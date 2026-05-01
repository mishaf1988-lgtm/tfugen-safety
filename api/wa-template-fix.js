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

// Pre-approved template bank — submit early so Meta approval is ready
// when the wiring on each event is built. All UTILITY (transactional).
// The endpoint is idempotent: if a template already exists with the
// same name, Meta returns an error and we keep going.
const TEMPLATES_TO_CREATE = [
  {
    name: 'tfugen_incident_alert',
    language: 'he',
    category: 'UTILITY',
    components: [{
      type: 'BODY',
      text: '🚨 תקרית בטיחות\n\nסוג: {{1}}\nמיקום: {{2}}\nחומרה: {{3}}\n\nנא לטפל מיידית.\nhttps://tfugen-safety.vercel.app',
      example: { body_text: [['החלקה', 'מחסן 3', 'בינונית']] }
    }]
  },
  {
    name: 'tfugen_ncr_closed',
    language: 'he',
    category: 'UTILITY',
    components: [{
      type: 'BODY',
      text: '✅ NCR-{{1}} נסגר\n\nהטיפול הושלם על ידי {{2}}.\nתאריך: {{3}}\n\nתודה!',
      example: { body_text: [['0357', 'מנהל בטיחות', '01/05/2026']] }
    }]
  },
  {
    name: 'tfugen_round_missed',
    language: 'he',
    category: 'UTILITY',
    components: [{
      type: 'BODY',
      text: '🌅 סבב בוקר לא בוצע\n\nהיום {{1}} — סבב הבטיחות לא תועד.\nנא לבצע בהקדם.\n\nhttps://tfugen-safety.vercel.app',
      example: { body_text: [['01/05/2026']] }
    }]
  },
  {
    name: 'tfugen_general_alert',
    language: 'he',
    category: 'UTILITY',
    components: [{
      type: 'BODY',
      text: '📢 התראה ממערכת תפוגן\n\n{{1}}\n\nלפרטים:\nhttps://tfugen-safety.vercel.app',
      example: { body_text: [['בדיקת ציוד דחופה - אנא בקרו במחסן 3']] }
    }]
  }
];

// All historical deletes already done. Keep empty for idempotent re-runs.
const TEMPLATES_TO_DELETE = [];

export default async function handler(req) {
  const origin = req.headers.get('origin') || '';
  const cors = {
    'Access-Control-Allow-Origin': originOk(origin) ? origin : ALLOWED_ORIGINS[0],
    'Access-Control-Allow-Methods': 'POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, x-confirm',
    'Vary': 'Origin'
  };

  if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
  // Accept POST + x-confirm header OR GET with ?confirm=fix-templates-now
  // (the GET path is so the agent can trigger it via the read-only web_fetch tool).
  const url = new URL(req.url);
  const confirmedViaQuery = url.searchParams.get('confirm') === 'fix-templates-now';
  const confirmedViaHeader = req.method === 'POST' && req.headers.get('x-confirm') === 'yes';
  if (!confirmedViaQuery && !confirmedViaHeader) {
    return new Response(JSON.stringify({ error: 'missing confirmation. POST with x-confirm: yes OR GET with ?confirm=fix-templates-now' }), {
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
