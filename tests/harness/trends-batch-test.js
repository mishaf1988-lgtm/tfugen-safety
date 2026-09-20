// Three things the safety committee asks that the app could not answer.
//
// 6.7  The "leading indicators" accordion held four static numbers. «12
//      דיווחי נאמנים החודש» says nothing without knowing there were 30 two
//      months ago — which is exactly the difference between a leading
//      indicator and a lagging one. There was not one sparkline in the file:
//      two <svg> tags in 18,000 lines and zero polylines.
//
// 6.8  The only by-area breakdown was a snapshot with no time window at all.
//      Michael knew which area is worst now; he could not see which area is
//      getting worse. For the safety committee that is the difference between
//      "5 findings in the frying hall" and "the frying hall is climbing for a
//      third month".
//
// 6.9  Training was one flat table and one number for the whole plant. «איזו
//      מחלקה בפיגור בהדרכות» is the first question an ISO 45001 auditor asks
//      under §7.2. The join is tr.w ↔ emp.n and the department is emp.dep —
//      and t-w was a bare input with no datalist, so any typo silently became
//      an unmatched row and made the percentages wrong without saying so.
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
    window.sbIns = function () {}; window.sbUpd = function () {}; window.sdb = function () {}; window.addLog = function () {};
    window.__toasts = []; window.toast = function (m) { window.__toasts.push(String(m)); };
    window.__mon = function (back, day) {
      const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - back);
      return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(day || 10).padStart(2, '0');
    };
    window.__blank = function () {
      ['ncr', 'inc', 'near_miss', 'tasks', 'rounds', 'toolbox', 'trustee_reports', 'trustees',
       'ppe', 'tr', 'docs', 'ctr', 'equip_inspections', 'med', 'emp', 'locations',
       'inspection_types', 'trustee_tasks'].forEach((t) => { DB[t] = []; });
    };
  });

  console.log('\n6.7 a number with a direction');
  {
    const r = await page.evaluate(() => {
      __blank();
      // near-misses falling away: 8, 7, 6, 4, 3, 1 — the warning sign
      [8, 7, 6, 4, 3, 1].forEach((n, i) => {
        for (let k = 0; k < n; k++) DB.near_miss.push({ id: 'nm' + i + '_' + k, d: __mon(5 - i, 5), descr: 'x' });
      });
      // trustee reports climbing, carried only by `d` (no `m`) on purpose
      [1, 2, 4, 6, 9, 12].forEach((n, i) => {
        for (let k = 0; k < n; k++) DB.trustee_reports.push({ id: 't' + i + '_' + k, u: 'מוסא', t: 1, d: __mon(5 - i, 6), ok: true });
      });
      DB.rounds = [{ id: 'r1', d: __mon(0, 2) }];
      DB.toolbox = [{ id: 'b1', d: __mon(1, 2), topic: 'x' }];
      goPage('dash');
      const acc = g('dash-kpi-acc'), box = g('dash-kpi');
      return {
        open: acc && acc.style.display !== 'none',
        html: (box || {}).innerHTML || '',
        text: (box || {}).textContent || '',
        sparks: ((box || {}).innerHTML || '').match(/<polyline/g) || [],
      };
    });
    check('the accordion opens on this data', r.open, r.open);
    check('every leading tile carries a sparkline — there were none in the file', r.sparks.length >= 4, r.sparks.length);
    check('near-misses, trustee reports, rounds and toolbox talks are all there',
      /כמעט-נפגע החודש/.test(r.text) && /דיווחי נאמנים החודש/.test(r.text) && /סבבי בוקר החודש/.test(r.text) && /שיחות בטיחות החודש/.test(r.text), r.text.slice(0, 300));
    check('each says what the six-month average was', (r.text.match(/ממוצע 6 חודשים/g) || []).length >= 4, (r.text.match(/ממוצע 6 חודשים/g) || []).length);

    const dirs = await page.evaluate(() => {
      const box = g('dash-kpi');
      const tiles = [...box.querySelectorAll('div')].filter((d) => /ממוצע 6 חודשים/.test(d.textContent) && d.querySelector === undefined ? false : /ממוצע 6 חודשים/.test(d.textContent));
      const nm = [...box.children[0].children].find((el) => /כמעט-נפגע/.test(el.textContent));
      const tru = [...box.children[0].children].find((el) => /דיווחי נאמנים/.test(el.textContent));
      return { nm: nm ? nm.innerHTML : '', tru: tru ? tru.innerHTML : '' };
    });
    check('a fall in near-miss REPORTING is flagged red — it is not a success', /▼/.test(dirs.nm) && /#cc1f1f/.test(dirs.nm), dirs.nm.slice(0, 300));
    check('...and a rise in trustee reporting is green', /▲/.test(dirs.tru) && /#16a34a/.test(dirs.tru), dirs.tru.slice(0, 300));

    const trustee = await page.evaluate(() => {
      // a trustee report may carry only `m` — _truRowMonth handles both
      __blank();
      DB.trustee_reports = [
        { id: 'a', u: 'x', t: 1, m: __mon(0, 1).substring(0, 7), d: null, ok: true },
        { id: 'b', u: 'x', t: 1, d: __mon(1, 5), ok: true },
      ];
      goPage('dash');
      const box = g('dash-kpi');
      const tile = [...(box.children[0] || { children: [] }).children].find((el) => /דיווחי נאמנים/.test(el.textContent));
      return tile ? tile.textContent : '';
    });
    check('a trustee report with only `m` and one with only `d` are both counted', /^1/.test(trustee.trim()), trustee.slice(0, 60));

    const quiet = await page.evaluate(() => {
      __blank();
      goPage('dash');
      const acc = g('dash-kpi-acc');
      return !acc || acc.style.display === 'none';
    });
    check('with nothing at all the accordion stays shut, as it always did', quiet, quiet);
  }

  console.log('\n6.8 which area is getting worse');
  {
    const r = await page.evaluate(() => {
      __blank();
      DB.locations = [{ id: 'L1', name: 'אולם טיגון', level: 1 }];
      // the frying hall climbing, by FK
      [0, 0, 1, 2, 3, 5].forEach((n, i) => {
        for (let k = 0; k < n; k++) DB.ncr.push({ id: 'n' + i + '_' + k, s: 'פתוח', location_id: 'L1', sd: __mon(5 - i, 4) });
      });
      // the warehouse steady, by free-text loc only — the 375 imported rows
      [2, 2, 2, 2, 2, 2].forEach((n, i) => {
        for (let k = 0; k < n; k++) DB.ncr.push({ id: 'w' + i + '_' + k, s: 'פתוח', loc: 'מחסן', sd: __mon(5 - i, 4) });
      });
      // a trustee finding, whose loc is written "area · detail"
      DB.trustee_reports = [{ id: 'f1', u: 'x', t: 6, d: __mon(0, 7), ok: false, s: 'פתוח', loc: 'אולם טיגון · מסוע 3', f: 'y' }];
      goPage('dash');
      const hm = _areaHeat6();
      const card = g('dash-heat-card'), body = g('dash-heat');
      return {
        shown: card && card.style.display !== 'none',
        areas: hm.areas.map((a) => a.area),
        fry: hm.areas.filter((a) => a.area === 'אולם טיגון')[0],
        wh: hm.areas.filter((a) => a.area === 'מחסן')[0],
        html: (body || {}).innerHTML || '',
      };
    });
    check('the card appears', r.shown, r.shown);
    check('an area named through the FK is resolved to its name', r.areas.indexOf('אולם טיגון') >= 0, r.areas);
    check('...and an imported row with only free-text loc is NOT invisible', r.areas.indexOf('מחסן') >= 0, r.areas);
    check('the frying hall climbs 0,0,1,2,3,5 plus the trustee finding', r.fry && r.fry.months.join() === '0,0,1,2,3,6', r.fry && r.fry.months);
    check('...and is flagged as rising', r.fry && r.fry.rising === true, r.fry);
    check('a steady area is not flagged', r.wh && r.wh.rising === false && r.wh.months.join() === '2,2,2,2,2,2', r.wh);
    check('«area · detail» on a trustee finding counts as the area', r.fry && r.fry.months[5] === 6, r.fry && r.fry.months);
    check('the strip says what it is counting', /אי-התאמות, תקריות, כמעט-נפגע/.test(r.html), r.html.slice(-300));
    check('...and the rising row is marked on screen', /עולה/.test(r.html), r.html.slice(-400));

    const capped = await page.evaluate(() => {
      __blank();
      for (let a = 0; a < 12; a++) DB.ncr.push({ id: 'x' + a, s: 'פתוח', loc: 'אזור ' + a, sd: __mon(1, 4) });
      return _areaHeat6().areas.length;
    });
    check('a plant with a dozen areas shows the busiest eight, not all of them', capped === 8, capped);

    const none = await page.evaluate(() => {
      __blank();
      goPage('dash');
      const card = g('dash-heat-card');
      return !card || card.style.display === 'none';
    });
    check('with no findings anywhere the card stays hidden', none, none);
  }

  console.log('\n6.9 which department is behind on training');
  {
    const r = await page.evaluate(() => {
      __blank();
      const today = new Date().toISOString().split('T')[0];
      const future = new Date(Date.now() + 200 * 864e5).toISOString().split('T')[0];
      const past = new Date(Date.now() - 200 * 864e5).toISOString().split('T')[0];
      DB.emp = [
        { id: 'e1', n: 'מוסא עלי', dep: 'ייצור' },
        { id: 'e2', n: 'דנה לוי', dep: 'ייצור' },
        { id: 'e3', n: 'רון כהן', dep: 'מחסן' },
        { id: 'e4', n: 'יוסי', dep: '' },
      ];
      DB.tr = [
        { id: 't1', w: 'מוסא עלי', n: 'עבודה בגובה', e: future },
        { id: 't2', w: 'מוסא עלי', n: 'חשמל', e: past },
        { id: 't3', w: 'דנה לוי', n: 'מלגזה', e: past },
        { id: 't4', w: 'רון כהן', n: 'כיבוי אש', e: future },
        { id: 't5', w: 'יוסי', n: 'עזרה ראשונה', e: future },
        { id: 't6', w: 'מישהו שלא במרשם', n: 'x', e: future },
        { id: 't7', w: 'דנה לוי', n: 'ללא תוקף', e: null },
      ];
      goPage('tr');
      const rows = _trByDept();
      const card = g('tr-dept-card'), body = g('tr-dept');
      return {
        shown: card && card.style.display !== 'none',
        rows: rows.map((x) => x.dep + ':' + x.pct + ':' + x.valid + '/' + x.total),
        html: (body || {}).innerHTML || '',
        prod: rows.filter((x) => x.dep === 'ייצור')[0],
        unmatched: rows.filter((x) => x.unmatched)[0],
      };
    });
    check('the card appears on the training page', r.shown, r.shown);
    // 4 rows: one valid, two expired, one with no expiry date at all. The
    // undated one stays in the denominator on purpose — a training with no
    // expiry is not evidence of validity, and excluding it would flatter the
    // number in exactly the place an auditor is looking.
    check('production is 1 valid of 4 — 25%', r.prod && r.prod.pct === 25 && r.prod.total === 4, r.prod);
    check('...and it is FIRST, because worst-first is the row an auditor wants', /^ייצור/.test(r.rows[0] || ''), r.rows);
    check('an employee with no department gets its own row, not thrown away', r.rows.some((x) => /ללא מחלקה/.test(x)), r.rows);
    check('a training whose name matches no employee is shown as «לא משויך»', r.unmatched && r.unmatched.dep === 'לא משויך', r.unmatched);
    check('...and sorted last, so it does not look like the worst department', /לא משויך/.test(r.rows[r.rows.length - 1] || ''), r.rows);
    check('expired and undated trainings are counted separately', r.prod && r.prod.expired === 2 && r.prod.undated === 1, r.prod);
    check('the card explains what «לא משויך» means and what to do', /אינו במרשם העובדים/.test(r.html), r.html.slice(-300));

    const dl = await page.evaluate(() => {
      __blank();
      DB.emp = [{ id: 'e1', n: 'מוסא עלי', dep: 'ייצור' }, { id: 'e2', n: 'דנה לוי', dep: 'מחסן' }];
      openModal('m-tr');
      const input = g('t-w'), list = g('emp-names-list');
      return {
        linked: input && input.getAttribute('list'),
        options: list ? [...list.options].map((o) => o.value) : [],
      };
    });
    check('the «שם עובד» field is wired to a list of real employees', dl.linked === 'emp-names-list', dl.linked);
    check('...populated from DB.emp, so the join stops failing on typos', dl.options.sort().join() === 'דנה לוי,מוסא עלי', dl.options);

    const empty = await page.evaluate(() => {
      __blank();
      goPage('tr');
      const card = g('tr-dept-card');
      return !card || card.style.display === 'none';
    });
    check('with no trainings at all the card stays hidden', empty, empty);
  }

  await browser.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('HARNESS ERROR', e); process.exit(2); });
