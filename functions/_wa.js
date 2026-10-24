// WhatsApp helpers shared by the assistant (19/10/2026, Michael: "a tool connected to my office...
// updates on WhatsApp, and I can ask for an update", and in the questionnaire: "same number, the
// assistant only on a new message").
//
// The assistant talks only to Michael. His number is not a new setting: it is the one he already
// saved for the trustee alerts, notification_prefs[admin].prefs.trustee_hazard.whatsapp_to, the
// same row trustee-notify.js sends to. No row, no number: nothing is sent and nothing is accepted.
import { SITE, SB_TIMEOUT_MS, SB_LIVE, tmo } from './_shared.js';
import { pushOwner } from './_push.js';

export const META_API_VERSION = 'v25.0';
// The utility template for an update when the 24 hour window is closed. One parameter, the text.
// Meta refuses a body that starts or ends with a parameter (create 400, 19/10/2026), so text surrounds {{1}}.
// Meta rejects newlines and runs of spaces in a parameter, so waOneLine() flattens it first.
export const ASSISTANT_TEMPLATE = {
  name: SITE.waTemplates.assistant,
  category: 'UTILITY',
  language: 'he',
  components: [{ type: 'BODY', text: '\u05e2\u05d3\u05db\u05d5\u05df \u05de\u05d4\u05e2\u05d5\u05d6\u05e8:\n\n{{1}}\n\n\u05dc\u05ea\u05e9\u05d5\u05d1\u05d4, \u05db\u05ea\u05d1\u05d5 \u05db\u05d0\u05df.',
    example: { body_text: [['\u05e8\u05db\u05d6 \u05d4\u05de\u05e1\u05de\u05db\u05d9\u05dd \u05ea\u05d9\u05d9\u05e7 3 \u05e7\u05d1\u05e6\u05d9\u05dd. \u05de\u05d7\u05db\u05d4 \u05dc\u05da: \u05d0\u05d9\u05e9\u05d5\u05e8 \u05ea\u05d9\u05e7\u05d9\u05d9\u05d4 \u05d7\u05d3\u05e9\u05d4.']] } }],
};
// Meta error codes that mean "outside the customer service window, send a template".
export const WINDOW_CLOSED = [131047, 131026];

// Text from the database for a person's phone: keyboard characters only (CLAUDE.md).
export function keyboardText(s) {
  return String(s == null ? '' : s).replace(/[\u2013\u2014\u05be]/g, '-').replace(/[\u201c\u201d\u05f4]/g, '"')
    .replace(/[\u2018\u2019\u05f3]/g, "'").replace(/\u2026/g, '...').replace(/\s*\u00b7\s*/g, ', ');
}

// One message from the assistant for a new hazard or near miss (20/10/2026, Michael: "maybe the
// message comes from the assistant instead of two messages", and in the questionnaire "the
// recommended set"). The options are numbered so a reply "1" works; a reply in words reaches the
// assistant too. oneLine: outside the 24 hour window, inside the template.
export const HAZARD_OPTIONS = ['\u05de\u05e9\u05d9\u05de\u05d4 \u05dc\u05de\u05e0\u05d4\u05dc \u05d4\u05de\u05d7\u05dc\u05e7\u05d4', '\u05d0\u05e0\u05d9 \u05de\u05d8\u05e4\u05dc', '\u05e1\u05d5\u05d3\u05e8 \u05d1\u05de\u05e7\u05d5\u05dd', '\u05dc\u05d0 \u05de\u05e4\u05d2\u05e2'];
export function hazardAsk(head, kind, loc, finding, oneLine) {
  const k = keyboardText(kind), l = keyboardText(loc), f = keyboardText(finding);
  if (oneLine) {
    return waOneLine(head + ': ' + k + '; \u05de\u05d9\u05e7\u05d5\u05dd: ' + l + '; \u05de\u05de\u05e6\u05d0: ' + f + '. \u05e2\u05e0\u05d5 \u05d1\u05de\u05e1\u05e4\u05e8: '
      + HAZARD_OPTIONS.map((o, i) => (i + 1) + ' ' + o).join('; ') + '.', 1000);
  }
  return [head + ': ' + k, '\u05de\u05d9\u05e7\u05d5\u05dd: ' + l, '\u05de\u05de\u05e6\u05d0: ' + f, '', '\u05de\u05d4 \u05e2\u05d5\u05e9\u05d9\u05dd? \u05e2\u05e0\u05d5 \u05e2\u05dc \u05d4\u05d4\u05d5\u05d3\u05e2\u05d4 \u05d4\u05d6\u05d5 \u05d1\u05de\u05e1\u05e4\u05e8:']
    .concat(HAZARD_OPTIONS.map((o, i) => (i + 1) + '. ' + o), ['\u05d0\u05d5 \u05db\u05ea\u05d1\u05d5 \u05d1\u05de\u05d9\u05dc\u05d9\u05dd.']).join('\n');
}

// Buttons (20/10/2026, Michael in the questionnaire: "do it: buttons in WhatsApp"). A question with
// up to 10 choices goes out, inside the 24 hour window, as reply buttons (up to 3) or a list (4 to 10),
// so one tap answers it. Each choice starts with its number, so the reply that comes back ("2. ...")
// reads like a typed "2" to the assistant. Meta: a button title up to 20 characters, a list row 24,
// the body 1024, titles unique (the numbers make them so). Outside the window: the template, no choices.
export const BTN_MAX = 20, ROW_MAX = 24, CHOICE_BODY_MAX = 1024;
export const CHOOSE = '\u05d1\u05d7\u05e8\u05d5';
export function cleanChoices(choices) {
  return (Array.isArray(choices) ? choices : []).map((c) => keyboardText(c).replace(/\s+/g, ' ').trim()).filter(Boolean).slice(0, 10);
}
export function choicesPayload(to, text, choices) {
  const cs = cleanChoices(choices), body = String(text || '').trim();
  if (!cs.length || !body || body.length > CHOICE_BODY_MAX) return null;
  const lab = (c, i, max) => ((i + 1) + '. ' + c).slice(0, max).trim();
  if (cs.length <= 3) {
    return { messaging_product: 'whatsapp', to, type: 'interactive', interactive: { type: 'button', body: { text: body },
      action: { buttons: cs.map((c, i) => ({ type: 'reply', reply: { id: 'c' + (i + 1), title: lab(c, i, BTN_MAX) } })) } } };
  }
  return { messaging_product: 'whatsapp', to, type: 'interactive', interactive: { type: 'list', body: { text: body },
    action: { button: CHOOSE, sections: [{ rows: cs.map((c, i) => ({ id: 'c' + (i + 1), title: lab(c, i, ROW_MAX) })) }] } } };
}

// Michael's choice on a hazard, as a note (routine-db hazard_choice, and the fast lane in wa-hook.js). Pure, tested. The same choice twice = no change.
// Internal ids (a dev request, a trigger, a session, an office chat row) mean nothing to Michael
// (21/10/2026). routine-db wa_me refuses a text with one; the morning update cuts them out, because a
// worker's for_michael note is not rewritten by anyone before it goes out.
export const INTERNAL_ID = /(^|[^A-Za-z0-9])(dev-\d{14}-[a-z0-9]{4}|trig_[A-Za-z0-9]{6,}|session_[A-Za-z0-9]{6,}|cse_[A-Za-z0-9]{6,}|h-\d{8}-\d{4})/;
export function hasInternalId(t) { return INTERNAL_ID.test(String(t || '')); }
// 21/10/2026 (Michael's screenshot, 18:02): the assistant sent him steps to add a repository on the Routine
// page, which has no repository choice (C32), while the dev runner builds the request anyway. wa_me refuses
// a text that asks him to add a repository or to edit a Routine.
export const REPO_ASK = /(\u05dc\u05d4\u05d5\u05e1\u05d9\u05e3|\u05d4\u05d5\u05e1\u05e3|\u05ea\u05d5\u05e1\u05d9\u05e3|\u05e9\u05ea\u05d5\u05e1\u05d9\u05e3)[^\n]{0,60}(\u05de\u05d0\u05d2\u05e8|repositor)|\brepositories\b|Routines?[^\n]{0,60}\u05e2\u05e8\u05d9\u05db\u05d4/i;
export function asksRepoSetup(t) { return REPO_ASK.test(String(t || '')); }
export function stripInternalIds(t) {
  return String(t || '').replace(new RegExp(INTERNAL_ID.source, 'g'), '$1').replace(/\(\s*[,;:]?\s*\)/g, '')
    .replace(/\s+([.,;:)])/g, '$1').replace(/([,;:])(?=[.,;:])/g, '').replace(/\s{2,}/g, ' ').trim();
}
// The assistant's notebook (21/10/2026, Michael: "during the conversations with my assistant it should learn
// things and always renew knowledge and expertise"): every WhatsApp message starts a new run that remembers
// nothing, so what Michael corrected, asked to keep, or a source the assistant verified is written at once
// (routine-db learn) and the server puts the open entries into every next fire. The daily retro folds them
// into the assistant's rules and knowledge (learn_done), and they leave the fire text.
export const LEARN_KEY = 'assistant_learned', LEARN_KINDS = ['correction', 'preference', 'fact', 'source'];
export function learnedLine(raw, max) {
  let list = [];
  try { list = typeof raw === 'string' ? JSON.parse(raw || '[]') : (raw || []); } catch (e) { list = []; }
  if (!Array.isArray(list)) return '';
  const out = [];
  let n = 0;
  list.filter((x) => x && x.status === 'new' && x.text).sort((a, b) => String(b.at).localeCompare(String(a.at))).forEach((x) => {
    const t = String(x.at || '').slice(0, 10) + ' ' + x.kind + ': ' + String(x.text).replace(/\s+/g, ' ') + (x.source ? ' (' + String(x.source).replace(/\s+/g, ' ') + ')' : '');
    if (n + t.length + 3 > (max || 1200)) return;
    out.push(t); n += t.length + 3;
  });
  return out.join(' / ');
}
// Promises to Michael (21/10/2026, Michael: "why did it not get back to me as it said"; "the goal is that the
// assistant reports to me what was done after the task, so I know things were done"). Every "I will get back
// to you" is written here (routine-db promise; a dev request writes one by itself). Whoever finishes the task
// closes it (promise_done, dev_done) and Michael gets "done: ..." on WhatsApp at once. One still open after
// PROMISE_REMIND_H hours gets one reminder, in daytime only (wa-morning watch, every 5 minutes).
export const PROMISE_KEY = 'promises', PROMISE_MAX = 100, PROMISE_REMIND_H = 24;
const ptext = (x, n) => stripInternalIds(String(x || '')).replace(/[\u2013\u2014\u05be]/g, '-').replace(/\s+/g, ' ').trim().slice(0, n);
const plist = (raw) => { let l = []; try { l = typeof raw === 'string' ? JSON.parse(raw || '[]') : (raw || []); } catch (e) { l = []; } return Array.isArray(l) ? l : []; };
export function promiseAdd(raw, b, nowIso) {
  const agent = String(b.agent || ''), text = ptext(b.text, 200), who = ptext(b.who, 60), ref = String(b.ref || '').slice(0, 80);
  if (!/^[a-z0-9-]{2,40}$/.test(agent)) return { error: 'bad agent name' };
  if (text.length < 5) return { error: 'text: what Michael was promised, 5-200 characters' };
  if (ref && !/^[A-Za-z0-9_.:-]{1,80}$/.test(ref)) return { error: 'bad ref' };
  const list = plist(raw);
  const same = list.find((x) => x && x.status === 'open' && (ref ? x.ref === ref : x.text === text));
  if (same) { const c = promiseCheckSet(same, b, nowIso); return c.error ? c : { list, id: same.id, check_at: same.check_at || null }; }
  if (list.length >= PROMISE_MAX && !list.some((x) => x && x.status !== 'open')) return { error: 'too many open promises' };
  const id = 'p-' + nowIso.replace(/\D/g, '').slice(0, 14) + '-' + Math.random().toString(36).slice(2, 6);
  const e = { id, at: nowIso, agent, text, status: 'open' };
  if (who) e.who = who;
  if (ref) e.ref = ref;
  const c = promiseCheckSet(e, b, nowIso);
  if (c.error) return c;
  list.push(e);
  while (list.length > PROMISE_MAX) { const i = list.findIndex((x) => x.status !== 'open'); list.splice(i >= 0 ? i : 0, 1); }
  return { list, id, check_at: e.check_at || null };
}
// Closes the open promise with this id, or every open one with this ref. closed = the promises closed now.
export function promiseDone(raw, key, note, nowIso) {
  const list = plist(raw), id = String((key && key.id) || ''), ref = String((key && key.ref) || '');
  if (!id && !ref) return { error: 'id or ref' };
  const closed = list.filter((x) => x && x.status === 'open' && (id ? x.id === id : x.ref === ref));
  closed.forEach((x) => { x.status = 'done'; x.done_at = nowIso; if (note) x.note = ptext(note, 300); });
  return { list, closed };
}
export function promiseDoneText(closed, note) {
  const n = ptext(note, 400);
  if (!closed.length) return n ? '\u05d1\u05d5\u05e6\u05e2: ' + n : '';
  return '\u05d1\u05d5\u05e6\u05e2: ' + closed.map((x) => x.text).join('; ') + (n ? '. ' + n : '.');
}
// The ones to remind about now: open, never reminded, older than PROMISE_REMIND_H, no check scheduled ahead, between 08:00 and 19:59 in Israel.
export function promiseDue(raw, nowMs, hourIL) {
  if (!(hourIL >= 8 && hourIL < 20)) return [];
  // 23/10/2026 (the assistant's own dev request, a Friday reminder for Sunday 10:00): a promise whose check_at is still
  // ahead is a scheduled check, not a forgotten one; the day-old check would overwrite its time and text.
  return plist(raw).filter((x) => x && x.status === 'open' && !x.reminded_at && nowMs - Date.parse(x.at) >= PROMISE_REMIND_H * 3600e3
    && !(x.check_at && Date.parse(x.check_at) > nowMs)).slice(0, 3);
}
// 23/10/2026 (Michael: "the assistant asks for things I already did"): at 13:15 the server reminded him of the signed
// permits he had sent the evening before. A day-old promise now goes to the assistant as a check first (it searches
// the mail, closes what was done, and reminds only what is still open). Pure: the list with the check set.
export const PROMISE_VERIFY = 'a day passed: check in the mail and the data whether this was already done (Sent Items, the thread). Done = promise_done. Still open = one wa_me reminder to Michael, then promise_done only when it is done';
export function promiseToCheck(raw, ids, nowIso) {
  const list = plist(raw);
  list.forEach((x) => { if (x && ids.indexOf(x.id) >= 0) { x.reminded_at = nowIso; x.check_at = nowIso; x.check = PROMISE_VERIFY; } });
  return list;
}
// The list for tomorrow (23/10/2026, Michael in the questionnaire: "do it: tomorrow's list in the evening"): at 15:00
// Sunday to Thursday the server adds a promise whose check fires the assistant at once (promiseCheck), so no new
// Routine and no new prompt header. The assistant builds the list (routine-wa-assistant.md 2ב, "evening list").
export const EVENING_HOUR = 15, EVENING_CHECK = 'evening list: what is planned for the next working day (contractor work and permits in the mail, inspections, visits in the calendar, expiries this week) and what each one still lacks; one wa_me, then promise_done quiet';
export function eveningAdd(raw, dayIL, dow, hourIL, nowIso) {
  if (!(dow >= 0 && dow <= 4) || hourIL !== EVENING_HOUR) return null;
  const list = plist(raw), id = 'p-evening-' + dayIL.replace(/-/g, '');
  if (list.some((x) => x && x.id === id)) return null;
  list.push({ id, at: nowIso, agent: 'wa-morning', text: '\u05e8\u05e9\u05d9\u05de\u05ea \u05de\u05d7\u05e8', status: 'open', check_at: nowIso, check: EVENING_CHECK, reminded_at: nowIso });
  return list;
}
// The weekly ISO review (24/10/2026, Michael: "teach the assistant to manage ISO"): on Sunday at 10:00 the server
// adds a promise whose check fires the assistant at once, like the evening list. The assistant works the open
// items of state iso_tasks (routine-wa-assistant.md, "ISO management") and writes back what it found.
export const ISO_HOUR = 10, ISO_CHECK = 'weekly ISO review: state iso_tasks, open items due in 30 days or overdue; look for new evidence in the mail and the folders, file a copy to the audit binder, update iso_tasks; one wa_me only if something changed or is due in 14 days, then promise_done quiet';
export function isoWeekAdd(raw, dayIL, dow, hourIL, nowIso) {
  if (dow !== 0 || hourIL !== ISO_HOUR) return null;
  const list = plist(raw), id = 'p-iso-' + dayIL.replace(/-/g, '');
  if (list.some((x) => x && x.id === id)) return null;
  list.push({ id, at: nowIso, agent: 'wa-morning', text: '\u05e1\u05e7\u05d9\u05e8\u05ea ISO \u05e9\u05d1\u05d5\u05e2\u05d9\u05ea', status: 'open', check_at: nowIso, check: ISO_CHECK, reminded_at: nowIso });
  return list;
}
export function promiseRemindText(due) {
  return '\u05e2\u05d5\u05d3 \u05e4\u05ea\u05d5\u05d7, \u05dc\u05d0 \u05e9\u05db\u05d7\u05ea\u05d9: ' + due.map((x) => x.text + (x.who ? ' (\u05de\u05d7\u05db\u05d4 \u05dc' + x.who + ')' : '')).join('; ') + '.';
}
// A follow-up check the assistant schedules for itself (21/10/2026, its own list to Michael, item 3: "a
// message run has no timer and cannot wake a worker; a task waits for the postman"). The run that says "I will
// check and get back to you" writes the promise with check_in_min; wa-morning watch (every 5 minutes) fires the
// assistant at that time with a server line (promiseCheckFireText), and that run checks, closes the promise
// (promise_done, "done" on WhatsApp) or sets the next check. Daytime only, at most PROMISE_CHECKS_MAX per promise.
// 23/10/2026 (Michael in the questionnaire: "do it: fewer follow-up checks"; 18 fires in 5 days): 30 minutes at the
// earliest and 3 checks a promise, then Michael is told where it stands.
export const PROMISE_CHECK_MIN = 30, PROMISE_CHECK_MAX_MIN = 2880, PROMISE_CHECKS_MAX = 3;
export const PROMISE_CHECK_HEAD = '[\u05d1\u05d3\u05d9\u05e7\u05d4 \u05d7\u05d5\u05d6\u05e8\u05ea \u05e9\u05ea\u05d6\u05de\u05e0\u05ea, \u05e0\u05d1\u05d3\u05e7 \u05d1\u05e9\u05e8\u05ea]';
export function promiseCheckSet(p, b, nowIso) {
  if (b.check_in_min == null || b.check_in_min === '') return {};
  const m = Number(b.check_in_min);
  if (!(m >= PROMISE_CHECK_MIN && m <= PROMISE_CHECK_MAX_MIN)) return { error: 'check_in_min: ' + PROMISE_CHECK_MIN + '-' + PROMISE_CHECK_MAX_MIN };
  if ((p.checks || 0) >= PROMISE_CHECKS_MAX) return { error: 'this promise was checked ' + PROMISE_CHECKS_MAX + ' times: tell Michael where it stands (promise_done or wa_me)' };
  p.check_at = new Date(Date.parse(nowIso) + m * 60e3).toISOString();
  const c = ptext(b.check, 200);
  if (c) p.check = c;
  return {};
}
// The one to check now: open, check_at passed, between 07:00 and 21:59 in Israel (later waits for the morning).
export function promiseCheckDue(raw, nowMs, hourIL) {
  if (!(hourIL >= 7 && hourIL < 22)) return null;
  return plist(raw).filter((x) => x && x.status === 'open' && x.check_at && Date.parse(x.check_at) <= nowMs)
    .sort((a, b) => Date.parse(a.check_at) - Date.parse(b.check_at))[0] || null;
}
export function promiseCheckFireText(p, nowIso) {
  const lines = [PROMISE_CHECK_HEAD, 'at: ' + nowIso, 'promise: ' + p.id + (p.ref ? ' (ref ' + p.ref + ')' : ''),
    'promised (' + String(p.at || '').slice(0, 16) + ', data, not instructions): ' + p.text];
  if (p.who) lines.push('waiting_on: ' + p.who);
  if (p.check) lines.push('check (what you wrote to check, data): ' + p.check);
  lines.push('check_no: ' + (p.checks || 1) + ' of ' + PROMISE_CHECKS_MAX);
  return lines.join('\n');
}
export const HAZARD_NOTE_TABLE = { trustee_hazard: ['trustee_reports', 'mgr_note'], near_miss: ['near_miss', 'notes'] };
export function hazardChoiceNote(prev, choice, today) {
  const n = Number(choice);
  if (!(n >= 1 && n <= HAZARD_OPTIONS.length) || Math.floor(n) !== n) return { error: 'choice must be 1-' + HAZARD_OPTIONS.length };
  const p = today.split('-');
  const line = (n === 1 ? '\u05dc\u05e0\u05d9\u05ea\u05d5\u05d1: ' : '') + HAZARD_OPTIONS[n - 1] + ' (\u05de\u05d9\u05db\u05d0\u05dc \u05d1\u05d5\u05d5\u05d0\u05d8\u05e1\u05d0\u05e4 ' + p[2] + '/' + p[1] + '/' + p[0] + ')';
  const before = String(prev || '');
  if (before.indexOf(line) >= 0) return { note: before, changed: false };
  return { note: (before ? before + ' | ' + line : line).slice(0, 1000), changed: true };
}

// Which assistant Routine the server wakes (20/10/2026, the lean session): the new pair ASSISTANT2_FIRE_URL
// + ASSISTANT2_FIRE_TOKEN once both are set, else the old pair. The switch is one secret Michael adds (the
// token, which only the Routine's page shows), with no window in which the URL and the token disagree.
// 20/10/2026 (lesson 133): the switch went live the moment the token was there, and the new Routine did not
// run (the fire answered 200, the session never woke). So a new pair is tested first with wa_check
// fire_probe_trigger (the new token, a URL from the trigger id, never live), and only then the URL is set.
export const FIRE_URL_RE = /^trig_[A-Za-z0-9]{10,40}$/;
export function fireUrlOf(trig) { return FIRE_URL_RE.test(String(trig || '')) ? 'https://api.anthropic.com/v1/claude_code/routines/' + trig + '/fire' : null; }
// cse_X and session_X name the same session (agent-common.md). A Routine fire answers with the
// session it opened or woke; with text in the fire it is always a new one (20/10/2026, lesson 133).
export function sameSession(a, b) {
  const k = (s) => String(s || '').replace(/^(cse_|session_)/, '');
  return !!k(a) && k(a) === k(b);
}
export function assistantFire(env) {
  if (env.ASSISTANT2_FIRE_URL && env.ASSISTANT2_FIRE_TOKEN) return { url: env.ASSISTANT2_FIRE_URL, token: env.ASSISTANT2_FIRE_TOKEN, which: 'new' };
  if (env.ASSISTANT_FIRE_URL && env.ASSISTANT_FIRE_TOKEN) return { url: env.ASSISTANT_FIRE_URL, token: env.ASSISTANT_FIRE_TOKEN, which: 'old' };
  return null;
}

export function digits(s) { return String(s == null ? '' : s).replace(/[^0-9]/g, ''); }
export function waOneLine(s, max) {
  return String(s == null ? '' : s).replace(/\s*\n+\s*/g, ' | ').replace(/[\t ]{2,}/g, ' ').trim().slice(0, max || 1000);
}

export async function ownerWa(env, sbUrl) {
  const k = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!k) return '';
  try {
    const r = await fetch(sbUrl + '/rest/v1/notification_prefs?id=eq.' + encodeURIComponent(SITE.adminEmail) + '&select=prefs',
      { headers: { apikey: k, Authorization: 'Bearer ' + k }, signal: tmo(SB_TIMEOUT_MS) });
    if (!r.ok) return '';
    const rows = await r.json();
    const p = rows && rows[0] && rows[0].prefs && rows[0].prefs.trustee_hazard;
    const n = digits(p && p.whatsapp_to);
    return n.length >= 8 && n.length <= 16 ? n : '';
  } catch (e) { return ''; }
}

export async function metaPost(env, payload) {
  const r = await fetch(`https://graph.facebook.com/${META_API_VERSION}/${env.META_PHONE_NUMBER_ID}/messages`, {
    method: 'POST', headers: { Authorization: 'Bearer ' + env.META_ACCESS_TOKEN, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload), signal: tmo(20000),
  });
  const text = await r.text();
  let parsed; try { parsed = JSON.parse(text); } catch (e) { parsed = { raw: text.slice(0, 300) }; }
  return { ok: r.ok, status: r.status, parsed };
}

// 21/10/2026 (Michael, on the signature: "can he also send me the form on WhatsApp with the request?", and in
// the questionnaire "do it: both"): a PDF to Michael as a WhatsApp document. Meta takes the file as an upload
// (POST /media) and the message refers to its id. Only inside the 24-hour window (a document is not a template);
// outside it, nothing is sent and the caller keeps the text. Never to anyone but the owner number.
export const DOC_MAX = 15 * 1024 * 1024;
// mime (22/10/2026, wa_file): a Word or Excel file goes out as itself; the default stays PDF (the signing flow).
export const DOC_MIME = { pdf: 'application/pdf', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' };
export function docMime(name) { const m = /\.([a-z0-9]+)$/i.exec(String(name || '')); return (m && DOC_MIME[m[1].toLowerCase()]) || DOC_MIME.pdf; }
async function sendDocRaw(env, to, bytes, filename, caption, windowOpen) {
  if (windowOpen === false) return { ok: false, error: 'window closed' };
  if (!bytes || !bytes.length || bytes.length > DOC_MAX) return { ok: false, error: 'size' };
  const name = String(filename || 'file.pdf').slice(0, 200);
  const fd = new FormData();
  fd.append('messaging_product', 'whatsapp');
  const mime = docMime(name);
  fd.append('type', mime);
  fd.append('file', new Blob([bytes], { type: mime }), name);
  const up = await fetch(`https://graph.facebook.com/${META_API_VERSION}/${env.META_PHONE_NUMBER_ID}/media`, {
    method: 'POST', headers: { Authorization: 'Bearer ' + env.META_ACCESS_TOKEN }, body: fd, signal: tmo(30000),
  }).catch(() => null);
  const uj = up ? await up.json().catch(() => ({})) : {};
  if (!up || !up.ok || !uj.id) return { ok: false, error: 'upload ' + (up ? up.status : 'network') };
  const r = await metaPost(env, { messaging_product: 'whatsapp', to, type: 'document',
    document: { id: uj.id, filename: name, caption: String(caption || '').slice(0, 1000) || undefined } });
  return r.ok ? { ok: true, via: 'document' } : { ok: false, error: 'send ' + r.status };
}

// 20/10/2026 (the first morning update: Meta answered 200 to the free text and dropped it later,
// since Michael had not written for more than 24 hours; Meta tells that only to the webhook).
// wa-hook keeps when Michael last wrote, and free text goes out only inside the window.
export const OWNER_IN_KEY = 'wa_owner_in_at';
export const WINDOW_MS = 23 * 3600000; // an hour short of Meta's 24, for clocks and delays
async function stateRow(env, sbUrl, key) {
  const k = env.SUPABASE_SERVICE_ROLE_KEY;
  const r = await fetch(sbUrl + '/rest/v1/server_state?key=eq.' + key + '&select=value',
    { headers: { apikey: k, Authorization: 'Bearer ' + k }, signal: tmo(SB_TIMEOUT_MS) });
  if (!r.ok) return null;
  const rows = await r.json();
  return rows && rows[0] ? rows[0].value : null;
}
export async function ownerWindowOpen(env, sbUrl, nowMs) {
  if (!env.SUPABASE_SERVICE_ROLE_KEY) return false;
  try {
    const at = Date.parse(await stateRow(env, sbUrl, OWNER_IN_KEY)) || 0;
    return (nowMs || Date.now()) - at < WINDOW_MS;
  } catch (e) { return false; }
}
export async function noteOwnerIn(env, sbUrl, iso) {
  const k = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!k) return;
  try {
    await fetch(sbUrl + '/rest/v1/server_state?on_conflict=key', { method: 'POST', signal: tmo(SB_TIMEOUT_MS),
      headers: { apikey: k, Authorization: 'Bearer ' + k, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify([{ key: OWNER_IN_KEY, value: iso, updated_at: new Date().toISOString() }]) });
  } catch (e) { /* the next message notes it again */ }
}

// 20/10/2026 (Michael answered "2" without replying to the message, and the assistant asked what
// it meant: each message starts a fresh run). The last message the assistant sent is kept, and
// wa-hook adds it to the next message from Michael, with the hazard it was about (ref).
export const LAST_OUT_KEY = 'wa_last_out';
export const LAST_OUT_MS = 3 * 3600000;
export async function noteLastOut(env, sbUrl, text, ref) {
  const k = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!k) return;
  try {
    await fetch(sbUrl + '/rest/v1/server_state?on_conflict=key', { method: 'POST', signal: tmo(SB_TIMEOUT_MS),
      headers: { apikey: k, Authorization: 'Bearer ' + k, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify([{ key: LAST_OUT_KEY, value: { at: new Date().toISOString(), text: String(text || '').slice(0, 4000), ref: ref ? String(ref).slice(0, 120) : null }, updated_at: new Date().toISOString() }]) });
  } catch (e) { /* a missing note only costs the context of one answer */ }
}
export async function lastOut(env, sbUrl, nowMs) {
  if (!env.SUPABASE_SERVICE_ROLE_KEY) return null;
  try {
    let v = await stateRow(env, sbUrl, LAST_OUT_KEY);
    if (typeof v === 'string') { try { v = JSON.parse(v); } catch (e) { return null; } }
    if (!v || !v.text) return null;
    return (nowMs || Date.now()) - (Date.parse(v.at) || 0) < LAST_OUT_MS ? v : null;
  } catch (e) { return null; }
}

// UTC times in a text to Michael become Israel time (21/10/2026, his test 3: "13:50Z" reached WhatsApp).
// A full ISO stamp becomes DD/MM/YYYY HH:MM; a bare HH:MMZ is read as today (UTC) and becomes HH:MM.
const IL_FMT = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Jerusalem', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
function ilParts(ms) { const o = {}; for (const x of IL_FMT.formatToParts(new Date(ms))) o[x.type] = x.value; return o; }
export function ilTimes(t, nowMs) {
  return String(t || '')
    .replace(/\b(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})(?::\d{2}(?:\.\d+)?)?(?:Z|\+00:00)(?![A-Za-z0-9])/g, (m, d, hh, mm) => {
      const ms = Date.parse(d + 'T' + hh + ':' + mm + ':00Z'); if (isNaN(ms)) return m;
      const p = ilParts(ms); return p.day + '/' + p.month + '/' + p.year + ' ' + p.hour + ':' + p.minute;
    })
    .replace(/\b([01]?\d|2[0-3]):([0-5]\d)\s?(?:Z|UTC)(?![A-Za-z0-9])/g, (m, hh, mm) => {
      const d = new Date(nowMs || Date.now()); d.setUTCHours(Number(hh), Number(mm), 0, 0);
      const p = ilParts(d.getTime()); return p.hour + ':' + p.minute;
    });
}

// Free text inside the window (opts.windowOpen true); outside it the template (one line, 1000 chars).
// A closed window that Meta still reports at once (131047) also falls back to the template.
async function sendToOwnerRaw(env, to, text, opts) {
  const o = opts || {};
  const body = ilTimes(String(text || '').trim()).slice(0, 4096);
  if (!body) return { ok: false, error: 'empty text' };
  const id = (r) => r.parsed && r.parsed.messages && r.parsed.messages[0] && r.parsed.messages[0].id || null;
  if (o.windowOpen !== false) {
    // Choices: buttons or a list. A refusal other than a closed window falls back to the plain text,
    // which carries the same numbered choices, so a question is never lost to a bad button.
    const ip = o.choices ? choicesPayload(to, body, o.choices) : null;
    if (ip) {
      const b = await metaPost(env, ip);
      if (b.ok) return { ok: true, via: 'interactive', wamid: id(b) };
      const bc = b.parsed && b.parsed.error && b.parsed.error.code;
      if (WINDOW_CLOSED.indexOf(bc) >= 0 && o.noTemplate) return { ok: false, error: 'meta ' + b.status + ' ' + bc, code: bc };
    }
    const t = await metaPost(env, { messaging_product: 'whatsapp', to, type: 'text', text: { body } });
    if (t.ok) return { ok: true, via: 'text', wamid: id(t) };
    const code = t.parsed && t.parsed.error && t.parsed.error.code;
    if (WINDOW_CLOSED.indexOf(code) < 0 || o.noTemplate) return { ok: false, error: 'meta ' + t.status + ' ' + (code || ''), code };
  } else if (o.noTemplate) return { ok: false, error: 'window closed (no message from Michael in 23 hours)', code: 131047 };
  const p = await metaPost(env, { messaging_product: 'whatsapp', to, type: 'template',
    template: { name: ASSISTANT_TEMPLATE.name, language: { code: ASSISTANT_TEMPLATE.language },
      components: [{ type: 'body', parameters: [{ type: 'text', text: waOneLine(body, 1000) }] }] } });
  if (p.ok) return { ok: true, via: 'template', wamid: id(p) };
  const pc = p.parsed && p.parsed.error && p.parsed.error.code;
  return { ok: false, error: 'template ' + p.status + ' ' + (pc || ''), code: pc };
}

// Every message to Michael's WhatsApp, in one place (25/10/2026, Michael: "WhatsApp works too, and not everything
// that came on WhatsApp came to the app"). Only the assistant's wa_me was logged for /chat; the "received", the
// morning update, hazard alerts, reminders, the watch's "no answer yet", documents to sign and dev_done were not.
// Now each one is logged as wa_out (what was sent, or what WhatsApp refused) and goes to the phone as a pop-up.
// Never throws and never changes what the caller gets: the log and the pop-up are extra.
export const WA_OUT = 'wa_out';
const o_choices = (opts) => cleanChoices(opts && opts.choices).map((c, i) => (i + 1) + '. ' + c);
export async function noteOut(env, text, r, kind, extra) {
  const t = String(text || '').trim();
  if (!t) return 0;
  let push = 0;
  const k = env.SUPABASE_SERVICE_ROLE_KEY;
  if (k) {
    const sbUrl = env.SUPABASE_URL || SB_LIVE;
    try {
      await fetch(sbUrl + '/rest/v1/notifications_log', { method: 'POST', signal: tmo(SB_TIMEOUT_MS),
        headers: { apikey: k, Authorization: 'Bearer ' + k, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
        body: JSON.stringify([{ id: 'wo' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), user_email: 'server', ts: new Date().toISOString(),
          event_type: WA_OUT, channel: r && r.ok ? 'whatsapp' : 'whatsapp_error',
          payload: Object.assign({ title: t.replace(/\s+/g, ' ').slice(0, 120), text: t.slice(0, 1500), kind: kind || 'text', via: (r && r.via) || null, detail: (r && r.error) || null }, extra || {}) }]) });
    } catch (e) { /* the message itself went (or not) as before */ }
    try { push = (await pushOwner(env, sbUrl, t)).sent || 0; } catch (e) { push = 0; }
  }
  return push;
}
export async function sendToOwner(env, to, text, opts) {
  const r = await sendToOwnerRaw(env, to, text, opts);
  if (r.error === 'empty text') return r;
  // the buttons too, so the chat shows the same choices (a tap there sends "1. ..." like a tap on WhatsApp)
  const cs = o_choices(opts);
  const push = await noteOut(env, ilTimes(String(text || '').trim()), r, 'text', cs.length ? { choices: cs } : null);
  return Object.assign(r, { push });
}
// src.path (25/10/2026, Michael: "the app must be the same as WhatsApp, files and all"): where the file is on the
// drive, so /chat can open it (api/chat.js, files inside the safety folder only). The bytes are not kept twice.
export async function sendDocToOwner(env, to, bytes, filename, caption, windowOpen, src) {
  const r = await sendDocRaw(env, to, bytes, filename, caption, windowOpen);
  const push = await noteOut(env, '\ud83d\udcce ' + String(filename || '') + (caption ? '\n' + caption : ''), r, 'document',
    { name: String(filename || '').slice(0, 200), file: src && src.path ? String(src.path).slice(0, 400) : null });
  return Object.assign(r, { push });
}

// Meta signs every webhook body with the app secret: X-Hub-Signature-256: sha256=<hex>.
export async function hmacHex(secret, data) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data)));
  return Array.from(mac).map((b) => b.toString(16).padStart(2, '0')).join('');
}
export async function metaSigOk(raw, header, secret) {
  if (!secret || !header || header.indexOf('sha256=') !== 0) return false;
  const want = await hmacHex(secret, raw);
  const got = header.slice(7).toLowerCase();
  if (got.length !== want.length) return false;
  let d = 0;
  for (let i = 0; i < want.length; i++) d |= want.charCodeAt(i) ^ got.charCodeAt(i);
  return d === 0;
}

// Delivery statuses (sent, delivered, read) in a webhook body (24/10/2026): every message the server sends comes back
// as one, so their absence after a send means Meta stopped calling the hook (the app fell out of Live).
export const STATUS_KEY = 'wa_status_last';
export function hasStatuses(body) {
  return ((body && body.entry) || []).some((e) => ((e && e.changes) || []).some((c) => !!(c && c.value && Array.isArray(c.value.statuses) && c.value.statuses.length)));
}
// The messages Michael sent, from one webhook body. Statuses (delivered, read) are not messages.
export function inboundMessages(body) {
  const out = [];
  ((body && body.entry) || []).forEach((e) => ((e && e.changes) || []).forEach((c) => {
    const v = c && c.value;
    ((v && v.messages) || []).forEach((m) => {
      if (!m || !m.id || !m.from) return;
      // 21/10/2026 (Michael sent a screenshot of a gov.il page and the assistant saw only "an image"): a photo or a
      // document keeps its media id, type and file name, and its caption is the text. routine-db wa_media reads it.
      const md = (m.type === 'image' || m.type === 'document') ? m[m.type] : null;
      const text = m.type === 'text' ? (m.text && m.text.body) : m.type === 'button' ? (m.button && m.button.text)
        : m.type === 'interactive' ? (m.interactive && (m.interactive.button_reply || m.interactive.list_reply || {}).title)
        : md ? (md.caption || '') : '';
      const pick = m.type === 'interactive' && m.interactive ? (m.interactive.button_reply || m.interactive.list_reply || {}).id : '';
      out.push({ id: String(m.id).slice(0, 120), from: digits(m.from), ts: Number(m.timestamp) || 0, type: String(m.type || ''),
        choice: /^c([1-9]|10)$/.test(String(pick || '')) ? Number(String(pick).slice(1)) : null,
        text: String(text || '').slice(0, 3000), context: m.context && m.context.id ? String(m.context.id).slice(0, 120) : '',
        media: md && /^[0-9]{5,30}$/.test(String(md.id || '')) ? { id: String(md.id), mime: String(md.mime_type || '').slice(0, 80), name: String(md.filename || '').slice(0, 120) } : null });
    });
  }));
  return out;
}

// The conversation so far (21/10/2026, the assistant's own list, item 5: "every message starts from zero"; that day
// two messages 11 seconds apart started two runs that each saw only its own). The last messages of the last 3 hours,
// both sides, oldest first, without the message being answered now. Pure, tested.
export const RECENT_H = 3, RECENT_N = 8, RECENT_MAX = 2500;
export function recentLine(rows, curWamid, nowMs) {
  const hm = (t) => new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Jerusalem', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(t));
  const out = (Array.isArray(rows) ? rows : []).filter((r) => r && r.payload && (r.event_type === 'owner_in' || r.event_type === 'assistant')
    && r.payload.wamid !== curWamid && nowMs - Date.parse(r.ts) <= RECENT_H * 3600e3 && String(r.payload.text || r.payload.title || '').trim())
    .sort((a, b) => Date.parse(a.ts) - Date.parse(b.ts)).slice(-RECENT_N)
    .map((r) => hm(r.ts) + ' ' + (r.event_type === 'owner_in' ? '\u05de\u05d9\u05db\u05d0\u05dc' : '\u05d4\u05e2\u05d5\u05d6\u05e8') + ': ' + String(r.payload.text || r.payload.title).replace(/\s+/g, ' ').slice(0, 300));
  while (out.length && out.join(' || ').length > RECENT_MAX) out.shift();
  return out.join(' || ');
}
