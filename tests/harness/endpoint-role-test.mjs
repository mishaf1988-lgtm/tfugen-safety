// Role gates on the money/identity endpoints (2026-09-24 pentest fix).
//
// requireUser proves WHO is calling but not that they MAY act. Until this fix,
// wa-send, claude and the trustee-notify test path admitted any non-anonymous
// session -- so a reporter (the role the database keeps out of every working
// table, and an attacker's most likely foothold) could:
//   - send arbitrary free-text WhatsApp from the company's verified number,
//   - burn the Workers AI quota / spend the Anthropic key,
//   - fire a test WhatsApp+email to any recipient.
// Now each requires a role. This runs the REAL modules with fetch mocked, so
// the gate is exercised, not read. vitre.js already had its own gate
// (vitre-gate-test.mjs); this covers the three that did not.
import { onRequest as waSend } from './_build/wa-send.mjs';
import { onRequest as claude } from './_build/claude.mjs';
import { onRequest as trusteeNotify } from './_build/trustee-notify.mjs';
let pass = 0, fail = 0;
const check = (l, c, d) => { if (c) { pass++; console.log('  ✓ ' + l); } else { fail++; console.log('  ✗ ' + l + (d !== undefined ? '  -> ' + JSON.stringify(d) : '')); } };
const SB = 'https://znhjtpcltrxxyfjczgvw.supabase.co';
const ORIGIN = 'https://tapugan-safety.pages.dev';
const ENV = { SUPABASE_SERVICE_ROLE_KEY: 'srv', META_PHONE_NUMBER_ID: 'pid', META_ACCESS_TOKEN: 'mtok', RESEND_API_KEY: 'rk', META_WABA_TEMPLATE: 'x' };

// o.email = what /auth/v1/user reports (null -> anonymous). o.row = the
// app_users row the service key reads back (null -> no row). Every other fetch
// (Meta, Anthropic, Resend, PostgREST selects) returns a bland 200 so the code
// past the gate runs without throwing; the test only asks whether the gate let
// the call through, i.e. whether the answer is 403 "insufficient role".
function world(o) {
  const w = { metaSent: false, aiCalled: false, resendCalled: false };
  globalThis.fetch = async (url, init) => {
    const u = String(url);
    const json = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json' } });
    if (u.startsWith(SB + '/auth/v1/user')) return json(o.email ? { id: 'u1', email: o.email, is_anonymous: false } : { id: 'a', is_anonymous: true });
    if (u.startsWith(SB + '/rest/v1/app_users')) return json(o.row ? [o.row] : []);
    if (u.includes('graph.facebook.com')) { w.metaSent = true; return json({ messages: [{ id: 'wamid' }] }); }
    if (u.includes('api.anthropic.com') || u.includes('/ai/run') || u.includes('gateway.ai')) { w.aiCalled = true; return json({ content: [{ text: 'ok' }] }); }
    if (u.includes('api.resend.com')) { w.resendCalled = true; return json({ id: 'em' }); }
    return json({}, 200);   // trustee-notify's PostgREST reads, taskName, etc.
  };
  return w;
}
const call = async (fn, body) => {
  const r = await fn({ request: new Request(ORIGIN + '/api/x', {
    method: 'POST', headers: { origin: ORIGIN, authorization: 'Bearer tok', 'content-type': 'application/json' },
    body: JSON.stringify(body) }), env: ENV });
  let j = null; try { j = await r.json(); } catch (e) {}
  return { status: r.status, json: j };
};
// "gate passed" = the request was NOT turned away for who the caller is. A 400
// (bad body) or 500 (missing downstream) past the gate still counts as passed.
const denied = (r) => r.status === 403 && /insufficient role|anonymous/.test((r.json && r.json.error) || '');

const ANON = { email: null };
const REPORTER = { email: 'yos@tfugen.local', row: { role: 'מדווח', active: true } };
const VIEWER = { email: 'qwer@tfugen.local', row: { role: 'צופה', active: true } };
const MANAGER = { email: 'dani@tfugen.local', row: { role: 'מנהל', active: true } };
const ADMIN = { email: 'admin@tfugen.local' };            // no app_users row needed
const INACTIVE_MGR = { email: 'old@tfugen.local', row: { role: 'מנהל', active: false } };

const WA = { to: '972501234567', text: 'שלום' };
const AI = { model: 'claude-3-5-haiku-20241022', max_tokens: 10, messages: [{ role: 'user', content: 'hi' }] };
const TEST_NOTIFY = { test: true, whatsapp_to: '972501234567', email_to: 'x@y.co' };

(async () => {
  console.log('\n1. wa-send: arbitrary WhatsApp from the company number = admin/manager only');
  for (const [name, who, allow] of [['anonymous', ANON, false], ['reporter', REPORTER, false], ['viewer', VIEWER, false], ['inactive manager', INACTIVE_MGR, false], ['manager', MANAGER, true], ['admin', ADMIN, true]]) {
    const w = world(who); const r = await call(waSend, WA);
    check(name + ' -> ' + (allow ? 'sends' : 'denied 403') + ' (' + r.status + ')', allow ? (!denied(r) && w.metaSent) : (denied(r) && !w.metaSent), r);
  }

  console.log('\n2. claude: reporter/anonymous cannot burn the AI key; staff and viewer may');
  for (const [name, who, allow] of [['anonymous', ANON, false], ['reporter', REPORTER, false], ['inactive manager', INACTIVE_MGR, false], ['viewer', VIEWER, true], ['manager', MANAGER, true], ['admin', ADMIN, true]]) {
    const w = world(who); const r = await call(claude, AI);
    check(name + ' -> ' + (allow ? 'reaches AI' : 'denied 403') + ' (' + r.status + ')', allow ? !denied(r) : (denied(r) && !w.aiCalled), r);
  }

  console.log('\n3. trustee-notify test path: a test message to any recipient = admin/manager only');
  for (const [name, who, allow] of [['anonymous', ANON, false], ['reporter', REPORTER, false], ['viewer', VIEWER, false], ['manager', MANAGER, true], ['admin', ADMIN, true]]) {
    const w = world(who); const r = await call(trusteeNotify, TEST_NOTIFY);
    check(name + ' -> ' + (allow ? 'sends' : 'denied 403') + ' (' + r.status + ')', allow ? !denied(r) : (denied(r) && !w.metaSent && !w.resendCalled), r);
  }

  console.log('\n4b. domain-bound role (2026-09-24 red-team): a staff username on a foreign domain is nobody');
  // rtmgr@evil.com has the local part of a real manager but the wrong domain.
  // userRole must not resolve it, so the endpoints deny it even though an
  // app_users row for that username exists.
  for (const [ep, name] of [[waSend, 'wa-send'], [claude, 'claude'], [trusteeNotify, 'trustee-notify']]) {
    const w = world({ email: 'rtmgr@evil.com', row: { role: 'מנהל', active: true } });
    const r = await call(ep, name === 'wa-send' ? WA : name === 'claude' ? AI : TEST_NOTIFY);
    check(name + ': rtmgr@evil.com is denied (' + r.status + ')', denied(r) && !w.metaSent && !w.aiCalled, r);
  }
  { const w = world({ email: 'dani@tfugen.local', row: { role: 'מנהל', active: true } }); const r = await call(waSend, WA); check('and the same username on @tfugen.local still passes', !denied(r) && w.metaSent, r); }

  console.log('\n4. the gate reads app_users the way the database does');
  // active=false is no role (mirrors is_admin_manager's active check); a role
  // string the map does not know is nobody.
  { const w = world({ email: 'x@tfugen.local', row: { role: 'מנהל', active: false } }); const r = await call(waSend, WA); check('a deactivated manager is denied', denied(r) && !w.metaSent, r); }
  { const w = world({ email: 'x@tfugen.local', row: { role: 'stranger', active: true } }); const r = await call(waSend, WA); check('an unknown role is denied', denied(r) && !w.metaSent, r); }
  { const w = world({ email: 'admin@tfugen.local' }); const r = await call(waSend, WA); check('the built-in admin needs no app_users row', !denied(r) && w.metaSent, r); }

  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('HARNESS ERROR', e); process.exit(2); });
