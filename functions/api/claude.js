// Cloudflare Pages Function — Claude AI proxy
// Mirrors /api/claude.js (Vercel Edge Function).

import {
  defaultAllowedOrigins,
  originPasses,
  corsHeaders,
  jsonResp,
  isAllowedCaller
} from '../_shared.js';

// Anthropic API requires the explicit dated form for Haiku 4.5 — the bare
// alias 'claude-haiku-4-5' returns 400 "model not found". Sonnet 4.6 still
// accepts the bare alias. Keep both forms so old client builds keep working
// during deploy roll-out.
const ALLOWED_MODELS = [
  'claude-sonnet-4-6',
  'claude-haiku-4-5',           // legacy alias — kept for backward-compat
  'claude-haiku-4-5-20251001'   // canonical dated ID — what client now sends
];
const MAX_TOKENS_CAP = 16000;    // 30+ page PDF inspections can extract 50+ items
const MAX_BODY_BYTES = 25000000; // 25MB — fits ~18MB raw PDFs after base64 inflation

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

  const upstream = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'anthropic-version': '2023-06-01',
      'x-api-key': env.ANTHROPIC_KEY || ''
    },
    body: JSON.stringify(parsed)
  });

  // Streaming path: pipe the SSE body straight through. Keeps the connection
  // alive for long PDF analyses (>100s) so Cloudflare doesn't 524.
  // We wrap upstream.body in a TransformStream that injects `: keepalive`
  // SSE comments while idle. Anthropic's first-token delay on 30-page PDFs
  // can exceed Cloudflare's 100-second silent-timeout — the heartbeat keeps
  // bytes flowing so the connection stays open until real tokens arrive.
  if (parsed.stream && upstream.body) {
    const enc = new TextEncoder();
    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();
    let lastByteAt = Date.now();
    let closed = false;

    const ping = setInterval(() => {
      if (closed) return;
      if (Date.now() - lastByteAt > 14000) {
        // SSE comments start with ":" and are silently ignored by clients.
        writer.write(enc.encode(': keepalive\n\n')).catch(() => {});
      }
    }, 5000);

    (async () => {
      const reader = upstream.body.getReader();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          lastByteAt = Date.now();
          await writer.write(value);
        }
      } catch (e) {
        // Surface upstream errors as a final SSE event for the client to log.
        try { await writer.write(enc.encode(`event: error\ndata: ${JSON.stringify({ message: String(e && e.message || e) })}\n\n`)); } catch (_) {}
      } finally {
        closed = true;
        clearInterval(ping);
        try { await writer.close(); } catch (_) {}
      }
    })();

    return new Response(readable, {
      status: upstream.status,
      headers: {
        ...cors,
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        'X-Accel-Buffering': 'no'
      }
    });
  }

  const data = await upstream.text();
  return new Response(data, {
    status: upstream.status,
    headers: { ...cors, 'Content-Type': 'application/json' }
  });
}
