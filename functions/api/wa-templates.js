// Cloudflare Pages Function — list WhatsApp templates with status
// Mirrors /api/wa-templates.js (Vercel Edge Function).

import { defaultAllowedOrigins, corsHeaders } from '../_shared.js';

const META_API_VERSION = 'v25.0';
const FALLBACK_WABA_ID = '4400035656982783';

export async function onRequest({ request, env }) {
  const allowed = defaultAllowedOrigins(env);
  const origin = request.headers.get('origin') || '';
  const cors = corsHeaders(origin, allowed, 'GET,OPTIONS');

  if (request.method === 'OPTIONS') return new Response(null, { headers: cors });
  if (request.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'method not allowed' }), {
      status: 405,
      headers: { ...cors, 'Content-Type': 'application/json' }
    });
  }

  const TOKEN = env.META_ACCESS_TOKEN;
  const WABA = env.META_WABA_ID || FALLBACK_WABA_ID;
  if (!TOKEN) {
    return new Response(JSON.stringify({ error: 'META_ACCESS_TOKEN not set' }), {
      status: 500,
      headers: { ...cors, 'Content-Type': 'application/json' }
    });
  }

  const url = `https://graph.facebook.com/${META_API_VERSION}/${WABA}/message_templates?fields=name,status,language,category&limit=50`;
  let r;
  try {
    r = await fetch(url, { headers: { 'Authorization': `Bearer ${TOKEN}` } });
  } catch (e) {
    return new Response(JSON.stringify({ error: 'network failure', detail: String(e && e.message || e) }), {
      status: 502,
      headers: { ...cors, 'Content-Type': 'application/json' }
    });
  }
  const text = await r.text();
  return new Response(text, {
    status: r.status,
    headers: { ...cors, 'Content-Type': 'application/json' }
  });
}
