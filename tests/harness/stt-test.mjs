// Voice to text on the server (25/10/2026). It began as the 🎤 of /chat; Michael tried it and asked to remove it
// ("it transcribes me and then writes it as text"), so the chat has no microphone and the iPhone keyboard dictates.
// What stays is the transcription itself (_stt.js, routine-db op 'stt'): audio by its bytes, Whisper asked in Hebrew.
import { readFileSync } from 'node:fs';
import { sttKind, transcribe, b64, STT_MODEL, STT_MAX } from './_build/_stt.mjs';
import { chatPage } from './_build/chat-page.mjs';

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

console.log('\n2. the chat has no microphone (25/10/2026, Michael: "it transcribes me and then writes it as text. Can it be removed?")');
{
  const page = chatPage(), api = readFileSync(new URL('../../functions/api/chat.js', import.meta.url), 'utf8');
  check('no 🎤 button, no recorder, no speech recognition in the page; /api/chat has no ?stt', !/id=\"?mic/.test(page) && !/MediaRecorder|SpeechRecognition|getUserMedia/.test(page) && !/stt/.test(api));
  check('the transcription stays for the server (routine-db op stt)', /body\.op === 'stt'/.test(readFileSync(new URL('../../functions/api/routine-db.js', import.meta.url), 'utf8')));
}

console.log(`\nstt-test: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
