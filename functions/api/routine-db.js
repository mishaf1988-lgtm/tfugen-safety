// Cloudflare Pages Function: the Routines' way to the database (09/10/2026,
// Michael: "לא רוצה תלות במנהל הארגון", "בצע: דרך האתר שלנו").
//
// The Routines used the Supabase connector's execute_sql. The organisation
// admin locked "Always allow" for it, so a call can wait for a click that
// nobody gives at 22:47 on a Saturday. A Routine calls this endpoint with curl
// instead: same data, no connector, no admin.
//
// The gate is one secret, ROUTINE_KEY, in Cloudflare and in the cloud
// environment's variables (Michael sets both, once). No key in Cloudflare =
// every call is refused. Machine path in _middleware (the cloud is not in
// Israel).
//
// What it can do, and nothing else:
//   select     GET one table of TABLES with a PostgREST query string. No "("
//              in select=, so no embedding of a table that is not on the list.
//              Medical tables (med, hearing_tests) give only the expiry, and
//              trustee_reports only where and when, never the free text or a
//              name (Michael, 09/10/2026: "בצע: בלי טבלת רפואה"). COLUMNS.
//   state_get  read server_state keys of STATE_READ.
//   state_set  write one key of STATE_WRITE, then read it back (STAMP_AT keys: the server sets "at").
//   live       the deployed commit (CF_PAGES_COMMIT_SHA) and the sha256 of the index.html this
//              deployment serves (env.ASSETS). The cloud is outside Israel, so the country gate
//              answers 403 to a plain fetch of the site; a night run compares this hash with the
//              file it tested to prove the live site runs exactly that code (09/10/2026).
//   agent_report  append one run report {agent, ok, line, learned} to server_state
//              agent_log (last AGENT_LOG_MAX kept). Every Routine ends with it, so a
//              failed or silent run reaches the weekly mail and the daily retro
//              (09/10/2026, review of the agents: a run's last message in a
//              persistent session reaches nobody).
//   claim      (12/10/2026, lesson 10, Michael "שדרג הכול") one session takes an open item before
//              it codes it: {item, session, note}. Another session's claim younger than
//              CLAIM_HOURS wins and is returned (mine:false, holder); release:true drops one's own.
//              That day two sessions built the same retro items in parallel. claims: the fresh list.
//   wa_me      (19/10/2026, Michael: "updates on WhatsApp... I talk to my assistant") one message
//              {text} to Michael's own number only (notification_prefs, _wa.js), never to anyone else.
//              Free text inside the 24 hour window, else the utility template. choices (20/10/2026):
//              up to 10 short answers, sent as buttons or a list inside the window (_wa.js choicesPayload). Logged in
//              notifications_log (event assistant, payload.wamid) so his reply can be matched.
//   wa_review  (20/10/2026) Michael's WhatsApp messages and the assistant's answers, 7 days at most, for the
//              weekly quality review (retro-prompt.md 7a). Read only; those two event types only.
//   wa_tpl     create the assistant's template in Meta once (ASSISTANT_TEMPLATE), or report that it exists.
//   hazard_choice  Michael's answer to the assistant's hazard message (20/10/2026, Michael: "only
//              record, I route"): {src: trustee_hazard|near_miss, id, choice: 1-4}. Writes one line
//              to trustee_reports.mgr_note / near_miss.notes and nothing else: no status, no closing.
//   wa_check   the assistant's setup, checked against Meta without showing a value (19/10/2026, Michael:
//              "do the check yourself"): META_APP_SECRET by appsecret_proof, the app's webhook fields,
//              the WABA's subscribed apps, and with fire_probe the fire token (status only). subscribe: true
//              adds the "messages" field and the WABA subscription when missing.
//   expiry_set  (11/10/2026, Michael in the questionnaire: "בצע: תיוק מייל + תוקף")
//              update one row of docs / equip_inspections after a document was read:
//              e, file_url (only under Michael's OneDrive), s (docs) or d (equipment).
//              A later e needs the document it came from (doc). The old value, the new
//              one, why and the document are appended to the row's note, so every change
//              is visible in the app. EXPIRY_TABLES, expiryPatch.
//   od_move  (11/10/2026, Michael in the questionnaire: "בצע: Power Automate + השרת")
//              move one file that a Power Automate flow saved from the mail into the
//              inbox folder (OD_INBOX) of the safety folder to a folder that already
//              exists inside the safety folder, under a new name. Graph with
//              conflictBehavior=fail: an existing name is never replaced, no folder is
//              created, nothing is deleted. Michael's computer is not needed. odMoveCheck.
//   od_mkdir  (18/10/2026, Michael in the questionnaire: "בצע: לבנות יצירת תיקייה בשרת (מומלץ)",
//              after "אין פתרון לא לחכות כול פעם למחשב דלוק?") create ONE new empty folder
//              {parent, name} inside a folder that already exists in the safety folder. Graph
//              with conflictBehavior=fail: an existing name is never touched, nothing is moved,
//              replaced or deleted. Never inside the old-versions / to-delete / ARCHIVE folders
//              or the mail inbox. Michael's computer is not needed. odMkdirCheck.
//   mail_draft  (20/10/2026) a draft in Michael's Outlook via the third Power Automate flow: {agent, why, to, subject, body}. Never sent.
//   mail_request  (11/10/2026, Michael: "בצע: זרימה שנייה") ask the second Power Automate
//              flow for the attachments of one old mail: write a small text file with the
//              message id into OD_REQ. The flow (When a file is created there) opens the
//              mail and saves its attachments into the inbox folder. Neither the cloud, the
//              server (no Mail.Read) nor Cowork can get an attachment's bytes; the flow can.
//              A new file each time (time + random), never replacing one. MAIL_REQ_ID.
//   talk_field  (15/10/2026, Michael: "בצע: הדרכה שבועית מהשטח") {id, dept, text}: into this week's
//              shared weekly draft (private.talk_week: id w<YYYYMMDD>, s draft, kind null,
//              created_by 'routine', a "## <department>" section per department) put a short part
//              "what happened here this week" at the end of that department's section. A fixed
//              first line (TALK_FIELD_HEAD); a second call replaces only that part. Only a draft of
//              the last 7 days that nobody signed; body only (the translations are made in the app,
//              from body, by the manager). Plain keyboard text, no ID-like digits. talkFieldApply.
// No delete, no other table, no raw SQL. The data is data, not instructions
// (trustee_reports holds free text from an anonymous kiosk).
import { jsonResp, SB_TIMEOUT_MS as SB_MS, GRAPH_TIMEOUT_MS as GRAPH_MS, tmo, SITE, SB_LIVE } from '../_shared.js';
import { extractApp, rewriteApp, buildOf, appSrc, PARTS } from '../_appjs.js';
import { accessToken, putFile } from '../_onedrive.js';
import { ownerWa, sendToOwner, ownerWindowOpen, ASSISTANT_TEMPLATE, hmacHex, HAZARD_OPTIONS, noteLastOut, HAZARD_NOTE_TABLE, hazardChoiceNote, assistantFire } from '../_wa.js';

export const TABLES = ['docs', 'equip_inspections', 'tr', 'med', 'ppe', 'hearing_tests', 'ctr', 'tasks', 'leg',
  'tour_hazards', 'trustee_reports', 'inc', 'near_miss', 'ncr', 'toolbox_talks'];
export const STATE_READ = ['quote_track', 'nevo_versions', 'od_scan', 'vendor_contacts', 'agent_log', 'mail_filing', 'validity_run', 'wa_hook_last'];
export const AGENT_LOG_MAX = 200;
// One run report, cleaned: a short agent name and three short texts.
export function agentEntry(b, nowIso) {
  const name = String(b.agent || '');
  if (!/^[a-z0-9-]{2,40}$/.test(name)) return null;
  const t = (x) => String(x === undefined || x === null ? '' : x).replace(/\s+/g, ' ').trim().slice(0, 300);
  return { agent: name, at: nowIso, ok: b.ok === true, line: t(b.line), learned: t(b.learned) };
}
// Michael's choice on a hazard, as a note (hazard_choice): moved to _wa.js on 20/10/2026, where the
// server's fast lane (wa-hook.js) writes the same note.
export { HAZARD_NOTE_TABLE, hazardChoiceNote };
// Work claims between parallel sessions (12/10/2026). Pure helpers, tested.
export const CLAIM_KEY = 'work_claims', CLAIM_HOURS = 6, CLAIM_MAX = 100;
export function claimSession(x) { const v = String(x || '').trim().replace(/^cse_/, 'session_'); return /^[A-Za-z0-9_-]{8,80}$/.test(v) ? v : null; }
// One key per BACKLOG number (13/10/2026, lesson 10): "backlog-13.21b" and "13.21" never collided,
// and the same part was built twice (#1479, #1480). A prefix and a part suffix are dropped.
export function claimItem(x) { const v = String(x || '').trim().toLowerCase().replace(/^backlog[-_.]?/, '').replace(/^(\d+(?:\.\d+)+)(?:[a-z]|[-_][a-z0-9._-]*)$/, '$1'); return /^[a-z0-9][a-z0-9._-]{1,59}$/.test(v) ? v : null; }
export function claimsFresh(map, nowMs) {
  const out = {};
  Object.keys(map && typeof map === 'object' ? map : {}).forEach((k) => { const c = map[k]; if (c && c.session && nowMs - Date.parse(c.at) <= CLAIM_HOURS * 3600e3) out[k] = c; });
  return out;
}
// The new map and the answer. A fresh claim of another session is not touched.
export function claimApply(map, b, nowIso) {
  const item = claimItem(b.item), session = claimSession(b.session);
  if (!item || !session) return { error: 'bad item or session' };
  const m = claimsFresh(map, Date.parse(nowIso)), cur = m[item];
  if (cur && cur.session !== session) return { map: null, ans: { mine: false, item, holder: cur } };
  if (b.release === true) { delete m[item]; return { map: m, ans: { mine: false, item, released: !!cur } }; }
  m[item] = { session, at: nowIso, note: String(b.note || '').replace(/\s+/g, ' ').trim().slice(0, 120) };
  const keys = Object.keys(m).sort((a, c) => Date.parse(m[c].at) - Date.parse(m[a].at));
  keys.slice(CLAIM_MAX).forEach((k) => { delete m[k]; });
  return { map: m, ans: { mine: true, item, claim: m[item] } };
}
// mail_filing / validity_run (11/10/2026): run counts of the mail-filing and validity Routines, for the weekly mail.
export const STATE_WRITE = ['quote_track', 'nevo_versions', 'od_raw_token', 'od_raw_exp', 'mail_filing', 'validity_run'];
// Run reports whose "at" the server stamps (11/10/2026): a Routine wrote a guessed time 11 minutes off,
// and the next run reads mail from that time. mail_filing: the last entry of the list; validity_run: the object.
export const STAMP_AT = ['mail_filing', 'validity_run'];
export function stampAt(v, nowIso) {
  if (Array.isArray(v)) {
    const last = v[v.length - 1];
    if (last && typeof last === 'object' && !Array.isArray(last)) last.at = nowIso;
  } else if (v && typeof v === 'object') v.at = nowIso;
  return v;
}
// Tables a Routine reads only some columns of; select= is required and must stay inside.
export const COLUMNS = {
  med: ['id', 'e'],
  hearing_tests: ['id', 'e'],
  trustee_reports: ['id', 'loc', 'location_id', 's', 'ok', 'ts', 'closed_d', 'num'],
  // talk_field reads this week's draft: no trainer signature, no links, no translations.
  toolbox_talks: ['id', 'd', 's', 'kind', 'dept', 'created_by', 'title', 'body'],
};

// talk_field (15/10/2026). Pure: the new body, or { error }. row = the talk as it is now; today = YYYY-MM-DD (Israel).
export const TALK_DRAFT = '\u05d8\u05d9\u05d5\u05d8\u05d4';
export const TALK_FIELD_HEAD = '\u05de\u05d4 \u05e7\u05e8\u05d4 \u05d0\u05e6\u05dc\u05e0\u05d5 \u05d4\u05e9\u05d1\u05d5\u05e2:';
export const TALK_FIELD_MAX = 1200;
// Not on a keyboard (CLAUDE.md, text for people; the same list as build-pdf.js KEYBOARD_ONLY).
export const NOT_KEYBOARD = /[\u2014\u2013\u2012\u05be\u2010\u2212\u00ab\u00bb\u201c\u201d\u2018\u2019\u05f3\u05f4\u2026\u00b7\u2190-\u21ff]/;
// Seven digits or more, spaces or dashes between them allowed: an ID number or a phone, never in a talk.
export const ID_LIKE = /\d(?:[\s-]?\d){6,}/;
const TALK_HEADING = /^##\s+(.+?)\s*$/;
export function talkFieldApply(row, b, today) {
  if (!row) return { error: 'talk not found' };
  const m = /^w(\d{4})(\d{2})(\d{2})$/.exec(String(row.id || ''));
  if (!m || row.created_by !== 'routine' || (row.kind !== null && row.kind !== undefined && row.kind !== 'weekly') || row.dept) return { error: 'not the weekly draft' };
  if (row.s !== TALK_DRAFT) return { error: 'not a draft' };
  const day = m[1] + '-' + m[2] + '-' + m[3], age = (Date.parse(today + 'T00:00:00Z') - Date.parse(day + 'T00:00:00Z')) / 864e5;
  if (String(row.d || '').slice(0, 10) !== day || !(age >= 0 && age <= 6)) return { error: 'not this week' };
  const dept = String(b.dept || '').trim();
  let text = String(b.text === undefined || b.text === null ? '' : b.text).replace(/\r/g, '').split('\n').map((l) => l.trim()).filter(Boolean).join('\n');
  if (text.length < 20) return { error: 'text too short' };
  if (text.length > TALK_FIELD_MAX) return { error: 'text over ' + TALK_FIELD_MAX };
  if (NOT_KEYBOARD.test(text)) return { error: 'not keyboard characters' };
  if (ID_LIKE.test(text)) return { error: 'ID-like digits' };
  if (/^#/m.test(text) || text.indexOf(TALK_FIELD_HEAD) >= 0) return { error: 'no headings in text' };
  const lines = String(row.body || '').replace(/\r/g, '').split('\n');
  const at = lines.findIndex((l) => { const h = TALK_HEADING.exec(l); return h && h[1] === dept; });
  if (!dept || at < 0) return { error: 'no such department section' };
  let end = lines.length;
  for (let i = at + 1; i < lines.length; i++) if (TALK_HEADING.test(lines[i])) { end = i; break; }
  let sec = lines.slice(at + 1, end);
  const h = sec.findIndex((l) => l.trim() === TALK_FIELD_HEAD);
  if (h >= 0) { let e = h + 1; while (e < sec.length && sec[e].trim() !== '') e++; sec.splice(h, e - h); }
  while (sec.length && sec[sec.length - 1].trim() === '') sec.pop();
  sec = sec.concat(['', TALK_FIELD_HEAD], text.split('\n'));
  const after = lines.slice(end);
  const body = lines.slice(0, at + 1).concat(sec, after.length ? [''] : [], after).join('\n');
  return { body, replaced: h >= 0 };
}
// expiry_set: the tables, the note column of each, and the one extra field it may set.
export const EXPIRY_TABLES = {
  docs: { note: 'nt', extra: 's' },
  equip_inspections: { note: 'notes', extra: 'd' },
};
// equipment: the one state a run may set (18/10/2026, Michael: "בצע: לעשות את הצעות 1 עד 5"): taking a row
// out of tracking after HIS decision ("לא רלוונטי" with e null), the way Drager 8000/7000 went by hand.
export const EQUIP_OUT = '\u05dc\u05d0 \u05e8\u05dc\u05d5\u05d5\u05e0\u05d8\u05d9';
export const DOC_STATES = ['\u05d1\u05ea\u05d5\u05e7\u05e3', '\u05e4\u05d2 \u05ea\u05d5\u05e7\u05e3', '\u05d8\u05e2\u05d5\u05df \u05d0\u05d9\u05de\u05d5\u05ea'];
export const FILE_URL_PREFIX = SITE.odFileUrl;
const isDay = (x) => /^\d{4}-\d{2}-\d{2}$/.test(String(x || '')) && !isNaN(Date.parse(x + 'T00:00:00Z')) && new Date(x + 'T00:00:00Z').toISOString().slice(0, 10) === x;
const ddmm = (x) => x ? x.slice(8, 10) + '/' + x.slice(5, 7) + '/' + x.slice(0, 4) : '-';
const short = (x, n) => String(x === undefined || x === null ? '' : x).replace(/\s+/g, ' ').trim().slice(0, n);

// The PATCH for one row, or { error }. row = the row as it is now; today = YYYY-MM-DD.
export function expiryPatch(b, row, today) {
  const t = EXPIRY_TABLES[b.table];
  if (!t) return { error: 'table not allowed' };
  if (!/^[a-z0-9-]{2,40}$/.test(String(b.agent || ''))) return { error: 'bad agent name' };
  const why = short(b.why, 300), doc = short(b.doc, 300);
  if (why.length < 5) return { error: 'why required' };
  const patch = {}, said = [];
  const outOfTracking = b.table === 'equip_inspections' && b.s !== undefined;
  if (outOfTracking) {
    // only this state, only together with e null and a document (his decision), so a run cannot hide a row by itself
    if (b.s !== EQUIP_OUT || b.e !== null) return { error: 'bad s' };
    if (!doc) return { error: 'doc required for s' };
    const old = row.e ? String(row.e).slice(0, 10) : '';
    patch.e = null; patch.s = EQUIP_OUT;
    said.push('\u05ea\u05d5\u05e7\u05e3 ' + ddmm(old) + ' -> \u05d4\u05d5\u05e6\u05d0 \u05de\u05d4\u05de\u05e2\u05e7\u05d1 (' + EQUIP_OUT + ')');
  } else if (b.e === null) {
    return { error: 'bad e' };
  }
  if (b.e !== undefined && !outOfTracking) {
    if (!isDay(b.e) || b.e < '2000-01-01' || b.e > String(Number(today.slice(0, 4)) + 6) + today.slice(4)) return { error: 'bad e' };
    const old = row.e ? String(row.e).slice(0, 10) : '';
    // later than now = the run read a document that says so; earlier is always allowed (careful)
    if ((!old || b.e > old) && !doc) return { error: 'doc required for a later e' };
    if (b.e !== old) { patch.e = b.e; said.push('\u05ea\u05d5\u05e7\u05e3 ' + ddmm(old) + ' -> ' + ddmm(b.e)); }
  }
  if (b.file_url !== undefined) {
    const u = String(b.file_url || '');
    // spaces allowed: the stored links are the plain OneDrive path (13/10/2026, a Hebrew path encoded ran past 600)
    if (u.indexOf(FILE_URL_PREFIX) !== 0 || u.length > 600 || /[\t\r\n\f\v"<>]/.test(u)) return { error: 'bad file_url' };
    if (u !== row.file_url) { patch.file_url = u; said.push('\u05e7\u05d9\u05e9\u05d5\u05e8 \u05dc\u05e7\u05d5\u05d1\u05e5'); }
  }
  if (b[t.extra] !== undefined) {
    const v = b[t.extra];
    if (t.extra === 's' && DOC_STATES.indexOf(v) < 0) return { error: 'bad s' };
    if (t.extra === 'd' && (!isDay(v) || v > today)) return { error: 'bad d' };
    if (v !== row[t.extra]) { patch[t.extra] = v; said.push(t.extra + ' ' + (t.extra === 'd' ? ddmm(v) : v)); }
  }
  for (const k of Object.keys(b)) {
    if (['op', 'table', 'id', 'agent', 'why', 'doc', 'e', 'file_url', t.extra].concat(outOfTracking ? ['s'] : []).indexOf(k) < 0) return { error: 'field not allowed: ' + k };
  }
  if (!said.length) return { patch: null };
  const line = ddmm(today) + ' Claude (' + b.agent + '): ' + said.join(', ') + '. ' + why + (doc ? '. \u05de\u05e1\u05de\u05da: ' + doc : '');
  const prev = String(row[t.note] || '').trim();
  patch[t.note] = prev ? prev + ' | ' + line : line;
  return { patch };
}

// od_move: the safety folder, the folder the flow saves into, and what may go where.
export const OD_ROOT = '\u05e9\u05d5\u05dc\u05d7\u05df \u05d4\u05e2\u05d1\u05d5\u05d3\u05d4/\u05e0\u05d9\u05d4\u05d5\u05dc \u05d1\u05d8\u05d9\u05d7\u05d5\u05ea/';
export const OD_INBOX = '_\u05e0\u05db\u05e0\u05e1 \u05de\u05d4\u05de\u05d9\u05d9\u05dc';
// Files that are not filed (invoices, quotes, unclear) go here, so the inbox holds only what is new
// (11/10/2026, Michael: "בצע: כל מה שמגיע, חוץ מרעש"). The only folder inside the inbox a file may go to.
export const OD_SKIP = '\u05dc\u05d0 \u05dc\u05ea\u05d9\u05d5\u05e7';
// The folder the second flow watches for requests (inside the safety folder).
export const OD_REQ = '_\u05d1\u05e7\u05e9\u05d5\u05ea \u05de\u05d4\u05de\u05d9\u05d9\u05dc';
// A Graph / Outlook message id: base64url-ish, as outlook_email_search returns it.
// 20/10/2026 (Michael: "maybe through other tools", after the 365 connector turned out read only):
// a draft in Michael's Outlook through Power Automate, like mail_request. The server writes one
// request file; the flow "\u05d8\u05d9\u05d5\u05d8\u05d5\u05ea \u05de\u05d4\u05e2\u05d5\u05d6\u05e8" (power-automate-mail.md, flow 3) saves it as a draft.
// Never sent: the flow has no send step, and Michael sends from Outlook.
export const OD_DRAFT = '_\u05d8\u05d9\u05d5\u05d8\u05d5\u05ea \u05dc\u05de\u05d9\u05d9\u05dc';
export const DRAFT_TO = /^[A-Za-z0-9._%+-]{1,64}@[A-Za-z0-9.-]{1,190}\.[A-Za-z]{2,24}$/;
export function draftRequest(b) {
  // Up to 3 recipients, "a@x; b@y" (20/10/2026: one mail to the two people in charge of the ammonia
  // equipment); the flow's To field takes them separated by ";".
  const list = String(b.to || '').split(/[;,]/).map((x) => x.trim()).filter(Boolean);
  if (!list.length || list.length > 3 || !list.every((x) => DRAFT_TO.test(x))) return { error: 'bad to' };
  const to = list.join(';'), subject = String(b.subject || '').replace(/\s+/g, ' ').trim(), text = String(b.body || '').replace(/\r\n/g, '\n').trim();
  if (!subject || subject.length > 200) return { error: 'subject 1-200 characters' };
  if (!text || text.length > 5000) return { error: 'body 1-5000 characters' };
  // 20/10/2026 (Michael: "instead of my name, attach the signature I have in the mail"): a draft made
  // through Graph gets no Outlook signature, so the server adds his (SITE.signature, the one under the
  // hazard reports). A typed sign-off at the end (his name and what follows, and a "regards" line
  // before it, which the signature opens with) is dropped so it does not appear twice.
  const lines = text.split('\n');
  let cut = -1;
  for (let i = Math.max(0, lines.length - 4); i < lines.length; i++) if (lines[i].trim().indexOf(SITE.owner) === 0) { cut = i; break; }
  if (cut >= 0) { if (cut > 0 && /^\u05d1\u05d1\u05e8\u05db\u05d4,?$/.test(lines[cut - 1].trim())) cut--; lines.length = cut; }
  // 20/10/2026 (Michael: "approve removing the thanks"): a closing "thanks," or "regards," as the last line
  // goes too, since the signature opens with "regards,".
  while (lines.length && !lines[lines.length - 1].trim()) lines.pop();
  while (lines.length && /^(\u05ea\u05d5\u05d3\u05d4|\u05d1\u05d1\u05e8\u05db\u05d4)[,.!]?$/.test(lines[lines.length - 1].trim())) lines.pop();
  while (lines.length && !lines[lines.length - 1].trim()) lines.pop();
  const kept = lines.join('\n').replace(/\s+$/, '');
  const html = kept.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').split('\n').join('<br>');
  return { file: JSON.stringify({ to, subject, body: kept, html: '<div dir="rtl">' + html + SITE.signature + '</div>' }) };
}
export const MAIL_REQ_ID = /^[A-Za-z0-9_=+\/-]{40,400}$/;
const OD_NO_DIR = /(^|\/)(_\u05d2\u05e8\u05e1\u05d0\u05d5\u05ea \u05e7\u05d5\u05d3\u05de\u05d5\u05ea|\u05dc\u05de\u05d7\u05d9\u05e7\u05d4|ARCHIVE)(\/|$)/i;
// 18/10/2026 (Michael: "גם וגם"): csv too, the data file next to a lab certificate pdf.
const OD_EXT = /\.(pdf|docx?|xlsx|csv|jpe?g|png)$/i;
// Into "not filed" any file the flow saved may go (11/10/2026: a 4 MB .mp4 ad stayed in the inbox;
// 12/10/2026: an attachment named "RAW", saved with no extension, was refused and stuck there),
// under the same name; into a document folder only OD_EXT.
// The same name may carry the reason in parentheses before the extension, "x (invoice).pdf"
// (13/10/2026, Michael: "on the file name, in parentheses, why it was not filed").
export function skipNameOk(from, name) {
  if (name === from) return true;
  const i = from.lastIndexOf('.');
  const ext = i > 0 ? from.slice(i) : '', base = i > 0 ? from.slice(0, i) : from;
  if (!name.startsWith(base + ' (') || !name.endsWith(')' + ext)) return false;
  const why = name.slice(base.length + 2, name.length - ext.length - 1);
  return why.trim().length >= 2 && why.length <= 60 && !/[()]/.test(why);
}
const OD_BAD = /[<>:"|?*\\\u0000-\u001f]/;
// { from, toDir, name } as Graph paths under the drive root, or { error }.
export function odMoveCheck(b) {
  if (!/^[a-z0-9-]{2,40}$/.test(String(b.agent || ''))) return { error: 'bad agent name' };
  if (String(b.why || '').trim().length < 5) return { error: 'why required' };
  const clean = (x) => String(x === undefined || x === null ? '' : x).split('/').filter(Boolean);
  const bad = (parts) => parts.some((x) => x === '.' || x === '..' || OD_BAD.test(x) || x.length > 180);
  const from = clean(b.from), dir = clean(b.to_dir), name = String(b.name || '');
  const skipTo = dir.length === 2 && dir[0] === OD_INBOX && dir[1] === OD_SKIP;
  // A file already in "not filed" may only get its reason added, in place (13/10/2026, Michael:
  // "גם הקבצים הקיימים עדכן"). Not recorded in skip_moved: the 30 days count from the first move.
  if (from.length === 2 && from[0] === OD_SKIP) {
    // A reason already in the name may be replaced (13/10/2026: "סריקה בלי טקסט" read as "empty").
    const had = /^(.*) \(([^()]{2,60})\)(\.[^.\/]*)?$/.exec(from[1]);
    const orig = had ? had[1] + (had[3] || '') : from[1];
    if (!skipTo || bad(from) || name === from[1] || name.indexOf('/') >= 0 || OD_BAD.test(name) || name.length > 180 || !skipNameOk(orig, name)) return { error: 'bad rename in not filed' };
    return { from: OD_ROOT + OD_INBOX + '/' + OD_SKIP + '/' + from[1], toDir: OD_ROOT + dir.join('/'), name, skip: false };
  }
  if (from.length !== 1 || bad(from) || !(skipTo || OD_EXT.test(from[0]))) return { error: 'from: one file inside the inbox folder' };
  const skip = dir.length === 2 && dir[0] === OD_INBOX && dir[1] === OD_SKIP;
  if (!dir.length || bad(dir) || OD_NO_DIR.test(dir.join('/')) || (dir[0] === OD_INBOX && !skip)) return { error: 'bad to_dir' };
  if (!name || name.indexOf('/') >= 0 || OD_BAD.test(name) || name.length > 180 || !(skipTo ? skipNameOk(from[0], name) : OD_EXT.test(name))) return { error: 'bad name' };
  return { from: OD_ROOT + OD_INBOX + '/' + from[0], toDir: OD_ROOT + dir.join('/'), name, skip: skipTo };
}
// od_mkdir: { parent, name } as Graph paths under the drive root, or { error }.
// The parent must be a path of 1 to 5 clean folder names that already exists (checked by the handler);
// the new name is one clean folder name.
export const OD_MKDIR_DEPTH = 5;
export function odMkdirCheck(b) {
  if (!/^[a-z0-9-]{2,40}$/.test(String(b.agent || ''))) return { error: 'bad agent name' };
  if (String(b.why || '').trim().length < 5) return { error: 'why required' };
  const parent = String(b.parent === undefined || b.parent === null ? '' : b.parent).split('/').filter(Boolean);
  const name = String(b.name === undefined || b.name === null ? '' : b.name);
  const bad = (x) => x === '.' || x === '..' || OD_BAD.test(x) || x.length > 120 || x !== x.trim() || x.startsWith('.');
  if (!parent.length || parent.length > OD_MKDIR_DEPTH || parent.some(bad)) return { error: 'bad parent' };
  if (OD_NO_DIR.test(parent.join('/')) || parent[0] === OD_INBOX || parent[0] === OD_REQ) return { error: 'bad parent' };
  if (!name || name.indexOf('/') >= 0 || bad(name) || OD_NO_DIR.test(name) || name === OD_INBOX || name === OD_REQ) return { error: 'bad name' };
  return { parent: OD_ROOT + parent.join('/'), name };
}
// 12/10/2026 (retro, Michael: "בצע"): OneDrive keeps createdDateTime on a move, so a file that waited a
// month in the inbox and was then moved to "לא לתיוק" was deleted the next night. Every move there is
// recorded here {itemId: ISO time}; backup-od counts the 30 days from the later of the two. Entries
// older than SKIP_MOVED_DAYS (the file is gone by then) and beyond SKIP_MOVED_MAX are dropped. Pure.
export const SKIP_MOVED_KEY = 'skip_moved', SKIP_MOVED_DAYS = 90, SKIP_MOVED_MAX = 500;
export function skipMovedAdd(raw, id, atIso, nowMs) {
  let m = {}; try { m = JSON.parse(raw || '{}'); } catch (e) { m = {}; }
  if (!m || typeof m !== 'object' || Array.isArray(m)) m = {};
  m[id] = atIso;
  const keep = Object.keys(m).filter((k) => !isNaN(Date.parse(m[k])) && nowMs - Date.parse(m[k]) <= SKIP_MOVED_DAYS * 864e5)
    .sort((a, b) => Date.parse(m[b]) - Date.parse(m[a])).slice(0, SKIP_MOVED_MAX);
  const out = {}; keep.forEach((k) => { out[k] = m[k]; });
  return JSON.stringify(out);
}

const SB_DEFAULT = SB_LIVE;

async function digest(s) {
  const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(s)));
  return Array.from(new Uint8Array(b)).map((x) => x.toString(16).padStart(2, '0')).join('');
}

// Same length compare of the hashes, so the time does not tell how much matched.
export async function keyOk(given, want) {
  if (!want || !given) return false;
  const a = await digest(given), b = await digest(want);
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

// The query string for one table, or null when it asks for more than that table.
export function cleanQuery(q, table) {
  const p = new URLSearchParams(String(q || '').replace(/^\?/, ''));
  for (const [k, v] of p) {
    if (k === 'select' && /[()]/.test(v)) return null;
    if (/[^a-zA-Z0-9_.]/.test(k)) return null;
  }
  const only = COLUMNS[table];
  if (only) {
    const sel = p.getAll('select');
    if (sel.length !== 1) return null;
    const cols = sel[0].split(',').map((c) => c.trim().split('::')[0]);
    if (!cols.length || cols.some((c) => only.indexOf(c) < 0)) return null;
    // a filter or an order on a column outside the list would still leak it
    for (const [k, v] of p) {
      if (k === 'select' || k === 'limit' || k === 'offset') continue;
      if (k === 'order') { if (v.split(',').some((o) => only.indexOf(o.split('.')[0]) < 0)) return null; continue; }
      if (k === 'or' || k === 'and' || only.indexOf(k) < 0) return null;
    }
  }
  return p.toString();
}

export async function liveInfo(request, env) {
  const out = { ok: false, commit: env.CF_PAGES_COMMIT_SHA || null, branch: env.CF_PAGES_BRANCH || null };
  try {
    if (!env.ASSETS) { out.error = 'no ASSETS binding'; return out; }
    const r = await env.ASSETS.fetch(new Request(new URL('/index.html', request.url).toString()));
    if (!r.ok) { out.error = 'index ' + r.status; return out; }
    const buf = await r.arrayBuffer();
    out.bytes = buf.byteLength;
    out.index_sha256 = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', buf))).map((b) => b.toString(16).padStart(2, '0')).join('');
    // /app.js (10/10/2026): the main script is cut out of this index and the page is
    // rewritten to load it. The cloud cannot open the site (country gate), so the night run
    // proves both here, in the real runtime: the cut's length, and that the swap happened.
    // The two tail scripts (?p=t1, ?p=t2, 16/10/2026) are reported too: a swap of main alone
    // would leave the NCR agent or the photos block missing, and app_swap is true only when all
    // three were swapped.
    const html = new TextDecoder().decode(buf), build = buildOf(env);
    out.app_parts = {};
    for (const part of Object.keys(PARTS)) {
      const js = extractApp(html, PARTS[part]);
      out.app_parts[part] = { bytes: js === null ? null : js.length, swap: false };
    }
    out.app_js_bytes = out.app_parts.main.bytes;
    try {
      const page = await rewriteApp(new Response(html, { headers: { 'Content-Type': 'text/html' } }), build).text();
      for (const part of Object.keys(PARTS)) out.app_parts[part].swap = out.app_parts[part].bytes !== null && page.indexOf('src="' + appSrc(build, part) + '"') >= 0;
    } catch (e) { /* every swap stays false */ }
    out.app_swap = Object.keys(PARTS).every((p) => out.app_parts[p].swap);
    out.ok = true;
  } catch (e) { out.error = String(e && e.message || e).slice(0, 200); }
  return out;
}

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method !== 'POST') return jsonResp({ error: 'method not allowed' }, 405, {});
  if (!(await keyOk(request.headers.get('x-routine-key') || '', env.ROUTINE_KEY))) return jsonResp({ error: 'forbidden' }, 403, {});
  let peek = null;
  try { peek = await request.clone().json(); } catch (e) { peek = null; }
  if (peek && peek.op === 'live') return jsonResp(await liveInfo(request, env), 200, {});
  if (!env.SUPABASE_SERVICE_ROLE_KEY) return jsonResp({ ok: false, error: 'server not configured' }, 200, {});
  let body = {};
  try { body = await request.json(); } catch (e) { return jsonResp({ ok: false, error: 'bad json' }, 400, {}); }
  const url = env.SUPABASE_URL || SB_DEFAULT, k = env.SUPABASE_SERVICE_ROLE_KEY;
  const h = { apikey: k, Authorization: 'Bearer ' + k, 'Content-Type': 'application/json' };
  const stateRead = async (keys) => {
    const r = await fetch(url + '/rest/v1/server_state?select=key,value,updated_at&key=in.(' + keys.map(encodeURIComponent).join(',') + ')', { headers: h, signal: tmo(SB_MS) });
    if (!r.ok) throw new Error('read ' + r.status);
    return r.json();
  };
  try {
    if (body.op === 'select') {
      if (TABLES.indexOf(body.table) < 0) return jsonResp({ ok: false, error: 'table not allowed' }, 400, {});
      const q = cleanQuery(body.query, body.table);
      if (q === null) return jsonResp({ ok: false, error: 'query not allowed' }, 400, {});
      const r = await fetch(url + '/rest/v1/' + body.table + (q ? '?' + q : ''), { headers: h, signal: tmo(SB_MS) });
      if (!r.ok) return jsonResp({ ok: false, error: 'select ' + r.status, detail: (await r.text()).slice(0, 300) }, 200, {});
      return jsonResp({ ok: true, rows: await r.json() }, 200, {});
    }
    if (body.op === 'state_get') {
      const keys = (Array.isArray(body.keys) ? body.keys : [body.key]).filter((x) => STATE_READ.indexOf(x) >= 0);
      if (!keys.length) return jsonResp({ ok: false, error: 'key not allowed' }, 400, {});
      return jsonResp({ ok: true, rows: await stateRead(keys) }, 200, {});
    }
    if (body.op === 'state_set') {
      if (STATE_WRITE.indexOf(body.key) < 0) return jsonResp({ ok: false, error: 'key not allowed' }, 400, {});
      if (STAMP_AT.indexOf(body.key) >= 0 && body.value && typeof body.value === 'object') stampAt(body.value, new Date().toISOString());
      const value = body.value === null || body.value === undefined ? null : (typeof body.value === 'string' ? body.value : JSON.stringify(body.value));
      const r = await fetch(url + '/rest/v1/server_state?on_conflict=key', {
        method: 'POST',
        headers: { ...h, Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify([{ key: body.key, value, updated_at: new Date().toISOString() }]), signal: tmo(SB_MS),
      });
      if (!r.ok) return jsonResp({ ok: false, error: 'write ' + r.status }, 200, {});
      const rows = await stateRead([body.key]);
      const got = Array.isArray(rows) && rows[0] ? rows[0].value : null;
      return jsonResp({ ok: got === value, value: got }, 200, {});
    }
    if (body.op === 'agent_report') {
      const e = agentEntry(body, new Date().toISOString());
      if (!e) return jsonResp({ ok: false, error: 'bad agent name' }, 400, {});
      const rows = await stateRead(['agent_log']);
      let log = [];
      try { log = JSON.parse(rows && rows[0] && rows[0].value || '[]'); } catch (x) { log = []; }
      if (!Array.isArray(log)) log = [];
      log.push(e);
      log = log.slice(-AGENT_LOG_MAX);
      const r = await fetch(url + '/rest/v1/server_state?on_conflict=key', {
        method: 'POST',
        headers: { ...h, Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify([{ key: 'agent_log', value: JSON.stringify(log), updated_at: e.at }]), signal: tmo(SB_MS),
      });
      if (!r.ok) return jsonResp({ ok: false, error: 'write ' + r.status }, 200, {});
      return jsonResp({ ok: true, entry: e, kept: log.length }, 200, {});
    }
    if (body.op === 'claim' || body.op === 'claims') {
      const now = new Date().toISOString();
      const rows = await stateRead([CLAIM_KEY]);
      let map = {};
      try { map = JSON.parse(rows && rows[0] && rows[0].value || '{}'); } catch (x) { map = {}; }
      if (body.op === 'claims') return jsonResp({ ok: true, claims: claimsFresh(map, Date.parse(now)) }, 200, {});
      const res = claimApply(map, body, now);
      if (res.error) return jsonResp({ ok: false, error: res.error }, 400, {});
      if (res.map) {
        const r = await fetch(url + '/rest/v1/server_state?on_conflict=key', {
          method: 'POST',
          headers: { ...h, Prefer: 'resolution=merge-duplicates,return=minimal' },
          body: JSON.stringify([{ key: CLAIM_KEY, value: JSON.stringify(res.map), updated_at: now }]), signal: tmo(SB_MS),
        });
        if (!r.ok) return jsonResp({ ok: false, error: 'write ' + r.status }, 200, {});
      }
      return jsonResp({ ok: true, ...res.ans }, 200, {});
    }
    if (body.op === 'hazard_choice') {
      const t = HAZARD_NOTE_TABLE[body.src];
      if (!t) return jsonResp({ ok: false, error: 'src must be trustee_hazard or near_miss' }, 400, {});
      for (const k of Object.keys(body)) if (['op', 'src', 'id', 'choice'].indexOf(k) < 0) return jsonResp({ ok: false, error: 'field not allowed: ' + k }, 400, {});
      const id = String(body.id === undefined || body.id === null ? '' : body.id);
      if (!/^[A-Za-z0-9_.-]{1,80}$/.test(id)) return jsonResp({ ok: false, error: 'bad id' }, 400, {});
      const g = await fetch(url + '/rest/v1/' + t[0] + '?select=id,' + t[1] + '&id=eq.' + encodeURIComponent(id), { headers: h, signal: tmo(SB_MS) });
      if (!g.ok) return jsonResp({ ok: false, error: 'read ' + g.status }, 200, {});
      const rows = await g.json();
      if (!Array.isArray(rows) || rows.length !== 1) return jsonResp({ ok: false, error: 'row not found' }, 200, {});
      const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jerusalem' });
      const c = hazardChoiceNote(rows[0][t[1]], body.choice, today);
      if (c.error) return jsonResp({ ok: false, error: c.error }, 400, {});
      if (!c.changed) return jsonResp({ ok: true, changed: false, note: c.note }, 200, {});
      const w = await fetch(url + '/rest/v1/' + t[0] + '?id=eq.' + encodeURIComponent(id), {
        method: 'PATCH', headers: { ...h, Prefer: 'return=representation' }, body: JSON.stringify({ [t[1]]: c.note }), signal: tmo(SB_MS),
      });
      if (!w.ok) return jsonResp({ ok: false, error: 'write ' + w.status }, 200, {});
      const after = await w.json();
      if (!Array.isArray(after) || after.length !== 1) return jsonResp({ ok: false, error: 'write touched ' + (Array.isArray(after) ? after.length : '?') + ' rows' }, 200, {});
      return jsonResp({ ok: true, changed: true, note: c.note }, 200, {});
    }
    if (body.op === 'expiry_set') {
      const t = EXPIRY_TABLES[body.table];
      if (!t) return jsonResp({ ok: false, error: 'table not allowed' }, 400, {});
      const id = String(body.id === undefined || body.id === null ? '' : body.id);
      if (!/^[A-Za-z0-9_.-]{1,80}$/.test(id)) return jsonResp({ ok: false, error: 'bad id' }, 400, {});
      const cols = ['id', 'e', 'file_url', t.note, t.extra].join(',');
      const g = await fetch(url + '/rest/v1/' + body.table + '?select=' + cols + '&id=eq.' + encodeURIComponent(id), { headers: h, signal: tmo(SB_MS) });
      if (!g.ok) return jsonResp({ ok: false, error: 'read ' + g.status }, 200, {});
      const rows = await g.json();
      if (!Array.isArray(rows) || rows.length !== 1) return jsonResp({ ok: false, error: 'row not found' }, 200, {});
      const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jerusalem' });
      const p = expiryPatch(body, rows[0], today);
      if (p.error) return jsonResp({ ok: false, error: p.error }, 400, {});
      if (!p.patch) return jsonResp({ ok: true, changed: false, row: rows[0] }, 200, {});
      const w = await fetch(url + '/rest/v1/' + body.table + '?id=eq.' + encodeURIComponent(id), {
        method: 'PATCH', headers: { ...h, Prefer: 'return=representation' }, body: JSON.stringify(p.patch), signal: tmo(SB_MS),
      });
      if (!w.ok) return jsonResp({ ok: false, error: 'write ' + w.status, detail: (await w.text()).slice(0, 300) }, 200, {});
      const after = await w.json();
      if (!Array.isArray(after) || after.length !== 1) return jsonResp({ ok: false, error: 'write touched ' + (Array.isArray(after) ? after.length : '?') + ' rows' }, 200, {});
      return jsonResp({ ok: true, changed: true, before: rows[0], after: after[0] }, 200, {});
    }
    if (body.op === 'talk_field') {
      const id = String(body.id === undefined || body.id === null ? '' : body.id);
      if (!/^w\d{8}$/.test(id)) return jsonResp({ ok: false, error: 'bad id' }, 400, {});
      for (const k of Object.keys(body)) if (['op', 'id', 'dept', 'text'].indexOf(k) < 0) return jsonResp({ ok: false, error: 'field not allowed: ' + k }, 400, {});
      const g = await fetch(url + '/rest/v1/toolbox_talks?select=id,d,s,kind,dept,created_by,body&id=eq.' + encodeURIComponent(id), { headers: h, signal: tmo(SB_MS) });
      if (!g.ok) return jsonResp({ ok: false, error: 'read ' + g.status }, 200, {});
      const rows = await g.json();
      const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jerusalem' });
      const p = talkFieldApply(Array.isArray(rows) && rows.length === 1 ? rows[0] : null, body, today);
      if (p.error) return jsonResp({ ok: false, error: p.error }, 400, {});
      // Signed = the text is evidence (ISO 45001 7.4); it is not changed under the signatures.
      const sr = await fetch(url + '/rest/v1/toolbox_reads?select=id&limit=1&talk_id=eq.' + encodeURIComponent(id), { headers: h, signal: tmo(SB_MS) });
      if (!sr.ok) return jsonResp({ ok: false, error: 'reads ' + sr.status }, 200, {});
      const signed = await sr.json();
      if (!Array.isArray(signed) || signed.length) return jsonResp({ ok: false, error: 'already signed' }, 400, {});
      if (p.body === rows[0].body) return jsonResp({ ok: true, changed: false }, 200, {});
      // s=eq.draft in the write too: published between the read and the write = nothing written.
      const w = await fetch(url + '/rest/v1/toolbox_talks?id=eq.' + encodeURIComponent(id) + '&s=eq.' + encodeURIComponent(TALK_DRAFT), {
        method: 'PATCH', headers: { ...h, Prefer: 'return=representation' }, body: JSON.stringify({ body: p.body }), signal: tmo(SB_MS),
      });
      if (!w.ok) return jsonResp({ ok: false, error: 'write ' + w.status, detail: (await w.text()).slice(0, 300) }, 200, {});
      const after = await w.json();
      if (!Array.isArray(after) || after.length !== 1) return jsonResp({ ok: false, error: 'write touched ' + (Array.isArray(after) ? after.length : '?') + ' rows' }, 200, {});
      return jsonResp({ ok: true, changed: true, replaced: p.replaced, chars: p.body.length }, 200, {});
    }
    if (body.op === 'mail_request') {
      if (!/^[a-z0-9-]{2,40}$/.test(String(body.agent || ''))) return jsonResp({ ok: false, error: 'bad agent name' }, 400, {});
      if (String(body.why || '').trim().length < 5) return jsonResp({ ok: false, error: 'why required' }, 400, {});
      const id = String(body.message_id || '').trim();
      if (!MAIL_REQ_ID.test(id)) return jsonResp({ ok: false, error: 'bad message_id' }, 400, {});
      const at = await accessToken(env);
      const name = new Date().toISOString().replace(/[-:]/g, '').replace(/\..*/, '') + '-' + Math.random().toString(36).slice(2, 8) + '.txt';
      const f = await putFile(at.token, OD_ROOT + OD_REQ, name, id, 'text/plain');
      return jsonResp({ ok: true, file: OD_REQ + '/' + name, size: f.size || null }, 200, {});
    }
    if (body.op === 'mail_draft') {
      for (const k of Object.keys(body)) if (['op', 'agent', 'why', 'to', 'subject', 'body'].indexOf(k) < 0) return jsonResp({ ok: false, error: 'field not allowed: ' + k }, 400, {});
      if (!/^[a-z0-9-]{2,40}$/.test(String(body.agent || ''))) return jsonResp({ ok: false, error: 'bad agent name' }, 400, {});
      if (String(body.why || '').trim().length < 5) return jsonResp({ ok: false, error: 'why required' }, 400, {});
      const d = draftRequest(body);
      if (d.error) return jsonResp({ ok: false, error: d.error }, 400, {});
      const at = await accessToken(env);
      // 20/10/2026: a call that timed out had written its file, and the retry made a second draft. The name
      // is the day and the content's hash, so the same draft again the same day overwrites its own file,
      // which the flow ("when a file is created") does not see as new.
      const name = new Date().toISOString().slice(0, 10).replace(/-/g, '') + '-' + (await digest(d.file)).slice(0, 16) + '.txt';
      const f = await putFile(at.token, OD_ROOT + OD_DRAFT, name, d.file, 'text/plain');
      return jsonResp({ ok: true, file: OD_DRAFT + '/' + name, size: f.size || null }, 200, {});
    }
    if (body.op === 'od_mkdir') {
      for (const k of Object.keys(body)) if (['op', 'agent', 'why', 'parent', 'name'].indexOf(k) < 0) return jsonResp({ ok: false, error: 'field not allowed: ' + k }, 400, {});
      const c = odMkdirCheck(body);
      if (c.error) return jsonResp({ ok: false, error: c.error }, 400, {});
      const at = await accessToken(env);
      const gh = { Authorization: 'Bearer ' + at.token, 'Content-Type': 'application/json' };
      const G = 'https://graph.microsoft.com/v1.0/me/drive/root:/';
      const enc = (p) => p.split('/').filter(Boolean).map(encodeURIComponent).join('/');
      const par = await fetch(G + enc(c.parent) + '?select=id,folder', { headers: gh, signal: tmo(GRAPH_MS) });
      if (!par.ok) return jsonResp({ ok: false, error: 'parent ' + par.status }, 200, {});
      const pj = await par.json();
      if (!pj.folder) return jsonResp({ ok: false, error: 'parent is not a folder' }, 200, {});
      const taken = await fetch(G + enc(c.parent + '/' + c.name) + '?select=id,folder', { headers: gh, signal: tmo(GRAPH_MS) });
      if (taken.status !== 404) {
        // Already there as a folder is not an error for the caller, nothing is changed.
        if (taken.ok) { const tj = await taken.json().catch(() => ({})); return jsonResp({ ok: true, created: false, exists: !!tj.folder, path: c.parent + '/' + c.name }, 200, {}); }
        return jsonResp({ ok: false, error: 'name check ' + taken.status }, 200, {});
      }
      const mk = await fetch('https://graph.microsoft.com/v1.0/me/drive/items/' + encodeURIComponent(pj.id) + '/children', {
        method: 'POST', headers: gh, body: JSON.stringify({ name: c.name, folder: {}, '@microsoft.graph.conflictBehavior': 'fail' }), signal: tmo(GRAPH_MS),
      });
      const mj = await mk.json().catch(() => ({}));
      if (!mk.ok) return jsonResp({ ok: false, error: 'create ' + mk.status }, 200, {});
      return jsonResp({ ok: true, created: true, path: c.parent + '/' + c.name, webUrl: mj.webUrl || null }, 200, {});
    }
    if (body.op === 'od_move') {
      const c = odMoveCheck(body);
      if (c.error) return jsonResp({ ok: false, error: c.error }, 400, {});
      const at = await accessToken(env);
      const gh = { Authorization: 'Bearer ' + at.token, 'Content-Type': 'application/json' };
      const G = 'https://graph.microsoft.com/v1.0/me/drive/root:/';
      const enc = (p) => p.split('/').filter(Boolean).map(encodeURIComponent).join('/');
      const src = await fetch(G + enc(c.from) + '?select=id,name,size,file', { headers: gh, signal: tmo(GRAPH_MS) });
      if (!src.ok) return jsonResp({ ok: false, error: 'source ' + src.status }, 200, {});
      const sj = await src.json();
      if (!sj.file) return jsonResp({ ok: false, error: 'source is not a file' }, 200, {});
      const dst = await fetch(G + enc(c.toDir) + '?select=id,folder', { headers: gh, signal: tmo(GRAPH_MS) });
      if (!dst.ok) return jsonResp({ ok: false, error: 'folder ' + dst.status }, 200, {});
      const dj = await dst.json();
      if (!dj.folder) return jsonResp({ ok: false, error: 'to_dir is not a folder' }, 200, {});
      const taken = await fetch(G + enc(c.toDir + '/' + c.name) + '?select=id', { headers: gh, signal: tmo(GRAPH_MS) });
      if (taken.status !== 404) return jsonResp({ ok: false, error: taken.ok ? 'name taken' : 'name check ' + taken.status }, 200, {});
      const mv = await fetch('https://graph.microsoft.com/v1.0/me/drive/items/' + encodeURIComponent(sj.id) + '?@microsoft.graph.conflictBehavior=fail', {
        method: 'PATCH', headers: gh, body: JSON.stringify({ parentReference: { id: dj.id }, name: c.name }), signal: tmo(GRAPH_MS),
      });
      const mj = await mv.json().catch(() => ({}));
      if (!mv.ok) return jsonResp({ ok: false, error: 'move ' + mv.status }, 200, {});
      // The move is done; a failed record only means this file is counted from its creation date.
      let recorded = null;
      if (c.skip) {
        recorded = false;
        try {
          const now = new Date().toISOString();
          const rows = await stateRead([SKIP_MOVED_KEY]);
          const value = skipMovedAdd(rows && rows[0] && rows[0].value, sj.id, now, Date.parse(now));
          const w = await fetch(url + '/rest/v1/server_state?on_conflict=key', { method: 'POST', headers: { ...h, Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify([{ key: SKIP_MOVED_KEY, value, updated_at: now }]), signal: tmo(SB_MS) });
          recorded = w.ok;
        } catch (e) { recorded = false; }
      }
      return jsonResp({ ok: true, path: c.toDir + '/' + c.name, size: mj.size || sj.size || null, webUrl: mj.webUrl || null, recorded }, 200, {});
    }
    if (body.op === 'wa_me') {
      if (!env.META_PHONE_NUMBER_ID || !env.META_ACCESS_TOKEN) return jsonResp({ ok: false, error: 'whatsapp not configured' }, 200, {});
      const to = await ownerWa(env, url);
      if (!to) return jsonResp({ ok: false, error: 'no owner number in notification_prefs' }, 200, {});
      const r = await sendToOwner(env, to, body.text, { noTemplate: body.no_template === true, windowOpen: await ownerWindowOpen(env, url), choices: Array.isArray(body.choices) ? body.choices : null });
      if (r.ok) await noteLastOut(env, url, body.text, body.ref);
      try {
        await fetch(url + '/rest/v1/notifications_log', { method: 'POST', headers: { ...h, Prefer: 'return=minimal' }, signal: tmo(SB_MS),
          body: JSON.stringify([{ id: 'wa' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), user_email: 'server', ts: new Date().toISOString(),
            event_type: 'assistant', channel: r.ok ? 'whatsapp' : 'whatsapp_error',
            payload: { title: String(body.text || '').replace(/\s+/g, ' ').slice(0, 120), text: String(body.text || '').slice(0, 1500), via: r.via || null, wamid: r.wamid || null, detail: r.error || null } }]) });
      } catch (e) { /* the message went out; a missing log line is not a failure */ }
      return jsonResp(r, 200, {});
    }
    // wa_review (20/10/2026, Michael: "not only time, also wisdom, quality and expertise"): the weekly
    // quality review in the retro (retro-prompt.md 7a) reads Michael's messages to his assistant and its
    // answers, 7 days at most, and nothing else from notifications_log (no alert, no other channel).
    if (body.op === 'wa_review') {
      const days = Math.min(7, Math.max(1, Number(body.days) || 7));
      const since = new Date(Date.now() - days * 864e5).toISOString();
      const r = await fetch(url + '/rest/v1/notifications_log?select=ts,event_type,payload->>text,payload->>title,payload->>fast,payload->>via'
        + '&event_type=in.(owner_in,assistant)&channel=eq.whatsapp&ts=gte.' + encodeURIComponent(since) + '&order=ts.asc&limit=300', { headers: h, signal: tmo(SB_MS) });
      if (!r.ok) return jsonResp({ ok: false, error: 'read ' + r.status }, 200, {});
      const rows = (await r.json()).map((x) => ({ ts: x.ts, who: x.event_type === 'owner_in' ? 'michael' : 'assistant', text: x.text || x.title || '', fast: x.fast === 'true', via: x.via || null }));
      return jsonResp({ ok: true, days, rows }, 200, {});
    }
    if (body.op === 'wa_check') {
      if (!env.META_ACCESS_TOKEN) return jsonResp({ ok: false, error: 'whatsapp not configured' }, 200, {});
      const V = 'https://graph.facebook.com/v25.0/', tok = env.META_ACCESS_TOKEN, sec = env.META_APP_SECRET || '';
      const waba = env.META_WABA_ID || SITE.wabaId, hook = SITE.appUrl + '/api/wa-hook';
      const g = async (u, init) => {
        try { const r = await fetch(u, Object.assign({ signal: tmo(GRAPH_MS) }, init || {})); return { status: r.status, j: await r.json().catch(() => ({})) }; }
        catch (e) { return { status: 'network', j: {} }; }
      };
      const err = (r) => r.j && r.j.error ? String(r.j.error.message || r.j.error.code).slice(0, 160) : null;
      const bearer = { Authorization: 'Bearer ' + tok };
      const out = { ok: true, secret_set: !!sec, verify_set: !!env.WA_VERIFY_TOKEN, fire_set: !!assistantFire(env), fire_to: assistantFire(env) ? assistantFire(env).which : null, fire2_url_set: !!env.ASSISTANT2_FIRE_URL, fire2_key_set: !!env.ASSISTANT2_FIRE_TOKEN, hook };
      const dbg = await g(V + 'debug_token?input_token=' + encodeURIComponent(tok), { headers: bearer });
      const appId = dbg.j && dbg.j.data && dbg.j.data.app_id ? String(dbg.j.data.app_id) : null;
      out.app_id = appId;
      if (sec) {
        const me = await g(V + 'me?fields=id&appsecret_proof=' + (await hmacHex(sec, tok)), { headers: bearer });
        out.secret_ok = me.status === 200; out.secret_err = err(me);
      }
      const appTok = appId && sec ? encodeURIComponent(appId + '|' + sec) : '';
      const readSubs = async () => {
        const r = await g(V + appId + '/subscriptions?access_token=' + appTok);
        const w = ((r.j && r.j.data) || []).find((x) => x.object === 'whatsapp_business_account');
        return { err: err(r), sub: w ? { callback_url: w.callback_url, active: w.active, fields: (w.fields || []).map((f) => f.name || f) } : null };
      };
      const readWaba = async () => {
        const r = await g(V + encodeURIComponent(waba) + '/subscribed_apps', { headers: bearer });
        const ids = ((r.j && r.j.data) || []).map((a) => String((a.whatsapp_business_api_data || {}).id || a.id || ''));
        return { err: err(r), has: appId ? ids.indexOf(appId) >= 0 : null };
      };
      let s = appTok ? await readSubs() : { err: 'no app id or secret', sub: null };
      let w = await readWaba();
      const subOk = () => !!(s.sub && s.sub.callback_url === hook && s.sub.fields.indexOf('messages') >= 0);
      if (body.subscribe && appTok && !subOk() && env.WA_VERIFY_TOKEN) {
        const f = new URLSearchParams({ object: 'whatsapp_business_account', callback_url: hook, fields: Array.from(new Set(((s.sub && s.sub.fields) || []).filter((n) => /^[a-z_]+$/.test(String(n))).concat(['messages']))).join(','), verify_token: env.WA_VERIFY_TOKEN, access_token: appId + '|' + sec });
        const r = await g(V + appId + '/subscriptions', { method: 'POST', body: f });
        out.subscribed_now = r.status === 200; out.subscribe_err = err(r);
        s = await readSubs();
      }
      if (body.subscribe && w.has === false) {
        const r = await g(V + encodeURIComponent(waba) + '/subscribed_apps', { method: 'POST', headers: bearer });
        out.waba_subscribed_now = r.status === 200; out.waba_err = err(r);
        w = await readWaba();
      }
      out.app_sub = s.sub; out.app_sub_err = s.err; out.messages_ok = subOk(); out.waba_has_app = w.has; out.waba_apps_err = w.err;
      if (body.fire_probe && out.fire_set) {
        const af = assistantFire(env);
        const fr = await g(af.url, { method: 'POST',
          headers: { Authorization: 'Bearer ' + af.token, 'anthropic-beta': 'experimental-cc-routine-2026-04-01', 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: '[\u05d1\u05d3\u05d9\u05e7\u05ea \u05d7\u05d9\u05d1\u05d5\u05e8 \u05de\u05d4\u05e9\u05e8\u05ea, \u05dc\u05d0 \u05d4\u05d5\u05d3\u05e2\u05d4 \u05de\u05de\u05d9\u05db\u05d0\u05dc] \u05dc\u05e1\u05d9\u05d9\u05dd \u05d1\u05e9\u05d5\u05e8\u05d4 \u05d0\u05d7\u05ea, \u05d1\u05dc\u05d9 wa_me.' }) });
        out.fire_status = fr.status;
      }
      return jsonResp(out, 200, {});
    }
    if (body.op === 'wa_tpl') {
      if (!env.META_ACCESS_TOKEN) return jsonResp({ ok: false, error: 'whatsapp not configured' }, 200, {});
      const waba = env.META_WABA_ID || SITE.wabaId;
      const G = 'https://graph.facebook.com/v25.0/' + encodeURIComponent(waba) + '/message_templates';
      const auth = { Authorization: 'Bearer ' + env.META_ACCESS_TOKEN, 'Content-Type': 'application/json' };
      const got = await fetch(G + '?name=' + encodeURIComponent(ASSISTANT_TEMPLATE.name) + '&fields=name,status,category', { headers: auth, signal: tmo(GRAPH_MS) });
      const gj = await got.json().catch(() => ({}));
      const have = gj && Array.isArray(gj.data) && gj.data.find((t) => t.name === ASSISTANT_TEMPLATE.name);
      if (have) return jsonResp({ ok: true, already: true, status: have.status, category: have.category }, 200, {});
      const mk = await fetch(G, { method: 'POST', headers: auth, body: JSON.stringify(ASSISTANT_TEMPLATE), signal: tmo(GRAPH_MS) });
      const mj = await mk.json().catch(() => ({}));
      return jsonResp(mk.ok ? { ok: true, created: true, status: mj.status || 'PENDING', id: mj.id || null } : { ok: false, error: 'create ' + mk.status, detail: mj.error && mj.error.message ? String(mj.error.message).slice(0, 200) : null }, 200, {});
    }
    return jsonResp({ ok: false, error: 'unknown op' }, 400, {});
  } catch (e) {
    return jsonResp({ ok: false, error: String(e && e.message || e).slice(0, 200) }, 200, {});
  }
}
