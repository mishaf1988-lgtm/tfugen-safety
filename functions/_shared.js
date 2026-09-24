// Shared helpers for Cloudflare Pages Functions.
// (Vercel constants were removed in 2026-05-04 after the migration to
// Cloudflare Pages was finalised and the Vercel project was deleted.)

export const CF_PROD = 'https://tapugan-safety.pages.dev';
export const CF_PREVIEW_RE = /^https:\/\/[a-z0-9-]+\.tapugan-safety\.pages\.dev$/;

export function defaultAllowedOrigins(env) {
  const list = [CF_PROD];
  const extra = (env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
  return [...list, ...extra];
}

export function originPasses(origin, allowed) {
  if (!origin) return false;
  if (allowed.includes(origin)) return true;
  if (CF_PREVIEW_RE.test(origin)) return true;
  return false;
}

export function corsHeaders(origin, allowed, methods = 'POST,OPTIONS') {
  const allow = originPasses(origin, allowed) ? origin : allowed[0];
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Methods': methods,
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Vary': 'Origin'
  };
}

// charset=utf-8 is not optional here. Without it Safari decodes the body as
// Latin-1, so every Hebrew string and every ✓ / ⚠ in a response comes out as
// mojibake — which is exactly how the security self-test read on Michael's
// phone: «âœ"» where a tick should be. claude.js always declared it on its
// stream; this, which serves ten endpoints including trustee-notify and its
// Hebrew task names, never did.
export function jsonResp(payload, status, cors) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json; charset=utf-8' }
  });
}

export function isAllowedCaller(request, allowed) {
  const origin = request.headers.get('origin') || '';
  if (originPasses(origin, allowed)) return true;
  // Safari sometimes omits Origin — fall back to Referer
  const referer = request.headers.get('referer') || '';
  if (referer) {
    try {
      const refOrigin = new URL(referer).origin;
      if (originPasses(refOrigin, allowed)) return true;
    } catch (e) {}
  }
  return false;
}

// ---- who is on the other end -------------------------------------------------
// Security review 2026-09-20. The May audit made wa-send require a JWT (H1).
// In September the app gained a no-password trustee screen, which signs in
// ANONYMOUSLY — and Supabase anonymous sign-in produces a real user, so
// /auth/v1/user returns 200 for it and the H1 gate stopped meaning anything.
// The client already knew the difference (index.html: !session.user.is_anonymous);
// the server did not. Endpoints that spend money, send from the factory's
// verified WhatsApp number, or burn an AI quota use this instead.
//
// Returns { ok, status, error, user } — never throws.
export async function requireUser(request, env, opts) {
  const allowAnonymous = !!(opts && opts.allowAnonymous);
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) return { ok: false, status: 500, error: 'server misconfigured: missing SUPABASE_SERVICE_ROLE_KEY' };
  const token = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();
  if (!token) return { ok: false, status: 401, error: 'missing bearer token' };
  const SUPABASE_URL = env.SUPABASE_URL || 'https://znhjtpcltrxxyfjczgvw.supabase.co';
  let resp, user;
  try {
    resp = await fetch(SUPABASE_URL + '/auth/v1/user', {
      headers: { apikey: serviceKey, Authorization: 'Bearer ' + token }
    });
  } catch (e) {
    return { ok: false, status: 502, error: 'auth check failed' };
  }
  if (!resp.ok) return { ok: false, status: 401, error: 'invalid session token' };
  try { user = await resp.json(); } catch (e) { return { ok: false, status: 502, error: 'auth check failed' }; }
  // Supabase marks these explicitly. Treat a missing email as anonymous too:
  // every real account in this app signs in with one, so absence is the tell
  // even if the flag is ever dropped from the response shape.
  const anonymous = user && (user.is_anonymous === true || !user.email);
  if (anonymous && !allowAnonymous) {
    return { ok: false, status: 403, error: 'anonymous session not allowed here', anonymous: true };
  }
  return { ok: true, user, anonymous: !!anonymous };
}

// ---- authorization by role ---------------------------------------------------
// requireUser proves WHO is calling; it does not prove they may do the thing.
// A reporter carries a real, non-anonymous session, so requireUser admits them
// -- and until the 2026-09-24 review wa-send, claude and the trustee-notify test
// path did nothing more, so a reporter (or an attacker holding a reporter
// account) could send WhatsApp from the company number, burn the AI key, or fire
// a test message to any recipient. The role is read exactly the way
// private.is_admin_manager() reads it in the database: app_users.id is the local
// part of the login email, and a row with active=false counts as no role.
export const ADMIN_EMAIL = 'admin@tfugen.local';
const ROLE_MAP = {
  'אדמין': 'admin',    // admin
  'מנהל': 'manager',        // manager
  'צופה': 'viewer',         // viewer (read-only, 2026-09-24)
  'מדווח': 'reporter'  // reporter (default)
};
export async function userRole(env, user) {
  const email = String((user && user.email) || '').toLowerCase();
  if (!email) return null;
  if (email === ADMIN_EMAIL) return 'admin';
  // 2026-09-24 red-team: the role must be bound to the FULL login email, not
  // just the local part -- otherwise <staff-username>@attacker.com resolves to
  // that staff member (matches the DB fix in is_admin_manager). Every real
  // login is <username>@tfugen.local (create-user.js, index.html _resolveEmail).
  const at = email.split('@');
  if (at.length !== 2 || at[1] !== 'tfugen.local') return null;
  const id = at[0];
  if (!/^[a-z0-9._-]{1,60}$/.test(id)) return null;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  const SUPABASE_URL = env.SUPABASE_URL || 'https://znhjtpcltrxxyfjczgvw.supabase.co';
  if (!key) return null;
  try {
    const r = await fetch(SUPABASE_URL + '/rest/v1/app_users?id=eq.' + encodeURIComponent(id) + '&select=role,active',
      { headers: { apikey: key, Authorization: 'Bearer ' + key } });
    if (!r.ok) return null;
    const rows = await r.json();
    const u = Array.isArray(rows) ? rows[0] : null;
    if (!u || u.active === false) return null;
    return ROLE_MAP[u.role] || null;
  } catch (e) { return null; }
}
// requireUser + a role gate. `allowed` is the list of roles that may proceed
// (e.g. ['admin','manager']). Returns { ok, status, error, user, role }.
export async function requireRole(request, env, allowed) {
  const who = await requireUser(request, env);
  if (!who.ok) return who;
  const role = await userRole(env, who.user);
  if (!role || (Array.isArray(allowed) && allowed.indexOf(role) < 0)) {
    return { ok: false, status: 403, error: 'insufficient role', user: who.user, role: role };
  }
  return { ok: true, user: who.user, role: role };
}
