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

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
