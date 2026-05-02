// Cloudflare Pages Function — admin-only delete user
// Mirrors /api/delete-user.js (Vercel Edge Function).

import { defaultAllowedOrigins, corsHeaders, jsonResp, isAllowedCaller } from '../_shared.js';

const SUPABASE_URL = 'https://znhjtpcltrxxyfjczgvw.supabase.co';
const ADMIN_EMAIL = 'admin@tfugen.local';
const MAX_BODY_BYTES = 1000;

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
  if (username === 'admin') return jsonResp({ error: 'cannot delete the admin account' }, 400, cors);

  const targetEmail = username + '@tfugen.local';

  let authStatus = 'skipped';
  try {
    const all = [];
    for (let page = 1; page <= 10; page++) {
      const r = await fetch(SUPABASE_URL + '/auth/v1/admin/users?page=' + page + '&per_page=1000', {
        headers: { apikey: serviceKey, Authorization: 'Bearer ' + serviceKey }
      });
      if (!r.ok) break;
      const j = await r.json();
      const arr = j.users || [];
      all.push(...arr);
      if (arr.length < 1000) break;
    }
    const targetUser = all.find(u => (u.email || '').toLowerCase() === targetEmail);
    if (targetUser) {
      const delResp = await fetch(SUPABASE_URL + '/auth/v1/admin/users/' + targetUser.id, {
        method: 'DELETE',
        headers: { apikey: serviceKey, Authorization: 'Bearer ' + serviceKey }
      });
      authStatus = (delResp.ok || delResp.status === 204) ? 'deleted' : ('failed: HTTP ' + delResp.status);
    } else {
      authStatus = 'not_found';
    }
  } catch (e) {
    authStatus = 'error: ' + e.message;
  }

  let appUsersStatus = 'unknown';
  try {
    const delRowResp = await fetch(SUPABASE_URL + '/rest/v1/app_users?id=eq.' + encodeURIComponent(username), {
      method: 'DELETE',
      headers: {
        apikey: serviceKey,
        Authorization: 'Bearer ' + serviceKey,
        Prefer: 'return=representation'
      }
    });
    if (delRowResp.ok) {
      const arr = await delRowResp.json().catch(() => []);
      appUsersStatus = (Array.isArray(arr) && arr.length > 0) ? 'deleted' : 'not_found';
    } else {
      appUsersStatus = 'failed: HTTP ' + delRowResp.status;
    }
  } catch (e) {
    appUsersStatus = 'error: ' + e.message;
  }

  return jsonResp({ success: true, username, auth: authStatus, app_users: appUsersStatus }, 200, cors);
}
