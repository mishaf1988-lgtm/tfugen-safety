// Builds the safety-platform copy from this repo (17/10/2026, "product for sale" step 2).
//
//   node tools/export-platform.mjs <out-dir>   (an empty folder, or a clone of safety-platform: KEEP stays)
//
// Run it again whenever the app here improves; the output replaces the tree of
// mishaf1988-lgtm/safety-platform. It is a closed list on purpose: a file reaches the product
// only when it is named in INCLUDE, so a new Tapugan procedure or a test full of Tapugan rows
// never slips out by being new. What it does:
//   1. copies INCLUDE, and puts tools/platform/_site.js (empty settings) in place of
//      functions/_site.js; the keys of both must match;
//   2. draws a placeholder logo and icons, and writes _logo.js from it (tools/make-logo.py);
//   3. writes the page's copy of the settings, the app name and the tab icon letter from the
//      empty settings (site-config-test.mjs --write), then runs that test on the copy;
//   1b. writes db/schema.sql, the database with no rows, from tools/platform/schema-live.sql;
//   4. scans every exported file, comments included, for anything that names Tapugan, its
//      people, its accounts or its keys. One hit = exit 1, and nothing should be pushed.
import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ARGS = process.argv.slice(2).filter((a) => a !== '--force');
const FORCE = process.argv.includes('--force');
const OUT = path.resolve(ARGS[0] || '');
if (!ARGS[0] || OUT === ROOT || OUT.startsWith(ROOT + path.sep)) {
  console.error('usage: node tools/export-platform.mjs <out-dir outside this repo>'); process.exit(2);
}

// What a new factory gets. Directories end with '/'. Each entry is reviewed before it is added.
const INCLUDE = [
  'index.html', '_headers', '_routes.json', 'manifest.webmanifest', 'robots.txt', 'icon.svg',
  'functions/',
  'tests/harness/site-config-test.mjs',   // sets up a new factory (--write) and guards its name
  'tools/make-logo.py',
];
const REPLACE = { 'functions/_site.js': 'tools/platform/_site.js', 'README.md': 'tools/platform/README.md',
  'SETUP.md': 'tools/platform/SETUP.md', 'db/demo-data.sql': 'tools/platform/demo-data.sql', 'CLAUDE.md': 'tools/platform/CLAUDE.md' };
// Words that are only history in a comment here, rewritten in the copy alone. Changing them in
// this repo would cost more than the word: the service worker reinstalls on every phone.
const REWRITE = {
  'functions/sw.js.js': [['TFUGEN Service Worker', 'Service Worker']],
  'tests/harness/site-config-test.mjs': [["'functions/sw.js.js': ['TFUGEN Service Worker']", "'functions/sw.js.js': []"]],
};
// Whole-line comments (// /* * #) keep this repo's history: a decision, a quote from Michael,
// the tenant that blocked a consent. In the copy those lines get generic words. Code lines are
// never touched, so a name in code still fails step 4 and is fixed in this repo, in _site.js.
const he = (...c) => String.fromCharCode(...c);
const esc = (s) => [...s].map((c) => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0')).join('');
const HE_NAME = he(0x5ea, 0x5e4, 0x5d5, 0x5d2, 0x5df), HE_FACTORY = he(0x5d4, 0x5de, 0x5e4, 0x5e2, 0x5dc);
const COMMENT_SUBS = [
  [/tapugan-safety\.pages\.dev/gi, 'your-site.pages.dev'], [/tfugen-safety\.vercel\.app/gi, 'your-site.pages.dev'],
  [/tapugan\.co\.il/gi, 'example.com'], [/tfugen\.local/gi, 'factory.local'], [/tfugen-staging/gi, 'the test project'],
  [/mishaf1988-lgtm\/(tfugen-safety|michael-skills)/gi, 'owner/repo'], [/\btfugen_/gi, ''],
  [/Tapugan Safety|TFUGEN SAFETY/g, 'Safety Platform'], [/tapugan|tfugen/gi, 'the factory'],
  [new RegExp(esc(HE_NAME).replace(/\\/g, '\\\\'), 'g'), esc(HE_FACTORY)], [new RegExp(HE_NAME, 'g'), HE_FACTORY],
];
const isComment = (t) => /^(\/\/|\/\*|\*|#|<!--)/.test(t);
const SKIP = /(^|\/)(__pycache__|node_modules|\.DS_Store)(\/|$)/;

const { NAMES_RE } = await import(path.join(ROOT, 'functions/_site.js'));
// Beyond the names: the owner's accounts, phones, the database and test-database keys, the
// WhatsApp business id. Spelled in parts so this file does not trip its own scan.
const PRIVATE = new RegExp(['mishaf' + '1988', 'sviva' + '@', '0547' + '940073', '08-680' + '8365',
  'ldzbjbsum' + 'zqjyvtpiwqo', 'N2ihyyjK' + '_qZEyB0', 'zITtcP' + '-mcfm8', '4400035' + '656982783'].join('|'), 'i');
// Tapugan's own departments (17/10/2026): the lists in index.html, talk.js and hazard-file.js
// still spell them, so the export fails until they come from the settings. Raw and \uXXXX.
const DEPTS = [he(0x5d8, 0x5d5, 0x5d2, 0x5e0, 0x5d9, 0x5dd), he(0x5de, 0x5e2, 0x5d5, 0x5e6, 0x5d1, 0x5d9, 0x5dd),
  he(0x5de, 0x5e2, 0x5e6, 0x5d1, 0x5d9, 0x5dd), he(0x5e7, 0x5d9, 0x5dc, 0x5d5, 0x5e4, 0x5d9, 0x5dd)];
const DEPTS_RE = new RegExp(DEPTS.flatMap((d) => [d, esc(d).replace(/\\/g, '\\\\')]).join('|'));

// Files that live only in safety-platform (17/10/2026, the business line: its handoff, the day-one
// checklist, demo data, documents and marketing), and its git folder. The out-dir may be a clone
// of safety-platform: everything else in it is replaced, these are never deleted or written.
const KEEP = ['.git', 'handoff.md', 'checklist-day1.md', 'demo', 'docs', 'marketing'];
const kept = (rel) => KEEP.includes(rel.split('/')[0]);
fs.mkdirSync(OUT, { recursive: true });
// A file edited in safety-platform since the last export would be overwritten in silence
// (17/10/2026, Michael: "how do we sync the business work with here"; CLAUDE.md was the near miss).
// Each export leaves MANIFEST: the sha256 of every file it wrote. Before deleting anything, a file
// that differs from it, or a file the last export did not write, stops the export with the list.
// Bring the change to this repo (tools/platform/ or the code), then run again; --force overwrites.
const MANIFEST = '.export-manifest.json';
const sha = (abs) => crypto.createHash('sha256').update(fs.readFileSync(abs)).digest('hex');
const treeOf = (d, rel = '') => fs.readdirSync(path.join(d, rel), { withFileTypes: true }).flatMap((e) => {
  const r = rel ? rel + '/' + e.name : e.name;
  if (kept(r) || r === MANIFEST) return [];
  return e.isDirectory() ? treeOf(d, r) : [r];
});
{
  const mf = path.join(OUT, MANIFEST);
  const last = fs.existsSync(mf) ? JSON.parse(fs.readFileSync(mf, 'utf8')) : {};
  const drift = treeOf(OUT).filter((r) => last[r] !== sha(path.join(OUT, r)));
  if (drift.length && !FORCE) {
    console.error('  ' + drift.length + ' files in ' + OUT + ' changed since the last export (or were never exported):\n'
      + drift.slice(0, 40).map((r) => '    ' + r + (last[r] ? '  (edited there)' : '  (not from the export)')).join('\n')
      + '\n  Bring each change to this repo first, then run again. To overwrite them anyway: --force');
    process.exit(3);
  }
}
for (const e of fs.readdirSync(OUT)) if (!kept(e)) fs.rmSync(path.join(OUT, e), { recursive: true, force: true });
const copy = (rel, from = rel) => {
  if (kept(rel)) { console.error('  ' + rel + ' is kept in safety-platform; the export may not write it'); process.exit(1); }
  const dst = path.join(OUT, rel);
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.copyFileSync(path.join(ROOT, from), dst);
};
const walk = (rel) => {
  const abs = path.join(ROOT, rel);
  if (!fs.statSync(abs).isDirectory()) return [rel];
  return fs.readdirSync(abs).flatMap((e) => walk(rel.replace(/\/$/, '') + '/' + e));
};

console.log('1. copy');
let n = 0;
for (const inc of INCLUDE) for (const f of walk(inc)) { if (SKIP.test(f)) continue; copy(f); n++; }
for (const [to, from] of Object.entries(REPLACE)) { copy(to, from); n++; }
// The general agents (17/10/2026, Michael: "only the general ones"): written for any factory in
// tools/platform/agents/, served as agents/ in the copy. Tapugan's own Routines stay here.
for (const f of fs.readdirSync(path.join(ROOT, 'tools/platform/agents'))) { copy('agents/' + f, 'tools/platform/agents/' + f); n++; }
for (const [f, pairs] of Object.entries(REWRITE)) {
  const p = path.join(OUT, f); let s = fs.readFileSync(p, 'utf8');
  for (const [a, b] of pairs) { if (!s.includes(a)) throw new Error(f + ': "' + a + '" is gone, update REWRITE'); s = s.split(a).join(b); }
  fs.writeFileSync(p, s);
}
let subbed = 0;
for (const f of INCLUDE.flatMap(walk).filter((f) => !SKIP.test(f) && /\.(m?js|html|py|txt)$|^_headers$/.test(f))) {
  const p = path.join(OUT, f);
  const lines = fs.readFileSync(p, 'utf8').split('\n');
  const out = lines.map((ln) => {
    if (!isComment(ln.trim()) || !(NAMES_RE.test(ln) || /tapugan|tfugen/i.test(ln))) return ln;
    subbed++; return COMMENT_SUBS.reduce((s, [a, b]) => s.replace(a, b), ln);
  });
  fs.writeFileSync(p, out.join('\n'));
}
console.log('  ' + subbed + ' comment lines given generic words');
const real = await import(path.join(ROOT, 'functions/_site.js'));
const tmpl = await import(path.join(OUT, 'functions/_site.js') + '?t=' + Date.now());
const keys = (m) => JSON.stringify([Object.keys(m.SITE).sort(), m.CLIENT_KEYS, Object.keys(m).sort()]);
if (keys(real) !== keys(tmpl)) {
  console.error('  tools/platform/_site.js and functions/_site.js have different keys; add the new one to the template');
  process.exit(1);
}
console.log('  ' + n + ' files, settings replaced by the empty template');

// The database with no rows (17/10/2026): tools/platform/schema-live.sql is the live structure,
// written by tools/platform/schema-dump.sql. The values that name this factory are swapped for
// the template's; a pair that no longer matches fails here, and anything left fails step 4.
console.log('1b. database structure');
const live = fs.readFileSync(path.join(ROOT, 'tools/platform/schema-live.sql'), 'utf8');
// A migration newer than the dump means the copy would miss it: dump again before exporting.
const dumped = (live.match(/^-- dumped (\d{4}-\d{2}-\d{2})/) || [])[1];
const newer = fs.readdirSync(path.join(ROOT, 'migrations')).filter((f) => !dumped || f.slice(0, 10) > dumped);
if (newer.length) {
  console.error('  schema-live.sql is older than ' + newer.slice(0, 5).join(', ') + ': run tools/platform/schema-dump.sql again');
  process.exit(1);
}
const DB_SUBS = [
  [real.SITE.appUrl + '/api/', tmpl.SITE.appUrl + '/api/'],
  ["'" + real.SITE.adminEmail + "'", "'" + tmpl.SITE.adminEmail + "'"],
  ["'@" + real.SITE.loginDomain + "'", "'@" + tmpl.SITE.loginDomain + "'"],
  ['tapugan_auth_read_backups', 'auth_read_backups'],
];
let db = live.replace(/^-- dumped .*\n/, '');
for (const [a, b] of DB_SUBS) { if (!db.includes(a)) throw new Error('schema-live.sql: "' + a + '" is gone, update DB_SUBS'); db = db.split(a).join(b); }
const DB_HEAD = `-- Builds the database of a new factory: structure only, no rows (Safety Platform).
--
-- 1. A new Supabase project (Postgres 17). SQL Editor: paste this whole file and run it once.
-- 2. The secret the database sends with every call to the site, the same value as the site's
--    TRUSTEE_NOTIFY_SECRET:   select vault.create_secret('<the value>', 'trustee_notify_secret');
-- 3. The site address and the login domain below are the ones in functions/_site.js
--    (${tmpl.SITE.appUrl}, @${tmpl.SITE.loginDomain}). Changed them there? Replace them here too.
-- 4. Authentication > Users: add admin@<login domain> - the first administrator.
--
-- The cron jobs at the end call the site; one that should not run here is removed with
-- select cron.unschedule('<name>');
`;
fs.mkdirSync(path.join(OUT, 'db'), { recursive: true });
fs.writeFileSync(path.join(OUT, 'db/schema.sql'), DB_HEAD + '\n' + db);
console.log('  db/schema.sql: ' + (db.match(/^create table /gm) || []).length + ' tables, '
  + (db.match(/^create policy /gm) || []).length + ' policies, ' + (db.match(/^select cron\.schedule/gm) || []).length + ' cron jobs');

console.log('2. placeholder logo and icons');
execFileSync('python3', ['-c', `
import sys, os
from PIL import Image, ImageDraw, ImageFont
out = sys.argv[1]
def font(sz):
    for f in ('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', '/usr/share/fonts/dejavu/DejaVuSans-Bold.ttf'):
        if os.path.exists(f): return ImageFont.truetype(f, sz)
    return ImageFont.load_default()
im = Image.new('RGB', (397, 265), 'white'); d = ImageDraw.Draw(im)
d.rounded_rectangle((20, 20, 377, 245), radius=24, outline=(150, 150, 150), width=6)
d.text((198, 132), 'LOGO', fill=(110, 110, 110), font=font(72), anchor='mm')
im.save(os.path.join(out, 'logo.jpg'), 'JPEG', quality=90)
for name, size, pad in (('icon-180.png', 180, 0), ('icon-192.png', 192, 0), ('icon-512.png', 512, 0), ('icon-maskable-512.png', 512, 0.1)):
    ic = Image.new('RGB', (size, size), (204, 31, 31)); g = ImageDraw.Draw(ic)
    g.text((size / 2, size / 2), 'S', fill='white', font=font(int(size * (0.55 - pad))), anchor='mm')
    ic.save(os.path.join(out, name))
`, OUT]);
execFileSync('python3', [path.join(OUT, 'tools/make-logo.py')], { stdio: 'inherit' });

console.log('3. settings into the page, then the setup test on the copy');
const test = path.join(OUT, 'tests/harness/site-config-test.mjs');
execFileSync('node', [test, '--write'], { stdio: 'ignore' });
try { execFileSync('node', [test], { stdio: 'pipe' }); console.log('  site-config-test passes on the copy'); }
catch (e) { console.error(String(e.stdout).split('\n').filter((l) => l.includes('✗')).join('\n')); process.exit(1); }

console.log('4. scan for Tapugan');
const hits = [];
const outFiles = (d) => fs.readdirSync(d, { withFileTypes: true }).filter((e) => e.name !== '.git').flatMap((e) => e.isDirectory() ? outFiles(path.join(d, e.name)) : [path.join(d, e.name)]);
for (const abs of outFiles(OUT)) {
  const buf = fs.readFileSync(abs);
  if (buf.includes(0)) continue; // images
  buf.toString('utf8').split('\n').forEach((ln, i) => {
    if (NAMES_RE.test(ln) || PRIVATE.test(ln) || DEPTS_RE.test(ln)) hits.push(path.relative(OUT, abs) + ':' + (i + 1) + '  ' + ln.trim().slice(0, 110));
  });
}
if (hits.length) {
  console.error('  ' + hits.length + ' lines still name Tapugan:\n' + hits.slice(0, 60).map((h) => '    ' + h).join('\n'));
  process.exit(1);
}
console.log('  clean: ' + outFiles(OUT).length + ' files, nothing names Tapugan');
fs.writeFileSync(path.join(OUT, MANIFEST), JSON.stringify(Object.fromEntries(treeOf(OUT).sort().map((r) => [r, sha(path.join(OUT, r))])), null, 1) + '\n');
console.log('  ' + MANIFEST + ': the next export stops if one of these files is edited in safety-platform');
