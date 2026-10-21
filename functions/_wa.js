// WhatsApp helpers shared by the assistant (19/10/2026, Michael: "a tool connected to my office...
// updates on WhatsApp, and I can ask for an update", and in the questionnaire: "same number, the
// assistant only on a new message").
//
// The assistant talks only to Michael. His number is not a new setting: it is the one he already
// saved for the trustee alerts, notification_prefs[admin].prefs.trustee_hazard.whatsapp_to, the
// same row trustee-notify.js sends to. No row, no number: nothing is sent and nothing is accepted.
import { SITE, SB_TIMEOUT_MS, tmo } from './_shared.js';

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

// Free text inside the window (opts.windowOpen true); outside it the template (one line, 1000 chars).
// A closed window that Meta still reports at once (131047) also falls back to the template.
export async function sendToOwner(env, to, text, opts) {
  const o = opts || {};
  const body = String(text || '').trim().slice(0, 4096);
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

// The messages Michael sent, from one webhook body. Statuses (delivered, read) are not messages.
export function inboundMessages(body) {
  const out = [];
  ((body && body.entry) || []).forEach((e) => ((e && e.changes) || []).forEach((c) => {
    const v = c && c.value;
    ((v && v.messages) || []).forEach((m) => {
      if (!m || !m.id || !m.from) return;
      const text = m.type === 'text' ? (m.text && m.text.body) : m.type === 'button' ? (m.button && m.button.text)
        : m.type === 'interactive' ? (m.interactive && (m.interactive.button_reply || m.interactive.list_reply || {}).title) : '';
      const pick = m.type === 'interactive' && m.interactive ? (m.interactive.button_reply || m.interactive.list_reply || {}).id : '';
      out.push({ id: String(m.id).slice(0, 120), from: digits(m.from), ts: Number(m.timestamp) || 0, type: String(m.type || ''),
        choice: /^c([1-9]|10)$/.test(String(pick || '')) ? Number(String(pick).slice(1)) : null,
        text: String(text || '').slice(0, 3000), context: m.context && m.context.id ? String(m.context.id).slice(0, 120) : '' });
    });
  }));
  return out;
}
