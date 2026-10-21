// Michael's own "sign in my name on <file>" read by the server (21/10/2026, wa-hook signAskOf / signPick /
// fastRoute): the assistant's sign_request was stopped by the cloud permission check, so the server finds the PDF
// in the safety folder and asks him itself. Pure parts only; the search and routine-db are covered elsewhere.
import { signAskOf, signPick, signAskManyText, fastRoute, recentPdfs, signPickOf, signPickChoices, signPickText } from './_build/wa-hook.mjs';
import { OD_ROOT } from './_build/routine-db.mjs';

let pass = 0, fail = 0;
const check = (l, c, d) => { if (c) { pass++; console.log('  ✓ ' + l); } else { fail++; console.log('  ✗ ' + l + (d !== undefined ? '  -> ' + JSON.stringify(d).slice(0, 300) : '')); } };
const T = 'תחתום בשמי על ';
const item = (dir, name) => ({ name, file: {}, parentReference: { path: '/drive/root:/' + encodeURI(OD_ROOT + dir) } });

check('the request is read, quotes and .pdf dropped', signAskOf(T + '"טופס 16.pdf"') === 'טופס 16', signAskOf(T + '"טופס 16.pdf"'));
check('the placeholder text of 20:48 becomes a search, not a crash', typeof signAskOf(T + '<שם של PDF>') === 'string');
check('other messages are not a request', signAskOf('מה המצב') === null && signAskOf('1') === null && signAskOf(T) === null);
check('fastRoute: a long request still routes (before the 40-character limit)', (fastRoute({ text: T + 'מערכת שמתאימה את הפעולות בארגון' }, '', null) || {}).kind === 'sign_ask');

const one = signPick([item('99_שונות', 'a.pdf')], 'a');
check('one PDF: its path relative to the safety folder', one.length === 1 && one[0].path === '99_שונות/a.pdf', one);
const ex = signPick([item('x', 'form.pdf'), item('y', 'form old.pdf'), item('z', 'form 2.pdf')], 'form');
check('the exact name wins over partial matches', ex.length === 1 && ex[0].path === 'x/form.pdf', ex);
const many = signPick([item('x', 'f1.pdf'), item('y', 'f2.pdf'), item('z', 'f3.pdf'), item('z', 'f4.pdf'), item('z', 'f5.pdf'), item('z', 'f6.pdf')], 'f');
check('several: at most 5, listed with numbers', many.length === 5 && /^.+\n1\. x\/f1\.pdf/.test(signAskManyText(many)), many);
const skip = signPick([item('x', 'f - חתום.pdf'), item('x', 'f.docx'), { name: 'g.pdf', file: {}, parentReference: { path: '/drive/root:/Other/x' } }], 'f');
check('a signed copy, a non-PDF and a file outside the safety folder are never offered', skip.length === 0, skip);
check('a PDF at the root of the safety folder (no subfolder) is not offered (sign_request needs a folder)', signPick([item('', 'r.pdf')], 'r').length === 0);

const at = (dir, name, d) => Object.assign(item(dir, name), { lastModifiedDateTime: d });
const rec = recentPdfs([at('a', 'old.pdf', '2026-01-01T00:00:00Z'), at('b', 'new.pdf', '2026-10-20T00:00:00Z'), at('c', 'mid.pdf', '2026-05-01T00:00:00Z'), at('d', 'x.docx', '2026-10-21T00:00:00Z'), at('e', 'mid2.pdf', '2026-04-01T00:00:00Z')], 3);
check('nothing matched: the 3 newest PDFs, newest first, no other files', rec.map((x) => x.name).join() === 'new.pdf,mid.pdf,mid2.pdf', rec);
check('buttons: the names without .pdf, short (choicesPayload adds the numbers)', signPickChoices(rec).join() === 'new,mid,mid2' && signPickChoices([{ name: 'a'.repeat(40) + '.pdf' }])[0].length <= 16 && /\n1\. b\/new\.pdf/.test(signPickText(rec, true)));
check('a tap on the pick message picks (button or typed digit)', signPickOf({ choice: 2 }, { ref: 'signpick' }) === 2 && signPickOf({ text: '3. mid' }, { ref: 'signpick' }) === 3);
check('the same digit after any other message is not a pick', signPickOf({ text: '1' }, { ref: 'brief' }) === null && signPickOf({ text: '1' }, null) === null);
check('fastRoute routes the tap as sign_pick', (fastRoute({ text: '1' }, '', { ref: 'signpick' }) || {}).kind === 'sign_pick');
console.log('\nsign-ask-test: ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
