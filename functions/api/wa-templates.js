// Cloudflare Pages Function — WhatsApp templates: list them (GET), and submit
// the safety-report one for approval (POST).
//
// Why POST exists: the alert that reaches the safety officer is carried by a
// Meta template, and the only APPROVED one is tfugen_incident_alert, written
// for road accidents. Michael read the first real alert on 2026-09-21 and it
// opened with «🚨 תקרית בטיחות» over a fire extinguisher missing its seal. The
// wording lives in the template, not in our code, so the fix is a template of
// our own -- and submitting one meant a Meta Business Suite form, on a phone,
// in English, with sample values. He asked me to do it for him. The token and
// the account id already live here, so the submission can be one button in the
// app instead.
//
// The template is HARDCODED below and never taken from the request. A caller
// who reached this endpoint must not be able to submit arbitrary text for
// approval in the factory's name.

import { defaultAllowedOrigins, corsHeaders, isAllowedCaller, jsonResp, requireUser } from '../_shared.js';

const META_API_VERSION = 'v25.0';
const FALLBACK_WABA_ID = '4400035656982783';

// Must match TEMPLATE_DEDICATED and the parameter order in trustee-notify.js:
//   {{1}} reporter · {{2}} kind · {{3}} location · {{4}} finding
// project-files/WHATSAPP-TEMPLATE.md explains every line.
const SAFETY_TEMPLATE = {
  name: 'tfugen_safety_report',
  language: 'he',
  category: 'UTILITY',
  components: [
    {
      type: 'BODY',
      text: 'דיווח בטיחות חדש\n\nמדווח: {{1}}\nסוג: {{2}}\nמיקום: {{3}}\nהממצא: {{4}}\n\nלצפייה ולטיפול במערכת.',
      example: {
        body_text: [[
          'דני כהן',
          'ליקוי בסיור נאמן: עמדות כיבוי אש',
          'אולם ייצור, מסוע 3',
          'מטף ליד דלת 4, פלומבה קרועה'
        ]]
      }
    },
    { type: 'FOOTER', text: 'תעשיות תפוגן, מערכת ניהול הבטיחות' }
  ]
};

export async function onRequest({ request, env }) {
  const allowed = defaultAllowedOrigins(env);
  const origin = request.headers.get('origin') || '';
  const cors = corsHeaders(origin, allowed, 'GET,POST,OPTIONS');

  if (request.method === 'OPTIONS') return new Response(null, { headers: cors });
  if (request.method !== 'GET' && request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'method not allowed' }), {
      status: 405,
      headers: { ...cors, 'Content-Type': 'application/json' }
    });
  }
  // Origin/Referer gate. Returns the WhatsApp template list (operational
  // recon if unprotected). The client doesn't actually call this endpoint
  // (only used by ad-hoc admin debugging), so gating won't break the UI.
  if (!isAllowedCaller(request, allowed)) {
    return new Response(JSON.stringify({ error: 'origin not allowed' }), {
      status: 403,
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

  // ---- POST: submit the safety template for approval ----
  if (request.method === 'POST') {
    // Submitting in the factory's name is not something an anonymous kiosk
    // session may do. Same gate as the test path in trustee-notify.
    const who = await requireUser(request, env);
    if (!who.ok) return jsonResp({ error: who.error }, who.status, cors);

    let res;
    try {
      res = await fetch(`https://graph.facebook.com/${META_API_VERSION}/${WABA}/message_templates`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(SAFETY_TEMPLATE)
      });
    } catch (e) {
      return jsonResp({ error: 'network failure', detail: String((e && e.message) || e) }, 502, cors);
    }
    const body = await res.text();
    let parsed; try { parsed = JSON.parse(body); } catch (e) { parsed = { raw: body }; }

    if (res.ok) {
      // Meta answers with the id and the review status, usually PENDING.
      return jsonResp({ ok: true, name: SAFETY_TEMPLATE.name, id: parsed.id || null, status: parsed.status || 'PENDING' }, 200, cors);
    }
    // A template that already exists is not a failure the person needs to act
    // on -- it means a previous press worked, or it is already live.
    const err = (parsed && parsed.error) || {};
    const msg = String(err.error_user_msg || err.message || body);
    if (/already exists/i.test(msg)) {
      return jsonResp({ ok: true, name: SAFETY_TEMPLATE.name, already: true, status: 'EXISTS' }, 200, cors);
    }
    return jsonResp({ error: 'meta refused', status: res.status, detail: msg.substring(0, 400) }, 502, cors);
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
