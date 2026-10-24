// /chat and /api/chat (24/10/2026): Michael's assistant as its own home-screen icon, outside Meta.
import { onRequest, chatRows, chatFireText, chatManifest, CHAT_MAX } from './_build/chat.mjs';
import { chatPage } from './_build/chat-page.mjs';
import { existsSync, readFileSync } from 'node:fs';

let pass = 0, fail = 0;
const check = (l, c, d) => { if (c) { pass++; console.log('  ✓ ' + l); } else { fail++; console.log('  ✗ ' + l + (d !== undefined ? '  -> ' + JSON.stringify(d).slice(0, 400) : '')); } };
const SB = 'https://sb.test';
const ENV = { SUPABASE_URL: SB, SUPABASE_SERVICE_ROLE_KEY: 'svc', ASSISTANT_FIRE_URL: 'https://fire.test/x', ASSISTANT_FIRE_TOKEN: 'ft', ALLOWED_ORIGINS: 'https://app.test' };
let calls = [], users = {}, logRows = [], fileRows = {}, lastOutVal = null, doc_url_saved = '';
globalThis.fetch = async (u, init) => {
  const url = String(u), m = (init && init.method) || 'GET';
  calls.push({ url, m, body: init && init.body });
  const json = (x, st = 200) => new Response(JSON.stringify(x), { status: st, headers: { 'Content-Type': 'application/json' } });
  if (url.startsWith(SB + '/auth/v1/user')) { const t = ((init && init.headers && init.headers.Authorization) || '').replace('Bearer ', ''); return users[t] ? json(users[t]) : json({ msg: 'bad' }, 401); }
  if (url.startsWith(SB + '/rest/v1/app_users')) return json([{ role: 'manager', active: true }]);
  if (url.startsWith(SB + '/rest/v1/notifications_log') && m === 'GET' && /id=eq\./.test(url)) return json(fileRows[(url.match(/id=eq\.([a-z0-9]+)/) || [])[1]] ? [fileRows[(url.match(/id=eq\.([a-z0-9]+)/) || [])[1]]] : []);
  if (url.startsWith(SB + '/rest/v1/notifications_log') && m === 'GET') return json(/select=ts,event_type,payload/.test(url) ? [] : logRows);
  if (url.startsWith(SB + '/rest/v1/oauth_tokens')) return json([{ user_email: 'm@x', refresh_token: 'r', access_token: 'at', expires_at: new Date(Date.now() + 3600e3).toISOString() }]);
  if (url.startsWith('https://graph.microsoft.com/') && m === 'PUT') return json({ webUrl: 'https://od/x', size: 10 });
  if (url.startsWith('https://graph.microsoft.com/')) return /%D7%A0%D7%99%D7%94%D7%95%D7%9C/.test(url) ? new Response('%PDF-1.4 x', { status: 200 }) : new Response('', { status: 404 });
  if (url.startsWith(SB + '/rest/v1/notifications_log') && m === 'POST') return new Response('', { status: 201 });
  if (url.startsWith(SB + '/rest/v1/server_state')) return json(/key=eq\.wa_last_out/.test(url) && lastOutVal ? [{ value: lastOutVal }] : []);
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
check('GET reads only the conversation: owner_in, assistant and wa_out, the four channels', /event_type=in\.\(owner_in,assistant,wa_out\)/.test(q.url) && /channel=in\.\(whatsapp,whatsapp_error,office,chat\)/.test(q.url));

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
check('chatRows: every message sent on WhatsApp shows (wa_out); an assistant line with its wa_out twin shows once; an old assistant line stays',
  (() => { const x = chatRows([{ ts: '2026-10-25T05:00:00Z', event_type: 'wa_out', channel: 'whatsapp', text: 'בוקר טוב, עדכון' }, { ts: '2026-10-25T06:00:00Z', event_type: 'assistant', channel: 'whatsapp', text: 'תשובה' }, { ts: '2026-10-25T06:00:01Z', event_type: 'wa_out', channel: 'whatsapp', text: 'תשובה' }, { ts: '2026-10-20T06:00:00Z', event_type: 'assistant', channel: 'whatsapp', text: 'ישנה' }]); return x.length === 3 && x.every((r) => r.who === 'bot') && x.filter((r) => r.text === 'תשובה').length === 1; })());
check('chatRows drops empty lines and other events', chatRows([{ ts: 'a', event_type: 'watch', text: 'x' }, { ts: 'b', event_type: 'assistant', text: ' ' }]).length === 0);
check('chatFireText keeps a newline out of the one text line', !/\n.*\n.*\n.*\ntext: a\nb/.test(chatFireText('a\nb', 't', '', null)) && /text: a \/ b/.test(chatFireText('a\nb', 't', '', null)));

// 24/10/2026 (lesson 154): Michael's first chat messages went unanswered, since step 1 of the procedure and the
// trigger prompt listed only three headers. The header the server sends must be in step 1 (the prompt is outside the repo).
const proc = readFileSync(new URL('../../project-files/routine-wa-assistant.md', import.meta.url), 'utf8');
const head = chatFireText('x', 't', '', null).split('\n')[0];
const step1 = (proc.split('\n').find((l) => /^1\. \*\*/.test(l)) || '');
check('step 1 of the assistant procedure accepts the exact header the chat sends', step1.indexOf('`' + head + '`') >= 0, head);
console.log('\n5. files and buttons, like WhatsApp (25/10/2026)');
{
  const SAFE = 'שולחן העבודה/ניהול בטיחות/';
  logRows = [{ id: 'wodoc1', ts: '2026-10-25T06:00:00Z', event_type: 'wa_out', channel: 'whatsapp', text: '📎 אישור כבאות.pdf', kind: 'document', file: SAFE + 'רישוי/אישור כבאות.pdf', name: 'אישור כבאות.pdf' },
    { id: 'wa1', ts: '2026-10-25T06:00:05Z', event_type: 'assistant', channel: 'whatsapp', text: 'אישור כבאות.pdf', via: 'document' },
    { id: 'wobtn', ts: '2026-10-25T06:01:00Z', event_type: 'wa_out', channel: 'whatsapp', text: 'לחתום?', choices: ['1. כן', '2. לא'] }];
  r = await onRequest({ request: req('/api/chat', 'GET', ADM), env: ENV });
  const j5 = await r.json();
  const doc = j5.rows.find((x) => x.doc);
  doc_url_saved = doc && doc.url;
  check('GET: a file the server sent shows once, with a signed link and its name; its assistant twin is not shown again', j5.rows.length === 2 && doc && /^\/api\/chat-file\/%D7%90[^/?]*\.pdf\?f=wodoc1&e=\d+&s=[0-9a-f]{32}$/.test(doc.url) && decodeURIComponent(doc.url.split('?')[0]).endsWith('/אישור כבאות.pdf') && doc.doc === 'אישור כבאות.pdf' && !('id' in doc), j5.rows);
  check('GET: the buttons of a question come with it', (j5.rows.find((x) => x.choices) || {}).choices.join('|') === '1. כן|2. לא');
  fileRows = { wodoc1: { file: SAFE + 'רישוי/אישור כבאות.pdf', name: 'אישור כבאות.pdf' }, wooutside: { file: 'שולחן העבודה/אחר/x.pdf', name: 'x.pdf' } };
  const nr = (u) => new Request('https://app.test' + u, { method: 'GET' });
  r = await onRequest({ request: nr(doc.url), env: ENV });
  check('the link opens the file without a login header: PDF, inline, its Hebrew name', r.status === 200 && r.headers.get('Content-Type') === 'application/pdf' && /inline; filename\*=UTF-8''/.test(r.headers.get('Content-Disposition')) && (await r.text()).startsWith('%PDF'));
  r = await onRequest({ request: nr(doc.url.replace(/s=[0-9a-f]+/, 's=' + '0'.repeat(32))), env: ENV });
  check('a changed signature: 403, nothing read', r.status === 403);
  r = await onRequest({ request: nr(doc.url.replace('f=wodoc1', 'f=wooutside')), env: ENV });
  check('a link for another row with the same signature: 403', r.status === 403);
  const { fileSig } = await import('./_build/chat.mjs');
  const e2 = Date.now() + 60000;
  r = await onRequest({ request: nr('/api/chat?f=wooutside&e=' + e2 + '&s=' + await fileSig(ENV, 'wooutside', e2)), env: ENV });
  check('a signed link to a file outside the safety folder: 404', r.status === 404);
  r = await onRequest({ request: nr('/api/chat?f=wodoc1&e=' + (Date.now() - 1000) + '&s=' + await fileSig(ENV, 'wodoc1', Date.now() - 1000)), env: ENV });
  check('an expired link: 403', r.status === 403);
  check('the page: a file is a link that opens it, buttons send their own text', /class="doc" href=/.test(page) && /send\(x\.getAttribute\('data-c'\),i\+1\)/.test(page));
  logRows = [];
  fileRows = { wodoc1: fileRows.wodoc1 };
}

{
  // the same fast lane as WhatsApp: a tap on "accurate" after a professional answer is answered by the server, no Routine
  const { onRequest: fileRoute } = await import('./_build/chat-file.mjs');
  r = await fileRoute({ request: new Request('https://app.test' + doc_url_saved), env: ENV });
  check('/api/chat-file/<name>: the same signed file, under its own name for sharing', r.status === 200 && r.headers.get('Content-Type') === 'application/pdf');
  lastOutVal = { at: new Date().toISOString(), text: 'answer', ref: 'pro' };
  calls = [];
  r = await onRequest({ request: req('/api/chat', 'POST', ADM, { text: '1. מדויק', choice: 1 }), env: ENV });
  const jf = await r.json();
  check('a button tap the WhatsApp fast lane answers: answered by the server (logged for the chat), the assistant not fired', jf.ok === true && jf.fast === 'rate' && !calls.some((c) => c.url.startsWith('https://fire.test/')) && calls.some((c) => c.url.includes('notifications_log') && c.m === 'POST' && /wa_out/.test(c.body)), jf);
  lastOutVal = null;
}

console.log('\n6. a photo or a PDF from him (25/10/2026)');
{
  const { upName } = await import('./_build/chat.mjs');
  const { upKind } = await import('./_build/routine-db.mjs');
  check('upKind: JPEG, PNG and PDF by their first bytes, nothing else', upKind(new Uint8Array([0xFF, 0xD8, 0xFF, 0xE0, 0, 0, 0, 0])).ext === 'jpg' && upKind(new Uint8Array([0x89, 0x50, 0x4E, 0x47, 0, 0, 0, 0])).ext === 'png' && upKind(new TextEncoder().encode('%PDF-1.4 x')).ext === 'pdf' && upKind(new TextEncoder().encode('<html>hi</html>')) === null);
  check('upName: Israel time DD-MM-YYYY HH.MM.SS, a clean name, the real extension', upName('../../a/b:c.exe', 'jpg', new Date('2026-10-25T06:05:09Z')) === '25-10-2026 08.05.09 - .. .. a b c.jpg', upName('../../a/b:c.exe', 'jpg', new Date('2026-10-25T06:05:09Z')));
  calls = [];
  const pdf = new TextEncoder().encode('%PDF-1.4 test');
  r = await onRequest({ request: new Request('https://app.test/api/chat?up=1', { method: 'POST', headers: { Authorization: 'Bearer ' + ADM, 'X-File-Name': encodeURIComponent('טופס.pdf'), 'X-Caption': encodeURIComponent('תבדוק את זה') }, body: pdf }), env: ENV });
  const ju = await r.json();
  const put = calls.find((c) => c.m === 'PUT' && c.url.startsWith('https://graph.microsoft.com/'));
  const lg = calls.find((c) => c.url.includes('notifications_log') && c.m === 'POST');
  const fr = calls.find((c) => c.url.startsWith('https://fire.test/'));
  const row = lg && JSON.parse(lg.body)[0], ft = fr && JSON.parse(fr.body).text;
  check('POST ?up=1: the file saved in the safety folder under its chat folder', ju.ok === true && put && decodeURIComponent(put.url).indexOf('ניהול בטיחות/מהצ\'אט/') > 0 && /טופס\.pdf:\/content$/.test(decodeURIComponent(put.url)), ju);
  check('...logged as his own line with the file, so the chat shows it as a file', row && row.event_type === 'owner_in' && row.payload.kind === 'document' && /מהצ'אט\//.test(row.payload.file) && row.payload.text.startsWith('📎 '));
  check('...and the assistant gets the WhatsApp media line, with the chat line id for wa_media, and the caption as text', ft && new RegExp('media: document id ' + row.id + ' \\(application/pdf, ').test(ft) && /"op":"wa_media","id":"ch/.test(ft) && /text: תבדוק את זה/.test(ft));
  r = await onRequest({ request: new Request('https://app.test/api/chat?up=1', { method: 'POST', headers: { Authorization: 'Bearer ' + ADM }, body: new TextEncoder().encode('MZ executable') }), env: ENV });
  check('anything but a photo or a PDF: 400', r.status === 400);
  r = await onRequest({ request: new Request('https://app.test/api/chat?up=1', { method: 'POST', headers: { Authorization: 'Bearer ' + ADM1 }, body: pdf }), env: ENV });
  check('without the second factor: 401, nothing saved', r.status === 401);
  check('the page: a picked photo waits above the box (✕ drops it) and goes with the caption only on ➤', /id="pv"/.test(page) && /if\(pend_f\)return sendFile\(pend_f,/.test(page) && !/\$\('fi'\)\.onchange=function\(\)\{[^}]*fetch\(/.test(page));
  check('the page: 📎 sends a photo (made smaller) or a PDF with what is typed', /id="att"/.test(page) && /\/api\/chat\?up=1/.test(page) && /image\/jpeg',0\.82/.test(page));
}

console.log(`\nchat-test: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
