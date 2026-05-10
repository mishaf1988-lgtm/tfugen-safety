// Cloudflare Pages Function — Microsoft OAuth callback.
//
// Microsoft redirects here with ?code=...&state=... after the admin
// signs in. We verify the state cookie matches, exchange the code for
// access + refresh tokens, sanity-check the signed-in user matches
// MAIL_FROM_USER, and store the refresh_token in oauth_tokens.
//
// Method: GET (browser navigation from microsoftonline.com).
// Auth: state cookie set by /api/auth/microsoft-start.

import { saveTokens } from '../../_msApp.js';

const SUCCESS_REDIRECT = 'https://tapugan-safety.pages.dev/?ms=connected';
const FAIL_REDIRECT = 'https://tapugan-safety.pages.dev/?ms=failed';

function readCookie(request, name) {
  const raw = request.headers.get('cookie') || '';
  for (const part of raw.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return decodeURIComponent(v.join('='));
  }
  return null;
}

function redirectTo(url, extraHeaders) {
  return new Response(null, {
    status: 302,
    headers: { Location: url, ...(extraHeaders || {}) }
  });
}

export async function onRequest({ request, env }) {
  if (request.method !== 'GET') {
    return new Response('method not allowed', { status: 405 });
  }

  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const oauthError = url.searchParams.get('error');
  const oauthErrorDesc = url.searchParams.get('error_description');

  // Clear the state cookie regardless of outcome.
  const clearCookie = 'ms_oauth_state=; Path=/api/auth/; Max-Age=0; HttpOnly; Secure; SameSite=Lax';

  if (oauthError) {
    return redirectTo(`${FAIL_REDIRECT}&reason=${encodeURIComponent(oauthError + ': ' + (oauthErrorDesc || ''))}`,
      { 'Set-Cookie': clearCookie });
  }
  if (!code || !state) {
    return redirectTo(`${FAIL_REDIRECT}&reason=missing_code_or_state`, { 'Set-Cookie': clearCookie });
  }

  const cookieState = readCookie(request, 'ms_oauth_state');
  if (!cookieState || cookieState !== state) {
    return redirectTo(`${FAIL_REDIRECT}&reason=state_mismatch`, { 'Set-Cookie': clearCookie });
  }

  const tenant = env.AZURE_TENANT_ID;
  const clientId = env.AZURE_CLIENT_ID;
  const clientSecret = env.AZURE_CLIENT_SECRET;
  const redirectUri = env.AZURE_REDIRECT_URI;
  const expectedUpn = (env.MAIL_FROM_USER || 'sviva@tapugan.co.il').toLowerCase();
  if (!tenant || !clientId || !clientSecret || !redirectUri || !env.SUPABASE_SERVICE_ROLE_KEY) {
    return redirectTo(`${FAIL_REDIRECT}&reason=server_misconfigured`, { 'Set-Cookie': clearCookie });
  }

  // Exchange code for tokens.
  const tokenUrl = `https://login.microsoftonline.com/${encodeURIComponent(tenant)}/oauth2/v2.0/token`;
  const tokenBody = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: clientId,
    client_secret: clientSecret,
    code,
    redirect_uri: redirectUri,
    scope: 'offline_access Mail.Send User.Send User.Read'
  });
  const tokenResp = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: tokenBody
  });
  if (!tokenResp.ok) {
    const t = await tokenResp.text();
    return redirectTo(
      `${FAIL_REDIRECT}&reason=${encodeURIComponent('token_exchange_' + tokenResp.status + ':' + t.substring(0, 120))}`,
      { 'Set-Cookie': clearCookie }
    );
  }
  const tokens = await tokenResp.json();
  if (!tokens.refresh_token) {
    // Microsoft returns refresh_token only when offline_access was
    // consented. If it's missing, our scope was wrong or consent
    // was incomplete.
    return redirectTo(`${FAIL_REDIRECT}&reason=no_refresh_token`, { 'Set-Cookie': clearCookie });
  }

  // Sanity check the signed-in user matches the expected UPN.
  const meResp = await fetch('https://graph.microsoft.com/v1.0/me?$select=userPrincipalName,mail', {
    headers: { Authorization: 'Bearer ' + tokens.access_token }
  });
  if (!meResp.ok) {
    return redirectTo(`${FAIL_REDIRECT}&reason=me_lookup_failed`, { 'Set-Cookie': clearCookie });
  }
  const me = await meResp.json();
  const actualUpn = String(me.userPrincipalName || me.mail || '').toLowerCase();
  if (actualUpn !== expectedUpn) {
    return redirectTo(
      `${FAIL_REDIRECT}&reason=${encodeURIComponent('upn_mismatch_expected_' + expectedUpn + '_got_' + actualUpn)}`,
      { 'Set-Cookie': clearCookie }
    );
  }

  // Store the refresh_token for the autonomous flows.
  const expSec = Number(tokens.expires_in || 3600);
  await saveTokens(env, expectedUpn, {
    refresh_token: tokens.refresh_token,
    access_token: tokens.access_token,
    expires_at: new Date(Date.now() + expSec * 1000).toISOString(),
    scope: tokens.scope || 'offline_access Mail.Send User.Read'
  });

  return redirectTo(SUCCESS_REDIRECT, { 'Set-Cookie': clearCookie });
}
