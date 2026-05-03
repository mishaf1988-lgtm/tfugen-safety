// Cloudflare Pages Function — Green API WhatsApp send
// Wraps https://api.green-api.com/waInstance{idInstance}/sendMessage/{apiTokenInstance}
// so the browser doesn't have to embed the apiToken in JS. Each user pairs
// their own WhatsApp account once via QR (https://green-api.com), then this
// proxy forwards send requests using the per-instance credentials supplied
// in the body.

import {
  defaultAllowedOrigins,
  originPasses,
  corsHeaders,
  jsonResp,
  isAllowedCaller
} from '../_shared.js';

const MAX_TEXT = 4000;

export async function onRequest({ request, env }) {
  const allowed = defaultAllowedOrigins(env);
  const origin = request.headers.get('origin') || '';
  const cors = corsHeaders(origin, allowed, 'POST,OPTIONS');

  if (request.method === 'OPTIONS') return new Response(null, { headers: cors });
  if (request.method !== 'POST') return jsonResp({ error: 'method not allowed' }, 405, cors);
  if (!isAllowedCaller(request, allowed)) return jsonResp({ error: 'origin not allowed' }, 403, cors);

  let body;
  try { body = await request.json(); }
  catch (e) { return jsonResp({ error: 'invalid json' }, 400, cors); }

  const idInstance      = String(body.idInstance      || '').replace(/[^0-9]/g, '');
  const apiTokenInstance= String(body.apiTokenInstance|| '').trim();
  const phone           = String(body.phone || '').replace(/[^0-9]/g, '');
  const text            = String(body.text  || '').substring(0, MAX_TEXT);

  if (!idInstance)      return jsonResp({ error: 'idInstance required (digits)' }, 400, cors);
  if (!apiTokenInstance)return jsonResp({ error: 'apiTokenInstance required' }, 400, cors);
  if (!phone)           return jsonResp({ error: 'phone required (digits, country code first)' }, 400, cors);
  if (!text)            return jsonResp({ error: 'text required' }, 400, cors);

  const url = `https://api.green-api.com/waInstance${idInstance}/sendMessage/${encodeURIComponent(apiTokenInstance)}`;
  const payload = { chatId: phone + '@c.us', message: text };

  let upstream;
  try {
    upstream = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  } catch (e) {
    return jsonResp({ error: 'network failure', detail: String(e && e.message || e) }, 502, cors);
  }

  const respText = await upstream.text();
  let parsed;
  try { parsed = JSON.parse(respText); } catch (e) { parsed = { raw: respText.substring(0, 240) }; }

  return jsonResp({
    status: upstream.status,
    ok: upstream.ok && !!(parsed && parsed.idMessage),
    response: parsed
  }, 200, cors);
}
