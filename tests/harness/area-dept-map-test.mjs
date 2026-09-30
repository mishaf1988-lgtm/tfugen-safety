// Area -> department (upgrade review 4, 30/09/2026; Michael's map of 29/09):
// ONE map, in the server (hazard-file.js AREA_DEPT) and in the app
// (index.html AREA_DEPT). Checks they are the same object, what a trustee
// finding from each area becomes in the register and the department report,
// and that a row typed in Excel with a department the report does not know is
// listed instead of opened.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { AREA_DEPT, NO_DEPT, DEPTS, REPORT_DEPTS, MAINT, trusteeResp, deptOf, trusteeDept, buildRegister, diffEdits } from './_build/hazard-file.mjs';
import { buildReport } from './_build/hazard-report.mjs';

let pass = 0, fail = 0;
const check = (l, c, d) => { if (c) { pass++; console.log('  ✓ ' + l); } else { fail++; console.log('  ✗ ' + l + (d !== undefined ? '  -> ' + JSON.stringify(d) : '')); } };
const here = path.dirname(fileURLToPath(import.meta.url));
const html = fs.readFileSync(path.join(here, '../../index.html'), 'utf8');

console.log('\n1. one map');
const m = /var AREA_DEPT=(\{[^;]*\});/.exec(html);
const appMap = m ? new Function('return ' + m[1])() : null;
check('the app has AREA_DEPT', !!appMap);
check('the app\'s map is the server\'s map, key for key', appMap && JSON.stringify(Object.entries(appMap).sort()) === JSON.stringify(Object.entries(AREA_DEPT).sort()), [appMap, AREA_DEPT]);
const nd = /var NO_DEPT='([^']*)'/.exec(html);
check('the same "no department" label', nd && new Function("return '" + nd[1] + "'")() === NO_DEPT && NO_DEPT === 'ללא מחלקה', nd && nd[1]);
check('every department the map points to is one of the report\'s 6 (the 5 + אחזקה)', Object.values(AREA_DEPT).every((v) => v === null || REPORT_DEPTS.includes(v)) && REPORT_DEPTS.length === 6 && MAINT === 'אחזקה' && DEPTS.length === 5);

console.log('\n2. Michael\'s answers (29/09/2026; yard, waste water, infrastructure to maintenance 30/09/2026)');
const want = { 'אריזה': 'ייצור טוגנים', 'קילופים': 'ייצור טוגנים', 'מעבדה': 'מעבדות', 'חצר': 'אחזקה', 'שפכים': 'אחזקה', 'תשתיות': 'אחזקה', 'מעוצבים': 'מעצבים', 'תוצ"ג': 'תוצג', 'אחזקה': 'אחזקה',
  'חומר גלם + שפכים': 'אחזקה', 'שפכים + חומר גלם': 'אחזקה', 'אריזה + מעבדה': 'ייצור טוגנים', 'מחסן כללי + מעבדה': 'מעבדות', 'מחסן כללי': null, 'מחסן כללי + מחסן ב': null };
Object.entries(want).forEach(([a, d]) => check(a + ' -> ' + (d || 'no department'), deptOf(a) === d, deptOf(a)));
check('a department\'s own name maps to itself (and a trailing space, as in the data, is fine)', DEPTS.every((d) => deptOf(d) === d) && deptOf('חומר גלם ') === 'חומר גלם');
check('an area not in the map: no department (never taken as a department)', deptOf('מחסן כללי') === null && deptOf('') === null && deptOf('+') === null);

console.log('\n3. the register and the department report');
const tr = (id, loc, f) => ({ id, u: 'דני', t: 1, d: '2026-09-29', ts: '2026-09-29T08:00:00Z', loc, ok: false, s: 'פתוח', f });
const reports = [tr('a', 'אריזה · קו 3', 'משטח שבור'), tr('b', 'חצר · שער אחורי', 'בור פתוח'), tr('c', 'מחסן כללי · סדנה', 'כבל חשוף'), tr('d', 'מעבדה · מדף', 'בקבוק פתוח'), tr('e', 'חומר גלם + שפכים · משרד שפכים', 'שטח תנועה של מלגזות')];
const reg = buildRegister([], reports, []);
const byF = (f) => reg.rows.find((r) => r[5] === f);
check('packing -> ייצור טוגנים, place kept', byF('משטח שבור')[3] === 'ייצור טוגנים' && byF('משטח שבור')[4] === 'קו 3', byF('משטח שבור'));
check('lab -> מעבדות', byF('בקבוק פתוח')[3] === 'מעבדות', byF('בקבוק פתוח'));
check('yard: אחזקה in column D, the place in column E', byF('בור פתוח')[3] === 'אחזקה' && byF('בור פתוח')[4] === 'שער אחורי', byF('בור פתוח'));
check('the 30/09 finding ("חומר גלם + שפכים · משרד שפכים"): אחזקה, both areas kept in E', byF('שטח תנועה של מלגזות')[3] === 'אחזקה' && byF('שטח תנועה של מלגזות')[4] === 'חומר גלם + שפכים · משרד שפכים', byF('שטח תנועה של מלגזות'));
check('an area not in the map (מחסן כללי): "ללא מחלקה", the area kept', byF('כבל חשוף')[3] === NO_DEPT && /^מחסן כללי/.test(byF('כבל חשוף')[4]), byF('כבל חשוף'));
check('trusteeDept without "·": the whole text is the place', JSON.stringify(trusteeDept('מחסן כללי')) === JSON.stringify({ dept: NO_DEPT, loc: 'מחסן כללי' }) && trusteeDept('תוצ"ג').dept === 'תוצג', trusteeDept('מחסן כללי'));
const rcpt = { depts: Object.fromEntries(REPORT_DEPTS.map((d) => [d, ['x@tapugan.co.il']])), resp: {}, cc: [] };
const reps = REPORT_DEPTS.map((d) => buildReport(d, reg.rows, rcpt, {}, '2026-09-30'));
const inAny = (f) => reps.some((r) => r.rows.some((x) => x.descr === f));
check('the department report: packing goes to ייצור טוגנים', reps.find((r) => r.dept === 'ייצור טוגנים').rows.some((x) => x.descr === 'משטח שבור'));
check('the department report: yard and the two-area finding go to אחזקה', ['בור פתוח', 'שטח תנועה של מלגזות'].every((f) => reps.find((r) => r.dept === 'אחזקה').rows.some((x) => x.descr === f)), reps.map((r) => [r.dept, r.count]));
check('the department report: a no-department finding reaches no department', !inAny('כבל חשוף'), reps.map((r) => [r.dept, r.count]));

console.log('\n3b. who handles a trustee finding (column H, 30/09/2026)');
check('in a production department: מנהל המחלקה, as before', byF('משטח שבור')[7] === 'מנהל המחלקה' && trusteeResp('חומר גלם', 'פנס שבור') === 'מנהל המחלקה');
check('maintenance: אחזקה (the 30/09 finding)', byF('שטח תנועה של מלגזות')[7] === 'אחזקה' && byF('בור פתוח')[7] === 'אחזקה', [byF('שטח תנועה של מלגזות')[7], byF('בור פתוח')[7]]);
check('maintenance, an electrical finding: חשמל', ['כבל חשמל חשוף', 'תאורה לא עובדת בשער', 'פנס שבור', 'מפסק פתוח', 'אין הארקה'].every((f) => trusteeResp('אחזקה', f) === 'חשמל'));
check('...not a dip in the floor or a notice board', trusteeResp('אחזקה', 'שקע ברצפה ליד השער') === 'אחזקה' && trusteeResp('אחזקה', 'לוח מודעות נפל') === 'אחזקה');
const mrep = buildReport('אחזקה', buildRegister([], [tr('x', 'חצר · שער', 'כבל חשמל חשוף')], []).rows, { depts: {}, resp: { 'אחזקה': ['vitaly@x'], 'חשמל': ['slava@x'], 'הנדסה': ['shlomi@x'] }, cc: [] }, {}, '2026-09-30');
check('the maintenance report still goes to all three when the finding is electrical', mrep.to.join() === 'vitaly@x,slava@x,shlomi@x' && mrep.rows[0].resp === 'חשמל', [mrep.to, mrep.rows[0] && mrep.rows[0].resp]);

console.log('\n3c. task 9, electrical panels and faults (30/09/2026)');
{
  const t9 = (id, loc, f) => Object.assign(tr(id, loc, f), { t: 9 });
  const r9 = buildRegister([], [t9('p', 'אריזה · קו 3', 'לוח פתוח'), t9('q', 'חצר · שער', 'שקע שבור')], []);
  const rowP = r9.rows.find((r) => r[5] === 'לוח פתוח'), rowQ = r9.rows.find((r) => r[5] === 'שקע שבור');
  check('a task-9 report is a finding: it is in the register, numbered', !!rowP && !!rowQ && /^נ-/.test(String(rowP && rowP[0])), r9.rows.map((r) => r[0]));
  check('in a production department: the manager AND electrical, even with no electrical word', rowP && rowP[7] === 'מנהל המחלקה + חשמל', rowP && rowP[7]);
  check('in maintenance: electrical', rowQ && rowQ[7] === 'חשמל', rowQ && rowQ[7]);
  check('task 8 (the closing photo) is still not a finding', !buildRegister([], [Object.assign(tr('z', 'אריזה · קו 3', 'x'), { t: 8 })], []).rows.length);
  const rc = { depts: { 'ייצור טוגנים': ['prod@x'] }, resp: { 'אחזקה': ['vitaly@x'], 'חשמל': ['slava@x'], 'הנדסה': ['shlomi@x'] }, cc: [] };
  const prep = buildReport('ייצור טוגנים', r9.rows, rc, {}, '2026-09-30');
  check('the production report goes to its manager, electrical and engineering', prep.to.join() === 'prod@x,slava@x,shlomi@x', prep.to);
}

console.log('\n4. a row typed in Excel');
const last = { rows: [], ids: [] };
const row = (dept, descr) => ({ r: 9, v: ['', '2026-09-30', 12, dept, 'מחסן', descr, 'גבוהה', 'אחזקה', '', null, 'פתוח', null, ''] });
let ed = diffEdits([row('מחסן כללי', 'בור')], last, [], [], '2026-09-30');
check('an area with no department (מחסן כללי): not opened, listed "dept"', !ed.fresh.length && ed.dropped.some((d) => d.why === 'dept' && d.ci === 3 && d.val === 'מחסן כללי'), ed);
ed = diffEdits([row('אחזקה', 'בור')], last, [], [], '2026-09-30');
check('אחזקה typed in column D: opened under אחזקה', ed.fresh.length === 1 && ed.fresh[0].dept === 'אחזקה', ed.fresh);
ed = diffEdits([row('חצר', 'בור')], last, [], [], '2026-09-30');
check('חצר typed in column D: opened under אחזקה', ed.fresh.length === 1 && ed.fresh[0].dept === 'אחזקה', ed.fresh);
ed = diffEdits([row('אריזה', 'משטח')], last, [], [], '2026-09-30');
check('an area of a department (אריזה): opened under ייצור טוגנים', ed.fresh.length === 1 && ed.fresh[0].dept === 'ייצור טוגנים', ed.fresh);
const lab = [{ id: 'h1', n: 1, d: '2026-09-30', dept: 'מעבדות', descr: 'שולחן', s: 'פתוח' }];
ed = diffEdits([row('מעבדה', 'שולחן')], last, lab, [], '2026-09-30');
check('"מעבדה" typed for a hazard already opened under מעבדות: not opened twice (the bug)', !ed.fresh.length && !ed.dropped.length, [ed.fresh, ed.dropped]);

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
