// /api/wa-template-fix.js — one-shot: delete the 2 mis-categorized templates
// and recreate them with the correct UTILITY category.
//
// Background: when the user created tfugen_task_overdue and
// tfugen_expiry_warning(_body) via the WhatsApp Manager UI, Meta
// auto-classified them as MARKETING because of the action wording.
// Marketing requires explicit recipient opt-in and is more likely to be
// rejected for operational alerts. We force UTILITY here via API.
//
// POST only. Pass header `x-confirm: yes` to actually run.

export const config = { runtime: 'edge' };

const META_API_VERSION = 'v25.0';
const FALLBACK_WABA_ID = '4400035656982783';
const ALLOWED_ORIGINS = ['https://tfugen-safety.vercel.app'];
const PREVIEW_RE = /^https:\/\/tfugen-safety-[a-z0-9-]+-mishaf1988-lgtms-projects\.vercel\.app$/;

function originOk(origin) {
  if (!origin) return false;
  if (ALLOWED_ORIGINS.includes(origin)) return true;
  return PREVIEW_RE.test(origin);
}

const TEMPLATES_TO_CREATE = [
  {
    name: 'tfugen_task_overdue',
    language: 'he',
    category: 'UTILITY',
    components: [{
      type: 'BODY',
      text: '⏰ משימה בפיגור\n\nהמשימה "{{1}}" עברה את היעד שלה.\nאיחור: {{2}} ימים.\n\nנא לעדכן סטטוס:\nhttps://tfugen-safety.vercel.app',
      example: { body_text: [['החלפת מטף כיבוי במחסן 3', '5']] }
    }]
  },
  {
    name: 'tfugen_expiry_warning',
    language: 'he',
    category: 'UTILITY',
    components: [{
      type: 'BODY',
      text: '🔧 תזכורת חידוש\n\n{{1}} פג תוקף בעוד {{2}} ימים ({{3}}).\n\nנא לתאם חידוש:\nhttps://tfugen-safety.vercel.app',
      example: { body_text: [['מטף כיבוי באולם A', '14', '15/05/2026']] }
    }]
  }
];

const TEMPLATES_TO_DELETE = ['tfugen_task_overdue', 'tfugen_expiry_warning_body'];

export default async function handler(req) {
  const origin = req.headers.get('origin') || '';
  const cors = {
    'Access-Control-Allow-Origin': originOk(origin) ? origin : ALLOWED_ORIGINS[0],
    'Access-Control-Allow-Methods': 'POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, x-confirm',
    'Vary': 'Origin'
  };

  if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'method not allowed; POST only' }), {
      status: 405, headers: { ...cors, 'Content-Type': 'application/json' }
    });
  }
  if (req.headers.get('x-confirm') !== 'yes') {
    return new Response(JSON.stringify({ error: 'missing x-confirm: yes header' }), {
      status: 400, headers: { ...cors, 'Content-Type': 'application/json' }
    });
  }

  const TOKEN = process.env.META_ACCESS_TOKEN;
  const WABA = process.env.META_WABA_ID || FALLBACK_WABA_ID;
  if (!TOKEN) {
    return new Response(JSON.stringify({ error: 'META_ACCESS_TOKEN not set' }), {
      status: 500, headers: { ...cors, 'Content-Type': 'application/json' }
    });
  }

  const auth = { 'Authorization': `Bearer ${TOKEN}`, 'Content-Type': 'application/json' };
  const result = { deleted: [], created: [], errors: [] };

  for (const name of TEMPLATES_TO_DELETE) {
    try {
      const r = await fetch(
        `https://graph.facebook.com/${META_API_VERSION}/${WABA}/message_templates?name=${encodeURIComponent(name)}`,
        { method: 'DELETE', headers: auth }
      );
      const t = await r.text();
      result.deleted.push({ name, status: r.status, body: t.substring(0, 300) });
    } catch (e) {
      result.errors.push({ step: 'delete', name, error: String(e && e.message || e) });
    }
  }

  for (const tpl of TEMPLATES_TO_CREATE) {
    try {
      const r = await fetch(
        `https://graph.facebook.com/${META_API_VERSION}/${WABA}/message_templates`,
        { method: 'POST', headers: auth, body: JSON.stringify(tpl) }
      );
      const t = await r.text();
      result.created.push({ name: tpl.name, status: r.status, body: t.substring(0, 500) });
    } catch (e) {
      result.errors.push({ step: 'create', name: tpl.name, error: String(e && e.message || e) });
    }
  }

  return new Response(JSON.stringify(result, null, 2), {
    status: 200, headers: { ...cors, 'Content-Type': 'application/json' }
  });
}
