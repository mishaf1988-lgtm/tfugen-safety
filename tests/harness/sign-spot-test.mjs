// The signature on the document's own signature line (21/10/2026, Michael: "a document with a place for a
// signature", then "do it"). tests/fixtures/sign-line-form.pdf: two pages from Chromium, Hebrew in visual order,
// "חתימה: ____" on page 2. findSignSpot finds it, signPlace puts the signature on the line, stampPdf draws there,
// and a PDF without a label keeps the default corner.
import fs from 'fs';
import { PDFDocument } from './_build/_pdflib.mjs';
import { findSignSpot, isSignLabel, parseToUnicode, tokens, pageTexts } from './_build/_pdftext.mjs';
import { signPlace, signAskText, stampPdf } from './_build/_sign.mjs';

let pass = 0, fail = 0;
const check = (l, c, d) => { if (c) { pass++; console.log('  ✓ ' + l); } else { fail++; console.log('  ✗ ' + l + (d !== undefined ? '  -> ' + JSON.stringify(d).slice(0, 300) : '')); } };
const bytes = fs.readFileSync(new URL('../fixtures/sign-line-form.pdf', import.meta.url));

(async () => {
  check('labels: Hebrew in both orders, English, and not other words', isSignLabel('חתימה:') && isSignLabel(':המיתח') && isSignLabel('Signature') && !isSignLabel('תאריך'));
  const cm = parseToUnicode('1 begincodespacerange <0000> <FFFF> endcodespacerange 2 beginbfchar <0003> <05D7> <0004> <05EA> endbfchar 1 beginbfrange <0010> <0012> <0041> endbfrange');
  check('ToUnicode: bfchar and bfrange, 2-byte codes', cm.len === 2 && cm.map.get(3) === 'ח' && cm.map.get(0x11) === 'B');
  const t = pageTexts('BT /F1 12 Tf 1 0 0 1 100 200 Tm <00030004> Tj 0 -20 Td /F2 12 Tf (ab) Tj ET', { F1: cm, F2: null });
  check('page text: strings with their start position (Tm, Td)', t.length === 2 && t[0].text === 'חת' && t[0].x === 100 && t[0].y === 200 && t[1].y === 180, t);
  check('tokens: escapes and nested parentheses in a literal string', tokens('(a\\(b\\)c) Tj')[0].s.length === 5);

  const doc = await PDFDocument.load(bytes);
  const spot = findSignSpot(doc);
  check('the fixture: the label on page 2, near the bottom half', spot && spot.page === 2 && spot.y > 400 && spot.y < 600 && spot.x > 300 && spot.x < 420, spot);
  const pl = signPlace(spot);
  // 20 underscores at 12pt are about 120pt: the signature fits inside them and leaves the label visible (21/10/2026,
// the first render had a 150pt signature over "חתימה:").
check('on the line: inside it, narrower than the line, on its height', pl && pl.page === 2 && pl.x >= spot.x && pl.x + pl.w <= spot.x + 20 * 12 * 0.5 && pl.w < 150 && Math.abs(pl.y - (spot.y - 2)) <= 1, { pl, spot });
  check('a label alone: the signature left of it', signPlace({ page: 1, x: 400, y: 100, text: ':המיתח' }).x === 400 - 6 - 150);
  check('no spot: no place (the default corner)', signPlace(null) === null);
  check('the question says where', signAskText('a.pdf', 'x', { page: 2 }).indexOf('על שורת החתימה בעמוד 2') > 0
    && signAskText('a.pdf', 'x', null).indexOf('לא מצאתי מקום חתימה') > 0);

  // A blank page: no label, so no spot.
  const blank = await PDFDocument.create(); blank.addPage([595, 842]);
  check('a PDF without a label: no spot', findSignSpot(await PDFDocument.load(await blank.save())) === null);

  // stampPdf draws on page 2 at the place (a 1x1 PNG stands for the signature).
  const png = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='), (c) => c.charCodeAt(0));
  const out = await stampPdf(bytes, png, '21/10/2026', pl);
  const after = await PDFDocument.load(out);
  const before = await PDFDocument.load(bytes);
  const len = (d, i) => { const c = d.getPages()[i].node.Contents(); return c ? String(c.constructor.name) + (c.asArray ? c.asArray().length : 1) : ''; };
  check('stamped on page 2, page 1 untouched', len(after, 1) !== len(before, 1) && len(after, 0) === len(before, 0), { p1: [len(before, 0), len(after, 0)], p2: [len(before, 1), len(after, 1)] });

  console.log('\nsign-spot-test: ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
