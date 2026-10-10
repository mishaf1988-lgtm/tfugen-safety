// New-worker induction (10/10/2026, Michael: "רק עובדים חדש"): a talk with kind=induction gets a
// permanent link (no 14-day expiry) for a QR at the entrance; "revoke" raises link_v so the old
// link and QR stop; a permanent token never opens a weekly talk; the page says "induction".
import { onRequest, makeTalkToken, makePermToken, readPermToken, permOk, PERM_TTL_DAYS, LANGS, KIND_IND } from './_build/talk.mjs';
let pass = 0, fail = 0;
const check = (l, c, d) => { if (c) { pass++; console.log('  ✓ ' + l); } else { fail++; console.log('  ✗ ' + l + (d !== undefined ? '  -> ' + JSON.stringify(d) : '')); } };
const SB = 'https://znhjtpcltrxxyfjczgvw.supabase.co';
const URL0 = 'https://tapugan-safety.pages.dev/api/talk';
const ENV = { SUPABASE_SERVICE_ROLE_KEY: 'srv', TRUSTEE_NOTIFY_SECRET: 'nsec', GEMINI_API_KEY: 'g' };
const T = {
  ind: { id: 'ind1', d: '2026-10-11', title: 'הוראות כניסה למשמרת', body: 'כללי', s: 'פורסמה', kind: 'induction', link_v: 0 },
  wk: { id: 'wk1', d: '2026-10-11', title: 'סולמות', body: 'x', s: 'פורסמה', kind: null, link_v: 0 },
  dp: { id: 'dp1', d: '2026-10-11', title: 'מסועים', body: 'x', s: 'פורסמה', kind: null, link_v: 0, dept: 'אריזה' },
};
const w = { patches: [], inserts: [] };
globalThis.fetch = async (url, init) => {
  const u = String(url), m = (init && init.method) || 'GET';
  const json = (o, st = 200) => new Response(JSON.stringify(o), { status: st, headers: { 'Content-Type': 'application/json' } });
  if (u.startsWith(SB + '/rest/v1/toolbox_talks') && m === 'PATCH') { const id = decodeURIComponent(u.match(/id=eq\.([^&]+)/)[1]); const b = JSON.parse(init.body); w.patches.push({ id, b }); if (w.patchFail) return new Response('x', { status: 500 }); Object.assign(T[Object.keys(T).find((k) => T[k].id === id)], b); return new Response(null, { status: 204 }); }
  if (u.startsWith(SB + '/rest/v1/toolbox_talks')) { const id = decodeURIComponent((u.match(/id=eq\.([^&]+)/) || [])[1] || ''); w.sel = u; return json(Object.values(T).filter((t) => t.id === id).map((t) => ({ ...t }))); }
  if (u.startsWith(SB + '/rest/v1/emp')) return m === 'PATCH' ? new Response(null, { status: 204 }) : json([{ id: 'e1', n: 'אחמד כהן', dep: 'ייצור', eid: '7777777' }, { id: 'e2', n: 'יוסי לוי', dep: 'אריזה' }]);
  if (u.startsWith(SB + '/rest/v1/toolbox_reads')) { if (m === 'POST') { w.inserts.push(JSON.parse(init.body)); return new Response(null, { status: 201 }); } return json([]); }
  if (u.startsWith(SB + '/storage/v1/object/')) return json({ Key: 'x' });
  if (u === SB + '/auth/v1/user') { const tok = init.headers.Authorization.replace('Bearer ', ''); return tok === 'good' ? json({ id: 'u1', email: 'michael@tfugen.local' }) : tok === 'rep' ? json({ id: 'u2', email: 'rep@tfugen.local' }) : new Response('no', { status: 401 }); }
  if (u.startsWith(SB + '/rest/v1/app_users')) return json([u.includes('id=eq.michael') ? { role: 'מנהל', active: true } : { role: 'מדווח', active: true }]);
  return json({ error: 'unexpected ' + u }, 599);
};
const link = async (body, auth) => { const r = await onRequest({ request: new Request(URL0, { method: 'POST', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json', Origin: 'https://tapugan-safety.pages.dev', ...(auth ? { Authorization: 'Bearer ' + auth } : {}) } }), env: ENV }); let j = null; try { j = await r.json(); } catch (e) { j = null; } return { st: r.status, j }; };
const open = async (u) => { const r = await onRequest({ request: new Request(u), env: ENV }); return { st: r.status, h: await r.text() }; };
const tokOf = (u) => decodeURIComponent(new URL(u).searchParams.get('k'));
const png = new Uint8Array(1024); png.set([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A], 0);
const sign = async (k) => { const fd = new FormData(); for (const [a, b] of Object.entries({ k, l: 'he', emp: 'e1', oid: '7777777', ok: '1', sig: 'data:image/png;base64,' + Buffer.from(png).toString('base64') })) fd.append(a, b); const r = await onRequest({ request: new Request(URL0, { method: 'POST', body: fd, headers: { 'user-agent': 'iPhone Mobile' } }), env: ENV }); return r.status; };

console.log('\n1. the permanent token');
{
  const t = await makePermToken(ENV, 'ind1', 3);
  const r = await readPermToken(ENV, t);
  check('reads back the talk and its version', r.id === 'ind1' && r.perm && r.v === 3, r);
  check('lasts ' + PERM_TTL_DAYS + ' days, not 14', !(await readPermToken(ENV, t, Date.now() + 400 * 864e5)).error && (await readPermToken(ENV, t, Date.now() + (PERM_TTL_DAYS + 1) * 864e5)).error === 'expired');
  const weekly = await makeTalkToken(ENV, 'ind1');
  check('a weekly token is not a permanent one, and back', (await readPermToken(ENV, weekly)).error === 'bad');
  check('permOk: only an induction talk with the same version', permOk({ perm: true, v: 0 }, T.ind) && !permOk({ perm: true, v: 1 }, T.ind) && !permOk({ perm: true, v: 0 }, T.wk) && permOk({ id: 'x' }, T.wk));
  check('the induction heading exists in all four languages', ['he', 'ar', 'ru', 'am'].every((l) => LANGS[l].indT));
}

console.log('\n2. the link from the manager');
{
  let r = await link({ op: 'link', id: 'ind1' }, 'good');
  check('induction: a permanent link, and no 14-day date written', r.st === 200 && r.j.perm === true && r.j.link_v === 0 && !w.patches.length, r);
  const u0 = r.j.url;
  const p = await open(u0);
  check('it opens the page with the induction heading', p.st === 200 && p.h.includes('font-weight:700">' + LANGS.he.indT + '</div>'), p.h.slice(0, 900));
  check('the talk read asks for kind and link_v', /kind,link_v/.test(w.sel || ''));
  check('a worker signs through it', (await sign(tokOf(u0))) === 200 && w.inserts.length === 1);
  r = await link({ op: 'revoke', id: 'ind1' }, 'good');
  check('revoke: link_v goes up and a new link comes back', r.st === 200 && r.j.link_v === 1 && w.patches.slice(-1)[0].b.link_v === 1 && r.j.url !== u0, r);
  const old = await open(u0);
  check('the old link and QR stop (403)', old.st === 403, old.st);
  check('signing through the old link is refused too', (await sign(tokOf(u0))) === 403);
  check('the new link opens', (await open(r.j.url)).st === 200);
  w.patchFail = true;
  const f = await link({ op: 'revoke', id: 'ind1' }, 'good');
  check('a failed revoke says so (502) and does not hand out a link', f.st === 502 && !(f.j && f.j.url), f);
  w.patchFail = false;
  check('revoke on a weekly talk: 409', (await link({ op: 'revoke', id: 'wk1' }, 'good')).st === 409);
  check('revoke without a manager: refused', (await link({ op: 'revoke', id: 'ind1' }, 'rep')).st === 403 && (await link({ op: 'revoke', id: 'ind1' })).st === 401);
  const wl = await link({ op: 'link', id: 'wk1' }, 'good');
  check('a weekly talk still gets its 14-day link', wl.st === 200 && wl.j.days === 14 && !wl.j.perm);
  const forged = await makePermToken(ENV, 'wk1', 0);
  check('a permanent token made for a weekly talk does not open it', (await open(URL0 + '?k=' + encodeURIComponent(forged))).st === 403);
}

console.log('\n3. a talk for one department');
{
  const k = await makeTalkToken(ENV, 'dp1');
  const p = await open(URL0 + '?k=' + encodeURIComponent(k));
  check('the talk read asks for dept', /link_v,dept/.test(w.sel || ''));
  check('the list on the page: only that department\'s workers', p.h.includes('יוסי לוי') && !p.h.includes('אחמד כהן'));
  check('"not on the list" is still there', p.h.includes('value="__other"'));
  w.inserts = [];
  check('a worker from another department can still sign by the list (moved, covers a shift)', (await sign(k)) === 200 && w.inserts.length === 1 && w.inserts[0].emp_id === 'e1');
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
