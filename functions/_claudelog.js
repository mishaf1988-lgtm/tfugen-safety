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
  draft_trash: '\u05d8\u05d9\u05d5\u05d8\u05d4 \u05dc\u05e1\u05dc \u05d4\u05de\u05d9\u05d7\u05d6\u05d5\u05e8',
};

const short = (t, n) => { t = String(t == null ? '' : t).replace(/\s+/g, ' ').trim(); return t.length > n ? t.substring(0, n - 3) + '...' : t; };
const ilWhen = (iso) => {
  const p = {};
  new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Jerusalem', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
    .formatToParts(new Date(iso)).forEach((x) => { p[x.type] = x.value; });
  return p.day + '/' + p.month + '/' + p.year + ' ' + p.hour + ':' + p.minute;
};

// What the line says about the target: the fields a write op carries, in a fixed order, never the file bytes.
const DETAIL_FIELDS = ['dir', 'name', 'path', 'from', 'to', 'move_to', 'replaced_by', 'keep', 'subject', 'kind'];
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
