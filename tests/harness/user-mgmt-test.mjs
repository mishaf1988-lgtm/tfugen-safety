// User management: only the admin deletes and renames, and a half-done rename or
// delete is shown as a warning (BACKLOG 9.29, 01/10/2026).
//
// Server: the real delete-user.js and rename-user.js with fetch mocked. A
// manager (a real, signed-in session) gets 403 and the admin API is never
// touched; the admin goes through; the admin account itself cannot be renamed
// or deleted; a rename whose app_users update fails answers partial:true.
//
// Screen: the real index.html. Until this fix a partial rename wrote the warning
// and then closed the window under a green "renamed ✓" toast, and a delete
// whose sign-in account was not deleted said "deleted ✓". In both cases the
// user could be locked out (or still sign in) and nobody saw it.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
let pw; try { pw = require('playwright'); } catch (e) { pw = require('playwright-core'); }
const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
let pass = 0, fail = 0;
const check = (l, c, d) => { if (c) { pass++; console.log('  ✓ ' + l); } else { fail++; console.log('  ✗ ' + l + (d !== undefined ? '  -> ' + JSON.stringify(d) : '')); } };

// ---------- server ----------
const build = path.join(HERE, '_build', 'usermgmt');
fs.mkdirSync(build, { recursive: true });
fs.copyFileSync(path.join(ROOT, 'functions/_shared.js'), path.join(build, '_shared.mjs'));
for (const n of ['delete-user', 'rename-user']) {
  fs.writeFileSync(path.join(build, n + '.mjs'), fs.readFileSync(path.join(ROOT, 'functions/api', n + '.js'), 'utf8').replace("'../_shared.js'", "'./_shared.mjs'"));
}
const { onRequest: del } = await import(path.join(build, 'delete-user.mjs'));
const { onRequest: ren } = await import(path.join(build, 'rename-user.mjs'));

const SB = 'https://znhjtpcltrxxyfjczgvw.supabase.co';
const ORIGIN = 'https://tapugan-safety.pages.dev';
const ENV = { SUPABASE_SERVICE_ROLE_KEY: 'srv' };
// o.email: the caller. o.patch: how the app_users PATCH answers ('ok' | 'fail' | 'empty').
// o.authDel: how the auth DELETE answers (status).
function world(o) {
  const w = { admin: [] };
  globalThis.fetch = async (u, init) => {
    const url = String(u), m = ((init && init.method) || 'GET').toUpperCase();
    const json = (b, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { 'Content-Type': 'application/json' } });
    if (url.startsWith(SB + '/auth/v1/user')) return json({ id: 'c', email: o.email, is_anonymous: false });
    if (url.startsWith(SB + '/auth/v1/admin/users?')) { w.admin.push('list'); return json({ users: [{ id: 'u-dana', email: 'dana@tfugen.local' }] }); }
    if (url.startsWith(SB + '/auth/v1/admin/users/')) { w.admin.push(m + ' auth'); return m === 'DELETE' ? new Response(null, { status: o.authDel || 204 }) : json({ id: 'u-dana' }); }
    if (url.startsWith(SB + '/rest/v1/app_users')) {
      w.admin.push(m + ' app_users');
      if (m === 'PATCH' && o.patch === 'fail') return new Response('permission denied', { status: 500 });
      if (m === 'PATCH' && o.patch === 'empty') return json([]);
      return json([{ id: 'x' }]);
    }
    return json({});
  };
  return w;
}
const req = (body) => new Request(ORIGIN + '/api/x', { method: 'POST', headers: { Origin: ORIGIN, Authorization: 'Bearer t', 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
const call = async (fn, body) => { const r = await fn({ request: req(body), env: ENV }); let j = {}; try { j = await r.json(); } catch (e) {} return { status: r.status, j }; };

for (const email of ['manager@tfugen.local', 'reporter@tfugen.local', 'sviva@tfugen.local']) {
  let w = world({ email });
  let r = await call(del, { username: 'dana' });
  check('delete: ' + email + ' gets 403 and the admin API is not touched', r.status === 403 && w.admin.length === 0, { r, a: w.admin });
  w = world({ email });
  r = await call(ren, { old_username: 'dana', new_username: 'dana2' });
  check('rename: ' + email + ' gets 403 and the admin API is not touched', r.status === 403 && w.admin.length === 0, { r, a: w.admin });
}
{
  let w = world({ email: 'admin@tfugen.local' });
  let r = await call(del, { username: 'dana' });
  check('delete: admin deletes the sign-in account and the row', r.status === 200 && r.j.auth === 'deleted' && r.j.app_users === 'deleted' && w.admin.includes('DELETE auth') && w.admin.includes('DELETE app_users'), { r, a: w.admin });
  w = world({ email: 'admin@tfugen.local', authDel: 500 });
  r = await call(del, { username: 'dana' });
  check('delete: a failed sign-in delete is reported as failed (the screen reads this)', /^failed/.test(r.j.auth), r);
  w = world({ email: 'admin@tfugen.local' });
  r = await call(del, { username: 'admin' });
  check('delete: the admin account cannot be deleted', r.status === 400 && !w.admin.some((x) => /DELETE/.test(x)), { r, a: w.admin });
  w = world({ email: 'admin@tfugen.local', patch: 'ok' });
  r = await call(ren, { old_username: 'dana', new_username: 'dana2' });
  check('rename: admin renames the sign-in account and the row', r.status === 200 && r.j.success === true && w.admin.includes('PUT auth') && w.admin.includes('PATCH app_users'), { r, a: w.admin });
  w = world({ email: 'admin@tfugen.local' });
  r = await call(ren, { old_username: 'admin', new_username: 'boss' });
  check('rename: the admin account cannot be renamed', r.status === 400 && !w.admin.includes('PUT auth'), { r, a: w.admin });
  for (const p of ['fail', 'empty']) {
    world({ email: 'admin@tfugen.local', patch: p });
    r = await call(ren, { old_username: 'dana', new_username: 'dana2' });
    check('rename: app_users ' + p + ' -> partial:true with a warning', r.status === 200 && r.j.partial === true && !!r.j.warning && !r.j.success, r);
  }
}
fs.rmSync(build, { recursive: true, force: true });

// ---------- screen ----------
const HTML = 'file://' + path.resolve(ROOT, 'index.html');
const browser = await pw.chromium.launch();
try {
  const page = await (await browser.newContext({ locale: 'he-IL' })).newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('dialog', (d) => { page.__dialogs = (page.__dialogs || []).concat(d.message()); d.accept(); });
  await page.route('**/*', (r) => {
    const u = r.request().url();
    if (u.startsWith('file://')) return r.continue();
    return r.abort();
  });
  await page.goto(HTML, { waitUntil: 'load' });
  await page.waitForTimeout(700);

  // From file:// Chromium refuses fetch('/api/...') before any route sees it,
  // so the two endpoints are answered by a stand-in for fetch inside the page.
  const answer = (a) => page.evaluate((a) => {
    window.__realFetch = window.__realFetch || window.fetch;
    window.fetch = function (u, init) {
      if (/\/api\/(rename|delete)-user/.test(String(u))) return Promise.resolve(new Response(JSON.stringify(a), { status: 200, headers: { 'Content-Type': 'application/json' } }));
      return window.__realFetch(u, init);
    };
  }, a);
  const rename = async (a) => {
    await answer(a);
    await page.evaluate(() => {
      _sbToken = 'tok';
      window.__synced = 0; window.sbSync = function () { window.__synced++; };
      document.querySelectorAll('.toast').forEach((t) => t.remove());
      g('u-username').value = 'dana';
      openRenameDialog();
      g('rn-new').value = 'dana2';
      doRenameUser();
    });
    await page.waitForTimeout(400);
    return page.evaluate(() => ({
      open: g('m-rename').style.display !== 'none' && getComputedStyle(g('m-rename')).display !== 'none',
      status: g('rn-status').textContent,
      toasts: Array.from(document.querySelectorAll('.toast')).map((t) => t.textContent + '|' + t.className),
      synced: window.__synced,
    }));
  };

  let s = await rename({ partial: true, warning: 'auth renamed but app_users PATCH returned zero rows', old_username: 'dana', new_username: 'dana2' });
  check('screen: partial rename keeps the window open', s.open, s);
  check('screen: partial rename shows the warning and what failed', /חלקית/.test(s.status) && /zero rows/.test(s.status), s.status);
  check('screen: partial rename shows no green "renamed ✓"', !s.toasts.some((t) => /✓/.test(t) || / ok$/.test(t)), s.toasts);
  check('screen: partial rename still syncs (the sign-in name did change)', s.synced >= 1, s.synced);

  s = await rename({ success: true, old_username: 'dana', new_username: 'dana2' });
  check('screen: a full rename closes the window with "renamed ✓" (unchanged)', !s.open && s.toasts.some((t) => /✓/.test(t)), s);

  const remove = async (a) => {
    await answer(a); page.__dialogs = [];
    await page.evaluate(() => {
      _sbToken = 'tok';
      window.sbSync = function () {};
      document.querySelectorAll('.toast').forEach((t) => t.remove());
      DB.app_users = [{ id: 'dana', username: 'dana' }];
      g('u-username').value = 'dana';
      openDeleteUserDialog();
    });
    await page.waitForTimeout(400);
    return page.evaluate((d) => ({
      dialogs: d,
      toasts: Array.from(document.querySelectorAll('.toast')).map((t) => t.textContent),
      rowGone: !(DB.app_users || []).some((u) => u.username === 'dana'),
    }), page.__dialogs);
  };
  let r = await remove({ success: true, username: 'dana', auth: 'failed: HTTP 500', app_users: 'deleted' });
  r.dialogs = page.__dialogs;
  check('screen: delete with a failed sign-in delete warns (the account can still sign in)', r.dialogs.some((m) => /חלקית/.test(m) && /failed: HTTP 500/.test(m)), r.dialogs);
  check('screen: ...and shows no "deleted ✓"', !r.toasts.some((t) => /✓/.test(t)), r.toasts);
  r = await remove({ success: true, username: 'dana', auth: 'deleted', app_users: 'deleted' });
  r.dialogs = page.__dialogs;
  check('screen: a full delete still says "deleted ✓" and drops the row (unchanged)', r.toasts.some((t) => /✓/.test(t)) && r.rowGone && !r.dialogs.some((m) => /חלקית/.test(m)), r);
  r = await remove({ success: true, username: 'dana', auth: 'not_found', app_users: 'deleted' });
  check('screen: a sign-in account that was already gone is not a warning', r.toasts.some((t) => /✓/.test(t)), r);
  check('no page errors', errors.length === 0, errors.slice(0, 3));
} finally {
  await browser.close();
}
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
