// Edit a stored row and save it unchanged: nothing may change (07/10/2026, Michael in a
// questionnaire: "a save review of every form"). Found on real rows the same day: an
// environmental aspect lost its status (a <select> without that option read empty and the save
// wrote null over "מבוצע - ..."), and a hazard closed without a date got today as its close date.
// Rows are made up, shaped like the live ones (free-text statuses, imported words, no dates).
// Israel's time zone, as on Michael's phone (an incident's time is shown and read in local time).
const path = require('path');
let pw; try { pw = require('playwright'); } catch (e) { pw = require('playwright-core'); }
const HTML = 'file://' + path.resolve(__dirname, '../../index.html');
let pass = 0, fail = 0;
const check = (l, c, d) => { if (c) { pass++; console.log('  ✓ ' + l); } else { fail++; console.log('  ✗ ' + l + (d !== undefined ? '  -> ' + JSON.stringify(d).slice(0, 400) : '')); } };

const SEED = {
  env_aspects: [
    { id: 'ea1', aspect: 'פסולת מוצקה', activity: 'כלל מפעל', impact: 'אריזות', controls: 'דיווח', owner: 'מנהל איכות סביבה', review_date: '2026-12-31', lifecycle: 'ייצור', control_type: 'שליטה', direction: 'השפעה של הארגון על הסביבה', p_curr: 1, sv_curr: 2, p_pot: 1, sv_pot: 2, additional_controls: 'לא נדרשות', status: 'בוצע - דיווח לחוק האריזות באפריל', notes: null },
    { id: 'ea2', aspect: 'ניצול משאבי טבע', activity: 'כלל המפעל', impact: 'אנרגיה', controls: 'גז', owner: 'מנהל', review_date: '2026-12-31', lifecycle: 'ייצור', control_type: 'שליטה', direction: 'השפעה של הארגון על הסביבה', p_curr: 2, sv_curr: 3, p_pot: 1, sv_pot: 3, additional_controls: 'ממונה', status: 'מבוצע', notes: null },
  ],
  tour_hazards: [
    { id: 'th-a', n: 6, d: null, tour_no: 2, dept: 'ייצור טוגנים', loc: 'סינון שמן', descr: 'מכסה פתוח', sev: 'גבוהה', resp: 'אחזקה', action: 'להתקין מגן', due: null, s: 'סגור', closed_d: null, notes: null },
    { id: 'th-b', n: 2, d: null, tour_no: 1, dept: 'מעצבים', loc: 'מחסן', descr: 'מחסן מבולגן', sev: 'בינונית', resp: 'מנהל', action: 'לסדר', due: '2026-06-08', s: 'סגור', closed_d: '2026-06-16', notes: 'נעשה סדר' },
  ],
  equip_inspections: [{ id: 'eq1', code: 'FORK-9', n: 'מלגזה', vendor: 'בודק', loc: 'מחסן', d: '2026-04-29', e: '2027-01-01', s: 'לתקן', notes: 'שרשרת' }],
  inc: [{ id: 'inc1', d: 'נפילה במדרגות', dt: '2025-06-10T21:00:00+00:00', ty: 'תאונה עם פציעה', sv: null, l: 'קילופים', w: 'עובד', dy: null, s: 'בחקירה', r: 'מהות הפגיעה: חבלה', p: null }],
  near_miss: [{ id: 'nm1', d: '2026-05-28', t: null, descr: 'שפך חומצה', area: 'קילופים / אחזקה', rep: null, sev: null, typ: 'כימי', s: 'בטיפול', notes: 'הועבר ממצגת' }],
  toolbox: [{ id: 'tb1', d: '2026-05-20', topic: 'ריענון בטיחות שבועי (Vitre)', presenter: 'נועם', attendees: null, s: 'נמסרה', notes: 'יובא מ-Vitre', dep: 'טוגנים' }],
  hzm: [{ id: 'hz1', n: 'Nalco 73540', un: 'UN 1760', hs: null, q: null, loc: 'מאצרה', ms: null, em: 'אחסון: מאצרה', file_url: null }],
};
const CUSTOM = { inc: ['editInc', 'm-inc', 'svInc'], env_aspects: ['editEasp', 'm-easp', 'svEasp'], equip_inspections: ['eqiEdit', 'm-eqi', 'svEqi'] };
const SV = { 'm-thz': 'svThz', 'm-nm': 'svNm', 'm-toolbox': 'svToolbox', 'm-hzm': 'svHzm' };
const norm = (k, v) => {
  if (v === null || v === undefined) return '';
  if (/^dt$/.test(k) && v) return String(new Date(v).getTime());
  return typeof v === 'object' ? JSON.stringify(v) : String(v);
};

(async () => {
  const browser = await pw.chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'he-IL', timezoneId: 'Asia/Jerusalem' })).newPage();
  await page.route('**/*', (r) => r.request().url().startsWith('file://') ? r.continue() : r.abort());
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  page.on('dialog', (d) => d.accept().catch(() => {}));
  await page.goto(HTML, { waitUntil: 'load' });
  await page.waitForTimeout(800);
  await page.evaluate((seed) => {
    document.getElementById('login').style.display = 'none'; document.getElementById('app').style.display = 'block';
    window.__out = []; window.sbIns = (t, r) => __out.push({ op: 'ins', t, r: JSON.parse(JSON.stringify(r)) }); window.sbUpd = (t, r) => __out.push({ op: 'upd', t, r: JSON.parse(JSON.stringify(r)) });
    window.sdb = () => {}; window.toast = () => {}; window.addLog = () => {}; window._role = () => 'admin'; window._isAdminUser = () => true; _isAdmin = true; window._currentUser = { username: 'admin' };
    for (const k in seed) DB[k] = JSON.parse(JSON.stringify(seed[k]));
  }, SEED);
  for (const t of Object.keys(SEED)) {
    for (const row of SEED[t]) {
      const c = CUSTOM[t] || ['_genEdit', null, null];
      const m = c[1] || (await page.evaluate((t) => _EDIT_MODS[t] && _EDIT_MODS[t].m, t));
      const sv = c[2] || SV[m];
      await page.evaluate(([t, id, open]) => { __out = []; if (open === '_genEdit') _genEdit(t, id); else window[open](id); }, [t, row.id, c[0]]);
      await page.waitForTimeout(300);
      await page.evaluate((sv) => window[sv](), sv);
      await page.waitForTimeout(150);
      const out = await page.evaluate((t) => __out.filter((x) => x.t === t), t);
      await page.evaluate((m) => { try { closeModal(m); } catch (e) {} }, m);
      const w = out[out.length - 1];
      const diffs = [];
      if (!w) diffs.push('nothing saved');
      else {
        if (w.op !== 'upd') diffs.push('insert instead of update');
        for (const k of Object.keys(w.r)) if (k in row && k !== 'ts' && norm(k, row[k]) !== norm(k, w.r[k])) diffs.push(k + ': ' + JSON.stringify(row[k]) + ' -> ' + JSON.stringify(w.r[k]));
      }
      check(t + ' ' + row.id + ': edit and save unchanged, nothing changes', !diffs.length, diffs);
    }
  }
  check('no page errors', !errs.length, errs.slice(0, 3));
  await browser.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('HARNESS ERROR', e); process.exit(2); });
