// Claude Log for routine-db writes (02/11/2026, functions/_claudelog.js): a successful write op queues one line, each
// hazard file takes the lines it has not taken yet, and nothing else (a read op, the file bytes) reaches the sheet.
import { logLine, logDetails, queueAdd, queuePending, LOG_OPS, LOG_Q_MAX, LOG_RUN_MAX } from './_build/_claudelog.mjs';
import fs from 'node:fs';
let pass = 0, fail = 0;
const check = (l, c, d) => { if (c) { pass++; console.log('  ✓ ' + l); } else { fail++; console.log('  ✗ ' + l + (d !== undefined ? '  -> ' + JSON.stringify(d) : '')); } };
const NOW = '2026-11-01T23:10:00.000Z';

{ // a write op: five columns, Israel time, the target, never the bytes
  const row = logLine({ op: 'od_put_pdf', agent: 'routine-wa-assistant', why: 'form 08.01', dir: 'a/b', name: 'x.pdf', b64: 'QUJD'.repeat(500) }, NOW);
  check('a write op gives a line of five columns', Array.isArray(row) && row.length === 5, row);
  check('the time is Israel time, DD/MM/YYYY HH:MM', row && row[0] === '02/11/2026 01:10', row && row[0]);
  check('the source names the agent and the reason', row && row[1] === 'routine-wa-assistant: form 08.01');
  check('the details name the folder and the file', row && row[3] === 'dir: a/b; name: x.pdf', row && row[3]);
  check('the file bytes never reach the line', row && row.join('|').indexOf('QUJD') < 0);
}
{ // not a write op: nothing
  check('a read op gives no line', logLine({ op: 'select', table: 'docs' }, NOW) === null);
  check('no op gives no line', logLine({}, NOW) === null && logLine(null, NOW) === null);
  check('every write op in routine-db is a known op name', Object.keys(LOG_OPS).every((op) => fs.readFileSync(new URL('../../functions/api/routine-db.js', import.meta.url), 'utf8').indexOf("body.op === '" + op + "'") >= 0));
}
{ // details: a list joined, attachments counted, long values cut
  const d = logDetails({ to: ['a@x', 'b@x'], subject: 's'.repeat(300), attach: ['p1', 'p2'] });
  check('a list of recipients is joined', d.indexOf('to: a@x, b@x') === 0, d);
  check('attachments are counted, not listed', /attach: 2$/.test(d), d);
  check('a long value is cut', d.length <= 400);
}
{ // the queue: add, take per file, nothing taken twice, old and surplus dropped
  let q = '';
  q = queueAdd(q, ['l1'], NOW);
  q = queueAdd(q, ['l2'], NOW); // same millisecond: a distinct id that sorts after
  q = queueAdd(q, ['l3'], '2026-11-01T23:11:00.000Z');
  const a = queuePending(q, '');
  check('a file that took nothing gets all lines, oldest first', JSON.stringify(a.rows) === JSON.stringify([['l1'], ['l2'], ['l3']]), a.rows);
  const b = queuePending(q, a.last);
  check('after taking them, nothing is pending', b.rows.length === 0 && b.last === a.last);
  q = queueAdd(q, ['l4'], '2026-11-01T23:12:00.000Z');
  const c = queuePending(q, a.last);
  check('a new line is pending for a file that took the earlier ones', JSON.stringify(c.rows) === JSON.stringify([['l4']]), c.rows);
  check('the twin file still gets all four', queuePending(q, '').rows.length === 4);
  const old = queueAdd(q, ['new'], '2026-12-15T00:00:00.000Z');
  check('lines older than 30 days drop', JSON.parse(old).length === 1);
  let big = '';
  for (let i = 0; i < LOG_Q_MAX + 5; i++) big = queueAdd(big, ['r' + i], new Date(Date.parse(NOW) + i * 1000).toISOString());
  check('the queue keeps at most LOG_Q_MAX lines', JSON.parse(big).length === LOG_Q_MAX);
  const p = queuePending(big, '');
  check('one run takes at most LOG_RUN_MAX, and says how many wait', p.rows.length === LOG_RUN_MAX && p.more === LOG_Q_MAX - LOG_RUN_MAX);
  check('a broken queue value is read as empty', queuePending('{oops', '').rows.length === 0 && JSON.parse(queueAdd('{oops', ['x'], NOW)).length === 1);
}
{ // the wiring: routine-db queues after a successful answer, hazard-file appends and remembers
  const rdb = fs.readFileSync(new URL('../../functions/api/routine-db.js', import.meta.url), 'utf8');
  check('routine-db queues only after ok:true', /out && out\.ok === true/.test(rdb) && /stateCas\(url, h, CLAUDE_LOG_Q/.test(rdb));
  const hf = fs.readFileSync(new URL('../../functions/api/hazard-file.js', import.meta.url), 'utf8');
  check('hazard-file rewrites when lines are pending', (hf.match(/!logq\.rows\.length/g) || []).length === 2);
  check('hazard-file appends the lines to the Claude Log sheet', /rows: logq\.rows\.concat/.test(hf));
  check('hazard-file remembers the last line it took, only after the write', /\[K \+ 'logq'\]: logq\.last/.test(hf));
}
console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
