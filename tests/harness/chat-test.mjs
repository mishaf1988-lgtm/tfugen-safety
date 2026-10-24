// /chat and /api/chat (24/10/2026): Michael's assistant as its own home-screen icon, outside Meta.
import { onRequest, chatRows, chatFireText, chatManifest, CHAT_MAX } from './_build/chat.mjs';
import { chatPage } from './_build/chat-page.mjs';
import { existsSync, readFileSync } from 'node:fs';

let pass = 0, fail = 0;
const check = (l, c, d) => { if (c) { pass++; console.log('  ✓ ' + l); } else { fail++; console.log('  ✗ ' + l + (d !== undefined ? '  -> ' + JSON.stringify(d).slice(0, 400) : '')); } };
const SB = 'https://sb.test';
const ENV = { SUPABASE_URL: SB, SUPABASE_SERVICE_ROLE_KEY: 'svc', ASSISTANT_FIRE_URL: 'https://fire.test/x', ASSISTANT_FIRE_TOKEN: 'ft', ALLOWED_ORIGINS: 'https://app.test' };
let calls = [], users = {}, logRows = [];
globalThis.fetch = async (u, init) => {
  const url = String(u), m = (init && init.method) || 'GET';
  calls.push({ url, m, body: init && init.body });
  const json = (x, st = 200) => new Response(JSON.stringify(x), { status: st, headers: { 'Content-Type': 'application/json' } });
  if (url.startsWith(SB + '/auth/v1/user')) { const t = ((init && init.headers && init.headers.Authorization) || '').replace('Bearer ', ''); return users[t] ? json(users[t]) : json({ msg: 'bad' }, 401); }
  if (url.startsWith(SB + '/rest/v1/app_users')) return json([{ role: 'manager', active: true }]);
  if (url.startsWith(SB + '/rest/v1/notifications_log') && m === 'GET') return json(/select=ts,event_type,payload/.test(url) ? [] : logRows);
  if (url.startsWith(SB + '/rest/v1/notifications_log') && m === 'POST') return new Response('', { status: 201 });
  if (url.startsWith(SB + '/rest/v1/server_state')) return json([]);
  if (url.startsWith('https://fire.test/')) return json({ claude_code_session_id: 'cse_x' }, 200);
  return json({ error: 'unexpected ' + url }, 599);
};
const req = (path, method, tok, body) => new Request('https://app.test' + path, { method, headers: Object.assign({ 'Content-Type': 'application/json' }, tok ? { Authorization: 'Bearer ' + tok } : {}), body: body ? JSON.stringify(body) : undefined });
const jwt = (aal) => 'h.' + Buffer.from(JSON.stringify({ aal })).toString('base64url') + '.s';
const ADM = jwt('aal2'), ADM1 = jwt('aal1');
users[ADM] = { email: 'admin@tfugen.local' };
users[ADM1] = { email: 'admin@tfugen.local' };
users.mgr = { email: 'someone@tfugen.local' };
users.anon = { is_anonymous: true };

console.log('\n1. the page and the icon');
const page = chatPage();
check('the page: the icon manifest, the player, the site values filled in, no placeholder left', /rel="manifest" href="\/api\/chat\?m=1"/.test(page) && /window\.tapSay=/.test(page) && !/__SITE__|__PLAYER__/.test(page) && /"loginDomain":"[^"]+"/.test(page));
const mf = chatManifest();
check('the manifest: its own id, start and scope at /chat, standalone, RTL', mf.id === '/chat' && mf.start_url === '/chat' && mf.scope === '/chat' && mf.display === 'standalone' && mf.dir === 'rtl' && mf.icons.length >= 2);
const mw = readFileSync(new URL('../../functions/_middleware.js', import.meta.url), 'utf8');
check('the icon: the safety worker, every manifest icon a file in the repo and public before login', mf.icons.every((i) => /^\/chat-icon-/.test(i.src) && existsSync(new URL('../..' + i.src, import.meta.url)) && mw.includes("'" + i.src + "'")) && mw.includes("'/chat-icon-180.png'"));
check('while the assistant works: the worker animation with changing steps, not a static wait line', /function startWork\(/.test(page) && /class="m bot work"|'m bot work'/.test(page) && /prefers-reduced-motion/.test(page));
let r = await onRequest({ request: req('/api/chat?m=1', 'GET'), env: ENV });
check('GET ?m=1: the manifest without a login (it holds no data)', r.status === 200 && (await r.json()).start_url === '/chat');

console.log('\n2. only his account');
calls = [];
r = await onRequest({ request: req('/api/chat', 'GET'), env: ENV });
check('no token: 401, nothing read', r.status === 401 && !calls.some((c) => c.url.includes('notifications_log')));
r = await onRequest({ request: req('/api/chat', 'GET', 'anon'), env: ENV });
check('an anonymous session: 403', r.status === 403);
r = await onRequest({ request: req('/api/chat', 'POST', 'mgr', { text: 'x' }), env: ENV });
check('a manager: 403, nothing fired', r.status === 403 && !calls.some((c) => c.url.startsWith('https://fire.test/')));

calls = [];
r = await onRequest({ request: req('/api/chat', 'GET', ADM1), env: ENV });
check('his account with the password only (no second factor): 401 back to login, nothing read', r.status === 401 && !calls.some((c) => c.url.includes('notifications_log')));
check('the page: a Turnstile token on the password sign-in, then the 6-digit code (challenge, verify)', /gotrue_meta_security/.test(page) && /challenges\.cloudflare\.com\/turnstile/.test(page) && /\/challenge'/.test(page) && /\/verify'/.test(page));
const idx = readFileSync(new URL('../../index.html', import.meta.url), 'utf8');
check('the page uses the same Turnstile sitekey as index.html', (idx.match(/TURNSTILE_SITEKEY='([^']*)'/) || [])[1] === (page.match(/var TS='([^']*)'/) || [])[1]);

console.log('\n3. the conversation');
logRows = [{ ts: '2026-10-24T19:00:00Z', event_type: 'assistant', channel: 'whatsapp_error', text: 'answer' }, { ts: '2026-10-24T18:59:00Z', event_type: 'owner_in', channel: 'whatsapp', text: 'question' }, { ts: '2026-10-24T18:58:00Z', event_type: 'assistant', channel: 'whatsapp', text: '' }];
r = await onRequest({ request: req('/api/chat', 'GET', ADM), env: ENV });
let j = await r.json();
check('GET: his lines and the answers from every channel, oldest first; an answer WhatsApp refused is still shown, marked', r.status === 200 && j.rows.length === 2 && j.rows[0].who === 'me' && j.rows[1].who === 'bot' && j.rows[1].failed === true, j);
const q = calls.filter((c) => c.url.includes('notifications_log') && c.m === 'GET').pop();
check('GET reads only the conversation: owner_in and assistant, the four channels', /event_type=in\.\(owner_in,assistant\)/.test(q.url) && /channel=in\.\(whatsapp,whatsapp_error,office,chat\)/.test(q.url));

console.log('\n4. a line to the assistant');
calls = [];
r = await onRequest({ request: req('/api/chat', 'POST', ADM, { text: 'מה המצב?' }), env: ENV });
j = await r.json();
const logged = calls.find((c) => c.url.includes('notifications_log') && c.m === 'POST');
const fire = calls.find((c) => c.url.startsWith('https://fire.test/'));
check('POST: logged as his own line on channel chat, then the assistant fired', j.ok === true && !!logged && /"channel":"chat"/.test(logged.body) && /"event_type":"owner_in"/.test(logged.body) && !!fire, j);
check('the fire text: the chat header, the line, and the instruction to answer with wa_me', fire && /wa_me/.test(JSON.parse(fire.body).text) && JSON.parse(fire.body).text.indexOf('מה המצב?') > 0);
r = await onRequest({ request: req('/api/chat', 'POST', ADM, { text: '   ' }), env: ENV });
check('an empty line: 400', r.status === 400);
r = await onRequest({ request: req('/api/chat', 'POST', ADM, { text: 'x'.repeat(CHAT_MAX + 1) }), env: ENV });
check('a line over the limit: 400', r.status === 400);
check('chatRows drops empty lines and other events', chatRows([{ ts: 'a', event_type: 'watch', text: 'x' }, { ts: 'b', event_type: 'assistant', text: ' ' }]).length === 0);
check('chatFireText keeps a newline out of the one text line', !/\n.*\n.*\n.*\ntext: a\nb/.test(chatFireText('a\nb', 't', '', null)) && /text: a \/ b/.test(chatFireText('a\nb', 't', '', null)));

console.log(`\nchat-test: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
