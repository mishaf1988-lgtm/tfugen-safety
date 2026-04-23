// Vercel Edge Function — /api/rename-user
//
// Admin-only endpoint that renames a user atomically:
// 1. Updates auth.users.email via Supabase Admin API
//    (oldUsername@tfugen.local → newUsername@tfugen.local)
// 2. Updates app_users row: id and username fields to the new value
//
// Existing data tied to the user (reports, tasks, etc.) is unaffected
// because nothing in the schema FKs into app_users.id today. The
// renamed user keeps their session until next login, then must use
// the new username.

export const config = { runtime: 'edge' };

const SUPABASE_URL = 'https://znhjtpcltrxxyfjczgvw.supabase.co';
const ADMIN_EMAIL = 'admin@tfugen.local';

const DEFAULT_ALLOWED_ORIGINS = ['https://tfugen-safety.vercel.app'];
const MAX_BODY_BYTES = 2000;

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

  const oldUsername = (body.old_username || '').trim().toLowerCase();
  const newUsername = (body.new_username || '').trim().toLowerCase();

  if (!oldUsername) return jsonErr('old_username required', 400, cors);
  if (!newUsername || !/^[a-z][a-z0-9_-]{2,29}$/.test(newUsername)) {
    return jsonErr('new_username must be 3-30 chars, start with letter, only a-z 0-9 _ -', 400, cors);
  }
  if (newUsername === 'admin') return jsonErr('username "admin" is reserved', 400, cors);
  if (oldUsername === newUsername) return jsonErr('new_username equals old_username', 400, cors);
  if (oldUsername === 'admin') return jsonErr('cannot rename the admin account', 400, cors);

  const oldEmail = oldUsername + '@tfugen.local';
  const newEmail = newUsername + '@tfugen.local';

  // 3. Fetch all auth users (Supabase Admin API ignores arbitrary `filter`
  // params; the only supported search is `?filter=<substr>` on email).
  // We have at most 10-20 users — just page through.
  async function listAllUsers() {
    const all = [];
    for (let page = 1; page <= 10; page++) {
      const r = await fetch(SUPABASE_URL + '/auth/v1/admin/users?page=' + page + '&per_page=1000', {
        headers: { apikey: serviceKey, Authorization: 'Bearer ' + serviceKey }
      });
      if (!r.ok) throw new Error('lookup failed: HTTP ' + r.status + ' ' + (await r.text()).slice(0, 200));
      const j = await r.json();
      const arr = j.users || [];
      all.push(...arr);
      if (arr.length < 1000) break;
    }
    return all;
  }

  let allUsers;
  try {
    allUsers = await listAllUsers();
  } catch (e) {
    return jsonErr('failed to lookup users: ' + e.message, 502, cors);
  }

  const lcOld = oldEmail.toLowerCase();
  const lcNew = newEmail.toLowerCase();
  const targetUser = allUsers.find(u => (u.email || '').toLowerCase() === lcOld);
  if (!targetUser) {
    return jsonErr('auth user not found for ' + oldEmail + ' (scanned ' + allUsers.length + ' users)', 404, cors);
  }

  // 4. Check newEmail not taken
  const collide = allUsers.find(u => (u.email || '').toLowerCase() === lcNew);
  if (collide) return jsonErr('username "' + newUsername + '" already taken', 409, cors);

  // 5. Update auth.users email
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
    return jsonErr('auth update failed (' + updAuthResp.status + '): ' + errText.slice(0, 300), 502, cors);
  }

  // 6. Atomic update of app_users primary key via PATCH.
  // PostgreSQL allows UPDATE on PRIMARY KEY as long as no FK references it.
  // Using PATCH avoids the INSERT+DELETE window that left orphan rows.
  const patchResp = await fetch(SUPABASE_URL + '/rest/v1/app_users?id=eq.' + encodeURIComponent(oldUsername), {
    method: 'PATCH',
    headers: {
      apikey: serviceKey,
      Authorization: 'Bearer ' + serviceKey,
      'Content-Type': 'application/json',
      Prefer: 'return=representation'
    },
    body: JSON.stringify({
      id: newUsername,
      username: newUsername,
      ts: new Date().toISOString()
    })
  });

  if (!patchResp.ok) {
    const errText = await patchResp.text();
    return jsonResp({
      partial: true,
      warning: 'auth email was renamed but app_users update failed: ' + errText.slice(0, 300),
      old_username: oldUsername,
      new_username: newUsername
    }, 200, cors);
  }

  // Verify exactly one row was updated (defense-in-depth)
  const updatedRows = await patchResp.json();
  if (!Array.isArray(updatedRows) || updatedRows.length === 0) {
    return jsonResp({
      partial: true,
      warning: 'auth renamed but app_users PATCH returned zero rows — check RLS / row existence',
      old_username: oldUsername,
      new_username: newUsername
    }, 200, cors);
  }

  return jsonResp({
    success: true,
    old_username: oldUsername,
    new_username: newUsername,
    note: 'המשתמש ייכנס מעתה עם השם החדש. הסיסמה לא השתנתה.'
  }, 200, cors);
}
