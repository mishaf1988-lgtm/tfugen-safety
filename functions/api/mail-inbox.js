// Cloudflare Pages Function: a reply to a trustee alert closes the finding.
// (Michael, 27/09: reply "טופל" from Outlook, with a photo, and it is closed
// in the app and in the Excel log, automatically.)
//
// The alert mail (trustee-notify) carries [TS-<report id>] in its subject.
// Every 5 minutes pg_cron calls this endpoint (x-notify-secret, like
// trustee-log). It reads the inbox of the connected Outlook account (Mail.Read)
// since the last run and, for each reply that:
//   * has the tag, and a reply prefix (RE: / השב:), so the alert itself and
//     our own confirmation never count;
//   * comes from an address @tapugan.co.il (decided with Michael);
//   * says it is done (טופל, תוקן, נסגר, בוצע ...) in the reply's own text,
//     not in the quoted alert below it;
// it writes a closure report (task 8, ref = the finding) under the name of
// whoever replied, with the largest photo attached to the reply as the
// "after" photo, marks the finding closed, and answers "נסגר ✓".
// The DB trigger close_ref closes only when the closer is the same trustee,
// so the finding is marked closed here, with the service key.
// The Excel log follows on its own: the insert fires trustee_reports_log.
// Nothing is ever deleted. Each message is handled once (ids in server_state).
import { defaultAllowedOrigins, corsHeaders, jsonResp, requireRole } from '../_shared.js';
import { odConfigured, accessToken, tokenRow, hasMailRead, stateGet, stateSet, sendMail } from '../_onedrive.js';
import { imageInfo } from '../_xlsx.js';

const SB = 'https://znhjtpcltrxxyfjczgvw.supabase.co';
const APP_URL = 'https://tapugan-safety.pages.dev';
const BUCKET = 'incidents-photos';
export const DOMAIN = '@tapugan.co.il';
export const TAG_RE = /\[TS-([A-Za-z0-9_-]{4,40})\]/;
const REPLY_RE = /^\s*(re|\u05d4\u05e9\u05d1|\u05ea\u05e9\u05d5\u05d1\u05d4|\u05ea\u05d2\u05d5\u05d1\u05d4|aw|antw)\s*:/i;
export const DONE_RE = /(\u05d8\u05d5\u05e4\u05dc|\u05d8\u05d5\u05e4\u05dc\u05d4|\u05ea\u05d5\u05e7\u05df|\u05ea\u05d5\u05e7\u05e0\u05d4|\u05ea\u05d5\u05e7\u05e0\u05d5|\u05e0\u05e1\u05d2\u05e8|\u05e0\u05e1\u05d2\u05e8\u05d4|\u05e1\u05d2\u05d5\u05e8|\u05d1\u05d5\u05e6\u05e2|\u05d1\u05d5\u05e6\u05e2\u05d4|\u05d4\u05d5\u05d7\u05dc\u05e3|\u05d4\u05d5\u05d7\u05dc\u05e4\u05d4|done|fixed|closed|resolved)/i;
export const NOT_DONE_RE = /(\u05dc\u05d0|\u05e2\u05d5\u05d3 \u05dc\u05d0|\u05d8\u05e8\u05dd)\s+(\u05d8\u05d5\u05e4\u05dc|\u05ea\u05d5\u05e7\u05df|\u05e0\u05e1\u05d2\u05e8|\u05d1\u05d5\u05e6\u05e2|\u05d4\u05d5\u05d7\u05dc\u05e3)|\bnot\s+(yet\s+)?(done|fixed|closed|resolved)/i;
const TASK_CLOSE = 8;
const S_CLOSED = '\u05e0\u05e1\u05d2\u05e8';
const MAX_PER_RUN = 5;         // closures per run: ~6 subrequests each, under 50
const MAX_FETCH = 20;          // messages read per run
const MIN_PHOTO = 15 * 1024;   // smaller images are signature logos
const MAX_PHOTO = 8 * 1024 * 1024;
const DONE_KEEP = 300;

// The reply's own text: everything before the quoted original.
export function replyText(preview) {
  const t = String(preview || '').replace(/\r/g, '');
  const cut = t.search(/(^|\n)\s*(From:|\u05de\u05d0\u05ea:|Sent:|\u05e0\u05e9\u05dc\u05d7:|-----|_{5,}|On .{0,80}wrote:|\u05d1\u05ea\u05d0\u05e8\u05d9\u05da .{0,80}\u05db\u05ea\u05d1)/);
  return (cut >= 0 ? t.substring(0, cut) : t).trim();
}

// Decides what one message is. Pure, so it can be tested without Graph.
export function classify(msg) {
  const subject = String((msg && msg.subject) || '');
  const m = subject.match(TAG_RE);
  if (!m) return { skip: 'no tag' };
  if (!REPLY_RE.test(subject)) return { skip: 'not a reply' };
  const from = String((msg.from && msg.from.emailAddress && msg.from.emailAddress.address) || '').toLowerCase();
  if (!from.endsWith(DOMAIN)) return { skip: 'outside domain', from };
  const text = replyText(msg.bodyPreview);
  if (!DONE_RE.test(text)) return { skip: 'no done word', from };
  // "not fixed yet" must never close anything.
  if (NOT_DONE_RE.test(text)) return { skip: 'negated', from };
  const name = String((msg.from.emailAddress && msg.from.emailAddress.name) || '').trim() || from.split('@')[0];
  return { id: m[1], from, name, text: text.substring(0, 300) };
}

function sbH(env, extra) {
  const k = env.SUPABASE_SERVICE_ROLE_KEY;
  return { apikey: k, Authorization: 'Bearer ' + k, ...(extra || {}) };
}
function newId() {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 6);
}
function todayIL() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jerusalem' });
}
function esc(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

async function graph(token, path) {
  const r = await fetch('https://graph.microsoft.com/v1.0' + path, { headers: { Authorization: 'Bearer ' + token } });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) {
    const e = new Error('graph ' + r.status + ': ' + String((j.error && (j.error.message || j.error.code)) || '').substring(0, 120));
    e.status = r.status; throw e;
  }
  return j;
}

// The largest real photo on the message (inline photos from a phone count,
// small signature images do not). Returns {bytes, ext} or null.
async function bestPhoto(token, msgId) {
  const j = await graph(token, '/me/messages/' + encodeURIComponent(msgId) + '/attachments?$top=10');
  let best = null;
  for (const a of (j.value || [])) {
    if (!a || a['@odata.type'] !== '#microsoft.graph.fileAttachment' || !a.contentBytes) continue;
    if (!/^image\/(jpeg|jpg|png)$/i.test(a.contentType || '') && !/\.(jpe?g|png)$/i.test(a.name || '')) continue;
    if (!(a.size >= MIN_PHOTO && a.size <= MAX_PHOTO)) continue;
    if (!best || a.size > best.size) best = a;
  }
  if (!best) return null;
  const bin = atob(best.contentBytes);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const info = imageInfo(bytes);
  return info ? { bytes, ext: info.ext === 'png' ? 'png' : 'jpg', type: 'image/' + info.ext } : null;
}

async function closeOne(env, token, msg, c) {
  const r = await fetch(SB + '/rest/v1/trustee_reports?id=eq.' + encodeURIComponent(c.id) + '&select=id,u,t,ok,s,loc,location_id,f,tour', { headers: sbH(env) });
  const rows = r.ok ? await r.json() : [];
  const f = Array.isArray(rows) && rows[0];
  if (!f) return { result: 'unknown finding' };
  const t = parseInt(f.t, 10);
  if (f.ok !== false || !(t >= 1 && t <= 7)) return { result: 'not a finding' };
  if (f.s === S_CLOSED) return { result: 'already closed' };

  let photoUrl = null;
  if (msg.hasAttachments) {
    try {
      const p = await bestPhoto(token, msg.id);
      if (p) {
        const name = 'tru-mail-' + String(c.id).replace(/[^A-Za-z0-9_-]/g, '') + '-' + Date.now() + '.' + p.ext;
        const up = await fetch(SB + '/storage/v1/object/' + BUCKET + '/' + name, { method: 'POST', headers: sbH(env, { 'Content-Type': p.type, 'x-upsert': 'false' }), body: p.bytes });
        if (up.ok) photoUrl = SB + '/storage/v1/object/public/' + BUCKET + '/' + name;
      }
    } catch (e) { /* closed without a photo rather than not closed */ }
  }

  const rep = {
    id: newId(), u: c.name, t: TASK_CLOSE, d: todayIL(), ok: true, ref: f.id,
    loc: f.loc || null, location_id: f.location_id || null, tour: f.tour || null,
    f: c.text || null, photo_url: photoUrl,
    mgr_note: '\u05e0\u05e1\u05d2\u05e8 \u05d1\u05ea\u05e9\u05d5\u05d1\u05d4 \u05dc\u05de\u05d9\u05d9\u05dc: ' + c.from,
  };
  const ins = await fetch(SB + '/rest/v1/trustee_reports', { method: 'POST', headers: sbH(env, { 'Content-Type': 'application/json', Prefer: 'return=minimal' }), body: JSON.stringify(rep) });
  if (!ins.ok) return { result: 'insert failed ' + ins.status, retry: true };
  const up = await fetch(SB + '/rest/v1/trustee_reports?id=eq.' + encodeURIComponent(f.id) + '&s=neq.' + encodeURIComponent(S_CLOSED), {
    method: 'PATCH', headers: sbH(env, { 'Content-Type': 'application/json', Prefer: 'return=minimal' }), body: JSON.stringify({ s: S_CLOSED }),
  });
  if (!up.ok) return { result: 'close failed ' + up.status, closure: rep.id };

  try {
    const html = '<div dir="rtl" style="font-family:Arial,sans-serif;font-size:14px;line-height:1.7">'
      + '<p><strong>\u2705 \u05d4\u05dc\u05d9\u05e7\u05d5\u05d9 \u05e0\u05e1\u05d2\u05e8.</strong></p>'
      + '<p><strong>\u05d4\u05de\u05de\u05e6\u05d0:</strong> ' + esc(f.f || '') + '<br><strong>\u05de\u05d9\u05e7\u05d5\u05dd:</strong> ' + esc(f.loc || '') + '<br><strong>\u05e0\u05e1\u05d2\u05e8 \u05e2\u05dc \u05d9\u05d3\u05d9:</strong> ' + esc(c.name)
      + (photoUrl ? '<br>\ud83d\udcf7 \u05d4\u05ea\u05de\u05d5\u05e0\u05d4 \u05e9\u05e6\u05d9\u05e8\u05e4\u05ea \u05e0\u05e9\u05de\u05e8\u05d4 \u05db\u05ea\u05de\u05d5\u05e0\u05ea "\u05d0\u05d7\u05e8\u05d9".' : '<br>\u05dc\u05d0 \u05e6\u05d5\u05e8\u05e4\u05d4 \u05ea\u05de\u05d5\u05e0\u05d4.') + '</p>'
      + '<p style="color:#6b7280;font-size:12px">\u05e2\u05d5\u05d3\u05db\u05df \u05d1\u05d0\u05e4\u05dc\u05d9\u05e7\u05e6\u05d9\u05d4 \u05d5\u05d1\u05d9\u05d5\u05de\u05df \u05d4\u05e0\u05d0\u05de\u05e0\u05d9\u05dd \u05d1\u05d0\u05e7\u05e1\u05dc. ' + esc(APP_URL) + '</p></div>';
    // No [TS-] tag in this subject: it must never be read back as a reply.
    await sendMail(token, c.from, '\u2705 \u05e0\u05e1\u05d2\u05e8: ' + String(f.f || '').substring(0, 60), html);
  } catch (e) { /* closed; the confirmation is a courtesy */ }
  return { result: 'closed', closure: rep.id, photo: !!photoUrl };
}

export async function runInbox(env) {
  const row = await tokenRow(env);
  if (!row || !row.refresh_token) return { ok: true, skipped: 'not connected' };
  if (!hasMailRead(row)) return { ok: true, skipped: 'no Mail.Read' };
  const { token } = await accessToken(env);
  const st = await stateGet(env, ['mail_inbox_since', 'mail_inbox_done']).catch(() => ({}));
  let done = [];
  try { done = JSON.parse((st.mail_inbox_done && st.mail_inbox_done.value) || '[]') || []; } catch (e) {}
  const since = (st.mail_inbox_since && st.mail_inbox_since.value) || new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const q = '/me/mailFolders/inbox/messages?$filter=' + encodeURIComponent('receivedDateTime ge ' + since)
    + '&$orderby=receivedDateTime%20asc&$top=' + MAX_FETCH + '&$select=id,subject,from,receivedDateTime,bodyPreview,hasAttachments';
  const j = await graph(token, q);
  const out = [];
  let last = since, closed = 0, stop = false;
  for (const msg of (j.value || [])) {
    if (stop) break;
    if (done.indexOf(msg.id) >= 0) { last = msg.receivedDateTime || last; continue; }
    const c = classify(msg);
    if (c.skip) { out.push({ skip: c.skip }); done.push(msg.id); last = msg.receivedDateTime || last; continue; }
    if (closed >= MAX_PER_RUN) { stop = true; break; }
    const res = await closeOne(env, token, msg, c).catch((e) => ({ result: 'error ' + String((e && e.message) || e).substring(0, 100), retry: true }));
    out.push({ id: c.id, ...res });
    if (res.retry) { stop = true; break; } // keep this message for the next run
    done.push(msg.id); last = msg.receivedDateTime || last;
    if (res.result === 'closed') closed++;
  }
  await stateSet(env, { mail_inbox_since: last, mail_inbox_done: JSON.stringify(done.slice(-DONE_KEEP)), mail_inbox_at: new Date().toISOString() });
  return { ok: true, read: (j.value || []).length, closed, results: out };
}

export async function onRequest(context) {
  const { request, env } = context;
  const allowed = defaultAllowedOrigins(env);
  const cors = corsHeaders(request.headers.get('Origin') || '', allowed, 'POST,OPTIONS');
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (request.method !== 'POST') return jsonResp({ error: 'method not allowed' }, 405, cors);
  if (!env.SUPABASE_SERVICE_ROLE_KEY) return jsonResp({ error: 'server misconfigured' }, 500, cors);
  if (/^Bearer\s+\S/i.test(request.headers.get('authorization') || '')) {
    const who = await requireRole(request, env, ['admin', 'manager']);
    if (!who.ok) return jsonResp({ error: who.error }, who.status, cors);
  } else {
    const want = env.TRUSTEE_NOTIFY_SECRET;
    if (!want || (request.headers.get('x-notify-secret') || '') !== want) return jsonResp({ error: 'forbidden' }, 403, cors);
  }
  if (!odConfigured(env)) return jsonResp({ ok: false, error: 'server not configured' }, 200, cors);
  try {
    return jsonResp(await runInbox(env), 200, cors);
  } catch (e) {
    return jsonResp({ ok: false, error: String((e && e.message) || e).substring(0, 200) }, 200, cors);
  }
}
