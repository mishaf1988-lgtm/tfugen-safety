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
import { DEV_INBOX_KEY, devInboxAdd, devFireTarget, devFireText } from './api/routine-db.js';

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
  const add = (key, text, dev, agent) => { if (sent[key] || items.some((x) => x.key === key)) return; items.push(agent ? { key, text, dev, agent } : { key, text, dev }); };
  (errRows || []).forEach((r) => {
    if (!r || String(r.ts || '') <= since) return;
    let t; try { t = JSON.parse(String(r.title || '')); } catch (e) { return; }
    if (!t || !t.m) return;
    add('err:' + cut(t.m, 80) + '|' + (t.f || '') + '|' + (t.l || 0), '\u05e9\u05d2\u05d9\u05d0\u05d4 \u05d1\u05d0\u05e4\u05dc\u05d9\u05e7\u05e6\u05d9\u05d4 \u05d0\u05e6\u05dc \u05de\u05e9\u05ea\u05de\u05e9: ' + cut(t.m, 120) + (t.p ? ' (\u05de\u05e1\u05da ' + cut(t.p, 30) + ')' : ''), 'ERRDEV');
  });
  (agentLog || []).forEach((r) => {
    if (!r || r.ok !== false || String(r.at || '') <= since) return;
    add('agent:' + agentKey(r.agent), '\u05e1\u05d5\u05db\u05df \u05e9\u05e0\u05db\u05e9\u05dc, ' + agentKey(r.agent) + ': ' + cut(r.line, 120), 'AGENTDEV', agentSafe(r.agent));
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
// one request for the faults of this tick, then the fire; a failure here never stops the WhatsApp
async function openFix(env, url, k, items, nowIso, fireOk) {
  const h = { apikey: k, Authorization: 'Bearer ' + k, 'Content-Type': 'application/json' };
  let st; try { st = await stateGet(env, [DEV_INBOX_KEY], true); } catch (e) { return { ok: false }; }
  const raw = (st[DEV_INBOX_KEY] && st[DEV_INBOX_KEY].value) || '[]';
  // one open fault-alert request at a time: a flood of new keys cannot fill the inbox or fire again and again
  let list0 = []; try { list0 = JSON.parse(raw); } catch (e) { list0 = []; }
  const open = Array.isArray(list0) && list0.find((x) => x && x.status === 'open' && x.agent === 'fault-alert');
  if (open) return { ok: true, id: open.id, fired: false, already: true };
  const r = devInboxAdd(raw, { agent: 'fault-alert', text: faultDevText(items) }, nowIso);
  if (r.error) return { ok: false, error: r.error };
  const w = await fetch(url + '/rest/v1/server_state?on_conflict=key', { method: 'POST', headers: { ...h, Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify([{ key: DEV_INBOX_KEY, value: JSON.stringify(r.list), updated_at: nowIso }]), signal: tmo(10000) }).catch(() => null);
  if (!w || !w.ok) return { ok: false, error: 'dev_inbox write' };
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
      await fetch(url + '/rest/v1/server_state?on_conflict=key', { method: 'POST', headers: { ...h, Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify([{ key: DEV_INBOX_KEY, value: JSON.stringify(r.list), updated_at: nowIso }]), signal: tmo(10000) }).catch(() => null);
    }
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
    try { fix = await openFix(env, url, k, items, nowIso, !(prev && prev.fired_day === dayIL(nowIso))); } catch (e) { fix = { ok: false }; }
    const to = await ownerWa(env, url);
    const s = to ? await sendToOwner(env, to, faultText(items, fix && (fix.fired || fix.already)), { windowOpen: await ownerWindowOpen(env, url) }) : { ok: false, error: 'no owner' };
    sentOk = !!(s && s.ok);
  }
  // not sent: the mark does not move, so the same faults are tried again next tick
  if (fix && fix.fired) fault.fired_day = dayIL(nowIso); else if (prev && prev.fired_day) fault.fired_day = prev.fired_day;
  if (sentOk) await stateSet(env, { [FAULT_KEY]: JSON.stringify(fault) });
  return { ok: true, items: items.length, sent: items.length ? sentOk : false, fix };
}
