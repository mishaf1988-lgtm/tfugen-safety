// Vercel Edge Function — /api/create-user
//
// Admin-only endpoint that:
// 1. Verifies the caller's JWT belongs to admin@tfugen.local
// 2. Creates a new Supabase Auth user (<username>@tfugen.local + random password)
// 3. Inserts/upserts a matching row in app_users (active=true)
// 4. Returns the username + password ONCE for the admin to relay
//
// Requires environment variable SUPABASE_SERVICE_ROLE_KEY.
// Falls back gracefully if either step fails.

export const config = { runtime: 'edge' };

const SUPABASE_URL = 'https://znhjtpcltrxxyfjczgvw.supabase.co';
const ADMIN_EMAIL = 'admin@tfugen.local';

const DEFAULT_ALLOWED_ORIGINS = [
  'https://tfugen-safety.vercel.app'
];
const MAX_BODY_BYTES = 5000;

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
    try {
      if (allowed.includes(new URL(referer).origin)) return true;
    } catch (e) {}
  }
  return false;
}

function genPassword() {
  // Pattern: Aa + 6 random alphanumerics + ! (e.g. AaK7mP3X!)
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let suffix = '';
  // Use crypto.getRandomValues for better randomness in edge runtime
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  for (let i = 0; i < 6; i++) {
    suffix += chars[bytes[i] % chars.length];
  }
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
  if (!serviceKey) {
    return jsonErr('server misconfigured: missing SUPABASE_SERVICE_ROLE_KEY env var', 500, cors);
  }

  // 1. Verify caller is admin
  const auth = req.headers.get('authorization') || '';
  const token = auth.replace(/^Bearer\s+/i, '').trim();
  if (!token) return jsonErr('missing bearer token', 401, cors);

  const verifyResp = await fetch(SUPABASE_URL + '/auth/v1/user', {
    headers: {
      apikey: serviceKey,
      Authorization: 'Bearer ' + token
    }
  });
  if (!verifyResp.ok) return jsonErr('invalid session token', 401, cors);
  const userInfo = await verifyResp.json();
  if (!userInfo || userInfo.email !== ADMIN_EMAIL) {
    return jsonErr('admin only — your account does not have permission', 403, cors);
  }

  // 2. Parse + validate body
  const bodyText = await req.text();
  if (bodyText.length > MAX_BODY_BYTES) return jsonErr('body too large', 413, cors);
  let body;
  try { body = JSON.parse(bodyText); } catch (e) { return jsonErr('invalid json', 400, cors); }

  const username = (body.username || '').trim().toLowerCase();
  const full_name = (body.full_name || '').trim();
  const role = (body.role || 'מדווח').trim();
  const dept = body.dept ? String(body.dept).trim() : null;
  const phone = body.phone ? String(body.phone).trim() : null;
  const email = body.email ? String(body.email).trim() : null;
  const notes = body.notes ? String(body.notes).trim() : null;

  if (!username || !/^[a-z][a-z0-9_-]{2,29}$/.test(username)) {
    return jsonErr('username must be 3-30 chars, start with letter, and contain only a-z 0-9 _ -', 400, cors);
  }
  if (username === 'admin') return jsonErr('username "admin" is reserved', 400, cors);
  if (!full_name) return jsonErr('full_name is required', 400, cors);

  const authEmail = username + '@tfugen.local';
  const password = genPassword();

  // 3. Create Supabase Auth user (admin API)
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
      user_metadata: { username, full_name }
    })
  });

  if (!createAuthResp.ok) {
    const errText = await createAuthResp.text();
    // Common: 422 if user already exists
    if (createAuthResp.status === 422 || /already/i.test(errText)) {
      return jsonErr('user already exists in Auth (username taken)', 409, cors);
    }
    return jsonErr('create auth failed (' + createAuthResp.status + '): ' + errText.slice(0, 300), 502, cors);
  }

  // 4. Upsert app_users row
  const upsertResp = await fetch(SUPABASE_URL + '/rest/v1/app_users', {
    method: 'POST',
    headers: {
      apikey: serviceKey,
      Authorization: 'Bearer ' + serviceKey,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates'
    },
    body: JSON.stringify({
      id: username,
      username,
      full_name,
      role,
      dept,
      phone,
      email,
      notes,
      active: true
    })
  });

  if (!upsertResp.ok) {
    // Auth user was created but app_users row failed — caller can manually fill it later
    const errText = await upsertResp.text();
    return jsonResp({
      partial: true,
      username,
      password,
      warning: 'auth account created but app_users row failed: ' + errText.slice(0, 300)
    }, 200, cors);
  }

  return jsonResp({ success: true, username, password }, 200, cors);
}
