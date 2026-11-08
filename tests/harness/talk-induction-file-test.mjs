// The signed induction form (10/10/2026): after a new worker signs, the form (the text read, name,
// ID, company, date, score, signature) is filed under 11_הדרכות/12_קליטת עובדים חדשים/<year> as a PDF
// (Graph conversion of an HTML page; the HTML itself when that fails) and mailed with the file to
// Michael and hr-tap@. The signature is saved first: a OneDrive or mail failure never loses it,
// and the reason lands on the row (doc_err). A weekly talk sends nothing.
import { onRequest, makeTalkToken, inductionHtml, quizAnswers, makeCodeCookie, IND_HR, IND_ROOT, docsOf, MAX_DOCS, equipFields, equipBox, EQ_L, EQ_RET_DEF } from './_build/talk.mjs';
import { LOGO_JPG } from './_build/_logo.mjs';
let pass = 0, fail = 0;
const check = (l, c, d) => { if (c) { pass++; console.log('  ✓ ' + l); } else { fail++; console.log('  ✗ ' + l + (d !== undefined ? '  -> ' + JSON.stringify(d) : '')); } };
const SB = 'https://znhjtpcltrxxyfjczgvw.supabase.co';
const URL0 = 'https://tapugan-safety.pages.dev/api/talk';
const ENV = { SUPABASE_SERVICE_ROLE_KEY: 'srv', SUPABASE_URL: SB, TRUSTEE_NOTIFY_SECRET: 'nsec', GEMINI_API_KEY: 'g' };
const GR = 'https://graph.microsoft.com/v1.0/me';
const T = {
  ind: { id: 'ind1', d: null, title: 'הוראות כניסה למשמרת', body: '1. חירום\n2. כללי', body_ru: 'Инструкции\nТекст', s: 'פורסמה', kind: 'induction', link_v: 0, trainer: 'מיכאל', trainer_qual: 'ממונה בטיחות', quiz: [{ q: 'שאלה', a: ['א', 'ב'], c: 1 }] },
  wk: { id: 'wk1', d: '2026-10-11', title: 'סולמות', body: 'x', s: 'פורסמה', kind: null, link_v: 0 },
};
let w;
const reset = (o) => { w = { puts: [], mails: [], patches: [], inserts: [], conv: 0, ...o }; };
globalThis.fetch = async (url, init) => {
  const u = String(url), m = (init && init.method) || 'GET';
  const json = (o, st = 200) => new Response(JSON.stringify(o), { status: st, headers: { 'Content-Type': 'application/json' } });
  if (u.startsWith(SB + '/rest/v1/toolbox_talks')) { const id = decodeURIComponent((u.match(/id=eq\.([^&]+)/) || [])[1] || ''); return json(Object.values(T).filter((t) => t.id === id)); }
  if (u.startsWith(SB + '/rest/v1/emp')) return m === 'PATCH' ? new Response(null, { status: 204 }) : json([{ id: 'e1', n: 'אחמד כהן', dep: 'ייצור', eid: '7777777' }]);
  if (u.startsWith(SB + '/rest/v1/toolbox_reads')) {
    if (m === 'POST') { w.inserts.push(JSON.parse(init.body)); return new Response(null, { status: 201 }); }
    if (m === 'PATCH') { w.patches.push({ u, b: JSON.parse(init.body) }); return new Response(null, { status: 204 }); }
    return json([]);
  }
  if (u.startsWith(SB + '/storage/v1/object/')) return json({ Key: 'x' });
  if (u.startsWith(SB + '/rest/v1/server_state')) return json([{ value: '246810' }]);
  if (u.startsWith(SB + '/rest/v1/oauth_tokens')) return w.noToken ? json([]) : json([{ user_email: 'sviva@tapugan.co.il', refresh_token: 'r', access_token: 'at', expires_at: new Date(Date.now() + 3600e3).toISOString(), scope: 'Files.ReadWrite Mail.Send' }]);
  if (u.startsWith(GR + '/drive/root:/') && m === 'PUT') {
    const path = decodeURIComponent(u.slice((GR + '/drive/root:/').length).replace(/:\/content$/, ''));
    w.puts.push({ path, type: init.headers['Content-Type'], n: init.body.length, txt: /html/.test(init.headers['Content-Type']) ? new TextDecoder().decode(init.body) : '', head: String.fromCharCode.apply(null, Array.from(init.body.slice(0, 4))) });
    if (w.putFail && !/Apps\//.test(path)) return json({ error: { message: 'disk full' } }, 507);
    return json({ webUrl: 'https://od.example/' + encodeURIComponent(path), size: init.body.length });
  }
  if (u.startsWith(GR + '/drive/root:/') && /\?format=pdf$/.test(u)) { w.conv++; if (w.noPdf) return new Response('x', { status: 406 }); const b = new Uint8Array(w.bigPdf ? 3.5 * 1024 * 1024 : 2000); b.set([0x25, 0x50, 0x44, 0x46], 0); return new Response(b, { status: 200 }); }
  if (u === GR + '/sendMail') { const b = JSON.parse(init.body); w.mails.push(b); return w.mailFail ? json({ error: { message: 'quota' } }, 429) : new Response(null, { status: 202 }); }
  return json({ error: 'unexpected ' + u }, 599);
};
const png = new Uint8Array(1024); png.set([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A], 0);
const SIG = 'data:image/png;base64,' + Buffer.from(png).toString('base64');
const sign = async (id, extra) => {
  const k = await makeTalkToken(ENV, id);
  const fd = new FormData();
  for (const [a, b] of Object.entries({ k, l: 'he', emp: '__other', oname: 'Ivan Petrov', ocomp: 'כוח אדם', oid: '334455667', ok: '1', sig: SIG, qa: '0:1', ino: '1234', idep: 'טוגנים', iph: '052-1234567', ijob: 'מפעיל קו', ...extra })) (Array.isArray(b) ? b : [b]).forEach((v) => fd.append(a, v));
  const r = await onRequest({ request: new Request(URL0, { method: 'POST', body: fd, headers: { 'user-agent': 'iPhone Mobile', cookie: 'tsind=' + (await makeCodeCookie(ENV, id, '246810')) } }), env: ENV });
  return { st: r.status, h: await r.text() };
};
// The name a worker types is turned to Hebrew by the AI; here a fixed answer.
const realFetch = globalThis.fetch;
globalThis.fetch = async (url, init) => (String(url).startsWith('https://generativelanguage.googleapis.com/') ? new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: 'איוון פטרוב' }] } }] }), { status: 200 }) : realFetch(url, init));

console.log('\n1. the form page');
{
  const h = inductionHtml(T.ind, { id: 'r1', emp_name: 'דני <b>', id_no: '123', dept: 'כוח אדם', quiz_ok: 1, quiz_n: 1 }, 'QUJD', 'he', { day: '2026-10-11', hm: '07:05' });
  check('the text read, name, ID, company, date, score, trainer and signature', h.includes('1. חירום') && h.includes('דני &lt;b&gt;') && h.includes('123') && h.includes('כוח אדם') && h.includes('11/10/2026 07:05') && h.includes('1/1') && h.includes('הטופס הוכן על ידי</td>') && h.includes('ממונה בטיחות') && !h.includes('>מדריך<') && h.includes('data:image/png;base64,QUJD'));
  const ru = inductionHtml(T.ind, { id: 'r1', emp_name: 'x', id_no: '1' }, 'QQ', 'ru', { day: '2026-10-11', hm: '07:05' });
  // 11/10/2026, Michael: "שפה של הטופס חייבת להיות בעברית לא משנה באיזה שפה"
  check('a worker who read Russian: the signed form is in Hebrew, and says he read Russian', !ru.includes('Текст') && ru.includes('1. חירום') && ru.includes('Русский'), ru.slice(0, 900));
  check('the form opens with the welcome and the essential food plant', h.includes('ברוכים הבאים למפעל תעשיות תפוגן') && h.includes('המפעל הוא מפעל מזון חיוני'));
  // 10/10/2026, Michael: "בטופס שנשלח חסר לוגו של תפוגן כולל השאלות שנענו"
  check('the Tapugan logo at the top (a real JPEG, carried in the code)', h.includes('data:image/jpeg;base64,' + LOGO_JPG) && Buffer.from(LOGO_JPG, 'base64').subarray(0, 3).toString('hex') === 'ffd8ff' && LOGO_JPG.length > 5000);
  const Q = { ...T.ind, quiz: [{ q: 'מה עושים בצבע אדום?', a: ['ממשיכים', 'למרחב המוגן', 'הביתה', 'לחניה'], c: 1, t: { ru: { q: 'Что делать?', a: ['Работать', 'В убежище', 'Домой', 'На парковку'] } } }, { q: 'מתי מורידים חלוק?', a: ['אף פעם', 'לפני השירותים'], c: 1 }, { q: 'מכונה בלי הדרכה?', a: ['לא מפעילים', 'מפעילים'], c: 0 }] };
  const ans = quizAnswers(Q, 'he', '0:1,1:0,0:3');
  check('the answers: the first choice per question, right or wrong, an unanswered one marked', ans.length === 3 && ans[0].a === 'למרחב המוגן' && ans[0].ok && ans[1].a === 'אף פעם' && !ans[1].ok && ans[1].right === 'לפני השירותים' && ans[2].a === null && !ans[2].ok, ans);
  const hq = inductionHtml(Q, { id: 'r1', emp_name: 'x', id_no: '1', quiz_ok: 1, quiz_n: 3 }, 'QQ', 'he', { day: '2026-10-11', hm: '07:05' }, ans);
  check('the form lists every question, the answer chosen, right or wrong, and the right answer when wrong', hq.includes('השאלות והתשובה שהעובד בחר') && hq.includes('1. מה עושים בצבע אדום?') && hq.includes('למרחב המוגן') && hq.includes('✓ נכון') && hq.includes('2. מתי מורידים חלוק?') && hq.includes('✗ שגוי') && hq.includes('התשובה הנכונה: לפני השירותים') && hq.includes('לא נענתה'), hq.slice(hq.indexOf('בדיקת הבנה: השאלות'), hq.indexOf('בדיקת הבנה: השאלות') + 600));
  const one = { ...Q, quiz: [Q.quiz[0]] };
  const hr = inductionHtml(one, { id: 'r1', emp_name: 'x', id_no: '1' }, 'QQ', 'ru', { day: '2026-10-11', hm: '07:05' }, quizAnswers(one, 'ru', '0:1'));
  check('answered in Russian: the Russian question and answer, and the Hebrew under them for HR', hr.includes('Что делать?') && hr.includes('В убежище') && hr.includes('מה עושים בצבע אדום?') && hr.includes('למרחב המוגן'), quizAnswers(one, 'ru', '0:1'));
  check('no questions: no answers block', !inductionHtml(T.wk, { id: 'r', emp_name: 'x', id_no: '1' }, 'QQ', 'he', { day: '2026-10-11', hm: '07:05' }, []).includes('השאלות והתשובה'));
}

console.log('\n2. a new worker signs');
{
  reset();
  const r = await sign('ind1');
  check('signed (200), the worker sees "saved"', r.st === 200 && w.inserts.length === 1);
  const filed = w.puts.find((p) => p.path.startsWith(IND_ROOT + '/'));
  const y = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jerusalem' }).slice(0, 4);
  check('filed as a PDF under 12_קליטת עובדים חדשים/<year>', filed && filed.path.startsWith(IND_ROOT + '/' + y + '/') && /\.pdf$/.test(filed.path) && filed.head === '%PDF', w.puts);
  check('the file name: DD-MM-YYYY - name - last 4 of the ID, never the full ID (11/10/2026)', filed && /\/\d{2}-\d{2}-\d{4} - איוון פטרוב - 5667\.pdf$/.test(filed.path) && filed.path.indexOf('334455667') < 0, filed && filed.path);
  const src = w.puts.find((p) => p.path.startsWith('Apps/Tapugan Safety/'));
  // 11/10/2026, Michael: no quiz, and worker number, department, phone, job, agency on the form
  check('the filed form: the logo, the new details, no quiz', src && src.txt.includes('data:image/jpeg;base64,') && src.txt.includes('מספר עובד') && src.txt.includes('1234') && src.txt.includes('טוגנים') && src.txt.includes('0521234567') && src.txt.includes('מפעיל קו') && !src.txt.includes('1. שאלה') && !src.txt.includes('✓ נכון'), src && src.txt.slice(-900));
  check('the row keeps the new details', w.inserts[0] && w.inserts[0].emp_no === '1234' && w.inserts[0].dept === 'טוגנים' && w.inserts[0].phone === '0521234567' && w.inserts[0].job === 'מפעיל קו' && w.inserts[0].agency === null && w.inserts[0].quiz_n === undefined, w.inserts[0]);
  check('the source page went to the app folder, not the safety folder', w.puts.some((p) => p.path.startsWith('Apps/Tapugan Safety/') && /\.html$/.test(p.path)) && w.conv === 1);
  const mail = w.mails[0] && w.mails[0].message;
  const to = mail ? mail.toRecipients.map((x) => x.emailAddress.address) : [];
  check('one mail, to Michael and HR', w.mails.length === 1 && to.length === 2 && to.includes('sviva@tapugan.co.il') && to.includes(IND_HR), to);
  check('the mail carries the signed form and the link to the folder', mail && mail.attachments && mail.attachments[0].contentType === 'application/pdf' && /\.pdf$/.test(mail.attachments[0].name) && mail.body.content.includes('od.example') && mail.subject.includes('איוון פטרוב'), mail && mail.subject);
  const p = w.patches[w.patches.length - 1];
  check('the row keeps the folder link and when it was mailed', p && p.b.doc_url && p.b.mailed_at && p.b.doc_err === null && p.u.includes('id=eq.' + w.inserts[0].id), p);
}

console.log('\n2c. the equipment declaration (08/11/2026, Michael: HR fills, the worker signs, HR writes to whom it is returned)');
{
  const fd = (o) => { const f = new FormData(); for (const [a, b] of Object.entries(o)) f.append(a, b); return f; };
  const e = equipFields(fd({ eqq0: '1', eqq1: '2', eqq2: '', eqq3: '1', eqd3: 'מברג, פטיש', eqq4: '0', eqn0: 'אפוד זוהר', eqf0: '1', eqn1: 'x', eqf1: '3', eqr: 'מחסן טכני' }));
  check('items with a quantity only, the tools detail, a free row, and to whom', JSON.stringify(e) === JSON.stringify({ items: [{ n: "צ'יפ אישי", q: 1 }, { n: 'נעלי עבודה', q: 2 }, { n: 'כלי עבודה', q: 1, d: 'מברג, פטיש' }, { n: 'אפוד זוהר', q: 1 }], ret: 'מחסן טכני' }), e);
  check('nothing handed over: null (no declaration page)', equipFields(fd({ eqq0: '', eqq1: '0', eqn0: 'אפוד' })) === null);
  // pairs (Michael 02/11/2026): 3 real quantities that count, 3 that do not
  const q = (v) => { const r = equipFields(fd({ eqq1: v })); return r ? r.items[0].q : 0; };
  check('pairs: "1", "2", "١٢" (Arabic digits) count as 1, 2, 12', q('1') === 1 && q('2') === 2 && q('١٢') === 12, [q('1'), q('2'), q('١٢')]);
  check('pairs: "-1", "1000", "abc" do not count', q('-1') === 0 && q('1000') === 0 && q('abc') === 0, [q('-1'), q('1000'), q('abc')]);
  const x = equipFields(fd({ eqn0: '<script>alert(1)</script>', eqf0: '1', eqr: '' }));
  check('angle brackets dropped from a free item, empty "to whom" = HR', x && !/[<>]/.test(x.items[0].n) && x.ret === EQ_RET_DEF, x);
  const box = equipBox('ru', { dir: 'ltr' });
  check('the page block: HR table in Hebrew, the declaration in the worker\'s language', box.includes('ממלאים משאבי אנוש') && box.includes('name="eqq1"') && box.includes('name="eqd3"') && box.includes('name="eqr"') && box.includes(EQ_L.ru.t) && box.includes('class="eqret"'), box.slice(0, 300));
  check('4 languages carry the declaration with the "to whom" place', ['he', 'ar', 'ru', 'am'].every((l) => EQ_L[l] && EQ_L[l].t && EQ_L[l].d1 && EQ_L[l].d2.includes('{ret}')));
  const row = { id: 'r1', emp_name: 'דני', id_no: '123', equip: e };
  const h = inductionHtml(T.ind, row, 'QQ', 'ru', { day: '2026-11-08', hm: '07:05' }, [], ['QUJD']);
  const at = h.indexOf('הצהרה על קבלת ציוד והחזרתו');
  check('the PDF: a declaration page with the logo, the items, to whom, the date, name, ID and the same signature', at > 0 && h.indexOf('data:image/jpeg;base64,' + LOGO_JPG, h.lastIndexOf('page-break-before', at)) < at && h.includes('נעלי עבודה') && h.includes('כלי עבודה: מברג, פטיש') && h.includes('<b>מחסן טכני</b>') && h.includes('שלא הוחזר') && h.includes('08/11/2026') && (h.match(/data:image\/png;base64,QQ/g) || []).length === 2 && h.includes('קרא את ההצהרה ב'), h.slice(at, at + 400));
  check('the declaration page comes before the photographed documents', at < h.indexOf('מסמך שצולם בקליטה'));
  check('the main table says the declaration was signed', h.includes('נחתמה, בעמוד ההצהרה'));
  const none = inductionHtml(T.ind, { id: 'r1', emp_name: 'דני', id_no: '1' }, 'QQ', 'he', { day: '2026-11-08', hm: '07:05' }, []);
  check('no equipment: no declaration page, and the form says so', !none.includes('הצהרה על קבלת ציוד והחזרתו') && none.includes('לא נמסר ציוד בקליטה'));
  const bidi = equipFields(fd({ eqn0: 'אפוד\u202e\u200b זוהר', eqf0: '1', eqr: 'מחסן\u2066' }));
  check('direction and zero-width marks are dropped from what HR types (security review)', bidi && !/[\u200b-\u200f\u202a-\u202e\u2066-\u2069]/.test(JSON.stringify(bidi)), bidi);
  const old = inductionHtml(T.ind, { id: 'r0', emp_name: 'x', id_no: '1', read_at: '2026-10-20T08:00:00Z', equip: null }, 'QQ', 'he', { day: '2026-10-20', hm: '08:00' }, []);
  check('a form signed before 08/11/2026, sent again: no claim about equipment', !old.includes('לא נמסר ציוד בקליטה') && !old.includes('הצהרת ציוד'));
  reset();
  await sign('ind1', { eqq1: '1', eqq2: '2', eqr: 'משאבי אנוש' });
  check('signing: the row keeps the equipment', w.inserts[0] && JSON.stringify(w.inserts[0].equip) === JSON.stringify({ items: [{ n: 'נעלי עבודה', q: 1 }, { n: 'בגדי עבודה', q: 2 }], ret: 'משאבי אנוש' }), w.inserts[0] && w.inserts[0].equip);
  const src = w.puts.find((p) => p.path.startsWith('Apps/Tapugan Safety/'));
  check('signing: the filed form carries the declaration page', src && src.txt.includes('הצהרה על קבלת ציוד והחזרתו') && src.txt.includes('בגדי עבודה'));
  reset();
  await sign('ind1');
  check('signing with nothing handed over: equip null', w.inserts[0] && w.inserts[0].equip === null, w.inserts[0] && w.inserts[0].equip);
}

console.log('\n2b. documents photographed at the induction (13/10/2026, Michael: embedded in the PDF)');
{
  const jpg = (n, fill) => { const b = new Uint8Array(n).fill(fill || 7); b.set([0xFF, 0xD8, 0xFF], 0); return 'data:image/jpeg;base64,' + Buffer.from(b).toString('base64'); };
  check('docsOf: JPEG data only, small or broken ones dropped, at most ' + MAX_DOCS, docsOf([jpg(5000), 'data:image/png;base64,AAAA', 'x', jpg(100), jpg(5000)]).length === 2 && docsOf(Array(MAX_DOCS + 3).fill(jpg(5000))).length === MAX_DOCS);
  check('docsOf: one too big (over 900KB) is dropped', docsOf([jpg(950 * 1024)]).length === 0);
  const h = inductionHtml(T.ind, { id: 'r1', emp_name: 'דני', id_no: '1' }, 'QQ', 'he', { day: '2026-10-11', hm: '07:05' }, [], ['QUJD', 'REVG']);
  check('the form: a page per document after the signature, numbered "1 of 2"', (h.match(/page-break-before:always/g) || []).length === 2 && h.includes('data:image/jpeg;base64,QUJD') && h.indexOf('QUJD') > h.indexOf('חתימה') && /1 מתוך 2/.test(h));
  check('no documents: no extra page', !inductionHtml(T.ind, { id: 'r1', emp_name: 'x', id_no: '1' }, 'QQ', 'he', { day: '2026-10-11', hm: '07:05' }, []).includes('page-break-before'));
  reset();
  const r = await sign('ind1', { doc: [jpg(6000, 1), jpg(6000, 2)] });
  const src = w.puts.find((p) => p.path.startsWith('Apps/Tapugan Safety/'));
  check('signed with two photos: both inside the filed form', r.st === 200 && src && (src.txt.match(/page-break-before:always/g) || []).length === 2, src && src.txt.length);
  check('the photos are not in the database row', w.inserts[0] && !JSON.stringify(w.inserts[0]).includes('base64'));
  reset({ bigPdf: true });
  await sign('ind1', { doc: [jpg(6000)] });
  const mail = w.mails[0] && w.mails[0].message;
  check('a form too big for a mail: sent with the link, no attachment', mail && (!mail.attachments || !mail.attachments.length) && mail.body.content.includes('od.example'), mail && mail.attachments && mail.attachments.length);
}

console.log('\n3. when something fails');
{
  reset({ noPdf: true });
  await sign('ind1');
  const filed = w.puts.find((p) => p.path.startsWith(IND_ROOT + '/'));
  check('no PDF from Graph: the HTML page is filed and sent instead', filed && /\.html$/.test(filed.path) && w.mails[0].message.attachments[0].contentType === 'text/html');
  reset({ mailFail: true });
  const r = await sign('ind1');
  check('the mail fails: the signature still saved, the reason on the row', r.st === 200 && w.inserts.length === 1 && w.patches[w.patches.length - 1].b.mailed_at === null && /outlook 429/.test(w.patches[w.patches.length - 1].b.doc_err || ''), w.patches[w.patches.length - 1]);
  reset({ noToken: true });
  const r2 = await sign('ind1');
  check('OneDrive not connected: signed, nothing filed, "not connected" on the row', r2.st === 200 && !w.puts.length && !w.mails.length && /not connected/.test(w.patches[w.patches.length - 1].b.doc_err || ''), w.patches[w.patches.length - 1]);
  reset({ putFail: true });
  await sign('ind1');
  check('the safety folder refuses: no mail with a missing file, the reason on the row', !w.mails.length && /onedrive 507/.test(w.patches[w.patches.length - 1].b.doc_err || ''), w.patches[w.patches.length - 1]);
}

console.log('\n3b. the status written in steps (15/10/2026, A3), photos the server could not take (A2)');
{
  reset();
  const seq = []; const f0 = globalThis.fetch;
  globalThis.fetch = async (url, init) => { const u = String(url), m = (init && init.method) || 'GET';
    if (/toolbox_reads/.test(u) && m === 'PATCH') seq.push('patch'); else if (/format=pdf/.test(u)) seq.push('pdf'); else if (/sendMail/.test(u)) seq.push('mail'); else if (m === 'PUT') seq.push(/Apps\//.test(decodeURIComponent(u)) ? 'put-src' : 'put-filed');
    return f0(url, init); };
  await sign('ind1');
  globalThis.fetch = f0;
  const ps = w.patches.map((p) => p.b);
  check('the row is written after each step: the source filed, the PDF filed, the mail', seq.join() === 'put-src,patch,pdf,put-filed,patch,mail,patch' && /Apps/.test(decodeURIComponent(ps[0].doc_url)) && !('mailed_at' in ps[0]) && /\.pdf$/.test(decodeURIComponent(ps[1].doc_url)) && !('mailed_at' in ps[1]) && ps[2].mailed_at && ps[2].doc_err === null, { seq, ps });
  check('a run cut after the HTML: the row already links the signed form (not "being sent" forever)', seq.indexOf('patch') < seq.indexOf('pdf') && !!ps[0].doc_url);
  const srcT = (await import('fs')).readFileSync(new URL('../../functions/api/talk.js', import.meta.url), 'utf8');
  check('the PDF conversion has its own, longer limit (25s here, 60s for 08.01), not the 20s of every call', /graphPdf\(od\.token, seg, PDF_MS_IND\)/.test(srcT) && /graphPdf\(od\.token, seg, PDF_MS_0801\)/.test(srcT) && /PDF_MS_IND = 25000, PDF_MS_0801 = 60000/.test(srcT));
  const jpg = (n, fill) => { const b = new Uint8Array(n).fill(fill || 7); b.set([0xFF, 0xD8, 0xFF], 0); return 'data:image/jpeg;base64,' + Buffer.from(b).toString('base64'); };
  reset();
  await sign('ind1', { doc: [jpg(950 * 1024, 3), jpg(6000, 4)] });
  const lp = w.patches[w.patches.length - 1];
  const srcF = w.puts.find((p) => p.path.startsWith('Apps/Tapugan Safety/'));
  check('a photo over the server limit: the other one filed, the form mailed, and "1 not in the form" on the row', srcF && (srcF.txt.match(/page-break-before:always/g) || []).length === 1 && w.mails.length === 1 && lp.b.mailed_at && /^1 מסמכים לא נכנסו לטופס/.test(lp.b.doc_err || ''), lp && lp.b);
}

console.log('\n4. a weekly talk');
{
  reset();
  const r = await sign('wk1');
  check('signed, and nothing filed or mailed', r.st === 200 && !w.puts.length && !w.mails.length && !w.patches.length);
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
