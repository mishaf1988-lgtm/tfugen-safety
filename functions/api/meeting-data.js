// Cloudflare Pages Function: the meeting data (stage 5, 28/09). See
// functions/_meeting.js for the definitions. POST {ref?: 'YYYY-MM-DD'} (the
// meeting date, default today in Israel). Admin/manager session, or the server
// secret (x-notify-secret) so the numbers can be checked from the database.
import { defaultAllowedOrigins, corsHeaders, jsonResp, requireRole } from '../_shared.js';
import { buildRegister, readAll, TASKS_Q } from './hazard-file.js';
import { meetingHazards, meetingAccidents } from '../_meeting.js';

export async function onRequest(context) {
  const { request, env } = context;
  const cors = corsHeaders(request.headers.get('Origin') || '', defaultAllowedOrigins(env), 'POST,OPTIONS');
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (request.method !== 'POST') return jsonResp({ error: 'method not allowed' }, 405, cors);
  const secret = env.TRUSTEE_NOTIFY_SECRET;
  const bySecret = !!secret && (request.headers.get('x-notify-secret') || '') === secret;
  if (!bySecret) {
    const who = await requireRole(request, env, ['admin', 'manager']);
    if (!who.ok) return jsonResp({ error: who.error }, who.status, cors);
  }
  if (!env.SUPABASE_SERVICE_ROLE_KEY) return jsonResp({ error: 'server misconfigured' }, 500, cors);
  let body = {}; try { body = await request.json(); } catch (e) {}
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jerusalem' });
  const ref = /^\d{4}-\d{2}-\d{2}$/.test(String(body.ref || '')) ? body.ref : today;
  try {
    const [hazards, reports, inc, tasks] = await Promise.all([
      readAll(env, 'tour_hazards?select=id,n,d,tour_no,dept,loc,descr,sev,resp,resp2,action,due,s,closed_d,notes&order=n.asc'),
      readAll(env, 'trustee_reports?select=id,num,u,t,d,loc,ok,f,s,ref,mgr_note,action,closed_d,ts&order=ts.asc'),
      readAll(env, 'inc?select=id,dt,d,l,dept,reported,r,ty&order=dt.asc'),
      readAll(env, TASKS_Q),
    ]);
    const rows = buildRegister(hazards, reports, tasks).rows;
    return jsonResp({ ok: true, ref, generatedAt: new Date().toISOString(), hazards: meetingHazards(rows, ref), accidents: meetingAccidents(inc, ref) }, 200, cors);
  } catch (e) {
    return jsonResp({ ok: false, error: String((e && e.message) || e).substring(0, 200) }, 200, cors);
  }
}
