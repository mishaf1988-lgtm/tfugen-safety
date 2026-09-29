// Patch the data rows of one sheet inside an EXISTING .xlsm/.xlsx, leaving the
// rest of the workbook as it is: macros (vbaProject.bin), formulas, other
// sheets, data validation, conditional formatting, styles (28/09, Michael:
// "the file has to be the existing one, same sheets, macros").
//
// How: the workbook is a zip. Entries we do not touch are copied as their
// original compressed bytes (same CRC, same size, no recompression). The few
// we change (the sheet, workbook.xml, [Content_Types].xml, workbook.xml.rels)
// are inflated with DecompressionStream, edited as text, and deflated again
// (stored uncompressed they tripled the file, 89KB -> 281KB, 28/09). calcChain.xml is dropped (it lists formula cells, and a cell
// that was a formula and is now a value makes Excel report a damaged file),
// and workbook.xml asks Excel to recalculate everything when the file opens,
// so the report sheets follow the new rows.
//
// Only columns A..lastCol of rows 2..maxRow are written. Anything to the right
// (the sheet's own formula columns) is left exactly as it was. Cell styles are
// kept from the template row, except date cells, which get dateStyle.

const enc = new TextEncoder(), dec = new TextDecoder();

let CRC_TABLE = null;
function crc32(buf) {
  if (!CRC_TABLE) {
    CRC_TABLE = new Uint32Array(256);
    for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; CRC_TABLE[n] = c >>> 0; }
  }
  let c = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}

export function readZip(bytes) {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let eocd = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--) { if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; } }
  if (eocd < 0) throw new Error('not a zip file');
  const n = dv.getUint16(eocd + 10, true);
  let p = dv.getUint32(eocd + 16, true);
  const out = [];
  for (let k = 0; k < n; k++) {
    if (dv.getUint32(p, true) !== 0x02014b50) throw new Error('bad zip directory');
    const flags = dv.getUint16(p + 8, true), method = dv.getUint16(p + 10, true);
    const time = dv.getUint16(p + 12, true), date = dv.getUint16(p + 14, true);
    const crc = dv.getUint32(p + 16, true), csize = dv.getUint32(p + 20, true), usize = dv.getUint32(p + 24, true);
    const nl = dv.getUint16(p + 28, true), xl = dv.getUint16(p + 30, true), cl = dv.getUint16(p + 32, true);
    const lho = dv.getUint32(p + 42, true);
    const name = dec.decode(bytes.subarray(p + 46, p + 46 + nl));
    const lnl = dv.getUint16(lho + 26, true), lxl = dv.getUint16(lho + 28, true);
    const start = lho + 30 + lnl + lxl;
    out.push({ name, flags, method, time, date, crc, csize, usize, raw: bytes.subarray(start, start + csize) });
    p += 46 + nl + xl + cl;
  }
  return out;
}

export async function entryText(e) {
  if (e.text != null) return e.text;
  if (e.method === 0) return dec.decode(e.raw);
  if (e.method !== 8) throw new Error('unsupported zip method ' + e.method);
  const stream = new Blob([e.raw]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return dec.decode(new Uint8Array(await new Response(stream).arrayBuffer()));
}

async function deflate(u8) {
  const stream = new Blob([u8]).stream().pipeThrough(new CompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

// Digest of every worksheet's XML. Excel rewrites these when a person saves;
// OneDrive's own processing after an upload changes the cTag but not these.
export async function sheetsDigest(bytes) {
  const texts = [];
  for (const e of readZip(bytes).filter((x) => /^xl\/worksheets\/[^/]+\.xml$/.test(x.name)).sort((a, b) => (a.name < b.name ? -1 : 1))) texts.push(e.name + '\n' + await entryText(e));
  const h = await crypto.subtle.digest('SHA-256', enc.encode(texts.join('\n')));
  return [...new Uint8Array(h)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

// e.text set = rewritten (deflated); otherwise the original bytes are copied.
export async function writeZip(entries) {
  const parts = [], central = [];
  const packed = await Promise.all(entries.map(async (e) => {
    if (e.text == null) return null;
    const plain = enc.encode(e.text);
    return { plain, z: await deflate(plain) };
  }));
  let offset = 0;
  const u16 = (v) => [v & 0xFF, (v >>> 8) & 0xFF];
  const u32 = (v) => [v & 0xFF, (v >>> 8) & 0xFF, (v >>> 16) & 0xFF, (v >>> 24) & 0xFF];
  entries.forEach((e, i) => {
    const nameB = enc.encode(e.name);
    let data, method, crc, csize, usize, flags = (e.flags || 0) & 0x0800; // keep only the UTF-8 name flag
    if (e.text != null) { const pk = packed[i]; data = pk.z; method = 8; crc = crc32(pk.plain); csize = data.length; usize = pk.plain.length; }
    else { data = e.raw; method = e.method; crc = e.crc; csize = e.csize; usize = e.usize; }
    const time = e.time || 0, date = e.date || 0x21;
    const head = new Uint8Array([...u32(0x04034b50), ...u16(20), ...u16(flags), ...u16(method), ...u16(time), ...u16(date),
      ...u32(crc), ...u32(csize), ...u32(usize), ...u16(nameB.length), ...u16(0)]);
    parts.push(head, nameB, data);
    central.push(new Uint8Array([...u32(0x02014b50), ...u16(20), ...u16(20), ...u16(flags), ...u16(method), ...u16(time), ...u16(date),
      ...u32(crc), ...u32(csize), ...u32(usize), ...u16(nameB.length), ...u16(0), ...u16(0), ...u16(0), ...u16(0), ...u32(0), ...u32(offset)]), nameB);
    offset += head.length + nameB.length + data.length;
  });
  const cdSize = central.reduce((s, x) => s + x.length, 0);
  const end = new Uint8Array([...u32(0x06054b50), ...u16(0), ...u16(0), ...u16(entries.length), ...u16(entries.length), ...u32(cdSize), ...u32(offset), ...u16(0)]);
  const all = [...parts, ...central, end];
  const out = new Uint8Array(all.reduce((s, x) => s + x.length, 0));
  let o = 0; all.forEach((x) => { out.set(x, o); o += x.length; });
  return out;
}

function xmlEsc(s) {
  return String(s).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\ufffe\uffff]/g, '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function colName(i) { let s = ''; i += 1; while (i > 0) { const m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); } return s; }
function colIndex(ref) { const m = /^([A-Z]+)/.exec(ref); let n = 0; for (const ch of m[1]) n = n * 26 + (ch.charCodeAt(0) - 64); return n - 1; }
// Excel serial day for YYYY-MM-DD (1900 system).
export function serial(ymd) { return Math.round((Date.parse(String(ymd).substring(0, 10) + 'T00:00:00Z') - Date.UTC(1899, 11, 30)) / 86400000); }

// The sheet's part path, by its tab name.
async function sheetPath(entries, sheetName) {
  const get = (n) => entries.find((e) => e.name === n);
  const wb = await entryText(get('xl/workbook.xml'));
  const m = new RegExp('<sheet [^>]*name="' + xmlEsc(sheetName).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '"[^>]*r:id="([^"]+)"').exec(wb);
  if (!m) throw new Error('sheet not found: ' + sheetName);
  const rels = await entryText(get('xl/_rels/workbook.xml.rels'));
  const t = new RegExp('<Relationship [^>]*Id="' + m[1] + '"[^>]*Target="([^"]+)"').exec(rels) || new RegExp('<Relationship [^>]*Target="([^"]+)"[^>]*Id="' + m[1] + '"').exec(rels);
  if (!t) throw new Error('sheet part not found');
  return 'xl/' + t[1].replace(/^\/?xl\//, '').replace(/^\.\//, '');
}

function xmlUnesc(s) {
  return String(s).replace(/&(#x[0-9a-fA-F]+|#\d+|lt|gt|quot|apos|amp);/g, (m, e) => (e === 'lt' ? '<' : e === 'gt' ? '>' : e === 'quot' ? '"' : e === 'apos' ? "'" : e === 'amp' ? '&'
    : String.fromCodePoint(e[1] === 'x' ? parseInt(e.substring(2), 16) : parseInt(e.substring(1), 10))));
}
// The text of an <si> / <is>: all its <t> runs (rich text has several).
const runText = (x) => { let t = ''; const re = /<t\b[^>]*>([\s\S]*?)<\/t>/g; let m; while ((m = re.exec(x || ''))) t += xmlUnesc(m[1]); return t; };
const ymdOfSerial = (n) => new Date(Date.UTC(1899, 11, 30) + Math.round(n) * 86400000).toISOString().substring(0, 10);
// A date a person typed as text: 28/09/2026, 28.9.26, 2026-09-28.
function ymdOfText(t) {
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(t);
  if (m) return m[1] + '-' + m[2].padStart(2, '0') + '-' + m[3].padStart(2, '0');
  m = /^(\d{1,2})[./-](\d{1,2})[./-](\d{2}|\d{4})$/.exec(t);
  if (!m) return null;
  const y = m[3].length === 2 ? '20' + m[3] : m[3];
  return y + '-' + m[2].padStart(2, '0') + '-' + m[1].padStart(2, '0');
}

// The tab names, in workbook order.
export async function sheetNames(bytes) {
  const wb = await entryText(readZip(bytes).find((e) => e.name === 'xl/workbook.xml'));
  const out = []; const re = /<sheet [^>]*name="([^"]+)"/g; let m;
  while ((m = re.exec(wb))) out.push(xmlUnesc(m[1]));
  return out;
}

// Read back columns A..lastCol of rows minRow (default 2)..maxRow (what a person saved in
// Excel). Returns [{r, v:[...]}] for the rows that have anything there:
// strings trimmed, numbers as numbers, and in dateCols a 'YYYY-MM-DD' string
// (from Excel's serial day or from a typed date). A cell that cannot be read
// as a date in a date column comes back as its text.
export async function readSheetRows(bytes, opts) {
  const entries = readZip(bytes);
  const path = await sheetPath(entries, opts.sheet);
  const xml = await entryText(entries.find((e) => e.name === path));
  const ssE = entries.find((e) => e.name === 'xl/sharedStrings.xml');
  const shared = [];
  if (ssE) { const ss = await entryText(ssE); const re = /<si\b[^>]*>([\s\S]*?)<\/si>|<si\s*\/>/g; let m; while ((m = re.exec(ss))) shared.push(runText(m[1] || '')); }
  const dateCols = opts.dateCols || [], out = [];
  const rowRe = /<row\b([^>]*?)(?:\/>|>([\s\S]*?)<\/row>)/g; let rm;
  while ((rm = rowRe.exec(xml))) {
    const r = +((/\br="(\d+)"/.exec(rm[1]) || [])[1] || 0);
    if (r < (opts.minRow || 2) || r > opts.maxRow || !rm[2]) continue;
    const v = []; let any = false;
    const cellRe = /<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g; let cm;
    while ((cm = cellRe.exec(rm[2]))) {
      const ref = /\br="([A-Z]+)\d+"/.exec(cm[1]); if (!ref) continue;
      const ci = colIndex(ref[1]); if (ci > opts.lastCol) continue;
      const t = ((/\bt="([^"]+)"/.exec(cm[1]) || [])[1]) || 'n';
      const inner = cm[2] || '';
      const raw = (/<v>([\s\S]*?)<\/v>/.exec(inner) || [])[1];
      let val = null;
      if (t === 's') val = raw == null ? null : shared[+raw];
      else if (t === 'inlineStr') val = runText((/<is>([\s\S]*?)<\/is>/.exec(inner) || [])[1]);
      else if (t === 'str' || t === 'e') val = raw == null ? null : xmlUnesc(raw);
      else if (t === 'b') val = raw == null ? null : raw === '1';
      else if (raw != null && raw !== '') val = +raw;
      if (typeof val === 'string') { val = val.replace(/\r\n?/g, '\n').trim(); if (val === '') val = null; }
      if (val != null && dateCols.indexOf(ci) >= 0) {
        if (typeof val === 'number' && val > 0) val = ymdOfSerial(val);
        else if (typeof val === 'string') val = ymdOfText(val) || val;
      }
      if (val != null) { v[ci] = val; any = true; }
    }
    if (any) out.push({ r, v });
  }
  return out;
}

// Appends rows after the last row with data: A = the next number in column
// A, then the texts; each cell takes the style of the cell above it. Empty
// prepared rows in the way are replaced. logRows: arrays of strings (B..).
export function appendLog(xml, logRows) {
  const rowRe = /<row\b([^>]*?)(?:\/>|>([\s\S]*?)<\/row>)/g; let m, last = 0, turn = 0, tmpl = {};
  while ((m = rowRe.exec(xml))) {
    const r = +((/\br="(\d+)"/.exec(m[1]) || [])[1] || 0), inner = m[2] || '';
    if (!/<v>|<is>/.test(inner)) continue;
    if (r > last) {
      last = r; tmpl = {};
      const cRe = /<c r="([A-Z]+)\d+"([^>]*?)(?:\/>|>)/g; let c;
      while ((c = cRe.exec(inner))) { const sm = /\bs="(\d+)"/.exec(c[2]); if (sm) tmpl[c[1]] = sm[1]; }
    }
    const a = /<c r="A\d+"[^>]*><v>(\d+)<\/v><\/c>/.exec(inner);
    if (a && +a[1] > turn) turn = +a[1];
  }
  const first = last + 1, end = last + logRows.length;
  const st = (col) => (tmpl[col] ? ' s="' + tmpl[col] + '"' : '');
  let add = '';
  logRows.forEach((vals, k) => {
    const r = first + k;
    add += '<row r="' + r + '"><c r="A' + r + '"' + st('A') + '><v>' + (turn + k + 1) + '</v></c>';
    vals.forEach((v, i) => { const col = String.fromCharCode(66 + i); add += '<c r="' + col + r + '"' + st(col) + ' t="inlineStr"><is><t xml:space="preserve">' + xmlEsc(v) + '</t></is></c>'; });
    add += '</row>';
  });
  // Drop the rows being replaced, then put the new ones before the first row after them.
  xml = xml.replace(rowRe, (all, attrs) => { const r = +((/\br="(\d+)"/.exec(attrs) || [])[1] || 0); return r >= first && r <= end ? '' : all; });
  let done = false;
  xml = xml.replace(rowRe, (all, attrs) => { const r = +((/\br="(\d+)"/.exec(attrs) || [])[1] || 0); if (!done && r > end) { done = true; return add + all; } return all; });
  if (!done) xml = /<sheetData\/>/.test(xml) ? xml.replace('<sheetData/>', '<sheetData>' + add + '</sheetData>') : xml.replace('</sheetData>', add + '</sheetData>');
  return xml;
}

// Column widths (0-based index -> width in characters) from <cols>.
function colWidths(xml) {
  const w = {}; const re = /<col\b[^>]*?\bmin="(\d+)"[^>]*?\bmax="(\d+)"[^>]*?\bwidth="([\d.]+)"/g; let m;
  const cols = (/<cols>([\s\S]*?)<\/cols>/.exec(xml) || [])[1] || '';
  while ((m = re.exec(cols))) for (let c = +m[1]; c <= Math.min(+m[2], 64); c++) w[c - 1] = +m[3];
  return w;
}
// Points for a row of wrapped text: the most lines any cell needs at its
// column's width (about 1.1 characters per width unit), 15pt a line, at least
// one line, at most Excel's 409.
const LINE_PT = 15, MIN_PT = 15, MAX_PT = 409;
export function rowHeight(vals, widths) {
  let lines = 1;
  vals.forEach((v, ci) => {
    if (v == null || typeof v === 'object' || typeof v === 'number') return;
    const per = Math.max(4, Math.floor((widths[ci] || 8.43) * 1.1));
    const n = String(v).split('\n').reduce((k, part) => k + Math.max(1, Math.ceil(part.length / per)), 0);
    if (n > lines) lines = n;
  });
  return Math.min(MAX_PT, Math.max(MIN_PT, lines * LINE_PT + 3));
}

// show {col, vals}: the header filter selects vals in that column, and data
// rows with another value there are hidden, as Excel would show it (Michael,
// 29/09: "leave the filter on the open ones only"). Empty rows stay visible, so
// a new hazard typed there is seen. Without an autoFilter in the sheet: no-op.
function applyShow(xml, rows, show, maxRow) {
  const af = /<autoFilter\b([^>]*?)\/>/.exec(xml);
  const ref = af && /\bref="([A-Z]+)\d+:[A-Z]+\d+"/.exec(af[1]);
  if (!ref) return xml;
  const colId = show.col - colIndex(ref[1]);
  if (colId < 0) return xml;
  const f = '<filterColumn colId="' + colId + '"><filters blank="1">'
    + show.vals.map((v) => '<filter val="' + xmlEsc(v) + '"/>').join('') + '</filters></filterColumn>';
  xml = xml.replace(af[0], '<autoFilter' + af[1] + '>' + f + '</autoFilter>');
  xml = xml.replace(/<row\b([^>]*?)(\/?>)/g, (all, attrs, end) => {
    const rm = /\br="(\d+)"/.exec(attrs); const r = rm ? +rm[1] : 0;
    const v = r >= 2 && r <= maxRow && rows[r - 2] ? rows[r - 2][show.col] : null;
    if (v === null || v === undefined || v === '' || show.vals.indexOf(v) >= 0) return all;
    return '<row' + attrs + ' hidden="1"' + end;
  });
  return /<sheetPr\b/.test(xml)
    ? xml.replace(/<sheetPr\b/, '<sheetPr filterMode="1"')
    : xml.replace(/(<worksheet\b[^>]*>)/, '$1<sheetPr filterMode="1"/>');
}

// rows: array of arrays of values for columns A.. (null/'' = empty cell;
// number; string; {date:'YYYY-MM-DD'}). Returns the new workbook bytes.
// opts: {sheet, lastCol (0-based, e.g. 12 = M), maxRow (e.g. 206), dateCols
// (0-based columns holding dates; their style is read from the sheet), dateStyle
// (optional override)}
export async function patchSheetRows(bytes, rows, opts) {
  const entries = readZip(bytes);
  const path = await sheetPath(entries, opts.sheet);
  const sheet = entries.find((e) => e.name === path);
  let xml = await entryText(sheet);
  const lastCol = opts.lastCol, maxRow = opts.maxRow;
  if (rows.length > maxRow - 1) throw new Error('too many rows for the sheet (' + rows.length + ' > ' + (maxRow - 1) + ')');
  // Date cells need a date style. The one the workbook already uses in that
  // column (the first number stored there) is taken, so the xlsm and its xlsx
  // twin, whose style numbers differ, each keep their own.
  const dateStyle = Object.assign({}, opts.dateStyle || {});
  const numRe = /<c r="([A-Z]+)(\d+)"([^>]*)>(?:<f>[^<]*<\/f>)?<v>[\d.]+<\/v><\/c>/g; let nm;
  while ((nm = numRe.exec(xml))) {
    const ci = colIndex(nm[1]); if (ci > lastCol || +nm[2] < 2 || /\bt="/.test(nm[3]) || (ci in dateStyle)) continue;
    const sm = /\bs="(\d+)"/.exec(nm[3]);
    if (sm && (opts.dateCols || []).indexOf(ci) >= 0) dateStyle[ci] = sm[1];
  }
  // Template styles per column, from the first data row that has them.
  const tmpl = {};
  if (lastCol > 25) throw new Error('lastCol beyond Z is not supported');
  // A non-empty cell in columns A..lastCol.
  const dataCell = new RegExp('<c r="[A-' + String.fromCharCode(65 + lastCol) + ']\\d+"[^>]*[^/]>');
  const seen = new Set();
  const rowRe = /<row\b([^>]*?)(\/>|>([\s\S]*?)<\/row>)/g;
  const widths = opts.fitRows ? colWidths(xml) : null;
  xml = xml.replace(rowRe, (all, attrs, close, inner) => {
    const rm = /\br="(\d+)"/.exec(attrs); const r = rm ? +rm[1] : 0;
    if (r < 2 || r > maxRow) return all;
    seen.add(r);
    // Fast path (most of the 205 rows): nothing to write and nothing written
    // there before. Only a hidden flag from the old filter is dropped.
    if (!rows[r - 2] && !dataCell.test(inner || '')) return all.replace(/\s+hidden="1"/, '');
    const cells = [];
    const cellRe = /<c\b([^>]*?)(\/>|>([\s\S]*?)<\/c>)/g; let cm;
    const body = inner || '';
    while ((cm = cellRe.exec(body))) {
      const refm = /\br="([A-Z]+)\d+"/.exec(cm[1]); if (!refm) continue;
      const ci = colIndex(refm[1]); const sm = /\bs="(\d+)"/.exec(cm[1]);
      if (ci <= lastCol && sm && !(ci in tmpl)) tmpl[ci] = sm[1];
      cells.push({ ci, xml: cm[0], s: sm ? sm[1] : null });
    }
    const vals = rows[r - 2] || [];
    let out = '';
    for (let ci = 0; ci <= lastCol; ci++) {
      const old = cells.find((c) => c.ci === ci);
      let v = vals[ci]; const ref = colName(ci) + r;
      let s = (old && old.s) || tmpl[ci] || null;
      if (v && typeof v === 'object' && v.date) { if (dateStyle[ci]) s = dateStyle[ci]; v = serial(v.date); }
      const sa = s ? ' s="' + s + '"' : '';
      if (v === null || v === undefined || v === '') out += '<c r="' + ref + '"' + sa + '/>';
      else if (typeof v === 'number' && isFinite(v)) out += '<c r="' + ref + '"' + sa + '><v>' + v + '</v></c>';
      else out += '<c r="' + ref + '"' + sa + ' t="inlineStr"><is><t xml:space="preserve">' + xmlEsc(v) + '</t></is></c>';
    }
    cells.filter((c) => c.ci > lastCol).forEach((c) => { out += c.xml; });
    // Rows hidden by the old filter would hide the wrong hazards now.
    let a2 = attrs.replace(/\s+hidden="1"/, '');
    // The row's height follows its text (Michael, 29/09/2026: long text was cut
    // off, the rows kept the height of the text they had before).
    if (widths && rows[r - 2]) a2 = a2.replace(/\s+(ht|customHeight)="[^"]*"/g, '') + ' ht="' + rowHeight(rows[r - 2], widths) + '" customHeight="1"';
    return '<row' + a2 + '>' + out + '</row>';
  });
  // A data row with no row in the sheet would be dropped without a word.
  for (let i = 0; i < rows.length; i++) if (!seen.has(i + 2)) throw new Error('too many rows for the sheet (row ' + (i + 2) + ' is not prepared)');
  // The filter itself stays (arrows on the header), its old selection goes.
  xml = xml.replace(/(<autoFilter\b[^>]*?)>[\s\S]*?<\/autoFilter>/, '$1/>').replace(/\s+filterMode="1"/, '');
  if (opts.show) xml = applyShow(xml, rows, opts.show, maxRow);
  sheet.text = xml;
  // A line in another sheet of the same workbook (the "Claude Log"), in the
  // same pass so the file is zipped once.
  if (opts.log && opts.log.rows && opts.log.rows.length) {
    const lp = await sheetPath(entries, opts.log.sheet).catch(() => null);
    const le = lp && entries.find((e) => e.name === lp);
    if (le) le.text = appendLog(await entryText(le), opts.log.rows);
  }

  const wbE = entries.find((e) => e.name === 'xl/workbook.xml');
  let wb = await entryText(wbE);
  wb = /<calcPr\b/.test(wb)
    ? wb.replace(/<calcPr\b([^>]*?)\/>/, (m, a) => '<calcPr' + a.replace(/\s+fullCalcOnLoad="[^"]*"/, '') + ' fullCalcOnLoad="1"/>')
    : wb.replace('</workbook>', '<calcPr fullCalcOnLoad="1"/></workbook>');
  wbE.text = wb;
  const kept = entries.filter((e) => e.name !== 'xl/calcChain.xml');
  const relE = kept.find((e) => e.name === 'xl/_rels/workbook.xml.rels');
  relE.text = (await entryText(relE)).replace(/<Relationship [^>]*calcChain[^>]*\/>/g, '');
  const ctE = kept.find((e) => e.name === '[Content_Types].xml');
  ctE.text = (await entryText(ctE)).replace(/<Override [^>]*calcChain[^>]*\/>/g, '');
  return writeZip(kept);
}
