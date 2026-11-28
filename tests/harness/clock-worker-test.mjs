// tapugan-clock (workers/clock.js, 28/11/2026): the site watch from Cloudflare's own cron.
// Pure functions (jobsFor, probeDue, stateOf, decide, waBodies), the country gate (every called path is exempt in
// functions/_middleware.js), the request budget (Free plan cap 50), and the HTTP surface (/health, /run).
// Runs the real worker with fetch mocked; no network.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '../..');
const src = fs.readFileSync(path.join(ROOT, 'workers/clock.js'), 'utf8');
const toml = fs.readFileSync(path.join(ROOT, 'workers/clock.toml'), 'utf8');
const mw = fs.readFileSync(path.join(ROOT, 'functions/_middleware.js'), 'utf8');
const M = await import('data:text/javascript;charset=utf-8,' + encodeURIComponent(src));
const W = M.default;
let pass = 0, fail = 0;
const check = (l, c, d) => { if (c) { pass++; console.log('  ✓ ' + l); } else { fail++; console.log('  ✗ ' + l + (d !== undefined ? '  -> ' + JSON.stringify(d) : '')); } };
const at = (iso) => Date.parse(iso);

console.log('\n1. source rules');
check('no raw Hebrew in clock.js (\\uXXXX only)', !/[֐-׿]/.test(src));
check('no non-ASCII character at all in clock.js', !/[^\x00-\x7f]/.test(src));
check('no secret value in the source (only names)', !/(EAA[A-Za-z0-9]{20,}|sk-ant-|eyJ[A-Za-z0-9_-]{20,})/.test(src + toml));
check('/run reads the key from the x-trigger header, never the query string', /headers\.get\('x-trigger'\)/.test(src) && !/searchParams\.get\('key'\)/.test(src));
{
  const msgs = Object.values(M.MSG).join(' ');
  check('every message is keyboard-only (no long dash, curly quotes, ellipsis char)', !/[–—‘’“”…·־]/.test(msgs));
  check('every message except the test says it is from Cloudflare', ['site_down', 'db_down', 'site_back', 'db_back'].every((k) => M.MSG[k].includes('Cloudflare')));
}

console.log('\n2. clock.toml');
{
  const crons = (toml.match(/^crons\s*=\s*\[(.*)\]/m) || [])[1] || '';
  check('the two crons are the ones jobsFor knows', crons.includes('"' + M.CRON_EVERY5 + '"') && crons.includes('"' + M.CRON_MORNING + '"'), crons);
  check('days by name (Cloudflare 1 = Sunday), no numeric 0-4', /SUN-THU/.test(crons) && !/0-4/.test(crons));
  check('name tapugan-clock, main clock.js', /^name = "tapugan-clock"/m.test(toml) && /^main = "clock.js"/m.test(toml));
  check('CLOCK_JOBS is empty by default (wa-* stay on pg_cron)', /^CLOCK_JOBS = ""/m.test(toml));
  check('the KV binding is a comment (optional)', /^# \[\[kv_namespaces\]\]/m.test(toml) && !/^\[\[kv_namespaces\]\]/m.test(toml));
  check('3 of 5 free crons with the backup Worker', crons.split(',').length + 1 <= 5);
}

console.log('\n3. the country gate: every called path is exempt');
{
  const m = mw.match(/const MACHINE_PATHS = \[([^\]]*)\]/);
  const machine = m ? (m[1].match(/'([^']+)'/g) || []).map((s) => s.slice(1, -1)) : [];
  check('MACHINE_PATHS is read from _middleware.js', machine.length >= 10, machine.length);
  for (const p of M.CALLED_PATHS) {
    const ok = machine.indexOf(p) >= 0 || (p === '/logo.jpg' && /path === '\/logo\.jpg' && \(request\.method === 'GET'/.test(mw));
    check(p + ' passes the gate from any country', ok);
  }
  check('the exempt check runs before the country is read', mw.indexOf('machineCall(request, path)) return next()') > 0
    && mw.indexOf('machineCall(request, path)) return next()') < mw.indexOf('request.cf.country'));
  const used = [...new Set((src.match(/'\/(?:api\/[\w-]+|logo\.jpg)'/g) || []).map((s) => s.slice(1, -1)))];
  check('every path literal in clock.js is in CALLED_PATHS', used.every((p) => M.CALLED_PATHS.indexOf(p) >= 0), used);
}

console.log('\n4. probeDue');
check('minute 0 is due', M.probeDue(at('2026-11-28T10:00:00Z')));
check('minute 15 is due', M.probeDue(at('2026-11-28T10:15:00Z')));
check('minute 45 with seconds is due', M.probeDue(at('2026-11-28T10:45:37Z')));
check('minute 5 is not', !M.probeDue(at('2026-11-28T10:05:00Z')));
check('minute 50 is not', !M.probeDue(at('2026-11-28T10:50:00Z')));
check('an invalid time is not', !M.probeDue(NaN));
{
  let n = 0;
  for (let m = 0; m < 60; m += 5) if (M.probeDue(at('2026-11-28T10:' + String(m).padStart(2, '0') + ':00Z'))) n++;
  check('4 probes an hour on the */5 tick (like site-up every 15)', n === 4, n);
}

console.log('\n5. jobsFor');
{
  const t0 = at('2026-11-28T10:00:00Z'), t5 = at('2026-11-28T10:05:00Z');
  check('*/5 at :00, nothing enabled: probe only', JSON.stringify(M.jobsFor(M.CRON_EVERY5, {}, t0)) === '["probe"]');
  check('*/5 at :05, nothing enabled: nothing', M.jobsFor(M.CRON_EVERY5, {}, t5).length === 0);
  check('*/5 with wa-watch on: probe and wa-watch', JSON.stringify(M.jobsFor(M.CRON_EVERY5, { CLOCK_JOBS: 'wa-watch' }, t0)) === '["probe","wa-watch"]');
  check('*/5 at :05 with wa-watch on: wa-watch only', JSON.stringify(M.jobsFor(M.CRON_EVERY5, { CLOCK_JOBS: 'wa-watch' }, t5)) === '["wa-watch"]');
  check('morning cron, off by default: nothing', M.jobsFor(M.CRON_MORNING, {}, t0).length === 0);
  check('morning cron with wa-morning on', JSON.stringify(M.jobsFor(M.CRON_MORNING, { CLOCK_JOBS: ' WA-Morning , wa-watch' }, t0)) === '["wa-morning"]');
  check('wa-morning on does not add it to */5', JSON.stringify(M.jobsFor(M.CRON_EVERY5, { CLOCK_JOBS: 'wa-morning' }, t0)) === '["probe"]');
  check('an unknown cron runs nothing', M.jobsFor('0 3 * * *', { CLOCK_JOBS: 'wa-watch,wa-morning' }, t0).length === 0);
  check('unknown job names are ignored', JSON.stringify(M.enabledJobs({ CLOCK_JOBS: 'probe,drop-db,wa-watch' })) === '["wa-watch"]');
}

console.log('\n6. stateOf');
{
  const F = { status: 403, body: 'forbidden' }, L = { status: 200, body: '' }, D = { status: 200, body: 'db ok' };
  check('all pass: up', M.stateOf({ fnGet: F, fnPost: F, logo: L, db: D }) === 'up');
  check('Functions down (502): site', M.stateOf({ fnGet: { status: 502, body: '' }, fnPost: F, logo: L, db: D }) === 'site');
  check('no answer at all: site', M.stateOf({ fnGet: null, fnPost: null, logo: null }) === 'site');
  check('webhook takes an unsigned POST (200): site', M.stateOf({ fnGet: F, fnPost: { status: 200, body: 'ok' }, logo: L, db: D }) === 'site');
  check('403 with another body (the country page): site', M.stateOf({ fnGet: { status: 403, body: '<html>blocked</html>' }, fnPost: F, logo: L, db: D }) === 'site');
  check('static files down: site', M.stateOf({ fnGet: F, fnPost: F, logo: { status: 404, body: '' }, db: D }) === 'site');
  check('db fail: db', M.stateOf({ fnGet: F, fnPost: F, logo: L, db: { status: 503, body: 'db fail' } }) === 'db');
  check('db not answering: db', M.stateOf({ fnGet: F, fnPost: F, logo: L, db: null }) === 'db');
  check('a body with a newline still counts', M.stateOf({ fnGet: { status: 403, body: 'forbidden\n' }, fnPost: F, logo: L, db: { status: 200, body: 'db ok\n' } }) === 'up');
  check('empty input: site', M.stateOf() === 'site');
}

console.log('\n7. decide');
{
  const top = at('2026-11-28T10:00:00Z'), mid = at('2026-11-28T10:30:00Z');
  const d = (p, c, t) => JSON.stringify(M.decide(p, c, t || mid));
  check('up -> up: nothing', d('up', 'up') === '{"send":null,"store":"up"}');
  check('up -> site: site_down', d('up', 'site') === '{"send":"site_down","store":"site"}');
  check('site -> site: nothing (once per fall)', d('site', 'site') === '{"send":null,"store":"site"}');
  check('site -> up: site_back', d('site', 'up') === '{"send":"site_back","store":"up"}');
  check('up -> db: db_down', d('up', 'db') === '{"send":"db_down","store":"db"}');
  check('db -> db: nothing', d('db', 'db') === '{"send":null,"store":"db"}');
  check('db -> up: db_back', d('db', 'up') === '{"send":"db_back","store":"up"}');
  check('site -> db: db_down (the site is back but the database is not)', d('site', 'db') === '{"send":"db_down","store":"db"}');
  check('db -> site: site_down', d('db', 'site') === '{"send":"site_down","store":"site"}');
  check('no memory, down on the first probe of the hour: send', d(null, 'site', top) === '{"send":"site_down","store":"site"}');
  check('no memory, down later in the hour: nothing (at most once an hour)', d(null, 'db', mid) === '{"send":null,"store":"db"}');
  check('no memory, up: never a "back"', d(null, 'up', top) === '{"send":null,"store":"up"}');
  check('a junk stored state counts as no memory', d('garbage', 'site', mid) === '{"send":null,"store":"site"}');
  check('an unknown current state sends nothing and keeps the old one', d('up', 'weird') === '{"send":null,"store":"up"}');
}

console.log('\n8. waBodies');
check('a key that is not one of the messages (constructor, __proto__) gives no body', ['constructor', '__proto__', 'toString', 'hasOwnProperty'].every((k) => M.waBodies(k, '972500000000').length === 0));
{
  const b = M.waBodies('site_down', '972500000000');
  check('two bodies: template, then text', b.length === 2 && b[0].type === 'template' && b[1].type === 'text');
  check('the template is safety_assistant_update in Hebrew', b[0].template.name === 'safety_assistant_update' && b[0].template.language.code === 'he');
  check('the template parameter is the message', b[0].template.components[0].parameters[0].text === M.MSG.site_down);
  check('the text body is the same message', b[1].text.body === M.MSG.site_down && b[1].to === '972500000000');
  check('an unknown kind: nothing', M.waBodies('nope', '972').length === 0);
  check('no number: nothing', M.waBodies('site_down', '').length === 0);
  check('every decide() send has a message', ['site_down', 'db_down', 'site_back', 'db_back', 'test'].every((k) => M.waBodies(k, '9').length === 2));
}

// ---------- the worker with fetch mocked ----------
function world(o) {
  o = o || {};
  const w = { calls: [], wa: [], kv: {} };
  let siteFails = o.siteFails || 0, dbFails = o.dbFails || 0;
  globalThis.fetch = async (url, init) => {
    const u = String(url), m = (init && init.method) || 'GET';
    w.calls.push(m + ' ' + u);
    if (w.calls.length > 50) throw new Error('Too many subrequests');
    if (u.startsWith('https://graph.facebook.com/')) {
      const body = JSON.parse(init.body); w.wa.push(body);
      if (o.waFail) return new Response('{}', { status: 500 });
      const ok = o.template === false ? body.type === 'text' : true;
      return new Response('{}', { status: ok ? 200 : 400 });
    }
    const p = new URL(u).pathname;
    if (p === '/api/wa-morning') { w.waMorning = { secret: init.headers['x-notify-secret'], body: init.body }; return new Response('{}', { status: 200 }); }
    if (p === '/api/db-health') {
      if (dbFails > 0) { dbFails--; return new Response('db fail', { status: 503 }); }
      return new Response('db ok', { status: 200 });
    }
    if (siteFails > 0) {
      if (p === '/logo.jpg') siteFails--;
      throw new Error('connection refused');
    }
    if (p === '/api/wa-hook') return new Response('forbidden', { status: 403 });
    if (p === '/logo.jpg') return new Response('x', { status: 200 });
    return new Response('?', { status: 404 });
  };
  w.KV = { get: async (k) => (k in w.kv ? w.kv[k] : null), put: async (k, v) => { w.kv[k] = v; } };
  return w;
}
const ENV = { RETRY_MS: '0', META_ACCESS_TOKEN: 't', WA_TO: '972500000000', MANUAL_KEY: 'mk' };

console.log('\n9a. refutation 28/11/2026: no alert is lost');
{
  const w = world({ siteFails: 99, waFail: true });
  const env = { ...ENV, CLOCK_STATE: w.KV };
  await M.runJobs(['probe'], env, at('2026-11-28T10:00:00Z'));
  check('a fall whose WhatsApp was refused keeps the old state in KV (up)', w.wa.length >= 1 && JSON.parse(w.kv.clock_state).state === 'up', w.kv);
  const w2 = world({ siteFails: 99 }); w2.kv = w.kv; env.CLOCK_STATE = w2.KV;
  await M.runJobs(['probe'], env, at('2026-11-28T10:15:00Z'));
  check('the next probe sends the fall again, and now the state moves to site', w2.wa.length === 1 && JSON.parse(w2.kv.clock_state).state === 'site', w2.kv);
  const w3 = world({ siteFails: 99 });
  const bad = { get: async () => { throw new Error('kv down'); }, put: async () => {} };
  await M.runJobs(['probe'], { ...ENV, CLOCK_STATE: bad }, at('2026-11-28T10:15:00Z'));
  check('a KV read that fails is "up": the first fall is sent mid-hour', w3.wa.length === 1, w3.wa.length);
  for (const v of ['{', 'null', '{"state":"zzz"}', '{"state":{"a":1}}', '[]']) {
    const w4 = world({ siteFails: 99 });
    await M.runJobs(['probe'], { ...ENV, CLOCK_STATE: { get: async () => v, put: async () => {} } }, at('2026-11-28T10:30:00Z'));
    check('a corrupt KV value ' + v + ' does not swallow the fall', w4.wa.length === 1, w4.wa.length);
  }
  // (C) fall delivered, then the site is back but get throws: KV stays site, and the next good read sends site_back
  const wc = world({ siteFails: 99 });
  const envC = { ...ENV, CLOCK_STATE: wc.KV };
  await M.runJobs(['probe'], envC, at('2026-11-28T11:00:00Z'));
  check('(C) the fall is delivered and KV is site', wc.wa.length === 1 && JSON.parse(wc.kv.clock_state).state === 'site', wc.kv);
  const wc2 = world(); wc2.kv = wc.kv; let putsC = 0;
  envC.CLOCK_STATE = { get: async () => { throw new Error('kv down'); }, put: async (k, v) => { putsC++; wc2.kv[k] = v; } };
  await M.runJobs(['probe'], envC, at('2026-11-28T11:15:00Z'));
  check('(C) site back but the KV read failed: nothing written, KV still site', putsC === 0 && JSON.parse(wc2.kv.clock_state).state === 'site', wc2.kv);
  const wc3 = world(); wc3.kv = wc2.kv; envC.CLOCK_STATE = wc3.KV;
  const rc = await M.runJobs(['probe'], envC, at('2026-11-28T11:30:00Z'));
  check('(C) the next probe with a good KV sends site_back', rc.results[0].send === 'site_back' && wc3.wa.length === 1 && JSON.parse(wc3.kv.clock_state).state === 'up', rc.results[0]);
  // (E) fall delivered, then get fails and Meta fails too: KV stays site
  const we = world({ siteFails: 99 });
  const envE = { ...ENV, CLOCK_STATE: we.KV };
  await M.runJobs(['probe'], envE, at('2026-11-28T12:00:00Z'));
  const we2 = world({ siteFails: 99, waFail: true }); we2.kv = we.kv; let putsE = 0;
  envE.CLOCK_STATE = { get: async () => { throw new Error('kv down'); }, put: async (k, v) => { putsE++; we2.kv[k] = v; } };
  await M.runJobs(['probe'], envE, at('2026-11-28T12:15:00Z'));
  check('(E) KV read failed and WhatsApp failed: KV stays site', putsE === 0 && we2.wa.length >= 1 && JSON.parse(we2.kv.clock_state).state === 'site', we2.kv);
  // a corrupt value is still overwritten (not a failed read)
  const wk = world({ siteFails: 99 }); wk.kv.clock_state = '{';
  await M.runJobs(['probe'], { ...ENV, CLOCK_STATE: wk.KV }, at('2026-11-28T12:30:00Z'));
  check('a corrupt KV value is replaced by the new state (site)', JSON.parse(wk.kv.clock_state).state === 'site', wk.kv);
}
console.log('\n9. a full run');
{
  const w = world();
  const r = await M.runJobs(['probe'], ENV, at('2026-11-28T10:00:00Z'));
  check('site up: state up, nothing sent', r.results[0].state === 'up' && r.results[0].send === null && w.wa.length === 0, r.results[0]);
  check('up = 4 requests (wa-hook GET, POST, logo, db-health)', r.subrequests === 4 && w.calls.length === 4, w.calls);
  check('the POST to the webhook carries no signature', !w.calls.some((c) => /x-hub/.test(c)));
}
{
  const w = world({ siteFails: 99 });
  const r = await M.runJobs(['probe'], { ...ENV, CLOCK_STATE: null }, at('2026-11-28T10:00:00Z'));
  check('site down, no KV, top of the hour: site_down sent as template', r.results[0].send === 'site_down' && w.wa.length === 1 && w.wa[0].type === 'template', r.results[0]);
  check('site down = 9 probe requests + 1 WhatsApp, no db-health', r.subrequests === 10 && !w.calls.some((c) => c.includes('db-health')), w.calls.length);
}
{
  const w = world({ siteFails: 2, dbFails: 99, template: false });
  const r = await M.runJobs(['probe'], { ...ENV, CLOCK_JOBS: 'wa-watch', TRUSTEE_NOTIFY_SECRET: 's' }, at('2026-11-28T10:00:00Z'));
  const r2 = await M.runJobs(['wa-watch'], { ...ENV, CLOCK_JOBS: 'wa-watch', TRUSTEE_NOTIFY_SECRET: 's' }, at('2026-11-28T10:00:00Z'));
  check('worst case: site back on the 3rd try, db fails, template refused -> text', r.results[0].state === 'db' && r.results[0].wa.sent && r.results[0].wa.as === 'text', r.results[0]);
  check('worst case is 14 requests, under the cap of 50 even with wa-watch (' + (r.subrequests + r2.subrequests) + ')', r.subrequests === 14 && r.subrequests + r2.subrequests <= 50, r.subrequests);
}
{
  const w = world({ siteFails: 99 });
  const env = { ...ENV, CLOCK_STATE: null };
  env.CLOCK_STATE = w.KV;
  await M.runJobs(['probe'], env, at('2026-11-28T10:30:00Z'));
  check('with KV: the first fall sends even mid-hour', w.wa.length === 1 && JSON.parse(w.kv.clock_state).state === 'site', w.kv);
  const w2 = world({ siteFails: 99 }); w2.kv = w.kv; env.CLOCK_STATE = w2.KV;
  await M.runJobs(['probe'], env, at('2026-11-28T10:45:00Z'));
  check('with KV: still down, nothing more', w2.wa.length === 0);
  const w3 = world(); w3.kv = w.kv; env.CLOCK_STATE = w3.KV;
  const r = await M.runJobs(['probe'], env, at('2026-11-28T11:00:00Z'));
  check('with KV: back up sends site_back', r.results[0].send === 'site_back' && w3.wa.length === 1 && w3.wa[0].template.components[0].parameters[0].text === M.MSG.site_back);
}
{
  const w = world({ siteFails: 99 });
  const r = await M.runJobs(['probe'], { RETRY_MS: '0' }, at('2026-11-28T10:00:00Z'));
  check('no WhatsApp secrets: the run still ends, nothing sent to Meta', r.results[0].wa && r.results[0].wa.sent === false && w.wa.length === 0, r.results[0].wa);
}
{
  const w = world();
  await M.runJobs(['wa-watch'], { ...ENV, TRUSTEE_NOTIFY_SECRET: 's' }, Date.now());
  check('wa-watch posts {"watch":true} with x-notify-secret', w.waMorning && w.waMorning.secret === 's' && w.waMorning.body === '{"watch":true}', w.waMorning);
  const w2 = world();
  await M.runJobs(['wa-morning'], { ...ENV, TRUSTEE_NOTIFY_SECRET: 's' }, Date.now());
  check('wa-morning posts {}', w2.waMorning && w2.waMorning.body === '{}');
  const w3 = world();
  const r = await M.runJobs(['wa-watch'], ENV, Date.now());
  check('no TRUSTEE_NOTIFY_SECRET: no call at all', !w3.waMorning && r.results[0].ok === false && w3.calls.length === 0);
}

console.log('\n10. scheduled()');
{
  const w = world();
  const waits = [];
  await W.scheduled({ cron: M.CRON_EVERY5, scheduledTime: at('2026-11-28T10:05:00Z') }, ENV, { waitUntil: (p) => waits.push(p) });
  await Promise.all(waits);
  check('*/5 at :05 with nothing enabled: no request', w.calls.length === 0);
  await W.scheduled({ cron: M.CRON_EVERY5, scheduledTime: at('2026-11-28T10:15:00Z') }, ENV, { waitUntil: (p) => waits.push(p) });
  await Promise.all(waits);
  check('*/5 at :15: the probe ran', w.calls.length === 4, w.calls);
  const w2 = world();
  await W.scheduled({ cron: M.CRON_MORNING, scheduledTime: at('2026-11-29T04:47:00Z') }, ENV, {});
  check('morning cron with wa-morning off: no request (pg_cron keeps it)', w2.calls.length === 0);
}

console.log('\n11. HTTP');
{
  const w = world();
  const h = await W.fetch(new Request('https://c/health'), { ...ENV, TRUSTEE_NOTIFY_SECRET: 'supersecret' });
  const hb = await h.text();
  check('/health answers 200 with booleans', h.status === 200 && JSON.parse(hb).whatsapp === true && JSON.parse(hb).kv === false);
  check('/health shows no secret value', !hb.includes('mk') && !hb.includes('972500000000') && !hb.includes('supersecret'));
  const bad = await W.fetch(new Request('https://c/run', { method: 'POST', headers: { 'x-trigger': 'wrong' } }), ENV);
  check('/run with a wrong key: 403', bad.status === 403);
  const q = await W.fetch(new Request('https://c/run?key=mk', { method: 'POST' }), ENV);
  check('/run with the key in the query string: 403', q.status === 403);
  const nokey = await W.fetch(new Request('https://c/run', { method: 'POST', headers: { 'x-trigger': '' } }), { ...ENV, MANUAL_KEY: '' });
  check('/run when MANUAL_KEY is not set: 403 even with an empty header', nokey.status === 403);
  const g = await W.fetch(new Request('https://c/run', { headers: { 'x-trigger': 'mk' } }), ENV);
  check('/run with GET: 405', g.status === 405);
  check('no request went out for the refused calls', w.calls.length === 0, w.calls);
  const ok = await W.fetch(new Request('https://c/run', { method: 'POST', headers: { 'x-trigger': 'mk' } }), ENV);
  const ob = await ok.json();
  check('/run with the right key runs the probe', ok.status === 200 && ob.results[0].job === 'probe' && ob.results[0].state === 'up', ob);
  const off = await W.fetch(new Request('https://c/run?job=wa-morning', { method: 'POST', headers: { 'x-trigger': 'mk' } }), ENV);
  check('/run?job=wa-morning while it is off: 400', off.status === 400);
  const w2 = world();
  const t = await W.fetch(new Request('https://c/run?job=test', { method: 'POST', headers: { 'x-trigger': 'mk' } }), ENV);
  check('/run?job=test sends the test line', t.status === 200 && w2.wa.length === 1 && w2.wa[0].template.components[0].parameters[0].text === M.MSG.test);
  const nf = await W.fetch(new Request('https://c/other'), ENV);
  check('any other path: 404', nf.status === 404);
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
