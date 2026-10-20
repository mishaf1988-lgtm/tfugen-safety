// Fill a form on the ORIGINAL PDF: write text (and missing table lines) over one page,
// append attachments, save. Built from the WhatsApp assistant's run on 20/10/2026 (Bambi
// forklift order form, Michael: "on the original file with all the attachments"), so the
// next run does not rebuild it from scratch (it cost about a minute).
//
//   node project-files/pdf-fill/fill.mjs spec.json
//
// spec.json (all positions in points, from the TOP-LEFT of the page; A4 = 595 x 842):
//   { "in": "quote.pdf", "out": "out.pdf", "page": 3,
//     "text":  [{ "x": 338, "w": 119, "y": 186, "t": "...", "size": 10, "align": "center", "ltr": false, "h": 0 }],
//     "rows":  { "x": [35, 178, 228, 277, 363, 451, 524, 560], "y": [614, 633] },   // optional: a table row to draw
//     "append": ["attachment.pdf"] }
// "h" > 0 centres the text vertically in a box of that height (a table cell). "\n" in "t" = a new line.
// Find positions: pdftotext -f N -l N -bbox in.pdf out.html (word boxes), and render the result
// with pdftoppm -f N -l N -r 110 -png out.pdf chk and look at it before saving.
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { createRequire } from 'module';

const DEPS = path.join(process.env.HOME || '/tmp', '.cache', 'pdf-fill');
function need() {
  if (!fs.existsSync(path.join(DEPS, 'node_modules', 'pdf-lib')) || !fs.existsSync(path.join(DEPS, 'node_modules', 'playwright-core'))) {
    fs.mkdirSync(DEPS, { recursive: true });
    execSync('npm i --silent --no-audit --no-fund --prefix "' + DEPS + '" pdf-lib@1.17.1 playwright-core@1.56.1', { stdio: 'inherit' });
  }
  const req = createRequire(path.join(DEPS, 'x.js'));
  return { PDFDocument: req('pdf-lib').PDFDocument, chromium: req('playwright-core').chromium };
}
function chromePath() {
  const base = '/opt/pw-browsers';
  for (const d of fs.existsSync(base) ? fs.readdirSync(base).sort().reverse() : []) {
    const p = path.join(base, d, 'chrome-linux', 'chrome');
    if (d.startsWith('chromium') && fs.existsSync(p)) return p;
  }
  return execSync('which chromium || which chromium-browser').toString().trim();
}
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>');

export function overlayHtml(spec, W, H) {
  let h = '';
  for (const t of spec.text || []) {
    const box = t.h > 0 ? `height:${t.h}pt;display:flex;flex-direction:column;justify-content:center;align-items:${t.align === 'right' ? 'flex-end' : t.align === 'left' ? 'flex-start' : 'center'};` : '';
    h += `<div style="position:absolute;left:${t.x}pt;width:${t.w}pt;top:${t.y}pt;${box}font-size:${t.size || 10}pt;line-height:1.1;text-align:${t.align || 'center'};direction:${t.ltr ? 'ltr' : 'rtl'}">${esc(t.t)}</div>`;
  }
  if (spec.rows) {
    const xs = spec.rows.x, ys = spec.rows.y;
    for (let i = 0; i + 1 < ys.length; i++) {
      const t = ys[i], b = ys[i + 1];
      h += `<div style="position:absolute;left:${xs[0]}pt;top:${t}pt;width:${xs[xs.length - 1] - xs[0]}pt;height:${b - t}pt;border:0.75pt solid #000;border-top:none;box-sizing:border-box"></div>`;
      for (const x of xs.slice(1, -1)) h += `<div style="position:absolute;left:${x}pt;top:${t}pt;height:${b - t}pt;border-left:0.75pt solid #000"></div>`;
    }
  }
  return `<!doctype html><html dir="rtl"><head><meta charset="utf-8"><style>@page{size:${W}pt ${H}pt;margin:0}html,body{margin:0}body{width:${W}pt;height:${H}pt;position:relative;font-family:'DejaVu Sans','FreeSans',sans-serif;color:#0b2a8a}div{white-space:nowrap}</style></head><body>${h}</body></html>`;
}

async function main() {
  const spec = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
  const dir = path.dirname(path.resolve(process.argv[2]));
  const at = (p) => path.resolve(dir, p);
  const { PDFDocument, chromium } = need();
  const doc = await PDFDocument.load(fs.readFileSync(at(spec.in)));
  const page = doc.getPage((spec.page || 1) - 1);
  const { width: W, height: H } = page.getSize();
  const br = await chromium.launch({ executablePath: chromePath() });
  const pg = await br.newPage();
  await pg.setContent(overlayHtml(spec, W, H));
  const ov = await pg.pdf({ width: W / 72 + 'in', height: H / 72 + 'in', preferCSSPageSize: true, printBackground: false });
  await br.close();
  const [emb] = await doc.embedPdf(ov, [0]);
  page.drawPage(emb, { x: 0, y: 0, width: W, height: H });
  for (const a of spec.append || []) {
    const src = await PDFDocument.load(fs.readFileSync(at(a)));
    for (const p of await doc.copyPages(src, src.getPageIndices())) doc.addPage(p);
  }
  fs.writeFileSync(at(spec.out), await doc.save());
  console.log(JSON.stringify({ ok: true, out: at(spec.out), pages: doc.getPageCount() }));
}
if (process.argv[1] && process.argv[1].endsWith('fill.mjs')) main().catch((e) => { console.error(e.message); process.exit(1); });
