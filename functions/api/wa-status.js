// Cloudflare Pages Function — WhatsApp system diagnostics
// Admin-friendly status check: env vars set? token valid? templates approved?
//
// Usage:
//   GET /api/wa-status
// Returns JSON with concrete go/no-go info per check.
//
// This endpoint never sends a WhatsApp message — read-only.

import { defaultAllowedOrigins, corsHeaders, jsonResp } from '../_shared.js';

const META_API_VERSION = 'v25.0';
const FALLBACK_WABA_ID = '4400035656982783';

export async function onRequest({ request, env }) {
  const allowed = defaultAllowedOrigins(env);
  const origin = request.headers.get('origin') || '';
  const cors = corsHeaders(origin, allowed, 'GET,OPTIONS');

  if (request.method === 'OPTIONS') return new Response(null, { headers: cors });
  if (request.method !== 'GET') return jsonResp({ error: 'method not allowed' }, 405, cors);

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
  const m = meta.messaging || {};
  const g = meta.management || {};

  if (m.ok && g.ok) {
    if (meta.approved_count === 0) {
      return 'OK - permissions valid. No APPROVED templates yet. Use "hello_world" until custom templates pass Meta review.';
    }
    return 'OK - permissions valid, ' + meta.approved_count + ' template(s) approved. Try the dashboard test send button.';
  }

  if (!m.ok && !g.ok) {
    const err = (g.json && g.json.error) || (m.json && m.json.error) || {};
    if (err.code === 190) {
      return 'META_ACCESS_TOKEN is invalid or expired. Regenerate a permanent System User token in Meta Business Settings.';
    }
    if (err.code === 200 || err.code === 10 || /access\s*blocked/i.test(err.message || '')) {
      return 'Token has no permissions on this WABA. Fix in Meta Business Settings: ' +
        '(1) Business Settings -> Users -> System Users, pick your SU. ' +
        '(2) Add Assets -> WhatsApp Accounts -> select your WABA with Full control. ' +
        '(3) Generate New Token, check both whatsapp_business_messaging AND whatsapp_business_management. ' +
        '(4) Update META_ACCESS_TOKEN in Cloudflare Pages env vars and redeploy.';
    }
    return 'Both messaging and management scopes failed. See meta_api.management.json.error / meta_api.messaging.json.error for details.';
  }

  if (m.ok && !g.ok) {
    return 'Sending will work, but template listing is blocked. Token is missing whatsapp_business_management scope. ' +
      'Regenerate the System User token with BOTH scopes (whatsapp_business_messaging AND whatsapp_business_management) ' +
      'and update META_ACCESS_TOKEN in Cloudflare Pages env vars.';
  }

  // !m.ok && g.ok — rare
  return 'Template listing works, but sending is blocked. Token is missing whatsapp_business_messaging scope, ' +
    'OR META_PHONE_NUMBER_ID is wrong / not connected to your WABA.';
}
