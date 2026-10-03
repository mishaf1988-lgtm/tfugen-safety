// Signed "mark as handled" links for the hazard email (27/09, Michael: close a
// finding from the mail, without Mail.Read, which the tenant keeps behind
// admin consent).
//
// Token = <report id>.<expiry, unix seconds, base36>.<HMAC-SHA256>
// The key is TRUSTEE_NOTIFY_SECRET, the secret the DB trigger already sends,
// under a fixed prefix so a signature made here means nothing anywhere else.
// No secret configured = no token = the email simply has no close button.
// Rotating the secret voids every link already sent; that is accepted.

export const CLOSE_TTL_DAYS = 30;
const PREFIX = 'close-link:v1:';
const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;

function b64url(u8) {
  let s = '';
  for (let i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i]);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function sign(secret, msg, prefix) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return b64url(new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode((prefix || PREFIX) + msg))));
}

function sameString(a, b) {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

export async function makeCloseToken(env, id, nowMs) {
  return makeLinkToken(env, PREFIX, id, CLOSE_TTL_DAYS, nowMs);
}

// {id} when the token is ours and still valid, {error} otherwise.
export async function readCloseToken(env, tok, nowMs) {
  return readLinkToken(env, PREFIX, tok, nowMs);
}

// The same signed link for another purpose (03/10/2026: the weekly talk link,
// /api/talk). Each purpose has its own prefix, so a token signed for one is
// refused by every other.
export async function makeLinkToken(env, prefix, id, ttlDays, nowMs) {
  const secret = env && env.TRUSTEE_NOTIFY_SECRET;
  if (!secret || !ID_RE.test(String(id || ''))) return null;
  const exp = Math.floor((nowMs || Date.now()) / 1000) + ttlDays * 24 * 3600;
  const body = id + '.' + exp.toString(36);
  return body + '.' + (await sign(secret, body, prefix));
}

export async function readLinkToken(env, prefix, tok, nowMs) {
  const secret = env && env.TRUSTEE_NOTIFY_SECRET;
  if (!secret) return { error: 'not configured' };
  const parts = String(tok || '').split('.');
  if (parts.length !== 3 || !ID_RE.test(parts[0]) || !/^[0-9a-z]{1,10}$/.test(parts[1])) return { error: 'bad' };
  const want = await sign(secret, parts[0] + '.' + parts[1], prefix);
  if (!sameString(want, parts[2])) return { error: 'bad' };
  if (parseInt(parts[1], 36) * 1000 < (nowMs || Date.now())) return { error: 'expired' };
  return { id: parts[0] };
}

export function closeUrl(appUrl, tok) {
  return appUrl + '/api/close-hazard?k=' + encodeURIComponent(tok);
}
