// Cloudflare Pages Function — anonymous password reset *request*.
//
// User clicks "שכחתי סיסמה" on the login screen, types their username.
// We queue a pending row in password_reset_requests; the admin (sviva)
// sees the notification on the dashboard, manually approves, and the
// existing /api/reset-password flow + browser-side _credAutoDeliver
// take it from there (mail via sviva's MSAL token, WhatsApp via the
// manual button in the credentials modal).
//
// 2026-05-10: server-side autonomous delivery was removed. Both the
// Microsoft Graph paths (CLIENT_CREDENTIALS and Delegated+refresh)
// and the SendGrid pivot were abandoned because the tapugan.co.il
// tenant blocks the consent we'd need, and sviva chose not to involve
// KakadoTech. We're back to the inbox-only Phase 2 model.
//
// SECURITY:
// - Always returns success to prevent username enumeration.
// - Rate-limited: at most one request per username per 5 min.

import {
  defaultAllowedOrigins,
  corsHeaders,
  jsonResp,
  isAllowedCaller
} from '../_shared.js';

const SUPABASE_URL = 'https://znhjtpcltrxxyfjczgvw.supabase.co';
const RATE_LIMIT_SECONDS = 300;

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
    return jsonResp({ ok: true }, 200, cors);
  }
  if (username === 'admin') {
    return jsonResp({ ok: true }, 200, cors);
  }

  // 1. Look up the user — don't enqueue requests for non-existent users
  // (still return generic 200 so the requester can't tell).
  const lookupResp = await fetch(
    `${SUPABASE_URL}/rest/v1/app_users?username=eq.${encodeURIComponent(username)}&select=username,active&limit=1`,
    { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } }
  );
  if (!lookupResp.ok) {
    return jsonResp({ ok: true }, 200, cors);
  }
  const rows = await lookupResp.json();
  const user = rows && rows[0];
  if (!user || !user.active) {
    return jsonResp({ ok: true }, 200, cors);
  }

  // 2. Rate-limit: any row (pending/completed/denied) within RATE_LIMIT_SECONDS.
  const sinceIso = new Date(Date.now() - RATE_LIMIT_SECONDS * 1000).toISOString();
  const recentResp = await fetch(
    `${SUPABASE_URL}/rest/v1/password_reset_requests?username=eq.${encodeURIComponent(username)}&ts=gte.${encodeURIComponent(sinceIso)}&select=id&limit=1`,
    { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } }
  );
  if (recentResp.ok) {
    const recent = await recentResp.json();
    if (Array.isArray(recent) && recent.length) {
      return jsonResp({ ok: true }, 200, cors);
    }
  }

  // 3. Queue the request. Admin sees pending row in inbox UI, approves
  // manually, the rest of the flow runs from there.
  await fetch(`${SUPABASE_URL}/rest/v1/password_reset_requests`, {
    method: 'POST',
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal'
    },
    body: JSON.stringify({ username, status: 'pending' })
  }).catch(() => {});

  return jsonResp({ ok: true }, 200, cors);
}
