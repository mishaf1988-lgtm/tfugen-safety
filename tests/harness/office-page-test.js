// The agents office page (project-files/agent-office-page.txt), 18/10/2026 review:
// the next run comes from the desk's cron, not from next_run that the 07:38 update writes once a day,
// and a reply updated in place ("קיבלתי" first, the full answer after) shows its bubble again.
const fs = require('fs'), path = require('path');
const src = fs.readFileSync(path.join(__dirname, '../../project-files/agent-office-page.txt'), 'utf8');
const js = src.split('<script>')[1].split('</script>')[0];
let passed = 0, failed = 0;
function check(label, cond, detail) {
  if (cond) { passed++; console.log('  ✓ ' + label); }
  else { failed++; console.log('  ✗ ' + label + (detail !== undefined ? '  -> ' + detail : '')); }
}
const block = (js.match(/function tms[\s\S]*?\n  function byNext/) || [''])[0].replace(/\n  function byNext$/, '');
check('the page has cronNext, upcoming and seenKey', /function cronNext/.test(block) && /function upcoming/.test(block) && /function seenKey/.test(block));
const lib = new Function('chatDocs', block + '; return {cronNext, upcoming, seenKey, tms};')([]);
const now = Date.parse('2026-10-18T16:50:00Z');
// the same next runs the server returned in list_triggers on 18/10/2026
[['CRON_TZ=Asia/Jerusalem 11 8,12,16 * * 0-4', '2026-10-19T05:11:00.000Z'],
 ['CRON_TZ=Asia/Jerusalem 13 12 * * 0', '2026-10-25T10:13:00.000Z'],
 ['19 * * * *', '2026-10-18T17:19:00.000Z'],
 ['CRON_TZ=Asia/Jerusalem 3 8 1 * *', '2026-11-01T06:03:00.000Z'],
 ['CRON_TZ=Asia/Jerusalem 44 22 * * 6', '2026-10-24T19:44:00.000Z'],
 ['17 5 * * 0', '2026-10-25T05:17:00.000Z'],
 ['CRON_TZ=Asia/Jerusalem 7 13 * * 5', '2026-10-23T10:07:00.000Z']].forEach(([c, want]) => {
  const got = lib.cronNext(c, now);
  check('cron ' + c, got === want, got);
});
// Israel leaves summer time on 25/10/2026: 08:11 local is 06:11 UTC after it, not 05:11
check('cron across the end of summer time', lib.cronNext('CRON_TZ=Asia/Jerusalem 11 8 * * 0-4', Date.parse('2026-10-24T22:00:00Z')) === '2026-10-25T06:11:00.000Z',
  lib.cronNext('CRON_TZ=Asia/Jerusalem 11 8 * * 0-4', Date.parse('2026-10-24T22:00:00Z')));
check('a bad cron gives no next run', lib.cronNext('every day', now) === null);
check('a past next_run without cron is not "next"', lib.upcoming({ next_run: '2026-10-18T09:13:00Z' }) === null);
check('a future next_run without cron stays', lib.upcoming({ next_run: '2099-01-01T00:00:00Z' }) === '2099-01-01T00:00:00Z');
check('cron wins over a stale next_run', lib.upcoming({ cron: '19 * * * *', next_run: '2026-10-18T05:19:00Z' }) !== '2026-10-18T05:19:00Z');
check('a reply updated in place is new again', lib.seenKey({ id: 'reply-x', text: 'קיבלתי' }) !== lib.seenKey({ id: 'reply-x', text: 'קיבלתי. התשובה המלאה' }));
check('chat order by time, with or without milliseconds', lib.tms('2026-10-18T16:19:30Z') < lib.tms('2026-10-18T16:19:30.500Z'));
// Run now (18/10/2026): the page writes a chat row with run = the trigger id, and the operations manager fires it
const relay = fs.readFileSync(path.join(__dirname, '../../project-files/routine-chat-relay.md'), 'utf8');
check('Run now writes a chat row with the trigger id', /run:a\.id/.test(js) && /status:'new'/.test(js));
check('the relay fires only a trigger that has a desk', /2א\. \*\*"רוץ עכשיו"\*\*/.test(relay) && /agents\/<run>/.test(relay) && /fire_trigger/.test(relay));
console.log('\noffice-page-test: ' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
