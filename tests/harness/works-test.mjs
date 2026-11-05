// The weekly works link (05/11/2026, Michael in the questionnaire): maintenance fills the Friday works in a signed
// link, every work becomes a ptw row waiting for Michael's approval, the contractor is checked against ctr, the gas test
// of a confined space and the fire watch of hot work must be in before approval, lock-out / tag-out, attachments
// (by their bytes), closing from the phone (never with a lock open), the Friday's plant representative.
// The 5-minute clock: Wednesday 18:00 the mail (only when works_mail_on), Thursday 12:00 the reminder, Sunday 08:00
// permits not closed. Mocked network, nothing leaves.
import { onRequest, makeWorksToken, readWorksToken, fridayOf, CATS, S_PEND, S_CANCEL, S_REJ, S_CLOSED, EMP_LABEL, CHECK_MARK, GATE_MARK, NOTE_LINE, REJ_MARK, kindsIn, ctrKey, ctrIssue,
  parseSafety, buildSafety, assess, GAS_LIMITS, worksTick, worksTryMail, worksApproveMail, TRY_PREFIX, mailHtml, mailList, MAIL_SUBJECT, submitText, remindText, openText, MAX_ROWS, DEPTS, fileType, closeCheck, mailDeps, makeOkToken, readOkToken, OK_PREFIX, S_OK, APPROVE_SUBJECT, OKN_MARK, DECIDE_SUBJECT,
  PERMIT_MARK, PERMIT_ERR, PERMIT_TO, PERMIT_SUBJECT, permitHtml, worksPermit } from './_build/works.mjs';
import { readFileSync } from 'fs';
import { readZip, entryText } from './_build/_xlsxpatch.mjs';
import { PDFDocument, PDFName, StandardFonts } from './_build/_pdflib.mjs';
import { SIGN_MARK, FILED_DIR, OD_SAFETY } from './_build/_permit.mjs';
import { makeLinkToken } from './_build/_closelink.mjs';
import { run as morningRun } from './_build/wa-morning.mjs';
import { SITE } from './_build/_site.mjs';

let pass = 0, fail = 0;
const check = (l, c, d) => { if (c) { pass++; console.log('  ✓ ' + l); } else { fail++; console.log('  ✗ ' + l + (d !== undefined ? '  -> ' + JSON.stringify(d).slice(0, 500) : '')); } };
const SB = 'https://znhjtpcltrxxyfjczgvw.supabase.co';
const ORIGIN = 'https://tapugan-safety.pages.dev';
const URL0 = ORIGIN + '/api/works';
const ENV = { SUPABASE_SERVICE_ROLE_KEY: 'srv', TRUSTEE_NOTIFY_SECRET: 'nsec', META_PHONE_NUMBER_ID: 'pid', META_ACCESS_TOKEN: 'mtok' };
// Thursday 05/11/2026 10:00 Israel; the Friday is 06/11/2026.
let NOW = Date.parse('2026-11-05T08:00:00Z');
const FRI = '2026-11-06';

const db = {};
const resetDb = () => Object.assign(db, { ptw: {}, state: {}, wa: [], mails: [], ptwPosts: 0, patches: [], ctrFail: false, files: {}, approveAfterRead: null });
// The approval mail (05/11/2026) goes through these, never to Graph.
mailDeps.accessToken = async () => ({ token: 'gt', email: 'owner@tapugan.co.il' });
mailDeps.sendMailTo = async (t, to, cc, subj, html) => { db.mails.push({ to, cc, subj, html }); return true; };
resetDb();
const CTR = [
  { n: 'ט"ס פרויקטים בע"מ', e: '2027-03-01', s: 'פעיל', tr: 'הוכשר' },
  { n: 'נגב אקולוגיה', e: '2026-10-01', s: 'פעיל', tr: 'הוכשר' },
];
const sFilter = (u) => {
  const inn = /[?&]s=in\.\(([^)]*)\)/.exec(u), notin = /[?&]s=not\.in\.\(([^)]*)\)/.exec(u), neq = /[?&]s=neq\.([^&]+)/.exec(u);
  if (inn) { const l = decodeURIComponent(inn[1]).split(','); return (s) => l.indexOf(s) >= 0; }
  if (notin) { const l = decodeURIComponent(notin[1]).split(','); return (s) => l.indexOf(s) < 0; }
  if (neq) { const v = decodeURIComponent(neq[1]); return (s) => s !== v; }
  return () => true;
};
globalThis.fetch = async (url, init) => {
  const u = String(url), m = (init && init.method) || 'GET';
  const json = (o, st = 200) => new Response(JSON.stringify(o), { status: st, headers: { 'Content-Type': 'application/json' } });
  if (u.startsWith(SB + '/rest/v1/app_users')) return json([u.includes('michael') ? { role: 'מנהל', active: true } : { role: 'צופה', active: true }]);
  if (u.startsWith(SB + '/rest/v1/ptw')) {
    const ok = sFilter(u);
    if (m === 'GET') {
      const eq = /id=eq\.([^&]+)/.exec(u);
      const like = decodeURIComponent((/id=like\.([^&]+)/.exec(u) || [])[1] || '').replace(/\*$/, '');
      const out = json(Object.values(db.ptw).filter((r) => (eq ? r.id === decodeURIComponent(eq[1]) : r.id.startsWith(like)) && ok(r.s)).sort((a, b) => a.id.localeCompare(b.id)).map((r) => ({ ...r })));
      if (db.approveAfterRead) { db.ptw[db.approveAfterRead].s = 'פתוח'; db.approveAfterRead = null; }  // Michael approves meanwhile
      return out;
    }
    if (m === 'POST') {
      const rows = JSON.parse(init.body);
      if (/on_conflict/.test(u) || rows.some((r) => db.ptw[r.id])) return json({ code: '23505' }, 409);
      db.ptwPosts++; rows.forEach((r) => { db.ptw[r.id] = Object.assign({}, r); }); return new Response(null, { status: 201 });
    }
    if (m === 'PATCH') {
      const ids = decodeURIComponent((/id=in\.\(([^)]*)\)/.exec(u) || /id=eq\.([^&]+)/.exec(u) || [])[1] || '').split(',');
      const b = JSON.parse(init.body); db.patches.push({ ids, b });
      if ('id' in b) return json({ message: 'id must not change' }, 400);
      ids.forEach((id) => { if (db.ptw[id] && ok(db.ptw[id].s)) Object.assign(db.ptw[id], b); });
      return new Response(null, { status: 204 });
    }
  }
  if (u.startsWith(SB + '/rest/v1/ctr')) return db.ctrFail ? json({ message: 'down' }, 500) : json(CTR);
  if (u.startsWith(SB + '/rest/v1/server_state')) {
    if (m === 'POST') { JSON.parse(init.body).forEach((r) => { db.state[r.key] = r.value; }); return new Response(null, { status: 201 }); }
    const one = /key=eq\.([^&]+)/.exec(u), many = /key=in\.\(([^)]*)\)/.exec(u);
    if (one) { const k = decodeURIComponent(one[1]); return json(k in db.state ? [{ key: k, value: db.state[k] }] : []); }
    if (many) return json(decodeURIComponent(many[1]).split(',').filter((k) => k in db.state).map((k) => ({ key: k, value: db.state[k] })));
    return json([]);
  }
  if (u.startsWith(SB + '/rest/v1/notification_prefs')) return json([{ prefs: { trustee_hazard: { whatsapp_to: '972500000001' } } }]);
  if (u.startsWith(SB + '/rest/v1/')) return json([]);
  if (u.startsWith(SB + '/storage/v1/object/list/incidents-photos')) {
    const pre = JSON.parse(init.body).prefix;
    if (db.staleList) { db.staleList = false; return json([]); }
    return json(Object.keys(db.files).filter((p) => p.startsWith(pre)).map((p) => ({ name: p.slice(pre.length), metadata: { size: db.files[p].size } })));
  }
  if (u.startsWith(SB + '/storage/v1/object/sign/incidents-photos')) return json(JSON.parse(init.body).paths.map((p) => ({ path: p, signedURL: '/object/sign/incidents-photos/' + p + '?token=t' })));
  if (u.startsWith(SB + '/storage/v1/object/incidents-photos/') && m === 'DE' + 'LETE') { delete db.files[decodeURIComponent(u.slice((SB + '/storage/v1/object/incidents-photos/').length))]; return json({}); }
  if (u.startsWith(SB + '/storage/v1/object/incidents-photos/') && m === 'POST') {
    const p = decodeURIComponent(u.slice((SB + '/storage/v1/object/incidents-photos/').length));
    db.files[p] = { size: init.body.length, type: init.headers['Content-Type'] }; return json({ Key: p });
  }
  if (u === SB + '/auth/v1/user') { const tok = init.headers.Authorization.replace('Bearer ', ''); return tok === 'good' ? json({ id: 'u1', email: 'michael@tfugen.local' }) : json({ id: 'u2', email: 'viewer@tfugen.local' }); }
  if (u.startsWith('https://graph.facebook.com/')) { db.wa.push(JSON.parse(init.body)); return json({ messages: [{ id: 'wamid.' + db.wa.length }] }); }
  return json({ error: 'unexpected ' + u }, 599);
};
const realNow = Date.now; Date.now = () => NOW;
const open = async (u) => { const r = await onRequest({ request: new Request(u), env: ENV }); return { st: r.status, h: await r.text(), r }; };
const WEEKF = [['f_w_week_rep', 'יוסי לוי'], ['f_w_week_rph', '050-7654321']];
const post = async (fields, opts) => {
  const p = new URLSearchParams();
  for (const [k, v] of (opts && opts.noWeek ? [] : WEEKF).concat(fields)) p.append(k, v);
  const r = await onRequest({ request: new Request(URL0, { method: 'POST', body: p.toString(), headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }), env: ENV });
  return { st: r.status, h: await r.text() };
};
const tok = await makeWorksToken(ENV, FRI, NOW);
const waText = (b) => (b && (b.text ? b.text.body : (b.interactive ? b.interactive.body.text : JSON.stringify(b.template || b)))) || '';
const work = (i, o) => Object.entries(o).flatMap(([k, v]) => (Array.isArray(v) ? v.map((x) => [k + '_' + i, x]) : [[k + '_' + i, v]]));
const W1 = { rid: '', desc: 'חדר אנרגיה: החלפת מד ספיקה 6 אינץ\' עם במת הרמה; החלפת מלכודת קיטור, ריתוך', area: 'חדר אנרגיה', dep: '', who: 'ctr', con: 'ט.ס פרויקטים', sup: 'נחום', ph: '050-1234567', wkr: 'יוסי, דני', ts: '07:00', te: '13:00', cat: ['hgt', 'hot'] };
const W2 = { rid: '', desc: 'מחלקת קילוף: ניקוי מיכל לחץ קיטור', area: 'קילוף', who: 'ctr', con: 'נגב אקולוגיה', sup: 'שלומי', cat: ['cnf'] };
const W3 = { rid: '', desc: 'החלפת נורה במשרד', who: 'emp', sup: 'אלינה' };
// chk: {kind: [measure indexes]}, fld: {kind: {field: value}}
const fieldsOf = (i, w, chk, fld) => {
  const o = Object.assign({}, w); delete o.cat;
  const out = work(i, o).concat((w.cat || []).map((k) => ['cat_' + i, k]));
  Object.entries(chk || {}).forEach(([k, arr]) => arr.forEach((j) => out.push(['chk_' + i + '_' + k, String(j)])));
  Object.entries(fld || {}).forEach(([k, o2]) => Object.entries(o2).forEach(([f, v]) => out.push(['f_' + i + '_' + k + '_' + f, v])));
  return out;
};
const GAS = { o2: '20.9', lel: '0', h2s: '0', co: '2', gat: '06:45', gby: 'שלומי', att: 'דני', rsc: 'חבל חילוץ וחצובה ליד הפתח' };

console.log('\n1. the token');
check('a token for a Friday reads back as that Friday', (await readWorksToken(ENV, tok, NOW)).id === FRI);
check('expired after 8 days', (await readWorksToken(ENV, tok, NOW + 9 * 86400000)).error === 'expired');
check('a token signed for another purpose (talk) is refused', (await readWorksToken(ENV, await makeLinkToken(ENV, 'talk-link:v1:', FRI, 8, NOW), NOW)).error === 'bad');
check('a works token whose id is not a date is refused', (await readWorksToken(ENV, await makeLinkToken(ENV, 'works-link:v1:', 'abc', 8, NOW), NOW)).error === 'bad');
check('a forged signature is refused', (await readWorksToken(ENV, tok.slice(0, -2) + 'xx', NOW)).error === 'bad');
check('the Friday of the week: Thursday -> tomorrow, Friday -> today, Saturday -> next week',
  fridayOf(new Date('2026-11-05T08:00:00Z')) === FRI && fridayOf(new Date('2026-11-06T08:00:00Z')) === FRI && fridayOf(new Date('2026-11-07T08:00:00Z')) === '2026-11-13');

console.log('\n2. the page');
let p = await open(URL0 + '?k=' + encodeURIComponent(tok));
check('opens 200, RTL Hebrew, the Friday in DD/MM/YYYY', p.st === 200 && p.h.includes('dir="rtl"') && p.h.includes('lang="he"') && p.h.includes('06/11/2026'), p.st);
check('mobile first: viewport, no-store, CSP with a nonce, no framing', p.h.includes('width=device-width') && p.r.headers.get('cache-control') === 'no-store' && /script-src 'nonce-[0-9a-f]{24}'/.test(p.r.headers.get('content-security-policy')) && p.r.headers.get('x-frame-options') === 'DENY');
check('all 8 kinds of the permit form with their measures', CATS.length === 8 && CATS.every((c) => p.h.includes(c.t)) && p.h.includes('קו חיים תקין') && p.h.includes('בדיקה סופית 30 דקות אחרי הסיום'));
check('the gas test, attendant and rescue plan under confined space; the fire watch under hot work; lock-out / tag-out', ['f_0_cnf_o2', 'f_0_cnf_lel', 'f_0_cnf_h2s', 'f_0_cnf_co', 'f_0_cnf_gat', 'f_0_cnf_gby', 'f_0_cnf_att', 'f_0_cnf_rsc', 'f_0_hot_fw', 'f_0_loto_pts', 'f_0_loto_lby', 'f_0_loto_rby', 'f_0_loto_rat', 'chk_0_loto'].every((n) => p.h.includes('name="' + n + '"')));
check('the Friday: plant representative and his phone; no first-aider field (Michael 05/11/2026)', p.h.includes('name="f_w_week_rep"') && p.h.includes('name="f_w_week_rph"') && !p.h.includes('name="f_w_week_aid"'));
check('the contractor list comes from ctr (datalist)', p.h.includes('<datalist id="ctrl">') && p.h.includes('נגב אקולוגיה'));
check('departments from SITE in a select, plus a free place field', DEPTS.length >= 5 && DEPTS.every((d) => p.h.includes('<option>' + d + '</option>')) && p.h.includes('name="area_0"'));
check('add-row template, a "no works" box, one list submit', p.h.includes('<template id="tpl">') && p.h.includes('name="none"') && (p.h.match(/type="submit" id="go"/g) || []).length === 1);
check('the page has only keyboard characters of its own (no long dash)', !/[–—…]/.test(p.h));
check('a bad token: 403 in Hebrew', (await open(URL0 + '?k=xx.yy.zz')).st === 403);
const expired = await open(URL0 + '?k=' + encodeURIComponent(await makeWorksToken(ENV, FRI, NOW - 9 * 86400000)));
check('an expired token: 403 "the link expired"', expired.st === 403 && expired.h.includes('הקישור פג'), expired.st);
check('a Friday already past with nothing in it: closed (410)', (await open(URL0 + '?k=' + encodeURIComponent(await makeWorksToken(ENV, '2026-10-30', NOW)))).st === 410);

console.log('\n3. the keywords');
check('welding / lift platform / tank / roof / crane / panel / isolation / solvent each name their kind', kindsIn('ריתוך צנרת').join() === 'hot' && kindsIn('עם במת הרמה').join() === 'hgt' && kindsIn('ניקוי מיכל').join() === 'cnf'
  && kindsIn('תיקון על הגג').join() === 'rof' && kindsIn('הרמה עם מנוף').join() === 'lft' && kindsIn('תיקון לוח').join() === 'elc' && kindsIn('נעילת מגוף').join() === 'eng' && kindsIn('ניקוי עם ממס').join() === 'chm');
check('pairs that must not match: "avur" (for) is not a pit, "mitachat" is not electrical, plain painting is nothing', kindsIn('עבור המחלקה').length === 0 && kindsIn('צביעת קיר מתחת לחלון').length === 0 && kindsIn('החלפת נורה במשרד').length === 0);
check('prefix letters: "u-ve-ritukh", "la-gag"', kindsIn('ובריתוך').join() === 'hot' && kindsIn('עלייה לגג').join() === 'rof');

console.log('\n4. the contractor check');
check('the name matches without quotes, dots or Ltd', ctrKey('ט.ס פרויקטים') === ctrKey('ט"ס פרויקטים בע"מ'));
check('a valid contractor: no flag', ctrIssue('ט.ס פרויקטים', CTR, FRI) === '');
check('an expired agreement: flagged with the date', /פג ב-01\/10\/2026/.test(ctrIssue('נגב אקולוגיה', CTR, FRI)));
check('not in the register: flagged', /לא במרשם הקבלנים/.test(ctrIssue('קבלן חדש', CTR, FRI)));

console.log('\n5. submit');
resetDb();
let r = await post([['k', tok]].concat(fieldsOf(0, W1, { hgt: [0, 1, 4], hot: [0, 1, 2] }, { hot: { fw: 'משה' } }), fieldsOf(1, W2, {})));
check('200 "sent for approval"', r.st === 200 && r.h.includes('נשלח לאישור') && r.h.includes('נשלחו 2 עבודות'), [r.st, r.h.slice(0, 300)]);
const ids = Object.keys(db.ptw).sort();
check('two ptw rows, stable ids wk-<friday>-1/2, one insert', ids.join() === 'wk-2026-11-06-1,wk-2026-11-06-2' && db.ptwPosts === 1, ids);
let a = db.ptw['wk-2026-11-06-1'], b = db.ptw['wk-2026-11-06-2'];
check('pending approval, dates = the Friday, times, contractor, responsible', a.s === S_PEND && a.ds === FRI && a.de === FRI && a.ts === '07:00' && a.te === '13:00' && a.con === 'ט.ס פרויקטים' && a.sup === 'נחום' && a.ph === '050-1234567', a);
check('types in the app\'s names, in the form\'s order', a.types === 'עבודות חמות, עבודה בגובה', a.types);
check('the ticked measures are kept per kind, with the fire watch', a.safety.includes('עבודה בגובה: רתמת בטיחות; קסדה; פיגום עם אישור') && a.safety.includes('עבודות חמות: היתר עבודה בחום; הרחקת חומרים דליקים; מטף כיבוי באתר; צופה האש (שם): משה'), a.safety);
const pa = parseSafety(a.safety);
check('...and read back the same (the page that opens again)', JSON.stringify(pa.chk.hgt.items) === '[0,1,4]' && JSON.stringify(pa.chk.hot.items) === '[0,1,2]' && pa.chk.hot.fw === 'משה', pa);
check('the Friday\'s representative and phone are on every work (no first-aider, Michael 05/11/2026)', pa.chk.week && pa.chk.week.rep === 'יוסי לוי' && pa.chk.week.rph === '050-7654321' && !pa.chk.week.aid && !parseSafety(b.safety).chk.week.aid);
check('a valid contractor, fire watch given: nothing red, nothing missing for approval', !a.safety.includes(CHECK_MARK) && !a.safety.includes(GATE_MARK), a.safety);
check('a height work with no attachment: a yellow note, not a block', a.safety.includes(NOTE_LINE + 'לא צורפו אישורים'), a.safety);
check('expired contractor and a kind with no measure: red flags', b.safety.includes(CHECK_MARK) && b.safety.includes('פג ב-01/10/2026') && b.safety.includes('חלל מוקף: לא סומן אף אמצעי'), b.safety);
check('confined space without a gas test: missing for approval, naming what', b.safety.includes(GATE_MARK + 'חלל מוקף: חסרה בדיקת גזים מלאה (חמצן O2 (%)'), b.safety);
check('the sign-off fields stay empty for stage B', !('sg1n' in a) && !('sg4n' in a));
check('Michael gets one WhatsApp with counts, the red flag and the app link', db.wa.length === 1 && /התקבלה: 2 עבודות/.test(waText(db.wa[0])) && /נגב אקולוגיה/.test(waText(db.wa[0])) && /חסרה בדיקת גזים/.test(waText(db.wa[0])) && waText(db.wa[0]).includes('/#ptw'), db.wa.map(waText));
check('works_sub notes the Friday', JSON.parse(db.state.works_sub).friday === FRI);

console.log('\n5b. approval from the mail (Michael 05/11/2026: "a mail with approve buttons")');
{ const am = db.mails.filter((x) => x.subj === APPROVE_SUBJECT(FRI, false));
  check('one approval mail, to the connected mailbox only, both works, a button each', am.length === 1 && am[0].to.join() === 'owner@tapugan.co.il' && !am[0].cc.length && (am[0].html.match(/\/api\/works\?a=/g) || []).length === 2 && am[0].html.includes('נגב אקולוגיה'), am.map((x) => x.subj));
  check('the mail shows the red flag and the "missing before approval" line, right-to-left', /פג ב-01\/10\/2026/.test(am[0].html) && /חסרה בדיקת גזים/.test(am[0].html) && /^<div dir="rtl" style="direction:rtl;text-align:right;/.test(am[0].html));
  const toks = [...am[0].html.matchAll(/\/api\/works\?a=([^"&]+)/g)].map((x) => decodeURIComponent(x[1]));
  check('each button is a token for its own row, with its own prefix', (await readOkToken(ENV, toks[0], NOW)).id === 'wk-2026-11-06-1' && (await readOkToken(ENV, toks[1], NOW)).id === 'wk-2026-11-06-2');
  check('the weekly-list token is refused as an approval token, and an approval token is no list link', (await readOkToken(ENV, tok, NOW)).error && (await readWorksToken(ENV, toks[0], NOW)).error);
  const forged = await makeLinkToken(ENV, OK_PREFIX, 'ctr26-1', 8, NOW);
  check('a token for a row that is not a weekly work: refused', (await readOkToken(ENV, forged, NOW)).error === 'bad');
  const pg = await open(URL0 + '?a=' + encodeURIComponent(toks[0]));
  check('opening the button (GET, as mail scanners do) only shows the work: nothing changes', pg.st === 200 && pg.h.includes('מאשר את תחילת העבודה') && db.ptw['wk-2026-11-06-1'].s === S_PEND);
  const pg2 = await open(URL0 + '?a=' + encodeURIComponent(toks[1]));
  check('a work missing a gas test: no approve button, reject only', pg2.st === 200 && !pg2.h.includes('value="approve"') && pg2.h.includes('value="reject"'));
  const decide = async (t, act, why) => { const body = new URLSearchParams({ op: 'decide', a: t, act, why: why || '' }).toString(); const r = await onRequest({ request: new Request(URL0, { method: 'POST', body, headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'content-length': String(body.length) } }), env: ENV }); return { st: r.status, h: await r.text() }; };
  let r = await decide(toks[1], 'approve');
  check('approving it anyway (a forged POST): refused, still pending', r.st === 409 && db.ptw['wk-2026-11-06-2'].s === S_PEND, r.st);
  r = await decide(toks[1], 'reject', '');
  check('a reject with no reason: refused', r.st === 400 && db.ptw['wk-2026-11-06-2'].s === S_PEND);
  const nm0 = db.mails.length;
  r = await decide(toks[1], 'reject', 'חסרה בדיקת גזים, להשלים');
  check('a reject with a reason: rejected, the reason is first in safety for the link', r.st === 200 && db.ptw['wk-2026-11-06-2'].s === S_REJ && db.ptw['wk-2026-11-06-2'].safety.startsWith(REJ_MARK + 'חסרה בדיקת גזים, להשלים'), db.ptw['wk-2026-11-06-2'].s);
  { const m = db.mails.slice(nm0);
    check('notes back to maintenance: one mail, a trial to Michael only while the weekly mail is off, the notes and the week link', m.length === 1 && m[0].to.join() === 'owner@tapugan.co.il' && m[0].subj.indexOf(TRY_PREFIX + 'לתיקון: ') === 0 && m[0].subj.includes('(יום שישי 06/11/2026)') && m[0].html.includes('חסרה בדיקת גזים, להשלים') && m[0].html.includes('/api/works?k=') && /^<div dir="rtl"/.test(m[0].html), m.map((x) => x.subj));
    check('...the page says where it went', r.h.includes('נשלח מייל ל: owner@tapugan.co.il')); }
  db.state.works_mail_on = 'true'; db.state.works_mail_to = JSON.stringify({ to: ['alina@tapugan.co.il'], cc: ['boss@tapugan.co.il'] });
  const np = db.patches.length;
  r = await decide(toks[0], 'approve');
  const last = db.patches[np];
  check('approve: open, only while pending (the update is filtered by status)', r.st === 200 && db.ptw['wk-2026-11-06-1'].s === S_OK && last && Object.keys(last.b).join() === 's', [r.st, last]);
  { const m = db.mails[db.mails.length - 1];
    check('approve while the weekly mail is on: to the maintenance list with its copy, not a trial', m.to.join() === 'alina@tapugan.co.il' && m.cc.join() === 'boss@tapugan.co.il' && m.subj.indexOf(TRY_PREFIX) !== 0 && m.subj.indexOf('אושרה: ') === 0, m && [m.to, m.subj]); }
  r = await decide(toks[0], 'approve');
  check('a second click: "already handled", nothing written', r.st === 409 && db.patches.length === np + 1);
  delete db.state.works_mail_on; delete db.state.works_mail_to;
  db.ptw['wk-2026-11-06-1'].s = S_PEND;
  r = await decide(toks[0], 'approve', 'לגדר את האזור; עובד נוסף צופה');
  check('approve with notes: open, the notes first in safety, the link shows them', r.st === 200 && db.ptw['wk-2026-11-06-1'].s === S_OK && db.ptw['wk-2026-11-06-1'].safety.startsWith(OKN_MARK + 'לגדר את האזור') && parseSafety(db.ptw['wk-2026-11-06-1'].safety).okn.includes('עובד נוסף צופה') && buildSafety(parseSafety(db.ptw['wk-2026-11-06-1'].safety)).startsWith(OKN_MARK), db.ptw['wk-2026-11-06-1'].safety);
  check('...and the mail carries the notes', db.mails[db.mails.length - 1].html.includes('הערות הממונה: </b>לגדר את האזור'));
  db.ptw['wk-2026-11-06-2'].s = S_PEND; db.ptw['wk-2026-11-06-2'].ver = '2026-11-05T08:00:00Z';
  const pv = await open(URL0 + '?a=' + encodeURIComponent(toks[1]));
  check('the page carries the version it showed', pv.h.includes('name="v" value="2026-11-05T08:00:00Z"'));
  const decideV = async (t, v) => { const body = new URLSearchParams({ op: 'decide', a: t, act: 'reject', why: 'x', v }).toString(); const rr = await onRequest({ request: new Request(URL0, { method: 'POST', body, headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'content-length': String(body.length) } }), env: ENV }); return rr.status; };
  check('maintenance changed the work after the page opened: no decision, "open it again"', (await decideV(toks[1], '2026-11-05T07:00:00Z')) === 409 && db.ptw['wk-2026-11-06-2'].s === S_PEND);
  delete db.ptw['wk-2026-11-06-2'].ver;
  r = await decide(toks[0].slice(0, -2) + 'zz', 'approve');
  check('a tampered token: refused', r.st === 403);
  db.ptw['wk-2026-11-06-1'].s = S_PEND; db.ptw['wk-2026-11-06-2'].s = S_PEND; db.ptw['wk-2026-11-06-2'].safety = db.ptw['wk-2026-11-06-2'].safety.split('\n').filter((x) => x.indexOf(REJ_MARK) !== 0).join('\n'); }

console.log('\n6. the page opens again, resubmit updates');
p = await open(URL0 + '?k=' + encodeURIComponent(tok));
check('shows what was sent, editable, with the row numbers and the Friday\'s details', p.h.includes('הרשימה כבר נשלחה') && p.h.includes('ט.ס פרויקטים') && p.h.includes('name="rid_0" value="1"') && p.h.includes('name="rid_1" value="2"') && p.h.includes('value="יוסי לוי"') && !p.h.includes('f_w_week_aid'));
check('the ticked measures are ticked again', /name="chk_0_hgt" value="0" checked/.test(p.h) && /name="chk_0_hot" value="2" checked/.test(p.h) && p.h.includes('value="משה"'));
check('what is missing shows on the page', p.h.includes('חסר לפני אישור: חלל מוקף'));
check('a saved work offers attachments (its own small form)', p.h.includes('<form id="fu2"') && p.h.includes('form="fu2"'));
r = await post([['k', tok]].concat(fieldsOf(0, Object.assign({}, W1, { rid: '1' }), { hgt: [0, 1, 4], hot: [0, 1, 2] }, { hot: { fw: 'משה' } }), fieldsOf(1, Object.assign({}, W2, { rid: '2' }), { cnf: [0, 1, 2] }, { cnf: GAS })));
b = db.ptw['wk-2026-11-06-2'];
check('the gas test filled: kept, and the work is no longer blocked', r.st === 200 && !b.safety.includes(GATE_MARK) && parseSafety(b.safety).chk.cnf.o2 === '20.9' && parseSafety(b.safety).chk.cnf.rsc === GAS.rsc, b.safety);
check('thresholds are on (Michael approved 05/11/2026)', GAS_LIMITS.on === true);
GAS_LIMITS.on = false;
check('with the thresholds off: an O2 of 15 is recorded, not red', assess({ chk: { cnf: Object.assign({}, GAS, { o2: '15' }) }, files: 1 }, ['cnf']).red.length === 0);
GAS_LIMITS.on = true;
check('with the thresholds on: O2 15 / LEL 12 / CO 30 are red, 20.9 / 0 / 2 are not', assess({ chk: { cnf: Object.assign({}, GAS, { o2: '15', lel: '12', co: '30' }) }, files: 1 }, ['cnf']).red.length === 3 && assess({ chk: { cnf: GAS }, files: 1 }, ['cnf']).red.length === 0);
check('a change within 15 minutes: no second WhatsApp', db.wa.length === 1, db.wa.length);
db.ptw['wk-2026-11-06-1'].s = 'פתוח';
r = await post([['k', tok]].concat(fieldsOf(0, Object.assign({}, W1, { rid: '1', desc: 'שונה אחרי אישור' }), {}), fieldsOf(5, W3, {})));
check('resubmit 200', r.st === 200, [r.st, r.h.slice(0, 300)]);
check('the approved row is not changed', db.ptw['wk-2026-11-06-1'].desc.indexOf('שונה') < 0 && db.ptw['wk-2026-11-06-1'].s === 'פתוח');
check('the removed row is cancelled, not deleted', db.ptw['wk-2026-11-06-2'].s === S_CANCEL, db.ptw['wk-2026-11-06-2']);
check('the new row takes a new number (3), employee work', db.ptw['wk-2026-11-06-3'] && db.ptw['wk-2026-11-06-3'].con === EMP_LABEL && db.ptw['wk-2026-11-06-3'].s === S_PEND, Object.keys(db.ptw));
db.ptw['wk-2026-11-06-3'].s = S_REJ; db.ptw['wk-2026-11-06-3'].safety = REJ_MARK + 'חסר מספר נייד\n' + db.ptw['wk-2026-11-06-3'].safety;
p = await open(URL0 + '?k=' + encodeURIComponent(tok));
check('a rejected work shows the reason on the page', p.h.includes('נדחתה: חסר מספר נייד'));
r = await post([['k', tok]].concat(fieldsOf(0, Object.assign({}, W3, { rid: '3', ph: '0521111111' }), {})));
check('a fixed rejected work is pending again, the same id', db.ptw['wk-2026-11-06-3'].s === S_PEND && db.ptw['wk-2026-11-06-3'].ph === '0521111111' && !db.ptw['wk-2026-11-06-3'].safety.includes(REJ_MARK), db.ptw['wk-2026-11-06-3']);
db.approveAfterRead = 'wk-2026-11-06-3';
r = await post([['k', tok]].concat(fieldsOf(0, Object.assign({}, W3, { rid: '3', desc: 'שינוי ברגע האישור' }), {})));
check('an approval that lands between read and write is kept (the update is filtered by status)', db.ptw['wk-2026-11-06-3'].s === 'פתוח' && db.ptw['wk-2026-11-06-3'].desc.indexOf('שינוי') < 0, db.ptw['wk-2026-11-06-3']);

console.log('\n7. validation (content is data)');
resetDb();
const bad = async (extra, label, opts) => { const x = await post([['k', tok]].concat(extra), opts); check(label, x.st === 400 && !db.ptwPosts, [x.st, x.h.slice(0, 200)]); };
await bad(fieldsOf(0, Object.assign({}, W1, { desc: 'x'.repeat(700) }), {}), 'a description over 600 characters: refused');
await bad(fieldsOf(0, Object.assign({}, W1, { cat: ['hot', 'nuke'] }), {}), 'an unknown kind: refused');
await bad(fieldsOf(0, W1, { hot: [99] }), 'an unknown measure: refused');
await bad(fieldsOf(0, Object.assign({}, W1, { ts: '25:00' }), {}), 'a bad time: refused');
await bad(fieldsOf(0, Object.assign({}, W1, { ds: '2027-01-01', de: '2027-01-01' }), {}), 'a date far from the Friday: refused');
await bad(fieldsOf(0, Object.assign({}, W1, { who: 'boss' }), {}), 'performer not employee / contractor: refused');
await bad(fieldsOf(0, Object.assign({}, W1, { con: '' }), {}), 'a contractor work with no contractor: refused');
await bad(fieldsOf(0, Object.assign({}, W1, { dep: 'מחלקה מומצאת' }), {}), 'an unknown department: refused');
await bad(fieldsOf(0, Object.assign({}, W1, { sup: '' }), {}), 'no responsible person: refused');
await bad(fieldsOf(0, W2, { cnf: [0] }, { cnf: { o2: 'abc' } }), 'a gas reading that is not a number: refused');
await bad(fieldsOf(0, W2, { cnf: [0] }, { cnf: { gat: '7am' } }), 'a gas test time that is not a time: refused');
await bad(fieldsOf(0, W3, {}), 'works without the Friday\'s representative: refused', { noWeek: true });
await bad(Array.from({ length: MAX_ROWS + 1 }, (_, i) => fieldsOf(i, W3, {})).flat(), 'more than ' + MAX_ROWS + ' works: refused');
await bad([], 'nothing at all (no works, "none" not ticked): refused');
const big = await post([['k', tok], ['desc_0', 'x'.repeat(130 * 1024)]]);
check('a body over 120KB: 413', big.st === 413);
const js = await onRequest({ request: new Request(URL0, { method: 'POST', body: 'k=' + tok, headers: { 'Content-Type': 'text/plain' } }), env: ENV });
check('not a form: 415', js.status === 415);
const forged = await post([['k', tok.slice(0, -3) + 'abc']].concat(fieldsOf(0, W1, {})));
check('a forged token: 403, nothing written', forged.st === 403 && !db.ptwPosts);
r = await post([['k', tok]].concat(fieldsOf(0, Object.assign({}, W3, { desc: '<script>alert(1)</script>‮abc\u0000 החלפת נורה' }), {})));
const sx = db.ptw['wk-2026-11-06-1'];
check('tags stay text in the row, direction and control characters are dropped', r.st === 200 && sx.desc.includes('<script>') && !/[‮\u0000]/.test(sx.desc), sx && sx.desc);
p = await open(URL0 + '?k=' + encodeURIComponent(tok));
check('...and the page escapes them', !p.h.includes('<script>alert(1)') && p.h.includes('&lt;script&gt;alert(1)'));
resetDb();
await post([['k', tok]].concat(fieldsOf(0, Object.assign({}, W3, { desc: 'ריתוך מעקה בחצר' }), {})));
check('"welding" in the text, hot work not ticked: flagged', db.ptw['wk-2026-11-06-1'].safety.includes('בתיאור יש עבודות חמות, ולא סומן'), db.ptw['wk-2026-11-06-1'].safety);
resetDb(); db.ctrFail = true;
await post([['k', tok]].concat(fieldsOf(0, W1, { hgt: [0], hot: [0] }, { hot: { fw: 'משה' } })));
check('ctr cannot be read: saved, and flagged "not checked"', db.ptw['wk-2026-11-06-1'] && db.ptw['wk-2026-11-06-1'].safety.includes('לא נבדק מול מרשם הקבלנים'));
resetDb();
r = await post([['k', tok], ['none', '1']], { noWeek: true });
check('"no special works": 200 without the Friday\'s details, Michael told, works_sub notes it', r.st === 200 && /אין עבודות מיוחדות/.test(waText(db.wa[0])) && JSON.parse(db.state.works_sub).none === true, db.wa.map(waText));

console.log('\n8. attachments');
resetDb();
await post([['k', tok]].concat(fieldsOf(0, W1, { hgt: [0], hot: [0] }, { hot: { fw: 'משה' } })));
const upload = async (n, kind, bytes, name, type, k) => {
  const mk = () => { const fd = new FormData(); fd.append('op', 'file'); fd.append('k', k || tok); fd.append('n', String(n)); fd.append('kind', kind); fd.append('file', new Blob([bytes], { type: type || 'application/pdf' }), name || 'x.pdf'); return fd; };
  const len = (await new Request(URL0, { method: 'POST', body: mk() }).arrayBuffer()).byteLength;
  const base = new Request(URL0, { method: 'POST', body: mk() });
  const hd = new Headers(base.headers); hd.set('content-length', String(len));
  const r2 = await onRequest({ request: new Request(URL0, { method: 'POST', body: await base.arrayBuffer(), headers: hd }), env: ENV });
  return { st: r2.status, h: await r2.text() };
};
const pdf = new Uint8Array(2000); pdf.set([0x25, 0x50, 0x44, 0x46, 0x2d], 0);
const jpg = new Uint8Array(1500); jpg.set([0xff, 0xd8, 0xff, 0xe0], 0);
const exe = new Uint8Array(1500); exe.set([0x4d, 0x5a], 0);
check('magic bytes: PDF, JPG, PNG yes; an EXE or HTML no', fileType(pdf)[0] === 'pdf' && fileType(jpg)[0] === 'jpg' && fileType(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]))[0] === 'png' && fileType(exe) === null && fileType(new TextEncoder().encode('<html><script>')) === null);
let u = await upload(1, 'cert', pdf, '../../evil.pdf');
const keys = Object.keys(db.files);
check('a PDF certificate is kept under works/<friday>/<n>/ with a name of ours (never the sent name)', u.st === 200 && keys.length === 1 && /^works\/2026-11-06\/1\/cert-[a-z0-9]+\.pdf$/.test(keys[0]) && db.files[keys[0]].type === 'application/pdf', [u.st, keys, u.h.slice(0, 200)]);
check('the work counts it, and the "no attachment" note is gone', parseSafety(db.ptw['wk-2026-11-06-1'].safety).files === 1 && !db.ptw['wk-2026-11-06-1'].safety.includes(NOTE_LINE), db.ptw['wk-2026-11-06-1'].safety);
u = await upload(1, 'insp', exe, 'report.pdf', 'application/pdf');
check('a file that says PDF but is not: refused (415)', u.st === 415 && Object.keys(db.files).length === 1);
{ // uploads at the same time saw the old list (security review 05/11/2026): the count after the upload decides
  const pre = 'works/2026-11-06/1/'; for (let i = 0; i < 5; i++) db.files[pre + 'other-race' + i + '.pdf'] = { size: 10, type: 'application/pdf' };
  db.staleList = true;
  const r = await upload(1, 'cert', pdf, 'race.pdf');
  check('an upload past 6 files, sent alongside others: removes its own file, 409', r.st === 409 && Object.keys(db.files).filter((k) => k.startsWith(pre)).length === 6, [r.st, Object.keys(db.files)]);
  for (let i = 0; i < 5; i++) delete db.files[pre + 'other-race' + i + '.pdf']; }
u = await upload(1, 'virus', jpg, 'a.jpg', 'image/jpeg');
check('an unknown kind: refused', u.st === 400);
u = await upload(9, 'cert', jpg, 'a.jpg', 'image/jpeg');
check('a work that does not exist: 404', u.st === 404);
u = await upload(1, 'cert', jpg, 'a.jpg', 'image/jpeg', tok.slice(0, -2) + 'zz');
check('a forged token: 403', u.st === 403 && Object.keys(db.files).length === 1);
const huge = new Uint8Array(4 * 1024 * 1024 + 10); huge.set([0x25, 0x50, 0x44, 0x46], 0);
u = await upload(1, 'cert', huge);
check('over 4MB: 413', u.st === 413);
for (let i = 0; i < 5; i++) await upload(1, 'ins', jpg, 'b.jpg', 'image/jpeg');
u = await upload(1, 'ins', jpg, 'b.jpg', 'image/jpeg');
check('at most 6 files a work', u.st === 409 && Object.keys(db.files).length === 6, [u.st, Object.keys(db.files).length]);
const app = async (body, auth) => { const x = await onRequest({ request: new Request(URL0, { method: 'POST', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json', Origin: ORIGIN, ...(auth ? { Authorization: 'Bearer ' + auth } : {}) } }), env: ENV }); return { st: x.status, j: await x.json().catch(() => null) }; };
let ap = await app({ op: 'files', id: 'wk-2026-11-06-1' }, 'good');
check('the app lists them with links that open for an hour', ap.st === 200 && ap.j.files.length === 6 && ap.j.files[0].url.startsWith(SB + '/storage/v1/object/sign/') && ap.j.files[0].kind === 'תעודות עובדים', ap.j);
check('a bad id in the files op: 400; a viewer: 403', (await app({ op: 'files', id: '../x' }, 'good')).st === 400 && (await app({ op: 'files', id: 'wk-2026-11-06-1' }, 'viewer')).st === 403);

console.log('\n9. closing from the phone, lock-out / tag-out');
resetDb();
await post([['k', tok]].concat(fieldsOf(0, Object.assign({}, W1, { cat: ['hot', 'elc'] }), { hot: [0], elc: [0], loto: [0] }, { hot: { fw: 'משה' }, elc: { mot: 'M-12' }, loto: { pts: 'לוח 3, מפסק 7', lby: 'נחום' } })));
const close = async (n, f) => post([['k', tok], ['op', 'close'], ['n', String(n)]].concat(Object.entries(f)));
let w1 = db.ptw['wk-2026-11-06-1'];
check('lock-out / tag-out kept with an electrical work', parseSafety(w1.safety).chk.loto.pts === 'לוח 3, מפסק 7' && parseSafety(w1.safety).chk.loto.lby === 'נחום' && parseSafety(w1.safety).chk.loto.items[0] === 0, w1.safety);
let c = await close(1, { done: '1', end: '13:00', c30: '13:30', by: 'נחום' });
check('a permit not yet approved cannot be closed', c.st === 409 && w1.s === S_PEND);
p = await open(URL0 + '?k=' + encodeURIComponent(tok));
check('...and the page offers no closing before approval', !p.h.includes('id="fc1"'));
w1.s = 'פתוח';
p = await open(URL0 + '?k=' + encodeURIComponent(tok));
check('approved: the page offers closing, with the 30-minute check of hot work and the open lock', p.h.includes('<form id="fc1"') && p.h.includes('name="c30"') && p.h.includes('הנעילה של נחום עוד פתוחה'));
c = await close(1, { done: '1', end: '13:00', c30: '13:30', by: 'נחום' });
check('a lock still open: not closed', c.st === 409 && c.h.includes('הנעילה של נחום עוד פתוחה') && w1.s === 'פתוח', c.h.slice(0, 300));
c = await close(1, { end: '13:00', c30: '13:30', by: 'נחום', rby: 'נחום', rat: '13:10' });
check('"finished, clean and safe" not ticked: not closed', c.st === 409 && w1.s === 'פתוח');
c = await close(1, { done: '1', end: '13:00', by: 'נחום', rby: 'נחום', rat: '13:10' });
check('hot work without the 30-minute check: not closed', c.st === 409 && w1.s === 'פתוח');
c = await close(1, { done: '1', end: '13:00', c30: '13:30', by: 'נחום', rby: 'נחום', rat: '13:10' });
w1 = db.ptw['wk-2026-11-06-1'];
const cs = parseSafety(w1.safety);
check('closed: status, end time, the release and the closing line', c.st === 200 && w1.s === S_CLOSED && w1.te === '13:00' && cs.chk.loto.rby === 'נחום' && cs.chk.loto.rat === '13:10' && cs.chk.close.end === '13:00' && cs.chk.close.c30 === '13:30' && cs.chk.close.items[0] === 0, [w1.s, w1.safety]);
check('closeCheck: a lock released in the row already lets it close', closeCheck({ chk: { loto: { lby: 'x', rby: 'y', rat: '10:00' } } }, ['elc'], { done: true, end: '11:00', by: 'z' }) === '');
u = await upload(1, 'cert', pdf);
check('no attachment to a closed permit', u.st === 409);
NOW = Date.parse('2026-11-07T08:00:00Z');
db.ptw['wk-2026-11-06-9'] = { id: 'wk-2026-11-06-9', con: EMP_LABEL, desc: 'תיקון', sup: 'x', s: 'פתוח', safety: buildSafety({ blocks: [], chk: {}, flags: [], gate: [], notes: [] }) };
p = await open(URL0 + '?k=' + encodeURIComponent(tok));
check('Saturday: the page opens for attachments and closing only (no list submit)', p.st === 200 && !p.h.includes('id="go"') && p.h.includes('<form id="fc9"'), p.st);
r = await post([['k', tok]].concat(fieldsOf(0, W3, {})));
check('Saturday: the list itself can no longer be changed (410)', r.st === 410);
c = await close(9, { done: '1', end: '12:00', by: 'אלינה' });
check('Saturday: a permit is still closed from the link', c.st === 200 && db.ptw['wk-2026-11-06-9'].s === S_CLOSED);
NOW = Date.parse('2026-11-05T08:00:00Z');

console.log('\n10. the copy-link op (app)');
ap = await app({ op: 'link' }, 'good');
check('a manager gets this week\'s link', ap.st === 200 && ap.j.friday === FRI && ap.j.url.startsWith(ORIGIN + '/api/works?k='), ap);
check('...which opens the page', (await open(ap.j.url)).st === 200);
check('a viewer is refused (403)', (await app({ op: 'link' }, 'viewer')).st === 403);
check('no sign-in: 401', (await app({ op: 'link' })).st === 401);

console.log('\n11. the clock: Wednesday mail, Thursday reminder, Sunday "not closed"');
const deps = { accessToken: async () => ({ token: 'gt' }), sendMailTo: async (t, to, cc, subj, html) => { db.mails.push({ to, cc, subj, html }); return true; } };
const WED18 = new Date('2026-11-04T16:05:00Z'), WED17 = new Date('2026-11-04T14:55:00Z'), THU12 = new Date('2026-11-05T10:05:00Z'), MON = new Date('2026-11-02T10:00:00Z'), SUN8 = new Date('2026-11-08T06:05:00Z');
resetDb();
let reads = 0; const _g = globalThis.fetch; globalThis.fetch = async (x, i) => { reads++; return _g(x, i); };
check('outside Wednesday evening, Thursday noon and Sunday morning: no request at all', (await worksTick(ENV, MON, deps)) === null && (await worksTick(ENV, WED17, deps)) === null && reads === 0, reads);
globalThis.fetch = _g;
check('the flag off (default): no mail', (await worksTick(ENV, WED18, deps)).off === true && !db.mails.length);
db.state.works_mail_on = 'true';
check('on, but no recipients in the database: no mail', (await worksTick(ENV, WED18, deps)).error === 'no recipients' && !db.mails.length);
db.state.works_mail_to = JSON.stringify({ to: ['coord@tapugan.co.il', 'maint1@tapugan.co.il', 'maint2@tapugan.co.il', 'evil@gmail.com'], cc: ['mgr@tapugan.co.il'] });
const t1 = await worksTick(ENV, WED18, deps);
check('on: one mail, company addresses only, cc kept', t1.mail === true && db.mails.length === 1 && db.mails[0].to.length === 3 && db.mails[0].to.indexOf('evil@gmail.com') < 0 && db.mails[0].cc.join() === 'mgr@tapugan.co.il', [t1, db.mails[0] && db.mails[0].to]);
check('the subject and the link for the coming Friday', db.mails[0].subj === MAIL_SUBJECT(FRI) && db.mails[0].subj.includes('06/11/2026') && db.mails[0].html.includes('/api/works?k='));
const mtok = decodeURIComponent(/k=([^"&]+)/.exec(db.mails[0].html)[1]);
check('the mailed link is valid for that Friday', (await readWorksToken(ENV, mtok, WED18.getTime())).id === FRI);
await worksTick(ENV, new Date(WED18.getTime() + 5 * 60000), deps);
check('the next tick: no second mail', db.mails.length === 1);
check('the mail text: keyboard characters only, signed with the owner\'s own signature (SITE.signature, 05/11/2026)', !/[–—…־]/.test(db.mails[0].html) && db.mails[0].html.includes(SITE.signature) && SITE.signature.length > 100);
check('the mail is right-to-left in the style too (Outlook drops dir=, 05/11/2026)', /^<div dir="rtl" style="direction:rtl;text-align:right;/.test(db.mails[0].html));
db.wa = [];
await worksTick(ENV, THU12, deps);
check('Thursday 12:00, nothing came: one WhatsApp reminder', db.wa.length === 1 && /לא התקבלה רשימת העבודות ליום שישי 06\/11\/2026/.test(waText(db.wa[0])), db.wa.map(waText));
await worksTick(ENV, new Date(THU12.getTime() + 5 * 60000), deps);
check('...once', db.wa.length === 1);
db.wa = []; delete db.state.works_remind_last; db.state.works_sub = JSON.stringify({ friday: FRI, n: 2 });
await worksTick(ENV, THU12, deps);
check('Thursday, the list came: no reminder', db.wa.length === 0);
db.state.works_mail_on = 'false'; delete db.state.works_sub; delete db.state.works_remind_last;
await worksTick(ENV, THU12, deps);
check('Thursday with the mail off: no reminder (the process has not started)', db.wa.length === 0);
check('mailList: bad JSON / no company address = null', mailList('nope') === null && mailList(JSON.stringify({ to: ['x@gmail.com'] })) === null);
db.wa = [];
db.ptw = { 'wk-2026-11-06-1': { id: 'wk-2026-11-06-1', desc: 'ריתוך בחדר האנרגיה', con: 'x', s: 'פתוח', safety: 'נעילה ותיוג: מי נעל: נחום' },
  'wk-2026-11-06-2': { id: 'wk-2026-11-06-2', desc: 'נסגר', s: S_CLOSED, safety: '' }, 'wk-2026-11-06-3': { id: 'wk-2026-11-06-3', desc: 'לא אושר', s: S_PEND, safety: '' } };
const so = await worksTick(ENV, SUN8, deps);
check('Sunday 08:00: one WhatsApp on the approved permit not closed (not the closed, not the pending), lock named, even with the mail off', so && so.open === 1 && db.wa.length === 1 && /שעוד לא נסגרו: 1/.test(waText(db.wa[0])) && /נעילה עוד פתוחה/.test(waText(db.wa[0])), [so, db.wa.map(waText)]);
await worksTick(ENV, new Date(SUN8.getTime() + 5 * 60000), deps);
check('...once', db.wa.length === 1);
resetDb(); db.state.works_mail_on = 'true'; db.state.works_mail_to = JSON.stringify({ to: ['coord@tapugan.co.il'], cc: [] });
const wm = await morningRun(Object.assign({}, ENV), THU12, { watch: true });
check('wa-morning watch runs the works step (the reminder)', wm && wm.works && wm.works.remind === true, wm && wm.works);

console.log('\n12. the texts');
console.log('--- MAIL subject: ' + MAIL_SUBJECT(FRI));
console.log(mailHtml(FRI, 'https://tapugan-safety.pages.dev/api/works?k=...').replace(/<br>/g, '\n').replace(/<\/p>/g, '\n').replace(/<[^>]+>/g, ''));
const sample = [{ desc: 'חדר אנרגיה: החלפת מד ספיקה', cats: ['hgt', 'hot'], st: { flags: [], gate: [], notes: ['לא צורפו אישורים (תעודות, תסקירים)'] } },
  { desc: 'מחלקת קילוף: ניקוי מיכל לחץ קיטור', cats: ['cnf'], st: { flags: ['הקבלן נגב אקולוגיה: ההסכם פג ב-01/10/2026'], gate: ['חלל מוקף: חסרה בדיקת גזים מלאה (חמצן O2 (%), דליקות LEL (%))'], notes: [] } }];
console.log('--- WA submit:\n' + submitText(FRI, sample, false));
console.log('--- WA none:\n' + submitText(FRI, [], false));
console.log('--- WA remind:\n' + remindText(FRI));
console.log('--- WA Sunday:\n' + openText(FRI, [{ id: 'wk-2026-11-06-1', desc: 'ריתוך מעקה בחצר', s: 'פתוח', safety: 'נעילה ותיוג: מי נעל: נחום' }]));
check('the texts have keyboard characters only', ![submitText(FRI, sample, false), remindText(FRI), mailHtml(FRI, 'u'), openText(FRI, [])].some((s) => /[–—…־“”]/.test(s)));

console.log('\n13. the trial mail to Michael (05/11/2026)');
{ db.mails = []; const dm = { accessToken: async () => ({ token: 'gt', email: 'owner@tapugan.co.il' }), sendMailTo: deps.sendMailTo };
  db.state.works_mail_on = 'false';
  const r = await worksTryMail(ENV, THU12, dm);
  check('the trial: one mail, to the connected account only, marked as a trial, the same link', r.ok && db.mails.length === 1 && db.mails[0].to.join() === 'owner@tapugan.co.il' && !db.mails[0].cc.length && db.mails[0].subj === TRY_PREFIX + MAIL_SUBJECT(FRI) && db.mails[0].html.includes('/api/works?k='), [r, db.mails[0]]);
  check('...the weekly switch untouched (still off), no last-sent stamp', db.state.works_mail_on === 'false' && db.state.works_mail_last !== FRI, db.state);
  const r2 = await worksTryMail(ENV, THU12, { accessToken: async () => ({ token: 'gt' }), sendMailTo: deps.sendMailTo });
  check('no connected address: nothing sent', r2.ok === false && db.mails.length === 1, r2); }
console.log('\n14. the approval mail again, for works still pending (05/11/2026)');
{ db.mails = []; const dm = { accessToken: async () => ({ token: 'gt', email: 'owner@tapugan.co.il' }), sendMailTo: deps.sendMailTo };
  db.ptw = {}; ['wk-' + FRI + '-1', 'wk-' + FRI + '-2', 'wk-' + FRI + '-3'].forEach((id, i) => { db.ptw[id] = { id, num: '', con: 'x', sup: 's', ph: '', wkr: '', area: 'a', dep: '', ds: FRI, de: FRI, ts: '', te: '', types: '', safety: '', desc: 'work ' + i, s: i === 2 ? S_OK : S_PEND }; });
  const pend = 2;
  const r = await worksApproveMail(ENV, THU12, dm);
  check('one mail to Michael only, one approve button per pending work', r.ok && r.n === pend && pend > 0 && db.mails.length === 1 && db.mails[0].to.join() === 'owner@tapugan.co.il' && !db.mails[0].cc.length && db.mails[0].subj === APPROVE_SUBJECT(FRI, false) && (db.mails[0].html.match(/\/api\/works\?a=/g) || []).length === pend, [r, pend, db.mails[0] && db.mails[0].subj]);
  Object.values(db.ptw).forEach((x) => { if (x.s === S_PEND) x.s = S_OK; });
  const r2 = await worksApproveMail(ENV, THU12, dm);
  check('nothing pending: no mail', r2.ok && r2.n === 0 && db.mails.length === 1, r2); }
console.log('\n15. the signed permit (stage B, 05/11/2026): approve -> filled, rendered, signed, filed, mailed');
{
  NOW = Date.parse('2026-11-05T08:00:00Z');
  resetDb();
  const GR = 'https://graph.microsoft.com/v1.0/me/drive/';
  const g = { files: {}, ids: {}, folders: {}, mk: [], puts: [], noTemplate: false, n: 0 };
  g.folders[OD_SAFETY + FILED_DIR] = 'fid';
  const fx = (n) => new Uint8Array(readFileSync(new URL('../fixtures/permit/' + n + '.docx', import.meta.url)));
  const TPL = { 'הרשאת עבודה - תבנית לקבלנים': fx('ctr-work'), 'הרשאת בטיחות - תבנית לקבלנים': fx('ctr-safety'), 'הרשאת עבודה - תבנית לעובדי אחזקה': fx('emp-work'), 'הרשאת בטיחות - תבנית לעובדי אחזקה': fx('emp-safety') };
  const SIG = Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAoAAAAECAIAAADAusJtAAAAFklEQVR4nGP4z8DwnwEJMMEZVBMBAD3wA/0HPNdUAAAAAElFTkSuQmCC', 'base64'));
  // Microsoft's rendering, mocked: the work permit 1 page, the safety permit 2 with the marker on its page 2
  const render = async (name) => {
    const d = await PDFDocument.create(); const f = await d.embedFont(StandardFonts.Helvetica);
    const n = /הרשאת בטיחות/.test(name) ? 2 : 1;
    for (let i = 1; i <= n; i++) { const pg = d.addPage([595, 842]); pg.drawText('p' + i, { x: 40, y: 800, size: 10, font: f }); if (n === 2 && i === 2) pg.drawText(SIGN_MARK, { x: 300, y: 340, size: 8, font: f }); }
    return d.save();
  };
  const base = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    const u = String(url), m = (init && init.method) || 'GET';
    const json = (o, st = 200) => new Response(JSON.stringify(o), { status: st, headers: { 'Content-Type': 'application/json' } });
    if (u === SB + '/storage/v1/object/backups/owner-signature/sig.png') return new Response(SIG, { status: 200 });
    if (!u.startsWith(GR)) return base(url, init);
    if (u.startsWith(GR + 'items/')) {
      if (/\/children$/.test(u) && m === 'POST') { const b = JSON.parse(init.body); g.mk.push(b); g.folders[g.mkParent + '/' + b.name] = 'mid'; return json({ id: 'mid', name: b.name, folder: {} }, 201); }
      const id = decodeURIComponent(/items\/([^/]+)\/content\?format=pdf/.exec(u)[1]);
      return new Response(await render(g.ids[id]), { status: 200 });
    }
    const path = decodeURIComponent(u.slice((GR + 'root:/').length).replace(/(:\/content)?(\?.*)?$/, ''));
    if (/:\/content/.test(u) && m === 'GET') {
      const k = Object.keys(TPL).find((x) => path.endsWith(x + '.docx'));
      return k && !g.noTemplate ? new Response(TPL[k], { status: 200 }) : json({ error: { code: 'itemNotFound' } }, 404);
    }
    if (/:\/content/.test(u) && m === 'PUT') {
      if (!/conflictBehavior=rename/.test(u)) return json({ error: 'replace' }, 400);
      let p2 = path; while (g.files[p2]) p2 = p2.replace(/(\.\w+)$/, ' 1$1');
      const id = 'f' + (++g.n); g.files[p2] = new Uint8Array(init.body); g.ids[id] = p2; g.puts.push(p2);
      return json({ id, name: p2.split('/').pop(), webUrl: 'https://od/' + id }, 201);
    }
    if (/\?select=id,folder/.test(u)) {
      if (g.folders[path]) return json({ id: g.folders[path], folder: { childCount: 0 } });
      g.mkParent = path.split('/').slice(0, -1).join('/');
      return json({ error: { code: 'itemNotFound' } }, 404);
    }
    return json({ error: 'unexpected ' + u }, 599);
  };
  mailDeps.sendMailTo = async (t, to, cc, subj, html, att) => { db.mails.push({ to, cc, subj, html, att: att || [] }); return true; };
  const ID = 'wk-2026-11-06-1', MONTH = OD_SAFETY + FILED_DIR + '/2026-11';
  const hotSt = { blocks: ['hot'], chk: { hot: { items: [0, 1, 6], fw: 'יוסי' } }, files: 0, flags: [], gate: [], notes: [] };
  const row = (id, o) => Object.assign({ id, num: 'WK-0611-1', con: 'ט"ס פרויקטים', sup: 'נועם', ph: '050-1234567', wkr: 'אבי, משה', area: 'חדר אנרגיה', dep: '', ds: FRI, de: FRI, ts: '07:00', te: '15:00',
    types: 'עבודות חמות', safety: buildSafety(hotSt), desc: 'החלפת מלכודת קיטור, ריתוך', s: S_PEND, ver: '2026-11-05T06:00:00Z' }, o || {});
  db.ptw[ID] = row(ID);
  const decide = async (id, act) => { const t = await makeOkToken(ENV, id, NOW); const body = new URLSearchParams({ op: 'decide', a: t, act, why: '', v: db.ptw[id].ver }).toString(); const r = await onRequest({ request: new Request(URL0, { method: 'POST', body, headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }), env: ENV }); return { st: r.status, h: await r.text() }; };
  let r = await decide(ID, 'approve');
  check('approved; the page says the signed permit was filed and mailed', r.st === 200 && db.ptw[ID].s === S_OK && r.h.includes('ההרשאה החתומה תויקה ונשלחה במייל'), r.h.slice(-400));
  const base0 = MONTH + '/2026-11-06 - הרשאה WK-0611-1 - החלפת מלכודת קיטור, ריתוך';
  check('the month folder was made (conflictBehavior=fail) under the filing folder', g.mk.length === 1 && g.mk[0].name === '2026-11' && g.mk[0]['@microsoft.graph.conflictBehavior'] === 'fail', g.mk);
  check('filed: the two Word files and the PDF, by name, never replacing', g.puts.join('|') === [base0 + ' - הרשאת עבודה.docx', base0 + ' - הרשאת בטיחות.docx', base0 + '.pdf'].join('|'), g.puts);
  const sx = await entryText(readZip(g.files[base0 + ' - הרשאת בטיחות.docx']).find((e) => e.name === 'word/document.xml'));
  check('the contractors\' safety template, filled: number, the safety officer, the marker', sx.includes('WK-0611-1') && sx.includes(SITE.owner) && sx.includes('05/11/2026') && sx.includes(SIGN_MARK));
  const pdf = await PDFDocument.load(g.files[base0 + '.pdf']);
  const xo = (i) => { const res = pdf.getPage(i).node.Resources(); const d = res && res.lookup(PDFName.of('XObject')); return d ? d.entries().length : 0; };
  check('the PDF: work 1 page + safety 2, signed on the safety form\'s page 2 only', pdf.getPageCount() === 3 && xo(2) >= 2 && xo(0) === 0 && xo(1) === 0, [pdf.getPageCount(), xo(0), xo(1), xo(2)]);
  const st = parseSafety(db.ptw[ID].safety);
  check('the row: the filed path on its own line, the measures kept', st.permit === FILED_DIR + '/2026-11/2026-11-06 - הרשאה WK-0611-1 - החלפת מלכודת קיטור, ריתוך.pdf' && st.chk.hot.fw === 'יוסי' && db.ptw[ID].safety.split('\n').filter((x) => x.indexOf(PERMIT_MARK) === 0).length === 1, db.ptw[ID].safety);
  const pm = db.mails.filter((x) => x.att.length);
  check('the weekly mail off: one permit mail, to Michael only, a trial, the PDF attached', pm.length === 1 && pm[0].to.join() === 'owner@tapugan.co.il' && !pm[0].cc.length && pm[0].subj === TRY_PREFIX + PERMIT_SUBJECT({ desc: 'החלפת מלכודת קיטור, ריתוך' }, FRI, false)
    && pm[0].att[0]['@odata.type'] === '#microsoft.graph.fileAttachment' && /\.pdf$/.test(pm[0].att[0].name) && pm[0].att[0].contentBytes.indexOf('JVBER') === 0, pm.map((x) => [x.subj, x.to, x.att.length]));
  check('the permit mail: right-to-left, Michael\'s signature, keyboard characters only', /^<div dir="rtl" style="direction:rtl;/.test(pm[0].html) && pm[0].html.includes(SITE.signature) && !/[–—־«»“”…]/.test(pm[0].html.replace(SITE.signature, '')));
  check('no error recorded', !(PERMIT_ERR in db.state), db.state[PERMIT_ERR]);

  // the weekly mail on and works_permit_to set: maintenance, Michael in copy; an address outside the company dropped
  db.state.works_mail_on = 'true'; db.state[PERMIT_TO] = JSON.stringify({ to: ['alina@tapugan.co.il', 'x@gmail.com'], cc: ['boss@tapugan.co.il'] });
  db.mails = [];
  const again = await worksPermit(ENV, ID, false, mailDeps);
  check('again (routine-db works_permit): a NEW file " 1", the row line replaced, not added', again.ok && g.puts[g.puts.length - 1] === base0 + ' 1.pdf' && parseSafety(db.ptw[ID].safety).permit.endsWith(' 1.pdf') && db.ptw[ID].safety.split('\n').filter((x) => x.indexOf(PERMIT_MARK) === 0).length === 1, again);
  check('to maintenance, copy to the boss and Michael, not a trial, outside addresses dropped', db.mails.length === 1 && db.mails[0].to.join() === 'alina@tapugan.co.il' && db.mails[0].cc.join() === 'boss@tapugan.co.il,owner@tapugan.co.il' && db.mails[0].subj.indexOf(TRY_PREFIX) < 0, db.mails[0] && [db.mails[0].to, db.mails[0].cc, db.mails[0].subj]);
  db.state[PERMIT_TO] = JSON.stringify({ to: ['x@gmail.com'] }); db.mails = [];
  await worksPermit(ENV, ID, false, mailDeps);
  check('works_permit_to with no company address: Michael only, a trial', db.mails[0].to.join() === 'owner@tapugan.co.il' && db.mails[0].subj.indexOf(TRY_PREFIX) === 0);
  db.ptw['wk-2026-11-06-5'] = row('wk-2026-11-06-5');
  check('the op refuses: a missing work, a bad id, a pending one', (await worksPermit(ENV, 'wk-2026-11-06-9', false, mailDeps)).error === 'missing' && (await worksPermit(ENV, '../x', false, mailDeps)).error === 'bad id'
    && (await worksPermit(ENV, 'wk-2026-11-06-5', false, mailDeps)).error === 'status: ' + S_PEND);
  check('the closed version only of a closed row', (await worksPermit(ENV, ID, true, mailDeps)).error === 'status: ' + S_OK);
  delete db.ptw['wk-2026-11-06-5'];

  // closing from the link: the closed version, to Michael only
  db.state.works_mail_on = 'false'; db.mails = []; const nput = g.puts.length;
  const c = await post([['k', tok], ['op', 'close'], ['n', '1'], ['done', '1'], ['end', '14:30'], ['c30', '15:00'], ['by', 'נועם']], { noWeek: true });
  check('closed; the page as before', c.st === 200 && db.ptw[ID].s === S_CLOSED, c.st);
  const cpdf = g.puts.slice(nput).find((x) => /\.pdf$/.test(x)) || '';
  check('the closed version filed beside: " - סגורה"', cpdf === MONTH + '/2026-11-06 - הרשאה WK-0611-1 - החלפת מלכודת קיטור, ריתוך - סגורה.pdf', g.puts.slice(nput));
  const cwn = g.puts.slice(nput).find((x) => /הרשאת עבודה\.docx$/.test(x));
  const cw = cwn ? await entryText(readZip(g.files[cwn]).find((e) => e.name === 'word/document.xml')) : '';
  check('...with the end time and who closed', cw.includes('14:30') && cw.includes('נועם'));
  check('...to Michael only, not a trial, attached', db.mails.length === 1 && db.mails[0].to.join() === 'owner@tapugan.co.il' && !db.mails[0].cc.length && db.mails[0].subj.indexOf('הרשאה סגורה: ') === 0 && db.mails[0].att.length === 1, db.mails.map((x) => x.subj));
  const cst = parseSafety(db.ptw[ID].safety);
  check('the row keeps both lines: the approved and the closed', cst.permit.endsWith('.pdf') && cst.permitc.endsWith(' - סגורה.pdf') && cst.chk.close.end === '14:30', db.ptw[ID].safety);

  // a failure never undoes the approval
  const ID2 = 'wk-2026-11-06-2'; db.ptw[ID2] = row(ID2); g.noTemplate = true; db.mails = [];
  r = await decide(ID2, 'approve');
  const err = JSON.parse(db.state[PERMIT_ERR] || '{}');
  check('a template missing: still approved, the page says so in red, the error kept', r.st === 200 && db.ptw[ID2].s === S_OK && r.h.includes('ההרשאה החתומה לא נוצרה') && err.id === ID2 && /template missing/.test(err.error), [r.st, err]);
  check('...and maintenance still got the decision mail', db.mails.length === 1 && db.mails[0].subj.indexOf('אושרה: ') >= 0, db.mails.map((x) => x.subj));
  g.noTemplate = false;

  // the factory's workers: their own templates, the approval line at the bottom
  const ID3 = 'wk-2026-11-06-3'; db.ptw[ID3] = row(ID3, { con: EMP_LABEL, num: 'WK-0611-3' }); delete db.state[PERMIT_ERR];
  r = await decide(ID3, 'approve');
  const ex = Object.keys(g.files).find((x) => /WK-0611-3 .* - הרשאת בטיחות\.docx$/.test(x));
  const exx = ex ? await entryText(readZip(g.files[ex]).find((e) => e.name === 'word/document.xml')) : '';
  check('maintenance workers: their templates, the line "approved by the safety officer" with the marker', !!ex && exx.includes('אושר על ידי ממונה הבטיחות, ' + SITE.owner) && exx.includes(SIGN_MARK) && !(PERMIT_ERR in db.state), [ex, db.state[PERMIT_ERR]]);
  check('a big PDF: the mail carries the link, not the file', permitHtml({ desc: 'x', cats: [] }, FRI, false, 'a.pdf', 'https://od/x', false).includes('href="https://od/x"') && !permitHtml({ desc: 'x', cats: [] }, FRI, false, 'a.pdf', 'https://od/x', true).includes('https://od/x'));
  globalThis.fetch = base;
}
Date.now = realNow;
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
