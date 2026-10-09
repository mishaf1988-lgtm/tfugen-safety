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
      DB.trustees = [{ id: 't1', n: 'דני', active: true }];
      const noTour = { st: __by('5.4').st, gap: __by('5.4').gap };
      // a report saved WITHOUT the m column — _truRowMonth falls back to its date
      DB.trustee_reports = [{ id: 'r1', u: 'דני', t: 1, d: new Date().toISOString().substring(0, 10), ok: true }];
      const withTour = __by('5.4').st, ev = __by('5.4').ev;
      // upgrade review 26: participation is out of the active trustees
      const today = new Date().toISOString().substring(0, 10);
      DB.trustees = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ז', 'ח'].map((n, i) => ({ id: 't' + i, n: n, active: true })).concat([{ id: 'tx', n: 'ט', active: false }]);
      DB.trustee_reports = [{ id: 'q1', u: 'א', t: 1, d: today }, { id: 'q2', u: 'א', t: 2, d: today }, { id: 'q3', u: 'ב', t: 1, d: today }, { id: 'q4', u: 'ג', t: 1, d: today }, { id: 'q6', u: 'שימי', t: 8, d: today, ok: true }, { id: 'q7', u: 'ט', t: 1, d: today }];
      const three = { st: __by('5.4').st, ev: __by('5.4').ev, gap: __by('5.4').gap };
      DB.trustee_reports.push({ id: 'q5', u: 'ד', t: 1, d: today });
      const four = __by('5.4').st;
      return { none: none, noTour: noTour, withTour: withTour, ev: ev, three: three, four: four };
    });
    check('no trustees appointed is red', r.none === 'bad', r.none);
    check('trustees but no tour this month is red (none of them reported)', r.noTour.st === 'bad' && /אין דיווחי/.test(r.noTour.gap), r.noTour);
    check('3 of 8 active trustees (one twice; a manager closing from the mail link and an inactive trustee not counted) is amber', r.three.st === 'warn' && /3 מתוך 8 דיווחו החודש/.test(r.three.ev) && /פחות ממחצית/.test(r.three.gap), r.three);
    check('4 of 8 (half) is green', r.four === 'ok', r.four);
    check('a tour filed this month turns it green', r.withTour === 'ok', r.withTour);
    check('...even though that row has no m column, because _truRowMonth fills it in', /1 מתוך 1 דיווחו החודש/.test(r.ev), r.ev);
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
        rows: (written.match(/<tr class="(ok|warn|bad|na)">/g) || []).length,
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

  console.log('\n9. upgrade review 14: the sheet reads where the work is done now');
  {
    const r = await page.evaluate(() => {
      __wipe(); DB.tour_hazards = []; DB.mgmt_reviews = []; DB.docs = [];
      const empty = { c91: __by('9.1').st, c102: __by('10.2').st, c82: __by('8.2').st, c92: __by('9.2').st,
        c62: __by('6.2').st, c93: __by('9.3').st, c75: __by('7.5').st, c912: __by('9.1.2').st, gap82: __by('8.2').gap };
      DB.tour_hazards = [
        { id: 'h1', d: __iso(-20), dept: 'A', tour_no: 3, s: 'פתוח', due: __iso(-5) },   // late
        { id: 'h2', d: __iso(-20), dept: 'A', tour_no: 3, s: 'סגור', closed_d: __iso(-2) },
        { id: 'h3', d: __iso(-60), dept: 'B', tour_no: 1, s: 'פתוח', due: __iso(10) },
      ];
      DB.inc = [
        { id: 'i1', dt: __iso(-30), ty: 'x' },
        { id: 'i2', dt: __iso(-40), ty: 'x', rc: 'סיבה' },
        { id: 'i3', dt: __iso(-500), ty: 'x' },        // older than a year: not asked about
      ];
      const ev = _opsEvidence();
      const c91 = __by('9.1'), c102 = __by('10.2');
      DB.tour_hazards[0].s = 'סגור'; DB.inc[0].five_why = 'למה 1';
      const clean = __by('10.2');
      return { empty, ev, c91, c102, clean };
    });
    check('with nothing recorded, 9.1 and 10.2 are still red', r.empty.c91 === 'bad' && r.empty.c102 === 'bad', r.empty);
    check('drills and internal audits the app does not keep are grey, not red', r.empty.c82 === 'na' && r.empty.c92 === 'na', r.empty);
    check('...and the grey row says where the evidence is', /מהתיקייה/.test(r.empty.gap82), r.empty.gap82);
    check('new rows 6.2, 7.5 and 9.1.2 are on the sheet, grey while empty', r.empty.c62 === 'na' && r.empty.c75 === 'na' && r.empty.c912 === 'na', r.empty);
    check('9.3 is red until a management review is saved', r.empty.c93 === 'bad', r.empty);
    check('two department tours are counted from the hazards (dept + tour number)', r.ev.tours === 2, r.ev);
    check('the late hazard is counted once', r.ev.hzLate === 1 && r.ev.hzOpen === 2, r.ev);
    check('incidents: 2 in the last year, 1 investigated', r.ev.inc === 2 && r.ev.incInv === 1, r.ev);
    check('tour hazards alone turn 9.1 green', r.c91.st === 'ok' && /2 סיורי מחלקות/.test(r.c91.ev), r.c91);
    check('10.2 is amber, naming the late hazard and the uninvestigated incident', r.c102.st === 'warn' && /1 מפגעי סיור עברו/.test(r.c102.gap) && /1 מ-2 תאונות/.test(r.c102.gap), r.c102);
    check('closing it and investigating the incident turns 10.2 green', r.clean.st === 'ok', r.clean);
  }

  console.log('\n10. 7.2 counts the weekly refreshers, and notices when they stop');
  {
    const r = await page.evaluate(() => {
      __wipe();
      const none = __by('7.2').st;
      DB.toolbox = [{ id: 't1', d: __iso(-3), topic: 'ריענון' }];
      const fresh = __by('7.2');
      DB.toolbox = [{ id: 't1', d: __iso(-24), topic: 'ריענון' }];
      const stale = __by('7.2');
      return { none, fresh, stale };
    });
    check('no training and no refreshers is red', r.none === 'bad', r.none);
    check('a refresher this week is green', r.fresh.st === 'ok' && /1 ריענונים/.test(r.fresh.ev), r.fresh);
    check('none for 24 days is amber, with the date and a pointer to the import', r.stale.st === 'warn' && /Vitre/.test(r.stale.gap) && /\d\d\/\d\d\/\d{4}/.test(r.stale.gap), r.stale);
  }

  console.log('\n11. the sheet is keyboard-only, and the others read the same counts');
  {
    const r = await page.evaluate(() => {
      __wipe();
      let written = '';
      const realOpen = window.open;
      window.open = function () { return { document: { write: function (h) { written = h; }, close: function () {} } }; };
      isoAuditReport();
      window.open = realOpen;
      const text = written.replace(/<style[\s\S]*?<\/style>/, '').replace(/<[^>]+>/g, ' ');
      const src = [...document.querySelectorAll('script')].map((s) => s.textContent).join('');
      DB.tour_hazards = [{ id: 'h1', d: new Date().toISOString().substring(0, 10), dept: 'A', tour_no: 1, s: 'פתוח' }];
      let mr = null;
      try { rMr(); mr = g('mr-hz-q') && g('mr-hz-q').textContent; } catch (e) { mr = 'ERR ' + e.message; }
      return {
        dash: /[—·]/.test(text), grey: /מחוץ לאפליקציה/.test(written), naRow: /<tr class="na">/.test(written),
        exp: /'tour_hazards'/.test(src.slice(src.indexOf('var tableOrder=['), src.indexOf('var tableOrder=[') + 600)),
        mr: mr, ann: /tour_hazards:\(function\(\)\{var o=_opsEvidence\(inLastYear\)/.test(src),
      };
    });
    check('no long dash or middle dot anywhere in the printed text', !r.dash, r);
    check('grey rows and a grey pill are printed', r.grey && r.naRow, r);
    check('the Excel export includes the tour hazards', r.exp, r);
    check('the management review shows the tour hazards of the quarter', r.mr === '1', r.mr);
    check('the annual report is handed the tour-hazard numbers', r.ann, r);
  }

  console.log('\n12. task 9 (electrical) is a finding in the app too');
  {
    const r = await page.evaluate(() => {
      __wipe(); DB.trustee_tasks = [];
      DB.trustee_reports = [
        { id: 'e9', u: 'דני', t: 9, d: __iso(-2), ok: false, s: 'פתוח', f: 'לוח פתוח' },
        { id: 'c8', u: 'דני', t: 8, d: __iso(-1), ok: true, ref: 'x', f: 'אחרי' },
      ];
      return { f: _mfTruFindings().map((x) => x.id), task: !!_truTask(9), hz: _truIsHazard(DB.trustee_reports[0]), open: _opsEvidence().truOpen, max: _truMaxTaskPts() };
    });
    check('a task-9 report is in the findings list, the closing photo is not', r.f.join() === 'e9', r.f);
    check('task 9 is in the catalogue and counts as a hazard', r.task && r.hz, r);
    check('the ISO sheet counts it as an open trustee finding', r.open === 1, r.open);
    check('nine tasks, 90 task points', r.max === 90, r.max);
  }

  console.log('\nBACKLOG 12.2: the clauses an auditor asks about are on the sheet, grey when not measured');
  {
    const r = await page.evaluate(() => {
      const keep = { docs: DB.docs, ctr: DB.ctr, mgmt_reviews: DB.mgmt_reviews };
      DB.docs = []; DB.ctr = []; DB.mgmt_reviews = [];
      const empty = ['4.1/4.2', '8.1.3', '8.1.4', '10.3'].map((cl) => { const c = __by(cl); return c ? c.st + '|' + c.gap : null; });
      DB.docs = [{ id: 'k', n: 'ניתוח בעלי עניין 2026', c: 'הקשר ובעלי עניין', e: null }];
      DB.ctr = [{ id: 'c1', n: 'קבלן א', e: new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10) }, { id: 'c2', n: 'קבלן ב', e: '2025-01-01' }];
      const ctx = __by('4.1/4.2'), con = __by('8.1.4');
      Object.assign(DB, keep);
      return { empty, ctx: ctx.st, con: con.st + '|' + con.ev + '|' + con.gap, moc: __by('8.1.3').st };
    });
    check('with nothing recorded, all four are grey and say where the evidence is', r.empty.every((x) => x && x.indexOf('na|לא באפליקציה') === 0), r.empty);
    check('a context document in the register: 4.1/4.2 green', r.ctx === 'ok', r.ctx);
    check('contractors: counted with expiry; an expired agreement is amber and named', /^warn\|2 קבלנים במרשם, 1 בתוקף, 1 פגו\|1 הסכמי קבלן פגו$/.test(r.con), r.con);
    check('change management (no register yet): grey', r.moc === 'na', r.moc);
  }

  console.log('\nBACKLOG 12.10: policy (5.2) and roles (5.3), grey with the folder documents until in the register');
  {
    const r = await page.evaluate(() => {
      const keep = DB.docs;
      DB.docs = [];
      const e = ['5.2', '5.3'].map((cl) => { const c = __by(cl); return c ? c.st + '|' + c.gap + '|' + c.proc : null; });
      DB.docs = [{ id: 'p', n: 'מדיניות בטיחות - עדכנית', c: 'מדיניות', e: null }, { id: 'r', n: 'הגדרת תפקיד - מנהל משמרת', c: 'נהלים', e: null }];
      const f = ['5.2', '5.3'].map((cl) => __by(cl).st + '|' + __by(cl).ev);
      DB.docs = [{ id: 'x', n: 'נוהל עבודה בגובה', c: 'נהלים', e: null }];
      const o = ['5.2', '5.3'].map((cl) => __by(cl).st);
      DB.docs = keep;
      return { e, f, o };
    });
    check('nothing in the register: both grey, naming the folder documents', /^na\|לא באפליקציה: "מדיניות בטיחות - עדכנית" \(22\/04\/2025\)/.test(r.e[0] || '') && /^na\|לא באפליקציה: הגדרות תפקיד \(ממונה בטיחות/.test(r.e[1] || ''), r.e);
    check('the procedures from the clause table', /\|נוהל 1 \(מדריך המערכת המשולבת\)$/.test(r.e[0] || '') && /\|מסמכי הגדרות תפקיד$/.test(r.e[1] || ''), r.e);
    check('a policy document and a role definition in the register: both green, counted', r.f.join() === 'ok|1 מסמכים במרשם,ok|1 מסמכים במרשם', r.f);
    check('an unrelated document does not turn them green', r.o.join() === 'na,na', r.o);
  }

  console.log('\nThe factory procedure behind each clause (clause table, 22/04/2025)');
  {
    const r = await page.evaluate(() => {
      const C = _isoClauses();
      const p = (cl, std) => (C.filter((c) => c.cl === cl && (!std || c.std === std))[0] || {}).proc;
      return { missing: C.filter((c) => !c.proc).map((c) => c.cl + ' ' + c.std), moc: p('8.1.3'), h45: p('6.1.2', '45001 + 14001'), h14: p('6.1.2', '14001'), em: p('8.2') };
    });
    check('every clause on the sheet names its procedure', r.missing.length === 0, r.missing);
    check('8.1.3 = procedure 35, 8.2 = procedure 26', r.moc === 'נוהל 35' && r.em === 'נוהל 26', r);
    check('the two 6.1.2 clauses get their own procedure (33 hazards, 28 aspects)', /נוהל 33/.test(r.h45) && r.h14 === 'נוהל 28', r);
  }

  await browser.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('HARNESS ERROR', e); process.exit(2); });
