// Cloudflare Pages Function — admin-only password reset
// Mirrors /api/reset-password.js (Vercel Edge Function).

import { defaultAllowedOrigins, corsHeaders, jsonResp, isAllowedCaller } from '../_shared.js';

const SUPABASE_URL = 'https://znhjtpcltrxxyfjczgvw.supabase.co';
const ADMIN_EMAIL = 'admin@tfugen.local';
const MAX_BODY_BYTES = 1000;

function genPassword() {
  // 13-char password (Aa + 10 random + !) — see create-user.js for rationale.
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  const bytes = new Uint8Array(10);
  crypto.getRandomValues(bytes);
  let suffix = '';
  for (let i = 0; i < 10; i++) suffix += chars[bytes[i] % chars.length];
  return 'Aa' + suffix + '!';
}

export async function onRequest({ request, env }) {
  const allowed = defaultAllowedOrigins(env);
  const origin = request.headers.get('origin') || '';
  const cors = corsHeaders(origin, allowed, 'POST,OPTIONS');

  if (request.method === 'OPTIONS') return new Response(null, { headers: cors });
  if (request.method !== 'POST') return jsonResp({ error: 'method not allowed' }, 405, cors);
  if (!isAllowedCaller(request, allowed)) return jsonResp({ error: 'origin not allowed' }, 403, cors);

  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) return jsonResp({ error: 'server misconfigured: missing SUPABASE_SERVICE_ROLE_KEY' }, 500, cors);

  const auth = request.headers.get('authorization') || '';
  const token = auth.replace(/^Bearer\s+/i, '').trim();
  if (!token) return jsonResp({ error: 'missing bearer token' }, 401, cors);

  const verifyResp = await fetch(SUPABASE_URL + '/auth/v1/user', {
    headers: { apikey: serviceKey, Authorization: 'Bearer ' + token }
  });
  if (!verifyResp.ok) return jsonResp({ error: 'invalid session token' }, 401, cors);
  const userInfo = await verifyResp.json();
  if (!userInfo || userInfo.email !== ADMIN_EMAIL) return jsonResp({ error: 'admin only' }, 403, cors);

  const bodyText = await request.text();
  if (bodyText.length > MAX_BODY_BYTES) return jsonResp({ error: 'body too large' }, 413, cors);
  let body;
  try { body = JSON.parse(bodyText); } catch (e) { return jsonResp({ error: 'invalid json' }, 400, cors); }

  const username = (body.username || '').trim().toLowerCase();
  if (!username) return jsonResp({ error: 'username required' }, 400, cors);
  if (username === 'admin') return jsonResp({ error: 'cannot reset admin password from this endpoint' }, 400, cors);

  const targetEmail = username + '@tfugen.local';

  async function listAllUsers() {
    const all = [];
    for (let page = 1; page <= 10; page++) {
      const r = await fetch(SUPABASE_URL + '/auth/v1/admin/users?page=' + page + '&per_page=1000', {
        headers: { apikey: serviceKey, Authorization: 'Bearer ' + serviceKey }
      });
      if (!r.ok) throw new Error('lookup failed: HTTP ' + r.status);
      const j = await r.json();
      const arr = j.users || [];
      all.push(...arr);
      if (arr.length < 1000) break;
    }
    return all;
  }

  let targetUser;
  try {
    const allUsers = await listAllUsers();
    targetUser = allUsers.find(u => (u.email || '').toLowerCase() === targetEmail);
  } catch (e) {
    return jsonResp({ error: 'lookup failed: ' + e.message }, 502, cors);
  }
  if (!targetUser) return jsonResp({ error: 'auth user not found for ' + targetEmail }, 404, cors);

  const newPassword = genPassword();
  // Preserve any existing user_metadata (e.g., username, full_name) and
  // mark must_change_password=true so the browser forces a self-set
  // password modal on the next successful login.
  const existingMeta = (targetUser && targetUser.user_metadata) || {};
  const newMeta = Object.assign({}, existingMeta, { must_change_password: true });
  const updResp = await fetch(SUPABASE_URL + '/auth/v1/admin/users/' + targetUser.id, {
    method: 'PUT',
    headers: {
      apikey: serviceKey,
      Authorization: 'Bearer ' + serviceKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ password: newPassword, user_metadata: newMeta })
  });

  if (!updResp.ok) {
    const errText = await updResp.text();
    return jsonResp({ error: 'password reset failed (' + updResp.status + '): ' + errText.slice(0, 300) }, 502, cors);
  }

  return jsonResp({ success: true, username, password: newPassword }, 200, cors);
}
