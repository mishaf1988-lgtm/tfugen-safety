// The voice message in /chat (25/10/2026, Michael: "a text-only recording is what my iPhone keyboard already does; a
// transcribed recording is useful"; in the questionnaire: "do it: a transcribed voice message"). The phone records
// until a second tap, /api/chat?stt=1 writes it out with Whisper on Workers AI, and the text joins the box to fix and
// send. What is checked: the server takes audio by its bytes only and asks Whisper in Hebrew; the endpoint has the
// same login as the rest of the chat; and in a real browser, with a fake microphone, the two taps put the text in the
// box and send nothing to the assistant.
import { createRequire } from 'module';
import { sttKind, transcribe, b64, STT_MODEL, STT_MAX } from './_build/_stt.mjs';
import { onRequest } from './_build/chat.mjs';
import { chatPage } from './_build/chat-page.mjs';

const require = createRequire(import.meta.url);
let pw; try { pw = require('playwright'); } catch (e) { pw = require('playwright-core'); }
let pass = 0, fail = 0;
const check = (l, c, d) => { if (c) { pass++; console.log('  ✓ ' + l); } else { fail++; console.log('  ✗ ' + l + (d !== undefined ? '  -> ' + JSON.stringify(d).slice(0, 400) : '')); } };
const pad = (head, n = 64) => { const b = new Uint8Array(n); b.set(head); return b; };
const WEBM = pad([0x1A, 0x45, 0xDF, 0xA3]), M4A = pad([0, 0, 0, 0x20, 0x66, 0x74, 0x79, 0x70, 0x4D, 0x34, 0x41]);

console.log('\n1. what counts as audio, and what Whisper is asked');
check('by the bytes: webm (Android), mp4/m4a (iPhone), ogg, wav, mp3; a JPEG or a PDF is not audio',
  sttKind(WEBM) === 'webm' && sttKind(M4A) === 'mp4' && sttKind(pad([0x4F, 0x67, 0x67, 0x53])) === 'ogg' && sttKind(pad([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x41, 0x56, 0x45])) === 'wav'
  && sttKind(pad([0x49, 0x44, 0x33])) === 'mp3' && sttKind(pad([0xFF, 0xD8, 0xFF])) === null && sttKind(pad([0x25, 0x50, 0x44, 0x46])) === null);
{
  let seen = null;
  const env = { AI: { run: async (m, i) => { seen = { m, i }; return { text: '  הקורס   אחרי ההמרה ' }; } } };
  const big = new Uint8Array(100000); big.set(M4A);
  const r = await transcribe(env, big);
  check('Whisper large v3 turbo, in Hebrew, the whole recording as base64; the text comes back tidied', r.ok && r.text === 'הקורס אחרי ההמרה' && seen.m === STT_MODEL && seen.i.language === 'he' && seen.i.task === 'transcribe'
    && Buffer.from(seen.i.audio, 'base64').equals(Buffer.from(big)), { r, m: seen && seen.m });
  check('b64 matches Node for a buffer over one chunk', b64(big) === Buffer.from(big).toString('base64'));
  const over = new Uint8Array(STT_MAX + 1); over.set(WEBM);
  check('not audio, too big, no AI binding, silence, an AI error: each an answer, none a throw',
    (await transcribe(env, pad([0xFF, 0xD8, 0xFF]))).error.startsWith('not audio') && (await transcribe(env, over)).error.startsWith('audio over')
    && (await transcribe({}, WEBM)).error === 'no Workers AI binding' && (await transcribe({ AI: { run: async () => ({ text: ' ' }) } }, WEBM)).error === 'nothing heard'
    && /^stt: boom/.test((await transcribe({ AI: { run: async () => { throw new Error('boom'); } } }, WEBM)).error));
}

console.log('\n2. /api/chat?stt=1');
{
  const SB = 'https://sb.test', jwt = (aal) => 'h.' + Buffer.from(JSON.stringify({ aal })).toString('base64url') + '.s';
  const users = { [jwt('aal2')]: { email: 'admin@tfugen.local' }, [jwt('aal1')]: { email: 'admin@tfugen.local' } };
  let posted = 0;
  globalThis.fetch = async (u, init) => {
    const url = String(u), json = (x, st = 200) => new Response(JSON.stringify(x), { status: st, headers: { 'Content-Type': 'application/json' } });
    if (url.startsWith(SB + '/auth/v1/user')) { const t = ((init && init.headers && init.headers.Authorization) || '').replace('Bearer ', ''); return users[t] ? json(users[t]) : json({}, 401); }
    if (url.startsWith(SB + '/rest/v1/app_users')) return json([{ role: 'admin', active: true }]);
    posted++; return json({}, 599);
  };
  const env = { SUPABASE_URL: SB, SUPABASE_SERVICE_ROLE_KEY: 'svc', ALLOWED_ORIGINS: 'https://app.test', AI: { run: async () => ({ text: 'שלום' }) } };
  const req = (tok, body) => new Request('https://app.test/api/chat?stt=1', { method: 'POST', headers: { Authorization: 'Bearer ' + tok, 'Content-Type': 'audio/mp4' }, body });
  let r = await onRequest({ request: req(jwt('aal2'), M4A), env });
  let j = await r.json();
  check('his phone, signed in with the code: the text, and nothing logged or fired', r.status === 200 && j.ok && j.text === 'שלום' && posted === 0, j);
  r = await onRequest({ request: req(jwt('aal1'), M4A), env });
  check('a password-only session: 401, like the rest of the chat', r.status === 401);
  r = await onRequest({ request: req(jwt('aal2'), pad([0x25, 0x50, 0x44, 0x46])), env });
  check('a PDF sent as audio: 400', r.status === 400);
}

console.log('\n3. the page, in a real browser with a fake microphone');
{
  const browser = await pw.chromium.launch();
  const page = await browser.newPage({ viewport: { width: 375, height: 760 } });
  const html = chatPage();
  const stt = [], chat = [];
  await page.route('**/*', (rt) => {
    const u = rt.request().url(), m = rt.request().method();
    if (u.includes('/api/chat?stt=1')) { stt.push({ type: rt.request().headers()['content-type'], len: (rt.request().postDataBuffer() || []).length }); return rt.fulfill({ json: { ok: true, text: 'הקורס אחרי ההמרה' } }); }
    if (u.includes('/api/chat') && m === 'GET') return rt.fulfill({ json: { ok: true, rows: [] } });
    if (u.includes('/api/chat')) { chat.push(rt.request().postData()); return rt.fulfill({ json: { ok: true } }); }
    if (u.startsWith('https://app.test/')) return rt.fulfill({ contentType: 'text/html', body: html });
    return rt.abort();
  });
  await page.addInitScript(() => {
    localStorage.setItem('chat_sess', JSON.stringify({ a: 't', r: 'r', x: Date.now() + 3600e3 }));
    window.__tracks = [];
    navigator.mediaDevices.getUserMedia = async () => { const t = { stopped: false, stop() { this.stopped = true; } }; window.__tracks.push(t); return { getTracks: () => [t] }; };
    window.MediaRecorder = class { constructor() { this.mimeType = 'audio/mp4'; } start() { this.state = 'recording'; }
      stop() { this.ondataavailable({ data: new Blob([new Uint8Array(4000)], { type: 'audio/mp4' }) }); this.onstop(); } };
  });
  await page.goto('https://app.test/chat');
  await page.waitForSelector('#mic');
  await page.fill('#x', 'תיקון:');
  await page.click('#mic');
  const during = await page.evaluate(() => ({ rec: document.getElementById('mic').classList.contains('rec'), ph: document.getElementById('x').placeholder }));
  check('first tap: recording, the button red, the box says how to stop', during.rec && /מקליט/.test(during.ph), during);
  await page.click('#mic');
  await page.waitForFunction(() => /הקורס/.test(document.getElementById('x').value));
  const after = await page.evaluate(() => ({ v: document.getElementById('x').value, rec: document.getElementById('mic').classList.contains('rec'), dis: document.getElementById('mic').disabled, stopped: window.__tracks.every((t) => t.stopped), focus: document.activeElement.id }));
  check('second tap: the recording goes to ?stt=1 with its type, the text joins what was typed, the microphone is released', stt.length === 1 && stt[0].type === 'audio/mp4' && stt[0].len === 4000
    && after.v === 'תיקון: הקורס אחרי ההמרה' && !after.rec && !after.dis && after.stopped && after.focus === 'x', { stt, after });
  check('...and nothing went to the assistant: he reads it, fixes it, and sends it himself', chat.length === 0, chat);
  await browser.close();
}

console.log(`\nchat-voice-test: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
