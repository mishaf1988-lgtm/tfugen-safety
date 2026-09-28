// The nightly backup worker must fit Cloudflare's subrequest cap (50 on the
// Free plan). Cowork found on 28/09, before deploying, that the 45-table list
// would need 62 requests and lose the upload itself. Runs the real worker with
// fetch mocked and counts every request.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const src = fs.readFileSync(path.join(HERE, '../../workers/backup-cron.js'), 'utf8');
const W = (await import('data:text/javascript;charset=utf-8,' + encodeURIComponent(src))).default;
let pass = 0, fail = 0;
const check = (l, c, d) => { if (c) { pass++; console.log('  ✓ ' + l); } else { fail++; console.log('  ✗ ' + l + (d !== undefined ? '  -> ' + JSON.stringify(d) : '')); } };

const NO_TS = ['auds', 'ctr', 'docs', 'drl', 'emp', 'env', 'hzm', 'inc', 'ins', 'leg', 'med', 'ppe', 'rsk', 'tr', 'wst'];
const ENV = { SUPABASE_URL: 'https://sb', SUPABASE_SERVICE_KEY: 'k', MANUAL_KEY: 'm' };
function world(o) {
  o = o || {};
  const w = { calls: [], uploads: 0, deleted: null };
  globalThis.fetch = async (url, init) => {
    const u = String(url), m = (init && init.method) || 'GET';
    w.calls.push(m + ' ' + u);
    // Cloudflare's cap, enforced here as the platform would
    if (w.calls.length > (o.cap || 50)) throw new Error('Too many subrequests');
    if (u.includes('/storage/v1/object/list/backups')) {
      const n = o.files || 16;
      const items = Array.from({ length: n }, (_, i) => ({ name: 'tapugan-backup-2026-09-' + String(30 - i).padStart(2, '0') + '.json', created_at: new Date(Date.now() - i * 86400e3).toISOString() }));
      return new Response(JSON.stringify(items), { status: 200 });
    }
    if (u.includes('/storage/v1/object/backups/') && m === 'POST') { w.uploads++; return new Response('{}', { status: 200 }); }
    if (u.endsWith('/storage/v1/object/backups') && m === 'DELETE') { w.deleted = JSON.parse(init.body).prefixes; return new Response('[]', { status: 200 }); }
    const t = u.split('/rest/v1/')[1].split('?')[0];
    if (/order=ts/.test(u) && (NO_TS.includes(t) || (o.dropTs || []).includes(t))) return new Response('{"message":"column ts does not exist"}', { status: 400 });
    if (t === 'audit_log' && o.bigAudit) {
      const from = parseInt(init.headers.Range, 10);
      return new Response(JSON.stringify(Array.from({ length: from === 0 ? 1000 : 5 }, (_, i) => ({ id: from + i }))), { status: 200 });
    }
    return new Response(JSON.stringify([{ id: t + '-1' }]), { status: 200 });
  };
  return w;
}
const run = async (env) => (await W.fetch(new Request('https://w/run?key=m'), env || ENV)).json();

console.log('\n1. the whole list fits the Free plan');
{
  const w = world();
  const r = await run();
  check('45 tables backed up, no errors', r.ok && r.table_count === 45 && r.errors.length === 0, r.errors);
  check('uploaded once', w.uploads === 1);
  check('pruned (16 files, keep 15): one deleted', w.deleted && w.deleted.length === 1, w.deleted);
  check('at most 50 requests (' + w.calls.length + ')', w.calls.length <= 50 && r.subrequests === w.calls.length, w.calls.length);
  check('a no-ts table is read once, unordered', w.calls.filter((c) => c.includes('/rest/v1/docs?')).length === 1 && !w.calls.some((c) => c.includes('/rest/v1/docs?') && c.includes('order=ts')));
  check('a ts table is ordered by ts', w.calls.some((c) => c.includes('/rest/v1/tour_hazards?') && c.includes('order=ts')));
}

console.log('\n2. when it does not fit, the upload still happens and says what is missing');
{
  const w = world({ bigAudit: true, dropTs: ['audit_log', 'tasks', 'toolbox', 'locations'] });
  const r = await run();
  check('upload happened', w.uploads === 1 && r.upload_status === 200, r);
  check('never over 50', w.calls.length <= 50, w.calls.length);
  const skipped = r.errors.filter((e) => /subrequest budget/.test(e.error)).map((e) => e.table);
  check('skipped tables are named, and ok is false', skipped.length > 0 && r.ok === false, r.errors);
  check('prune is skipped rather than overrunning', w.deleted === null, r.prune);
}
{
  const w = world({ bigAudit: true });
  const r = await run({ ...ENV, SUBREQ_LIMIT: '1000' });
  check('SUBREQ_LIMIT on a Paid plan: everything, audit_log paged (1005 rows)', r.ok && w.uploads === 1 && r.total_rows === 44 + 1005, [r.ok, r.total_rows, r.errors]);
}
{
  world({ dropTs: ['tasks'] });
  const r = await run();
  check('a table that lost its ts column is still read (fallback)', r.ok && r.table_count === 45, r.errors);
}

console.log('\n3. /health without KV reads the bucket');
{
  // a fresh module = a cold worker, with no LAST_RUN in memory
  const W2 = (await import('data:text/javascript;charset=utf-8,' + encodeURIComponent(src + '\n// cold'))).default;
  const w = world({ files: 3 });
  const h = await W2.fetch(new Request('https://w/health'), ENV);
  const j = await h.json();
  check('fresh file in the bucket -> 200 ok, not "unknown"', h.status === 200 && j.status === 'ok' && /tapugan-backup/.test(j.filename) && w.calls.length === 1, j);
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
