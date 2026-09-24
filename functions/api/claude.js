// Cloudflare Pages Function — AI proxy.
// Routes to Cloudflare Workers AI (free tier) by default; routes to Anthropic
// for legacy claude-* model names if the env.ANTHROPIC_KEY is set.
//
// Why two providers: Anthropic's Claude is higher quality but costs money.
// Workers AI is free up to 10K neurons/day and binds natively to this Pages
// project. The client doesn't care — we translate Workers AI's response
// shape into Anthropic's {content:[{text}]} shape so all 14 client call
// sites keep working unchanged.

import { defaultAllowedOrigins, originPasses, corsHeaders, jsonResp, isAllowedCaller, requireRole } from '../_shared.js';

// Allowed models. Cloudflare Workers AI models start with "@cf/". Anthropic
// models are kept for backward-compat — switch the client back any time by
// re-pointing the model string.
const ALLOWED_MODELS = [
  // Cloudflare Workers AI (free tier, default)
  '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
  '@cf/meta/llama-3.1-8b-instruct-fast',
  '@cf/meta/llama-3.1-70b-instruct',
  '@cf/meta/llama-3.2-11b-vision-instruct', // OCR / image analysis
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

  // The origin gate stops another website's page. It does not stop curl, which
  // sets Origin freely — so until now this was an unauthenticated LLM proxy:
  // anyone could burn the Workers AI daily quota (taking every AI feature in
  // the app down with it) and, for claude-* models, spend ANTHROPIC_KEY on
  // arbitrary prompts. Security review 2026-09-20.
  // Anonymous sessions are refused: the trustee screen hides every AI control
  // (index.html: body.emp-mode .cap-fab, #ask-fab { display:none }), so no
  // legitimate anonymous caller exists.
  // 2026-09-24 review: a JWT alone still admitted a reporter, who could burn the
  // Workers AI quota (down for everyone) and spend ANTHROPIC_KEY on arbitrary
  // prompts. AI is a staff feature -- reporters reach no AI page. A viewer is
  // allowed (it "reads what a manager reads", incl. the AI summaries).
  const who = await requireRole(request, env, ['admin', 'manager', 'viewer']);
  if (!who.ok) return jsonResp({ error: who.error }, who.status, cors);

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
    // The client speaks Anthropic; Workers AI does not. Until 2026-09-20 the
    // translation here threw away everything it did not recognise, in silence:
    //
    //   * `system` was dropped. legAskAI's whole guardrail — "never invent an
    //     inspection interval, a threshold or a date" — lives in `system`, and
    //     the answer panel tells the safety manager in so many words that the
    //     AI is forbidden to invent numbers. It never reached the model.
    //   * an Anthropic content-block array was passed through as-is, so a
    //     {type:'document'} PDF reached a text-only model as "[object Object]".
    //   * `stream:true` was ignored, so a client reading SSE got one JSON blob
    //     and accumulated the empty string.
    //
    // Translate what can be translated, and refuse loudly for what cannot.
    const isVision = parsed.model.indexOf('vision') >= 0;
    let cfMessages = [];
    if (!isVision) {
      let fileBlock = null;
      cfMessages = (parsed.messages || []).map((m) => {
        let c = m && m.content;
        if (Array.isArray(c)) {
          const bad = c.find((b) => b && b.type && b.type !== 'text');
          if (bad) fileBlock = bad.type;
          c = c.filter((b) => b && b.type === 'text').map((b) => b.text || '').join('\n');
        }
        return { role: (m && m.role) || 'user', content: typeof c === 'string' ? c : String(c == null ? '' : c) };
      });
      if (fileBlock) {
        return jsonResp({
          error: 'model cannot read files',
          detail: parsed.model + ' is text-only and was sent a "' + fileBlock + '" block. Extract the text client-side, or call a vision model.'
        }, 400, cors);
      }
      if (typeof parsed.system === 'string' && parsed.system.trim()) {
        cfMessages = [{ role: 'system', content: parsed.system }].concat(cfMessages);
      }
    }

    try {
      // Vision model takes a different request shape: {prompt, image} where
      // image is either an array of byte ints or base64. Client sends base64.
      const aiInput = isVision
        ? { prompt: parsed.prompt || '', image: parsed.image || '', max_tokens: parsed.max_tokens }
        : { messages: cfMessages, max_tokens: parsed.max_tokens };
      let aiResp;
      try {
        aiResp = await env.AI.run(parsed.model, aiInput);
      } catch (firstErr) {
        // Llama 3.2 Vision is gated behind a one-time TOS acknowledgement.
        // Cloudflare returns "5016: Prior to using this model, you must
        // submit the prompt 'agree'." Auto-accept and retry once. Once
        // accepted at the account level, future calls succeed without retry.
        const m = String((firstErr && firstErr.message) || firstErr);
        if (/5016|must submit the prompt 'agree'|Prior to using this model/i.test(m)) {
          try {
            await env.AI.run(parsed.model, { prompt: 'agree' });
          } catch (_) { /* the agree call itself can also error; ignore */ }
          aiResp = await env.AI.run(parsed.model, aiInput);
        } else {
          throw firstErr;
        }
      }
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

      // A client that asked for a stream is reading SSE and will find nothing
      // in a JSON body. Workers AI answered in one piece — emit that one piece
      // as the Anthropic event sequence the client already parses, so the
      // streaming call sites work against either provider.
      if (parsed.stream) {
        const enc = new TextEncoder();
        const ev = (name, obj) => enc.encode('event: ' + name + '\ndata: ' + JSON.stringify(obj) + '\n\n');
        const sse = new ReadableStream({
          start(c) {
            c.enqueue(ev('message_start', { type: 'message_start', message: { ...out, content: [] } }));
            c.enqueue(ev('content_block_start', { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } }));
            c.enqueue(ev('content_block_delta', { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: text } }));
            c.enqueue(ev('content_block_stop', { type: 'content_block_stop', index: 0 }));
            c.enqueue(ev('message_delta', { type: 'message_delta', delta: { stop_reason: 'end_turn' }, usage: { output_tokens: 0 } }));
            c.enqueue(ev('message_stop', { type: 'message_stop' }));
            c.close();
          }
        });
        return new Response(sse, {
          status: 200,
          headers: { ...cors, 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-cache, no-transform', 'X-Accel-Buffering': 'no' }
        });
      }

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
