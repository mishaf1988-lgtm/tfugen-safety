// The department lines of the weekly mail (10/10/2026, Michael: "בצע: מצב חתימות לפי מחלקה במייל
// השבועי"): one line per training department, this week's talk and how many of its workers signed
// (red under 80% from the day after), a draft still waiting, or no talk; nothing while no talk has a
// department; and the whole-plant line no longer counts a department or induction talk.
import { deptTalkLines, latestTalk, digestHtml, digestOf } from './_build/weekly-digest.mjs';
let pass = 0, fail = 0;
const check = (l, c, d) => { if (c) { pass++; console.log('  ✓ ' + l); } else { fail++; console.log('  ✗ ' + l + (d !== undefined ? '  -> ' + JSON.stringify(d).slice(0, 400) : '')); } };
const PUB = 'פורסמה', DRAFT = 'טיוטה';
const emps = [{ id: 'e1', dep: 'יצור' }, { id: 'e2', dep: 'יצור' }, { id: 'e3', dep: 'יצור' }, { id: 'e4', dep: 'יצור' }, { id: 'e5', dep: 'אריזה' }, { id: 'e6', dep: 'הנהלה' }];
const talks = [
  { id: 't1', d: '2026-10-11', title: 'אולם השטיפה', s: PUB, dept: 'טוגנים' },
  { id: 't0', d: '2026-10-04', title: 'ישנה', s: PUB, dept: 'טוגנים' },
  { id: 'a1', d: '2026-10-11', title: 'רובוט', s: DRAFT, dept: 'אריזה' },
  { id: 'old', d: '2026-09-20', title: 'ישנה מאוד', s: PUB, dept: 'מעבדה' },
  { id: 'ind', d: '2026-10-11', title: 'קליטה', s: PUB, dept: null, kind: 'induction' },
];
const reads = [{ talk_id: 't1', emp_id: 'e1' }, { talk_id: 't1', emp_id: 'e2' }, { talk_id: 't1', emp_id: 'e5' }, { talk_id: 't0', emp_id: 'e3' }];

console.log('\n1. the lines');
{
  const L = deptTalkLines(talks, reads, emps, '2026-10-12');
  const by = (d) => L.find((x) => x.text.startsWith(d + ':'));
  check('seven lines, one per training department', L.length === 7, L.map((x) => x.text));
  check('טוגנים: the newest published talk, 2 of the 4 "יצור" workers (a packer who signed is not counted)', /^טוגנים: 2 מתוך 4 חתמו על "אולם השטיפה"$/.test(by('טוגנים').text), by('טוגנים'));
  check('under 80% the day after: red', by('טוגנים').red === true);
  check('אריזה: a draft waiting to be published, red', /טיוטה שמחכה לפרסום/.test(by('אריזה').text) && by('אריזה').red);
  check('מעבדה: a talk three weeks old counts as no talk this week', /לא פורסמה הדרכה השבוע/.test(by('מעבדה').text) && by('מעבדה').red);
  const sameDay = deptTalkLines(talks, reads, emps, '2026-10-11');
  check('published this morning: not red yet', sameDay.find((x) => x.text.startsWith('טוגנים:')).red === false);
  const full = deptTalkLines(talks, reads.concat([{ talk_id: 't1', emp_id: 'e3' }, { talk_id: 't1', emp_id: 'e4' }]), emps, '2026-10-12');
  check('all four signed: not red', full.find((x) => x.text.startsWith('טוגנים:')).red === false && /4 מתוך 4/.test(full.find((x) => x.text.startsWith('טוגנים:')).text));
  check('no talk with a department at all: no lines', deptTalkLines([{ id: 'x', s: PUB, d: '2026-10-11' }], [], emps, '2026-10-12') === null && deptTalkLines(null, [], emps, '2026-10-12') === null);
}

console.log('\n2. the whole-plant line and the mail');
{
  const lt = latestTalk(talks.concat([{ id: 'w', d: '2026-10-05', title: 'כל המפעל', s: PUB }]));
  check('the whole-plant line skips department and induction talks', lt && lt.id === 'w', lt);
  const g = digestOf([], '2026-10-12');
  const h = digestHtml(g, '2026-10-12', { meeting: '2026-10-13', deckAt: '', watchOpen: [], deptTalks: deptTalkLines(talks, reads, emps, '2026-10-12') });
  check('the mail shows the block, a red line in red', h.includes('הדרכות שבועיות לפי מחלקה') && /color:#b91c1c;font-weight:bold">טוגנים: 2 מתוך 4/.test(h), h.slice(h.indexOf('לפי מחלקה') - 40, h.indexOf('לפי מחלקה') + 300));
  const h0 = digestHtml(g, '2026-10-12', { meeting: '2026-10-13', deckAt: '', watchOpen: [], deptTalks: null });
  check('no lines: no block', !h0.includes('הדרכות שבועיות לפי מחלקה'));
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
