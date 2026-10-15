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
// Curly quotes and the acute accent of a phone keyboard (U+2018 U+2019 U+201B U+00B4, U+201C U+201D U+201E)
// are the plain ' and " that a name needs (15/10/2026, review of the signing pages: iOS types them).
export const plainQuotes = (s) => String(s || '').replace(/[\u2018\u2019\u201b\u00b4\u05f3]/g, "'").replace(/[\u201c\u201d\u201e\u05f4]/g, '"');
// max: 60 for what a person types; the assistant's spelling of a long Arabic name may run to 80 (15/10/2026).
export function heName(t, max) {
  const s = plainQuotes(String(t || '').replace(/\s+/g, ' ').trim());
  const n = Math.max(0, (max || 60) - 1);
  return new RegExp('^[\\u05d0-\\u05ea][\\u05d0-\\u05ea\'". -]{0,' + n + '}$').test(s) ? s : null;
}
// Free text that is not a name (job, agency, company, with a digit or a slash): Hebrew letters with digits
// and common punctuation are kept as typed (15/10/2026). Moved here from talk.js beside hebrewText.
export function heText(t) {
  const s = plainQuotes(String(t || '').replace(/\s+/g, ' ').trim());
  return /^(?=.*[\u05d0-\u05ea])[\u05d0-\u05ea0-9'". ,/()&+-]{1,60}$/.test(s) ? s : null;
}
async function geminiLine(env, text) {
  const key = env && env.GEMINI_API_KEY;
  if (!key) return null;
  const model = env.GEMINI_MODEL || DEFAULT_MODEL;
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
    return parts.filter((p) => p && typeof p.text === 'string' && !p.thought).map((p) => p.text).join('').split('\n').map((x) => x.trim()).filter(Boolean)[0] || null;
  } catch (e) { return null; }
}
export async function hebrewName(env, raw) {
  const direct = heName(raw);
  if (direct) return direct;
  const out = await geminiLine(env, 'Write this name of a person or of a company in Hebrew letters, the way an Israeli would spell it. Output only the name in Hebrew letters, with no notes. The name:\n' + String(raw || '').substring(0, 60));
  return heName(out, 80);
}
// A job, an agency or a company in Hebrew letters (15/10/2026): the answer is checked as text (digits kept),
// not as a name, so a job with a line number is not refused for its digit.
export async function hebrewText(env, raw) {
  const direct = heText(raw);
  if (direct) return direct;
  const out = await geminiLine(env, 'Write this job title, department or company name in Hebrew letters, the way an Israeli would write it. Keep any digits. Output only the Hebrew text, with no notes. The text:\n' + String(raw || '').substring(0, 60));
  return heText(out);
}
