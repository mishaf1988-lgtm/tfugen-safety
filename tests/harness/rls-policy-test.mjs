// 5.9 — nothing in this project checked the database rules.
//
// 80 migrations, 19 of them with a `-- Verify` block in a comment, and not one
// automated assertion about any of it. The proof is in the folder: the Storage
// hole documented in migrations/2026-09-20_storage_trustee_scope.sql lived in
// production from September, because four Storage policies were granted to
// `authenticated` — and the day the trustee kiosk started signing in
// anonymously, "authenticated" came to include every visitor off the street.
// They could list, download, overwrite and delete every file in the bucket:
// incident photos, hearing-test scans, medical documents. Nothing warned.
// It was found because a person opened the file.
//
// These checks read the migrations as text. They cannot see the live database
// — the session has no network route to it (CLAUDE.md, Supabase MCP section) —
// so they assert what the repository CAN prove: that no migration reintroduces
// the shapes that produced that hole, that the ones that close it exist and
// stay honest about not having been run, and that the self-test endpoint grew
// the Storage coverage it was missing.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
const MIG = path.join(ROOT, 'migrations');
let pass = 0, fail = 0;
const check = (l, c, d) => { if (c) { pass++; console.log('  ✓ ' + l); } else { fail++; console.log('  ✗ ' + l + (d !== undefined ? '  -> ' + JSON.stringify(d) : '')); } };

const files = fs.readdirSync(MIG).filter((f) => f.endsWith('.sql')).sort();
const src = {};
files.forEach((f) => { src[f] = fs.readFileSync(path.join(MIG, f), 'utf8'); });

// A policy statement, from CREATE POLICY to the next semicolon.
// Comment lines are stripped first: several migrations DESCRIBE the policy
// they are replacing, and a description is not a grant. So are the bodies of
// DO $$ blocks that build SQL with format() — `public.%I` is not a table.
function policies(text) {
  const clean = text.split('\n').filter((l) => !/^\s*--/.test(l)).join('\n');
  const out = [];
  // Storage policies are quoted ("incidents_photos_select_named_user"); the
  // table may be schema-qualified. The negative lookahead is what keeps
  // `public.%I` inside an EXECUTE format() from parsing as the table `public`.
  const re = /CREATE\s+POLICY\s+"?([A-Za-z_][\w]*)"?\s+ON\s+((?:[A-Za-z_][\w]*\.)?[A-Za-z_][\w]*)(?![\w.%])([\s\S]*?);/gi;
  let m;
  while ((m = re.exec(clean))) out.push({ name: m[1], table: m[2], body: m[3], full: m[0] });
  return out;
}
const ALL = [];
files.forEach((f) => policies(src[f]).forEach((p) => ALL.push({ ...p, file: f })));

console.log('\n1. the migrations are readable and say what they do');
{
  check('there are migrations to check (' + files.length + ')', files.length > 40, files.length);
  check('and policies in them (' + ALL.length + ')', ALL.length > 20, ALL.length);
  // A policy built at runtime inside format() targets `public.%I`, which is a
  // placeholder and not a table. Nothing literal to parse there, and that is
  // not a parser failure.
  const literal = (t) => t.split('\n').filter((l) => !/^\s*--/.test(l)).join('\n')
    .replace(/CREATE\s+POLICY[^\n]*%I[^\n]*/gi, '');
  const noSemi = files.filter((f) => /CREATE\s+POLICY/i.test(literal(src[f])) && !policies(src[f]).length);
  check('every file with a literal CREATE POLICY parses into one — otherwise these checks see nothing', noSemi.length === 0, noSemi);
}

console.log('\n2. no policy hands a whole table to «authenticated» unconditionally');
{
  // USING(true) on SELECT for a public-ish table is a decision, not a bug — the
  // trustee kiosk needs it. FOR ALL is the shape that produced the hole: it
  // carries UPDATE and DELETE with it.
  // Some of these are history: 2026-04-24 opened four tables to the anonymous
  // kiosk on purpose, and a later migration narrowed them. What matters is
  // what is still the last word, which the block below works out.
  const forAllTrue = ALL.filter((p) => /FOR\s+ALL/i.test(p.body) && /USING\s*\(\s*true\s*\)/i.test(p.body));
  check('the FOR ALL … USING(true) statements in the history are all accounted for', forAllTrue.every((p) => /2026-04-2[04]/.test(p.file)),
    forAllTrue.filter((p) => !/2026-04-2[04]/.test(p.file)).map((p) => p.file + ': ' + p.name));

  // A later migration may narrow an earlier one; judge only what is still the
  // last word on each policy name.
  const latest = {};
  ALL.forEach((p) => { latest[p.table + '|' + p.name] = p; });
  const dropped = {};
  files.forEach((f) => {
    const re = /DROP\s+POLICY\s+(?:IF\s+EXISTS\s+)?([^\s]+)\s+ON\s+([^\s;]+)/gi;
    let m; while ((m = re.exec(src[f]))) dropped[m[2] + '|' + m[1]] = f;
  });
  const live = Object.keys(latest).filter((k) => {
    const d = dropped[k];
    return !d || d <= latest[k].file;     // dropped before it was (re)created
  }).map((k) => latest[k]);

  // A RESTRICTIVE policy can only take access away (it is ANDed with the
  // permissive ones), so it cannot be the hole this looks for. The next
  // check makes sure the 2026-09-24 ones stay restrictive: mfa_required as a
  // PERMISSIVE policy would hand every table to every user without a factor.
  const restrictive = (p) => /AS\s+RESTRICTIVE/i.test(p.body);
  const forAll = live.filter((p) => /FOR\s+ALL/i.test(p.body) && /TO\s+authenticated/i.test(p.body) && !restrictive(p));
  // Most of them are created in a format() loop over every table, which the
  // policy parser does not see; so every line that creates one is read directly.
  const narrowing = [];
  files.forEach((f) => src[f].split('\n').forEach((l) => {
    if (/^\s*--/.test(l)) return;
    if (/CREATE\s+POLICY\s+(mfa_required|viewer_no_(insert|update|delete))\b/i.test(l)) narrowing.push({ f, l: l.trim(), ok: /AS\s+RESTRICTIVE/i.test(l) });
  }));
  check('every CREATE POLICY mfa_required / viewer_no_* says AS RESTRICTIVE (' + narrowing.length + ' lines)', narrowing.length >= 8 && narrowing.every((x) => x.ok),
    narrowing.filter((x) => !x.ok).map((x) => x.f + ': ' + x.l.slice(0, 80)));

  const guarded = forAll.filter((p) => /is_admin_manager|is_admin_only|auth\.uid\(\)|auth\.jwt\(\)/i.test(p.body));
  check('every live FOR ALL policy is gated by a function or the caller identity', forAll.length === guarded.length,
    forAll.filter((p) => guarded.indexOf(p) < 0).map((p) => p.file + ': ' + p.name));

  // audit_log is the one that must not be FOR ALL at all: a manager could
  // delete the row recording what they did, and audit_log is excluded from
  // logging itself.
  const auditForAll = live.filter((p) => /audit_log/.test(p.table) && /FOR\s+ALL/i.test(p.body));
  check('audit_log has no live FOR ALL policy — or the migration that removes it exists',
    auditForAll.length === 0 || fs.existsSync(path.join(MIG, '2026-09-20_audit_log_append_only.sql')),
    auditForAll.map((p) => p.file + ': ' + p.name));
}

console.log('\n3. an anonymous session is not the same as a signed-in one');
{
  // This is the exact hole. A Storage policy that names `authenticated` and
  // says nothing about is_anonymous grants the anonymous kiosk session
  // everything it grants Michael.
  const storageFiles = files.filter((f) => /storage\.objects/i.test(src[f]));
  check('there are Storage policies in the repo at all', storageFiles.length > 0, storageFiles);

  const storagePolicies = [];
  storageFiles.forEach((f) => policies(src[f]).filter((p) => /storage\.objects|objects/i.test(p.table)).forEach((p) => storagePolicies.push({ ...p, file: f })));
  const authOnes = storagePolicies.filter((p) => /TO\s+authenticated/i.test(p.body));
  const anonAware = authOnes.filter((p) => /is_anonymous|tru-ph-|auth\.jwt\(\)/i.test(p.body));
  const blind = authOnes.filter((p) => anonAware.indexOf(p) < 0);
  // The old blind ones still exist as history; the scoping migration is what
  // replaces them, and it has to be there.
  check('a Storage policy that names authenticated either knows about anonymous sessions, or the scoping migration exists',
    blind.length === 0 || fs.existsSync(path.join(MIG, '2026-09-20_storage_trustee_scope.sql')),
    blind.map((p) => p.file + ': ' + p.name));

  const scope = fs.existsSync(path.join(MIG, '2026-09-20_storage_trustee_scope.sql'))
    ? fs.readFileSync(path.join(MIG, '2026-09-20_storage_trustee_scope.sql'), 'utf8') : '';
  check('the scoping migration exists', !!scope);
  check('...it pins the anonymous session to the trustee photo prefix', /tru-ph-/.test(scope), scope.slice(0, 200));
  check('...it fails CLOSED: a token with no is_anonymous claim counts as anonymous', /coalesce\(\s*\(\s*auth\.jwt\(\)\s*->>\s*'is_anonymous'\s*\)::boolean\s*,\s*true\s*\)/i.test(scope), (scope.match(/coalesce[\s\S]{0,80}/i) || [])[0]);
  check('...and it does not give the anonymous session DELETE', !/FOR\s+DELETE[\s\S]{0,400}is_anonymous'\)::boolean\s*,\s*true\s*\)\s*=\s*true/i.test(scope));
}

console.log('\n3b. every Storage bucket the repo touches is scoped, not just the photos one');
{
  // #642 scoped `incidents-photos` and stopped there. The `backups` bucket —
  // which the nightly cron fills with a complete dump of the database — was
  // still `USING (bucket_id = 'backups')` and nothing more, so every
  // authenticated session including the anonymous kiosk could download the
  // lot. Found 2026-09-21 by get_advisors, fixed the same day.
  //
  // So the rule is not «the photos bucket is scoped» but «no bucket is
  // reachable on bucket_id alone».
  const buckets = new Set();
  const loose = [];
  files.forEach((f) => {
    policies(src[f]).forEach((p) => {
      const m = [...p.body.matchAll(/bucket_id\s*=\s*'([a-z0-9-]+)'/gi)].map((x) => x[1]);
      if (!m.length) return;
      m.forEach((b) => buckets.add(b));
      // the clause that names the bucket and nothing else about WHO is asking
      const knowsCaller = /is_anonymous|is_admin_manager|auth\.uid\(\)|tru-ph-|auth\.jwt\(\)\s*->>\s*'email'/i.test(p.body);
      if (!knowsCaller) loose.push(f + ': ' + p.name + ' (' + m.join(',') + ')');
    });
  });
  check('the repo defines Storage policies for more than one bucket', buckets.size >= 2, [...buckets]);
  // The loose ones are history; what matters is that a migration exists that
  // narrows each of them.
  const fixed = fs.existsSync(path.join(MIG, '2026-09-20_storage_trustee_scope.sql'))
             && fs.existsSync(path.join(MIG, '2026-09-21_storage_backups_scope.sql'));
  check('...and every bucket that was reachable on bucket_id alone has a scoping migration',
    loose.length === 0 || fixed, loose);
  // Comments stripped first — the file EXPLAINS the fix in prose, and matching
  // that prose would pass even with the live clause deleted. (It did.)
  const bk = fs.existsSync(path.join(MIG, '2026-09-21_storage_backups_scope.sql'))
    ? fs.readFileSync(path.join(MIG, '2026-09-21_storage_backups_scope.sql'), 'utf8')
        .split('\n').filter((l) => !/^\s*--/.test(l)).join('\n')
    : '';
  check('the backups bucket is scoped to a named admin, not merely to «authenticated»',
    /is_admin_manager/.test(bk) && /is_anonymous/.test(bk),
    'backups hold a full dump of every table');
}

console.log('\n4. a migration that has not been run says so');
{
  // Every migration waiting on Michael. If one is ever quietly edited to look
  // applied, or ships without the two things he needs to run it safely, this
  // is what notices. Started as three; the list grew with #678/#681/#684 and
  // the additions were nearly missed, so it is derived rather than typed —
  // every 2026-09-20 migration is pending until he says otherwise.
  const PENDING = files.filter((f) => f.startsWith('2026-09-20_'));
  check('the pending set is not empty — otherwise this section asserts nothing', PENDING.length >= 7, PENDING);
  PENDING.forEach((f) => {
    const t = src[f];
    check(f, /verify|אימות/i.test(t) && /SELECT/i.test(t) && /rollback|רולבק|DROP POLICY IF EXISTS/i.test(t),
      { verify: /verify|אימות/i.test(t), select: /SELECT/i.test(t), rollback: /rollback|רולבק|DROP POLICY IF EXISTS/i.test(t) });
  });

  // They are meant to be pasted one after another in a single SQL Editor, so
  // no two may create the same object under different definitions, and none
  // may carry an uncommented destructive statement into that run.
  const created = {};
  const clash = [];
  PENDING.forEach((f) => {
    const clean = src[f].split('\n').filter((l) => !/^\s*--/.test(l)).join('\n');
    const re = /CREATE\s+(?:TABLE|INDEX)\s+(?:IF\s+NOT\s+EXISTS\s+)?([A-Za-z_][\w.]*)/gi;
    let m;
    while ((m = re.exec(clean))) {
      const k = m[1].toLowerCase();
      if (created[k] && created[k] !== f) clash.push(k + ': ' + created[k] + ' + ' + f);
      created[k] = f;
    }
  });
  check('no two pending migrations create the same object', clash.length === 0, clash);

  const live = PENDING.filter((f) => {
    const clean = src[f].split('\n').filter((l) => !/^\s*--/.test(l)).join('\n');
    return /\b(DROP\s+TABLE|DROP\s+COLUMN|TRUNCATE|DELETE\s+FROM)\b/i.test(clean);
  });
  check('none of them runs a destructive statement — the rollbacks stay commented out', live.length === 0, live);
}

console.log('\n4b. no migration can fail halfway through a paste');
{
  // These three guards were written for RUN_ALL_PENDING.sql, the one-paste
  // file that carried the seven migrations waiting on Michael. All seven ran
  // on 2026-09-21, so that file and its builder are gone — but the failures
  // they caught are not specific to it, so they live here now and apply to
  // every migration in the folder.

  // 1. The gate function moved from public to private on 2026-05-29. A file
  //    still on the April spelling dies with «function does not exist» — which
  //    is what happened to Michael on 2026-09-21, three lines after a DROP
  //    POLICY had already run.
  const CANON = '2026-05-29_canonical_is_admin_manager_function.sql';
  const after = files.filter((f) => f > CANON && f !== 'RUN_ALL_PENDING.sql');
  const stale = after.filter((f) => /public\.is_admin_manager/.test(
    src[f].split('\n').filter((l) => !/^\s*--/.test(l)).join('\n')));
  check('no migration written after the move still calls public.is_admin_manager()', stale.length === 0, stale);
  check('...and the canonical file defines it in private', /FUNCTION\s+private\.is_admin_manager/i.test(src[CANON] || ''));

  // 2. The SQL editor wraps a paste in one transaction, so a failure rolls all
  //    of it back. A file with its own COMMIT ends that transaction early, and
  //    a failure after it leaves the database half-migrated with no signal.
  const txn = files.filter((f) => f !== 'RUN_ALL_PENDING.sql')
    .filter((f) => src[f].split('\n').some((l) => /^\s*(BEGIN|COMMIT|ROLLBACK)\s*;\s*$/i.test(l)));
  check('no migration opens or closes a transaction of its own', txn.length === 0, txn);

  // 3. Every CREATE POLICY has to be re-runnable: Postgres has no
  //    IF NOT EXISTS for policies, so it must be dropped by name first or sit
  //    behind a pg_policy / pg_policies check.
  const unsafe = [];
  files.filter((f) => f !== 'RUN_ALL_PENDING.sql').forEach((f) => {
    const clean = src[f].split('\n').filter((l) => !/^\s*--/.test(l)).join('\n');
    [...clean.matchAll(/CREATE\s+POLICY\s+"?([A-Za-z_][\w]*)"?/gi)].map((x) => x[1]).forEach((n) => {
      const dropped = new RegExp('DROP\\s+POLICY\\s+IF\\s+EXISTS\\s+"?' + n + '"?', 'i').test(clean);
      const guarded = /FROM\s+pg_polic(y|ies)/i.test(clean)
        && new RegExp("(polname|policyname)\\s*=\\s*'" + n + "'", 'i').test(clean);
      if (!dropped && !guarded) unsafe.push(f + ': ' + n);
    });
  });
  // Files from before this rule existed are history; what matters is that the
  // ones still waiting to be run are safe to paste twice.
  const pendingUnsafe = unsafe.filter((x) => /^2026-09-2[01]_/.test(x));
  check('every CREATE POLICY in a recent migration is re-runnable', pendingUnsafe.length === 0, pendingUnsafe);
}

console.log('\n5. a destructive statement is never silent');
{
  const DESTRUCTIVE = /\b(DROP\s+TABLE|TRUNCATE|DELETE\s+FROM)\b/i;
  const risky = files.filter((f) => DESTRUCTIVE.test(src[f].split('\n').filter((l) => !/^\s*--/.test(l)).join('\n')));
  // Anything that drops or empties a table has to explain itself in the file:
  // CLAUDE.md requires explicit approval for these, and a reader should not
  // have to guess which ones they are.
  const unexplained = risky.filter((f) => !/(רולבק|rollback|גיבוי|backup|אישור|approval)/i.test(src[f]));
  check('no migration drops or empties a table without saying so in the file', unexplained.length === 0, unexplained);
  check('and none of them touches the protected tables', !risky.some((f) => /DELETE\s+FROM\s+(public\.)?(ncr|ncr_ai|trustee_reports)\b/i.test(src[f])),
    risky.filter((f) => /DELETE\s+FROM\s+(public\.)?(ncr|ncr_ai|trustee_reports)\b/i.test(src[f])));
}

console.log('\n6. the live self-test covers what it claims to');
{
  const st = path.join(ROOT, 'functions/api/_securityselftest.js');
  check('the self-test endpoint exists — it is the only thing that touches the live DB', fs.existsSync(st));
  if (fs.existsSync(st)) {
    const t = fs.readFileSync(st, 'utf8');
    check('it checks RLS against the caller’s own token', /sens_ncr_visible_to_caller|app_users_visible_to_caller/.test(t));
    check('it checks that no secret is served in the page', /no_secrets/.test(t));
    // The gap this item is about: zero Storage checks, in the very endpoint
    // that would have caught the hole.
    check('...and it now probes Storage too, which is where the hole was', /storage\/v1\/object/.test(t), (t.match(/storage[^\n]{0,60}/) || [])[0]);

    // It used to report the anonymous case as «not testable from this
    // endpoint — needs an anonymous token». That was wrong: the endpoint
    // holds the publishable key, which is exactly what the kiosk mints an
    // anonymous token with. Now it does what the kiosk does and checks what
    // that session can actually reach.
    // Comments stripped: the file EXPLAINS that it used to say «not testable»,
    // and matching that prose passes while the code says the opposite. Same
    // trap as the migration check above; it caught me twice in one day.
    const tCode = t.split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n');
    check('it can prove the anonymous case rather than declaring it untestable',
      /auth\/v1\/signup/.test(tCode) && !/not testable from this endpoint/.test(tCode),
      (tCode.match(/not testable[^\n]{0,60}/) || ['signup call missing'])[0]);
    check('...and the backups bucket is one of the things it proves unreachable',
      /anon_cannot_read_backups/.test(t));
    // Creating an auth user as a side effect of a health check is its own
    // small problem, so it must not happen unless asked.
    check('...and it only mints that session when explicitly asked (?anon=1)',
      /searchParams\.get\('anon'\)/.test(t), 'must be opt-in');
  }
}

console.log('\n7. role is resolved by the full login email, never the local part (red-team 2026-09-24)');
{
  // The critical finding: is_admin_manager / is_admin_only / is_viewer matched
  // split_part(email,'@',1) -- the local part only -- so <staff-username>@any
  // -domain resolved to that staff member. The fix binds to the full
  // <id>@tfugen.local email. This guards against a future migration bringing
  // the local-part form back: for each function, only its LAST definition (the
  // one Postgres keeps) is judged.
  const FNS = ['is_admin_manager', 'is_admin_only', 'is_viewer'];
  for (const fn of FNS) {
    const defs = files.filter((f) => new RegExp('FUNCTION\\s+private\\.' + fn + '\\b').test(src[f])).sort();
    const last = defs[defs.length - 1];
    check(fn + ' has a definition in the migrations', !!last, defs);
    if (last) {
      // Strip comment lines: the rollback section quotes the old split_part
      // form on purpose, and matching it there is the same false-positive trap
      // the other checks in this file guard against.
      const body = src[last].split('\n').filter((l) => !/^\s*--/.test(l)).join('\n');
      check(fn + ' (last defined in ' + last + ') binds to the full @tfugen.local email',
        /\|\|\s*'@tfugen\.local'/.test(body), last);
      check(fn + ' (last defined in ' + last + ') does NOT resolve identity by the email local part',
        !/split_part\(\s*auth\.jwt\(\)\s*->>\s*'email'\s*,\s*'@'\s*,\s*1\s*\)/.test(body), last);
    }
  }
  // The server mirror (requireRole) must reject a foreign domain too.
  const shared = fs.readFileSync(path.join(ROOT, 'functions/_shared.js'), 'utf8');
  check('functions/_shared.js userRole requires the @tfugen.local domain',
    /!==\s*'tfugen\.local'/.test(shared), 'userRole domain guard missing');
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
