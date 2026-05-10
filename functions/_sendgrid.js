// Shared SendGrid helper for autonomous server-side mail.
//
// Until 2026-05-10 we tried Microsoft Graph (first CLIENT_CREDENTIALS,
// then Delegated + refresh_token) but the tapugan.co.il tenant blocks
// admin consent (KakadoTech-controlled) AND blocks user consent for
// new scopes like offline_access. Both Microsoft paths are walled off
// without involving the tenant admin.
//
// SendGrid Single Sender Verification gives us a clean exit: sviva
// verifies sviva@tapugan.co.il by clicking a link in her own Outlook
// inbox (no DNS, no domain ownership, no admin). Mail then sends from
// her address through SendGrid's infrastructure.
//
// Env vars expected:
//   SENDGRID_API_KEY  full-access on Mail Send only (Encrypted)
//   MAIL_FROM         the verified sender (default: sviva@tapugan.co.il)

const SENDGRID_URL = 'https://api.sendgrid.com/v3/mail/send';
const FROM_NAME = 'Tapugan Safety';

// Send a mail via SendGrid. Signature kept compatible with the previous
// sendMailAsApp(env, { from, to, subject, html }) — `from` is ignored
// (SendGrid only allows the verified sender), but accepted for backward
// compat with existing call sites.
export async function sendMailAsApp(env, { from, to, subject, html }) {
  if (!to) throw new Error('to required');
  const apiKey = env.SENDGRID_API_KEY;
  if (!apiKey) throw new Error('SendGrid not configured (missing SENDGRID_API_KEY)');
  const sender = env.MAIL_FROM || 'sviva@tapugan.co.il';

  const recipients = (Array.isArray(to) ? to : [to])
    .filter(addr => addr && String(addr).trim())
    .map(addr => ({ email: String(addr).trim() }));
  if (recipients.length === 0) throw new Error('no valid recipients');

  const payload = {
    personalizations: [{ to: recipients }],
    from: { email: sender, name: FROM_NAME },
    subject: String(subject || 'Tapugan Safety').substring(0, 240),
    content: [{ type: 'text/html', value: String(html || '') }]
  };

  const r = await fetch(SENDGRID_URL, {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + apiKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });
  if (r.status === 202) return { ok: true };
  const t = await r.text();
  throw new Error(`SendGrid ${r.status}: ${t.substring(0, 240)}`);
}
