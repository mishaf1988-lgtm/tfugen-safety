// Generate the home-screen icons from the Tapugan logo.
//
//   NODE_PATH=$(npm root -g) node tools/make-icons.js
//
// Why PNGs exist at all, when icon.svg was sitting there:
// **iOS does not accept SVG for apple-touch-icon.** With only an SVG declared,
// iPhone falls back to a screenshot of the page as the home-screen icon -- so
// the app a trustee installs from the guide gets a blurry thumbnail of a form
// instead of a mark. That is the whole point of "add to home screen".
//
// And why the logo rather than the letter T that icon.svg drew: the factory has
// a mark, everyone there recognises it, and it is already at the top of every
// screen in the app. An icon is the one place where recognition is the entire
// job.
//
// The source logo carries «תעשיות תפוגן בע"מ» under the oval. At 180px that
// line is an unreadable smudge, so it is cropped away and only the oval is
// kept.
//
// The maskable one is a separate image on purpose. Android crops icons to
// whatever shape the launcher uses, and a "maskable" icon is cropped to
// roughly the middle 80%. The oval is drawn smaller inside the same field so
// it survives that crop; handing the full-bleed art over as maskable is how
// the mark loses its edges.
const fs = require('fs');
const os = require('os');
const path = require('path');
let pw; try { pw = require('playwright'); } catch (e) { pw = require('playwright-core'); }

const ROOT = path.resolve(__dirname, '..');

// logo.jpg is 397x265. The oval, with its swoosh, sits in the top two thirds;
// below it is the company line, which is what we are cropping out.
const SRC = { w: 397, h: 265, cropTop: 10, cropH: 168 };

// `fill` is how much of the canvas width the oval takes. The maskable icon
// uses less, so the crop the launcher applies lands on empty white.
const pageAt = (C, fill) => {
  const wrapW = Math.round(C * fill);
  const scale = wrapW / SRC.w;
  const wrapH = Math.round(SRC.cropH * scale);
  return `<!doctype html><meta charset="utf-8">
<style>
  html,body{margin:0;padding:0;width:${C}px;height:${C}px;background:#fff;overflow:hidden}
  .wrap{position:absolute;overflow:hidden;
        width:${wrapW}px;height:${wrapH}px;
        left:${Math.round((C - wrapW) / 2)}px;top:${Math.round((C - wrapH) / 2)}px}
  .wrap img{position:absolute;left:0;top:${-Math.round(SRC.cropTop * scale)}px;
            width:${Math.round(SRC.w * scale)}px;height:${Math.round(SRC.h * scale)}px}
</style>
<div class="wrap"><img src="logo.jpg"></div>`;
};

const TARGETS = [
  { file: 'icon-180.png', px: 180, fill: 0.86, why: 'apple-touch-icon; iOS rounds it itself' },
  { file: 'icon-192.png', px: 192, fill: 0.86, why: 'manifest, any' },
  { file: 'icon-512.png', px: 512, fill: 0.86, why: 'manifest, any' },
  { file: 'icon-maskable-512.png', px: 512, fill: 0.60, why: 'manifest, maskable; inside the safe zone' },
];

(async () => {
  // A page built with setContent cannot load a file:// image -- it has no
  // origin to resolve one against. So the markup is written to a real file
  // beside a copy of the logo, and the browser navigates to it.
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tfgn-icons-'));
  fs.copyFileSync(path.join(ROOT, 'logo.jpg'), path.join(tmp, 'logo.jpg'));

  const browser = await pw.chromium.launch();
  const page = await browser.newPage();
  for (const t of TARGETS) {
    const html = path.join(tmp, t.file + '.html');
    fs.writeFileSync(html, pageAt(t.px, t.fill));
    await page.setViewportSize({ width: t.px, height: t.px });
    await page.goto('file://' + html, { waitUntil: 'load' });
    // A screenshot of a half-loaded image is a white square that looks like a
    // finished icon.
    await page.waitForFunction(() => {
      const i = document.images[0];
      return i && i.complete && i.naturalWidth > 0;
    }, null, { timeout: 15000 });
    const out = path.join(ROOT, t.file);
    await page.screenshot({ path: out, omitBackground: false });
    console.log('  \u2713 ' + t.file + '  ' + t.px + 'px  (' + Math.round(fs.statSync(out).size / 1024) + ' KB)  ' + t.why);
  }
  await browser.close();
  fs.rmSync(tmp, { recursive: true, force: true });
})();
