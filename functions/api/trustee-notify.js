// Cloudflare Pages Function — a hazard report → WhatsApp (+ email) to the
// safety officer, server-side, so it lands even when the app is closed.
//
// Two sources, because on the floor they are the same event: something that
// is about to hurt somebody. A trustee's ליקוי comes from trustee_reports; a
// כמעט ונפגע comes from near_miss and can be filed by anyone, which is
// exactly why it used to reach nobody until the manager next opened the app.
// Michael on 2026-09-21: "שלא יצא מצב שכמה אנשים מעלים ומגלים מאוחר".
//
// Both notify the SAME recipient, the one saved under `trustee_hazard` in
// notification_prefs, so there is one phone number and one address to fill in
// rather than two.
//
// Callers:
//   1. A Supabase database trigger (pg_net) after INSERT:
//        trustee_reports, ok=false → POST {"id":"<id>"}
//        near_miss, any row        → POST {"id":"<id>","src":"near_miss"}
//      `src` is absent on the older trigger and defaults to trustee_reports.
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

import { defaultAllowedOrigins, corsHeaders, jsonResp, requireRole } from '../_shared.js';

const SUPABASE_URL = 'https://znhjtpcltrxxyfjczgvw.supabase.co';
const META_API_VERSION = 'v25.0';
const APP_URL = 'https://tapugan-safety.pages.dev';
const PREFS_ID = 'admin@tfugen.local';
const EVENT = 'trustee_hazard';
const MAX_AGE_MS = 48 * 3600 * 1000;
// The template this system is meant to send on. Until it exists and is
// approved in Meta, the approved incident template carries the message -- and
// carries it badly: its fixed text reads «🚨 תקרית בטיחות ... נא לטפל מיידית»,
// which is a road accident, not a fire extinguisher missing a seal. Michael saw
// the first one on 2026-09-21 and said so. project-files/WHATSAPP-TEMPLATE.md
// is the text to submit; the moment it is approved this code uses it with no
// further change.
const TEMPLATE_DEDICATED = 'tfugen_safety_report';
const TEMPLATE_FALLBACK = 'tfugen_incident_alert';
// The built-in catalogue, and the fallback. Once migrations/2026-09-19_trustee_tasks.sql
// has run the manager can rename a task from the app — and the message that
// went out still carried this wording. taskName() reads the table first.
const TASKS = {
  1: 'סיור מפגעים באזור', 2: 'מקלחות חירום ושטיפות עיניים', 3: 'דרכי מילוט ויציאות חירום',
  4: 'תקינות סולמות וגישה לגובה', 5: 'עמדות כיבוי אש', 6: 'מגיני מכונות ולחצני עצירה',
  7: 'עזרה ראשונה וציוד מגן', 8: 'מעקב סגירה'
};

// The two tables, and everything that differs between them. Anything the rest
// of the file needs per-source lives here, so adding a third source later is a
// table entry rather than a hunt through the delivery code.
const SOURCES = {
  trustee_reports: {
    select: 'id,u,t,d,loc,f,ok,s,photo_url,ts,notified_at',
    // Only a ליקוי is a hazard. A clean check is the trustee doing the job.
    skipReason: (r) => (r.ok === false ? null : 'not a hazard'),
    // One shape for the delivery code: who reported, where, what.
    norm: (r) => r,
    event: 'trustee_hazard',
    emoji: '🦺',
    title: 'ליקוי חדש מנאמן בטיחות',
    subject: 'ליקוי מנאמן בטיחות',
    whoLabel: 'נאמן',
    lineLabel: 'משימה',
    // The task number reads naturally in front of its name, and only there.
    lineText: (row, line) => (row.t ? esc(row.t) + '. ' : '') + esc(line),
    kindLabel: (row, line) => 'ליקוי בסיור נאמן: ' + line,
    footer: 'נשלח אוטומטית כשנאמן שומר ליקוי. באפליקציה: מודולים > נאמני בטיחות',
  },
  near_miss: {
    select: 'id,rep,descr,area,sev,typ,d,s,photo_url,ts,notified_at',
    // Every near-miss is worth knowing about the moment it is filed. There is
    // no "clean" near-miss to filter out.
    skipReason: () => null,
    norm: (r) => ({ ...r, u: r.rep || 'לא צוין', loc: r.area || '', f: r.descr || '', t: '' }),
    event: 'near_miss',
    emoji: '⛔',
    title: 'דיווח חדש: כמעט ונפגע',
    subject: 'כמעט ונפגע',
    whoLabel: 'מדווח',
    lineLabel: 'חומרה / סוג',
    lineText: (row, line) => esc(line),
    kindLabel: (row, line) => 'כמעט ונפגע' + (row.sev ? ', חומרה ' + row.sev : ''),
    footer: 'נשלח אוטומטית כשנשמר דיווח כמעט ונפגע. באפליקציה: מודולים > כמעט ונפגע',
  },
};

// Meta rejects parameters with newlines / tabs / long runs of spaces.
function clean(s, max) { return String(s == null ? '' : s).replace(/\s+/g, ' ').trim().substring(0, max || 200); }
function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

export async function onRequest({ request, env }) {
  const allowed = defaultAllowedOrigins(env);
  const origin = request.headers.get('origin') || '';
  const cors = corsHeaders(origin, allowed, 'POST,OPTIONS');

  if (request.method === 'OPTIONS') return new Response(null, { headers: cors });
  // Read-only probe (25/09): is the shared secret configured on this deployment?
  // A boolean only, so the env can be checked from a phone browser after a deploy.
  if (request.method === 'GET' && new URL(request.url).searchParams.get('probe') === '1') {
    return jsonResp({ ok: true, secret_configured: !!env.TRUSTEE_NOTIFY_SECRET }, 200, cors);
  }
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
    // sends through Meta AND Resend. An anonymous kiosk token must not reach it,
    // and (2026-09-24 review) neither may a reporter -- sending a test to any
    // recipient is a manager action. Only admin/manager.
    const who = await requireRole(request, env, ['admin', 'manager']);
    if (!who.ok) return jsonResp({ error: who.error }, who.status, cors);
    // The test uses what the screen holds right now (the prefs row may not be saved yet).
    const prefs = {
      whatsapp: body.whatsapp !== false, whatsapp_to: clean(body.whatsapp_to, 20).replace(/[^0-9]/g, ''),
      email: body.email !== false, email_to: clean(body.email_to, 120)
    };
    if (!prefs.whatsapp_to && !prefs.email_to) return jsonResp({ error: 'no recipient: fill a WhatsApp number or an email' }, 400, cors);
    const sample = { id: 'test', u: 'בדיקה', t: 5, d: new Date().toISOString().substring(0, 10), loc: 'מחסן, מטף מזרחי', f: 'הודעת בדיקה - מטף ללא פלומבה', photo_url: null };
    const res = await deliver(env, prefs, sample, await taskName(sb, sample.t), SOURCES.trustee_reports);
    return jsonResp({ ok: true, test: true, ...res }, 200, cors);
  }

  // ---- (1) a real hazard, referenced by id ----
  if (env.TRUSTEE_NOTIFY_SECRET && request.headers.get('x-notify-secret') !== env.TRUSTEE_NOTIFY_SECRET) {
    return jsonResp({ error: 'forbidden' }, 403, cors);
  }
  const id = clean(body.id, 64);
  if (!id || /[^A-Za-z0-9_-]/.test(id)) return jsonResp({ error: 'id required' }, 400, cors);
  // The table name reaches the query string, so it is picked from the map by
  // key and never taken from the request as text.
  const srcKey = clean(body.src, 32) || 'trustee_reports';
  const src = Object.prototype.hasOwnProperty.call(SOURCES, srcKey) ? SOURCES[srcKey] : null;
  if (!src) return jsonResp({ error: 'unknown src' }, 400, cors);

  const rowResp = await sb(srcKey + '?id=eq.' + encodeURIComponent(id) + '&select=' + src.select);
  if (!rowResp.ok) return jsonResp({ error: 'db read failed', status: rowResp.status }, 502, cors);
  const rows = await rowResp.json();
  const raw = Array.isArray(rows) ? rows[0] : null;
  if (!raw) return jsonResp({ error: 'not found' }, 404, cors);
  const skip = src.skipReason(raw);
  if (skip) return jsonResp({ ok: true, skipped: skip }, 200, cors);
  if (raw.notified_at) return jsonResp({ ok: true, skipped: 'already notified' }, 200, cors);
  const age = Date.now() - Date.parse(raw.ts || 0);
  if (!(age < MAX_AGE_MS)) return jsonResp({ ok: true, skipped: 'too old' }, 200, cors);
  const row = src.norm(raw);

  const prefs = await loadPrefs(sb);
  if (!(prefs.whatsapp && prefs.whatsapp_to) && !(prefs.email && prefs.email_to)) {
    return jsonResp({ ok: true, skipped: 'no recipient configured' }, 200, cors);
  }

  // Claim the row: only the caller whose PATCH flips notified_at from null sends.
  const claim = await sb(srcKey + '?id=eq.' + encodeURIComponent(id) + '&notified_at=is.null', {
    method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify({ notified_at: new Date().toISOString() })
  });
  const claimed = claim.ok ? await claim.json() : [];
  if (!Array.isArray(claimed) || !claimed.length) return jsonResp({ ok: true, skipped: 'already notified' }, 200, cors);

  const task = await lineFor(sb, src, row);
  const res = await deliver(env, prefs, row, task, src);
  const title = clean((row.u || '') + ' — ' + task + (row.f ? ': ' + row.f : ''), 120);
  const logs = [];
  if (res.whatsapp) logs.push({ channel: res.whatsapp === 'sent' ? 'whatsapp' : 'whatsapp_error', detail: res.whatsapp });
  if (res.email) logs.push({ channel: res.email === 'sent' ? 'email' : 'email_error', detail: res.email });
  if (logs.length) {
    try {
      await sb('notifications_log', {
        method: 'POST', headers: { Prefer: 'return=minimal' },
        body: JSON.stringify(logs.map((l) => ({
          id: 'tn' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
          user_email: 'server', event_type: src.event, channel: l.channel,
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

// The task's current name. Falls back to the built-in map for the window
// before the migration runs, for a number the table does not carry, and for
// any read that fails — a notification must never be lost over its subject line.
async function taskName(sb, n) {
  const num = parseInt(n, 10);
  const fallback = TASKS[num] || ('משימה ' + n);
  if (!(num > 0)) return fallback;
  try {
    const r = await sb('trustee_tasks?n=eq.' + num + '&select=t');
    if (!r.ok) return fallback;
    const rows = await r.json();
    const t = Array.isArray(rows) && rows[0] && rows[0].t;
    return t ? String(t) : fallback;
  } catch (e) { return fallback; }
}

// The one line under the reporter's name: which check it was for a trustee,
// how bad it was for a near-miss.
async function lineFor(sb, src, row) {
  if (src.event === 'near_miss') {
    const bits = [];
    if (row.sev) bits.push('חומרה ' + clean(row.sev, 20));
    if (row.typ) bits.push(clean(row.typ, 40));
    return bits.length ? bits.join(', ') : 'כמעט ונפגע';
  }
  return taskName(sb, row.t);
}

async function deliver(env, prefs, row, task, src) {
  const res = {};
  if (prefs.whatsapp && prefs.whatsapp_to) res.whatsapp = await sendWhatsApp(env, prefs.whatsapp_to, row, task, src);
  if (prefs.email && prefs.email_to) res.email = await sendEmail(env, prefs.email_to, row, task, src);
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

async function sendWhatsApp(env, to, row, task, src) {
  if (!env.META_PHONE_NUMBER_ID || !env.META_ACCESS_TOKEN) return 'error: WhatsApp not configured (META env vars)';
  const who = clean(row.u, 40), loc = clean(row.loc || 'לא צוין', 60), finding = clean(row.f || 'ללא תיאור', 150);
  try {
    const kind = clean(src.kindLabel(row, task), 90);
    // The template we want: {{1}} reporter, {{2}} kind, {{3}} location, {{4}} finding.
    let r = await metaSend(env, to, TEMPLATE_DEDICATED, [who, kind, loc, finding]);
    const err = r.parsed && r.parsed.error;
    const missing = !r.ok && err && (err.code === 132001 || /template/i.test(String(err.message || '')));
    if (missing) {
      // The approved incident template, whose fixed labels are, in order:
      //   סוג: {{1}}   מיקום: {{2}}   חומרה: {{3}}
      // We were passing location, kind, finding -- so every line was captioned
      // as something it was not: the store room appeared under «סוג», the task
      // name under «מיקום». Read on a phone it looked like a broken system
      // reporting a road accident. This is the order the labels actually want.
      r = await metaSend(env, to, TEMPLATE_FALLBACK, [kind, loc, finding]);
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

async function sendEmail(env, to, row, task, src) {
  if (!env.RESEND_KEY) return 'error: email not configured (RESEND_KEY missing in Cloudflare env)';
  const who = esc(row.u), loc = esc(row.loc || 'לא צוין'), finding = esc(row.f || 'ללא תיאור');
  const date = esc(row.d || '');
  // A photo that cannot be opened is worse than no photo: it reads as a broken
  // system. Link it only when the signature actually came back.
  const signed = row.photo_url && /^https?:\/\//.test(row.photo_url) && env.SUPABASE_SERVICE_ROLE_KEY
    ? await signPhoto(env.SUPABASE_SERVICE_ROLE_KEY, row.photo_url)
    : null;
  const photo = signed ? '<p><a href="' + esc(signed) + '">📷 תמונת הממצא</a></p>' : '';
  const subject = src.emoji + ' ' + src.subject + ' - ' + clean(row.u, 40) + ', ' + clean(task, 40);
  const html = '<div dir="rtl" style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">'
    + '<div style="background:#cc1f1f;padding:16px;text-align:center;border-radius:8px 8px 0 0"><h1 style="color:#fff;margin:0;font-size:18px">' + src.emoji + ' ' + esc(src.title) + '</h1><p style="color:#ffcccc;margin:4px 0 0;font-size:12px">תעשיות תפוגן - ניהול הבטיחות</p></div>'
    + '<div style="background:#fff;padding:20px;border:1px solid #e5e7eb;font-size:14px;line-height:1.7">'
    + '<p><strong>' + esc(src.whoLabel) + ':</strong> ' + who + '</p><p><strong>' + esc(src.lineLabel) + ':</strong> ' + src.lineText(row, task) + '</p><p><strong>תאריך:</strong> ' + date + '</p><p><strong>מיקום:</strong> ' + loc + '</p><p><strong>הממצא:</strong> ' + finding + '</p>' + photo
    + '<p style="margin-top:16px"><a href="' + APP_URL + '" style="background:#cc1f1f;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:bold">לניתוב באפליקציה</a></p>'
    + '</div><div style="background:#f9fafb;padding:10px;text-align:center;font-size:11px;color:#9ca3af;border-radius:0 0 8px 8px">' + esc(src.footer) + '</div></div>';
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST', headers: { Authorization: 'Bearer ' + env.RESEND_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: env.RESEND_FROM || 'Tapugan Safety <onboarding@resend.dev>', to: [to], subject, html, text: subject + ' - ' + clean(row.loc, 60) + ': ' + clean(row.f, 200) + ' ' + APP_URL })
    });
    if (r.ok) return 'sent';
    const t = await r.text();
    // Resend's most common refusal, and the one that reads like a bug in us.
    // With no verified domain it delivers ONLY to the address the account was
    // opened with, and answers 403 with a wall of English JSON that lands in a
    // Hebrew log line. Michael hit it on 2026-09-21 and had to read it out of
    // net._http_response in the SQL editor to find out what to do.
    if (r.status === 403 && /only send testing emails/i.test(t)) {
      const own = (t.match(/\(([^()\s]+@[^()\s]+)\)/) || [])[1] || '';
      return 'error: Resend שולח רק אל ' + (own || 'כתובת החשבון')
        + ' כל עוד אין דומיין מאומת. או לשים את הכתובת הזו כיעד, או לאמת דומיין ב-resend.com/domains ולהגדיר RESEND_FROM ב-Cloudflare';
    }
    return 'error: Resend ' + r.status + ' ' + t.substring(0, 160);
  } catch (e) {
    return 'error: network ' + String(e && e.message || e).substring(0, 120);
  }
}
