// The "Claude Log" for writes outside the hazard file (02/11/2026, STATUS "od_put_pdf writes are not in the Claude Log";
// CLAUDE.md rule 9: every write in Microsoft 365 is logged there). Only hazard-file.js can write the sheet (it is a sheet
// in the hazard workbook, patched when the file is rewritten). So routine-db queues one line per successful write op in
// server_state CLAUDE_LOG_Q, and each hazard file (xlsm and its xlsx twin) appends the lines it has not taken yet on its
// next run (every 15 minutes), remembering the last id it took in hazard_<file>_logq.
// All pure here; the reads and writes stay in routine-db.js and hazard-file.js.

export const CLAUDE_LOG_Q = 'claude_log_q';
export const LOG_Q_MAX = 200;      // lines kept in the queue
export const LOG_Q_DAYS = 30;      // a line older than this is dropped even if a file never took it
export const LOG_RUN_MAX = 40;     // lines one file run appends; the rest on the next run

// The write ops of /api/routine-db and the action column of the sheet (Hebrew, as \u escapes).
export const LOG_OPS = {
  od_put_pdf: '\u05e9\u05de\u05d9\u05e8\u05ea \u05e7\u05d5\u05d1\u05e5 \u05d1-OneDrive',
  od_pdf: '\u05d4\u05de\u05e8\u05ea Word \u05dc-PDF \u05d1-OneDrive',
  od_pull: '\u05d4\u05e2\u05ea\u05e7\u05ea \u05e7\u05d5\u05d1\u05e5 \u05dc\u05ea\u05d9\u05e7\u05d9\u05d9\u05ea \u05d4\u05d1\u05d8\u05d9\u05d7\u05d5\u05ea',
  od_mkdir: '\u05d9\u05e6\u05d9\u05e8\u05ea \u05ea\u05d9\u05e7\u05d9\u05d9\u05d4 \u05d1-OneDrive',
  od_move: '\u05d4\u05e2\u05d1\u05e8\u05ea \u05e7\u05d5\u05d1\u05e5 \u05d1-OneDrive',
  od_archive: '\u05d2\u05e8\u05e1\u05d4 \u05e7\u05d5\u05d3\u05de\u05ea \u05dc\u05d0\u05e8\u05db\u05d9\u05d5\u05df',
  od_expire: '\u05ea\u05e1\u05e7\u05d9\u05e8 \u05e7\u05d5\u05d3\u05dd \u05dc"\u05e4\u05d2 \u05ea\u05d5\u05e7\u05e3"',
  od_trash: '\u05e7\u05d5\u05d1\u05e5 \u05dc\u05ea\u05d9\u05e7\u05d9\u05d9\u05ea "\u05dc\u05de\u05d7\u05d9\u05e7\u05d4"',
  od_dedupe: '\u05db\u05e4\u05d9\u05dc\u05d5\u05ea \u05dc\u05e1\u05dc \u05d4\u05de\u05d9\u05d7\u05d6\u05d5\u05e8',
  od_swap: '\u05d4\u05d7\u05dc\u05e4\u05ea \u05de\u05e1\u05de\u05da ISO',
  iso_up: '\u05e2\u05d3\u05db\u05d5\u05df \u05de\u05e1\u05de\u05da ISO',
  mail_draft: '\u05d8\u05d9\u05d5\u05d8\u05ea \u05de\u05d9\u05d9\u05dc \u05d1-Outlook',
  ocr_txt: '\u05db\u05ea\u05d9\u05d1\u05ea \u05d8\u05e7\u05e1\u05d8 \u05e1\u05e8\u05d9\u05e7\u05d4 \u05d1-OneDrive',
  mail_request: '\u05d1\u05e7\u05e9\u05ea \u05e7\u05d1\u05e6\u05d9\u05dd \u05de\u05de\u05d9\u05d9\u05dc \u05dc-OneDrive',
  cal_move: '\u05d4\u05d6\u05d6\u05ea \u05d0\u05d9\u05e8\u05d5\u05e2 \u05d1\u05d9\u05d5\u05de\u05df',
  cal_invite: '\u05d4\u05d6\u05de\u05e0\u05d4 \u05dc\u05d9\u05d5\u05de\u05df',
  draft_trash: '\u05d8\u05d9\u05d5\u05d8\u05d4 \u05dc\u05e1\u05dc \u05d4\u05de\u05d9\u05d7\u05d6\u05d5\u05e8',
  mail_forward: '\u05d8\u05d9\u05d5\u05d8\u05ea \u05d4\u05e2\u05d1\u05e8\u05d4 \u05e2\u05dd \u05db\u05dc \u05d4\u05e7\u05d1\u05e6\u05d9\u05dd \u05d1-Outlook',
  mail_bundle: '\u05d8\u05d9\u05d5\u05d8\u05d4 \u05e2\u05dd \u05e7\u05d1\u05e6\u05d9\u05dd \u05de\u05db\u05de\u05d4 \u05de\u05d9\u05d9\u05dc\u05d9\u05dd \u05d1-Outlook',
  // retro 26/11/2026 (1): the works ops send real mail (sendMailTo) and works_permit also files a PDF in OneDrive
  works_try_mail: '\u05de\u05d9\u05d9\u05dc \u05e0\u05d9\u05e1\u05d9\u05d5\u05df \u05e9\u05dc \u05e7\u05d9\u05e9\u05d5\u05e8 \u05d4\u05e2\u05d1\u05d5\u05d3\u05d5\u05ea \u05d4\u05e9\u05d1\u05d5\u05e2\u05d9',
  works_mail_now: '\u05e7\u05d9\u05e9\u05d5\u05e8 \u05d4\u05e2\u05d1\u05d5\u05d3\u05d5\u05ea \u05d4\u05e9\u05d1\u05d5\u05e2\u05d9 \u05dc\u05d0\u05d7\u05d6\u05e7\u05d4 \u05d1\u05de\u05d9\u05d9\u05dc',
  works_approve_mail: '\u05de\u05d9\u05d9\u05dc \u05d0\u05d9\u05e9\u05d5\u05e8 \u05e2\u05d1\u05d5\u05d3\u05d5\u05ea \u05e9\u05de\u05de\u05ea\u05d9\u05e0\u05d5\u05ea',
  works_permit: '\u05d4\u05d9\u05ea\u05e8 \u05e2\u05d1\u05d5\u05d3\u05d4 \u05d7\u05ea\u05d5\u05dd: \u05e7\u05d5\u05d1\u05e5 \u05d1-OneDrive \u05d5\u05de\u05d9\u05d9\u05dc',
  // found by the reverse check (27/11/2026): writes made inside a helper (signRun, refileInduction, ctrExtend, formProbe)
  sign_now: '\u05d7\u05ea\u05d9\u05de\u05d4 \u05d1\u05e9\u05dd \u05de\u05d9\u05db\u05d0\u05dc \u05e2\u05dc \u05e7\u05d5\u05d1\u05e5 \u05d1-OneDrive',
  ind_refile: '\u05d8\u05d5\u05e4\u05e1 \u05d4\u05d3\u05e8\u05db\u05ea \u05e7\u05dc\u05d9\u05d8\u05d4 \u05d1\u05de\u05d9\u05d9\u05dc \u05e9\u05d5\u05d1, \u05dc\u05de\u05d9\u05db\u05d0\u05dc \u05d5\u05dc-HR',
  ctr_extend: '\u05d4\u05d0\u05e8\u05db\u05ea \u05d4\u05d9\u05ea\u05e8 \u05e7\u05d1\u05dc\u05df \u05d5\u05de\u05d9\u05d9\u05dc \u05dc\u05de\u05d9\u05db\u05d0\u05dc',
  form_probe: '\u05e7\u05d5\u05d1\u05e5 \u05d1\u05d3\u05d9\u05e7\u05ea \u05d8\u05d5\u05e4\u05e1 146.03 \u05d1-OneDrive',
};
// The ops whose request says almost nothing ({} or {id}): the line takes its details from the answer (answerRow).
export const ANSWER_OPS = ['works_try_mail', 'works_mail_now', 'works_approve_mail', 'works_permit', 'sign_now', 'ind_refile', 'ctr_extend', 'form_probe'];

const short = (t, n) => { t = String(t == null ? '' : t).replace(/\s+/g, ' ').trim(); return t.length > n ? t.substring(0, n - 3) + '...' : t; };
const ilWhen = (iso) => {
  const p = {};
  new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Jerusalem', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
    .formatToParts(new Date(iso)).forEach((x) => { p[x.type] = x.value; });
  return p.day + '/' + p.month + '/' + p.year + ' ' + p.hour + ':' + p.minute;
};

// What the line says about the target: the fields a write op carries, in a fixed order, never the file bytes.
const DETAIL_FIELDS = ['dir', 'name', 'path', 'from', 'to', 'move_to', 'replaced_by', 'keep', 'subject', 'subjects', 'kind', 'paths', 'message_id'];
export function logDetails(body) {
  const out = [];
  DETAIL_FIELDS.forEach((k) => {
    let v = body[k];
    if (v == null || v === '') return;
    if (Array.isArray(v)) v = v.join(', ');
    if (typeof v !== 'string') return;
    out.push(k + ': ' + short(v, 120));
  });
  if (Array.isArray(body.attach) && body.attach.length) out.push('attach: ' + body.attach.length);
  return short(out.join('; '), 400);
}

// One sheet line for a successful write op, or null for any other op: [when, source, action, details, outcome].
export function logLine(body, nowIso) {
  if (!body || !LOG_OPS[body.op]) return null;
  const src = short((body.agent || '?') + (body.why ? ': ' + body.why : ''), 200);
  return [ilWhen(nowIso), src, LOG_OPS[body.op], logDetails(body) || body.op, '\u05d1\u05d5\u05e6\u05e2'];
}

// retro 02/11/2026 (d): ocr_txt answers ok only when every file was read, so the txt files it did write on a partial run
// were missing from the sheet. Such a run gets its own line: only the written files, outcome "done in part: N/M".
export function ocrPartialRow(row, out) {
  if (!row || !out || !Array.isArray(out.files)) return null;
  const done = out.files.filter((f) => f && f.ok && f.txt);
  if (!done.length) return null;
  return [row[0], row[1], row[2], short('txt: ' + done.map((f) => f.txt).join(', '), 400), '\u05d1\u05d5\u05e6\u05e2 \u05d7\u05dc\u05e7\u05d9\u05ea: ' + done.length + '/' + out.files.length];
}

// retro 26/11/2026 (1): these ops carry almost nothing in the request ({} or {id}), so the line takes its details from
// the answer: the Friday, who got the mail, the file written, the new end date. Nothing sent (approve mail with n: 0) =
// no line; a file filed or a permit extended whose mail failed = "done in part". Recipients are only the addresses the
// server sent to; never a link (a OneDrive url, a token) or the file bytes.
export function answerRow(row, body, out) {
  if (!row || !body || ANSWER_OPS.indexOf(body.op) < 0 || !out || out.ok !== true) return row;
  if (body.op === 'works_approve_mail' && !out.n) return null;
  const list = (v) => (Array.isArray(v) ? v.join(', ') : typeof v === 'string' ? v : '');
  const m = out.mailed && typeof out.mailed === 'object' ? out.mailed : null;
  const d = [];
  const id = body.id || (body.op === 'sign_now' ? out.id : '');
  if (id) d.push('id: ' + short(id, 40) + (body.closed === true ? ' (closed)' : ''));
  if (out.friday) d.push('friday: ' + short(out.friday, 12));
  if (out.n) d.push('works: ' + out.n);
  if (body.op === 'ctr_extend' && out.until) d.push('until: ' + short(out.until, 12) + (out.te ? ' ' + short(out.te, 5) : ''));
  const to = list(m ? m.to : out.to), cc = list(m ? m.cc : out.cc);
  if (to) d.push('to: ' + short(to, 160));
  if (cc) d.push('cc: ' + short(cc, 120));
  if (m && m.trial) d.push('trial');
  if (typeof out.path === 'string' && out.path) d.push('path: ' + short(out.path, 160));
  else if (body.op === 'sign_now' && body.path) d.push('path: ' + short(body.path, 160));
  if (body.op === 'ind_refile' && typeof out.docs === 'number') d.push('docs: ' + out.docs);
  if (body.op === 'form_probe' && Array.isArray(out.fails)) d.push('fails: ' + out.fails.length);
  const r = row.slice();
  r[3] = short(d.join('; '), 400) || r[3];
  const mailFailed = (m && m.error) || (body.op === 'ctr_extend' && typeof out.mail === 'string' && out.mail !== 'sent');
  if (mailFailed) r[4] = '\u05d1\u05d5\u05e6\u05e2 \u05d7\u05dc\u05e7\u05d9\u05ea: \u05d4\u05de\u05d9\u05d9\u05dc \u05dc\u05d0 \u05e0\u05e9\u05dc\u05d7';
  return r;
}

const parse = (raw) => { try { const v = JSON.parse(raw || '[]'); return Array.isArray(v) ? v : []; } catch (e) { return []; } };

// The queue after adding a line: ids are the time plus a counter, so they sort; old and surplus lines drop.
export function queueAdd(raw, row, nowIso) {
  const q = parse(raw), t0 = Date.parse(nowIso) - LOG_Q_DAYS * 86400000;
  let id = nowIso, n = 0;
  while (q.some((x) => x.id === id)) id = nowIso + '#' + String(++n).padStart(3, '0');
  q.push({ id, row });
  return JSON.stringify(q.filter((x) => x && x.id && Date.parse(x.id.substring(0, 24)) >= t0).slice(-LOG_Q_MAX));
}

// The lines a file has not taken yet (id after `seen`), oldest first, at most LOG_RUN_MAX; `last` = the id to remember.
export function queuePending(raw, seen) {
  const all = parse(raw).filter((x) => x && x.id && Array.isArray(x.row) && (!seen || x.id > seen)).sort((a, b) => (a.id < b.id ? -1 : 1));
  const take = all.slice(0, LOG_RUN_MAX);
  return { rows: take.map((x) => x.row), last: take.length ? take[take.length - 1].id : seen || '', more: all.length - take.length };
}
