// Text from scanned PDFs (24/10/2026). Shared by routine-db (ocr_txt, ocr_probe) and the 5-minute watch in
// wa-morning, which reads each new PDF in the mail inbox on its own (Michael in the questionnaire: "do it: automatic").
// Workers AI (free quota, the scan stays inside our Cloudflare account); the text goes to _\u05d8\u05e7\u05e1\u05d8 \u05e1\u05e8\u05d9\u05e7\u05d5\u05ea/<name>.txt
// and Claude reads it with the Microsoft 365 connector.
export const OD_OCR_DIR = '_\u05d8\u05e7\u05e1\u05d8 \u05e1\u05e8\u05d9\u05e7\u05d5\u05ea';
// Workers AI fallback (24/10/2026, no Azure subscription; Michael in the questionnaire: "do it: test Workers AI"):
// a scanned PDF holds each page as a JPEG stream (DCTDecode); the first OCR_PAGES of them go to a vision model.
export const OCR_MODELS = ['@cf/meta/llama-4-scout-17b-16e-instruct', '@cf/mistralai/mistral-small-3.1-24b-instruct', '@cf/google/gemma-3-12b-it', '@cf/meta/llama-3.2-11b-vision-instruct'];
export const OCR_PAGES = 3;
export const OCR_PROMPT = 'Transcribe all the text in this scanned document exactly, line by line, in its original language (mostly Hebrew). Keep numbers and dates as written. Output only the text, no comments.';
export function pdfJpegs(buf, max) {
  const out = [];
  for (let i = 0; i + 1 < buf.length && out.length < max; i++) {
    if (buf[i] !== 0xFF || buf[i + 1] !== 0xD8 || buf[i + 2] !== 0xFF) continue;
    let j = i + 2;
    while (j + 1 < buf.length && !(buf[j] === 0xFF && buf[j + 1] === 0xD9)) j++;
    if (j + 1 >= buf.length) break;
    if (j - i > 2000) out.push(buf.subarray(i, j + 2));
    i = j + 1;
  }
  return out;
}
export async function aiOcr(env, model, jpg) {
  let bin = ''; for (let i = 0; i < jpg.length; i += 0x8000) bin += String.fromCharCode.apply(null, jpg.subarray(i, i + 0x8000));
  const input = model.indexOf('llama-3.2') >= 0 ? { prompt: OCR_PROMPT, image: Array.from(jpg), max_tokens: 1500 }
    : { messages: [{ role: 'user', content: [{ type: 'text', text: OCR_PROMPT }, { type: 'image_url', image_url: { url: 'data:image/jpeg;base64,' + btoa(bin) } }] }], max_tokens: 1500 };
  const r = await env.AI.run(model, input);
  return String((r && (r.response || (r.choices && r.choices[0] && r.choices[0].message && r.choices[0].message.content))) || '').trim();
}
// The lines of an Azure Read result, page by page.
export function ocrLines(j) {
  const pages = (j && j.analyzeResult && j.analyzeResult.readResults) || [];
  return pages.map((p) => ((p && p.lines) || []).map((l) => String((l && l.text) || '')).join('\n')).join('\n\n').trim();
}
// The safety folder and the mail inbox, as routine-db's OD_ROOT and OD_INBOX (the test checks they match).
export const OCR_ROOT = '\u05e9\u05d5\u05dc\u05d7\u05df \u05d4\u05e2\u05d1\u05d5\u05d3\u05d4/\u05e0\u05d9\u05d4\u05d5\u05dc \u05d1\u05d8\u05d9\u05d7\u05d5\u05ea/';
export const OCR_INBOX = '_\u05e0\u05db\u05e0\u05e1 \u05de\u05d4\u05de\u05d9\u05d9\u05dc';
export const OCR_AUTO_KEY = 'ocr_auto', OCR_AUTO_GAP_MS = 10 * 60e3, OCR_AUTO_DAYS = 3, OCR_DONE_MAX = 300;
// The next inbox PDF to read: a PDF from the last OCR_AUTO_DAYS days, not done yet, oldest first.
export function ocrAutoPick(items, done, nowMs) {
  const seen = new Set(done || []);
  return (items || []).filter((x) => x && x.file && /\.pdf$/i.test(String(x.name || '')) && !seen.has(x.name)
    && nowMs - (Date.parse(x.createdDateTime) || 0) <= OCR_AUTO_DAYS * 864e5)
    .sort((a, b) => Date.parse(a.createdDateTime) - Date.parse(b.createdDateTime))[0] || null;
}
// One PDF of the drive (path under OCR_ROOT) to a txt beside the others. Never returns the text.
export async function ocrOne(env, token, rel, name, model) {
  const enc = (p) => p.split('/').filter(Boolean).map(encodeURIComponent).join('/');
  const G = 'https://graph.microsoft.com/v1.0/me/drive/root:/';
  const d = await fetch(G + enc(OCR_ROOT + rel) + ':/content', { headers: { Authorization: 'Bearer ' + token }, signal: AbortSignal.timeout(30000) });
  if (!d.ok) return { name, ok: false, error: d.status === 404 ? 'file not found' : 'read ' + d.status };
  const buf = new Uint8Array(await d.arrayBuffer());
  if (buf.length > 4 * 1024 * 1024) return { name, ok: false, error: 'too big: ' + buf.length };
  const pages = pdfJpegs(buf, OCR_PAGES);
  if (!pages.length) return { name, ok: false, error: 'no scanned page image in this PDF' };
  const parts = [];
  for (const pg of pages) parts.push(await aiOcr(env, model, pg));
  const text = parts.join('\n\n').trim();
  const txt = name.replace(/\.pdf$/i, '') + '.txt';
  const up = await fetch(G + enc(OCR_ROOT + OD_OCR_DIR + '/' + txt) + ':/content?@microsoft.graph.conflictBehavior=replace', { method: 'PUT', signal: AbortSignal.timeout(20000),
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'text/plain; charset=utf-8' }, body: text });
  return { name, ok: up.ok && text.length > 0, txt: OD_OCR_DIR + '/' + txt, chars: text.length, pages: pages.length, engine: model, error: up.ok ? (text ? undefined : 'no text found') : 'write ' + up.status };
}
