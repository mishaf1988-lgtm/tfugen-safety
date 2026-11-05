// The signed permit of an approved work (05/11/2026, stage B of the weekly works link; functions/_permit.js).
// The factory's four real templates (tests/fixtures/permit: the maintenance workers' work / safety permit of
// 24/06/2026, the contractors' .docx copies of 30/10/2025) are filled: every label gets its value, the filled blanks
// lose their underscores, the blanks with no value stay, the measures are ticked, the signature marker is where the
// safety officer signs, and every part but word/document.xml (the header, the logo) is byte for byte the template's.
// Then the PDF side: the marker is found on the rendered safety page, the merge keeps the page counts, file names.
import { readFileSync } from 'fs';
import { readZip, entryText } from './_build/_xlsxpatch.mjs';
import { PDFDocument, StandardFonts } from './_build/_pdflib.mjs';
import { fillPermit, permitSpec, permitBase, safeName, blanksOf, norm, signSpot, mergePdfs, pdfAttachment, BOX, SIGN_MARK, HEADS, TEMPLATES, FILED_DIR, FALLBACK_SPOT, EMP_SIG_X, unmark } from './_build/_permit.mjs';
import { findTextSpot } from './_build/_pdftext.mjs';
import { SITE } from './_build/_site.mjs';

let pass = 0, fail = 0;
const check = (l, c, d) => { if (c) { pass++; console.log('  ✓ ' + l); } else { fail++; console.log('  ✗ ' + l + (d !== undefined ? '  -> ' + JSON.stringify(d).slice(0, 500) : '')); } };
const fx = (n) => new Uint8Array(readFileSync(new URL('../fixtures/permit/' + n + '.docx', import.meta.url)));

// paragraphs of a document.xml as text (innermost w:p), for reading the result back
const paraTexts = (xml) => [...xml.matchAll(/<w:p\b[^>]*>(?:(?!<w:p\b)[\s\S])*?<\/w:p>/g)].map((m) => [...m[0].matchAll(/<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>/g)].map((t) => t[1]).join('')
  .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'"));
const lineOf = (xml, at, nth) => paraTexts(xml).filter((t) => norm(t).indexOf(at) === 0)[nth || 0] || '';
// well-formed: every tag closes in order, no bare "&"
function wellFormed(xml) {
  const body = xml.replace(/^<\?xml[^>]*\?>/, '');
  if (/&(?!(amp|lt|gt|quot|apos|#\d+|#x[0-9a-fA-F]+);)/.test(body)) return 'bare &';
  const st = [];
  for (const m of body.matchAll(/<(\/?)([A-Za-z_][\w:.-]*)[^>]*?(\/?)>/g)) {
    if (m[3]) continue;
    if (m[1]) { if (st.pop() !== m[2]) return 'close ' + m[2] + ' at ' + m.index; } else st.push(m[2]);
  }
  return st.length ? 'open ' + st.slice(-3).join(',') : '';
}
async function docXml(bytes) { return entryText(readZip(bytes).find((e) => e.name === 'word/document.xml')); }
function sameParts(a, b) {
  const A = readZip(a), B = readZip(b);
  if (A.map((e) => e.name).join() !== B.map((e) => e.name).join()) return 'names differ';
  for (let i = 0; i < A.length; i++) {
    if (A[i].name === 'word/document.xml') continue;
    if (A[i].crc !== B[i].crc || A[i].raw.length !== B[i].raw.length || !A[i].raw.every((x, k) => x === B[i].raw[k])) return 'changed: ' + A[i].name;
  }
  return '';
}

// A work as works.js rowToWork gives it: contractor, hot work (welding) + height + electrical, measures ticked.
const WORK = {
  who: 'ctr', con: 'ט"ס פרויקטים', sup: 'נועם כהן', ph: '050-1234567', wkr: 'אבי, משה\nדני', area: 'חדר אנרגיה', dep: 'אחזקה',
  ds: '2026-11-06', de: '2026-11-06', ts: '07:00', te: '15:00', desc: 'החלפת מלכודת קיטור, ריתוך צנרת & חיתוך <קו> 6"',
  cats: ['hot', 'hgt', 'elc'],
  st: { okn: 'לגדר את האזור', chk: {
    hot: { items: [0, 1, 2, 6], fw: 'יוסי', other: 'שמיכת ריתוך' },
    hgt: { items: [0, 3] },
    elc: { items: [0], mot: 'M-12', ele: 'רוני' },
    close: { items: [0], end: '14:30', c30: '15:00', by: 'נועם כהן' },
  } },
};
const O = { num: 'WK-0611-1', date: '05/11/2026', closed: false };

console.log('\n1. the contractors\' work permit');
{
  const t = fx('ctr-work');
  const r = await fillPermit(t, permitSpec('work', WORK, O));
  const x = await docXml(r.bytes);
  check('document.xml is well-formed', !wellFormed(x), wellFormed(x));
  check('every other part (header, logo, footer) byte for byte the template\'s', !sameParts(t, r.bytes), sameParts(t, r.bytes));
  check('nothing missing', r.report.missing.length === 0, r.report);
  const num = lineOf(x, 'מספר הרשאה');
  check('number: filled, its underscores gone', num.includes('WK-0611-1') && !num.includes('_'), num);
  const dt = lineOf(x, 'תאריך תחילת העבודה');
  check('dates DD/MM/YYYY and hours, in order, no underscores left', /06\/11\/2026.*06\/11\/2026.*07:00.*15:00/.test(dt) && !dt.includes('_'), dt);
  const nm = lineOf(x, 'שם קבלן');
  check('contractor, supervisor, phone in order', /ט"ס פרויקטים.*נועם כהן.*050-1234567/.test(nm) && !nm.includes('_'), nm);
  check('workers on one line', lineOf(x, 'שמות העובדים').includes('אבי, משה, דני'));
  const loc = lineOf(x, 'מקום העבודה');
  check('area and department; the two blanks with no value stay', loc.includes('חדר אנרגיה') && loc.includes('אחזקה') && blanksOf(loc).length === 2, loc);
  const ds = lineOf(x, 'תיאור העבודה');
  check('the description with Michael\'s notes, & < > " escaped and read back', ds.includes('ריתוך צנרת & חיתוך <קו> 6"') && ds.includes('הערות הממונה: לגדר את האזור') && !ds.includes('_'), ds);
  check('the signature lines of the field stay blank (not approved yet)', lineOf(x, 'שם מנהל').includes('____') && lineOf(x, 'שם המבצע').includes('____'));
  check('not closed: the closing line stays blank', lineOf(x, 'אני מאשר בזה כי סיימתי').includes('____'));
  check('the label text itself is kept', lineOf(x, 'שם קבלן').indexOf('שם קבלן') === 0 && dt.indexOf('תאריך תחילת העבודה') === 0);
}

console.log('\n2. the contractors\' safety permit: kinds, measures, the safety officer\'s line');
{
  const t = fx('ctr-safety');
  const spec = permitSpec('safety', WORK, O);
  const r = await fillPermit(t, spec);
  const x = await docXml(r.bytes);
  check('well-formed, other parts unchanged', !wellFormed(x) && !sameParts(t, r.bytes), [wellFormed(x), sameParts(t, r.bytes)]);
  check('nothing missing', r.report.missing.length === 0, r.report);
  const t0 = await docXml(t);
  const boxes = (s) => s.split(BOX).length - 1;
  // hot: 4 measures + other, + welding and cutting in the title; height 2; electrical item 0 = both boxes
  check('ticked: 4+1 hot, 2 title, 2 height, 2 electrical = 11', r.report.ticked === 11 && boxes(t0) - boxes(x) === 11, [r.report.ticked, boxes(t0) - boxes(x)]);
  check('each ticked kind\'s title starts with X, the others do not', ['עבודות חמות', 'עבודה בגובה', 'עבודות חשמל'].every((h) => paraTexts(x).some((p) => norm(p).indexOf('X ' + h) === 0))
    && !paraTexts(x).some((p) => /^X עבודות הנפה/.test(norm(p))));
  const hot = paraTexts(x).find((p) => norm(p).indexOf('אמצעי הבטיחות הנדרשים') === 0 && p.includes('היתר עבודה חמה'));
  check('hot measures 0,1,2: X before each', /X\s*היתר עבודה חמה\s*X\s*פינוי\s.*X\s*מטף/.test(hot), hot);
  check('hot title: welding and cutting ticked by the description, grinding and soldering not', /X\s*ריתוך\s*X\s*חיתוך/.test(lineOf(x, 'X עבודות חמות')) && lineOf(x, 'X עבודות חמות').includes(BOX + 'השחזה'), lineOf(x, 'X עבודות חמות'));
  const oth = paraTexts(x).find((p) => p.includes('שמיכת ריתוך'));
  check('"other": the text in its blank, its box ticked', !!oth && /X\s*אחר\s*שמיכת ריתוך/.test(oth), oth);
  check('a ticked box is an X in Arial', /<w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"\/>[^]*?<w:t xml:space="preserve">X<\/w:t>/.test(x));
  const mot = lineOf(x, "מס' מנוע/מכונה שנותק");
  check('electrical: the motor and the electrician', /M-12.*רוני/.test(mot), mot);
  const off = lineOf(x, 'שם ממונה');
  check('the safety officer: name and date, once each (the name blank is split over three runs)', off.split(SITE.owner).length === 2 && off.split('05/11/2026').length === 2, off);
  check('the signature marker sits on that line, hidden (white)', off.includes(SIGN_MARK) && new RegExp('<w:color w:val="FFFFFF"/>[^<]*<w:sz w:val="16"/><w:szCs w:val="16"/></w:rPr><w:t>' + SIGN_MARK).test(x));
  check('the signature line itself and the phone stay as lines', blanksOf(off.slice(off.indexOf(SIGN_MARK))).length === 2, off);
  check('the marker appears once', x.split(SIGN_MARK).length === 2);
}

console.log('\n3. the maintenance workers\' forms: the approval line at the bottom');
{
  const E = Object.assign({}, WORK, { who: 'emp', con: '', cats: ['cnf', 'rof'], st: { okn: '', chk: {
    cnf: { items: [0, 6], o2: '20.9' }, rof: { items: [5], other: 'x' } } } });
  const tw = fx('emp-work'), ts = fx('emp-safety');
  const rw = await fillPermit(tw, permitSpec('work', E, O));
  const xw = await docXml(rw.bytes);
  check('work permit: well-formed, other parts unchanged, nothing missing', !wellFormed(xw) && !sameParts(tw, rw.bytes) && !rw.report.missing.length, [wellFormed(xw), sameParts(tw, rw.bytes), rw.report]);
  check('the worker name: the first of the workers', /^שם עובד אחזקה\s+אבי\s/.test(norm(lineOf(xw, 'שם עובד אחזקה'))), lineOf(xw, 'שם עובד אחזקה'));
  check('no signature on the work permit', !xw.includes(SIGN_MARK));
  const sp = permitSpec('safety', E, O);
  const rs = await fillPermit(ts, sp);
  const xs = await docXml(rs.bytes);
  check('safety permit: well-formed, other parts unchanged', !wellFormed(xs) && !sameParts(ts, rs.bytes), [wellFormed(xs), sameParts(ts, rs.bytes)]);
  check('roofs: "other" is not on this form, reported, nothing else missing', rs.report.missing.join() === HEADS.rof + ' other', rs.report);
  const all = paraTexts(xs).map(norm);
  const at = all.findIndex((p) => p.indexOf('הטופס הוכן על ידי ממונה הבטיחות') === 0);
  check('a new line right after "the form was prepared by the safety officer": approved by, name, date, the marker', at > 0 && all[at + 1] === 'אושר על ידי ממונה הבטיחות, ' + SITE.owner + ', 05/11/2026 ' + SIGN_MARK, all[at + 1]);
  check('confined space: 2 boxes; roofs item 5 = two boxes (by licence, by the regulations)', rs.report.ticked === 4, rs.report);
  check('the template is not changed by filling (a new copy)', (await docXml(ts)).indexOf(SIGN_MARK) < 0);
}

console.log('\n4. closed: the end time and who closed');
{
  const t = fx('ctr-work');
  const r = await fillPermit(t, permitSpec('work', WORK, Object.assign({}, O, { closed: true })));
  const x = await docXml(r.bytes);
  const end = lineOf(x, 'אני מאשר בזה כי סיימתי');
  check('"I finished ... end time": 14:30', end.includes('14:30') && !end.includes('_'), end);
  check('the second "performer name" (the closing one) = who closed; the first stays blank', lineOf(x, 'שם המבצע', 1).includes('נועם כהן') && lineOf(x, 'שם המבצע', 0).includes('____'), [lineOf(x, 'שם המבצע', 0), lineOf(x, 'שם המבצע', 1)]);
}

console.log('\n5. pure helpers: blanks, names');
check('a blank split by spaces is one blank; text between makes two', blanksOf('a ______      _____ b ___').length === 2 && blanksOf('a ___ b').length === 1);
check('a value for a missing label is reported, never thrown', (await fillPermit(fx('ctr-work'), { fill: [{ at: 'אין כזה', vals: ['x'] }] })).report.missing[0] === 'אין כזה');
check('a file name with path and reserved characters is cleaned', safeName('a/b\\c:d*e?"f<g>|h#%‮.', 40) === 'a b c d e f g h', safeName('a/b\\c:d*e?"f<g>|h#%‮.', 40));
check('the base name: date, number, short description', permitBase({ ds: '2026-11-06', desc: 'החלפת מלכודת קיטור/../../x' }, 'WK-0611-1', false) === '2026-11-06 - הרשאה WK-0611-1 - החלפת מלכודת קיטור x', permitBase({ ds: '2026-11-06', desc: 'החלפת מלכודת קיטור/../../x' }, 'WK-0611-1', false));
check('closed: " - סגורה"; no number: "ללא מספר"; a bad date never reaches the name', permitBase({ ds: '../x', desc: 'a' }, '', true) === '0000-00-00 - הרשאה ללא מספר - a - סגורה');
check('the filing folder and the templates are in folder 18', FILED_DIR.indexOf('18_') === 0 && TEMPLATES.ctr.concat(TEMPLATES.emp).every((p) => p.indexOf('18_') === 0 && /\.docx$/.test(p)));

console.log('\n6. the PDF: the marker, the merge, the attachment');
async function pdfWith(pages, mark) {
  const d = await PDFDocument.create(); const f = await d.embedFont(StandardFonts.Helvetica);
  for (let i = 1; i <= pages; i++) { const p = d.addPage([595, 842]); p.drawText('page ' + i, { x: 50, y: 800, size: 12, font: f }); if (mark && mark.page === i) p.drawText(mark.text, { x: mark.x, y: mark.y, size: 8, font: f }); }
  return d.save();
}
{
  const work = await pdfWith(1), safe = await pdfWith(2, { page: 2, x: 300, y: 340, text: 'name date ' + SIGN_MARK });
  const m = await mergePdfs([work, safe]);
  check('merged: 1 + 2 pages', m.counts.join() === '1,2' && (await PDFDocument.load(m.bytes)).getPageCount() === 3);
  const sp = await signSpot(m.bytes, 1, true);
  check('the marker found on page 3; contractor: the signature on the line left of it, its bottom on the line', sp.found && sp.page === 3 && sp.x === Math.round(300 + 10 * 8 * 0.55 - 80) && sp.x + sp.w <= 300 + 10 * 8 * 0.55 + 12 && sp.y === 338, sp);
  const se = await signSpot(m.bytes, 1, false);
  check('maintenance workers: the marker\'s row, at the left margin', se.found && se.page === 3 && se.x === EMP_SIG_X && se.y === 338, se);
  const none = await mergePdfs([work, await pdfWith(2)]);
  const fb = await signSpot(none.bytes, 1, true);
  check('no marker, contractor: the measured spot on the safety form\'s page 2', !fb.found && fb.page === 3 && fb.x === FALLBACK_SPOT.x && fb.y === FALLBACK_SPOT.y, fb);
  const fe = await signSpot(none.bytes, 1, false);
  check('no marker, maintenance workers: the last page, default corner', !fe.found && fe.page === 3 && fe.x === undefined, fe);
  const onWork = await mergePdfs([await pdfWith(1, { page: 1, x: 100, y: 100, text: SIGN_MARK }), await pdfWith(2)]);
  check('a marker on the work permit\'s pages is not used', !(await signSpot(onWork.bytes, 1, true)).found);
  {
    const d = await PDFDocument.create(); const f = await d.embedFont(StandardFonts.Helvetica); const p = d.addPage([595, 842]);
    p.drawText('qzx', { x: 200, y: 100, size: 8, font: f }); p.drawText('Sgq', { x: 212, y: 100, size: 8, font: f });
    const s = findTextSpot(await PDFDocument.load(await d.save()), SIGN_MARK);
    check('findTextSpot: a marker split over two shows of a line is found, at its start', s && s.page === 1 && Math.round(s.x) === 200 && s.y === 100, s);
    check('findTextSpot: absent = null', findTextSpot(await PDFDocument.load(await pdfWith(1)), SIGN_MARK) === null);
  }
  const a = pdfAttachment('x.pdf', new Uint8Array([37, 80, 68, 70, 45]));
  check('the attachment: a Graph fileAttachment, base64', a['@odata.type'] === '#microsoft.graph.fileAttachment' && a.contentBytes === 'JVBERi0=' && a.contentType === 'application/pdf');
}

// security review 05/11/2026: a link user cannot plant the signature marker
{ const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  \u2717 ' + m); } };
  // pairs: 3 that must lose the marker, 3 real values that must stay as they are
  ok(unmark('x qzxSgq y') === 'x  y' && unmark('Q Z X S G Q') === '' && unmark('qgSxzq') === '', 'unmark removes the marker in both directions, any case and spacing');
  ok(unmark('Design Pro \u05d1\u05e2"\u05de') === 'Design Pro \u05d1\u05e2"\u05de' && unmark('eSign') === 'eSign' && unmark('\u05e8\u05d9\u05ea\u05d5\u05da \u05de\u05e2\u05e7\u05d4 qz') === '\u05e8\u05d9\u05ea\u05d5\u05da \u05de\u05e2\u05e7\u05d4 qz', 'real values (a contractor named Design, eSign, Hebrew) stay untouched');
  const sp = permitSpec('safety', { who: 'ctr', con: 'qzxSgq', sup: 'a', ph: '', wkr: 'q g s x z q', area: 'x', dep: '', ds: '2026-11-06', de: '2026-11-06', ts: '', te: '', desc: 'qzx sgq', cats: [], st: { chk: {}, blocks: [] } }, { num: '1', date: '06/11/2026' });
  const typed = JSON.stringify(sp);
  ok(!/q\s*g\s*s\s*x\s*z\s*q/i.test(typed) && (typed.match(/qzxSgq/g) || []).length <= 1, 'a work typed with the marker: the values carry none of it (only the officer line, if any)'); }

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
