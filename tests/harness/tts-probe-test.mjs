// 13/11/2026 (ideas-lab 37, Michael in the questionnaire: "do it: a voice-reply trial"): one Hebrew line read aloud and
// sent to Michael as a WhatsApp voice message, so he can say whether Hebrew is usable. A probe, not a feature: nothing
// on an ordinary message calls it. Here the pure parts (the answer shapes a model can return) and the op's guards.
import { TTS_MODELS, ttsBytes, aiTts } from './_build/_ocr.mjs';
import { sendVoiceToOwner, TTS_MAX } from './_build/_wa.mjs';
import fs from 'node:fs';
let pass = 0, fail = 0;
const check = (l, c, d) => { if (c) { pass++; console.log('  ✓ ' + l); } else { fail++; console.log('  ✗ ' + l + (d !== undefined ? '  -> ' + JSON.stringify(d).slice(0, 200) : '')); } };
const B64 = 'SUQzBAAAAAAA';  // a few real bytes, base64

check('the model list is the Workers AI ones, cheapest first, ElevenLabs not among them', TTS_MODELS.length === 2 && TTS_MODELS[0].id === '@cf/myshell-ai/melotts' && TTS_MODELS.every((m) => m.id.indexOf('@cf/') === 0 && !/elevenlabs/i.test(m.id)));

// the three shapes a model answers with, and three that are not audio
check('ttsBytes: raw bytes come back as they are', ttsBytes(new Uint8Array([1, 2, 3])).length === 3 && ttsBytes(new Uint8Array([1, 2, 3])[0] === undefined ? new Uint8Array([1]) : new Uint8Array([1, 2, 3])).length === 3);
check('ttsBytes: an ArrayBuffer becomes bytes', ttsBytes(new Uint8Array([1, 2, 3, 4]).buffer).length === 4);
check('ttsBytes: base64, plain or as a data: url, becomes the same bytes', ttsBytes(B64).length === ttsBytes({ audio: 'data:audio/mpeg;base64,' + B64 }).length && ttsBytes(B64).length > 3);
for (const bad of [null, undefined, {}, { ms: 5 }, 42]) {
  let threw = false; try { ttsBytes(bad); } catch (e) { threw = true; }
  check('ttsBytes: ' + JSON.stringify(bad) + ' is not audio and throws', threw);
}

// a model that streams its audio
{
  const chunks = [new Uint8Array([1, 2]), new Uint8Array([3])];
  let i = 0;
  const env = { AI: { run: async (id, input) => { check('aiTts: the Hebrew text and the language go to the model', input.prompt === 'שלום' && input.lang === 'he'); return { getReader: () => ({ read: async () => (i < chunks.length ? { done: false, value: chunks[i++] } : { done: true }) }) }; } } };
  const b = await aiTts(env, TTS_MODELS[0], 'שלום');
  check('aiTts: a streamed answer is joined in order', b.length === 3 && b[0] === 1 && b[2] === 3);
}
{
  const env = { AI: { run: async () => ({ audio: B64 }) } };
  check('aiTts: a model that answers {audio: base64} works too', (await aiTts(env, { id: '@cf/deepgram/aura-1', mime: 'audio/mpeg' }, 'בדיקה')).length > 3);
  const bad = { AI: { run: async () => ({ oops: 1 }) } };
  let threw = false; try { await aiTts(bad, TTS_MODELS[0], 'בדיקה'); } catch (e) { threw = true; }
  check('aiTts: an answer that is not audio throws, so the probe reports the model as failed', threw);
}

// sending it to Michael
{
  const f0 = globalThis.fetch; const calls = [];
  globalThis.fetch = async (u, i) => { calls.push(String(u)); return String(u).includes('/media') ? new Response('{"id":"mid1"}', { status: 200 }) : new Response('{"messages":[{"id":"wamid.1"}]}', { status: 200 }); };
  const env = { META_PHONE_NUMBER_ID: '1', META_ACCESS_TOKEN: 't' };
  const r = await sendVoiceToOwner(env, '972', new Uint8Array([1, 2, 3]), 'audio/mpeg', true);
  check('the audio is uploaded and then sent as a voice message, not as a document', r.ok && r.via === 'audio' && calls.length === 2 && calls[0].includes('/media') && calls[1].includes('/messages'));
  check('outside the 24-hour window nothing is sent', (await sendVoiceToOwner(env, '972', new Uint8Array([1]), 'audio/mpeg', false)).ok === false);
  check('empty audio, or more than the limit, is not sent', (await sendVoiceToOwner(env, '972', new Uint8Array(0), 'audio/mpeg', true)).error === 'size' && (await sendVoiceToOwner(env, '972', new Uint8Array(TTS_MAX + 1), 'audio/mpeg', true)).error === 'size');
  globalThis.fetch = f0;
}

// the op's own guards, in the source
{
  const src = fs.readFileSync(new URL('../../functions/api/routine-db.js', import.meta.url), 'utf8');
  const op = src.split("if (body.op === 'tts_probe') {")[1].split("if (body.op === 'ocr_probe')")[0];
  check('tts_probe: only its own fields are accepted', /\['op', 'agent', 'text', 'model', 'send'\]/.test(op));
  check('tts_probe: the text is the caller\'s own, 4 to 300 characters, never a row from the database', /text: 4-300 characters/.test(op) && !/select|sbJson|from\(/.test(op));
  check('tts_probe: without the Workers AI binding it answers instead of throwing', /Workers AI binding missing/.test(op));
  check('tts_probe: an unknown model name is refused with the list', /model: ' \+ TTS_MODELS\.map/.test(op));
  check('tts_probe: a model that fails is reported, and the next one still runs', /catch \(e\) \{ res\.push\(\{ model: m\.id/.test(op));
  check('nothing but the probe reads anything aloud (no other caller of aiTts)', (src.match(/aiTts\(/g) || []).length === 1 && !/aiTts/.test(fs.readFileSync(new URL('../../functions/api/wa-hook.js', import.meta.url), 'utf8')));
}
// 13/11/2026: the Hebrew voice that already reads the induction (Gemini, talk.js), as a WAV file for WhatsApp
{
  const { ssePcm, wavOf, ttsWav } = await import('./_build/talk.mjs');
  const b64 = (a) => Buffer.from(Uint8Array.from(a)).toString('base64');
  const sse = 'data: ' + JSON.stringify({ candidates: [{ content: { parts: [{ inlineData: { mimeType: 'audio/L16;codec=pcm;rate=24000', data: b64([1, 0, 2, 0, 1, 0, 2, 0, 1, 0]) } }] } }] }) + '\n\n' +
    'data: ' + JSON.stringify({ type: 'content.delta', delta: { type: 'audio', data: b64([3, 0, 3, 0, 3, 0, 3, 0, 3, 0]), mime_type: 'audio/l16', sample_rate: 24000 } }) + '\n\ndata: [DONE]\n';
  const p = ssePcm(sse);
  check('ssePcm: audio parts from both API shapes are joined in order; the rate is read; a non-JSON event is skipped', p.pcm.length === 20 && p.pcm[0] === 1 && p.pcm[10] === 3 && p.rate === 24000, p);
  check('ssePcm: an answer with no audio gives no bytes', ssePcm('data: {"x":1}\n').pcm.length === 0);
  const w = wavOf(new Uint8Array([1, 0, 2, 0]), 24000), v = new DataView(w.buffer);
  check('wavOf: a 44-byte RIFF/WAVE header, mono 16-bit at the rate, then the samples', w.length === 48 && String.fromCharCode(...w.slice(0, 4)) === 'RIFF' && String.fromCharCode(...w.slice(8, 12)) === 'WAVE' && v.getUint16(22, true) === 1 && v.getUint32(24, true) === 24000 && v.getUint16(34, true) === 16 && v.getUint32(40, true) === 4 && w[44] === 1);
  const f0 = globalThis.fetch;
  globalThis.fetch = async () => new Response(sse, { status: 200 });
  const ok = await ttsWav({ GEMINI_API_KEY: 'k' }, 'שלום מיכאל', 'he');
  globalThis.fetch = async () => new Response('{"error":"x"}', { status: 400 });
  const bad = await ttsWav({ GEMINI_API_KEY: 'k' }, 'שלום', 'he');
  globalThis.fetch = f0;
  check('ttsWav: the stream becomes one WAV file; a refused call and no key are errors, not a throw', ok.bytes && ok.bytes.length === 64 && bad.error && (await ttsWav({}, 'שלום', 'he')).error === 'no key', { ok: !!ok.bytes, bad });
  const src = fs.readFileSync(new URL('../../functions/api/routine-db.js', import.meta.url), 'utf8');
  const op = src.split("if (body.op === 'tts_probe') {")[1].slice(0, 4000);
  check('tts_probe gemini: goes as a document (WhatsApp takes no raw PCM as voice), only to Michael, and does not need Workers AI', /model === TTS_GEMINI/.test(op) && /sendDocToOwner\(env, to, w\.bytes/.test(op) && op.indexOf('TTS_GEMINI') < op.indexOf('Workers AI binding missing'));
}
console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
