// Vercel Edge Function — /api/reset-password
//
// Admin-only endpoint that resets a user's password to a newly
// generated random password and returns it ONCE for the admin to
// hand to the user.
//
// Does NOT change any other profile fields. Does not affect active
// sessions — the user keeps their current session until they log
// out, then must log in with the new password.

export const config = { runtime: 'edge' };

const SUPABASE_URL = 'https://znhjtpcltrxxyfjczgvw.supabase.co';
const ADMIN_EMAIL = 'admin@tfugen.local';

const DEFAULT_ALLOWED_ORIGINS = ['https://tfugen-safety.vercel.app'];
const MAX_BODY_BYTES = 1000;

function getAllowedOrigins() {
  const extra = (process.env.ALLOWED_ORIGINS || '')
    .split(',').map(s => s.trim()).filter(Boolean);
  return [...DEFAULT_ALLOWED_ORIGINS, ...extra];
}

function corsHeaders(origin, allowed) {
  const allow = allowed.includes(origin) ? origin : allowed[0];
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Methods': 'POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Vary': 'Origin'
  };
}

function jsonResp(obj, status, cors) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' }
  });
}

function jsonErr(msg, status, cors) {
  return jsonResp({ error: msg }, status, cors);
}

function isAllowedCaller(req, allowed) {
  const origin = req.headers.get('origin') || '';
  if (origin && allowed.includes(origin)) return true;
  const referer = req.headers.get('referer') || '';
  if (referer) {
    try { if (allowed.includes(new URL(referer).origin)) return true; } catch (e) {}
  }
  return false;
}

function genPassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  let suffix = '';
  for (let i = 0; i < 6; i++) suffix += chars[bytes[i] % chars.length];
  return 'Aa' + suffix + '!';
}

export default async function handler(req) {
  const allowed = getAllowedOrigins();
  const origin = req.headers.get('origin') || '';
  const cors = corsHeaders(origin, allowed);

  if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
  if (req.method !== 'POST') return jsonErr('method not allowed', 405, cors);
  if (!isAllowedCaller(req, allowed)) return jsonErr('origin not allowed', 403, cors);

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) return jsonErr('server misconfigured: missing SUPABASE_SERVICE_ROLE_KEY', 500, cors);

  // 1. Verify caller is admin
  const auth = req.headers.get('authorization') || '';
  const token = auth.replace(/^Bearer\s+/i, '').trim();
  if (!token) return jsonErr('missing bearer token', 401, cors);

  const verifyResp = await fetch(SUPABASE_URL + '/auth/v1/user', {
    headers: { apikey: serviceKey, Authorization: 'Bearer ' + token }
  });
  if (!verifyResp.ok) return jsonErr('invalid session token', 401, cors);
  const userInfo = await verifyResp.json();
  if (!userInfo || userInfo.email !== ADMIN_EMAIL) {
    return jsonErr('admin only — your account does not have permission', 403, cors);
  }

  // 2. Parse body
  const bodyText = await req.text();
  if (bodyText.length > MAX_BODY_BYTES) return jsonErr('body too large', 413, cors);
  let body;
  try { body = JSON.parse(bodyText); } catch (e) { return jsonErr('invalid json', 400, cors); }

  const username = (body.username || '').trim().toLowerCase();
  if (!username) return jsonErr('username required', 400, cors);
  if (username === 'admin') return jsonErr('cannot reset admin password from this endpoint', 400, cors);

  const targetEmail = username + '@tfugen.local';

  // 3. Find the auth user (paginated list; API has no direct lookup by email)
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
    return jsonErr('lookup failed: ' + e.message, 502, cors);
  }
  if (!targetUser) return jsonErr('auth user not found for ' + targetEmail, 404, cors);

  // 4. Update the password
  const newPassword = genPassword();
  const updResp = await fetch(SUPABASE_URL + '/auth/v1/admin/users/' + targetUser.id, {
    method: 'PUT',
    headers: {
      apikey: serviceKey,
      Authorization: 'Bearer ' + serviceKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ password: newPassword })
  });

  if (!updResp.ok) {
    const errText = await updResp.text();
    return jsonErr('password reset failed (' + updResp.status + '): ' + errText.slice(0, 300), 502, cors);
  }

  return jsonResp({
    success: true,
    username,
    password: newPassword
  }, 200, cors);
}
