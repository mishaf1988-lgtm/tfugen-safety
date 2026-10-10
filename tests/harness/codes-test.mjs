// The app's codes from one admin screen (10/10/2026, Michael: "פלטפורמה מלאה באפליקציה לניהול
// הסיסמות", the app's own codes): /api/codes lists and changes the HR code and the trustee code in
// server_state, admin only, and logs who and when to audit_log without the code. The trustee
// screen reads its code from server_state first, Cloudflare's TRUSTEE_CODE while that is empty.
import { onRequest, randomCode, CODE_RE, pwOk, changeMailHtml } from './_build/codes.mjs';
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
  if (u.startsWith(SB + '/rest/v1/oauth_tokens')) return j(w.noOd ? [] : [{ user_email: 'sviva@tapugan.co.il', refresh_token: 'r', access_token: 'at', expires_at: new Date(Date.now() + 3600e3).toISOString(), scope: 'Files.ReadWrite Mail.Send' }]);
  if (u === 'https://graph.microsoft.com/v1.0/me/sendMail') { w.mails = (w.mails || []).concat([JSON.parse(init.body)]); return new Response(null, { status: w.mailFail ? 500 : 202 }); }
  if (u.startsWith(SB + '/rest/v1/audit_log') && m === 'GET') { w.auditQ = u; return j(w.logs.slice().reverse().slice(0, 3).map((x, i) => ({ ts: '2026-10-10T1' + i + ':00:00Z', user_email: x.user_email, record_id: x.record_id }))); }
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
  let r = await call({ op: 'set', key: 'trustee_code', value: ' Tapugan2026 ' }, 'admin');
  check('my password: saved in lower case (upsert on key), returned', r.st === 200 && r.j.value === 'tapugan2026' && w.writes[0].b.key === 'trustee_code' && w.writes[0].b.value === 'tapugan2026' && /merge-duplicates/.test(w.writes[0].prefer) && /on_conflict=key/.test(w.writes[0].u), [r, w.writes[0]]);
  check('...logged: who, which code, and NOT the code', w.logs.length === 1 && w.logs[0].user_email === 'admin@tfugen.local' && w.logs[0].record_id === 'trustee_code' && !JSON.stringify(w.logs[0]).toLowerCase().includes('tapugan2026'), w.logs[0]);
  const ml = (w.mails || [])[0] && w.mails[0].message;
  check('...and a mail to Michael: which password, who, when; never the password', ml && ml.toRecipients.length === 1 && ml.toRecipients[0].emailAddress.address === 'sviva@tapugan.co.il' && /סיסמה הוחלפה: קוד נאמני/.test(ml.subject) && /admin/.test(ml.body.content) && !JSON.stringify(w.mails).toLowerCase().includes('tapugan2026'), ml && [ml.subject, ml.body.content.slice(0, 300)]);
  w.noOd = true; const nm = (w.mails || []).length;
  const r2 = await call({ op: 'set', key: 'trustee_code', value: 'abcd1234' }, 'admin');
  check('no mail account connected: the change still goes through, no mail', r2.st === 200 && w.mails.length === nm);
  w.noOd = false; w.mailFail = true;
  check('the mail fails: the change still goes through', (await call({ op: 'set', key: 'trustee_code', value: 'tapugan2026' }, 'admin')).st === 200);
  w.mailFail = false;
  const mh = changeMailHtml('קוד נאמני הבטיחות', 'admin', '2026-10-10T17:05:00Z');
  check('the mail in Israel time and in plain words', mh.includes('10/10/2026') && mh.includes('20:05') && /לא אתה\?/.test(mh));
  r = await call({ op: 'list' }, 'admin');
  check('the list now shows it as set in the app', r.j.codes.find((c) => c.key === 'trustee_code').source === 'app');
  check('...and the last changes: who (without the domain), which, never the password; only codes, newest first, three', r.j.recent.length === 3 && r.j.recent[0].who === 'admin' && r.j.recent[0].key === 'trustee_code' && /נאמני/.test(r.j.recent[0].label) && !JSON.stringify(r.j.recent).includes('tapugan2026') && /source=eq\.codes/.test(w.auditQ) && /order=ts\.desc/.test(w.auditQ) && /limit=3/.test(w.auditQ), [r.j.recent, w.auditQ]);
  r = await call({ op: 'set', key: 'induction_code' }, 'admin');
  check('no value: a random password, 10 letters and digits, no 0/o/1/l/i', r.st === 200 && /^[a-z2-9]{10}$/.test(r.j.value) && pwOk(r.j.value) && !/[01oli]/.test(r.j.value) && w.state.induction_code.value === r.j.value, r.j);
  check('randomCode: letters and digits, the length asked, always both kinds', Array.from({ length: 50 }, () => randomCode(10)).every((v) => v.length === 10 && pwOk(v)) && new Set(Array.from({ length: 20 }, () => randomCode(10))).size === 20);
  for (const bad of ['12', 'abc12', '12345678', 'abcdefgh', 'abcd-1234', 'a'.repeat(32) + '1']) check('refused: "' + bad + '"', (await call({ op: 'set', key: 'induction_code', value: bad }, 'admin')).st === 400);
  check('an unknown key: 400, nothing written', (await call({ op: 'set', key: 'delete', value: 'abcd1234' }, 'admin')).st === 400 && !w.writes.some((x) => x.b.key === 'delete'));
  check('a manager cannot change one', (await call({ op: 'set', key: 'induction_code', value: 'abcd1234' }, 'mgr')).st === 403);
  w.failWrite = true; const n = w.logs.length;
  r = await call({ op: 'set', key: 'induction_code', value: 'efgh5678' }, 'admin');
  check('a failed write: 502 and nothing logged', r.st === 502 && w.logs.length === n);
  w.failWrite = false;
  check('pwOk: 8 to 32, letters and digits, at least one of each', pwOk('abcd1234') && pwOk('a1'.repeat(16)) && !pwOk('abc1234') && !pwOk('abcdefgh') && !pwOk('12345678'));
}

console.log('\n4. the trustee screen reads the code from the app first');
{
  const src = fs.readFileSync(new URL('../../functions/api/trustee-gate.js', import.meta.url), 'utf8').replace("from '../_shared.js'", "from './_shared.mjs'");
  fs.writeFileSync(new URL('./_build/trustee-gate-c.mjs', import.meta.url), src);
  const { onRequest: gate } = await import('./_build/trustee-gate-c.mjs');
  const g = async (code, env) => (await gate({ request: new Request('https://tapugan-safety.pages.dev/api/trustee-gate', { method: 'POST', body: JSON.stringify({ code }), headers: { 'Content-Type': 'application/json', origin: 'https://tapugan-safety.pages.dev' } }), env })).status;
  w.state.trustee_code = { key: 'trustee_code', value: 'tapugan2026' };
  check('the app password opens, capitals not counted', (await g('Tapugan2026', ENV)) === 200);
  check('the old Cloudflare code no longer does', (await g('482913', ENV)) === 403);
  delete w.state.trustee_code;
  check('no app code: Cloudflare\'s still works', (await g('482913', ENV)) === 200);
}

console.log('\n5. the screen in the app');
{
  const html = fs.readFileSync(new URL('../../index.html', import.meta.url), 'utf8');
  check('the passwords card sits on the users page, no separate dialog', html.includes('id="codes-card"') && !html.includes('id="m-codes"') && /function _codesLoad\(force\)/.test(html) && /function _codeSet\(key,own\)/.test(html));
  check('a code is hidden until "show"', html.includes("'\\u2022\\u2022\\u2022\\u2022\\u2022\\u2022\\u2022\\u2022'"));
  check('a change asks first', /function _codeSet[\s\S]{0,1500}confirm\(/.test(html));
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
