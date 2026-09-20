// Cloudflare Pages Function — a trustee's hazard report → WhatsApp (+ email)
// to the safety officer, server-side, so it lands even when the app is closed.
//
// Two callers:
//   1. A Supabase database trigger (pg_net) after INSERT into trustee_reports
//      with ok=false:            POST /api/trustee-notify   {"id":"<report id>"}
//   2. The app's notification settings, "send a test":
//                                 POST /api/trustee-notify   {"test":true, ...}
//      with a Supabase session in `Authorization: Bearer` (same gate as wa-send).
//
// Trust model for (1): no shared secret is required. A caller can only make
// us look up a row by id; the row must exist, be a hazard, be recent and not
// yet notified — notified_at is claimed atomically, so each hazard notifies
// once — and the recipient comes from the manager's own settings row in
// notification_prefs, never from the request. Optional hardening: set
// TRUSTEE_NOTIFY_SECRET in the Pages env and send the same value from the DB
// trigger as the x-notify-secret header.
//
// Env: SUPABASE_SERVICE_ROLE_KEY (required), META_PHONE_NUMBER_ID +
// META_ACCESS_TOKEN (WhatsApp), RESEND_KEY (+ optional RESEND_FROM) for email.

import { defaultAllowedOrigins, corsHeaders, jsonResp, requireUser } from '../_shared.js';

const SUPABASE_URL = 'https://znhjtpcltrxxyfjczgvw.supabase.co';
const META_API_VERSION = 'v25.0';
const APP_URL = 'https://tapugan-safety.pages.dev';
const PREFS_ID = 'admin@tfugen.local';
const EVENT = 'trustee_hazard';
const MAX_AGE_MS = 48 * 3600 * 1000;
// A dedicated Meta template (he) — used as soon as it exists and is approved;
// until then the approved incident template carries the message.
const TEMPLATE_DEDICATED = 'tfugen_trustee_hazard';
const TEMPLATE_FALLBACK = 'tfugen_incident_alert';
const TASKS = {
  1: 'סיור מפגעים באזור', 2: 'מקלחות חירום ושטיפות עיניים', 3: 'דרכי מילוט ויציאות חירום',
  4: 'תקינות סולמות וגישה לגובה', 5: 'עמדות כיבוי אש', 6: 'מגיני מכונות ולחצני עצירה',
  7: 'עזרה ראשונה וציוד מגן', 8: 'מעקב סגירה'
};

// Meta rejects parameters with newlines / tabs / long runs of spaces.
function clean(s, max) { return String(s == null ? '' : s).replace(/\s+/g, ' ').trim().substring(0, max || 200); }
function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

export async function onRequest({ request, env }) {
  const allowed = defaultAllowedOrigins(env);
  const origin = request.headers.get('origin') || '';
  const cors = corsHeaders(origin, allowed, 'POST,OPTIONS');

  if (request.method === 'OPTIONS') return new Response(null, { headers: cors });
  if (request.method !== 'POST') return jsonResp({ error: 'method not allowed' }, 405, cors);

  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) return jsonResp({ error: 'server misconfigured: missing SUPABASE_SERVICE_ROLE_KEY' }, 500, cors);

  let body;
  try { body = await request.json(); }
  catch (e) { return jsonResp({ error: 'invalid json' }, 400, cors); }
  body = body && typeof body === 'object' ? body : {};

  const sb = (path, init) => fetch(SUPABASE_URL + '/rest/v1/' + path, {
    ...(init || {}),
    headers: { apikey: serviceKey, Authorization: 'Bearer ' + serviceKey, 'Content-Type': 'application/json', ...((init && init.headers) || {}) }
  });

  // ---- (2) test message from the settings screen: needs a logged-in session ----
  if (body.test === true) {
    // Same hole as wa-send: this path takes an attacker-chosen recipient and
    // sends through Meta AND Resend. An anonymous kiosk token must not reach it.
    const who = await requireUser(request, env);
    if (!who.ok) return jsonResp({ error: who.error }, who.status, cors);
    // The test uses what the screen holds right now (the prefs row may not be saved yet).
    const prefs = {
      whatsapp: body.whatsapp !== false, whatsapp_to: clean(body.whatsapp_to, 20).replace(/[^0-9]/g, ''),
      email: body.email !== false, email_to: clean(body.email_to, 120)
    };
    if (!prefs.whatsapp_to && !prefs.email_to) return jsonResp({ error: 'no recipient: fill a WhatsApp number or an email' }, 400, cors);
    const sample = { id: 'test', u: 'בדיקה', t: 5, d: new Date().toISOString().substring(0, 10), loc: 'מחסן · מטף מזרחי', f: 'הודעת בדיקה — מטף ללא פלומבה', photo_url: null };
    const res = await deliver(env, prefs, sample);
    return jsonResp({ ok: true, test: true, ...res }, 200, cors);
  }

  // ---- (1) a real hazard, referenced by id ----
  if (env.TRUSTEE_NOTIFY_SECRET && request.headers.get('x-notify-secret') !== env.TRUSTEE_NOTIFY_SECRET) {
    return jsonResp({ error: 'forbidden' }, 403, cors);
  }
  const id = clean(body.id, 64);
  if (!id || /[^A-Za-z0-9_-]/.test(id)) return jsonResp({ error: 'id required' }, 400, cors);

  const rowResp = await sb('trustee_reports?id=eq.' + encodeURIComponent(id) + '&select=id,u,t,d,loc,f,ok,s,photo_url,ts,notified_at');
  if (!rowResp.ok) return jsonResp({ error: 'db read failed', status: rowResp.status }, 502, cors);
  const rows = await rowResp.json();
  const row = Array.isArray(rows) ? rows[0] : null;
  if (!row) return jsonResp({ error: 'not found' }, 404, cors);
  if (row.ok !== false) return jsonResp({ ok: true, skipped: 'not a hazard' }, 200, cors);
  if (row.notified_at) return jsonResp({ ok: true, skipped: 'already notified' }, 200, cors);
  const age = Date.now() - Date.parse(row.ts || 0);
  if (!(age < MAX_AGE_MS)) return jsonResp({ ok: true, skipped: 'too old' }, 200, cors);

  const prefs = await loadPrefs(sb);
  if (!(prefs.whatsapp && prefs.whatsapp_to) && !(prefs.email && prefs.email_to)) {
    return jsonResp({ ok: true, skipped: 'no recipient configured' }, 200, cors);
  }

  // Claim the row: only the caller whose PATCH flips notified_at from null sends.
  const claim = await sb('trustee_reports?id=eq.' + encodeURIComponent(id) + '&notified_at=is.null', {
    method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify({ notified_at: new Date().toISOString() })
  });
  const claimed = claim.ok ? await claim.json() : [];
  if (!Array.isArray(claimed) || !claimed.length) return jsonResp({ ok: true, skipped: 'already notified' }, 200, cors);

  const res = await deliver(env, prefs, row);
  const title = clean((row.u || '') + ' — ' + (TASKS[row.t] || ('משימה ' + row.t)) + (row.f ? ': ' + row.f : ''), 120);
  const logs = [];
  if (res.whatsapp) logs.push({ channel: res.whatsapp === 'sent' ? 'whatsapp' : 'whatsapp_error', detail: res.whatsapp });
  if (res.email) logs.push({ channel: res.email === 'sent' ? 'email' : 'email_error', detail: res.email });
  if (logs.length) {
    try {
      await sb('notifications_log', {
        method: 'POST', headers: { Prefer: 'return=minimal' },
        body: JSON.stringify(logs.map((l) => ({
          id: 'tn' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
          user_email: 'server', event_type: EVENT, channel: l.channel,
          payload: { id: row.id, title, detail: l.detail }, ts: new Date().toISOString()
        })))
      });
    } catch (e) { /* the message went out; a missing log line is not worth a failure */ }
  }
  return jsonResp({ ok: true, ...res }, 200, cors);
}

// The manager's saved settings: notification_prefs[admin].prefs.trustee_hazard
async function loadPrefs(sb) {
  const out = { whatsapp: false, whatsapp_to: '', email: false, email_to: '' };
  try {
    const r = await sb('notification_prefs?id=eq.' + encodeURIComponent(PREFS_ID) + '&select=prefs');
    if (!r.ok) return out;
    const rows = await r.json();
    const p = rows && rows[0] && rows[0].prefs && rows[0].prefs[EVENT];
    if (!p) return out;
    out.whatsapp = !!p.whatsapp; out.whatsapp_to = clean(p.whatsapp_to, 20).replace(/[^0-9]/g, '');
    out.email = !!p.email; out.email_to = clean(p.email_to, 120);
  } catch (e) { /* no prefs → nothing to send */ }
  return out;
}

async function deliver(env, prefs, row) {
  const res = {};
  const task = TASKS[row.t] || ('משימה ' + row.t);
  if (prefs.whatsapp && prefs.whatsapp_to) res.whatsapp = await sendWhatsApp(env, prefs.whatsapp_to, row, task);
  if (prefs.email && prefs.email_to) res.email = await sendEmail(env, prefs.email_to, row, task);
  return res;
}

async function metaSend(env, to, template, params) {
  const resp = await fetch(`https://graph.facebook.com/${META_API_VERSION}/${env.META_PHONE_NUMBER_ID}/messages`, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + env.META_ACCESS_TOKEN, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messaging_product: 'whatsapp', to, type: 'template',
      template: { name: template, language: { code: 'he' }, components: [{ type: 'body', parameters: params.map((p) => ({ type: 'text', text: p })) }] }
    })
  });
  const text = await resp.text();
  let parsed; try { parsed = JSON.parse(text); } catch (e) { parsed = { raw: text }; }
  return { ok: resp.ok, status: resp.status, parsed };
}

async function sendWhatsApp(env, to, row, task) {
  if (!env.META_PHONE_NUMBER_ID || !env.META_ACCESS_TOKEN) return 'error: WhatsApp not configured (META env vars)';
  const who = clean(row.u, 40), loc = clean(row.loc || 'לא צוין', 60), finding = clean(row.f || 'ללא תיאור', 150);
  try {
    // Dedicated template first: {{1}} trustee · {{2}} task + location · {{3}} finding
    let r = await metaSend(env, to, TEMPLATE_DEDICATED, [who, clean(task + ' — ' + loc, 90), finding]);
    const err = r.parsed && r.parsed.error;
    const missing = !r.ok && err && (err.code === 132001 || /template/i.test(String(err.message || '')));
    if (missing) {
      // Approved incident template: {{1}} location · {{2}} severity · {{3}} description
      r = await metaSend(env, to, TEMPLATE_FALLBACK, [loc, clean('ליקוי נאמן בטיחות — ' + who + ', ' + task, 90), finding]);
    }
    if (r.ok) return 'sent';
    const e2 = r.parsed && r.parsed.error;
    return 'error: Meta ' + r.status + (e2 && e2.message ? ' ' + String(e2.message).substring(0, 160) : '');
  } catch (e) {
    return 'error: network ' + String(e && e.message || e).substring(0, 120);
  }
}

// The bucket has been private since 2026-04-21, but the email kept linking the
// /object/public/… URL the client stores — so "📷 תמונת הממצא" answered 400 for
// every manager who ever clicked it. Mint a signed link instead. It is valid
// for seven days, which is long enough to act on a hazard and short enough that
// a forwarded mail does not become a permanent key to the photo.
const PHOTO_LINK_TTL = 7 * 24 * 3600;
async function signPhoto(serviceKey, publicUrl) {
  const m = String(publicUrl || '').match(/\/storage\/v1\/object\/(?:public\/|sign\/)?([^/]+)\/([^?]+)/);
  if (!m) return null;
  try {
    const r = await fetch(SUPABASE_URL + '/storage/v1/object/sign/' + m[1] + '/' + m[2], {
      method: 'POST',
      headers: { apikey: serviceKey, Authorization: 'Bearer ' + serviceKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ expiresIn: PHOTO_LINK_TTL }),
    });
    if (!r.ok) return null;
    const d = await r.json();
    return d && d.signedURL ? SUPABASE_URL + '/storage/v1' + d.signedURL : null;
  } catch (e) { return null; }
}

async function sendEmail(env, to, row, task) {
  if (!env.RESEND_KEY) return 'error: email not configured (RESEND_KEY missing in Cloudflare env)';
  const who = esc(row.u), loc = esc(row.loc || 'לא צוין'), finding = esc(row.f || 'ללא תיאור');
  const date = esc(row.d || '');
  // A photo that cannot be opened is worse than no photo: it reads as a broken
  // system. Link it only when the signature actually came back.
  const signed = row.photo_url && /^https?:\/\//.test(row.photo_url) && env.SUPABASE_SERVICE_ROLE_KEY
    ? await signPhoto(env.SUPABASE_SERVICE_ROLE_KEY, row.photo_url)
    : null;
  const photo = signed ? '<p><a href="' + esc(signed) + '">📷 תמונת הממצא</a></p>' : '';
  const subject = '🦺 ליקוי מנאמן בטיחות — ' + clean(row.u, 40) + ' · ' + clean(task, 40);
  const html = '<div dir="rtl" style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">'
    + '<div style="background:#cc1f1f;padding:16px;text-align:center;border-radius:8px 8px 0 0"><h1 style="color:#fff;margin:0;font-size:18px">🦺 ליקוי חדש מנאמן בטיחות</h1><p style="color:#ffcccc;margin:4px 0 0;font-size:12px">תעשיות תפוגן — ניהול הבטיחות</p></div>'
    + '<div style="background:#fff;padding:20px;border:1px solid #e5e7eb;font-size:14px;line-height:1.7">'
    + '<p><strong>נאמן:</strong> ' + who + '</p><p><strong>משימה:</strong> ' + esc(row.t) + '. ' + esc(task) + '</p><p><strong>תאריך:</strong> ' + date + '</p><p><strong>מיקום:</strong> ' + loc + '</p><p><strong>הממצא:</strong> ' + finding + '</p>' + photo
    + '<p style="margin-top:16px"><a href="' + APP_URL + '" style="background:#cc1f1f;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:bold">לניתוב באפליקציה</a></p>'
    + '</div><div style="background:#f9fafb;padding:10px;text-align:center;font-size:11px;color:#9ca3af;border-radius:0 0 8px 8px">נשלח אוטומטית כשנאמן שומר ליקוי · מודולים → נאמני בטיחות</div></div>';
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST', headers: { Authorization: 'Bearer ' + env.RESEND_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: env.RESEND_FROM || 'Tapugan Safety <onboarding@resend.dev>', to: [to], subject, html, text: subject + ' — ' + clean(row.loc, 60) + ': ' + clean(row.f, 200) + ' · ' + APP_URL })
    });
    if (r.ok) return 'sent';
    const t = await r.text();
    return 'error: Resend ' + r.status + ' ' + t.substring(0, 160);
  } catch (e) {
    return 'error: network ' + String(e && e.message || e).substring(0, 120);
  }
}
