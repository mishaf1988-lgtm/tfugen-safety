// Where a PDF wants its signature (21/10/2026, Michael: "and if there is a document with a place for a signature,
// how will it look?", then "do it"): the label "חתימה" (or "חתימת", "signature") on the last page that has one.
// The server signs on its line instead of the default corner (functions/_sign.js).
//
// pdf-lib reads the file (object streams included) and decodes the page content; this module reads the text out of
// it: the show-text operators with their position, and the font's ToUnicode map from codes to letters. Positions
// are where a string starts, which is enough to find a label. Hebrew may be stored in visual order ("המיתח"), so
// both orders are searched. Anything it cannot read is skipped: no spot = the default corner, never a failure.
import { PDFName, PDFDict, PDFArray, PDFRawStream, decodePDFRawStream } from './_pdflib.js';

const LABELS = ['\u05d7\u05ea\u05d9\u05de', 'signature'];
const rev = (s) => s.split('').reverse().join('');
export function isSignLabel(t) {
  const s = String(t || '').toLowerCase().replace(/\s+/g, '');
  return LABELS.some((l) => s.indexOf(l) >= 0 || s.indexOf(rev(l)) >= 0);
}

const bytesOf = (stream) => {
  try { return stream instanceof PDFRawStream ? decodePDFRawStream(stream).decode() : (stream && stream.getContents ? stream.getContents() : null); } catch (e) { return null; }
};
const latin = (b) => { let s = ''; for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]); return s; };

// A ToUnicode CMap: bfchar and bfrange to a map {code: text}, and the code length in bytes. Pure.
export function parseToUnicode(src) {
  const map = new Map(); let len = 1;
  const hex = (h) => parseInt(h, 16);
  const u16 = (h) => { let s = ''; for (let i = 0; i + 4 <= h.length; i += 4) s += String.fromCharCode(hex(h.slice(i, i + 4))); return s; };
  const cs = /begincodespacerange\s*<([0-9a-fA-F]+)>/.exec(src);
  if (cs) len = cs[1].length / 2;
  for (const blk of src.split('beginbfchar').slice(1)) {
    const body = blk.split('endbfchar')[0];
    for (const m of body.matchAll(/<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>/g)) map.set(hex(m[1]), u16(m[2]));
  }
  for (const blk of src.split('beginbfrange').slice(1)) {
    const body = blk.split('endbfrange')[0];
    for (const m of body.matchAll(/<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>\s*(<([0-9a-fA-F]+)>|\[([^\]]*)\])/g)) {
      const a = hex(m[1]), b = hex(m[2]);
      if (m[4] !== undefined) { const base = hex(m[4]); for (let c = a; c <= b && c - a < 4096; c++) map.set(c, String.fromCharCode(base + c - a)); }
      else { const list = [...m[5].matchAll(/<([0-9a-fA-F]+)>/g)].map((x) => u16(x[1])); list.forEach((t, i) => map.set(a + i, t)); }
    }
  }
  return { map, len };
}

// Content stream tokens: numbers, names, strings (literal and hex, as bytes), arrays, operators. Pure.
export function tokens(src) {
  const out = []; let i = 0; const n = src.length;
  const ws = (c) => c === ' ' || c === '\n' || c === '\r' || c === '\t' || c === '\f' || c === '\0';
  const delim = (c) => '()<>[]{}/%'.indexOf(c) >= 0;
  const stack = [];
  const push = (t) => { if (stack.length) stack[stack.length - 1].push(t); else out.push(t); };
  while (i < n) {
    const c = src[i];
    if (ws(c)) { i++; continue; }
    if (c === '%') { while (i < n && src[i] !== '\n' && src[i] !== '\r') i++; continue; }
    if (c === '(') {
      let depth = 1, s = []; i++;
      while (i < n && depth) {
        const d = src[i];
        if (d === '\\') { const e = src[i + 1]; i += 2;
          if (e >= '0' && e <= '7') { let o = e; while (o.length < 3 && src[i] >= '0' && src[i] <= '7') o += src[i++]; s.push(parseInt(o, 8) & 255); }
          else s.push(({ n: 10, r: 13, t: 9, b: 8, f: 12 })[e] !== undefined ? ({ n: 10, r: 13, t: 9, b: 8, f: 12 })[e] : e.charCodeAt(0));
          continue; }
        if (d === '(') depth++; else if (d === ')') { depth--; if (!depth) { i++; break; } }
        s.push(d.charCodeAt(0) & 255); i++;
      }
      push({ s }); continue;
    }
    if (c === '<' && src[i + 1] !== '<') {
      const j = src.indexOf('>', i); const h = src.slice(i + 1, j < 0 ? n : j).replace(/\s+/g, '');
      const s = []; for (let k = 0; k < h.length; k += 2) s.push(parseInt((h[k] + (h[k + 1] || '0')), 16));
      push({ s }); i = j < 0 ? n : j + 1; continue;
    }
    if (c === '<' || c === '>') { i += 2; continue; }
    if (c === '[') { stack.push([]); i++; continue; }
    if (c === ']') { const a = stack.pop() || []; push({ a }); i++; continue; }
    if (c === '/') { let j = i + 1; while (j < n && !ws(src[j]) && !delim(src[j])) j++; push({ name: src.slice(i + 1, j) }); i = j; continue; }
    let j = i; while (j < n && !ws(src[j]) && !delim(src[j])) j++;
    const w = src.slice(i, j); i = j === i ? i + 1 : j;
    if (/^[+-]?(\d+\.?\d*|\.\d+)$/.test(w)) push(+w); else if (w) push({ op: w });
  }
  return out;
}

const mul = (a, b) => [a[0] * b[0] + a[1] * b[2], a[0] * b[1] + a[1] * b[3], a[2] * b[0] + a[3] * b[2], a[2] * b[1] + a[3] * b[3], a[4] * b[0] + a[5] * b[2] + b[4], a[4] * b[1] + a[5] * b[3] + b[5]];
// The strings a content stream shows, with their start position on the page: [{ text, x, y }]. fonts:
// {name: {map, len}}. Pure.
export function pageTexts(src, fonts) {
  const out = []; const ops = []; let ctm = [1, 0, 0, 1, 0, 0]; const saved = [];
  let tm = [1, 0, 0, 1, 0, 0], tlm = tm, tl = 0, font = null, size = 12;
  const show = (bytes) => {
    const f = font && fonts[font]; let t = '';
    if (f) { for (let i = 0; i + f.len <= bytes.length; i += f.len) { let code = 0; for (let k = 0; k < f.len; k++) code = code * 256 + bytes[i + k]; t += f.map.get(code) || ''; } }
    else t = latin(bytes);
    const m = mul(tm, ctm);
    if (t) out.push({ text: t, x: m[4], y: m[5], size: Math.abs(size * (m[3] || m[0] || 1)) });
  };
  for (const tk of tokens(src)) {
    if (!tk || tk.op === undefined) { ops.push(tk); continue; }
    const a = ops.splice(0);
    const num = (k) => (typeof a[k] === 'number' ? a[k] : 0);
    switch (tk.op) {
      case 'q': saved.push(ctm); break;
      case 'Q': ctm = saved.pop() || [1, 0, 0, 1, 0, 0]; break;
      case 'cm': ctm = mul([num(0), num(1), num(2), num(3), num(4), num(5)], ctm); break;
      case 'BT': tm = tlm = [1, 0, 0, 1, 0, 0]; break;
      case 'Tf': font = a[0] && a[0].name; size = num(1) || size; break;
      case 'TL': tl = num(0); break;
      case 'Td': tlm = mul([1, 0, 0, 1, num(0), num(1)], tlm); tm = tlm; break;
      case 'TD': tl = -num(1); tlm = mul([1, 0, 0, 1, num(0), num(1)], tlm); tm = tlm; break;
      case 'Tm': tlm = tm = [num(0), num(1), num(2), num(3), num(4), num(5)]; break;
      case 'T*': tlm = mul([1, 0, 0, 1, 0, -tl], tlm); tm = tlm; break;
      case 'Tj': if (a[0] && a[0].s) show(a[0].s); break;
      case "'": tlm = mul([1, 0, 0, 1, 0, -tl], tlm); tm = tlm; if (a[0] && a[0].s) show(a[0].s); break;
      case '"': tlm = mul([1, 0, 0, 1, 0, -tl], tlm); tm = tlm; if (a[2] && a[2].s) show(a[2].s); break;
      case 'TJ': if (a[0] && a[0].a) show([].concat(...a[0].a.filter((x) => x && x.s).map((x) => x.s))); break;
      default: break;
    }
  }
  return out;
}

function fontsOf(page) {
  const fonts = {};
  try {
    const res = page.node.Resources();
    const fd = res && res.lookup(PDFName.of('Font'), PDFDict);
    if (!fd) return fonts;
    for (const [k] of fd.entries()) {
      const f = fd.lookup(k, PDFDict);
      const tu = f && f.lookup(PDFName.of('ToUnicode'));
      const b = tu && bytesOf(tu);
      const sub = f && f.lookup(PDFName.of('Subtype'));
      const cm = b ? parseToUnicode(latin(b)) : { map: new Map(), len: 1 };
      if (sub && String(sub) === '/Type0') cm.len = Math.max(cm.len, 2);
      fonts[k.asString().replace(/^\//, '')] = b ? cm : null;
    }
  } catch (e) { /* a font it cannot read: its text is skipped */ }
  return fonts;
}
function contentOf(page) {
  try {
    const c = page.node.Contents();
    const list = c instanceof PDFArray ? c.asArray().map((r) => page.doc.context.lookup(r)) : [c];
    return list.map((s) => { const b = bytesOf(s); return b ? latin(b) : ''; }).join('\n');
  } catch (e) { return ''; }
}

// The spot: the last page with a signature label, the lowest label on it. { page (1-based), x, y } in points
// from the bottom left, where the label starts; or null.
export function findSignSpot(doc) {
  const pages = doc.getPages();
  for (let p = pages.length - 1; p >= 0; p--) {
    const texts = pageTexts(contentOf(pages[p]), fontsOf(pages[p])).filter((t) => isSignLabel(t.text));
    if (texts.length) { const t = texts.sort((a, b) => a.y - b.y)[0]; return { page: p + 1, x: t.x, y: t.y, text: t.text, size: t.size }; }
  }
  return null;
}
