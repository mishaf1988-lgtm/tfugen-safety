// Cloudflare Pages Function: "✅ סמן כטופל" from the hazard email (27/09).
//
// The alert mail (trustee-notify) carries a signed link per finding
// (functions/_closelink.js). Whoever holds the mail, Michael or whoever it was
// forwarded to, opens it on a phone:
//   GET  ?k=<token>  a short page: the finding, "who handled it", an optional
//                    note and "after" photo, and a close button. Nothing is
//                    written on GET: Outlook / Defender open every link in a
//                    mail to scan it, and a one-click close would close
//                    findings nobody touched.
//   POST (form)      writes a closure report (task 8, ref = the finding) under
//                    the typed name, marks the finding closed (service key,
//                    since the close_ref trigger only closes for the same
//                    trustee), and mails the manager a confirmation.
// Same closure shape as mail-inbox.js. The Excel log follows on its own: the
// insert fires trustee_reports_log. Nothing is deleted.
// Tour hazards too (upgrade review 13, 30/09/2026, Michael: a "mark as
// handled" link per hazard in the department report): a token whose id starts
// with "th-" names a row of tour_hazards (trustee ids never have a dash). The
// same form; the POST marks the hazard סגור with closed_d, closed_by,
// close_note and after_photo_url, and the file in folder 13 follows through
// the tour_hazards trigger. The photo is optional (Michael, same day).
// Not in MACHINE_PATHS: a person opens it, so the Israel-only rule applies.
import { odConfigured, tokenRow, hasMail, accessToken, sendMail } from '../_onedrive.js';
import { imageInfo } from '../_xlsx.js';
import { readCloseToken } from '../_closelink.js';

const SB = 'https://znhjtpcltrxxyfjczgvw.supabase.co';
const APP_URL = 'https://tapugan-safety.pages.dev';
const BUCKET = 'incidents-photos';
const PREFS_ID = 'admin@tfugen.local';
const TASK_CLOSE = 8;
const S_CLOSED = '\u05e0\u05e1\u05d2\u05e8';
const S_H_CLOSED = '\u05e1\u05d2\u05d5\u05e8';
const NOUN_T = '\u05dc\u05d9\u05e7\u05d5\u05d9', NOUN_H = '\u05de\u05e4\u05d2\u05e2';
export const isHazardId = (id) => /^th-/.test(String(id || ''));
const MAX_PHOTO = 8 * 1024 * 1024;

function esc(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function clean(s, max) { return String(s == null ? '' : s).replace(/\s+/g, ' ').trim().substring(0, max); }
function sbH(env, extra) {
  const k = env.SUPABASE_SERVICE_ROLE_KEY;
  return { apikey: k, Authorization: 'Bearer ' + k, ...(extra || {}) };
}
function newId() { return Date.now().toString(36) + Math.random().toString(36).substring(2, 6); }
function todayIL() { return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jerusalem' }); }

// The token sits in the URL: no referrer, no cache, no index, no framing.
const HEADERS = {
  'Content-Type': 'text/html; charset=utf-8',
  'Cache-Control': 'no-store',
  'Referrer-Policy': 'no-referrer',
  'X-Robots-Tag': 'noindex, nofollow',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; img-src data:; form-action 'self'; base-uri 'none'; frame-ancestors 'none'",
};

export function page(title, inner, tone, status) {
  const color = tone === 'ok' ? '#15803d' : tone === 'err' ? '#cc1f1f' : '#1e3a8a';
  const html = '<!doctype html><html lang="he" dir="rtl"><head><meta charset="UTF-8">'
    + '<meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex, nofollow">'
    + '<title>Tapugan Safety</title></head>'
    + '<body style="font-family:Arial,Heebo,sans-serif;background:#f5f7fa;margin:0;padding:16px">'
    + '<div style="background:#fff;border-radius:12px;max-width:480px;margin:0 auto;box-shadow:0 4px 20px rgba(0,0,0,.08);overflow:hidden">'
    + '<div style="background:' + color + ';color:#fff;padding:14px 18px;font-size:17px;font-weight:700">' + esc(title) + '</div>'
    + '<div style="padding:18px;font-size:15px;line-height:1.7;color:#1f2937">' + inner + '</div>'
    + '<div style="padding:10px 18px;background:#f9fafb;font-size:11px;color:#9ca3af">\u05ea\u05e2\u05e9\u05d9\u05d5\u05ea \u05ea\u05e4\u05d5\u05d2\u05df - \u05e0\u05d9\u05d4\u05d5\u05dc \u05d4\u05d1\u05d8\u05d9\u05d7\u05d5\u05ea</div>'
    + '</div></body></html>';
  return new Response(html, { status: status || 200, headers: HEADERS });
}

function details(f) {
  return '<p style="margin:0 0 12px"><strong>' + (f.noun === NOUN_H ? '\u05d4\u05de\u05e4\u05d2\u05e2' : '\u05d4\u05de\u05de\u05e6\u05d0') + ':</strong> ' + esc(f.f || '\u05dc\u05dc\u05d0 \u05ea\u05d9\u05d0\u05d5\u05e8')
    + '<br><strong>\u05de\u05d9\u05e7\u05d5\u05dd:</strong> ' + esc(f.loc || '\u05dc\u05d0 \u05e6\u05d5\u05d9\u05df')
    + '<br><strong>\u05d3\u05d5\u05d5\u05d7:</strong> ' + esc(f.d || '') + ', ' + esc(f.u || '') + '</p>';
}

const INPUT = 'width:100%;box-sizing:border-box;padding:10px;border:1px solid #d1d5db;border-radius:8px;font-size:15px;font-family:inherit';

export function formPage(tok, f, err, who, note) {
  const noun = f.noun || NOUN_T;
  return page('\u2705 \u05e1\u05d2\u05d9\u05e8\u05ea ' + noun, details(f)
    + (err ? '<p style="color:#cc1f1f;font-weight:700;margin:0 0 10px">' + esc(err) + '</p>' : '')
    + '<form method="post" action="/api/close-hazard" enctype="multipart/form-data">'
    + '<input type="hidden" name="k" value="' + esc(tok) + '">'
    + '<label style="display:block;font-weight:700;margin-bottom:4px">\u05de\u05d9 \u05d8\u05d9\u05e4\u05dc? (\u05d7\u05d5\u05d1\u05d4)</label>'
    + '<input name="who" required maxlength="60" value="' + esc(who || '') + '" style="' + INPUT + ';margin-bottom:12px">'
    + '<label style="display:block;font-weight:700;margin-bottom:4px">\u05de\u05d4 \u05e0\u05e2\u05e9\u05d4? (\u05dc\u05d0 \u05d7\u05d5\u05d1\u05d4)</label>'
    + '<textarea name="note" maxlength="300" rows="3" style="' + INPUT + ';margin-bottom:12px">' + esc(note || '') + '</textarea>'
    + '<label style="display:block;font-weight:700;margin-bottom:4px">\ud83d\udcf7 \u05ea\u05de\u05d5\u05e0\u05d4 \u05d0\u05d7\u05e8\u05d9 \u05d4\u05d8\u05d9\u05e4\u05d5\u05dc (\u05dc\u05d0 \u05d7\u05d5\u05d1\u05d4)</label>'
    + '<input type="file" name="photo" accept="image/jpeg,image/png" style="margin-bottom:16px;font-size:14px">'
    + '<button type="submit" style="width:100%;background:#15803d;color:#fff;border:0;border-radius:8px;padding:13px;font-size:16px;font-weight:700;font-family:inherit">\u2705 \u05e1\u05d2\u05d5\u05e8 ' + noun + '</button>'
    + '</form>', 'info');
}

async function loadFinding(env, id) {
  const r = await fetch(SB + '/rest/v1/trustee_reports?id=eq.' + encodeURIComponent(id) + '&select=id,u,t,d,ok,s,loc,location_id,f,tour', { headers: sbH(env) });
  if (!r.ok) throw new Error('db ' + r.status);
  const rows = await r.json();
  return Array.isArray(rows) && rows[0] ? rows[0] : null;
}

// A tour hazard, shaped for details(): description, department and place,
// the tour and its date.
async function loadHazard(env, id) {
  const r = await fetch(SB + '/rest/v1/tour_hazards?id=eq.' + encodeURIComponent(id) + '&select=id,n,d,tour_no,dept,loc,descr,s', { headers: sbH(env) });
  if (!r.ok) throw new Error('db ' + r.status);
  const rows = await r.json();
  const h = Array.isArray(rows) && rows[0] ? rows[0] : null;
  if (!h) return null;
  return { id: h.id, noun: NOUN_H, f: h.descr, loc: [h.dept, h.loc].filter(Boolean).join(' \u00b7 '), d: h.d || '',
    u: '\u05e1\u05d9\u05d5\u05e8 ' + (h.tour_no || '') + ', \u05de\u05e1"\u05d3 ' + (h.n || ''), closed: h.s === S_H_CLOSED };
}

function isFinding(f) {
  const t = parseInt(f.t, 10);
  return f.ok === false && t >= 1 && t !== TASK_CLOSE;
}

// A problem with the link itself, before any finding is looked at.
function tokenError(r) {
  if (r.error === 'expired') return page('\u05d4\u05e7\u05d9\u05e9\u05d5\u05e8 \u05e4\u05d2 \u05ea\u05d5\u05e7\u05e3', '<p>\u05d4\u05e7\u05d9\u05e9\u05d5\u05e8 \u05d1\u05ea\u05d5\u05e7\u05e3 \u05dc-30 \u05d9\u05d5\u05dd. \u05d0\u05e4\u05e9\u05e8 \u05dc\u05e1\u05d2\u05d5\u05e8 \u05d0\u05ea \u05d4\u05dc\u05d9\u05e7\u05d5\u05d9 \u05de\u05d4\u05d0\u05e4\u05dc\u05d9\u05e7\u05e6\u05d9\u05d4: \u05de\u05d5\u05d3\u05d5\u05dc\u05d9\u05dd &gt; \u05e0\u05d0\u05de\u05e0\u05d9 \u05d1\u05d8\u05d9\u05d7\u05d5\u05ea.</p><p><a href="' + APP_URL + '">\u05dc\u05d0\u05e4\u05dc\u05d9\u05e7\u05e6\u05d9\u05d4</a></p>', 'err', 410);
  return page('\u05d4\u05e7\u05d9\u05e9\u05d5\u05e8 \u05dc\u05d0 \u05ea\u05e7\u05d9\u05df', '<p>\u05d9\u05d9\u05ea\u05db\u05df \u05e9\u05d4\u05e7\u05d9\u05e9\u05d5\u05e8 \u05e0\u05d7\u05ea\u05da \u05d1\u05d4\u05e2\u05ea\u05e7\u05d4. \u05d0\u05e4\u05e9\u05e8 \u05dc\u05e4\u05ea\u05d5\u05d7 \u05e9\u05d5\u05d1 \u05de\u05d4\u05de\u05d9\u05d9\u05dc, \u05d0\u05d5 \u05dc\u05e1\u05d2\u05d5\u05e8 \u05de\u05d4\u05d0\u05e4\u05dc\u05d9\u05e7\u05e6\u05d9\u05d4.</p><p><a href="' + APP_URL + '">\u05dc\u05d0\u05e4\u05dc\u05d9\u05e7\u05e6\u05d9\u05d4</a></p>', 'err', 400);
}

function alreadyClosed(f) {
  return page((f.noun === NOUN_H ? '\u05d4\u05de\u05e4\u05d2\u05e2' : '\u05d4\u05dc\u05d9\u05e7\u05d5\u05d9') + ' \u05db\u05d1\u05e8 \u05e0\u05e1\u05d2\u05e8', details(f) + '<p>\u05d0\u05d9\u05df \u05e6\u05d5\u05e8\u05da \u05d1\u05e4\u05e2\u05d5\u05dc\u05d4 \u05e0\u05d5\u05e1\u05e4\u05ea.</p>', 'ok');
}

async function uploadPhoto(env, id, file, prefix) {
  if (!file || typeof file === 'string' || !(file.size > 0)) return { url: null };
  if (file.size > MAX_PHOTO) return { url: null, note: '\u05d4\u05ea\u05de\u05d5\u05e0\u05d4 \u05d2\u05d3\u05d5\u05dc\u05d4 \u05de-8MB \u05d5\u05dc\u05d0 \u05e0\u05e9\u05de\u05e8\u05d4.' };
  const bytes = new Uint8Array(await file.arrayBuffer());
  const info = imageInfo(bytes);
  if (!info) return { url: null, note: '\u05d4\u05ea\u05de\u05d5\u05e0\u05d4 \u05dc\u05d0 \u05d1\u05e4\u05d5\u05e8\u05de\u05d8 JPG \u05d0\u05d5 PNG \u05d5\u05dc\u05d0 \u05e0\u05e9\u05de\u05e8\u05d4.' };
  const ext = info.ext === 'png' ? 'png' : 'jpg';
  const name = (prefix || 'tru-link-') + id.replace(/[^A-Za-z0-9_-]/g, '') + '-' + Date.now() + '.' + ext;
  try {
    const up = await fetch(SB + '/storage/v1/object/' + BUCKET + '/' + name, { method: 'POST', headers: sbH(env, { 'Content-Type': 'image/' + (ext === 'png' ? 'png' : 'jpeg'), 'x-upsert': 'false' }), body: bytes });
    if (up.ok) return { url: SB + '/storage/v1/object/public/' + BUCKET + '/' + name };
  } catch (e) { /* closed without a photo rather than not closed */ }
  return { url: null, note: '\u05e9\u05de\u05d9\u05e8\u05ea \u05d4\u05ea\u05de\u05d5\u05e0\u05d4 \u05e0\u05db\u05e9\u05dc\u05d4. \u05d4\u05dc\u05d9\u05e7\u05d5\u05d9 \u05e0\u05e1\u05d2\u05e8 \u05d1\u05dc\u05d9 \u05ea\u05de\u05d5\u05e0\u05d4.' };
}

// Tell the manager who closed it. A courtesy: the finding is closed either way.
async function notifyManager(env, f, who, note, hasPhoto) {
  const hz = f.noun === NOUN_H;
  try {
    if (!odConfigured(env)) return;
    const r = await fetch(SB + '/rest/v1/notification_prefs?id=eq.' + encodeURIComponent(PREFS_ID) + '&select=prefs', { headers: sbH(env) });
    const rows = r.ok ? await r.json() : [];
    const p = rows && rows[0] && rows[0].prefs && rows[0].prefs.trustee_hazard;
    const to = p && p.email && clean(p.email_to, 120);
    if (!to) return;
    const tr = await tokenRow(env);
    if (!hasMail(tr)) return;
    const { token } = await accessToken(env);
    const html = '<div dir="rtl" style="font-family:Arial,sans-serif;font-size:14px;line-height:1.7">'
      + '<p><strong>\u2705 ' + (hz ? '\u05d4\u05de\u05e4\u05d2\u05e2' : '\u05d4\u05dc\u05d9\u05e7\u05d5\u05d9') + ' \u05e0\u05e1\u05d2\u05e8 \u05de\u05d4\u05e7\u05d9\u05e9\u05d5\u05e8 \u05d1\u05de\u05d9\u05d9\u05dc.</strong></p>'
      + '<p><strong>\u05d4\u05de\u05de\u05e6\u05d0:</strong> ' + esc(f.f || '') + '<br><strong>\u05de\u05d9\u05e7\u05d5\u05dd:</strong> ' + esc(f.loc || '')
      + '<br><strong>\u05d8\u05d9\u05e4\u05dc:</strong> ' + esc(who) + (note ? '<br><strong>\u05de\u05d4 \u05e0\u05e2\u05e9\u05d4:</strong> ' + esc(note) : '')
      + '<br>' + (hasPhoto ? '\ud83d\udcf7 \u05e6\u05d5\u05e8\u05e4\u05d4 \u05ea\u05de\u05d5\u05e0\u05ea "\u05d0\u05d7\u05e8\u05d9".' : '\u05dc\u05d0 \u05e6\u05d5\u05e8\u05e4\u05d4 \u05ea\u05de\u05d5\u05e0\u05d4.') + '</p>'
      + '<p style="color:#6b7280;font-size:12px">' + (hz ? '\u05e2\u05d5\u05d3\u05db\u05df \u05d1\u05d0\u05e4\u05dc\u05d9\u05e7\u05e6\u05d9\u05d4 \u05d5\u05d1\u05e7\u05d5\u05d1\u05e5 \u05d4\u05de\u05e4\u05d2\u05e2\u05d9\u05dd. ' : '\u05e2\u05d5\u05d3\u05db\u05df \u05d1\u05d0\u05e4\u05dc\u05d9\u05e7\u05e6\u05d9\u05d4 \u05d5\u05d1\u05d9\u05d5\u05de\u05df \u05d4\u05e0\u05d0\u05de\u05e0\u05d9\u05dd \u05d1\u05d0\u05e7\u05e1\u05dc. ') + esc(APP_URL) + '</p></div>';
    await sendMail(token, to, '\u2705 \u05e0\u05e1\u05d2\u05e8: ' + clean(f.f, 60), html);
  } catch (e) { /* ignore */ }
}

// POST for a tour hazard: the row itself carries the closure (no report row
// as for a trustee finding). Guarded by s != סגור, so a second tap or a
// closure in the app in between changes nothing.
async function closeHazardPost(env, tok, id, form) {
  let h;
  try { h = await loadHazard(env, id); } catch (e) { return page('\u05ea\u05e7\u05dc\u05d4 \u05d6\u05de\u05e0\u05d9\u05ea', '<p>\u05dc\u05d0 \u05e0\u05e1\u05d2\u05e8. \u05e0\u05e1\u05d4 \u05e9\u05d5\u05d1 \u05d1\u05e2\u05d5\u05d3 \u05d3\u05e7\u05d4.</p>', 'err', 502); }
  if (!h) return page('\u05d4\u05de\u05e4\u05d2\u05e2 \u05dc\u05d0 \u05e0\u05de\u05e6\u05d0', '<p>\u05dc\u05d0 \u05e0\u05e1\u05d2\u05e8 \u05d3\u05d1\u05e8.</p>', 'err', 404);
  if (h.closed) return alreadyClosed(h);
  const who = clean(form.get('who'), 60);
  const note = clean(form.get('note'), 300);
  if (!who) return formPage(tok, h, '\u05e6\u05e8\u05d9\u05da \u05dc\u05de\u05dc\u05d0 \u05de\u05d9 \u05d8\u05d9\u05e4\u05dc.', who, note);
  const photo = await uploadPhoto(env, id, form.get('photo'), 'thz-link-');
  const up = await fetch(SB + '/rest/v1/tour_hazards?id=eq.' + encodeURIComponent(id) + '&s=neq.' + encodeURIComponent(S_H_CLOSED), {
    method: 'PATCH', headers: sbH(env, { 'Content-Type': 'application/json', Prefer: 'return=minimal' }),
    body: JSON.stringify({ s: S_H_CLOSED, closed_d: todayIL(), closed_by: who, close_note: note || null, after_photo_url: photo.url }),
  });
  if (!up.ok) return formPage(tok, h, '\u05d4\u05e9\u05de\u05d9\u05e8\u05d4 \u05e0\u05db\u05e9\u05dc\u05d4 (' + up.status + '). \u05e0\u05e1\u05d4 \u05e9\u05d5\u05d1.', who, note);
  await notifyManager(env, h, who, note, !!photo.url);
  return page('\u2705 \u05d4\u05de\u05e4\u05d2\u05e2 \u05e0\u05e1\u05d2\u05e8', details(h)
    + '<p><strong>\u05d8\u05d9\u05e4\u05dc:</strong> ' + esc(who) + '<br>' + (photo.url ? '\ud83d\udcf7 \u05d4\u05ea\u05de\u05d5\u05e0\u05d4 \u05e0\u05e9\u05de\u05e8\u05d4.' : esc(photo.note || '\u05dc\u05d0 \u05e6\u05d5\u05e8\u05e4\u05d4 \u05ea\u05de\u05d5\u05e0\u05d4.')) + '</p>'
    + '<p>\u05e2\u05d5\u05d3\u05db\u05df \u05d1\u05d0\u05e4\u05dc\u05d9\u05e7\u05e6\u05d9\u05d4 \u05d5\u05d1\u05e7\u05d5\u05d1\u05e5 \u05d4\u05de\u05e4\u05d2\u05e2\u05d9\u05dd. \u05d0\u05e4\u05e9\u05e8 \u05dc\u05e1\u05d2\u05d5\u05e8 \u05d0\u05ea \u05d4\u05d3\u05e3.</p>', 'ok');
}

export async function onRequest({ request, env }) {
  if (!env.SUPABASE_SERVICE_ROLE_KEY) return page('\u05ea\u05e7\u05dc\u05d4 \u05d1\u05e9\u05e8\u05ea', '<p>\u05d4\u05e9\u05e8\u05ea \u05dc\u05d0 \u05de\u05d5\u05d2\u05d3\u05e8. \u05e4\u05e0\u05d4 \u05dc\u05de\u05de\u05d5\u05e0\u05d4 \u05d4\u05d1\u05d8\u05d9\u05d7\u05d5\u05ea.</p>', 'err', 500);
  const url = new URL(request.url);

  if (request.method === 'GET') {
    const tok = url.searchParams.get('k') || '';
    const t = await readCloseToken(env, tok);
    if (t.error) return tokenError(t);
    if (t.id === 'test') return page('\u05d6\u05d5 \u05d4\u05d5\u05d3\u05e2\u05ea \u05d1\u05d3\u05d9\u05e7\u05d4', '<p>\u05d4\u05db\u05e4\u05ea\u05d5\u05e8 \u05e2\u05d5\u05d1\u05d3. \u05d1\u05dc\u05d9\u05e7\u05d5\u05d9 \u05d0\u05de\u05d9\u05ea\u05d9 \u05d9\u05d9\u05e4\u05ea\u05d7 \u05db\u05d0\u05df \u05d8\u05d5\u05e4\u05e1 \u05d4\u05e1\u05d2\u05d9\u05e8\u05d4.</p>', 'ok');
    if (isHazardId(t.id)) {
      let h;
      try { h = await loadHazard(env, t.id); } catch (e) { return page('\u05ea\u05e7\u05dc\u05d4 \u05d6\u05de\u05e0\u05d9\u05ea', '<p>\u05e0\u05e1\u05d4 \u05e9\u05d5\u05d1 \u05d1\u05e2\u05d5\u05d3 \u05d3\u05e7\u05d4.</p>', 'err', 502); }
      if (!h) return page('\u05d4\u05de\u05e4\u05d2\u05e2 \u05dc\u05d0 \u05e0\u05de\u05e6\u05d0', '<p>\u05d9\u05d9\u05ea\u05db\u05df \u05e9\u05d4\u05d5\u05d0 \u05e0\u05de\u05d7\u05e7. \u05d0\u05e4\u05e9\u05e8 \u05dc\u05d1\u05d3\u05d5\u05e7 \u05d1\u05d0\u05e4\u05dc\u05d9\u05e7\u05e6\u05d9\u05d4.</p><p><a href="' + APP_URL + '">\u05dc\u05d0\u05e4\u05dc\u05d9\u05e7\u05e6\u05d9\u05d4</a></p>', 'err', 404);
      return h.closed ? alreadyClosed(h) : formPage(tok, h);
    }
    let f;
    try { f = await loadFinding(env, t.id); } catch (e) { return page('\u05ea\u05e7\u05dc\u05d4 \u05d6\u05de\u05e0\u05d9\u05ea', '<p>\u05dc\u05d0 \u05d4\u05e6\u05dc\u05d7\u05ea\u05d9 \u05dc\u05e7\u05e8\u05d5\u05d0 \u05d0\u05ea \u05d4\u05dc\u05d9\u05e7\u05d5\u05d9. \u05e0\u05e1\u05d4 \u05e9\u05d5\u05d1 \u05d1\u05e2\u05d5\u05d3 \u05d3\u05e7\u05d4.</p>', 'err', 502); }
    if (!f || !isFinding(f)) return page('\u05d4\u05dc\u05d9\u05e7\u05d5\u05d9 \u05dc\u05d0 \u05e0\u05de\u05e6\u05d0', '<p>\u05d9\u05d9\u05ea\u05db\u05df \u05e9\u05d4\u05d5\u05d0 \u05e0\u05de\u05d7\u05e7. \u05d0\u05e4\u05e9\u05e8 \u05dc\u05d1\u05d3\u05d5\u05e7 \u05d1\u05d0\u05e4\u05dc\u05d9\u05e7\u05e6\u05d9\u05d4.</p><p><a href="' + APP_URL + '">\u05dc\u05d0\u05e4\u05dc\u05d9\u05e7\u05e6\u05d9\u05d4</a></p>', 'err', 404);
    if (f.s === S_CLOSED) return alreadyClosed(f);
    return formPage(tok, f);
  }

  if (request.method !== 'POST') return page('\u05e9\u05d2\u05d9\u05d0\u05d4', '<p>\u05e4\u05e2\u05d5\u05dc\u05d4 \u05dc\u05d0 \u05e0\u05ea\u05de\u05db\u05ea.</p>', 'err', 405);

  let form;
  try { form = await request.formData(); } catch (e) { return page('\u05e9\u05d2\u05d9\u05d0\u05d4', '<p>\u05d4\u05d8\u05d5\u05e4\u05e1 \u05dc\u05d0 \u05e0\u05e7\u05e8\u05d0. \u05e0\u05e1\u05d4 \u05e9\u05d5\u05d1.</p>', 'err', 400); }
  const tok = String(form.get('k') || '');
  const t = await readCloseToken(env, tok);
  if (t.error) return tokenError(t);
  if (t.id === 'test') return page('\u05d6\u05d5 \u05d4\u05d5\u05d3\u05e2\u05ea \u05d1\u05d3\u05d9\u05e7\u05d4', '<p>\u05dc\u05d0 \u05e0\u05e1\u05d2\u05e8 \u05d3\u05d1\u05e8.</p>', 'ok');
  if (isHazardId(t.id)) return closeHazardPost(env, tok, t.id, form);
  let f;
  try { f = await loadFinding(env, t.id); } catch (e) { return page('\u05ea\u05e7\u05dc\u05d4 \u05d6\u05de\u05e0\u05d9\u05ea', '<p>\u05dc\u05d0 \u05e0\u05e1\u05d2\u05e8. \u05e0\u05e1\u05d4 \u05e9\u05d5\u05d1 \u05d1\u05e2\u05d5\u05d3 \u05d3\u05e7\u05d4.</p>', 'err', 502); }
  if (!f || !isFinding(f)) return page('\u05d4\u05dc\u05d9\u05e7\u05d5\u05d9 \u05dc\u05d0 \u05e0\u05de\u05e6\u05d0', '<p>\u05dc\u05d0 \u05e0\u05e1\u05d2\u05e8 \u05d3\u05d1\u05e8.</p>', 'err', 404);
  if (f.s === S_CLOSED) return alreadyClosed(f);

  const who = clean(form.get('who'), 60);
  const note = clean(form.get('note'), 300);
  if (!who) return formPage(tok, f, '\u05e6\u05e8\u05d9\u05da \u05dc\u05de\u05dc\u05d0 \u05de\u05d9 \u05d8\u05d9\u05e4\u05dc.', who, note);

  const photo = await uploadPhoto(env, f.id, form.get('photo'));
  const rep = {
    id: newId(), u: who, t: TASK_CLOSE, d: todayIL(), ok: true, ref: f.id,
    loc: f.loc || null, location_id: f.location_id || null, tour: f.tour || null,
    f: note || null, photo_url: photo.url,
    mgr_note: '\u05e0\u05e1\u05d2\u05e8 \u05de\u05e7\u05d9\u05e9\u05d5\u05e8 \u05d1\u05de\u05d9\u05d9\u05dc',
  };
  const ins = await fetch(SB + '/rest/v1/trustee_reports', { method: 'POST', headers: sbH(env, { 'Content-Type': 'application/json', Prefer: 'return=minimal' }), body: JSON.stringify(rep) });
  if (!ins.ok) return formPage(tok, f, '\u05d4\u05e9\u05de\u05d9\u05e8\u05d4 \u05e0\u05db\u05e9\u05dc\u05d4 (' + ins.status + '). \u05e0\u05e1\u05d4 \u05e9\u05d5\u05d1.', who, note);
  const up = await fetch(SB + '/rest/v1/trustee_reports?id=eq.' + encodeURIComponent(f.id) + '&s=neq.' + encodeURIComponent(S_CLOSED), {
    method: 'PATCH', headers: sbH(env, { 'Content-Type': 'application/json', Prefer: 'return=minimal' }), body: JSON.stringify({ s: S_CLOSED }),
  });
  if (!up.ok) return page('\u05e0\u05e9\u05de\u05e8 \u05d7\u05dc\u05e7\u05d9\u05ea', '<p>\u05d3\u05d9\u05d5\u05d5\u05d7 \u05d4\u05e1\u05d2\u05d9\u05e8\u05d4 \u05e0\u05e9\u05de\u05e8, \u05d0\u05d1\u05dc \u05e1\u05d9\u05de\u05d5\u05df \u05d4\u05dc\u05d9\u05e7\u05d5\u05d9 \u05db\u05e1\u05d2\u05d5\u05e8 \u05e0\u05db\u05e9\u05dc. \u05d0\u05e4\u05e9\u05e8 \u05dc\u05e1\u05d2\u05d5\u05e8 \u05de\u05d4\u05d0\u05e4\u05dc\u05d9\u05e7\u05e6\u05d9\u05d4.</p>', 'err', 502);

  await notifyManager(env, f, who, note, !!photo.url);
  return page('\u2705 \u05d4\u05dc\u05d9\u05e7\u05d5\u05d9 \u05e0\u05e1\u05d2\u05e8', details(f)
    + '<p><strong>\u05d8\u05d9\u05e4\u05dc:</strong> ' + esc(who) + '<br>' + (photo.url ? '\ud83d\udcf7 \u05d4\u05ea\u05de\u05d5\u05e0\u05d4 \u05e0\u05e9\u05de\u05e8\u05d4.' : esc(photo.note || '\u05dc\u05d0 \u05e6\u05d5\u05e8\u05e4\u05d4 \u05ea\u05de\u05d5\u05e0\u05d4.')) + '</p>'
    + '<p>\u05e2\u05d5\u05d3\u05db\u05df \u05d1\u05d0\u05e4\u05dc\u05d9\u05e7\u05e6\u05d9\u05d4 \u05d5\u05d1\u05d9\u05d5\u05de\u05df \u05d4\u05e0\u05d0\u05de\u05e0\u05d9\u05dd. \u05d0\u05e4\u05e9\u05e8 \u05dc\u05e1\u05d2\u05d5\u05e8 \u05d0\u05ea \u05d4\u05d3\u05e3.</p>', 'ok');
}
