// Web Push to Michael's phone (24/10/2026, Michael: "will I get pop-up messages like WhatsApp even when I am not
// connected?"; in the questionnaire: "do it: build notifications"). Every assistant message (wa_me) also goes to the
// phones that turned notifications on in /chat, whether WhatsApp delivered it or not, so Meta's block does not matter.
// No library: VAPID (RFC 8292) and the aes128gcm payload (RFC 8291) with WebCrypto, as Cloudflare runs it.
// The key pair (25/10/2026, Michael: "handle the notifications in the new assistant"): the server makes it itself
// the first time it is needed and keeps it in server_state (no grant to anon or authenticated, RLS with no policy:
// only the service key reads it), so nobody pastes a secret and none passes through a chat. The public half goes to
// the page to subscribe. env.VAPID_PRIVATE with env.VAPID_PUBLIC replace it (the tests use their own pair).
import { tmo, SB_TIMEOUT_MS } from './_shared.js';
import { SITE } from './_site.js';

export const VAPID_KEY = 'vapid_keys';
async function readKeys(env, sbUrl) {
  const r = await fetch(sbUrl + '/rest/v1/server_state?key=eq.' + VAPID_KEY + '&select=value', { headers: sbH(env), signal: tmo(SB_TIMEOUT_MS) }).catch(() => null);
  if (!r || !r.ok) return null;
  const rows = await r.json().catch(() => []);
  let v = rows && rows[0] ? rows[0].value : null;
  if (typeof v === 'string') { try { v = JSON.parse(v); } catch (e) { v = null; } }
  return v && v.d && v.pub ? { d: String(v.d), pub: String(v.pub) } : null;
}
export async function vapidKeys(env, sbUrl) {
  if (env && env.VAPID_PRIVATE && env.VAPID_PUBLIC) return { d: env.VAPID_PRIVATE, pub: env.VAPID_PUBLIC };
  if (!env || !env.SUPABASE_SERVICE_ROLE_KEY) return null;
  const have = await readKeys(env, sbUrl);
  if (have) return have;
  const kp = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign']);
  const d = (await crypto.subtle.exportKey('jwk', kp.privateKey)).d, pub = b64u(await crypto.subtle.exportKey('raw', kp.publicKey));
  // two first calls at once: the first row stays (ignore-duplicates), and both read it back
  await fetch(sbUrl + '/rest/v1/server_state?on_conflict=key', { method: 'POST', signal: tmo(SB_TIMEOUT_MS),
    headers: { ...sbH(env), Prefer: 'resolution=ignore-duplicates,return=minimal' },
    body: JSON.stringify([{ key: VAPID_KEY, value: { d, pub, at: new Date().toISOString() }, updated_at: new Date().toISOString() }]) }).catch(() => null);
  return readKeys(env, sbUrl);
}
export const PUSH_KEY = 'chat_push_subs';
export const PUSH_MAX_SUBS = 5;
const PUSH_MS = 10000;

const enc = new TextEncoder();
export const b64u = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
export const unb64u = (s) => { const t = String(s || '').replace(/-/g, '+').replace(/_/g, '/'); return Uint8Array.from(atob(t + '==='.slice((t.length + 3) % 4)), (c) => c.charCodeAt(0)); };
const cat = (...a) => { const o = new Uint8Array(a.reduce((n, x) => n + x.length, 0)); let i = 0; for (const x of a) { o.set(x, i); i += x.length; } return o; };

// A subscription as the browser gives it: an https endpoint and two keys of the right length.
export function pushSubOk(s) {
  try {
    if (!s || !/^https:\/\/[^\s]+$/.test(String(s.endpoint || '')) || String(s.endpoint).length > 1000) return false;
    return unb64u(s.keys && s.keys.p256dh).length === 65 && unb64u(s.keys && s.keys.auth).length === 16;
  } catch (e) { return false; }
}

export async function vapidAuth(privD, endpoint, nowSec, pubB64) {
  const pk = String(pubB64 || ''), pub = unb64u(pk);
  const key = await crypto.subtle.importKey('jwk', { kty: 'EC', crv: 'P-256', d: privD, x: b64u(pub.slice(1, 33)), y: b64u(pub.slice(33, 65)), ext: true },
    { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const head = b64u(enc.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const body = b64u(enc.encode(JSON.stringify({ aud: new URL(endpoint).origin, exp: (nowSec || Math.floor(Date.now() / 1000)) + 12 * 3600, sub: SITE.appUrl })));
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, enc.encode(head + '.' + body));
  return 'vapid t=' + head + '.' + body + '.' + b64u(sig) + ', k=' + pk;
}

async function hkdf(salt, ikm, info, bits) {
  const k = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info }, k, bits));
}
// RFC 8291: one record, aes128gcm. The phone holds the private half of p256dh and the auth secret.
export async function pushEncrypt(sub, plain) {
  const ua = unb64u(sub.keys.p256dh), auth = unb64u(sub.keys.auth);
  const eph = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const asPub = new Uint8Array(await crypto.subtle.exportKey('raw', eph.publicKey));
  const uaKey = await crypto.subtle.importKey('raw', ua, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const shared = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: uaKey }, eph.privateKey, 256));
  const ikm = await hkdf(auth, shared, cat(enc.encode('WebPush: info\0'), ua, asPub), 256);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const cek = await hkdf(salt, ikm, enc.encode('Content-Encoding: aes128gcm\0'), 128);
  const nonce = await hkdf(salt, ikm, enc.encode('Content-Encoding: nonce\0'), 96);
  const aes = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, aes, cat(plain, new Uint8Array([2]))));
  return cat(salt, new Uint8Array([0, 0, 16, 0]), new Uint8Array([65]), asPub, ct);
}

// What the phone shows: the start of the message (a push payload is at most about 4KB; the chat has the rest).
export function pushPayload(text) {
  const t = String(text || '').replace(/\s+/g, ' ').trim();
  return { title: '\u05e2\u05d5\u05d6\u05e8 \u05de\u05e4\u05e2\u05dc', body: t.length > 300 ? t.slice(0, 297) + '...' : t, url: '/chat', tag: 'chat' };
}

export async function sendPush(env, sub, obj, keys) {
  try {
    const body = await pushEncrypt(sub, enc.encode(JSON.stringify(obj)));
    const r = await fetch(sub.endpoint, { method: 'POST', signal: tmo(PUSH_MS), body,
      headers: { Authorization: await vapidAuth(keys.d, sub.endpoint, 0, keys.pub), TTL: '86400', Urgency: 'high',
        'Content-Encoding': 'aes128gcm', 'Content-Type': 'application/octet-stream' } });
    return r.status;
  } catch (e) { return 'network'; }
}

const sbH = (env) => ({ apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: 'Bearer ' + env.SUPABASE_SERVICE_ROLE_KEY, 'Content-Type': 'application/json' });
export async function pushSubs(env, sbUrl) {
  const r = await fetch(sbUrl + '/rest/v1/server_state?key=eq.' + PUSH_KEY + '&select=value', { headers: sbH(env), signal: tmo(SB_TIMEOUT_MS) }).catch(() => null);
  if (!r || !r.ok) return null;
  const rows = await r.json().catch(() => []);
  // server_state.value is text: the list comes back as a JSON string (25/10/2026, lesson 158)
  let v = rows && rows[0] ? rows[0].value : null;
  if (typeof v === 'string') { try { v = JSON.parse(v); } catch (e) { v = null; } }
  return Array.isArray(v) ? v.filter(pushSubOk) : [];
}
async function putSubs(env, sbUrl, subs) {
  await fetch(sbUrl + '/rest/v1/server_state?on_conflict=key', { method: 'POST', signal: tmo(SB_TIMEOUT_MS),
    headers: { ...sbH(env), Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify([{ key: PUSH_KEY, value: subs, updated_at: new Date().toISOString() }]) }).catch(() => null);
}
// The newest phone first; the same endpoint again replaces itself; at most PUSH_MAX_SUBS.
export async function pushSave(env, sbUrl, sub) {
  const cur = await pushSubs(env, sbUrl);
  if (cur === null) return false;
  const one = { endpoint: sub.endpoint, keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth }, at: new Date().toISOString() };
  await putSubs(env, sbUrl, [one].concat(cur.filter((s) => s.endpoint !== sub.endpoint)).slice(0, PUSH_MAX_SUBS));
  return true;
}
// Every phone; one the push service says is gone (404, 410) is dropped. Never throws: a push is extra.
export async function pushOwner(env, sbUrl, text) {
  if (!env.SUPABASE_SERVICE_ROLE_KEY || !String(text || '').trim()) return { sent: 0, skipped: true };
  try {
    const subs = await pushSubs(env, sbUrl);
    if (!subs || !subs.length) return { sent: 0 };
    const keys = await vapidKeys(env, sbUrl);
    if (!keys) return { sent: 0, skipped: true };
    const obj = pushPayload(text), st = await Promise.all(subs.map((s) => sendPush(env, s, obj, keys)));
    const gone = subs.filter((s, i) => st[i] === 404 || st[i] === 410);
    if (gone.length) await putSubs(env, sbUrl, subs.filter((s) => gone.indexOf(s) < 0));
    return { sent: st.filter((x) => x === 201 || x === 200).length, statuses: st };
  } catch (e) { return { sent: 0, error: String(e && e.message || e).slice(0, 120) }; }
}
