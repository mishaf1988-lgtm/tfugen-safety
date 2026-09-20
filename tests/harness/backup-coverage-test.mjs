// A backup is only a backup for the tables it names. Two things were wrong,
// and one of them nearly got "fixed" in a way that would have been worse.
//
// 1. workers/backup-cron.js — the unattended one, the one that actually runs
//    every night — listed 33 tables and was missing the entire trustee
//    programme (ISO 45001 §5.4 evidence, and the only record of who reported
//    what) plus every history table nothing else keeps: ncr_ai, which
//    CLAUDE.md names as protected production history, ncr_comments,
//    ncr_patterns, equip_inspection_history, and audit_log — the answer to
//    "who changed this record", which exists in no other place.
//
// 2. The obvious symmetric fix — adding those five to _BACKUP_TABLES in
//    index.html — would have produced a backup that looks complete and is
//    not: _backupSnapshot reads `Array.isArray(DB[t]) ? DB[t] : []`, those
//    tables are never synced into DB, and the builder SKIPS empty tables, so
//    they would have vanished silently. This suite pins that trap shut.
//
// 3. /health answered 'ok' whether the cron had run an hour ago or stopped in
//    July, so a dead backup system looked identical to a working one.
import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
let pass = 0, fail = 0;
const check = (l, c, d) => { if (c) { pass++; console.log('  ✓ ' + l); } else { fail++; console.log('  ✗ ' + l + (d !== undefined ? '  -> ' + JSON.stringify(d) : '')); } };

const cronSrc = fs.readFileSync(path.join(ROOT, 'workers/backup-cron.js'), 'utf8');
const appSrc = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const list = (src, re) => { const m = src.match(re); return m ? [...m[1].matchAll(/'([a-z_]+)'/g)].map((x) => x[1]) : []; };
const CRON = list(cronSrc, /const TABLES = \[([\s\S]*?)\];/);
const APP = list(appSrc, /_BACKUP_TABLES=\[([\s\S]*?)\];/);
// DB's keys are bare identifiers (`docs:[]`), not quoted strings — and four
// more (hearing_tests and three trustee tables) are not in the literal at all:
// ldb() creates them at startup with `if(!DB.x)DB.x=[];`. Both count.
const DBM = appSrc.match(/var DB=\{([\s\S]*?)\};/);
const DBKEYS = (DBM ? [...DBM[1].matchAll(/([a-z_]+)\s*:\s*\[\]/g)].map((x) => x[1]) : [])
  .concat([...appSrc.matchAll(/if\(!DB\.([a-z_]+)\)DB\.\1=\[\]/g)].map((x) => x[1]));

// Tables that hold a fact somebody would have to re-enter by hand.
const MUST_BACKUP = [
  'ncr', 'ncr_ai', 'ncr_comments', 'ncr_patterns', 'inc', 'near_miss', 'tasks',
  'tr', 'ppe', 'med', 'hearing_tests', 'equip_inspections', 'equip_inspection_history',
  'docs', 'ctr', 'leg', 'rsk', 'env_aspects', 'wst', 'hzm', 'auds', 'drl', 'ins',
  'rounds', 'toolbox', 'ptw', 'emp', 'app_users', 'locations', 'projects',
  'trustee_reports', 'trustees', 'trustee_winners', 'trustee_tasks', 'audit_log',
];

console.log('\n1. the nightly cron covers everything that holds a fact');
{
  const missing = MUST_BACKUP.filter((t) => CRON.indexOf(t) < 0);
  check('the cron names ' + CRON.length + ' tables', CRON.length >= 40, CRON.length);
  check('none of the ' + MUST_BACKUP.length + ' tables that hold a fact is missing from it', missing.length === 0, missing);
  check('the whole trustee programme is in it — it was the group most obviously absent',
    ['trustee_reports', 'trustees', 'trustee_winners', 'trustee_tasks'].every((t) => CRON.indexOf(t) >= 0),
    ['trustee_reports', 'trustees', 'trustee_winners', 'trustee_tasks'].filter((t) => CRON.indexOf(t) < 0));
  check('ncr_ai is in it — CLAUDE.md names it protected production history', CRON.indexOf('ncr_ai') >= 0);
  check('audit_log is in it — the only record of who changed what', CRON.indexOf('audit_log') >= 0);
  check('notifications_log is deliberately OUT — append-only, capped on sync, exportable as CSV', CRON.indexOf('notifications_log') < 0);
  check('no table is listed twice', new Set(CRON).size === CRON.length, CRON.filter((t, i) => CRON.indexOf(t) !== i));
}

console.log('\n2. the in-app backup only names tables it can actually read');
{
  // _backupSnapshot does `Array.isArray(DB[t]) ? DB[t] : []`, and the builder
  // skips empty tables — so a name that is not a DB key is a silent hole.
  const ghosts = APP.filter((t) => DBKEYS.indexOf(t) < 0);
  check('DB\u2019s tables were found — literal plus the ones ldb() creates (' + new Set(DBKEYS).size + ')', new Set(DBKEYS).size > 30, new Set(DBKEYS).size);
  check('every name in _BACKUP_TABLES is a real key in DB — otherwise it backs up an empty array', ghosts.length === 0, ghosts);
  check('the snapshot really does read the local DB, which is why the above matters',
    /_BACKUP_TABLES\.forEach\(function\(t\)\{\s*var rows=Array\.isArray\(DB\[t\]\)/.test(appSrc.replace(/\s+/g, ' ').replace(/ \{/g, '{')) || /Array\.isArray\(DB\[t\]\)\?DB\[t\]:\[\]/.test(appSrc));
  check('...and that it skips empty tables, so a ghost would leave no trace', /if\(!rows\.length\)return;/.test(appSrc));
  const appOnly = APP.filter((t) => CRON.indexOf(t) < 0);
  check('the cron is a superset of the in-app list — nothing is covered only by the browser', appOnly.length === 0, appOnly);
}

console.log('\n3. the cron pages through big tables instead of taking the first slice');
{
  check('fetchAllRows sends a Range header', /Range: `\$\{from\}-\$\{to\}`/.test(cronSrc));
  check('...and loops until the page comes back short', /while \(true\)/.test(cronSrc) && /from \+= pageSize|from = to \+ 1/.test(cronSrc));
  check('a table without a ts column falls back instead of failing the whole run', /order=ts\.desc[\s\S]{0,900}select=\*`/.test(cronSrc));
}

console.log('\n4. /health answers what happened, not that the worker is awake');
{
  const mod = await import(pathToFileURL(path.join(ROOT, 'workers/backup-cron.js')).href);
  const req = (p) => new Request('https://x' + p);
  const r0 = await mod.default.fetch(req('/health'), {});
  const b0 = await r0.json();
  check('with no run recorded it is 503, not ok', r0.status === 503 && b0.status === 'unknown', { status: r0.status, body: b0 });

  // a worker that remembers a good run an hour ago
  const kv = (v) => ({ get: async () => v, put: async () => {} });
  const fresh = JSON.stringify({ at: new Date(Date.now() - 3600e3).toISOString(), ok: true, filename: 'b.json', total_rows: 900, table_count: 30, errors: 0 });
  const r1 = await mod.default.fetch(req('/health'), { BACKUP_STATE: kv(fresh) });
  const b1 = await r1.json();
  check('a good run an hour ago is 200 ok', r1.status === 200 && b1.status === 'ok', { status: r1.status, body: b1 });
  check('...and it reports the row count, so an empty "success" is visible', b1.total_rows === 900, b1);

  const stale = JSON.stringify({ at: new Date(Date.now() - 20 * 864e5).toISOString(), ok: true, filename: 'b.json', total_rows: 900, table_count: 30, errors: 0 });
  const r2 = await mod.default.fetch(req('/health'), { BACKUP_STATE: kv(stale) });
  const b2 = await r2.json();
  check('a run that succeeded 20 days ago is 503 stale — this is the cron that quietly died', r2.status === 503 && b2.status === 'stale', { status: r2.status, body: b2 });
  check('...and it says how many hours old', b2.age_hours > 400, b2.age_hours);

  const failing = JSON.stringify({ at: new Date(Date.now() - 3600e3).toISOString(), ok: false, filename: '', total_rows: 0, table_count: 0, errors: 3 });
  const r3 = await mod.default.fetch(req('/health'), { BACKUP_STATE: kv(failing) });
  const b3 = await r3.json();
  check('a recent run that FAILED is 503 failing, not ok', r3.status === 503 && b3.status === 'failing', { status: r3.status, body: b3 });
  check('...and it carries the error count', b3.errors === 3, b3);
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
