// Cloudflare Pages Function: WhatsApp messages from Michael to his assistant (19/10/2026, Michael:
// "I'm not always in front of the computer... updates on WhatsApp, and I can ask for an update...
// I'm the CEO talking to my assistant, he passes on tasks", and in the questionnaire: "same number,
// the assistant only on a new message").
//
// Meta calls this URL (webhook, field "messages") for every message to the business number.
//   GET   the one-time subscription check: hub.verify_token must equal WA_VERIFY_TOKEN.
//   POST  a message. The body must carry Meta's signature (META_APP_SECRET), and the sender must be
//         Michael's own number (_wa.js ownerWa). Anything else is answered 200 and dropped, so Meta
//         does not retry it and nobody else can reach the assistant.
// A message from Michael fires the assistant's Routine (ASSISTANT_FIRE_URL + ASSISTANT_FIRE_TOKEN,
// the API trigger Michael generates on the Routine's page). The Routine answers with
// /api/routine-db op wa_me. A reply to a trustee alert carries what that alert was, from
// notifications_log (payload.wamid), so the assistant knows what Michael is answering.
// Machine path in _middleware: Meta calls from outside Israel.
import { jsonResp, sbFrom, SB_TIMEOUT_MS, tmo } from '../_shared.js';
import { ownerWa, metaSigOk, inboundMessages } from '../_wa.js';

const SEEN_KEY = 'wa_hook_seen', SEEN_MAX = 100;

export function fireText(m, about) {
  const lines = ['[\u05d5\u05d5\u05d0\u05d8\u05e1\u05d0\u05e4 \u05de\u05de\u05d9\u05db\u05d0\u05dc, \u05e0\u05d1\u05d3\u05e7 \u05d1\u05e9\u05e8\u05ea: \u05d7\u05ea\u05d9\u05de\u05ea Meta \u05d5\u05d4\u05de\u05e1\u05e4\u05e8 \u05e9\u05dc\u05d5]',
    'at: ' + (m.ts ? new Date(m.ts * 1000).toISOString() : new Date().toISOString()), 'wamid: ' + m.id];
  if (m.type !== 'text' && !m.text) lines.push('type: ' + m.type + ' (\u05dc\u05d0 \u05d8\u05e7\u05e1\u05d8)');
  if (about) lines.push('reply_to: ' + about);
  else if (m.context) lines.push('reply_to: wamid ' + m.context + ' (\u05dc\u05d0 \u05e0\u05de\u05e6\u05d0 \u05d1\u05d9\u05d5\u05de\u05df)');
  lines.push('text: ' + m.text);
  return lines.join('\n');
}

async function sbJson(env, path, init) {
  const k = env.SUPABASE_SERVICE_ROLE_KEY;
  const r = await fetch(sbFrom(env) + '/rest/v1/' + path, Object.assign({ signal: tmo(SB_TIMEOUT_MS) }, init || {},
    { headers: Object.assign({ apikey: k, Authorization: 'Bearer ' + k, 'Content-Type': 'application/json' }, (init && init.headers) || {}) }));
  if (!r.ok) throw new Error('sb ' + r.status);
  return r.status === 204 ? null : r.json().catch(() => null);
}

// Meta retries a webhook it thinks failed: the same message id is handled once.
async function firstTime(env, id) {
  const rows = await sbJson(env, 'server_state?key=eq.' + SEEN_KEY + '&select=value');
  const seen = (rows && rows[0] && Array.isArray(rows[0].value)) ? rows[0].value : [];
  if (seen.indexOf(id) >= 0) return false;
  const value = seen.concat([id]).slice(-SEEN_MAX);
  await sbJson(env, 'server_state?on_conflict=key', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify([{ key: SEEN_KEY, value, updated_at: new Date().toISOString() }]) });
  return true;
}

async function aboutAlert(env, wamid) {
  if (!wamid) return '';
  try {
    const rows = await sbJson(env, 'notifications_log?select=event_type,payload,ts&payload->>wamid=eq.' + encodeURIComponent(wamid) + '&limit=1');
    const r = rows && rows[0];
    if (!r) return '';
    const p = r.payload || {};
    return String(r.event_type || '') + ' | ' + String(p.title || '').slice(0, 200) + (p.id ? ' | id ' + String(p.id).slice(0, 64) : '') + ' | ' + String(r.ts || '');
  } catch (e) { return ''; }
}

async function handle(env, raw) {
  let body; try { body = JSON.parse(raw); } catch (e) { return; }
  const msgs = inboundMessages(body);
  if (!msgs.length) return;
  const owner = await ownerWa(env, sbFrom(env));
  for (const m of msgs) {
    if (!owner || m.from !== owner) continue;
    if (!(await firstTime(env, m.id))) continue;
    const text = fireText(m, await aboutAlert(env, m.context));
    await fetch(env.ASSISTANT_FIRE_URL, {
      method: 'POST', signal: tmo(20000),
      headers: { Authorization: 'Bearer ' + env.ASSISTANT_FIRE_TOKEN, 'anthropic-beta': 'experimental-cc-routine-2026-04-01',
        'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    }).catch(() => null);
  }
}

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method === 'GET') {
    const u = new URL(request.url);
    const ok = env.WA_VERIFY_TOKEN && u.searchParams.get('hub.mode') === 'subscribe' && u.searchParams.get('hub.verify_token') === env.WA_VERIFY_TOKEN;
    return ok ? new Response(u.searchParams.get('hub.challenge') || '', { status: 200, headers: { 'Content-Type': 'text/plain' } })
      : new Response('forbidden', { status: 403 });
  }
  if (request.method !== 'POST') return jsonResp({ error: 'method not allowed' }, 405, {});
  const raw = await request.text();
  if (!(await metaSigOk(raw, request.headers.get('x-hub-signature-256') || '', env.META_APP_SECRET))) return new Response('forbidden', { status: 403 });
  if (!env.ASSISTANT_FIRE_URL || !env.ASSISTANT_FIRE_TOKEN || !env.SUPABASE_SERVICE_ROLE_KEY) return new Response('ok', { status: 200 });
  const job = handle(env, raw).catch(() => null);
  if (context.waitUntil) context.waitUntil(job); else await job;
  return new Response('ok', { status: 200 });
}
