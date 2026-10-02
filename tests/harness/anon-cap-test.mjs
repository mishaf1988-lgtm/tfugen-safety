// Upgrade review 18 (30/09/2026, Michael chose 20 / 50 / 15): a ceiling on
// what an anonymous session can push in. Two halves:
//   1. migrations/2026-09-30_anon_write_cap.sql: 20 inserts an hour from one
//      anonymous session, 50 from all of them, on every emp_insert table.
//      (Run against the live DB in a rolled-back transaction on 30/09/2026:
//      20 passed / 21st refused PT429, 30 more from new sessions then 10
//      refused, a named user 5/5.) Here: the file says what was run.
//   2. functions/api/trustee-notify.js: 15 alerts a day, the 16th becomes one
//      notice, the rest are silent. Runs the REAL module with fetch mocked.
import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
let pass = 0, fail = 0;
const check = (l, c, d) => { if (c) { pass++; console.log('  ✓ ' + l); } else { fail++; console.log('  ✗ ' + l + (d !== undefined ? '  -> ' + JSON.stringify(d).substring(0, 300) : '')); } };
const load = async (rel) => {
  const src = fs.readFileSync(path.join(ROOT, rel), 'utf8')
    .replace(/from '\.\.\/(_[a-z]+)\.js'/g, (m, mod) => "from '" + pathToFileURL(path.join(ROOT, 'functions/' + mod + '.js')).href + "'");
  return import('data:text/javascript;charset=utf-8,' + encodeURIComponent(src));
};

console.log('\n1. the migration');
const mig = fs.readFileSync(path.join(ROOT, 'migrations/2026-09-30_anon_write_cap.sql'), 'utf8');
const body = mig.split('\n').filter((l) => !/^\s*--/.test(l)).join('\n');
check('only anonymous sessions are counted (is_anonymous from the JWT)', /\(auth\.jwt\(\) ->> 'is_anonymous'\)::boolean/.test(body) && /IS NOT TRUE THEN\s+RETURN NEW/.test(body));
check('20 an hour per session, 50 an hour for all', /n_me >= 20 OR n_all >= 50/.test(body) && /interval '1 hour'/.test(body));
check('refused with PT429 (HTTP 429), so the outbox keeps the row and sends it again', /RAISE SQLSTATE 'PT429'/.test(body));
check('parallel inserts are serialised (advisory lock)', /pg_advisory_xact_lock/.test(body));
const TABLES = ['trustee_reports', 'near_miss', 'rounds', 'tr', 'equip_inspections'];
check('a BEFORE INSERT trigger on all five emp_insert tables', TABLES.every((t) => new RegExp('CREATE TRIGGER a_anon_write_cap BEFORE INSERT ON public\\.' + t + '\\s').test(body)));
check('no existing policy is touched', !/(CREATE|DROP|ALTER) POLICY/.test(body));
check('the counter table is closed to clients', /REVOKE ALL ON private\.anon_writes FROM PUBLIC, anon, authenticated/.test(body));
check('the rollback is in the file', /-- Rollback/.test(mig) && /-- DROP TABLE IF EXISTS private\.anon_writes;/.test(mig));
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const drain = /function _obDrainOps\(\)\{[\s\S]*?\n\}\n/.exec(html);
check('the app\'s outbox keeps a refused op (remaining.push in the catch)', drain && /catch\(function\(err\)\{[\s\S]*?remaining\.push\(op\)/.test(drain[0]));

console.log('\n2. trustee-notify: 15 alerts a day, then one notice');
const SB = 'https://znhjtpcltrxxyfjczgvw.supabase.co';
const ENV = { SUPABASE_SERVICE_ROLE_KEY: 'svc', META_PHONE_NUMBER_ID: 'pn', META_ACCESS_TOKEN: 'tok', RESEND_KEY: 'rk', TRUSTEE_NOTIFY_SECRET: 's0' };
const notify = await load('functions/api/trustee-notify.js');
function world(alreadyToday, stateDay) {
  const w = { meta: [], mail: [], logs: [], state: stateDay ? { notify_cap_day: stateDay } : {}, counts: [] };
  globalThis.fetch = async (url, init) => {
    const u = String(url), m = (init && init.method) || 'GET';
    const J = (b, s) => new Response(JSON.stringify(b), { status: s || 200, headers: { 'Content-Type': 'application/json' } });
    if (u.includes('graph.facebook.com')) { w.meta.push(JSON.parse(init.body)); return J({ messages: [{ id: 'x' }] }); }
    if (u.includes('api.resend.com')) { w.mail.push(JSON.parse(init.body)); return J({ id: 'e' }); }
    if (!u.startsWith(SB)) throw new Error('unexpected ' + u);
    if (u.includes('/server_state')) {
      if (m === 'POST') { JSON.parse(init.body).forEach((r) => { w.state[r.key] = r.value; }); return J([]); }
      return J(Object.keys(w.state).map((k) => ({ key: k, value: w.state[k], updated_at: 'x' })));
    }
    if (u.includes('/notification_prefs')) return J([{ prefs: { trustee_hazard: { whatsapp: true, whatsapp_to: '972500000000', email: true, email_to: 'm@x.y' } } }]);
    if (u.includes('/notifications_log')) { w.logs.push(...JSON.parse(init.body)); return J([]); }
    if (u.includes('/trustee_tasks')) return J([]);
    if (u.includes('notified_at=gte.')) {
      w.counts.push(decodeURIComponent(u));
      // the row just claimed counts too: split what "today" holds between the two tables
      const n = u.includes('/trustee_reports') ? alreadyToday : 0;
      return J(Array.from({ length: n }, (_, i) => ({ id: 'r' + i })));
    }
    if (u.includes('/trustee_reports?id=eq.')) {
      if (m === 'PATCH') return J([{ id: 'R1' }]);
      return J([{ id: 'R1', u: 'דנה', t: 5, d: '2026-09-30', loc: 'מחסן', f: 'מטף בלי פלומבה', ok: false, s: 'פתוח', photo_url: null, ts: new Date().toISOString(), notified_at: null }]);
    }
    throw new Error('unexpected sb ' + m + ' ' + u);
  };
  return w;
}
const req = () => new Request('https://tapugan-safety.pages.dev/api/trustee-notify', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-notify-secret': 's0' }, body: JSON.stringify({ id: 'R1' }) });
const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jerusalem' });
{
  const w = world(15);
  const r = await (await notify.onRequest({ request: req(), env: ENV })).json();
  check('the 15th of the day goes out as usual (WhatsApp + mail with the finding)', r.whatsapp === 'sent' && w.meta.length === 1 && w.mail.length === 1 && /מטף בלי פלומבה/.test(w.mail[0].html), r);
  check('...counted from midnight Israel time, over both sources', w.counts.length === 2 && w.counts.some((c) => c.includes('/trustee_reports?ok=eq.false&')) && w.counts.some((c) => c.includes('/near_miss?')), w.counts);
}
{
  const w = world(16);
  const r = await (await notify.onRequest({ request: req(), env: ENV })).json();
  const txt = JSON.stringify(w.meta) + (w.mail[0] ? w.mail[0].html : '');
  check('the 16th sends ONE notice instead of itself', r.skipped === 'daily cap (notice sent)' && w.meta.length === 1 && w.mail.length === 1, r);
  check('...the notice says 15, until tomorrow, the reports are saved', /15 התראות/.test(txt) && /עד מחר/.test(txt) && /נשמרים/.test(txt), txt.substring(0, 300));
  check('...and does not carry the hazard itself', !/מטף בלי פלומבה/.test(txt));
  check('...the day is remembered, the notice is logged as notify_cap', w.state.notify_cap_day === today && w.logs.some((l) => l.event_type === 'notify_cap' && l.channel === 'whatsapp'), { st: w.state, logs: w.logs });
  check('...text for people: no long dash', !/—/.test(txt));
}
{
  const w = world(40, today);
  const r = await (await notify.onRequest({ request: req(), env: ENV })).json();
  check('after the notice: nothing sent, a "capped" log line', r.skipped === 'daily cap' && w.meta.length === 0 && w.mail.length === 0 && w.logs.some((l) => l.channel === 'capped'), r);
}
{
  const w = world(40, '2026-01-01');
  const r = await (await notify.onRequest({ request: req(), env: ENV })).json();
  check('a notice from another day does not silence today: today gets its own', r.skipped === 'daily cap (notice sent)' && w.meta.length === 1, r);
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
