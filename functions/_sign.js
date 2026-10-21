// Michael's signature on a PDF, only after his own "\u05d1\u05e6\u05e2" on WhatsApp (21/10/2026, Michael: "I want you to
// find a signature of mine... and pass it to the assistant, so I ask it to sign in my name", and in the
// questionnaires: "only add the company name too", "do it: a library in the server, now").
//
// The flow: an agent asks with routine-db op sign_request {path}. The request waits in server_state
// (SIGN_KEY) and Michael gets "sign in your name on <file>?" with the buttons \u05d1\u05e6\u05e2 / \u05dc\u05d0 and ref sign:<id>.
// His "1" / "\u05d1\u05e6\u05e2" on that message is caught by wa-hook's fast lane, and only then the server signs:
// it reads the PDF from OneDrive, draws the signature (the private bucket, never in the repo or in an
// agent's chat), the caption and the date, and saves a NEW file "<name> - \u05d7\u05ea\u05d5\u05dd.pdf" beside it
// (conflictBehavior=fail: the original and an earlier signed copy are never replaced). "2" / "\u05dc\u05d0" cancels;
// a request older than SIGN_TTL_MS has expired. The agent itself can never sign.
// pdf-lib 1.17.1 as it is (functions/_pdflib.js, sha256 checked in tests/harness/sign-test.mjs); in the
// server only (DECISIONS: no PDF library in the app page).
import { PDFDocument, StandardFonts, rgb } from './_pdflib.js';
import { SB_TIMEOUT_MS as SB_MS, GRAPH_TIMEOUT_MS as GRAPH_MS, FILE_TIMEOUT_MS as FILE_MS, tmo } from './_shared.js';
import { CAPTION_PNG_B64 } from './_signcaption.js';
import { SITE } from './_site.js';

export const SIGN_KEY = 'sign_requests', SIGN_MAX = 50, SIGN_TTL_MS = 24 * 3600e3;
// The signature image: the bucket "backups" is read only with the service key (and by admin managers in
// the app, migrations/2026-09-21_storage_backups_scope.sql); the nightly copy to OneDrive skips folders.
export const SIGN_BUCKET = 'backups', SIGN_OBJ = 'owner-signature/sig.png';
export const SIGN_PDF_MAX = 20 * 1024 * 1024;
export const SIGN_CHOICES = ['\u05d1\u05e6\u05e2', '\u05dc\u05d0'];
export const SIGN_SUFFIX = ' - \u05d7\u05ea\u05d5\u05dd';
export const SIGN_ID_RE = /^s[a-z0-9]{6,20}$/;

function readList(raw) {
  let list = [];
  try { list = typeof raw === 'string' ? JSON.parse(raw || '[]') : (raw || []); } catch (e) { list = []; }
  return Array.isArray(list) ? list : [];
}

// A new request, or the open one for the same file (no second message for one file). Pure.
export function signAdd(raw, req, nowIso, rnd) {
  const list = readList(raw), now = Date.parse(nowIso);
  const open = list.find((x) => x && x.status === 'pending' && x.path === req.path && now - Date.parse(x.at) < SIGN_TTL_MS);
  if (open) return { id: open.id, created: false, list };
  const id = 's' + now.toString(36) + String(rnd || Math.random().toString(36).slice(2, 6)).replace(/[^a-z0-9]/g, '').slice(0, 4);
  const e = { id, at: nowIso, status: 'pending', agent: String(req.agent || ''), path: req.path, name: req.name, page: req.page || null, x: req.x === undefined ? null : req.x, y: req.y === undefined ? null : req.y };
  return { id, created: true, list: list.concat([e]).slice(-SIGN_MAX) };
}

// Michael's answer to one request: yes = approved (the server then signs), no = cancelled. Only a pending
// request younger than SIGN_TTL_MS; anything else is an error and nothing is signed. Pure.
export function signTake(raw, id, yes, nowIso, wamid) {
  const list = readList(raw);
  const e = list.find((x) => x && x.id === id);
  if (!e) return { error: 'unknown', list };
  if (e.status !== 'pending') return { error: 'done', req: e, list };
  if (Date.parse(nowIso) - Date.parse(e.at) >= SIGN_TTL_MS) { e.status = 'expired'; e.done_at = nowIso; return { error: 'expired', req: e, list }; }
  e.status = yes ? 'approved' : 'cancelled'; e.done_at = nowIso; e.by = wamid || null;
  return { req: e, list };
}
export function signMark(raw, id, status, extra) {
  const list = readList(raw);
  const e = list.find((x) => x && x.id === id);
  if (e) Object.assign(e, { status }, extra || {});
  return list;
}

// Which request a WhatsApp message answers: the message it replies to (its log line carries "| ref sign:<id> |"),
// or, with no reply, the last message the assistant sent (wa_last_out ref). A reply to anything else is not
// about a signature. Pure.
export function signRefOf(about, prev) {
  const a = String(about || '');
  if (a) { const m = /\| ref sign:(s[a-z0-9]{6,20}) \|/.exec(a); return m ? m[1] : null; }
  const r = /^sign:(s[a-z0-9]{6,20})$/.exec(String((prev && prev.ref) || ''));
  return r ? r[1] : null;
}
// "1" / "\u05d1\u05e6\u05e2" (a tap or typed) = yes, "2" / "\u05dc\u05d0" = no, anything else = not an answer (goes to the assistant). Pure.
export function signAnswer(m) {
  const raw = String((m && m.text) || '').trim().replace(/[.!]/g, ' ').replace(/\s+/g, ' ').trim();
  const c = m && m.choice !== undefined && m.choice !== null ? String(m.choice) : '';
  if (c === '1' || /^(1 )?\u05d1\u05e6\u05e2$/.test(raw) || raw === '1') return true;
  if (c === '2' || /^(2 )?\u05dc\u05d0$/.test(raw) || raw === '2') return false;
  return null;
}

export function signedName(name) { return String(name).replace(/\.pdf$/i, '') + SIGN_SUFFIX + '.pdf'; }
export function signAskText(name, folder) {
  return '\u05dc\u05d7\u05ea\u05d5\u05dd \u05d1\u05e9\u05de\u05da \u05e2\u05dc ' + name + '?\n(' + folder + ')\n'
    + '\u05d4\u05d7\u05ea\u05d9\u05de\u05d4, "' + SITE.company + '" \u05d5\u05d4\u05ea\u05d0\u05e8\u05d9\u05da, \u05d1\u05e2\u05de\u05d5\u05d3 \u05d4\u05d0\u05d7\u05e8\u05d5\u05df \u05dc\u05de\u05d8\u05d4 \u05de\u05d9\u05de\u05d9\u05df. \u05e0\u05e9\u05de\u05e8 \u05db\u05e7\u05d5\u05d1\u05e5 \u05d7\u05d3\u05e9 \u05d1\u05e9\u05dd "' + signedName(name) + '", \u05d4\u05de\u05e7\u05d5\u05e8 \u05dc\u05d0 \u05de\u05e9\u05ea\u05e0\u05d4. \u05d4\u05d1\u05e7\u05e9\u05d4 \u05d1\u05ea\u05d5\u05e7\u05e3 24 \u05e9\u05e2\u05d5\u05ea.';
}
export function ilDate(nowMs) {
  const p = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Jerusalem', day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(nowMs));
  return p; // en-GB gives DD/MM/YYYY
}

const b64bytes = (s) => Uint8Array.from(atob(s), (ch) => ch.charCodeAt(0));
const isPng = (b) => b.length > 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47;
const isJpg = (b) => b.length > 3 && b[0] === 0xff && b[1] === 0xd8;
// Sizes in PDF points (1/72 inch): a signature 150 wide, the caption 80 wide under it, the date under that.
export const SIG_W = 150, CAP_W = 80, DATE_SIZE = 10, MARGIN = 36;

// The signature, the caption and the date on one page (default: the last page, bottom right). Returns new
// bytes; the input is not changed. page is 1-based; x, y (points from the bottom left) move the signature.
export async function stampPdf(pdfBytes, sigBytes, dateText, opts) {
  const o = opts || {};
  const doc = await PDFDocument.load(pdfBytes);
  const pages = doc.getPages();
  if (!pages.length) throw new Error('no pages');
  const pg = pages[o.page ? Math.min(pages.length, Math.max(1, o.page)) - 1 : pages.length - 1];
  const { width } = pg.getSize();
  const sig = isPng(sigBytes) ? await doc.embedPng(sigBytes) : isJpg(sigBytes) ? await doc.embedJpg(sigBytes) : null;
  if (!sig) throw new Error('signature is not png or jpg');
  const cap = await doc.embedPng(b64bytes(CAPTION_PNG_B64));
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const sh = sig.height * SIG_W / sig.width, ch = cap.height * CAP_W / cap.width;
  const right = (typeof o.x === 'number' ? o.x : width - MARGIN - SIG_W) + SIG_W;
  const y = typeof o.y === 'number' ? o.y : MARGIN + DATE_SIZE + 4 + ch + 2;
  pg.drawImage(sig, { x: right - SIG_W, y, width: SIG_W, height: sh });
  pg.drawImage(cap, { x: right - CAP_W, y: y - ch - 2, width: CAP_W, height: ch });
  const dw = font.widthOfTextAtSize(dateText, DATE_SIZE);
  pg.drawText(dateText, { x: right - dw, y: y - ch - 2 - DATE_SIZE - 2, size: DATE_SIZE, font, color: rgb(0.1, 0.1, 0.1) });
  return doc.save();
}

// The signing itself, after Michael's yes: read, stamp, save beside, never replace. req.path is the full
// Graph path under the drive root (checked when the request was made, routine-db signRequestCheck).
// Returns {ok, name, webUrl} or {ok:false, error}.
export async function signRun(env, sbUrl, token, req, nowMs) {
  const G = 'https://graph.microsoft.com/v1.0/me/drive/root:/';
  const enc = (p) => String(p).split('/').filter(Boolean).map(encodeURIComponent).join('/');
  const gh = { Authorization: 'Bearer ' + token };
  const dir = req.path.split('/').slice(0, -1).join('/'), out = signedName(req.name);
  const taken = await fetch(G + enc(dir + '/' + out) + '?select=id', { headers: gh, signal: tmo(GRAPH_MS) });
  if (taken.status !== 404) return { ok: false, error: taken.ok ? 'signed file exists' : 'name check ' + taken.status };
  const src = await fetch(G + enc(req.path) + ':/content', { headers: gh, signal: tmo(FILE_MS) });
  if (!src.ok) return { ok: false, error: 'read ' + src.status };
  const pdf = new Uint8Array(await src.arrayBuffer());
  if (!pdf.length || pdf.length > SIGN_PDF_MAX) return { ok: false, error: 'size' };
  if (String.fromCharCode(...pdf.slice(0, 5)) !== '%PDF-') return { ok: false, error: 'not a pdf' };
  const k = env.SUPABASE_SERVICE_ROLE_KEY;
  const s = await fetch(sbUrl + '/storage/v1/object/' + SIGN_BUCKET + '/' + SIGN_OBJ, { headers: { apikey: k, Authorization: 'Bearer ' + k }, signal: tmo(SB_MS) });
  if (!s.ok) return { ok: false, error: s.status === 400 || s.status === 404 ? 'no signature image' : 'signature ' + s.status };
  const sig = new Uint8Array(await s.arrayBuffer());
  let signed;
  try { signed = await stampPdf(pdf, sig, ilDate(nowMs), { page: req.page, x: req.x, y: req.y }); } catch (e) { return { ok: false, error: 'stamp: ' + String(e && e.message || e).slice(0, 120) }; }
  const up = await fetch(G + enc(dir + '/' + out) + ':/content?@microsoft.graph.conflictBehavior=fail', { method: 'PUT', headers: { ...gh, 'Content-Type': 'application/pdf' }, body: signed, signal: tmo(FILE_MS) });
  const uj = await up.json().catch(() => ({}));
  if (!up.ok) return { ok: false, error: 'put ' + up.status };
  return { ok: true, name: out, webUrl: uj.webUrl || null, size: uj.size || null, bytes: signed };
}

// What Michael reads back. Keyboard characters only.
export function signDoneText(r, req) {
  if (r.ok) return '\u05e0\u05d7\u05ea\u05dd: ' + r.name + ' (\u05d1\u05d0\u05d5\u05ea\u05d4 \u05ea\u05d9\u05e7\u05d9\u05d9\u05d4, \u05d4\u05de\u05e7\u05d5\u05e8 \u05dc\u05d0 \u05d4\u05e9\u05ea\u05e0\u05d4).';
  const why = { 'signed file exists': '\u05db\u05d1\u05e8 \u05d9\u05e9 \u05e7\u05d5\u05d1\u05e5 \u05d7\u05ea\u05d5\u05dd \u05d1\u05e9\u05dd \u05d4\u05d6\u05d4', 'no signature image': '\u05ea\u05de\u05d5\u05e0\u05ea \u05d4\u05d7\u05ea\u05d9\u05de\u05d4 \u05e2\u05d5\u05d3 \u05dc\u05d0 \u05e0\u05e9\u05de\u05e8\u05d4 \u05d1\u05e9\u05e8\u05ea', 'not a pdf': '\u05d4\u05e7\u05d5\u05d1\u05e5 \u05d0\u05d9\u05e0\u05d5 PDF', size: '\u05d4\u05e7\u05d5\u05d1\u05e5 \u05d2\u05d3\u05d5\u05dc \u05de\u05d3\u05d9' }[r.error] || r.error;
  return '\u05dc\u05d0 \u05e0\u05d7\u05ea\u05dd: ' + (req ? req.name : '') + '. ' + why + '.';
}
export const SIGN_CANCEL_TEXT = '\u05d1\u05d5\u05d8\u05dc, \u05dc\u05d0 \u05e0\u05d7\u05ea\u05dd.';
export const SIGN_EXPIRED_TEXT = '\u05d4\u05d1\u05e7\u05e9\u05d4 \u05dc\u05d7\u05ea\u05d9\u05de\u05d4 \u05e4\u05d2\u05d4 (\u05e2\u05d1\u05e8\u05d5 24 \u05e9\u05e2\u05d5\u05ea). \u05dc\u05d0 \u05e0\u05d7\u05ea\u05dd. \u05d0\u05e4\u05e9\u05e8 \u05dc\u05d1\u05e7\u05e9 \u05e9\u05d5\u05d1.';
export const SIGN_DONE_TEXT = '\u05db\u05d1\u05e8 \u05e2\u05e0\u05d9\u05ea\u05d9 \u05e2\u05dc \u05d4\u05d1\u05e7\u05e9\u05d4 \u05d4\u05d6\u05d5, \u05dc\u05d0 \u05d7\u05ea\u05de\u05ea\u05d9 \u05e9\u05d5\u05d1.';
