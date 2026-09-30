// Sync watchdog (upgrade review 12, 30/09/2026). Michael: "I need some
// mechanism that makes sure the sync between the files, the app and the deck
// always happens", with the alert in his organisation mailbox.
// What it calls a problem, that it mails once when a problem starts and once
// when it is over (never every 15 minutes), that a mail that fails is tried
// again, that every run leaves the proof of life it reads, and that the home
// screen says the same when the mail cannot go out.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { assess, step, mailHtml, mailSubject, runWatch, stateKeys, WATCH_KEY, STALE_MS, ERR_MS, ilTime } from './_build/_watchdog.mjs';

let pass = 0, fail = 0;
const check = (l, c, d) => { if (c) { pass++; console.log('  ✓ ' + l); } else { fail++; console.log('  ✗ ' + l + (d !== undefined ? '  -> ' + JSON.stringify(d).substring(0, 400) : '')); } };
const here = path.dirname(fileURLToPath(import.meta.url));
const src = (f) => fs.readFileSync(path.join(here, '../../', f), 'utf8');

const NOW = Date.parse('2026-09-30T08:00:00Z');
const ago = (min) => new Date(NOW - min * 60000).toISOString();
const S = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, { value: v, at: ago(1) }]));
const fresh = { hazard_xlsm_ok_at: ago(5), hazard_xlsx_ok_at: ago(5), deck_ok_at: ago(5), trustee_log_ok_at: ago(5) };
const keys = (l) => l.map((x) => x.key).sort();

console.log('\n1. what is a problem');
check('all ran in the last 5 minutes, connected: nothing', assess(S(fresh), NOW, true, ago(600)).length === 0, assess(S(fresh), NOW, true, ago(600)));
let l = assess(S({ ...fresh, deck_ok_at: ago(50) }), NOW, true, ago(600));
check('the deck last ran 50 minutes ago: "stale:deck"', keys(l).join() === 'stale:deck' && /מצגת/.test(l[0].title) && /לא התעדכן/.test(l[0].title), l);
check('...with the time in DD/MM/YYYY HH:MM (Israel)', /\d{2}\/\d{2}\/2026 \d{2}:\d{2}/.test(l[0].detail) && ilTime(ago(50)) === '30/09/2026 10:10', [l[0].detail, ilTime(ago(50))]);
check('40 minutes is not yet stale (3 ticks)', assess(S({ ...fresh, deck_ok_at: ago(40) }), NOW, true, ago(600)).length === 0);
l = assess(S({ ...fresh, hazard_xlsx_err: 'onedrive 423: locked', hazard_xlsx_err_at: ago(35), hazard_xlsx_ok_at: ago(35) }), NOW, true, ago(600));
check('an error 35 minutes old: "err:hazard_xlsx" only (not also stale)', keys(l).join() === 'err:hazard_xlsx' && /423/.test(l[0].detail), l);
check('an error 10 minutes old: nothing yet (the next run may clear it)', assess(S({ ...fresh, hazard_xlsx_err: 'x', hazard_xlsx_err_at: ago(10), hazard_xlsx_ok_at: ago(60) }), NOW, true, ago(600)).length === 0);
const drop = JSON.stringify({ at: ago(5), items: [{ n: 37, r: 40, ci: 10, val: 'סגור', why: 'both', id: 'h:th-37' }, { n: 'נ-2', r: 55, ci: 5, val: 'אחר', why: 'tru_col' }] });
l = assess(S({ ...fresh, hazard_xlsm_dropped: drop }), NOW, true, ago(600));
check('two changes not taken: two problems, with number, column and reason', l.length === 2 && /מפגע 37, עמודה K/.test(l[0].title) && /שונה גם באפליקציה/.test(l[0].detail) && /סגור/.test(l[0].detail) && /נ-2/.test(l[1].title), l);
l = assess(S(fresh), NOW, false, ago(600));
check('no OneDrive token: "od", and not four "stale" on top', keys(l).join() === 'od', l);
check('ok_at not written yet (first hour after this ships): nothing', assess(S({}), NOW, true, ago(30)).length === 0);
check('...still not written an hour later: all four stale', assess(S({}), NOW, true, ago(61)).length === 4);

console.log('\n2. one mail when it starts, one when it is over');
let st = step(null, [{ key: 'stale:deck', title: 'T', detail: 'D' }], ago(0));
check('new problem: to mail', st.fresh.join() === 'stale:deck' && !st.done.length);
st.open['stale:deck'].mailed = true;
const prev = { open: st.open, done: [] };
st = step(prev, [{ key: 'stale:deck', title: 'T', detail: 'D2' }], ago(0));
check('same problem on the next tick: nothing to mail', !st.fresh.length && !st.done.length && st.open['stale:deck'].since === prev.open['stale:deck'].since);
st = step(prev, [], ago(0));
check('gone: one "resolved" notice', !st.fresh.length && st.done.length === 1 && st.done[0].key === 'stale:deck');
st = step({ open: { a: { title: 'A', since: ago(9), mailed: false } } }, [], ago(0));
check('gone before it was ever mailed: no "resolved" mail', !st.done.length);
const html = mailHtml({ k: { title: 'מצגת הוועדה: לא התעדכן', detail: 'x', since: ago(0) } }, ['k'], [{ title: 'R', since: ago(60), until: ago(0) }], 'https://tapugan-safety.pages.dev/');
check('mail: rtl, the problem, what was resolved, the link', /dir="rtl"/.test(html) && /מצגת הוועדה/.test(html) && /נפתר/.test(html) && /tapugan-safety\.pages\.dev/.test(html));
check('keyboard characters only in the mail', !/[—–־«»…•→←]/.test(html + mailSubject(['k'], [], { k: { title: 'T' } }) + mailSubject([], [1], {})));

console.log('\n3. runWatch against a fake server');
let store = {}, mails = [], mailFail = false, tokenOk = true;
globalThis.fetch = async (url, init) => {
  const u = String(url), body = init && init.body ? JSON.parse(init.body) : null;
  if (u.includes('/rest/v1/server_state?select=')) {
    const ks = decodeURIComponent(u.match(/key=in\.\(([^)]*)\)/)[1]).split(',');
    return { ok: true, json: async () => ks.filter((k) => k in store).map((k) => ({ key: k, value: store[k], updated_at: ago(1) })) };
  }
  if (u.includes('/rest/v1/server_state')) { (Array.isArray(body) ? body : [body]).forEach((r) => { store[r.key] = r.value; }); return { ok: true, status: 201, json: async () => ({}) }; }
  if (u.includes('/rest/v1/oauth_tokens')) return { ok: true, json: async () => (tokenOk ? [{ user_email: 'sviva@tapugan.co.il', refresh_token: 'r', access_token: 'a', expires_at: new Date(Date.now() + 3600e3).toISOString(), scope: 'Files.ReadWrite Mail.Send' }] : []) };
  if (u.includes('/sendMail')) { if (mailFail) return { ok: false, status: 503, json: async () => ({ error: { message: 'down' } }) }; mails.push(body.message); return { ok: true, status: 202, json: async () => ({}) }; }
  return { ok: false, status: 404, json: async () => ({}) };
};
const env = { SUPABASE_SERVICE_ROLE_KEY: 'k', SUPABASE_URL: 'https://x.supabase.co', ONEDRIVE_CLIENT_ID: 'c', ONEDRIVE_CLIENT_SECRET: 's' };
const realNow = Date.now();
store = { hazard_xlsm_ok_at: new Date(realNow).toISOString(), hazard_xlsx_ok_at: new Date(realNow).toISOString(), deck_ok_at: new Date(realNow - 50 * 60000).toISOString(), trustee_log_ok_at: new Date(realNow).toISOString(), [WATCH_KEY]: JSON.stringify({ started: new Date(realNow - 600 * 60000).toISOString(), open: {} }) };
let r = await runWatch(env, 'https://tapugan-safety.pages.dev/');
check('a stale deck: one mail, to the connected mailbox', mails.length === 1 && mails[0].toRecipients[0].emailAddress.address === 'sviva@tapugan.co.il' && /מצגת/.test(mails[0].subject), [r, mails.map((m) => m.subject)]);
r = await runWatch(env, 'x');
check('next tick, same problem: no second mail', mails.length === 1, r);
store.deck_ok_at = new Date().toISOString();
r = await runWatch(env, 'x');
check('the deck ran again: one "back to work" mail', mails.length === 2 && /חזר לעבוד/.test(mails[1].subject), mails.map((m) => m.subject));
r = await runWatch(env, 'x');
check('...and then quiet', mails.length === 2);
mailFail = true; store.deck_ok_at = new Date(Date.now() - 50 * 60000).toISOString();
r = await runWatch(env, 'x');
const w = JSON.parse(store[WATCH_KEY]);
check('the mail fails: the problem stays unmailed and the error is kept', mails.length === 2 && w.open['stale:deck'] && !w.open['stale:deck'].mailed && /503/.test(w.mail_err), w);
mailFail = false;
r = await runWatch(env, 'x');
check('...and goes out on the next tick', mails.length === 3 && /מצגת/.test(mails[2].subject), mails.map((m) => m.subject));
tokenOk = false;
r = await runWatch(env, 'x');
const w2 = JSON.parse(store[WATCH_KEY]);
check('no connection: "od" open, no mail possible, kept for the home screen', w2.open.od && w2.mail_err === 'not connected' && mails.length === 3, w2);

console.log('\n4. every run leaves the proof of life the watchdog reads');
const hf = src('functions/api/hazard-file.js'), hd = src('functions/api/hazard-deck.js'), tl = src('functions/api/trustee-log.js');
check('hazard-file writes hazard_<file>_ok_at after a finished run', /\['hazard_' \+ which \+ '_ok_at'\]: new Date\(\)\.toISOString\(\)/.test(hf));
check('hazard-deck writes deck_ok_at', /deck_ok_at: new Date\(\)\.toISOString\(\)/.test(hd));
check('trustee-log writes trustee_log_ok_at', /trustee_log_ok_at: new Date\(\)\.toISOString\(\)/.test(tl));
check('the watchdog reads exactly those keys', ['hazard_xlsm_ok_at', 'hazard_xlsx_ok_at', 'deck_ok_at', 'trustee_log_ok_at'].every((k) => stateKeys().includes(k)));
check('the 15-minute tick starts it (op:"watch", with the secret)', /body: JSON\.stringify\(\{ op: 'watch' \}\)/.test(hf) && /if \(body\.op === 'watch'\)/.test(hf));
check('the app cannot start it with a sign-in (only the tick)', /body\.op === 'watch'\) \{\s*\n\s*if \(\/\^Bearer/.test(hf));
check('status gives the app the open problems', /files, watch \}/.test(hf));

console.log('\n5. the home screen');
const html2 = src('index.html');
const m = /function _swProblems\(j,nowMs\)\{[\s\S]*?\n\}\n/.exec(html2);
check('the card is on the home screen', html2.includes('<div id="dash-sync-watch"></div>') && /try\{_swHomeRender\(\);\}catch\(e\)\{\}/.test(html2));
const fdStub = (d) => d.split('-').reverse().join('/');
const probs = m ? new Function('fd', m[0] + '; return _swProblems;')(fdStub) : null;
const T = Date.parse('2026-09-30T08:00:00Z');
check('connected, check ran 5 minutes ago, nothing open: no card', probs && probs({ configured: true, connected: true, watch: { at: new Date(T - 5 * 60000).toISOString(), open: [] } }, T).length === 0);
check('open problems are listed', probs && probs({ configured: true, connected: true, watch: { at: new Date(T - 5 * 60000).toISOString(), open: [{ key: 'stale:deck', title: 'A', detail: 'B' }] } }, T).length === 1);
const off = probs && probs({ configured: true, connected: true, watch: { at: new Date(T - 60 * 60000).toISOString(), open: [] } }, T);
check('the check itself has not run for an hour: said on the home screen', off && off.length === 1 && /בדיקת הסנכרון לא רצה/.test(off[0].title), off);
const nc = probs && probs({ configured: true, connected: false, watch: null }, T);
check('not connected and no watch yet: said too', nc && nc.length === 1 && /OneDrive/.test(nc[0].title), nc);
const me = probs && probs({ configured: true, connected: true, watch: { at: new Date(T - 5 * 60000).toISOString(), mailErr: 'outlook 401', open: [{ key: 'x', title: 'A' }] } }, T);
check('a mail that did not go out is said on the card', me && me.some((x) => /לא נשלחה/.test(x.title)), me);

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
