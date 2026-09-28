// Cloudflare Pages Function: the committee deck in folder 13, updated in place
// from the meeting data (28/09; DECISIONS 2026-09-28; functions/_deckpatch.js).
//   \u05de\u05e6\u05d2\u05ea \u05e9\u05d1\u05d5\u05e2\u05d9\u05ea.\u05d7\u05d5\u05d3\u05e9\u05d9\u05ea.pptx next to the hazard workbook.
// The meeting date: the one the manager set in the app (server_state
// deck_meeting_date) while it is current, else this week's Tuesday (Sunday to
// Wednesday) or next week's (Thursday on): the meeting is on Tuesday or
// Wednesday and its week is Sunday..Saturday before it either way.
// Once per meeting date, before the first write, the deck as it was is copied
// to \u05d0\u05e8\u05db\u05d9\u05d5\u05df/\u05de\u05e6\u05d2\u05d5\u05ea. Unchanged content = nothing written. Open in PowerPoint
// (423) = written by the next 15-minute run.
// Callers: the hazard-file chain (x-notify-secret) and the app: {op:'status'},
// {op:'setDate', date}, {force:true} (admin/manager session).
import { defaultAllowedOrigins, corsHeaders, jsonResp, requireRole } from '../_shared.js';
import { odConfigured, accessToken, stateGet, stateSet } from '../_onedrive.js';
import { FOLDER, G, seg, graphPut, stampName, buildRegister, readAll, TASKS_Q } from './hazard-file.js';
import { meetingHazards, meetingAccidents } from '../_meeting.js';
import { deckContent, patchDeck } from '../_deckpatch.js';

export const DECK = { name: '\u05de\u05e6\u05d2\u05ea \u05e9\u05d1\u05d5\u05e2\u05d9\u05ea.\u05d7\u05d5\u05d3\u05e9\u05d9\u05ea.pptx', type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' };
// Bump when deckContent/patchDeck change what they write.
export const DECK_VERSION = 4;
const DAY = 86400000;
const addDays = (ymd, n) => new Date(Date.parse(ymd + 'T12:00:00Z') + n * DAY).toISOString().substring(0, 10);
const dow = (ymd) => new Date(Date.parse(ymd + 'T12:00:00Z')).getUTCDay();
export function defaultMeeting(today) {
  const d = dow(today); // 0 = Sunday
  return d <= 3 ? addDays(today, 2 - d) : addDays(today, 9 - d);
}
export function meetingDate(today, stored) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(stored || '') && stored >= addDays(today, -2) && stored <= addDays(today, 13)) return stored;
  return defaultMeeting(today);
}
async function sha(s) {
  const h = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return Array.from(new Uint8Array(h)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function runDeck(env, force) {
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jerusalem' });
  const st = await stateGet(env, ['deck_sig', 'deck_ctag', 'deck_week', 'deck_meeting_date']).catch(() => ({}));
  const val = (k) => (st[k] && st[k].value) || '';
  const date = meetingDate(today, val('deck_meeting_date'));
  const [hazards, reports, tasks, inc] = await Promise.all([
    readAll(env, 'tour_hazards?select=id,n,d,tour_no,dept,loc,descr,sev,resp,resp2,action,due,s,closed_d,notes&order=n.asc'),
    readAll(env, 'trustee_reports?select=id,u,t,d,loc,ok,f,s,ref,mgr_note,action,closed_d,ts&order=ts.asc'),
    readAll(env, TASKS_Q),
    readAll(env, 'inc?select=id,dt,d,l,dept,reported,r,ty&order=dt.asc'),
  ]);
  const rows = buildRegister(hazards, reports, tasks).rows;
  const m = { hazards: meetingHazards(rows, date), accidents: meetingAccidents(inc, date) };
  // The code's version is in the signature too: a wording fix must reach the
  // deck without waiting for the data to change (28/09, PR #918).
  const sig = await sha(JSON.stringify([date, m, rows, DECK_VERSION]));
  const now = new Date().toISOString();
  try {
    const { token } = await accessToken(env);
    const mr = await fetch(G + seg(FOLDER) + '/' + encodeURIComponent(DECK.name) + '?select=id,cTag,lastModifiedDateTime,webUrl,@microsoft.graph.downloadUrl', { headers: { Authorization: 'Bearer ' + token } });
    if (mr.status === 404) throw Object.assign(new Error('the deck is not in the folder: ' + FOLDER + '/' + DECK.name), { status: 404 });
    if (!mr.ok) throw Object.assign(new Error('onedrive ' + mr.status), { status: mr.status });
    const meta = await mr.json();
    if (!force && val('deck_sig') === sig && val('deck_ctag') === meta.cTag) return { ok: true, pushed: false, reason: 'unchanged', date };
    const dl = await fetch(meta['@microsoft.graph.downloadUrl']);
    if (!dl.ok) throw new Error('download failed (' + dl.status + ')');
    const orig = new Uint8Array(await dl.arrayBuffer());
    const { bytes, report, changed } = await patchDeck(orig, deckContent(m, rows, date));
    // Nothing to change in the file (OneDrive bumped the cTag after our last
    // upload, or a person saved it without touching the numbers): remember the
    // cTag, write nothing, or this would rewrite the deck every 15 minutes.
    if (!changed.length && !force) {
      await stateSet(env, { deck_sig: sig, deck_ctag: meta.cTag || '', deck_week: date });
      return { ok: true, pushed: false, reason: 'already up to date', date, report };
    }
    let kept = null;
    if (val('deck_week') !== date) {
      kept = FOLDER + '/\u05d0\u05e8\u05db\u05d9\u05d5\u05df/\u05de\u05e6\u05d2\u05d5\u05ea';
      await graphPut(token, kept, stampName(DECK.name, (meta.lastModifiedDateTime || now)), orig, DECK.type);
    }
    const put = await graphPut(token, FOLDER, DECK.name, bytes, DECK.type);
    await stateSet(env, { deck_sig: sig, deck_ctag: put.cTag || '', deck_week: date, deck_at: now, deck_err: '', deck_report: report.join('; '), deck_url: put.webUrl || meta.webUrl || '' });
    return { ok: true, pushed: true, date, kept, report, webUrl: put.webUrl || null };
  } catch (e) {
    const msg = e && e.code === 'not_connected' ? 'not connected'
      : e && e.status === 423 ? '\u05d4\u05de\u05e6\u05d2\u05ea \u05e4\u05ea\u05d5\u05d7\u05d4. \u05ea\u05e2\u05d5\u05d3\u05db\u05df \u05d0\u05d5\u05d8\u05d5\u05de\u05d8\u05d9\u05ea \u05d0\u05d7\u05e8\u05d9 \u05e9\u05ea\u05d9\u05e1\u05d2\u05e8 (\u05d1\u05d3\u05d9\u05e7\u05d4 \u05db\u05dc 15 \u05d3\u05e7\u05d5\u05ea).'
        : String((e && e.message) || e).substring(0, 200);
    await stateSet(env, { deck_err: msg, deck_err_at: now }).catch(() => {});
    return { ok: false, pushed: false, error: msg, locked: !!(e && e.status === 423), date };
  }
}

export async function onRequest(context) {
  const { request, env } = context;
  const cors = corsHeaders(request.headers.get('Origin') || '', defaultAllowedOrigins(env), 'POST,OPTIONS');
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (request.method !== 'POST') return jsonResp({ error: 'method not allowed' }, 405, cors);
  if (!env.SUPABASE_SERVICE_ROLE_KEY) return jsonResp({ error: 'server misconfigured' }, 500, cors);
  let body = {}; try { body = await request.json(); } catch (e) {}
  const secret = env.TRUSTEE_NOTIFY_SECRET;
  if (!(secret && (request.headers.get('x-notify-secret') || '') === secret)) {
    const who = await requireRole(request, env, ['admin', 'manager']);
    if (!who.ok) return jsonResp({ error: who.error }, who.status, cors);
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jerusalem' });
    if (body.op === 'status' || body.op === 'setDate') {
      if (body.op === 'setDate') {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(String(body.date || ''))) return jsonResp({ ok: false, error: 'bad date' }, 400, cors);
        await stateSet(env, { deck_meeting_date: body.date });
      }
      const s = await stateGet(env, ['deck_at', 'deck_err', 'deck_err_at', 'deck_url', 'deck_report', 'deck_meeting_date']).catch(() => ({}));
      const v = (k) => (s[k] && s[k].value) || null;
      return jsonResp({ ok: true, name: DECK.name, folder: FOLDER, date: meetingDate(today, v('deck_meeting_date')), last: v('deck_at'), error: v('deck_err'), errorAt: v('deck_err_at'), webUrl: v('deck_url'), report: v('deck_report') }, 200, cors);
    }
  }
  if (!odConfigured(env)) return jsonResp({ ok: false, error: 'server not configured' }, 200, cors);
  try { return jsonResp(await runDeck(env, body.force === true), 200, cors); }
  catch (e) { return jsonResp({ ok: false, error: String((e && e.message) || e).substring(0, 200) }, 200, cors); }
}
