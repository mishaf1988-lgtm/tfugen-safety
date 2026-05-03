// Cloudflare Pages Function — CallMeBot WhatsApp send
// Wraps https://api.callmebot.com/whatsapp.php so the browser doesn't have to
// deal with CORS. Each recipient owns their own apikey (one-time pairing with
// the public CallMeBot bot via WhatsApp), so the proxy here is stateless —
// it only forwards the call.

import {
  defaultAllowedOrigins,
  originPasses,
  corsHeaders,
  jsonResp,
  isAllowedCaller
} from '../_shared.js';

const MAX_TEXT = 1500;          // CallMeBot drops messages over a few KB
const ENDPOINT = 'https://api.callmebot.com/whatsapp.php';

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

  // CallMeBot expects digits only, no '+'.
  const phone  = String(body.phone  || '').replace(/[^0-9]/g, '');
  const apikey = String(body.apikey || '').replace(/[^0-9]/g, '');
  const text   = String(body.text   || '').substring(0, MAX_TEXT);

  if (!phone)  return jsonResp({ error: 'phone required (digits only, country code first)' }, 400, cors);
  if (!apikey) return jsonResp({ error: 'apikey required (CallMeBot pairing code)' }, 400, cors);
  if (!text)   return jsonResp({ error: 'text required' }, 400, cors);

  const url = ENDPOINT
    + '?phone='  + encodeURIComponent(phone)
    + '&text='   + encodeURIComponent(text)
    + '&apikey=' + encodeURIComponent(apikey);

  let upstream;
  try {
    upstream = await fetch(url, { method: 'GET' });
  } catch (e) {
    return jsonResp({ error: 'network failure', detail: String(e && e.message || e) }, 502, cors);
  }

  const respText = await upstream.text();
  // CallMeBot returns plain HTML on success/failure; surface the first line so
  // the client can show a meaningful message either way.
  const firstLine = respText.replace(/<[^>]+>/g, '').trim().split('\n')[0].substring(0, 240);

  return jsonResp({
    status: upstream.status,
    ok: upstream.ok && /Message queued|sent|ok/i.test(firstLine),
    response: firstLine
  }, 200, cors);
}
