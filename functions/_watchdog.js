// Sync watchdog (upgrade review 12, 30/09/2026). Michael: "I need some
// mechanism that makes sure the sync between the files, the app and the deck
// always happens", with the alert in his organisation mailbox.
//
// Every 15-minute tick (hazard-file.js op:'watch') it reads what the runs left
// in server_state and mails Michael once when a problem starts and once when
// it is over, never every tick:
//   * a part (the two register files, the deck, the trustee log) whose last
//     successful run (<part>_ok_at, written by each run) is older than 45
//     minutes: the chain has stopped, so a change in the app or in Excel is
//     not reaching the other side;
//   * an error a run left (<part>_err) that has not cleared for 30 minutes;
//   * a change typed in Excel that was not taken (hazard_<file>_dropped), with
//     the hazard number, the column and the reason, as the tours screen says;
//   * the OneDrive connection gone (no refresh token);
//   * the Microsoft app's client secret expired (01/10/2026): every run fails
//     with AADSTS7000222 and no run can clear it, so it is said at once, with
//     what to do, and not as four separate errors;
//   * the daily Vitre refresher import (vitre.js op:'sync', 06:00) that failed,
//     or that has not run for 26 hours.
//   * the database slow for an hour in working hours (15/10/2026, Michael: "that
//     it works as smoothly as possible for the workers"): a sample times three
//     small reads (probe), keeps the median of the last LAT_KEEP samples, and a
//     median over SLOW_MS on SLOW_TICKS samples in a row, the oldest of them at
//     least SLOW_SPAN_MS old, is a problem. It OPENS only between 06:00 and 18:00
//     Israel time; once open it stays open while the samples stay slow, so the
//     evening does not mail "back to normal". The free Supabase server answered
//     2-10 seconds at times on 15/10/2026, at night too; this is how Michael
//     hears of it before a worker does, and how the Pro decision gets its numbers.
//     op:'watch' runs on EVERY hazard-file call, not every 15 minutes, so a
//     sample is taken only when the last one is LAT_GAP_MS old (review
//     15/10/2026: four samples in two minutes mailed "slow for an hour").
// The mail goes out through the same Microsoft connection, so when that
// connection is what broke, the mail cannot go: the app shows the same list
// on the home screen (op:'status' -> watch), and says so when this check
// itself has not run for 45 minutes.
import { stateGet, stateSet, stateLock, stateUnlock, tokenRow, accessToken, hasMail, sendMail, odConfigured } from './_onedrive.js';
import { SITE } from './_site.js';

export const WATCH_KEY = 'sync_watch';
// The file's prepared rows and the 80% warning (hazard-file.js MAX_ROW - 1, FULL_WARN).
export const FILE_ROWS = 205, FULL_WARN = 164;
export const STALE_MS = 45 * 60 * 1000, ERR_MS = 30 * 60 * 1000, FIRST_MS = 60 * 60 * 1000;
// The Vitre import runs once a day; a day and two hours without a run = the cron stopped.
export const VITRE_KEY = 'vitre_sync', VITRE_STALE_MS = 26 * 60 * 60 * 1000;
// The number's state at Meta, read at most every WA_GAP_MS (op:'watch' rides every hazard-file call).
export const WA_GAP_MS = 30 * 60 * 1000, WA_HOOK_MS = 30 * 60 * 1000;
export function jsonAt(raw) { try { const o = JSON.parse(raw || 'null'); return o && Date.parse(o.at) || 0; } catch (e) { return 0; } }
export function waDue(prev, nowMs) { const t = prev && prev.wa && Date.parse(prev.wa.at); return !t || nowMs - t >= WA_GAP_MS; }
async function waPhoneStatus(env, nowIso) {
  if (!env.META_PHONE_NUMBER_ID || !env.META_ACCESS_TOKEN) return null;
  try {
    const r = await fetch('https://graph.facebook.com/v25.0/' + encodeURIComponent(env.META_PHONE_NUMBER_ID) + '?fields=status', { headers: { Authorization: 'Bearer ' + env.META_ACCESS_TOKEN }, signal: AbortSignal.timeout(8000) });
    const j = await r.json().catch(() => ({}));
    // A failed read is "unknown", never "dropped" (lesson 145): keep the last known state.
    return r.ok && j.status ? { at: nowIso, status: String(j.status) } : null;
  } catch (e) { return null; }
}
// Auto re-register (24/10/2026, the number fell to PENDING twice in one day; Michael in the questionnaire: "do it:
// automatic registration"): when Meta says the number is not CONNECTED and the secret WA_PIN is set, register it
// again, at most once an hour, and read the state back. CONNECTED after it = no alert and no mail; a failure keeps
// the alert, now with Meta's reason. Pure part: whether to try.
export const WA_REG_GAP_MS = 60 * 60 * 1000;
export function waRegDue(wa, pin, nowMs) {
  if (!wa || !wa.status || wa.status === 'CONNECTED' || !/^[0-9]{6}$/.test(String(pin || ''))) return false;
  const t = Date.parse(wa.reg_at || '');
  return !t || nowMs - t >= WA_REG_GAP_MS;
}
export async function waReRegister(env, wa, nowIso) {
  const P = 'https://graph.facebook.com/v25.0/' + encodeURIComponent(env.META_PHONE_NUMBER_ID);
  const H = { Authorization: 'Bearer ' + env.META_ACCESS_TOKEN, 'Content-Type': 'application/json' };
  let reg = 'ok';
  try {
    const r = await fetch(P + '/register', { method: 'POST', headers: H, body: JSON.stringify({ messaging_product: 'whatsapp', pin: String(env.WA_PIN) }), signal: AbortSignal.timeout(8000) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || j.error) reg = 'fail: ' + String((j.error && (j.error.message || j.error.code)) || r.status).slice(0, 120);
  } catch (e) { reg = 'fail: ' + String((e && e.message) || e).slice(0, 120); }
  const after = await waPhoneStatus(env, nowIso);
  return Object.assign({}, wa, after || {}, { reg_at: nowIso, reg });
}
// The database speed check: ms for the median of 3 reads, 4 slow samples spanning 45 minutes
// (an hour of slowness, give or take a sample), one sample per 10 minutes at most, 8 kept.
export const SLOW_MS = 1000, SLOW_TICKS = 4, LAT_KEEP = 8, PROBE_MS = 4000, WORK_H = [6, 18];
export const LAT_GAP_MS = 10 * 60 * 1000, SLOW_SPAN_MS = 45 * 60 * 1000;
export const WATCH_LOCK = 'sync_watch_lock', WATCH_LEASE_MS = 120000;
// Microsoft's answer when the client secret expired or was replaced.
export const SECRET_RE = /AADSTS7000222|AADSTS7000215|invalid_client/;
export const PARTS = [
  { k: 'hazard_xlsm', name: '\u05e0\u05d9\u05d4\u05d5\u05dc \u05e1\u05d9\u05d5\u05e8\u05d9 \u05de\u05e4\u05d2\u05e2\u05d9\u05dd.xlsm' },
  { k: 'hazard_xlsx', name: '\u05e0\u05d9\u05d4\u05d5\u05dc \u05e1\u05d9\u05d5\u05e8\u05d9 \u05de\u05e4\u05d2\u05e2\u05d9\u05dd.xlsx' },
  { k: 'deck', partialOk: true, name: '\u05de\u05e6\u05d2\u05ea \u05d4\u05d5\u05d5\u05e2\u05d3\u05d4' },
  { k: 'trustee_log', name: '\u05d9\u05d5\u05de\u05df \u05d3\u05d9\u05d5\u05d5\u05d7\u05d9 \u05e0\u05d0\u05de\u05e0\u05d9\u05dd' },
];
const FILES = [['xlsm', '\u05e0\u05d9\u05d4\u05d5\u05dc \u05e1\u05d9\u05d5\u05e8\u05d9 \u05de\u05e4\u05d2\u05e2\u05d9\u05dd.xlsm'], ['xlsx', '\u05e0\u05d9\u05d4\u05d5\u05dc \u05e1\u05d9\u05d5\u05e8\u05d9 \u05de\u05e4\u05d2\u05e2\u05d9\u05dd.xlsx']];
// The same words as the tours screen (index.html _THZ_WHY).
export const WHY = {
  keep: '\u05e2\u05de\u05d5\u05d3\u05d4 \u05e9\u05e0\u05e7\u05d1\u05e2\u05ea \u05d1\u05d0\u05e4\u05dc\u05d9\u05e7\u05e6\u05d9\u05d4, \u05dc\u05ea\u05e7\u05df \u05e9\u05dd', both: '\u05e9\u05d5\u05e0\u05d4 \u05d2\u05dd \u05d1\u05d0\u05e4\u05dc\u05d9\u05e7\u05e6\u05d9\u05d4, \u05e0\u05e9\u05d0\u05e8 \u05d4\u05e2\u05e8\u05da \u05e9\u05dc \u05d4\u05d0\u05e4\u05dc\u05d9\u05e7\u05e6\u05d9\u05d4',
  bad: '\u05e2\u05e8\u05da \u05e9\u05dc\u05d0 \u05e0\u05d9\u05ea\u05df \u05dc\u05e7\u05dc\u05d5\u05d8 (\u05ea\u05d0\u05e8\u05d9\u05da \u05d0\u05d5 \u05e1\u05d8\u05d8\u05d5\u05e1)', tru_col: '\u05d1\u05dc\u05d9\u05e7\u05d5\u05d9 \u05e0\u05d0\u05de\u05df \u05de\u05ea\u05e7\u05e0\u05d9\u05dd \u05d0\u05ea \u05d6\u05d4 \u05d1\u05d0\u05e4\u05dc\u05d9\u05e7\u05e6\u05d9\u05d4',
  nomatch: '\u05d4\u05e9\u05d5\u05e8\u05d4 \u05dc\u05d0 \u05ea\u05d5\u05d0\u05de\u05ea \u05dc\u05de\u05e4\u05d2\u05e2 \u05e2\u05dd \u05d4\u05de\u05e1\u05e4\u05e8 \u05d4\u05d6\u05d4', dup: '\u05d4\u05de\u05e1\u05e4\u05e8 \u05de\u05d5\u05e4\u05d9\u05e2 \u05e4\u05e2\u05de\u05d9\u05d9\u05dd \u05d1\u05e7\u05d5\u05d1\u05e5',
  seen: '\u05d0\u05d5\u05ea\u05d5 \u05de\u05e1\u05e4\u05e8 \u05d1\u05e9\u05ea\u05d9 \u05e9\u05d5\u05e8\u05d5\u05ea, \u05e0\u05e7\u05dc\u05d8\u05d4 \u05e8\u05e7 \u05d4\u05e8\u05d0\u05e9\u05d5\u05e0\u05d4', gone: '\u05d4\u05de\u05e4\u05d2\u05e2 \u05db\u05d1\u05e8 \u05dc\u05d0 \u05e7\u05d9\u05d9\u05dd \u05d1\u05d0\u05e4\u05dc\u05d9\u05e7\u05e6\u05d9\u05d4',
  tru_new: '\u05dc\u05d9\u05e7\u05d5\u05d9 \u05e0\u05d0\u05de\u05df \u05e0\u05e4\u05ea\u05d7 \u05e8\u05e7 \u05de\u05d4\u05d0\u05e4\u05dc\u05d9\u05e7\u05e6\u05d9\u05d4, \u05dc\u05d0 \u05de\u05d4\u05e7\u05d5\u05d1\u05e5', nodescr: '\u05e9\u05d5\u05e8\u05d4 \u05d1\u05dc\u05d9 \u05ea\u05d9\u05d0\u05d5\u05e8 \u05de\u05e4\u05d2\u05e2, \u05dc\u05d0 \u05e0\u05e4\u05ea\u05d7 \u05de\u05e4\u05d2\u05e2',
  dept: '\u05de\u05d7\u05dc\u05e7\u05d4 \u05e9\u05dc\u05d0 \u05de\u05d5\u05e4\u05d9\u05e2\u05d4 \u05d1\u05d3\u05d5\u05d7, \u05dc\u05d0 \u05e0\u05e4\u05ea\u05d7 \u05de\u05e4\u05d2\u05e2. \u05dc\u05ea\u05e7\u05df \u05dc\u05d0\u05d7\u05ea \u05de-5 \u05d4\u05de\u05d7\u05dc\u05e7\u05d5\u05ea',
};
const COL = 'ABCDEFGHIJKLM';

// Israel time, as Michael reads dates: DD/MM/YYYY HH:MM.
export function ilTime(iso) {
  const d = new Date(iso);
  if (isNaN(d)) return '';
  const p = {};
  new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Jerusalem', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
    .formatToParts(d).forEach((x) => { p[x.type] = x.value; });
  return p.day + '/' + p.month + '/' + p.year + ' ' + p.hour + ':' + p.minute;
}

export function ilHour(ms) {
  return +new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Jerusalem', hour: '2-digit', hourCycle: 'h23' }).format(new Date(ms));
}
const median = (a) => { const b = a.slice().sort((x, y) => x - y); return b[Math.floor(b.length / 2)]; };
// Pure. lat = [{at, ms}] oldest first, ms = the median of one sample. A problem when the
// last SLOW_TICKS samples are all slow and the oldest of them is SLOW_SPAN_MS old. It opens
// only in working hours; wasOpen (it is open already) keeps it open after 18:00 while slow.
export function slowIssue(lat, nowMs, wasOpen) {
  const last = (lat || []).slice(-SLOW_TICKS);
  if (last.length < SLOW_TICKS || last.some((x) => !(x && x.ms > SLOW_MS))) return null;
  if (!(nowMs - (Date.parse(last[0].at) || nowMs) >= SLOW_SPAN_MS)) return null;
  const h = ilHour(nowMs);
  if (!wasOpen && (h < WORK_H[0] || h >= WORK_H[1])) return null;
  const ms = median(last.map((x) => x.ms));
  return { key: 'slow', title: '\u05d4\u05de\u05e1\u05d3 \u05d0\u05d9\u05d8\u05d9 \u05db\u05d1\u05e8 \u05e9\u05e2\u05d4', detail: '\u05d1\u05e7\u05e9\u05d4 \u05e7\u05d8\u05e0\u05d4 \u05dc\u05de\u05e1\u05d3 \u05dc\u05d5\u05e7\u05d7\u05ea \u05db-' + (ms / 1000).toFixed(1) + ' \u05e9\u05e0\u05d9\u05d5\u05ea (\u05d4\u05e8\u05d2\u05d9\u05dc: \u05e4\u05d7\u05d5\u05ea \u05de-0.2). \u05e2\u05d5\u05d1\u05d3\u05d9\u05dd \u05e9\u05d7\u05d5\u05ea\u05de\u05d9\u05dd \u05e2\u05dc \u05d4\u05d3\u05e8\u05db\u05d4 \u05d0\u05d5 \u05e0\u05db\u05e0\u05e1\u05d9\u05dd \u05dc\u05d0\u05e4\u05dc\u05d9\u05e7\u05e6\u05d9\u05d4 \u05de\u05e8\u05d2\u05d9\u05e9\u05d9\u05dd \u05ea\u05e7\u05d9\u05e2\u05d5\u05ea. \u05d4\u05e1\u05d9\u05d1\u05d4 \u05d4\u05e9\u05db\u05d9\u05d7\u05d4: \u05d4\u05e9\u05e8\u05ea \u05d4\u05d7\u05d9\u05e0\u05de\u05d9 \u05e9\u05dc Supabase.' };
}
// Three small reads at once; { ms: the median, fail: reads that threw }. An answer, even an
// error status, counts its time (the server answered). A read that hangs counts PROBE_MS.
// A read that THROWS at once (connection refused, DNS) also counts PROBE_MS, not its 5ms:
// for a worker a database that cannot be reached is the worst case, not a fast one. It is
// counted apart in `fail`, so the numbers kept for the Pro decision say which it was.
export async function probe(env) {
  const url = (env.SUPABASE_URL || SITE.supabaseUrl) + '/rest/v1/locations?select=id&limit=1';
  const h = { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: 'Bearer ' + env.SUPABASE_SERVICE_ROLE_KEY };
  let fail = 0;
  const one = async () => {
    const t = Date.now();
    let r = null;
    try { r = await fetch(url, { headers: h, signal: AbortSignal.timeout(PROBE_MS) }); }
    catch (e) { if (!(e && (e.name === 'TimeoutError' || e.name === 'AbortError'))) fail++; return PROBE_MS; }
    const ms = Date.now() - t;
    try { if (r && r.body) await r.body.cancel(); } catch (e) {} // the answer is not needed, only its time
    return ms;
  };
  const out = await Promise.all([one(), one(), one()]);
  return { ms: median(out), fail };
}

export function stateKeys() {
  const keys = [WATCH_KEY, VITRE_KEY, 'wa_last_out', 'wa_status_last'];
  PARTS.forEach((p) => ['ok_at', 'err', 'err_at'].forEach((x) => keys.push(p.k + '_' + x)));
  FILES.forEach(([f]) => { keys.push('hazard_' + f + '_dropped'); keys.push('hazard_' + f + '_rows'); });
  return keys;
}

// Pure. st = stateGet(stateKeys()); connected = the OneDrive token exists;
// started = when the watchdog first ran (a part with no ok_at yet gets an
// hour from then, since ok_at is new with this change); vitre = the Vitre keys
// are set, so the daily import is expected.
export function assess(st, nowMs, connected, started, vitre, lat, slowOpen, wa) {
  const v = (k) => (st[k] && st[k].value) || '';
  const at = (k) => (st[k] && st[k].at) || '';
  const out = [];
  if (!connected) out.push({ key: 'od', title: '\u05d4\u05d7\u05d9\u05d1\u05d5\u05e8 \u05dc-OneDrive \u05e0\u05e4\u05dc', detail: '\u05d4\u05e7\u05d1\u05e6\u05d9\u05dd \u05d5\u05d4\u05de\u05e6\u05d2\u05ea \u05dc\u05d0 \u05de\u05ea\u05e2\u05d3\u05db\u05e0\u05d9\u05dd \u05e2\u05d3 \u05e9\u05de\u05ea\u05d7\u05d1\u05e8\u05d9\u05dd \u05de\u05d7\u05d3\u05e9 (\u05de\u05e6\u05d1 \u05d4\u05de\u05e2\u05e8\u05db\u05ea > OneDrive).' });
  if (connected && PARTS.some((p) => SECRET_RE.test(v(p.k + '_err')))) out.push({ key: 'secret', title: '\u05e4\u05d2 \u05ea\u05d5\u05e7\u05e3 \u05d4\u05e1\u05d5\u05d3 \u05e9\u05dc \u05d7\u05d9\u05d1\u05d5\u05e8 Microsoft', detail: '\u05d4\u05e7\u05d1\u05e6\u05d9\u05dd, \u05d4\u05de\u05e6\u05d2\u05ea \u05d5\u05d4\u05de\u05d9\u05d9\u05dc \u05e0\u05e2\u05e6\u05e8\u05d5. \u05d1-Azure Portal > App registrations > Certificates & secrets \u05dc\u05d9\u05e6\u05d5\u05e8 \u05e1\u05d5\u05d3 \u05d7\u05d3\u05e9, \u05d5\u05d0\u05d6 \u05dc\u05d4\u05d7\u05dc\u05d9\u05e3 \u05d0\u05ea ONEDRIVE_CLIENT_SECRET \u05d1-Cloudflare (Settings > Variables and Secrets).' });
  PARTS.forEach((p) => {
    const err = v(p.k + '_err');
    if (SECRET_RE.test(err)) return; // said once above
    const errAt = Date.parse(v(p.k + '_err_at') || at(p.k + '_err')) || 0;
    const ok = Date.parse(v(p.k + '_ok_at')) || 0;
    // 19/10/2026 (mail "timeout since 19:15", the 19:45 run succeeded): a run that finished
    // after the error clears it, even when nothing was written and err stayed in server_state.
    // deck: ok_at is written after a run that finished with a chart error still set (hazard-deck.js), so a later ok_at does not clear it
    if (err && !(!p.partialOk && errAt && ok > errAt)) {
      if (nowMs - errAt >= ERR_MS) out.push({ key: 'err:' + p.k, title: p.name + ': \u05e9\u05d2\u05d9\u05d0\u05d4 \u05d1\u05e2\u05d3\u05db\u05d5\u05df', detail: String(err).substring(0, 200) + (errAt ? ' (\u05de\u05d0\u05d6 ' + ilTime(new Date(errAt).toISOString()) + ')' : '') });
      return; // a fresh error is the next run's to clear; it is not also "stale"
    }
    const since = ok || Date.parse(started) || nowMs;
    if (connected && nowMs - since >= (ok ? STALE_MS : FIRST_MS)) {
      out.push({ key: 'stale:' + p.k, title: p.name + ': \u05dc\u05d0 \u05d4\u05ea\u05e2\u05d3\u05db\u05df', detail: ok ? '\u05d4\u05d1\u05d3\u05d9\u05e7\u05d4 \u05d4\u05de\u05d5\u05e6\u05dc\u05d7\u05ea \u05d4\u05d0\u05d7\u05e8\u05d5\u05e0\u05d4: ' + ilTime(new Date(ok).toISOString()) + '. \u05e9\u05d9\u05e0\u05d5\u05d9\u05d9\u05dd \u05d1\u05d0\u05e4\u05dc\u05d9\u05e7\u05e6\u05d9\u05d4 \u05d0\u05d5 \u05d1\u05e7\u05d5\u05d1\u05e5 \u05dc\u05d0 \u05e2\u05d5\u05d1\u05e8\u05d9\u05dd \u05dc\u05e6\u05d3 \u05d4\u05e9\u05e0\u05d9.' : '\u05e2\u05d5\u05d3 \u05dc\u05d0 \u05e0\u05e8\u05e9\u05de\u05d4 \u05d1\u05d3\u05d9\u05e7\u05d4 \u05de\u05d5\u05e6\u05dc\u05d7\u05ea.' });
    }
  });
  if (vitre) {
    let r = null; try { r = JSON.parse(v(VITRE_KEY) || 'null'); } catch (e) { r = null; }
    const last = (r && Date.parse(r.at)) || 0;
    const when = last ? ' (\u05d1\u05e8\u05d9\u05e6\u05d4 \u05e9\u05dc ' + ilTime(new Date(last).toISOString()) + ')' : '';
    if (r && r.error) out.push({ key: 'vitre:err', title: '\u05d9\u05d9\u05d1\u05d5\u05d0 \u05d4\u05e8\u05d9\u05e2\u05e0\u05d5\u05e0\u05d9\u05dd \u05de-Vitre: \u05e9\u05d2\u05d9\u05d0\u05d4', detail: String(r.error).substring(0, 200) + when });
    else if (nowMs - (last || Date.parse(started) || nowMs) >= VITRE_STALE_MS) out.push({ key: 'vitre:stale', title: '\u05d9\u05d9\u05d1\u05d5\u05d0 \u05d4\u05e8\u05d9\u05e2\u05e0\u05d5\u05e0\u05d9\u05dd \u05de-Vitre: \u05dc\u05d0 \u05e8\u05e5', detail: (last ? '\u05d4\u05e8\u05d9\u05e6\u05d4 \u05d4\u05d0\u05d7\u05e8\u05d5\u05e0\u05d4: ' + ilTime(new Date(last).toISOString()) + '. ' : '\u05e2\u05d5\u05d3 \u05dc\u05d0 \u05e0\u05e8\u05e9\u05de\u05d4 \u05e8\u05d9\u05e6\u05d4. ') + '\u05d4\u05d9\u05d9\u05d1\u05d5\u05d0 \u05d0\u05de\u05d5\u05e8 \u05dc\u05e8\u05d5\u05e5 \u05db\u05dc \u05d1\u05d5\u05e7\u05e8 \u05d1-06:00.' });
  }
  // The assistant's WhatsApp number (24/10/2026: Meta dropped it, 133010, and Michael found out only when he could not
  // write to it; in the questionnaire: "do it: a mail when it drops"). wa = { status } from waPhoneStatus; no wa = not checked.
  if (wa && wa.status && wa.status !== 'CONNECTED') out.push({ key: 'wa:phone', title: '\u05de\u05e1\u05e4\u05e8 \u05d4\u05d5\u05d5\u05d0\u05d8\u05e1\u05d0\u05e4 \u05e9\u05dc \u05d4\u05e2\u05d5\u05d6\u05e8 \u05de\u05e0\u05d5\u05ea\u05e7', detail: '\u05dc\u05e4\u05d9 Meta: ' + wa.status + (wa.reg && wa.reg !== 'ok' ? '. \u05e8\u05d9\u05e9\u05d5\u05dd \u05d0\u05d5\u05d8\u05d5\u05de\u05d8\u05d9 \u05e0\u05db\u05e9\u05dc: ' + wa.reg : '') + '. \u05d4\u05e2\u05d5\u05d6\u05e8 \u05dc\u05d0 \u05de\u05e7\u05d1\u05dc \u05d5\u05dc\u05d0 \u05e9\u05d5\u05dc\u05d7 \u05d4\u05d5\u05d3\u05e2\u05d5\u05ea, \u05d5\u05d2\u05dd \u05e2\u05d3\u05db\u05d5\u05df \u05d4\u05d1\u05d5\u05e7\u05e8 \u05dc\u05d0 \u05d9\u05d5\u05e6\u05d0. \u05dc\u05e9\u05d7\u05d6\u05d5\u05e8: \u05d1\u05e9\u05d9\u05d7\u05ea \u05d4\u05e4\u05d9\u05ea\u05d5\u05d7, wa_phone \u05e2\u05dd step register \u05d5\u05d4-PIN \u05e9\u05dc \u05d4\u05de\u05e1\u05e4\u05e8 (ACCOUNT-INVENTORY, \u05d5\u05d5\u05d0\u05d8\u05e1\u05d0\u05e4).' });
  // Meta stopped calling the hook (24/10/2026: the app "בטיחות" fell out of Live; the number stayed CONNECTED, so the
  // phone check saw nothing). A send that got no status back within WA_HOOK_MS. No status ever seen = not known yet.
  const waOut = jsonAt(v('wa_last_out')), waStat = jsonAt(v('wa_status_last'));
  if (waOut && waStat && nowMs - waOut >= WA_HOOK_MS && waStat < waOut) out.push({ key: 'wa:hook', title: '\u05d4\u05d5\u05d3\u05e2\u05d5\u05ea \u05d5\u05d5\u05d0\u05d8\u05e1\u05d0\u05e4 \u05de-Meta \u05dc\u05d0 \u05de\u05d2\u05d9\u05e2\u05d5\u05ea \u05dc\u05e9\u05e8\u05ea', detail: '\u05d4\u05e2\u05d5\u05d6\u05e8 \u05e9\u05dc\u05d7 \u05d4\u05d5\u05d3\u05e2\u05d4 \u05d1-' + ilTime(new Date(waOut).toISOString()) + ' \u05d5-Meta \u05dc\u05d0 \u05d4\u05d7\u05d6\u05d9\u05e8\u05d4 \u05d0\u05d9\u05e9\u05d5\u05e8 \u05e9\u05dc\u05d9\u05d7\u05d4. \u05db\u05e0\u05e8\u05d0\u05d4 \u05d4\u05d0\u05e4\u05dc\u05d9\u05e7\u05e6\u05d9\u05d4 "\u05d1\u05d8\u05d9\u05d7\u05d5\u05ea" \u05d1-Meta \u05d9\u05e6\u05d0\u05d4 \u05de\u05de\u05e6\u05d1 Live: developers.facebook.com, \u05d4\u05d0\u05e4\u05dc\u05d9\u05e7\u05e6\u05d9\u05d4, Publish. \u05e2\u05d3 \u05d0\u05d6 \u05d4\u05d5\u05d3\u05e2\u05d5\u05ea \u05e9\u05ea\u05db\u05ea\u05d5\u05d1 \u05dc\u05e2\u05d5\u05d6\u05e8 \u05dc\u05d0 \u05de\u05d2\u05d9\u05e2\u05d5\u05ea.' });
  const slow = slowIssue(lat, nowMs, slowOpen);
  if (slow) out.push(slow);
  FILES.forEach(([f, name]) => {
    // 80% full (upgrade review 24): a month or two before it stops.
    const n = +v('hazard_' + f + '_rows') || 0;
    if (n >= FULL_WARN) out.push({ key: 'full:' + f, title: name + ': \u05d4\u05e7\u05d5\u05d1\u05e5 \u05de\u05ea\u05de\u05dc\u05d0', detail: n + ' \u05e9\u05d5\u05e8\u05d5\u05ea \u05de\u05ea\u05d5\u05da ' + FILE_ROWS + '. \u05db\u05e9\u05d4\u05d5\u05d0 \u05de\u05ea\u05de\u05dc\u05d0 \u05d4\u05d5\u05d0 \u05de\u05e4\u05e1\u05d9\u05e7 \u05dc\u05d4\u05ea\u05e2\u05d3\u05db\u05df. \u05e6\u05e8\u05d9\u05da \u05dc\u05d4\u05d5\u05e1\u05d9\u05e3 \u05e9\u05d5\u05e8\u05d5\u05ea \u05de\u05d5\u05db\u05e0\u05d5\u05ea \u05d1\u05ea\u05d1\u05e0\u05d9\u05ea, \u05d0\u05d5 \u05dc\u05e2\u05d1\u05d5\u05e8 \u05dc\u05e7\u05d5\u05d1\u05e5 \u05d7\u05d3\u05e9 \u05dc\u05e4\u05e0\u05d9 \u05db\u05df.' });
    let d = null; try { d = JSON.parse(v('hazard_' + f + '_dropped') || 'null'); } catch (e) { d = null; }
    ((d && d.items) || []).forEach((x) => {
      if (!x) return;
      const col = x.ci >= 0 && x.ci < COL.length ? ', \u05e2\u05de\u05d5\u05d3\u05d4 ' + COL[x.ci] : '';
      out.push({ key: 'drop:' + f + ':' + [x.n, x.ci, x.val].join('|'), title: name + ': \u05e9\u05d9\u05e0\u05d5\u05d9 \u05e9\u05dc\u05d0 \u05e0\u05e7\u05dc\u05d8, \u05de\u05e4\u05d2\u05e2 ' + (x.n || '?') + col,
        detail: (WHY[x.why] || '\u05dc\u05d0 \u05e0\u05e7\u05dc\u05d8') + (x.val ? '. \u05d4\u05e2\u05e8\u05da \u05d1\u05e7\u05d5\u05d1\u05e5: ' + String(x.val).substring(0, 80) : '') });
    });
  });
  return out;
}

// Pure. prev = the stored watch state; list = assess(). What to mail now:
// problems not mailed yet, and mailed problems that are gone.
export function step(prev, list, nowIso) {
  const open = {}, before = (prev && prev.open) || {};
  list.forEach((x) => { const b = before[x.key]; open[x.key] = { title: x.title, detail: x.detail, since: (b && b.since) || nowIso, mailed: !!(b && b.mailed) }; });
  const fresh = Object.keys(open).filter((k) => !open[k].mailed);
  const done = ((prev && prev.done) || []).slice();
  Object.keys(before).forEach((k) => { if (!open[k] && before[k].mailed) done.push({ key: k, title: before[k].title, since: before[k].since, until: nowIso }); });
  return { open, fresh, done };
}

const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
export function mailHtml(open, fresh, done, appUrl) {
  const li = (t, d) => '<li style="margin-bottom:6px"><b>' + esc(t) + '</b>' + (d ? '<br>' + esc(d) : '') + '</li>';
  let h = '<div dir="rtl" style="font-family:Arial,sans-serif;font-size:14px">';
  if (fresh.length) h += '<p style="color:#b91c1c;font-weight:bold">' + (onlySlow(fresh) ? '\u05d4\u05d0\u05e4\u05dc\u05d9\u05e7\u05e6\u05d9\u05d4 \u05d0\u05d9\u05d8\u05d9\u05ea:' : '\u05d1\u05e2\u05d9\u05d4 \u05d1\u05e1\u05e0\u05db\u05e8\u05d5\u05df \u05d1\u05d9\u05df \u05d4\u05d0\u05e4\u05dc\u05d9\u05e7\u05e6\u05d9\u05d4, \u05d4\u05e7\u05d1\u05e6\u05d9\u05dd \u05d5\u05d4\u05de\u05e6\u05d2\u05ea:') + '</p><ul>' + fresh.map((k) => li(open[k].title, open[k].detail)).join('') + '</ul>';
  if (done.length) h += '<p style="color:#15803d;font-weight:bold">\u05e0\u05e4\u05ea\u05e8:</p><ul>' + done.map((x) => li(x.title, '\u05de-' + ilTime(x.since) + ' \u05e2\u05d3 ' + ilTime(x.until))).join('') + '</ul>';
  const still = Object.keys(open).filter((k) => fresh.indexOf(k) < 0);
  if (still.length) h += '<p>\u05e2\u05d3\u05d9\u05d9\u05df \u05e4\u05ea\u05d5\u05d7: ' + still.map((k) => esc(open[k].title)).join('; ') + '</p>';
  h += '<p style="color:#555;font-size:12px">\u05d4\u05d5\u05d3\u05e2\u05d4 \u05d0\u05d7\u05ea \u05db\u05e9\u05d1\u05e2\u05d9\u05d4 \u05de\u05ea\u05d7\u05d9\u05dc\u05d4 \u05d5\u05d0\u05d7\u05ea \u05db\u05e9\u05d4\u05d9\u05d0 \u05e0\u05e4\u05ea\u05e8\u05ea. \u05d4\u05e8\u05e9\u05d9\u05de\u05d4 \u05d4\u05de\u05dc\u05d0\u05d4 \u05d1\u05de\u05e1\u05da \u05d4\u05d1\u05d9\u05ea \u05d1\u05d0\u05e4\u05dc\u05d9\u05e7\u05e6\u05d9\u05d4' + (appUrl ? ': <a href="' + esc(appUrl) + '">' + esc(appUrl) + '</a>' : '') + '.</p></div>';
  return h;
}
// The slowness notice is not a sync problem; a mail about it alone says so.
const onlySlow = (keys) => keys.length > 0 && keys.every((k) => (k && k.key ? k.key : k) === 'slow');
export function mailSubject(fresh, done, open) {
  if (fresh.length && onlySlow(fresh)) return SITE.name + ': ' + open[fresh[0]].title;
  if (!fresh.length && onlySlow(done || [])) return SITE.name + ': \u05d4\u05de\u05e1\u05d3 \u05d7\u05d6\u05e8 \u05dc\u05de\u05d4\u05d9\u05e8\u05d5\u05ea \u05e8\u05d2\u05d9\u05dc\u05d4';
  if (fresh.length) return SITE.name + ': \u05d1\u05e2\u05d9\u05d4 \u05d1\u05e1\u05e0\u05db\u05e8\u05d5\u05df (' + fresh.length + ') - ' + open[fresh[0]].title;
  return SITE.name + ': \u05d4\u05e1\u05e0\u05db\u05e8\u05d5\u05df \u05d7\u05d6\u05e8 \u05dc\u05e2\u05d1\u05d5\u05d3' + (Object.keys(open).length ? ' (\u05d7\u05dc\u05e7\u05d9\u05ea)' : '');
}

// One run at a time (15/10/2026): op:'watch' rides every hazard-file call, so two could read
// the same state and both mail. A run that finds the lock held does nothing.
export async function runWatch(env, appUrl) {
  const tok = await stateLock(env, WATCH_LOCK, WATCH_LEASE_MS);
  if (!tok) return { ok: true, busy: true };
  try { return await watchOnce(env, appUrl); } finally { await stateUnlock(env, WATCH_LOCK, tok); }
}
async function watchOnce(env, appUrl) {
  const now = new Date(), nowIso = now.toISOString();
  // Strict reads (15/10/2026): a failed read used to look like "no state", so it wiped
  // sync_watch, forgot which problems were mailed and mailed them again. Now it writes nothing.
  let st;
  try { st = await stateGet(env, stateKeys(), true); } catch (e) { return { ok: false, error: 'state read failed: ' + String((e && e.message) || e).substring(0, 120) }; }
  let prev = null; try { prev = JSON.parse((st[WATCH_KEY] && st[WATCH_KEY].value) || 'null'); } catch (e) { prev = null; }
  // tokenRow throws only when the read failed (no row = null): not the same as "not connected".
  let row = null;
  try { row = odConfigured(env) ? await tokenRow(env) : null; } catch (e) { return { ok: false, error: 'token read failed: ' + String((e && e.message) || e).substring(0, 120) }; }
  const connected = !!(row && row.refresh_token);
  const started = (prev && prev.started) || nowIso;
  // A sample only when the last one is LAT_GAP_MS old: the ticks are not 15 minutes apart.
  const prevLat = (prev && Array.isArray(prev.lat)) ? prev.lat : [];
  const lastAt = prevLat.length ? Date.parse(prevLat[prevLat.length - 1].at) || 0 : 0;
  let ms = null, sample = null;
  if (now.getTime() - lastAt >= LAT_GAP_MS) {
    try { const p = await probe(env); ms = p.ms; sample = p.fail ? { at: nowIso, ms, fail: p.fail } : { at: nowIso, ms }; } catch (e) { sample = null; }
  }
  const lat = prevLat.concat(sample ? [sample] : []).slice(-LAT_KEEP);
  const slowOpen = !!(prev && prev.open && prev.open.slow);
  let wa = waDue(prev, now.getTime()) ? ((await waPhoneStatus(env, nowIso)) || (prev && prev.wa) || null) : (prev && prev.wa) || null;
  // the last attempt rides along, so the hourly limit holds across reads
  if (wa && prev && prev.wa && prev.wa.reg_at && !wa.reg_at) wa = Object.assign({}, wa, { reg_at: prev.wa.reg_at, reg: prev.wa.reg });
  if (env.META_PHONE_NUMBER_ID && env.META_ACCESS_TOKEN && waRegDue(wa, env.WA_PIN, now.getTime())) wa = await waReRegister(env, wa, nowIso);
  const list = assess(st, now.getTime(), connected, started, !!(env.VITRE_API_KEY_ID && env.VITRE_API_KEY_SECRET), lat, slowOpen, wa);
  const s = step(prev, list, nowIso);
  let mailErr = '', sent = 0;
  // The samples are saved before the mail (15/10/2026): a mail step that hangs or dies must
  // not lose them. Nothing is marked mailed yet, so a run that dies here mails next time.
  if (sample && (s.fresh.length || s.done.length)) {
    const pre = Object.assign({}, prev || {}, { at: nowIso, started, lat });
    await stateSet(env, { [WATCH_KEY]: JSON.stringify(pre) }).catch(() => {});
  }
  if ((s.fresh.length || s.done.length) && connected && hasMail(row)) {
    try {
      const { token, email } = await accessToken(env);
      await sendMail(token, email || row.user_email, mailSubject(s.fresh, s.done, s.open), mailHtml(s.open, s.fresh, s.done, appUrl));
      s.fresh.forEach((k) => { s.open[k].mailed = true; });
      sent = 1;
    } catch (e) { mailErr = String((e && e.message) || e).substring(0, 200); }
  } else if (s.fresh.length || s.done.length) mailErr = connected ? 'no Mail.Send' : 'not connected';
  // A notice that cannot go out is kept for the next run, but not forever.
  const done = sent ? [] : s.done.slice(-20);
  const value = { at: nowIso, started, open: s.open, done, lat, wa, mail_err: mailErr, mailed_at: sent ? nowIso : (prev && prev.mailed_at) || null };
  await stateSet(env, { [WATCH_KEY]: JSON.stringify(value) });
  return { ok: true, open: Object.keys(s.open).length, fresh: s.fresh.length, resolved: sent ? s.done.length : 0, sent, mailErr, ms };
}
