// _backupPruneOneDrive (index.html) deletes old browser backups from
// _Backups/. It used a name list of server folders to skip (cron, monthly,
// photos) and missed `talks` (04/10/2026, functions/api/backup-od.js), so the
// weekly talk backup was counted as a browser backup. Now only a timestamp
// folder is a candidate. This runs the real function against a fake OneDrive.
const fs = require('fs');
const path = require('path');
const src = fs.readFileSync(path.join(__dirname, '../../index.html'), 'utf8');
let pass = 0, fail = 0;
const check = (l, c, d) => { if (c) { pass++; console.log('  ✓ ' + l); } else { fail++; console.log('  ✗ ' + l + (d !== undefined ? '  -> ' + JSON.stringify(d) : '')); } };

const re = src.match(/var _BACKUP_STAMP_RE=[^\n]*\n/);
const start = src.indexOf('function _backupPruneOneDrive(keep){');
const end = src.indexOf('\n}\n', start);
check('found the prune function and the stamp regex', !!re && start > 0 && end > start);

const stamps = Array.from({ length: 20 }, (_, i) => '2026-09-' + String(i + 1).padStart(2, '0') + '_03-00-00');
const top = stamps.map((n) => ({ id: 'id-' + n, name: n, folder: {} }))
  .concat(['cron', 'monthly', 'photos', 'talks', 'future-folder'].map((n) => ({ id: 'id-' + n, name: n, folder: {} })))
  .concat([{ id: 'id-file', name: 'readme.txt', file: {} }]);
const deleted = [];
const fetch = (url, o) => {
  if (o && o.method === 'DELETE') { deleted.push(decodeURIComponent(url.split('/items/')[1])); return Promise.resolve({ ok: true }); }
  const value = url.includes('/_Backups/cron:') ? [] : top;
  return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ value }) });
};
const _odEnsureToken = () => Promise.resolve('tok');
const fn = new Function('fetch', '_odEnsureToken', re[0] + src.slice(start, end + 2) + '\nreturn _backupPruneOneDrive;')(fetch, _odEnsureToken);

fn(15).then((res) => {
  check('5 oldest timestamp folders deleted', res.pruned === 5, res);
  check('the deleted ones are the oldest', deleted.slice().sort().join() === stamps.slice(0, 5).map((n) => 'id-' + n).join(), deleted);
  ['cron', 'monthly', 'photos', 'talks', 'future-folder'].forEach((n) =>
    check(n + ' is never deleted', !deleted.includes('id-' + n)));
  check('15 timestamp folders kept', res.browser_kept === 15, res);
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
});
