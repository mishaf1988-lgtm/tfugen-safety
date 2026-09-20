// Two ways a compliance register quietly lost the evidence it exists to hold.
//
// 3.1  svTr and svToolbox write `file_url: _attachUrls[area] || null` on EVERY
//      save, and _genEdit never restored _attachUrls when it opened the form.
//      So opening ✎ on a training record to update its expiry after a refresher
//      — the single most ordinary edit in the module — silently deleted the
//      attached certificate. No warning, no trace. That certificate is the
//      evidence an auditor asks for under §7.2.
//
// 3.2  _hearingBackupCsv wrote columns named n/emp, d, res/result, e. A hearing
//      record has emp_name, emp_id, test_date, inspector, role, dept, category,
//      dob, age, gender, year, notes. None of the written names exist, so the
//      file came out with an id and five empty columns — and that is the CSV
//      delAllHearing exports right BEFORE wiping the entire register.
const path = require('path');
let pw; try { pw = require('playwright'); } catch (e) { pw = require('playwright-core'); }
const HTML = 'file://' + path.resolve(__dirname, '../../index.html');
let pass = 0, fail = 0;
const check = (l, c, d) => { if (c) { pass++; console.log('  ✓ ' + l); } else { fail++; console.log('  ✗ ' + l + (d !== undefined ? '  -> ' + JSON.stringify(d) : '')); } };

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
    window._currentUser = { username: 'admin' }; _isAdmin = true; _applyRoleGates();
    window.__upd = []; window.__ins = [];
    window.sbIns = function (t, r) { window.__ins.push(r); };
    window.sbUpd = function (t, r) { window.__upd.push(r); };
    window.sdb = function () {}; window.addLog = function () {};
    window.__toasts = []; window.toast = function (m) { window.__toasts.push(String(m)); };
    // signing answers, so _attachRender's preview resolves like it does live
    window._sbAuth = function () { return Promise.resolve(); }; window._sbToken = 'tok';
    window.fetch = function (u) {
      const m = String(u).match(/\/storage\/v1\/object\/sign\/([^/]+)\/(.+)$/);
      const body = m ? { signedURL: '/object/sign/' + m[1] + '/' + m[2] + '?token=S' } : {};
      return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body), text: () => Promise.resolve(JSON.stringify(body)) });
    };
    window.__csv = null;
    const realCreate = URL.createObjectURL.bind(URL);
    URL.createObjectURL = function (b) { window.__blob = b; return realCreate(b); };
    HTMLAnchorElement.prototype.click = function () { window.__clicked = this.download; };
    window.__iso = (d) => new Date(Date.now() + d * 864e5).toISOString().split('T')[0];
  });

  const CERT = 'https://znhjtpcltrxxyfjczgvw.supabase.co/storage/v1/object/public/incidents-photos/tr-1758-cert.pdf';

  console.log('\n3.1 editing a training record keeps its certificate');
  {
    const r = await page.evaluate((cert) => {
      DB.tr = [{ id: 't1', w: 'מוסא', n: 'עבודה בגובה', c: 'בטיחות', d: '2026-03-01', e: '2027-03-01', s: 'בתוקף', file_url: cert }];
      window.__upd = [];
      _genEdit('tr', 't1');
      const restored = _attachUrls['tr-attach-area'];
      // read the form BEFORE saving — svTr closes and resets it
      const areaHtml = (g('tr-attach-area') || {}).innerHTML || '';
      g('t-e').value = '2028-03-01';            // the ordinary edit: renew the expiry
      svTr();
      return { restored: restored, areaHtml: areaHtml, file_url: DB.tr[0].file_url, e: DB.tr[0].e, upd: window.__upd.length };
    }, CERT);
    check('opening ✎ restores the attachment into _attachUrls', r.restored === CERT, r.restored);
    check('renewing the expiry keeps the certificate', r.file_url === CERT, r);
    check('...and the new expiry really was saved', r.e === '2028-03-01', r.e);
    check('it was an update, not a second row', r.upd === 1, r.upd);

    check('the open form shows the existing file, with a way to remove it', /_attachClear/.test(r.areaHtml), r.areaHtml.slice(0, 200));

    const removed = await page.evaluate((cert) => {
      DB.tr = [{ id: 't2', w: 'דנה', n: 'חשמל', c: 'בטיחות', d: '2026-01-01', e: '2027-01-01', file_url: cert }];
      _genEdit('tr', 't2');
      _attachClear('tr-attach-area');           // the user removes it ON PURPOSE
      svTr();
      return DB.tr[0].file_url;
    }, CERT);
    check('removing it on purpose still works — the fix does not make it sticky', removed === null, removed);

    const none = await page.evaluate(() => {
      DB.tr = [{ id: 't3', w: 'רון', n: 'מלגזה', c: 'בטיחות', d: '2026-01-01', e: '2027-01-01', file_url: null }];
      _attachUrls['tr-attach-area'] = 'LEFTOVER-FROM-A-PREVIOUS-RECORD';
      _genEdit('tr', 't3');
      const after = _attachUrls['tr-attach-area'];
      svTr();
      return { after: after, saved: DB.tr[0].file_url };
    });
    check('a record with no file clears the area — it does not inherit the last one', none.after === null && none.saved === null, none);

    const tb = await page.evaluate((cert) => {
      DB.toolbox = [{ id: 'b1', d: '2026-05-01', topic: 'עבודה בגובה', pres: 'דני', file_url: cert }];
      _genEdit('toolbox', 'b1');
      const restored = _attachUrls['tb-attach-area'];
      svToolbox();
      return { restored: restored, file_url: DB.toolbox[0].file_url };
    }, CERT);
    check('the toolbox-talk form has the same protection', tb.restored === CERT && tb.file_url === CERT, tb);
  }

  console.log('\n3.2 the hearing backup actually contains the hearing records');
  {
    const r = await page.evaluate(() => {
      DB.hearing_tests = [
        { id: 'h1', emp_name: 'מוסא עלי', emp_id: '301234567', test_date: '2026-04-12', inspector: 'ד״ר כהן', role: 'מפעיל מכונה', dept: 'ייצור', category: 'רעש', dob: '1988-02-03', age: 38, gender: 'ז', year: '2026', notes: 'ירידה קלה בתדר גבוה' },
        { id: 'h2', emp_name: 'דנה לוי', emp_id: '302345678', test_date: '2026-04-13', inspector: 'ד״ר כהן', role: 'אחסנה', dept: 'מחסן', category: 'רעש', dob: '1995-07-19', age: 31, gender: 'נ', year: '2026', notes: '' },
      ];
      window.__blob = null;
      _hearingBackupCsv(DB.hearing_tests);
      return window.__blob.text();
    });
    const lines = r.trim().split('\n');
    check('the file has a header and one line per record', lines.length === 3, lines.length);
    check('the employee name is in it', /מוסא עלי/.test(r), lines[1] && lines[1].slice(0, 120));
    check('the ID number is in it', /301234567/.test(r));
    check('the test date is in it', /2026-04-12/.test(r));
    check('the inspector is in it', /כהן/.test(r));
    check('the department is in it', /ייצור/.test(r));
    check('the notes are in it', /ירידה קלה/.test(r));
    const cols = (lines[1] || '').split('","').length;
    check('no row is mostly empty columns — the old file had five', cols >= 10 && (lines[1].match(/""/g) || []).length <= 2, { cols: cols, row: lines[1] });
    check('the header is in Hebrew, for whoever opens the file', /שם העובד/.test(lines[0]) && /תאריך בדיקה/.test(lines[0]), lines[0]);
  }

  console.log('\n3.2b the wipe still exports before it deletes');
  {
    const r = await page.evaluate(() => {
      DB.hearing_tests = [{ id: 'h9', emp_name: 'רון', emp_id: '1', test_date: '2026-01-01', dept: 'ייצור' }];
      window.__blob = null; window.__clicked = null;
      window.__toasts = [];
      // delAllHearing asks for a password; the dialog handler accepts, so it
      // proceeds far enough to export. What matters here is that the export ran.
      try { delAllHearing(); } catch (e) { /* password path may bail; the export is what we check */ }
      return new Promise(function (res) {
        setTimeout(function () {
          if (!window.__blob) { res({ exported: false }); return; }
          window.__blob.text().then(function (t) { res({ exported: true, hasName: /רון/.test(t) }); });
        }, 200);
      });
    });
    check('the export runs as part of the wipe flow', r.exported, r);
    if (r.exported) check('...and what it exports is the real record, not blanks', r.hasName, r);
  }

  await browser.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('HARNESS ERROR', e); process.exit(2); });
