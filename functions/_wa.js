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

// Free text inside the window (opts.windowOpen true); outside it the template (one line, 1000 chars).
// A closed window that Meta still reports at once (131047) also falls back to the template.
export async function sendToOwner(env, to, text, opts) {
  const o = opts || {};
  const body = String(text || '').trim().slice(0, 4096);
  if (!body) return { ok: false, error: 'empty text' };
  const id = (r) => r.parsed && r.parsed.messages && r.parsed.messages[0] && r.parsed.messages[0].id || null;
  if (o.windowOpen !== false) {
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
      out.push({ id: String(m.id).slice(0, 120), from: digits(m.from), ts: Number(m.timestamp) || 0, type: String(m.type || ''),
        text: String(text || '').slice(0, 3000), context: m.context && m.context.id ? String(m.context.id).slice(0, 120) : '' });
    });
  }));
  return out;
}
