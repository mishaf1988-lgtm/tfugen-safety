// The "read aloud" button on the weekly talk page. First (10/10/2026, "מאשר המלצות") the
// phone's own voices; then the same day Michael: "הדיבוב לא טוב כמו רובוט, חייב להיות יותר
// מקצועי כמו מדריך מדבר, בנוסף הוא מקריא מספר טופס". Now the voice comes from Gemini TTS
// through /api/talk?op=say (streamed, played as it arrives), the phone's voice is only the
// fallback, and what is read has no form numbers and no "2.1." line numbers.
// Runs the real talk.js: the server with fetch mocked, the page in Chromium at its real URL
// with its real headers (the CSP must let the page fetch its voice).
import { createRequire } from 'module';
import { onRequest, makeTalkToken, SPEAK, speechText, spokenOf, PLAYER, TTS_MODEL, TTS_VOICE } from './_build/talk.mjs';

const require = createRequire(import.meta.url);
let pw; try { pw = require('playwright'); } catch (e) { pw = require('playwright-core'); }
let pass = 0, fail = 0;
const check = (l, c, d) => { if (c) { pass++; console.log('  ✓ ' + l); } else { fail++; console.log('  ✗ ' + l + (d !== undefined ? '  -> ' + JSON.stringify(d).slice(0, 400) : '')); } };
const SB = 'https://znhjtpcltrxxyfjczgvw.supabase.co';
const URL0 = 'https://tapugan-safety.pages.dev/api/talk';
const ENV = { SUPABASE_SERVICE_ROLE_KEY: 'srv', TRUSTEE_NOTIFY_SECRET: 'nsec', GEMINI_API_KEY: 'gk' };
const TALK = { id: 't1', d: '2026-10-04', s: 'פורסמה', title: 'הוראות כניסה למשמרת (טופס 08.02.01)', body: '1. חירום: הולכים למרחב המוגן.\n2.1. משמרת של 8.5 שעות.', body_ru: 'Инструкция (форма 08.02.01)\n1. Проверьте привязь.' };
// Gemini's stream: two SSE events of base64 16-bit PCM, the second with an odd byte count.
const pcm = (n, off) => Buffer.from(Int16Array.from({ length: n }, (_, i) => (i + off) % 100 * 100).buffer);
const ev = (b) => 'data: ' + JSON.stringify({ event_type: 'step.delta', index: 0, delta: { type: 'audio', mime_type: 'audio/l16', sample_rate: 24000, data: b.toString('base64') } }) + '\n\n';
const ALL = pcm(2405, 0);
const SSE = ev(ALL.subarray(0, 4801)) + ev(ALL.subarray(4801));

let world = {};
globalThis.fetch = async (url, init) => {
  const u = String(url), m = (init && init.method) || 'GET';
  const j = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json' } });
  if (u.includes('/rest/v1/toolbox_talks')) return j([{ ...TALK, ...(world.talk || {}) }]);
  if (u.includes('/rest/v1/emp')) return j([{ id: 'e1', n: 'דנה', dep: 'ייצור' }]);
  if (u === SB + '/auth/v1/user') { const tok = init.headers.Authorization.replace('Bearer ', ''); return tok === 'good' ? j({ id: 'u1', email: 'michael@tfugen.local' }) : tok === 'rep' ? j({ id: 'u2', email: 'rep@tfugen.local' }) : new Response('no', { status: 401 }); }
  if (u.startsWith(SB + '/rest/v1/app_users')) return j([u.includes('id=eq.michael') ? { role: 'מנהל', active: true } : { role: 'מדווח', active: true }]);
  if (u.startsWith('https://generativelanguage.googleapis.com/')) {
    (world.tts = world.tts || []).push({ u, m, key: init.headers['x-goog-api-key'], b: JSON.parse(init.body) });
    const which = u.endsWith('/interactions') ? 'i' : 'g';
    if ((world.down || '').includes(which)) return new Response('{"error":"refused ' + which + '"}', { status: 400 });
    return new Response(SSE, { headers: { 'Content-Type': 'text/event-stream' } });
  }
  return j({}, 599);
};
const get = (q) => onRequest({ request: new Request(URL0 + '?' + q), env: ENV, waitUntil() {} });
const post = (body, auth) => onRequest({ request: new Request(URL0, { method: 'POST', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json', Origin: 'https://tapugan-safety.pages.dev', ...(auth ? { Authorization: 'Bearer ' + auth } : {}) } }), env: ENV, waitUntil() {} });

// The page: a fake AudioContext that records what is queued, and a fake speechSynthesis.
const STUB = (o) => {
  window.__q = []; window.__said = []; window.__cancel = 0; window.__closed = 0;
  if (o.audio) {
    window.AudioContext = function () { this.currentTime = 0; this.destination = {}; };
    window.AudioContext.prototype = { resume() {}, close() { window.__closed++; },
      createBuffer(c, n, r) { const d = new Float32Array(n); return { length: n, sampleRate: r, duration: n / r, getChannelData: () => d }; },
      createBufferSource() { const s = { connect() {}, start(t) { window.__q.push({ n: s.buffer.length, r: s.buffer.sampleRate, t }); window.__src = (window.__src || []).concat(s); } }; return s; } };
  } else { window.AudioContext = undefined; window.webkitAudioContext = undefined; }
  window.SpeechSynthesisUtterance = function (t) { this.text = t; };
  Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: { getVoices: () => (o.voices || []).map((l) => ({ lang: l, name: l })), addEventListener() {},
    speak(u) { window.__said.push({ text: u.text, lang: u.lang }); }, cancel() { window.__cancel++; } } });
};

(async () => {
  console.log('1. what is read');
  const he = speechText(TALK.title, TALK.body);
  check('no form number in the title', !/08\.02|טופס/.test(he) && /^הוראות כניסה למשמרת\./.test(he), he);
  check('no "1." or "2.1." in front of a line, and a decimal inside a sentence stays', !/^\s*\d/m.test(he) && /8\.5 שעות/.test(he), he);
  check('every line ends in a stop, so the voice pauses', he.split('\n').every((l) => /[.:]$/.test(l)), he);
  check('"לפי טופס 08.01" goes whole, and " - " becomes a comma', speechText('', 'כפפות לפי טופס 08.01\nאולם השטיפה - בונקר') === 'כפפות.\nאולם השטיפה, בונקר.', speechText('', 'כפפות לפי טופס 08.01\nאולם השטיפה - בונקר'));
  check('the same in Russian (the translation)', spokenOf(TALK, 'ru') === 'Инструкция.\nПроверьте привязь.', spokenOf(TALK, 'ru'));

  console.log('\n2. the server voice');
  const tok = await makeTalkToken(ENV, 't1');
  world = {};
  let r = await get('op=say&k=' + encodeURIComponent(tok));
  let t = await r.text();
  check('a valid link: 200, an event stream, Gemini\'s bytes passed through', r.status === 200 && /event-stream/.test(r.headers.get('content-type')) && t === SSE, [r.status, t.length]);
  const q = world.tts && world.tts[0];
  check('asks Gemini (interactions) with the key, the model, the voice and Hebrew', q && q.u.endsWith('/v1beta/interactions') && q.key === 'gk' && q.b.model === TTS_MODEL && q.b.stream === true && q.b.generation_config.speech_config[0].voice === TTS_VOICE && q.b.generation_config.speech_config[0].language === 'he-IL', q && q.b);
  check('...with the cleaned text, not the raw one', q && q.b.input[0].content[0].text === he, q && q.b.input);
  world = {};
  await get('op=say&l=ru&k=' + encodeURIComponent(tok));
  check('Russian page: the Russian text in a Russian voice', world.tts[0].b.input[0].content[0].text === spokenOf(TALK, 'ru') && world.tts[0].b.generation_config.speech_config[0].language === 'ru-RU');
  world = { down: 'i' };
  r = await get('op=say&k=' + encodeURIComponent(tok));
  check('interactions refused: generateContent with AUDIO, same voice', r.status === 200 && world.tts.length === 2 && /:streamGenerateContent\?alt=sse$/.test(world.tts[1].u) && world.tts[1].b.generationConfig.responseModalities[0] === 'AUDIO' && world.tts[1].b.generationConfig.speechConfig.voiceConfig.prebuiltVoiceConfig.voiceName === TTS_VOICE, world.tts.map((x) => x.u));
  world = { down: 'ig' };
  r = await get('op=say&k=' + encodeURIComponent(tok));
  t = await r.text();
  check('both refused: 502 with both answers, for the page to fall back', r.status === 502 && /interactions 400/.test(t) && /generate 400/.test(t), [r.status, t]);
  world = {};
  r = await get('op=say&k=zzz');
  check('a bad link: 403, Gemini not called', r.status === 403 && !world.tts);
  world = { talk: { s: 'טיוטה' } };
  r = await get('op=say&k=' + encodeURIComponent(tok));
  check('a draft: 404, Gemini not called', r.status === 404 && !world.tts);
  world = {};
  r = await onRequest({ request: new Request(URL0 + '?op=say&k=' + encodeURIComponent(tok)), env: { ...ENV, GEMINI_API_KEY: '' } });
  check('no key on the server: 503', r.status === 503);
  r = await get('op=player');
  check('?op=player serves the player script', r.status === 200 && /javascript/.test(r.headers.get('content-type')) && (await r.text()) === PLAYER);

  console.log('\n3. the manager listens before publishing (POST op say)');
  world = {};
  r = await post({ op: 'say', title: 'נושא (טופס 08.01)', body: '1. כובע חבטה' }, 'good');
  check('a manager: the stream, from the text in the form, cleaned', r.status === 200 && /event-stream/.test(r.headers.get('content-type')) && world.tts[0].b.input[0].content[0].text === 'נושא.\nכובע חבטה.', world.tts && world.tts[0].b.input);
  world = {};
  r = await post({ op: 'say', title: 'x', body: 'y' }, 'rep');
  check('a reporter: refused, Gemini not called', r.status === 403 && !world.tts, r.status);
  r = await post({ op: 'say', title: 'x', body: 'y' });
  check('no login: refused', r.status === 401 || r.status === 403, r.status);

  console.log('\n4. the page');
  const browser = await pw.chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 375, height: 812 } });
  const errs = [];
  const open = async (o, l) => {
    const p = await ctx.newPage();
    p.on('pageerror', (e) => errs.push(String(e)));
    p.__says = [];
    await p.route('**/*', async (rt) => {
      const u = rt.request().url();
      if (!u.startsWith(URL0)) return rt.abort();
      if (u.includes('op=say')) { p.__says.push(u); return o.serverDown ? rt.fulfill({ status: 502, body: '{"error":"x"}', contentType: 'application/json' }) : rt.fulfill({ status: 200, body: SSE, headers: { 'Content-Type': 'text/event-stream' } }); }
      world = {};
      const res = await get('k=' + encodeURIComponent(tok) + (l ? '&l=' + l : ''));
      const h = {}; res.headers.forEach((v, k) => { h[k] = v; });
      return rt.fulfill({ status: res.status, headers: h, body: await res.text() });
    });
    await p.addInitScript(STUB, o);
    await p.goto(URL0 + '?k=' + encodeURIComponent(tok) + (l ? '&l=' + l : ''));
    await p.waitForTimeout(80);
    return p;
  };
  const vis = (p) => p.evaluate(() => { const b = document.getElementById('say'); return !!b && getComputedStyle(b).display !== 'none'; });

  let p = await open({ audio: true, voices: [] }, 'he');
  check('the button shows with no phone voice at all (the voice comes from the server)', await vis(p));
  check('...labelled in Hebrew', (await p.textContent('#say')).includes(SPEAK.he.listen));
  await p.click('#say');
  await p.waitForTimeout(200);
  let s = await p.evaluate(() => ({ q: window.__q, label: document.getElementById('say').textContent, said: window.__said }));
  check('a tap fetches op=say for this link and language', p.__says.length === 1 && p.__says[0].includes('op=say') && p.__says[0].includes('k=' + encodeURIComponent(tok)) && p.__says[0].includes('l=he'), p.__says);
  check('...and queues the audio: all 2405 samples, at 24 kHz, one after another', s.q.reduce((a, x) => a + x.n, 0) === 2405 && s.q.every((x) => x.r === 24000) && s.q.length >= 2 && s.q[1].t >= s.q[0].t + s.q[0].n / 24000 - 1e-9, s.q);
  check('...the button becomes "stop", and the phone voice is not used', s.label.includes(SPEAK.he.stop) && !s.said.length, s);
  await p.evaluate(() => window.__src.forEach((x) => x.onended && x.onended()));
  s = await p.evaluate(() => ({ label: document.getElementById('say').textContent, closed: window.__closed }));
  check('when the audio ends, the button is "read aloud" again', s.label.includes(SPEAK.he.listen) && s.closed === 1, s);
  await p.click('#say'); await p.waitForTimeout(100);
  await p.click('#say');
  s = await p.evaluate(() => ({ label: document.getElementById('say').textContent, closed: window.__closed }));
  check('a second tap stops', s.label.includes(SPEAK.he.listen) && s.closed === 2, s);
  await p.close();

  p = await open({ audio: true, voices: ['he-IL'], serverDown: true }, 'he');
  await p.click('#say'); await p.waitForTimeout(200);
  s = await p.evaluate(() => window.__said);
  check('server voice fails: the phone reads, the cleaned text in Hebrew', s.length === 1 && s[0].text === he && s[0].lang === 'he-IL', s);
  await p.close();

  p = await open({ audio: true, voices: [], serverDown: true }, 'he');
  await p.click('#say'); await p.waitForTimeout(200);
  check('server fails and no phone voice: the button returns to "read aloud"', (await p.textContent('#say')).includes(SPEAK.he.listen));
  await p.close();

  p = await open({ audio: false, voices: ['ru-RU'] }, 'ru');
  check('no Web Audio, a Russian voice: the button, in Russian', (await vis(p)) && (await p.textContent('#say')).includes(SPEAK.ru.listen));
  await p.click('#say'); await p.waitForTimeout(100);
  s = await p.evaluate(() => window.__said);
  check('...and the phone reads the cleaned Russian', s.length === 1 && s[0].text === spokenOf(TALK, 'ru'), s);
  await p.close();
  p = await open({ audio: false, voices: [] }, 'he');
  check('no Web Audio and no voice: no button', !(await vis(p)));
  await p.close();

  check('no page errors (and the CSP let the page fetch its voice)', !errs.length, errs);
  await browser.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('HARNESS ERROR', e); process.exit(2); });
