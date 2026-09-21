// What the app looks like once it is on a phone's home screen.
//
// The guide tells every trustee to install it that way, so the icon and the
// shortcuts are not decoration -- they are the first thing a worker sees and
// the fastest way into a report.
//
// The defect this suite was written for: apple-touch-icon pointed at an SVG.
// **iOS ignores SVG there.** With nothing usable declared, iPhone uses a
// screenshot of the page as the icon, so the app installed itself as a blurry
// thumbnail of a form. Nothing errors, nothing logs, and it is invisible from
// a desktop browser.
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '../..');
let pass = 0, fail = 0;
const check = (l, c, d) => { if (c) { pass++; console.log('  ✓ ' + l); } else { fail++; console.log('  ✗ ' + l + (d !== undefined ? '  -> ' + JSON.stringify(d) : '')); } };

const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const rawManifest = fs.readFileSync(path.join(ROOT, 'manifest.webmanifest'), 'utf8');

const isPng = (p) => {
  try {
    const b = fs.readFileSync(path.join(ROOT, p.replace(/^\//, ''))).subarray(0, 8);
    return b.equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  } catch (e) { return false; }
};

console.log('\n1. the icon iOS will actually use');
{
  const m = html.match(/<link[^>]+rel="apple-touch-icon"[^>]*>/);
  check('apple-touch-icon is declared', !!m, m);
  const href = m && (m[0].match(/href="([^"]+)"/) || [])[1];
  // The bug, stated as a test: an SVG here is the same as declaring nothing.
  check('...and it is a PNG, because iOS ignores SVG there', /\.png$/i.test(href || ''), href);
  check('...that exists and really is a PNG', isPng(href || ''), href);
}

console.log('\n2. the manifest');
let man = null;
{
  try { man = JSON.parse(rawManifest); } catch (e) {}
  check('it parses', !!man, rawManifest.slice(0, 80));
  check('it is linked from the page', /<link[^>]+rel="manifest"/.test(html));
  // Without these two it opens as a browser tab with an address bar, which is
  // the thing "add to home screen" is supposed to remove.
  check('standalone, so it opens without browser chrome', man && man.display === 'standalone', man && man.display);
  check('...and iOS is told the same, which it reads from the meta tag',
    /name="apple-mobile-web-app-capable"\s+content="yes"/.test(html));
  check('Hebrew and right-to-left', man && man.lang === 'he' && man.dir === 'rtl', man && [man.lang, man.dir]);
}

console.log('\n3. every icon it names is on disk');
{
  const icons = (man && man.icons) || [];
  check('there are icons at all', icons.length >= 2, icons.length);
  const missing = icons.filter((i) => !isPng(i.src)).map((i) => i.src);
  check('each one exists and is a real PNG', missing.length === 0, missing);
  const any = icons.filter((i) => (i.purpose || 'any').includes('any'));
  const mask = icons.filter((i) => (i.purpose || '').includes('maskable'));
  check('a 192 and a 512 for ordinary use', any.some((i) => i.sizes === '192x192') && any.some((i) => i.sizes === '512x512'), any.map((i) => i.sizes));
  check('and a maskable one', mask.length === 1, mask.map((i) => i.src));
  // Android crops a maskable icon to roughly the middle 80%. Handing it the
  // full-bleed art means the mark loses its edges on every launcher that
  // rounds.
  check('...which is a DIFFERENT file, drawn inside the safe zone',
    mask.length === 1 && !any.some((i) => i.src === mask[0].src), mask.map((i) => i.src));
}

console.log('\n4. the long-press shortcuts go somewhere real');
{
  const sc = (man && man.shortcuts) || [];
  check('there are shortcuts', sc.length >= 1, sc.length);
  check('each has a name and a url', sc.every((s) => s.name && s.url), sc);
  check('...and an icon, or the launcher draws a blank square',
    sc.every((s) => Array.isArray(s.icons) && s.icons.length && isPng(s.icons[0].src)), sc.map((s) => s.icons));

  // The real risk: a shortcut is a URL nobody tests. index.html decides what
  // to do from the query string, so the only honest check is against the
  // patterns the boot code matches. A shortcut to a parameter nothing reads
  // is a button that opens the home screen and looks broken.
  const boot = [];
  const empRe = html.match(/\/\[\?&\]emp=1\\b\//);
  if (empRe) boot.push(/[?&]emp=1\b/);
  const repRe = html.match(/\/\[\?&\]report=\(([a-z|]+)\)\\b\//);
  if (repRe) boot.push(new RegExp('[?&]report=(' + repRe[1] + ')\\b'));
  check('the boot code patterns were found in index.html (emp, report)', boot.length === 2, boot.map(String));

  sc.forEach((s) => {
    const qs = String(s.url).replace(/^[^?]*/, '');
    check('«' + s.short_name + '» -> ' + s.url + ' is handled at boot',
      boot.some((re) => re.test(qs)), { url: s.url, qs: qs });
  });
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
