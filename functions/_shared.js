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

export function jsonResp(payload, status, cors) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' }
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
