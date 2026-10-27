// Pop-ups on Michael's phone (24/10/2026): functions/_push.js, /api/chat?push=1, /chat-sw.js, wa_me.
// The payload is decrypted here the way the phone does it (RFC 8291), and the VAPID signature checked with the public key.
import { readFileSync } from 'node:fs';
import { vapidKeys, VAPID_KEY, pushEncrypt, vapidAuth, pushOwner, pushSubOk, pushPayload, unb64u, b64u, PUSH_KEY, PUSH_LAST, PUSH_OK_AT, PUSH_GONE } from './_build/_push.mjs';
import { chatOnly, OWNER_MODE_KEY } from './_build/_wa.mjs';
import { onRequest } from './_build/chat.mjs';
import { sendToOwner } from './_build/_wa.mjs';
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
const other = b64u(await S.exportKey('raw', (await S.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign'])).publicKey));
let threw = false; try { await vapidAuth(vd, 'https://push.test/a', 0, other); } catch (e) { threw = true; }
check('a private key with a public key that is not its half is refused', threw);
{
  const a = await vapidAuth(vd, 'https://web.push.apple.com/abc', 1000, vpub);
  const [, t, k] = a.match(/^vapid t=([^,]+), k=(.+)$/) || [];
  const [h, b, sg] = t.split('.');
  const ok = await S.verify({ name: 'ECDSA', hash: 'SHA-256' }, vk.publicKey, unb64u(sg), enc.encode(h + '.' + b));
  const claims = JSON.parse(new TextDecoder().decode(unb64u(b)));
  check('the token: signed with the pair, k = the public half, aud = the push service origin, exp 12h', ok && k === vpub && claims.aud === 'https://web.push.apple.com' && claims.exp === 1000 + 43200 && /^https:/.test(claims.sub), claims);
}

console.log('\n3. sending to every phone');
const SB = 'https://sb.test';
let calls = [], stored = [], sends = {}, state = {};
globalThis.fetch = async (u, init) => {
  const url = String(u), m = (init && init.method) || 'GET';
  calls.push({ url, m, body: init && init.body, headers: init && init.headers });
  const json = (x, st = 200) => new Response(JSON.stringify(x), { status: st, headers: { 'Content-Type': 'application/json' } });
  if (url.startsWith(SB + '/auth/v1/user')) return json({ email: 'admin@tfugen.local' });
  if (url.startsWith(SB + '/rest/v1/app_users')) return json([{ role: 'admin', active: true }]);
  if (url.startsWith(SB + '/rest/v1/server_state') && m === 'GET') {
    const key = (url.match(/key=eq\.([a-z_]+)/) || [])[1];
    // server_state.value is a text column: an array or an object comes back as its JSON string, like the real one
    const asText = (v) => typeof v === 'string' ? v : JSON.stringify(v);
    if (key === PUSH_KEY) return json(stored.length ? [{ value: asText(stored) }] : []);
    return json(key in state ? [{ value: asText(state[key]) }] : []);
  }
  if (url.startsWith(SB + '/rest/v1/server_state') && m === 'POST') {
    for (const row of JSON.parse(init.body)) {
      if (row.key === PUSH_KEY) stored = typeof row.value === 'string' ? JSON.parse(row.value) : row.value;
      else if (!(row.key in state) || !/ignore-duplicates/.test(init.headers.Prefer)) state[row.key] = row.value;
    }
    return new Response('', { status: 201 });
  }
  if (url.startsWith('https://push.test/')) return new Response('', { status: sends[url] || 201 });
  return json({ error: 'unexpected ' + url }, 599);
};
// the real public key is in the code, so for sending in tests the signature is only checked for shape
const ph2 = await phone('https://push.test/gone');
stored = [ph.sub, ph2.sub]; sends['https://push.test/gone'] = 410;
stored = [];
let r = await pushOwner({ SUPABASE_SERVICE_ROLE_KEY: 'k' }, SB, 'x');
check('no phone yet: nothing sent, no key made', r.sent === 0 && !(VAPID_KEY in state) && !calls.some((c) => c.url.startsWith('https://push.test/')));
stored = [ph.sub, ph2.sub];
{
  // no key in Cloudflare: the server makes its own pair once, keeps it, and uses the same one after
  const E0 = { SUPABASE_URL: SB, SUPABASE_SERVICE_ROLE_KEY: 'k' };
  const k1 = await vapidKeys(E0, SB), k2 = await vapidKeys(E0, SB);
  check('vapidKeys: made once by the server and kept in server_state; the second call reads the same pair', k1 && k2 && k1.pub === k2.pub && k1.d === k2.d && (typeof state[VAPID_KEY] === 'string' ? JSON.parse(state[VAPID_KEY]) : state[VAPID_KEY]).pub === k1.pub && unb64u(k1.pub).length === 65);
  await vapidAuth(k1.d, 'https://push.test/a', 0, k1.pub);
  check('...and the pair it made signs', true);
}
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

console.log('\n3b. how the last push went, for the watchdog (25/10/2026)');
{
  const J = (k) => (typeof state[k] === 'string' ? JSON.parse(state[k]) : state[k]);
  const last = J(PUSH_LAST), gone = J(PUSH_GONE);
  check('the push above: push_last says 1 sent, 1 failed, 1 dropped, 1 left, with the statuses', last && last.sent === 1 && last.failed === 1 && last.gone === 1 && last.left === 1 && last.st.join() === '201,410' && Date.parse(last.at) > 0, last);
  check('...push_ok_at is that moment, and push_gone keeps the drop with how many are left', !!last && state[PUSH_OK_AT] === last.at && gone && gone.n === 1 && gone.left === 1 && gone.at === last.at, { ok: state[PUSH_OK_AT], gone });
  const okBefore = state[PUSH_OK_AT];
  delete state[PUSH_GONE];
  stored = [ph.sub]; sends['https://push.test/a'] = 500;
  await new Promise((res) => setTimeout(res, 5));
  r = await pushOwner(ENV, SB, 'x');
  const l2 = J(PUSH_LAST);
  check('a push no phone took: push_last 0 sent, 1 failed; push_ok_at and push_gone untouched', r.sent === 0 && !!l2 && l2.sent === 0 && l2.failed === 1 && l2.st[0] === 500 && l2 && last && l2.at !== last.at && state[PUSH_OK_AT] === okBefore && !(PUSH_GONE in state), l2);
  delete sends['https://push.test/a'];
}

{
  // sendToOwner itself: Meta accepts, then one wa_out line with the text sent, then the pop-up
  stored = [ph.sub]; calls = [];
  const f1 = globalThis.fetch;
  globalThis.fetch = async (u, i) => String(u).includes('graph.facebook.com') ? new Response(JSON.stringify({ messages: [{ id: 'wamid.1' }] }), { status: 200 }) : f1(u, i);
  const sr = await sendToOwner(ENV, '972500000000', 'בוקר טוב', { windowOpen: true });
  globalThis.fetch = f1;
  const lg = calls.find((c) => c.url.includes('/notifications_log') && c.m === 'POST');
  const row = lg && JSON.parse(lg.body)[0];
  check('sendToOwner: sent, logged as wa_out on whatsapp with the text, and no pop-up (WhatsApp took it, 26/10/2026)', sr.ok && row && row.event_type === 'wa_out' && row.channel === 'whatsapp' && row.payload.text === 'בוקר טוב' && sr.push === 0 && !calls.some((c) => c.url === 'https://push.test/a'), { sr, row });
  // 26/10/2026: the same text again within 10 minutes is not sent (dev_done called twice on 25/10)
  calls = [];
  const txt = 'בוקר טוב ' + 'x'.repeat(40);
  let lookupUrl = '';
  globalThis.fetch = async (u, i) => String(u).includes('graph.facebook.com') ? new Response(JSON.stringify({ messages: [{ id: 'wamid.2' }] }), { status: 200 })
    : String(u).includes('/notifications_log?select=payload') ? (lookupUrl = String(u), new Response(JSON.stringify([{ text: txt }]), { status: 200 })) : f1(u, i);
  const sd = await sendToOwner(ENV, '972500000000', txt, { windowOpen: true });
  globalThis.fetch = f1;
  check('sendToOwner: the same text already sent in the last 10 minutes = not sent again, not logged', sd.ok && sd.duplicate && !calls.some((c) => c.url.includes('graph.facebook.com') || (c.url.includes('/notifications_log') && c.m === 'POST')), sd);
  // 27/10/2026 retro: a send Meta refused is logged as wa_out too (channel whatsapp_error); its retry must not count as a duplicate
  check('sentLately: the lookup leaves out failed sends (channel=neq.whatsapp_error), so a retry of a refused message goes out', lookupUrl.includes('channel=neq.whatsapp_error'), lookupUrl);
  calls = [];
  globalThis.fetch = async (u, i) => String(u).includes('graph.facebook.com') ? new Response(JSON.stringify({ error: { code: 131000, message: 'x' } }), { status: 400 }) : f1(u, i);
  const sf = await sendToOwner(ENV, '972500000000', 'נכשל', { windowOpen: true });
  globalThis.fetch = f1;
  check('sendToOwner, WhatsApp refused: no pop-up either (26/10/2026, only WhatsApp)', !sf.ok && sf.push === 0 && !calls.some((c) => c.url === 'https://push.test/a'), sf);
}

console.log('\n4. /api/chat?push=1');
const jwt = (aal) => 'h.' + Buffer.from(JSON.stringify({ aal })).toString('base64url') + '.s';
const req = (q, method, body) => new Request('https://app.test/api/chat' + q, { method, headers: { Authorization: 'Bearer ' + jwt('aal2'), 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
r = await onRequest({ request: req('?push=1', 'GET'), env: { ...ENV, VAPID_PUBLIC: undefined, VAPID_PRIVATE: undefined } });
let j = await r.json();
check('GET without a key in Cloudflare: the public half of the server\'s own pair, and ready', j.ok && j.key === (typeof state[VAPID_KEY] === 'string' ? JSON.parse(state[VAPID_KEY]) : state[VAPID_KEY]).pub && j.ready === true, j);
r = await onRequest({ request: req('?push=1', 'POST', { endpoint: 'http://bad' }), env: { ...ENV, VAPID_PRIVATE: 'x' } });
check('POST a bad subscription: 400', r.status === 400);
{
  stored = []; calls = [];
  const ph3 = await phone('https://push.test/new');
  r = await onRequest({ request: req('?push=1', 'POST', ph3.sub), env: ENV });
  j = await r.json();
  check('POST: the phone kept first, and a test pop-up sent to it at once', j.ok === true && j.test === 201 && stored[0].endpoint === 'https://push.test/new' && calls.some((c) => c.url === 'https://push.test/new'), j);
}

console.log('\n4b. only to the chat (25/10/2026: "cancel the notifications I get on WhatsApp")');
{
  const E = { SUPABASE_URL: SB, SUPABASE_SERVICE_ROLE_KEY: 'k' };
  state[OWNER_MODE_KEY] = 'chat'; state.wa_owner_in_at = new Date(Date.now() - 3600e3).toISOString();
  stored = [];
  check('mode chat, but no phone turned pop-ups on: WhatsApp still (or he would get nothing)', await chatOnly(E) === false);
  stored = [ph.sub];
  check('mode chat, he has not written on WhatsApp for an hour: chat only', await chatOnly(E) === true);
  state.wa_owner_in_at = new Date(Date.now() - 5 * 60000).toISOString();
  check('mode chat, he wrote on WhatsApp 5 minutes ago: the conversation goes on there', await chatOnly(E) === false);
  delete state[OWNER_MODE_KEY];
  check('no mode: WhatsApp as before', await chatOnly(E) === false);
  state[OWNER_MODE_KEY] = 'chat'; state.wa_owner_in_at = '2000-01-01T00:00:00Z'; calls = []; stored = [ph.sub];
  const sr = await sendToOwner({ ...ENV }, '972500000000', 'עדכון הבוקר', { windowOpen: true });
  const lg = calls.find((c) => c.url.includes('/notifications_log') && c.m === 'POST');
  check('sendToOwner in chat mode: nothing to Meta, logged on channel chat (not "failed"), and the pop-up sent', sr.ok && sr.via === 'chat' && !calls.some((c) => c.url.includes('graph.facebook.com')) && lg && JSON.parse(lg.body)[0].channel === 'chat' && sr.push === 1, sr);
  delete state[OWNER_MODE_KEY];
}

console.log('\n5. the service worker and the wiring');
check('the worker shows every push and opens /chat on a tap', /addEventListener\('push'/.test(CHAT_SW) && /showNotification/.test(CHAT_SW) && /notificationclick/.test(CHAT_SW) && /openWindow/.test(CHAT_SW));
const mw = readFileSync(new URL('../../functions/_middleware.js', import.meta.url), 'utf8');
check('/chat-sw.js is public (the browser fetches it without a login)', mw.includes("'/chat-sw.js'"));
const rdb = readFileSync(new URL('../../functions/api/routine-db.js', import.meta.url), 'utf8');
const wa = rdb.slice(rdb.indexOf("if (body.op === 'wa_me')"), rdb.indexOf("if (body.op === 'wa_review')"));
const waSrc = readFileSync(new URL('../../functions/_wa.js', import.meta.url), 'utf8');
check('every message to Michael (sendToOwner, sendDocToOwner) is logged as wa_out and pushed, sent or refused; wa_me reports the count', /export async function sendToOwner[\s\S]{0,700}noteOut\(/.test(waSrc) && /export async function sendDocToOwner[\s\S]{0,700}noteOut\(/.test(waSrc) && /pushOwner\(env, sbUrl, t\)/.test(waSrc) && /push: ps\.sent/.test(wa) && /ps = \{ sent: r\.push/.test(wa));
console.log(`\npush-test: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
