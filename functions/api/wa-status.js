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

  try {
    const url = 'https://graph.facebook.com/' + META_API_VERSION + '/' + WABA +
                '/message_templates?fields=name,status,language,category&limit=50';
    const r = await fetch(url, { headers: { 'Authorization': 'Bearer ' + TOKEN } });
    const text = await r.text();
    let parsed;
    try { parsed = JSON.parse(text); } catch (e) { parsed = { raw: text.substring(0, 500) }; }

    status.meta_api.status = r.status;
    status.meta_api.reachable = r.ok;

    if (!r.ok) {
      status.meta_api.error = parsed.error || parsed;
      const code = parsed.error && parsed.error.code;
      if (code === 190) {
        status.next_step = 'META_ACCESS_TOKEN is invalid or expired. Generate a new permanent System User token in Meta Business Settings.';
      } else if (code === 100) {
        status.next_step = 'WABA ID may be wrong. Verify META_WABA_ID env var matches your WhatsApp Business Account ID.';
      } else {
        status.next_step = 'Meta API error - see meta_api.error for details.';
      }
      return jsonResp(status, 200, cors);
    }

    const tpls = (parsed.data || []).map(function (t) {
      return { name: t.name, status: t.status, language: t.language, category: t.category };
    });
    status.meta_api.templates = tpls;
    status.meta_api.approved_count = tpls.filter(function (t) { return t.status === 'APPROVED'; }).length;

    if (status.meta_api.approved_count === 0) {
      status.next_step = 'No APPROVED templates yet. Use template "hello_world" (always works) until your custom templates pass Meta review.';
    } else {
      status.next_step = 'OK - ' + status.meta_api.approved_count + ' approved template(s) available. Try the dashboard test send button.';
    }
  } catch (e) {
    status.meta_api.error = String(e && e.message || e);
    status.next_step = 'Network error reaching Meta API. Check Cloudflare function logs.';
  }

  return jsonResp(status, 200, cors);
}
