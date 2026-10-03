// A recommended corrective action for a trustee finding (28/09, Michael: "the
// trustee does not think about it, you fill it in and I decide"). Asked from
// the same assistant the app uses (Gemini, env.GEMINI_API_KEY / GEMINI_MODEL).
// Returns a short Hebrew sentence, or null on any failure: the caller simply
// tries again on its next run, and the manager can always type one.

const DEFAULT_MODEL = 'gemini-flash-latest';
const TIMEOUT_MS = 20000;

const SYSTEM = '\u05d0\u05ea\u05d4 \u05de\u05de\u05d5\u05e0\u05d4 \u05d1\u05d8\u05d9\u05d7\u05d5\u05ea \u05d1\u05de\u05e4\u05e2\u05dc \u05de\u05d6\u05d5\u05df \u05d1\u05d9\u05e9\u05e8\u05d0\u05dc. \u05db\u05ea\u05d5\u05d1 \u05e4\u05e2\u05d5\u05dc\u05d4 \u05de\u05ea\u05e7\u05e0\u05ea \u05d0\u05d7\u05ea, \u05de\u05e2\u05e9\u05d9\u05ea \u05d5\u05e7\u05e6\u05e8\u05d4 (\u05e2\u05d3 25 \u05de\u05d9\u05dc\u05d9\u05dd), \u05d1\u05e2\u05d1\u05e8\u05d9\u05ea, \u05d1\u05dc\u05e9\u05d5\u05df \u05e6\u05d9\u05d5\u05d5\u05d9 (\u05dc\u05ea\u05e7\u05df, \u05dc\u05d4\u05ea\u05e7\u05d9\u05df, \u05dc\u05e1\u05de\u05df...), \u05dc\u05de\u05de\u05e6\u05d0 \u05e9\u05e0\u05de\u05e6\u05d0 \u05d1\u05e1\u05d9\u05d5\u05e8 \u05d1\u05d8\u05d9\u05d7\u05d5\u05ea. \u05d1\u05dc\u05d9 \u05d4\u05e7\u05d3\u05de\u05d4, \u05d1\u05dc\u05d9 \u05de\u05e1\u05e4\u05d5\u05e8, \u05d1\u05dc\u05d9 \u05de\u05e8\u05db\u05d0\u05d5\u05ea, \u05e9\u05d5\u05e8\u05d4 \u05d0\u05d7\u05ea \u05d1\u05dc\u05d1\u05d3.';

export function cleanAction(t) {
  let s = String(t || '').replace(/\r/g, '').split('\n').map((x) => x.trim()).filter(Boolean)[0] || '';
  s = s.replace(/^[-*\d.)\s]+/, '').replace(/^["'`]+|["'`]+$/g, '').replace(/\*\*/g, '').trim();
  // Keyboard characters only (CLAUDE.md): the text goes into a file and a mail.
  s = s.replace(/[\u2013\u2014\u05be]/g, '-').replace(/[\u201c\u201d\u05f4]/g, '"').replace(/[\u2018\u2019\u05f3]/g, "'").replace(/\u2026/g, '...');
  return s.length >= 6 ? s.substring(0, 300) : null;
}

export async function suggestAction(env, finding) {
  const key = env && env.GEMINI_API_KEY;
  if (!key) return null;
  const model = env.GEMINI_MODEL || DEFAULT_MODEL;
  const text = '\u05de\u05de\u05e6\u05d0: ' + String(finding.f || '').substring(0, 300) + '\n\u05de\u05d9\u05e7\u05d5\u05dd: ' + String(finding.loc || '').substring(0, 120);
  try {
    const r = await fetch('https://generativelanguage.googleapis.com/v1beta/models/' + encodeURIComponent(model) + ':generateContent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({ systemInstruction: { parts: [{ text: SYSTEM }] }, contents: [{ role: 'user', parts: [{ text }] }], generationConfig: { maxOutputTokens: 2048 } }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!r.ok) return null;
    const j = await r.json();
    const parts = (j && j.candidates && j.candidates[0] && j.candidates[0].content && j.candidates[0].content.parts) || [];
    return cleanAction(parts.filter((p) => p && typeof p.text === 'string' && !p.thought).map((p) => p.text).join(''));
  } catch (e) { return null; }
}

// A name typed by a worker who is not on the list (03/10/2026, Michael: "an
// option for every worker", and "the documentation must be in Hebrew whatever
// language the workers wrote in"). A name already in Hebrew letters is kept as
// typed; any other is written in Hebrew letters by the assistant. The answer is
// accepted only if it is Hebrew letters, spaces and . ' " - (60 at most), so a
// "name" that tries to steer the assistant gives nothing usable. null = failed.
export function heName(t) {
  const s = String(t || '').replace(/\s+/g, ' ').trim().replace(/\u05f3/g, "'").replace(/\u05f4/g, '"');
  return /^[\u05d0-\u05ea][\u05d0-\u05ea'". -]{0,59}$/.test(s) ? s : null;
}
export async function hebrewName(env, raw) {
  const direct = heName(raw);
  if (direct) return direct;
  const key = env && env.GEMINI_API_KEY;
  if (!key) return null;
  const model = env.GEMINI_MODEL || DEFAULT_MODEL;
  const text = 'Write this name of a person or of a company in Hebrew letters, the way an Israeli would spell it. Output only the name in Hebrew letters, with no notes. The name:\n' + String(raw || '').substring(0, 60);
  try {
    const r = await fetch('https://generativelanguage.googleapis.com/v1beta/models/' + encodeURIComponent(model) + ':generateContent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text }] }], generationConfig: { maxOutputTokens: 1024 } }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!r.ok) return null;
    const j = await r.json();
    const parts = (j && j.candidates && j.candidates[0] && j.candidates[0].content && j.candidates[0].content.parts) || [];
    const out = parts.filter((p) => p && typeof p.text === 'string' && !p.thought).map((p) => p.text).join('').split('\n').map((x) => x.trim()).filter(Boolean)[0];
    return heName(out);
  } catch (e) { return null; }
}
