// An ISO 45001 / 14001 auditor works clause by clause: "show me the evidence,
// and show me where it is thin". Every one of those answers already lived in
// this database, spread over nineteen pages, and pulling them together was a
// morning's work with a notebook. This is that morning, on one sheet.
//
// The report is only worth printing if it is HONEST, so this suite spends most
// of its checks on the two ways it could lie: calling a clause covered when it
// is not, and calling one uncovered when it is. A clause goes green only with
// records AND activity in the last twelve months — an auditor discounts a
// register that stopped being kept, and so does this.
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
    window.sdb = function () {}; window.addLog = function () {};
    window.__toasts = []; window.toast = function (m) { window.__toasts.push(String(m)); };
    // a factory with nothing recorded at all
    window.__wipe = function () {
      ['ncr', 'inc', 'near_miss', 'rsk', 'leg', 'tr', 'toolbox', 'ptw', 'ppe', 'equip_inspections',
        'drl', 'ins', 'rounds', 'med', 'hearing_tests', 'auds', 'env_aspects', 'wst', 'hzm',
        'trustees', 'trustee_reports'].forEach((t) => { DB[t] = []; });
    };
    window.__iso = (d) => new Date(Date.now() + d * 864e5).toISOString().split('T')[0];
    window.__by = (cl, std) => _isoClauses().filter((c) => c.cl === cl && (!std || c.std.indexOf(std) >= 0))[0];
  });

  console.log('\n1. an empty system is red everywhere, and says why');
  {
    const r = await page.evaluate(() => {
      __wipe();
      const C = _isoClauses();
      return {
        total: C.length,
        bad: C.filter((c) => c.st === 'bad').length,
        ok: C.filter((c) => c.st === 'ok').length,
        noGapText: C.filter((c) => c.st !== 'ok' && !c.gap).map((c) => c.cl),
        clauses: C.map((c) => c.cl),
      };
    });
    check('the report covers the clauses an auditor walks (' + r.total + ')', r.total >= 12, r.total);
    check('nothing is green when nothing is recorded', r.ok === 0, r.ok);
    check('every non-green clause names what is missing — none is a bare ❌', r.noGapText.length === 0, r.noGapText);
    check('10.2 (corrective action) is on the sheet', r.clauses.indexOf('10.2') >= 0, r.clauses);
    check('9.2 (internal audit) is on the sheet', r.clauses.indexOf('9.2') >= 0, r.clauses);
    check('both 6.1.2 clauses are there — hazards for 45001, aspects for 14001', r.clauses.filter((c) => c === '6.1.2').length === 2, r.clauses);
  }

  console.log('\n2. a register that stopped being kept is NOT evidence');
  {
    const r = await page.evaluate(() => {
      __wipe();
      DB.auds = [{ id: 'a1', n: 'ביקורת', d: __iso(-400) }];       // over a year old
      DB.drl = [{ id: 'd1', ty: 'פינוי', d: __iso(-400) }];
      const stale = { aud: __by('9.2').st, drl: __by('8.2').st, audGap: __by('9.2').gap };
      DB.auds.push({ id: 'a2', n: 'ביקורת', d: __iso(-30) });      // one this year
      DB.drl.push({ id: 'd2', ty: 'פינוי', d: __iso(-30) });
      return { stale: stale, fresh: { aud: __by('9.2').st, drl: __by('8.2').st } };
    });
    check('an audit register whose last entry is 400 days old is amber, not green', r.stale.aud === 'warn', r.stale);
    check('...and it says so in words', /בשנה האחרונה/.test(r.stale.audGap), r.stale.audGap);
    check('a drill register 400 days stale is amber too', r.stale.drl === 'warn', r.stale);
    check('one audit this year turns it green', r.fresh.aud === 'ok', r.fresh);
    check('one drill this year turns that green', r.fresh.drl === 'ok', r.fresh);
  }

  console.log('\n3. an undated row never counts as recent');
  {
    const r = await page.evaluate(() => {
      __wipe();
      DB.toolbox = [{ id: 't1', topic: 'שיחה' }];                  // no date at all
      const undated = { st: __by('7.4').st, gap: __by('7.4').gap };
      DB.toolbox.push({ id: 't2', topic: 'שיחה', d: __iso(-10) });
      return { undated: undated, dated: __by('7.4').st };
    });
    check('a toolbox talk with no date leaves the clause amber', r.undated.st === 'warn', r.undated);
    check('a dated one this month turns it green', r.dated === 'ok', r.dated);
  }

  console.log('\n4. the statutory equipment clause counts the two ways it fails');
  {
    const r = await page.evaluate(() => {
      __wipe();
      DB.equip_inspections = [
        { id: 'e1', n: 'מלגזה', e: __iso(-10) },   // lapsed
        { id: 'e2', n: 'מנוף', e: __iso(-40) },    // lapsed
        { id: 'e3', n: 'מטף', e: null },           // never given an expiry
        { id: 'e4', n: 'סולם', e: __iso(200) },    // fine
      ];
      const bad = __by('8.1', '45001');
      DB.equip_inspections = [{ id: 'e4', n: 'סולם', e: __iso(200) }];
      return { gap: bad.gap, st: bad.st, ev: bad.ev, clean: __by('8.1', '45001').st };
    });
    check('two lapsed inspections are counted as two', /2 /.test(r.gap), r.gap);
    check('an inspection with no expiry date is called out separately', /בלי תאריך תוקף/.test(r.gap), r.gap);
    check('the wording names the legal exposure, not just a number', /פקודת הבטיחות/.test(r.gap), r.gap);
    check('with everything in date the clause is green', r.clean === 'ok', r.clean);
  }

  console.log('\n5. clause 10.2 is wired to the verification queue');
  {
    const r = await page.evaluate(() => {
      __wipe();
      DB.ncr = [
        { id: 'n1', num: 'NCR-1', s: 'סגור', cd: __iso(-90) },                       // due for verification
        { id: 'n2', num: 'NCR-2', s: 'סגור', cd: __iso(-200) },                      // due
        { id: 'n3', num: 'NCR-3', s: 'סגור', cd: __iso(-90), verified_by: 'admin' }, // done
        { id: 'n4', num: 'NCR-4', s: 'פתוח' },
      ];
      const due = __by('10.2');
      const queue = _capaDue().length;        // read BEFORE verifying them
      DB.ncr.forEach((n) => { if (n.s === 'סגור') n.verified_by = 'admin'; });
      return { st: due.st, gap: due.gap, ev: due.ev, queue: queue, after: __by('10.2').st };
    });
    check('two unverified corrective actions make the clause amber', r.st === 'warn', r);
    check('the gap says exactly how many nobody checked', /^2 /.test(r.gap), r.gap);
    check('...and the number matches the queue on the NCR page', r.queue === 2, r.queue);
    check('the evidence line reports open NCRs and verified ones separately', /1 פתוחות/.test(r.ev) && /1 אומתו/.test(r.ev), r.ev);
    check('verifying them all turns the clause green', r.after === 'ok', r.after);
  }

  console.log('\n6. clause 5.4 uses the trustee programme, through its own helpers');
  {
    const r = await page.evaluate(() => {
      __wipe();
      const none = __by('5.4').st;
      DB.trustees = [{ id: 't1', u: 'דני', active: true }];
      const noTour = { st: __by('5.4').st, gap: __by('5.4').gap };
      // a report saved WITHOUT the m column — _truRowMonth falls back to its date
      DB.trustee_reports = [{ id: 'r1', u: 'דני', t: 1, d: new Date().toISOString().substring(0, 10), ok: true }];
      return { none: none, noTour: noTour, withTour: __by('5.4').st, ev: __by('5.4').ev };
    });
    check('no trustees appointed is red', r.none === 'bad', r.none);
    check('trustees but no tour this month is amber', r.noTour.st === 'warn', r.noTour);
    check('a tour filed this month turns it green', r.withTour === 'ok', r.withTour);
    check('...even though that row has no m column, because _truRowMonth fills it in', /1 החודש/.test(r.ev), r.ev);
  }

  console.log('\n7. the sheet itself');
  {
    const r = await page.evaluate(() => {
      __wipe();
      DB.rsk = [{ id: 'r1', d: 'סיכון' }];
      DB.equip_inspections = [{ id: 'e1', e: __iso(-10) }];
      let written = '';
      const realOpen = window.open;
      window.open = function () { return { document: { write: function (h) { written = h; }, close: function () {} } }; };
      isoAuditReport();
      window.open = realOpen;
      return {
        len: written.length,
        rtl: /dir="rtl"/.test(written),
        title: /ISO 45001/.test(written) && /ISO 14001/.test(written),
        rows: (written.match(/<tr class="(ok|warn|bad)">/g) || []).length,
        hasPrint: /window\.print\(\)/.test(written),
        signature: /הוכן על ידי/.test(written),
        caveat: /אינו תחליף לביקורת/.test(written),
        stamped: /הופק ב:/.test(written),
        greenClaim: /2 בדיקות/.test(written),
      };
    });
    check('a full HTML document is produced', r.len > 3000, r.len);
    check('it is right-to-left and names both standards', r.rtl && r.title, r);
    check('one row per clause, each carrying its own status class', r.rows >= 12, r.rows);
    check('it carries a print button', r.hasPrint);
    check('it is stamped with when it was produced', r.stamped);
    check('it has a signature line — an auditor is handed a signed sheet', r.signature);
    check('and it states plainly that it is not a substitute for an audit', r.caveat);

    const blocked = await page.evaluate(() => {
      window.__toasts = [];
      const realOpen = window.open;
      window.open = function () { return null; };       // popup blocker
      isoAuditReport();
      window.open = realOpen;
      return window.__toasts;
    });
    check('a blocked popup is explained, not a silent no-op', blocked.some((t) => /קופצים/.test(t)), blocked);
  }

  console.log('\n8. it is reachable, and only by someone who should see it');
  {
    const r = await page.evaluate(() => {
      function entries() {
        document.querySelectorAll('[id^=tfgn-menu],.tfgn-menu').forEach((n) => n.remove());
        const btn = document.createElement('button');
        document.body.appendChild(btn);
        _openMainMenu ? _openMainMenu(btn) : (window.openMoreMenu && openMoreMenu(btn));
        const txt = document.body.textContent;
        return txt;
      }
      const fns = typeof window.isoAuditReport;
      // role gate: the menu builder asks _role()
      window._currentUser = { username: 'noa', role: 'מדווח' }; _isAdmin = false;
      const reporter = _role();
      window._currentUser = { username: 'admin' }; _isAdmin = true;
      return { fn: fns, reporterRole: reporter, adminRole: _role() };
    });
    check('isoAuditReport is a real global, callable from the menu', r.fn === 'function', r.fn);
    check('a reporter is not a manager, so the entry is gated away from them', r.reporterRole === 'reporter' && r.adminRole === 'admin', r);
    const inMenu = await page.evaluate(() => {
      const src = [...document.querySelectorAll('script')].map((s) => s.textContent).join('');
      const i = src.indexOf('isoAuditReport();');
      return { wired: i > 0, gated: /_role\(\)!=='reporter'\)item\([^)]*isoAuditReport/.test(src.replace(/\s+/g, ' ')) || src.slice(Math.max(0, i - 200), i).indexOf("_role()!=='reporter'") >= 0 };
    });
    check('the menu item calls it', inMenu.wired, inMenu);
    check('...behind a manager-or-above check', inMenu.gated, inMenu);
  }

  await browser.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('HARNESS ERROR', e); process.exit(2); });
