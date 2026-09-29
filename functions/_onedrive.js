// Server-side OneDrive access (Michael, 2026-09-27: "do it through the server").
//
// Why a separate Azure app: the in-browser OneDrive link is an SPA public
// client, whose refresh tokens live 24h and are bound to the browser
// (DECISIONS 2026-09-21). A server needs a confidential client: its own app
// registration with a client secret. Refresh tokens issued to it last 90 days
// and roll forward every time they are used, so a log that is written a few
// times a week never expires.
//
// Delegated, not application permissions: the tenant admin was unreachable in
// May (migrations/2026-05-10_oauth_tokens.sql), and delegated Files.ReadWrite
// only reaches the signed-in user's own OneDrive, not every mailbox in the
// company. sviva signs in once through /api/ms-auth; the refresh token lands in
// public.oauth_tokens (service-role only, no RLS policies) and never leaves
// the server.
//
// Env (Cloudflare Pages): ONEDRIVE_CLIENT_ID, ONEDRIVE_CLIENT_SECRET,
// ONEDRIVE_TENANT_ID (optional, default "common"), SUPABASE_SERVICE_ROLE_KEY.
// New names on purpose: AZURE_* may still hold the values of the flow that was
// deleted on 2026-05-10.

export const PROVIDER = 'onedrive_server';
// What a NEW sign-in asks for. Mail.Send added 2026-09-27 (Michael: trustee
// alerts to the organisational mailbox; Resend without a verified domain only
// delivers to its own account address).
// Mail.Read is NOT asked (2026-09-27): the Tapugan tenant requires admin
// consent for it, and asking would turn every new sign-in into "admin approval
// required", taking the OneDrive log and the alert mails down with it.
// mail-inbox.js stays dormant until an admin grants it (DECISIONS 2026-09-27).
export const SCOPES = 'offline_access User.Read Files.ReadWrite Mail.Send';
// A refresh must ask only for what was actually granted, never for SCOPES:
// asking a refresh for a scope nobody consented to fails the refresh, and with
// it the OneDrive log. So it asks for the scopes stored with the token.
const BASE_SCOPES = 'offline_access User.Read Files.ReadWrite';
export function refreshScopes(granted) {
  const g = String(granted || '').split(/\s+/).filter((x) => x && !/^(openid|profile|email)$/i.test(x));
  if (!g.length) return BASE_SCOPES;
  if (g.indexOf('offline_access') < 0) g.unshift('offline_access');
  return g.join(' ');
}
export function hasMailRead(row) { return !!(row && /(^|\s)Mail\.Read(\s|$)/i.test(String(row.scope || ''))); }
export function hasMail(row) { return !!(row && /(^|\s)Mail\.Send(\s|$)/i.test(String(row.scope || ''))); }
const SB_DEFAULT = 'https://znhjtpcltrxxyfjczgvw.supabase.co';

export function odConfigured(env) {
  return !!(env.ONEDRIVE_CLIENT_ID && env.ONEDRIVE_CLIENT_SECRET && env.SUPABASE_SERVICE_ROLE_KEY);
}
export function tokenUrl(env) {
  return 'https://login.microsoftonline.com/' + encodeURIComponent(env.ONEDRIVE_TENANT_ID || 'common') + '/oauth2/v2.0/token';
}
export function authorizeUrl(env) {
  return 'https://login.microsoftonline.com/' + encodeURIComponent(env.ONEDRIVE_TENANT_ID || 'common') + '/oauth2/v2.0/authorize';
}

function sb(env) {
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  const url = env.SUPABASE_URL || SB_DEFAULT;
  return {
    url,
    h: { apikey: key, Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' },
  };
}

// ---- small key/value store: public.server_state (service-role only) ----
export async function stateGet(env, keys) {
  const s = sb(env);
  const r = await fetch(s.url + '/rest/v1/server_state?select=key,value,updated_at&key=in.(' + keys.map(encodeURIComponent).join(',') + ')', { headers: s.h });
  if (!r.ok) return {};
  const rows = await r.json();
  const out = {};
  (Array.isArray(rows) ? rows : []).forEach((x) => { out[x.key] = { value: x.value, at: x.updated_at }; });
  return out;
}
export async function stateSet(env, obj) {
  const s = sb(env);
  const now = new Date().toISOString();
  const rows = Object.keys(obj).map((k) => ({ key: k, value: obj[k] === null ? null : String(obj[k]), updated_at: now }));
  await fetch(s.url + '/rest/v1/server_state?on_conflict=key', {
    method: 'POST',
    headers: { ...s.h, Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify(rows),
  });
}

// A lease in server_state, so two runs never write the same file at once
// (29/09: five closures in three minutes started five runs; one that read
// the table before the last closures finished after the others, and its copy
// of the file read as "reopened in Excel" on the next run). Value = the ISO
// time it was taken; a lease older than leaseMs is free (a crashed run).
// Returns the token, null when held, or 'open' when the lock itself cannot be
// used (then the run goes ahead, as before this lock).
export async function stateLock(env, key, leaseMs) {
  const s = sb(env);
  const now = Date.now(), iso = new Date(now).toISOString(), cutoff = new Date(now - leaseMs).toISOString();
  try {
    await fetch(s.url + '/rest/v1/server_state?on_conflict=key', { method: 'POST', headers: { ...s.h, Prefer: 'resolution=ignore-duplicates,return=minimal' }, body: JSON.stringify([{ key, value: '', updated_at: iso }]) });
    const r = await fetch(s.url + '/rest/v1/server_state?key=eq.' + encodeURIComponent(key) + '&or=' + encodeURIComponent('(value.is.null,value.eq."",value.lt."' + cutoff + '")'),
      { method: 'PATCH', headers: { ...s.h, Prefer: 'return=representation' }, body: JSON.stringify({ value: iso, updated_at: iso }) });
    if (!r.ok) return 'open';
    const rows = await r.json();
    return Array.isArray(rows) && rows.length ? iso : null;
  } catch (e) { return 'open'; }
}
export async function stateUnlock(env, key, token) {
  if (!token || token === 'open') return;
  const s = sb(env);
  await fetch(s.url + '/rest/v1/server_state?key=eq.' + encodeURIComponent(key) + '&value=eq.' + encodeURIComponent(token),
    { method: 'PATCH', headers: { ...s.h, Prefer: 'return=minimal' }, body: JSON.stringify({ value: '', updated_at: new Date().toISOString() }) }).catch(() => {});
}

// One run of fn per name at a time. A run that finds it busy leaves a mark
// and returns {busy}; the holder goes again when it sees a mark newer than its
// own start, so the last change is never left out (the 15-minute cron is the
// backstop if that run dies).
export async function runLeased(env, name, leaseMs, fn, depth) {
  const lk = name + '_lock', dk = name + '_dirty';
  const tok = await stateLock(env, lk, leaseMs);
  if (!tok) { await stateSet(env, { [dk]: new Date().toISOString() }).catch(() => {}); return { busy: true }; }
  let r, start, rounds = 0;
  const marked = async () => { const st = await stateGet(env, [dk]).catch(() => ({})); const d = st[dk] && st[dk].value; return !!d && d >= start; };
  try {
    do { start = new Date().toISOString(); r = await fn(); } while (++rounds < 3 && await marked());
  } finally { await stateUnlock(env, lk, tok); }
  // A mark left between the last check and the unlock: once more.
  if (tok !== 'open' && !depth && rounds < 3 && await marked()) return runLeased(env, name, leaseMs, fn, 1);
  return r;
}

// ---- token store: public.oauth_tokens ----
export async function tokenRow(env) {
  const s = sb(env);
  const r = await fetch(s.url + '/rest/v1/oauth_tokens?provider=eq.' + PROVIDER + '&select=user_email,refresh_token,access_token,expires_at,scope,updated_at&order=updated_at.desc&limit=1', { headers: s.h });
  if (!r.ok) throw new Error('token store read failed (' + r.status + ')');
  const rows = await r.json();
  return Array.isArray(rows) && rows[0] ? rows[0] : null;
}
export async function saveTokens(env, email, t) {
  const s = sb(env);
  const row = {
    provider: PROVIDER,
    user_email: String(email || '').toLowerCase(),
    refresh_token: t.refresh_token,
    access_token: t.access_token || null,
    expires_at: t.expires_in ? new Date(Date.now() + (t.expires_in - 60) * 1000).toISOString() : null,
    scope: t.scope || null,
    updated_at: new Date().toISOString(),
  };
  // One connected account at a time: a new sign-in replaces the old one.
  await fetch(s.url + '/rest/v1/oauth_tokens?provider=eq.' + PROVIDER + '&user_email=neq.' + encodeURIComponent(row.user_email), { method: 'DELETE', headers: s.h });
  const r = await fetch(s.url + '/rest/v1/oauth_tokens?on_conflict=provider,user_email', {
    method: 'POST',
    headers: { ...s.h, Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify(row),
  });
  if (!r.ok) throw new Error('token store write failed (' + r.status + ')');
}

async function tokenCall(env, params) {
  const body = new URLSearchParams({
    client_id: env.ONEDRIVE_CLIENT_ID,
    client_secret: env.ONEDRIVE_CLIENT_SECRET,
    scope: SCOPES,
    ...params,
  });
  const r = await fetch(tokenUrl(env), { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.access_token) {
    const why = (j && (j.error_description || j.error)) || ('HTTP ' + r.status);
    const e = new Error('microsoft token: ' + String(why).split('\r')[0].substring(0, 160));
    e.code = j && j.error;
    throw e;
  }
  return j;
}
export function exchangeCode(env, code, redirectUri) {
  return tokenCall(env, { grant_type: 'authorization_code', code, redirect_uri: redirectUri });
}

// A valid access token for the connected account, refreshing when needed.
// Throws with .code === 'not_connected' when nobody has signed in yet.
export async function accessToken(env) {
  const row = await tokenRow(env);
  if (!row || !row.refresh_token) { const e = new Error('not connected'); e.code = 'not_connected'; throw e; }
  if (row.access_token && row.expires_at && Date.parse(row.expires_at) > Date.now() + 60000) {
    return { token: row.access_token, email: row.user_email, scope: row.scope || '' };
  }
  const t = await tokenCall(env, { grant_type: 'refresh_token', refresh_token: row.refresh_token, scope: refreshScopes(row.scope) });
  // Microsoft rotates the refresh token; keep the new one, or the old one if none came back.
  await saveTokens(env, row.user_email, { ...t, refresh_token: t.refresh_token || row.refresh_token, scope: t.scope || row.scope });
  return { token: t.access_token, email: row.user_email, scope: t.scope || row.scope || '' };
}

// PUT a file by path under the user's OneDrive root. Replaces an existing
// file of the same name. `folder` segments are encoded one by one so the
// slashes stay separators.
export async function putFile(token, folder, name, bytes, type) {
  const seg = String(folder || '').split('/').filter(Boolean).map(encodeURIComponent).join('/');
  const url = 'https://graph.microsoft.com/v1.0/me/drive/root:/' + seg + '/' + encodeURIComponent(name) + ':/content';
  const r = await fetch(url, { method: 'PUT', headers: { Authorization: 'Bearer ' + token, 'Content-Type': type || 'application/octet-stream' }, body: bytes });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) {
    const msg = (j && j.error && (j.error.message || j.error.code)) || '';
    const e = new Error('onedrive ' + r.status + (msg ? ': ' + String(msg).substring(0, 160) : ''));
    e.status = r.status;
    throw e;
  }
  return { webUrl: j.webUrl || null, size: j.size || null };
}

// webUrl of a folder (or file) by path; null when it is not there.
export async function itemUrl(token, path) {
  const seg = String(path || '').split('/').filter(Boolean).map(encodeURIComponent).join('/');
  const r = await fetch('https://graph.microsoft.com/v1.0/me/drive/root:/' + seg + '?select=webUrl', { headers: { Authorization: 'Bearer ' + token } });
  if (!r.ok) return null;
  const j = await r.json().catch(() => ({}));
  return j.webUrl || null;
}

// Several recipients and copies, kept in Sent Items (the department report,
// 28/09: it replaces the workbook macro, which sent from Outlook).
// attachments (optional): Graph fileAttachment objects, e.g. inline pictures
// (isInline + contentId, shown where the html says cid:<contentId>).
export async function sendMailTo(token, to, cc, subject, html, attachments) {
  const list = (a) => (a || []).map((x) => ({ emailAddress: { address: x } }));
  const r = await fetch('https://graph.microsoft.com/v1.0/me/sendMail', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: Object.assign({ subject: String(subject || '').substring(0, 240), body: { contentType: 'HTML', content: html }, toRecipients: list(to), ccRecipients: list(cc) }, attachments && attachments.length ? { attachments } : {}),
      saveToSentItems: true,
    }),
  });
  if (r.status === 202 || r.ok) return true;
  const j = await r.json().catch(() => ({}));
  const msg = (j && j.error && (j.error.message || j.error.code)) || '';
  throw new Error('outlook ' + r.status + (msg ? ': ' + String(msg).substring(0, 140) : ''));
}

// Send an HTML mail as the connected account (Graph /me/sendMail, 202 on success).
export async function sendMail(token, to, subject, html) {
  const r = await fetch('https://graph.microsoft.com/v1.0/me/sendMail', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: { subject: String(subject || '').substring(0, 240), body: { contentType: 'HTML', content: html }, toRecipients: [{ emailAddress: { address: to } }] },
      saveToSentItems: false,
    }),
  });
  if (r.status === 202 || r.ok) return true;
  const j = await r.json().catch(() => ({}));
  const msg = (j && j.error && (j.error.message || j.error.code)) || '';
  throw new Error('outlook ' + r.status + (msg ? ': ' + String(msg).substring(0, 140) : ''));
}
