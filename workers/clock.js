// Cloudflare Worker "tapugan-clock": the site watch from inside Cloudflare (28/11/2026).
//
// Why (STATUS "Cloudflare improvements" (2), project-files/cloudflare-review-27-11-2026.md): .github/workflows/
// site-up.yml checks the site from GitHub every 15 minutes. This Worker runs the same checks from Cloudflare's
// own cron, so a GitHub outage or a disabled schedule does not leave the site unwatched. The plan is to run both
// side by side for about a week and only then (with Michael's approval) drop the schedule from site-up.yml.
//
// The country gate (functions/_middleware.js): machineCall() and mailLogo() run BEFORE request.cf.country is
// read, so a path in MACHINE_PATHS (any method) and GET /logo.jpg pass from any country. A Worker calling another
// zone arrives with CF-Connecting-IP 2a06:98c0:3600::103, whose country was not checked; so this Worker calls ONLY
// those exempt paths (CALLED_PATHS). tests/harness/clock-worker-test.mjs reads MACHINE_PATHS from the middleware
// and fails when a called path leaves the list. Every function still checks its own secret: wa-hook Meta's
// signature, wa-morning x-notify-secret, db-health nothing (it answers "db ok" or "db fail" only).
//
// Jobs (jobsFor):
//   "*/5 * * * *"         probe every 15 minutes (probeDue), like site-up.yml.
//                          wa-watch (POST /api/wa-morning {"watch":true}) only when CLOCK_JOBS names it.
//   "47 4,5 * * SUN-THU"   wa-morning (POST /api/wa-morning {}) only when CLOCK_JOBS names it.
//   Both wa-* jobs are OFF by default: pg_cron runs them today (migrations/2026-10-20_wa_watch_cron.sql,
//   2026-10-20_wa_morning_cron.sql), and DECISIONS 27/11/2026 ("idea 48 back to deferred, pg_cron stays") keeps
//   them there. Moving them is Michael's decision; never turn both on together with pg_cron (double messages).
//
// The probe (same as site-up.yml): GET /api/wa-hook without Meta's token = 403 "forbidden" (the Functions run),
// POST /api/wa-hook without a signature = 403 "forbidden" (the webhook refuses an unsigned call), GET /logo.jpg =
// 200 (the static files). When those pass, GET /api/db-health = 200 "db ok". Three tries each, RETRY_MS apart.
// Worst case 14 outgoing requests per run (9 site + 3 db would need the site to pass on the third try: 9 + 3 + 2
// WhatsApp), well under the Free plan's 50.
//
// WhatsApp (waBodies): once when the site or the database goes down and once when it is back, the approved
// template safety_assistant_update first and a plain text if Meta refuses it, the same wording as site-up.yml with
// "check from Cloudflare". Without the KV binding CLOCK_STATE there is no memory between runs: no "back"
// message, and "down" is sent only on the first probe of each hour (at most once an hour). A KV read that throws
// counts as "up" for that run but writes nothing, so the stored state (and the coming "back") survives.
//
// HTTP: GET /health = what is configured (booleans only, no values). POST /run = one run now, needs the header
// x-trigger equal to MANUAL_KEY (never a query string: it would land in logs). /run?job=test sends one test
// WhatsApp line; /run?job=wa-watch or wa-morning only when CLOCK_JOBS names it.
//
// Secrets (set in Cloudflare, never in this file): META_ACCESS_TOKEN, WA_TO (only Michael has the values),
// MANUAL_KEY (random), TRUSTEE_NOTIFY_SECRET (only when a wa-* job is on). Plain vars: CLOCK_JOBS, SITE,
// META_PHONE_NUMBER_ID, RETRY_MS. Hebrew text is \uXXXX only.

export const SITE = 'https://tapugan-safety.pages.dev';
export const PHONE_ID = '1304479066092850';
export const TEMPLATE = 'safety_assistant_update';
export const CRON_EVERY5 = '*/5 * * * *';
export const CRON_MORNING = '47 4,5 * * SUN-THU';
export const OPTIONAL_JOBS = ['wa-watch', 'wa-morning'];
export const CALLED_PATHS = ['/api/wa-hook', '/logo.jpg', '/api/db-health', '/api/wa-morning'];
export const TRIES = 3;
export const STATE_KEY = 'clock_state';

export const MSG = {
  site_down: '\u05d4\u05d0\u05ea\u05e8 tapugan-safety.pages.dev \u05dc\u05d0 \u05e2\u05d5\u05e0\u05d4 \u05db\u05d1\u05e8 \u05db\u05de\u05d4 \u05d3\u05e7\u05d5\u05ea (\u05d1\u05d3\u05d9\u05e7\u05d4 \u05de-Cloudflare). \u05d4\u05d5\u05d5\u05d0\u05d8\u05e1\u05d0\u05e4, \u05d4\u05d7\u05ea\u05d9\u05de\u05d4 \u05d5\u05d4\u05e2\u05d5\u05d6\u05e8 \u05dc\u05d0 \u05d9\u05e2\u05d1\u05d3\u05d5 \u05e2\u05d3 \u05e9\u05d9\u05d7\u05d6\u05d5\u05e8. \u05d4\u05e0\u05ea\u05d5\u05e0\u05d9\u05dd \u05e9\u05de\u05d5\u05e8\u05d9\u05dd \u05d1-Supabase.',
  db_down: '\u05d4\u05e9\u05e8\u05ea \u05dc\u05d0 \u05de\u05e6\u05dc\u05d9\u05d7 \u05dc\u05d4\u05d2\u05d9\u05e2 \u05dc\u05de\u05e1\u05d3 \u05d4\u05e0\u05ea\u05d5\u05e0\u05d9\u05dd \u05db\u05d1\u05e8 \u05db\u05de\u05d4 \u05d3\u05e7\u05d5\u05ea (\u05d1\u05d3\u05d9\u05e7\u05d4 \u05de-Cloudflare). \u05d4\u05e2\u05d5\u05d6\u05e8 \u05d1\u05d5\u05d5\u05d0\u05d8\u05e1\u05d0\u05e4 \u05dc\u05d0 \u05d9\u05e2\u05e0\u05d4, \u05d5\u05d4\u05d5\u05d3\u05e2\u05d5\u05ea \u05d0\u05dc\u05d9\u05d5 \u05dc\u05d0 \u05d9\u05d9\u05e9\u05de\u05e8\u05d5. \u05d4\u05e1\u05d9\u05d1\u05d4 \u05d4\u05e9\u05db\u05d9\u05d7\u05d4: \u05de\u05e4\u05ea\u05d7 \u05d4\u05de\u05e1\u05d3 \u05d1-Cloudflare (SUPABASE_SERVICE_ROLE_KEY \u05d1-Production).',
  site_back: '\u05d4\u05d0\u05ea\u05e8 tapugan-safety.pages.dev \u05d7\u05d6\u05e8 \u05dc\u05e2\u05e0\u05d5\u05ea (\u05d1\u05d3\u05d9\u05e7\u05d4 \u05de-Cloudflare).',
  db_back: '\u05d4\u05e9\u05e8\u05ea \u05e9\u05d5\u05d1 \u05de\u05d2\u05d9\u05e2 \u05dc\u05de\u05e1\u05d3 \u05d4\u05e0\u05ea\u05d5\u05e0\u05d9\u05dd, \u05d5\u05d4\u05e2\u05d5\u05d6\u05e8 \u05d1\u05d5\u05d5\u05d0\u05d8\u05e1\u05d0\u05e4 \u05d7\u05d6\u05e8 \u05dc\u05e2\u05d1\u05d5\u05d3 (\u05d1\u05d3\u05d9\u05e7\u05d4 \u05de-Cloudflare). \u05d4\u05d5\u05d3\u05e2\u05d5\u05ea \u05e9\u05e9\u05dc\u05d7\u05ea \u05dc\u05d5 \u05d1\u05d6\u05de\u05df \u05d4\u05ea\u05e7\u05dc\u05d4 \u05dc\u05d0 \u05e0\u05e9\u05de\u05e8\u05d5: \u05dc\u05e9\u05dc\u05d5\u05d7 \u05e9\u05d5\u05d1.',
  test: '\u05d1\u05d3\u05d9\u05e7\u05d4: \u05d4\u05d4\u05ea\u05e8\u05d0\u05d4 \u05de-Cloudflare \u05db\u05e9\u05d4\u05d0\u05ea\u05e8 \u05dc\u05d0 \u05e2\u05d5\u05e0\u05d4 \u05de\u05d7\u05d5\u05d1\u05e8\u05ea \u05dc\u05d5\u05d5\u05d0\u05d8\u05e1\u05d0\u05e4 \u05e9\u05dc\u05da. \u05d0\u05d9\u05df \u05e6\u05d5\u05e8\u05da \u05dc\u05e2\u05e0\u05d5\u05ea.',
};

// ---------- pure functions (tested in tests/harness/clock-worker-test.mjs) ----------

// The optional jobs CLOCK_JOBS turns on ("wa-watch,wa-morning"); unknown names are ignored.
export function enabledJobs(env) {
  const raw = String((env && env.CLOCK_JOBS) || '').toLowerCase().split(/[\s,;]+/);
  return OPTIONAL_JOBS.filter((j) => raw.indexOf(j) >= 0);
}

// The probe runs on the */5 tick whose minute is 0, 15, 30 or 45 (any second inside that minute).
export function probeDue(ms) {
  const d = new Date(ms);
  if (isNaN(d.getTime())) return false;
  return d.getUTCMinutes() % 15 === 0;
}

// Which jobs one cron tick runs. An unknown cron runs nothing.
export function jobsFor(cron, env, ms) {
  const on = enabledJobs(env);
  if (cron === CRON_EVERY5) {
    const out = [];
    if (probeDue(ms)) out.push('probe');
    if (on.indexOf('wa-watch') >= 0) out.push('wa-watch');
    return out;
  }
  if (cron === CRON_MORNING) return on.indexOf('wa-morning') >= 0 ? ['wa-morning'] : [];
  return [];
}

// One try of the probe -> 'up' | 'site' (the site does not answer) | 'db' (the server cannot reach the database).
// r = { fnGet, fnPost, logo, db } each { status, body } or null (no answer); db is null when it was not asked.
export function stateOf(r) {
  r = r || {};
  const is = (x, st, body) => !!x && x.status === st && (body === undefined || String(x.body || '').trim() === body);
  const site = is(r.fnGet, 403, 'forbidden') && is(r.fnPost, 403, 'forbidden') && is(r.logo, 200);
  if (!site) return 'site';
  return is(r.db, 200, 'db ok') ? 'up' : 'db';
}

// What to send, from the previous state (null = unknown, no KV) and the current one.
// Returns { send: one of MSG's keys or null, store: the state to keep }.
export function decide(prev, cur, ms) {
  const known = prev === 'up' || prev === 'site' || prev === 'db';
  if (cur !== 'up' && cur !== 'site' && cur !== 'db') return { send: null, store: known ? prev : null };
  if (!known) {
    // no memory: a "down" only on the first probe of the hour, never a "back"
    if (cur === 'up') return { send: null, store: cur };
    return { send: new Date(ms).getUTCMinutes() < 15 ? cur + '_down' : null, store: cur };
  }
  if (cur === prev) return { send: null, store: cur };
  if (cur === 'site') return { send: 'site_down', store: cur };
  if (cur === 'db') return { send: 'db_down', store: cur };
  return { send: prev + '_back', store: cur };
}

// The two WhatsApp bodies for one message: the approved template, then a plain text if Meta refuses it.
export function waBodies(kind, to) {
  const text = Object.hasOwn(MSG, kind) ? MSG[kind] : '';
  if (!text || !to) return [];
  return [
    { messaging_product: 'whatsapp', to: String(to), type: 'template',
      template: { name: TEMPLATE, language: { code: 'he' }, components: [{ type: 'body', parameters: [{ type: 'text', text }] }] } },
    { messaging_product: 'whatsapp', to: String(to), type: 'text', text: { body: text } },
  ];
}

// ---------- the runs ----------

function siteOf(env) { return String((env && env.SITE) || SITE).replace(/\/+$/, ''); }
function retryMs(env) { const n = parseInt(env && env.RETRY_MS, 10); return isNaN(n) || n < 0 ? 30000 : Math.min(n, 60000); }
const wait = (ms) => (ms > 0 ? new Promise((r) => setTimeout(r, ms)) : Promise.resolve());

async function call(url, init, counter) {
  counter.n++;
  try {
    const sig = typeof AbortSignal !== 'undefined' && AbortSignal.timeout ? AbortSignal.timeout(20000) : undefined;
    const res = await fetch(url, Object.assign({ signal: sig, redirect: 'manual' }, init || {}));
    let body = '';
    try { body = (await res.text()).slice(0, 200); } catch (e) { /* empty body */ }
    return { status: res.status, body };
  } catch (e) {
    return null;
  }
}

export async function probe(env, counter) {
  const site = siteOf(env), gap = retryMs(env);
  let r = {}, st = 'site';
  for (let i = 0; i < TRIES; i++) {
    if (i) await wait(gap);
    r = {
      fnGet: await call(site + '/api/wa-hook', { method: 'GET' }, counter),
      fnPost: await call(site + '/api/wa-hook', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }, counter),
      logo: await call(site + '/logo.jpg', { method: 'GET' }, counter),
    };
    st = stateOf(Object.assign({}, r, { db: { status: 200, body: 'db ok' } }));
    if (st === 'up') break;
  }
  if (st !== 'up') return { state: 'site', detail: r };
  for (let i = 0; i < TRIES; i++) {
    if (i) await wait(gap);
    r.db = await call(site + '/api/db-health', { method: 'GET' }, counter);
    st = stateOf(r);
    if (st === 'up') break;
  }
  return { state: st, detail: r };
}

export async function sendWa(env, kind, counter) {
  const bodies = waBodies(kind, env.WA_TO);
  if (!bodies.length || !env.META_ACCESS_TOKEN) return { sent: false, why: 'no WhatsApp secrets' };
  const url = 'https://graph.facebook.com/v25.0/' + (env.META_PHONE_NUMBER_ID || PHONE_ID) + '/messages';
  const head = { Authorization: 'Bearer ' + env.META_ACCESS_TOKEN, 'Content-Type': 'application/json' };
  const codes = [];
  for (const b of bodies) {
    const r = await call(url, { method: 'POST', headers: head, body: JSON.stringify(b) }, counter);
    codes.push(r ? r.status : 0);
    if (r && r.status === 200) return { sent: true, as: b.type, codes };
  }
  return { sent: false, why: 'WhatsApp refused', codes };
}

async function kvGet(env) {
  if (!env.CLOCK_STATE) return { state: null, failed: false };
  // an empty KV is a fresh start: counted as "up", so the first fall is sent at once
  // a failed read or a corrupt value is also "up" (independent refutation 28/11/2026: "no memory" swallowed the first fall alert; a repeat alert beats a lost one)
  // failed = the read itself threw: runProbe then writes nothing (refutation 28/11/2026: "up" overwrote "site" and the "back" message was lost)
  let v;
  try { v = await env.CLOCK_STATE.get(STATE_KEY); } catch (e) { return { state: 'up', failed: true }; }
  let st = 'up';
  try { st = v ? JSON.parse(v).state : 'up'; } catch (e) { st = 'up'; }
  return { state: st === 'up' || st === 'site' || st === 'db' ? st : 'up', failed: false };
}
async function kvPut(env, state, ms) {
  if (!env.CLOCK_STATE || !state) return;
  try { await env.CLOCK_STATE.put(STATE_KEY, JSON.stringify({ state, at: new Date(ms).toISOString() })); } catch (e) { /* next run retries */ }
}

export async function runProbe(env, ms, counter) {
  const p = await probe(env, counter);
  const kv = await kvGet(env);
  const prev = kv.state;
  const d = decide(prev, p.state, ms);
  const wa = d.send ? await sendWa(env, d.send, counter) : null;
  // a message that was not delivered keeps the old state, so the next probe sends it again (refutation 28/11/2026: the state moved on and the alert was lost)
  // a failed KV read writes nothing: the stored state is unknown here and must not be overwritten
  if (!kv.failed) await kvPut(env, d.send && wa && !wa.sent && env.CLOCK_STATE ? prev : d.store, ms);
  return { job: 'probe', state: p.state, prev, send: d.send, wa, detail: p.detail };
}

export async function runWa(env, job, counter) {
  if (!env.TRUSTEE_NOTIFY_SECRET) return { job, ok: false, why: 'no TRUSTEE_NOTIFY_SECRET' };
  const r = await call(siteOf(env) + '/api/wa-morning', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-notify-secret': env.TRUSTEE_NOTIFY_SECRET },
    body: job === 'wa-watch' ? '{"watch":true}' : '{}',
  }, counter);
  return { job, ok: !!r && r.status === 200, status: r ? r.status : 0 };
}

export async function runJobs(jobs, env, ms) {
  const counter = { n: 0 };
  const out = [];
  for (const j of jobs) {
    if (j === 'probe') out.push(await runProbe(env, ms, counter));
    else if (j === 'test') out.push({ job: 'test', wa: await sendWa(env, 'test', counter) });
    else if (OPTIONAL_JOBS.indexOf(j) >= 0) out.push(await runWa(env, j, counter));
  }
  return { results: out, subrequests: counter.n };
}

async function sameSecret(a, b) {
  if (!a || !b) return false;
  const enc = new TextEncoder();
  const [x, y] = await Promise.all([crypto.subtle.digest('SHA-256', enc.encode(String(a))), crypto.subtle.digest('SHA-256', enc.encode(String(b)))]);
  const u = new Uint8Array(x), v = new Uint8Array(y);
  let diff = 0;
  for (let i = 0; i < u.length; i++) diff |= u[i] ^ v[i];
  return diff === 0;
}

const json = (o, status) => new Response(JSON.stringify(o), { status: status || 200, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

export default {
  async scheduled(event, env, ctx) {
    const ms = event.scheduledTime || Date.now();
    const jobs = jobsFor(event.cron, env, ms);
    if (!jobs.length) return;
    const p = runJobs(jobs, env, ms).then((r) => console.log(JSON.stringify(r.results.map((x) => ({ job: x.job, state: x.state, send: x.send, ok: x.ok }))) + ' subrequests=' + r.subrequests));
    if (ctx && ctx.waitUntil) ctx.waitUntil(p); else await p;
  },

  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/health' && request.method === 'GET') {
      return json({ ok: true, worker: 'tapugan-clock', crons: [CRON_EVERY5, CRON_MORNING], jobs: enabledJobs(env),
        kv: !!env.CLOCK_STATE, whatsapp: !!(env.META_ACCESS_TOKEN && env.WA_TO), manual: !!env.MANUAL_KEY,
        notify_secret: !!env.TRUSTEE_NOTIFY_SECRET });
    }
    if (url.pathname === '/run') {
      if (request.method !== 'POST') return json({ error: 'method not allowed' }, 405);
      if (!env.MANUAL_KEY || !(await sameSecret(request.headers.get('x-trigger'), env.MANUAL_KEY))) return json({ error: 'forbidden' }, 403);
      const job = url.searchParams.get('job') || 'probe';
      if (job !== 'probe' && job !== 'test' && enabledJobs(env).indexOf(job) < 0) return json({ error: 'job not enabled' }, 400);
      return json(await runJobs([job], env, Date.now()));
    }
    return new Response('tapugan-clock: GET /health, POST /run with the x-trigger header', { status: 404 });
  },
};
