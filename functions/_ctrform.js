// Form 146.03 filled from the contractor link (16/11/2026, DECISIONS "\u05e7\u05d9\u05e9\u05d5\u05e8 \u05e7\u05d1\u05dc\u05df: \u05db\u05dc \u05d4\u05e2\u05d5\u05d1\u05d3\u05d9\u05dd \u05d7\u05d5\u05ea\u05de\u05d9\u05dd \u05d1\u05e7\u05d9\u05e9\u05d5\u05e8 \u05d0\u05d7\u05d3"; Michael: "the
// workers' names and signatures are filled in the link in the app, and it fills the form").
//
// The template is the factory's controlled Word file in OneDrive (19_\u05e7\u05d1\u05dc\u05e0\u05d9\u05dd, "\u05d8\u05d5\u05e4\u05e1 146.03 ... .docx", the newest one). Its
// declaration table (\u05e9\u05dd \u05d4\u05e7\u05d1\u05dc\u05df / \u05ea.\u05d6. / \u05d7.\u05e4 / \u05ea\u05d0\u05e8\u05d9\u05da / \u05d7\u05ea\u05d9\u05de\u05d4) gets the company, the signer's ID, the company number, the date and
// the manager's signature; lines after the declaration sentence carry the works, the description, the dates and place
// of a job and the signer's name; the workers table (\u05e9\u05dd \u05d4\u05e2\u05d5\u05d1\u05d3 / \u05ea.\u05d6. / \u05d7\u05ea\u05d9\u05de\u05d4) gets one row per worker, with his
// signature drawn as a picture inside his own cell. A picture in the cell is laid out by Word itself, so no position in
// the rendered PDF is guessed (the permit's marker search, _permit.js, needed that because the officer's line is text).
// Only word/document.xml, word/_rels/document.xml.rels and the new pictures change; every other part (the header with
// the logo, the footer, the styles) is copied byte for byte (_xlsxpatch writeZip). Pure: no network.
import { readZip, writeZip, entryText, picInfo } from './_xlsxpatch.js';

export const FORM_DIR = '19_\u05e7\u05d1\u05dc\u05e0\u05d9\u05dd';
export const FORM_PREFIX = '\u05d8\u05d5\u05e4\u05e1 146.03';
export const FORM_MAX = 8 * 1024 * 1024;
// The newest .docx of form 146.03 in the folder listing [{name, lastModifiedDateTime}] (a new edition gets a new date in
// its name; the old one may stay beside it). null = none.
export function pickTemplate(items) {
  const c = (items || []).filter((x) => x && typeof x.name === 'string' && x.name.indexOf(FORM_PREFIX) === 0 && /\.docx$/i.test(x.name) && !x.folder);
  c.sort((a, b) => String(b.lastModifiedDateTime || '').localeCompare(String(a.lastModifiedDateTime || '')));
  return c.length ? c[0].name : null;
}

const xesc = (s) => String(s == null ? '' : s).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\ufffe\uffff]/g, '').replace(/[\r\n\t]+/g, ' ')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const textOf = (x) => [...String(x).matchAll(/<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>/g)].map((m) => m[1]).join('');
const L_COMPANY = '\u05e9\u05dd \u05d4\u05e7\u05d1\u05dc\u05df:', L_ID = '\u05ea.\u05d6.:', L_CNUM = '\u05d7.\u05e4 / \u05e2\u05d5\u05e1\u05e7 \u05de\u05d5\u05e8\u05e9\u05d4:', L_DATE = '\u05ea\u05d0\u05e8\u05d9\u05da:', L_SIG = '\u05d7\u05ea\u05d9\u05de\u05d4:';
const DECL = '\u05e7\u05e8\u05d0\u05ea\u05d9 \u05d0\u05ea \u05d4\u05d4\u05d5\u05e8\u05d0\u05d5\u05ea';
const WORKER_HEAD = '\u05e9\u05dd \u05d4\u05e2\u05d5\u05d1\u05d3';
export const FORM_ROWS = 8;   // the empty rows of the template's workers table; more workers = more rows

// A picture run: the signature inside a table cell, at most maxW x maxH centimetres, its own proportions kept.
const EMU = 360000;
export function sigRun(rid, n, png, maxW, maxH) {
  const p = picInfo(png) || { w: 3, h: 1 };
  const k = Math.min((maxW * EMU) / Math.max(1, p.w), (maxH * EMU) / Math.max(1, p.h));
  const cx = Math.max(1, Math.round(p.w * k)), cy = Math.max(1, Math.round(p.h * k));
  return '<w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="' + cx + '" cy="' + cy + '"/><wp:docPr id="' + (9000 + n) + '" name="ctrsig' + n + '"/>'
    + '<a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">'
    + '<pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="' + (9000 + n) + '" name="ctrsig' + n + '.png"/><pic:cNvPicPr/></pic:nvPicPr>'
    + '<pic:blipFill><a:blip r:embed="' + rid + '"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>'
    + '<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="' + cx + '" cy="' + cy + '"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>';
}
// The label's text node gets the value after it ("\u05e9\u05dd \u05d4\u05e7\u05d1\u05dc\u05df: <value>"). Only the first node whose whole text is the label.
function afterLabel(xml, label, value) {
  const node = '>' + label + '</w:t>';
  const i = xml.indexOf(node);
  if (i < 0) return { xml, ok: false };
  return { xml: xml.slice(0, i) + '>' + label + ' ' + xesc(value) + '</w:t>' + xml.slice(i + node.length), ok: true };
}
// A run appended after the run that holds the label (the signature after "\u05d7\u05ea\u05d9\u05de\u05d4:").
// The paragraph that gets a picture: its line spacing "at least one line" instead of the form's proportional one, so the
// line grows with the picture (a LibreOffice render of 16/11/2026 cut the signatures to their top third at line="300").
const SPACING_AT_LEAST = '<w:spacing w:after="0" w:line="240" w:lineRule="atLeast"/>';
function growLine(xml, at) {
  const ps = xml.lastIndexOf('<w:p>', at), pp = xml.indexOf('<w:pPr>', ps);
  if (ps < 0 || pp < 0 || pp > at) return xml;
  const pe = xml.indexOf('</w:pPr>', pp);
  const ppr = xml.slice(pp, pe);
  const fixed = /<w:spacing\b[^>]*\/>/.test(ppr) ? ppr.replace(/<w:spacing\b[^>]*\/>/, SPACING_AT_LEAST) : ppr + SPACING_AT_LEAST;
  return xml.slice(0, pp) + fixed + xml.slice(pe);
}
function runAfterLabel(xml, label, run) {
  const i = xml.indexOf('>' + label + '</w:t>');
  if (i < 0) return { xml, ok: false };
  const e = xml.indexOf('</w:r>', i);
  if (e < 0) return { xml, ok: false };
  return { xml: growLine(xml.slice(0, e + 6) + run + xml.slice(e + 6), i), ok: true };
}
// The table's first row marked as a heading row (w:tblHeader), which Word repeats at the top of each page.
export function repeatHead(tbl) {
  const m = /<w:tr\b[^>]*>/.exec(tbl);
  if (!m) return tbl;
  const at = m.index + m[0].length, rest = tbl.slice(at);
  if (/^<w:trPr>[\s\S]*?<w:tblHeader/.test(rest)) return tbl;
  if (rest.indexOf('<w:trPr>') === 0) return tbl.slice(0, at) + '<w:trPr><w:tblHeader/>' + rest.slice(8);
  return tbl.slice(0, at) + '<w:trPr><w:tblHeader/></w:trPr>' + rest;
}
// The innermost table that holds a text.
function tableWith(xml, text) {
  for (const m of xml.matchAll(/<w:tbl>[\s\S]*?<\/w:tbl>/g)) if (m[0].indexOf(text) >= 0) return { s: m.index, e: m.index + m[0].length, x: m[0] };
  return null;
}
// A paragraph's text node set to a value (the first empty "<w:t ...></w:t>" of each cell, in order).
function fillCells(row, vals, run) {
  let k = 0;
  let out = row.replace(/<w:t xml:space="preserve"><\/w:t>/g, (m) => { const v = vals[k++]; return v == null || v === '' ? m : '<w:t xml:space="preserve">' + xesc(v) + '</w:t>'; });
  if (run) {
    // the signature into the last cell, after its run
    const c = out.lastIndexOf('<w:tc>');
    const e = out.indexOf('</w:r>', c);
    if (c >= 0 && e >= 0) out = growLine(out.slice(0, e + 6) + run + out.slice(e + 6), e);
  }
  return out;
}
// A new paragraph after the one that starts with `start`, in its paragraph and run formatting. lines = [[label, value]].
function linesAfter(xml, start, lines) {
  const i = xml.indexOf(start);
  if (i < 0) return { xml, ok: false };
  const ps = xml.lastIndexOf('<w:p>', i), pe = xml.indexOf('</w:p>', i);
  if (ps < 0 || pe < 0) return { xml, ok: false };
  const p = xml.slice(ps, pe + 6);
  const ppr = (/<w:pPr>[\s\S]*?<\/w:pPr>/.exec(p) || [''])[0].replace(/<w:sectPr\b[\s\S]*?<\/w:sectPr>/, '');
  const rpr = (/<w:rPr>[\s\S]*?<\/w:rPr>/.exec(p) || [''])[0];
  const bold = rpr.replace(/<w:b w:val="false"\/>/, '<w:b/>').replace(/<w:bCs w:val="false"\/>/, '<w:bCs/>');
  const add = lines.filter((l) => l[1]).map((l) => '<w:p>' + ppr + '<w:r>' + bold + '<w:t xml:space="preserve">' + xesc(l[0]) + ' </w:t></w:r><w:r>' + rpr + '<w:t xml:space="preserve">' + xesc(l[1]) + '</w:t></w:r></w:p>').join('');
  return { xml: xml.slice(0, pe + 6) + add + xml.slice(pe + 6), ok: true };
}

// d = { company, cnum, signer, sid, date (DD/MM/YYYY), works (text), desc, job (text or ''), contact (text),
//       mgrSig: PNG bytes, workers: [{ n, id, sig: PNG bytes }] }.
// Returns { bytes, report: { filled: n, missing: [what was not found] } }. Throws on a file that is not a .docx.
export async function fillCtrForm(bytes, d) {
  if (!bytes || bytes[0] !== 0x50 || bytes[1] !== 0x4b) throw new Error('template is not a docx');
  const entries = readZip(bytes);
  const docE = entries.find((e) => e.name === 'word/document.xml');
  const relE = entries.find((e) => e.name === 'word/_rels/document.xml.rels');
  if (!docE || !relE) throw new Error('template has no document');
  let xml = await entryText(docE), rels = await entryText(relE);
  const missing = [];
  const pics = [];   // [{ name, bytes, rid }]
  const pic = (png, maxW, maxH) => {
    const n = pics.length + 1, rid = 'rIdCtrSig' + n, name = 'media/ctrsig' + n + '.png';
    pics.push({ name: 'word/' + name, bytes: png, rid, target: name });
    return sigRun(rid, n, png, maxW, maxH);
  };
  // the declaration table
  const t1 = tableWith(xml, '>' + L_COMPANY + '<');
  if (t1) {
    let x = t1.x, r;
    for (const [l, v] of [[L_COMPANY, d.company], [L_ID, d.sid], [L_CNUM, d.cnum], [L_DATE, d.date]]) { r = afterLabel(x, l, v); x = r.xml; if (!r.ok) missing.push(l); }
    if (d.mgrSig) { r = runAfterLabel(x, L_SIG, pic(d.mgrSig, 4.5, 1.3)); x = r.xml; if (!r.ok) missing.push(L_SIG); }
    xml = xml.slice(0, t1.s) + x + xml.slice(t1.e);
  } else missing.push('declaration table');
  // the job's lines after the declaration sentence
  const la = linesAfter(xml, DECL, [
    ['\u05de\u05e0\u05d4\u05dc \u05d4\u05e2\u05d1\u05d5\u05d3\u05d4 \u05de\u05d8\u05e2\u05dd \u05d4\u05e7\u05d1\u05dc\u05df \u05e9\u05d7\u05ea\u05dd:', d.signer + (d.contact ? ' (' + d.contact + ')' : '')],
    ['\u05d4\u05e2\u05d1\u05d5\u05d3\u05d5\u05ea:', d.works],
    ['\u05ea\u05d9\u05d0\u05d5\u05e8 \u05d4\u05e2\u05d1\u05d5\u05d3\u05d4:', d.desc],
    ['\u05d4\u05e2\u05d1\u05d5\u05d3\u05d4 \u05d1\u05de\u05e4\u05e2\u05dc:', d.job]]);
  xml = la.xml; if (!la.ok) missing.push('declaration sentence');
  // the workers table: a row per worker from the first empty row, at least the template's rows
  const t2 = tableWith(xml, '>' + WORKER_HEAD + '<');
  let filled = 0;
  if (t2) {
    // the heading row repeats on every page the table runs onto (the live PDF of 16/11/2026: the second worker's row
    // stood on page 3 with no "\u05e9\u05dd \u05d4\u05e2\u05d5\u05d1\u05d3 / \u05ea.\u05d6. / \u05d7\u05ea\u05d9\u05de\u05d4" above it)
    t2.x = repeatHead(t2.x);
    const rows = [...t2.x.matchAll(/<w:tr\b[\s\S]*?<\/w:tr>/g)];
    const empty = rows.filter((m) => !textOf(m[0]).trim());
    if (rows.length && empty.length) {
      const tpl = empty[0][0], ws = d.workers || [];
      const n = Math.max(empty.length, ws.length);
      const body = Array.from({ length: n }, (u, i) => (ws[i] ? fillCells(tpl, [ws[i].n, ws[i].id], ws[i].sig ? pic(ws[i].sig, 4.2, 1.0) : '') : tpl)).join('');
      filled = ws.length;
      const first = empty[0].index, last = empty[empty.length - 1];
      const x = t2.x.slice(0, first) + body + t2.x.slice(last.index + last[0].length);
      xml = xml.slice(0, t2.s) + x + xml.slice(t2.e);
    } else missing.push('workers rows');
  } else missing.push('workers table');
  // the pictures' relationships
  if (pics.length) {
    const add = pics.map((p) => '<Relationship Id="' + p.rid + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="' + p.target + '"/>').join('');
    rels = rels.replace('</Relationships>', add + '</Relationships>');
  }
  const out = entries.map((e) => (e === docE ? { name: e.name, flags: e.flags, text: xml } : e === relE ? { name: e.name, flags: e.flags, text: rels } : e));
  // a .png part needs its content type; the template states it as a Default (checked, added when missing)
  const ctE = entries.find((e) => e.name === '[Content_Types].xml');
  if (ctE && pics.length) {
    const ct = await entryText(ctE);
    if (!/Extension="png"/i.test(ct)) out[entries.indexOf(ctE)] = { name: ctE.name, flags: ctE.flags, text: ct.replace('<Default ', '<Default ContentType="image/png" Extension="png"/><Default ') };
  }
  for (const p of pics) out.push({ name: p.name, bytes: p.bytes });
  return { bytes: await writeZip(out), report: { filled, pictures: pics.length, missing } };
}
