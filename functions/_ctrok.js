// Contractor link, stage 2 (16/11/2026, Michael in a 4-question interview; DECISIONS 16/11/2026 "קישור קבלן שלב 2").
// After a contractor sends the form (api/ctr-link.js), Michael gets a WhatsApp with "בצע" / "לא" (ref ctra:<rid>).
// - Yes: the request is approved once (a second tap answers "already approved"), and the contractor goes into the
//   contractors' register (table ctr) until the end of the year (perm) or of the job (temp), tr = "הוכשר". A contractor
//   already there is updated: the same company number, or the very same name. A similar name is asked (ref ctrm:<rid>).
// - No: Michael writes why (ref ctrr:<rid>); the server makes a mail draft to the contractor with the reason and a fresh
//   link to the same request (Michael sends it), and the page keeps what the contractor typed.
// - A request waiting more than a day is asked again after the morning update (wa-morning run, ctrMorning).
// - 30 days before a permanent contractor's year in the register ends, a new link is made and sent to Michael to forward.
// The state of each request stays in server_state ctr_links (one entry per request), so several can wait at once.
import { SITE, sbFrom, tmo, SB_TIMEOUT_MS } from './_shared.js';
import { stateCas } from './_cas.js';
import { sendToOwner, ownerWa, ownerWindowOpen, noteLastOut } from './_wa.js';
import { CTR_STATE, CTR_S_FILLED, CTR_S_SENT, stateList, statePatch, linkTtlDays, ctrLinkId } from './_ctr.js';
import { makeCtrToken, ctrUrl, workLabel, ctrLinkCreate, ilDay, workerLink } from './api/ctr-link.js';

export const CTR_S_OK = 'approved', CTR_S_REJ = 'rejecting';
export const CTR_YEAR_DAYS = 365, CTR_RENEW_DAYS = 30;
export const CTR_AGAIN_MS = 20 * 3600e3;    // asked again at the next morning update when the last ask is older than this
export const CTR_REASON_MS = 24 * 3600e3;   // a reason is taken up to a day after "no"
export const CTR_RENEW_KEY = 'ctr_renew';   // server_state: {ctr id: the end date a new link was already made for}
export const CTR_MORNING_MAX = 5;           // asks / registers / renewals per morning, each
// 16/11/2026 (DECISIONS "\u05d7\u05de\u05e9 \u05ea\u05d5\u05e1\u05e4\u05d5\u05ea \u05de\u05e1\u05e7\u05d9\u05e8\u05ea \u05d4\u05ea\u05d4\u05dc\u05d9\u05da"): a link not filled is told to Michael this long before it ends, once per link
export const CTR_NAG_MS = 3 * 864e5;
export const CTR_S_CLOSED = 'closed';
// approvals before this (16/11/2026) gave the new-worker link at the send already: the morning never sends theirs
export const CTR_WLINK_SINCE = '2026-11-16T18:00:00Z';
export const CTR_CHOICES = ['\u05d1\u05e6\u05e2', '\u05dc\u05d0'];
export const CTR_MATCH_CHOICES = ['\u05d0\u05d5\u05ea\u05d5 \u05e7\u05d1\u05dc\u05df', '\u05e7\u05d1\u05dc\u05df \u05d7\u05d3\u05e9'];
export const CTR_TRAINED = '\u05d4\u05d5\u05db\u05e9\u05e8', CTR_ACTIVE = '\u05e4\u05e2\u05d9\u05dc';
const KIND_TY = { perm: '\u05e7\u05d1\u05d5\u05e2', temp: '\u05d6\u05de\u05e0\u05d9' };
const RID = 'c[0-9a-z]{6,16}';

const dmy = (d) => (/^\d{4}-\d{2}-\d{2}/.test(String(d || '')) ? String(d).slice(8, 10) + '/' + String(d).slice(5, 7) + '/' + String(d).slice(0, 4) : '');
const one = (s, n) => String(s || '').replace(/[\r\n\t]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n);
const digits = (s) => String(s || '').replace(/\D/g, '');

// ---- pure ----
// The request id a message refers to: the tapped / replied message (about, its log line carries "| ref <kind>:<rid> |"),
// else, when nothing was replied to, the newest message the server sent (prev.ref). {rid, by: 'about' | 'prev'} or null.
export function ctrRefOf(kind, about, prev) {
  const a = String(about || '');
  // a reply to another message never falls back to the newest one (as delRefOf)
  if (a) { const x = new RegExp('\\| ref ' + kind + ':(' + RID + ') \\| [^|]*$').exec(a); return x ? { rid: x[1], by: 'about' } : null; }
  const p = new RegExp('^' + kind + ':(' + RID + ')$').exec(String((prev && prev.ref) || ''));
  return p ? { rid: p[1], by: 'prev' } : null;
}
// The last day in the register: a year from the approval (perm), or the job's last day (temp). YYYY-MM-DD.
// 16/11/2026 (DECISIONS "five additions"): never past the document that ends first (first_e, from the page's "valid until").
export function ctrEnd(e, nowMs) {
  const base = e && e.kind === 'temp' && /^\d{4}-\d{2}-\d{2}$/.test(String(e.de || '')) ? e.de : ilDay(nowMs + CTR_YEAR_DAYS * 864e5);
  const f = String((e && e.first_e) || '');
  return /^\d{4}-\d{2}-\d{2}$/.test(f) && f < base ? f : base;
}
// The document that cut the approval short, for the question and the answer ('' when none did).
const firstNote = (e, nowMs) => (e && e.first_e && ctrEnd(e, nowMs) === e.first_e && e.first_doc ? ' (\u05d4\u05de\u05e1\u05de\u05da \u05e9\u05e4\u05d2 \u05e8\u05d0\u05e9\u05d5\u05df: ' + one(e.first_doc, 60) + ')' : '');
export function ctrAskText(e, nowMs) {
  const works = Array.isArray(e.works) ? e.works.map(workLabel).join(', ') : '';
  return '\u05e7\u05d1\u05dc\u05df \u05e9\u05dc\u05d7 \u05d0\u05ea \u05d8\u05d5\u05e4\u05e1 \u05d4\u05d0\u05d9\u05e9\u05d5\u05e8: ' + one(e.company, 80) + ' (' + (e.kind === 'temp' ? '\u05e2\u05d1\u05d5\u05d3\u05d4 \u05d6\u05de\u05e0\u05d9\u05ea' : '\u05e7\u05d1\u05dc\u05df \u05e7\u05d1\u05d5\u05e2') + ').\n'
    + (works ? '\u05e2\u05d1\u05d5\u05d3\u05d5\u05ea: ' + works + '.\n' : '')
    + (Number(e.workers) || 0) + ' \u05e2\u05d5\u05d1\u05d3\u05d9\u05dd \u05d7\u05ea\u05de\u05d5 \u05e2\u05dc \u05d4\u05d5\u05e8\u05d0\u05d5\u05ea \u05d4\u05d1\u05d8\u05d9\u05d7\u05d5\u05ea, ' + (Number(e.files) || 0) + ' \u05e7\u05d1\u05e6\u05d9\u05dd. \u05d4\u05db\u05dc \u05d1\u05ea\u05d9\u05e7\u05d9\u05d9\u05ea \u05d4\u05e7\u05d1\u05dc\u05df \u05d5\u05d1\u05de\u05d9\u05d9\u05dc \u05e9\u05dc\u05da.\n'
    + '\u05dc\u05d0\u05e9\u05e8 \u05d5\u05dc\u05d4\u05db\u05e0\u05d9\u05e1 \u05dc\u05de\u05e8\u05e9\u05dd \u05d4\u05e7\u05d1\u05dc\u05e0\u05d9\u05dd \u05e2\u05d3 ' + dmy(ctrEnd(e, nowMs)) + firstNote(e, nowMs) + '?';
}
// A company name for comparing: no quotes, no "בע\"מ", no punctuation, one space, lower case.
export function normName(s) {
  return String(s || '').replace(/\u05d1\u05e2["'\u05f4\u05f3]?\u05de/g, ' ').replace(/["'\u05f4\u05f3.,()\-_/\\]/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
}
// Which register row this request is: {id, how: 'cid' | 'name'} | {similar: row} | {none: true}. A row with another
// company number is never "the same" by name; a similar name (one inside the other, 3+ letters) is asked.
export function matchCtr(rows, e) {
  const list = (Array.isArray(rows) ? rows : []).filter((x) => x && x.id);
  const cn = digits(e && e.cnum);
  const n = normName(e && e.company);
  // the same number under another name is asked (security review 16/11/2026: the number is not in the question Michael
  // sees, so a typed number of another contractor would have changed that contractor's row)
  if (cn) { const r = list.find((x) => digits(x.cid) === cn); if (r) return normName(r.n) === n ? { id: r.id, how: 'cid' } : { similar: r }; }
  if (!n) return { none: true };
  const otherCid = (x) => cn && digits(x.cid) && digits(x.cid) !== cn;
  const ex = list.filter((x) => normName(x.n) === n);
  const same = ex.filter((x) => !otherCid(x));
  if (same.length === 1) return { id: same[0].id, how: 'name' };
  if (ex.length) return { similar: ex[0] };
  const sim = n.length >= 3 ? list.find((x) => { const o = normName(x.n); return o.length >= 3 && (o.indexOf(n) >= 0 || n.indexOf(o) >= 0); }) : null;
  return sim ? { similar: sim } : { none: true };
}
const tyOf = (e) => (KIND_TY[e.kind] || KIND_TY.perm) + (Array.isArray(e.works) && e.works.length ? ': ' + e.works.map(workLabel).join(', ') : '');
// A new register row (no id): what the contractor typed and the approval.
export function ctrNewRow(e) {
  return { n: one(e.company, 80), cid: digits(e.cnum) || null, ty: tyOf(e), c: one(e.contact, 60) || null, ph: one(e.mobile, 15) || null,
    e: e.until, tr: CTR_TRAINED, s: CTR_ACTIVE, file_url: e.form || e.summary || null,
    ins: insDay(e), ins_src: insDay(e) ? insLine(e) : null };
}
// The insurance end the contractor gave on the page (16/11/2026, ins_e), and where it came from (as the app's ins_src lines).
const insDay = (e) => (/^\d{4}-\d{2}-\d{2}$/.test(String((e && e.ins_e) || '')) ? e.ins_e : null);
const insLine = (e) => dmy(String(e.ok_at || new Date().toISOString()).slice(0, 10)) + ' \u05de\u05e7\u05d9\u05e9\u05d5\u05e8 \u05d4\u05e7\u05d1\u05dc\u05df, \u05d1\u05ea\u05d5\u05e7\u05e3 \u05e2\u05d3 ' + dmy(e.ins_e) + (e.form || e.summary ? ': ' + (e.form || e.summary) : '');
// The patch of a row already there: never empties a field, never shortens its date (a job inside a permanent year keeps the year).
export function ctrUpdate(cur, e) {
  const p = { tr: CTR_TRAINED, s: CTR_ACTIVE };
  if (digits(e.cnum) && !digits(cur && cur.cid)) p.cid = digits(e.cnum);
  if (one(e.contact, 60)) p.c = one(e.contact, 60);
  if (one(e.mobile, 15)) p.ph = one(e.mobile, 15);
  // the newest signed form (16/11/2026 review: a contractor already in the register kept no link to it)
  if (e.form || e.summary) p.file_url = e.form || e.summary;
  // the newest insurance certificate wins (it may end sooner than the one before); its line on top of the old ones
  if (insDay(e)) { p.ins = insDay(e); p.ins_src = (insLine(e) + (cur && cur.ins_src ? '\n' + cur.ins_src : '')).slice(0, 2000); }
  if (!(cur && /^\d{4}-\d{2}-\d{2}$/.test(String(cur.e || '')) && String(cur.e) > String(e.until))) { p.e = e.until; p.ty = tyOf(e); }
  return p;
}
// The register rows whose permanent year ends within CTR_RENEW_DAYS and that have no new link yet for that date.
export function renewDue(rows, today, done) {
  const lim = ilDay(Date.parse(today + 'T12:00:00Z') + CTR_RENEW_DAYS * 864e5);
  const d = done && typeof done === 'object' ? done : {};
  return (Array.isArray(rows) ? rows : []).filter((r) => r && r.id && String(r.ty || '').indexOf(KIND_TY.perm) === 0 && /^\d{4}-\d{2}-\d{2}$/.test(String(r.e || ''))
    && r.e >= today && r.e <= lim && r.s !== '\u05dc\u05d0 \u05e4\u05e2\u05d9\u05dc' && d[r.id] !== r.e);
}
export function ctrDraftBody(e, reason, link, expDay) {
  return '\u05d1\u05d3\u05e7\u05e0\u05d5 \u05d0\u05ea \u05d8\u05d5\u05e4\u05e1 \u05d0\u05d9\u05e9\u05d5\u05e8 \u05d4\u05e7\u05d1\u05dc\u05df \u05e9\u05e9\u05dc\u05d7\u05ea\u05dd \u05e2\u05d1\u05d5\u05e8 ' + one(e.company, 80) + ', \u05d5\u05d9\u05e9 \u05e6\u05d5\u05e8\u05da \u05d1\u05ea\u05d9\u05e7\u05d5\u05df:\n' + one(reason, 600) + '\n\n'
    + '\u05d0\u05e4\u05e9\u05e8 \u05dc\u05ea\u05e7\u05df \u05d5\u05dc\u05e9\u05dc\u05d5\u05d7 \u05e9\u05d5\u05d1 \u05d1\u05d0\u05d5\u05ea\u05d5 \u05d8\u05d5\u05e4\u05e1, \u05d1\u05e7\u05d9\u05e9\u05d5\u05e8 \u05d4\u05d6\u05d4 (\u05d1\u05ea\u05d5\u05e7\u05e3 \u05e2\u05d3 ' + dmy(expDay) + '):\n' + link + '\n\n'
    + '\u05e4\u05e8\u05d8\u05d9 \u05d4\u05d7\u05d1\u05e8\u05d4 \u05d5\u05ea\u05d9\u05d0\u05d5\u05e8 \u05d4\u05e2\u05d1\u05d5\u05d3\u05d4 \u05db\u05d1\u05e8 \u05de\u05d5\u05dc\u05d0\u05d5 \u05d1\u05d8\u05d5\u05e4\u05e1. \u05d0\u05ea \u05d4\u05de\u05e1\u05de\u05db\u05d9\u05dd \u05e6\u05e8\u05d9\u05da \u05dc\u05e6\u05e8\u05e3 \u05e9\u05d5\u05d1, \u05d5\u05db\u05dc \u05d4\u05e2\u05d5\u05d1\u05d3\u05d9\u05dd \u05d7\u05d5\u05ea\u05de\u05d9\u05dd \u05e9\u05d5\u05d1.';
}
// The mail to the contractor after "\u05d1\u05e6\u05e2" (16/11/2026): the new-worker link, and what a worker at height does.
export function ctrWorkerBody(e, link, expDay) {
  return '\u05d8\u05d5\u05e4\u05e1 \u05d0\u05d9\u05e9\u05d5\u05e8 \u05d4\u05e7\u05d1\u05dc\u05df \u05e9\u05dc ' + one(e.company, 80) + ' \u05d0\u05d5\u05e9\u05e8' + (e.until ? ', \u05d1\u05ea\u05d5\u05e7\u05e3 \u05e2\u05d3 ' + dmy(e.until) : '') + '.\n\n'
    + '\u05db\u05dc \u05e2\u05d5\u05d1\u05d3 \u05d7\u05d3\u05e9 \u05e9\u05dc\u05db\u05dd \u05e0\u05db\u05e0\u05e1 \u05dc\u05e7\u05d9\u05e9\u05d5\u05e8 \u05d4\u05d6\u05d4 \u05dc\u05e4\u05e0\u05d9 \u05d4\u05db\u05e0\u05d9\u05e1\u05d4 \u05d4\u05e8\u05d0\u05e9\u05d5\u05e0\u05d4 \u05dc\u05de\u05e4\u05e2\u05dc, \u05e7\u05d5\u05e8\u05d0 \u05d0\u05ea \u05d4\u05d5\u05e8\u05d0\u05d5\u05ea \u05d4\u05d1\u05d8\u05d9\u05d7\u05d5\u05ea \u05d5\u05d7\u05d5\u05ea\u05dd:\n' + link + '\n' + '(\u05d4\u05e7\u05d9\u05e9\u05d5\u05e8 \u05d1\u05ea\u05d5\u05e7\u05e3 \u05e2\u05d3 ' + dmy(expDay) + ')\n\n'
    + '\u05e2\u05d5\u05d1\u05d3 \u05e9\u05e2\u05d5\u05d1\u05d3 \u05d1\u05d2\u05d5\u05d1\u05d4 \u05de\u05e1\u05de\u05df \u05d6\u05d0\u05ea \u05d1\u05e7\u05d9\u05e9\u05d5\u05e8, \u05de\u05e6\u05dc\u05dd \u05d0\u05ea \u05d0\u05d9\u05e9\u05d5\u05e8 \u05d4\u05e2\u05d1\u05d5\u05d3\u05d4 \u05d1\u05d2\u05d5\u05d1\u05d4 \u05e9\u05dc\u05d5 \u05d5\u05db\u05d5\u05ea\u05d1 \u05e2\u05d3 \u05de\u05ea\u05d9 \u05d4\u05d5\u05d0 \u05d1\u05ea\u05d5\u05e7\u05e3. \u05d1\u05dc\u05d9 \u05d7\u05ea\u05d9\u05de\u05d4 \u05d1\u05e7\u05d9\u05e9\u05d5\u05e8 \u05d4\u05e2\u05d5\u05d1\u05d3 \u05dc\u05d0 \u05e0\u05db\u05e0\u05e1 \u05dc\u05de\u05e4\u05e2\u05dc.';
}
const EMAIL_RE = /^[^\s@<>"';,]{1,64}@[A-Za-z0-9.-]{1,120}\.[A-Za-z]{2,}$/;

// A link the contractor did not fill, ending within CTR_NAG_MS: told once per link (nag = the exp it was told for, so a
// fresh link after "no" is told again). A link made less than a day ago is not told (a short job's link).
export function nagDue(list, nowMs) {
  return (Array.isArray(list) ? list : []).filter((x) => x && x.status === CTR_S_SENT && x.exp && x.nag !== x.exp
    && Date.parse(x.exp) > nowMs && Date.parse(x.exp) - nowMs <= CTR_NAG_MS && nowMs - (Date.parse(x.created_at || '') || 0) > 864e5);
}
export function nagText(e) {
  return '\u05d4\u05e7\u05d1\u05dc\u05df ' + (one(e.company, 60) || '\u05dc\u05dc\u05d0 \u05e9\u05dd') + ' \u05e2\u05d5\u05d3 \u05dc\u05d0 \u05de\u05d9\u05dc\u05d0 \u05d0\u05ea \u05d8\u05d5\u05e4\u05e1 \u05d0\u05d9\u05e9\u05d5\u05e8 \u05d4\u05e7\u05d1\u05dc\u05df, \u05d5\u05d4\u05e7\u05d9\u05e9\u05d5\u05e8 \u05e9\u05dc\u05d5 \u05e4\u05d2 \u05d1-' + dmy(ilDay(Date.parse(e.exp))) + '. \u05d0\u05e4\u05e9\u05e8 \u05dc\u05d4\u05d6\u05db\u05d9\u05e8 \u05dc\u05d5, \u05d5\u05d0\u05d7\u05e8\u05d9 \u05e9\u05d9\u05e4\u05d5\u05d2 \u05dc\u05d1\u05e7\u05e9 \u05de\u05d4\u05e2\u05d5\u05d6\u05e8 \u05e7\u05d9\u05e9\u05d5\u05e8 \u05d7\u05d3\u05e9.';
}
// A temporary job's request still waiting for Michael after the job's last day: closed, not asked again (one message).
export function endedDue(list, today) {
  return (Array.isArray(list) ? list : []).filter((x) => x && x.status === CTR_S_FILLED && x.files != null && x.kind === 'temp'
    && /^\d{4}-\d{2}-\d{2}$/.test(String(x.de || '')) && x.de < today);
}
export function endedText(e) {
  return '\u05d4\u05d1\u05e7\u05e9\u05d4 \u05e9\u05dc ' + one(e.company, 60) + ' (\u05e2\u05d1\u05d5\u05d3\u05d4 \u05d6\u05de\u05e0\u05d9\u05ea ' + dmy(e.ds) + ' \u05e2\u05d3 ' + dmy(e.de) + ') \u05e0\u05e1\u05d2\u05e8\u05d4: \u05d4\u05e2\u05d1\u05d5\u05d3\u05d4 \u05d4\u05e1\u05ea\u05d9\u05d9\u05de\u05d4 \u05d1\u05dc\u05d9 \u05d0\u05d9\u05e9\u05d5\u05e8, \u05d5\u05d4\u05e7\u05d1\u05dc\u05df \u05dc\u05d0 \u05e0\u05db\u05e0\u05e1 \u05dc\u05de\u05e8\u05e9\u05dd \u05d4\u05e7\u05d1\u05dc\u05e0\u05d9\u05dd. \u05dc\u05d0 \u05d0\u05e9\u05d0\u05dc \u05e2\u05dc\u05d9\u05d4 \u05e9\u05d5\u05d1.';
}

// ---- the database and WhatsApp ----
const hdr = (env) => { const k = env.SUPABASE_SERVICE_ROLE_KEY; return { apikey: k, Authorization: 'Bearer ' + k, 'Content-Type': 'application/json' }; };
async function sb(env, path, opt) {
  const o = opt || {};
  const r = await fetch(sbFrom(env) + '/rest/v1/' + path, { method: o.method || 'GET', headers: Object.assign(hdr(env), o.headers || {}), body: o.body, signal: tmo(SB_TIMEOUT_MS) });
  if (!r.ok) throw new Error(path.split('?')[0] + ' ' + r.status);
  const t = await r.text();
  return t ? JSON.parse(t) : null;
}
export async function ctrEntries(env) {
  const rows = await sb(env, 'server_state?select=value&key=eq.' + CTR_STATE);
  return stateList(rows && rows[0] && rows[0].value);
}
// One entry patched under compare-and-swap; when = the status it must have now, or a function of the entry.
export async function ctrPatch(env, rid, patch, when) {
  let err = null;
  const w = await stateCas(sbFrom(env), hdr(env), CTR_STATE, (cur) => {
    const p = statePatch(cur, rid, patch, when);
    if (p.error) { err = p; return { write: false }; }
    return { value: JSON.stringify(p.list) };
  }, () => tmo(SB_TIMEOUT_MS));
  return err || (w && w.written ? { ok: true } : { error: 'write' });
}
// A message to Michael from the server, logged like routine-db wa_me (event assistant, its ref and wamid), so a tap or a
// reply on it finds its request. {ok, held} or {ok:false, error}.
export async function ctrSay(env, text, ref, choices) {
  if (!env.META_PHONE_NUMBER_ID || !env.META_ACCESS_TOKEN) return { ok: false, error: 'whatsapp not configured' };
  const url = sbFrom(env), to = await ownerWa(env, url);
  if (!to) return { ok: false, error: 'no owner number' };
  const open = await ownerWindowOpen(env, url);
  // a closed window goes as the template, without buttons: the answer is a reply to the message itself (it carries the ref)
  if (!open && choices && choices.length) text = text + '\n\u05dc\u05e2\u05e0\u05d5\u05ea \u05e2\u05dc \u05d4\u05d4\u05d5\u05d3\u05e2\u05d4 \u05d4\u05d6\u05d5: ' + choices.join(' \u05d0\u05d5 ') + '.';
  const r = await sendToOwner(env, to, text, { kind: 'ctr', ref, choices: choices || null, windowOpen: open, repeat: true });
  if (r.ok && !r.held) await noteLastOut(env, url, text, ref);
  await sb(env, 'notifications_log', { method: 'POST', headers: { Prefer: 'return=minimal' },
    body: JSON.stringify([{ id: 'wc' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), user_email: 'server', ts: new Date().toISOString(),
      event_type: 'assistant', channel: r.held ? 'held' : r.ok ? 'whatsapp' : 'whatsapp_error',
      payload: { title: one(text, 120), text: String(text).slice(0, 1500), via: r.via || null, wamid: r.wamid || null, ref: String(ref || 'none').slice(0, 40), detail: r.error || null } }]) }).catch(() => {});
  return r.ok ? { ok: true, held: !!r.held } : { ok: false, error: r.error || 'send' };
}
// The approval question for one request (after the send, and again from the morning update).
export async function ctrAsk(env, rid, nowMs) {
  const e = (await ctrEntries(env)).find((x) => x.id === rid);
  if (!e || e.status !== CTR_S_FILLED || e.files == null) return { ok: false, error: 'not waiting' };
  const s = await ctrSay(env, ctrAskText(e, nowMs), 'ctra:' + rid, CTR_CHOICES);
  if (s.ok && !s.held) await ctrPatch(env, rid, { ask_at: new Date(nowMs).toISOString(), asks: (Number(e.asks) || 0) + 1 }, CTR_S_FILLED);
  return s;
}

// The new-worker link after "\u05d1\u05e6\u05e2" (16/11/2026, DECISIONS "five additions"): a draft to the contractor when there is a mail
// and deps.draft, else the link in the line for Michael to forward. Marked once (wlink) under the approved status.
// {line} for Michael's message ('' when no link could be made).
export async function ctrWorkerSend(env, e, nowMs, deps) {
  const link = await workerLink(env, { kind: e.kind, de: e.de }, e, nowMs).catch(() => null);
  if (!link) return { line: '' };
  const from = Date.parse(e.at || '') || nowMs;
  const endDay = e.until && e.until < ilDay(from + 365 * 864e5) ? e.until : ilDay(from + 364 * 864e5);
  let drafted = false;
  if (EMAIL_RE.test(String(e.email || '')) && deps && deps.draft) {
    const d = await deps.draft({ op: 'mail_draft', agent: 'ctr-link', why: 'contractor approved (Michael: \u05d1\u05e6\u05e2): the new-worker link',
      to: e.email, subject: '\u05e7\u05d9\u05e9\u05d5\u05e8 \u05dc\u05e2\u05d5\u05d1\u05d3 \u05d7\u05d3\u05e9 - ' + SITE.company, body: ctrWorkerBody(e, link, endDay) }).catch(() => null);
    drafted = !!(d && d.ok);
  }
  await ctrPatch(env, e.id, { wlink: drafted ? 'draft' : 'said', wlink_at: new Date(nowMs).toISOString() }, CTR_S_OK).catch(() => null);
  return { line: drafted ? '\u05d4\u05db\u05e0\u05ea\u05d9 \u05d8\u05d9\u05d5\u05d8\u05d4 \u05dc\u05e7\u05d1\u05dc\u05df \u05e2\u05dd \u05d4\u05e7\u05d9\u05e9\u05d5\u05e8 \u05dc\u05e2\u05d5\u05d1\u05d3 \u05d7\u05d3\u05e9. \u05d4\u05d9\u05d0 \u05ea\u05d5\u05e4\u05d9\u05e2 \u05d1\u05d8\u05d9\u05d5\u05d8\u05d5\u05ea \u05d1-Outlook, \u05d5\u05d0\u05ea\u05d4 \u05e9\u05d5\u05dc\u05d7.' : '\u05d4\u05e7\u05d9\u05e9\u05d5\u05e8 \u05dc\u05e2\u05d5\u05d1\u05d3 \u05d7\u05d3\u05e9, \u05dc\u05d4\u05e2\u05d1\u05d9\u05e8 \u05dc\u05e7\u05d1\u05dc\u05df:\n' + link };
}

const GONE = '\u05d4\u05d1\u05e7\u05e9\u05d4 \u05d4\u05d6\u05d5 \u05db\u05d1\u05e8 \u05dc\u05d0 \u05e0\u05de\u05e6\u05d0\u05ea. \u05d0\u05e4\u05e9\u05e8 \u05dc\u05d1\u05e7\u05e9 \u05de\u05d4\u05e2\u05d5\u05d6\u05e8 \u05e7\u05d9\u05e9\u05d5\u05e8 \u05d7\u05d3\u05e9 \u05dc\u05e7\u05d1\u05dc\u05df.';
const notWaiting = (e) => '\u05d4\u05d1\u05e7\u05e9\u05d4 \u05e9\u05dc ' + one(e.company, 60) + ' \u05db\u05d1\u05e8 \u05dc\u05d0 \u05de\u05d7\u05db\u05d4 \u05dc\u05d0\u05d9\u05e9\u05d5\u05e8.';
// The tap on "בצע" / "לא". {text, ref, choices}.
export async function fastCtrOk(env, fr, nowMs, deps) {
  const e = (await ctrEntries(env)).find((x) => x.id === fr.id);
  if (!e) return { text: GONE, ref: 'ctr-gone' };
  if (e.status === CTR_S_OK) return { text: '\u05db\u05d1\u05e8 \u05d0\u05d5\u05e9\u05e8: ' + one(e.company, 60) + ', \u05d1\u05de\u05e8\u05e9\u05dd \u05d4\u05e7\u05d1\u05dc\u05e0\u05d9\u05dd \u05e2\u05d3 ' + dmy(e.until) + '.', ref: 'ctr-done' };
  if (e.status !== CTR_S_FILLED || e.files == null) return { text: notWaiting(e), ref: 'ctr-gone' };
  const iso = new Date(nowMs).toISOString();
  if (!fr.yes) {
    const p = await ctrPatch(env, fr.id, { status: CTR_S_REJ, rej_at: iso }, CTR_S_FILLED);
    if (p.error) return { text: notWaiting(e), ref: 'ctr-gone' };
    return { text: '\u05de\u05d4 \u05dc\u05d0 \u05ea\u05e7\u05d9\u05df \u05d0\u05e6\u05dc ' + one(e.company, 60) + '? \u05db\u05ea\u05d5\u05d1 \u05dc\u05d9 \u05d1\u05de\u05e9\u05e4\u05d8 \u05d0\u05d7\u05d3. \u05d0\u05db\u05d9\u05df \u05d8\u05d9\u05d5\u05d8\u05ea \u05de\u05d9\u05d9\u05dc \u05dc\u05e7\u05d1\u05dc\u05df \u05e2\u05dd \u05d4\u05e1\u05d9\u05d1\u05d4 \u05d5\u05e7\u05d9\u05e9\u05d5\u05e8 \u05dc\u05ea\u05d9\u05e7\u05d5\u05df, \u05d5\u05d0\u05ea\u05d4 \u05e9\u05d5\u05dc\u05d7 \u05d0\u05d5\u05ea\u05d4.', ref: 'ctrr:' + fr.id };
  }
  const until = ctrEnd(e, nowMs);
  // the one approval: under compare-and-swap from "filled", so a second tap finds it approved
  const p = await ctrPatch(env, fr.id, { status: CTR_S_OK, ok_at: iso, until }, CTR_S_FILLED);
  if (p.error) return p.status === CTR_S_OK ? { text: '\u05db\u05d1\u05e8 \u05d0\u05d5\u05e9\u05e8: ' + one(e.company, 60) + '.', ref: 'ctr-done' } : { text: notWaiting(e), ref: 'ctr-gone' };
  const ok = Object.assign({}, e, { status: CTR_S_OK, until, ok_at: iso });
  const r = await ctrRegister(env, ok, null);
  const w = await ctrWorkerSend(env, ok, nowMs, deps);
  return w.line ? Object.assign({}, r, { text: r.text + '\n\n' + w.line }) : r;
}
// Writes the approved request into the register. force = a row id Michael chose, 'new', or null (match it here).
export async function ctrRegister(env, e, force) {
  const name = one(e.company, 60);
  try {
    const rows = await sb(env, 'ctr?select=id,n,cid,e,ty,s,ins_src&limit=2000');
    const m = force === 'new' ? { none: true } : force ? { id: force } : matchCtr(rows, e);
    if (m.similar) {
      await ctrPatch(env, e.id, { reg: 'ask', reg_ask: m.similar.id }, CTR_S_OK);
      return { text: '\u05d0\u05d5\u05e9\u05e8. \u05d1\u05de\u05e8\u05e9\u05dd \u05d4\u05e7\u05d1\u05dc\u05e0\u05d9\u05dd \u05d9\u05e9 \u05e7\u05d1\u05dc\u05df \u05d1\u05e9\u05dd \u05d3\u05d5\u05de\u05d4: ' + one(m.similar.n, 60) + '. \u05d6\u05d4 \u05d0\u05d5\u05ea\u05d5 \u05e7\u05d1\u05dc\u05df \u05db\u05de\u05d5 ' + name + '?', ref: 'ctrm:' + e.id, choices: CTR_MATCH_CHOICES };
    }
    let id = m.id, rowName = name;
    if (id) {
      const cur = (rows || []).find((x) => x.id === id);
      if (cur) rowName = one(cur.n, 60) || name;
      if (!cur) return { text: '\u05d4\u05e7\u05d1\u05dc\u05df \u05e9\u05d1\u05d7\u05e8\u05ea \u05db\u05d1\u05e8 \u05dc\u05d0 \u05d1\u05de\u05e8\u05e9\u05dd. \u05db\u05ea\u05d5\u05d1 \u05dc\u05e2\u05d5\u05d6\u05e8 "\u05e8\u05e9\u05d5\u05dd \u05d0\u05ea ' + name + ' \u05d1\u05de\u05e8\u05e9\u05dd".', ref: 'ctr-reg-fail' };
      await sb(env, 'ctr?id=eq.' + encodeURIComponent(id), { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(ctrUpdate(cur, e)) });
    } else {
      id = 'ctr' + String(e.until || '').slice(2, 4) + '-' + e.id;
      await sb(env, 'ctr?on_conflict=id', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify([Object.assign({ id }, ctrNewRow(e))]) });
    }
    await ctrPatch(env, e.id, { reg: id, reg_ask: null }, CTR_S_OK);
    return { text: '\u05d0\u05d5\u05e9\u05e8. ' + rowName + (m.id ? ' \u05e2\u05d5\u05d3\u05db\u05df' : ' \u05e0\u05d5\u05e1\u05e3') + ' \u05d1\u05de\u05e8\u05e9\u05dd \u05d4\u05e7\u05d1\u05dc\u05e0\u05d9\u05dd, \u05d1\u05ea\u05d5\u05e7\u05e3 \u05e2\u05d3 ' + dmy(e.until) + firstNote(e, Date.parse(e.ok_at || '') || Date.now()) + (insDay(e) ? ', \u05d4\u05d1\u05d9\u05d8\u05d5\u05d7 \u05e2\u05d3 ' + dmy(insDay(e)) : '') + ', \u05d5\u05d4\u05e2\u05d5\u05d1\u05d3\u05d9\u05dd \u05e9\u05d7\u05ea\u05de\u05d5 \u05e1\u05d5\u05de\u05e0\u05d5 "\u05d4\u05d5\u05db\u05e9\u05e8".'
      + (e.kind === 'temp' ? '' : ' 30 \u05d9\u05d5\u05dd \u05dc\u05e4\u05e0\u05d9 \u05d4\u05e1\u05d5\u05e3 \u05ea\u05e7\u05d1\u05dc \u05e7\u05d9\u05e9\u05d5\u05e8 \u05d7\u05d3\u05e9 \u05de\u05d5\u05db\u05df \u05dc\u05e9\u05dc\u05d9\u05d7\u05d4.'), ref: 'ctr-done' };
  } catch (x) {
    return { text: '\u05d0\u05d5\u05e9\u05e8, \u05d0\u05d1\u05dc \u05d4\u05db\u05ea\u05d9\u05d1\u05d4 \u05dc\u05de\u05e8\u05e9\u05dd \u05d4\u05e7\u05d1\u05dc\u05e0\u05d9\u05dd \u05e0\u05db\u05e9\u05dc\u05d4 (' + one(x && x.message, 60) + '). \u05d0\u05e0\u05e1\u05d4 \u05e9\u05d5\u05d1 \u05de\u05d7\u05e8 \u05d1\u05e2\u05d3\u05db\u05d5\u05df \u05d4\u05d1\u05d5\u05e7\u05e8.', ref: 'ctr-reg-fail' };
  }
}
// The tap on "same contractor" / "new contractor".
export async function fastCtrMatch(env, fr) {
  const e = (await ctrEntries(env)).find((x) => x.id === fr.id);
  if (!e || e.status !== CTR_S_OK || e.reg !== 'ask' || !e.reg_ask) return { text: e && e.reg && e.reg !== 'ask' ? '\u05db\u05d1\u05e8 \u05e0\u05e8\u05e9\u05dd \u05d1\u05de\u05e8\u05e9\u05dd \u05d4\u05e7\u05d1\u05dc\u05e0\u05d9\u05dd.' : GONE, ref: 'ctr-gone' };
  return ctrRegister(env, e, fr.n === 1 ? e.reg_ask : 'new');
}
// Michael's reason after "no": a fresh link to the same request, the entry open again with what was typed, and a draft
// to the contractor. deps.draft(body) = routine-db mail_draft -> {ok}. {text, ref}.
export async function fastCtrReason(env, fr, nowMs, deps) {
  const e = (await ctrEntries(env)).find((x) => x.id === fr.id);
  if (!e || e.status !== CTR_S_REJ || nowMs - (Date.parse(e.rej_at || '') || 0) > CTR_REASON_MS) return { text: GONE, ref: 'ctr-gone' };
  const reason = one(fr.text, 600);
  const ttl = linkTtlDays(e.kind, e.de, nowMs);
  if (!(ttl > 0)) {
    await ctrPatch(env, e.id, { status: 'closed', rej: reason }, CTR_S_REJ);
    return { text: '\u05e8\u05e9\u05de\u05ea\u05d9. \u05d4\u05e2\u05d1\u05d5\u05d3\u05d4 \u05e9\u05dc ' + one(e.company, 60) + ' \u05db\u05d1\u05e8 \u05d4\u05e1\u05ea\u05d9\u05d9\u05de\u05d4, \u05d0\u05d6 \u05d0\u05d9\u05df \u05e7\u05d9\u05e9\u05d5\u05e8 \u05dc\u05ea\u05d9\u05e7\u05d5\u05df. \u05dc\u05e2\u05d1\u05d5\u05d3\u05d4 \u05d7\u05d3\u05e9\u05d4 \u05d0\u05e4\u05e9\u05e8 \u05dc\u05d1\u05e7\u05e9 \u05de\u05d4\u05e2\u05d5\u05d6\u05e8 \u05e7\u05d9\u05e9\u05d5\u05e8 \u05d7\u05d3\u05e9.', ref: 'ctr-rej' };
  }
  const tok = await makeCtrToken(env, ctrLinkId(e.id, e.kind, e.ins, e.ds, e.de), ttl, nowMs);
  if (!tok) return { text: '\u05dc\u05d0 \u05d4\u05e6\u05dc\u05d7\u05ea\u05d9 \u05dc\u05d9\u05e6\u05d5\u05e8 \u05e7\u05d9\u05e9\u05d5\u05e8 \u05dc\u05ea\u05d9\u05e7\u05d5\u05df (\u05d4\u05e7\u05d9\u05e9\u05d5\u05e8\u05d9\u05dd \u05dc\u05d0 \u05de\u05d5\u05d2\u05d3\u05e8\u05d9\u05dd \u05d1\u05e9\u05e8\u05ea).', ref: 'ctr-rej' };
  const link = ctrUrl(tok), exp = new Date(nowMs + ttl * 864e5).toISOString(), expDay = ilDay(Date.parse(exp));
  const p = await ctrPatch(env, e.id, { status: CTR_S_SENT, rej: reason, rej_n: (Number(e.rej_n) || 0) + 1, at: null, files: null, ask_at: null, exp }, CTR_S_REJ);
  if (p.error) return { text: GONE, ref: 'ctr-gone' };
  let drafted = false;
  if (EMAIL_RE.test(String(e.email || '')) && deps && deps.draft) {
    const d = await deps.draft({ op: 'mail_draft', agent: 'ctr-link', why: 'contractor form returned for a fix (Michael: ' + reason.slice(0, 80) + ')',
      to: e.email, subject: '\u05ea\u05d9\u05e7\u05d5\u05df \u05d8\u05d5\u05e4\u05e1 \u05d0\u05d9\u05e9\u05d5\u05e8 \u05e7\u05d1\u05dc\u05df - ' + SITE.company, body: ctrDraftBody(e, reason, link, expDay) }).catch(() => null);
    drafted = !!(d && d.ok);
  }
  return drafted
    ? { text: '\u05d4\u05db\u05e0\u05ea\u05d9 \u05d8\u05d9\u05d5\u05d8\u05d4 \u05dc\u05e7\u05d1\u05dc\u05df ' + one(e.company, 60) + ' \u05e2\u05dd \u05d4\u05e1\u05d9\u05d1\u05d4 \u05d5\u05e7\u05d9\u05e9\u05d5\u05e8 \u05dc\u05ea\u05d9\u05e7\u05d5\u05df (\u05d1\u05ea\u05d5\u05e7\u05e3 \u05e2\u05d3 ' + dmy(expDay) + '). \u05d4\u05d9\u05d0 \u05ea\u05d5\u05e4\u05d9\u05e2 \u05d1\u05d8\u05d9\u05d5\u05d8\u05d5\u05ea \u05d1-Outlook \u05d1\u05ea\u05d5\u05da \u05db\u05de\u05d4 \u05d3\u05e7\u05d5\u05ea, \u05d5\u05d0\u05ea\u05d4 \u05e9\u05d5\u05dc\u05d7.', ref: 'ctr-rej' }
    : { text: '\u05dc\u05d0 \u05d4\u05e6\u05dc\u05d7\u05ea\u05d9 \u05dc\u05d4\u05db\u05d9\u05df \u05d8\u05d9\u05d5\u05d8\u05d4' + (EMAIL_RE.test(String(e.email || '')) ? '' : ' (\u05d0\u05d9\u05df \u05de\u05d9\u05d9\u05dc \u05ea\u05e7\u05d9\u05df \u05e9\u05dc \u05d4\u05e7\u05d1\u05dc\u05df)') + '. \u05d6\u05d4 \u05d4\u05e7\u05d9\u05e9\u05d5\u05e8 \u05dc\u05ea\u05d9\u05e7\u05d5\u05df, \u05d1\u05ea\u05d5\u05e7\u05e3 \u05e2\u05d3 ' + dmy(expDay) + ', \u05dc\u05d4\u05e2\u05d1\u05d9\u05e8 \u05dc\u05e7\u05d1\u05dc\u05df:\n' + link, ref: 'ctr-rej' };
}

// ---- the morning update (wa-morning run, after it went out) ----
// (1) a request still waiting: asked again; (2) an approval whose register write failed: written again; (3) a permanent
// contractor whose year ends within 30 days: a new link, sent to Michael to forward; (4) a temporary job that ended
// unanswered: closed; (5) a link not filled 3 days before it ends: told. Each at most CTR_MORNING_MAX.
export async function ctrMorning(env, now) {
  const nowMs = now.getTime(), out = { asked: 0, reg: 0, renew: 0, nag: 0, ended: 0 };
  let list = await ctrEntries(env);
  // (4) a temporary job that ended while its request waited: closed with one message, before the asks below
  for (const e of endedDue(list, ilDay(nowMs)).slice(0, CTR_MORNING_MAX)) {
    const p = await ctrPatch(env, e.id, { status: CTR_S_CLOSED, closed: 'ended', closed_at: now.toISOString() }, CTR_S_FILLED);
    if (p.error) continue;
    out.ended++;
    await ctrSay(env, endedText(e), 'ctr-ended', null);
  }
  if (out.ended) list = await ctrEntries(env);
  // (5) a link the contractor did not fill, ending within three days: told once (a held message counts, it comes on Sunday)
  for (const e of nagDue(list, nowMs).slice(0, CTR_MORNING_MAX)) {
    const s = await ctrSay(env, nagText(e), 'ctr-nag', null);
    if (!s.ok) continue;
    out.nag++;
    await ctrPatch(env, e.id, { nag: e.exp }, CTR_S_SENT);
  }
  for (const e of list.filter((x) => x.status === CTR_S_FILLED && x.files != null && nowMs - (Date.parse(x.ask_at || '') || 0) > CTR_AGAIN_MS).slice(0, CTR_MORNING_MAX)) {
    if ((await ctrAsk(env, e.id, nowMs)).ok) out.asked++;
  }
  for (const e of list.filter((x) => x.status === CTR_S_OK && !x.reg).slice(0, CTR_MORNING_MAX)) {
    const r = await ctrRegister(env, e, null);
    if (r.ref !== 'ctr-reg-fail') { out.reg++; if (r.choices) await ctrSay(env, r.text, r.ref, r.choices); }
  }
  // an approval whose new-worker link did not go out (no link then): the link to Michael, to forward
  for (const e of list.filter((x) => x.status === CTR_S_OK && !x.wlink && x.files != null && String(x.ok_at || '') >= CTR_WLINK_SINCE).slice(0, CTR_MORNING_MAX)) {
    const w = await ctrWorkerSend(env, e, nowMs, null);
    if (w.line) { await ctrSay(env, '\u05e7\u05d1\u05dc\u05df \u05e9\u05d0\u05d9\u05e9\u05e8\u05ea, ' + one(e.company, 60) + ':\n' + w.line, 'ctr-wlink', null); out.wlink = (out.wlink || 0) + 1; }
  }
  const today = ilDay(nowMs);
  const rows = await sb(env, 'ctr?select=id,n,ty,e,s&limit=2000').catch(() => []);
  const st = await sb(env, 'server_state?select=value&key=eq.' + CTR_RENEW_KEY).catch(() => null);
  let done = {}; try { done = JSON.parse((st && st[0] && st[0].value) || '{}') || {}; } catch (x) { done = {}; }
  const mark = (id, val) => stateCas(sbFrom(env), hdr(env), CTR_RENEW_KEY, (cur) => {
    let m = {}; try { m = JSON.parse(cur || '{}') || {}; } catch (x) { m = {}; }
    m[id] = val;
    return { value: JSON.stringify(m) };
  }, () => tmo(SB_TIMEOUT_MS)).catch(() => null);
  for (const r of renewDue(rows, today, done).slice(0, CTR_MORNING_MAX)) {
    // a link made on an earlier morning whose message did not go out is sent again, not made again (security review 16/11/2026)
    const kept = done[r.id] && typeof done[r.id] === 'object' && done[r.id].e === r.e ? done[r.id] : null;
    let text = kept && kept.text;
    if (!text) {
      const prevE = list.find((x) => x.reg === r.id);
      const v = { kind: 'perm', ins: prevE ? !!prevE.ins : false, ds: null, de: null, company: one(r.n, 80) };
      const c = await ctrLinkCreate(env, sbFrom(env), hdr(env), v, nowMs).catch((x) => ({ error: String(x && x.message) }));
      if (!c || !c.ok) { out.renew_err = String((c && c.error) || 'link').slice(0, 80); continue; }
      text = '\u05d4\u05d0\u05d9\u05e9\u05d5\u05e8 \u05e9\u05dc ' + one(r.n, 60) + ' \u05d1\u05de\u05e8\u05e9\u05dd \u05d4\u05e7\u05d1\u05dc\u05e0\u05d9\u05dd \u05e0\u05d2\u05de\u05e8 \u05d1-' + dmy(r.e) + '. \u05d4\u05db\u05e0\u05ea\u05d9 \u05e7\u05d9\u05e9\u05d5\u05e8 \u05d7\u05d3\u05e9 \u05dc\u05d0\u05d9\u05e9\u05d5\u05e8 \u05dc\u05e9\u05e0\u05d4 \u05d4\u05d1\u05d0\u05d4:\n\n' + c.text;
      await mark(r.id, { e: r.e, text });
    }
    const s = await ctrSay(env, text, 'ctr-renew', null);
    if (!s.ok || s.held) continue;
    out.renew++;
    await mark(r.id, r.e);
  }
  return out;
}
