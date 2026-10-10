// The app's codes from one admin screen (10/10/2026, Michael: "פלטפורמה מלאה באפליקציה לניהול
// הסיסמות", the app's own codes): /api/codes lists and changes the HR code and the trustee code in
// server_state, admin only, and logs who and when to audit_log without the code. The trustee
// screen reads its code from server_state first, Cloudflare's TRUSTEE_CODE while that is empty.
import { onRequest, randomCode, CODE_RE } from './_build/codes.mjs';
import fs from 'fs';
let pass = 0, fail = 0;
const check = (l, c, d) => { if (c) { pass++; console.log('  ✓ ' + l); } else { fail++; console.log('  ✗ ' + l + (d !== undefined ? '  -> ' + JSON.stringify(d).slice(0, 300) : '')); } };
const SB = 'https://znhjtpcltrxxyfjczgvw.supabase.co';
const ENV = { SUPABASE_SERVICE_ROLE_KEY: 'srv', TRUSTEE_CODE: '482913' };
const w = { state: { induction_code: { key: 'induction_code', value: '996322', updated_at: '2026-10-10T16:35:21Z' } }, writes: [], logs: [] };
globalThis.fetch = async (url, init) => {
  const u = String(url), m = (init && init.method) || 'GET';
  const j = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json' } });
  if (u === SB + '/auth/v1/user') { const t = init.headers.Authorization.replace('Bearer ', ''); return t === 'admin' ? j({ id: 'u0', email: 'admin@tfugen.local' }) : t === 'mgr' ? j({ id: 'u1', email: 'michael@tfugen.local' }) : new Response('no', { status: 401 }); }
  if (u.startsWith(SB + '/rest/v1/app_users')) return j([u.includes('id=eq.michael') ? { role: 'מנהל', active: true } : { role: 'מדווח', active: true }]);
  if (u.startsWith(SB + '/rest/v1/server_state') && m === 'POST') { const b = JSON.parse(init.body); w.writes.push({ u, b, prefer: init.headers.Prefer }); if (w.failWrite) return new Response('x', { status: 500 }); w.state[b.key] = b; return new Response(null, { status: 201 }); }
  if (u.startsWith(SB + '/rest/v1/server_state')) { const one = /key=eq\.([a-z_]+)/.exec(u); return j(Object.values(w.state).filter((x) => !one || x.key === one[1])); }
  if (u.startsWith(SB + '/rest/v1/audit_log')) { w.logs.push(JSON.parse(init.body)); return new Response(null, { status: 201 }); }
  return j({ error: 'unexpected ' + u }, 599);
};
const call = async (body, auth, env) => { const r = await onRequest({ request: new Request('https://tapugan-safety.pages.dev/api/codes', { method: 'POST', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json', Origin: 'https://tapugan-safety.pages.dev', ...(auth ? { Authorization: 'Bearer ' + auth } : {}) } }), env: env || ENV }); let jj = null; try { jj = await r.json(); } catch (e) { jj = null; } return { st: r.status, j: jj }; };

console.log('\n1. who may');
check('no login: 401', (await call({ op: 'list' })).st === 401);
check('a manager: 403 (admin only)', (await call({ op: 'list' }, 'mgr')).st === 403);

console.log('\n2. the list');
{
  const r = await call({ op: 'list' }, 'admin');
  const by = Object.fromEntries((r.j && r.j.codes || []).map((c) => [c.key, c]));
  check('the HR code: set in the app, its value and date', by.induction_code && by.induction_code.value === '996322' && by.induction_code.source === 'app' && by.induction_code.updated_at, by.induction_code);
  check('the trustee code: only in Cloudflare, so set but no value shown', by.trustee_code && by.trustee_code.set && by.trustee_code.value === null && by.trustee_code.source === 'cloudflare', by.trustee_code);
  const r2 = await call({ op: 'list' }, 'admin', { SUPABASE_SERVICE_ROLE_KEY: 'srv' });
  check('no code anywhere: "none"', r2.j.codes.find((c) => c.key === 'trustee_code').source === 'none');
}

console.log('\n3. changing a code');
{
  let r = await call({ op: 'set', key: 'trustee_code', value: ' 135790 ' }, 'admin');
  check('my code: saved (upsert on key), returned', r.st === 200 && r.j.value === '135790' && w.writes[0].b.key === 'trustee_code' && w.writes[0].b.value === '135790' && /merge-duplicates/.test(w.writes[0].prefer) && /on_conflict=key/.test(w.writes[0].u), [r, w.writes[0]]);
  check('...logged: who, which code, and NOT the code', w.logs.length === 1 && w.logs[0].user_email === 'admin@tfugen.local' && w.logs[0].record_id === 'trustee_code' && !JSON.stringify(w.logs[0]).includes('135790'), w.logs[0]);
  r = await call({ op: 'list' }, 'admin');
  check('the list now shows it as set in the app', r.j.codes.find((c) => c.key === 'trustee_code').source === 'app');
  r = await call({ op: 'set', key: 'induction_code' }, 'admin');
  check('no value: 6 random digits', r.st === 200 && /^\d{6}$/.test(r.j.value) && w.state.induction_code.value === r.j.value, r.j);
  check('randomCode: digits only, the length asked', /^\d{6}$/.test(randomCode(6)) && /^\d{8}$/.test(randomCode(8)) && new Set(Array.from({ length: 20 }, () => randomCode(6))).size > 15);
  for (const bad of ['12', '12ab56', '1234567890123', 'abc']) check('refused: "' + bad + '"', (await call({ op: 'set', key: 'induction_code', value: bad }, 'admin')).st === 400);
  check('an unknown key: 400, nothing written', (await call({ op: 'set', key: 'delete', value: '1234' }, 'admin')).st === 400 && !w.writes.some((x) => x.b.key === 'delete'));
  check('a manager cannot change one', (await call({ op: 'set', key: 'induction_code', value: '1111' }, 'mgr')).st === 403);
  w.failWrite = true; const n = w.logs.length;
  r = await call({ op: 'set', key: 'induction_code', value: '2222' }, 'admin');
  check('a failed write: 502 and nothing logged', r.st === 502 && w.logs.length === n);
  w.failWrite = false;
  check('CODE_RE: 4 to 12 digits', CODE_RE.test('1234') && CODE_RE.test('123456789012') && !CODE_RE.test('123'));
}

console.log('\n4. the trustee screen reads the code from the app first');
{
  const src = fs.readFileSync(new URL('../../functions/api/trustee-gate.js', import.meta.url), 'utf8').replace("from '../_shared.js'", "from './_shared.mjs'");
  fs.writeFileSync(new URL('./_build/trustee-gate-c.mjs', import.meta.url), src);
  const { onRequest: gate } = await import('./_build/trustee-gate-c.mjs');
  const g = async (code, env) => (await gate({ request: new Request('https://tapugan-safety.pages.dev/api/trustee-gate', { method: 'POST', body: JSON.stringify({ code }), headers: { 'Content-Type': 'application/json', origin: 'https://tapugan-safety.pages.dev' } }), env })).status;
  w.state.trustee_code = { key: 'trustee_code', value: '135790' };
  check('the app code opens', (await g('135790', ENV)) === 200);
  check('the old Cloudflare code no longer does', (await g('482913', ENV)) === 403);
  delete w.state.trustee_code;
  check('no app code: Cloudflare\'s still works', (await g('482913', ENV)) === 200);
}

console.log('\n5. the screen in the app');
{
  const html = fs.readFileSync(new URL('../../index.html', import.meta.url), 'utf8');
  check('a "codes" button on the users page, and the dialog', html.includes('id="codes-btn" onclick="openCodes()"') && html.includes('id="m-codes"') && /function openCodes\(\)/.test(html) && /function _codeSet\(key,own\)/.test(html));
  check('a code is hidden until "show"', html.includes("'••••••'") || html.includes("'\\u2022\\u2022\\u2022\\u2022\\u2022\\u2022'"));
  check('a change asks first', /function _codeSet[\s\S]{0,700}confirm\(/.test(html));
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
