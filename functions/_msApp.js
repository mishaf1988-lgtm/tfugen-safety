// Shared Microsoft Graph helper for server-side mail.
//
// Until 2026-05-10 this used CLIENT_CREDENTIALS (Mail.Send Application
// permission). Pivoted to Delegated + refresh_token because the tenant
// admin couldn't grant Application permission within the time window.
//
// Flow: an admin (sviva) signs in once via /api/auth/microsoft-start,
// which stores a refresh_token in public.oauth_tokens. From then on
// this module exchanges the refresh_token for a short-lived access
// token on every send and rolls the refresh_token forward. Microsoft
// extends the refresh_token's life with each use — as long as the
// system is used at all, it never expires.
//
// Env vars expected:
//   AZURE_TENANT_ID            "tapugan.co.il" or the GUID
//   AZURE_CLIENT_ID            same as the existing MSAL client id
//   AZURE_CLIENT_SECRET        confidential-client secret (Encrypted)
//   AZURE_REDIRECT_URI         must match what's registered in Azure
//   MAIL_FROM_USER             UPN we send from (and that consented)
//   SUPABASE_SERVICE_ROLE_KEY  to read/write oauth_tokens

const SUPABASE_URL = 'https://znhjtpcltrxxyfjczgvw.supabase.co';
const TOKEN_PROVIDER = 'microsoft';

// Per-isolate cache. Microsoft access tokens are valid ~60 min, so this
// avoids hitting the token endpoint on every send within the same isolate.
const TOKEN_CACHE = { token: null, exp: 0 };

async function loadStoredTokens(env, userEmail) {
  const r = await fetch(
    `${SUPABASE_URL}/rest/v1/oauth_tokens?provider=eq.${TOKEN_PROVIDER}&user_email=eq.${encodeURIComponent(userEmail)}&limit=1`,
    {
      headers: {
        apikey: env.SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`
      }
    }
  );
  if (!r.ok) {
    const t = await r.text();
    throw new Error(`oauth_tokens read ${r.status}: ${t.substring(0, 200)}`);
  }
  const rows = await r.json();
  return (rows && rows[0]) || null;
}

export async function saveTokens(env, userEmail, { refresh_token, access_token, expires_at, scope }) {
  const body = {
    provider: TOKEN_PROVIDER,
    user_email: userEmail,
    refresh_token,
    access_token: access_token || null,
    expires_at: expires_at || null,
    scope: scope || null,
    updated_at: new Date().toISOString()
  };
  const r = await fetch(
    `${SUPABASE_URL}/rest/v1/oauth_tokens?on_conflict=provider,user_email`,
    {
      method: 'POST',
      headers: {
        apikey: env.SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates,return=minimal'
      },
      body: JSON.stringify(body)
    }
  );
  if (!r.ok) {
    const t = await r.text();
    throw new Error(`oauth_tokens upsert ${r.status}: ${t.substring(0, 200)}`);
  }
}

async function refreshAccessToken(env, stored, userEmail) {
  const tenant = env.AZURE_TENANT_ID;
  const clientId = env.AZURE_CLIENT_ID;
  const clientSecret = env.AZURE_CLIENT_SECRET;
  if (!tenant || !clientId || !clientSecret) {
    throw new Error('Microsoft Graph not configured (missing AZURE_TENANT_ID / AZURE_CLIENT_ID / AZURE_CLIENT_SECRET)');
  }

  const url = `https://login.microsoftonline.com/${encodeURIComponent(tenant)}/oauth2/v2.0/token`;
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: stored.refresh_token,
    scope: 'offline_access Mail.Send User.Read'
  });
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body
  });
  if (!r.ok) {
    const t = await r.text();
    throw new Error(`AAD refresh ${r.status}: ${t.substring(0, 240)}`);
  }
  const j = await r.json();
  if (!j.access_token) throw new Error('AAD response missing access_token');

  const now = Date.now();
  const expSec = Number(j.expires_in || 3600);
  // Microsoft rolls the refresh_token. Persist whichever we got back —
  // fall back to the previous one if absent (rare for confidential clients).
  await saveTokens(env, userEmail, {
    refresh_token: j.refresh_token || stored.refresh_token,
    access_token: j.access_token,
    expires_at: new Date(now + expSec * 1000).toISOString(),
    scope: j.scope || stored.scope
  });
  TOKEN_CACHE.token = j.access_token;
  TOKEN_CACHE.exp = now + expSec * 1000;
  return j.access_token;
}

// Backward-compatible name kept for existing call sites
// (self-recovery.js, send-credentials.js). Internally now uses
// the delegated refresh_token flow.
export async function getMsAppToken(env) {
  const userEmail = env.MAIL_FROM_USER || 'sviva@tapugan.co.il';
  const now = Date.now();
  if (TOKEN_CACHE.token && TOKEN_CACHE.exp > now + 60_000) {
    return TOKEN_CACHE.token;
  }
  const stored = await loadStoredTokens(env, userEmail);
  if (!stored) {
    throw new Error('Microsoft not connected — admin must complete one-time sign-in via /api/auth/microsoft-start');
  }
  return refreshAccessToken(env, stored, userEmail);
}

// Send a mail message from the configured sender via Microsoft Graph.
// Under delegated flow, the sender is fixed to MAIL_FROM_USER (the
// user whose refresh_token we hold). The `from` argument is accepted
// for backward compat but ignored — we always send as MAIL_FROM_USER.
export async function sendMailAsApp(env, { from, to, subject, html }) {
  if (!to) throw new Error('to required');
  const token = await getMsAppToken(env);
  const recipients = (Array.isArray(to) ? to : [to])
    .map(addr => ({ emailAddress: { address: String(addr).trim() } }));
  const payload = {
    message: {
      subject: String(subject || 'Tapugan Safety').substring(0, 240),
      body: { contentType: 'HTML', content: String(html || '') },
      toRecipients: recipients
    },
    saveToSentItems: 'true'
  };
  // /me/sendMail under a delegated token sends as the signed-in user.
  const r = await fetch(
    'https://graph.microsoft.com/v1.0/me/sendMail',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    }
  );
  if (r.status === 202) return { ok: true };
  const t = await r.text();
  throw new Error(`Graph sendMail ${r.status}: ${t.substring(0, 240)}`);
}
