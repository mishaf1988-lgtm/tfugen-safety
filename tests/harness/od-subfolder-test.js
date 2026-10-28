// _odSubfolderName / _odSubPick / _odResolveSub (index.html), 28/10/2026 (Michael in the questionnaire: "do it: no
// date in the name"). A record's OneDrive folder no longer carries [תוקף DD-MM-YYYY]: the date never followed
// a renewal, and each renewal opened a new folder. A folder made before keeps its name and is still found, so the
// next upload does not open a duplicate. This runs the real functions against a fake OneDrive.
const fs = require('fs');
const path = require('path');
const src = fs.readFileSync(path.join(__dirname, '../../index.html'), 'utf8');
let pass = 0, fail = 0;
const check = (l, c, d) => { if (c) { pass++; console.log('  ✓ ' + l); } else { fail++; console.log('  ✗ ' + l + (d !== undefined ? '  -> ' + JSON.stringify(d) : '')); } };

const piece = (a, b) => { const i = src.indexOf(a), j = src.indexOf(b, i); return i > 0 && j > i ? src.slice(i, j) : ''; };
const code = piece('function _odSanitizeName(s)', '\n') + '\n' + piece('function _odSubfolderName(tbl,rec){', 'function _odMirrorRecord(tbl,rec){');
check('found the name, pick and resolve functions', /function _odSubPick/.test(code) && /function _odResolveSub/.test(code));
let listing = [], fail404 = false, asked = '';
const fetch = (url) => { asked = url; return Promise.resolve(fail404 ? { ok: false, status: 404 } : { ok: true, json: () => Promise.resolve({ value: listing }) }); };
const _odEnsureToken = () => Promise.resolve('tok');
const f = new Function('fetch', '_odEnsureToken', code + '\nreturn { name: _odSubfolderName, pick: _odSubPick, resolve: _odResolveSub };')(fetch, _odEnsureToken);

const TK = 'תוקף';
const name = f.name('equip_inspections', { code: 'HOIST-1', n: 'Hoist', e: '2027-10-03' });
check('a new equipment folder has no expiry in its name', name === 'HOIST-1 - Hoist', name);
check('docs, tr, ppe, med, ctr: no expiry either', ['docs', 'tr', 'ppe', 'med', 'ctr'].every((t) => f.name(t, { n: 'X', ty: 'X', t: 'X', e: '2027-01-01' }).indexOf(TK) < 0));
check('a folder with the plain name wins', f.pick(['HOIST-1 - Hoist [' + TK + ' 03-10-2026]', 'HOIST-1 - Hoist'], 'HOIST-1 - Hoist') === 'HOIST-1 - Hoist');
check('an old folder with an expiry suffix is reused, the latest date first',
  f.pick(['HOIST-1 - Hoist [' + TK + ' 03-10-2026]', 'HOIST-1 - Hoist [' + TK + ' 03-10-2027]', 'HOIST-10 - Hoist [' + TK + ' 01-01-2030]'], 'HOIST-1 - Hoist') === 'HOIST-1 - Hoist [' + TK + ' 03-10-2027]');
check('another item with a longer code is not taken', f.pick(['HOIST-10 - Hoist [' + TK + ' 01-01-2030]'], 'HOIST-1 - Hoist') === 'HOIST-1 - Hoist');
const longSub = 'LIFT-X - ' + 'a'.repeat(66), cut = (longSub + ' [' + TK + ' 03-10-2027]').slice(0, 80);
check('an old name cut at 80 characters is still found', f.pick([cut], longSub) === cut, cut);
check('nothing matching: the plain name (the upload creates it)', f.pick(['OTHER - Y'], 'HOIST-1 - Hoist') === 'HOIST-1 - Hoist');

(async () => {
  listing = [{ name: 'HOIST-1 - Hoist [' + TK + ' 03-10-2026]', folder: {} }, { name: 'HOIST-1 - Hoist', file: {} }];
  const r1 = await f.resolve('Other/EQI', 'HOIST-1 - Hoist');
  check('resolve lists the topic folder and reuses the old folder (a file with the plain name is not a folder)', r1 === listing[0].name && /approot:\/Other\/EQI:\/children/.test(asked), { r1, asked });
  fail404 = true;
  const r2 = await f.resolve('Other/EQI', 'HOIST-1 - Hoist');
  check('topic folder missing: the plain name', r2 === 'HOIST-1 - Hoist', r2);
  const mirror = piece('function _odMirrorRecord(tbl,rec){', '\nfunction ');
  check('every upload in _odMirrorRecord waits for the resolved folder', (mirror.match(/_odPushFile\(/g) || []).length === 3 && (mirror.match(/where\.then\(function\(\)\{return _odPushFile\(/g) || []).length === 3);
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
