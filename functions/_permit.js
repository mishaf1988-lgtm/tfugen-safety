// The signed permit of a work Michael approved (05/11/2026, stage B of the weekly works link, DECISIONS "\u05d4\u05d4\u05e8\u05e9\u05d0\u05d4 \u05d4\u05d7\u05ea\u05d5\u05de\u05d4
// \u05dc\u05db\u05dc \u05e2\u05d1\u05d5\u05d3\u05d4 \u05e9\u05d0\u05d5\u05e9\u05e8\u05d4"; Michael: "a work permit form as it exists, signed, to the maintenance manager, to me, and filed").
//
// One PDF per work: the factory's own "\u05d4\u05e8\u05e9\u05d0\u05ea \u05e2\u05d1\u05d5\u05d3\u05d4" filled from the work, then its "\u05d4\u05e8\u05e9\u05d0\u05ea \u05d1\u05d8\u05d9\u05d7\u05d5\u05ea" filled, the kinds of
// work and their measures marked, Michael's signature stamped (functions/_sign.js stampPdf). The templates are the
// factory's Word files in OneDrive (safety folder 18), the contractors' ones or the maintenance workers' ones. The
// filled .docx files are put in the filing folder and Microsoft renders each to PDF (Graph ?format=pdf, as Word prints
// it, the logo kept, like od_pdf in routine-db.js); the two PDFs are merged with pdf-lib, stamped and filed beside them
// (Word + PDF, DECISIONS 01/11/2026). Nothing is ever replaced: every upload is conflictBehavior=rename.
//
// The forms have no tables: a blank is a run of underscores inside a paragraph, often split over several runs. A
// paragraph is found by the start of its text (its label), its blanks are filled in order; a value goes in the first
// run of its blank (that run's formatting) and the rest of the blank's underscores are removed; a blank with no value
// stays. A ticked measure: its box (U+F00E in the form's symbol font) becomes an X in Arial. Only word/document.xml
// changes; every other part (the header with the logo, the media) is copied byte for byte (_xlsxpatch writeZip).
//
// Where the signature goes: a hidden marker (white, 8pt) is written in the document beside the safety officer's line;
// the rendered PDF is searched for it (findTextSpot) and the signature drawn there. Not found = the fixed spot
// measured on the contractors' template (PERMIT_SPOT of routine-db.js) or, on the maintenance workers' form, the
// default corner; the result says which.
import { readZip, writeZip, entryText } from './_xlsxpatch.js';
import { PDFDocument } from './_pdflib.js';
import { stampPdf, SIGN_BUCKET, SIGN_OBJ, ilDate } from './_sign.js';
import { findTextSpot } from './_pdftext.js';
import { GRAPH_TIMEOUT_MS as GRAPH_MS, FILE_TIMEOUT_MS as FILE_MS, SB_TIMEOUT_MS as SB_MS, tmo } from './_shared.js';
import { SITE } from './_site.js';

// The safety folder (routine-db.js OD_ROOT; not imported: routine-db imports works.js, which imports this file).
export const OD_SAFETY = '\u05e9\u05d5\u05dc\u05d7\u05df \u05d4\u05e2\u05d1\u05d5\u05d3\u05d4/\u05e0\u05d9\u05d4\u05d5\u05dc \u05d1\u05d8\u05d9\u05d7\u05d5\u05ea/';
export const PERMIT_TOP = '18_\u05e2\u05d1\u05d5\u05d3\u05d5\u05ea \u05d1\u05e1\u05d9\u05db\u05d5\u05df \u05d2\u05d1\u05d5\u05d4';
const TPL = PERMIT_TOP + '/01_\u05d4\u05e8\u05e9\u05d0\u05ea \u05e2\u05d1\u05d5\u05d3\u05d4 \u05d5\u05d4\u05e8\u05e9\u05d0\u05ea \u05d1\u05d8\u05d9\u05d7\u05d5\u05ea/';
// [the work permit, the safety permit] per who does the work (works.js: 'ctr' a contractor, 'emp' the factory's workers).
// The contractors' ones are .docx copies of the .doc originals (DECISIONS 05/11/2026, "\u05ea\u05d1\u05e0\u05d9\u05d5\u05ea \u05d4\u05e7\u05d1\u05dc\u05e0\u05d9\u05dd").
export const TEMPLATES = {
  ctr: [TPL + '\u05ea\u05d1\u05e0\u05d9\u05d5\u05ea \u05dc\u05e7\u05d1\u05dc\u05e0\u05d9\u05dd/2025-10-30 - \u05d4\u05e8\u05e9\u05d0\u05ea \u05e2\u05d1\u05d5\u05d3\u05d4 - \u05ea\u05d1\u05e0\u05d9\u05ea \u05dc\u05e7\u05d1\u05dc\u05e0\u05d9\u05dd.docx', TPL + '\u05ea\u05d1\u05e0\u05d9\u05d5\u05ea \u05dc\u05e7\u05d1\u05dc\u05e0\u05d9\u05dd/2025-10-30 - \u05d4\u05e8\u05e9\u05d0\u05ea \u05d1\u05d8\u05d9\u05d7\u05d5\u05ea - \u05ea\u05d1\u05e0\u05d9\u05ea \u05dc\u05e7\u05d1\u05dc\u05e0\u05d9\u05dd.docx'],
  emp: [TPL + '\u05ea\u05d1\u05e0\u05d9\u05d5\u05ea \u05dc\u05e2\u05d5\u05d1\u05d3\u05d9 \u05d0\u05d7\u05d6\u05e7\u05d4/2026-06-24 - \u05d4\u05e8\u05e9\u05d0\u05ea \u05e2\u05d1\u05d5\u05d3\u05d4 - \u05ea\u05d1\u05e0\u05d9\u05ea \u05dc\u05e2\u05d5\u05d1\u05d3\u05d9 \u05d0\u05d7\u05d6\u05e7\u05d4.docx', TPL + '\u05ea\u05d1\u05e0\u05d9\u05d5\u05ea \u05dc\u05e2\u05d5\u05d1\u05d3\u05d9 \u05d0\u05d7\u05d6\u05e7\u05d4/2026-06-24 - \u05d4\u05e8\u05e9\u05d0\u05ea \u05d1\u05d8\u05d9\u05d7\u05d5\u05ea - \u05ea\u05d1\u05e0\u05d9\u05ea \u05dc\u05e2\u05d5\u05d1\u05d3\u05d9 \u05d0\u05d7\u05d6\u05e7\u05d4.docx'],
};
export const FILED_DIR = PERMIT_TOP + '/02_\u05d4\u05e8\u05e9\u05d0\u05d5\u05ea \u05d7\u05ea\u05d5\u05de\u05d5\u05ea';
export const PERMIT_MAX = 8 * 1024 * 1024;   // a template or a rendered PDF read whole into the Worker
export const ATTACH_MAX = 3 * 1024 * 1024;   // Graph sendMail takes about 4MB a request; above this the mail carries a link
export const SIGN_MARK = 'qzxSgq';  // no word in Hebrew or English has it ("eSign" collided with "design")
export const SIG_W = 90;
// The live PDF of 05/11/2026: the full stamp (signature, name stamp, date) overlapped the lines above and below the
// officer's line. On a form line: the signature alone, at most this tall (points).
export const SIG_MAX_H = 16;
// PERMIT_SPOT of routine-db.js (measured on the contractors' safety template 22/10/2026), on the safety form's page 2.
export const FALLBACK_SPOT = { x: 225, y: 342, w: 90 };

// The section of each kind in the safety form, by the start of its title, and how the work's measures (works.js CATS
// items, in the form's own order) map to the form's boxes when they are not one to one.
export const HEADS = { hot: '\u05e2\u05d1\u05d5\u05d3\u05d5\u05ea \u05d7\u05de\u05d5\u05ea', hgt: '\u05e2\u05d1\u05d5\u05d3\u05d4 \u05d1\u05d2\u05d5\u05d1\u05d4', elc: '\u05e2\u05d1\u05d5\u05d3\u05d5\u05ea \u05d7\u05e9\u05de\u05dc', eng: '\u05e2\u05d1\u05d5\u05d3\u05d5\u05ea \u05e0\u05d9\u05ea\u05d5\u05e7 \u05d0\u05e0\u05e8\u05d2\u05d9\u05d4', lft: '\u05e2\u05d1\u05d5\u05d3\u05d5\u05ea \u05d4\u05e0\u05e4\u05d4',
  chm: '\u05e2\u05d1\u05d5\u05d3\u05d4 \u05d1\u05e7\u05e8\u05d1\u05ea \u05db\u05d9\u05de\u05d9\u05e7\u05dc\u05d9\u05dd', cnf: '\u05e2\u05d1\u05d5\u05d3\u05d5\u05ea \u05d1\u05d7\u05dc\u05dc \u05de\u05d5\u05e7\u05e3', rof: '\u05e2\u05d1\u05d5\u05d3\u05d5\u05ea \u05e2\u05dc \u05d2\u05d2\u05d5\u05ea' };
export const SEC_STOP = '\u05db\u05dc\u05dc\u05d9';
export const BOX_MAP = { elc: { 0: [0, 1] }, rof: { 5: [5, 6] } };
// The boxes in the title of hot work: welding, cutting, grinding, soldering, ticked by the description's words.
export const HOT_SUBS = [/\u05e8\u05d9\u05ea\u05d5?[\u05db\u05da]|\u05dc\u05e8\u05ea\u05da/, /\u05d7\u05d9\u05ea\u05d5?[\u05db\u05da]|\u05dc\u05d7\u05ea\u05d5\u05da/, /\u05d4\u05e9\u05d7\u05d6|\u05dc\u05d4\u05e9\u05d7\u05d9\u05d6|\u05de\u05e9\u05d7\u05d6\u05ea/, /\u05d4\u05dc\u05d7\u05de|\u05dc\u05d4\u05dc\u05d7\u05d9\u05dd/];
export const BOX = '\uf00e';

// ---- the Word file ----
const xesc = (s) => String(s).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\ufffe\uffff]/g, '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const xun = (s) => String(s).replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'")
  .replace(/&#x([0-9a-fA-F]+);/g, (m, h) => String.fromCharCode(parseInt(h, 16))).replace(/&#(\d+);/g, (m, d) => String.fromCharCode(+d)).replace(/&amp;/g, '&');
export const norm = (s) => String(s || '').replace(/[\s\u00a0]+/g, ' ').trim();
// Innermost paragraphs (no paragraph inside), runs, text nodes.
const P_RE = /<w:p\b[^>]*>(?:(?!<w:p\b)[\s\S])*?<\/w:p>/g;
const R_RE = /<w:r\b[^>]*>[\s\S]*?<\/w:r>/g;
const T_RE = /<w:t(\s[^>]*)?>([^<]*)<\/w:t>/g;
const BLANK_RE = /_+(?:[ \t\u00a0]*_+)*/g;
const ARIAL = '<w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/>';
const MARK_RUN = '<w:r><w:rPr>' + ARIAL + '<w:color w:val="FFFFFF"/><w:sz w:val="16"/><w:szCs w:val="16"/></w:rPr><w:t>' + SIGN_MARK + '</w:t></w:r>';

function para(px, s) {
  const runs = [], nodes = []; let text = '';
  for (const m of px.matchAll(R_RE)) {
    const ri = runs.length;
    runs.push({ s: m.index, xml: m[0] });
    for (const t of m[0].matchAll(T_RE)) { const txt = xun(t[2]); nodes.push({ ri, s: t.index, len: t[0].length, at: text.length, txt, cur: txt }); text += txt; }
  }
  return { px, s, runs, nodes, text, fills: [], font: {}, before: {}, prefix: '', append: '' };
}
export const blanksOf = (text) => [...String(text).matchAll(BLANK_RE)].map((m) => [m.index, m.index + m[0].length]);
// One character of the paragraph's text, changed in place (same length, so other offsets stay).
function setChar(P, i, ch) {
  const n = P.nodes.find((x) => i >= x.at && i < x.at + x.txt.length);
  if (!n) return false;
  const k = i - n.at;
  n.cur = n.cur.slice(0, k) + ch + n.cur.slice(k + 1);
  P.font[n.ri] = true;
  return true;
}
// A value into a blank: in its first node, the rest of the blank removed; a space where it touches a letter.
function put(P, b, val) {
  const [s, e] = b, t = P.text;
  const v = (s > 0 && !/\s/.test(t[s - 1]) ? ' ' : '') + val + (e < t.length && !/\s/.test(t[e]) ? ' ' : '');
  let first = true;
  for (const n of P.nodes) {
    const ns = n.at, ne = n.at + n.txt.length;
    if (ne <= s || ns >= e) continue;
    const lo = Math.max(s, ns) - ns, hi = Math.min(e, ne) - ns;
    n.cur = n.cur.slice(0, lo) + (first ? v : '') + n.cur.slice(hi);
    first = false;
  }
}
function setFont(x) {
  if (x.indexOf('<w:rPr>') >= 0) return x.replace(/<w:rFonts\b[^>]*\/>/, '').replace('<w:rPr>', '<w:rPr>' + ARIAL);
  return x.replace(/^(<w:r\b[^>]*>)/, '$1<w:rPr>' + ARIAL + '</w:rPr>');
}
function unpara(P) {
  // fills from the last blank back (a node's earlier offsets stay valid), then the title's prefix
  P.fills.sort((a, b) => b[0][0] - a[0][0]).forEach(([b, v]) => { if (v && typeof v === 'object' && v.hidden) return; put(P, b, v); });
  P.fills.forEach(([b, v]) => {
    if (!(v && typeof v === 'object' && v.hidden)) return;
    const n = P.nodes.find((x) => b[0] >= x.at && b[0] < x.at + x.txt.length);
    if (n) P.before[n.ri] = (P.before[n.ri] || '') + MARK_RUN;
  });
  if (P.prefix) { const n = P.nodes.find((x) => x.cur.trim()); if (n) n.cur = n.cur.replace(/^(\s*)/, '$1' + P.prefix); }
  let px = P.px;
  for (let i = P.runs.length - 1; i >= 0; i--) {
    const r = P.runs[i]; let x = r.xml;
    const ns = P.nodes.filter((n) => n.ri === i);
    for (let k = ns.length - 1; k >= 0; k--) { const n = ns[k]; if (n.cur !== n.txt) x = x.slice(0, n.s) + '<w:t xml:space="preserve">' + xesc(n.cur) + '</w:t>' + x.slice(n.s + n.len); }
    if (P.font[i]) x = setFont(x);
    if (P.before[i]) x = P.before[i] + x;
    if (x !== r.xml) px = px.slice(0, r.s) + x + px.slice(r.s + r.xml.length);
  }
  return px + P.append;
}
// A new line after a paragraph, in its paragraph and run formatting (never its section break).
function lineAfter(P, text, marker) {
  const ppr = ((/<w:pPr>[\s\S]*?<\/w:pPr>/.exec(P.px) || [''])[0]).replace(/<w:sectPr\b[\s\S]*?<\/w:sectPr>/, '');
  const r0 = P.nodes.length ? P.runs[P.nodes[0].ri].xml : '';
  const rpr = (/<w:rPr>[\s\S]*?<\/w:rPr>/.exec(r0) || [''])[0];
  return '<w:p>' + ppr + '<w:r>' + rpr + '<w:t xml:space="preserve">' + xesc(text) + ' </w:t></w:r>' + (marker ? MARK_RUN : '') + '</w:p>';
}

// spec = {
//   fill: [{ at: label (start of the paragraph's text), nth: which paragraph with that start (0), vals: [value per
//          blank in order; '' / null = left blank; { hidden: true } = the signature marker] }],
//   sections: [{ head, mark: true (an X before the title), boxes: [box index in the section], headBoxes: [box index
//          in the title], other: text for the section's "other" blank (its box ticked) }],
//   append: { after: label, text, marker: true } }
// Returns { bytes, report: { filled, ticked, missing: [what was not found] } }.
export async function fillPermit(bytes, spec) {
  const entries = readZip(bytes);
  const doc = entries.find((e) => e.name === 'word/document.xml');
  if (!doc) throw new Error('not a word file');
  const xml = await entryText(doc, 4 * 1024 * 1024);
  const paras = [...xml.matchAll(P_RE)].map((m) => para(m[0], m.index));
  const report = { filled: 0, ticked: 0, missing: [] };
  const starts = (P, at) => norm(P.text).indexOf(norm(at)) === 0;
  const find = (at, nth) => paras.filter((P) => starts(P, at))[nth || 0] || null;
  for (const f of (spec.fill || [])) {
    const P = find(f.at, f.nth);
    if (!P) { if (f.vals.some((v) => v)) report.missing.push(f.at); continue; }
    const bl = blanksOf(P.text);
    f.vals.forEach((v, i) => {
      if (!v) return;
      if (!bl[i]) { report.missing.push(f.at + ' #' + i); return; }
      P.fills.push([bl[i], typeof v === 'object' ? v : String(v)]); report.filled++;
    });
  }
  const heads = Object.values(HEADS).map(norm);
  const bound = (P) => { const t = norm(P.text); return t.indexOf(SEC_STOP) === 0 || heads.some((h) => t.indexOf(h) === 0); };
  const boxesIn = (P) => { const o = []; for (let i = 0; i < P.text.length; i++) if (P.text[i] === BOX) o.push(i); return o; };
  for (const sec of (spec.sections || [])) {
    const hi = paras.findIndex((P) => starts(P, sec.head));
    if (hi < 0) { report.missing.push(sec.head); continue; }
    const H = paras[hi];
    if (sec.mark) H.prefix = 'X ';
    const hb = boxesIn(H);
    (sec.headBoxes || []).forEach((j) => { if (hb[j] !== undefined && setChar(H, hb[j], 'X')) report.ticked++; else report.missing.push(sec.head + ' title #' + j); });
    const body = [];
    for (let i = hi + 1; i < paras.length && !bound(paras[i]); i++) body.push(paras[i]);
    const boxes = [].concat(...body.map((P) => boxesIn(P).map((i) => [P, i])));
    (sec.boxes || []).forEach((j) => { if (boxes[j] && setChar(boxes[j][0], boxes[j][1], 'X')) report.ticked++; else report.missing.push(sec.head + ' #' + j); });
    if (sec.other) {
      // the blank right after the word "other" (the electrical section's motor / electrician blanks are not it)
      const otherAt = (x) => blanksOf(x.text).find((b) => /\u05d0\u05d7\u05e8\s*$/.test(x.text.slice(0, b[0])));
      const P = body.find((x) => otherAt(x));
      if (!P) { report.missing.push(sec.head + ' other'); continue; }
      const b = otherAt(P);
      const box = boxesIn(P).filter((i) => i < b[0]).pop();
      if (box !== undefined && setChar(P, box, 'X')) report.ticked++;
      P.fills.push([b, sec.other]); report.filled++;
    }
  }
  // The work permit's list of kinds ("\u05e2\u05d1\u05d5\u05d3\u05d4 \u05d1\u05d2\u05d5\u05d1\u05d4:, \u05e2\u05d1\u05d5\u05d3\u05d5\u05ea \u05d7\u05e9\u05de\u05dc,: ..."): "X " before each kind of the work, in the line
  // where it appears (the live PDF of 05/11/2026 showed the work permit with none marked). Right to left within a
  // paragraph, so an insertion never moves the next one.
  const marks = new Map();
  for (const word of (spec.markWords || [])) {
    const P = paras.find((x) => x.text.indexOf(word) >= 0);
    if (!P) { report.missing.push(word); continue; }
    if (!marks.has(P)) marks.set(P, []);
    marks.get(P).push(P.text.indexOf(word));
  }
  for (const [P, at] of marks) at.sort((a, b) => b - a).forEach((i) => { if (setChar(P, i, 'X ' + P.text[i])) report.ticked++; });
  if (spec.append) {
    const P = find(spec.append.after, 0);
    if (P) { P.append = lineAfter(P, spec.append.text, spec.append.marker); report.filled++; } else report.missing.push(spec.append.after);
  }
  let out = xml;
  for (let i = paras.length - 1; i >= 0; i--) {
    const P = paras[i], nx = unpara(P);
    if (nx !== P.px) out = out.slice(0, P.s) + nx + out.slice(P.s + P.px.length);
  }
  doc.text = out;
  return { bytes: await writeZip(entries), report };
}

// ---- what goes where (pure) ----
const dmy = (ymd) => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(ymd || '')); return m ? m[3] + '/' + m[2] + '/' + m[1] : ''; };
// The signature marker never comes from what a link user typed (security review 05/11/2026): "eSign" in a value
// would move Michael's signature next to it. Removed in both directions, any spacing.
export const unmark = (s) => String(s).replace(/q\s*z\s*x\s*s\s*g\s*q|q\s*g\s*s\s*x\s*z\s*q/gi, '');
const one = (s, max) => unmark(norm(String(s || '').replace(/[\r\n]+/g, ', '))).slice(0, max);
// w: a work as works.js rowToWork gives it (who, con, sup, ph, wkr, area, dep, ds, de, ts, te, desc, cats, st);
// o: { num, date (DD/MM/YYYY, the approval), closed }. form: 'work' | 'safety'.
export function permitSpec(form, w, o) {
  const ctr = w.who === 'ctr';
  const okn = w.st && w.st.okn;
  const desc = one(w.desc, 600) + (okn ? ' | \u05d4\u05e2\u05e8\u05d5\u05ea \u05d4\u05de\u05de\u05d5\u05e0\u05d4: ' + one(okn, 200) : '');
  const firstWkr = one(String(w.wkr || '').split(/[,;\n]/)[0], 60);
  const fill = [
    { at: '\u05de\u05e1\u05e4\u05e8 \u05d4\u05e8\u05e9\u05d0\u05d4', vals: [one(o.num, 20)] },
    { at: '\u05ea\u05d0\u05e8\u05d9\u05da \u05ea\u05d7\u05d9\u05dc\u05ea \u05d4\u05e2\u05d1\u05d5\u05d3\u05d4', vals: [dmy(w.ds), dmy(w.de), w.ts, w.te] },
    { at: ctr ? '\u05e9\u05dd \u05e7\u05d1\u05dc\u05df' : '\u05e9\u05dd \u05e2\u05d5\u05d1\u05d3 \u05d0\u05d7\u05d6\u05e7\u05d4', vals: [ctr ? one(w.con, 80) : (firstWkr || one(w.sup, 60)), one(w.sup, 60), one(w.ph, 20)] },
    { at: '\u05e9\u05de\u05d5\u05ea \u05d4\u05e2\u05d5\u05d1\u05d3\u05d9\u05dd', vals: [one(w.wkr, 300)] },
    { at: '\u05de\u05e7\u05d5\u05dd \u05d4\u05e2\u05d1\u05d5\u05d3\u05d4', vals: [one(w.area, 80), one(w.dep, 80)] },
    { at: '\u05ea\u05d9\u05d0\u05d5\u05e8 \u05d4\u05e2\u05d1\u05d5\u05d3\u05d4', vals: [desc] },
  ];
  const chk = (w.st && w.st.chk) || {};
  if (o.closed && chk.close) {
    fill.push({ at: '\u05d0\u05e0\u05d9 \u05de\u05d0\u05e9\u05e8 \u05d1\u05d6\u05d4 \u05db\u05d9 \u05e1\u05d9\u05d9\u05de\u05ea\u05d9', vals: [chk.close.end] });
    fill.push({ at: '\u05e9\u05dd \u05d4\u05de\u05d1\u05e6\u05e2', nth: 1, vals: [one(chk.close.by, 60)] });
  }
  if (form === 'work') return { fill, markWords: (w.cats || []).filter((k) => HEADS[k]).map((k) => HEADS[k]) };
  if (chk.elc) fill.push({ at: "\u05de\u05e1' \u05de\u05e0\u05d5\u05e2/\u05de\u05db\u05d5\u05e0\u05d4 \u05e9\u05e0\u05d5\u05ea\u05e7", vals: [one(chk.elc.mot, 80), one(chk.elc.ele, 80)] });
  if (ctr) fill.push({ at: '\u05e9\u05dd \u05de\u05de\u05d5\u05e0\u05d4', vals: [SITE.owner, o.date, { hidden: true }] });
  const sections = (w.cats || []).filter((k) => HEADS[k]).map((k) => {
    const x = chk[k] || { items: [] }, map = BOX_MAP[k] || {};
    const boxes = [].concat(...(x.items || []).map((i) => map[i] || [i]));
    const sec = { head: HEADS[k], mark: true, boxes, other: x.other ? one(x.other, 120) : '' };
    if (k === 'hot') sec.headBoxes = HOT_SUBS.map((re, j) => (re.test(String(w.desc || '')) ? j : -1)).filter((j) => j >= 0);
    return sec;
  });
  const spec = { fill, sections };
  // The maintenance workers' form has no line for the safety officer (Michael 05/11/2026: "a line at the bottom").
  if (!ctr) spec.append = { after: '\u05d4\u05d8\u05d5\u05e4\u05e1 \u05d4\u05d5\u05db\u05df \u05e2\u05dc \u05d9\u05d3\u05d9 \u05de\u05de\u05d5\u05e0\u05d4 \u05d4\u05d1\u05d8\u05d9\u05d7\u05d5\u05ea', text: '\u05d0\u05d5\u05e9\u05e8 \u05e2\u05dc \u05d9\u05d3\u05d9 \u05de\u05de\u05d5\u05e0\u05d4 \u05d4\u05d1\u05d8\u05d9\u05d7\u05d5\u05ea, ' + SITE.owner + ', ' + o.date, marker: true };
  return spec;
}

// A name OneDrive and Windows accept: no path or reserved characters, no direction marks, one space, no dot at the end.
export function safeName(s, max) {
  return String(s || '').replace(/[\u0000-\u001f\u007f"*:<>?/\\|#%~&{}\u200b-\u200f\u202a-\u202e\u2066-\u2069]/g, ' ')
    .replace(/\.{2,}/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max).replace(/[.\s]+$/, '').trim();
}
// "<YYYY-MM-DD> - \u05d4\u05e8\u05e9\u05d0\u05d4 <num> - <short description>" (+ " - \u05e1\u05d2\u05d5\u05e8\u05d4").
export function permitBase(w, num, closed) {
  const d = /^\d{4}-\d{2}-\d{2}$/.test(String(w.ds || '')) ? w.ds : '0000-00-00';
  return d + ' - \u05d4\u05e8\u05e9\u05d0\u05d4 ' + (safeName(num, 20) || '\u05dc\u05dc\u05d0 \u05de\u05e1\u05e4\u05e8') + ' - ' + (safeName(w.desc, 40) || '\u05e2\u05d1\u05d5\u05d3\u05d4') + (closed ? ' - \u05e1\u05d2\u05d5\u05e8\u05d4' : '');
}

// ---- OneDrive, the rendering, the signature ----
const G = 'https://graph.microsoft.com/v1.0/me/drive/';
const enc = (p) => String(p).split('/').filter(Boolean).map(encodeURIComponent).join('/');
async function readBytes(r, max) {
  if (+(r.headers.get('content-length') || 0) > max) throw new Error('file over ' + max);
  const b = new Uint8Array(await r.arrayBuffer());
  if (b.length > max) throw new Error('file over ' + max);
  return b;
}
async function readTemplate(gh, path) {
  const r = await fetch(G + 'root:/' + enc(OD_SAFETY + path) + ':/content', { headers: gh, signal: tmo(FILE_MS) });
  if (!r.ok) throw new Error((r.status === 404 ? 'template missing: ' : 'template ' + r.status + ': ') + path.split('/').pop());
  const b = await readBytes(r, PERMIT_MAX);
  if (b[0] !== 0x50 || b[1] !== 0x4b) throw new Error('template is not a docx: ' + path.split('/').pop());
  return b;
}
// The month folder under the filing folder, made when missing (conflictBehavior=fail: an existing one is used as it is).
async function monthDir(gh, ym) {
  const parent = OD_SAFETY + FILED_DIR, path = parent + '/' + ym;
  const got = await fetch(G + 'root:/' + enc(path) + '?select=id,folder', { headers: gh, signal: tmo(GRAPH_MS) });
  if (got.ok) { if (!(await got.json().catch(() => ({}))).folder) throw new Error('month is not a folder'); return path; }
  if (got.status !== 404) throw new Error('month folder ' + got.status);
  const par = await fetch(G + 'root:/' + enc(parent) + '?select=id,folder', { headers: gh, signal: tmo(GRAPH_MS) });
  if (!par.ok) throw new Error('filing folder ' + par.status);
  const pj = await par.json();
  if (!pj.folder) throw new Error('filing folder is not a folder');
  const mk = await fetch(G + 'items/' + encodeURIComponent(pj.id) + '/children', { method: 'POST', headers: { ...gh, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: ym, folder: {}, '@microsoft.graph.conflictBehavior': 'fail' }), signal: tmo(GRAPH_MS) });
  if (!mk.ok && mk.status !== 409) throw new Error('month folder create ' + mk.status);
  return path;
}
// A new file, never replacing one (rename on a clash). { id, name, webUrl }.
async function upload(gh, dir, name, bytes, type) {
  const r = await fetch(G + 'root:/' + enc(dir + '/' + name) + ':/content?@microsoft.graph.conflictBehavior=rename', { method: 'PUT', headers: { ...gh, 'Content-Type': type }, body: bytes, signal: tmo(FILE_MS) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.id) throw new Error('put ' + r.status);
  return { id: j.id, name: j.name || name, webUrl: j.webUrl || null };
}
async function toPdf(gh, id) {
  const r = await fetch(G + 'items/' + encodeURIComponent(id) + '/content?format=pdf', { headers: gh, signal: tmo(FILE_MS) });
  if (!r.ok) throw new Error('convert ' + r.status);
  const b = await readBytes(r, PERMIT_MAX);
  if (b.length < 5 || String.fromCharCode(...b.slice(0, 5)) !== '%PDF-') throw new Error('convert: not a pdf');
  return b;
}
async function signature(env, sbUrl) {
  const k = env.SUPABASE_SERVICE_ROLE_KEY;
  const r = await fetch(sbUrl + '/storage/v1/object/' + SIGN_BUCKET + '/' + SIGN_OBJ, { headers: { apikey: k, Authorization: 'Bearer ' + k }, signal: tmo(SB_MS) });
  if (!r.ok) throw new Error(r.status === 400 || r.status === 404 ? 'no signature image' : 'signature ' + r.status);
  return new Uint8Array(await r.arrayBuffer());
}
// Where the signature goes on the merged PDF, its bottom on the marker's line, only on a safety-form page; else the
// fixed spot. Contractors: the marker stands right of the signature line (bidi: "\u05d7\u05ea\u05d9\u05de\u05d4" <marker> "____" in an RTL
// line), so the signature is centred on the line left of it (seen in a LibreOffice render 05/11/2026; Word's own render
// was not seen). Maintenance workers: the line is new and right-aligned, so the signature goes at the left margin of its
// row (the marker sits inside the date's left-to-right run, its x is not reliable). Pure but for the PDF read.
export const EMP_SIG_X = 40;
export async function signSpot(merged, workPages, ctr) {
  const doc = await PDFDocument.load(merged);
  const n = doc.getPageCount();
  const m = findTextSpot(doc, SIGN_MARK);
  if (m && m.page > workPages) return { page: m.page, x: ctr ? Math.max(20, Math.round(m.x - 80)) : EMP_SIG_X, y: Math.round(m.y - 2), w: SIG_W, found: true };
  if (ctr) return { page: Math.min(n, workPages + 2), x: FALLBACK_SPOT.x, y: FALLBACK_SPOT.y, w: FALLBACK_SPOT.w, found: false };
  return { page: n, found: false };
}
export async function mergePdfs(list) {
  const out = await PDFDocument.create();
  const counts = [];
  for (const b of list) {
    const d = await PDFDocument.load(b);
    const pages = await out.copyPages(d, d.getPageIndices());
    pages.forEach((p) => out.addPage(p));
    counts.push(pages.length);
  }
  return { bytes: await out.save(), counts };
}

// The whole permit of one work: templates, filling, the month folder, the two Word files, their PDFs, the merge, the
// signature, the signed PDF. job = { w, num, friday, closed, nowMs }. Returns { ok, path (under the safety folder),
// name, webUrl, bytes, docx: [names], spot: 'marker' | 'fixed', missing } or throws.
export async function buildPermit(env, sbUrl, token, job) {
  const w = job.w, closed = !!job.closed;
  const tpl = TEMPLATES[w.who];
  if (!tpl) throw new Error('unknown who');
  const gh = { Authorization: 'Bearer ' + token };
  const date = ilDate(job.nowMs);
  const [workT, safeT] = await Promise.all(tpl.map((p) => readTemplate(gh, p)));
  const o = { num: job.num, date, closed };
  const fw = await fillPermit(workT, permitSpec('work', w, o));
  const fs = await fillPermit(safeT, permitSpec('safety', w, o));
  const ymd = /^\d{4}-\d{2}-\d{2}$/.test(String(w.ds || '')) ? w.ds : job.friday;
  const dir = await monthDir(gh, ymd.slice(0, 7));
  const base = permitBase(Object.assign({}, w, { ds: ymd }), job.num, closed);
  const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  // in parallel: the whole job has to fit in the time Cloudflare gives after the answer (waitUntil, about 30 seconds)
  const [uw, us] = await Promise.all([upload(gh, dir, base + ' - \u05d4\u05e8\u05e9\u05d0\u05ea \u05e2\u05d1\u05d5\u05d3\u05d4.docx', fw.bytes, DOCX),
    upload(gh, dir, base + ' - \u05d4\u05e8\u05e9\u05d0\u05ea \u05d1\u05d8\u05d9\u05d7\u05d5\u05ea.docx', fs.bytes, DOCX)]);
  const [pw, ps] = await Promise.all([toPdf(gh, uw.id), toPdf(gh, us.id)]);
  const merged = await mergePdfs([pw, ps]);
  const spot = await signSpot(merged.bytes, merged.counts[0], w.who === 'ctr');
  const sig = await signature(env, sbUrl);
  const signed = await stampPdf(merged.bytes, sig, date, spot.found || w.who === 'ctr' ? { page: spot.page, x: spot.x, y: spot.y, w: spot.w, bare: true, maxH: SIG_MAX_H } : { page: spot.page });
  const up = await upload(gh, dir, base + '.pdf', signed, 'application/pdf');
  return { ok: true, path: dir.slice(OD_SAFETY.length) + '/' + up.name, name: up.name, webUrl: up.webUrl, bytes: signed, docx: [uw.name, us.name],
    spot: spot.found ? 'marker' : 'fixed', missing: fw.report.missing.concat(fs.report.missing) };
}
// Graph fileAttachment of a PDF.
export function pdfAttachment(name, bytes) {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return { '@odata.type': '#microsoft.graph.fileAttachment', name, contentType: 'application/pdf', contentBytes: btoa(s) };
}
