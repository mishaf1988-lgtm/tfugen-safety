// Pop-ups on Michael's phone (24/10/2026): functions/_push.js, /api/chat?push=1, /chat-sw.js, wa_me.
// The payload is decrypted here the way the phone does it (RFC 8291), and the VAPID signature checked with the public key.
import { readFileSync } from 'node:fs';
import { VAPID_PUBLIC, pushEncrypt, vapidAuth, pushOwner, pushSubOk, pushPayload, unb64u, b64u, PUSH_KEY } from './_build/_push.mjs';
import { onRequest } from './_build/chat.mjs';
import { CHAT_SW } from '../../functions/chat-sw.js.js';

let pass = 0, fail = 0;
const check = (l, c, d) => { if (c) { pass++; console.log('  ✓ ' + l); } else { fail++; console.log('  ✗ ' + l + (d !== undefined ? '  -> ' + JSON.stringify(d).slice(0, 400) : '')); } };
const S = crypto.subtle, enc = new TextEncoder();
const cat = (...a) => { const o = new Uint8Array(a.reduce((n, x) => n + x.length, 0)); let i = 0; for (const x of a) { o.set(x, i); i += x.length; } return o; };
const hk = async (salt, ikm, info, bits) => new Uint8Array(await S.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info }, await S.importKey('raw', ikm, 'HKDF', false, ['deriveBits']), bits));

// a phone: its own key pair and auth secret
async function phone(endpoint) {
  const kp = await S.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const pub = new Uint8Array(await S.exportKey('raw', kp.publicKey)), auth = crypto.getRandomValues(new Uint8Array(16));
  return { kp, sub: { endpoint, keys: { p256dh: b64u(pub), auth: b64u(auth) } } };
}
async function decrypt(ph, body) {
  const salt = body.slice(0, 16), rs = new DataView(body.buffer, body.byteOffset).getUint32(16), idlen = body[20], asPub = body.slice(21, 21 + idlen), ct = body.slice(21 + idlen);
  const ua = unb64u(ph.sub.keys.p256dh), auth = unb64u(ph.sub.keys.auth);
  const shared = new Uint8Array(await S.deriveBits({ name: 'ECDH', public: await S.importKey('raw', asPub, { name: 'ECDH', namedCurve: 'P-256' }, false, []) }, ph.kp.privateKey, 256));
  const ikm = await hk(auth, shared, cat(enc.encode('WebPush: info\0'), ua, asPub), 256);
  const cek = await hk(salt, ikm, enc.encode('Content-Encoding: aes128gcm\0'), 128), nonce = await hk(salt, ikm, enc.encode('Content-Encoding: nonce\0'), 96);
  const pt = new Uint8Array(await S.decrypt({ name: 'AES-GCM', iv: nonce }, await S.importKey('raw', cek, 'AES-GCM', false, ['decrypt']), ct));
  return { rs, idlen, last: pt[pt.length - 1], text: new TextDecoder().decode(pt.slice(0, -1)) };
}

// a VAPID key pair for the test, its public half put in place of the real one's
const vk = await S.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
const vd = (await S.exportKey('jwk', vk.privateKey)).d, vpub = b64u(await S.exportKey('raw', vk.publicKey));

console.log('\n1. the payload, as the phone opens it');
const ph = await phone('https://push.test/a');
const msg = JSON.stringify(pushPayload('שלום מהעוזר'));
const d = await decrypt(ph, await pushEncrypt(ph.sub, enc.encode(msg)));
check('decrypted with the phone private key: the same text, one record (delimiter 2), rs 4096, key id 65', d.text === msg && d.last === 2 && d.rs === 4096 && d.idlen === 65, d);
check('pushPayload: title, body cut at 300, opens /chat', (() => { const p = pushPayload('x'.repeat(400)); return p.title && p.body.length === 300 && p.body.endsWith('...') && p.url === '/chat'; })());
check('pushSubOk: refuses http, a short key, a missing auth', pushSubOk(ph.sub) && !pushSubOk({ ...ph.sub, endpoint: 'http://x' }) && !pushSubOk({ endpoint: 'https://x', keys: { p256dh: 'AAAA', auth: ph.sub.keys.auth } }) && !pushSubOk({ endpoint: 'https://x', keys: { p256dh: ph.sub.keys.p256dh } }));

console.log('\n2. VAPID');
check('the public key is a P-256 point (65 bytes, 0x04)', unb64u(VAPID_PUBLIC).length === 65 && unb64u(VAPID_PUBLIC)[0] === 4);
let threw = false; try { await vapidAuth(vd, 'https://push.test/a'); } catch (e) { threw = true; }
check('a private key that is not the half of VAPID_PUBLIC is refused (the secret must match the code)', threw);
const realPrivPath = process.env.VAPID_PRIVATE_FILE;
if (realPrivPath) {
  const a = await vapidAuth(readFileSync(realPrivPath, 'utf8').trim(), 'https://web.push.apple.com/abc', 1000);
  const [, t, k] = a.match(/^vapid t=([^,]+), k=(.+)$/) || [];
  const [h, b, s] = t.split('.');
  const pubKey = await S.importKey('raw', unb64u(k), { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
  const ok = await S.verify({ name: 'ECDSA', hash: 'SHA-256' }, pubKey, unb64u(s), enc.encode(h + '.' + b));
  const claims = JSON.parse(new TextDecoder().decode(unb64u(b)));
  check('the real secret signs: verified with VAPID_PUBLIC, aud = the push service origin, exp 12h', ok && k === VAPID_PUBLIC && claims.aud === 'https://web.push.apple.com' && claims.exp === 1000 + 43200 && /^https:/.test(claims.sub), claims);
}

console.log('\n3. sending to every phone');
const SB = 'https://sb.test';
let calls = [], stored = [], sends = {};
globalThis.fetch = async (u, init) => {
  const url = String(u), m = (init && init.method) || 'GET';
  calls.push({ url, m, body: init && init.body, headers: init && init.headers });
  const json = (x, st = 200) => new Response(JSON.stringify(x), { status: st, headers: { 'Content-Type': 'application/json' } });
  if (url.startsWith(SB + '/auth/v1/user')) return json({ email: 'admin@tfugen.local' });
  if (url.startsWith(SB + '/rest/v1/app_users')) return json([{ role: 'admin', active: true }]);
  if (url.startsWith(SB + '/rest/v1/server_state') && m === 'GET') return json(stored.length ? [{ value: stored }] : []);
  if (url.startsWith(SB + '/rest/v1/server_state') && m === 'POST') { stored = JSON.parse(init.body)[0].value; return new Response('', { status: 201 }); }
  if (url.startsWith('https://push.test/')) return new Response('', { status: sends[url] || 201 });
  return json({ error: 'unexpected ' + url }, 599);
};
// the real public key is in the code, so for sending in tests the signature is only checked for shape
const ph2 = await phone('https://push.test/gone');
stored = [ph.sub, ph2.sub]; sends['https://push.test/gone'] = 410;
let r = await pushOwner({ SUPABASE_SERVICE_ROLE_KEY: 'k' }, SB, 'x');
check('no VAPID_PRIVATE: nothing read, nothing sent', r.skipped === true && calls.length === 0);
const ENV = { SUPABASE_URL: SB, SUPABASE_SERVICE_ROLE_KEY: 'k', VAPID_PRIVATE: vd, VAPID_PUBLIC: vpub, ALLOWED_ORIGINS: 'https://app.test' };
{
  calls = [];
  r = await pushOwner(ENV, SB, 'תשובה');
  const toA = calls.find((c) => c.url === 'https://push.test/a');
  check('both phones tried; the one the service calls gone (410) is dropped, the other kept', r.sent === 1 && stored.length === 1 && stored[0].endpoint === 'https://push.test/a', { r, stored });
  const [, t] = toA.headers.Authorization.match(/^vapid t=([^,]+), k=(.+)$/) || [];
  const [h, b, sg] = t.split('.');
  const vok = await S.verify({ name: 'ECDSA', hash: 'SHA-256' }, vk.publicKey, unb64u(sg), enc.encode(h + '.' + b));
  check('the request: aes128gcm, TTL, urgency high, and a VAPID token the push service can verify (aud = its origin)', toA.headers['Content-Encoding'] === 'aes128gcm' && toA.headers.TTL && toA.headers.Urgency === 'high' && vok && JSON.parse(new TextDecoder().decode(unb64u(b))).aud === 'https://push.test');
  check('and the phone can open it', (await decrypt(ph, new Uint8Array(toA.body))).text.indexOf('תשובה') > 0);
}

console.log('\n4. /api/chat?push=1');
const jwt = (aal) => 'h.' + Buffer.from(JSON.stringify({ aal })).toString('base64url') + '.s';
const req = (q, method, body) => new Request('https://app.test/api/chat' + q, { method, headers: { Authorization: 'Bearer ' + jwt('aal2'), 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
r = await onRequest({ request: req('?push=1', 'GET'), env: { ...ENV, VAPID_PUBLIC: undefined, VAPID_PRIVATE: 'x' } });
let j = await r.json();
check('GET: the public key and ready', j.ok && j.key === VAPID_PUBLIC && j.ready === true, j);
r = await onRequest({ request: req('?push=1', 'POST', { endpoint: 'http://bad' }), env: { ...ENV, VAPID_PRIVATE: 'x' } });
check('POST a bad subscription: 400', r.status === 400);
r = await onRequest({ request: req('?push=1', 'POST', ph.sub), env: { ...ENV, VAPID_PRIVATE: null } });
check('POST before the secret is set: says so, keeps nothing', (await r.json()).error === 'push not configured');
{
  stored = []; calls = [];
  const ph3 = await phone('https://push.test/new');
  r = await onRequest({ request: req('?push=1', 'POST', ph3.sub), env: ENV });
  j = await r.json();
  check('POST: the phone kept first, and a test pop-up sent to it at once', j.ok === true && j.test === 201 && stored[0].endpoint === 'https://push.test/new' && calls.some((c) => c.url === 'https://push.test/new'), j);
}

console.log('\n5. the service worker and the wiring');
check('the worker shows every push and opens /chat on a tap', /addEventListener\('push'/.test(CHAT_SW) && /showNotification/.test(CHAT_SW) && /notificationclick/.test(CHAT_SW) && /openWindow/.test(CHAT_SW));
const mw = readFileSync(new URL('../../functions/_middleware.js', import.meta.url), 'utf8');
check('/chat-sw.js is public (the browser fetches it without a login)', mw.includes("'/chat-sw.js'"));
const rdb = readFileSync(new URL('../../functions/api/routine-db.js', import.meta.url), 'utf8');
const wa = rdb.slice(rdb.indexOf("if (body.op === 'wa_me')"), rdb.indexOf("if (body.op === 'wa_review')"));
check('wa_me sends the pop-up whatever WhatsApp answered, and logs how many went', /pushOwner\(env, url, body\.text\)/.test(wa) && /push: ps\.sent/.test(wa) && wa.indexOf('pushOwner') < wa.indexOf('notifications_log'));
console.log(`\npush-test: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
