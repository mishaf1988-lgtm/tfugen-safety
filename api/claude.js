export const config = { runtime: 'edge' };

// Security hardening:
// 1. Origin allowlist — blocks browser requests from other sites + non-browser
//    abuse that doesn't spoof Origin header.
// 2. Model allowlist — prevents callers switching to expensive Opus models.
// 3. max_tokens cap — limits per-request cost.
// 4. Body size cap — limits prompt length (also an abuse multiplier).
//
// Not a substitute for proper auth (that requires Supabase Auth integration).
// A determined attacker who reads the HTML can spoof Origin; this stops
// opportunistic scanners and botnets, which are the realistic threat.

const DEFAULT_ALLOWED_ORIGINS = [
  'https://tfugen-safety.vercel.app'
];
// Vercel preview deployments for this project: tfugen-safety-<hash>-mishaf1988-lgtms-projects.vercel.app
const PREVIEW_ORIGIN_RE = /^https:\/\/tfugen-safety-[a-z0-9-]+-mishaf1988-lgtms-projects\.vercel\.app$/;
const ALLOWED_MODELS = [
  'claude-sonnet-4-6',
  'claude-haiku-4-5'
];
const MAX_TOKENS_CAP = 16000;    // 30+ page PDF inspections can extract 50+ items
const MAX_BODY_BYTES = 25000000; // 25MB — fits ~18MB raw PDFs after base64 inflation

function getAllowedOrigins() {
  const extra = (process.env.ALLOWED_ORIGINS || '')
    .split(',').map(s => s.trim()).filter(Boolean);
  return [...DEFAULT_ALLOWED_ORIGINS, ...extra];
}

function originPasses(origin, allowed) {
  if (!origin) return false;
  if (allowed.includes(origin)) return true;
  return PREVIEW_ORIGIN_RE.test(origin);
}

function corsHeaders(origin, allowed) {
  const allow = originPasses(origin, allowed) ? origin : allowed[0];
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Methods': 'POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Vary': 'Origin'
  };
}

function jsonErr(msg, status, cors) {
  return new Response(JSON.stringify({ error: msg }), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' }
  });
}

function isAllowedCaller(req, allowed) {
  const origin = req.headers.get('origin') || '';
  if (originPasses(origin, allowed)) return true;
  // Same-origin fetches from Safari sometimes omit Origin — fall back to Referer.
  const referer = req.headers.get('referer') || '';
  if (referer) {
    try {
      const refOrigin = new URL(referer).origin;
      if (originPasses(refOrigin, allowed)) return true;
    } catch (e) {}
  }
  return false;
}

export default async function handler(req) {
  const allowed = getAllowedOrigins();
  const origin = req.headers.get('origin') || '';
  const cors = corsHeaders(origin, allowed);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: cors });
  }
  if (req.method !== 'POST') {
    return jsonErr('method not allowed', 405, cors);
  }
  if (!isAllowedCaller(req, allowed)) {
    return jsonErr('origin not allowed', 403, cors);
  }

  const body = await req.text();
  if (body.length > MAX_BODY_BYTES) {
    return jsonErr('body too large', 413, cors);
  }

  let parsed;
  try { parsed = JSON.parse(body); }
  catch (e) { return jsonErr('invalid json', 400, cors); }

  if (!parsed || !ALLOWED_MODELS.includes(parsed.model)) {
    return jsonErr('model not allowed', 400, cors);
  }
  if (typeof parsed.max_tokens !== 'number' || parsed.max_tokens > MAX_TOKENS_CAP) {
    parsed.max_tokens = Math.min(parsed.max_tokens || MAX_TOKENS_CAP, MAX_TOKENS_CAP);
  }

  const upstream = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'anthropic-version': '2023-06-01',
      'x-api-key': process.env.ANTHROPIC_KEY || ''
    },
    body: JSON.stringify(parsed)
  });

  if (parsed.stream && upstream.body) {
    return new Response(upstream.body, {
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
