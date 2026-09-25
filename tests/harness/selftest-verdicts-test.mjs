// The security self-test's verdicts for the four trustee tables (2026-09-25).
//
// They used to be a fixed ⚠ whatever came back, so a clean result looked like a
// warning. Michael: no defect, no warning. And ?anon=1 never probed them, so
// open item #3 (any anonymous session reads the trustee reports, manager note
// included) did not appear on the screen at all.
//
// Runs the real endpoint with fetch mocked: a stranger with no session reads 0
// rows everywhere; an anonymous session reads the trustee roster, task list,
// locations and reports -- which is today's live state.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
let pass = 0, fail = 0;
const check = (l, c, d) => { if (c) { pass++; console.log('  ✓ ' + l); } else { fail++; console.log('  ✗ ' + l + (d !== undefined ? '  -> ' + JSON.stringify(d) : '')); } };

const build = path.join(HERE, '_build');
fs.mkdirSync(build, { recursive: true });
const out = path.join(build, 'selftest-verdicts.mjs');
fs.writeFileSync(out, fs.readFileSync(path.join(ROOT, 'functions/api/_securityselftest.js'), 'utf8')
  .replace("from '../_shared.js'", 'from ' + JSON.stringify(path.join(ROOT, 'functions/_shared.js'))));
globalThis.atob = (b) => Buffer.from(b, 'base64').toString('binary');

// `stranger` = row counts a request WITHOUT a session gets; `anonymous` = with
// the throwaway anonymous token.
function world(stranger, anonymous) {
  globalThis.fetch = async (url, init) => {
    const u = String(url);
    const h = new Headers((init && init.headers) || {});
    const auth = h.get('authorization') || '';
    const json = (obj, status = 200, extra = {}) => new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json', ...extra } });
    if (u.includes('/auth/v1/user')) return json({ id: 'u1', email: 'admin@tfugen.local', is_anonymous: false });
    if (u.includes('/auth/v1/signup')) return json({ access_token: 'anon-tok' });
    if (u.includes('/storage/v1/object/list/')) return json([]);
    const m = u.match(/\/rest\/v1\/([a-z_]+)\?/);
    if (m) {
      const counts = auth === 'Bearer anon-tok' ? anonymous : stranger;
      const n = counts[m[1]] || 0;
      return json([], 200, { 'content-range': (n ? '0-0' : '*') + '/' + n });
    }
    return json({});
  };
}
const { onRequest } = await import(out);
const run = async () => {
  const r = await onRequest({ request: new Request('https://x.dev/api/_securityselftest?stranger=1&anon=1', {
    headers: { authorization: 'Bearer user-tok', accept: 'application/json' } }) });
  const j = await r.json();
  const by = {};
  (j.checks || []).forEach((c) => { by[c.id] = c; });
  return by;
};
const TODAY = { trustees: 8, trustee_tasks: 8, locations: 10, trustee_reports: 3 };

console.log('\n1. a stranger with no session reads 0 rows: a tick, not a warning');
{
  world({}, TODAY);
  const by = await run();
  for (const t of ['trustee_reports', 'trustees', 'trustee_tasks', 'locations']) {
    const c = by['anon:' + t] || {};
    check('anon:' + t + ' is ✓ (' + c.got + ')', c.verdict === '✓', c);
  }
}

console.log('\n2. ?anon=1 now probes the trustee tables with an anonymous session');
{
  world({}, TODAY);
  const by = await run();
  for (const t of ['trustees', 'trustee_tasks', 'locations']) {
    const c = by['anonymous:' + t] || {};
    check('anonymous:' + t + ' readable, as the trustee screen needs: ✓ (' + c.got + ')', c.verdict === '✓', c);
  }
  const r = by['anonymous:trustee_reports'] || {};
  check('anonymous:trustee_reports readable is ⚠, and names open item #3', r.verdict === '⚠' && /#3/.test(r.expected || ''), r);
}

console.log('\n3. the verdicts still catch a real problem');
{
  // A stranger reading the roster without any session would be a new hole.
  world({ trustees: 8 }, TODAY);
  let c = (await run())['anon:trustees'] || {};
  check('a stranger who CAN read trustees gets ⚠', c.verdict === '⚠', c);
  // An anonymous session that cannot read the roster means the trustee screen broke.
  world({}, { ...TODAY, trustees: 0 });
  c = (await run())['anonymous:trustees'] || {};
  check('an anonymous session that CANNOT read trustees gets ⚠ (the screen would be broken)', c.verdict === '⚠', c);
  // Once #3 is fixed, the reports no longer reach an anonymous session.
  world({}, { ...TODAY, trustee_reports: 0 });
  c = (await run())['anonymous:trustee_reports'] || {};
  check('when the reports are closed to anonymous sessions, the warning clears', c.verdict === '✓', c);
  // Non-trustee tables keep their old rule.
  world({ emp: 5 }, TODAY);
  c = (await run())['anon:emp'] || {};
  check('a stranger reading emp is still a failure (✗)', c.verdict === '✗', c);
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
