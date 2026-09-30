// Server reads past 1000 rows (upgrade review 30, 30/09/2026).
// PostgREST caps a response at db-max-rows (1000) whatever limit= asks for,
// and says nothing. readAll in hazard-file.js asked for limit=5000 and took
// the first page as the whole table, so the file in folder 13, the
// department report, the deck and the meeting data would have lost the
// newest hazards (order=n.asc) once a table passed 1000 rows. A fake
// PostgREST below caps at 1000 and returns rows with equal sort values in a
// different order on every request, as Postgres may, so a pager that does not
// add a tiebreak repeats and skips rows.
// Also: no top-level function in index.html is defined twice (a fix made in
// the dead copy changes nothing).
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { readAll, pagedPath, READ_PAGE, READ_MAX_PAGES, TASKS_Q } from './_build/hazard-file.mjs';

let pass = 0, fail = 0;
const check = (l, c, d) => { if (c) { pass++; console.log('  ✓ ' + l); } else { fail++; console.log('  ✗ ' + l + (d !== undefined ? '  -> ' + JSON.stringify(d).substring(0, 300) : '')); } };
const here = path.dirname(fileURLToPath(import.meta.url));
const src = (f) => fs.readFileSync(path.join(here, '../../', f), 'utf8');

const MAX_ROWS = 1000;
let tables = {}, calls = [], status = 200;
globalThis.fetch = async (url) => {
  calls.push(url);
  if (status !== 200) return { ok: false, status, json: async () => ({}) };
  const u = new URL(url);
  const t = u.pathname.split('/').pop();
  const rows = (tables[t] || []).slice();
  // Unspecified tie order: shuffle first, then a stable sort on the given keys.
  for (let i = rows.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [rows[i], rows[j]] = [rows[j], rows[i]]; }
  const ord = (u.searchParams.get('order') || '').split(',').filter(Boolean).map((o) => o.split('.'));
  rows.sort((a, b) => { for (const [c, dir] of ord) { if (a[c] < b[c]) return dir === 'desc' ? 1 : -1; if (a[c] > b[c]) return dir === 'desc' ? -1 : 1; } return 0; });
  const off = +(u.searchParams.get('offset') || 0);
  const lim = Math.min(+(u.searchParams.get('limit') || MAX_ROWS), MAX_ROWS);
  return { ok: true, status: 200, json: async () => rows.slice(off, off + lim) };
};
const env = { SUPABASE_SERVICE_ROLE_KEY: 'k', SUPABASE_URL: 'https://x.supabase.co' };
const mk = (n, f) => Array.from({ length: n }, (_, i) => f(i + 1));

console.log('\n1. more than 1000 rows');
tables = { tour_hazards: mk(1250, (i) => ({ id: 'h' + String(i).padStart(5, '0'), n: i })) };
calls = [];
let got = await readAll(env, 'tour_hazards?select=id,n&order=n.asc');
check('1250 hazards read, not 1000', got.length === 1250, got.length);
check('the newest hazard (n=1250) is there', got.some((r) => r.n === 1250));
check('in order n.asc', got.every((r, i) => r.n === i + 1));
check('two requests', calls.length === 2, calls);

console.log('\n2. equal sort values across a page boundary');
tables = { trustee_reports: mk(1250, (i) => ({ id: 'r' + String(i).padStart(5, '0'), ts: '2026-09-' + (i <= 1100 ? '01' : '02') })) };
let dupOrMiss = 0;
for (let k = 0; k < 5; k++) {
  got = await readAll(env, 'trustee_reports?select=id,ts&order=ts.asc');
  if (new Set(got.map((r) => r.id)).size !== 1250) dupOrMiss++;
}
check('5 reads of 1250 rows with 1100 on the same ts: every row exactly once', dupOrMiss === 0, dupOrMiss);
check('id is added as the tiebreak', /order=ts\.asc,id\.asc/.test(pagedPath('trustee_reports?select=id,ts&order=ts.asc', 0)));
check('a desc order keeps its direction', /order=ts\.desc,id\.asc&/.test(pagedPath('trustee_reports?select=id&order=ts.desc', 0)));
check('an order that already has id is left alone', /order=n\.asc,id\.desc&limit/.test(pagedPath('t?select=id&order=n.asc,id.desc', 0)));
check('no order: order=id.asc (TASKS_Q)', /&order=id\.asc&limit=1000&offset=1000$/.test(pagedPath(TASKS_Q, 1000)), pagedPath(TASKS_Q, 1000));
check('a path with no "?" still builds a query', pagedPath('locations', 0) === 'locations?order=id.asc&limit=1000&offset=0', pagedPath('locations', 0));

console.log('\n3. edges');
tables = { inc: mk(1000, (i) => ({ id: 'i' + String(i).padStart(5, '0') })) };
calls = [];
got = await readAll(env, 'inc?select=id');
check('exactly 1000 rows: all read, and a second request finds the end', got.length === 1000 && calls.length === 2, [got.length, calls.length]);
tables = { inc: mk(41, (i) => ({ id: 'i' + i })) };
calls = [];
got = await readAll(env, 'inc?select=id&order=dt.asc');
check('41 rows (today): one request', got.length === 41 && calls.length === 1, [got.length, calls.length]);
tables = { inc: [] };
check('empty table: []', (await readAll(env, 'inc?select=id')).length === 0);
status = 500;
let err = null;
try { await readAll(env, 'inc?select=id'); } catch (e) { err = e.message; }
check('an error status throws (not an empty register)', /read inc failed \(500\)/.test(err || ''), err);
status = 200;
tables = { tour_hazards: mk(READ_PAGE * READ_MAX_PAGES + 5, (i) => ({ id: 'h' + String(i).padStart(6, '0') })) };
err = null;
try { await readAll(env, 'tour_hazards?select=id'); } catch (e) { err = e.message; }
check('more than the page cap: throws instead of a cut list', /more than 20000 rows/.test(err || ''), err);

console.log('\n4. one reader for every server file');
const users = ['hazard-file', 'hazard-report', 'hazard-deck', 'meeting-data', 'trustee-log'];
users.forEach((f) => {
  const s = src('functions/api/' + f + '.js');
  check(f + ': no limit=5000', !/limit=5000/.test(s));
  if (f !== 'hazard-file') check(f + ': no own readAll, imports hazard-file\'s', !/function readAll/.test(s) && /import \{[^}]*\breadAll\b[^}]*\} from '\.\/hazard-file\.js'/.test(s));
});

console.log('\n5. no top-level function defined twice in index.html');
const html = src('index.html');
const seen = {}, twice = [];
html.split('\n').forEach((l, i) => {
  const m = /^(?:async )?function ([A-Za-z_$][\w$]*)\s*\(/.exec(l);
  if (!m) return;
  if (seen[m[1]]) twice.push(m[1] + ' ' + seen[m[1]] + '/' + (i + 1)); else seen[m[1]] = i + 1;
});
check('none', twice.length === 0, twice);
check('the ones that were: each defined once', ['_eqiPdfExtractJson', 'ncrTab', 'ncrStatusChange'].every((n) => (html.match(new RegExp('^function ' + n + '\\(', 'gm')) || []).length === 1));

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
