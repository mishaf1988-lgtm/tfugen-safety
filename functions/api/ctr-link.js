// Cloudflare Pages Function: the contractor approval link (15/11/2026, phase 1; functions/_ctr.js has the why).
//
//   routine-db op ctr_link   the WhatsApp assistant asks for a link (ctrLinkCheck + ctrLinkCreate below): a request in
//                            server_state ctr_links, a draft talk of kind 'contractor', and the URL text that Michael
//                            forwards himself. The server never sends anything to the contractor.
//   GET  ?k=<token>          the contractor's page: company, company number, contact, mobile, email; for a job its dates
//                            (from the link) and place; the works (the 8 kinds of works.js and the forklift); the
//                            documents those works need (CTR_REQ), each a file field; the workers list (typed, or a file);
//                            the manager's commitment and finger signature. Once sent: the new-worker link.
//   POST multipart           checked on the server whatever the page did: every field, every file by its bytes (PDF / JPG /
//                            PNG, MAX_FILE each, CTR_MAX_FILES and CTR_MAX_TOTAL in all), every required document by
//                            name. Then: the files and a signed summary into the contractor's folder in OneDrive, the
//                            talk published (its permanent link is the new-worker link), one mail to Michael with the
//                            files attached up to MAIL_BUDGET (links beyond it), and the request marked filled.
//
// The token (ctr-link:v1, its own prefix) is the only gate, like /api/works and /api/talk: it carries the request id, the
// kind (perm / temp), "with insurance", and for a job its dates; it runs out after 14 days, or the day after the job ends.
// The page shows nothing of the factory beyond what the link holder typed. A request can be sent once; to fix it Michael
// asks for a new link. Posts are counted per address (guess_hit, CTR_POSTS_HOUR an hour).
// Not in MACHINE_PATHS: a person opens it, so the Israel-only rule applies.
import { sbFrom, SITE, SB_LIVE, ipBucket } from '../_shared.js';
import { makeLinkToken, readLinkToken } from '../_closelink.js';
import { accessToken, putFile, sendMailTo } from '../_onedrive.js';
import { stateCas } from '../_cas.js';
import { CATS, fileType, MAX_FILE, clean, page, dmy } from './works.js';
import { makePermToken, talkUrl, sigBytes, idOf, graphPdf, PAD_JS } from './talk.js';
import { KIND_CTR, CTR_PREFIX, CTR_STATE, CTR_INSTR, CTR_KIND_L, CTR_S_SENT, CTR_S_FILLED, CTR_WORKS, FRK_L, CTR_DOCS, CTR_DOC_L, requiredDocs, optionalDocs,
  missingDocs, missingMsg, RID_RE, ctrLinkId, parseCtrLinkId, linkTtlDays, workerTtlDays, addDays, ctrFolder, safeName, stateList, stateAdd, statePatch,
  INSTR_MISSING, instrText, CTR_TITLE, CTR_COMMIT } from '../_ctr.js';

let SB = SB_LIVE; // set from env in onRequest (sbFrom)
export const FETCH_MS = 15000;
const fetch = (u, o) => globalThis.fetch(u, o && o.signal ? o : { ...(o || {}), signal: AbortSignal.timeout(FETCH_MS) });
// The network calls a test replaces (Graph only; Supabase goes through fetch).
export const ctrDeps = { accessToken, putFile, sendMailTo, graphPdf };

export const CTR_MAX_FILES = 15, CTR_MAX_TOTAL = 15 * 1024 * 1024, CTR_MAX_BODY = CTR_MAX_TOTAL + 1024 * 1024;
export const MAIL_BUDGET = 2500 * 1024;   // the files attached to the mail, in all; the rest go as links
export const CTR_POSTS_HOUR = 20;
export const MAX_WORKERS = 200;
// At most this many links a day (an assistant in a loop would otherwise fill toolbox_talks with drafts).
export const CTR_DAY_MAX = 20;
const S_DRAFT = '\u05d8\u05d9\u05d5\u05d8\u05d4', S_PUB = '\u05e4\u05d5\u05e8\u05e1\u05de\u05d4';
const TZ = 'Asia/Jerusalem';
export const ilDay = (ms) => new Date(ms).toLocaleDateString('en-CA', { timeZone: TZ });

// The label of each work: the works list's own names, and the forklift.
export const workLabel = (k) => (k === 'frk' ? FRK_L : ((CATS.find((c) => c.k === k) || {}).t || k));

function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }
function sbH(env, extra) { const k = env.SUPABASE_SERVICE_ROLE_KEY; return { apikey: k, Authorization: 'Bearer ' + k, ...(extra || {}) }; }
const newNonce = () => Array.from(crypto.getRandomValues(new Uint8Array(12))).map((b) => b.toString(16).padStart(2, '0')).join('');
function b64(u8) { let out = ''; for (let i = 0; i < u8.length; i += 0x8000) out += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(out); }

// ---- the token ----
export function makeCtrToken(env, id, ttlDays, nowMs) { return makeLinkToken(env, CTR_PREFIX, id, ttlDays, nowMs); }
export async function readCtrToken(env, tok, nowMs) {
  const r = await readLinkToken(env, CTR_PREFIX, String(tok || '').slice(0, 300), nowMs);
  if (r.error) return r;
  const p = parseCtrLinkId(r.id);
  return p ? Object.assign({ id: r.id }, p) : { error: 'bad' };
}
export const ctrUrl = (tok) => SITE.appUrl + '/api/ctr-link?k=' + encodeURIComponent(tok);

// ---- routine-db op ctr_link ----
// Pure. b = the op body; today = YYYY-MM-DD (Israel). {v: {kind, ins, ds, de, company}} or {error}.
export const CTR_OP_FIELDS = ['op', 'agent', 'why', 'company', 'kind', 'ins', 'ds', 'de'];
export function ctrLinkCheck(b, today) {
  for (const k of Object.keys(b || {})) if (CTR_OP_FIELDS.indexOf(k) < 0) return { error: 'field not allowed: ' + k };
  const kind = String(b.kind || '');
  if (kind !== 'perm' && kind !== 'temp') return { error: 'kind must be perm or temp' };
  if (b.ins !== true && b.ins !== false) return { error: 'ins must be true or false (Michael says with or without insurance)' };
  const company = b.company == null ? '' : clean(b.company, 80);
  if (company.length > 80) return { error: 'company too long' };
  if (b.company != null && String(b.company).trim() && company.length < 2) return { error: 'company too short' };
  let ds = null, de = null;
  if (kind === 'temp') {
    ds = String(b.ds || ''); de = String(b.de || '');
    const ok = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s) && new Date(s + 'T00:00:00Z').toISOString().slice(0, 10) === s;
    if (!ok(ds) || !ok(de)) return { error: 'ds and de (YYYY-MM-DD) are required for a temp job' };
    if (de < ds) return { error: 'de before ds' };
    if (de < today) return { error: 'the job already ended' };
    if (ds > addDays(today, 366) || de > addDays(ds, 366)) return { error: 'dates too far' };
  } else if (b.ds != null || b.de != null) return { error: 'field not allowed: ' + (b.ds != null ? 'ds' : 'de') + ' (only for kind temp)' };
  return { v: { kind, ins: b.ins, ds, de, company } };
}
// The text Michael forwards (keyboard characters only, people-text.md).
export function ctrLinkText(v, url, expDay, instrMissing) {
  const who = v.company ? '\u05dc\u05e7\u05d1\u05dc\u05df ' + v.company : '\u05dc\u05e7\u05d1\u05dc\u05df';
  const lines = ['\u05e7\u05d9\u05e9\u05d5\u05e8 ' + who + ' (' + CTR_KIND_L[v.kind] + (v.kind === 'temp' ? ', ' + dmy(v.ds) + ' \u05e2\u05d3 ' + dmy(v.de) : '') + ', ' + (v.ins ? '\u05e2\u05dd \u05d0\u05d9\u05e9\u05d5\u05e8 \u05d1\u05d9\u05d8\u05d5\u05d7' : '\u05d1\u05dc\u05d9 \u05d7\u05d5\u05d1\u05ea \u05d1\u05d9\u05d8\u05d5\u05d7') + '), \u05d1\u05ea\u05d5\u05e7\u05e3 \u05e2\u05d3 ' + dmy(expDay) + ':',
    url,
    '\u05dc\u05d4\u05e2\u05d1\u05d9\u05e8 \u05dc\u05e7\u05d1\u05dc\u05df \u05d1\u05e2\u05e6\u05de\u05da. \u05d4\u05e7\u05d1\u05dc\u05df \u05de\u05de\u05dc\u05d0 \u05e4\u05e8\u05d8\u05d9\u05dd, \u05de\u05e1\u05de\u05db\u05d9\u05dd \u05d5\u05d7\u05ea\u05d9\u05de\u05d4, \u05d5\u05d0\u05d6 \u05de\u05e7\u05d1\u05dc \u05e7\u05d9\u05e9\u05d5\u05e8 \u05dc\u05e2\u05d5\u05d1\u05d3 \u05d7\u05d3\u05e9. \u05d4\u05e2\u05ea\u05e7 \u05e9\u05dc \u05d4\u05db\u05d5\u05dc \u05d9\u05d2\u05d9\u05e2 \u05d0\u05dc\u05d9\u05da \u05d1\u05de\u05d9\u05d9\u05dc.'];
  if (instrMissing) lines.push('\u05e9\u05d9\u05dd \u05dc\u05d1: \u05d8\u05e7\u05e1\u05d8 \u05d4\u05d5\u05e8\u05d0\u05d5\u05ea \u05d4\u05d1\u05d8\u05d9\u05d7\u05d5\u05ea \u05dc\u05e7\u05d1\u05dc\u05e0\u05d9\u05dd (\u05d8\u05d5\u05e4\u05e1 146.03) \u05e2\u05d5\u05d3 \u05dc\u05d0 \u05d4\u05d5\u05d6\u05df, \u05d5\u05e2\u05d5\u05d1\u05d3\u05d9 \u05d4\u05e7\u05d1\u05dc\u05df \u05dc\u05d0 \u05d9\u05d5\u05db\u05dc\u05d5 \u05dc\u05d7\u05ea\u05d5\u05dd \u05e2\u05d3 \u05e9\u05d9\u05d5\u05d6\u05df.');
  return lines.join('\n');
}
// The request: the talk (a draft until the contractor sends the form), the state entry, the link. url/h = routine-db's.
export async function ctrLinkCreate(env, url, h, v, nowMs) {
  const rid = 'c' + nowMs.toString(36) + Array.from(crypto.getRandomValues(new Uint8Array(3))).map((b) => b.toString(16).padStart(2, '0')).join('');
  if (!RID_RE.test(rid)) return { error: 'id' };
  const ttl = linkTtlDays(v.kind, v.de, nowMs);
  if (!(ttl > 0)) return { error: 'the job already ended' };
  const tok = await makeCtrToken(env, ctrLinkId(rid, v.kind, v.ins, v.ds, v.de), ttl, nowMs);
  if (!tok) return { error: 'links not configured (TRUSTEE_NOTIFY_SECRET)' };
  const today = ilDay(nowMs), exp = new Date(nowMs + ttl * 86400000).toISOString();
  const sr = await globalThis.fetch(url + '/rest/v1/server_state?select=value&key=eq.' + CTR_STATE, { headers: h, signal: AbortSignal.timeout(FETCH_MS) });
  if (!sr.ok) return { error: 'state read ' + sr.status };
  const srows = await sr.json();
  if (stateList(srows && srows[0] && srows[0].value).filter((x) => ilDay(Date.parse(x.created_at) || 0) === today).length >= CTR_DAY_MAX) return { error: 'max ' + CTR_DAY_MAX + ' contractor links a day' };
  const tw = await globalThis.fetch(url + '/rest/v1/toolbox_talks', { method: 'POST', headers: { ...h, Prefer: 'return=minimal' }, signal: AbortSignal.timeout(FETCH_MS),
    body: JSON.stringify([{ id: 'ctr-' + rid, kind: KIND_CTR, s: S_DRAFT, d: today, title: CTR_TITLE + (v.company ? ': ' + v.company : ''), dept: v.company || null, body: null, link_v: 0, ts: new Date(nowMs).toISOString() }]) });
  if (!tw.ok) return { error: 'talk write ' + tw.status };
  const entry = { id: rid, kind: v.kind, ins: v.ins, ds: v.ds, de: v.de, company: v.company || '', created_at: new Date(nowMs).toISOString(), exp, status: CTR_S_SENT, talk: 'ctr-' + rid };
  const w = await stateCas(url, h, CTR_STATE, (cur) => ({ value: JSON.stringify(stateAdd(cur, entry)) }), () => AbortSignal.timeout(FETCH_MS));
  if (!w.written) return { error: 'state write failed' };
  let instrMissing = true;
  try {
    const r = await globalThis.fetch(url + '/rest/v1/server_state?select=value&key=eq.' + CTR_INSTR, { headers: h, signal: AbortSignal.timeout(FETCH_MS) });
    const rows = r.ok ? await r.json() : [];
    instrMissing = !instrText(rows && rows[0] && rows[0].value);
  } catch (e) { /* said as missing */ }
  const link = ctrUrl(tok), expDay = ilDay(Date.parse(exp));
  return { ok: true, id: rid, url: link, exp: expDay, instructions_missing: instrMissing, text: ctrLinkText(v, link, expDay, instrMissing) };
}

// ---- reading the form (pure once the files are read) ----
export const LIM = { company: 80, contact: 60, email: 100, place: 120, signer: 60, workers: 8000 };
const MOBILE_RE = /^(?:\+?972|0)5\d{8}$/, EMAIL_RE = /^[^\s@<>"']{1,64}@[A-Za-z0-9.-]{1,120}\.[A-Za-z]{2,}$/;
// The workers typed: one per line, a name and an ID or passport number. {list} or {error}.
export function parseWorkers(text) {
  const out = [], lines = String(text || '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length > MAX_WORKERS) return { error: '\u05d0\u05e4\u05e9\u05e8 \u05e2\u05d3 ' + MAX_WORKERS + ' \u05e2\u05d5\u05d1\u05d3\u05d9\u05dd \u05d1\u05e8\u05e9\u05d9\u05de\u05d4.' };
  for (let i = 0; i < lines.length; i++) {
    const m = /^(.*?)[\s,;:\-]+([0-9A-Za-z][0-9A-Za-z.\-]{4,19})$/.exec(lines[i]);
    const id = m && /\d/.test(m[2]) ? idOf(m[2]) : null, name = m ? clean(m[1], 60) : '';
    if (!id || name.length < 2 || name.length > 60) return { error: '\u05e8\u05e9\u05d9\u05de\u05ea \u05d4\u05e2\u05d5\u05d1\u05d3\u05d9\u05dd, \u05e9\u05d5\u05e8\u05d4 ' + (i + 1) + ': \u05e6\u05e8\u05d9\u05da \u05e9\u05dd \u05d5\u05de\u05e1\u05e4\u05e8 \u05ea\u05e2\u05d5\u05d3\u05ea \u05d6\u05d4\u05d5\u05ea \u05d0\u05d5 \u05d3\u05e8\u05db\u05d5\u05df \u05d1\u05d0\u05d5\u05ea\u05d4 \u05e9\u05d5\u05e8\u05d4.' };
    out.push({ n: name, id });
  }
  return { list: out };
}
// f = the text fields (a plain object), files = [{doc, size, type}] where type comes from the bytes (null = not a PDF, JPG
// or PNG), t = the token. {v} or {errors: [...]} (each a sentence the contractor reads).
export function checkCtrForm(f, files, t) {
  const errors = [], v = {};
  const txt = (k, max, multi) => { const s = clean(f[k], max, multi); if (s.length > max) { errors.push('\u05d4\u05d8\u05e7\u05e1\u05d8 \u05d1\u05e9\u05d3\u05d4 \u05d0\u05e8\u05d5\u05da \u05de\u05d3\u05d9.'); return ''; } return s; };
  v.company = txt('company', LIM.company);
  if (v.company.length < 2) errors.push('\u05d7\u05e1\u05e8 \u05e9\u05dd \u05d4\u05d7\u05d1\u05e8\u05d4.');
  v.cnum = String(f.cnum || '').replace(/[\s.-]/g, '');
  if (!/^\d{9}$/.test(v.cnum)) errors.push('\u05de\u05e1\u05e4\u05e8 \u05d4\u05d7\u05d1\u05e8\u05d4 (\u05d7.\u05e4 \u05d0\u05d5 \u05e2\u05d5\u05e1\u05e7 \u05de\u05d5\u05e8\u05e9\u05d4) \u05e6\u05e8\u05d9\u05da \u05dc\u05d4\u05d9\u05d5\u05ea 9 \u05e1\u05e4\u05e8\u05d5\u05ea.');
  v.contact = txt('contact', LIM.contact);
  if (v.contact.length < 2) errors.push('\u05d7\u05e1\u05e8 \u05e9\u05dd \u05d0\u05d9\u05e9 \u05d4\u05e7\u05e9\u05e8.');
  v.mobile = String(f.mobile || '').replace(/[\s()-]/g, '');
  if (!MOBILE_RE.test(v.mobile)) errors.push('\u05de\u05e1\u05e4\u05e8 \u05d4\u05e0\u05d9\u05d9\u05d3 \u05dc\u05d0 \u05ea\u05e7\u05d9\u05df (\u05dc\u05de\u05e9\u05dc 0501234567).');
  v.email = String(f.email || '').trim();
  if (v.email.length > LIM.email || !EMAIL_RE.test(v.email)) errors.push('\u05db\u05ea\u05d5\u05d1\u05ea \u05d4\u05de\u05d9\u05d9\u05dc \u05dc\u05d0 \u05ea\u05e7\u05d9\u05e0\u05d4.');
  if (t.kind === 'temp') {
    v.place = txt('place', LIM.place);
    if (v.place.length < 2) errors.push('\u05d7\u05e1\u05e8 \u05de\u05e7\u05d5\u05dd \u05d4\u05e2\u05d1\u05d5\u05d3\u05d4 \u05d1\u05de\u05e4\u05e2\u05dc.');
  }
  const works = Array.isArray(f.works) ? f.works.map(String) : [];
  if (works.some((w) => CTR_WORKS.indexOf(w) < 0)) errors.push('\u05e1\u05d5\u05d2 \u05e2\u05d1\u05d5\u05d3\u05d4 \u05dc\u05d0 \u05de\u05d5\u05db\u05e8.');
  v.works = CTR_WORKS.filter((w) => works.indexOf(w) >= 0);
  if (!v.works.length) errors.push('\u05e6\u05e8\u05d9\u05da \u05dc\u05e1\u05de\u05df \u05dc\u05e4\u05d7\u05d5\u05ea \u05e1\u05d5\u05d2 \u05e2\u05d1\u05d5\u05d3\u05d4 \u05d0\u05d7\u05d3.');
  const wk = parseWorkers(f.workers ? clean(f.workers, LIM.workers, true) : '');
  if (wk.error) errors.push(wk.error); else v.workers = wk.list;
  // the files: by their bytes, the limits, and only for documents of this request
  const req = requiredDocs(v.works, t.ins), opt = optionalDocs(t.ins), allowed = req.concat(opt);
  const have = {}; let total = 0, n = 0;
  v.files = [];
  for (const x of files || []) {
    if (allowed.indexOf(x.doc) < 0) continue;  // a field left from a work that was unticked: not taken
    if (!x.type) { errors.push((CTR_DOC_L[x.doc] || '') + ': \u05d0\u05e4\u05e9\u05e8 \u05dc\u05e6\u05e8\u05e3 \u05e8\u05e7 PDF, JPG \u05d0\u05d5 PNG.'); continue; }
    if (x.size > MAX_FILE) { errors.push((CTR_DOC_L[x.doc] || '') + ': \u05e7\u05d5\u05d1\u05e5 \u05d2\u05d3\u05d5\u05dc \u05de\u05d3\u05d9 (\u05e2\u05d3 4MB \u05dc\u05e7\u05d5\u05d1\u05e5).'); continue; }
    n++; total += x.size; have[x.doc] = (have[x.doc] || 0) + 1; v.files.push(x);
  }
  if (n > CTR_MAX_FILES) errors.push('\u05d0\u05e4\u05e9\u05e8 \u05dc\u05e6\u05e8\u05e3 \u05e2\u05d3 ' + CTR_MAX_FILES + ' \u05e7\u05d1\u05e6\u05d9\u05dd.');
  if (total > CTR_MAX_TOTAL) errors.push('\u05d4\u05e7\u05d1\u05e6\u05d9\u05dd \u05d2\u05d3\u05d5\u05dc\u05d9\u05dd \u05de\u05d3\u05d9 \u05d9\u05d7\u05d3 (\u05e2\u05d3 15MB).');
  v.missing = missingDocs(req, have, v.workers && v.workers.length > 0);
  errors.push(...missingMsg(v.missing));
  v.required = req;
  v.optMissing = opt.filter((k) => k !== 'oth' && !have[k]);
  v.signer = txt('signer', LIM.signer);
  if (v.signer.length < 2) errors.push('\u05d7\u05e1\u05e8 \u05e9\u05dd \u05de\u05e0\u05d4\u05dc \u05d4\u05e2\u05d1\u05d5\u05d3\u05d4 \u05e9\u05d7\u05d5\u05ea\u05dd.');
  if (String(f.commit || '') !== '1') errors.push('\u05e6\u05e8\u05d9\u05da \u05dc\u05e1\u05de\u05df \u05d0\u05ea \u05d4\u05d4\u05ea\u05d7\u05d9\u05d9\u05d1\u05d5\u05ea \u05dc\u05e4\u05e0\u05d9 \u05d4\u05e9\u05dc\u05d9\u05d7\u05d4.');
  if (!f.sig) errors.push('\u05d7\u05e1\u05e8\u05d4 \u05d7\u05ea\u05d9\u05de\u05d4. \u05d7\u05ea\u05de\u05d5 \u05d1\u05d0\u05e6\u05d1\u05e2 \u05d1\u05ea\u05d5\u05da \u05d4\u05de\u05e1\u05d2\u05e8\u05ea.');
  return errors.length ? { errors } : { v };
}

// ---- the page ----
const workBoxes = () => CTR_WORKS.map((k) => '<label class="ck"><input type="checkbox" name="works" value="' + k + '" class="wk">' + esc(workLabel(k)) + '</label>').join('');
// Which works need each document (for the page's script; the server checks again).
const docWorks = (key) => CTR_WORKS.filter((w) => requiredDocs([w], false).indexOf(key) >= 0);
function docField(key, t) {
  const always = key === 'wkr' || (key === 'ins' && t.ins), opt = key === 'oth' || (key === 'ins' && !t.ins);
  const works = docWorks(key).filter((w) => key !== 'wkr');
  const note = key === 'wkr' ? ' (\u05e7\u05d5\u05d1\u05e5, \u05d0\u05d5 \u05dc\u05d4\u05e7\u05dc\u05d9\u05d3 \u05d0\u05ea \u05d4\u05e8\u05e9\u05d9\u05de\u05d4 \u05dc\u05de\u05d8\u05d4)' : opt && key !== 'oth' ? ' (\u05dc\u05d0 \u05d7\u05d5\u05d1\u05d4)' : '';
  return '<div class="doc' + (always || opt ? ' on' : '') + '" data-doc="' + key + '" data-works="' + works.join(',') + '" data-req="' + (always ? '1' : opt ? '0' : 'w') + '">'
    + '<label for="f_' + key + '">' + esc(CTR_DOC_L[key]) + esc(note) + '</label><input type="file" id="f_' + key + '" name="f_' + key + '" accept="application/pdf,image/jpeg,image/png" multiple></div>';
}
const SCRIPT = (nonce) => `(function(){${PAD_JS}
var f=document.getElementById('f'),sig=document.getElementById('sig'),go=document.getElementById('go');
document.getElementById('clr').addEventListener('click',function(){x.clearRect(0,0,c.width,c.height);drawn=false;});
function upd(){var on=[];Array.prototype.forEach.call(document.querySelectorAll('.wk'),function(b){if(b.checked)on.push(b.value);});
Array.prototype.forEach.call(document.querySelectorAll('.doc'),function(d){var r=d.getAttribute('data-req');if(r!=='w')return;var ws=d.getAttribute('data-works').split(',');var need=ws.some(function(w){return on.indexOf(w)>=0;});d.className='doc'+(need?' on':'');});}
Array.prototype.forEach.call(document.querySelectorAll('.wk'),function(b){b.addEventListener('change',upd);});upd();
f.addEventListener('submit',function(e){var miss=[];Array.prototype.forEach.call(document.querySelectorAll('.doc.on'),function(d){var r=d.getAttribute('data-req'),k=d.getAttribute('data-doc'),i=d.querySelector('input');if(r==='0')return;if(k==='wkr'&&document.getElementById('workers').value.trim())return;if(!i.files||!i.files.length)miss.push(d.querySelector('label').textContent);});
if(!document.querySelectorAll('.wk:checked').length){e.preventDefault();alert(${JSON.stringify('\u05e6\u05e8\u05d9\u05da \u05dc\u05e1\u05de\u05df \u05dc\u05e4\u05d7\u05d5\u05ea \u05e1\u05d5\u05d2 \u05e2\u05d1\u05d5\u05d3\u05d4 \u05d0\u05d7\u05d3.')});return;}
if(miss.length){e.preventDefault();alert(${JSON.stringify('\u05d7\u05e1\u05e8\u05d9\u05dd \u05de\u05e1\u05de\u05db\u05d9\u05dd:')}+'\\n'+miss.join('\\n'));return;}
if(!drawn){e.preventDefault();alert(${JSON.stringify('\u05d7\u05e1\u05e8\u05d4 \u05d7\u05ea\u05d9\u05de\u05d4. \u05d7\u05ea\u05de\u05d5 \u05d1\u05d0\u05e6\u05d1\u05e2 \u05d1\u05ea\u05d5\u05da \u05d4\u05de\u05e1\u05d2\u05e8\u05ea.')});return;}
sig.value=c.toDataURL('image/png');go.disabled=true;go.textContent=${JSON.stringify('\u05e9\u05d5\u05dc\u05d7...')};});
})();`;
export function formHtml(t, entry, tok) {
  const inp = (n, l, type, extra) => '<label for="' + n + '">' + esc(l) + '</label><input type="' + (type || 'text') + '" id="' + n + '" name="' + n + '"' + (extra || '') + ' required>';
  return '<p>' + esc(SITE.company) + ' \u05de\u05d1\u05e7\u05e9\u05ea \u05d0\u05ea \u05d4\u05e4\u05e8\u05d8\u05d9\u05dd \u05d5\u05d4\u05de\u05e1\u05de\u05db\u05d9\u05dd \u05dc\u05d0\u05d9\u05e9\u05d5\u05e8 \u05e2\u05d1\u05d5\u05d3\u05d4 \u05e9\u05dc \u05e7\u05d1\u05dc\u05df \u05d1\u05de\u05e4\u05e2\u05dc (' + esc(CTR_KIND_L[t.kind]) + ').'
    + (t.kind === 'temp' ? ' \u05ea\u05d0\u05e8\u05d9\u05db\u05d9 \u05d4\u05e2\u05d1\u05d5\u05d3\u05d4: ' + esc(dmy(t.ds)) + ' \u05e2\u05d3 ' + esc(dmy(t.de)) + '.' : '') + '</p>'
    + '<form id="f" method="POST" action="/api/ctr-link" enctype="multipart/form-data">'
    + '<input type="hidden" name="k" value="' + esc(tok) + '"><input type="hidden" name="sig" id="sig">'
    + '<div class="sec"><b>\u05e4\u05e8\u05d8\u05d9 \u05d4\u05d7\u05d1\u05e8\u05d4</b>'
    + inp('company', '\u05e9\u05dd \u05d4\u05d7\u05d1\u05e8\u05d4', 'text', ' maxlength="80" value="' + esc(entry.company || '') + '"')
    + inp('cnum', '\u05de\u05e1\u05e4\u05e8 \u05d4\u05d7\u05d1\u05e8\u05d4 (\u05d7.\u05e4 \u05d0\u05d5 \u05e2\u05d5\u05e1\u05e7 \u05de\u05d5\u05e8\u05e9\u05d4, 9 \u05e1\u05e4\u05e8\u05d5\u05ea)', 'text', ' inputmode="numeric" maxlength="11" dir="ltr"')
    + inp('contact', '\u05d0\u05d9\u05e9 \u05d4\u05e7\u05e9\u05e8', 'text', ' maxlength="60"')
    + inp('mobile', '\u05e0\u05d9\u05d9\u05d3', 'tel', ' maxlength="15" dir="ltr"')
    + inp('email', '\u05de\u05d9\u05d9\u05dc', 'email', ' maxlength="100" dir="ltr"')
    + (t.kind === 'temp' ? inp('place', '\u05de\u05e7\u05d5\u05dd \u05d4\u05e2\u05d1\u05d5\u05d3\u05d4 \u05d1\u05de\u05e4\u05e2\u05dc', 'text', ' maxlength="120"') : '') + '</div>'
    + '<div class="sec"><b>\u05d4\u05e2\u05d1\u05d5\u05d3\u05d5\u05ea \u05e9\u05ea\u05d1\u05e6\u05e2\u05d5</b>' + workBoxes() + '</div>'
    + '<div class="sec"><b>\u05d4\u05de\u05e1\u05de\u05db\u05d9\u05dd</b><p class="yel">\u05dc\u05e4\u05d9 \u05d4\u05e2\u05d1\u05d5\u05d3\u05d5\u05ea \u05e9\u05e1\u05d9\u05de\u05e0\u05ea\u05dd. PDF, JPG \u05d0\u05d5 PNG, \u05e2\u05d3 4MB \u05dc\u05e7\u05d5\u05d1\u05e5.</p>'
    + CTR_DOCS.map((d) => docField(d[0], t)).join('')
    + '<label for="workers">\u05e8\u05e9\u05d9\u05de\u05ea \u05d4\u05e2\u05d5\u05d1\u05d3\u05d9\u05dd: \u05e9\u05d5\u05e8\u05d4 \u05dc\u05db\u05dc \u05e2\u05d5\u05d1\u05d3, \u05e9\u05dd \u05d5\u05de\u05e1\u05e4\u05e8 \u05ea\u05e2\u05d5\u05d3\u05ea \u05d6\u05d4\u05d5\u05ea</label><textarea id="workers" name="workers" maxlength="8000" placeholder="\u05d9\u05e9\u05e8\u05d0\u05dc \u05d9\u05e9\u05e8\u05d0\u05dc\u05d9 012345678"></textarea></div>'
    + '<div class="sec"><b>\u05d4\u05ea\u05d7\u05d9\u05d9\u05d1\u05d5\u05ea \u05d5\u05d7\u05ea\u05d9\u05de\u05d4</b>'
    + '<label class="ck"><input type="checkbox" name="commit" value="1" required>' + esc(CTR_COMMIT) + '</label>'
    + inp('signer', '\u05e9\u05dd \u05de\u05e0\u05d4\u05dc \u05d4\u05e2\u05d1\u05d5\u05d3\u05d4 \u05e9\u05d7\u05d5\u05ea\u05dd', 'text', ' maxlength="60"')
    + '<div style="font-weight:700;margin:8px 0 4px">\u05d7\u05ea\u05d9\u05de\u05d4 \u05d1\u05d0\u05e6\u05d1\u05e2</div><canvas id="pad" style="width:100%;height:180px;border:2px dashed #9ca3af;border-radius:8px;touch-action:none;background:#fff"></canvas>'
    + '<button type="button" id="clr" class="btn s">\u05e0\u05e7\u05d4 \u05d7\u05ea\u05d9\u05de\u05d4</button></div>'
    + '<button type="submit" id="go" class="btn g">\u05e9\u05dc\u05d9\u05d7\u05d4</button></form>';
}
const errPage = (msg, status) => page('\u05dc\u05d0 \u05e0\u05d9\u05ea\u05df \u05dc\u05e4\u05ea\u05d5\u05d7', '<p>' + esc(msg) + '</p>', 'err', status || 400);
const tokErr = (e) => errPage(e === 'expired' ? '\u05ea\u05d5\u05e7\u05e3 \u05d4\u05e7\u05d9\u05e9\u05d5\u05e8 \u05e4\u05d2. \u05d0\u05e4\u05e9\u05e8 \u05dc\u05d1\u05e7\u05e9 \u05e7\u05d9\u05e9\u05d5\u05e8 \u05d7\u05d3\u05e9 \u05de\u05de\u05de\u05d5\u05e0\u05d4 \u05d4\u05d1\u05d8\u05d9\u05d7\u05d5\u05ea.' : '\u05d4\u05e7\u05d9\u05e9\u05d5\u05e8 \u05dc\u05d0 \u05ea\u05e7\u05d9\u05df. \u05d0\u05e4\u05e9\u05e8 \u05dc\u05d1\u05e7\u05e9 \u05e7\u05d9\u05e9\u05d5\u05e8 \u05d7\u05d3\u05e9 \u05de\u05de\u05de\u05d5\u05e0\u05d4 \u05d4\u05d1\u05d8\u05d9\u05d7\u05d5\u05ea.', 403);
const backBtn = (nonce) => '<p><button type="button" id="bk" class="btn p">\u05d7\u05d6\u05e8\u05d4 \u05dc\u05d8\u05d5\u05e4\u05e1</button></p><script nonce="' + nonce + '">document.getElementById("bk").addEventListener("click",function(){history.back();});</script>';

async function readState(env) {
  const r = await fetch(SB + '/rest/v1/server_state?select=value&key=eq.' + CTR_STATE, { headers: sbH(env) });
  if (!r.ok) throw new Error('state ' + r.status);
  const rows = await r.json();
  return stateList(rows && rows[0] && rows[0].value);
}
async function talkRow(env, id) {
  const r = await fetch(SB + '/rest/v1/toolbox_talks?select=id,kind,s,link_v,dept&id=eq.' + encodeURIComponent(id), { headers: sbH(env) });
  if (!r.ok) throw new Error('talk ' + r.status);
  const rows = await r.json();
  return rows && rows[0] && rows[0].kind === KIND_CTR ? rows[0] : null;
}
// The new-worker link of a filled request: the talk's permanent link, valid as long as the approval.
async function workerLink(env, t, entry, nowMs) {
  const talk = await talkRow(env, entry.talk);
  if (!talk || talk.s !== S_PUB) return null;
  const from = Date.parse(entry.at || '') || nowMs;
  const tok = await makePermToken(env, talk.id, talk.link_v || 0, from, workerTtlDays(t.kind, t.de, from));
  return tok ? talkUrl(tok) : null;
}
const doneHtml = (link) => '<p>\u05d4\u05d8\u05d5\u05e4\u05e1 \u05d4\u05ea\u05e7\u05d1\u05dc. \u05ea\u05d5\u05d3\u05d4.</p>'
  + (link ? '<p><b>\u05d4\u05e7\u05d9\u05e9\u05d5\u05e8 \u05dc\u05e2\u05d5\u05d1\u05d3 \u05d7\u05d3\u05e9:</b> \u05db\u05dc \u05e2\u05d5\u05d1\u05d3 \u05e9\u05dc\u05db\u05dd \u05e0\u05db\u05e0\u05e1 \u05dc\u05e7\u05d9\u05e9\u05d5\u05e8, \u05e7\u05d5\u05e8\u05d0 \u05d0\u05ea \u05d4\u05d5\u05e8\u05d0\u05d5\u05ea \u05d4\u05d1\u05d8\u05d9\u05d7\u05d5\u05ea \u05d5\u05d7\u05d5\u05ea\u05dd, \u05dc\u05e4\u05e0\u05d9 \u05d4\u05db\u05e0\u05d9\u05e1\u05d4 \u05d4\u05e8\u05d0\u05e9\u05d5\u05e0\u05d4 \u05dc\u05de\u05e4\u05e2\u05dc.</p>'
    + '<p style="word-break:break-all;direction:ltr;text-align:left"><a href="' + esc(link) + '">' + esc(link) + '</a></p>' : '');

async function showForm(env, tok, nowMs) {
  const t = await readCtrToken(env, tok, nowMs);
  if (t.error) return tokErr(t.error);
  const entry = (await readState(env)).find((x) => x.id === t.rid);
  if (!entry) return errPage('\u05d4\u05e7\u05d9\u05e9\u05d5\u05e8 \u05d1\u05d5\u05d8\u05dc. \u05d0\u05e4\u05e9\u05e8 \u05dc\u05d1\u05e7\u05e9 \u05e7\u05d9\u05e9\u05d5\u05e8 \u05d7\u05d3\u05e9 \u05de\u05de\u05de\u05d5\u05e0\u05d4 \u05d4\u05d1\u05d8\u05d9\u05d7\u05d5\u05ea.', 410);
  if (entry.status === CTR_S_FILLED) return page('\u05d4\u05d8\u05d5\u05e4\u05e1 \u05db\u05d1\u05e8 \u05e0\u05e9\u05dc\u05d7', doneHtml(await workerLink(env, t, entry, nowMs)), 'ok', 200);
  const nonce = newNonce();
  return page('\u05d0\u05d9\u05e9\u05d5\u05e8 \u05e7\u05d1\u05dc\u05df: ' + (entry.company || '\u05e4\u05e8\u05d8\u05d9\u05dd \u05d5\u05de\u05e1\u05de\u05db\u05d9\u05dd'), formHtml(t, entry, tok), '', 200, nonce, SCRIPT(nonce));
}

// ---- after the checks: the files, the summary, the talk, the mail ----
export function summaryHtml(t, v, when, sigB64, saved) {
  const cell = (k, x) => '<tr><td style="padding:3px 8px;font-weight:bold;white-space:nowrap;vertical-align:top">' + esc(k) + '</td><td style="padding:3px 8px">' + x + '</td></tr>';
  return '<!doctype html><html lang="he" dir="rtl"><head><meta charset="UTF-8"><title>' + esc('\u05d0\u05d9\u05e9\u05d5\u05e8 \u05e7\u05d1\u05dc\u05df: ' + v.company) + '</title></head>'
    + '<body style="font-family:Arial,sans-serif;font-size:13px;direction:rtl;text-align:right;margin:24px">'
    + '<h2 style="margin:0 0 4px">\u05d8\u05d5\u05e4\u05e1 \u05d0\u05d9\u05e9\u05d5\u05e8 \u05e7\u05d1\u05dc\u05df: ' + esc(v.company) + '</h2><div style="color:#555;margin-bottom:10px">' + esc(SITE.company) + ', ' + esc(CTR_KIND_L[t.kind]) + '</div>'
    + '<table style="border-collapse:collapse;margin-bottom:10px">'
    + cell('\u05de\u05e1\u05e4\u05e8 \u05d4\u05d7\u05d1\u05e8\u05d4', esc(v.cnum)) + cell('\u05d0\u05d9\u05e9 \u05d4\u05e7\u05e9\u05e8', esc(v.contact)) + cell('\u05e0\u05d9\u05d9\u05d3', esc(v.mobile)) + cell('\u05de\u05d9\u05d9\u05dc', esc(v.email))
    + (t.kind === 'temp' ? cell('\u05ea\u05d0\u05e8\u05d9\u05db\u05d9 \u05d4\u05e2\u05d1\u05d5\u05d3\u05d4', esc(dmy(t.ds) + ' \u05e2\u05d3 ' + dmy(t.de))) + cell('\u05de\u05e7\u05d5\u05dd \u05d4\u05e2\u05d1\u05d5\u05d3\u05d4', esc(v.place)) : '')
    + cell('\u05d4\u05e2\u05d1\u05d5\u05d3\u05d5\u05ea', esc(v.works.map(workLabel).join(', ')))
    + cell('\u05de\u05e1\u05de\u05db\u05d9\u05dd \u05e9\u05e6\u05d5\u05e8\u05e4\u05d5', saved.length ? saved.map((x) => esc(CTR_DOC_L[x.doc] + ': ' + x.name)).join('<br>') : '-')
    + cell('\u05dc\u05d0 \u05e6\u05d5\u05e8\u05e3 (\u05dc\u05d0 \u05d7\u05d5\u05d1\u05d4)', v.optMissing.length ? esc(v.optMissing.map((k) => CTR_DOC_L[k]).join(', ')) : '-')
    + cell('\u05e0\u05e9\u05dc\u05d7', esc(dmy(when.day) + ' ' + when.hm)) + '</table>'
    + (v.workers && v.workers.length ? '<h3 style="margin:8px 0 4px">\u05e8\u05e9\u05d9\u05de\u05ea \u05d4\u05e2\u05d5\u05d1\u05d3\u05d9\u05dd</h3><table style="border-collapse:collapse">' + v.workers.map((w, i) => '<tr><td style="padding:2px 8px">' + (i + 1) + '</td><td style="padding:2px 8px">' + esc(w.n) + '</td><td style="padding:2px 8px;direction:ltr">' + esc(w.id) + '</td></tr>').join('') + '</table>' : '')
    + '<p style="font-weight:bold;margin-top:12px">' + esc(CTR_COMMIT) + '</p>'
    + '<div>\u05e9\u05dd: ' + esc(v.signer) + '</div><div>\u05d7\u05ea\u05d9\u05de\u05d4:</div><img alt="" style="max-width:320px;max-height:120px;border-bottom:1px solid #333" src="data:image/png;base64,' + sigB64 + '">'
    + '</body></html>';
}
export const MAIL_SUBJECT = (t, v) => '\u05d0\u05d9\u05e9\u05d5\u05e8 \u05e7\u05d1\u05dc\u05df: ' + String(v.company).slice(0, 60) + ' (' + CTR_KIND_L[t.kind] + ')';
// The mail to Michael: what was filled, the works, the files (attached or as links), what is optional and not given, the commitment.
export function mailHtml(t, v, saved, summary, attachedNames, workerUrl, instrMissing) {
  const row = (k, x) => '<tr><td style="padding:3px 10px;font-weight:bold;vertical-align:top">' + esc(k) + '</td><td style="padding:3px 10px">' + x + '</td></tr>';
  const fileLine = (x) => esc(CTR_DOC_L[x.doc] + ': ') + (x.url ? '<a href="' + esc(x.url) + '">' + esc(x.name) + '</a>' : esc(x.name)) + (attachedNames.indexOf(x.name) >= 0 ? ' (\u05de\u05e6\u05d5\u05e8\u05e3)' : '');
  return '<div dir="rtl" style="direction:rtl;text-align:right;font-family:Arial,sans-serif;font-size:14px">'
    + '<p>\u05d4\u05e7\u05d1\u05dc\u05df ' + esc(v.company) + ' \u05de\u05d9\u05dc\u05d0 \u05d0\u05ea \u05d8\u05d5\u05e4\u05e1 \u05d0\u05d9\u05e9\u05d5\u05e8 \u05d4\u05e7\u05d1\u05dc\u05df (' + esc(CTR_KIND_L[t.kind]) + ').</p><table>'
    + row('\u05de\u05e1\u05e4\u05e8 \u05d4\u05d7\u05d1\u05e8\u05d4', esc(v.cnum)) + row('\u05d0\u05d9\u05e9 \u05d4\u05e7\u05e9\u05e8', esc(v.contact) + ', ' + esc(v.mobile) + ', ' + esc(v.email))
    + (t.kind === 'temp' ? row('\u05ea\u05d0\u05e8\u05d9\u05db\u05d9 \u05d4\u05e2\u05d1\u05d5\u05d3\u05d4', esc(dmy(t.ds) + ' \u05e2\u05d3 ' + dmy(t.de))) + row('\u05de\u05e7\u05d5\u05dd', esc(v.place)) : '')
    + row('\u05d4\u05e2\u05d1\u05d5\u05d3\u05d5\u05ea', esc(v.works.map(workLabel).join(', ')))
    + row('\u05d1\u05d9\u05d8\u05d5\u05d7', t.ins ? '\u05e0\u05d3\u05e8\u05e9 \u05d5\u05e6\u05d5\u05e8\u05e3' : (v.optMissing.indexOf('ins') >= 0 ? '\u05dc\u05d0 \u05e0\u05d3\u05e8\u05e9, \u05dc\u05d0 \u05e6\u05d5\u05e8\u05e3' : '\u05dc\u05d0 \u05e0\u05d3\u05e8\u05e9, \u05e6\u05d5\u05e8\u05e3'))
    + row('\u05e2\u05d5\u05d1\u05d3\u05d9\u05dd \u05d1\u05e8\u05e9\u05d9\u05de\u05d4', v.workers && v.workers.length ? String(v.workers.length) + ' (\u05d1\u05d8\u05d5\u05e4\u05e1 \u05d4\u05de\u05e1\u05db\u05dd)' : '\u05d1\u05e7\u05d5\u05d1\u05e5 \u05e9\u05e6\u05d5\u05e8\u05e3')
    + row('\u05d4\u05de\u05e1\u05de\u05db\u05d9\u05dd', saved.length ? saved.map(fileLine).join('<br>') : '-')
    + row('\u05dc\u05d0 \u05e6\u05d5\u05e8\u05e3 (\u05dc\u05d0 \u05d7\u05d5\u05d1\u05d4)', v.optMissing.length ? esc(v.optMissing.map((k) => CTR_DOC_L[k]).join(', ')) : '-')
    + row('\u05d4\u05ea\u05d7\u05d9\u05d9\u05d1\u05d5\u05ea', '\u05e1\u05d5\u05de\u05e0\u05d4 \u05d5\u05e0\u05d7\u05ea\u05de\u05d4 \u05d1\u05d9\u05d3\u05d9 ' + esc(v.signer))
    + row('\u05d4\u05d8\u05d5\u05e4\u05e1 \u05d4\u05de\u05e1\u05db\u05dd', summary && summary.url ? '<a href="' + esc(summary.url) + '">' + esc(summary.name) + '</a>' + (attachedNames.indexOf(summary.name) >= 0 ? ' (\u05de\u05e6\u05d5\u05e8\u05e3)' : '') : '\u05dc\u05d0 \u05e0\u05e9\u05de\u05e8') + '</table>'
    + (workerUrl ? '<p>\u05d4\u05e7\u05d9\u05e9\u05d5\u05e8 \u05dc\u05e2\u05d5\u05d1\u05d3 \u05d7\u05d3\u05e9 (\u05d4\u05e7\u05d1\u05dc\u05df \u05e7\u05d9\u05d1\u05dc \u05d0\u05d5\u05ea\u05d5): <a href="' + esc(workerUrl) + '">' + esc(workerUrl) + '</a></p>' : '')
    + (instrMissing ? '<p style="color:#b91c1c;font-weight:bold">\u05e9\u05d9\u05dd \u05dc\u05d1: \u05d8\u05e7\u05e1\u05d8 \u05d4\u05d5\u05e8\u05d0\u05d5\u05ea \u05d4\u05d1\u05d8\u05d9\u05d7\u05d5\u05ea \u05dc\u05e7\u05d1\u05dc\u05e0\u05d9\u05dd (\u05d8\u05d5\u05e4\u05e1 146.03) \u05e2\u05d5\u05d3 \u05dc\u05d0 \u05d4\u05d5\u05d6\u05df \u05d1\u05de\u05e2\u05e8\u05db\u05ea, \u05d5\u05e2\u05d5\u05d1\u05d3\u05d9 \u05d4\u05e7\u05d1\u05dc\u05df \u05dc\u05d0 \u05d9\u05d5\u05db\u05dc\u05d5 \u05dc\u05d7\u05ea\u05d5\u05dd \u05d1\u05e7\u05d9\u05e9\u05d5\u05e8 \u05dc\u05e2\u05d5\u05d1\u05d3 \u05d7\u05d3\u05e9 \u05e2\u05d3 \u05e9\u05d9\u05d5\u05d6\u05df.</p>' : '')
    + '<p>\u05dc\u05d1\u05d3\u05d9\u05e7\u05d4 \u05d5\u05dc\u05ea\u05d9\u05d5\u05e7. \u05d0\u05d9\u05e9\u05d5\u05e8 \u05d4\u05e7\u05d1\u05dc\u05df \u05d1\u05de\u05e8\u05e9\u05dd \u05d4\u05d5\u05d0 \u05e2\u05d3\u05d9\u05d9\u05df \u05d1\u05d9\u05d3\u05d9\u05d9\u05dd \u05e9\u05dc\u05da.</p>'
    + '<p style="color:#666;font-size:12px">\u05e0\u05e9\u05dc\u05d7 \u05d0\u05d5\u05d8\u05d5\u05de\u05d8\u05d9\u05ea \u05de\u05d0\u05e4\u05dc\u05d9\u05e7\u05e6\u05d9\u05d9\u05ea \u05e0\u05d9\u05d4\u05d5\u05dc \u05d4\u05d1\u05d8\u05d9\u05d7\u05d5\u05ea \u05e9\u05dc ' + esc(SITE.company) + '.</p></div>';
}
// Attach in order (the summary first) while the total stays under MAIL_BUDGET.
export function pickAttach(items) {
  const out = []; let total = 0;
  for (const x of items) { if (x.bytes && total + x.bytes.length <= MAIL_BUDGET) { out.push(x); total += x.bytes.length; } }
  return out;
}

async function guessCount(env, request) {
  const ip = ipBucket(request.headers.get('cf-connecting-ip') || request.headers.get('x-real-ip'));
  const d = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode('ctrlink|' + ip)));
  const key = 'guess:ctrlink:' + Array.from(d.slice(0, 8)).map((b) => b.toString(16).padStart(2, '0')).join('');
  try {
    const r = await fetch(SB + '/rest/v1/rpc/guess_hit', { method: 'POST', headers: sbH(env, { 'Content-Type': 'application/json' }), body: JSON.stringify({ p_key: key, p_window_s: 3600 }) });
    const n = r.ok ? await r.json() : 0;
    return typeof n === 'number' ? n : 0;
  } catch (e) { return 0; }
}

async function submit(env, request, nowMs, deps) {
  const ct = request.headers.get('content-type') || '';
  if (!/multipart\/form-data/i.test(ct)) return errPage('\u05d4\u05d8\u05d5\u05e4\u05e1 \u05dc\u05d0 \u05e0\u05e9\u05dc\u05d7 \u05db\u05e8\u05d0\u05d5\u05d9. \u05e0\u05e1\u05d5 \u05e9\u05d5\u05d1 \u05de\u05d4\u05e7\u05d9\u05e9\u05d5\u05e8.', 415);
  const len = Number(request.headers.get('content-length') || 0);
  if (len > CTR_MAX_BODY) return errPage('\u05d4\u05e7\u05d1\u05e6\u05d9\u05dd \u05d2\u05d3\u05d5\u05dc\u05d9\u05dd \u05de\u05d3\u05d9 \u05d9\u05d7\u05d3 (\u05e2\u05d3 15MB).', 413);
  let form; try { form = await request.formData(); } catch (e) { return errPage('\u05d4\u05d8\u05d5\u05e4\u05e1 \u05dc\u05d0 \u05e0\u05e9\u05dc\u05d7 \u05db\u05e8\u05d0\u05d5\u05d9. \u05e0\u05e1\u05d5 \u05e9\u05d5\u05d1.', 400); }
  const tok = String(form.get('k') || '');
  const t = await readCtrToken(env, tok, nowMs);
  if (t.error) return tokErr(t.error);
  if ((await guessCount(env, request)) > CTR_POSTS_HOUR) return errPage('\u05d9\u05d5\u05ea\u05e8 \u05de\u05d3\u05d9 \u05e0\u05d9\u05e1\u05d9\u05d5\u05e0\u05d5\u05ea. \u05e0\u05e1\u05d5 \u05e9\u05d5\u05d1 \u05d1\u05e2\u05d5\u05d3 \u05e9\u05e2\u05d4.', 429);
  const entry0 = (await readState(env)).find((x) => x.id === t.rid);
  if (!entry0) return errPage('\u05d4\u05e7\u05d9\u05e9\u05d5\u05e8 \u05d1\u05d5\u05d8\u05dc. \u05d0\u05e4\u05e9\u05e8 \u05dc\u05d1\u05e7\u05e9 \u05e7\u05d9\u05e9\u05d5\u05e8 \u05d7\u05d3\u05e9 \u05de\u05de\u05de\u05d5\u05e0\u05d4 \u05d4\u05d1\u05d8\u05d9\u05d7\u05d5\u05ea.', 410);
  if (entry0.status === CTR_S_FILLED) return page('\u05d4\u05d8\u05d5\u05e4\u05e1 \u05db\u05d1\u05e8 \u05e0\u05e9\u05dc\u05d7', doneHtml(await workerLink(env, t, entry0, nowMs)), 'ok', 200);
  // the files, read and typed by their bytes
  const files = [];
  for (const d of CTR_DOCS) {
    for (const file of form.getAll('f_' + d[0])) {
      if (!file || typeof file.arrayBuffer !== 'function' || !file.size) continue;
      if (file.size > MAX_FILE) { files.push({ doc: d[0], size: file.size, type: ['big'], u8: null }); continue; }
      const u8 = new Uint8Array(await file.arrayBuffer());
      files.push({ doc: d[0], size: u8.length, type: fileType(u8), u8 });
    }
  }
  const sig = sigBytes(form.get('sig'));
  const f = { works: form.getAll('works'), sig: !!sig };
  for (const k of ['company', 'cnum', 'contact', 'mobile', 'email', 'place', 'workers', 'signer', 'commit']) f[k] = form.get(k) == null ? '' : String(form.get(k));
  const c = checkCtrForm(f, files, t);
  const nonce = newNonce();
  if (c.errors) return page('\u05e6\u05e8\u05d9\u05da \u05dc\u05d4\u05e9\u05dc\u05d9\u05dd', '<ul>' + c.errors.map((e) => '<li>' + esc(e) + '</li>').join('') + '</ul>' + backBtn(nonce), 'err', 400, nonce);
  const v = c.v;
  // claim: sent -> filled, once (a second send at the same moment finds it filled)
  const atIso = new Date(nowMs).toISOString();
  const claim = { status: CTR_S_FILLED, at: atIso, company: v.company, cnum: v.cnum, contact: v.contact, mobile: v.mobile, email: v.email, works: v.works, place: v.place || null };
  let gone = false;
  const cw = await stateCas(SB, sbH(env, { 'Content-Type': 'application/json' }), CTR_STATE, (cur) => {
    const p = statePatch(cur, t.rid, claim, CTR_S_SENT);
    if (p.error) { gone = true; return { write: false }; }
    return { value: JSON.stringify(p.list) };
  }, () => AbortSignal.timeout(FETCH_MS));
  if (gone) return page('\u05d4\u05d8\u05d5\u05e4\u05e1 \u05db\u05d1\u05e8 \u05e0\u05e9\u05dc\u05d7', doneHtml(null), 'ok', 200);
  if (!cw.written) return errPage('\u05ea\u05e7\u05dc\u05d4 \u05d6\u05de\u05e0\u05d9\u05ea \u05d1\u05e9\u05de\u05d9\u05e8\u05d4. \u05e0\u05e1\u05d5 \u05e9\u05d5\u05d1 \u05d1\u05e2\u05d5\u05d3 \u05d3\u05e7\u05d4.', 503);
  const giveBack = () => stateCas(SB, sbH(env, { 'Content-Type': 'application/json' }), CTR_STATE, (cur) => {
    const p = statePatch(cur, t.rid, { status: CTR_S_SENT, at: null }, CTR_S_FILLED);
    return p.error ? { write: false } : { value: JSON.stringify(p.list) };
  }, () => AbortSignal.timeout(FETCH_MS)).catch(() => null);
  // OneDrive: every file, then the summary (HTML in a source folder, the PDF beside the files)
  const day = ilDay(nowMs), hm = new Date(nowMs).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: TZ, hour12: false });
  const stamp = day.split('-').reverse().join('-'), folder = ctrFolder(v.company, day.slice(0, 4));
  let od, saved = [], summary = null;
  try {
    od = await deps.accessToken(env);
    const count = {};
    saved = await Promise.all(v.files.map(async (x) => {
      count[x.doc] = (count[x.doc] || 0) + 1;
      const name = stamp + ' - ' + safeName(CTR_DOC_L[x.doc], 40) + ' - ' + count[x.doc] + '.' + x.type[0];
      const r = await deps.putFile(od.token, folder, name, x.u8, x.type[1], 'rename');
      return { doc: x.doc, name, url: r.webUrl || null, bytes: x.u8, type: x.type[1] };
    }));
    const hb = new TextEncoder().encode(summaryHtml(t, v, { day, hm }, b64(sig), saved));
    const base = stamp + ' - ' + '\u05d8\u05d5\u05e4\u05e1 \u05d0\u05d9\u05e9\u05d5\u05e8 \u05e7\u05d1\u05dc\u05df', src = folder + '/\u05de\u05e7\u05d5\u05e8';
    let sb = hb, sname = base + '.html', stype = 'text/html';
    try {
      await deps.putFile(od.token, src, base + '.html', hb, 'text/html; charset=utf-8', 'rename');
      const pdf = await deps.graphPdf(od.token, (src + '/' + base + '.html').split('/').map(encodeURIComponent).join('/'), 25000);
      if (pdf) { sb = pdf; sname = base + '.pdf'; stype = 'application/pdf'; }
    } catch (e) { /* the HTML is filed instead */ }
    const sr = await deps.putFile(od.token, folder, sname, sb, stype, 'rename');
    summary = { name: sname, url: sr.webUrl || null, bytes: sb, type: stype };
  } catch (e) {
    await giveBack();
    return errPage('\u05d4\u05e7\u05d1\u05e6\u05d9\u05dd \u05dc\u05d0 \u05e0\u05e9\u05de\u05e8\u05d5 \u05d1\u05d2\u05dc\u05dc \u05ea\u05e7\u05dc\u05d4 \u05d6\u05de\u05e0\u05d9\u05ea. \u05e0\u05e1\u05d5 \u05dc\u05e9\u05dc\u05d5\u05d7 \u05e9\u05d5\u05d1 \u05d1\u05e2\u05d5\u05d3 \u05db\u05de\u05d4 \u05d3\u05e7\u05d5\u05ea (\u05d4\u05e7\u05d1\u05e6\u05d9\u05dd \u05e6\u05e8\u05d9\u05db\u05d9\u05dd \u05dc\u05d4\u05d9\u05d1\u05d7\u05e8 \u05de\u05d7\u05d3\u05e9).', 503);
  }
  // the talk: published with the company and the instructions; its permanent link is the new-worker link
  let instr = '';
  try {
    const r = await fetch(SB + '/rest/v1/server_state?select=value&key=eq.' + CTR_INSTR, { headers: sbH(env) });
    const rows = r.ok ? await r.json() : [];
    instr = instrText(rows && rows[0] && rows[0].value);
  } catch (e) { /* the placeholder below */ }
  const pub = await fetch(SB + '/rest/v1/toolbox_talks?id=eq.' + encodeURIComponent(entry0.talk) + '&kind=eq.' + KIND_CTR, { method: 'PATCH', headers: sbH(env, { 'Content-Type': 'application/json', Prefer: 'return=minimal' }),
    body: JSON.stringify({ s: S_PUB, d: day, dept: v.company, title: CTR_TITLE + ': ' + v.company, body: instr || INSTR_MISSING, link_at: atIso }) }).catch(() => null);
  const entry = Object.assign({}, entry0, claim);
  const wUrl = pub && pub.ok ? await workerLink(env, t, entry, nowMs).catch(() => null) : null;
  // the mail to Michael
  let mail = 'sent';
  try {
    const att = pickAttach([summary].concat(saved));
    const html = mailHtml(t, v, saved, summary, att.map((x) => x.name), wUrl, !instr);
    await deps.sendMailTo(od.token, [od.email], [], MAIL_SUBJECT(t, v), html,
      att.map((x) => ({ '@odata.type': '#microsoft.graph.fileAttachment', name: x.name, contentType: x.type, contentBytes: b64(x.bytes) })));
  } catch (e) { mail = 'err: ' + String((e && e.message) || e).slice(0, 120); }
  await stateCas(SB, sbH(env, { 'Content-Type': 'application/json' }), CTR_STATE, (cur) => {
    const p = statePatch(cur, t.rid, { files: saved.length, folder, mail, summary: summary.url || null, worker_link: !!wUrl });
    return p.error ? { write: false } : { value: JSON.stringify(p.list) };
  }, () => AbortSignal.timeout(FETCH_MS)).catch(() => null);
  return page('\u05ea\u05d5\u05d3\u05d4, \u05d4\u05d8\u05d5\u05e4\u05e1 \u05d4\u05ea\u05e7\u05d1\u05dc', doneHtml(wUrl), 'ok', 200);
}

export async function onRequest(context, deps) {
  SB = sbFrom(context.env);
  const { request, env } = context;
  const nowMs = Date.now();
  try {
    if (!env.SUPABASE_SERVICE_ROLE_KEY) return errPage('\u05d4\u05e9\u05e8\u05ea \u05dc\u05d0 \u05de\u05d5\u05d2\u05d3\u05e8.', 500);
    if (request.method === 'GET') return await showForm(env, new URL(request.url).searchParams.get('k') || '', nowMs);
    if (request.method !== 'POST') return errPage('\u05e4\u05e2\u05d5\u05dc\u05d4 \u05dc\u05d0 \u05e0\u05ea\u05de\u05db\u05ea.', 405);
    return await submit(env, request, nowMs, deps || ctrDeps);
  } catch (e) {
    return errPage('\u05ea\u05e7\u05dc\u05d4 \u05d6\u05de\u05e0\u05d9\u05ea. \u05e0\u05e1\u05d5 \u05e9\u05d5\u05d1 \u05d1\u05e2\u05d5\u05d3 \u05d3\u05e7\u05d4.', 503);
  }
}
