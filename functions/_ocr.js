// Text from scanned PDFs (24/10/2026). Shared by routine-db (ocr_txt, ocr_probe) and the 5-minute watch in
// wa-morning, which reads each new PDF in the mail inbox on its own (Michael in the questionnaire: "do it: automatic").
// Workers AI (free quota, the scan stays inside our Cloudflare account); the text goes to _\u05d8\u05e7\u05e1\u05d8 \u05e1\u05e8\u05d9\u05e7\u05d5\u05ea/<name>.txt
// and Claude reads it with the Microsoft 365 connector.
export const OD_OCR_DIR = '_\u05d8\u05e7\u05e1\u05d8 \u05e1\u05e8\u05d9\u05e7\u05d5\u05ea';
// Workers AI fallback (24/10/2026, no Azure subscription; Michael in the questionnaire: "do it: test Workers AI"):
// a scanned PDF holds each page as a JPEG stream (DCTDecode); the first OCR_PAGES of them go to a vision model.
export const OCR_MODELS = ['@cf/meta/llama-4-scout-17b-16e-instruct', '@cf/mistralai/mistral-small-3.1-24b-instruct', '@cf/google/gemma-3-12b-it', '@cf/meta/llama-3.2-11b-vision-instruct'];
export const OCR_PAGES = 3, OCR_MAX_PAGES = 60;
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
export async function aiOcr(env, model, jpg, mime) {
  let bin = ''; for (let i = 0; i < jpg.length; i += 0x8000) bin += String.fromCharCode.apply(null, jpg.subarray(i, i + 0x8000));
  const input = model.indexOf('llama-3.2') >= 0 ? { prompt: OCR_PROMPT, image: Array.from(jpg), max_tokens: 1500 }
    : { messages: [{ role: 'user', content: [{ type: 'text', text: OCR_PROMPT }, { type: 'image_url', image_url: { url: 'data:' + (mime || 'image/jpeg') + ';base64,' + btoa(bin) } }] }], max_tokens: 1500 };
  const r = await env.AI.run(model, input);
  return String((r && (r.response || (r.choices && r.choices[0] && r.choices[0].message && r.choices[0].message.content))) || '').trim();
}
// 27/10/2026 (Michael's inspector scans from OmniPage: "no scanned page image" on a filed page, "read" on the 6-page
// original): each page JPEG sat in a /Filter [/FlateDecode /DCTDecode] stream, so the raw FFD8 search above found
// nothing, or a false FFD8 inside deflated bytes that the model then refused. Here the image streams are found by
// their dictionary, inflated when Flate comes first, and returned in file order (= page order for a scan).
// Safety (27/10/2026 review: the PDF comes from outside): at most `max` images, a dictionary looked at within 4 KB of
// its filter, and an inflated image cut off at OCR_INFLATE_MAX, so a deflate bomb or thousands of images cannot
// exhaust the isolate. Only the pages in [lo, hi) are inflated; the others count as pages without being read.
export const OCR_INFLATE_MAX = 8 * 1024 * 1024;
async function inflateCapped(bytes) {
  const rd = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate')).getReader();
  const parts = []; let n = 0;
  for (;;) {
    const { done, value } = await rd.read();
    if (done) break;
    n += value.length;
    if (n > OCR_INFLATE_MAX) { await rd.cancel().catch(() => {}); throw new Error('image over ' + (OCR_INFLATE_MAX >> 20) + ' MB inflated'); }
    parts.push(value);
  }
  const out = new Uint8Array(n); let o = 0; for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}
export async function pdfDct(buf, max, lo, hi) {
  max = max || 60; lo = lo || 0; hi = hi === undefined ? max : hi;
  let s = ''; for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000));
  const out = [];
  let at = 0;
  while (out.length < max) {
    const f = s.indexOf('/DCTDecode', at);
    if (f < 0) break;
    at = f + 10;
    const st = s.lastIndexOf(' obj', f), sk = s.indexOf('stream', f);
    if (st < 0 || sk < 0 || f - st > 4096 || sk - f > 4096) continue;
    const d = s.slice(st, sk);
    if (!/\/Subtype\s*\/Image/.test(d)) continue;
    const fm = d.match(/\/Filter\s*(\[[^\]]*\]|\/\w+)/);
    const filters = (fm ? fm[1].match(/\/\w+/g) : null) || [];
    if (filters[filters.length - 1] !== '/DCTDecode' || filters.slice(0, -1).some((x) => x !== '/FlateDecode')) continue;
    let len = null; const lm = d.match(/\/Length\s+(\d+)(\s+(\d+)\s+R)?/);
    if (lm && !lm[2]) len = Number(lm[1]);
    else if (lm) { const r = s.match(new RegExp('(?:^|[^0-9])' + lm[1] + '\\s+' + lm[3] + '\\s+obj\\s*(\\d+)')); if (r) len = Number(r[1]); }
    let p = sk + 6; if (s[p] === '\r') p++; if (s[p] === '\n') p++;
    if (len === null) { const e = s.indexOf('endstream', p); if (e < 0) continue; len = e - p; }
    let jpg = buf.subarray(p, p + len);
    at = p + len;
    const idx = out.length;
    if (idx < lo || idx >= hi) { out.push(null); continue; } // a page outside this call: counted, not read
    for (let k = 1; k < filters.length; k++) jpg = await inflateCapped(jpg);
    if (jpg.length > OCR_INFLATE_MAX) throw new Error('image over ' + (OCR_INFLATE_MAX >> 20) + ' MB');
    out.push(jpg[0] === 0xFF && jpg[1] === 0xD8 && jpg.length > 2000 ? jpg : null); // null keeps the page numbers
  }
  return out;
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
// from (27/10/2026): the first page of this call, 1-based. A scan longer than OCR_PAGES is read in calls of OCR_PAGES pages
// (a 6-page inspector scan stopped at 3); from > 1 appends to the same txt. `next` = the from of the next call.
export async function ocrOne(env, token, rel, name, model, from) {
  from = Math.max(1, Number(from) || 1);
  const enc = (p) => p.split('/').filter(Boolean).map(encodeURIComponent).join('/');
  const G = 'https://graph.microsoft.com/v1.0/me/drive/root:/';
  const d = await fetch(G + enc(OCR_ROOT + rel) + ':/content', { headers: { Authorization: 'Bearer ' + token }, signal: AbortSignal.timeout(30000) });
  if (!d.ok) return { name, ok: false, error: d.status === 404 ? 'file not found' : 'read ' + d.status };
  const buf = new Uint8Array(await d.arrayBuffer());
  if (buf.length > 4 * 1024 * 1024) return { name, ok: false, error: 'too big: ' + buf.length };
  const MAXP = OCR_MAX_PAGES;
  let all = await pdfDct(buf, MAXP, from - 1, from - 1 + OCR_PAGES), mime = 'image/jpeg', ccitt = null;
  if (!all.length) all = pdfJpegs(buf, MAXP); // no image object found by its dictionary: the raw search, as before
  if (!all.length) { mime = 'image/png'; ccitt = pdfCcitt(buf, MAXP); }
  const total = ccitt ? ccitt.length : all.length;
  if (!total) return { name, ok: false, error: 'no scanned page image in this PDF (JPEG or CCITT Group 4)' };
  if (from > total) return { name, ok: false, error: 'from ' + from + ': the PDF has ' + total + ' pages' };
  const last = Math.min(total, from + OCR_PAGES - 1);
  const pages = [];
  try { for (let i = from - 1; i < last; i++) pages.push(ccitt ? await ccittPng(ccitt[i]) : all[i]); } catch (e) { return { name, ok: false, error: String((e && e.message) || e).slice(0, 120) }; }
  const parts = []; let readAny = false; // a page with real text; the headers alone are not text (28/10/2026 retro)
  for (let i = 0; i < pages.length; i++) { const t1 = pages[i] ? String(await aiOcr(env, model, pages[i], mime) || '').trim() : ''; if (t1) readAny = true; parts.push('--- \u05e2\u05de\u05d5\u05d3 ' + (from + i) + ' ---\n' + (t1 || '(\u05dc\u05d0 \u05e0\u05e7\u05e8\u05d0)')); }
  const txt = name.replace(/\.pdf$/i, '') + '.txt', url = G + enc(OCR_ROOT + OD_OCR_DIR + '/' + txt) + ':/content';
  let before = '';
  if (from > 1) { const o = await fetch(url, { headers: { Authorization: 'Bearer ' + token }, signal: AbortSignal.timeout(20000) }).catch(() => null);
    if (o && o.ok) before = (await o.text()).trim() + '\n\n';
    else if (!o || o.status !== 404) return { name, ok: false, error: 'could not read the earlier pages of the txt (' + (o ? o.status : 'no answer') + '): not overwritten, try again' }; } // 28/10/2026 retro: a failed read must not replace pages 1-3 with 4-6
  if (!readAny) return { name, ok: false, pages: pages.length, of: total, engine: model, error: 'no text found' }; // nothing is written: an empty read must not replace an earlier txt (28/10/2026 retro)
  const text = (before + parts.join('\n\n')).trim();
  const up = await fetch(url + '?@microsoft.graph.conflictBehavior=replace', { method: 'PUT', signal: AbortSignal.timeout(20000),
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'text/plain; charset=utf-8' }, body: text });
  return { name, ok: up.ok && readAny, txt: OD_OCR_DIR + '/' + txt, chars: text.length, pages: pages.length, of: total, next: last < total ? last + 1 : undefined, engine: model, error: up.ok ? (readAny ? undefined : 'no text found') : 'write ' + up.status };
}
// 26/10/2026 (dev request: a 5-page scan from the plant's copier, "no scanned page image in this PDF"): black and white
// scanners keep each page as a CCITT Group 4 fax image (/CCITTFaxDecode, /K -1), not a JPEG. It is decoded here, made
// half size in gray (smoother letters for the vision model) and sent as a PNG. Group 3 (/K >= 0) is not read.
const G4_WHITE = '00110101,000111,0111,1000,1011,1100,1110,1111,10011,10100,00111,01000,001000,000011,110100,110101,101010,101011,0100111,0001100,0001000,0010111,0000011,0000100,0101000,0101011,0010011,0100100,0011000,00000010,00000011,00011010,00011011,00010010,00010011,00010100,00010101,00010110,00010111,00101000,00101001,00101010,00101011,00101100,00101101,00000100,00000101,00001010,00001011,01010010,01010011,01010100,01010101,00100100,00100101,01011000,01011001,01011010,01011011,01001010,01001011,00110010,00110011,00110100';
const G4_WHITE_UP = '11011,10010,010111,0110111,00110110,00110111,01100100,01100101,01101000,01100111,011001100,011001101,011010010,011010011,011010100,011010101,011010110,011010111,011011000,011011001,011011010,011011011,010011000,010011001,010011010,011000,010011011';
const G4_BLACK = '0000110111,010,11,10,011,0011,0010,00011,000101,000100,0000100,0000101,0000111,00000100,00000111,000011000,0000010111,0000011000,0000001000,00001100111,00001101000,00001101100,00000110111,00000101000,00000010111,00000011000,000011001010,000011001011,000011001100,000011001101,000001101000,000001101001,000001101010,000001101011,000011010010,000011010011,000011010100,000011010101,000011010110,000011010111,000001101100,000001101101,000011011010,000011011011,000001010100,000001010101,000001010110,000001010111,000001100100,000001100101,000001010010,000001010011,000000100100,000000110111,000000111000,000000100111,000000101000,000001011000,000001011001,000000101011,000000101100,000001011010,000001100110,000001100111';
const G4_BLACK_UP = '0000001111,000011001000,000011001001,000001011011,000000110011,000000110100,000000110101,0000001101100,0000001101101,0000001001010,0000001001011,0000001001100,0000001001101,0000001110010,0000001110011,0000001110100,0000001110101,0000001110110,0000001110111,0000001010010,0000001010011,0000001010100,0000001010101,0000001011010,0000001011011,0000001100100,0000001100101';
const G4_EXT_UP = '00000001000,00000001100,00000001101,000000010010,000000010011,000000010100,000000010101,000000010110,000000010111,000000011100,000000011101,000000011110,000000011111';
// mode codes: pass, horizontal, and vertical a1 - b1 = -3..3
const G4_MODES = { '0001': 'P', '001': 'H', '1': 0, '011': 1, '000011': 2, '0000011': 3, '010': -1, '000010': -2, '0000010': -3 };
const codeKey = (s) => (s.length << 16) | parseInt(s, 2);
function runTable(term, up) {
  const m = new Map();
  term.split(',').forEach((c, i) => m.set(codeKey(c), i));
  up.split(',').forEach((c, i) => m.set(codeKey(c), 64 * (i + 1)));
  G4_EXT_UP.split(',').forEach((c, i) => m.set(codeKey(c), 1792 + 64 * i));
  return m;
}
let G4T = null;
function g4Tables() {
  if (!G4T) {
    const modes = new Map();
    for (const k of Object.keys(G4_MODES)) modes.set(codeKey(k), G4_MODES[k]);
    G4T = { white: runTable(G4_WHITE, G4_WHITE_UP), black: runTable(G4_BLACK, G4_BLACK_UP), modes };
  }
  return G4T;
}
// Group 4 to a gray image `scale` times smaller (each output pixel = share of white in a scale x scale block).
export function g4Gray(data, columns, rows, scale) {
  const T = g4Tables();
  let pos = 0;
  const bit = () => { const b = pos >> 3; if (b >= data.length) return -1; const v = (data[b] >> (7 - (pos & 7))) & 1; pos++; return v; };
  const code = (table, maxLen) => { let v = 0; for (let len = 1; len <= maxLen; len++) { const b = bit(); if (b < 0) return null; v = (v << 1) | b; const k = (len << 16) | v; if (table.has(k)) return table.get(k); } return null; };
  const run = (table) => { let total = 0; for (;;) { const r = code(table, 13); if (r === null) return null; total += r; if (r < 64) return total; } };
  const W = Math.ceil(columns / scale), H = Math.ceil(rows / scale);
  const out = new Uint8Array(W * H).fill(255), acc = new Uint16Array(W), line = new Uint8Array(columns); // white until a line is read (27/10/2026 retro: the rest of a broken stream stayed black)
  let ref = [columns, columns], y = 0;
  for (; y < rows; y++) {
    const cur = [];
    let a0 = -1, color = 0;
    while (a0 < columns) {
      let i = 0;
      while (i < ref.length && (ref[i] <= a0 || (i & 1) !== color)) i++;
      const b1 = i < ref.length ? ref[i] : columns, b2 = i + 1 < ref.length ? ref[i + 1] : columns;
      const m = code(T.modes, 7);
      if (m === null) break;
      if (m === 'P') { a0 = b2; continue; }
      if (m === 'H') {
        const r1 = run(color ? T.black : T.white), r2 = run(color ? T.white : T.black);
        if (r1 === null || r2 === null) { a0 = -2; break; }
        const a1 = Math.min(columns, Math.max(a0, 0) + r1), a2 = Math.min(columns, a1 + r2);
        cur.push(a1, a2); a0 = a2; continue;
      }
      const a1 = Math.min(columns, Math.max(0, b1 + m));
      cur.push(a1); a0 = a1; color ^= 1;
    }
    if (a0 === -2 || (a0 < columns && !cur.length && y > 0 && pos >= data.length * 8)) break;
    // one line: white (0) until the first change, then alternating
    line.fill(0);
    let c = 0, x = 0;
    for (const t of cur) { if (c) line.fill(1, x, Math.min(t, columns)); x = t; c ^= 1; }
    if (c && x < columns) line.fill(1, x);
    for (let k = 0; k < columns; k++) if (line[k]) acc[(k / scale) | 0]++;
    if ((y + 1) % scale === 0 || y === rows - 1) {
      const oy = (y / scale) | 0, n = scale * scale;
      for (let k = 0; k < W; k++) { out[oy * W + k] = 255 - Math.round(acc[k] * 255 / n); acc[k] = 0; }
    }
    ref = cur.concat([columns, columns]);
  }
  return { width: W, height: H, gray: out, lines: y };
}
// The CCITT page images of a PDF body, first `max`: dictionary values and the raw stream bytes.
export function pdfCcitt(buf, max) {
  let s = ''; for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000));
  const out = [];
  let at = 0;
  while (out.length < max) {
    const f = s.indexOf('/CCITTFaxDecode', at);
    if (f < 0) break;
    at = f + 15;
    const st = s.lastIndexOf(' obj', f), sk = s.indexOf('stream', f);
    if (st < 0 || sk < 0) continue;
    const d = s.slice(st, sk);
    if (!/\/Subtype\s*\/Image/.test(d) || /\/(?:Flate|LZW|DCT|ASCII85|ASCIIHex|RunLength)Decode/.test(d)) continue;
    const num = (re, dflt) => { const m = d.match(re); return m ? Number(m[1]) : dflt; };
    const k = num(/\/K\s+(-?\d+)/, 0), columns = num(/\/Columns\s+(\d+)/, num(/\/Width\s+(\d+)/, 1728));
    const rows = num(/\/Rows\s+(\d+)/, num(/\/Height\s+(\d+)/, 0));
    let len = null; const lm = d.match(/\/Length\s+(\d+)(\s+(\d+)\s+R)?/);
    if (lm && !lm[2]) len = Number(lm[1]);
    else if (lm) { const r = s.match(new RegExp('(?:^|[^0-9])' + lm[1] + '\\s+' + lm[3] + '\\s+obj\\s*(\\d+)')); if (r) len = Number(r[1]); }
    let p = sk + 6; if (s[p] === '\r') p++; if (s[p] === '\n') p++;
    if (len === null) { const e = s.indexOf('endstream', p); if (e < 0) continue; len = e - p; }
    if (k >= 0 || !rows || !columns) continue;
    out.push({ columns, rows, blackIs1: /\/BlackIs1\s+true/.test(d), data: buf.subarray(p, p + len) });
  }
  return out;
}
// PNG, 8-bit gray, zlib from the platform (CompressionStream 'deflate' = zlib framing).
let CRC = null;
function crc32(bytes) {
  if (!CRC) { CRC = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; CRC[n] = c >>> 0; } }
  let c = 0xFFFFFFFF; for (let i = 0; i < bytes.length; i++) c = CRC[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}
export async function grayPng(width, height, gray) {
  const raw = new Uint8Array((width + 1) * height);
  for (let y = 0; y < height; y++) raw.set(gray.subarray(y * width, (y + 1) * width), y * (width + 1) + 1);
  const z = new Uint8Array(await new Response(new Blob([raw]).stream().pipeThrough(new CompressionStream('deflate'))).arrayBuffer());
  const chunk = (type, body) => {
    const c = new Uint8Array(12 + body.length), dv = new DataView(c.buffer);
    dv.setUint32(0, body.length); for (let i = 0; i < 4; i++) c[4 + i] = type.charCodeAt(i);
    c.set(body, 8); dv.setUint32(8 + body.length, crc32(c.subarray(4, 8 + body.length)));
    return c;
  };
  const ihdr = new Uint8Array(13), hv = new DataView(ihdr.buffer);
  hv.setUint32(0, width); hv.setUint32(4, height); ihdr[8] = 8; ihdr[9] = 0;
  const parts = [new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', z), chunk('IEND', new Uint8Array(0))];
  const png = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0; for (const p of parts) { png.set(p, o); o += p.length; }
  return png;
}
// A scanned page for the vision model: half size up to OCR_PX wide (a 300 dpi A4 page is 2480 wide).
export const OCR_PX = 1400;
export async function ccittPng(img) {
  const scale = Math.max(1, Math.ceil(img.columns / OCR_PX));
  const g = g4Gray(img.data, img.columns, img.rows, scale);
  if (g.lines < img.rows * 0.9) throw new Error('ccitt: only ' + g.lines + ' of ' + img.rows + ' lines decoded');
  return grayPng(g.width, g.height, g.gray);
}
