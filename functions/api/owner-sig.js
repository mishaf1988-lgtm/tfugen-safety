// Cloudflare Pages Function: Michael's own signature, drawn by him in the app (21/10/2026, Michael: "why
// don't you make it yourself, I sign interactively", and in the questionnaire "do it: a signature screen now").
//
// The image the server signs PDFs with (functions/_sign.js, after his "do it" on WhatsApp) lives in the private
// bucket "backups" at owner-signature/sig.png, which the app cannot write. Only the owner account
// (SITE.adminEmail) may set it, not any admin: a signature in his name is his alone. Agents never see it.
//
//   GET  ?op=status          -> { set, at }   (no image)
//   POST ?op=set {png}       -> { ok, at }    png = "data:image/png;base64,..." from the signature canvas
import { defaultAllowedOrigins, corsHeaders, jsonResp, isAllowedCaller, requireUser, sbFrom, tmo, SITE } from '../_shared.js';

export const SIG_PATH = 'backups/owner-signature/sig.png', SIG_MAX = 300 * 1024, SIG_MIN = 500;
// A drawn signature: a real PNG, not empty, not huge. Pure.
export function sigCheck(png) {
  const m = /^data:image\/png;base64,([A-Za-z0-9+/=]+)$/.exec(String(png || ''));
  if (!m) return { error: 'png: a data:image/png;base64 string' };
  let bytes;
  try { bytes = Uint8Array.from(atob(m[1]), (c) => c.charCodeAt(0)); } catch (e) { return { error: 'png: bad base64' }; }
  if (bytes.length < SIG_MIN || bytes.length > SIG_MAX) return { error: 'png: ' + SIG_MIN + '-' + SIG_MAX + ' bytes' };
  const magic = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (magic.some((b, i) => bytes[i] !== b)) return { error: 'png: not a PNG' };
  return { bytes };
}
export const isOwner = (user) => String((user && user.email) || '').toLowerCase() === String(SITE.adminEmail || '').toLowerCase();

export async function onRequest({ request, env }) {
  const allowed = defaultAllowedOrigins(env);
  const cors = corsHeaders(request.headers.get('origin') || '', allowed, 'GET,POST,OPTIONS');
  if (request.method === 'OPTIONS') return new Response(null, { headers: cors });
  if (!isAllowedCaller(request, allowed)) return jsonResp({ error: 'origin not allowed' }, 403, cors);
  const who = await requireUser(request, env);
  if (!who.ok) return jsonResp({ error: who.error }, who.status, cors);
  if (!isOwner(who.user)) return jsonResp({ error: 'only the owner account sets the owner signature' }, 403, cors);
  const key = env.SUPABASE_SERVICE_ROLE_KEY, url = sbFrom(env);
  const h = { apikey: key, Authorization: 'Bearer ' + key };
  const op = (new URL(request.url).searchParams.get('op') || '').toLowerCase();
  if (request.method === 'GET' && op === 'status') {
    const r = await fetch(url + '/storage/v1/object/info/' + SIG_PATH, { headers: h, signal: tmo(10000) }).catch(() => null);
    if (!r || (!r.ok && r.status !== 400 && r.status !== 404)) return jsonResp({ error: 'read ' + (r ? r.status : 'network') }, 502, cors);
    const j = r.ok ? await r.json().catch(() => ({})) : null;
    return jsonResp({ set: !!j, at: (j && (j.updated_at || j.created_at || j.last_modified)) || null }, 200, cors);
  }
  if (request.method === 'POST' && op === 'set') {
    let body = {};
    try { body = await request.json(); } catch (e) { return jsonResp({ error: 'bad json' }, 400, cors); }
    const c = sigCheck(body.png);
    if (c.error) return jsonResp({ error: c.error }, 400, cors);
    const up = await fetch(url + '/storage/v1/object/' + SIG_PATH, { method: 'POST', signal: tmo(15000),
      headers: { ...h, 'Content-Type': 'image/png', 'x-upsert': 'true', 'Cache-Control': 'no-store' }, body: c.bytes }).catch(() => null);
    if (!up || !up.ok) return jsonResp({ error: 'save ' + (up ? up.status : 'network') }, 502, cors);
    const at = new Date().toISOString();
    // the log line says the signature changed and when, never the image
    await fetch(url + '/rest/v1/notifications_log', { method: 'POST', signal: tmo(10000),
      headers: { ...h, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify([{ id: 'os' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), user_email: who.user.email, ts: at,
        event_type: 'owner_sign', channel: 'app', payload: { title: 'owner signature set', bytes: c.bytes.length } }]) }).catch(() => null);
    return jsonResp({ ok: true, at }, 200, cors);
  }
  return jsonResp({ error: 'unknown op (GET status, POST set)' }, 400, cors);
}
