// The shared weekly talk (14/10/2026, Michael: "one shared draft for all departments, whoever fills it
// picks his department"): a section per department ("## <department>"), the worker picks his department
// and sees only its section; the department goes on the signature row.
import { onRequest, makeTalkToken, sectionsOf, tDeptOf, WDEP_L } from './_build/talk.mjs';
let pass = 0, fail = 0;
const check = (l, c, d) => { if (c) { pass++; console.log('  ✓ ' + l); } else { fail++; console.log('  ✗ ' + l + (d !== undefined ? '  -> ' + JSON.stringify(d).slice(0, 400) : '')); } };
const SB = 'https://znhjtpcltrxxyfjczgvw.supabase.co';
const URL0 = 'https://tapugan-safety.pages.dev/api/talk';
const GR = 'https://graph.' + 'microsoft.com/v1.0/';  // the mock's Graph, for the filing and the mail
const ENV = { SUPABASE_SERVICE_ROLE_KEY: 'srv', TRUSTEE_NOTIFY_SECRET: 'nsec', GEMINI_API_KEY: 'g' };
const T = {
  sh: { id: 'w20261011', d: '2026-10-11', title: 'הדרכה שבועית 11/10/2026', body: 'שבוע בטוח לכולם\n## אריזה\nציוד מגן באריזה\n## טוגנים\nכובע חבטה מתחת לבונקרים', s: 'פורסמה', kind: null, link_v: 0 },
  ann: { id: 'an1', d: '2026-10-20', title: 'הדרכת בטיחות שנתית 2026', body: '1. נהלי בטיחות\n2. ציוד מגן אישי\n3. חומרים מסוכנים\n- היערכות לחירום\n5. עזרה ראשונה', s: 'פורסמה', kind: 'annual', link_v: 0, trainer: 'מיכאל פרייליך', dur: 'שעתיים' },
  qa: { id: 'qa1', d: '2026-10-21', title: 'הדרכת איכות', body: 'היגיינה', s: 'פורסמה', kind: 'quality', link_v: 2 },
  wk: { id: 'wk1', d: '2026-10-11', title: 'סולמות', body: 'x', s: 'פורסמה', kind: null, link_v: 0 },
};
const w = { patches: [], inserts: [], outs: 0 };
globalThis.fetch = async (url, init) => {
  const u = String(url), m = (init && init.method) || 'GET';
  const json = (o, st = 200) => new Response(JSON.stringify(o), { status: st, headers: { 'Content-Type': 'application/json' } });
  if (u.startsWith(SB + '/rest/v1/toolbox_talks') && m === 'PATCH') { const id = decodeURIComponent(u.match(/id=eq\.([^&]+)/)[1]); w.patches.push({ id, b: JSON.parse(init.body) }); return new Response(null, { status: 204 }); }
  if (u.startsWith(SB + '/rest/v1/toolbox_talks')) { const id = decodeURIComponent((u.match(/id=eq\.([^&]+)/) || [])[1] || ''); return json(Object.values(T).filter((t) => t.id === id).map((t) => ({ ...t }))); }
  if (u.startsWith(SB + '/rest/v1/emp')) return json([{ id: 'e1', n: 'אחמד כהן', dep: 'יצור', eid: '7777777' }]);
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
const sign = async (k, extra) => { const fd = new FormData(); for (const [a, b] of Object.entries(Object.assign({ k, l: 'he', emp: 'e1', oid: '7777777', ok: '1', sig: 'data:image/png;base64,' + Buffer.from(png).toString('base64') }, extra || {}))) fd.append(a, b); const r = await onRequest({ request: new Request(URL0, { method: 'POST', body: fd, headers: { 'user-agent': 'iPhone Mobile' } }), env: ENV }); return { st: r.status, h: await r.text() }; };


console.log('\n1. sections');
const sx = sectionsOf(T.sh.body);
check('intro, then one section per "## " line', sx.intro === 'שבוע בטוח לכולם' && sx.list.map((c) => c.dept).join() === 'אריזה,טוגנים' && sx.list[1].text === 'כובע חבטה מתחת לבונקרים', sx);
check('no "## " = no sections', sectionsOf('1. סולמות\n2. גובה').list.length === 0);
check('a card department maps to its training department', tDeptOf('יצור') === 'טוגנים' && tDeptOf('משהו אחר') === '');

console.log('\n2. the page');
const k = await makeTalkToken(ENV, 'w20261011');
const p = await open('https://tapugan-safety.pages.dev/api/talk?k=' + encodeURIComponent(k));
check('a department select with the sections, in the form', p.st === 200 && p.h.includes(WDEP_L) && /<select name="wdep" id="wdep" form="f" required/.test(p.h) && p.h.includes('<option value="אריזה">') && p.h.includes('<option value="טוגנים">'), p.st);
check('each section hidden until picked; the intro shown to all', (p.h.match(/class="wsec"/g) || []).length === 2 && /class="wsec" data-dep="טוגנים" style="display:none/.test(p.h) && p.h.includes('שבוע בטוח לכולם'));
check('the names carry their training department, for the filter', p.h.includes('data-t="טוגנים">אחמד כהן'));
check('no reading aloud of all the departments at once', !p.h.includes('id="say"'));
const kw = await makeTalkToken(ENV, 'wk1');
const pw = await open('https://tapugan-safety.pages.dev/api/talk?k=' + encodeURIComponent(kw));
check('a talk without sections: as before, no department select', pw.st === 200 && !pw.h.includes('name="wdep"') && pw.h.includes('id="tb"'));

console.log('\n3. signing');
let s = await sign(k, { wdep: 'טוגנים' });
check('signed: the department picked goes on the row', s.st === 200 && w.inserts[0] && w.inserts[0].dept === 'טוגנים' && w.inserts[0].emp_id === 'e1', w.inserts[0]);
s = await sign(k, { wdep: '' });
check('no department picked: refused, nothing saved', s.st === 400 && w.inserts.length === 1, s.st);
s = await sign(k, { wdep: 'מחלקה שלא קיימת' });
check('a department that is not a section: refused', s.st === 400 && w.inserts.length === 1, s.st);
s = await sign(kw, {});
check('a talk without sections signs as before (the card department)', s.st === 200 && w.inserts[1] && w.inserts[1].dept === 'יצור', w.inserts[1]);

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
