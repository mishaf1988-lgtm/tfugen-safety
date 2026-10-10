// The signed induction form (10/10/2026): after a new worker signs, the form (the text read, name,
// ID, company, date, score, signature) is filed under 11_הדרכות/12_קליטת עובדים חדשים/<year> as a PDF
// (Graph conversion of an HTML page; the HTML itself when that fails) and mailed with the file to
// Michael and hr-tap@. The signature is saved first: a OneDrive or mail failure never loses it,
// and the reason lands on the row (doc_err). A weekly talk sends nothing.
import { onRequest, makeTalkToken, inductionHtml, IND_HR, IND_ROOT } from './_build/talk.mjs';
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
  if (u.startsWith(SB + '/rest/v1/oauth_tokens')) return w.noToken ? json([]) : json([{ user_email: 'sviva@tapugan.co.il', refresh_token: 'r', access_token: 'at', expires_at: new Date(Date.now() + 3600e3).toISOString(), scope: 'Files.ReadWrite Mail.Send' }]);
  if (u.startsWith(GR + '/drive/root:/') && m === 'PUT') {
    const path = decodeURIComponent(u.slice((GR + '/drive/root:/').length).replace(/:\/content$/, ''));
    w.puts.push({ path, type: init.headers['Content-Type'], n: init.body.length, head: String.fromCharCode.apply(null, Array.from(init.body.slice(0, 4))) });
    if (w.putFail && !/Apps\//.test(path)) return json({ error: { message: 'disk full' } }, 507);
    return json({ webUrl: 'https://od.example/' + encodeURIComponent(path), size: init.body.length });
  }
  if (u.startsWith(GR + '/drive/root:/') && /\?format=pdf$/.test(u)) { w.conv++; if (w.noPdf) return new Response('x', { status: 406 }); const b = new Uint8Array(2000); b.set([0x25, 0x50, 0x44, 0x46], 0); return new Response(b, { status: 200 }); }
  if (u === GR + '/sendMail') { const b = JSON.parse(init.body); w.mails.push(b); return w.mailFail ? json({ error: { message: 'quota' } }, 429) : new Response(null, { status: 202 }); }
  return json({ error: 'unexpected ' + u }, 599);
};
const png = new Uint8Array(1024); png.set([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A], 0);
const SIG = 'data:image/png;base64,' + Buffer.from(png).toString('base64');
const sign = async (id, extra) => {
  const k = await makeTalkToken(ENV, id);
  const fd = new FormData();
  for (const [a, b] of Object.entries({ k, l: 'he', emp: '__other', oname: 'Ivan Petrov', ocomp: 'כוח אדם', oid: '334455667', ok: '1', sig: SIG, qa: '0:1', ...extra })) fd.append(a, b);
  const r = await onRequest({ request: new Request(URL0, { method: 'POST', body: fd, headers: { 'user-agent': 'iPhone Mobile' } }), env: ENV });
  return { st: r.status, h: await r.text() };
};
// The name a worker types is turned to Hebrew by the AI; here a fixed answer.
const realFetch = globalThis.fetch;
globalThis.fetch = async (url, init) => (String(url).startsWith('https://generativelanguage.googleapis.com/') ? new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: 'איוון פטרוב' }] } }] }), { status: 200 }) : realFetch(url, init));

console.log('\n1. the form page');
{
  const h = inductionHtml(T.ind, { id: 'r1', emp_name: 'דני <b>', id_no: '123', dept: 'כוח אדם', quiz_ok: 1, quiz_n: 1 }, 'QUJD', 'he', { day: '2026-10-11', hm: '07:05' });
  check('the text read, name, ID, company, date, score, trainer and signature', h.includes('1. חירום') && h.includes('דני &lt;b&gt;') && h.includes('123') && h.includes('כוח אדם') && h.includes('11/10/2026 07:05') && h.includes('1/1') && h.includes('ממונה בטיחות') && h.includes('data:image/png;base64,QUJD'));
  const ru = inductionHtml(T.ind, { id: 'r1', emp_name: 'x', id_no: '1' }, 'QQ', 'ru', { day: '2026-10-11', hm: '07:05' });
  check('a worker who read Russian: the Russian text, and the form says so', ru.includes('Текст') && ru.includes('Русский'));
}

console.log('\n2. a new worker signs');
{
  reset();
  const r = await sign('ind1');
  check('signed (200), the worker sees "saved"', r.st === 200 && w.inserts.length === 1);
  const filed = w.puts.find((p) => p.path.startsWith(IND_ROOT + '/'));
  const y = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jerusalem' }).slice(0, 4);
  check('filed as a PDF under 12_קליטת עובדים חדשים/<year>', filed && filed.path.startsWith(IND_ROOT + '/' + y + '/') && /\.pdf$/.test(filed.path) && filed.head === '%PDF', w.puts);
  check('the file name: DD-MM-YYYY - name - ID', filed && /\/\d{2}-\d{2}-\d{4} - איוון פטרוב - 334455667\.pdf$/.test(filed.path), filed && filed.path);
  check('the source page went to the app folder, not the safety folder', w.puts.some((p) => p.path.startsWith('Apps/Tapugan Safety/') && /\.html$/.test(p.path)) && w.conv === 1);
  const mail = w.mails[0] && w.mails[0].message;
  const to = mail ? mail.toRecipients.map((x) => x.emailAddress.address) : [];
  check('one mail, to Michael and HR', w.mails.length === 1 && to.length === 2 && to.includes('sviva@tapugan.co.il') && to.includes(IND_HR), to);
  check('the mail carries the signed form and the link to the folder', mail && mail.attachments && mail.attachments[0].contentType === 'application/pdf' && /\.pdf$/.test(mail.attachments[0].name) && mail.body.content.includes('od.example') && mail.subject.includes('איוון פטרוב'), mail && mail.subject);
  const p = w.patches[0];
  check('the row keeps the folder link and when it was mailed', p && p.b.doc_url && p.b.mailed_at && p.b.doc_err === null && p.u.includes('id=eq.' + w.inserts[0].id), p);
}

console.log('\n3. when something fails');
{
  reset({ noPdf: true });
  await sign('ind1');
  const filed = w.puts.find((p) => p.path.startsWith(IND_ROOT + '/'));
  check('no PDF from Graph: the HTML page is filed and sent instead', filed && /\.html$/.test(filed.path) && w.mails[0].message.attachments[0].contentType === 'text/html');
  reset({ mailFail: true });
  const r = await sign('ind1');
  check('the mail fails: the signature still saved, the reason on the row', r.st === 200 && w.inserts.length === 1 && w.patches[0].b.mailed_at === null && /outlook 429/.test(w.patches[0].b.doc_err || ''), w.patches[0]);
  reset({ noToken: true });
  const r2 = await sign('ind1');
  check('OneDrive not connected: signed, nothing filed, "not connected" on the row', r2.st === 200 && !w.puts.length && !w.mails.length && /not connected/.test(w.patches[0].b.doc_err || ''), w.patches[0]);
  reset({ putFail: true });
  await sign('ind1');
  check('the safety folder refuses: no mail with a missing file, the reason on the row', !w.mails.length && /onedrive 507/.test(w.patches[0].b.doc_err || ''), w.patches[0]);
}

console.log('\n4. a weekly talk');
{
  reset();
  const r = await sign('wk1');
  check('signed, and nothing filed or mailed', r.st === 200 && !w.puts.length && !w.mails.length && !w.patches.length);
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
