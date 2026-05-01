// /api/wa-send.js — WhatsApp Business send endpoint via Meta Cloud API.
//
// Called from the TFUGEN UI (e.g. a "📱 שלח התראה" button) to send a
// WhatsApp message to a recipient. Uses the test number Meta provides
// for free (5 verified recipients, hello_world template).
//
// Production setup will require:
//   1. Custom approved templates (utility category) for our actual alerts.
//   2. A System User permanent access token (current setup uses temporary 24h).
//
// Env vars required (set in Vercel project settings):
//   META_PHONE_NUMBER_ID — Meta WhatsApp phone number ID
//   META_ACCESS_TOKEN    — Bearer token (temporary 24h or permanent)

export const config = { runtime: 'edge' };

const ALLOWED_ORIGINS = ['https://tfugen-safety.vercel.app'];
const PREVIEW_RE = /^https:\/\/tfugen-safety-[a-z0-9-]+-mishaf1988-lgtms-projects\.vercel\.app$/;
const META_API_VERSION = 'v25.0';

function originOk(origin) {
  if (!origin) return false;
  if (ALLOWED_ORIGINS.includes(origin)) return true;
  return PREVIEW_RE.test(origin);
}

function corsFor(origin) {
  return {
    'Access-Control-Allow-Origin': originOk(origin) ? origin : ALLOWED_ORIGINS[0],
    'Access-Control-Allow-Methods': 'POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Vary': 'Origin'
  };
}

function jsonResp(payload, status, cors) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' }
  });
}

export default async function handler(req) {
  const origin = req.headers.get('origin') || '';
  const cors = corsFor(origin);

  if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
  if (req.method !== 'POST') return jsonResp({ error: 'method not allowed' }, 405, cors);
  if (!originOk(origin)) return jsonResp({ error: 'origin not allowed' }, 403, cors);

  const PHONE_ID = process.env.META_PHONE_NUMBER_ID;
  const TOKEN = process.env.META_ACCESS_TOKEN;
  if (!PHONE_ID || !TOKEN) {
    return jsonResp({ error: 'WhatsApp not configured (missing env vars)' }, 500, cors);
  }

  let body;
  try { body = await req.json(); }
  catch (e) { return jsonResp({ error: 'invalid json' }, 400, cors); }

  // Accept E.164 with or without leading + or hyphens; strip non-digits
  const to = String(body.to || '').replace(/[^0-9]/g, '');
  if (!to || to.length < 8 || to.length > 16) {
    return jsonResp({ error: 'recipient phone (to) required, E.164 digits' }, 400, cors);
  }

  // 3 modes:
  // 1) hello_world template (default; pre-approved by Meta, English).
  // 2) Custom approved template with optional body parameters.
  // 3) Free-form text (only valid within 24h of recipient sending us a msg).
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
