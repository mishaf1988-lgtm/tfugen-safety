// /api/wa-templates.js — list WhatsApp templates with status.
// Called by the admin to see which custom templates Meta has approved.
//
// Env vars required:
//   META_PHONE_NUMBER_ID   — used to look up the WhatsApp Business Account ID
//   META_WABA_ID           — direct WABA ID (preferred; skip the lookup)
//   META_ACCESS_TOKEN      — System User permanent token

export const config = { runtime: 'edge' };

const ALLOWED_ORIGINS = ['https://tfugen-safety.vercel.app'];
const PREVIEW_RE = /^https:\/\/tfugen-safety-[a-z0-9-]+-mishaf1988-lgtms-projects\.vercel\.app$/;
const META_API_VERSION = 'v25.0';
const FALLBACK_WABA_ID = '4400035656982783';

function originOk(origin) {
  if (!origin) return false;
  if (ALLOWED_ORIGINS.includes(origin)) return true;
  return PREVIEW_RE.test(origin);
}

function corsFor(origin) {
  return {
    'Access-Control-Allow-Origin': originOk(origin) ? origin : ALLOWED_ORIGINS[0],
    'Access-Control-Allow-Methods': 'GET,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Vary': 'Origin'
  };
}

export default async function handler(req) {
  const origin = req.headers.get('origin') || '';
  const cors = corsFor(origin);

  if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
  // Allow GET from any origin (no sensitive write); just return template list
  if (req.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'method not allowed' }), {
      status: 405, headers: { ...cors, 'Content-Type': 'application/json' }
    });
  }

  const TOKEN = process.env.META_ACCESS_TOKEN;
  const WABA = process.env.META_WABA_ID || FALLBACK_WABA_ID;
  if (!TOKEN) {
    return new Response(JSON.stringify({ error: 'META_ACCESS_TOKEN not set' }), {
      status: 500, headers: { ...cors, 'Content-Type': 'application/json' }
    });
  }

  const url = `https://graph.facebook.com/${META_API_VERSION}/${WABA}/message_templates?fields=name,status,language,category&limit=50`;
  let r;
  try {
    r = await fetch(url, {
      headers: { 'Authorization': `Bearer ${TOKEN}` }
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: 'network failure', detail: String(e && e.message || e) }), {
      status: 502, headers: { ...cors, 'Content-Type': 'application/json' }
    });
  }
  const text = await r.text();
  return new Response(text, {
    status: r.status,
    headers: { ...cors, 'Content-Type': 'application/json' }
  });
}
