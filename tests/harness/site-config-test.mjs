// The product, step 1 (17/10/2026, DECISIONS "מוצר למכירה"): everything on the server that
// names the factory sits in functions/_site.js. A new factory changes that file (and _logo.js);
// if another server file names the company, its domain, its database or its OneDrive folder,
// the copy for a new factory would still say Tapugan there. What must hold:
//   * no file under functions/ outside _site.js and _logo.js names the factory in code
//     (whole-line comments are history and stay), except the explicit list below;
//   * _site.js holds every value the files need, Hebrew as \uXXXX (rule 1);
//   * _shared.js takes its addresses from SITE, so the endpoints that import them follow.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
let pass = 0, fail = 0;
const check = (l, c, d) => { if (c) { pass++; console.log('  ✓ ' + l); } else { fail++; console.log('  ✗ ' + l + (d !== undefined ? '  -> ' + JSON.stringify(d) : '')); } };

// tapugan / tfugen in any case, the live project id, and the Hebrew short name (raw or \uXXXX)
const NAMES = /tapugan|tfugen|znhjtpcltrxxyfjczgvw|\\u05ea\\u05e4\\u05d5\\u05d2\\u05df|\u05ea\u05e4\u05d5\u05d2\u05df/i;
const SETTINGS = ['functions/_site.js', 'functions/_logo.js'];
// Left on purpose, each with its reason. A new entry needs one too.
const ALLOWED = {
  // A comment inside the service worker the server serves: changing a byte of it reinstalls
  // the worker on every phone, for a word nobody sees.
  'functions/sw.js.js': ['TFUGEN Service Worker']
};

console.log('\n1. no server file names the factory outside _site.js');
const files = [];
const walk = (d) => { for (const e of fs.readdirSync(path.join(ROOT, d), { withFileTypes: true })) { const p = d + '/' + e.name; if (e.isDirectory()) walk(p); else if (p.endsWith('.js')) files.push(p); } };
walk('functions');
const hits = [];
for (const f of files) {
  if (SETTINGS.includes(f)) continue;
  fs.readFileSync(path.join(ROOT, f), 'utf8').split('\n').forEach((ln, i) => {
    const t = ln.trim();
    if (t.startsWith('//') || t.startsWith('*') || !NAMES.test(ln)) return;
    if ((ALLOWED[f] || []).some((a) => ln.includes(a))) return;
    hits.push(f + ':' + (i + 1) + ' ' + t.slice(0, 90));
  });
}
check('scanned the server (' + files.length + ' files)', files.length > 30, files.length);
check('the factory is named only in _site.js and _logo.js', hits.length === 0, hits.slice(0, 10));

console.log('\n2. _site.js has what a new factory fills in');
const src = fs.readFileSync(path.join(ROOT, 'functions/_site.js'), 'utf8');
check('_site.js: no raw Hebrew (\\uXXXX, rule 1)', !/[\u0590-\u05ff]/.test(src));
const { SITE } = await import(path.join(ROOT, 'functions/_site.js'));
const KEYS = ['name', 'slug', 'shortName', 'company', 'host', 'appUrl', 'supabaseUrl', 'loginDomain', 'adminEmail', 'managerEmail', 'mailDomain', 'hrEmail', 'odRoot', 'odFileUrl', 'backupPrefix', 'signature'];
check('every value is filled', KEYS.every((k) => typeof SITE[k] === 'string' && SITE[k].length > 0), KEYS.filter((k) => !SITE[k]));
check('appUrl is https:// + host', SITE.appUrl === 'https://' + SITE.host, SITE.appUrl);
check('adminEmail is in loginDomain', SITE.adminEmail.endsWith('@' + SITE.loginDomain), SITE.adminEmail);
check('the signature carries the manager\'s mail', SITE.signature.includes('mailto:' + SITE.managerEmail));
check('previewRe: a preview of this site passes', SITE.previewRe.test('https://a1b2c3.' + SITE.host));
check('previewRe: another site, or the host as a suffix of another name, does not', !SITE.previewRe.test('https://evil.com') && !SITE.previewRe.test('https://a1.' + SITE.host + '.evil.com') && !SITE.previewRe.test('https://a1x' + SITE.host.replace(/^[^.]+/, '')));

console.log('\n3. _shared.js takes its addresses from SITE');
const sh = await import(path.join(ROOT, 'functions/_shared.js'));
check('CF_PROD = SITE.appUrl', sh.CF_PROD === SITE.appUrl);
check('SB_LIVE = SITE.supabaseUrl, and sbFrom falls back to it', sh.SB_LIVE === SITE.supabaseUrl && sh.sbFrom({}) === SITE.supabaseUrl);
check('ADMIN_EMAIL = SITE.adminEmail', sh.ADMIN_EMAIL === SITE.adminEmail);
check('the endpoints\' allowed origins start with this site', sh.defaultAllowedOrigins({})[0] === SITE.appUrl);

console.log('\n4. index.html takes the factory from _site.js (17/10/2026, step 1 of the app)');
// The page cannot import a module before it runs, and must open with no network, so it carries
// a copy: <script id="site-config">var SITE=...</script>, and data-site="<template>" on the few
// elements of the markup that name the factory (data-site-<attr> for an attribute). The copy is
// written from _site.js by `node tests/harness/site-config-test.mjs --write`; here it must match.
const { clientSite } = await import(path.join(ROOT, 'functions/_site.js'));
const CS = clientSite();
const jsEsc = (s) => s.replace(/[^\x20-\x7e]|</g, (c) => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0'));
const BLOCK_RE = /(<script id="site-config">)[^<]*(<\/script>)/;
const block = 'var SITE=' + jsEsc(JSON.stringify(CS)) + ';';
const htEsc = (s) => String(s).replace(/[&<>"]|[^\x20-\x7e]/g, (c) => '&#' + c.charCodeAt(0) + ';');
const render = (t) => t.replace(/\{(\w+)\}/g, (m, k) => (typeof CS[k] === 'string' ? htEsc(CS[k]) : m));
// One element per line; its text (data-site) or attribute (data-site-<attr>) is the template, rendered.
// Returns the page as it should be, and a copy with every rendered value blanked for the scan.
function sync(html) {
  let found = false;
  const out = html.replace(BLOCK_RE, (m, a, b) => { found = true; return a + block + b; })
    .replace(/<([a-z][\w-]*)\b([^<>\n]*\sdata-site[^<>\n]*)>([^<\n]*)(<\/\1>)?/gi, (m, tag, attrs, text, close) => {
      let a2 = attrs;
      for (const [, attr, t] of [...attrs.matchAll(/\sdata-site-([a-z-]+)="([^"]*)"/g)]) {
        a2 = a2.replace(new RegExp('(\\s' + attr + '=")[^"]*"'), (x, p) => p + render(t) + '"');
      }
      const tt = /\sdata-site="([^"]*)"/.exec(attrs);
      return '<' + tag + a2 + '>' + (tt && close ? render(tt[1]) : text) + (close || '');
    });
  const scan = out.replace(BLOCK_RE, '$1$2')
    .replace(/<([a-z][\w-]*)\b([^<>\n]*\sdata-site[^<>\n]*)>([^<\n]*)(<\/\1>)?/gi, (m, tag, attrs, text, close) => {
      let a2 = attrs;
      for (const [, attr] of [...attrs.matchAll(/\sdata-site-([a-z-]+)="/g)]) a2 = a2.replace(new RegExp('(\\s' + attr + '=")[^"]*"'), '$1"');
      return '<' + tag + a2 + '>' + (/\sdata-site="/.test(attrs) && close ? '' : text) + (close || '');
    });
  return { out, scan, found };
}
const idxPath = path.join(ROOT, 'index.html');
const idx = fs.readFileSync(idxPath, 'utf8');
const synced = sync(idx);
if (process.argv.includes('--write')) {
  fs.writeFileSync(idxPath, synced.out);
  console.log('  wrote index.html from _site.js' + (synced.out === idx ? ' (no change)' : ''));
}
check('index.html has <script id="site-config"> before the main script', synced.found && idx.indexOf('id="site-config"') < idx.indexOf('id="app-main"'));
check('the copy in index.html matches _site.js (fix: node tests/harness/site-config-test.mjs --write)', process.argv.includes('--write') || synced.out === idx,
  ((o) => idx.split('\n').filter((l, i) => l !== o[i]).map((l) => l.slice(0, 90)).slice(0, 5))(synced.out.split('\n')));
// Left on purpose in the page, each with its reason. A new entry needs one too.
const PAGE_ALLOWED = [];
const pageHits = [];
synced.scan.split('\n').forEach((ln, i) => {
  const t = ln.trim();
  if (t.startsWith('//') || t.startsWith('/*') || t.startsWith('*') || t.startsWith('<!--')) return;
  if (!NAMES.test(ln) && !/&#1514;&#1508;&#1493;&#1490;&#1503;/.test(ln)) return;
  if (PAGE_ALLOWED.some((a) => ln.includes(a))) return;
  pageHits.push((i + 1) + ' ' + t.slice(0, 90));
});
check('index.html names the factory only through SITE (code) and data-site (markup)', pageHits.length === 0, pageHits.slice(0, 10));

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
