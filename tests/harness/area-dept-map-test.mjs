// Area -> department (upgrade review 4, 30/09/2026; Michael's map of 29/09):
// ONE map, in the server (hazard-file.js AREA_DEPT) and in the app
// (index.html AREA_DEPT). Checks they are the same object, what a trustee
// finding from each area becomes in the register and the department report,
// and that a row typed in Excel with a department the report does not know is
// listed instead of opened.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { AREA_DEPT, NO_DEPT, DEPTS, deptOf, trusteeDept, buildRegister, diffEdits } from './_build/hazard-file.mjs';
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
check('every department the map points to is one of the report\'s 5', Object.values(AREA_DEPT).every((v) => v === null || DEPTS.includes(v)));

console.log('\n2. Michael\'s answers (29/09/2026)');
const want = { 'אריזה': 'ייצור טוגנים', 'קילופים': 'ייצור טוגנים', 'מעבדה': 'מעבדות', 'חצר': null, 'שפכים': null, 'תשתיות': null, 'מעוצבים': 'מעצבים', 'תוצ"ג': 'תוצג' };
Object.entries(want).forEach(([a, d]) => check(a + ' -> ' + (d || 'no department'), deptOf(a) === d, deptOf(a)));
check('a department\'s own name maps to itself (and a trailing space, as in the data, is fine)', DEPTS.every((d) => deptOf(d) === d) && deptOf('חומר גלם ') === 'חומר גלם');
check('an area not in the map: no department (never taken as a department)', deptOf('אחזקה') === null && deptOf('') === null);

console.log('\n3. the register and the department report');
const tr = (id, loc, f) => ({ id, u: 'דני', t: 1, d: '2026-09-29', ts: '2026-09-29T08:00:00Z', loc, ok: false, s: 'פתוח', f });
const reports = [tr('a', 'אריזה · קו 3', 'משטח שבור'), tr('b', 'חצר · שער אחורי', 'בור פתוח'), tr('c', 'אחזקה · סדנה', 'כבל חשוף'), tr('d', 'מעבדה · מדף', 'בקבוק פתוח')];
const reg = buildRegister([], reports, []);
const byF = (f) => reg.rows.find((r) => r[5] === f);
check('packing -> ייצור טוגנים, place kept', byF('משטח שבור')[3] === 'ייצור טוגנים' && byF('משטח שבור')[4] === 'קו 3', byF('משטח שבור'));
check('lab -> מעבדות', byF('בקבוק פתוח')[3] === 'מעבדות', byF('בקבוק פתוח'));
check('yard: "ללא מחלקה" in column D, the area kept in column E', byF('בור פתוח')[3] === NO_DEPT && byF('בור פתוח')[4] === 'חצר · שער אחורי', byF('בור פתוח'));
check('an area not in the map (אחזקה): "ללא מחלקה" too, the area kept', byF('כבל חשוף')[3] === NO_DEPT && /^אחזקה/.test(byF('כבל חשוף')[4]), byF('כבל חשוף'));
check('trusteeDept without "·": the whole text is the place', JSON.stringify(trusteeDept('חצר')) === JSON.stringify({ dept: NO_DEPT, loc: 'חצר' }) && trusteeDept('תוצ"ג').dept === 'תוצג', trusteeDept('חצר'));
const rcpt = { depts: Object.fromEntries(DEPTS.map((d) => [d, ['x@tapugan.co.il']])), resp: {}, cc: [] };
const reps = DEPTS.map((d) => buildReport(d, reg.rows, rcpt, {}, '2026-09-30'));
const inAny = (f) => reps.some((r) => r.rows.some((x) => x.descr === f));
check('the department report: packing goes to ייצור טוגנים', reps.find((r) => r.dept === 'ייצור טוגנים').rows.some((x) => x.descr === 'משטח שבור'));
check('the department report: the no-department findings reach no department', !inAny('בור פתוח') && !inAny('כבל חשוף'), reps.map((r) => [r.dept, r.count]));

console.log('\n4. a row typed in Excel');
const last = { rows: [], ids: [] };
const row = (dept, descr) => ({ r: 9, v: ['', '2026-09-30', 12, dept, 'מחסן', descr, 'גבוהה', 'אחזקה', '', null, 'פתוח', null, ''] });
let ed = diffEdits([row('חצר', 'בור')], last, [], [], '2026-09-30');
check('a department with none (חצר): not opened, listed "dept"', !ed.fresh.length && ed.dropped.some((d) => d.why === 'dept' && d.ci === 3 && d.val === 'חצר'), ed);
ed = diffEdits([row('אחזקה', 'בור')], last, [], [], '2026-09-30');
check('a department the report does not know (אחזקה): not opened, listed', !ed.fresh.length && ed.dropped.some((d) => d.why === 'dept'), ed.dropped);
ed = diffEdits([row('אריזה', 'משטח')], last, [], [], '2026-09-30');
check('an area of a department (אריזה): opened under ייצור טוגנים', ed.fresh.length === 1 && ed.fresh[0].dept === 'ייצור טוגנים', ed.fresh);
const lab = [{ id: 'h1', n: 1, d: '2026-09-30', dept: 'מעבדות', descr: 'שולחן', s: 'פתוח' }];
ed = diffEdits([row('מעבדה', 'שולחן')], last, lab, [], '2026-09-30');
check('"מעבדה" typed for a hazard already opened under מעבדות: not opened twice (the bug)', !ed.fresh.length && !ed.dropped.length, [ed.fresh, ed.dropped]);

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
