// A WhatsApp voice message to text (07/11/2026, Michael in the questionnaire: "do it: a voice message to the assistant", after the
// n8n-workflows review): routine-db wa_media reads only images and PDF, so a voice note reached the assistant as
// "type: audio (not text)". wa-hook transcribes it here, on arrival, with _stt.js (Whisper on Workers AI, measured
// on Hebrew 25/10/2026), and the transcript becomes the message text with VOICE_MARK in front. Nothing is kept: the
// audio is read from Meta, transcribed and dropped. A voice message never takes the fast lane (an approval stays a
// tap or typed text, so a transcription slip cannot approve anything); wa-hook checks isVoice().
import { tmo } from './_shared.js';
import { META_API_VERSION } from './_wa.js';
import { STT_MODEL, STT_MAX, transcribe } from './_stt.js';

export const VOICE_MODEL = STT_MODEL;
// the whole step. wa-hook runs in waitUntil (about 30 seconds) and the fire after it can take up to 20 (review 07/11/2026)
export const VOICE_MS = 10000;
export const VOICE_MARK = '\ud83c\udfa4 ';  // the microphone, so the log, the chat and the assistant see it was spoken
export const VOICE_TEXT_MAX = 3000;

export function isVoice(m) {
  return !!(m && m.type === 'audio' && m.media && m.media.id);
}

// Only Meta's own download hosts get the token (the same rule as routine-db wa_media).
export function metaMediaHostOk(u) {
  return /^https:\/\/[a-z0-9.-]+\.(fbsbx|fbcdn|whatsapp)\.(com|net)\//.test(String(u || ''));
}

// The body, stopped at max bytes (a missing file_size or content-length must not load a 16MB file; review 07/11/2026).
export async function readCapped(resp, max) {
  if (!resp.body || typeof resp.body.getReader !== 'function') { const b = new Uint8Array(await resp.arrayBuffer()); return b.length > max ? null : b; }
  const rd = resp.body.getReader(), parts = []; let n = 0;
  for (;;) {
    const { done, value } = await rd.read();
    if (done) break;
    n += value.length;
    if (n > max) { await rd.cancel().catch(() => {}); return null; }
    parts.push(value);
  }
  const out = new Uint8Array(n); let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}

// The WhatsApp media id -> {ok, text} or {ok:false, error}. Never throws, and gives up after VOICE_MS.
export async function voiceText(env, mediaId, fetchFn) {
  const f = fetchFn || fetch;
  const work = (async () => {
    if (!/^[0-9]{5,30}$/.test(String(mediaId || ''))) return { ok: false, error: 'bad media id' };
    if (!env.META_ACCESS_TOKEN) return { ok: false, error: 'whatsapp not configured' };
    const auth = { Authorization: 'Bearer ' + env.META_ACCESS_TOKEN };
    const mr = await f('https://graph.facebook.com/' + META_API_VERSION + '/' + mediaId, { headers: auth, redirect: 'manual', signal: tmo(4000) });
    const meta = await mr.json().catch(() => null);
    if (!mr.ok || !meta || !meta.url) return { ok: false, error: 'media ' + mr.status };
    if (Number(meta.file_size) > STT_MAX) return { ok: false, error: 'too long: ' + meta.file_size + ' bytes' };
    if (!metaMediaHostOk(meta.url)) return { ok: false, error: 'unexpected media host' };
    // no redirect: the token goes only to the host checked above (review 07/11/2026)
    const fr = await f(meta.url, { headers: auth, redirect: 'manual', signal: tmo(6000) });
    if (!fr.ok) return { ok: false, error: 'download ' + fr.status };
    if (Number(fr.headers.get('content-length')) > STT_MAX) return { ok: false, error: 'too long: ' + fr.headers.get('content-length') + ' bytes' };
    const bytes = await readCapped(fr, STT_MAX);
    if (!bytes) return { ok: false, error: 'too long: over ' + STT_MAX + ' bytes' };
    const t = await transcribe(env, bytes);
    return t.ok ? { ok: true, text: String(t.text).slice(0, VOICE_TEXT_MAX) } : { ok: false, error: String(t.error).slice(0, 120) };
  })().catch((e) => ({ ok: false, error: String((e && e.message) || e).slice(0, 120) }));
  let timer;
  const late = new Promise((res) => { timer = setTimeout(() => res({ ok: false, error: 'timeout ' + VOICE_MS + ' ms' }), VOICE_MS); });
  try { return await Promise.race([work, late]); } finally { clearTimeout(timer); }
}
