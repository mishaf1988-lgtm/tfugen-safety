// A voice message to text (25/10/2026, Michael: "a text-only recording is what my iPhone keyboard already does; a
// transcribed recording is useful"; in the questionnaire: "do it: a transcribed voice message"). The phone records
// (MediaRecorder: webm/opus on Android, mp4/aac on an iPhone), the server writes it out with Whisper on Workers AI
// (the AI binding the OCR already uses), and the text goes into the box for him to fix before he sends it.
// Used by /api/chat?stt=1 and by routine-db op 'stt' (so a cloud session can check it on a real recording).
export const STT_MODEL = '@cf/openai/whisper-large-v3-turbo';
export const STT_MAX = 6 * 1024 * 1024; // about 6 minutes of opus, 3 of aac; the page stops at 3 minutes

// by the bytes, never by the name or the header the phone sends
export function sttKind(b) {
  if (!b || b.length < 12) return null;
  if (b[0] === 0x1A && b[1] === 0x45 && b[2] === 0xDF && b[3] === 0xA3) return 'webm';
  if (b[4] === 0x66 && b[5] === 0x74 && b[6] === 0x79 && b[7] === 0x70) return 'mp4';
  if (b[0] === 0x4F && b[1] === 0x67 && b[2] === 0x67 && b[3] === 0x53) return 'ogg';
  if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x41) return 'wav';
  if ((b[0] === 0x49 && b[1] === 0x44 && b[2] === 0x33) || (b[0] === 0xFF && (b[1] & 0xE0) === 0xE0)) return 'mp3';
  return null;
}

export function b64(bytes) {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

// { ok, text } or { ok: false, error }. Never throws.
export async function transcribe(env, bytes) {
  if (!sttKind(bytes)) return { ok: false, error: 'not audio (webm, mp4, ogg, wav, mp3)' };
  if (bytes.length > STT_MAX) return { ok: false, error: 'audio over ' + (STT_MAX >> 20) + 'MB' };
  if (!env || !env.AI || typeof env.AI.run !== 'function') return { ok: false, error: 'no Workers AI binding' };
  try {
    const r = await env.AI.run(STT_MODEL, { audio: b64(bytes), language: 'he', task: 'transcribe', vad_filter: true });
    const text = String((r && r.text) || '').replace(/\s+/g, ' ').trim();
    return text ? { ok: true, text } : { ok: false, error: 'nothing heard' };
  } catch (e) { return { ok: false, error: 'stt: ' + String(e && e.message || e).slice(0, 160) }; }
}
