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

  const forAll = live.filter((p) => /FOR\s+ALL/i.test(p.body) && /TO\s+authenticated/i.test(p.body));
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
  }
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
