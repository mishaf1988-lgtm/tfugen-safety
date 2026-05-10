// Shared Microsoft Graph application-token helper for server-side flows.
//
// The client-side OAuth flow (MSAL in the browser) gives us a delegated
// token that's only valid while the admin (sviva) is signed in. For
// fully autonomous flows — like a user clicking "forgot password" while
// no admin is around — we need an APPLICATION token instead, acquired
// via the OAuth client_credentials grant.
//
// This requires the Azure App registration to have:
//   - "Mail.Send" granted as an APPLICATION permission (not Delegated)
//   - Admin consent for that permission
//   - A Client Secret created and stored in env.AZURE_CLIENT_SECRET
//
// See project-files/COWORKER-AZURE-SETUP.md for the one-time setup.
//
// Env vars expected:
//   AZURE_TENANT_ID      e.g. "tapugan.co.il" or the GUID
//   AZURE_CLIENT_ID      same as the existing MSAL client id
//   AZURE_CLIENT_SECRET  the secret created in Azure (encrypted)

const TOKEN_CACHE = { token: null, exp: 0 };

export async function getMsAppToken(env) {
  const now = Date.now();
  // Reuse cached token until 60s before its real expiry — gives plenty of
  // margin for clock skew and the call we're about to make.
  if (TOKEN_CACHE.token && TOKEN_CACHE.exp > now + 60_000) {
    return TOKEN_CACHE.token;
  }

  const tenant = env.AZURE_TENANT_ID;
  const clientId = env.AZURE_CLIENT_ID;
  const clientSecret = env.AZURE_CLIENT_SECRET;
  if (!tenant || !clientId || !clientSecret) {
    throw new Error('Microsoft Graph not configured (missing AZURE_TENANT_ID / AZURE_CLIENT_ID / AZURE_CLIENT_SECRET)');
  }

  const url = `https://login.microsoftonline.com/${encodeURIComponent(tenant)}/oauth2/v2.0/token`;
  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: clientId,
    client_secret: clientSecret,
    scope: 'https://graph.microsoft.com/.default'
  });

  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body
  });
  if (!r.ok) {
    const t = await r.text();
    throw new Error(`AAD token ${r.status}: ${t.substring(0, 240)}`);
  }
  const j = await r.json();
  if (!j.access_token) throw new Error('AAD response missing access_token');
  // expires_in is seconds. Cache the token until 60s before expiry.
  TOKEN_CACHE.token = j.access_token;
  TOKEN_CACHE.exp = now + (Number(j.expires_in || 3600) * 1000);
  return j.access_token;
}

// Send a mail message from a fixed sender via Microsoft Graph.
// `from` is the UPN (e.g. "sviva@tapugan.co.il") of the mailbox we send
// from. With Application permissions we can send as ANY user in the
// tenant — so this UPN must be a real licensed mailbox we control.
//
// `to` is a single email or an array of emails.
export async function sendMailAsApp(env, { from, to, subject, html }) {
  if (!from) throw new Error('from required');
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
  const r = await fetch(
    `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(from)}/sendMail`,
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
