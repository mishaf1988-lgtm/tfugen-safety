// Minimal .xlsx writer for Cloudflare Pages Functions (no npm, no build step).
//
// An .xlsx is a zip of a few XML files. This writes one sheet of inline
// strings and numbers, right-to-left, bold frozen header row with an
// autofilter, into a zip with no compression (STORE). Excel, LibreOffice and
// OneDrive's Excel for the web all open it. A log of a few thousand rows is a
// few hundred KB uncompressed, well under Graph's 4MB simple-upload limit.
//
// Optional (27/09): pictures anchored in cells (JPEG/PNG, a drawing part) and
// cell hyperlinks. A cell value {text, link} writes the text and links it; the
// link lives in the sheet's relationships, so it has no 255-char formula limit.

const enc = new TextEncoder();

// Characters XML 1.0 forbids even when escaped (control chars except tab/newline).
function clean(s) {
  return String(s).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\ufffe\uffff]/g, '');
}
function xmlEsc(s) {
  return clean(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function colName(i) {
  let s = ''; i += 1;
  while (i > 0) { const m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); }
  return s;
}

// Pixel size of a JPEG (first SOF marker) or PNG (IHDR). null = not an image we embed.
export function imageInfo(b) {
  if (!b || b.length < 24) return null;
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4E && b[3] === 0x47) {
    return { ext: 'png', w: ((b[16] << 24) | (b[17] << 16) | (b[18] << 8) | b[19]) >>> 0, h: ((b[20] << 24) | (b[21] << 16) | (b[22] << 8) | b[23]) >>> 0 };
  }
  if (b[0] === 0xFF && b[1] === 0xD8) {
    let i = 2;
    while (i + 9 < b.length) {
      if (b[i] !== 0xFF) { i++; continue; }
      const m = b[i + 1];
      if (m === 0xFF) { i++; continue; }
      if (m === 0xD8 || m === 0x01 || (m >= 0xD0 && m <= 0xD7)) { i += 2; continue; }
      const len = (b[i + 2] << 8) | b[i + 3];
      if (m >= 0xC0 && m <= 0xCF && m !== 0xC4 && m !== 0xC8 && m !== 0xCC) {
        return { ext: 'jpeg', h: (b[i + 5] << 8) | b[i + 6], w: (b[i + 7] << 8) | b[i + 8] };
      }
      i += 2 + len;
    }
  }
  return null;
}

const EMU = 9525; // per pixel
const IMG_H = 70, IMG_MAX_W = 120, IMG_ROW_PT = 72; // thumbnail px, row height pt

function sheetXml(aoa, widths, links, tallRows, hasDrawing) {
  const ncol = aoa.reduce((m, r) => Math.max(m, r.length), 0) || 1;
  const nrow = aoa.length || 1;
  let rows = '';
  aoa.forEach((row, ri) => {
    let cells = '';
    row.forEach((v, ci) => {
      let isLink = false;
      if (v && typeof v === 'object' && 'text' in v) {
        if (v.link) { links.push({ ref: colName(ci) + (ri + 1), url: v.link, text: v.text }); isLink = true; }
        v = v.text;
      }
      if (v === null || v === undefined || v === '') return;
      const ref = colName(ci) + (ri + 1);
      // s=2: blue underlined, so a link looks like one (Michael saw black text, 27/09).
      const style = ri === 0 ? ' s="1"' : isLink ? ' s="2"' : '';
      if (typeof v === 'number' && isFinite(v)) cells += '<c r="' + ref + '"' + style + '><v>' + v + '</v></c>';
      else cells += '<c r="' + ref + '"' + style + ' t="inlineStr"><is><t xml:space="preserve">' + xmlEsc(v) + '</t></is></c>';
    });
    const ht = tallRows.has(ri) ? ' ht="' + IMG_ROW_PT + '" customHeight="1"' : '';
    rows += '<row r="' + (ri + 1) + '"' + ht + '>' + cells + '</row>';
  });
  let cols = '';
  for (let i = 0; i < ncol; i++) cols += '<col min="' + (i + 1) + '" max="' + (i + 1) + '" width="' + ((widths && widths[i]) || 14) + '" customWidth="1"/>';
  const lastRef = colName(ncol - 1) + nrow;
  let hl = '';
  links.forEach((l, i) => { hl += '<hyperlink ref="' + l.ref + '" r:id="rIdL' + (i + 1) + '" display="' + xmlEsc(l.text || '') + '"/>'; });
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    + '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
    + '<sheetViews><sheetView workbookViewId="0" rightToLeft="1">'
    + '<pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>'
    + '<cols>' + cols + '</cols>'
    + '<sheetData>' + rows + '</sheetData>'
    + (aoa.length > 1 ? '<autoFilter ref="A1:' + lastRef + '"/>' : '')
    + (hl ? '<hyperlinks>' + hl + '</hyperlinks>' : '')
    + (hasDrawing ? '<drawing r:id="rIdD1"/>' : '')
    + '</worksheet>';
}

function drawingXml(pics) {
  let x = '';
  pics.forEach((p, i) => {
    const n = i + 1, h = IMG_H, w = Math.max(1, Math.min(IMG_MAX_W, Math.round(IMG_H * p.info.w / Math.max(1, p.info.h))));
    const cx = w * EMU, cy = h * EMU;
    x += '<xdr:oneCellAnchor><xdr:from><xdr:col>' + p.col + '</xdr:col><xdr:colOff>' + (3 * EMU) + '</xdr:colOff>'
      + '<xdr:row>' + p.row + '</xdr:row><xdr:rowOff>' + (3 * EMU) + '</xdr:rowOff></xdr:from>'
      + '<xdr:ext cx="' + cx + '" cy="' + cy + '"/>'
      + '<xdr:pic><xdr:nvPicPr><xdr:cNvPr id="' + (n + 1) + '" name="Picture ' + n + '"/><xdr:cNvPicPr><a:picLocks noChangeAspect="1"/></xdr:cNvPicPr></xdr:nvPicPr>'
      + '<xdr:blipFill><a:blip r:embed="rIdI' + n + '"/><a:stretch><a:fillRect/></a:stretch></xdr:blipFill>'
      + '<xdr:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="' + cx + '" cy="' + cy + '"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></xdr:spPr></xdr:pic>'
      + '<xdr:clientData/></xdr:oneCellAnchor>';
  });
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    + '<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
    + x + '</xdr:wsDr>';
}

const REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/';
function rels(list) {
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' + list.join('') + '</Relationships>';
}

function files(aoa, sheetName, widths, images) {
  const name = xmlEsc(String(sheetName || 'Sheet1').substring(0, 31));
  const pics = (images || []).map((im) => ({ ...im, info: imageInfo(im.bytes) })).filter((p) => p.info && p.info.w && p.info.h);
  const tallRows = new Set(pics.map((p) => p.row));
  const links = [];
  const sheet = sheetXml(aoa, widths, links, tallRows, pics.length > 0);
  const sheetRels = links.map((l, i) => '<Relationship Id="rIdL' + (i + 1) + '" Type="' + REL + 'hyperlink" Target="' + xmlEsc(l.url) + '" TargetMode="External"/>');
  if (pics.length) sheetRels.push('<Relationship Id="rIdD1" Type="' + REL + 'drawing" Target="../drawings/drawing1.xml"/>');
  const extra = [];
  if (sheetRels.length) extra.push(['xl/worksheets/_rels/sheet1.xml.rels', rels(sheetRels)]);
  if (pics.length) {
    extra.push(['xl/drawings/drawing1.xml', drawingXml(pics)]);
    extra.push(['xl/drawings/_rels/drawing1.xml.rels', rels(pics.map((p, i) => '<Relationship Id="rIdI' + (i + 1) + '" Type="' + REL + 'image" Target="../media/image' + (i + 1) + '.' + p.info.ext + '"/>'))]);
    pics.forEach((p, i) => extra.push(['xl/media/image' + (i + 1) + '.' + p.info.ext, p.bytes]));
  }
  return [
    ['[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
      + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
      + '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
      + '<Default Extension="xml" ContentType="application/xml"/>'
      + '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
      + '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'
      + '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>'
      + (pics.length ? '<Default Extension="jpeg" ContentType="image/jpeg"/><Default Extension="png" ContentType="image/png"/>'
        + '<Override PartName="/xl/drawings/drawing1.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/>' : '')
      + '</Types>'],
    ['_rels/.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
      + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
      + '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>'
      + '</Relationships>'],
    ['xl/workbook.xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
      + '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
      + '<sheets><sheet name="' + name + '" sheetId="1" r:id="rId1"/></sheets>'
      + (aoa.length > 1 ? '<definedNames><definedName name="_xlnm._FilterDatabase" localSheetId="0" hidden="1">\'' + name + '\'!$A$1:$' + colName(Math.max(0, aoa[0].length - 1)) + '$' + aoa.length + '</definedName></definedNames>' : '')
      + '</workbook>'],
    ['xl/_rels/workbook.xml.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
      + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
      + '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>'
      + '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>'
      + '</Relationships>'],
    ['xl/styles.xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
      + '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
      + '<fonts count="3"><font><sz val="11"/><name val="Arial"/></font><font><b/><sz val="11"/><name val="Arial"/></font>'
      + '<font><u/><sz val="11"/><color rgb="FF0563C1"/><name val="Arial"/></font></fonts>'
      + '<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>'
      + '<fill><patternFill patternType="solid"><fgColor rgb="FFE2E8F0"/><bgColor indexed="64"/></patternFill></fill></fills>'
      + '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>'
      + '<cellStyleXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/><xf numFmtId="0" fontId="2" fillId="0" borderId="0"/></cellStyleXfs>'
      + '<cellXfs count="3"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>'
      + '<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/>'
      + '<xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="1" applyFont="1"/></cellXfs>'
      + '<cellStyles count="2"><cellStyle name="Normal" xfId="0" builtinId="0"/><cellStyle name="Hyperlink" xfId="1" builtinId="8"/></cellStyles>'
      + '</styleSheet>'],
    ['xl/worksheets/sheet1.xml', sheet],
    ...extra,
  ];
}

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

// STORE-only zip. Names are ASCII, so no UTF-8 flag is needed.
function zip(entries) {
  const parts = [], central = [];
  let offset = 0;
  const u16 = (v) => [v & 0xFF, (v >>> 8) & 0xFF];
  const u32 = (v) => [v & 0xFF, (v >>> 8) & 0xFF, (v >>> 16) & 0xFF, (v >>> 24) & 0xFF];
  entries.forEach(([name, text]) => {
    const nameB = enc.encode(name), data = text instanceof Uint8Array ? text : enc.encode(text), crc = crc32(data);
    const head = new Uint8Array([
      ...u32(0x04034b50), ...u16(20), ...u16(0), ...u16(0), ...u16(0), ...u16(0x21),
      ...u32(crc), ...u32(data.length), ...u32(data.length), ...u16(nameB.length), ...u16(0)]);
    parts.push(head, nameB, data);
    central.push(new Uint8Array([
      ...u32(0x02014b50), ...u16(20), ...u16(20), ...u16(0), ...u16(0), ...u16(0), ...u16(0x21),
      ...u32(crc), ...u32(data.length), ...u32(data.length), ...u16(nameB.length), ...u16(0), ...u16(0),
      ...u16(0), ...u16(0), ...u32(0), ...u32(offset)]), nameB);
    offset += head.length + nameB.length + data.length;
  });
  const cdSize = central.reduce((s, p) => s + p.length, 0);
  const end = new Uint8Array([
    ...u32(0x06054b50), ...u16(0), ...u16(0), ...u16(entries.length), ...u16(entries.length),
    ...u32(cdSize), ...u32(offset), ...u16(0)]);
  const all = [...parts, ...central, end];
  const out = new Uint8Array(all.reduce((s, p) => s + p.length, 0));
  let o = 0; all.forEach((p) => { out.set(p, o); o += p.length; });
  return out;
}

// aoa: array of rows (first row = header). images: [{row, col, bytes}] with
// 0-based aoa row/col. Returns a Uint8Array .xlsx.
export function buildXlsx(aoa, sheetName, widths, images) {
  return zip(files(aoa || [], sheetName, widths, images));
}
export const XLSX_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
