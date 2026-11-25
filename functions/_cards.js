// Built by tools/action-cards.py --write from project-files/action-cards.md (25/11/2026). Do not edit.
// cardsFor(body): the action cards for one routine-db request, returned to the assistant in `cards`.
export const CARDS = [
 {
  "id": "oxana-review",
  "when": {
   "op": "mail_draft",
   "to": "oxana@"
  },
  "text": "\u05dc\u05d0\u05d5\u05e7\u05e1\u05e0\u05d4 \u05e0\u05e9\u05dc\u05d7 \u05e8\u05e7 \u05e7\u05d5\u05d1\u05e5 \u05d4\u05e1\u05e7\u05d9\u05e8\u05d4, \u05d1\u05e4\u05d5\u05e8\u05de\u05d8 \u05e9\u05dc \u05d4\u05d8\u05d5\u05e4\u05e1 \u05d4\u05de\u05e7\u05d5\u05e8\u05d9 (Word \u05e0\u05e9\u05d0\u05e8 Word, Excel \u05e0\u05e9\u05d0\u05e8 Excel) \u05e2\u05dd \u05de\u05e2\u05e7\u05d1 \u05e9\u05d9\u05e0\u05d5\u05d9\u05d9\u05dd (`track_docx.py` / `track_xlsx.py`), \u05d1\u05e9\u05dd `<\u05e9\u05dd>_<\u05de\u05e1\u05e4\u05e8>_\u05e1\u05e7\u05d9\u05e8\u05d4- DD.MM.YY`. \u05dc\u05d0 PDF \u05d5\u05dc\u05d0 \u05d8\u05d5\u05e4\u05e1 02.03 (\u05d0\u05d5\u05ea\u05d5 \u05d4\u05d9\u05d0 \u05de\u05e2\u05d3\u05db\u05e0\u05ea \u05dc\u05d1\u05d3).",
  "src": "DECISIONS 25/11/2026 \"\u05dc\u05d0\u05d5\u05e7\u05e1\u05e0\u05d4 \u05e0\u05e9\u05dc\u05d7 \u05e7\u05d5\u05d1\u05e5 \u05d4\u05e1\u05e7\u05d9\u05e8\u05d4\""
 },
 {
  "id": "draft-check",
  "when": {
   "op": "mail_draft"
  },
  "text": "\u05d8\u05d9\u05d5\u05d8\u05d4: `reply_to` \u05e9\u05dc \u05d4\u05de\u05d9\u05d9\u05dc \u05d4\u05d0\u05de\u05d9\u05ea\u05d9 \u05d4\u05d0\u05d7\u05e8\u05d5\u05df \u05d1\u05e9\u05e8\u05e9\u05d5\u05e8, Sent Items \u05e7\u05d5\u05d3\u05dd, \u05e7\u05d5\u05d1\u05e5 \u05e9\u05de\u05d5\u05d6\u05db\u05e8 \u05e0\u05de\u05e6\u05d0 \u05d1-`attach`. \"\u05d4\u05db\u05e0\u05ea\u05d9 \u05d8\u05d9\u05d5\u05d8\u05d4\" \u05e8\u05e7 \u05d0\u05d7\u05e8\u05d9 \u05d7\u05d9\u05e4\u05d5\u05e9 \u05d1-Drafts \u05e9\u05de\u05e8\u05d0\u05d4 \u05d0\u05d5\u05ea\u05d4.",
  "src": "`domains/mail.md` 1-6"
 },
 {
  "id": "form-index",
  "when": {
   "op": "od_put_pdf|od_archive|od_pdf",
   "file": "\\d{2}\\.\\d{2}"
  },
  "text": "\u05d8\u05d5\u05e4\u05e1 \u05de\u05d1\u05d5\u05e7\u05e8 \u05e0\u05e9\u05de\u05e8 \u05d0\u05d5 \u05d4\u05d5\u05d7\u05dc\u05e3: \u05e9\u05d5\u05e8\u05d4 \u05d1-`project-files/iso-forms-index.md` \u05d1\u05d0\u05d5\u05ea\u05d4 \u05de\u05e9\u05d9\u05de\u05d4 (\u05de\u05e1\u05e4\u05e8, \u05e9\u05dd, \u05d0\u05d9\u05e4\u05d4 \u05db\u05dc \u05e7\u05d5\u05d1\u05e5: \u05e0\u05e7\u05d9, PDF, \u05e1\u05e7\u05d9\u05e8\u05d4, \u05d2\u05e8\u05e1\u05d4 \u05e7\u05d5\u05d3\u05de\u05ea).",
  "src": "DECISIONS 25/11/2026, `domains/iso.md` 8"
 },
 {
  "id": "form-build",
  "when": {
   "op": "od_put_pdf",
   "file": "\\d{2}\\.\\d{2}"
  },
  "text": "\u05d8\u05d5\u05e4\u05e1 \u05de\u05d1\u05d5\u05e7\u05e8: \u05de\u05ea\u05d7\u05d9\u05dc\u05d9\u05dd \u05de\u05d4-Word \u05d4\u05de\u05e7\u05d5\u05e8\u05d9 (`form-fill.py`), Word \u05d5\u05d2\u05dd PDF \u05d1\u05d0\u05d5\u05ea\u05d5 \u05e9\u05dd, PDF \u05e8\u05e7 \u05d1-`od_pdf`, \u05d5\u05d1\u05d3\u05d9\u05e7\u05d4 \u05d5\u05d9\u05d6\u05d5\u05d0\u05dc\u05d9\u05ea \u05e9\u05dc \u05d4-PDF \u05dc\u05e4\u05e0\u05d9 \u05e9\u05dc\u05d9\u05d7\u05d4. \u05e9\u05d9\u05e0\u05d5\u05d9 \u05d1\u05d8\u05d5\u05e4\u05e1 \u05e7\u05d9\u05d9\u05dd = \u05d2\u05dd \u05e7\u05d5\u05d1\u05e5 \u05e1\u05e7\u05d9\u05e8\u05d4 \u05e2\u05dd \u05de\u05e2\u05e7\u05d1 \u05e9\u05d9\u05e0\u05d5\u05d9\u05d9\u05dd.",
  "src": "`domains/iso.md` 2-6, DECISIONS 24/10/2026"
 },
 {
  "id": "xlsx-save",
  "when": {
   "op": "od_put_pdf",
   "file": "\\.xlsx"
  },
  "text": "Excel: `xlsx-print.py` \u05dc\u05e4\u05e0\u05d9 \u05d4\u05e2\u05dc\u05d0\u05d4; \u05ea\u05d0\u05e8\u05d9\u05da \u05d1\u05ea\u05d0 \u05d1\u05e4\u05d5\u05e8\u05de\u05d8 DD/MM/YYYY (\u05dc\u05d0 m/d/yyyy); \u05e9\u05d9\u05e0\u05d5\u05d9 \u05d1\u05e7\u05d5\u05d1\u05e5 \u05e7\u05d9\u05d9\u05dd = `track_xlsx.py`, \u05d1\u05e7\u05d5\u05d1\u05e5 \u05d4\u05de\u05e7\u05d5\u05e8\u05d9 \u05d5\u05dc\u05d0 \u05d1\u05e7\u05d5\u05d1\u05e5 \u05d7\u05d3\u05e9.",
  "src": "25/11/2026 (\u05ea\u05d0\u05e8\u05d9\u05db\u05d9\u05dd \u05d1\u05e4\u05d5\u05e8\u05de\u05d8 \u05d0\u05de\u05e8\u05d9\u05e7\u05d0\u05d9)"
 },
 {
  "id": "archive-name",
  "when": {
   "op": "od_archive"
  },
  "text": "`replaced_by` = \u05e9\u05dd \u05d4\u05e7\u05d5\u05d1\u05e5 \u05d1\u05dc\u05d1\u05d3 (\u05dc\u05d0 \u05e0\u05ea\u05d9\u05d1), \u05e7\u05d5\u05d1\u05e5 \u05e9\u05db\u05d1\u05e8 \u05e0\u05de\u05e6\u05d0 \u05d1\u05d0\u05d5\u05ea\u05d4 \u05ea\u05d9\u05e7\u05d9\u05d9\u05d4.",
  "src": "25/11/2026 (\u05e9\u05d2\u05d9\u05d0\u05ea \u05d4\u05e9\u05e8\u05ea)"
 }
];
export function cardsFor(body) {
  if (!body || typeof body !== 'object') return [];
  const op = String(body.op || '');
  const to = [body.to, body.cc].map((x) => String(x || '')).join(' ');
  const file = [body.name, body.path, body.dir, body.replaced_by, body.old, body.new].map((x) => String(x || '')).concat((body.attach || []).map(String)).join(' ');
  const f = { tool: 'routine-db', op, to, file };
  return CARDS.filter((c) => Object.keys(c.when).length && Object.keys(c.when).every((k) => {
    if (k === 'tool') return false;
    try { return k === 'op' ? new RegExp('^(?:' + c.when[k] + ')$').test(op) : new RegExp(c.when[k], 'i').test(f[k]); } catch (e) { return false; }
  })).map((c) => c.id + ': ' + c.text + ' (' + c.src + ')');
}
