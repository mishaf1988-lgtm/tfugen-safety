// Cloudflare Pages Function — WhatsApp system diagnostics
// Admin-friendly status check: env vars set? token valid? templates approved?
//
// Usage:
//   GET /api/wa-status
// Returns JSON with concrete go/no-go info per check.
//
// This endpoint never sends a WhatsApp message — read-only.

import { defaultAllowedOrigins, corsHeaders, jsonResp, isAllowedCaller } from '../_shared.js';

const META_API_VERSION = 'v25.0';
const FALLBACK_WABA_ID = '4400035656982783';

export async function onRequest({ request, env }) {
  const allowed = defaultAllowedOrigins(env);
  const origin = request.headers.get('origin') || '';
  const cors = corsHeaders(origin, allowed, 'GET,OPTIONS');

  if (request.method === 'OPTIONS') return new Response(null, { headers: cors });
  if (request.method !== 'GET') return jsonResp({ error: 'method not allowed' }, 405, cors);
  // Origin/Referer gate. This is a diagnostics endpoint that leaks operational
  // metadata (token length, last-4 of WABA/phone-number IDs, approved template
  // names). Only callers from a trusted origin (production or a CF preview)
  // should reach it. Note: this is the only gate — the in-browser caller is
  // already further restricted by the admin-only "dash-wa-test" UI block.
  if (!isAllowedCaller(request, allowed)) return jsonResp({ error: 'origin not allowed' }, 403, cors);

  const PHONE_ID = env.META_PHONE_NUMBER_ID;
  const TOKEN = env.META_ACCESS_TOKEN;
  const WABA_RAW = env.META_WABA_ID;
  const WABA = WABA_RAW || FALLBACK_WABA_ID;

  const status = {
    env: {
      META_PHONE_NUMBER_ID: PHONE_ID ? ('set (...' + PHONE_ID.slice(-4) + ')') : 'MISSING',
      META_ACCESS_TOKEN: TOKEN ? ('set (' + TOKEN.length + ' chars)') : 'MISSING',
      META_WABA_ID: WABA_RAW ? ('set (...' + WABA_RAW.slice(-4) + ')') : ('fallback (' + WABA + ')')
    },
    runtime: {
      origin: origin || 'no-origin-header',
      cf_pages: env.CF_PAGES === '1' || !!env.CF_PAGES_BRANCH,
      branch: env.CF_PAGES_BRANCH || null
    },
    meta_api: { reachable: false, status: null, error: null, templates: null, approved_count: 0 },
    next_step: null
  };

  if (!PHONE_ID || !TOKEN) {
    status.next_step = 'Set META_PHONE_NUMBER_ID and META_ACCESS_TOKEN in Cloudflare Pages dashboard ' +
      '(Settings -> Environment variables -> Add for production).';
    return jsonResp(status, 200, cors);
  }

  // Check -1: is Meta Graph API reachable AT ALL from this Cloudflare worker?
  // Hits /me with a deliberately invalid token. A healthy Meta API responds
  // with "Invalid OAuth access token" (code 190). If we instead get "API
  // access blocked" (code 200) on this neutral probe, then Meta is rejecting
  // requests by IP/origin — not a token issue, but a Cloudflare worker IP
  // reputation issue.
  status.meta_api.reachability = await probe(
    'https://graph.facebook.com/' + META_API_VERSION + '/me?fields=id',
    'invalid_token_for_probe'
  );

  // Check 0: token sanity — is the token recognized by Meta at all?
  // /me works for any valid token (user, SU, page). If THIS fails, the
  // token is dead (revoked or expired) and nothing else can succeed.
  status.meta_api.identity = await probe(
    'https://graph.facebook.com/' + META_API_VERSION + '/me?fields=id,name',
    TOKEN
  );

  // Check 1: messaging scope — fetch the phone number metadata. Needs
  // whatsapp_business_messaging permission. If this works, send will work.
  status.meta_api.messaging = await probe(
    'https://graph.facebook.com/' + META_API_VERSION + '/' + PHONE_ID + '?fields=verified_name,display_phone_number',
    TOKEN
  );

  // Check 2: management scope — list templates. Needs whatsapp_business_management.
  status.meta_api.management = await probe(
    'https://graph.facebook.com/' + META_API_VERSION + '/' + WABA + '/message_templates?fields=name,status,language,category&limit=50',
    TOKEN
  );

  // Backwards-compat fields the dashboard already reads
  const mgmt = status.meta_api.management;
  status.meta_api.reachable = mgmt.ok;
  status.meta_api.status = mgmt.status;
  if (mgmt.ok && mgmt.json && Array.isArray(mgmt.json.data)) {
    const tpls = mgmt.json.data.map(function (t) {
      return { name: t.name, status: t.status, language: t.language, category: t.category };
    });
    status.meta_api.templates = tpls;
    status.meta_api.approved_count = tpls.filter(function (t) { return t.status === 'APPROVED'; }).length;
  } else if (!mgmt.ok) {
    status.meta_api.error = (mgmt.json && mgmt.json.error) || mgmt.json || mgmt.networkError;
  }

  // Compose next_step from the combination of probe results
  status.next_step = nextStepFor(status.meta_api);

  return jsonResp(status, 200, cors);
}

async function probe(url, token) {
  try {
    const r = await fetch(url, { headers: { 'Authorization': 'Bearer ' + token } });
    const text = await r.text();
    let json;
    try { json = JSON.parse(text); } catch (e) { json = { raw: text.substring(0, 400) }; }
    return { ok: r.ok, status: r.status, json: json };
  } catch (e) {
    return { ok: false, status: 0, networkError: String(e && e.message || e) };
  }
}

function nextStepFor(meta) {
  const reach = meta.reachability || {};
  const id = meta.identity || {};
  const m = meta.messaging || {};
  const g = meta.management || {};

  // Reachability check FIRST. Neutral probe with bogus token should get a
  // "bad token" error (code 190). If it gets "API access blocked" (200) or
  // a network failure, the issue is between Cloudflare worker and Meta.
  if (reach.networkError) {
    return 'NETWORK FAILURE reaching Meta from Cloudflare. Cloudflare worker may be unable to egress to graph.facebook.com. Check Cloudflare function logs.';
  }
  const reachErr = (reach.json && reach.json.error) || {};
  if (reachErr.code === 200 || /access\s*blocked/i.test(reachErr.message || '')) {
    return 'IP BLOCKED. Cloudflare worker IP is rejected by Meta BEFORE any token check. This is independent of your token. Workarounds: ' +
      '(a) Test the same token from your laptop with curl - if it works, the problem is the CF worker IP. ' +
      '(b) Move the WhatsApp send endpoint back to Vercel temporarily. ' +
      '(c) Open a Meta support ticket explaining your CF worker IP is being blocked.';
  }
  // Reachability OK if we got code 190 "Invalid OAuth access token" - that's healthy

  // Identity check second.
  if (!id.ok) {
    const err = (id.json && id.json.error) || {};
    if (err.code === 190) {
      return 'TOKEN IS DEAD. The token was revoked or expired. Regenerate at Meta Business Settings -> System Users -> [your SU] -> Generate New Token (with both whatsapp_business_messaging + whatsapp_business_management scopes), then update META_ACCESS_TOKEN in Cloudflare Pages env vars.';
    }
    if (err.code === 200 || /access\s*blocked/i.test(err.message || '')) {
      return 'TOKEN BLOCKED but Meta API is reachable. The Meta App or Business Account itself is restricted. ' +
        'Check: (1) developers.facebook.com/apps - your App should show status "Live" not "Restricted". ' +
        '(2) business.facebook.com/security_center - any "Action Required" cards. ' +
        '(3) business.facebook.com/settings/info - Business Verification valid? ' +
        '(4) Try regenerating the token entirely - sometimes Meta security rotates tokens silently.';
    }
    return 'Token rejected by Meta. Error: ' + JSON.stringify(err).substring(0, 200);
  }

  if (m.ok && g.ok) {
    if (meta.approved_count === 0) {
      return 'OK - permissions valid. No APPROVED templates yet. Use "hello_world" until custom templates pass Meta review.';
    }
    return 'OK - permissions valid, ' + meta.approved_count + ' template(s) approved. Try the dashboard test send button.';
  }

  // Identity OK but WhatsApp endpoints fail — it's specifically the WABA asset access
  if (!m.ok && !g.ok) {
    const err = (g.json && g.json.error) || (m.json && m.json.error) || {};
    if (err.code === 200 || err.code === 10 || /access\s*blocked/i.test(err.message || '')) {
      return 'TOKEN VALID but no access to this WABA. Most likely cause: the System User\'s asset assignment to the WABA was removed (or the WABA quality rating dropped). ' +
        'Fix: (1) business.facebook.com -> Settings -> Users -> System Users -> your SU. ' +
        '(2) Assigned Assets tab -> Add Assets -> WhatsApp Accounts -> tick your WABA with FULL control. ' +
        '(3) Generate New Token (both whatsapp_business_messaging + whatsapp_business_management scopes). ' +
        '(4) Paste new token into Cloudflare META_ACCESS_TOKEN env var and Retry deployment.';
    }
    return 'Both WhatsApp scopes failed but token identity works. See meta_api.management.json.error / meta_api.messaging.json.error.';
  }

  if (m.ok && !g.ok) {
    return 'Sending will work, but template listing is blocked. Token is missing whatsapp_business_management scope. ' +
      'Regenerate the System User token with BOTH scopes and update META_ACCESS_TOKEN in Cloudflare Pages env vars.';
  }

  // !m.ok && g.ok — rare
  return 'Template listing works, but sending is blocked. Token is missing whatsapp_business_messaging scope, ' +
    'OR META_PHONE_NUMBER_ID is wrong / not connected to your WABA.';
}
