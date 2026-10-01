// The change log is written by the database (BACKLOG 9.20, 01/10/2026).
//
// The behaviour itself was proven on the live database in a transaction that
// was rolled back (STATUS, 01/10/2026): insert / update / delete logged under
// the session's email, a no-op update not logged, a forged user_email and ts
// from the browser replaced, a browser row for an audited table dropped, the
// service key logged as 'server' and manual SQL as 'db'. This suite guards the
// migration's shape so a later edit cannot quietly undo those properties, and
// the screen that reads the new columns.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
let pw; try { pw = require('playwright'); } catch (e) { pw = require('playwright-core'); }
const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
let pass = 0, fail = 0;
const check = (l, c, d) => { if (c) { pass++; console.log('  ✓ ' + l); } else { fail++; console.log('  ✗ ' + l + (d !== undefined ? '  -> ' + JSON.stringify(d) : '')); } };

const sql = fs.readFileSync(path.join(ROOT, 'migrations/2026-10-01_audit_log_db_triggers.sql'), 'utf8');
const code = sql.split('\n').filter((l) => !/^\s*--/.test(l)).join('\n');   // comments may mention anything
const fn = (name) => (code.match(new RegExp('FUNCTION private\\.' + name + '\\(\\)[\\s\\S]*?\\$function\\$;')) || [''])[0];

const TABLES = ['tour_hazards', 'trustee_reports', 'inc', 'ncr', 'near_miss', 'tasks', 'equip_inspections', 'docs', 'tr', 'mgmt_reviews', 'leg'];
const list = (code.match(/ARRAY\[([^\]]+)\]::text\[\]/) || ['', ''])[1];
check('the 11 evidence tables Michael approved, no more and no less', TABLES.every((t) => list.includes("'" + t + "'")) && (list.match(/'/g) || []).length === 22, list);
check('not destructive: no DROP TABLE / DROP POLICY / DELETE / TRUNCATE / DROP COLUMN',
  !/DROP\s+TABLE|DROP\s+POLICY|DELETE\s+FROM|TRUNCATE|DROP\s+COLUMN/i.test(code));
check('new columns are additive (IF NOT EXISTS)', /ADD COLUMN IF NOT EXISTS source text/.test(code) && /ADD COLUMN IF NOT EXISTS changed text\[\]/.test(code));

const row = fn('audit_row'), stamp = fn('audit_log_stamp');
for (const [n, f] of [['audit_row', row], ['audit_log_stamp', stamp]]) {
  check(n + ': SECURITY DEFINER with an empty search_path', /SECURITY DEFINER/.test(f) && /SET search_path TO ''/.test(f), f.slice(0, 80));
  check(n + ': not callable by clients (REVOKE ... anon, authenticated)', new RegExp('REVOKE ALL ON FUNCTION private\\.' + n + '\\(\\) FROM PUBLIC, anon, authenticated').test(code));
}
check('audit_row: who comes from the JWT, never from the row', /auth\.jwt\(\)/.test(row) && !/NEW\.user_email|r->>'user_email'/.test(row));
check("audit_row: the service key is 'server', no JWT is 'db', no email is 'anonymous'",
  /'service_role'[\s\S]*'server'/.test(row) && /IS NULL THEN who := 'db'/.test(row) && /'anonymous'/.test(row));
check('audit_row: an update that changed nothing (but ts / notified_at) is not logged',
  /k NOT IN \('ts', 'notified_at'\)/.test(row) && /IS DISTINCT FROM/.test(row) && /IF ch IS NULL THEN RETURN NULL/.test(row));
check('audit_row: op values match what the app already writes (ins / upd / del)', /'ins'[\s\S]*'upd'[\s\S]*'del'/.test(row));
check('stamp: tells its own rows by trigger depth, not current_user (always the owner under SECURITY DEFINER)',
  /pg_trigger_depth\(\) > 1/.test(stamp) && !/current_user/.test(stamp));
check('stamp: a browser row gets the server time and the session email', /NEW\.ts := now\(\)/.test(stamp) && /NEW\.user_email := coalesce\(nullif\(j->>'email'/.test(stamp));
check('stamp: a browser row for an audited table is dropped (no duplicate)', /= ANY \(private\.audit_tables\(\)\) THEN RETURN NULL/.test(stamp));
check('stamp: BEFORE INSERT on audit_log; audit_row: AFTER I/U/D, named zz_ to run last',
  /CREATE TRIGGER audit_log_stamp BEFORE INSERT ON public\.audit_log/.test(code) && /zz_audit_row AFTER INSERT OR UPDATE OR DELETE/.test(code));
check('re-runnable: every CREATE TRIGGER has a DROP TRIGGER IF EXISTS before it',
  (code.match(/CREATE TRIGGER/g) || []).length === (code.match(/DROP TRIGGER IF EXISTS/g) || []).length);
check('the app reads the two new columns', /audit_log:'id,ts,user_email,op,table_name,record_id,title,source,changed'/.test(fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8')));

// ---------- the screen ----------
const browser = await pw.chromium.launch();
try {
  const page = await (await browser.newContext({ locale: 'he-IL' })).newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.route('**/*', (r) => r.request().url().startsWith('file://') ? r.continue() : r.abort());
  await page.goto('file://' + path.join(ROOT, 'index.html'), { waitUntil: 'load' });
  await page.waitForTimeout(700);
  const rows = await page.evaluate(async () => {
    const data = [
      { id: 3, ts: '2026-10-01T10:00:00Z', user_email: 'server', op: 'upd', table_name: 'tour_hazards', record_id: 'th-1', title: 'מטף חסום', source: 'server', changed: ['closed_d', 's'] },
      { id: 2, ts: '2026-10-01T09:00:00Z', user_email: 'anonymous', op: 'ins', table_name: 'trustee_reports', record_id: 'r1', title: 'x', source: 'app', changed: null },
      { id: 1, ts: '2026-10-01T08:00:00Z', user_email: 'admin@tfugen.local', op: 'del', table_name: 'tasks', record_id: 't1', title: 'y', source: 'app', changed: null },
    ];
    if (!g('tb-audit')) { const t = document.createElement('tbody'); t.id = 'tb-audit'; document.body.appendChild(t); }
    window._sbAuth = () => Promise.resolve();
    window.fetch = () => Promise.resolve(new Response(JSON.stringify(data), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    rAudit();
    await new Promise((r) => setTimeout(r, 300));
    return Array.from(g('tb-audit').querySelectorAll('tr')).map((tr) => tr.textContent);
  });
  check('screen: three rows', rows.length === 3, rows);
  check("screen: 'server' shows as שרת and the changed fields are listed", /שרת/.test(rows[0]) && /שדות: closed_d, s/.test(rows[0]), rows[0]);
  check("screen: 'anonymous' shows as נאמן", /נאמן/.test(rows[1]), rows[1]);
  check('screen: a user still shows as the username, no fields line without changes', /admin/.test(rows[2]) && !/שדות:/.test(rows[2]), rows[2]);
  check('screen: keyboard characters only (no middle dot)', !rows.some((r) => /·/.test(r)), rows);
  check('no page errors', errors.length === 0, errors.slice(0, 3));
} finally {
  await browser.close();
}
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
