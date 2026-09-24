// Who may use the Vitre bridge, and whether "paused" means paused.
//
// Review of 2026-09-24. functions/api/vitre.js admitted ANY signed-in account
// through requireUser -- and that includes a reporter, the role the database
// keeps out of every working table and out of other people's app_users rows.
// Through the bridge the same account could read the whole company's phone and
// email directory (op=employees) and send an SMS + email in the company's name
// to any employee, with any link (op=notify).
//
// And op=notify had been "paused" the day before (#796) by hiding a button and
// setting a flag in the page. Neither reaches the server: a direct POST still
// sent the SMS. Michael believed the channel was off.
//
// Runs the real module with fetch mocked, so the gates are exercised rather
// than read.
import { onRequest } from './_build/vitre.mjs';
let pass = 0, fail = 0;
const check = (l, c, d) => { if (c) { pass++; console.log('  ✓ ' + l); } else { fail++; console.log('  ✗ ' + l + (d !== undefined ? '  -> ' + JSON.stringify(d) : '')); } };
const SB = 'https://znhjtpcltrxxyfjczgvw.supabase.co';
const BASE = { VITRE_API_KEY_ID: 'kid', VITRE_API_KEY_SECRET: 'ksecret', SUPABASE_SERVICE_ROLE_KEY: 'srv' };

// o.email   who /auth/v1/user says is calling (null = anonymous)
// o.row     the app_users row for that account, or null for none
function world(o) {
  const w = { calls: [] };
  globalThis.fetch = async (url, init) => {
    const u = String(url);
    w.calls.push({ u, method: (init && init.method) || 'GET', body: init && init.body ? String(init.body) : null });
    const json = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json' } });
    if (u.startsWith(SB + '/auth/v1/user')) return json(o.email ? { id: 'u1', email: o.email, is_anonymous: false } : { id: 'a', is_anonymous: true });
    if (u.startsWith(SB + '/rest/v1/app_users')) return json(o.row ? [o.row] : []);
    if (u.includes('/Employee')) return json([{ id: 1, displayName: 'עובד', phone: '0501234567', email: 'w@x.co' }]);
    if (u.includes('/review/submit')) return json({ id: 777, status: 'Draft' });
    return json({ message: 'unexpected ' + u }, 404);
  };
  return w;
}
const run = async (method, qs, body, env) => {
  const r = await onRequest({ request: new Request('https://tapugan-safety.pages.dev/api/vitre?' + qs, {
    method, headers: { origin: 'https://tapugan-safety.pages.dev', authorization: 'Bearer tok', 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body) }), env: env || BASE });
  let j = null; try { j = await r.json(); } catch (e) {}
  return { status: r.status, json: j };
};
const reachedVitre = (w) => w.calls.some((c) => c.u.includes('hbinov'));
const MANAGER = { email: 'dani@tfugen.local', row: { role: 'מנהל', active: true } };
const REPORTER = { email: 'yos@tfugen.local', row: { role: 'מדווח', active: true } };
const NOTE = { to: '1234', title: 'ליקוי', details: 'פרטים' };

console.log('\n1. a reporter is not staff');
{
  // The database keeps a reporter out of app_users beyond their own row. The
  // directory must not come back to them from Vitre instead.
  let w = world(REPORTER);
  let r = await run('GET', 'op=employees');
  check('the company directory is refused to a reporter', r.status === 403 && r.json.error === 'staff only', r);
  check('...and Vitre was never asked', !reachedVitre(w), w.calls.map((c) => c.u));
  w = world(REPORTER);
  r = await run('POST', 'op=notify', NOTE, { ...BASE, VITRE_NOTIFY_ENABLED: '1' });
  check('a reporter cannot send an SMS in the company\'s name, even with the channel on', r.status === 403, r);
  check('...and nothing was submitted', !reachedVitre(w), w.calls.map((c) => c.u));
  for (const op of ['ping', 'tasks', 'orgunits', 'trainings&page=0', 'training&id=5', 'training_photo&id=5']) {
    world(REPORTER);
    const x = await run('GET', 'op=' + op);
    check('op=' + op.split('&')[0] + ' is refused to a reporter', x.status === 403, x.status);
  }
}

console.log('\n2. nor is somebody with no account row, or a deactivated one');
{
  let w = world({ email: 'ghost@tfugen.local', row: null });
  let r = await run('GET', 'op=employees');
  check('a login with no app_users row is refused', r.status === 403 && !reachedVitre(w), r);
  w = world({ email: 'dani@tfugen.local', row: { role: 'מנהל', active: false } });
  r = await run('GET', 'op=employees');
  check('a manager whose account was switched off is refused', r.status === 403 && !reachedVitre(w), r);
  w = world({ email: null });
  r = await run('GET', 'op=employees');
  check('the anonymous trustee kiosk still cannot reach it', r.status === 403 && !reachedVitre(w), r);
}

console.log('\n3. a manager can, and the admin-only ops stay admin-only');
{
  let w = world(MANAGER);
  let r = await run('GET', 'op=employees');
  check('a manager gets the directory', r.status === 200 && r.json.count === 1, r);
  w = world(MANAGER);
  r = await run('GET', 'op=review_schema&id=11997');
  check('...but the form schema is still admin only', r.status === 403 && r.json.error === 'admin only', r);
  w = world({ email: 'admin@tfugen.local', row: null });
  r = await run('GET', 'op=employees');
  check('the admin account passes without needing an app_users row', r.status === 200, r);
}

console.log('\n4. paused means paused');
{
  // #796 hid the button and set _VITRE_SMS_ON=false in the page. A direct POST
  // did not care. The pause is on the server now.
  let w = world(MANAGER);
  let r = await run('POST', 'op=notify', NOTE);
  check('with VITRE_NOTIFY_ENABLED unset, notify is refused', r.status === 403 && /paused/.test(r.json.error), r);
  check('...and no SMS was submitted', !reachedVitre(w), w.calls.map((c) => c.u));
  w = world(MANAGER);
  r = await run('POST', 'op=notify', NOTE, { ...BASE, VITRE_NOTIFY_ENABLED: 'true' });
  check('only the exact value 1 turns it on', r.status === 403, r);
  w = world(MANAGER);
  r = await run('POST', 'op=notify', NOTE, { ...BASE, VITRE_NOTIFY_ENABLED: '1' });
  check('with it set, a manager can send', r.status === 200 && r.json.ok === true, r);
}

console.log('\n5. a link in the company\'s name points at the company\'s app');
{
  const ON = { ...BASE, VITRE_NOTIFY_ENABLED: '1' };
  let w = world(MANAGER);
  let r = await run('POST', 'op=notify', { ...NOTE, link: 'https://evil.example/login' }, ON);
  check('a link to anywhere else is refused', r.status === 400 && /link/.test(r.json.error), r);
  check('...before anything is sent', !reachedVitre(w), w.calls.map((c) => c.u));
  w = world(MANAGER);
  r = await run('POST', 'op=notify', { ...NOTE, link: 'javascript:alert(1)' }, ON);
  check('...so is a javascript: link', r.status === 400, r);
  w = world(MANAGER);
  r = await run('POST', 'op=notify', { ...NOTE, link: 'http://tapugan-safety.pages.dev/' }, ON);
  check('...and the right host over plain http', r.status === 400, r);
  w = world(MANAGER);
  r = await run('POST', 'op=notify', { ...NOTE, link: 'https://tapugan-safety.pages.dev.evil.example/' }, ON);
  check('...and a host that only starts with ours', r.status === 400, r);
  w = world(MANAGER);
  r = await run('POST', 'op=notify', { ...NOTE, link: 'https://tapugan-safety.pages.dev/?emp=1' }, ON);
  check('a link to the app is accepted', r.status === 200, r);
  w = world(MANAGER);
  r = await run('POST', 'op=notify', NOTE, ON);
  check('...and so is no link at all', r.status === 200, r);
}

console.log('\n4. domain-bound staff (2026-09-24 red-team)');
{
  // The manager's local part on a foreign domain must not pass as staff --
  // staffRole binds to the full <id>@tfugen.local email now.
  let w = world({ email: 'dani@evil.com', row: { role: 'מנהל', active: true } });
  let r = await run('GET', 'op=employees');
  check('dani@evil.com cannot read the directory', r.status === 403 && !reachedVitre(w), r);
  w = world(MANAGER);
  r = await run('GET', 'op=employees');
  check('dani@tfugen.local still can', r.status === 200, r);
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
