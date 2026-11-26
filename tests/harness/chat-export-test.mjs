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

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
