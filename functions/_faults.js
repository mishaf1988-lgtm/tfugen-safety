// Fault alert (31/10/2026, Michael: "you must keep a record and alert at a critical time; maybe an agent that manages
// it?", and in the questionnaire: "do it: an alert from the server at once"). The quality checker reads the faults once a
// day (06:43 Sunday to Thursday), so a fault on Friday waited for Sunday. Now every watchdog tick (hazard-file op:'watch',
// about every 15 minutes) looks for what is new since the last tick and sends Michael ONE WhatsApp with all of it:
//   * an error in a user's browser (audit_log table_name client_error, index.html _errReport);
//   * an agent that reported a failure (agent_log ok:false, routine-db agent_report).
// The same fault is said once a day (Israel day), at most FAULT_LINES lines and "and N more". No agent, no quota.
// The quality checker still fixes what it can in the morning; this only makes sure Michael hears of it in time.
import { stateGet, stateSet } from './_onedrive.js';
import { ownerWa, sendToOwner, ownerWindowOpen } from './_wa.js';
import { SB_LIVE, tmo } from './_shared.js';

export const FAULT_KEY = 'fault_alert', FAULT_LINES = 5, FAULT_FIRST_MS = 20 * 60e3;
const dayIL = (iso) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jerusalem' }).format(new Date(iso));
const cut = (s, n) => { s = String(s || '').replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 3) + '...' : s; };
const agentKey = (s) => String(s || '').replace(/^routine-/, '').replace(/-prompt$/, '').replace(/\.md$/, '');

// Pure: what to say now, and the state to keep. prev = {at, sent: {key: day}} or null.
export function faultItems(prev, errRows, agentLog, nowIso) {
  const since = (prev && prev.at) || new Date(Date.parse(nowIso) - FAULT_FIRST_MS).toISOString();
  const today = dayIL(nowIso);
  const sent = {};
  Object.entries((prev && prev.sent) || {}).forEach(([k, d]) => { if (d === today) sent[k] = d; });
  const items = [];
  const add = (key, text) => { if (sent[key] || items.some((x) => x.key === key)) return; items.push({ key, text }); };
  (errRows || []).forEach((r) => {
    if (!r || String(r.ts || '') <= since) return;
    let t; try { t = JSON.parse(String(r.title || '')); } catch (e) { return; }
    if (!t || !t.m) return;
    add('err:' + cut(t.m, 80) + '|' + (t.f || '') + '|' + (t.l || 0), '\u05e9\u05d2\u05d9\u05d0\u05d4 \u05d1\u05d0\u05e4\u05dc\u05d9\u05e7\u05e6\u05d9\u05d4 \u05d0\u05e6\u05dc \u05de\u05e9\u05ea\u05de\u05e9: ' + cut(t.m, 120) + (t.p ? ' (\u05de\u05e1\u05da ' + cut(t.p, 30) + ')' : ''));
  });
  (agentLog || []).forEach((r) => {
    if (!r || r.ok !== false || String(r.at || '') <= since) return;
    add('agent:' + agentKey(r.agent), '\u05e1\u05d5\u05db\u05df \u05e9\u05e0\u05db\u05e9\u05dc, ' + agentKey(r.agent) + ': ' + cut(r.line, 120));
  });
  items.forEach((x) => { sent[x.key] = today; });
  return { items, fault: { at: nowIso, sent } };
}
export function faultText(items) {
  const lines = items.slice(0, FAULT_LINES).map((x) => '- ' + x.text);
  if (items.length > FAULT_LINES) lines.push('- \u05d5\u05e2\u05d5\u05d3 ' + (items.length - FAULT_LINES));
  return '\u26a0\ufe0f \u05ea\u05e7\u05dc\u05d4 \u05d1\u05de\u05e2\u05e8\u05db\u05ea:\n' + lines.join('\n') + '\n\u05d1\u05d5\u05d3\u05e7 \u05d4\u05d0\u05d9\u05db\u05d5\u05ea \u05de\u05d8\u05e4\u05dc \u05d1\u05d6\u05d4 \u05d1\u05d1\u05d5\u05e7\u05e8. \u05d3\u05d7\u05d5\u05e3? \u05db\u05ea\u05d5\u05d1 \u05dc\u05d9 \u05db\u05d0\u05df.';
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
  let sentOk = true;
  if (items.length) {
    const to = await ownerWa(env, url);
    const s = to ? await sendToOwner(env, to, faultText(items), { windowOpen: await ownerWindowOpen(env, url) }) : { ok: false, error: 'no owner' };
    sentOk = !!(s && s.ok);
  }
  // not sent: the mark does not move, so the same faults are tried again next tick
  if (sentOk) await stateSet(env, { [FAULT_KEY]: JSON.stringify(fault) });
  return { ok: true, items: items.length, sent: items.length ? sentOk : false };
}
