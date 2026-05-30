// Cloudflare Pages Function — security self-test endpoint
//
// Open this URL from any browser (mobile included) to verify that the
// security hardening landed in production AND is still in force:
//   https://tapugan-safety.pages.dev/api/_securityselftest
//
// All checks are SAFE to expose:
//   * Header values are public anyway (defined in /_headers, in the repo).
//   * Counts only — never the contents of PII rows.
//   * Caller's role inferred from their JWT email if a token is provided.
//
// Without a token, runs only public/header checks. With a token (set by the
// page automatically via `Authorization: Bearer <_sbToken>` when called from
// the app shell), also runs RLS checks against the caller's effective view.
//
// Read-only. No state changes. No secrets in response.

import { jsonResp } from '../_shared.js';

const SBU = 'https://znhjtpcltrxxyfjczgvw.supabase.co';
const SBK = 'sb_publishable_N2ihyyjK_qZEyB0vqunNtQ_oi4roa0M';

function decodeJwtEmail(token) {
  if (!token) return null;
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const padded = parts[1] + '='.repeat((4 - (parts[1].length % 4)) % 4);
    const json = atob(padded.replace(/-/g, '+').replace(/_/g, '/'));
    const claims = JSON.parse(json);
    return claims.email || (claims.user_metadata && claims.user_metadata.email) || null;
  } catch (e) { return null; }
}

function verdict(pass) { return pass ? '✓' : (pass === false ? '✗' : '⚠'); }

export async function onRequest({ request }) {
  // Permissive CORS — diagnostics endpoint, no PII in response.
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Cache-Control': 'no-store'
  };
  if (request.method === 'OPTIONS') return new Response(null, { headers: cors });
  if (request.method !== 'GET') return jsonResp({ error: 'method not allowed' }, 405, cors);

  const url = new URL(request.url);
  const origin = url.origin;
  const userToken = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  const callerEmail = decodeJwtEmail(userToken);

  const checks = [];
  const counts = { pass: 0, fail: 0, warn: 0 };

  function pushCheck(c) {
    checks.push(c);
    if (c.verdict === '✓') counts.pass++;
    else if (c.verdict === '✗') counts.fail++;
    else counts.warn++;
  }

  // ----- 1. HTML Cache-Control -----
  try {
    const r = await fetch(origin + '/index.html', { method: 'HEAD', cf: { cacheTtl: 0 } });
    const cc = r.headers.get('cache-control') || '';
    pushCheck({
      id: 'cache_control_html',
      expected: 'no-cache, must-revalidate',
      got: cc || '(missing)',
      verdict: verdict(/no-cache/i.test(cc) && /must-revalidate/i.test(cc))
    });
  } catch (e) {
    pushCheck({ id: 'cache_control_html', got: 'fetch failed: ' + e.message, verdict: '✗' });
  }

  // ----- 2. Security headers on / -----
  let homeHeaders = null;
  try {
    const r = await fetch(origin + '/', { method: 'HEAD', cf: { cacheTtl: 0 } });
    homeHeaders = r.headers;
  } catch (e) {}
  if (homeHeaders) {
    const csp = homeHeaders.get('content-security-policy') || '';
    pushCheck({
      id: 'csp_present',
      expected: 'CSP header set with frame-ancestors',
      got: csp ? (csp.substring(0, 80) + (csp.length > 80 ? '...' : '')) : '(missing)',
      verdict: verdict(csp.length > 50 && /frame-ancestors/.test(csp))
    });
    const hsts = homeHeaders.get('strict-transport-security') || '';
    pushCheck({
      id: 'hsts',
      expected: 'max-age >= 1 year',
      got: hsts || '(missing)',
      verdict: verdict(/max-age=(\d+)/.test(hsts) && parseInt(RegExp.$1, 10) >= 31536000)
    });
    pushCheck({
      id: 'x_content_type_options',
      expected: 'nosniff',
      got: homeHeaders.get('x-content-type-options') || '(missing)',
      verdict: verdict((homeHeaders.get('x-content-type-options') || '').toLowerCase() === 'nosniff')
    });
    pushCheck({
      id: 'x_frame_options',
      expected: 'SAMEORIGIN or DENY',
      got: homeHeaders.get('x-frame-options') || '(missing)',
      verdict: verdict(/^(SAMEORIGIN|DENY)$/i.test(homeHeaders.get('x-frame-options') || ''))
    });
    pushCheck({
      id: 'referrer_policy',
      expected: 'strict-origin-when-cross-origin',
      got: homeHeaders.get('referrer-policy') || '(missing)',
      verdict: verdict(/strict-origin/.test(homeHeaders.get('referrer-policy') || ''))
    });
  } else {
    pushCheck({ id: 'security_headers', got: 'fetch / failed', verdict: '✗' });
  }

  // ----- 3. M4 — wa-status origin gate (negative test) -----
  // Fetch /api/wa-status with NO Origin header (simulating external curl).
  // Server should 403.
  try {
    const r = await fetch(origin + '/api/wa-status', { method: 'GET' });
    pushCheck({
      id: 'wa_status_origin_gate_blocks_no_origin',
      expected: '403',
      got: String(r.status),
      verdict: verdict(r.status === 403)
    });
  } catch (e) {
    pushCheck({ id: 'wa_status_origin_gate_blocks_no_origin', got: 'fetch failed', verdict: '⚠' });
  }

  // ----- 4. M4 — wa-templates origin gate (negative test) -----
  try {
    const r = await fetch(origin + '/api/wa-templates', { method: 'GET' });
    pushCheck({
      id: 'wa_templates_origin_gate_blocks_no_origin',
      expected: '403',
      got: String(r.status),
      verdict: verdict(r.status === 403)
    });
  } catch (e) {
    pushCheck({ id: 'wa_templates_origin_gate_blocks_no_origin', got: 'fetch failed', verdict: '⚠' });
  }

  // ----- 5. C1 — Resend key not in current HTML payload -----
  try {
    const r = await fetch(origin + '/index.html', { cf: { cacheTtl: 0 } });
    const body = await r.text();
    const leaked = /re_[A-Za-z0-9]{8,}/.test(body) || /service_role/.test(body);
    pushCheck({
      id: 'no_secrets_in_html',
      expected: 'no live re_/service_role pattern',
      got: leaked ? 'LEAK SUSPECTED' : 'clean',
      verdict: verdict(!leaked)
    });
  } catch (e) {
    pushCheck({ id: 'no_secrets_in_html', got: 'fetch failed', verdict: '⚠' });
  }

  // ----- 6+. RLS checks (need caller's JWT). Skip gracefully if anonymous. -----
  if (!userToken) {
    pushCheck({
      id: 'rls_checks',
      expected: 'caller JWT in Authorization header',
      got: 'no Authorization header — open from app shell or pass token to run RLS checks',
      verdict: '⚠'
    });
  } else {
    const sbHeaders = { apikey: SBK, Authorization: 'Bearer ' + userToken };
    const callerRoleHint = callerEmail === 'admin@tfugen.local'
      ? 'admin'
      : (callerEmail ? 'authenticated (' + callerEmail + ')' : 'unknown');

    // M1: sens NCR count visible to caller.
    try {
      const r = await fetch(SBU + '/rest/v1/ncr?sens=eq.true&select=id', {
        headers: { ...sbHeaders, Prefer: 'count=exact' }
      });
      const cr = r.headers.get('content-range') || '';
      const total = (cr.split('/')[1] || '?');
      const expectAdmin = (callerRoleHint === 'admin');
      pushCheck({
        id: 'sens_ncr_visible_to_caller',
        expected: expectAdmin ? 'admin: any count OK' : 'non-admin: 0',
        got: total + ' rows (caller: ' + callerRoleHint + ')',
        verdict: verdict(expectAdmin ? r.ok : (total === '0'))
      });
    } catch (e) {
      pushCheck({ id: 'sens_ncr_visible_to_caller', got: 'fetch failed', verdict: '✗' });
    }

    // H2: app_users count visible to caller.
    try {
      const r = await fetch(SBU + '/rest/v1/app_users?select=id', {
        headers: { ...sbHeaders, Prefer: 'count=exact' }
      });
      const cr = r.headers.get('content-range') || '';
      const total = parseInt((cr.split('/')[1] || '-1'), 10);
      const expectAdmin = (callerRoleHint === 'admin');
      pushCheck({
        id: 'app_users_visible_to_caller',
        expected: expectAdmin ? '> 1 (admin sees all)' : '= 1 (reporter sees only self)',
        got: total + ' rows (caller: ' + callerRoleHint + ')',
        verdict: verdict(expectAdmin ? total > 1 : total === 1)
      });
    } catch (e) {
      pushCheck({ id: 'app_users_visible_to_caller', got: 'fetch failed', verdict: '✗' });
    }

    // M2: password_reset_requests visible to caller.
    try {
      const r = await fetch(SBU + '/rest/v1/password_reset_requests?select=id', {
        headers: { ...sbHeaders, Prefer: 'count=exact' }
      });
      const cr = r.headers.get('content-range') || '';
      const total = parseInt((cr.split('/')[1] || '-1'), 10);
      const expectAdmin = (callerRoleHint === 'admin');
      pushCheck({
        id: 'password_reset_visible_to_caller',
        expected: expectAdmin ? 'admin: any count OK' : 'non-admin: 0',
        got: total + ' rows (caller: ' + callerRoleHint + ')',
        verdict: verdict(expectAdmin ? r.ok : total === 0)
      });
    } catch (e) {
      pushCheck({ id: 'password_reset_visible_to_caller', got: 'fetch failed', verdict: '✗' });
    }

    // Information: caller's identity (no PII beyond the JWT email which the
    // caller already knows about themselves).
    pushCheck({
      id: 'caller_identity',
      expected: 'identifiable from JWT',
      got: callerEmail || '(no email claim)',
      verdict: callerEmail ? '✓' : '⚠'
    });
  }

  return jsonResp({
    timestamp: new Date().toISOString(),
    summary: {
      pass: counts.pass,
      fail: counts.fail,
      warn: counts.warn,
      total: checks.length
    },
    checks: checks
  }, 200, cors);
}
