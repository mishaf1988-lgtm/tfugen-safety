// Claude Log for routine-db writes (02/11/2026, functions/_claudelog.js): a successful write op queues one line, each
// hazard file takes the lines it has not taken yet, and nothing else (a read op, the file bytes) reaches the sheet.
import { logLine, logDetails, queueAdd, queuePending, ocrPartialRow, LOG_OPS, LOG_Q_MAX, LOG_RUN_MAX } from './_build/_claudelog.mjs';
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
  check('the log line names the file for ocr_txt (paths) and the mail for mail_request (message_id)', /a\/1\.pdf/.test(logLine({ op: 'ocr_txt', agent: 'x', paths: ['a/1.pdf'] }, '2026-11-02T06:00:00Z')[3]) && /message_id: AAMk/.test(logLine({ op: 'mail_request', agent: 'x', message_id: 'AAMk123' }, '2026-11-02T06:00:00Z')[3]));
  check('the log wrapper looks at the request before it clones a response (a read op is not parsed)', /reqBody = await copy\.json\(\)/.test(fs.readFileSync(new URL('../../functions/api/routine-db.js', import.meta.url), 'utf8')));
  check('the OneDrive and calendar writes are logged too (retro 02/11/2026)', ['ocr_txt', 'mail_request', 'cal_move', 'cal_invite'].every((op) => logLine({ op, agent: 'x' }, '2026-11-02T06:00:00Z') !== null));
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
{ // retro 02/11/2026 (d): a partial ocr_txt run still logs the txt files it wrote
  const row = logLine({ op: 'ocr_txt', agent: 'filer', why: 'scan', paths: ['a.pdf', 'b.pdf'] }, '2026-11-06T10:00:00.000Z');
  const p = ocrPartialRow(row, { ok: false, files: [{ name: 'a.pdf', ok: true, txt: 'OCR/a.txt' }, { name: 'b.pdf', ok: false, error: 'azure 500' }] });
  check('ocr_txt partial: one line with only the written txt and "done in part: 1/2"', p && p[3] === 'txt: OCR/a.txt' && p[4] === '\u05d1\u05d5\u05e6\u05e2 \u05d7\u05dc\u05e7\u05d9\u05ea: 1/2' && p[2] === row[2], p);
  check('ocr_txt partial: nothing written = no line; no files = no line', ocrPartialRow(row, { ok: false, files: [{ name: 'a', ok: false }] }) === null && ocrPartialRow(row, { ok: false, error: 'x' }) === null && ocrPartialRow(null, { files: [{ ok: true, txt: 'x' }] }) === null);
  const rdb0 = fs.readFileSync(new URL('../../functions/api/routine-db.js', import.meta.url), 'utf8');
  check('routine-db logs a partial ocr_txt through ocrPartialRow', /reqBody\.op === 'ocr_txt' \? ocrPartialRow\(row0, out\)/.test(rdb0));
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
