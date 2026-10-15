// /api/routine-db op talk_field (15/10/2026, Michael: "בצע: הדרכה שבועית מהשטח"): the Sunday Routine
// adds "what happened here this week" to each department's section of the shared weekly draft
// (private.talk_week, id w<YYYYMMDD>). Only that draft, only this week, only unsigned; appended at the
// end of the department's section, a second call replaces only that part; plain keyboard text, no
// ID-like digits, at most 1200 characters. The worker's page still sees the same sections.
import { onRequest, talkFieldApply, TALK_FIELD_HEAD, TALK_DRAFT, TALK_FIELD_MAX, TABLES, COLUMNS, cleanQuery } from './_build/routine-db.mjs';
import { sectionsOf } from './_build/talk.mjs';

let pass = 0, fail = 0;
const check = (l, c, d) => { if (c) { pass++; console.log('  ✓ ' + l); } else { fail++; console.log('  ✗ ' + l + (d !== undefined ? '  -> ' + JSON.stringify(d).slice(0, 400) : '')); } };
const SB = 'https://znhjtpcltrxxyfjczgvw.supabase.co';
const ENV = { ROUTINE_KEY: 'k-123', SUPABASE_SERVICE_ROLE_KEY: 'srv' };
const today = new Date(Date.now() + 3 * 3600e3).toISOString().slice(0, 10);
const dayAgo = (n) => new Date(Date.parse(today + 'T00:00:00Z') - n * 864e5).toISOString().slice(0, 10);
const wid = (d) => 'w' + d.replace(/-/g, '');
const A = 'טוגנים', B = 'אריזה', C = 'מעבדה';
const BODY = '## ' + A + '\nנושא 1\nטקסט 1\n\n## ' + B + '\nנושא 2\nטקסט 2\n\n## ' + C + '\nנושא 3';
const TXT = 'בשבוע שעבר היה כמעט תאונה ליד המכונה. זה חשוב כי יד יכולה להיתפס.\nמה עושים: עוצרים לפני ניקוי.';
const TXT2 = 'נוסח שני: היה מפגע של חומר על הרצפה. מנקים מיד.';
const draft = (o = {}) => ({ id: wid(today), d: today, s: TALK_DRAFT, kind: null, dept: null, created_by: 'routine', body: BODY, ...o });

let talks = [], reads = [], calls = [];
globalThis.fetch = async (url, opt = {}) => {
  const method = opt.method || 'GET';
  calls.push({ url, method, body: opt.body });
  if (url.startsWith(SB + '/rest/v1/toolbox_reads')) {
    const id = decodeURIComponent((/talk_id=eq\.([^&]*)/.exec(url) || [])[1] || '');
    return new Response(JSON.stringify(reads.filter((r) => r.talk_id === id).slice(0, 1).map((r) => ({ id: r.id }))), { status: 200 });
  }
  if (url.startsWith(SB + '/rest/v1/toolbox_talks')) {
    const id = decodeURIComponent((/[?&]id=eq\.([^&]*)/.exec(url) || [])[1] || '');
    const s = /[?&]s=eq\.([^&]*)/.exec(url);
    const hit = talks.filter((t) => t.id === id && (!s || t.s === decodeURIComponent(s[1])));
    if (method === 'PATCH') { hit.forEach((t) => Object.assign(t, JSON.parse(opt.body))); return new Response(JSON.stringify(hit), { status: 200 }); }
    return new Response(JSON.stringify(hit.map((t) => ({ ...t }))), { status: 200 });
  }
  return new Response('[]', { status: 200 });
};
const call = async (body, key = 'k-123') => {
  const r = await onRequest({ request: new Request('https://x/api/routine-db', { method: 'POST', headers: { 'x-routine-key': key, 'content-type': 'application/json' }, body: JSON.stringify(body) }), env: ENV });
  return { status: r.status, json: await r.json() };
};
const patches = () => calls.filter((c) => c.method === 'PATCH');

(async () => {
  console.log('\n1. the key');
  talks = [draft()]; calls = [];
  check('no key: 403, nothing read or written', (await call({ op: 'talk_field', id: wid(today), dept: A, text: TXT }, '')).status === 403 && !calls.length);
  check('wrong key: 403', (await call({ op: 'talk_field', id: wid(today), dept: A, text: TXT }, 'nope')).status === 403 && !calls.length);

  console.log('\n2. only this week\'s shared weekly draft');
  const refused = async (row, label, want) => {
    talks = [row]; calls = [];
    const r = await call({ op: 'talk_field', id: row.id, dept: A, text: TXT });
    check(label, r.status === 400 && !patches().length && talks[0].body === BODY && (!want || want.test(r.json.error)), r.json);
  };
  await refused(draft({ s: 'פורסם' }), 'published: refused, body untouched', /draft/);
  await refused(draft({ kind: 'annual' }), 'annual talk: refused', /weekly/);
  await refused(draft({ kind: 'induction' }), 'induction talk: refused', /weekly/);
  await refused(draft({ created_by: 'michael' }), 'a draft the manager made: refused', /weekly/);
  await refused(draft({ dept: A }), 'a one-department talk: refused', /weekly/);
  await refused(draft({ id: wid(dayAgo(8)), d: dayAgo(8) }), 'last week\'s draft: refused', /week/);
  await refused(draft({ id: wid(dayAgo(-1)), d: dayAgo(-1) }), 'a draft dated tomorrow: refused', /week/);
  await refused(draft({ d: dayAgo(1) }), 'd that does not match the id: refused', /week/);
  talks = [draft()]; calls = [];
  check('an id outside w<YYYYMMDD>: refused before any read', (await call({ op: 'talk_field', id: 'abc', dept: A, text: TXT })).status === 400 && !calls.length);
  check('an extra field (s, body_ar): refused, nothing read', (await call({ op: 'talk_field', id: wid(today), dept: A, text: TXT, s: 'x' })).status === 400 && (await call({ op: 'talk_field', id: wid(today), dept: A, text: TXT, body_ar: 'x' })).status === 400 && !calls.length);
  check('a department that has no section: refused', (await call({ op: 'talk_field', id: wid(today), dept: 'אחר', text: TXT })).status === 400 && !patches().length);
  talks = [draft()]; reads = [{ id: 'r1', talk_id: wid(today) }]; calls = [];
  let r = await call({ op: 'talk_field', id: wid(today), dept: A, text: TXT });
  check('someone already signed: refused, body untouched', r.status === 400 && /signed/.test(r.json.error) && !patches().length && talks[0].body === BODY, r.json);
  reads = [];
  check('a draft 6 days old: allowed', !talkFieldApply(draft({ id: wid(dayAgo(6)), d: dayAgo(6) }), { dept: A, text: TXT }, today).error);

  console.log('\n3. appended at the end of the department\'s section, replaced on a second call');
  talks = [draft()]; calls = [];
  r = await call({ op: 'talk_field', id: wid(today), dept: B, text: TXT });
  const b1 = talks[0].body;
  check('written: ok, one PATCH, body only, with s=draft in the filter', r.json.ok && r.json.changed && patches().length === 1 && Object.keys(JSON.parse(patches()[0].body)).join() === 'body' && patches()[0].url.indexOf('&s=eq.' + encodeURIComponent(TALK_DRAFT)) > 0, { r: r.json, p: patches() });
  check('the original text is all still there, in order', b1.indexOf('נושא 2\nטקסט 2\n\n' + TALK_FIELD_HEAD + '\n' + TXT + '\n\n## ' + C) > 0 && b1.startsWith('## ' + A + '\nנושא 1\nטקסט 1\n\n## ' + B), b1);
  const sec = sectionsOf(b1);
  check('the worker page sees the same 3 sections, the part inside its department only', sec.list.map((x) => x.dept).join() === [A, B, C].join() && sec.list[1].text.indexOf(TALK_FIELD_HEAD) > 0 && sec.list[0].text.indexOf(TALK_FIELD_HEAD) < 0 && sec.list[2].text.indexOf(TALK_FIELD_HEAD) < 0, sec);
  calls = [];
  r = await call({ op: 'talk_field', id: wid(today), dept: B, text: TXT });
  check('the same text again: no write (changed:false)', r.json.ok && r.json.changed === false && !patches().length, r.json);
  r = await call({ op: 'talk_field', id: wid(today), dept: B, text: TXT2 });
  const b2 = talks[0].body;
  check('a new text: replaces only that part (one header, the old text gone)', r.json.ok && r.json.replaced && b2.split(TALK_FIELD_HEAD).length === 2 && b2.indexOf(TXT) < 0 && b2 === b1.replace(TXT, TXT2), b2);
  r = await call({ op: 'talk_field', id: wid(today), dept: C, text: TXT });
  const b3 = talks[0].body;
  check('the last department: appended at the end of the body', b3.endsWith('נושא 3\n\n' + TALK_FIELD_HEAD + '\n' + TXT) && b3.startsWith(b2), b3);
  r = await call({ op: 'talk_field', id: wid(today), dept: C, text: TXT2 });
  check('the last department again: replaced, nothing else moves', talks[0].body === b2 + '\n\n' + TALK_FIELD_HEAD + '\n' + TXT2, talks[0].body);
  check('blank lines inside the text are dropped (they would end the part)', talkFieldApply(draft(), { dept: A, text: TXT + '\n\n\n' + TXT2 }, today).body.indexOf(TXT + '\n' + TXT2) > 0);
  check('body_ar / ru / am are never sent', !patches().some((p) => /body_(ar|ru|am)/.test(p.body)));

  console.log('\n4. the text: size, keyboard only, no ID-like digits, no headings');
  const bad = (text) => talkFieldApply(draft(), { dept: A, text }, today).error;
  check('1200 characters: allowed', !bad('א'.repeat(TALK_FIELD_MAX)));
  check('1201 characters: refused', /over/.test(bad('א'.repeat(TALK_FIELD_MAX + 1)) || ''));
  check('shorter than 20: refused', /short/.test(bad('קצר') || ''));
  ['—', '–', '«', '»', '“', '”', '’', '־', '…', '→'].forEach((ch) => check('not on a keyboard (U+' + ch.charCodeAt(0).toString(16) + '): refused', /keyboard/.test(bad(TXT + ' ' + ch + ' x') || '')));
  check('plain dash, quotes, colon, DD/MM/YYYY date: allowed', !bad(TXT + ' - "x" 12/10/2026: 3 פעמים.'));
  ['123456789', '0541234567', '12345678', '1234567', '054-1234567', '123 456 789'].forEach((n) => check('ID-like digits ' + n + ': refused', /ID/.test(bad(TXT + ' ' + n) || '')));
  check('six digits: allowed', !bad(TXT + ' 123456'));
  check('a "## " line (a new department section): refused', /heading/.test(bad(TXT + '\n## x') || ''));
  check('the fixed header inside the text: refused', /heading/.test(bad(TALK_FIELD_HEAD + ' ' + TXT) || ''));
  talks = [draft()]; calls = [];
  r = await call({ op: 'talk_field', id: wid(today), dept: A, text: TXT + ' 123456789' });
  check('through the endpoint: ID-like digits refused, nothing written', r.status === 400 && !patches().length && talks[0].body === BODY, r.json);

  console.log('\n5. reading the drafts: toolbox_talks, some columns only');
  check('toolbox_talks is on TABLES with a column list', TABLES.indexOf('toolbox_talks') >= 0 && Array.isArray(COLUMNS.toolbox_talks));
  check('select id,d,s,kind,dept,body with filters on them: allowed', cleanQuery('select=id,d,s,kind,dept,body&kind=is.null&d=gte.2026-10-11', 'toolbox_talks') !== null);
  check('the trainer signature / links / translations: refused', cleanQuery('select=trainer_sig_url', 'toolbox_talks') === null && cleanQuery('select=*', 'toolbox_talks') === null && cleanQuery('select=body_ar', 'toolbox_talks') === null);

  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.log('HARNESS ERROR: ' + (e && e.stack || e)); process.exit(1); });
