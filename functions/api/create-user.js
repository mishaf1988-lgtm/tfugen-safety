// Cloudflare Pages Function — admin-only create user
// Mirrors /api/create-user.js (Vercel Edge Function).

import { defaultAllowedOrigins, corsHeaders, jsonResp, isAllowedCaller } from '../_shared.js';

const SUPABASE_URL = 'https://znhjtpcltrxxyfjczgvw.supabase.co';
const ADMIN_EMAIL = 'admin@tfugen.local';
const MAX_BODY_BYTES = 5000;

function genPassword() {
  // Random 13-char password (Aa + 10 random + !) — ~57^10 ≈ 3.6e17 combos.
  // The previous 9-char generator (~24M) was within brute-force reach
  // for an attacker with a leaked auth backend. Length is the cheapest
  // fix and matches NIST 2024 guidance (10+ admin-set, force change).
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
  if (!userInfo || userInfo.email !== ADMIN_EMAIL) {
    return jsonResp({ error: 'admin only' }, 403, cors);
  }

  const bodyText = await request.text();
  if (bodyText.length > MAX_BODY_BYTES) return jsonResp({ error: 'body too large' }, 413, cors);
  let body;
  try { body = JSON.parse(bodyText); } catch (e) { return jsonResp({ error: 'invalid json' }, 400, cors); }

  const username = (body.username || '').trim().toLowerCase();
  const full_name = (body.full_name || '').trim();
  const role = (body.role || 'מדווח').trim();
  const dept = body.dept ? String(body.dept).trim() : null;
  const phone = body.phone ? String(body.phone).trim() : null;
  const email = body.email ? String(body.email).trim() : null;
  const notes = body.notes ? String(body.notes).trim() : null;

  if (!username || !/^[a-z][a-z0-9_-]{2,29}$/.test(username)) {
    return jsonResp({ error: 'username must be 3-30 chars, start with letter, only a-z 0-9 _ -' }, 400, cors);
  }
  if (username === 'admin') return jsonResp({ error: 'username "admin" is reserved' }, 400, cors);
  if (!full_name) return jsonResp({ error: 'full_name is required' }, 400, cors);

  const authEmail = username + '@tfugen.local';
  const password = genPassword();

  const createAuthResp = await fetch(SUPABASE_URL + '/auth/v1/admin/users', {
    method: 'POST',
    headers: {
      apikey: serviceKey,
      Authorization: 'Bearer ' + serviceKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      email: authEmail,
      password,
      email_confirm: true,
      // must_change_password: forces the user to set their own password on
      // the first successful login. The browser checks this flag after
      // signIn and shows the m-force-pw-change modal before continuing.
      user_metadata: { username, full_name, must_change_password: true }
    })
  });

  if (!createAuthResp.ok) {
    const errText = await createAuthResp.text();
    if (createAuthResp.status === 422 || /already/i.test(errText)) {
      return jsonResp({ error: 'user already exists in Auth (username taken)' }, 409, cors);
    }
    return jsonResp({ error: 'create auth failed (' + createAuthResp.status + '): ' + errText.slice(0, 300) }, 502, cors);
  }

  const upsertResp = await fetch(SUPABASE_URL + '/rest/v1/app_users', {
    method: 'POST',
    headers: {
      apikey: serviceKey,
      Authorization: 'Bearer ' + serviceKey,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates'
    },
    body: JSON.stringify({ id: username, username, full_name, role, dept, phone, email, notes, active: true })
  });

  if (!upsertResp.ok) {
    const errText = await upsertResp.text();
    return jsonResp({
      partial: true,
      username, password,
      warning: 'auth account created but app_users row failed: ' + errText.slice(0, 300)
    }, 200, cors);
  }

  return jsonResp({ success: true, username, password }, 200, cors);
}
