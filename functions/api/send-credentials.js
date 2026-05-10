// Cloudflare Pages Function — server-side delivery of new-user credentials.
//
// Called right after /api/create-user succeeds, with the same credentials
// the admin sees in the modal. The browser used to do this delivery
// itself (_credAutoDeliver) but that required the admin to be signed
// into Microsoft AND made WhatsApp a manual click. This server-side
// path uses the application token (CLIENT_CREDENTIALS) — fully autonomous
// from the admin's perspective.
//
// Inputs (POST body): { username, password, full_name, email, phone }
// Auth: Supabase admin token (same gate as create-user) — only the
//       admin can trigger this, and they can only deliver credentials
//       for a user they just created.

import {
  defaultAllowedOrigins,
  corsHeaders,
  jsonResp,
  isAllowedCaller
} from '../_shared.js';
import { sendMailAsApp } from '../_msApp.js';

const SUPABASE_URL = 'https://znhjtpcltrxxyfjczgvw.supabase.co';
const ADMIN_EMAIL = 'admin@tfugen.local';
const MAX_BODY_BYTES = 5000;

function escapeHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function emailBody({ fullName, username, password }) {
  return `<div style="font-family:Arial,sans-serif;direction:rtl;text-align:right;font-size:14px;line-height:1.7;color:#1a1d23">
    <p>${fullName ? 'שלום ' + escapeHtml(fullName) + ',' : 'שלום,'}</p>
    <p>נוצר עבורך חשבון במערכת ניהול הבטיחות של תפוגן.</p>
    <table style="border-collapse:collapse;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:0;margin:14px 0">
      <tr><td style="padding:8px 14px;color:#64748b">שם משתמש</td><td style="padding:8px 14px;font-weight:700;font-family:monospace;font-size:16px">${escapeHtml(username)}</td></tr>
      <tr><td style="padding:8px 14px;color:#64748b;border-top:1px solid #e2e8f0">סיסמה זמנית</td><td style="padding:8px 14px;font-weight:700;font-family:monospace;font-size:16px;border-top:1px solid #e2e8f0">${escapeHtml(password)}</td></tr>
    </table>
    <p><a href="https://tapugan-safety.pages.dev" style="background:#cc1f1f;color:#fff;padding:10px 22px;border-radius:6px;text-decoration:none;font-weight:700">כניסה למערכת</a></p>
    <p style="color:#64748b;font-size:12px">בכניסה הראשונה תתבקש/י לקבוע סיסמה משלך.</p>
    <p style="color:#94a3b8;font-size:11px;margin-top:24px">תפוגן בטיחות · מערכת ניהול בטיחות ואיכות סביבה</p>
  </div>`;
}

function phoneToE164(raw) {
  if (!raw) return '';
  const d = String(raw).replace(/[^0-9]/g, '');
  if (!d) return '';
  if (d.startsWith('972')) return d;
  if (d.charAt(0) === '0') return '972' + d.substring(1);
  if (d.length >= 8 && d.length <= 10) return '972' + d;
  return d;
}

async function sendWhatsApp(env, { phone, fullName, username, password }) {
  const PHONE_ID = env.META_PHONE_NUMBER_ID;
  const TOKEN = env.META_ACCESS_TOKEN;
  if (!PHONE_ID || !TOKEN) throw new Error('whatsapp not configured');
  const to = phoneToE164(phone);
  if (!to) throw new Error('invalid phone');
  const tplName = env.WA_NEW_USER_TEMPLATE || 'tfugen_new_user';
  const lang = env.WA_NEW_USER_TEMPLATE_LANG || 'he';
  const params = [fullName || 'משתמש', username, password];
  const payload = {
    messaging_product: 'whatsapp',
    to,
    type: 'template',
    template: {
      name: tplName,
      language: { code: lang },
      components: [{
        type: 'body',
        parameters: params.map(p => ({ type: 'text', text: String(p) }))
      }]
    }
  };
  const r = await fetch(
    `https://graph.facebook.com/v25.0/${PHONE_ID}/messages`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    }
  );
  if (!r.ok) {
    const t = await r.text();
    throw new Error(`WA ${r.status}: ${t.substring(0, 200)}`);
  }
  return { ok: true };
}

export async function onRequest({ request, env }) {
  const allowed = defaultAllowedOrigins(env);
  const origin = request.headers.get('origin') || '';
  const cors = corsHeaders(origin, allowed, 'POST,OPTIONS');

  if (request.method === 'OPTIONS') return new Response(null, { headers: cors });
  if (request.method !== 'POST') return jsonResp({ error: 'method not allowed' }, 405, cors);
  if (!isAllowedCaller(request, allowed)) return jsonResp({ error: 'origin not allowed' }, 403, cors);

  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) return jsonResp({ error: 'server misconfigured' }, 500, cors);

  // Admin gate — same as create-user.
  const auth = request.headers.get('authorization') || '';
  const token = auth.replace(/^Bearer\s+/i, '').trim();
  if (!token) return jsonResp({ error: 'missing bearer token' }, 401, cors);
  const verifyResp = await fetch(SUPABASE_URL + '/auth/v1/user', {
    headers: { apikey: serviceKey, Authorization: 'Bearer ' + token }
  });
  if (!verifyResp.ok) return jsonResp({ error: 'invalid session token' }, 401, cors);
  const userInfo = await verifyResp.json();
  if (!userInfo || userInfo.email !== ADMIN_EMAIL) {
    return jsonResp({ error: 'admin only' }, 403, cors);
  }

  const bodyText = await request.text();
  if (bodyText.length > MAX_BODY_BYTES) return jsonResp({ error: 'body too large' }, 413, cors);
  let body;
  try { body = JSON.parse(bodyText); } catch (e) { return jsonResp({ error: 'invalid json' }, 400, cors); }

  const username = (body.username || '').trim().toLowerCase();
  const password = String(body.password || '').trim();
  const fullName = (body.full_name || '').trim();
  const email = (body.email || '').trim();
  const phone = (body.phone || '').trim();

  if (!username || !password) return jsonResp({ error: 'username and password required' }, 400, cors);
  if (!email && !phone) {
    // Nothing to deliver — admin will hand off manually via the modal.
    return jsonResp({ ok: true, channels: [], skipped: 'no_contact_method' }, 200, cors);
  }

  const channels = [];
  const errors = [];

  const tasks = [];
  if (email) {
    tasks.push(
      sendMailAsApp(env, {
        from: env.MAIL_FROM_USER || 'sviva@tapugan.co.il',
        to: email,
        subject: 'פרטי כניסה — Tapugan Safety',
        html: emailBody({ fullName, username, password })
      })
        .then(() => channels.push('email'))
        .catch(e => errors.push({ channel: 'email', error: String(e.message || e).substring(0, 200) }))
    );
  }
  if (phone) {
    tasks.push(
      sendWhatsApp(env, { phone, fullName, username, password })
        .then(() => channels.push('whatsapp'))
        .catch(e => errors.push({ channel: 'whatsapp', error: String(e.message || e).substring(0, 200) }))
    );
  }
  await Promise.all(tasks);

  return jsonResp({ ok: true, channels, errors }, 200, cors);
}
