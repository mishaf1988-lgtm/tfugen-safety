// The hazards sheet: does the file say the same thing the screen does?
//
// Two tables feed it and they disagree about almost everything. A trustee
// report is a hazard only when ok===false, and only when the task is a real
// one -- task 8 is "מעקב סגירה", where ok===false means "I went back and it is
// still not fixed", not a new hazard. A near-miss has no ok flag at all and
// its own status words. Get either wrong and the manager works from a list
// that is missing things, which is worse than having no list.
//
// So this drives the real functions against seeded rows and checks what comes
// out, rather than reading the source.
const path = require('path');
let pw; try { pw = require('playwright'); } catch (e) { pw = require('playwright-core'); }
const HTML = 'file://' + path.resolve(__dirname, '../../index.html');
let pass = 0, fail = 0;
const check = (l, c, d) => { if (c) { pass++; console.log('  ✓ ' + l); } else { fail++; console.log('  ✗ ' + l + (d !== undefined ? '  -> ' + JSON.stringify(d) : '')); } };

const DAY = 86400000;
const iso = (daysAgo) => new Date(Date.now() - daysAgo * DAY).toISOString();
const ymd = (daysAgo) => iso(daysAgo).substring(0, 10);

(async () => {
  const browser = await pw.chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, locale: 'he-IL' });
  const page = await ctx.newPage();
  page.on('dialog', (d) => d.accept().catch(() => {}));
  await page.route('**/*', (r) => r.request().url().startsWith('file://') ? r.continue() : r.abort());
  await page.goto(HTML, { waitUntil: 'load' });
  await page.waitForTimeout(700);

  const out = await page.evaluate((fix) => {
    window.sdb = function () {}; window.addLog = function () {};
    window.sbIns = function () {}; window.sbUpd = function () {};
    const toasts = [];
    window.toast = function (m) { toasts.push(String(m)); };

    // The locations table names its column `name`, not `n` like most others
    // (svLoc, index.html) -- a fixture with the wrong key makes _locName
    // return '' and the fallback look broken when it is not.
    DB.locations = [{ id: 'L1', name: 'מחסן חומרי גלם', parent_id: null, level: 1 }];
    DB.trustee_tasks = [
      { id: 'k5', n: 5, t: 'עמדות כיבוי אש', active: true },
      { id: 'k8', n: 8, t: 'מעקב סגירה', active: true },
    ];
    DB.trustee_reports = [
      // an open hazard
      { id: 'h1', u: 'דני כהן', t: 5, d: fix.d3, loc: 'אולם ייצור - מסוע 3',
        f: 'מטף ליד דלת 4, פלומבה קרועה', ok: false, s: 'פתוח', ts: fix.t3, photo_url: 'u/1.jpg', ref: 'אחזקה' },
      // one that was fixed
      { id: 'h2', u: 'רונית לוי', t: 5, d: fix.d40, loc: 'מעבדה',
        f: 'גלגלון חסום', ok: false, s: 'נסגר', ts: fix.t40, photo_url: '' },
      // a clean check: not a hazard, must not appear
      { id: 'ok1', u: 'דני כהן', t: 5, d: fix.d3, loc: 'אולם ייצור', f: '', ok: true, s: 'תקין', ts: fix.t3 },
      // task 8 is the follow-up task. ok===false there means "went back, still
      // not fixed" -- it is the SAME hazard, not a new one.
      { id: 'f1', u: 'יוסי בר', t: 8, d: fix.d1, loc: 'אולם ייצור', f: 'עדיין לא תוקן', ok: false, s: 'פתוח', ts: fix.t1 },
      // no loc typed: the location id has to carry it
      { id: 'h3', u: 'יוסי בר', t: 5, d: fix.d5, location_id: 'L1',
        f: 'מעבר חסום במשטחים', ok: false, s: 'פתוח', ts: fix.t5 },
    ];
    DB.near_miss = [
      { id: 'n1', d: fix.d2, descr: 'משטח כמעט נפל מהמלגזה', area: 'רציף העמסה',
        rep: 'משה לוי', sev: 'גבוהה', typ: 'ציוד הרמה', s: 'פתוח', ts: fix.t2, photo_url: 'u/n.jpg' },
      { id: 'n2', d: fix.d20, descr: 'מעידה במדרגות', area: 'משרדים',
        rep: 'שרה כהן', sev: 'נמוכה', typ: '', s: 'טופל', ts: fix.t20 },
      { id: 'n3', d: fix.d6, descr: 'ניצוץ מלוח חשמל', area: 'חדר מכונות',
        rep: 'אבי בר', sev: 'גבוהה', typ: 'חשמל', s: 'בטיפול', ts: fix.t6 },
    ];

    const rows = _hazRows();
    const aoa = _hazAoa(rows);
    const byId = {}; rows.forEach((r) => { byId[r.id] = r; });

    // The empty case must not reach for the CDN.
    let libCalls = 0;
    const realLib = window._ensureXlsxLib;
    window._ensureXlsxLib = function () { libCalls++; return Promise.resolve(); };
    const keepT = DB.trustee_reports, keepN = DB.near_miss;
    DB.trustee_reports = []; DB.near_miss = [];
    toasts.length = 0;
    _hazExportXlsx();
    const emptyToast = toasts.slice();
    const emptyLibCalls = libCalls;
    DB.trustee_reports = keepT; DB.near_miss = keepN;
    window._ensureXlsxLib = realLib;

    // Is it reachable? Both menus are built by callbacks, so collect the
    // labels the same way the menu does.
    const labels = [];
    const collect = (fn) => {
      try { fn(function (icon, label, cb) { labels.push({ label: label, cb: cb }); }, function () {}); } catch (e) {}
    };
    const origPop = window._popMenu;
    window._popMenu = function (anchor, id, build) { collect(build); };
    try { _truMgrMenu(null); } catch (e) {}
    window._popMenu = origPop;

    return {
      ids: rows.map((r) => r.id),
      rows: rows,
      header: aoa[0],
      firstDataRow: aoa[1],
      aoaLen: aoa.length,
      emptyToast: emptyToast,
      emptyLibCalls: emptyLibCalls,
      menuLabels: labels.map((x) => x.label),
      menuWired: labels.some((x) => x.cb === window._hazExportXlsx),
      h3: byId.h3, h1: byId.h1, h2: byId.h2, n3: byId.n3, n2: byId.n2,
    };
  }, { d1: ymd(1), t1: iso(1), d2: ymd(2), t2: iso(2), d3: ymd(3), t3: iso(3),
       d5: ymd(5), t5: iso(5), d6: ymd(6), t6: iso(6), d20: ymd(20), t20: iso(20),
       d40: ymd(40), t40: iso(40) });

  console.log('\n1. what counts as a hazard');
  {
    check('a trustee finding is in', out.ids.indexOf('h1') >= 0, out.ids);
    check('a clean check is NOT a hazard', out.ids.indexOf('ok1') < 0, out.ids);
    // The one that is easy to get wrong: the follow-up task reports on an
    // EXISTING hazard. Counting it would double every hazard that was checked
    // again, and inflate the open list with duplicates.
    check('the follow-up task (8) is not a second hazard', out.ids.indexOf('f1') < 0, out.ids);
    check('every near-miss is in, whatever its status',
      ['n1', 'n2', 'n3'].every((id) => out.ids.indexOf(id) >= 0), out.ids);
    check('a closed finding is still in the file (history, not noise)', out.ids.indexOf('h2') >= 0, out.ids);
    check('nothing else crept in (6 rows)', out.ids.length === 6, out.ids);
  }

  console.log('\n2. open and closed');
  {
    check('a finding not marked נסגר is open', out.h1 && out.h1.open === true, out.h1);
    check('...and one marked נסגר is not', out.h2 && out.h2.open === false, out.h2);
    // בטיפול is work in progress, not a closed hazard. Treating it as closed
    // is how something in progress drops off the manager's list.
    check('a near-miss in בטיפול counts as open', out.n3 && out.n3.open === true, out.n3);
    check('...and one in טופל does not', out.n2 && out.n2.open === false, out.n2);
    check('open rows come before closed ones',
      out.rows.findIndex((r) => !r.open) > out.rows.map((r) => r.open).lastIndexOf(true) - 1
      && out.rows.filter((r) => r.open).length === 4, out.ids);
  }

  console.log('\n3. the columns say what they hold');
  {
    const want = ['מקור', 'תאריך', 'אזור / מיקום', 'מי דיווח', 'תיאור המפגע',
      'משימה / סוג', 'חומרה', 'סטטוס', 'ימים פתוח', 'אחראי לסגירה', 'תמונה', 'מזהה'];
    check('the header is Hebrew and complete', JSON.stringify(out.header) === JSON.stringify(want), out.header);
    check('one row per hazard, plus the header', out.aoaLen === out.ids.length + 1, out.aoaLen);
    check('the date is printed DD/MM/YYYY, not ISO', /^\d{2}\/\d{2}\/\d{4}$/.test(out.firstDataRow[1]), out.firstDataRow[1]);
    // A row whose loc field is empty still has a location, through the id.
    // Without the fallback the manager gets a hazard with no place on it.
    check('a location given only by id still names the place',
      out.h3 && out.h3.loc === 'מחסן חומרי גלם', out.h3 && out.h3.loc);
    check('the trustee task name lands in משימה / סוג', out.h1 && out.h1.kind === 'עמדות כיבוי אש', out.h1);
    check('a near-miss carries its severity', out.n3 && out.n3.sev === 'גבוהה', out.n3);
    check('age is counted for an open hazard', out.h1 && out.h1.days === 3, out.h1 && out.h1.days);
    check('...and left blank once it is closed', out.h2 && out.h2.days === '', out.h2 && out.h2.days);
  }

  console.log('\n4. reachable, and quiet when there is nothing');
  {
    check('it is on the trustee manager menu',
      out.menuLabels.some((l) => /מפגעים/.test(l) && /אקסל/.test(l)), out.menuLabels);
    check('...wired to the export itself, not to a stale name', out.menuWired, out.menuLabels);
    check('an empty list says so', out.emptyToast.some((t) => /אין מפגעים/.test(t)), out.emptyToast);
    check('...without fetching a 900KB library to build nothing', out.emptyLibCalls === 0, out.emptyLibCalls);
  }

  await browser.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('HARNESS ERROR', e); process.exit(2); });
