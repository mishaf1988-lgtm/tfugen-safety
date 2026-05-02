// /api/wa-template-update-url — admin one-shot:
// for each WhatsApp template that contains the old Vercel URL,
// submit an edit to Meta replacing it with the new Cloudflare URL.
//
// Each edit requires Meta re-approval (24–48h). Old approved
// versions keep working until the new ones are approved.
//
// Usage:
//   GET /api/wa-template-update-url?confirm=update-urls-2026
//
// Returns JSON with per-template result.

import { defaultAllowedOrigins, corsHeaders } from '../_shared.js';

const META_API_VERSION = 'v25.0';
const FALLBACK_WABA_ID = '4400035656982783';
const OLD_URL = 'https://tfugen-safety.vercel.app';
const NEW_URL = 'https://tapugan-safety.pages.dev';

export async function onRequest({ request, env }) {
  const allowed = defaultAllowedOrigins(env);
  const origin = request.headers.get('origin') || '';
  const cors = corsHeaders(origin, allowed, 'GET,OPTIONS');

  if (request.method === 'OPTIONS') return new Response(null, { headers: cors });
  if (request.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'method not allowed' }), {
      status: 405, headers: { ...cors, 'Content-Type': 'application/json' }
    });
  }

  const url = new URL(request.url);
  if (url.searchParams.get('confirm') !== 'update-urls-2026') {
    return new Response(JSON.stringify({ error: 'missing ?confirm=update-urls-2026' }), {
      status: 400, headers: { ...cors, 'Content-Type': 'application/json' }
    });
  }

  const TOKEN = env.META_ACCESS_TOKEN;
  const WABA = env.META_WABA_ID || FALLBACK_WABA_ID;
  if (!TOKEN) {
    return new Response(JSON.stringify({ error: 'META_ACCESS_TOKEN not set' }), {
      status: 500, headers: { ...cors, 'Content-Type': 'application/json' }
    });
  }

  const auth = { 'Authorization': `Bearer ${TOKEN}` };

  // 1. List all templates with full components
  const listResp = await fetch(
    `https://graph.facebook.com/${META_API_VERSION}/${WABA}/message_templates?fields=name,id,status,language,category,components&limit=200`,
    { headers: auth }
  );
  if (!listResp.ok) {
    const text = await listResp.text();
    return new Response(JSON.stringify({ error: 'list templates failed', status: listResp.status, body: text.substring(0, 500) }), {
      status: 502, headers: { ...cors, 'Content-Type': 'application/json' }
    });
  }
  const listJson = await listResp.json();
  const templates = listJson.data || [];

  const result = { scanned: templates.length, updated: [], skipped: [], errors: [] };

  for (const tpl of templates) {
    // Only update templates that contain the old URL in any text component
    const hasOldUrl = (tpl.components || []).some((c) => {
      if (typeof c.text === 'string' && c.text.includes(OLD_URL)) return true;
      if (Array.isArray(c.buttons)) {
        return c.buttons.some((b) => typeof b.url === 'string' && b.url.includes(OLD_URL));
      }
      return false;
    });

    if (!hasOldUrl) {
      result.skipped.push({ name: tpl.name, reason: 'no old URL' });
      continue;
    }

    // Replace old URL with new URL in all text + button URL fields
    const newComponents = (tpl.components || []).map((c) => {
      const copy = { ...c };
      if (typeof copy.text === 'string') {
        copy.text = copy.text.split(OLD_URL).join(NEW_URL);
      }
      if (Array.isArray(copy.buttons)) {
        copy.buttons = copy.buttons.map((b) => {
          if (typeof b.url === 'string') {
            return { ...b, url: b.url.split(OLD_URL).join(NEW_URL) };
          }
          return b;
        });
      }
      return copy;
    });

    // Submit edit via POST /{template_id}
    try {
      const editResp = await fetch(
        `https://graph.facebook.com/${META_API_VERSION}/${tpl.id}`,
        {
          method: 'POST',
          headers: { ...auth, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            category: tpl.category,
            components: newComponents
          })
        }
      );
      const editText = await editResp.text();
      let editJson;
      try { editJson = JSON.parse(editText); } catch (e) { editJson = { raw: editText }; }
      if (editResp.ok) {
        result.updated.push({ name: tpl.name, id: tpl.id, status: 'submitted', resp: editJson });
      } else {
        result.errors.push({ name: tpl.name, id: tpl.id, status: editResp.status, resp: editJson });
      }
    } catch (e) {
      result.errors.push({ name: tpl.name, id: tpl.id, error: String(e && e.message || e) });
    }
  }

  return new Response(JSON.stringify(result, null, 2), {
    status: 200, headers: { ...cors, 'Content-Type': 'application/json' }
  });
}
