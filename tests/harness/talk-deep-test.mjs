// The deep review of the worker signing pages (15/10/2026): the server side of each fix, on the real talk.js
// with fetch mocked. The browser side (draft, photos, digits as typed, the pad, the send button) is in
// talk-draft-test.mjs; form 08.01 in talk-0801-browser-test.mjs; the steps of the induction filing in
// talk-induction-file-test.mjs; "cannot check" in talk-miss-mail-test.mjs.
import fs from 'fs';
import { onRequest, makeTalkToken, makePermToken, LANGS, idOf, idCmp, latinDigits, indFields, HE_ONLY_PATTERN, heText, ttsUpstream, FETCH_MS, PLAYER, FILE_LINK_SEC, SIGN_MS, langOfAccept, textHe } from './_build/talk.mjs';
import { heName, hebrewName, hebrewText } from './_build/_ai.mjs';

let pass = 0, fail = 0;
const check = (l, c, d) => { if (c) { pass++; console.log('  ✓ ' + l); } else { fail++; console.log('  ✗ ' + l + (d !== undefined ? '  -> ' + JSON.stringify(d).slice(0, 400) : '')); } };
const SB = 'https://znhjtpcltrxxyfjczgvw.supabase.co';
const URL0 = 'https://tapugan-safety.pages.dev/api/talk';
const ENV = { SUPABASE_SERVICE_ROLE_KEY: 'srv', TRUSTEE_NOTIFY_SECRET: 'nsec', GEMINI_API_KEY: 'g' };
const SRC = fs.readFileSync(new URL('../../functions/api/talk.js', import.meta.url), 'utf8');
const IDX = fs.readFileSync(new URL('../../index.html', import.meta.url), 'utf8');
const T = {
  wk: { id: 'wk1', d: '2026-10-11', s: 'פורסמה', title: 'שיחה משותפת', body: 'לכולם\n## טוגנים\nשמן חם\n## אריזה\nסכינים',
    body_ar: 'حديث مشترك\nللجميع\n## المقالي\nزيت ساخن\n## التغليف\nسكاكين', body_ru: 'Общая беседа\nВсем\n## Жарка\nГорячее масло', kind: null, link_v: 0, file_url: SB + '/storage/v1/object/public/incidents-photos/tb-1.pdf', video_url: SB + '/storage/v1/object/public/incidents-photos/v-1.mp4' },
  t1: { id: 't1', d: '2026-10-11', s: 'פורסמה', title: 'סולמות', body: 'לבדוק סולם', kind: null, link_v: 0 },
  ann: { id: 'an1', d: '2026-10-20', s: 'פורסמה', title: 'שנתית', body: '', subjects: 'כיבוי אש', kind: 'annual', link_v: 0, trainer_signed_at: 'x', body_ar: 'سنوي' },
};
const EMPS = [{ id: 'e1', n: 'דנה כהן', dep: 'ייצור', eid: '012345678' }, { id: 'e2', n: 'אחמד', dep: 'אריזה', eid: '' }, { id: 'e3', n: 'יוסי לוי', dep: 'ייצור', eid: '987654321' }];
let w;
const reset = (o) => { w = { inserts: [], ai: [], aiAnswer: 'איוון פטרוב', aiDelay: 0, signs: [], inflight: 0, maxInflight: 0, delay: 0, hang: false, talkFail: false, ...o }; };
reset();
globalThis.fetch = async (url, init) => {
  const u = String(url), m = (init && init.method) || 'GET';
  const json = (o, st = 200) => new Response(JSON.stringify(o), { status: st, headers: { 'Content-Type': 'application/json' } });
  w.inflight++; w.maxInflight = Math.max(w.maxInflight, w.inflight);
  try {
    if (w.delay) await new Promise((r) => setTimeout(r, w.delay));
    if (u.startsWith('https://generativelanguage.googleapis.com/')) { w.ai.push(JSON.parse(init.body).contents[0].parts[0].text); if (w.aiDelay) await new Promise((r) => setTimeout(r, w.aiDelay)); return json({ candidates: [{ content: { parts: [{ text: typeof w.aiAnswer === 'function' ? w.aiAnswer(w.ai[w.ai.length - 1]) : w.aiAnswer }] } }] }); }
    if (u.startsWith(SB + '/rest/v1/toolbox_talks')) { if (w.talkFail) throw new Error('db down'); const id = decodeURIComponent((u.match(/id=eq\.([^&]+)/) || [])[1] || ''); return json(Object.values(T).filter((t) => t.id === id).map((t) => ({ ...t }))); }
    if (u.startsWith(SB + '/rest/v1/emp')) return m === 'PATCH' ? new Response(null, { status: 204 }) : json(EMPS);
    if (u.startsWith(SB + '/rest/v1/toolbox_reads')) {
      if (m === 'POST') { if (w.hang) return await new Promise(() => {}); w.inserts.push(JSON.parse(init.body)); return new Response(null, { status: 201 }); }
      return json([]);
    }
    if (u.startsWith(SB + '/storage/v1/object/sign/')) { w.signs.push(JSON.parse(init.body)); return json({ signedURL: '/object/sign/incidents-photos/x?token=t' }); }
    if (u.startsWith(SB + '/storage/v1/object/')) return json({ Key: 'x' });
    if (u.startsWith(SB + '/rest/v1/server_state')) return json([{ value: '246810' }]);
    if (u.startsWith(SB + '/rest/v1/rpc/')) return json(1);
    return json({ error: 'unexpected ' + u }, 599);
  } finally { w.inflight--; }
};
const png = new Uint8Array(1024); png.set([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A], 0);
const SIG = 'data:image/png;base64,' + Buffer.from(png).toString('base64');
const get = async (tok, q, h) => { const r = await onRequest({ request: new Request(URL0 + '?k=' + encodeURIComponent(tok) + (q || ''), { headers: h || {} }), env: ENV }); return { st: r.status, h: await r.text(), csp: r.headers.get('content-security-policy') || '' }; };
const post = async (f, h) => { const fd = new FormData(); for (const [a, b] of Object.entries({ ok: '1', sig: SIG, ...f })) fd.append(a, b); const r = await onRequest({ request: new Request(URL0, { method: 'POST', body: fd, headers: { 'user-agent': 'iPhone Mobile', ...(h || {}) } }), env: ENV, waitUntil: () => {} }); return { st: r.status, h: await r.text() }; };
const kw = await makeTalkToken(ENV, 'wk1'), k1 = await makeTalkToken(ENV, 't1'), ka = await makePermToken(ENV, 'an1', 0);

console.log('\n1. a translated shared talk: sections by their place (A4)');
{
  const p = await get(kw, '&l=ar');
  check('the Arabic page: each option is the Hebrew department, labelled in Arabic', p.st === 200 && p.h.includes('<option value="טוגנים">المقالي</option>') && p.h.includes('<option value="אריזה">التغليف</option>'), p.h.slice(p.h.indexOf('id="wdep"'), p.h.indexOf('id="wdep"') + 300));
  check('...each section block keyed by the Hebrew department, its text in Arabic', p.h.includes('data-dep="טוגנים"') && p.h.includes('زيت ساخن') && !p.h.includes('data-dep="المقالي"'));
  check('...so the name list (data-t, Hebrew) still matches the department picked', p.h.includes('data-t="אריזה"'));
  check('...the picker\'s heading in Arabic, not Hebrew', p.h.includes(LANGS.ar.wdep) && p.h.includes(LANGS.ar.wpick) && !p.h.includes('המחלקה שלך'));
  const pr = await get(kw, '&l=ru');
  check('a translation with a different number of sections: the Hebrew sections, still signable', pr.h.includes('<option value="טוגנים">טוגנים</option>') && pr.h.includes('<option value="אריזה">אריזה</option>'));
  reset();
  let r = await post({ k: kw, l: 'ar', emp: 'e1', oid: '12345678', wdep: 'טוגנים' });
  check('signed in Arabic: the row keeps the Hebrew department', r.st === 200 && w.inserts[0] && w.inserts[0].dept === 'טוגנים', [r.st, w.inserts[0] && w.inserts[0].dept]);
  reset();
  r = await post({ k: kw, l: 'ar', emp: 'e1', oid: '12345678', wdep: 'المقالي' });
  check('an Arabic department name is refused (the server checks the Hebrew list), nothing saved', r.st === 400 && !w.inserts.length, r.st);
  check('the translate prompt keeps "## " lines as they are', /Keep every line that starts with ## unchanged/.test(IDX));
}

console.log('\n2. "not on the list" with the ID of a card (A5), leading zeros (A7)');
{
  reset();
  let r = await post({ k: k1, emp: '__other', oname: 'Dana K', oid: '12345678', ocomp: 'ACME' });
  const row = w.inserts[0] || {};
  check('signed as the card: emp_id of the card, the card\'s name, no AI call (the ID wins over the typed name)', r.st === 200 && row.emp_id === 'e1' && row.emp_name === 'דנה כהן' && !w.ai.length, row);
  reset();
  r = await post({ k: k1, emp: '__other', oname: 'יוסי לוי', oid: '555666777' });
  check('an ID on no card: still outside the list, as before', r.st === 200 && /^x:555666777:/.test((w.inserts[0] || {}).emp_id || ''), w.inserts[0]);
  reset();
  r = await post({ k: k1, emp: 'e1', oid: '12345678' });
  check('a worker on the list, his card "012345678", typed "12345678": the same number, signed', r.st === 200 && w.inserts.length === 1, r.st);
  reset();
  r = await post({ k: k1, emp: 'e2', oid: '0987654321' });
  check('another worker\'s number with a leading zero is still another worker\'s: refused', r.st === 403 && !w.inserts.length, r.st);
  check('idCmp: leading zeros only for all-digit IDs', idCmp('012345678') === '12345678' && idCmp('0AB123') === '0AB123' && idCmp('12') === null);
  check('the employee card credits by emp_id first, by the ID only a signature from outside the list', /ex===id\|\|\(ex\.indexOf\('x:'\)===0&&eid&&_tbtIdKey\(x\.id_no\)===eid\)/.test(IDX));
}

console.log('\n3. errors: an ID heading, a page in the worker\'s language with a way back (B4), one deadline (C8)');
{
  reset();
  let r = await post({ k: k1, l: 'ru', emp: 'e1', oid: '' });
  check('no ID: the page is titled "ID", not "missing name" (all 4 languages have it)', r.st === 400 && r.h.includes('<title>' + LANGS.ru.errIdT + '</title>') && ['he', 'ar', 'ru', 'am'].every((l) => LANGS[l].errIdT && LANGS[l].errIdT !== LANGS[l].errNameT), r.h.slice(0, 300));
  r = await post({ k: k1, l: 'ar', emp: 'e1', oid: '111222333' });
  check('an ID that is not the card\'s: titled "ID" too', r.st === 403 && r.h.includes('<title>' + LANGS.ar.errIdT + '</title>'));
  reset({ talkFail: true });
  r = await post({ k: k1, l: 'am', emp: 'e1', oid: '12345678' });
  check('the database throws: 503 in Amharic with the link back to the form (it was a Hebrew page with no way back)', r.st === 503 && r.h.includes(LANGS.am.errSave) && r.h.includes(LANGS.am.back) && r.h.includes('/api/talk?k='), [r.st, r.h.slice(0, 200)]);
  const bad = await onRequest({ request: new Request(URL0, { method: 'POST', body: 'not a form', headers: { 'Content-Type': 'multipart/form-data; boundary=zz', 'Accept-Language': 'ru-RU,ru;q=0.9,en;q=0.5' } }), env: ENV });
  const bh = await bad.text(), bn = (bad.headers.get('content-security-policy') || '').match(/nonce-([a-z0-9]+)/);
  check('a form that cannot be read: in the browser\'s language, a "back to the form" button that works (its script allowed)', bad.status === 400 && bh.includes(LANGS.ru.errForm) && bh.includes('id="bk"') && /history\.back\(\)/.test(bh) && !!bn && bh.includes('<script nonce="' + bn[1] + '">'), bh.slice(0, 300));
  check('Accept-Language: the first of ours, "iw" is Hebrew, anything else Hebrew', langOfAccept('am-ET,en') === 'am' && langOfAccept('iw') === 'he' && langOfAccept('fr-FR,ar;q=0.8') === 'ar' && langOfAccept('') === 'he');
  // One deadline for the whole request: the time scaled down here, the insert never answers.
  const st0 = globalThis.setTimeout;
  globalThis.setTimeout = (fn, ms, ...a) => st0(fn, ms === SIGN_MS ? 40 : ms, ...a);
  reset({ hang: true });
  const t0 = Date.now();
  r = await post({ k: k1, l: 'ru', emp: 'e1', oid: '12345678' });
  globalThis.setTimeout = st0;
  check('a request that hangs ends at its one deadline (' + SIGN_MS / 1000 + 's): 503 in Russian with the way back', r.st === 503 && r.h.includes(LANGS.ru.errSave) && r.h.includes(LANGS.ru.back) && Date.now() - t0 < 2000, [r.st, Date.now() - t0]);
  reset({ aiDelay: 150 });
  const t1 = Date.now();
  r = await post({ k: k1, emp: '__other', oname: 'Ivan Petrov', oid: '444555666', ocomp: 'ACME 3' });
  check('the name and the company asked at the same time (C8)', r.st === 200 && w.ai.length === 2 && Date.now() - t1 < 280, [r.st, w.ai.length, Date.now() - t1]);
}

console.log('\n4. a page that cannot load (B4), reads at once (C7), files for 12 hours (C9)');
{
  reset({ talkFail: true });
  const p = await get(k1, '&l=ar');
  check('the database down: 503 in Arabic, "try again" to the same link', p.st === 503 && p.h.includes(LANGS.ar.errLoad) && p.h.includes('id="retry"') && p.h.includes('href="/api/talk?k=') && p.h.includes('l=ar'), [p.st, p.h.slice(0, 200)]);
  reset({ delay: 40 });
  const t0 = Date.now();
  const q = await get(kw);
  check('the workers, the file and the video read at the same time, not one after another', q.st === 200 && w.maxInflight >= 3, [q.st, w.maxInflight, Date.now() - t0]);
  check('the file and the video signed for 12 hours (it was one, and ran out on a page left open)', FILE_LINK_SEC === 43200 && w.signs.length === 2 && w.signs.every((b) => b.expiresIn === 43200), w.signs);
}

console.log('\n5. Arabic-Indic digits (B5), curly quotes (B6), text that is not a name (B7), long names (C10)');
{
  check('idOf: Arabic-Indic and Persian digits are 0-9', idOf('١٢٣٤٥٦٧٨٩') === '123456789' && idOf('۰۱۲۳۴۵۶۷۸') === '012345678' && latinDigits('٠٥٢-١٢٣') === '052-123');
  const fd = new FormData(); for (const [a, b] of Object.entries({ ino: '١٢٣٤', idep: 'טוגנים', iph: '٠٥٢-١٢٣٤٥٦٧', ijob: 'מפעיל', iagn: '' })) fd.append(a, b);
  const f = indFields(fd);
  check('the induction\'s worker number and phone in Arabic-Indic digits are kept, as 0-9', f.ok && f.v.emp_no === '1234' && f.v.phone === '0521234567', f);
  reset();
  let r = await post({ k: k1, emp: 'e3', oid: '٩٨٧٦٥٤٣٢١' });
  check('a worker signs with his ID in Arabic-Indic digits', r.st === 200 && w.inserts[0] && w.inserts[0].id_no === '987654321', r.st);
  check('heName: curly quotes and the accent of an iPhone are plain quotes', heName('ג’ורג’ לוי') === "ג'ורג' לוי" && heName('צ´רלי') === "צ'רלי" && heText('כ„א 2') === 'כ"א 2');
  const re = new RegExp('^(?:' + HE_ONLY_PATTERN + ')$', 'v');
  check('the annual page\'s pattern (checked by the browser on the raw value) accepts them', re.test('ג’ורג’ לוי') && re.test('צ´רלי') && !re.test('George'));
  reset();
  r = await post({ k: ka, emp: '__other', oname: 'ג’ורג’ לוי', oid: '333444555', idep: 'אריזה' });
  check('...and the server saves the name with plain quotes', r.st === 200 && w.inserts[0] && w.inserts[0].emp_name === "ג'ורג' לוי", [r.st, w.inserts[0] && w.inserts[0].emp_name]);
  reset({ aiAnswer: 'מפעיל קו 3' });
  check('hebrewText: a job with a digit from the assistant is kept; hebrewName refuses the same answer', (await hebrewText(ENV, 'line 3 operator')) === 'מפעיל קו 3' && (await hebrewName(ENV, 'line 3 operator')) === null);
  reset({ aiAnswer: (t) => (/job title/.test(t) ? 'not hebrew' : 'איוון פטרוב') });
  r = await post({ k: k1, emp: '__other', oname: 'Ivan Petrov', oid: '777888999', ocomp: 'ACME' });
  check('the optional company that cannot be put in Hebrew is left out, the signature saved (it was refused)', r.st === 200 && w.inserts[0] && w.inserts[0].emp_name === 'איוון פטרוב' && w.inserts[0].dept === null, [r.st, w.inserts[0]]);
  reset({ aiAnswer: 'א'.repeat(35) + ' ' + 'ב'.repeat(35) });
  check('a long Arabic name spelled by the assistant: up to 80 Hebrew letters (C10); typed by a person still 60', (await hebrewName(ENV, 'عبد الرحمن بن محمد بن عبد العزيز')) === 'א'.repeat(35) + ' ' + 'ב'.repeat(35) && heName('א'.repeat(70)) === null);
  check('textHe goes through the same AI limit as names', /export async function textHe[\s\S]{0,300}TLK_AI_LIMIT\) return null;/.test(SRC) && typeof textHe === 'function');
}

console.log('\n6. the pages: the read-aloud voice (B2, B9), the code page (C11), cosmetic');
{
  // B2: the time limit is on the headers only. Scaled down here: 20s become 50ms, the audio streams for 300ms.
  const st0 = globalThis.setTimeout, at0 = AbortSignal.timeout;
  globalThis.setTimeout = (fn, ms, ...a) => st0(fn, ms === FETCH_MS ? 50 : ms, ...a);
  AbortSignal.timeout = (ms) => { const c = new AbortController(); st0(() => c.abort(), ms === FETCH_MS ? 50 : ms); return c.signal; };
  const f0 = globalThis.fetch;
  globalThis.fetch = async (u, init) => {
    const sig = init && init.signal;
    const body = new ReadableStream({ async start(c) { for (let i = 0; i < 6; i++) { await new Promise((r) => st0(r, 50)); if (sig && sig.aborted) { c.error(new Error('aborted')); return; } c.enqueue(new TextEncoder().encode('data: {"x":' + i + '}\n\n')); } c.close(); } });
    return new Response(body, { status: 200, headers: { 'Content-Type': 'text/event-stream' } });
  };
  const up = await ttsUpstream(ENV, 'שלום', 'he');
  let txt = '', err = null;
  try { txt = await up.r.text(); } catch (e) { err = String(e); }
  globalThis.fetch = f0; globalThis.setTimeout = st0; AbortSignal.timeout = at0;
  check('a long read-aloud is not cut when the time limit passes: it covers the headers, not the stream', !err && (txt.match(/data:/g) || []).length === 6, { err, n: (txt.match(/data:/g) || []).length });
  const iAC = PLAYER.indexOf('new AC()'), iAS = PLAYER.indexOf("navigator.audioSession.type='playback'");
  check('iPhone silent switch: the audio session is set to playback before the audio starts', iAS > 0 && iAS < iAC);
  reset();
  const ki = await makePermToken(ENV, 'in1', 0);
  T.in1 = { id: 'in1', d: null, s: 'פורסמה', title: 'קליטה', body: 'x', kind: 'induction', link_v: 0 };
  const cp = await get(ki);
  const cn = (cp.csp.match(/nonce-([a-z0-9]+)/) || [])[1];
  check('the HR code page: one press sends once (the button disabled on submit, let go after a while), its script allowed', cp.h.includes('id="icf"') && /f\.addEventListener\("submit",function\(\)\{b\.disabled=true;/.test(cp.h) && !!cn && cp.h.includes('<script nonce="' + cn + '">'), cp.h.slice(-500));
  delete T.in1;
  const he = await get(k1), ru = await get(k1.replace(/^/, ''), '&l=ru');
  check('the name list has its label (for="emp")', he.h.includes('<label for="emp"'));
  T.t1.body_ru = 'Лестницы\nПроверить лестницу';
  const ru2 = await get(k1, '&l=ru');
  check('a left-to-right page: the ID box is aligned left; a Hebrew page right', /id="oid"[^>]*text-align:left/.test(ru2.h) && /id="oid"[^>]*text-align:right/.test(he.h), [ru.st]);
  delete T.t1.body_ru;
  const an = await get(ka, '&l=ar');
  check('the annual page in Arabic: the topics heading and the face-to-face line translated', an.h.includes(LANGS.ar.topics) && an.h.includes(LANGS.ar.f2f) && !an.h.includes('נושאי ההדרכה</div>'));
  for (const l of Object.keys(LANGS)) {
    const bad = ['errIdT', 'wdep', 'wpick', 'topics', 'f2f', 'errLoad', 'retry', 'errForm', 'backF'].filter((k) => !LANGS[l][k] || /[–—־«»“”‘’…·]/.test(LANGS[l][k]));
    check('the new words in ' + l + ': all there, keyboard characters only', bad.length === 0, bad);
  }
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
