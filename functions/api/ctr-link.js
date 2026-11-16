// Cloudflare Pages Function: the contractor approval link (15/11/2026, phase 1; functions/_ctr.js has the why).
//
//   routine-db op ctr_link   the WhatsApp assistant asks for a link (ctrLinkCheck + ctrLinkCreate below): a request in
//                            server_state ctr_links, a draft talk of kind 'contractor', and the URL text that Michael
//                            forwards himself. The server never sends anything to the contractor.
//   GET  ?k=<token>          the contractor's page: company, company number, contact, mobile, email; for a job its dates
//                            (from the link) and place; the works (the 8 kinds of works.js and the forklift); the
//                            documents those works need (CTR_REQ), each a file field; the description of the work
//                            (required, as the permit's); the instructions of form 146.03 shown whole, then a row per
//                            worker (name, ID, finger signature), all on the same phone (16/11/2026); the manager's
//                            commitment, ID and finger signature. Once sent: the new-worker link.
//   POST multipart           checked on the server whatever the page did: every field, every file by its bytes (PDF / JPG /
//                            PNG, MAX_FILE each, CTR_MAX_FILES and CTR_MAX_TOTAL in all), every required document by
//                            name. Then: the files, a signed summary and form 146.03 filled (Word + PDF, the signatures
//                            inside its tables, functions/_ctrform.js) into the contractor's folder in OneDrive, the talk
//                            published (its permanent link is the new-worker link) with a signature row per worker
//                            (toolbox_reads, as if each signed the talk), one mail to Michael with the form and the files
//                            attached up to MAIL_BUDGET (links beyond it), and the request marked filled.
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
import { makePermToken, talkUrl, sigBytes, idOf, graphPdf, PAD_JS, ctrName, textHash, BUCKET } from './talk.js';
import { KIND_CTR, CTR_PREFIX, CTR_STATE, CTR_INSTR, CTR_KIND_L, CTR_S_SENT, CTR_S_FILLED, CTR_WORKS, FRK_L, CTR_DOCS, CTR_DOC_L, requiredDocs, optionalDocs,
  missingDocs, missingMsg, RID_RE, ctrLinkId, parseCtrLinkId, linkTtlDays, workerTtlDays, addDays, ctrFolder, safeName, stateList, stateAdd, statePatch,
  instrText, CTR_TITLE, CTR_COMMIT, CTR_OK, CTR_SIGN_MAX, DESC_MAX } from '../_ctr.js';
import { fillCtrForm, pickTemplate, FORM_DIR, FORM_MAX } from '../_ctrform.js';

let SB = SB_LIVE; // set from env in onRequest (sbFrom)
export const FETCH_MS = 15000;
const fetch = (u, o) => globalThis.fetch(u, o && o.signal ? o : { ...(o || {}), signal: AbortSignal.timeout(FETCH_MS) });
// The network calls a test replaces (Graph only; Supabase goes through fetch).
// formTemplate: the newest form 146.03 (.docx) in the contractors' folder, read whole (GET only).
const G = 'https://graph.microsoft.com/v1.0/me/drive/';
const OD_SAFETY = '\u05e9\u05d5\u05dc\u05d7\u05df \u05d4\u05e2\u05d1\u05d5\u05d3\u05d4/\u05e0\u05d9\u05d4\u05d5\u05dc \u05d1\u05d8\u05d9\u05d7\u05d5\u05ea/';
const encPath = (p) => String(p).split('/').filter(Boolean).map(encodeURIComponent).join('/');
export async function formTemplate(token) {
  const gh = { Authorization: 'Bearer ' + token };
  const l = await fetch(G + 'root:/' + encPath(OD_SAFETY + FORM_DIR) + ':/children?$select=name,lastModifiedDateTime,folder&$top=200', { headers: gh });
  if (!l.ok) throw new Error('form folder ' + l.status);
  const name = pickTemplate(((await l.json()) || {}).value);
  if (!name) throw new Error('form 146.03 not in the folder');
  const r = await fetch(G + 'root:/' + encPath(OD_SAFETY + FORM_DIR + '/' + name) + ':/content', { headers: gh });
  if (!r.ok) throw new Error('form ' + r.status);
  if (+(r.headers.get('content-length') || 0) > FORM_MAX) throw new Error('form too big');
  const b = new Uint8Array(await r.arrayBuffer());
  if (b.length > FORM_MAX) throw new Error('form too big');
  return { name, bytes: b };
}
export const ctrDeps = { accessToken, putFile, sendMailTo, graphPdf, formTemplate };

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
    '\u05dc\u05d4\u05e2\u05d1\u05d9\u05e8 \u05dc\u05e7\u05d1\u05dc\u05df \u05d1\u05e2\u05e6\u05de\u05da. \u05d4\u05e7\u05d1\u05dc\u05df \u05de\u05de\u05dc\u05d0 \u05e4\u05e8\u05d8\u05d9\u05dd \u05d5\u05de\u05e1\u05de\u05db\u05d9\u05dd, \u05d5\u05db\u05dc \u05d4\u05e2\u05d5\u05d1\u05d3\u05d9\u05dd \u05e9\u05dc\u05d5 \u05d7\u05d5\u05ea\u05de\u05d9\u05dd \u05e2\u05dc \u05d4\u05d5\u05e8\u05d0\u05d5\u05ea \u05d4\u05d1\u05d8\u05d9\u05d7\u05d5\u05ea \u05d1\u05d0\u05d5\u05ea\u05d5 \u05d8\u05dc\u05e4\u05d5\u05df (\u05d8\u05d5\u05e4\u05e1 146.03 \u05de\u05ea\u05de\u05dc\u05d0 \u05dc\u05d1\u05d3). \u05d0\u05d7\u05e8 \u05db\u05da \u05de\u05e7\u05d1\u05dc \u05e7\u05d9\u05e9\u05d5\u05e8 \u05dc\u05e2\u05d5\u05d1\u05d3 \u05d7\u05d3\u05e9. \u05d4\u05e2\u05ea\u05e7 \u05e9\u05dc \u05d4\u05db\u05d5\u05dc \u05d9\u05d2\u05d9\u05e2 \u05d0\u05dc\u05d9\u05da \u05d1\u05de\u05d9\u05d9\u05dc.'];
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
export const LIM = { company: 80, contact: 60, email: 100, place: 120, signer: 60, desc: DESC_MAX };
const MOBILE_RE = /^(?:\+?972|0)5\d{8}$/, EMAIL_RE = /^[^\s@<>"']{1,64}@[A-Za-z0-9.-]{1,120}\.[A-Za-z]{2,}$/;
// The workers' rows of the page (16/11/2026): [{ n, id, sig }] where sig = the PNG bytes of the finger signature or null.
// A row left wholly empty is skipped. Each other row needs a name (any letters, talk.js ctrName), an ID or passport
// number (idOf) and a signature; an ID twice is refused. {list: [{n, id, sig}]} or {errors}.
export function checkWorkers(rows) {
  const list = (rows || []).filter((r) => r && (String(r.n || '').trim() || String(r.id || '').trim() || r.sig));
  if (!list.length) return { errors: ['\u05e6\u05e8\u05d9\u05da \u05dc\u05e4\u05d7\u05d5\u05ea \u05e2\u05d5\u05d1\u05d3 \u05d0\u05d7\u05d3: \u05e9\u05dd, \u05de\u05e1\u05e4\u05e8 \u05ea\u05e2\u05d5\u05d3\u05ea \u05d6\u05d4\u05d5\u05ea \u05d5\u05d7\u05ea\u05d9\u05de\u05d4.'] };
  if (list.length > CTR_SIGN_MAX) return { errors: ['\u05d0\u05e4\u05e9\u05e8 \u05e2\u05d3 ' + CTR_SIGN_MAX + ' \u05e2\u05d5\u05d1\u05d3\u05d9\u05dd \u05d1\u05e9\u05dc\u05d9\u05d7\u05d4 \u05d0\u05d7\u05ea. \u05d4\u05e9\u05d0\u05e8 \u05d9\u05d7\u05ea\u05de\u05d5 \u05d0\u05d7\u05e8 \u05db\u05da \u05d1\u05e7\u05d9\u05e9\u05d5\u05e8 \u05dc\u05e2\u05d5\u05d1\u05d3 \u05d7\u05d3\u05e9.'] };
  const out = [], errors = [], seen = new Set();
  list.forEach((r, i) => {
    const n = ctrName(r.n), id = idOf(r.id);
    if (!n || !id || !r.sig) { errors.push('\u05e2\u05d5\u05d1\u05d3 ' + (i + 1) + ': \u05e6\u05e8\u05d9\u05da \u05e9\u05dd, \u05de\u05e1\u05e4\u05e8 \u05ea\u05e2\u05d5\u05d3\u05ea \u05d6\u05d4\u05d5\u05ea \u05d0\u05d5 \u05d3\u05e8\u05db\u05d5\u05df, \u05d5\u05d7\u05ea\u05d9\u05de\u05d4 \u05d1\u05d0\u05e6\u05d1\u05e2.'); return; }
    const k = /^\d+$/.test(id) ? id.replace(/^0+/, '') : id;
    if (seen.has(k)) { errors.push('\u05e2\u05d5\u05d1\u05d3 ' + (i + 1) + ': \u05de\u05e1\u05e4\u05e8 \u05ea\u05e2\u05d5\u05d3\u05ea \u05d4\u05d6\u05d4\u05d5\u05ea \u05db\u05d1\u05e8 \u05d1\u05e8\u05e9\u05d9\u05de\u05d4.'); return; }
    seen.add(k); out.push({ n, id, sig: r.sig });
  });
  return errors.length ? { errors } : { list: out };
}
// f = the text fields (a plain object; f.workers = the rows for checkWorkers), files = [{doc, size, type}] where type
// comes from the bytes (null = not a PDF, JPG or PNG), t = the token. {v} or {errors: [...]} (each a sentence the
// contractor reads).
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
  v.desc = txt('desc', LIM.desc, true).replace(/\n{3,}/g, '\n\n');
  if (v.desc.length < 3) errors.push('\u05d7\u05e1\u05e8 \u05ea\u05d9\u05d0\u05d5\u05e8 \u05d4\u05e2\u05d1\u05d5\u05d3\u05d4.');
  const wk = checkWorkers(f.workers);
  if (wk.errors) errors.push(...wk.errors); else v.workers = wk.list;
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
  v.missing = missingDocs(req, have);
  errors.push(...missingMsg(v.missing));
  v.required = req;
  v.optMissing = opt.filter((k) => k !== 'oth' && !have[k]);
  v.signer = txt('signer', LIM.signer);
  if (v.signer.length < 2) errors.push('\u05d7\u05e1\u05e8 \u05e9\u05dd \u05de\u05e0\u05d4\u05dc \u05d4\u05e2\u05d1\u05d5\u05d3\u05d4 \u05e9\u05d7\u05d5\u05ea\u05dd.');
  v.sid = idOf(f.sid);
  if (!v.sid) errors.push('\u05d7\u05e1\u05e8 \u05de\u05e1\u05e4\u05e8 \u05ea\u05e2\u05d5\u05d3\u05ea \u05d4\u05d6\u05d4\u05d5\u05ea \u05e9\u05dc \u05de\u05e0\u05d4\u05dc \u05d4\u05e2\u05d1\u05d5\u05d3\u05d4 \u05e9\u05d7\u05d5\u05ea\u05dd.');
  if (String(f.commit || '') !== '1') errors.push('\u05e6\u05e8\u05d9\u05da \u05dc\u05e1\u05de\u05df \u05d0\u05ea \u05d4\u05d4\u05ea\u05d7\u05d9\u05d9\u05d1\u05d5\u05ea \u05dc\u05e4\u05e0\u05d9 \u05d4\u05e9\u05dc\u05d9\u05d7\u05d4.');
  if (!f.sig) errors.push('\u05d7\u05e1\u05e8\u05d4 \u05d7\u05ea\u05d9\u05de\u05d4. \u05d7\u05ea\u05de\u05d5 \u05d1\u05d0\u05e6\u05d1\u05e2 \u05d1\u05ea\u05d5\u05da \u05d4\u05de\u05e1\u05d2\u05e8\u05ea.');
  return errors.length ? { errors } : { v };
}

// ---- the page ----
const workBoxes = () => CTR_WORKS.map((k) => '<label class="ck"><input type="checkbox" name="works" value="' + k + '" class="wk">' + esc(workLabel(k)) + '</label>').join('');
// Which works need each document (for the page's script; the server checks again).
const docWorks = (key) => CTR_WORKS.filter((w) => requiredDocs([w], false).indexOf(key) >= 0);
function docField(key, t) {
  const always = key === 'ins' && t.ins, opt = key === 'oth' || (key === 'ins' && !t.ins);
  const note = opt && key !== 'oth' ? ' (\u05dc\u05d0 \u05d7\u05d5\u05d1\u05d4)' : '';
  return '<div class="doc' + (always || opt ? ' on' : '') + '" data-doc="' + key + '" data-works="' + docWorks(key).join(',') + '" data-req="' + (always ? '1' : opt ? '0' : 'w') + '">'
    + '<label for="f_' + key + '">' + esc(CTR_DOC_L[key]) + esc(note) + '</label><input type="file" id="f_' + key + '" name="f_' + key + '" accept="application/pdf,image/jpeg,image/png" multiple></div>';
}
// Before 16/11/2026 every document field showed whatever was ticked (no rule hid .doc); now only those of the works.
const PAGE_CSS = '<style>.doc{display:none;margin:6px 0}.doc.on{display:block}.wr{border:1px solid #d1d5db;border-radius:10px;padding:8px 10px;margin:8px 0;background:#fafafa}'
  + '.wh{font-weight:700;margin-bottom:4px}.wr canvas{width:100%;height:110px;border:2px dashed #9ca3af;border-radius:8px;touch-action:none;background:#fff;display:block}'
  + '.wb{display:flex;gap:8px}.wb button{flex:1;padding:8px;border:0;border-radius:8px;background:#e5e7eb;font-size:15px;margin-top:6px}'
  + '.ins{white-space:pre-wrap;max-height:340px;overflow:auto;border:1px solid #d1d5db;border-radius:8px;padding:10px;background:#fff;font-size:15px;line-height:1.55}</style>';
// One worker's row (no data of the link in it: the script copies it for each worker).
export const ROW_HTML = '<div class="wh"></div>'
  + '<label>\u05e9\u05dd \u05de\u05dc\u05d0</label><input type="text" name="wn" maxlength="60" autocomplete="off">'
  + '<label>\u05de\u05e1\u05e4\u05e8 \u05ea\u05e2\u05d5\u05d3\u05ea \u05d6\u05d4\u05d5\u05ea \u05d0\u05d5 \u05d3\u05e8\u05db\u05d5\u05df</label><input type="text" name="wi" maxlength="15" dir="ltr" autocomplete="off">'
  + '<input type="hidden" name="ws"><div style="font-weight:700;margin:6px 0 4px">\u05d7\u05ea\u05d9\u05de\u05ea \u05d4\u05e2\u05d5\u05d1\u05d3 \u05d1\u05d0\u05e6\u05d1\u05e2</div><canvas></canvas>'
  + '<div class="wb"><button type="button" class="wc">\u05e0\u05e7\u05d4 \u05d7\u05ea\u05d9\u05de\u05d4</button><button type="button" class="wx">\u05d4\u05e1\u05e8 \u05e2\u05d5\u05d1\u05d3</button></div>';
const J = (s) => JSON.stringify(s);
const SCRIPT = (nonce) => `(function(){${PAD_JS}
var f=document.getElementById('f'),sig=document.getElementById('sig'),go=document.getElementById('go');
document.getElementById('clr').addEventListener('click',function(){x.clearRect(0,0,c.width,c.height);drawn=false;});
function upd(){var on=[];Array.prototype.forEach.call(document.querySelectorAll('.wk'),function(b){if(b.checked)on.push(b.value);});
Array.prototype.forEach.call(document.querySelectorAll('.doc'),function(d){var r=d.getAttribute('data-req');if(r!=='w')return;var ws=d.getAttribute('data-works').split(',');var need=ws.some(function(w){return on.indexOf(w)>=0;});d.className='doc'+(need?' on':'');});}
Array.prototype.forEach.call(document.querySelectorAll('.wk'),function(b){b.addEventListener('change',upd);});upd();
var wl=document.getElementById('wl'),rows=[],MAX=${CTR_SIGN_MAX};
function mkPad(cv){var cx=cv.getContext('2d'),st={d:false,dn:false};var r0=cv.getBoundingClientRect();cv.width=r0.width||300;cv.height=110;cx.lineWidth=2.5;cx.lineCap='round';cx.strokeStyle='#111';
function q(e){var r=cv.getBoundingClientRect();return{x:(e.clientX-r.left)*cv.width/r.width,y:(e.clientY-r.top)*cv.height/r.height};}
function dn(e){st.dn=true;var p=q(e);cx.beginPath();cx.moveTo(p.x,p.y);}
function mv(e){if(!st.dn)return;var p=q(e);cx.lineTo(p.x,p.y);cx.stroke();st.d=true;}
function up(){st.dn=false;}
if(window.PointerEvent){cv.addEventListener('pointerdown',function(e){dn(e);try{cv.setPointerCapture(e.pointerId);}catch(z){}e.preventDefault();});cv.addEventListener('pointermove',function(e){mv(e);e.preventDefault();});cv.addEventListener('pointerup',up);cv.addEventListener('pointercancel',up);}
else{cv.addEventListener('touchstart',function(e){if(e.touches&&e.touches[0])dn(e.touches[0]);e.preventDefault();},{passive:false});cv.addEventListener('touchmove',function(e){if(e.touches&&e.touches[0])mv(e.touches[0]);e.preventDefault();},{passive:false});cv.addEventListener('touchend',up);cv.addEventListener('mousedown',dn);cv.addEventListener('mousemove',mv);window.addEventListener('mouseup',up);}
return{st:st,cv:cv,clear:function(){cx.clearRect(0,0,cv.width,cv.height);st.d=false;}};}
function num(){rows.forEach(function(r,i){r.el.querySelector('.wh').textContent=${J('\u05e2\u05d5\u05d1\u05d3 ')}+(i+1);});}
function addRow(){if(rows.length>=MAX){alert(${J('\u05d0\u05e4\u05e9\u05e8 \u05e2\u05d3 ' + CTR_SIGN_MAX + ' \u05e2\u05d5\u05d1\u05d3\u05d9\u05dd \u05d1\u05e9\u05dc\u05d9\u05d7\u05d4 \u05d0\u05d7\u05ea. \u05d4\u05e9\u05d0\u05e8 \u05d9\u05d7\u05ea\u05de\u05d5 \u05d0\u05d7\u05e8 \u05db\u05da \u05d1\u05e7\u05d9\u05e9\u05d5\u05e8 \u05dc\u05e2\u05d5\u05d1\u05d3 \u05d7\u05d3\u05e9.')});return;}
var d=document.createElement('div');d.className='wr';d.innerHTML=${J(ROW_HTML)};wl.appendChild(d);var r={el:d,pad:mkPad(d.querySelector('canvas'))};rows.push(r);num();
d.querySelector('.wc').addEventListener('click',function(){r.pad.clear();});
d.querySelector('.wx').addEventListener('click',function(){if(rows.length<2){d.querySelector('[name=wn]').value='';d.querySelector('[name=wi]').value='';r.pad.clear();return;}wl.removeChild(d);rows.splice(rows.indexOf(r),1);num();});
d.querySelector('[name=wn]').focus();}
document.getElementById('add').addEventListener('click',addRow);addRow();
f.addEventListener('submit',function(e){var miss=[];Array.prototype.forEach.call(document.querySelectorAll('.doc.on'),function(d){var r=d.getAttribute('data-req'),i=d.querySelector('input');if(r==='0')return;if(!i.files||!i.files.length)miss.push(d.querySelector('label').textContent);});
if(!document.querySelectorAll('.wk:checked').length){e.preventDefault();alert(${J('\u05e6\u05e8\u05d9\u05da \u05dc\u05e1\u05de\u05df \u05dc\u05e4\u05d7\u05d5\u05ea \u05e1\u05d5\u05d2 \u05e2\u05d1\u05d5\u05d3\u05d4 \u05d0\u05d7\u05d3.')});return;}
if(miss.length){e.preventDefault();alert(${J('\u05d7\u05e1\u05e8\u05d9\u05dd \u05de\u05e1\u05de\u05db\u05d9\u05dd:')}+'\\n'+miss.join('\\n'));return;}
var full=0,bad=[];rows.forEach(function(r,i){var n=r.el.querySelector('[name=wn]').value.trim(),id=r.el.querySelector('[name=wi]').value.trim(),s=r.pad.st.d;if(!n&&!id&&!s)return;if(!n||!id||!s)bad.push(i+1);else full++;});
if(bad.length){e.preventDefault();alert(${J('\u05d7\u05e1\u05e8 \u05e9\u05dd, \u05de\u05e1\u05e4\u05e8 \u05ea\u05e2\u05d5\u05d3\u05ea \u05d6\u05d4\u05d5\u05ea \u05d0\u05d5 \u05d7\u05ea\u05d9\u05de\u05d4 \u05d0\u05e6\u05dc \u05e2\u05d5\u05d1\u05d3:')}+' '+bad.join(', '));return;}
if(!full){e.preventDefault();alert(${J('\u05e6\u05e8\u05d9\u05da \u05dc\u05e4\u05d7\u05d5\u05ea \u05e2\u05d5\u05d1\u05d3 \u05d0\u05d7\u05d3: \u05e9\u05dd, \u05de\u05e1\u05e4\u05e8 \u05ea\u05e2\u05d5\u05d3\u05ea \u05d6\u05d4\u05d5\u05ea \u05d5\u05d7\u05ea\u05d9\u05de\u05d4.')});return;}
if(!drawn){e.preventDefault();alert(${J('\u05d7\u05e1\u05e8\u05d4 \u05d7\u05ea\u05d9\u05de\u05ea \u05de\u05e0\u05d4\u05dc \u05d4\u05e2\u05d1\u05d5\u05d3\u05d4. \u05d7\u05ea\u05de\u05d5 \u05d1\u05d0\u05e6\u05d1\u05e2 \u05d1\u05ea\u05d5\u05da \u05d4\u05de\u05e1\u05d2\u05e8\u05ea.')});return;}
rows.forEach(function(r){r.el.querySelector('[name=ws]').value=r.pad.st.d?r.pad.cv.toDataURL('image/png'):'';});
sig.value=c.toDataURL('image/png');go.disabled=true;go.textContent=${J('\u05e9\u05d5\u05dc\u05d7...')};});
})();`;
// instr = the text of form 146.03 (server_state ctr_instructions), shown whole before the workers sign.
export function formHtml(t, entry, tok, instr) {
  const inp = (n, l, type, extra) => '<label for="' + n + '">' + esc(l) + '</label><input type="' + (type || 'text') + '" id="' + n + '" name="' + n + '"' + (extra || '') + ' required>';
  return PAGE_CSS + '<p>' + esc(SITE.company) + ' \u05de\u05d1\u05e7\u05e9\u05ea \u05d0\u05ea \u05d4\u05e4\u05e8\u05d8\u05d9\u05dd \u05d5\u05d4\u05de\u05e1\u05de\u05db\u05d9\u05dd \u05dc\u05d0\u05d9\u05e9\u05d5\u05e8 \u05e2\u05d1\u05d5\u05d3\u05d4 \u05e9\u05dc \u05e7\u05d1\u05dc\u05df \u05d1\u05de\u05e4\u05e2\u05dc (' + esc(CTR_KIND_L[t.kind]) + ').'
    + (t.kind === 'temp' ? ' \u05ea\u05d0\u05e8\u05d9\u05db\u05d9 \u05d4\u05e2\u05d1\u05d5\u05d3\u05d4: ' + esc(dmy(t.ds)) + ' \u05e2\u05d3 ' + esc(dmy(t.de)) + '.' : '')
    + ' \u05db\u05dc \u05d4\u05e2\u05d5\u05d1\u05d3\u05d9\u05dd \u05e9\u05d9\u05d9\u05db\u05e0\u05e1\u05d5 \u05dc\u05de\u05e4\u05e2\u05dc \u05e7\u05d5\u05e8\u05d0\u05d9\u05dd \u05d0\u05ea \u05d4\u05d5\u05e8\u05d0\u05d5\u05ea \u05d4\u05d1\u05d8\u05d9\u05d7\u05d5\u05ea \u05d5\u05d7\u05d5\u05ea\u05de\u05d9\u05dd \u05db\u05d0\u05df, \u05d1\u05d0\u05d5\u05ea\u05d5 \u05d8\u05dc\u05e4\u05d5\u05df.</p>'
    + '<form id="f" method="POST" action="/api/ctr-link" enctype="multipart/form-data">'
    + '<input type="hidden" name="k" value="' + esc(tok) + '"><input type="hidden" name="sig" id="sig">'
    + '<div class="sec"><b>\u05e4\u05e8\u05d8\u05d9 \u05d4\u05d7\u05d1\u05e8\u05d4</b>'
    + inp('company', '\u05e9\u05dd \u05d4\u05d7\u05d1\u05e8\u05d4', 'text', ' maxlength="80" value="' + esc(entry.company || '') + '"')
    + inp('cnum', '\u05de\u05e1\u05e4\u05e8 \u05d4\u05d7\u05d1\u05e8\u05d4 (\u05d7.\u05e4 \u05d0\u05d5 \u05e2\u05d5\u05e1\u05e7 \u05de\u05d5\u05e8\u05e9\u05d4, 9 \u05e1\u05e4\u05e8\u05d5\u05ea)', 'text', ' inputmode="numeric" maxlength="11" dir="ltr"')
    + inp('contact', '\u05d0\u05d9\u05e9 \u05d4\u05e7\u05e9\u05e8', 'text', ' maxlength="60"')
    + inp('mobile', '\u05e0\u05d9\u05d9\u05d3', 'tel', ' maxlength="15" dir="ltr"')
    + inp('email', '\u05de\u05d9\u05d9\u05dc', 'email', ' maxlength="100" dir="ltr"')
    + (t.kind === 'temp' ? inp('place', '\u05de\u05e7\u05d5\u05dd \u05d4\u05e2\u05d1\u05d5\u05d3\u05d4 \u05d1\u05de\u05e4\u05e2\u05dc', 'text', ' maxlength="120"') : '') + '</div>'
    + '<div class="sec"><b>\u05d4\u05e2\u05d1\u05d5\u05d3\u05d5\u05ea \u05e9\u05ea\u05d1\u05e6\u05e2\u05d5</b>' + workBoxes()
    + '<label for="desc">\u05ea\u05d9\u05d0\u05d5\u05e8 \u05d4\u05e2\u05d1\u05d5\u05d3\u05d4 (\u05de\u05d4 \u05d9\u05e2\u05e9\u05d4, \u05d0\u05d9\u05e4\u05d4 \u05d5\u05d1\u05d0\u05d9\u05d6\u05d4 \u05e6\u05d9\u05d5\u05d3)</label><textarea id="desc" name="desc" maxlength="' + DESC_MAX + '" required></textarea></div>'
    + '<div class="sec"><b>\u05d4\u05de\u05e1\u05de\u05db\u05d9\u05dd</b><p class="yel">\u05dc\u05e4\u05d9 \u05d4\u05e2\u05d1\u05d5\u05d3\u05d5\u05ea \u05e9\u05e1\u05d9\u05de\u05e0\u05ea\u05dd. PDF, JPG \u05d0\u05d5 PNG, \u05e2\u05d3 4MB \u05dc\u05e7\u05d5\u05d1\u05e5.</p>'
    + CTR_DOCS.map((d) => docField(d[0], t)).join('') + '</div>'
    + '<div class="sec"><b>' + esc(CTR_TITLE) + ' (\u05d8\u05d5\u05e4\u05e1 146.03)</b><p class="yel">\u05db\u05dc \u05e2\u05d5\u05d1\u05d3 \u05e7\u05d5\u05e8\u05d0 \u05d0\u05ea \u05d4\u05d4\u05d5\u05e8\u05d0\u05d5\u05ea \u05dc\u05e4\u05e0\u05d9 \u05e9\u05d4\u05d5\u05d0 \u05d7\u05d5\u05ea\u05dd.</p><div class="ins">' + esc(instr) + '</div></div>'
    + '<div class="sec"><b>\u05e2\u05d5\u05d1\u05d3\u05d9 \u05d4\u05e7\u05d1\u05dc\u05df: \u05e9\u05d5\u05e8\u05d4 \u05dc\u05db\u05dc \u05e2\u05d5\u05d1\u05d3</b><p class="yel">\u05d1\u05d7\u05ea\u05d9\u05de\u05d4 \u05e9\u05dc\u05d5 \u05db\u05dc \u05e2\u05d5\u05d1\u05d3 \u05de\u05d0\u05e9\u05e8: ' + esc(CTR_OK) + ' \u05de\u05e2\u05d1\u05d9\u05e8\u05d9\u05dd \u05d0\u05ea \u05d4\u05d8\u05dc\u05e4\u05d5\u05df \u05de\u05e2\u05d5\u05d1\u05d3 \u05dc\u05e2\u05d5\u05d1\u05d3.</p>'
    + '<div id="wl"></div><button type="button" id="add" class="btn s">+ \u05d4\u05d5\u05e1\u05e4\u05ea \u05e2\u05d5\u05d1\u05d3</button></div>'
    + '<div class="sec"><b>\u05d4\u05ea\u05d7\u05d9\u05d9\u05d1\u05d5\u05ea \u05d5\u05d7\u05ea\u05d9\u05de\u05ea \u05de\u05e0\u05d4\u05dc \u05d4\u05e2\u05d1\u05d5\u05d3\u05d4</b>'
    + '<label class="ck"><input type="checkbox" name="commit" value="1" required>' + esc(CTR_COMMIT) + '</label>'
    + inp('signer', '\u05e9\u05dd \u05de\u05e0\u05d4\u05dc \u05d4\u05e2\u05d1\u05d5\u05d3\u05d4 \u05e9\u05d7\u05d5\u05ea\u05dd', 'text', ' maxlength="60"')
    + inp('sid', '\u05de\u05e1\u05e4\u05e8 \u05ea\u05e2\u05d5\u05d3\u05ea \u05d6\u05d4\u05d5\u05ea \u05e9\u05dc \u05de\u05e0\u05d4\u05dc \u05d4\u05e2\u05d1\u05d5\u05d3\u05d4', 'text', ' maxlength="15" dir="ltr"')
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
// The text of form 146.03 ('' = not set yet).
async function readInstr(env) {
  try {
    const r = await fetch(SB + '/rest/v1/server_state?select=value&key=eq.' + CTR_INSTR, { headers: sbH(env) });
    const rows = r.ok ? await r.json() : [];
    return instrText(rows && rows[0] && rows[0].value);
  } catch (e) { return ''; }
}
const INSTR_NOT_READY = '\u05d4\u05d5\u05e8\u05d0\u05d5\u05ea \u05d4\u05d1\u05d8\u05d9\u05d7\u05d5\u05ea \u05dc\u05e7\u05d1\u05dc\u05e0\u05d9 \u05d7\u05d5\u05e5 \u05e2\u05d5\u05d3 \u05dc\u05d0 \u05de\u05d5\u05db\u05e0\u05d5\u05ea \u05d1\u05de\u05e2\u05e8\u05db\u05ea. \u05d0\u05e4\u05e9\u05e8 \u05dc\u05e0\u05e1\u05d5\u05ea \u05e9\u05d5\u05d1 \u05de\u05d0\u05d5\u05d7\u05e8 \u05d9\u05d5\u05ea\u05e8 \u05d0\u05d5 \u05dc\u05e4\u05e0\u05d5\u05ea \u05dc\u05de\u05de\u05d5\u05e0\u05d4 \u05d4\u05d1\u05d8\u05d9\u05d7\u05d5\u05ea.';
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
  // the workers sign on these instructions: without them there is nothing to sign (as talk.js ctrNotReady)
  const instr = await readInstr(env);
  if (!instr) return errPage(INSTR_NOT_READY, 503);
  const nonce = newNonce();
  return page('\u05d0\u05d9\u05e9\u05d5\u05e8 \u05e7\u05d1\u05dc\u05df: ' + (entry.company || '\u05e4\u05e8\u05d8\u05d9\u05dd \u05d5\u05de\u05e1\u05de\u05db\u05d9\u05dd'), formHtml(t, entry, tok, instr), '', 200, nonce, SCRIPT(nonce));
}

// ---- after the checks: the files, the summary, the talk, the mail ----
// v.workers[i].sig = PNG bytes (each worker's signature, shown beside his name).
export function summaryHtml(t, v, when, sigB64, saved) {
  const cell = (k, x) => '<tr><td style="padding:3px 8px;font-weight:bold;white-space:nowrap;vertical-align:top">' + esc(k) + '</td><td style="padding:3px 8px">' + x + '</td></tr>';
  return '<!doctype html><html lang="he" dir="rtl"><head><meta charset="UTF-8"><title>' + esc('\u05d0\u05d9\u05e9\u05d5\u05e8 \u05e7\u05d1\u05dc\u05df: ' + v.company) + '</title></head>'
    + '<body style="font-family:Arial,sans-serif;font-size:13px;direction:rtl;text-align:right;margin:24px">'
    + '<h2 style="margin:0 0 4px">\u05d8\u05d5\u05e4\u05e1 \u05d0\u05d9\u05e9\u05d5\u05e8 \u05e7\u05d1\u05dc\u05df: ' + esc(v.company) + '</h2><div style="color:#555;margin-bottom:10px">' + esc(SITE.company) + ', ' + esc(CTR_KIND_L[t.kind]) + '</div>'
    + '<table style="border-collapse:collapse;margin-bottom:10px">'
    + cell('\u05de\u05e1\u05e4\u05e8 \u05d4\u05d7\u05d1\u05e8\u05d4', esc(v.cnum)) + cell('\u05d0\u05d9\u05e9 \u05d4\u05e7\u05e9\u05e8', esc(v.contact)) + cell('\u05e0\u05d9\u05d9\u05d3', esc(v.mobile)) + cell('\u05de\u05d9\u05d9\u05dc', esc(v.email))
    + (t.kind === 'temp' ? cell('\u05ea\u05d0\u05e8\u05d9\u05db\u05d9 \u05d4\u05e2\u05d1\u05d5\u05d3\u05d4', esc(dmy(t.ds) + ' \u05e2\u05d3 ' + dmy(t.de))) + cell('\u05de\u05e7\u05d5\u05dd \u05d4\u05e2\u05d1\u05d5\u05d3\u05d4', esc(v.place)) : '')
    + cell('\u05d4\u05e2\u05d1\u05d5\u05d3\u05d5\u05ea', esc(v.works.map(workLabel).join(', ')))
    + cell('\u05ea\u05d9\u05d0\u05d5\u05e8 \u05d4\u05e2\u05d1\u05d5\u05d3\u05d4', '<span style="white-space:pre-wrap">' + esc(v.desc || '') + '</span>')
    + cell('\u05de\u05e1\u05de\u05db\u05d9\u05dd \u05e9\u05e6\u05d5\u05e8\u05e4\u05d5', saved.length ? saved.map((x) => esc(CTR_DOC_L[x.doc] + ': ' + x.name)).join('<br>') : '-')
    + cell('\u05dc\u05d0 \u05e6\u05d5\u05e8\u05e3 (\u05dc\u05d0 \u05d7\u05d5\u05d1\u05d4)', v.optMissing.length ? esc(v.optMissing.map((k) => CTR_DOC_L[k]).join(', ')) : '-')
    + cell('\u05e0\u05e9\u05dc\u05d7', esc(dmy(when.day) + ' ' + when.hm)) + '</table>'
    + (v.workers && v.workers.length ? '<h3 style="margin:8px 0 4px">\u05d4\u05e2\u05d5\u05d1\u05d3\u05d9\u05dd \u05e9\u05e7\u05e8\u05d0\u05d5 \u05d0\u05ea \u05d4\u05d5\u05e8\u05d0\u05d5\u05ea \u05d4\u05d1\u05d8\u05d9\u05d7\u05d5\u05ea \u05d5\u05d7\u05ea\u05de\u05d5</h3><table style="border-collapse:collapse">' + v.workers.map((w, i) => '<tr><td style="padding:2px 8px">' + (i + 1) + '</td><td style="padding:2px 8px">' + esc(w.n) + '</td><td style="padding:2px 8px;direction:ltr">' + esc(w.id) + '</td><td style="padding:2px 8px">' + (w.sig ? '<img alt="" style="max-width:160px;max-height:50px" src="data:image/png;base64,' + b64(w.sig) + '">' : '') + '</td></tr>').join('') + '</table><p>' + esc(CTR_OK) + '</p>' : '')
    + '<p style="font-weight:bold;margin-top:12px">' + esc(CTR_COMMIT) + '</p>'
    + '<div>\u05e9\u05dd: ' + esc(v.signer) + (v.sid ? ', \u05ea.\u05d6. ' + esc(v.sid) : '') + '</div><div>\u05d7\u05ea\u05d9\u05de\u05d4:</div><img alt="" style="max-width:320px;max-height:120px;border-bottom:1px solid #333" src="data:image/png;base64,' + sigB64 + '">'
    + '</body></html>';
}
export const MAIL_SUBJECT = (t, v) => '\u05d0\u05d9\u05e9\u05d5\u05e8 \u05e7\u05d1\u05dc\u05df: ' + String(v.company).slice(0, 60) + ' (' + CTR_KIND_L[t.kind] + ')';
// The mail to Michael: what was filled, the works, the files (attached or as links), what is optional and not given, the commitment.
// form = { name, url } of form 146.03 filed, or { err } when it was not made.
export function mailHtml(t, v, saved, summary, attachedNames, workerUrl, instrMissing, form) {
  const row = (k, x) => '<tr><td style="padding:3px 10px;font-weight:bold;vertical-align:top">' + esc(k) + '</td><td style="padding:3px 10px">' + x + '</td></tr>';
  const fileLine = (x) => esc(CTR_DOC_L[x.doc] + ': ') + (x.url ? '<a href="' + esc(x.url) + '">' + esc(x.name) + '</a>' : esc(x.name)) + (attachedNames.indexOf(x.name) >= 0 ? ' (\u05de\u05e6\u05d5\u05e8\u05e3)' : '');
  return '<div dir="rtl" style="direction:rtl;text-align:right;font-family:Arial,sans-serif;font-size:14px">'
    + '<p>\u05d4\u05e7\u05d1\u05dc\u05df ' + esc(v.company) + ' \u05de\u05d9\u05dc\u05d0 \u05d0\u05ea \u05d8\u05d5\u05e4\u05e1 \u05d0\u05d9\u05e9\u05d5\u05e8 \u05d4\u05e7\u05d1\u05dc\u05df (' + esc(CTR_KIND_L[t.kind]) + ').</p><table>'
    + row('\u05de\u05e1\u05e4\u05e8 \u05d4\u05d7\u05d1\u05e8\u05d4', esc(v.cnum)) + row('\u05d0\u05d9\u05e9 \u05d4\u05e7\u05e9\u05e8', esc(v.contact) + ', ' + esc(v.mobile) + ', ' + esc(v.email))
    + (t.kind === 'temp' ? row('\u05ea\u05d0\u05e8\u05d9\u05db\u05d9 \u05d4\u05e2\u05d1\u05d5\u05d3\u05d4', esc(dmy(t.ds) + ' \u05e2\u05d3 ' + dmy(t.de))) + row('\u05de\u05e7\u05d5\u05dd', esc(v.place)) : '')
    + row('\u05d4\u05e2\u05d1\u05d5\u05d3\u05d5\u05ea', esc(v.works.map(workLabel).join(', ')))
    + row('\u05ea\u05d9\u05d0\u05d5\u05e8 \u05d4\u05e2\u05d1\u05d5\u05d3\u05d4', '<span style="white-space:pre-wrap">' + esc(v.desc || '') + '</span>')
    + row('\u05d1\u05d9\u05d8\u05d5\u05d7', t.ins ? '\u05e0\u05d3\u05e8\u05e9 \u05d5\u05e6\u05d5\u05e8\u05e3' : (v.optMissing.indexOf('ins') >= 0 ? '\u05dc\u05d0 \u05e0\u05d3\u05e8\u05e9, \u05dc\u05d0 \u05e6\u05d5\u05e8\u05e3' : '\u05dc\u05d0 \u05e0\u05d3\u05e8\u05e9, \u05e6\u05d5\u05e8\u05e3'))
    + row('\u05e2\u05d5\u05d1\u05d3\u05d9\u05dd \u05e9\u05d7\u05ea\u05de\u05d5', String((v.workers || []).length) + ' (\u05e9\u05dd, \u05ea.\u05d6. \u05d5\u05d7\u05ea\u05d9\u05de\u05d4 \u05dc\u05db\u05dc \u05d0\u05d7\u05d3, \u05d1\u05d8\u05d5\u05e4\u05e1 146.03)')
    + row('\u05d8\u05d5\u05e4\u05e1 146.03', form && form.url ? '<a href="' + esc(form.url) + '">' + esc(form.name) + '</a>' + (attachedNames.indexOf(form.name) >= 0 ? ' (\u05de\u05e6\u05d5\u05e8\u05e3)' : '') : '<span style="color:#b91c1c;font-weight:bold">\u05dc\u05d0 \u05e0\u05d5\u05e6\u05e8' + (form && form.err ? ' (' + esc(String(form.err).slice(0, 100)) + ')' : '') + '. \u05d4\u05e9\u05de\u05d5\u05ea \u05d5\u05d4\u05d7\u05ea\u05d9\u05de\u05d5\u05ea \u05d1\u05d8\u05d5\u05e4\u05e1 \u05d4\u05de\u05e1\u05db\u05dd.</span>')
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
  for (const x of items) {
    if (!x) continue; if (x.bytes && total + x.bytes.length <= MAIL_BUDGET) { out.push(x); total += x.bytes.length; } }
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

const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
// Form 146.03 filled (functions/_ctrform.js): the Word file and its PDF (Microsoft renders it, as Word prints it) in the
// contractor's folder, under one name. { name, url, bytes, type } of the PDF (the Word file when no PDF came), or
// { err } when the form could not be made. Never throws: the summary already holds the names and signatures.
export async function buildForm(deps, token, folder, t, v, mgrSig, when) {
  try {
    const tp = await deps.formTemplate(token);
    const fl = await fillCtrForm(tp.bytes, { company: v.company, cnum: v.cnum, signer: v.signer, sid: v.sid, contact: v.mobile, date: dmy(when.day),
      works: v.works.map(workLabel).join(', '), desc: v.desc, job: t.kind === 'temp' ? dmy(t.ds) + ' \u05e2\u05d3 ' + dmy(t.de) + ', ' + v.place : '', mgrSig, workers: v.workers });
    // the hour in the name: a second send of the same company on the same day never meets the first (rename would
    // give the file another name, and the PDF would be made from the older one)
    const base = when.stamp + ' ' + when.hm.replace(':', '-') + ' - \u05d8\u05d5\u05e4\u05e1 146.03 \u05d7\u05ea\u05d5\u05dd - ' + safeName(v.company, 40);
    const wd = await deps.putFile(token, folder, base + '.docx', fl.bytes, DOCX, 'rename');
    const pdf = await deps.graphPdf(token, (folder + '/' + base + '.docx').split('/').map(encodeURIComponent).join('/'), 25000);
    if (!pdf) return { name: base + '.docx', url: wd.webUrl || null, bytes: fl.bytes, type: DOCX, err: 'pdf', missing: fl.report.missing };
    const wp = await deps.putFile(token, folder, base + '.pdf', pdf, 'application/pdf', 'rename');
    return { name: base + '.pdf', url: wp.webUrl || null, bytes: pdf, type: 'application/pdf', missing: fl.report.missing };
  } catch (e) { return { err: String((e && e.message) || e).slice(0, 120) }; }
}
// One toolbox_reads row per worker of the send, his signature in Storage, as talk.js writes a contractor worker's
// signature (emp_id x:<ID>:<name>, so the new-worker link finds him signed). {n: rows written, err}.
export async function workerReads(env, talkId, v, instr, atIso) {
  const talk = { title: CTR_TITLE + ': ' + v.company, body: instr, file_url: null };
  const hash = await textHash(talk, 'he');
  const rows = [];
  for (const w of v.workers) {
    const key = 'x:' + w.id + ':';
    const tag = 'x' + Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(key)))).slice(0, 8).map((b) => b.toString(16).padStart(2, '0')).join('');
    const name = 'sig-' + talkId + '-' + tag + '.png';
    const up = await fetch(SB + '/storage/v1/object/' + BUCKET + '/' + name, { method: 'POST', headers: sbH(env, { 'Content-Type': 'image/png', 'x-upsert': 'true' }), body: w.sig });
    if (!up.ok) continue;
    rows.push({ id: newNonce().slice(0, 16), talk_id: talkId, emp_id: key + w.n.toLowerCase(), emp_name: w.n, id_no: w.id, dept: v.company, lang: 'he', text_hash: hash,
      sig_url: SB + '/storage/v1/object/public/' + BUCKET + '/' + name, device: 'ctr-link', read_at: atIso, mode: 'link' });
  }
  if (!rows.length) return { n: 0, err: 'storage' };
  const ins = await fetch(SB + '/rest/v1/toolbox_reads', { method: 'POST', headers: sbH(env, { 'Content-Type': 'application/json', Prefer: 'return=minimal' }), body: JSON.stringify(rows) });
  return ins.ok ? { n: rows.length, err: rows.length < v.workers.length ? 'storage' : null } : { n: 0, err: 'insert ' + ins.status };
}

async function submit(env, request, nowMs, deps) {
  const ct = request.headers.get('content-type') || '';
  if (!/multipart\/form-data/i.test(ct)) return errPage('\u05d4\u05d8\u05d5\u05e4\u05e1 \u05dc\u05d0 \u05e0\u05e9\u05dc\u05d7 \u05db\u05e8\u05d0\u05d5\u05d9. \u05e0\u05e1\u05d5 \u05e9\u05d5\u05d1 \u05de\u05d4\u05e7\u05d9\u05e9\u05d5\u05e8.', 415);
  const len = Number(request.headers.get('content-length') || 0);
  // A browser always states the size of a form with files; without it the body could be read without end (review 15/11/2026).
  if (!len) return errPage('\u05d4\u05d8\u05d5\u05e4\u05e1 \u05dc\u05d0 \u05e0\u05e9\u05dc\u05d7 \u05db\u05e8\u05d0\u05d5\u05d9. \u05e0\u05e1\u05d5 \u05e9\u05d5\u05d1 \u05de\u05d4\u05e7\u05d9\u05e9\u05d5\u05e8.', 411);
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
  for (const k of ['company', 'cnum', 'contact', 'mobile', 'email', 'place', 'desc', 'signer', 'sid', 'commit']) f[k] = form.get(k) == null ? '' : String(form.get(k));
  // the workers' rows, in the page's order (each row sends wn, wi and ws, so the three lists line up); a count far past
  // CTR_SIGN_MAX is cut before any signature is decoded, and checkWorkers refuses it
  const wn = form.getAll('wn').slice(0, CTR_SIGN_MAX + 5), wi = form.getAll('wi'), wsg = form.getAll('ws');
  f.workers = wn.map((n, i) => ({ n: String(n || ''), id: String(wi[i] || ''), sig: sigBytes(wsg[i]) }));
  const c = checkCtrForm(f, files, t);
  const nonce = newNonce();
  if (c.errors) return page('\u05e6\u05e8\u05d9\u05da \u05dc\u05d4\u05e9\u05dc\u05d9\u05dd', '<ul>' + c.errors.map((e) => '<li>' + esc(e) + '</li>').join('') + '</ul>' + backBtn(nonce), 'err', 400, nonce);
  const v = c.v;
  // the workers sign on the instructions: without them nothing is taken (the page already refuses to open)
  const instr = await readInstr(env);
  if (!instr) return errPage(INSTR_NOT_READY, 503);
  // claim: sent -> filled, once (a second send at the same moment finds it filled)
  const atIso = new Date(nowMs).toISOString();
  const claim = { status: CTR_S_FILLED, at: atIso, company: v.company, cnum: v.cnum, contact: v.contact, mobile: v.mobile, email: v.email, works: v.works, place: v.place || null, desc: v.desc, signer: v.signer, workers: v.workers.length };
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
  let od, saved = [], summary = null, form146 = null;
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
    form146 = await buildForm(deps, od.token, folder, t, v, sig, { day, hm, stamp });
  } catch (e) {
    await giveBack();
    return errPage('\u05d4\u05e7\u05d1\u05e6\u05d9\u05dd \u05dc\u05d0 \u05e0\u05e9\u05de\u05e8\u05d5 \u05d1\u05d2\u05dc\u05dc \u05ea\u05e7\u05dc\u05d4 \u05d6\u05de\u05e0\u05d9\u05ea. \u05e0\u05e1\u05d5 \u05dc\u05e9\u05dc\u05d5\u05d7 \u05e9\u05d5\u05d1 \u05d1\u05e2\u05d5\u05d3 \u05db\u05de\u05d4 \u05d3\u05e7\u05d5\u05ea (\u05d4\u05e7\u05d1\u05e6\u05d9\u05dd \u05e6\u05e8\u05d9\u05db\u05d9\u05dd \u05dc\u05d4\u05d9\u05d1\u05d7\u05e8 \u05de\u05d7\u05d3\u05e9).', 503);
  }
  // the talk: published with the company and the instructions; its permanent link is the new-worker link
  const pub = await fetch(SB + '/rest/v1/toolbox_talks?id=eq.' + encodeURIComponent(entry0.talk) + '&kind=eq.' + KIND_CTR, { method: 'PATCH', headers: sbH(env, { 'Content-Type': 'application/json', Prefer: 'return=minimal' }),
    body: JSON.stringify({ s: S_PUB, d: day, dept: v.company, title: CTR_TITLE + ': ' + v.company, body: instr, link_at: atIso }) }).catch(() => null);
  const entry = Object.assign({}, entry0, claim);
  const wUrl = pub && pub.ok ? await workerLink(env, t, entry, nowMs).catch(() => null) : null;
  // each worker as a signature of the talk (the app's training records; the new-worker link then sees him as signed)
  const reads = pub && pub.ok ? await workerReads(env, entry0.talk, v, instr, atIso).catch(() => ({ n: 0, err: 'reads' })) : { n: 0, err: 'talk' };
  // the mail to Michael
  let mail = 'sent';
  try {
    const att = pickAttach([form146 && form146.bytes ? form146 : null, summary].concat(saved));
    const html = mailHtml(t, v, saved, summary, att.map((x) => x.name), wUrl, false, form146);
    await deps.sendMailTo(od.token, [od.email], [], MAIL_SUBJECT(t, v), html,
      att.map((x) => ({ '@odata.type': '#microsoft.graph.fileAttachment', name: x.name, contentType: x.type, contentBytes: b64(x.bytes) })));
  } catch (e) { mail = 'err: ' + String((e && e.message) || e).slice(0, 120); }
  await stateCas(SB, sbH(env, { 'Content-Type': 'application/json' }), CTR_STATE, (cur) => {
    const p = statePatch(cur, t.rid, { files: saved.length, folder, mail, summary: summary.url || null, worker_link: !!wUrl, form: form146 && form146.url || null, form_err: form146 && form146.err || null, reads: reads.n, reads_err: reads.err || null });
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
