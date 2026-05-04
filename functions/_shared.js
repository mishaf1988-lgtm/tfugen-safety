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
