// migrations/RUN_ALL_PENDING.sql is the one paste that unblocks ten backlog
// items. It is a SECOND copy of seven migrations, one of which closes a live
// production leak — and a drifted copy of a security migration is worse than
// not having one, because it looks like it was run.
//
// So it is generated, and this is what stops the copy from drifting: edit any
// of the seven, forget to rebuild, and the harness goes red.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { build, ORDER, MIG, OUT } from '../../tools/build-run-all.mjs';

let pass = 0, fail = 0;
const check = (l, c, d) => { if (c) { pass++; console.log('  ✓ ' + l); } else { fail++; console.log('  ✗ ' + l + (d !== undefined ? '  -> ' + JSON.stringify(d) : '')); } };

console.log('\n1. the combined file exists and matches its parts');
{
  check('RUN_ALL_PENDING.sql exists', fs.existsSync(OUT));
  const have = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : '';
  check('...and is exactly what the builder produces — no hand edits, no drift',
    have === build(), have === build() ? undefined : 'run: node tools/build-run-all.mjs');
}

console.log('\n2. it covers every migration that is still waiting');
{
  // Derived, not typed: a new pending migration that nobody adds to the
  // combined file is the failure this catches.
  const pending = fs.readdirSync(MIG).filter((f) => /^2026-09-20_.*\.sql$/.test(f)).sort();
  const listed = ORDER.map((m) => m.file).sort();
  check('every pending migration is in the combined file (' + pending.length + ')',
    pending.join('|') === listed.join('|'),
    { missing: pending.filter((f) => listed.indexOf(f) < 0), extra: listed.filter((f) => pending.indexOf(f) < 0) });
  check('...each one only once', new Set(listed).size === listed.length, listed);
  ORDER.forEach((m) => check('  ' + m.file + ' is a real file', fs.existsSync(path.join(MIG, m.file)), m.file));
}

console.log('\n3. the leak goes first');
{
  // The other six are missing features. This one is a hole an anonymous
  // session can walk through, open in production since September.
  check('the Storage scope migration is first', ORDER[0].file === '2026-09-20_storage_trustee_scope.sql', ORDER[0].file);
  check('...and is marked as the urgent one', ORDER[0].sev === '🔴', ORDER[0]);
  const body = fs.readFileSync(OUT, 'utf8');
  const iStorage = body.indexOf('tru-ph-');
  const iOther = body.indexOf('mgmt_reviews');
  check('...and really is earlier in the file, not just in the header', iStorage > 0 && iStorage < iOther, { iStorage, iOther });
}

console.log('\n4. pasting it cannot destroy anything');
{
  const body = fs.readFileSync(OUT, 'utf8');
  const live = body.split('\n').filter((l) => !/^\s*--/.test(l)).join('\n');
  // Every rollback block in every source file is commented out. If one is ever
  // uncommented, running this whole file would drop tables and columns.
  check('no live DROP TABLE', !/\bDROP\s+TABLE\b/i.test(live), (live.match(/.*DROP\s+TABLE.*/i) || [])[0]);
  check('no live DROP COLUMN', !/\bDROP\s+COLUMN\b/i.test(live), (live.match(/.*DROP\s+COLUMN.*/i) || [])[0]);
  // Two of these files REPLACE an existing policy — that is what they are for,
  // and CLAUDE.md treats it as a destructive action needing Michael's explicit
  // approval, which is what issues #642 and #658 are. So the property to hold
  // is not "never drops" but "drops safely and puts something back".
  const drops = live.match(/DROP\s+POLICY[^;]*/gi) || [];
  check('every policy drop is IF EXISTS, so a second run is not an error',
    drops.every((d) => /IF\s+EXISTS/i.test(d)), drops.filter((d) => !/IF\s+EXISTS/i.test(d)));

  // Per source file, not a global count with slack in it: a file that drops a
  // policy and puts nothing back would leave the table with no rule at all.
  const orphan = ORDER.filter((m) => {
    const f = fs.readFileSync(path.join(MIG, m.file), 'utf8')
      .split('\n').filter((l) => !/^\s*--/.test(l)).join('\n');
    return /DROP\s+POLICY/i.test(f) && !/CREATE\s+POLICY/i.test(f);
  }).map((m) => m.file);
  check('no file drops a policy without creating one in its place', orphan.length === 0, orphan);

  // And the four the Storage migration deliberately RETIRES (the blind
  // «authenticated» ones that were the hole) must not come back.
  const retired = ['incidents_photos_select_authenticated', 'incidents_photos_insert_authenticated',
    'incidents_photos_update_authenticated', 'incidents_photos_delete_authenticated'];
  const resurrected = retired.filter((n) => new RegExp('CREATE\\s+POLICY\\s+"?' + n).test(live));
  check('...and the blind «authenticated» Storage policies are not re-created', resurrected.length === 0, resurrected);
  check('no TRUNCATE and no DELETE FROM', !/\b(TRUNCATE|DELETE\s+FROM)\b/i.test(live), (live.match(/.*(TRUNCATE|DELETE\s+FROM).*/i) || [])[0]);
  check('and nothing touches the protected tables', !/(TRUNCATE|DELETE\s+FROM)\s+(public\.)?(ncr|ncr_ai|trustee_reports)\b/i.test(live));
}

console.log('\n4b. it warns that existing policies are replaced');
{
  const head = fs.readFileSync(OUT, 'utf8').split('=====')[0] + fs.readFileSync(OUT, 'utf8').slice(0, 3000);
  check('the header says outright that existing RLS policies are replaced', /\u05de\u05d7\u05dc\u05d9\u05e3 policies \u05e7\u05d9\u05d9\u05de\u05d5\u05ea/.test(head), head.slice(0, 200));
}

console.log('\n4c. it calls functions that actually exist');
{
  // This is what broke the first real run (2026-09-21). The gate function was
  // created as public.is_admin_manager() in April, then moved to the `private`
  // schema on 2026-05-29 (2026-05-29_canonical_is_admin_manager_function.sql).
  // One pending migration was still on the April spelling, so the paste died
  // with «function public.is_admin_manager() does not exist» — after the DROP
  // POLICY above it had already run.
  const stale = [];
  ORDER.forEach((m) => {
    const f = fs.readFileSync(path.join(MIG, m.file), 'utf8')
      .split('\n').filter((l) => !/^\s*--/.test(l)).join('\n');
    if (/public\.is_admin_manager/.test(f)) stale.push(m.file);
  });
  check('no pending migration calls public.is_admin_manager() — it lives in private', stale.length === 0, stale);

  // And the canonical definition is in the repo, so the name is checkable.
  const canon = fs.readFileSync(path.join(MIG, '2026-05-29_canonical_is_admin_manager_function.sql'), 'utf8');
  check('...and the canonical file still defines it there', /CREATE\s+OR\s+REPLACE\s+FUNCTION\s+private\.is_admin_manager/i.test(canon));
}

console.log('\n4d. no migration ends the transaction early');
{
  // The Supabase editor wraps the whole paste in ONE implicit transaction, so
  // a failure anywhere rolls the whole thing back — which is what we want from
  // a seven-part paste. An explicit COMMIT inside a section ENDS that
  // transaction mid-file, and a failure after it would leave the plant with
  // half the migrations applied and no signal about which half.
  const bad = [];
  ORDER.forEach((m) => {
    const f = fs.readFileSync(path.join(MIG, m.file), 'utf8');
    // a DO $$ block legitimately contains BEGIN ... END; the statement-level
    // ones are what matter, so match only a line that is exactly BEGIN;/COMMIT;
    const lines = f.split('\n').filter((l) => /^\s*(BEGIN|COMMIT|ROLLBACK)\s*;\s*$/i.test(l));
    if (lines.length) bad.push(m.file + ': ' + lines.map((x) => x.trim()).join(' '));
  });
  check('no pending migration opens or closes a transaction of its own', bad.length === 0, bad);
}

console.log('\n5. it is safe to run twice');
{
  const body = fs.readFileSync(OUT, 'utf8');
  const live = body.split('\n').filter((l) => !/^\s*--/.test(l)).join('\n');
  const creates = live.match(/CREATE\s+(TABLE|INDEX)\s+(?!IF\s+NOT\s+EXISTS)/gi) || [];
  check('every CREATE TABLE / CREATE INDEX is IF NOT EXISTS', creates.length === 0, creates);
  const adds = live.match(/ADD\s+COLUMN\s+(?!IF\s+NOT\s+EXISTS)/gi) || [];
  check('every ADD COLUMN is IF NOT EXISTS', adds.length === 0, adds);
  // CREATE POLICY has no IF NOT EXISTS in Postgres, so each one has to sit
  // inside a DO $$ block that checks pg_policy first.
  // CREATE POLICY has no IF NOT EXISTS in Postgres, so each one is re-runnable
  // only if it is either dropped first by name in the same file, or wrapped in
  // a DO block that checks pg_policy. Checked per policy, by name — a global
  // «at least one guard exists» would pass a file where nothing is guarded.
  const unsafe = [];
  ORDER.forEach((m) => {
    const f = fs.readFileSync(path.join(MIG, m.file), 'utf8')
      .split('\n').filter((l) => !/^\s*--/.test(l)).join('\n');
    const names = [...f.matchAll(/CREATE\s+POLICY\s+"?([A-Za-z_][\w]*)"?/gi)].map((x) => x[1]);
    names.forEach((n) => {
      const droppedFirst = new RegExp('DROP\\s+POLICY\\s+IF\\s+EXISTS\\s+"?' + n + '"?', 'i').test(f);
      // both spellings: the pg_policy catalog (polname) and the pg_policies
      // view (policyname). This file uses the second.
      const doGuarded = /FROM\s+pg_polic(y|ies)/i.test(f)
        && new RegExp("(polname|policyname)\\s*=\\s*'" + n + "'", 'i').test(f);
      if (!droppedFirst && !doGuarded) unsafe.push(m.file + ': ' + n);
    });
  });
  check('every CREATE POLICY is re-runnable — dropped by name first, or guarded on pg_policy', unsafe.length === 0, unsafe);
  check('the schema cache is reloaded so PostgREST sees the new columns', /NOTIFY\s+pgrst/i.test(live));
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
