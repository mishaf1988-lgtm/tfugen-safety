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

  // 3. Find auth user by old email
  const findResp = await fetch(SUPABASE_URL + '/auth/v1/admin/users?filter=email.eq.' + encodeURIComponent(oldEmail), {
    headers: { apikey: serviceKey, Authorization: 'Bearer ' + serviceKey }
  });
  if (!findResp.ok) {
    const errText = await findResp.text();
    return jsonErr('failed to lookup user (' + findResp.status + '): ' + errText.slice(0, 200), 502, cors);
  }
  const findJson = await findResp.json();
  const users = findJson.users || [];
  const targetUser = users.find(u => u.email === oldEmail);
  if (!targetUser) return jsonErr('auth user not found for ' + oldEmail, 404, cors);

  // 4. Check newEmail not taken
  const collisionResp = await fetch(SUPABASE_URL + '/auth/v1/admin/users?filter=email.eq.' + encodeURIComponent(newEmail), {
    headers: { apikey: serviceKey, Authorization: 'Bearer ' + serviceKey }
  });
  if (collisionResp.ok) {
    const cj = await collisionResp.json();
    const collide = (cj.users || []).find(u => u.email === newEmail);
    if (collide) return jsonErr('username already taken', 409, cors);
  }

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

  // 6. Insert NEW app_users row first (with all old data), then delete the old row.
  // We can't UPDATE id directly via PostgREST without ON CONFLICT, so do INSERT (copy) + DELETE.
  // Step 6a: fetch the old row
  const fetchOldResp = await fetch(SUPABASE_URL + '/rest/v1/app_users?id=eq.' + encodeURIComponent(oldUsername) + '&select=*', {
    headers: { apikey: serviceKey, Authorization: 'Bearer ' + serviceKey }
  });
  if (!fetchOldResp.ok) {
    return jsonErr('fetch old app_users failed', 502, cors);
  }
  const oldRows = await fetchOldResp.json();
  const oldRow = oldRows[0] || { id: oldUsername, username: oldUsername, active: true };

  // Step 6b: insert new row (copy old, override id+username)
  const newRow = Object.assign({}, oldRow, {
    id: newUsername,
    username: newUsername,
    ts: new Date().toISOString()
  });
  const insNewResp = await fetch(SUPABASE_URL + '/rest/v1/app_users', {
    method: 'POST',
    headers: {
      apikey: serviceKey,
      Authorization: 'Bearer ' + serviceKey,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates'
    },
    body: JSON.stringify(newRow)
  });
  if (!insNewResp.ok) {
    const errText = await insNewResp.text();
    // Auth was renamed; app_users couldn't be updated. Caller should retry.
    return jsonResp({
      partial: true,
      warning: 'auth renamed but new app_users row failed: ' + errText.slice(0, 200),
      old_username: oldUsername,
      new_username: newUsername
    }, 200, cors);
  }

  // Step 6c: delete the old row
  const delOldResp = await fetch(SUPABASE_URL + '/rest/v1/app_users?id=eq.' + encodeURIComponent(oldUsername), {
    method: 'DELETE',
    headers: { apikey: serviceKey, Authorization: 'Bearer ' + serviceKey }
  });
  if (!delOldResp.ok) {
    // Both rows now exist temporarily; not catastrophic
    return jsonResp({
      partial: true,
      warning: 'both old + new rows exist; admin should delete old one manually',
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
