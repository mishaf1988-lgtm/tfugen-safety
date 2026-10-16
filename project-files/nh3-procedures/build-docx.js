// Procedures 26.03 and 26.04 as official Tapugan documents, with the decisions of
// 16/10/2026 built in (project-files/nh3-emergency-equipment.md, "הוחלט 16/10/2026").
// Michael, 16/10/2026: "the draft has to move into an official Tapugan document and into the file".
// The draft of that morning was built in a session container and was lost with it, so the
// builder lives here. Run: node build-docx.js  ->  two .docx beside this file.
// Source text: 26.03 = the PDF of 04/02/2025 in 17_חירום/נהלים ותרחישים, 26.04 = the PDF of
// 19/03/2015 (חידוש היתר/תוספות), both read in 365 on 16/10/2026. Keyboard characters only
// (CLAUDE.md): no long dash, no Hebrew maqaf, no gershayim sign, no curly quotes.
const fs = require('fs');
const path = require('path');
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, AlignmentType,
  Header, Footer, ImageRun, PageNumber, BorderStyle, ShadingType, VerticalAlign,
} = require('docx');

const DATE = '16.10.2026';
const LOGO = fs.readFileSync(path.join(__dirname, '..', '..', 'logo.jpg'));
const FONT = 'David';
const W = 9638; // A4 text width at 1 inch margins, DXA

const run = (text, o = {}) => new TextRun({ text, font: FONT, size: o.size || 24, bold: !!o.bold, rightToLeft: true, color: o.color, highlight: o.hl });
const para = (parts, o = {}) => new Paragraph({
  bidirectional: true,
  alignment: o.align || AlignmentType.RIGHT,
  spacing: { after: o.after === undefined ? 100 : o.after, line: 300 },
  indent: o.indent ? { right: o.indent } : undefined,
  children: (Array.isArray(parts) ? parts : [parts]).map((p) => (typeof p === 'string' ? run(p, o) : p)),
});
const border = { style: BorderStyle.SINGLE, size: 6, color: '000000' };
const borders = { top: border, bottom: border, left: border, right: border };
const cell = (children, width, o = {}) => new TableCell({
  borders, width: { size: width, type: WidthType.DXA }, verticalAlign: VerticalAlign.CENTER,
  columnSpan: o.span, rowSpan: o.rows,
  shading: o.fill ? { type: ShadingType.CLEAR, fill: o.fill, color: 'auto' } : undefined,
  margins: { top: 60, bottom: 60, left: 100, right: 100 },
  children: Array.isArray(children) ? children : [children],
});
const center = (t, o = {}) => para(t, Object.assign({ align: AlignmentType.CENTER, after: 0 }, o));

// The header of every page, as on the procedure PDFs: title, document number, page,
// update date, and the logo.
function header(title, num) {
  const c = [2200, 4038, 3400];
  const page = new Paragraph({ bidirectional: true, alignment: AlignmentType.CENTER, children: [
    run('עמוד ', { size: 20 }), new TextRun({ children: [PageNumber.CURRENT], font: FONT, size: 20 }),
    run(' מתוך ', { size: 20 }), new TextRun({ children: [PageNumber.TOTAL_PAGES], font: FONT, size: 20 }),
  ] });
  return new Header({ children: [new Table({
    width: { size: W, type: WidthType.DXA }, columnWidths: c, visuallyRightToLeft: true,
    rows: [
      new TableRow({ children: [
        cell(new Paragraph({ alignment: AlignmentType.CENTER, children: [new ImageRun({ type: 'jpg', data: LOGO, transformation: { width: 96, height: 64 } })] }), c[0], { rows: 2 }),
        cell(center(title, { bold: true, size: 26 }), c[1], { rows: 2 }),
        cell(center('תיעוד ' + num, { bold: true, size: 22 }), c[2]),
      ] }),
      new TableRow({ children: [cell([page, center('ת. עדכון: ' + DATE, { size: 20 })], c[2])] }),
    ],
  }), para('', { after: 0 })] });
}

// Written by / approved by, on the first page as on the originals. The signatures stay empty:
// the document is signed on paper or in the signing page, not by Claude.
function signTable() {
  const c = [2400, 2400, 2438, 2400];
  const row = (who, name, role) => new TableRow({ children: [
    cell(para([run(who + ' ', { bold: true, size: 22 }), run(name, { size: 22 })], { after: 0 }), c[0]),
    cell(para([run('תפקיד: ', { bold: true, size: 22 }), run(role, { size: 22 })], { after: 0 }), c[1]),
    cell(para([run('תאריך: ', { bold: true, size: 22 }), run(DATE, { size: 22 })], { after: 0 }), c[2]),
    cell(para(run('חתימה:', { bold: true, size: 22 }), { after: 0 }), c[3]),
  ] });
  return new Table({ width: { size: W, type: WidthType.DXA }, columnWidths: c, visuallyRightToLeft: true, rows: [
    row('נכתב ע"י:', 'מיכאל פרייליך', 'מנהל בטיחות ואיכות הסביבה'),
    row('אושר ע"י:', 'איתי הושמד', 'מנהל המפעל'),
  ] });
}

// The changes table at the end: what changed in this revision, so a reader of the
// signed copy sees it without comparing versions.
function changes(rows) {
  const c = [1600, 1600, 6438];
  const hd = (t, w) => cell(center(t, { bold: true, size: 22 }), w, { fill: 'D9D9D9' });
  return new Table({ width: { size: W, type: WidthType.DXA }, columnWidths: c, visuallyRightToLeft: true, rows: [
    new TableRow({ tableHeader: true, children: [hd('מהדורה / תאריך', c[0]), hd('סעיף', c[1]), hd('מה שונה', c[2])] }),
    ...rows.map((r) => new TableRow({ children: [cell(center(r[0], { size: 22 }), c[0]), cell(center(r[1], { size: 22 }), c[1]), cell(para(r[2], { size: 22, after: 0 }), c[2])] })),
  ] });
}

// Lines: [level, text] with level 0 = heading, 1 = numbered item, 2 = sub-item, 3 = list line.
// A line whose text starts with '+' is new in this revision. The signed copy shows no colour
// (the changes table says what changed); HIGHLIGHT=1 marks the new lines in yellow for review.
function body(lines) {
  return lines.map(([lv, t]) => {
    const isNew = t[0] === '+'; const text = isNew ? t.substring(1) : t;
    if (lv === 0) return para(run(text, { bold: true, size: 26 }), { after: 120 });
    const o = { indent: [0, 0, 400, 800][lv], hl: isNew && process.env.HIGHLIGHT === '1' ? 'yellow' : undefined };
    const m = /^([0-9.]+ )(.*)$/.exec(text);
    if (m && lv < 3) return para([run(m[1], { bold: true, hl: o.hl }), run(m[2], { hl: o.hl })], o);
    return para(run((lv === 3 ? '- ' : '') + text, { hl: o.hl }), o);
  });
}

function doc(title, num, lines, rev) {
  return new Document({
    styles: { default: { document: { run: { font: FONT, size: 24 } } } },
    sections: [{
      properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1440, bottom: 1200, left: 1134, right: 1134, header: 500 } } },
      headers: { default: header(title, num) },
      footers: { default: new Footer({ children: [center('העותק המבוקר נמצא אצל מנהל הבטיחות. עותק מודפס אינו מבוקר.', { size: 16, color: '666666' })] }) },
      children: [signTable(), para('', { after: 200 }), ...body(lines), para('', { after: 200 }),
        para(run('רישום שינויים', { bold: true, size: 26 }), { after: 120 }), changes(rev)],
    }],
  });
}

module.exports = { doc };

if (require.main === module) {
  const P = require('./content.json');
  const out = [
    [P.T2603, '26.03', P.L2603, P.R2603, 'נוהל 26.03 - טיפול במקרה של דליפת אמוניה - 16.10.2026.docx'],
    [P.T2604, '26.04', P.L2604, P.R2604, 'נוהל 26.04 - ריקון יזום של אמוניה ונעילה ותיוג - 16.10.2026.docx'],
  ];
  // Keyboard characters only (CLAUDE.md, 21/09/2026): refuse to build otherwise.
  const BAD = /[–—־׳״«»“”‘’•…·←-⇿]/;
  for (const [t, n, l, r, f] of out) {
    const all = [t].concat(l.map((x) => x[1]), [].concat(...r));
    const bad = all.find((s) => BAD.test(s));
    if (bad) { console.error('non-keyboard character in: ' + bad); process.exit(1); }
    Packer.toBuffer(doc(t, n, l, r)).then((b) => { fs.writeFileSync(path.join(__dirname, f), b); console.log('wrote ' + f + ' ' + b.length); });
  }
}
