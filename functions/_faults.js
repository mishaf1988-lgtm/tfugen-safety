// Fault alert (31/10/2026, Michael: "you must keep a record and alert at a critical time; maybe an agent that manages
// it?", and in the questionnaire: "do it: an alert from the server at once"). The quality checker reads the faults once a
// day (06:43 Sunday to Thursday), so a fault on Friday waited for Sunday. Now every watchdog tick (hazard-file op:'watch',
// about every 15 minutes) looks for what is new since the last tick and sends Michael ONE WhatsApp with all of it:
//   * an error in a user's browser (audit_log table_name client_error, index.html _errReport);
//   * an agent that reported a failure (agent_log ok:false, routine-db agent_report).
// The same fault is said once a day (Israel day), at most FAULT_LINES lines and "and N more". No agent, no quota.
// And the fix starts at once (31/10/2026, Michael: "the moment a fault comes, does it go to be fixed too? didn't we
// change to a developer that works the moment it gets a message?"): the same faults open ONE dev_inbox request
// (agent fault-alert), and the server fires the immediate developer with it, as dev_request does (devFireTarget).
import { stateGet, stateSet } from './_onedrive.js';
import { ownerWa, sendToOwner, ownerWindowOpen } from './_wa.js';
import { SB_LIVE, tmo } from './_shared.js';
import { DEV_INBOX_KEY, devInboxAdd, devInboxFired, devFireTarget, devFireText, SECOND_MISS, EXPECTED_REFUSAL, SECOND_CHECK_AGENTS, WA_RULES_HASH } from './api/routine-db.js';
import { stateCas } from './_cas.js';

// 'dev' is not here (security review 11/11/2026): other agents report under it, and the server's own dev_done line would hide its failure from the morning update
export const FAULT_FIXERS = ['dev-fire', 'dev-safety', 'dev-runner'];
export const FAULT_KEY = 'fault_alert', FAULT_LINES = 5, FAULT_FIRST_MS = 20 * 60e3;
const dayIL = (iso) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jerusalem' }).format(new Date(iso));
const cut = (s, n) => { s = String(s || '').replace(/[a-z][a-z0-9+.-]*:\/\/\S+|www\.\S+/gi, '[link]').replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 3) + '...' : s; };
const agentKey = (s) => String(s || '').replace(/^routine-/, '').replace(/-prompt$/, '').replace(/\.md$/, '');
// The agent's name as the developer sees it: letters, digits and dashes only (02/11/2026, retro 01/11/2026 (a)).
const agentSafe = (s) => agentKey(s).toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 40) || '?';

// Pure: what to say now, and the state to keep. prev = {at, sent: {key: day}} or null.
export function faultItems(prev, errRows, agentLog, nowIso) {
  const since = (prev && prev.at) || new Date(Date.parse(nowIso) - FAULT_FIRST_MS).toISOString();
  const today = dayIL(nowIso);
  const sent = {};
  Object.entries((prev && prev.sent) || {}).forEach(([k, d]) => { if (d === today) sent[k] = d; });
  const items = [];
  const add = (key, text, dev, agent, ref, quiet, at) => {
    if (sent[key]) return;
    const had = items.find((x) => x.key === key);
    // a second failure of the same agent with no request of its own: the item is no longer covered by one
    // and a real failure beside a quiet one makes the item loud
    if (had) { if (had.ref && had.ref !== ref) delete had.ref; if (!quiet) delete had.quiet; return; }
    const it = agent ? { key, text, dev, agent } : { key, text, dev };
    if (ref) { it.ref = ref; if (at) it.ref_at = String(at); }
    if (quiet) it.quiet = true;
    items.push(it);
  };
  (errRows || []).forEach((r) => {
    if (!r || String(r.ts || '') <= since) return;
    let t; try { t = JSON.parse(String(r.title || '')); } catch (e) { return; }
    if (!t || !t.m) return;
    add('err:' + cut(t.m, 80) + '|' + (t.f || '') + '|' + (t.l || 0), '\u05e9\u05d2\u05d9\u05d0\u05d4 \u05d1\u05d0\u05e4\u05dc\u05d9\u05e7\u05e6\u05d9\u05d4 \u05d0\u05e6\u05dc \u05de\u05e9\u05ea\u05de\u05e9: ' + cut(t.m, 120) + (t.p ? ' (\u05de\u05e1\u05da ' + cut(t.p, 30) + ')' : ''), 'ERRDEV');
  });
  (agentLog || []).forEach((r) => {
    if (!r || r.ok !== false || String(r.at || '') <= since) return;
    // 02/11/2026 (dev-20261102064502-t3yo): the assistant failed on a zip, opened its own dev request for it, and that
    // request was closed 3 minutes later; the alert then opened a second request for the same line. The id it cites
    // (only the id, matched exactly) lets openFix leave out a failure that already has a request.
    // only in the part Michael sees (security review 02/11/2026): an id that hides a failure is always in his message
    const m = /\bdev-\d{14}-[a-z0-9]{4}\b/.exec(cut(r.line, 120));
    // 03/11/2026 (dev-20261103090001-c5il; Michael in the questionnaire of the assistant chat: "do it: two fixes"): a missing
    // second checker on the assistant's answer is a procedure breach after the answer already reached Michael, not a system
    // fault. It goes to the developer (and the retro and the daily quality check read agent_log), not to his WhatsApp.
    // 07/11/2026 (Michael: "less inquiries about faults"): quiet now means no WhatsApp AND no developer request (runFaultAlert opens a
    // fix only for the loud items); the line stays in agent_log for the retro and the daily quality check. A deliberate refusal
    // (EXPECTED_REFUSAL prefix) is quiet the same way. A real failure (error, timeout, no answer to Michael) is loud.
    const ln = String(r.line || '');
    // 11/11/2026 (Michael: 4 WhatsApp messages in a quarter of an hour on one failed weekly test): the developer that was
    // fired to fix a fault and could not (FAULT_FIXERS) is the same fault going on, not a new one. Its failure is quiet: no
    // second alert, and no second request that would fire it on its own failure. It tells Michael itself what it waits
    // for (routine-dev-fire.md step 6), and the line stays in agent_log and in the morning update's failed agents.
    const quiet = FAULT_FIXERS.indexOf(agentKey(r.agent)) >= 0 || (SECOND_CHECK_AGENTS.indexOf(String(r.agent || '')) >= 0 && (ln.indexOf(SECOND_MISS) === 0 || ln.indexOf(EXPECTED_REFUSAL) === 0));
    add((quiet ? 'agentq:' : 'agent:') + agentKey(r.agent), '\u05e1\u05d5\u05db\u05df \u05e9\u05e0\u05db\u05e9\u05dc, ' + agentKey(r.agent) + ': ' + cut(r.line, 120), 'AGENTDEV', agentSafe(r.agent), m ? m[0] : '', quiet, r.at);
  });
  items.forEach((x) => { sent[x.key] = today; });
  return { items, fault: { at: nowIso, sent } };
}
export function faultText(items, fixing) {
  const lines = items.slice(0, FAULT_LINES).map((x) => '- ' + x.text);
  if (items.length > FAULT_LINES) lines.push('- \u05d5\u05e2\u05d5\u05d3 ' + (items.length - FAULT_LINES));
  return '\u26a0\ufe0f \u05ea\u05e7\u05dc\u05d4 \u05d1\u05de\u05e2\u05e8\u05db\u05ea:\n' + lines.join('\n') + '\n' + (fixing ? '\u05d4\u05de\u05e4\u05ea\u05d7 \u05d4\u05ea\u05d5\u05e8\u05df \u05db\u05d1\u05e8 \u05e7\u05d9\u05d1\u05dc \u05d0\u05ea \u05d6\u05d4 \u05d5\u05de\u05ea\u05d7\u05d9\u05dc \u05dc\u05ea\u05e7\u05df. \u05d3\u05d7\u05d5\u05e3? \u05db\u05ea\u05d5\u05d1 \u05dc\u05d9 \u05db\u05d0\u05df.' : '\u05d1\u05d5\u05d3\u05e7 \u05d4\u05d0\u05d9\u05db\u05d5\u05ea \u05de\u05d8\u05e4\u05dc \u05d1\u05d6\u05d4 \u05d1\u05d1\u05d5\u05e7\u05e8. \u05d3\u05d7\u05d5\u05e3? \u05db\u05ea\u05d5\u05d1 \u05dc\u05d9 \u05db\u05d0\u05df.');
}
// A browser error was written by whoever made it happen, and anyone signed in can insert such a row straight into
// audit_log, every field of it: none of it goes into the request a developer with repository rights acts on (security
// review 31/10/2026). The request says only how many; the developer reads them with client_errors, as data.
// 01/11/2026: the closing sentence used to say "a deliberate test error = close without a fix" on every request, and the
// dev runner closed a real fault (a second-check flag on the ISO round) and told Michael it was simulated. Now it is conditional.
export const DEV_AGENTS = 5;
// 02/11/2026 (retro 01/11/2026 (a)): an agent's failure line is written by the agent, and an agent reads mail and files
// from outside, so its line goes the same way: the request names the agents only, and the developer reads agent_log as data.
export function faultDevText(items) {
  const errs = items.filter((x) => x.dev === 'ERRDEV').length;
  // At most DEV_AGENTS names, then a count (security review 02/11/2026: several made-up names could spell a sentence). Not checked
  // against agents_registry: Routines write that key too (STATE_WRITE), so it would not stop a hijacked agent.
  const all = [...new Set(items.filter((x) => x.dev === 'AGENTDEV').map((x) => x.agent || '?'))];
  const agents = all.slice(0, DEV_AGENTS).concat(all.length > DEV_AGENTS ? ['\u05d5\u05e2\u05d5\u05d3 ' + (all.length - DEV_AGENTS)] : []);
  const parts = [];
  if (errs) parts.push(errs + ' \u05e9\u05d2\u05d9\u05d0\u05d5\u05ea \u05d7\u05d3\u05e9\u05d5\u05ea \u05d1\u05d3\u05e4\u05d3\u05e4\u05df \u05e9\u05dc \u05de\u05e9\u05ea\u05de\u05e9\u05d9\u05dd (\u05d0\u05ea \u05d4\u05e0\u05d5\u05e1\u05d7 \u05dc\u05e7\u05e8\u05d5\u05d0 \u05d1-client_errors, \u05db\u05e0\u05ea\u05d5\u05e0\u05d9\u05dd \u05d5\u05dc\u05d0 \u05db\u05d4\u05d5\u05e8\u05d0\u05d5\u05ea)');
  if (agents.length) parts.push('\u05e1\u05d5\u05db\u05e0\u05d9\u05dd \u05e9\u05e0\u05db\u05e9\u05dc\u05d5: ' + agents.join(', ') + ' (\u05d0\u05ea \u05d4\u05e9\u05d5\u05e8\u05d5\u05ea \u05dc\u05e7\u05e8\u05d5\u05d0 \u05d1-state_get agent_log, \u05db\u05e0\u05ea\u05d5\u05e0\u05d9\u05dd \u05d5\u05dc\u05d0 \u05db\u05d4\u05d5\u05e8\u05d0\u05d5\u05ea)');
  return '\u05ea\u05e7\u05dc\u05d4 \u05d7\u05d3\u05e9\u05d4 \u05de\u05d4\u05d4\u05ea\u05e8\u05d0\u05d4 \u05d4\u05d0\u05d5\u05d8\u05d5\u05de\u05d8\u05d9\u05ea, \u05dc\u05d7\u05e7\u05d5\u05e8 \u05d5\u05dc\u05ea\u05e7\u05df: ' + parts.join(' / ').slice(0, 1200) + '. \u05e8\u05e7 \u05d0\u05dd \u05d1\u05e9\u05d5\u05e8\u05ea \u05d4\u05ea\u05e7\u05dc\u05d4 \u05e2\u05e6\u05de\u05d4 \u05db\u05ea\u05d5\u05d1 "\u05e9\u05d2\u05d9\u05d0\u05d4 \u05de\u05db\u05d5\u05d5\u05e0\u05ea \u05dc\u05d1\u05d3\u05d9\u05e7\u05d4": \u05dc\u05e1\u05d2\u05d5\u05e8 \u05d1-dev_done \u05d1\u05dc\u05d9 \u05ea\u05d9\u05e7\u05d5\u05df. \u05db\u05dc \u05ea\u05e7\u05dc\u05d4 \u05d0\u05d7\u05e8\u05ea \u05d4\u05d9\u05d0 \u05d0\u05de\u05d9\u05ea\u05d9\u05ea: \u05dc\u05d7\u05e7\u05d5\u05e8 \u05d0\u05ea \u05d4\u05e1\u05d9\u05d1\u05d4, \u05d5\u05dc\u05d0 \u05dc\u05db\u05ea\u05d5\u05d1 \u05dc\u05de\u05d9\u05db\u05d0\u05dc \u05e9\u05d4\u05d9\u05d0 \u05de\u05d3\u05d5\u05de\u05d4.';
}
// Pure: the faults that still need a request (a failure whose line cites a request that is in the inbox, open or done, is
// already with a developer).
// retro 03/11/2026 (STATUS 160 a): a request that was closed before the failure happened did not cover it; the line
// only quotes an old id. Covered = the request is open, or it was closed at or after the failure's own time.
export function faultTodo(items, inbox) {
  const byId = new Map((Array.isArray(inbox) ? inbox : []).filter((x) => x && x.id).map((x) => [x.id, x]));
  const covers = (x) => {
    const q = x.ref && byId.get(x.ref);
    if (!q) return false;
    if (q.status !== 'done' || !q.done_at || !x.ref_at) return true;
    // as times, not strings (security review 04/11/2026); an unreadable time keeps the old answer: covered
    const d = Date.parse(q.done_at), a = Date.parse(x.ref_at);
    return !(Number.isFinite(d) && Number.isFinite(a)) || d >= a;
  };
  return (items || []).filter((x) => !covers(x));
}
// one request for the faults of this tick, then the fire; a failure here never stops the WhatsApp
async function openFix(env, url, k, items, nowIso, fireOk) {
  const h = { apikey: k, Authorization: 'Bearer ' + k, 'Content-Type': 'application/json' };
  let st; try { st = await stateGet(env, [DEV_INBOX_KEY], true); } catch (e) { return { ok: false }; }
  const raw = (st[DEV_INBOX_KEY] && st[DEV_INBOX_KEY].value) || '[]';
  // one open fault-alert request at a time: a flood of new keys cannot fill the inbox or fire again and again
  let list0 = []; try { list0 = JSON.parse(raw); } catch (e) { list0 = []; }
  const open = Array.isArray(list0) && list0.find((x) => x && x.status === 'open' && x.agent === 'fault-alert');
  if (open) return { ok: true, id: open.id, fired: false, already: true };
  // a failure whose line cites a request that is in the inbox (open or done) is already with a developer
  const todo = faultTodo(items, list0);
  // "the developer is fixing it" only while every cited request is still open; a closed one was answered already
  // (security review 02/11/2026: a closed id must not make the message promise a fix nobody is doing)
  if (!todo.length) return { ok: true, fired: false, covered: faultTodo(items, (Array.isArray(list0) ? list0 : []).filter((x) => x && x.status === 'open')).length === 0 };
  // security review 02/11/2026: through stateCas, so a request saved meanwhile is not dropped
  let r = devInboxAdd(raw, { agent: 'fault-alert', text: faultDevText(todo) }, nowIso);
  if (r.error) return { ok: false, error: r.error };
  const w = await stateCas(url, h, DEV_INBOX_KEY, (cur) => { r = devInboxAdd(cur, { agent: 'fault-alert', text: faultDevText(todo) }, nowIso); return r.error ? { write: false } : { value: JSON.stringify(r.list) }; }, () => tmo(10000)).catch(() => null);
  if (r.error) return { ok: false, error: r.error };
  if (!w || !w.written) return { ok: false, error: 'dev_inbox write' };
  const ft = r.created && fireOk ? devFireTarget(env) : null;
  if (!ft) return { ok: true, id: r.id, fired: false };
  const e = r.list.find((x) => x && x.id === r.id);
  try {
    const fr = await fetch(ft.url, { method: 'POST', signal: tmo(10000),
      headers: { Authorization: 'Bearer ' + ft.token, 'anthropic-beta': 'experimental-cc-routine-2026-04-01', 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
      body: JSON.stringify(ft.body || { text: devFireText(e) }) });
    const fj = fr.ok ? await fr.json().catch(() => ({})) : {};
    if (fj && fj.claude_code_session_id) {
      e.fired_session = fj.claude_code_session_id;
      await stateCas(url, h, DEV_INBOX_KEY, (cur) => { const l = devInboxFired(cur, r.id, fj.claude_code_session_id); return l ? { value: JSON.stringify(l) } : { write: false }; }, () => tmo(10000)).catch(() => null);
    }
    return { ok: true, id: r.id, fired: fr.ok };
  } catch (x) { return { ok: true, id: r.id, fired: false }; }
}
// The golden questions run by themselves (11/11/2026, Michael in the questionnaire: "do it: the assistant's check runs by
// itself"). That morning a change to the assistant's instructions dropped the golden score from 8 to 6, and it was
// seen only because the questions were run by hand. The deployed code carries a hash of the instruction files
// (WA_RULES_HASH, tools/domains-build.py). A watchdog tick that sees a hash it did not see before marks the run as
// pending; when the hash has stood still for GOLDEN_SETTLE_MS (several merges in a row are one run), at most once in
// GOLDEN_GAP_MS, on a working day between 07:00 and 20:00 in Israel, one request opens for the immediate developer
// (agent golden-auto, routine-dev-fire.md step 3g), which runs the ten questions and fixes or reports. The first hash
// ever seen is the baseline and runs nothing. Pure: prev = the stored state or null; hour and dow in Israel.
export const GOLDEN_KEY = 'golden_auto', GOLDEN_SETTLE_MS = 30 * 60e3, GOLDEN_GAP_MS = 6 * 3600e3, GOLDEN_AGENT = 'golden-auto';
export const GOLDEN_TEXT = 'the assistant\'s instruction files changed on main (routine-wa-core.md, routine-wa-assistant.md or wa-topics/): run the golden questions now, as project-files/assistant-golden.md and routine-dev-fire.md step 3g say, and close this request with the score';
export function goldenStep(prev, hash, nowIso, hourIL, dowIL) {
  const now = Date.parse(nowIso);
  if (!hash) return { state: prev || null, fire: false, changed: false };
  if (!prev || !prev.hash) return { state: { hash, seen_at: nowIso }, fire: false, changed: true };
  let st = prev, changed = false;
  if (st.hash !== hash) { st = { ...st, hash, seen_at: nowIso, pending: true }; changed = true; }
  if (!st.pending) return { state: st, fire: false, changed };
  const settled = now - Date.parse(st.seen_at) >= GOLDEN_SETTLE_MS;
  const gap = !st.fired_at || now - Date.parse(st.fired_at) >= GOLDEN_GAP_MS;
  const hours = dowIL >= 0 && dowIL <= 4 && hourIL >= 7 && hourIL < 20;
  return { state: st, fire: settled && gap && hours, changed };
}
const hourDowIL = (iso) => {
  const p = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Jerusalem', weekday: 'short', hour: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(iso));
  const g = (t) => (p.find((x) => x.type === t) || {}).value;
  return { hour: Number(g('hour')), dow: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(g('weekday')) };
};
// A golden-auto request is still open (11/11/2026, the wide trial's review, finding a): the change that request was opened
// for stays covered, but a newer change of the instructions must not be swallowed. It stays pending, so once the open
// request is closed the next watch round opens one for it. fired_at moves only when a request was really opened.
export function goldenAlready(st) {
  if (!st) return st;
  return { ...st, pending: !!st.hash && st.hash !== st.fired_hash };
}
// one open golden-auto request at a time; the fire is the same as the fault alert's
export async function runGolden(env, nowIso) {
  const k = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!k) return { ok: false, error: 'no service key' };
  const url = env.SUPABASE_URL || SB_LIVE, h = { apikey: k, Authorization: 'Bearer ' + k, 'Content-Type': 'application/json' };
  let st; try { st = await stateGet(env, [GOLDEN_KEY, DEV_INBOX_KEY], true); } catch (e) { return { ok: false, error: 'state read failed' }; }
  let prev = null; try { prev = JSON.parse((st[GOLDEN_KEY] && st[GOLDEN_KEY].value) || 'null'); } catch (e) { prev = null; }
  const t = hourDowIL(nowIso), g = goldenStep(prev, WA_RULES_HASH, nowIso, t.hour, t.dow);
  if (!g.fire) { if (g.changed) await stateSet(env, { [GOLDEN_KEY]: JSON.stringify(g.state) }); return { ok: true, fired: false, pending: !!(g.state && g.state.pending) }; }
  let r = null;
  const w = await stateCas(url, h, DEV_INBOX_KEY, (cur) => {
    let list = []; try { list = JSON.parse(cur || '[]'); } catch (e) { list = []; }
    if (Array.isArray(list) && list.some((x) => x && x.status === 'open' && x.agent === GOLDEN_AGENT)) { r = { already: true }; return { write: false }; }
    r = devInboxAdd(cur, { agent: GOLDEN_AGENT, text: GOLDEN_TEXT }, nowIso);
    return r.error ? { write: false } : { value: JSON.stringify(r.list) };
  }, () => tmo(10000), 2).catch(() => null); // two tries at most (security review 11/11/2026): this runs under the watch lock
  if (r && r.already) { const a = goldenAlready(g.state); await stateSet(env, { [GOLDEN_KEY]: JSON.stringify(a) }); return { ok: true, fired: false, already: true, pending: a.pending }; }
  if (!r || r.error || !w || !w.written) return { ok: false, error: (r && r.error) || 'dev_inbox write' };
  await stateSet(env, { [GOLDEN_KEY]: JSON.stringify({ ...g.state, pending: false, fired_at: nowIso, fired_hash: WA_RULES_HASH }) });
  const ft = r.created ? devFireTarget(env) : null;
  if (!ft) return { ok: true, id: r.id, fired: false };
  const e = r.list.find((x) => x && x.id === r.id);
  try {
    const fr = await fetch(ft.url, { method: 'POST', signal: tmo(10000),
      headers: { Authorization: 'Bearer ' + ft.token, 'anthropic-beta': 'experimental-cc-routine-2026-04-01', 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
      body: JSON.stringify(ft.body || { text: devFireText(e) }) });
    const fj = fr.ok ? await fr.json().catch(() => ({})) : {};
    if (fj && fj.claude_code_session_id) await stateCas(url, h, DEV_INBOX_KEY, (cur) => { const l = devInboxFired(cur, r.id, fj.claude_code_session_id); return l ? { value: JSON.stringify(l) } : { write: false }; }, () => tmo(10000), 2).catch(() => null);
    return { ok: true, id: r.id, fired: fr.ok };
  } catch (x) { return { ok: true, id: r.id, fired: false }; }
}
export async function runFaultAlert(env, nowIso) {
  const k = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!k) return { ok: false, error: 'no service key' };
  const url = env.SUPABASE_URL || SB_LIVE;
  let st; try { st = await stateGet(env, [FAULT_KEY, 'agent_log'], true); } catch (e) { return { ok: false, error: 'state read failed' }; }
  let prev = null; try { prev = JSON.parse((st[FAULT_KEY] && st[FAULT_KEY].value) || 'null'); } catch (e) { prev = null; }
  let log = []; try { log = JSON.parse((st.agent_log && st.agent_log.value) || '[]'); } catch (e) { log = []; }
  const since = (prev && prev.at) || new Date(Date.parse(nowIso) - FAULT_FIRST_MS).toISOString();
  const r = await fetch(url + '/rest/v1/audit_log?select=ts,title&table_name=eq.client_error&ts=gt.' + encodeURIComponent(since) + '&order=ts.asc&limit=50',
    { headers: { apikey: k, Authorization: 'Bearer ' + k }, signal: tmo(10000) }).catch(() => null);
  // a failed read is not "no errors": keep the old mark so the next tick looks again
  if (!r || !r.ok) return { ok: false, error: 'audit_log read ' + (r ? r.status : 'failed') };
  const rows = await r.json().catch(() => []);
  const { items, fault } = faultItems(prev, rows, Array.isArray(log) ? log : [], nowIso);
  let sentOk = true, fix = null;
  if (items.length) {
    // a fault already reported today was filtered above, so the fix is opened once a day per fault too
    const loud = items.filter((x) => !x.quiet);
    // a quiet item (expected: second checker missing, deliberate refusal) opens no developer request (07/11/2026)
    if (loud.length) { try { fix = await openFix(env, url, k, loud, nowIso, !(prev && prev.fired_day === dayIL(nowIso))); } catch (e) { fix = { ok: false }; } }
    if (loud.length) {
      const to = await ownerWa(env, url);
      const s = to ? await sendToOwner(env, to, faultText(loud, fix && (fix.fired || fix.already || fix.covered)), { kind: loud.some((x) => /^agentq?:wa-assistant$/.test(x.key)) ? 'watchdog' : 'fault', windowOpen: await ownerWindowOpen(env, url) }) : { ok: false, error: 'no owner' };
      sentOk = !!(s && s.ok);
    }
  }
  // not sent: the mark does not move, so the same faults are tried again next tick
  if (fix && fix.fired) fault.fired_day = dayIL(nowIso); else if (prev && prev.fired_day) fault.fired_day = prev.fired_day;
  if (sentOk) await stateSet(env, { [FAULT_KEY]: JSON.stringify(fault) });
  return { ok: true, items: items.length, sent: items.length ? sentOk : false, fix };
}
