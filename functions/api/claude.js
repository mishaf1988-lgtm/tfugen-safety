// Cloudflare Pages Function — Claude AI proxy
// Mirrors /api/claude.js (Vercel Edge Function).

import {
  defaultAllowedOrigins,
  originPasses,
  corsHeaders,
  jsonResp,
  isAllowedCaller
} from '../_shared.js';

const ALLOWED_MODELS = ['claude-sonnet-4-6', 'claude-haiku-4-5'];
const MAX_TOKENS_CAP = 1200;
const MAX_BODY_BYTES = 600000;

export async function onRequest({ request, env }) {
  const allowed = defaultAllowedOrigins(env);
  const origin = request.headers.get('origin') || '';
  const cors = corsHeaders(origin, allowed, 'POST,OPTIONS');

  if (request.method === 'OPTIONS') return new Response(null, { headers: cors });
  if (request.method !== 'POST') return jsonResp({ error: 'method not allowed' }, 405, cors);
  if (!isAllowedCaller(request, allowed)) return jsonResp({ error: 'origin not allowed' }, 403, cors);

  const body = await request.text();
  if (body.length > MAX_BODY_BYTES) return jsonResp({ error: 'body too large' }, 413, cors);

  let parsed;
  try { parsed = JSON.parse(body); }
  catch (e) { return jsonResp({ error: 'invalid json' }, 400, cors); }

  if (!parsed || !ALLOWED_MODELS.includes(parsed.model)) {
    return jsonResp({ error: 'model not allowed' }, 400, cors);
  }
  if (typeof parsed.max_tokens !== 'number' || parsed.max_tokens > MAX_TOKENS_CAP) {
    parsed.max_tokens = Math.min(parsed.max_tokens || MAX_TOKENS_CAP, MAX_TOKENS_CAP);
  }

  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'anthropic-version': '2023-06-01',
      'x-api-key': env.ANTHROPIC_KEY || ''
    },
    body: JSON.stringify(parsed)
  });

  const data = await r.text();
  return new Response(data, {
    status: r.status,
    headers: { ...cors, 'Content-Type': 'application/json' }
  });
}
