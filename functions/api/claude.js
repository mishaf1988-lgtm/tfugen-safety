// Cloudflare Pages Function — AI proxy.
// Routes to Cloudflare Workers AI (free tier) by default; routes to Anthropic
// for legacy claude-* model names if the env.ANTHROPIC_KEY is set.
//
// Why two providers: Anthropic's Claude is higher quality but costs money.
// Workers AI is free up to 10K neurons/day and binds natively to this Pages
// project. The client doesn't care — we translate Workers AI's response
// shape into Anthropic's {content:[{text}]} shape so all 14 client call
// sites keep working unchanged.

import {
  defaultAllowedOrigins,
  originPasses,
  corsHeaders,
  jsonResp,
  isAllowedCaller
} from '../_shared.js';

// Allowed models. Cloudflare Workers AI models start with "@cf/". Anthropic
// models are kept for backward-compat — switch the client back any time by
// re-pointing the model string.
const ALLOWED_MODELS = [
  // Cloudflare Workers AI (free tier, default)
  '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
  '@cf/meta/llama-3.1-8b-instruct-fast',
  '@cf/meta/llama-3.1-70b-instruct',
  // Anthropic (paid — only if ANTHROPIC_KEY env var is set)
  'claude-sonnet-4-6',
  'claude-haiku-4-5',
  'claude-haiku-4-5-20251001'
];
const MAX_TOKENS_CAP = 16000;
const MAX_BODY_BYTES = 25000000;

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
    return jsonResp({ error: 'model not allowed: ' + (parsed && parsed.model) }, 400, cors);
  }
  if (typeof parsed.max_tokens !== 'number' || parsed.max_tokens > MAX_TOKENS_CAP) {
    parsed.max_tokens = Math.min(parsed.max_tokens || MAX_TOKENS_CAP, MAX_TOKENS_CAP);
  }

  // Route to Workers AI (free) for "@cf/..." models.
  if (parsed.model.startsWith('@cf/')) {
    if (!env.AI || typeof env.AI.run !== 'function') {
      return jsonResp({
        error: 'Workers AI binding not configured',
        hint: 'In Cloudflare Pages dashboard: Settings → Functions → Bindings → Add Binding → Workers AI. Variable name must be exactly "AI". Then redeploy.'
      }, 500, cors);
    }
    try {
      const aiResp = await env.AI.run(parsed.model, {
        messages: parsed.messages,
        max_tokens: parsed.max_tokens
      });
      // Translate Workers AI shape ({response: "..."} or {result: ...}) into
      // Anthropic shape ({content:[{type:"text",text:"..."}]}) so the 14
      // client-side handlers don't need to change.
      const text = (aiResp && (aiResp.response || (aiResp.result && aiResp.result.response))) || '';
      const out = {
        id: 'cf_' + Date.now().toString(36),
        type: 'message',
        role: 'assistant',
        model: parsed.model,
        content: [{ type: 'text', text: text }],
        stop_reason: 'end_turn',
        usage: { input_tokens: 0, output_tokens: 0 }
      };
      return jsonResp(out, 200, cors);
    } catch (err) {
      const m = String((err && err.message) || err);
      // Workers AI free tier = 10K neurons/day. When exceeded, the binding
      // throws with a "neuron" / "limit" / "rate" mention. Map to 429 so the
      // client can show a friendly "try again later" message and back off.
      const looksLikeRate = /neuron|rate.?limit|exceed|quota|too many/i.test(m);
      const status = looksLikeRate ? 429 : 500;
      const headers = { ...cors };
      if (looksLikeRate) headers['Retry-After'] = '3600'; // 1 hour
      return new Response(JSON.stringify({
        error: looksLikeRate ? 'Daily AI quota exceeded' : ('Workers AI error: ' + m),
        retry_after_seconds: looksLikeRate ? 3600 : null
      }), { status, headers: { ...headers, 'Content-Type': 'application/json' } });
    }
  }

  // Anthropic flow (legacy / paid).
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
