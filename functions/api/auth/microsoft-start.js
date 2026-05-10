// Cloudflare Pages Function — start Microsoft OAuth (admin-only).
//
// Returns the Microsoft authorize URL the admin should redirect to.
// Sets a short-lived state cookie so the callback can verify it's
// the same browser that started the flow.
//
// Auth: Supabase admin bearer (same gate as send-credentials).
// Method: POST.

import {
  defaultAllowedOrigins,
  corsHeaders,
  jsonResp,
  isAllowedCaller
} from '../../_shared.js';

const SUPABASE_URL = 'https://znhjtpcltrxxyfjczgvw.supabase.co';
const ADMIN_EMAIL = 'admin@tfugen.local';
const STATE_TTL_SECONDS = 600; // 10 min to complete the round trip

function randomState() {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
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

  // Admin gate — verify Supabase session belongs to ADMIN_EMAIL.
  const auth = request.headers.get('authorization') || '';
  const token = auth.replace(/^Bearer\s+/i, '').trim();
  if (!token) return jsonResp({ error: 'missing bearer token' }, 401, cors);
  const verifyResp = await fetch(SUPABASE_URL + '/auth/v1/user', {
    headers: { apikey: serviceKey, Authorization: 'Bearer ' + token }
  });
  if (!verifyResp.ok) return jsonResp({ error: 'invalid session token' }, 401, cors);
  const userInfo = await verifyResp.json();
  if (!userInfo || userInfo.email !== ADMIN_EMAIL) {
    return jsonResp({ error: 'admin only' }, 403, cors);
  }

  const tenant = env.AZURE_TENANT_ID;
  const clientId = env.AZURE_CLIENT_ID;
  const redirectUri = env.AZURE_REDIRECT_URI;
  if (!tenant || !clientId || !redirectUri) {
    return jsonResp({ error: 'azure not configured (AZURE_TENANT_ID / AZURE_CLIENT_ID / AZURE_REDIRECT_URI)' }, 500, cors);
  }

  const state = randomState();
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    redirect_uri: redirectUri,
    response_mode: 'query',
    scope: 'offline_access Mail.Send User.Read',
    state,
    // Force a fresh consent so we always get a refresh_token back —
    // important for the very first connection and after revocation.
    prompt: 'consent'
  });
  const authorizeUrl =
    `https://login.microsoftonline.com/${encodeURIComponent(tenant)}/oauth2/v2.0/authorize?${params}`;

  // Set a short-lived cookie the callback will verify against.
  // SameSite=Lax allows it to be sent on the redirect back from microsoftonline.com.
  const cookie =
    `ms_oauth_state=${state}; Path=/api/auth/; Max-Age=${STATE_TTL_SECONDS}; HttpOnly; Secure; SameSite=Lax`;

  return new Response(JSON.stringify({ authorize_url: authorizeUrl }), {
    status: 200,
    headers: {
      ...cors,
      'Content-Type': 'application/json',
      'Set-Cookie': cookie
    }
  });
}
