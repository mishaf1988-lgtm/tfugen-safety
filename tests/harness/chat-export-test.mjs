// A WhatsApp chat export for the assistant (26/11/2026, idea 50): the last days, with phone numbers, IDs, e-mails and health
// messages removed (functions/_chatexport.js). Pure.
import { chatExport, MEDICAL_MARK, CHAT_MAX_CHARS, CHAT_DAYS_DEFAULT } from './_build/_chatexport.mjs';
let pass = 0, fail = 0;
const check = (l, c, d) => { if (c) { pass++; console.log('  ✓ ' + l); } else { fail++; console.log('  ✗ ' + l + (d !== undefined ? '  -> ' + JSON.stringify(d) : '')); } };
const NOW = Date.UTC(2026, 10, 26, 18);
const H = 'דוד', R = 'רונית';

console.log('\n1. the window');
{
  const raw = '26/11/2026, 14:03 - ' + H + ': a\n[20/11/2026, 10:00:11] ' + R + ': b\n01/10/2026, 10:00 - ' + H + ': old\n20.11.26, 08:00 - ' + R + ': c';
  const r = chatExport(raw, 14, NOW);
  check('Android and iPhone lines, dots or slashes, a two digit year: the old line is out, the others in', r.stats.kept === 3 && r.stats.messages === 4 && !/old/.test(r.text), r.stats);
  check('from and to are the earliest and latest kept day', r.stats.from === '2026-11-20' && r.stats.to === '2026-11-26', r.stats);
  check('days: 1 keeps only the last day (the line at 14:03 is 4 hours old)', chatExport(raw, 1, NOW).stats.kept === 1);
  check('days over the maximum, or garbage, falls to the limits', chatExport(raw, 99999, NOW).stats.days === 120 && chatExport(raw, 'x', NOW).stats.days === CHAT_DAYS_DEFAULT && chatExport(raw, 0, NOW).stats.days === CHAT_DAYS_DEFAULT);
  check('a line with no date belongs to the message before it, and goes with it', chatExport('26/11/2026, 14:03 - ' + H + ': one\ntwo\n01/01/2020, 10:00 - ' + R + ': x\nthree', 14, NOW).text === '26/11/2026, 14:03 - ' + H + ': one\ntwo');
  check('empty or not a string: nothing, no crash', chatExport('', 14, NOW).text === '' && chatExport(null, 14, NOW).stats.kept === 0 && chatExport(undefined, 14, NOW).text === '');
}

console.log('\n2. what is removed');
{
  const raw = '26/11/2026, 14:03 - ' + H + ': call +972 54-794-0073 or 054-794-0073 or 0547940073 or 08-6808331\n'
    + '26/11/2026, 14:04 - ' + R + ': id 334455667 and mail a.b@c.co.il\n'
    + '26/11/2026, 14:05 - ' + H + ': יוסי בניתוח השבוע\nוגם בשורה נוספת\n'
    + '26/11/2026, 14:06 - ' + R + ': בדיקת שמיעה של עובד\n'
    + '26/11/2026, 14:07 - ' + H + ': order 106520 on 26/11/2026 is due and 1234567890123 stays';
  const r = chatExport(raw, 14, NOW);
  check('phones (international, mobile, landline) are gone', r.stats.phones === 4 && !/0547940073|054-794-0073|972 54|08-6808331/.test(r.text), r.stats);
  check('a 9 digit ID and an e-mail are gone', r.stats.ids === 1 && r.stats.emails === 1 && !/334455667|c\.co\.il/.test(r.text), r.stats);
  check('a health message (surgery, hearing) is replaced whole, with its continuation line, and the sender stays', r.stats.medical === 2 && !/בניתוח|שמיעה|נוספת/.test(r.text) && r.text.includes(H + ': ' + MEDICAL_MARK) && r.text.includes(R + ': ' + MEDICAL_MARK), r.text);
  check('a short number (an order) and a date stay; a 13 digit number is not an ID', /106520/.test(r.text) && /on 26\/11\/2026 is due/.test(r.text) && /1234567890123/.test(r.text), r.text);
}

console.log('\n3. the size');
{
  let raw = ''; for (let i = 0; i < 4000; i++) raw += '26/11/2026, 14:03 - ' + H + ': line number ' + i + ' of the export, a normal length message\n';
  const r = chatExport(raw, 14, NOW);
  check('over the cap: the newest part, cut at a message start, flagged', r.stats.truncated === true && r.text.length <= CHAT_MAX_CHARS && /^26\/11\/2026, 14:03 - /.test(r.text) && /number 3999 /.test(r.text) && !/number 0 /.test(r.text), { n: r.text.length, h: r.text.slice(0, 40) });
  check('under the cap: not truncated', chatExport('26/11/2026, 14:03 - ' + H + ': x', 14, NOW).stats.truncated === false);
}

console.log('\n4. the security review of 26/11/2026');
{
  const L = (x) => '26/11/2026, 14:03 - ' + H + ': ' + x;
  const red = (x) => chatExport(L(x), 14, NOW).text;
  check('an ID with a dash or spaces, or in Arabic-Indic digits, is gone', !/334|445|667/.test(red('334-455-667 or 33445 5667 or \u0663\u0663\u0664\u0664\u0665\u0665\u0666\u0666\u0667')), red('334-455-667'));
  check('an 8 digit ID written after the ID word is gone, an 8 digit order number alone stays', !/33445566/.test(red('\u05ea.\u05d6. 33445566')) && /26001584/.test(red('order 26001584 approved')));
  check('phones with odd spacing, or 972 without a plus, are gone', !/794|7940073|547940073/.test(red('054 794 00 73 and 972547940073 and 08 680 83 31')), red('054 794 00 73'));
  check('health words from the review (illness of, hospitalized, spelling variants, cancer) are replaced; an injury at work stays', ['\u05de\u05d7\u05dc\u05ea \u05dc\u05d1', '\u05de\u05d0\u05d5\u05e9\u05e4\u05d6', '\u05d0\u05d9\u05e9\u05e4\u05d5\u05d6', '\u05d4\u05d9\u05e8\u05d9\u05d5\u05df', '\u05e1\u05e8\u05d8\u05df'].every((w) => red(w).includes(MEDICAL_MARK)) && /\u05e0\u05e4\u05e6\u05e2/.test(red('\u05e0\u05e4\u05e6\u05e2 \u05d1\u05e8\u05d2\u05dc')));
  check('US order date (month first) is read right; a month of 13 is not a date and the message is out', chatExport('11/26/26, 2:03 PM - ' + H + ': a\n13/13/2026, 1:00 - ' + R + ': b', 14, NOW).stats.kept === 1);
  let t = Date.now();
  const r = chatExport('26/11/2026, 14:03 - ' + H + ': ' + '0'.repeat(2000000), 14, NOW);
  check('a 2MB single line (the e-mail pattern was quadratic on it) takes well under a second and is cut', Date.now() - t < 1500 && r.stats.cut === 1 && r.text.length < 3100, { ms: Date.now() - t, n: r.text.length });
  t = Date.now(); chatExport('26/11/2026, 14:03 - ' + H + ': ' + 'a'.repeat(1500000) + '@', 14, NOW);
  check('a long run of e-mail characters with a lone at-sign is fast too', Date.now() - t < 1500, Date.now() - t);
  const many = ('26/11/2026, 14:03 - ' + H + ': x\n').repeat(150000);
  check('150 thousand messages: from and to by a loop, no stack problem', chatExport(many, 14, NOW).stats.from === '2026-11-26');
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
