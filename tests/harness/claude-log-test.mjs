// Claude Log for routine-db writes (02/11/2026, functions/_claudelog.js): a successful write op queues one line, each
// hazard file takes the lines it has not taken yet, and nothing else (a read op, the file bytes) reaches the sheet.
import { logLine, logDetails, queueAdd, queuePending, ocrPartialRow, answerRow, LOG_OPS, LOG_Q_MAX, LOG_RUN_MAX } from './_build/_claudelog.mjs';
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
  check('mail_bundle writes a draft with files to Outlook, so it is logged like mail_forward (retro 26/11/2026)', logLine({ op: 'mail_bundle', agent: 'x', subjects: ['s1', 's2'] }, '2026-11-26T06:00:00Z') !== null);
  check('an unchecked mail_bundle (403, flow 12) is not logged as done, like an unchecked mail_forward (retro 26/11/2026)', /subject_checked === 'flow 12'\) \) row\[4\]|subject_checked === 'flow 12'\)\) row\[4\]/.test(fs.readFileSync(new URL('../../functions/api/routine-db.js', import.meta.url), 'utf8')));
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
{ // retro 26/11/2026 (1): the reverse check. Every op block of routine-db that sends mail (sendMailTo), writes a file
  // (putFile) or writes through Graph (PUT/POST/PATCH/DELETE to graph.microsoft.com) is in LOG_OPS, or in EXEMPT with why.
  const rdb = fs.readFileSync(new URL('../../functions/api/routine-db.js', import.meta.url), 'utf8');
  const EXEMPT = {
    // op: one-line reason. Empty on 27/11/2026: the first run found 8 ops, all real writes, so all 8 went into LOG_OPS
  };
  const heads = [];
  const re = /^[ \t]*if \((body\.op === '\w+'(?: \|\| body\.op === '\w+')*)/gm;
  let m;
  while ((m = re.exec(rdb))) heads.push({ at: m.index, ops: [...m[1].matchAll(/'(\w+)'/g)].map((x) => x[1]) });
  // a Graph call: the URL in the call, or a base built from it (G, GM, D), or the Graph token / headers (at.token, gh)
  const graphWrite = (b) => b.split(/\bfetch\(/).slice(1).some((c) => {
    const s = c.indexOf('signal:'), call = c.substring(0, s >= 0 && s < 1500 ? s : 1500);
    return /method:\s*'(PUT|POST|PATCH|DELETE)'/.test(call) && /graph\.microsoft\.com|^\s*(G|GM|D|G2)\s*\+|\.token\b|headers:\s*gh\b/.test(call);
  });
  // helpers that mail or write in Microsoft 365 themselves (found 27/11/2026 by reading each import of routine-db):
  // _sign.js signRun (signed PDF), talk.js refileInduction (mail to Michael and HR), _ctrok.js ctrExtend (mail),
  // _formprobe.js formProbe (putFile), _ocr.js ocrOne (txt file), works.js (mail through the sendMailTo it is handed)
  const WRITE_HELPERS = /\b(signRun|refileInduction|ctrExtend|formProbe|ocrOne)\(/;
  const missing = [], flagged = {};
  heads.forEach((hd, i) => {
    let end = i + 1 < heads.length ? heads[i + 1].at : rdb.length;
    const close = rdb.indexOf('\n}\n', hd.at);
    if (close > 0 && close < end) end = close;
    const b = rdb.substring(hd.at, end);
    const why = [];
    if (/\bsendMailTo\b/.test(b)) why.push('sendMailTo');
    if (/\bputFile\(/.test(b)) why.push('putFile');
    if (graphWrite(b)) why.push('graph write');
    const hw = b.match(WRITE_HELPERS);
    if (hw) why.push(hw[1] + ' (writes inside)');
    if (why.length) hd.ops.forEach((op) => { flagged[op] = why.join(', '); if (!LOG_OPS[op] && !EXEMPT[op]) missing.push(op + ' (' + why.join(', ') + ')'); });
  });
  check('routine-db has op blocks to check', heads.length > 50, heads.length);
  check('the check sees the known writes: works mail (sendMailTo), mail_draft (putFile), od_put_pdf and od_move (Graph)', ['works_try_mail', 'works_mail_now', 'works_approve_mail', 'works_permit', 'mail_draft', 'od_put_pdf', 'od_move'].every((op) => flagged[op]), flagged);
  check('the check sees writes made inside a helper: sign_now, ind_refile, ctr_extend, form_probe', ['sign_now', 'ind_refile', 'ctr_extend', 'form_probe'].every((op) => flagged[op]), flagged);
  check('every logged op is seen as a write by the check (the detector misses none of LOG_OPS)', Object.keys(LOG_OPS).every((op) => flagged[op]), Object.keys(LOG_OPS).filter((op) => !flagged[op]));
  if (process.env.SHOW_FLAGGED) console.log(JSON.stringify(flagged, null, 1));
  check('every routine-db op that mails or writes in Microsoft 365 is in LOG_OPS or EXEMPT with a reason', missing.length === 0, missing);
  check('every EXEMPT op is a real op and has a reason', Object.keys(EXEMPT).every((op) => rdb.indexOf("body.op === '" + op + "'") >= 0 && String(EXEMPT[op]).length > 10 && !LOG_OPS[op]));
}
{ // retro 26/11/2026 (1): the works mails, the signature, the induction resend, the permit extension: details from the answer
  const L = (op, body) => logLine(Object.assign({ op, agent: 'x' }, body || {}), '2026-11-27T08:00:00Z');
  const rdb = fs.readFileSync(new URL('../../functions/api/routine-db.js', import.meta.url), 'utf8');
  check('routine-db builds the line through answerRow after ok:true', /\(body && answerRow\(row0, reqBody, out\)\)/.test(rdb));
  const t = answerRow(L('works_try_mail'), { op: 'works_try_mail' }, { ok: true, friday: '2026-11-27', to: ['m@x'] });
  check('works_try_mail: the Friday and the mailbox', t && t[3] === 'friday: 2026-11-27; to: m@x' && t[4] === '\u05d1\u05d5\u05e6\u05e2', t);
  const n = answerRow(L('works_mail_now'), { op: 'works_mail_now' }, { ok: true, friday: '2026-11-27', to: ['a@x', 'b@x'], cc: ['c@x'] });
  check('works_mail_now: the maintenance list and the copy', n && n[3] === 'friday: 2026-11-27; to: a@x, b@x; cc: c@x', n);
  check('works_approve_mail with nothing pending (n: 0) sends nothing, so no line', answerRow(L('works_approve_mail'), { op: 'works_approve_mail' }, { ok: true, friday: '2026-11-27', n: 0 }) === null);
  const a = answerRow(L('works_approve_mail'), { op: 'works_approve_mail' }, { ok: true, friday: '2026-11-27', n: 2, to: 'm@x' });
  check('works_approve_mail: how many works and to whom', a && a[3] === 'friday: 2026-11-27; works: 2; to: m@x', a);
  const p = answerRow(L('works_permit', { id: 'wk-2026-11-27-1' }), { op: 'works_permit', id: 'wk-2026-11-27-1' }, { ok: true, path: '18_x/02_y/2026-11/p.pdf', mailed: { to: ['m@x'], cc: [], trial: true } });
  check('works_permit: the work, the mailbox, trial, the file', p && p[3] === 'id: wk-2026-11-27-1; to: m@x; trial; path: 18_x/02_y/2026-11/p.pdf', p);
  const pf = answerRow(L('works_permit', { id: 'wk-2026-11-27-1' }), { op: 'works_permit', id: 'wk-2026-11-27-1' }, { ok: true, path: 'a/p.pdf', mailed: { error: 'graph 503' } });
  check('works_permit filed but the mail failed: "done in part", not "done"', pf && pf[4] === '\u05d1\u05d5\u05e6\u05e2 \u05d7\u05dc\u05e7\u05d9\u05ea: \u05d4\u05de\u05d9\u05d9\u05dc \u05dc\u05d0 \u05e0\u05e9\u05dc\u05d7', pf);
  const c = answerRow(L('ctr_extend', { id: 'c1234567' }), { op: 'ctr_extend', id: 'c1234567' }, { ok: true, until: '2026-11-28', te: '16:00', mail: 'err: no mailbox' });
  check('ctr_extend: the new end, and a failed mail is "done in part"', c && c[3] === 'id: c1234567; until: 2026-11-28 16:00' && /\u05d7\u05dc\u05e7\u05d9\u05ea/.test(c[4]), c);
  const s = answerRow(L('sign_now', { path: 'a/b.pdf' }), { op: 'sign_now', path: 'a/b.pdf' }, { ok: true, id: 'sg1', path: 'a/b - signed.pdf', signed: 'b - signed.pdf' });
  check('sign_now: the request and the signed file', s && s[3] === 'id: sg1; path: a/b - signed.pdf', s);
  const r = answerRow(L('ind_refile', { id: 'abc123' }), { op: 'ind_refile', id: 'abc123' }, { ok: true, url: 'https://x/secret', mailed: true, docs: 2 });
  check('ind_refile: the read and the documents, never the link', r && r[3] === 'id: abc123; docs: 2' && r.join('|').indexOf('secret') < 0, r);
  check('a failed answer or another op is left as logLine made it', answerRow(['a', 'b', 'c', 'd', 'e'], { op: 'mail_draft' }, { ok: true, to: 'z' })[3] === 'd' && answerRow(null, { op: 'works_try_mail' }, { ok: true }) === null);
}
console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
