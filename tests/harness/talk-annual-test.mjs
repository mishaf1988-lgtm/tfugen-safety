// The annual safety training and the quality training (14/10/2026, Michael: "a barcode for the annual
// training, the worker fills his details, and one form 08.01 with everyone"; in the questionnaire:
// "everything typed", "PDF to the folder + print"). kind annual / quality: a permanent link until
// closed (revoke), the worker types name and ID and picks a department, one form 08.01 for all.
import { onRequest, makePermToken, permOk, KIND_ANN, KIND_QA, PERM_KINDS, TYPED_KINDS, ANN_OK, MAX_OUT_TYPED, form0801Html, topicsOf, F0801_ROWS, F0801_SUB } from './_build/talk.mjs';
let pass = 0, fail = 0;
const check = (l, c, d) => { if (c) { pass++; console.log('  ✓ ' + l); } else { fail++; console.log('  ✗ ' + l + (d !== undefined ? '  -> ' + JSON.stringify(d).slice(0, 400) : '')); } };
const SB = 'https://znhjtpcltrxxyfjczgvw.supabase.co';
const URL0 = 'https://tapugan-safety.pages.dev/api/talk';
const GR = 'https://graph.' + 'microsoft.com/v1.0/';  // the mock's Graph, for the filing and the mail
const ENV = { SUPABASE_SERVICE_ROLE_KEY: 'srv', TRUSTEE_NOTIFY_SECRET: 'nsec', GEMINI_API_KEY: 'g' };
const T = {
  ann: { id: 'an1', d: '2026-10-20', title: 'הדרכת בטיחות שנתית 2026', body: '1. נהלי בטיחות\n2. ציוד מגן אישי\n3. חומרים מסוכנים\n- היערכות לחירום\n5. עזרה ראשונה', s: 'פורסמה', kind: 'annual', link_v: 0, trainer: 'מיכאל פרייליך', dur: 'שעתיים', trainer_signed_at: '2026-10-20T06:00:00Z', subjects: 'כיבוי אש\nמלגזות' },
  qa: { id: 'qa1', d: '2026-10-21', title: 'הדרכת איכות', body: 'היגיינה', s: 'פורסמה', kind: 'quality', link_v: 2 },
  q0: { id: 'q0', d: '2026-10-21', title: 'איכות בלי חתימת מדריך', body: 'היגיינה', s: 'פורסמה', kind: 'quality', link_v: 0, subjects: 'היגיינה' },
  wk: { id: 'wk1', d: '2026-10-11', title: 'סולמות', body: 'x', s: 'פורסמה', kind: null, link_v: 0 },
};
const w = { patches: [], inserts: [], outs: 0 };
globalThis.fetch = async (url, init) => {
  const u = String(url), m = (init && init.method) || 'GET';
  const json = (o, st = 200) => new Response(JSON.stringify(o), { status: st, headers: { 'Content-Type': 'application/json' } });
  if (u.startsWith(SB + '/rest/v1/toolbox_talks') && m === 'PATCH') { const id = decodeURIComponent(u.match(/id=eq\.([^&]+)/)[1]); w.patches.push({ id, b: JSON.parse(init.body) }); return new Response(null, { status: 204 }); }
  if (u.startsWith(SB + '/rest/v1/toolbox_talks')) { const id = decodeURIComponent((u.match(/id=eq\.([^&]+)/) || [])[1] || ''); return json(Object.values(T).filter((t) => t.id === id).map((t) => ({ ...t }))); }
  if (u.startsWith(SB + '/rest/v1/emp')) return json([{ id: 'e1', n: 'אחמד כהן', dep: 'ייצור', eid: '7777777' }]);
  if (u.startsWith(SB + '/rest/v1/toolbox_reads')) {
    if (m === 'POST') { w.inserts.push(JSON.parse(init.body)); return new Response(null, { status: 201 }); }
    if (/emp_id=like\.x%3A\*/.test(u)) return json(Array.from({ length: w.outs }, (_, i) => ({ id: 'o' + i })));
    return json(w.reads || []);
  }
  if (u.startsWith(SB + '/storage/v1/object/')) return json({ Key: 'x' });
  if (u.startsWith(SB + '/rest/v1/server_state') || u.startsWith(SB + '/rest/v1/rpc/')) return json([]);
  if (u === SB + '/auth/v1/user') { const tok = init.headers.Authorization.replace('Bearer ', ''); return tok === 'good' ? json({ id: 'u1', email: 'michael@tfugen.local' }) : json({ id: 'u2', email: 'rep@tfugen.local' }); }
  if (u.startsWith(SB + '/rest/v1/app_users')) return json([u.includes('michael') ? { role: 'מנהל', active: true } : { role: 'צופה', active: true }]);
  if (u.startsWith(SB + '/rest/v1/oauth_tokens')) return json([{ user_email: 'sviva@tapugan.co.il', refresh_token: 'rt', access_token: 'at', expires_at: new Date(Date.now() + 3600e3).toISOString(), scope: 'Files.ReadWrite Mail.Send' }]);
  if (u.startsWith(GR + 'me/sendMail')) { w.mails = (w.mails || []).concat([JSON.parse(init.body)]); return new Response(null, { status: 202 }); }
  if (u.startsWith(GR) && m === 'PUT') { w.puts = (w.puts || []).concat([decodeURIComponent(u)]); return json({ webUrl: 'https://od.example/' + w.puts.length }); }
  if (u.startsWith(GR) && u.includes('format=pdf')) { const b = new Uint8Array(1200); b.set([0x25, 0x50, 0x44, 0x46], 0); return new Response(b, { status: 200 }); }
  return json({ error: 'unexpected ' + u }, 599);
};
const link = async (body, auth) => { const r = await onRequest({ request: new Request(URL0, { method: 'POST', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json', Origin: 'https://tapugan-safety.pages.dev', ...(auth ? { Authorization: 'Bearer ' + auth } : {}) } }), env: ENV }); let j = null; try { j = await r.json(); } catch (e) { j = null; } return { st: r.status, j }; };
const open = async (u) => { const r = await onRequest({ request: new Request(u), env: ENV }); return { st: r.status, h: await r.text() }; };
const tokOf = (u) => decodeURIComponent(new URL(u).searchParams.get('k'));
const png = new Uint8Array(1024); png.set([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A], 0);
const sign = async (k, extra) => { const fd = new FormData(); for (const [a, b] of Object.entries(Object.assign({ k, l: 'he', emp: 'e1', oname: 'דני חדש', oid: '3333333', idep: 'אריזה', ok: '1', sig: 'data:image/png;base64,' + Buffer.from(png).toString('base64') }, extra || {}))) fd.append(a, b); const r = await onRequest({ request: new Request(URL0, { method: 'POST', body: fd, headers: { 'user-agent': 'iPhone Mobile' } }), env: ENV }); return { st: r.status, h: await r.text() }; };

console.log('\n1. kinds and the permanent link');
check('annual and quality are typed, permanent-link kinds', TYPED_KINDS.join() === 'annual,quality' && PERM_KINDS.indexOf(KIND_ANN) >= 0 && PERM_KINDS.indexOf(KIND_QA) >= 0);
check('permOk: an annual talk with the same version only; a weekly talk never by a permanent token', permOk({ perm: true, v: 0 }, T.ann) && !permOk({ perm: true, v: 1 }, T.ann) && permOk({ perm: true, v: 2 }, T.qa) && !permOk({ perm: true, v: 0 }, T.wk));
let r = await link({ op: 'link', id: 'q0' }, 'good');
check('no link before the trainer signed (and the kinds ticked): 409 incomplete', r.st === 409 && r.j.error === 'incomplete', r);
r = await link({ op: 'link', id: 'an1' }, 'good');
check('the manager gets a permanent link, no 14-day date written', r.st === 200 && r.j.perm === true && r.j.link_v === 0 && !w.patches.length, r);
const u0 = r.j.url;
r = await link({ op: 'revoke', id: 'an1' }, 'good');
check('"close signatures" (revoke) raises link_v', r.st === 200 && r.j.link_v === 1 && w.patches[0] && w.patches[0].b.link_v === 1, r);
T.ann.link_v = 1;
check('...and the old link stops', (await open(u0)).st === 403);
const k1 = tokOf(r.j.url);

console.log('\n2. the page: everything typed');
const p = await open(r.j.url);
check('opens, titled by the training', p.st === 200 && p.h.includes('הדרכת בטיחות שנתית 2026'), p.st);
check('no list of workers: a hidden "other", name and ID required', p.h.includes('name="emp" id="emp" value="__other"') && !p.h.includes('אחמד כהן') && /name="oname" id="oname"[^>]*required/.test(p.h) && p.h.includes('name="oid"'));
check('a department list (the seven + other) and a box for another department; no company box', p.h.includes('name="idep"') && p.h.includes('<option value="אריזה">') && p.h.includes('name="idepo"') && !p.h.includes('name="ocomp"'));
check('the confirmation: every topic above, understood', p.h.includes(ANN_OK));
check('the topics are on the page', p.h.includes('ציוד מגן אישי'));

console.log('\n3. signing');
let s = await sign(k1);
const row = w.inserts[0] || {};
check('saved: typed name, ID, the department picked, outside the list', s.st === 200 && row.emp_name === 'דני חדש' && row.id_no === '3333333' && row.dept === 'אריזה' && /^x:3333333:/.test(row.emp_id), row);
s = await sign(k1, { oname: 'רונית לוי', oid: '4444444', idep: 'אחר', idepo: 'משרד' });
check('"other" + a typed department', s.st === 200 && w.inserts[1] && w.inserts[1].dept === 'משרד', w.inserts[1]);
s = await sign(k1, { oname: 'אבי', oid: '5555555', idep: '' });
check('no department: refused, nothing saved', s.st === 400 && w.inserts.length === 2, s.st);
s = await sign(k1, { oname: 'אבי', oid: '5555555', idep: 'אחר', idepo: '' });
check('"other" with no department typed: refused', s.st === 400 && w.inserts.length === 2, s.st);
w.outs = 100;
s = await sign(k1, { oname: 'משה', oid: '6666666' });
check('more than 100 typed names fit (the whole factory): limit ' + MAX_OUT_TYPED, s.st === 200 && w.inserts.length === 3, s.st);
w.outs = 0;

console.log('\n4. form 08.01');
const reads = Array.from({ length: 23 }, (_, i) => ({ id: 'r' + i, emp_name: 'עובד ' + (i + 1), dept: 'אריזה', id_no: String(1000000 + i), sig_url: SB + '/storage/v1/object/public/incidents-photos/s' + i + '.png' }));
const h = form0801Html(Object.assign({}, T.ann, { eff_req: true, eff_ok: false, eff_desc: 'שאלות', eff_by: 'מיכאל פרייליך' }), reads, (x) => (x.id === 'r0' ? 'QUJD' : null), 'data:image/jpeg;base64,VFJT');
check('the trainer signature (a JPEG from the app) on the training and on the effectiveness check', (h.match(/data:image\/jpeg;base64,VFJT/g) || []).length === 2);
check('the kinds ticked (subjects) are the topics on the form, before the text', h.includes('<td>כיבוי אש</td>') && h.includes('<td>מלגזות</td>') && !h.includes('<td>נהלי בטיחות</td>'));
check('the topics, numbered, the list markers dropped', JSON.stringify(topicsOf(T.ann.body)) === JSON.stringify(['נהלי בטיחות', 'ציוד מגן אישי', 'חומרים מסוכנים', 'היערכות לחירום', 'עזרה ראשונה']));
check('header: logo, "תיעוד ביצוע הדרכה", form 08.01, page 1 of 2 (20 per page)', h.includes('data:image/jpeg;base64,') && h.includes('תיעוד ביצוע הדרכה') && h.includes('טופס 08.01') && h.includes('עמוד 1 מתוך 2') && h.includes('עמוד 2 מתוך 2') && F0801_ROWS === 20);
check('date, duration, trainer and his signature', h.includes('20/10/2026') && h.includes('שעתיים') && h.includes('מיכאל פרייליך') && h.includes('base64,VFJT'));
check('every participant: number, name, department, full ID, signature image', h.includes('>23</td><td>עובד 23</td><td>אריזה</td>') && h.includes('1000022') && h.includes('base64,QUJD'));
check('the effectiveness check on the last page only', (h.match(/בדיקת אפקטיביות/g) || []).length === 1 && h.indexOf('בדיקת אפקטיביות') > h.indexOf('עמוד 2 מתוך 2') && h.includes('נדרשת: כן') && h.includes('אפקטיבי: לא'));
check('a name is escaped', form0801Html(T.ann, [{ id: 'x', emp_name: '<b>x</b>' }], () => null, null).includes('&lt;b&gt;x&lt;/b&gt;'));
check('folders: annual and quality each their own', F0801_SUB.annual === 'הדרכה שנתית' && F0801_SUB.quality === 'הדרכת איכות');
r = await link({ op: 'form0801', id: 'an1' }, 'rep');
check('form0801: a viewer is refused', r.st === 403, r.st);
w.reads = [];
// 14/10/2026: a preview before anyone signed: the HTML, nothing filed or mailed
const putsBefore = (w.puts || []).length, mailsBefore = (w.mails || []).length;
r = await link({ op: 'form0801', id: 'an1', preview: true }, 'good');
check('preview with no signatures yet: the form HTML (topics, trainer), nothing filed or mailed', r.st === 200 && r.j.preview === true && r.j.n === 0 && /תיעוד ביצוע הדרכה/.test(r.j.html) && r.j.html.includes('כיבוי אש') && (w.puts || []).length === putsBefore && (w.mails || []).length === mailsBefore, r.j && Object.keys(r.j));
r = await link({ op: 'form0801', id: 'an1', preview: true }, 'rep');
check('preview: a viewer is refused', r.st === 403, r.st);
r = await link({ op: 'form0801', id: 'an1' }, 'good');
check('form0801 with no signatures yet: a clear 409, nothing filed', r.st === 409, r);

w.reads = reads.slice(0, 3); T.ann.mail_cc = 'quality@tapugan.co.il; not-an-address';
r = await link({ op: 'form0801', id: 'an1' }, 'good');
const fin = (w.puts || []).filter((x) => !x.includes('Apps/Tapugan Safety'));
check('form0801: a PDF filed under 11_הדרכות/הדרכה שנתית/2026, named by date and title, no ID in the name', r.st === 200 && r.j.ok && r.j.pdf && r.j.n === 3 && fin.length === 1 && fin[0].includes('11_הדרכות/הדרכה שנתית/2026/20-10-2026 - הדרכת בטיחות שנתית 2026 - 08.01.pdf') && !/1000000/.test(fin[0]), { j: r.j, puts: w.puts });
const ml = (w.mails || [])[0];
check('...mailed with the PDF to the connected account and the address on the training (a bad one dropped)', r.j.mailed && ml && ml.message.toRecipients.map((x) => x.emailAddress.address).join() === 'sviva@tapugan.co.il,quality@tapugan.co.il' && ml.message.attachments.length === 1 && ml.message.attachments[0].contentType === 'application/pdf' && ml.saveToSentItems === false, ml && ml.message.toRecipients);

// 14/10/2026: form_at stamped on the talk once filed (the training screen stops warning), never by a preview
const fa = w.patches.filter((x) => x.id === 'an1' && x.b.form_at);
check('form0801: form_at stamped on the talk and returned; the preview stamped nothing', fa.length === 1 && r.j.form_at === fa[0].b.form_at && /^\d{4}-\d\d-\d\dT/.test(r.j.form_at), { fa, at: r.j.form_at });

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
