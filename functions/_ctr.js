// The contractor approval link (15/11/2026, Michael: "a link I ask the WhatsApp assistant for, that I send to a
// contractor: a temporary job or a permanent contractor for an annual approval; by the works they tick, they must
// attach the relevant documents; then a copy of the files to my mail"; "it is a kind of insurance for me that the
// contractors were trained and are approved to work"; "the contractor must commit that a new worker fills a new form").
// Procedure: contractors 15/04/2025, 3.1.5 insurance certificate signed by the insurer, 3.1.6 the contractor trains
// its own workers, 3.2.1 the documents per task.
//
// Pure helpers and constants shared by functions/api/ctr-link.js (the contractor's page), functions/api/talk.js (each
// worker of the contractor signs the safety instructions, kind KIND_CTR) and functions/api/routine-db.js (op ctr_link).
// No imports: talk.js and ctr-link.js both load this file, and neither may load the other at the top.

// The toolbox_talks kind of a contractor's instructions talk: one talk per request; its permanent link is the
// "new worker" link the contractor keeps. Never a factory training: every list of trainings leaves it out.
export const KIND_CTR = 'contractor';
export const CTR_PREFIX = 'ctr-link:v1:';
export const CTR_TTL_DAYS = 14;
export const CTR_WORKER_DAYS = 365;      // a permanent contractor: the new-worker link lasts the year of the approval
export const CTR_STATE = 'ctr_links';    // server_state: the requests, newest first
export const CTR_STATE_MAX = 200;
export const CTR_INSTR = 'ctr_instructions'; // server_state: the text of form 146.03, set by Michael
export const CTR_KIND_L = { perm: '\u05e7\u05d1\u05dc\u05df \u05e7\u05d1\u05d5\u05e2, \u05d0\u05d9\u05e9\u05d5\u05e8 \u05e9\u05e0\u05ea\u05d9', temp: '\u05e2\u05d1\u05d5\u05d3\u05d4 \u05d6\u05de\u05e0\u05d9\u05ea' };
export const CTR_S_SENT = 'sent', CTR_S_FILLED = 'filled';
// A send that was cut (security review 16/11/2026: the Worker stopped after the claim and before its last write, so the
// request said "filled" with no files and the contractor could not send again): filled, no "files" (the last write
// never came) and claimed more than this long ago = it may be sent again from the same link.
export const CTR_STUCK_MS = 10 * 60 * 1000;
export const isStuck = (e, nowMs) => !!e && e.status === CTR_S_FILLED && e.files == null && nowMs - (Date.parse(e.at || '') || 0) > CTR_STUCK_MS;
// May this request be sent now: never sent, or a cut send.
export const canSend = (e, nowMs) => !!e && (e.status === CTR_S_SENT || isStuck(e, nowMs));

// The works the contractor ticks: the 8 kinds of the weekly works list (works.js CATS) and the forklift, which only a
// contractor brings.
export const CTR_WORKS = ['hot', 'hgt', 'elc', 'eng', 'lft', 'chm', 'cnf', 'rof', 'frk'];
export const FRK_L = '\u05e2\u05d1\u05d5\u05d3\u05d4 \u05e2\u05dd \u05de\u05dc\u05d2\u05d6\u05d4';
// The documents (Michael's table, 15/11/2026). The workers list is no document since 16/11/2026: each worker is a row
// with name, ID and finger signature on the page (DECISIONS "\u05e7\u05d9\u05e9\u05d5\u05e8 \u05e7\u05d1\u05dc\u05df: \u05db\u05dc \u05d4\u05e2\u05d5\u05d1\u05d3\u05d9\u05dd \u05d7\u05d5\u05ea\u05de\u05d9\u05dd \u05d1\u05e7\u05d9\u05e9\u05d5\u05e8 \u05d0\u05d7\u05d3").
export const CTR_DOCS = [
  ['ins', '\u05d0\u05d9\u05e9\u05d5\u05e8 \u05e7\u05d9\u05d5\u05dd \u05d1\u05d9\u05d8\u05d5\u05d7\u05d9\u05dd \u05d7\u05ea\u05d5\u05dd \u05d1\u05d9\u05d3\u05d9 \u05d7\u05d1\u05e8\u05ea \u05d4\u05d1\u05d9\u05d8\u05d5\u05d7'],
  ['hgtc', '\u05ea\u05e2\u05d5\u05d3\u05ea \u05d4\u05e1\u05de\u05db\u05d4 \u05dc\u05e2\u05d1\u05d5\u05d3\u05d4 \u05d1\u05d2\u05d5\u05d1\u05d4 \u05dc\u05db\u05dc \u05e2\u05d5\u05d1\u05d3'],
  ['plat', '\u05ea\u05e1\u05e7\u05d9\u05e8 \u05d1\u05d5\u05d3\u05e7 \u05de\u05d5\u05e1\u05de\u05da \u05dc\u05d1\u05de\u05ea \u05d4\u05d4\u05e8\u05de\u05d4 \u05d0\u05d5 \u05dc\u05de\u05ea\u05e7\u05df \u05d4\u05d4\u05e8\u05de\u05d4'],
  ['elcl', '\u05e8\u05d9\u05e9\u05d9\u05d5\u05df \u05d7\u05e9\u05de\u05dc\u05d0\u05d9'],
  ['crane', '\u05ea\u05e1\u05e7\u05d9\u05e8\u05d9 \u05d1\u05d5\u05d3\u05e7 \u05de\u05d5\u05e1\u05de\u05da \u05dc\u05e2\u05d2\u05d5\u05e8\u05df \u05d5\u05dc\u05d0\u05d1\u05d9\u05d6\u05e8\u05d9 \u05d4\u05d4\u05e8\u05de\u05d4'],
  ['oper', '\u05e8\u05d9\u05e9\u05d9\u05d5\u05df \u05de\u05e4\u05e2\u05d9\u05dc \u05e2\u05d2\u05d5\u05e8\u05df'],
  ['sds', '\u05d2\u05d9\u05dc\u05d9\u05d5\u05e0\u05d5\u05ea \u05d1\u05d8\u05d9\u05d7\u05d5\u05ea (SDS) \u05e9\u05dc \u05d4\u05d7\u05d5\u05de\u05e8\u05d9\u05dd'],
  ['cnft', '\u05ea\u05e2\u05d5\u05d3\u05ea \u05d4\u05d3\u05e8\u05db\u05d4 \u05dc\u05e2\u05d1\u05d5\u05d3\u05d4 \u05d1\u05d7\u05dc\u05dc \u05de\u05d5\u05e7\u05e3'],
  ['frkl', '\u05e8\u05d9\u05e9\u05d9\u05d5\u05df \u05e0\u05d4\u05d9\u05d2\u05d4 \u05d1\u05de\u05dc\u05d2\u05d6\u05d4'],
  ['oth', '\u05de\u05e1\u05de\u05db\u05d9\u05dd \u05e0\u05d5\u05e1\u05e4\u05d9\u05dd (\u05dc\u05d0 \u05d7\u05d5\u05d1\u05d4)'],
];
export const CTR_DOC_L = Object.fromEntries(CTR_DOCS);
export const CTR_REQ = { hot: [], hgt: ['hgtc', 'plat'], elc: ['elcl'], eng: [], lft: ['crane', 'oper'], chm: ['sds'], cnf: ['cnft'], rof: ['hgtc', 'plat'], frk: ['frkl'] };

// Required documents for the works ticked, in the order of CTR_DOCS. ins = the link says "with insurance".
export function requiredDocs(works, ins) {
  const want = new Set();
  if (ins) want.add('ins');
  for (const w of works || []) for (const d of (CTR_REQ[w] || [])) want.add(d);
  return CTR_DOCS.map((d) => d[0]).filter((k) => want.has(k));
}
// What may be attached but is not required: the insurance when the link does not ask for it, and "other".
export const optionalDocs = (ins) => (ins ? ['oth'] : ['ins', 'oth']);
// have = {docKey: number of files}. Returns the missing keys.
export function missingDocs(required, have) {
  return (required || []).filter((k) => !(have && have[k] > 0));
}
// The workers who sign on the contractor's own page, all on one phone (16/11/2026): at most this many in one send
// (each signature is a picture in form 146.03 and a row of the talk); more come through the new-worker link.
export const CTR_SIGN_MAX = 30;
export const DESC_MAX = 600;   // the work's description, as the permit's (works.js desc)
export const missingMsg = (keys) => (keys || []).map((k) => '\u05d7\u05e1\u05e8 \u05de\u05e1\u05de\u05da: ' + (CTR_DOC_L[k] || k));

// ---- the link id: <request>-<p|t><0|1>[-<YYYYMMDD start>-<YYYYMMDD end>] ----
export const RID_RE = /^c[0-9a-z]{6,16}$/;
const ymd8 = (s) => String(s || '').replace(/-/g, '');
const ymdOf = (s) => s.slice(0, 4) + '-' + s.slice(4, 6) + '-' + s.slice(6, 8);
const okDay = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s) && new Date(s + 'T00:00:00Z').toISOString().slice(0, 10) === s;
export function ctrLinkId(rid, kind, ins, ds, de) {
  return rid + '-' + (kind === 'temp' ? 't' : 'p') + (ins ? '1' : '0') + (kind === 'temp' ? '-' + ymd8(ds) + '-' + ymd8(de) : '');
}
export function parseCtrLinkId(id) {
  const m = /^(c[0-9a-z]{6,16})-([pt])([01])(?:-(\d{8})-(\d{8}))?$/.exec(String(id || ''));
  if (!m) return null;
  const kind = m[2] === 't' ? 'temp' : 'perm';
  if ((kind === 'temp') !== !!m[4]) return null;
  const ds = m[4] ? ymdOf(m[4]) : null, de = m[5] ? ymdOf(m[5]) : null;
  if (kind === 'temp' && (!okDay(ds) || !okDay(de) || de < ds)) return null;
  return { rid: m[1], kind, ins: m[3] === '1', ds, de };
}
export const addDays = (ymd, n) => new Date(Date.parse(ymd + 'T00:00:00Z') + n * 86400000).toISOString().slice(0, 10);
// The end of the day after the job ends, Israel winter time (a summer hour later at worst).
export const jobEndMs = (de) => Date.parse(addDays(de, 2) + 'T00:00:00+02:00');
// Days the main link is valid: 14, or until the day after a temporary job ends when that is sooner. <= 0 = ended.
export function linkTtlDays(kind, de, nowMs) {
  if (kind !== 'temp') return CTR_TTL_DAYS;
  return Math.min(CTR_TTL_DAYS, (jobEndMs(de) - nowMs) / 86400000);
}
// The new-worker link: a year for a permanent contractor; for a job, until the day after it ends.
export function workerTtlDays(kind, de, nowMs) {
  if (kind !== 'temp') return CTR_WORKER_DAYS;
  return Math.max(1 / 24, (jobEndMs(de) - nowMs) / 86400000);
}

// ---- the folder in OneDrive ----
export const CTR_DIR = '\u05e9\u05d5\u05dc\u05d7\u05df \u05d4\u05e2\u05d1\u05d5\u05d3\u05d4/\u05e0\u05d9\u05d4\u05d5\u05dc \u05d1\u05d8\u05d9\u05d7\u05d5\u05ea/11_\u05d4\u05d3\u05e8\u05db\u05d5\u05ea/03_\u05d4\u05d3\u05e8\u05db\u05d5\u05ea \u05e7\u05d1\u05dc\u05e0\u05d9 \u05d7\u05d5\u05e5';
// A company name as one folder name: no slash, backslash or other character OneDrive refuses, no control or
// direction characters, no dots at the ends (".." is no way up), at most 60 characters. Nothing left = a fixed name.
export function safeName(v, max) {
  const s = String(v == null ? '' : v)
    .replace(/[\u0000-\u001f\u007f\u200b-\u200f\u202a-\u202e\u2066-\u2069\ufeff]/g, ' ')
    .replace(/[\\/:*?"<>|#%~&{}]/g, ' ')
    .replace(/\s+/g, ' ').trim().slice(0, max || 60)
    .replace(/^[.\s]+|[.\s]+$/g, '');
  return s || '\u05e7\u05d1\u05dc\u05df';
}
export const ctrFolder = (company, year) => CTR_DIR + '/\u05e2\u05d1\u05d5\u05d3\u05d5\u05ea \u05e7\u05d1\u05dc\u05df ' + String(year).replace(/\D/g, '').slice(0, 4) + '/' + safeName(company);

// ---- server_state ctr_links (written with stateCas only) ----
export function stateList(raw) {
  let v = raw;
  if (typeof v === 'string') { try { v = JSON.parse(v); } catch (e) { v = null; } }
  return Array.isArray(v) ? v.filter((x) => x && typeof x === 'object' && RID_RE.test(String(x.id || ''))) : [];
}
export function stateAdd(raw, entry) {
  const list = stateList(raw).filter((x) => x.id !== entry.id);
  return [entry].concat(list).slice(0, CTR_STATE_MAX);
}
// Patch one entry; when = the status it must have now (else {error:'state'}); {error:'missing'} when it is not there.
// when may also be a function(entry, i.e. its row) -> true when the patch may go.
export function statePatch(raw, id, patch, when) {
  const list = stateList(raw);
  const i = list.findIndex((x) => x.id === id);
  if (i < 0) return { error: 'missing' };
  if (when && (typeof when === 'function' ? !when(list[i]) : list[i].status !== when)) return { error: 'state', status: list[i].status };
  list[i] = Object.assign({}, list[i], patch);
  return { list };
}

// ---- the instructions text ----
export const INSTR_MISSING = '\u05d8\u05e7\u05e1\u05d8 \u05d4\u05d5\u05e8\u05d0\u05d5\u05ea \u05d4\u05d1\u05d8\u05d9\u05d7\u05d5\u05ea \u05dc\u05e7\u05d1\u05dc\u05e0\u05d9 \u05d7\u05d5\u05e5 (\u05d8\u05d5\u05e4\u05e1 146.03) \u05e2\u05d5\u05d3 \u05dc\u05d0 \u05d4\u05d5\u05d6\u05df \u05d1\u05de\u05e2\u05e8\u05db\u05ea.';
export const isInstrMissing = (body) => !String(body || '').trim() || String(body).indexOf(INSTR_MISSING) === 0;
export const instrText = (v) => { const s = String(v == null ? '' : v).trim(); return s.length >= 20 ? s.slice(0, 20000) : ''; };
// The worker's declaration on the signing page.
export const CTR_OK = '\u05d0\u05e0\u05d9 \u05de\u05d0\u05e9\u05e8/\u05ea \u05e9\u05e7\u05e8\u05d0\u05ea\u05d9 \u05d0\u05ea \u05d4\u05d5\u05e8\u05d0\u05d5\u05ea \u05d4\u05d1\u05d8\u05d9\u05d7\u05d5\u05ea \u05dc\u05e7\u05d1\u05dc\u05e0\u05d9 \u05d7\u05d5\u05e5 \u05e9\u05dc \u05d4\u05de\u05e4\u05e2\u05dc, \u05d4\u05d1\u05e0\u05ea\u05d9 \u05d0\u05d5\u05ea\u05df \u05d5\u05d0\u05e4\u05e2\u05dc \u05dc\u05e4\u05d9\u05d4\u05df.';
export const CTR_TITLE = '\u05d4\u05d5\u05e8\u05d0\u05d5\u05ea \u05d1\u05d8\u05d9\u05d7\u05d5\u05ea \u05dc\u05e7\u05d1\u05dc\u05e0\u05d9 \u05d7\u05d5\u05e5';
// The contractor manager's commitment (procedure 3.1.6).
export const CTR_COMMIT = '\u05d0\u05e0\u05d9, \u05de\u05e0\u05d4\u05dc \u05d4\u05e2\u05d1\u05d5\u05d3\u05d4 \u05de\u05d8\u05e2\u05dd \u05d4\u05e7\u05d1\u05dc\u05df, \u05de\u05ea\u05d7\u05d9\u05d9\u05d1/\u05ea \u05e9\u05db\u05dc \u05e2\u05d5\u05d1\u05d3 \u05d7\u05d3\u05e9 \u05e9\u05dc\u05e0\u05d5 \u05d9\u05de\u05dc\u05d0 \u05d5\u05d9\u05d7\u05ea\u05d5\u05dd \u05e2\u05dc \u05d8\u05d5\u05e4\u05e1 \u05d4\u05d4\u05d3\u05e8\u05db\u05d4 \u05d1\u05e7\u05d9\u05e9\u05d5\u05e8 \u05dc\u05e2\u05d5\u05d1\u05d3 \u05d7\u05d3\u05e9 \u05dc\u05e4\u05e0\u05d9 \u05e9\u05d9\u05d9\u05db\u05e0\u05e1 \u05dc\u05de\u05e4\u05e2\u05dc, \u05d5\u05e9\u05d4\u05de\u05e1\u05de\u05db\u05d9\u05dd \u05e9\u05e6\u05d9\u05e8\u05e4\u05ea\u05d9 \u05e0\u05db\u05d5\u05e0\u05d9\u05dd \u05d5\u05d1\u05ea\u05d5\u05e7\u05e3.';
