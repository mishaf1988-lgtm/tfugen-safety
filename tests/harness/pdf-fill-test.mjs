// project-files/pdf-fill/fill.mjs (20/10/2026): the overlay that writes a form onto the original PDF.
// The full run (Chromium + pdf-lib) was checked by hand on a 3-page original + 2-page attachment;
// here only the page HTML, which is where a wrong position or an unescaped name would hide.
import { overlayHtml } from '../../project-files/pdf-fill/fill.mjs';

let pass = 0, fail = 0;
const check = (l, c, d) => { if (c) { pass++; console.log('  ✓ ' + l); } else { fail++; console.log('  ✗ ' + l + (d !== undefined ? '  -> ' + JSON.stringify(d).slice(0, 300) : '')); } };

const h = overlayHtml({ text: [
  { x: 338, w: 119, y: 186, t: 'A & B <x>', size: 10 },
  { x: 451, w: 72, y: 594, h: 20, t: 'FIRST\nLAST', size: 7, ltr: true, align: 'right' },
], rows: { x: [35, 178, 560], y: [614, 633] } }, 595.32, 841.92);
check('page size is the original page', h.includes('@page{size:595.32pt 841.92pt'), h.slice(0, 200));
check('text placed in points from the top-left', h.includes('left:338pt;width:119pt;top:186pt'));
check('a name is escaped, not markup', h.includes('A &amp; B &lt;x&gt;') && !h.includes('<x>'));
check('a new line in a cell is a <br>', h.includes('FIRST<br>LAST'));
check('a cell with h is centred vertically', h.includes('height:20pt;display:flex'));
check('ltr text (a passport, a Latin name) is ltr', h.includes('direction:ltr'));
check('right-aligned cell ends at the right', h.includes('align-items:flex-end'));
check('a drawn row: outer box without a top line', h.includes('border-top:none'));
check('a drawn row: one inner line per inner x', (h.match(/border-left:0.75pt/g) || []).length === 1);
check('no row when none asked', !overlayHtml({ text: [] }, 595, 842).includes('border-top:none'));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
