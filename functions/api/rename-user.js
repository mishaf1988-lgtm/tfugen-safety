// Cloudflare Pages Function — admin-only rename user
// Mirrors /api/rename-user.js (Vercel Edge Function).

import { defaultAllowedOrigins, corsHeaders, jsonResp, isAllowedCaller } from '../_shared.js';

const SUPABASE_URL = 'https://znhjtpcltrxxyfjczgvw.supabase.co';
const ADMIN_EMAIL = 'admin@tfugen.local';
const MAX_BODY_BYTES = 2000;

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

  const oldUsername = (body.old_username || '').trim().toLowerCase();
  const newUsername = (body.new_username || '').trim().toLowerCase();

  if (!oldUsername) return jsonResp({ error: 'old_username required' }, 400, cors);
  if (!newUsername || !/^[a-z][a-z0-9_-]{2,29}$/.test(newUsername)) {
    return jsonResp({ error: 'new_username must be 3-30 chars, start with letter, only a-z 0-9 _ -' }, 400, cors);
  }
  if (newUsername === 'admin') return jsonResp({ error: 'username "admin" is reserved' }, 400, cors);
  if (oldUsername === newUsername) return jsonResp({ error: 'new_username equals old_username' }, 400, cors);
  if (oldUsername === 'admin') return jsonResp({ error: 'cannot rename the admin account' }, 400, cors);

  const oldEmail = oldUsername + '@tfugen.local';
  const newEmail = newUsername + '@tfugen.local';

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

  let allUsers;
  try { allUsers = await listAllUsers(); }
  catch (e) { return jsonResp({ error: 'failed to lookup users: ' + e.message }, 502, cors); }

  const lcOld = oldEmail.toLowerCase();
  const lcNew = newEmail.toLowerCase();
  const targetUser = allUsers.find(u => (u.email || '').toLowerCase() === lcOld);
  if (!targetUser) return jsonResp({ error: 'auth user not found for ' + oldEmail }, 404, cors);

  const collide = allUsers.find(u => (u.email || '').toLowerCase() === lcNew);
  if (collide) return jsonResp({ error: 'username "' + newUsername + '" already taken' }, 409, cors);

  const updAuthResp = await fetch(SUPABASE_URL + '/auth/v1/admin/users/' + targetUser.id, {
    method: 'PUT',
    headers: {
      apikey: serviceKey,
      Authorization: 'Bearer ' + serviceKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ email: newEmail, email_confirm: true })
  });
  if (!updAuthResp.ok) {
    const errText = await updAuthResp.text();
    return jsonResp({ error: 'auth update failed (' + updAuthResp.status + '): ' + errText.slice(0, 300) }, 502, cors);
  }

  const patchResp = await fetch(SUPABASE_URL + '/rest/v1/app_users?id=eq.' + encodeURIComponent(oldUsername), {
    method: 'PATCH',
    headers: {
      apikey: serviceKey,
      Authorization: 'Bearer ' + serviceKey,
      'Content-Type': 'application/json',
      Prefer: 'return=representation'
    },
    body: JSON.stringify({ id: newUsername, username: newUsername, ts: new Date().toISOString() })
  });

  if (!patchResp.ok) {
    const errText = await patchResp.text();
    return jsonResp({
      partial: true,
      warning: 'auth email was renamed but app_users update failed: ' + errText.slice(0, 300),
      old_username: oldUsername, new_username: newUsername
    }, 200, cors);
  }

  const updatedRows = await patchResp.json();
  if (!Array.isArray(updatedRows) || updatedRows.length === 0) {
    return jsonResp({
      partial: true,
      warning: 'auth renamed but app_users PATCH returned zero rows',
      old_username: oldUsername, new_username: newUsername
    }, 200, cors);
  }

  return jsonResp({
    success: true,
    old_username: oldUsername,
    new_username: newUsername
  }, 200, cors);
}
