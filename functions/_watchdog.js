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
//   * the OneDrive connection gone (no refresh token).
// The mail goes out through the same Microsoft connection, so when that
// connection is what broke, the mail cannot go: the app shows the same list
// on the home screen (op:'status' -> watch), and says so when this check
// itself has not run for 45 minutes.
import { stateGet, stateSet, tokenRow, accessToken, hasMail, sendMail, odConfigured } from './_onedrive.js';

export const WATCH_KEY = 'sync_watch';
// The file's prepared rows and the 80% warning (hazard-file.js MAX_ROW - 1, FULL_WARN).
export const FILE_ROWS = 205, FULL_WARN = 164;
export const STALE_MS = 45 * 60 * 1000, ERR_MS = 30 * 60 * 1000, FIRST_MS = 60 * 60 * 1000;
export const PARTS = [
  { k: 'hazard_xlsm', name: '\u05e0\u05d9\u05d4\u05d5\u05dc \u05e1\u05d9\u05d5\u05e8\u05d9 \u05de\u05e4\u05d2\u05e2\u05d9\u05dd.xlsm' },
  { k: 'hazard_xlsx', name: '\u05e0\u05d9\u05d4\u05d5\u05dc \u05e1\u05d9\u05d5\u05e8\u05d9 \u05de\u05e4\u05d2\u05e2\u05d9\u05dd.xlsx' },
  { k: 'deck', name: '\u05de\u05e6\u05d2\u05ea \u05d4\u05d5\u05d5\u05e2\u05d3\u05d4' },
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

export function stateKeys() {
  const keys = [WATCH_KEY];
  PARTS.forEach((p) => ['ok_at', 'err', 'err_at'].forEach((x) => keys.push(p.k + '_' + x)));
  FILES.forEach(([f]) => { keys.push('hazard_' + f + '_dropped'); keys.push('hazard_' + f + '_rows'); });
  return keys;
}

// Pure. st = stateGet(stateKeys()); connected = the OneDrive token exists;
// started = when the watchdog first ran (a part with no ok_at yet gets an
// hour from then, since ok_at is new with this change).
export function assess(st, nowMs, connected, started) {
  const v = (k) => (st[k] && st[k].value) || '';
  const at = (k) => (st[k] && st[k].at) || '';
  const out = [];
  if (!connected) out.push({ key: 'od', title: '\u05d4\u05d7\u05d9\u05d1\u05d5\u05e8 \u05dc-OneDrive \u05e0\u05e4\u05dc', detail: '\u05d4\u05e7\u05d1\u05e6\u05d9\u05dd \u05d5\u05d4\u05de\u05e6\u05d2\u05ea \u05dc\u05d0 \u05de\u05ea\u05e2\u05d3\u05db\u05e0\u05d9\u05dd \u05e2\u05d3 \u05e9\u05de\u05ea\u05d7\u05d1\u05e8\u05d9\u05dd \u05de\u05d7\u05d3\u05e9 (\u05de\u05e6\u05d1 \u05d4\u05de\u05e2\u05e8\u05db\u05ea > OneDrive).' });
  PARTS.forEach((p) => {
    const err = v(p.k + '_err');
    const errAt = Date.parse(v(p.k + '_err_at') || at(p.k + '_err')) || 0;
    if (err) {
      if (nowMs - errAt >= ERR_MS) out.push({ key: 'err:' + p.k, title: p.name + ': \u05e9\u05d2\u05d9\u05d0\u05d4 \u05d1\u05e2\u05d3\u05db\u05d5\u05df', detail: String(err).substring(0, 200) + (errAt ? ' (\u05de\u05d0\u05d6 ' + ilTime(new Date(errAt).toISOString()) + ')' : '') });
      return; // a fresh error is the next run's to clear; it is not also "stale"
    }
    const ok = Date.parse(v(p.k + '_ok_at')) || 0;
    const since = ok || Date.parse(started) || nowMs;
    if (connected && nowMs - since >= (ok ? STALE_MS : FIRST_MS)) {
      out.push({ key: 'stale:' + p.k, title: p.name + ': \u05dc\u05d0 \u05d4\u05ea\u05e2\u05d3\u05db\u05df', detail: ok ? '\u05d4\u05d1\u05d3\u05d9\u05e7\u05d4 \u05d4\u05de\u05d5\u05e6\u05dc\u05d7\u05ea \u05d4\u05d0\u05d7\u05e8\u05d5\u05e0\u05d4: ' + ilTime(new Date(ok).toISOString()) + '. \u05e9\u05d9\u05e0\u05d5\u05d9\u05d9\u05dd \u05d1\u05d0\u05e4\u05dc\u05d9\u05e7\u05e6\u05d9\u05d4 \u05d0\u05d5 \u05d1\u05e7\u05d5\u05d1\u05e5 \u05dc\u05d0 \u05e2\u05d5\u05d1\u05e8\u05d9\u05dd \u05dc\u05e6\u05d3 \u05d4\u05e9\u05e0\u05d9.' : '\u05e2\u05d5\u05d3 \u05dc\u05d0 \u05e0\u05e8\u05e9\u05de\u05d4 \u05d1\u05d3\u05d9\u05e7\u05d4 \u05de\u05d5\u05e6\u05dc\u05d7\u05ea.' });
    }
  });
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
  if (fresh.length) h += '<p style="color:#b91c1c;font-weight:bold">\u05d1\u05e2\u05d9\u05d4 \u05d1\u05e1\u05e0\u05db\u05e8\u05d5\u05df \u05d1\u05d9\u05df \u05d4\u05d0\u05e4\u05dc\u05d9\u05e7\u05e6\u05d9\u05d4, \u05d4\u05e7\u05d1\u05e6\u05d9\u05dd \u05d5\u05d4\u05de\u05e6\u05d2\u05ea:</p><ul>' + fresh.map((k) => li(open[k].title, open[k].detail)).join('') + '</ul>';
  if (done.length) h += '<p style="color:#15803d;font-weight:bold">\u05e0\u05e4\u05ea\u05e8:</p><ul>' + done.map((x) => li(x.title, '\u05de-' + ilTime(x.since) + ' \u05e2\u05d3 ' + ilTime(x.until))).join('') + '</ul>';
  const still = Object.keys(open).filter((k) => fresh.indexOf(k) < 0);
  if (still.length) h += '<p>\u05e2\u05d3\u05d9\u05d9\u05df \u05e4\u05ea\u05d5\u05d7: ' + still.map((k) => esc(open[k].title)).join('; ') + '</p>';
  h += '<p style="color:#555;font-size:12px">\u05d4\u05d5\u05d3\u05e2\u05d4 \u05d0\u05d7\u05ea \u05db\u05e9\u05d1\u05e2\u05d9\u05d4 \u05de\u05ea\u05d7\u05d9\u05dc\u05d4 \u05d5\u05d0\u05d7\u05ea \u05db\u05e9\u05d4\u05d9\u05d0 \u05e0\u05e4\u05ea\u05e8\u05ea. \u05d4\u05e8\u05e9\u05d9\u05de\u05d4 \u05d4\u05de\u05dc\u05d0\u05d4 \u05d1\u05de\u05e1\u05da \u05d4\u05d1\u05d9\u05ea \u05d1\u05d0\u05e4\u05dc\u05d9\u05e7\u05e6\u05d9\u05d4' + (appUrl ? ': <a href="' + esc(appUrl) + '">' + esc(appUrl) + '</a>' : '') + '.</p></div>';
  return h;
}
export function mailSubject(fresh, done, open) {
  if (fresh.length) return 'Tapugan Safety: \u05d1\u05e2\u05d9\u05d4 \u05d1\u05e1\u05e0\u05db\u05e8\u05d5\u05df (' + fresh.length + ') - ' + open[fresh[0]].title;
  return 'Tapugan Safety: \u05d4\u05e1\u05e0\u05db\u05e8\u05d5\u05df \u05d7\u05d6\u05e8 \u05dc\u05e2\u05d1\u05d5\u05d3' + (Object.keys(open).length ? ' (\u05d7\u05dc\u05e7\u05d9\u05ea)' : '');
}

export async function runWatch(env, appUrl) {
  const now = new Date(), nowIso = now.toISOString();
  const st = await stateGet(env, stateKeys()).catch(() => ({}));
  let prev = null; try { prev = JSON.parse((st[WATCH_KEY] && st[WATCH_KEY].value) || 'null'); } catch (e) { prev = null; }
  let row = null; try { row = odConfigured(env) ? await tokenRow(env) : null; } catch (e) { row = null; }
  const connected = !!(row && row.refresh_token);
  const started = (prev && prev.started) || nowIso;
  const list = assess(st, now.getTime(), connected, started);
  const s = step(prev, list, nowIso);
  let mailErr = '', sent = 0;
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
  const value = { at: nowIso, started, open: s.open, done, mail_err: mailErr, mailed_at: sent ? nowIso : (prev && prev.mailed_at) || null };
  await stateSet(env, { [WATCH_KEY]: JSON.stringify(value) });
  return { ok: true, open: Object.keys(s.open).length, fresh: s.fresh.length, resolved: sent ? s.done.length : 0, sent, mailErr };
}
