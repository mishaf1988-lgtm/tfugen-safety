// Cloudflare Pages middleware — who is allowed to reach the front door.
//
// Michael, 2026-09-21: «צריך שהמערכת תהיה נגישה רק מישראל בלבד ולא מכל העולם».
// Every request to the site now passes through here and is answered by the
// country Cloudflare resolved for the caller's IP.
//
// WHAT THIS DOES NOT DO, and it matters more than what it does:
//
// The data does not live here. It lives in Supabase, on a different hostname
// that is not behind Cloudflare and never sees this code. The publishable key
// sits in the page source, as it is designed to -- the row-level rules in the
// database are what stand between a stranger and a record, not this file.
// Somebody in another country who has that key can still call Supabase
// directly. This closes the front door; it does not move the building.
//
// To geo-fence the data as well, Supabase network restrictions are the control
// (an IP allowlist on the project, a paid-plan feature). Until then, treat
// this as what it is: fewer people finding the login screen, not a wall.
//
// Two deliberate choices, both of which make it weaker on purpose:
//
//  * A request whose country Cloudflare could not resolve is ALLOWED. Locking
//    a safety manager out of a hazard report because a geo lookup hiccuped is
//    worse than a stranger reaching a password prompt.
//  * The list is an environment variable, not code. Michael travels, carriers
//    route oddly, and the fix has to be a field in the Cloudflare dashboard
//    that takes effect at once -- not a deploy he cannot do from a phone.

// Set ALLOWED_COUNTRIES in Cloudflare Pages to change this without a deploy.
// Comma separated ISO country codes, e.g. "IL,US".
const DEFAULT_ALLOWED = 'IL';

// Called by Supabase itself (pg_net), from Supabase's servers, which are not
// in Israel. Geo-blocking this path would silently break every hazard alert:
// the trustee's report would save and nobody would ever be told. It carries
// its own authentication and does not become weaker for being reachable.
const MACHINE_PATHS = ['/api/trustee-notify'];

// Headers Pages applies to static assets from /_headers. A response that comes
// back through next() should still carry them, but this does not depend on
// that: the security review of May put them there and a geo rule is no reason
// to find out later that they went missing.
const MUST_HAVE = {
  'X-Content-Type-Options': 'nosniff',
  'X-Robots-Tag': 'noindex, nofollow',
  'X-Frame-Options': 'SAMEORIGIN',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains'
};

function blocked(country) {
  // Says enough for the person in front of it to know what happened and who
  // to ask. Nothing about the system, its version, or what is behind it.
  const body = '<!doctype html><html lang="he" dir="rtl"><head>'
    + '<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
    + '<meta name="robots" content="noindex, nofollow">'
    + '<title>Tapugan Safety</title></head>'
    + '<body style="font-family:Arial,Heebo,sans-serif;background:#f5f7fa;margin:0;'
    + 'display:flex;align-items:center;justify-content:center;min-height:100vh;padding:20px">'
    + '<div style="background:#fff;border-radius:12px;padding:28px 24px;max-width:420px;'
    + 'box-shadow:0 4px 20px rgba(0,0,0,.08);text-align:center">'
    + '<div style="font-size:15px;font-weight:700;color:#cc1f1f;margin-bottom:10px">'
    + 'המערכת זמינה מישראל בלבד</div>'
    + '<div style="font-size:13px;color:#5a6070;line-height:1.8">'
    + 'הגישה נחסמה כי החיבור הגיע מחוץ לישראל.'
    + '<br>אם אתה בארץ ומשתמש ב-VPN, כבה אותו ונסה שוב.'
    + '<br>לגישה מחו״ל פנה לממונה הבטיחות.</div>'
    + '<div style="font-size:11px;color:#94a3b8;margin-top:14px">'
    + (country ? 'code: ' + String(country).substring(0, 4) : 'code: --') + '</div>'
    + '</div></body></html>';
  return new Response(body, {
    status: 403,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', ...MUST_HAVE }
  });
}

export async function onRequest(context) {
  const { request, env, next } = context;

  let path = '/';
  try { path = new URL(request.url).pathname; } catch (e) { /* keep '/' */ }
  if (MACHINE_PATHS.indexOf(path) >= 0) return next();

  const country = (request.cf && request.cf.country) || null;
  const allowed = String((env && env.ALLOWED_COUNTRIES) || DEFAULT_ALLOWED)
    .split(',').map((c) => c.trim().toUpperCase()).filter(Boolean);

  // T1 is how Cloudflare labels a Tor exit. The rule below already refuses it,
  // since T1 is not a country and will not be in the list -- this line earns
  // its place only when the list is widened carelessly, which is exactly when
  // nobody is thinking about Tor. It is checked before the list, not after.
  if (country === 'T1') return blocked(country);
  if (country && allowed.indexOf(country) < 0) return blocked(country);

  const res = await next();
  try {
    const out = new Response(res.body, res);
    Object.keys(MUST_HAVE).forEach(function (k) {
      if (!out.headers.get(k)) out.headers.set(k, MUST_HAVE[k]);
    });
    return out;
  } catch (e) {
    // Re-wrapping failed for a response that cannot be cloned. The page is
    // more important than the belt-and-braces header.
    return res;
  }
}
