// Cloudflare Pages Function — WhatsApp send via Meta Cloud API
// Mirrors /api/wa-send.js (Vercel Edge Function).

import {
  defaultAllowedOrigins,
  originPasses,
  corsHeaders,
  jsonResp
} from '../_shared.js';

const META_API_VERSION = 'v25.0';

export async function onRequest({ request, env }) {
  const allowed = defaultAllowedOrigins(env);
  const origin = request.headers.get('origin') || '';
  const cors = corsHeaders(origin, allowed, 'POST,OPTIONS');

  if (request.method === 'OPTIONS') return new Response(null, { headers: cors });
  if (request.method !== 'POST') return jsonResp({ error: 'method not allowed' }, 405, cors);
  if (!originPasses(origin, allowed)) return jsonResp({ error: 'origin not allowed' }, 403, cors);

  const PHONE_ID = env.META_PHONE_NUMBER_ID;
  const TOKEN = env.META_ACCESS_TOKEN;
  if (!PHONE_ID || !TOKEN) return jsonResp({ error: 'WhatsApp not configured (missing env vars)' }, 500, cors);

  let body;
  try { body = await request.json(); }
  catch (e) { return jsonResp({ error: 'invalid json' }, 400, cors); }

  const to = String(body.to || '').replace(/[^0-9]/g, '');
  if (!to || to.length < 8 || to.length > 16) {
    return jsonResp({ error: 'recipient phone (to) required, E.164 digits' }, 400, cors);
  }

  let payload;
  if (body.text && body.text.trim()) {
    payload = {
      messaging_product: 'whatsapp',
      to,
      type: 'text',
      text: { body: String(body.text).substring(0, 4096) }
    };
  } else {
    const tplName = String(body.template || 'hello_world');
    const lang = String(body.language || (tplName === 'hello_world' ? 'en_US' : 'he'));
    const params = Array.isArray(body.params) ? body.params : [];
    payload = {
      messaging_product: 'whatsapp',
      to,
      type: 'template',
      template: {
        name: tplName,
        language: { code: lang },
        components: params.length ? [{
          type: 'body',
          parameters: params.map((p) => ({ type: 'text', text: String(p) }))
        }] : []
      }
    };
  }

  let metaResp;
  try {
    metaResp = await fetch(
      `https://graph.facebook.com/${META_API_VERSION}/${PHONE_ID}/messages`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      }
    );
  } catch (e) {
    return jsonResp({ error: 'network failure', detail: String(e && e.message || e) }, 502, cors);
  }

  const text = await metaResp.text();
  let parsed;
  try { parsed = JSON.parse(text); } catch (e) { parsed = { raw: text }; }

  return new Response(JSON.stringify(parsed), {
    status: metaResp.status,
    headers: { ...cors, 'Content-Type': 'application/json' }
  });
}
