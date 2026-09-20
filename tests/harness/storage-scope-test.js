// The Storage bucket was open to every signed-in session, and since September
// "signed in" includes the no-password trustee kiosk, whose anonymous Supabase
// token carries the `authenticated` role. Any visitor could list, download,
// overwrite and delete every file ever uploaded — incident photos, hearing-test
// scans, medical documents, contractor files.
//
// migrations/2026-09-20_storage_trustee_scope.sql closes that by scoping the
// kiosk to object names beginning 'tru-ph-'. That boundary is not a property of
// the database — it is a property of THIS CODE: _attachBtn passes the area id
// as the upload prefix, the trustee form's area ids come from _truPhId, and
// _fileUpload names the object after the prefix.
//
// If any of those three drift, the policy silently starts hiding photos the
// trustee needs, or stops hiding files it should. This suite is what notices.
const path = require('path');
let pw; try { pw = require('playwright'); } catch (e) { pw = require('playwright-core'); }
const ROOT = path.resolve(__dirname, '../..');
const HTML = 'file://' + path.join(ROOT, 'index.html');
const fs = require('fs');
let pass = 0, fail = 0;
const check = (l, c, d) => { if (c) { pass++; console.log('  ✓ ' + l); } else { fail++; console.log('  ✗ ' + l + (d !== undefined ? '  -> ' + JSON.stringify(d) : '')); } };

const KIOSK_PREFIX = 'tru-ph-';

(async () => {
  const browser = await pw.chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, locale: 'he-IL' });
  const page = await ctx.newPage();
  page.on('dialog', (d) => d.accept().catch(() => {}));
  await page.route('**/*', (r) => r.request().url().startsWith('file://') ? r.continue() : r.abort());
  await page.goto(HTML, { waitUntil: 'load' });
  await page.waitForTimeout(700);

  await page.evaluate(() => {
    document.getElementById('login').style.display = 'none';
    document.getElementById('app').style.display = 'block';
    window.sdb = function () {}; window.addLog = function () {};
    window.__toasts = []; window.toast = function (m) { window.__toasts.push(String(m)); };
    // capture what _fileUpload would PUT, instead of putting it
    window.__uploads = [];
    window._sbAuth = function () { return Promise.resolve(); };
    window._sbToken = 'tok';
    window.fetch = function (u, o) {
      const url = String(u);
      window.__uploads.push({ url: url, method: (o && o.method) || 'GET' });
      // _signifyDom STRIPS data-sign and only sets src/href if signing answers.
      // A mock that refuses to sign leaves nothing on the page to inspect, so
      // sign for real here — that is also the path the kiosk depends on.
      const m = url.match(/\/storage\/v1\/object\/sign\/([^/]+)\/(.+)$/);
      const body = m ? { signedURL: '/object/sign/' + m[1] + '/' + m[2] + '?token=SIGNED' } : {};
      return Promise.resolve({ ok: true, status: 200, text: () => Promise.resolve(JSON.stringify(body)), json: () => Promise.resolve(body) });
    };
    window._odMaybeMirror = function () {};
    // A real 1x1 PNG, so the image branch (_imgCompress → canvas) runs for real
    // rather than being stepped around.
    window.__pngFile = function (name) {
      const b64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
      const bin = atob(b64), arr = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
      return new File([arr], name || 'p.png', { type: 'image/png' });
    };
    // Upload once and resolve with the stored object name.
    window.__upload = function (prefix, file) {
      window.__uploads = [];
      return new Promise(function (res) {
        _fileUpload(file || window.__pngFile(), prefix, function () {
          const u = (window.__uploads[0] || {}).url || '';
          res({ url: u, name: (u.split('/incidents-photos/')[1] || '').split('?')[0] });
        });
      });
    };
  });

  console.log('\n1. a trustee tour photo is named so the policy can find it');
  {
    const r = await page.evaluate(() => {
      window.__uploads = [];
      // the area id the trustee form actually builds, for task 5 item "a"
      const areaId = _truPhId(5, 'a');
      // _attachBtn/_attachClear both call _attachPick(areaId, areaId) — the
      // PREFIX IS THE AREA ID, which is the whole basis of the policy
      const btn = _attachBtn(areaId);
      const m = btn.match(/_attachPick\('([^']+)','([^']+)'\)/);
      return window.__upload(areaId).then(function (up) {
        return { areaId: areaId, pickArea: m && m[1], pickPrefix: m && m[2], url: up.url, name: up.name };
      });
    });
    check('the trustee form builds area ids beginning "' + KIOSK_PREFIX + '"', r.areaId.indexOf(KIOSK_PREFIX) === 0, r.areaId);
    check('the attach button passes the area id AS the upload prefix', r.pickArea === r.areaId && r.pickPrefix === r.areaId, r);
    check('so the stored object name begins "' + KIOSK_PREFIX + '"', r.name.indexOf(KIOSK_PREFIX) === 0, { url: r.url, name: r.name });
    check('...and a photo is stored as .jpg after compression', /\.jpg$/.test(r.name), r.name);
    check('...and it lands in the bucket the policy names', String(r.url).indexOf('/storage/v1/object/incidents-photos/') > 0, r.url);
  }

  console.log('\n2. nothing else lands under that prefix');
  {
    const r = await page.evaluate(() => {
      // every prefix the app uploads under, taken from the real call sites
      const OTHERS = ['nm', 'inc', 'tr', 'toolbox', 'easp', 'round', 'eqi', 'docs', 'med',
        'ppe', 'ctr', 'pf-dash', 'cap-123', 'cap-vid-123', 'ins', 'drl', 'wst', 'hzm',
        'nm-photo-area', 'inc-attach-area', 'tr-attach-area', 'tb-attach-area', 'ea-attach-area'];
      return OTHERS.reduce(function (chain, p) {
        return chain.then(function (acc) {
          return window.__upload(p).then(function (up) { acc.push({ prefix: p, name: up.name }); return acc; });
        });
      }, Promise.resolve([]));
    });
    const collide = r.filter((x) => x.name.indexOf(KIOSK_PREFIX) === 0);
    check('none of the ' + r.length + ' other upload prefixes produces a "' + KIOSK_PREFIX + '" name', collide.length === 0, collide);
    // the near-miss: 'tr' (training certificates) sits one letter away
    const tr = r.filter((x) => x.prefix === 'tr')[0];
    check('training certificates ("tr-…") do NOT match the kiosk prefix', tr && tr.name.indexOf('tr-') === 0 && tr.name.indexOf(KIOSK_PREFIX) !== 0, tr);
  }

  console.log('\n3. the kiosk screen only ever shows its own photos');
  {
    const r = await page.evaluate(() => {
      const SB = 'https://znhjtpcltrxxyfjczgvw.supabase.co/storage/v1/object/public/incidents-photos/';
      const today = new Date().toISOString().substring(0, 10);
      const m = today.substring(0, 7);
      DB.trustee_reports = [
        { id: 'a1', u: 'דנה', m: m, t: 5, d: today, loc: 'מחסן', ok: false, f: 'מטף ללא פלומבה', s: 'פתוח', photo_url: SB + 'tru-ph-5-a-111.jpg' },
        { id: 'a2', u: 'דנה', m: m, t: 3, d: today, loc: 'מסדרון', ok: true, s: 'תקין', photo_url: SB + 'tru-ph-3-a-222.jpg' },
      ];
      DB.trustees = [{ id: 't1', u: 'דנה', active: true }];
      // the kiosk renders as that trustee
      _truSetMe('דנה');                       // the kiosk's own identity setter
      if (typeof _truEmpHome === 'function') _truEmpHome(true);
      _truRender();
      // _sign resolves asynchronously; give it a tick before reading the DOM
      return new Promise(function (res) {
        setTimeout(function () {
          const sel = '#pg-emp-home [data-sign],#pg-emp-home [src*="incidents-photos"],#pg-emp-home [href*="incidents-photos"]';
          const urls = [...document.querySelectorAll(sel)]
            .map((e) => e.getAttribute('data-sign') || e.getAttribute('src') || e.getAttribute('href'));
          res({ urls: urls.filter(Boolean), me: _truMe(), mine: (DB.trustee_reports || []).length });
        }, 300);
      });
    });
    const objects = r.urls.map((u) => (String(u).split('/incidents-photos/')[1] || '').split('?')[0]).filter(Boolean);
    check('the kiosk screen renders at least one stored photo', objects.length > 0, r.urls);
    check('and every one of them is under "' + KIOSK_PREFIX + '"', objects.every((n) => n.indexOf(KIOSK_PREFIX) === 0), objects);
  }

  console.log('\n4. the app never deletes from Storage, so the kiosk needs no DELETE');
  {
    const src = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
    // any fetch to a storage object path with method DELETE, in either order
    const del = (src.match(/\/storage\/v1\/object\/[\s\S]{0,300}?method\s*:\s*'DELETE'/g) || [])
      .concat(src.match(/method\s*:\s*'DELETE'[\s\S]{0,300}?\/storage\/v1\/object\//g) || []);
    check('no DELETE is ever issued against /storage/v1/object', del.length === 0, del.map((d) => d.slice(0, 80)));
    const clear = src.slice(src.indexOf('function _attachClear'), src.indexOf('function _attachClear') + 700);
    check('_attachClear drops the local reference only — it does not delete the file', !/DELETE/.test(clear));
  }

  console.log('\n5. the migration is written, says it has not been run, and matches this code');
  {
    const f = path.join(ROOT, 'migrations/2026-09-20_storage_trustee_scope.sql');
    check('the migration file exists', fs.existsSync(f));
    const sql = fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : '';
    check('it is marked NOT YET RUN, so nobody ticks it off by mistake', /NOT YET RUN/.test(sql));
    check('it scopes the kiosk to the same prefix this code uses', sql.indexOf("name LIKE '" + KIOSK_PREFIX + "%'") > 0, KIOSK_PREFIX);
    check('it keeps the kiosk able to UPLOAD — the one thing it must not lose', /FOR INSERT[\s\S]{0,400}tru-ph-%/.test(sql));
    check('...and able to SELECT its own photos, which is how a signed link is minted', /FOR SELECT[\s\S]{0,400}tru-ph-%/.test(sql));
    check('it gives the kiosk no DELETE at all', !/FOR DELETE[\s\S]{0,400}tru-ph-%/.test(sql));
    check('a token with no is_anonymous claim fails CLOSED', /is_anonymous'\)::boolean,\s*true\)\s*=\s*false/.test(sql));
    check('it also requires an email, the same test requireUser applies', /email',\s*''\)\s*<>\s*''/.test(sql));
    check('it drops the four bucket-wide policies it replaces', ['select', 'insert', 'update', 'delete']
      .every((c) => sql.indexOf('DROP POLICY IF EXISTS "incidents_photos_' + c + '_authenticated"') > 0));
    check('it carries a verification block to paste after running', /pg_policies/.test(sql));
  }

  await browser.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('HARNESS ERROR', e); process.exit(2); });
