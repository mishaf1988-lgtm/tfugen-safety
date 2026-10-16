// Every outbound call from a server function has a time limit (16/10/2026, Michael in the
// questionnaire: "בצע: מגבלת זמן לקריאות השרת"; BACKLOG 14.5). A fetch with no signal waits
// as long as the platform lets it, so one dead upstream leaves the phone spinning.
// Done in three stages the same day (17 + 31 + 59 calls). This file holds the line:
//   * no call in functions/api without a signal, unless the line above says why (// no-timeout:);
//   * close-hazard, the page a worker opens from the mail, answers a timed-out write with
//     a page that sends them back to the link, not a crash.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
let pass = 0, fail = 0;
const check = (l, c, d) => { if (c) { pass++; console.log('  ✓ ' + l); } else { fail++; console.log('  ✗ ' + l + (d !== undefined ? '  -> ' + JSON.stringify(d) : '')); } };

// fetch( ... ) calls in a source, nested parentheses included. Calls the function makes to its
// own site in waitUntil (new URL('/api/...')) are other runs, not calls to wait on.
const callsOf = (s) => {
  const out = []; let i = -1;
  while ((i = s.indexOf('fetch(', i + 1)) >= 0) {
    if (/[A-Za-z_.]$/.test(s[i - 1] || '')) continue;
    let depth = 0, j = i + 5;
    for (; j < s.length; j++) { if (s[j] === '(') depth++; else if (s[j] === ')') { depth--; if (!depth) break; } }
    out.push(s.substring(i, j + 1));
  }
  return out.filter((c) => !/new URL\('\/api\//.test(c));
};
// A file may shadow fetch with one that adds a limit to every call (talk.js, 15/10/2026); then
// every call in it is covered.
// A file may shadow fetch with one that adds a limit to every call (talk.js, 15/10/2026); then
// every call in it is covered.
const WRAP = /^const fetch = \(u, o\) => globalThis\.fetch\(u, o && o\.signal \? o : \{ \.\.\.\(o \|\| \{\}\), signal: AbortSignal\.timeout\(\w+\) \}\);$/m;
// A call left without a limit on purpose says why on the line above: `// no-timeout: <reason>`.
// Today: the streamed AI answer in claude.js (a long answer runs past any fixed limit).
const bareIn = (f) => {
  const s = fs.readFileSync(path.join(ROOT, 'functions/api', f), 'utf8');
  if (WRAP.test(s)) return [];
  return callsOf(s).filter((c) => {
    if (/\bsignal\s*:/.test(c)) return false;
    const at = s.indexOf(c), lineStart = s.lastIndexOf('\n', at), prev = s.substring(s.lastIndexOf('\n', lineStart - 1) + 1, lineStart);
    return !/\/\/ no-timeout: \S/.test(prev);
  });
};

console.log('\n1. every outbound call in functions/api has a time limit (stages 1-3 done, 16/10/2026)');
const files = fs.readdirSync(path.join(ROOT, 'functions/api')).filter((f) => f.endsWith('.js'));
const bare = [];
for (const f of files) for (const c of bareIn(f)) bare.push(f + ': ' + c.substring(0, 100));
check(files.length + ' files, 0 calls without signal: tmo(...) (or a "// no-timeout:" reason)', bare.length === 0, bare);
const marked = files.reduce((n, f) => n + (fs.readFileSync(path.join(ROOT, 'functions/api', f), 'utf8').match(/\/\/ no-timeout: \S/g) || []).length, 0);
check('exemptions stay rare: at most 1 marked call (the streamed AI answer)', marked <= 1, marked);
const backup = fs.readFileSync(path.join(ROOT, 'functions/api/backup-od.js'), 'utf8');
check('backup-od: its counting wrapper gives every call the file limit', /return fetch\(url, init && init\.signal \? init : \{ \.\.\.\(init \|\| \{\}\), signal: tmo\(FILE_MS\) \}\);/.test(backup));

console.log('\n3. the limits themselves');
const shared = fs.readFileSync(path.join(ROOT, 'functions/_shared.js'), 'utf8');
check('_shared.js: database 10s, Graph 20s, a file 60s, and tmo()', /export const SB_TIMEOUT_MS = 10000;/.test(shared) && /export const GRAPH_TIMEOUT_MS = 20000, FILE_TIMEOUT_MS = 60000;/.test(shared) && /export const tmo = \(ms\) => AbortSignal\.timeout\(ms\);/.test(shared));
const ch = fs.readFileSync(path.join(ROOT, 'functions/api/close-hazard.js'), 'utf8');
check('close-hazard: the photo upload gets the file limit, not the database one', /storage\/v1\/object\/' \+ BUCKET[^\n]*signal: tmo\(FILE_MS\)/.test(ch));

console.log('\n4. close-hazard: a write that never answers ends in a page, not a crash');
{
  const { onRequest } = await import('./_build/close-hazard.mjs');
  const { makeCloseToken } = await import('./_build/_closelink.mjs');
  const SB = 'https://znhjtpcltrxxyfjczgvw.supabase.co';
  const ENV = { SUPABASE_SERVICE_ROLE_KEY: 'srv', TRUSTEE_NOTIFY_SECRET: 'nsec' };
  const H1 = { id: 'th-mumiomsmjz43', n: 51, d: '2026-09-29', tour_no: 3, dept: 'x', loc: 'y', descr: 'z', s: 'open' };
  // Each limit fires after 30ms here instead of seconds; the real values are checked in 3.
  const realTimeout = AbortSignal.timeout, asked = [];
  AbortSignal.timeout = (ms) => { asked.push(ms); return realTimeout.call(AbortSignal, 30); };
  let patched = 0, withSignal = 0;
  globalThis.fetch = async (url, init) => {
    const u = String(url), m = (init && init.method) || 'GET';
    if (u.startsWith(SB + '/rest/v1/tour_hazards') && m === 'GET') return new Response(JSON.stringify([H1]), { status: 200 });
    if (u.startsWith(SB + '/rest/v1/tour_hazards') && m === 'PATCH') {
      patched++; if (init.signal) withSignal++;
      // the database never answers: only the signal can end this
      return new Promise((res, rej) => {
        // no signal: stand in for the platform cut after 1s, so the run fails fast, not after 300s
        if (!init.signal) { setTimeout(() => res(new Response('[]', { status: 200 })), 1000); return; }
        init.signal.addEventListener('abort', () => rej(init.signal.reason || new Error('aborted')));
      });
    }
    return new Response('[]', { status: 200 });
  };
  const tok = await makeCloseToken(ENV, H1.id);
  const fd = new FormData(); fd.append('k', tok); fd.append('who', 'Test');
  // Node runs AbortSignal.timeout on a timer that does not hold the process open; this one does.
  const keep = setInterval(() => {}, 20);
  const t0 = Date.now();
  const r = await onRequest({ request: new Request('https://tapugan-safety.pages.dev/api/close-hazard', { method: 'POST', body: fd }), env: ENV });
  const html = await r.text();
  AbortSignal.timeout = realTimeout; clearInterval(keep);
  check('the PATCH was sent, with a signal', patched === 1 && withSignal === 1, { patched, withSignal, asked });
  check('answers 504 within the limit, not after the platform cut', r.status === 504 && Date.now() - t0 < 2000, { status: r.status, ms: Date.now() - t0 });
  check('the page says it may be saved and to open the link again', html.includes('פתח שוב את הקישור'), html.slice(0, 300));
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
