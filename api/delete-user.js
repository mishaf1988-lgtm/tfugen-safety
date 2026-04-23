// Vercel Edge Function — /api/delete-user
//
// Admin-only endpoint that removes a user completely:
// 1. Deletes the Supabase Auth account (<username>@tfugen.local)
// 2. Deletes the app_users row
//
// Best-effort on the auth side: if the auth user doesn't exist (already
// deleted manually), we still proceed and delete the app_users row.
// The user's reports/tasks/incidents are untouched (no FKs into app_users).

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
  if (username === 'admin') return jsonErr('cannot delete the admin account', 400, cors);

  const targetEmail = username + '@tfugen.local';

  // 3. Find the auth user (best-effort; keep going even if not found)
  let authDeleted = false, authStatus = 'skipped';
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
      if (delResp.ok || delResp.status === 204) {
        authDeleted = true; authStatus = 'deleted';
      } else {
        authStatus = 'failed: HTTP ' + delResp.status;
      }
    } else {
      authStatus = 'not_found';
    }
  } catch (e) {
    authStatus = 'error: ' + e.message;
  }

  // 4. Delete the app_users row (always attempted)
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

  return jsonResp({
    success: true,
    username,
    auth: authStatus,
    app_users: appUsersStatus
  }, 200, cors);
}
