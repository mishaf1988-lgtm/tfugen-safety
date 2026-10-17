// End-to-end check of the app against the TEST database (tfugen-staging), from the cloud,
// in a real browser (16/10/2026, Michael: "a development and test environment, who runs the
// tests there?" -- Claude does, with this script). Not part of the CI harness: it needs the
// network and a password that exists only for the length of one run.
//
// How: the repo is served on 127.0.0.1, and Chromium resolves e2e.tapugan-safety.pages.dev to
// it. To the page that is a preview host, so index.html picks the test database (_STAGING),
// exactly as on a real Cloudflare preview build; nothing here can reach the live one.
//
// Run:  STAGING_PW=<the password set a moment ago in auth.users of ldzbjbsumzqjyvtpiwqo> node tests/staging/e2e.js
// Then set a new random password again (project-files/staging/README.md).
const http = require('http');
const fs = require('fs');
const path = require('path');
let pw; try { pw = require('playwright'); } catch (e) { pw = require('playwright-core'); }

const ROOT = path.resolve(__dirname, '../..');
const HOST = 'e2e.tapugan-safety.pages.dev';
const TEST_DB = 'ldzbjbsumzqjyvtpiwqo.supabase.co', LIVE_DB = 'znhjtpcltrxxyfjczgvw.supabase.co';
const PASS = process.env.STAGING_PW || '';
let ok = 0, bad = 0;
const check = (l, c, d) => { if (c) { ok++; console.log('  ✓ ' + l); } else { bad++; console.log('  ✗ ' + l + (d !== undefined ? '  -> ' + JSON.stringify(d).slice(0, 300) : '')); } };
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' };

(async () => {
  if (!PASS) { console.log('STAGING_PW is not set'); process.exit(2); }
  const srv = http.createServer((req, res) => {
    const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]) === '/' ? 'index.html' : decodeURIComponent(req.url.split('?')[0]));
    if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(p)] || 'application/octet-stream' });
    fs.createReadStream(p).pipe(res);
  }).listen(0, '127.0.0.1');
  await new Promise((r) => srv.on('listening', r));
  const port = srv.address().port;
  const browser = await pw.chromium.launch({ args: ['--host-resolver-rules=MAP ' + HOST + ' 127.0.0.1'] });
  // A phone in Israel (17/10/2026): the incident form turns the local time it shows into UTC by the
  // device's zone, so a browser on UTC would store a shifted hour.
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, timezoneId: 'Asia/Jerusalem', locale: 'he-IL' });
  const hosts = new Set(), errors = [];
  page.on('request', (r) => { try { hosts.add(new URL(r.url()).host); } catch (e) {} });
  page.on('pageerror', (e) => errors.push(String(e.message || e)));
  page.on('dialog', (d) => d.accept().catch(() => {}));

  console.log('\n1. the page on a preview host');
  await page.goto('http://' + HOST + ':' + port + '/index.html', { waitUntil: 'load' });
  await page.waitForTimeout(1500);
  const boot = await page.evaluate(() => ({ st: typeof _STAGING !== 'undefined' && _STAGING, sbu: typeof SBU !== 'undefined' && SBU, title: document.title }));
  check('index.html chose the test database', boot.st === true && boot.sbu === 'https://' + TEST_DB, boot);
  check('the tab title says ניסוי', /^ניסוי - /.test(boot.title), boot.title);

  console.log('\n2. sign-in as claude-test');
  await page.fill('#uname', 'claude-test');
  await page.fill('#pw', PASS);
  await page.evaluate(() => doLogin());
  await page.waitForFunction(() => typeof _sbToken !== 'undefined' && !!_sbToken, null, { timeout: 45000 }).catch(() => {});
  const auth = await page.evaluate(() => ({ token: !!_sbToken, role: (typeof CU !== 'undefined' && CU && CU.role) || null }));
  check('signed in (a session token from the test database)', auth.token, auth);

  console.log('\n3. data from the test database reaches the screens');
  await page.waitForTimeout(6000);
  const data = await page.evaluate(() => {
    const D = (typeof DB !== 'undefined' && DB) || {};
    return { ncr: (D.ncr || []).map((x) => x.id), emp: (D.emp || []).map((x) => x.id), thz: (D.tour_hazards || []).map((x) => x.id) };
  });
  check('NCR: the sample row is loaded', data.ncr.indexOf('ncr-t1') >= 0, data.ncr);
  check('employees: the two sample rows', data.emp.indexOf('emp-t1') >= 0 && data.emp.indexOf('emp-t2') >= 0, data.emp);
  check('tour hazards: the sample row', data.thz.indexOf('th-t1') >= 0, data.thz);

  console.log('\n4. a save, an edit and a delete through the app reach the test database');
  // The app's own write path (sbIns / sbUpd / sbDel -> the outbox -> PostgREST with RLS), read
  // back from the server, not from DB (17/10/2026, STATUS "סביבת פיתוח וניסוי": "forms and saving").
  // A row left by an earlier run that stopped half way (an intentional break) is removed first.
  await page.evaluate(async () => {
    const r = await fetch(SBU + '/rest/v1/docs?or=(id.like.e2e-*,n.like.e2e-*)&select=id', { headers: sbH() });
    (r.ok ? await r.json() : []).forEach((x) => sbDel('docs', x.id));
    for (const t of ['ncr', 'tour_hazards', 'inc']) {
      const q = await fetch(SBU + '/rest/v1/' + t + '?select=*&limit=500', { headers: sbH() });
      (q.ok ? await q.json() : []).filter((x) => Object.values(x).some((v) => String(v).indexOf('e2e-form-') === 0)).forEach((x) => sbDel(t, x.id));
    }
    await _obIdle();
  });
  const rid = 'e2e-' + Date.now();
  const read = () => page.evaluate(async (id) => {
    const r = await fetch(SBU + '/rest/v1/docs?id=eq.' + encodeURIComponent(id) + '&select=id,n,e', { headers: sbH() });
    return { status: r.status, rows: r.ok ? await r.json() : await r.text() };
  }, rid);
  await page.evaluate(async (id) => { sbIns('docs', { id: id, n: 'בדיקת e2e', e: null }); await _obIdle(); }, rid);
  const ins = await read();
  check('insert: the row is on the server, empty date as null', ins.status === 200 && ins.rows.length === 1 && ins.rows[0].e === null, ins);
  await page.evaluate(async (id) => { sbUpd('docs', { id: id, e: '2027-01-31' }); await _obIdle(); }, rid);
  const upd = await read();
  check('update: the new date is on the server', upd.status === 200 && upd.rows.length === 1 && upd.rows[0].e === '2027-01-31', upd);
  await page.evaluate(async (id) => { sbDel('docs', id); await _obIdle(); }, rid);
  const del = await read();
  check('delete: the row is gone from the server', del.status === 200 && del.rows.length === 0, del);
  const left = await page.evaluate(() => _obGet().length);
  check('the outbox is empty (nothing failed and waits)', left === 0, left);

  console.log('\n5. forms on the screen: open, fill, save, read back from the server');
  // As a person does it (17/10/2026): the page's "new" button, every visible field filled by its
  // type, the form's own save button. The id comes from the app's own insert; the row is read back
  // from the server, must hold the mark and the date typed, and is then removed.
  for (const [pg, tbl] of [['docs', 'docs'], ['ncr', 'ncr'], ['thz', 'tour_hazards'], ['inc', 'inc']]) {
    const mark = 'e2e-form-' + pg + '-' + Date.now();
    const form = await page.evaluate(async ({ pg, tbl, mark }) => {
      const ids = [], ins0 = window.sbIns;
      window.sbIns = function (t, r) { if (t === tbl && r && r.id) ids.push(r.id); return ins0.apply(this, arguments); };
      try {
        goPage(pg);
        const root = document.getElementById('pg-' + pg) || document.body;
        const add = [...root.querySelectorAll('button,a')].find((b) => b.offsetParent !== null && /openModal\('m-(?!reports-sheet|modules-sheet|del|view)|openNew[A-Za-z]*\(\)|^_?[a-z]*New\(|^new[A-Z]|^add[A-Z]/.test(b.getAttribute('onclick') || '') && !/Xl|Import|Rename|Reset|Delete|Starter/.test(b.getAttribute('onclick') || ''));
        if (!add) return { err: 'no new button' };
        add.click();
        const m = [...document.querySelectorAll('.modal')].find((x) => x.style.display === 'block' || x.style.display === 'flex');
        if (!m) return { err: 'no form opened' };
        const iso = new Date(Date.now() + 200 * 864e5).toISOString().substring(0, 10);
        [...m.querySelectorAll('input,textarea,select')].filter((el) => el.offsetParent !== null && !el.disabled && !el.readOnly).forEach((el) => {
          const ty = (el.type || '').toLowerCase();
          if (['hidden', 'file', 'button', 'submit', 'checkbox', 'radio', 'password', 'search'].indexOf(ty) >= 0) return;
          if (el.tagName === 'SELECT') { const o = [...el.options].find((x) => x.value && !x.disabled); if (o && !el.value) el.value = o.value; }
          else if (ty === 'date') el.value = iso;
          else if (ty === 'datetime-local') el.value = iso + 'T08:00';
          else if (ty === 'time') el.value = '08:00';
          else if (ty === 'number') el.value = el.value || '1';
          else if (ty === 'email') el.value = 'a@b.co';
          else if (ty === 'tel') el.value = '0501234567';
          else if (!el.value) el.value = mark;
          el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true }));
        });
        const first = [...m.querySelectorAll('input[type=text],input:not([type]),textarea')].find((el) => el.offsetParent !== null && !el.readOnly && !el.disabled);
        if (first) { first.value = mark; first.dispatchEvent(new Event('input', { bubbles: true })); }
        const sv = [...m.querySelectorAll('button')].find((b) => b.offsetParent !== null && (/^\s*sv|save|Save/.test(b.getAttribute('onclick') || '') || /שמור/.test(b.textContent)));
        if (!sv) return { err: 'no save button in ' + m.id };
        sv.click();
        await _obIdle();
        return { form: m.id, iso: iso, open: m.style.display === 'block' || m.style.display === 'flex', ids: ids };
      } finally { window.sbIns = ins0; }
    }, { pg, tbl, mark });
    check(pg + ': the form opened, saved and closed', form && !form.err && !form.open && form.ids.length === 1, form);
    const id = form && form.ids && form.ids[0];
    const saved = id ? await page.evaluate(async ({ tbl, id }) => {
      const r = await fetch(SBU + '/rest/v1/' + tbl + '?id=eq.' + encodeURIComponent(id) + '&select=*', { headers: sbH() });
      return { status: r.status, rows: r.ok ? await r.json() : await r.text() };
    }, { tbl, id }) : { rows: [] };
    const row = saved.rows && saved.rows[0];
    const vals = row ? Object.values(row).map(String) : [];
    check(pg + ': the row is on the server with the mark and the date typed', !!row && vals.some((v) => v.indexOf(mark) >= 0) && vals.some((v) => v.indexOf(form.iso) === 0), row || saved);
    if (row && pg === 'inc') {
      const want = await page.evaluate((iso) => new Date(iso + 'T08:00').toISOString(), form.iso);
      check('inc: 08:00 Israel time is stored as the same moment', Date.parse(row.dt) === Date.parse(want), { stored: row.dt, want });
    }
    if (id && pg === 'docs') {
      // Edit the same row as a person does (17/10/2026): 👁 on it, "edit", change the first text
      // field, the form's save. The server must hold the new text, still one row (no duplicate).
      const mark2 = mark + '-edited';
      const ed = await page.evaluate(async ({ tbl, id, mark2 }) => {
        const r = await fetch(SBU + '/rest/v1/' + tbl + '?id=eq.' + encodeURIComponent(id) + '&select=*', { headers: sbH() });
        const row = (await r.json())[0];
        if (!DB[tbl].some((x) => x.id === id)) DB[tbl].push(row);
        showView(tbl, id);
        const eb = document.getElementById('view-edit');
        if (!eb || eb.style.display === 'none') return { err: 'no edit button on the view' };
        eb.click();
        const m = [...document.querySelectorAll('.modal')].find((x) => (x.style.display === 'block' || x.style.display === 'flex') && x.id !== 'm-view');
        if (!m) return { err: 'no edit form opened' };
        const first = [...m.querySelectorAll('input[type=text],input:not([type]),textarea')].find((el) => el.offsetParent !== null && !el.readOnly && !el.disabled);
        if (!first) return { err: 'no text field in ' + m.id };
        first.value = mark2; first.dispatchEvent(new Event('input', { bubbles: true }));
        const sv = [...m.querySelectorAll('button')].find((b) => b.offsetParent !== null && (/^\s*sv|save|Save/.test(b.getAttribute('onclick') || '') || /\u05e9\u05de\u05d5\u05e8/.test(b.textContent)));
        if (!sv) return { err: 'no save button in ' + m.id };
        sv.click();
        await _obIdle();
        return { form: m.id, open: m.style.display === 'block' || m.style.display === 'flex' };
      }, { tbl, id, mark2 });
      check(pg + ': edit through the view opened, saved and closed', ed && !ed.err && !ed.open, ed);
      const after = await page.evaluate(async ({ tbl, mark, mark2 }) => {
        const r = await fetch(SBU + '/rest/v1/' + tbl + '?select=*&or=(n.eq.' + encodeURIComponent(mark) + ',n.eq.' + encodeURIComponent(mark2) + ')', { headers: sbH() });
        return r.ok ? await r.json() : [];
      }, { tbl, mark, mark2 });
      check(pg + ': the server holds the edit, one row, no duplicate', after.length === 1 && after[0].id === id && after[0].n === mark2, after);
    }
    if (id && pg === 'docs') {
      // Delete as a person does (17/10/2026): the row's trash on the page, the delete password
      // (a wrong one first: nothing may go), the dialog's confirm. Read back from the server.
      const del = async (pw) => page.evaluate(async ({ tbl, id, pw }) => {
        goPage('docs');
        // The trash carries its table and id in data-dtbl / data-did (askDel(this.dataset.dtbl,this.dataset.did)).
        const b = [...document.querySelectorAll('#pg-docs [data-did]')].find((x) => x.dataset.did === id && x.dataset.dtbl === tbl && /askDel/.test(x.getAttribute('onclick') || ''));
        if (!b) return { err: 'no trash button for the row' };
        b.click();
        const m = document.getElementById('m-del-confirm');
        if (!m || m.style.display !== 'block') return { err: 'the delete dialog did not open' };
        document.getElementById('del-pw').value = pw;
        confirmDel();
        await _obIdle();
        const r = await fetch(SBU + '/rest/v1/' + tbl + '?id=eq.' + encodeURIComponent(id) + '&select=id', { headers: sbH() });
        return { open: m.style.display === 'block', server: r.ok ? (await r.json()).length : -1, local: DB[tbl].some((x) => x.id === id) };
      }, { tbl, id, pw });
      const wrong = await del('wrong-password');
      check(pg + ': a wrong delete password deletes nothing', wrong && !wrong.err && wrong.open && wrong.server === 1 && wrong.local, wrong);
      await page.evaluate(() => { try { cancelDel(); } catch (e) {} });
      const right = await del(await page.evaluate(() => _delPw()));
      check(pg + ': the trash, the password and confirm delete the row on the server', right && !right.err && !right.open && right.server === 0 && !right.local, right);
    } else if (id) await page.evaluate(async ({ tbl, id }) => { sbDel(tbl, id); await _obIdle(); }, { tbl, id });
  }
  console.log('\n6. a trustee phone: anonymous session, its own report, nothing else');
  // The kiosk with no password (17/10/2026): a fresh browser, the same preview host, no sign-in.
  // The trustee code is checked by /api/trustee-gate, which this local server does not run, so this
  // part tests what the phone does with the database: the anonymous session, the insert under the
  // anonymous policies, and that manager tables stay closed. The Turnstile widget is skipped (the
  // site key belongs to the live host); the test project must accept an anonymous sign-in without it.
  // trustee_reports rows are never deleted (CLAUDE.md), so each run leaves one row marked e2e-kiosk.
  const ctx2 = await browser.newContext({ viewport: { width: 390, height: 844 }, timezoneId: 'Asia/Jerusalem', locale: 'he-IL' });
  const kiosk = await ctx2.newPage();
  kiosk.on('request', (r) => { try { hosts.add(new URL(r.url()).host); } catch (e) {} });
  kiosk.on('pageerror', (e) => errors.push('kiosk: ' + String(e.message || e)));
  await kiosk.goto('http://' + HOST + ':' + port + '/index.html', { waitUntil: 'load' });
  await kiosk.waitForTimeout(1500);
  const anon = await kiosk.evaluate(async () => {
    window._captcha = () => Promise.resolve(null);
    try { await _sbAuth(); } catch (e) { return { err: String(e && (e.message || e)) }; }
    const claims = JSON.parse(atob(_sbToken.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    const d = new Date().toISOString().substring(0, 10), id = gid();
    const row = { id: id, u: 'e2e-kiosk', m: _truMonthKey(d), t: 1, d: d, location_id: null, loc: 'e2e-kiosk', ok: true, f: null, photo_url: null, s: TRUSTEE_S_OK, ts: new Date().toISOString() };
    sbIns('trustee_reports', row);
    await _obIdle();
    const get = async (q) => { const r = await fetch(SBU + '/rest/v1/' + q, { headers: sbH() }); return { status: r.status, rows: r.ok ? await r.json() : await r.text() }; };
    return { anonymous: claims.is_anonymous === true, id: id, own: await get('trustee_reports?id=eq.' + id + '&select=id,u,s'), ncr: await get('ncr?select=id&limit=5'), emp: await get('emp?select=id&limit=5'), outbox: _obGet().length };
  });
  if (anon && anon.err && /anonymous sign-ins are disabled/i.test(anon.err)) {
    // A setting of the test project only (Authentication > Sign In / Providers), chrome-queue C17.
    console.log('  - skipped: anonymous sign-ins are off in the test project (chrome-queue C17)');
  } else {
  check('kiosk: an anonymous session from the test database', anon && !anon.err && anon.anonymous, anon);
  check('kiosk: the report reached the server under the anonymous policies', anon && anon.own && anon.own.status === 200 && anon.own.rows.length === 1 && anon.outbox === 0, anon && { own: anon.own, outbox: anon.outbox });
  check('kiosk: NCR and employees stay closed to it', anon && anon.ncr && Array.isArray(anon.ncr.rows) && anon.ncr.rows.length === 0 && Array.isArray(anon.emp.rows) && anon.emp.rows.length === 0, anon && { ncr: anon.ncr, emp: anon.emp });
  }
  await ctx2.close();

  console.log('\n7. never the live database');
  check('no request went to the live Supabase', !hosts.has(LIVE_DB), [...hosts]);
  check('requests did go to the test Supabase', hosts.has(TEST_DB), [...hosts]);
  check('no page errors', errors.length === 0, errors.slice(0, 5));

  await browser.close(); srv.close();
  console.log('\n' + ok + ' passed, ' + bad + ' failed');
  process.exit(bad ? 1 : 0);
})().catch((e) => { console.error('E2E ERROR', e); process.exit(2); });
