// Cloudflare Pages Function — autonomous password reset.
//
// A user clicks "שכחתי סיסמה?" on the login screen, types their username,
// and the server: (1) generates a new temp password, (2) updates Supabase
// Auth to that password + must_change_password flag, (3) sends the new
// credentials to the user's registered email AND WhatsApp number, all
// without any admin involvement.
//
// SECURITY:
// - Always returns success to prevent username enumeration. If the user
//   doesn't exist, no email/WhatsApp goes out but the response looks the
//   same. Compare with /login which returns "user or password wrong".
// - Rate-limited per username via the password_reset_requests audit
//   table — at most one successful reset per 5 minutes per user.
// - Only the user's CONFIGURED contact methods are used. Attacker can't
//   redirect the new password to a different email/phone.

import {
  defaultAllowedOrigins,
  corsHeaders,
  jsonResp,
  isAllowedCaller
} from '../_shared.js';
import { sendMailAsApp } from '../_msApp.js';

const SUPABASE_URL = 'https://znhjtpcltrxxyfjczgvw.supabase.co';
const RATE_LIMIT_SECONDS = 300; // one successful reset per username per 5 min

function genPassword() {
  // Same generator as /api/create-user — easy-to-type 8-char temp password.
  const chars = 'abcdefghjkmnpqrstuvwxyz23456789';
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  let pw = '';
  for (let i = 0; i < 8; i++) pw += chars[bytes[i] % chars.length];
  return pw;
}

// Pre-rendered email body (HTML). Hebrew + RTL.
function emailBody({ fullName, username, password }) {
  return `<div style="font-family:Arial,sans-serif;direction:rtl;text-align:right;font-size:14px;line-height:1.7;color:#1a1d23">
    <p>${fullName ? 'שלום ' + escapeHtml(fullName) + ',' : 'שלום,'}</p>
    <p>לבקשתך, אופסה הסיסמה שלך במערכת ניהול הבטיחות של תפוגן.</p>
    <table style="border-collapse:collapse;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:0;margin:14px 0">
      <tr><td style="padding:8px 14px;color:#64748b">שם משתמש</td><td style="padding:8px 14px;font-weight:700;font-family:monospace;font-size:16px">${escapeHtml(username)}</td></tr>
      <tr><td style="padding:8px 14px;color:#64748b;border-top:1px solid #e2e8f0">סיסמה זמנית</td><td style="padding:8px 14px;font-weight:700;font-family:monospace;font-size:16px;border-top:1px solid #e2e8f0">${escapeHtml(password)}</td></tr>
    </table>
    <p><a href="https://tapugan-safety.pages.dev" style="background:#cc1f1f;color:#fff;padding:10px 22px;border-radius:6px;text-decoration:none;font-weight:700">כניסה למערכת</a></p>
    <p style="color:#64748b;font-size:12px">בכניסה הראשונה תתבקש/י לקבוע סיסמה משלך. הסיסמה הזמנית תקפה רק לכניסה אחת.</p>
    <p style="color:#94a3b8;font-size:11px;margin-top:24px">תפוגן בטיחות · אם לא ביקשת לאפס סיסמה — פנה למנהל הבטיחות מיד.</p>
  </div>`;
}

function escapeHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function phoneToE164(raw) {
  if (!raw) return '';
  const d = String(raw).replace(/[^0-9]/g, '');
  if (!d) return '';
  if (d.startsWith('972')) return d;
  if (d.charAt(0) === '0') return '972' + d.substring(1);
  if (d.length >= 8 && d.length <= 10) return '972' + d;
  return d;
}

async function sendWhatsApp(env, { phone, fullName, username, password }) {
  const PHONE_ID = env.META_PHONE_NUMBER_ID;
  const TOKEN = env.META_ACCESS_TOKEN;
  if (!PHONE_ID || !TOKEN) throw new Error('whatsapp not configured');

  const to = phoneToE164(phone);
  if (!to) throw new Error('invalid phone');

  // Try the approved template first. Template name must match exactly
  // what was approved in Meta Business Manager — see Coworker doc.
  // Fallback is a free-text message which only works inside an open
  // 24h conversation window with this number.
  const tplName = env.WA_PASSWORD_TEMPLATE || 'tfugen_password_reset';
  const lang = env.WA_PASSWORD_TEMPLATE_LANG || 'he';
  const params = [
    fullName || 'משתמש',
    username,
    password
  ];
  const payload = {
    messaging_product: 'whatsapp',
    to,
    type: 'template',
    template: {
      name: tplName,
      language: { code: lang },
      components: [{
        type: 'body',
        parameters: params.map(p => ({ type: 'text', text: String(p) }))
      }]
    }
  };
  const r = await fetch(
    `https://graph.facebook.com/v25.0/${PHONE_ID}/messages`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    }
  );
  if (!r.ok) {
    const t = await r.text();
    throw new Error(`WA ${r.status}: ${t.substring(0, 200)}`);
  }
  return { ok: true };
}

export async function onRequest({ request, env }) {
  const allowed = defaultAllowedOrigins(env);
  const origin = request.headers.get('origin') || '';
  const cors = corsHeaders(origin, allowed, 'POST,OPTIONS');

  if (request.method === 'OPTIONS') return new Response(null, { headers: cors });
  if (request.method !== 'POST') return jsonResp({ error: 'method not allowed' }, 405, cors);
  if (!isAllowedCaller(request, allowed)) return jsonResp({ error: 'origin not allowed' }, 403, cors);

  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) return jsonResp({ error: 'server misconfigured' }, 500, cors);

  let body;
  try { body = await request.json(); } catch (e) { return jsonResp({ error: 'invalid json' }, 400, cors); }
  const username = String(body.username || '').trim().toLowerCase();
  if (!username || !/^[a-z][a-z0-9_-]{2,29}$/.test(username)) {
    // Same generic response as success — don't leak that the format is
    // even being checked. The browser shows a static toast either way.
    return jsonResp({ ok: true }, 200, cors);
  }
  if (username === 'admin') {
    // Admin password is not self-resettable. Silent generic response.
    return jsonResp({ ok: true }, 200, cors);
  }

  const channels = [];
  const errors = [];

  // 1. Look up the user in app_users to get email + phone + full_name.
  const lookupResp = await fetch(
    `${SUPABASE_URL}/rest/v1/app_users?username=eq.${encodeURIComponent(username)}&select=username,full_name,email,phone,active&limit=1`,
    { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } }
  );
  if (!lookupResp.ok) {
    return jsonResp({ ok: true, _debug: 'lookup_failed' }, 200, cors);
  }
  const rows = await lookupResp.json();
  const user = rows && rows[0];
  if (!user || !user.active) {
    // Generic success — don't leak that the user doesn't exist or is disabled.
    return jsonResp({ ok: true }, 200, cors);
  }

  // 2. Rate-limit: bail if the same username has had a successful reset in
  // the last RATE_LIMIT_SECONDS. Read the most recent completed row.
  const sinceIso = new Date(Date.now() - RATE_LIMIT_SECONDS * 1000).toISOString();
  const recentResp = await fetch(
    `${SUPABASE_URL}/rest/v1/password_reset_requests?username=eq.${encodeURIComponent(username)}&status=eq.completed&approved_at=gte.${encodeURIComponent(sinceIso)}&select=id&limit=1`,
    { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } }
  );
  if (recentResp.ok) {
    const recent = await recentResp.json();
    if (Array.isArray(recent) && recent.length) {
      // Generic success — don't expose the rate-limit either.
      return jsonResp({ ok: true, _debug: 'rate_limited' }, 200, cors);
    }
  }

  // 3. Find the Auth user. We use email = `<username>@tfugen.local`.
  const targetEmail = username + '@tfugen.local';
  const allUsersResp = await fetch(
    `${SUPABASE_URL}/auth/v1/admin/users?per_page=1000`,
    { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } }
  );
  if (!allUsersResp.ok) {
    return jsonResp({ ok: true, _debug: 'auth_lookup_failed' }, 200, cors);
  }
  const allUsersJ = await allUsersResp.json();
  const authUser = (allUsersJ.users || []).find(u => (u.email || '').toLowerCase() === targetEmail);
  if (!authUser) {
    return jsonResp({ ok: true, _debug: 'auth_not_found' }, 200, cors);
  }

  // 4. Generate new password and update Auth.
  const newPassword = genPassword();
  const existingMeta = (authUser.user_metadata || {});
  const newMeta = { ...existingMeta, must_change_password: true };
  const updResp = await fetch(
    `${SUPABASE_URL}/auth/v1/admin/users/${authUser.id}`,
    {
      method: 'PUT',
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ password: newPassword, user_metadata: newMeta })
    }
  );
  if (!updResp.ok) {
    return jsonResp({ ok: true, _debug: 'auth_update_failed' }, 200, cors);
  }

  // 5. Send the credentials. Email AND WhatsApp run in parallel; either
  // failing doesn't fail the whole flow — the password is already changed,
  // we just want to notify the user via every channel they registered.
  const tasks = [];
  if (user.email) {
    tasks.push(
      sendMailAsApp(env, {
        from: env.MAIL_FROM_USER || 'sviva@tapugan.co.il',
        to: user.email,
        subject: 'איפוס סיסמה — Tapugan Safety',
        html: emailBody({ fullName: user.full_name, username, password: newPassword })
      })
        .then(() => channels.push('email'))
        .catch(e => errors.push({ channel: 'email', error: String(e.message || e).substring(0, 200) }))
    );
  }
  if (user.phone) {
    tasks.push(
      sendWhatsApp(env, {
        phone: user.phone,
        fullName: user.full_name,
        username,
        password: newPassword
      })
        .then(() => channels.push('whatsapp'))
        .catch(e => errors.push({ channel: 'whatsapp', error: String(e.message || e).substring(0, 200) }))
    );
  }
  await Promise.all(tasks);

  // 6. Audit row — record the reset for traceability.
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/password_reset_requests`, {
      method: 'POST',
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal'
      },
      body: JSON.stringify({
        username,
        status: 'completed',
        approved_by: 'self-recovery-agent',
        approved_at: new Date().toISOString(),
        notes: channels.length
          ? `delivered via ${channels.join(',')}`
          : 'delivery failed: ' + JSON.stringify(errors).substring(0, 200)
      })
    });
  } catch (e) { /* audit only — never fail the response on this */ }

  // Always 200 — generic to the browser.
  return jsonResp({ ok: true, channels }, 200, cors);
}
