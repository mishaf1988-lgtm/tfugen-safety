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

  // ----- 5b. H1 — wa-send must require a valid JWT -----
  // Two negative tests. Send a body that is rejected at the *recipient*
  // validation step (400) — this guarantees no real Meta API call is made
  // even if the auth gate is missing. We send POST with no Authorization,
  // then with a bogus Bearer.
  //
  // BEFORE H1 lands: wa-send only checks origin, so a same-origin POST
  // with no auth reaches the body parser and returns 400. Verdict ✗.
  // AFTER H1 lands: wa-send checks auth before parsing body. Returns 401.
  // Verdict ✓.
  try {
    const r = await fetch(origin + '/api/wa-send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Origin': origin },
      body: '{}'
    });
    pushCheck({
      id: 'wa_send_requires_auth_no_bearer',
      expected: '401 (means H1 JWT-gate is active)',
      got: String(r.status) + ((r.status === 400) ? ' (H1 not yet deployed)' : ''),
      verdict: verdict(r.status === 401 || r.status === 403)
    });
  } catch (e) {
    pushCheck({ id: 'wa_send_requires_auth_no_bearer', got: 'fetch failed: ' + e.message, verdict: '⚠' });
  }
  try {
    const r = await fetch(origin + '/api/wa-send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': origin,
        'Authorization': 'Bearer bogus.invalid.token'
      },
      body: '{}'
    });
    pushCheck({
      id: 'wa_send_requires_auth_bogus_bearer',
      expected: '401 (bogus token must be rejected)',
      got: String(r.status) + ((r.status === 400) ? ' (H1 not yet deployed)' : ''),
      verdict: verdict(r.status === 401 || r.status === 403)
    });
  } catch (e) {
    pushCheck({ id: 'wa_send_requires_auth_bogus_bearer', got: 'fetch failed: ' + e.message, verdict: '⚠' });
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

    // ----- Storage -----
    // The gap 5.9 is about: this endpoint tested RLS on three tables and
    // nothing at all on Storage — which is where the hole actually was. Four
    // policies granted to `authenticated`, and the day the trustee kiosk
    // started signing in anonymously, "authenticated" came to include every
    // visitor. Nothing in the project noticed for weeks.
    //
    // A named user should see the bucket; that is all this can assert from
    // the caller's own token. What it CANNOT do is prove the anonymous case,
    // because it would have to hold an anonymous token — so it says so
    // rather than implying coverage it does not have.
    try {
      const r = await fetch(SBU + '/storage/v1/object/list/incidents-photos', {
        method: 'POST',
        headers: { ...sbHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ limit: 1, prefix: '' })
      });
      const named = callerEmail && callerEmail.indexOf('@') > 0;
      pushCheck({
        id: 'storage_list_for_caller',
        expected: named ? 'named user: can list the bucket' : 'no email claim: should be refused',
        got: 'HTTP ' + r.status + ' (caller: ' + (callerEmail || 'anonymous') + ')',
        verdict: verdict(named ? r.ok : !r.ok)
      });
    } catch (e) {
      pushCheck({ id: 'storage_list_for_caller', got: 'fetch failed', verdict: '⚠' });
    }

    // This used to say the anonymous case was «not testable from this endpoint
    // — needs an anonymous token». That was wrong: the endpoint holds the
    // publishable key, and an anonymous token is exactly what the kiosk mints
    // with it. So it can be proved, by doing what the kiosk does.
    //
    // It is opt-in (?anon=1) for one reason only: signing in anonymously
    // creates a real row in auth.users, and a check that quietly grows that
    // table on every run is its own small problem. Ask for it and it runs.
    if (url.searchParams.get('anon') === '1') {
      let anonTok = null;
      try {
        const su = await fetch(SBU + '/auth/v1/signup', {
          method: 'POST',
          headers: { apikey: SBK, 'Content-Type': 'application/json' },
          body: '{}'
        });
        const sj = await su.json().catch(() => ({}));
        anonTok = sj && sj.access_token;
        pushCheck({
          id: 'anon_signin',
          expected: 'an anonymous session can be created (this is what the kiosk does)',
          got: anonTok ? 'got a token' : ('no token — HTTP ' + su.status),
          verdict: verdict(!!anonTok)
        });
      } catch (e) {
        pushCheck({ id: 'anon_signin', expected: 'anonymous sign-in', got: 'fetch failed', verdict: '⚠' });
      }

      if (anonTok) {
        const anonH = { apikey: SBK, Authorization: 'Bearer ' + anonTok, 'Content-Type': 'application/json' };
        // Each of these is a hole that was real at some point in this project.
        const probes = [
          ['anon_cannot_read_backups', '/storage/v1/object/list/backups',
           'the nightly full-database dump must be unreachable (2026-09-21)'],
          ['anon_cannot_list_all_photos', '/storage/v1/object/list/incidents-photos',
           'incident photos must not be listable wholesale (migrations/2026-09-20_storage_trustee_scope.sql)'],
        ];
        for (const [id, path, expected] of probes) {
          try {
            const r = await fetch(SBU + path, { method: 'POST', headers: anonH, body: JSON.stringify({ limit: 50, prefix: '' }) });
            let rows = [];
            try { rows = await r.json(); } catch (e) { rows = []; }
            const listed = Array.isArray(rows) ? rows.filter((x) => x && x.name && !/^tru-ph-/.test(x.name)) : [];
            pushCheck({
              id, expected,
              got: 'HTTP ' + r.status + ' · ' + listed.length + ' non-kiosk file(s) visible',
              verdict: verdict(listed.length === 0)
            });
          } catch (e) {
            pushCheck({ id, expected, got: 'fetch failed', verdict: '⚠' });
          }
        }
        // And the tables an anonymous visitor must never reach.
        for (const [id, table] of [['anon_cannot_read_ncr', 'ncr'],
                                   ['anon_cannot_read_audit_log', 'audit_log'],
                                   ['anon_cannot_read_app_users', 'app_users']]) {
          try {
            const r = await fetch(SBU + '/rest/v1/' + table + '?select=id&limit=5', { headers: anonH });
            let rows = [];
            try { rows = await r.json(); } catch (e) { rows = []; }
            const n = Array.isArray(rows) ? rows.length : 0;
            pushCheck({
              id,
              expected: 'anonymous session sees 0 rows of ' + table,
              got: 'HTTP ' + r.status + ' · ' + n + ' row(s)',
              verdict: verdict(n === 0)
            });
          } catch (e) {
            pushCheck({ id, expected: 'anonymous read of ' + table, got: 'fetch failed', verdict: '⚠' });
          }
        }
      }
    } else {
      pushCheck({
        id: 'storage_anon_scope',
        expected: 'anonymous session limited to tru-ph-* and locked out of backups',
        got: 'not run — add ?anon=1 (it creates one anonymous auth user, so it is opt-in)',
        verdict: '⚠'
      });
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

  const payload = {
    timestamp: new Date().toISOString(),
    summary: { pass: counts.pass, fail: counts.fail, warn: counts.warn, total: checks.length },
    checks: checks
  };

  // A browser gets a page it can actually read. The JSON is still there for
  // anything programmatic (?format=json, or any client that does not ask for
  // HTML) — but the person who most needs this endpoint reads it on a phone,
  // and Safari was offering to DOWNLOAD it as a file rather than show it.
  const wantsHtml = (request.headers.get('accept') || '').includes('text/html')
                 && url.searchParams.get('format') !== 'json';
  if (!wantsHtml) return jsonResp(payload, 200, cors);

  const esc = (v) => String(v == null ? '' : v)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const colour = { '✓': '#15803d', '✗': '#b91c1c', '⚠': '#b45309' };
  const rows = checks.map((c) => `
    <div class="c" style="border-right-color:${colour[c.verdict] || '#94a3b8'}">
      <div class="h"><span class="v" style="color:${colour[c.verdict] || '#64748b'}">${esc(c.verdict)}</span> <code>${esc(c.id)}</code></div>
      <div class="e">${esc(c.expected || '')}</div>
      <div class="g">${esc(c.got || '')}</div>
    </div>`).join('');

  const html = `<!doctype html><html dir="rtl" lang="he"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>בדיקת אבטחה — Tapugan Safety</title>
<style>
 body{font-family:-apple-system,Arial,Heebo,sans-serif;margin:0;padding:14px;background:#f8fafc;color:#1a1d23}
 h1{font-size:17px;margin:0 0 2px}
 .t{font-size:11px;color:#64748b;margin-bottom:12px}
 .s{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px}
 .s b{display:block;font-size:22px;line-height:1.1}
 .s div{flex:1;min-width:76px;text-align:center;background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:8px 6px;font-size:11px}
 .s .p{border-color:#16a34a;color:#15803d}.s .f{border-color:#cc1f1f;color:#b91c1c}.s .w{border-color:#b45309;color:#b45309}
 .c{background:#fff;border:1px solid #e2e8f0;border-right-width:4px;border-radius:9px;padding:9px 11px;margin-bottom:7px}
 .h{font-size:13px;font-weight:700;display:flex;gap:7px;align-items:baseline}
 .v{font-size:16px}
 code{font-family:ui-monospace,Menlo,monospace;font-size:12px;word-break:break-all;direction:ltr;unicode-bidi:embed}
 .e{font-size:11px;color:#64748b;margin-top:3px}
 .g{font-size:12px;margin-top:2px;direction:ltr;unicode-bidi:embed;text-align:right}
 .n{margin-top:14px;font-size:11px;color:#64748b;background:#fff;border:1px solid #e2e8f0;border-radius:9px;padding:10px 12px;line-height:1.7}
 a{color:#2563eb}
</style></head><body>
<h1>בדיקת אבטחה</h1>
<div class="t">${esc(payload.timestamp)}</div>
<div class="s">
 <div class="p"><b>${counts.pass}</b>עברו</div>
 <div class="f"><b>${counts.fail}</b>נכשלו</div>
 <div class="w"><b>${counts.warn}</b>אזהרות</div>
</div>
${rows}
<div class="n">
 בדיקות ה-RLS דורשות טוקן — פתח את הכתובת הזו <b>מתוך האפליקציה</b>, או הוסף כותרת Authorization.<br>
 להוכחת המקרה האנונימי: <a href="?anon=1">?anon=1</a> (יוצר משתמש אנונימי אחד, לכן אינו רץ כברירת מחדל).<br>
 ל-JSON גולמי: <a href="?format=json">?format=json</a>
</div>
</body></html>`;
  return new Response(html, { status: 200, headers: { ...cors, 'Content-Type': 'text/html; charset=utf-8' } });
}
