// Cloudflare Pages Function: the report to each department (stage 4, 28/09).
// Replaces the workbook macro "\u05e9\u05dc\u05d7 \u05d3\u05d5"\u05d7 \u05d1\u05d8\u05d9\u05d7\u05d5\u05ea" (sheet "\u05d3\u05d5\u05d7 \u05dc\u05e9\u05dc\u05d9\u05d7\u05d4"), with
// the same rules, read from the same workbook so a change there applies here:
//   * rows: the department's hazards that are not \u05e1\u05d2\u05d5\u05e8, from the merged
//     register (manager + trustees, hazard-file.js buildRegister), columns
//     \u05de\u05e1"\u05d3 / \u05de\u05d9\u05e7\u05d5\u05dd / \u05ea\u05d9\u05d0\u05d5\u05e8 / \u05d7\u05d5\u05de\u05e8\u05d4 / \u05d0\u05d7\u05e8\u05d0\u05d9 / \u05e4\u05e2\u05d5\u05dc\u05d4 / \u05d9\u05e2\u05d3 / \u05e1\u05d8\u05d8\u05d5\u05e1. A hazard from
//     an earlier tour of the department (its tour number below the latest)
//     says "<status> - \u05de\u05e1\u05d9\u05d5\u05e8 \u05e7\u05d5\u05d3\u05dd!" and is highlighted, like column N. Past its
//     target: "\u05e2\u05d1\u05e8 \u05d4\u05d9\u05e2\u05d3" in red under the date (28/09).
//   * \u05d0\u05dc: the department's managers (sheet "\u05e0\u05de\u05e2\u05e0\u05d9\u05dd", part 1), plus \u05d0\u05d7\u05d6\u05e7\u05d4 /
//     \u05d7\u05e9\u05de\u05dc / \u05d4\u05e0\u05d3\u05e1\u05d4 when one of the rows is theirs (part 2), plus the
//     \u05d4\u05e0\u05d3\u05e1\u05d4 row (\u05e9\u05dc\u05d5\u05de\u05d9, their manager) when a row is for \u05d0\u05d7\u05d6\u05e7\u05d4 or \u05d7\u05e9\u05de\u05dc.
//     \u05e2\u05d5\u05ea\u05e7: part 3, on every mail.
//   * the opening and closing lines: L1 / L2 of "\u05d3\u05d5\u05d7 \u05dc\u05e9\u05dc\u05d9\u05d7\u05d4".
// Sent from sviva's Outlook (Graph, Mail.Send), kept in Sent Items.
// Only on request (Michael: "\u05e8\u05e7 \u05db\u05e4\u05ea\u05d5\u05e8 \u05d1\u05d0\u05e4\u05dc\u05d9\u05e7\u05e6\u05d9\u05d4"): admin/manager session.
// POST {op:'preview'} -> every department; {op:'send', depts:[...], test?}.
// test: true sends each report to the connected account only.
import { defaultAllowedOrigins, corsHeaders, jsonResp, requireRole } from '../_shared.js';
import { odConfigured, accessToken, tokenRow, hasMail, sendMailTo, stateSet, stateGet } from '../_onedrive.js';
import { readSheetRows, sheetsDigest } from '../_xlsxpatch.js';
import { makeCloseToken, closeUrl } from '../_closelink.js';
import { FILES, REPORT_DEPTS, buildRegister, readAll, TASKS_Q, photoOf, signPhotos, fetchThumb, ilYear, folderFor } from './hazard-file.js';
import { suggestAction } from '../_ai.js';

const G = 'https://graph.microsoft.com/v1.0/me/drive/root:/';
const APP_URL = 'https://tapugan-safety.pages.dev';
const CLOSE_TH = '\u05e1\u05d2\u05d9\u05e8\u05d4', CLOSE_LINK = '\u2705 \u05e1\u05de\u05df \u05db\u05d8\u05d5\u05e4\u05dc';
const seg = (p) => String(p).split('/').filter(Boolean).map(encodeURIComponent).join('/');
const S_DONE = '\u05e1\u05d2\u05d5\u05e8';
const OLD = ' - \u05de\u05e1\u05d9\u05d5\u05e8 \u05e7\u05d5\u05d3\u05dd!';
const RESP_KEYS = ['\u05d0\u05d7\u05d6\u05e7\u05d4', '\u05d7\u05e9\u05de\u05dc', '\u05d4\u05e0\u05d3\u05e1\u05d4'];
const DEFAULT_OPEN = '\u05e9\u05dc\u05d5\u05dd, \u05dc\u05d4\u05dc\u05df \u05d4\u05de\u05e4\u05d2\u05e2\u05d9\u05dd \u05d4\u05e4\u05ea\u05d5\u05d7\u05d9\u05dd \u05e9\u05e0\u05de\u05e6\u05d0\u05d5 \u05d1\u05e1\u05d9\u05d5\u05e8 \u05d4\u05d1\u05d8\u05d9\u05d7\u05d5\u05ea \u05d5\u05d3\u05d5\u05e8\u05e9\u05d9\u05dd \u05d8\u05d9\u05e4\u05d5\u05dc.';
// Michael's own Outlook signature (29/09/2026, from his screenshot), under every
// report. The closing line of the sheet (L2) is shown above it only when it is
// something other than a "בברכה" line, which the signature already opens with.
export const SIGNATURE = '<div style="margin-top:16px;font-family:Arial,sans-serif;font-size:14px">\u05d1\u05d1\u05e8\u05db\u05d4,<br><br><span style="color:#e00000;font-weight:bold">\u05de\u05d9\u05db\u05d0\u05dc \u05e4\u05e8\u05d9\u05d9\u05dc\u05d9\u05da.</span><br>\u05de\u05e0\u05d4\u05dc \u05d0\u05d9\u05db\u05d5\u05ea \u05d4\u05e1\u05d1\u05d9\u05d1\u05d4 \u05d5\u05d1\u05d8\u05d9\u05d7\u05d5\u05ea(\u05de\u05de\u05d5\u05e0\u05d4 \u05d4\u05d1\u05d8\u05d9\u05d7\u05d5\u05ea) // <span style="color:#e00000;font-weight:bold">\u05ea\u05e2\u05e9\u05d9\u05d5\u05ea \u05ea\u05e4\u05d5\u05d2\u05df \u05d1\u05e2&quot;\u05de</span><br><span style="font-size:12px"><span style="font-weight:bold">\u05e0\u05d9\u05d9\u05d3:</span> 0547940073 / <span style="font-weight:bold">\u05de\u05e9\u05e8\u05d3:</span> 08-6808365 / <a href="mailto:sviva@tapugan.co.il" style="font-weight:bold">sviva@tapugan.co.il</a></span><br><div style="border-top:2px solid #f5c400;width:340px;margin:12px 0"></div><a href="https://www.tapugan.co.il" style="color:#e00000;font-weight:bold">www.tapugan.co.il</a></div>';
const REGARDS = /^\s*\u05d1\u05d1\u05e8\u05db\u05d4/;
const PHOTO_TH = '\u05ea\u05de\u05d5\u05e0\u05d4', PHOTO_LINK = '\u05ea\u05de\u05d5\u05e0\u05d4';
// Pictures in a send: at most this many in all (each is a download, and the
// free plan counts them), this wide, attached inline so Outlook shows them
// without "download pictures". The rest get a link.
const MAIL_PICS = 20, MAIL_PIC_W = 400;
function b64(u8) { let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s); }
const emails = (t) => String(t || '').split(/[,;\s]+/).map((x) => x.trim()).filter((x) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(x));
const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
// 06/10/2026 (Michael): severity as a traffic light in the mail.
export const SEV_COLOR = { '\u05d2\u05d1\u05d5\u05d4\u05d4': '#c00000', '\u05d1\u05d9\u05e0\u05d5\u05e0\u05d9\u05ea': '#e8710a', '\u05e0\u05de\u05d5\u05db\u05d4': '#2e7d32' };
const fd = (v) => { const d = v && typeof v === 'object' ? v.date : v; const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(d || '')); return m ? m[3] + '/' + m[2] + '/' + m[1] : ''; };

// Pure: the "\u05e0\u05de\u05e2\u05e0\u05d9\u05dd" sheet (readSheetRows from row 1) -> who gets what.
export function parseRecipients(rows) {
  const out = { depts: {}, resp: {}, cc: [] };
  let part = 0;
  (rows || []).forEach(({ v }) => {
    const a = String(v[0] || '').trim();
    const p = /^([123])\./.exec(a); if (p) { part = +p[1]; return; }
    if (part === 1) { const d = REPORT_DEPTS.find((x) => x === a); const e = emails(v[2]); if (d && e.length) out.depts[d] = e; }
    else if (part === 2) { const k = RESP_KEYS.find((x) => a.indexOf(x) === 0); const e = emails(v[1]); if (k && e.length) out.resp[k] = e; }
    else if (part === 3) { emails(v[1]).forEach((x) => out.cc.push(x)); }
  });
  return out;
}

// Pure: one department's report from the register rows.
// photos (optional): Map register row -> {cid} (a picture in the mail) or
// {link} (a link to it), 29/09/2026: the report carries the hazards' photos.
// links (optional): Map register row -> the signed "mark as handled" URL
// (close-hazard.js; upgrade review 13, 30/09/2026). Only in a real send.
export function buildReport(dept, rows, rcpt, texts, today, photos, links) {
  const mine = rows.filter((r) => r[3] === dept);
  const latest = mine.reduce((m, r) => Math.max(m, +r[2] || 0), 0);
  const open = mine.filter((r) => r[10] !== S_DONE).map((r) => {
    const old = !!latest && (+r[2] || 0) > 0 && +r[2] < latest;
    const dueY = r[9] && typeof r[9] === 'object' ? r[9].date : '';
    const overdue = !!today && !!dueY && dueY < today;
    const ph = photos && photos.get(r) ? photos.get(r) : null;
    // src: the register row it came from (not sent to the page), to find its photo.
    return Object.defineProperty({ n: r[0], opened: fd(r[1]), loc: r[4] || '', descr: r[5] || '', sev: r[6] || '', resp: r[7] || '', action: r[8] || '', due: fd(r[9]), status: (r[10] || '') + (old ? OLD : ''), old, overdue, photo: ph, close: (links && links.get(r)) || null }, 'src', { value: r });
  });
  const seen = new Set(), to = [];
  const add = (list) => (list || []).forEach((x) => { const k = x.toLowerCase(); if (!seen.has(k)) { seen.add(k); to.push(x); } });
  // Maintenance (30/09/2026, Michael: every maintenance finding, in any
  // department, goes to Vitaly, Slava and Shlomi): the three rows of part 2 of
  // the recipients sheet, אחזקה + חשמל + הנדסה. The same three are the
  // maintenance department's own recipients when part 1 has no אחזקה row.
  const MAINT_TEAM = ['\u05d0\u05d7\u05d6\u05e7\u05d4', '\u05d7\u05e9\u05de\u05dc', '\u05d4\u05e0\u05d3\u05e1\u05d4'];
  add(rcpt.depts[dept]);
  if (dept === '\u05d0\u05d7\u05d6\u05e7\u05d4' && !(rcpt.depts[dept] || []).length) MAINT_TEAM.forEach((k) => add(rcpt.resp[k]));
  const who = new Set();
  open.forEach((r) => String(r.resp).split(/\s*\+\s*/).forEach((x) => { if (RESP_KEYS.indexOf(x) >= 0) who.add(x); }));
  RESP_KEYS.forEach((k) => { if (who.has(k)) add(rcpt.resp[k]); });
  if (who.has('\u05d0\u05d7\u05d6\u05e7\u05d4')) MAINT_TEAM.forEach((k) => add(rcpt.resp[k]));
  if (who.has('\u05d0\u05d7\u05d6\u05e7\u05d4') || who.has('\u05d7\u05e9\u05de\u05dc')) add(rcpt.resp['\u05d4\u05e0\u05d3\u05e1\u05d4']);
  const cc = [];
  (rcpt.cc || []).forEach((x) => { const k = x.toLowerCase(); if (!seen.has(k)) { seen.add(k); cc.push(x); } });
  const title = '\u05d3\u05d5\u05d7 \u05de\u05e4\u05d2\u05e2\u05d9\u05dd \u05e4\u05ea\u05d5\u05d7\u05d9\u05dd \u05dc\u05d8\u05d9\u05e4\u05d5\u05dc - \u05de\u05d7\u05dc\u05e7\u05ea ' + dept;
  const th = ['\u05de\u05e1"\u05d3', '\u05ea\u05d0\u05e8\u05d9\u05da \u05e4\u05ea\u05d9\u05d7\u05d4', '\u05de\u05d9\u05e7\u05d5\u05dd', '\u05ea\u05d9\u05d0\u05d5\u05e8 \u05d4\u05de\u05e4\u05d2\u05e2', '\u05d7\u05d5\u05de\u05e8\u05d4', '\u05de\u05d7\u05dc\u05e7\u05d4 \u05d0\u05d7\u05e8\u05d0\u05d9\u05ea', '\u05e4\u05e2\u05d5\u05dc\u05d4 \u05e0\u05d3\u05e8\u05e9\u05ea', '\u05d9\u05e2\u05d3 \u05dc\u05d8\u05d9\u05e4\u05d5\u05dc', '\u05e1\u05d8\u05d8\u05d5\u05e1'];
  const cell = 'border:1px solid #ccc;padding:6px;vertical-align:top';
  const anyPhoto = open.some((r) => r.photo);
  const anyClose = open.some((r) => r.close);
  const closeTd = (r) => (!anyClose ? '' : '<td style="' + cell + '">' + (r.close ? '<a href="' + esc(r.close) + '" style="color:#15803d;font-weight:bold;white-space:nowrap">' + CLOSE_LINK + '</a>' : '') + '</td>');
  const photoTd = (r) => (!anyPhoto ? '' : '<td style="' + cell + '">' + (r.photo && r.photo.cid ? '<img src="cid:' + r.photo.cid + '" width="140" alt="" style="display:block;border:0">' : r.photo && r.photo.link ? '<a href="' + esc(r.photo.link) + '">' + PHOTO_LINK + '</a>' : '') + '</td>');
  const html = '<div dir="rtl" style="font-family:Arial,sans-serif;font-size:14px">'
    + '<h2 style="margin:0 0 10px">' + esc(title) + '</h2>'
    + '<p>' + esc(texts.open || DEFAULT_OPEN).replace(/\n/g, '<br>') + '</p>'
    + (open.some((r) => r.old) ? '<p style="color:#8a6d00">\u05d4\u05e9\u05d5\u05e8\u05d5\u05ea \u05d4\u05de\u05e1\u05d5\u05de\u05e0\u05d5\u05ea \u05d1\u05e6\u05d1\u05e2 \u05d6\u05d4\u05d1 \u05d4\u05df \u05dc\u05d9\u05e7\u05d5\u05d9\u05d9\u05dd \u05de\u05e1\u05d9\u05d5\u05e8\u05d9\u05dd \u05e7\u05d5\u05d3\u05de\u05d9\u05dd \u05e9\u05d8\u05e8\u05dd \u05e0\u05e1\u05d2\u05e8\u05d5.</p>' : '')
    + '<table style="border-collapse:collapse;width:100%"><tr>' + th.concat(anyPhoto ? [PHOTO_TH] : [], anyClose ? [CLOSE_TH] : []).map((h) => '<th style="' + cell + ';background:#1f3864;color:#fff">' + esc(h) + '</th>').join('') + '</tr>'
    + open.map((r) => '<tr style="background:' + (r.old ? '#fff2cc' : '#fff') + '">' + [r.n, r.opened, r.loc, r.descr, r.sev, r.resp, r.action, r.due, r.status].map((x, i) => '<td style="' + cell + (i === 4 && SEV_COLOR[x] ? ';background:' + SEV_COLOR[x] + ';color:#ffffff;font-weight:bold;text-align:center;white-space:nowrap' : i === 1 ? ';white-space:nowrap' : '') + '">' + (i === 4 && SEV_COLOR[x] ? '&#9679; ' : '') + esc(x).replace(/\n/g, '<br>') + (i === 7 && r.overdue ? '<br><b style="color:#b91c1c">\u05e2\u05d1\u05e8 \u05d4\u05d9\u05e2\u05d3</b>' : '') + '</td>').join('') + photoTd(r) + closeTd(r) + '</tr>').join('')
    + '</table>' + (texts.sign && !REGARDS.test(texts.sign) ? '<p>' + esc(texts.sign).replace(/\n/g, '<br>') + '</p>' : '') + SIGNATURE + '</div>';
  return { dept, title, to, cc, rows: open, count: open.length, old: open.filter((r) => r.old).length, overdue: open.filter((r) => r.overdue).length, html };
}

async function loadAll(env, token) {
  const [hazards, reports, tasks] = await Promise.all([
    readAll(env, 'tour_hazards?select=id,n,d,tour_no,dept,loc,descr,sev,resp,resp2,action,due,s,closed_d,notes,photo_url&order=n.asc'),
    readAll(env, 'trustee_reports?select=id,num,u,t,d,loc,ok,f,s,ref,mgr_note,action,closed_d,ts,photo_url&order=ts.asc'),
    readAll(env, TASKS_Q),
  ]);
  // This year's workbook; in the first minutes of a year, before the tick has
  // copied it into the new folder, last year's (upgrade review 24).
  const book0 = (y) => fetch(G + seg(folderFor(y) + '/' + FILES.xlsm.name) + ':/content', { headers: { Authorization: 'Bearer ' + token } });
  let r = await book0(ilYear());
  if (r.status === 404) r = await book0(ilYear() - 1);
  if (!r.ok) throw new Error('the workbook could not be read (onedrive ' + r.status + ')');
  const book = new Uint8Array(await r.arrayBuffer());
  const rc = await readSheetRows(book, { sheet: '\u05e0\u05de\u05e2\u05e0\u05d9\u05dd', minRow: 1, maxRow: 80, lastCol: 3, dateCols: [] });
  const tx = await readSheetRows(book, { sheet: '\u05d3\u05d5\u05d7 \u05dc\u05e9\u05dc\u05d9\u05d7\u05d4', minRow: 1, maxRow: 2, lastCol: 11, dateCols: [] });
  const t1 = tx.find((x) => x.r === 1), t2 = tx.find((x) => x.r === 2);
  const reg = buildRegister(hazards, reports, tasks);
  const urls = new Map(); reg.ids.forEach((id, i) => { const u = photoOf(id, hazards, reports); if (u) urls.set(reg.rows[i], u); });
  const idOf = new Map(); reg.ids.forEach((id, i) => idOf.set(reg.rows[i], id));
  // The action as typed (a trustee row's column also says who reported it): empty = to suggest.
  const raw = new Map(); hazards.forEach((h) => raw.set('h:' + h.id, h.action || '')); reports.forEach((t) => raw.set('t:' + t.id, t.action || ''));
  // A save in Excel the server has not taken yet (upgrade review 16, 29/09): the
  // sheets differ from the ones the server last wrote (hazard-file.js keeps
  // their digest). A report sent now would list what the manager just closed there.
  const st = await stateGet(env, ['hazard_xlsm_sheets']).catch(() => ({}));
  const ours = st.hazard_xlsm_sheets && st.hazard_xlsm_sheets.value;
  const unsynced = !!ours && ours !== await sheetsDigest(book).catch(() => ours);
  return { rows: reg.rows, urls, idOf, raw, rcpt: parseRecipients(rc), texts: { open: t1 && t1.v[11], sign: t2 && t2.v[11] }, unsynced };
}

export async function onRequest(context) {
  const { request, env } = context;
  const cors = corsHeaders(request.headers.get('Origin') || '', defaultAllowedOrigins(env), 'POST,OPTIONS');
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (request.method !== 'POST') return jsonResp({ error: 'method not allowed' }, 405, cors);
  const who = await requireRole(request, env, ['admin', 'manager']);
  if (!who.ok) return jsonResp({ error: who.error }, who.status, cors);
  if (!odConfigured(env)) return jsonResp({ ok: false, error: 'server not configured' }, 200, cors);
  let body = {}; try { body = await request.json(); } catch (e) {}
  try {
    const row = await tokenRow(env);
    if (!row || !row.refresh_token) return jsonResp({ ok: false, error: 'OneDrive \u05dc\u05d0 \u05de\u05d7\u05d5\u05d1\u05e8' }, 200, cors);
    const { token } = await accessToken(env);
    // 06/10/2026 (Michael: "a required action, filled automatically with my approval"):
    // suggest = the assistant's text for each item, nothing saved; setAction = the
    // manager approved one: saved only where the action is still empty.
    if (body.op === 'suggest') {
      const items = (Array.isArray(body.items) ? body.items : []).slice(0, 12);
      const out = [];
      for (const it of items) out.push({ id: String(it.id || ''), action: await suggestAction(env, { f: String(it.f || '').substring(0, 300), loc: String(it.loc || '').substring(0, 120) }) });
      return jsonResp({ ok: true, suggestions: out }, 200, cors);
    }
    if (body.op === 'setAction') {
      const m = /^(h|t):([\w-]{1,80})$/.exec(String(body.id || ''));
      const text = String(body.action || '').replace(/[\u2013\u2014\u05be]/g, '-').replace(/\s+/g, ' ').trim().substring(0, 300);
      if (!m || text.length < 4) return jsonResp({ ok: false, error: 'bad request' }, 400, cors);
      const table = m[1] === 'h' ? 'tour_hazards' : 'trustee_reports';
      const key = env.SUPABASE_SERVICE_ROLE_KEY, base = env.SUPABASE_URL || 'https://znhjtpcltrxxyfjczgvw.supabase.co';
      const up = await fetch(base + '/rest/v1/' + table + '?id=eq.' + encodeURIComponent(m[2]) + '&or=(action.is.null,action.eq.)', { method: 'PATCH', headers: { apikey: key, Authorization: 'Bearer ' + key, 'Content-Type': 'application/json', Prefer: 'return=representation' }, body: JSON.stringify({ action: text }) });
      const got = up.ok ? await up.json().catch(() => []) : [];
      return jsonResp({ ok: up.ok && got.length === 1, saved: got.length === 1, action: text }, 200, cors);
    }
    const data = await loadAll(env, token);
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jerusalem' });
    const reports = REPORT_DEPTS.map((d) => buildReport(d, data.rows, data.rcpt, data.texts, today));
    if (body.op !== 'send') return jsonResp({ ok: true, canSend: hasMail(row), unsynced: data.unsynced, reports: reports.map((x) => Object.assign({}, x, { html: undefined, rows: x.rows.map((r) => { const id = r.src && data.idOf.get(r.src); return Object.assign({}, r, { id: id || null, noAction: !!id && !String(data.raw.get(id) || '').trim() }); }) })) }, 200, cors);
    if (!hasMail(row)) return jsonResp({ ok: false, error: '\u05d0\u05d9\u05df \u05d4\u05e8\u05e9\u05d0\u05ea \u05e9\u05dc\u05d9\u05d7\u05ea \u05de\u05d9\u05d9\u05dc (Mail.Send)' }, 200, cors);
    if (data.unsynced && body.anyway !== true) return jsonResp({ ok: false, unsynced: true, error: '\u05d9\u05e9 \u05d1\u05e7\u05d5\u05d1\u05e5 \u05e9\u05de\u05d9\u05e8\u05d4 \u05de-Excel \u05e9\u05e2\u05d5\u05d3 \u05dc\u05d0 \u05e0\u05e7\u05dc\u05d8\u05d4. \u05e7\u05dc\u05d5\u05d8 \u05d0\u05d5\u05ea\u05d4 \u05e7\u05d5\u05d3\u05dd.' }, 200, cors);
    const want = Array.isArray(body.depts) ? body.depts : [];
    // A test (28/09, Michael: "for now, only to me"): the same mail, to the
    // connected account only, no copies; the real recipients are listed at the top.
    const test = body.test === true;
    const me = row.user_email;
    if (test && !me) return jsonResp({ ok: false, error: '\u05dc\u05d0 \u05d9\u05d3\u05d5\u05e2 \u05dc\u05d0\u05d9\u05d6\u05d4 \u05d7\u05e9\u05d1\u05d5\u05df \u05dc\u05e9\u05dc\u05d5\u05d7' }, 200, cors);
    // The photos of the rows being sent: pictures for the first MAIL_PICS, links for the rest.
    const inSend = reports.filter((r) => want.indexOf(r.dept) >= 0 && r.count);
    const need = []; inSend.forEach((r) => r.rows.forEach((x) => { const u = x.src && data.urls.get(x.src); if (u) need.push(u); }));
    const links = need.length ? await signPhotos(env, need) : {};
    const pics = {}; let k = 0;
    for (const u of need) { if (u in pics) continue; if (k >= MAIL_PICS) { pics[u] = null; continue; } k++; pics[u] = await fetchThumb(env, u, MAIL_PIC_W); }
    const sent = [], skipped = [], failed = [];
    for (const rep0 of reports) {
      let rep = rep0, attachments = [];
      // "Mark as handled" per row (upgrade review 13): the register id without
      // its kind, h:th-... for a tour hazard, t:<id> for a trustee finding;
      // close-hazard.js tells them apart. No secret configured = no links.
      const closeLinks = new Map();
      if (inSend.indexOf(rep0) >= 0) for (const x of rep0.rows) { const rid = x.src && data.idOf.get(x.src); const tk = rid && await makeCloseToken(env, rid.substring(2)); if (tk) closeLinks.set(x.src, closeUrl(APP_URL, tk)); }
      const photos = new Map();
      if (inSend.indexOf(rep0) >= 0 && rep0.rows.some((x) => x.src && data.urls.get(x.src))) {
        rep0.rows.forEach((x, i) => {
          const u = x.src && data.urls.get(x.src); if (!u) return;
          if (pics[u]) { const cid = 'ph' + rep0.dept.length + '-' + i + '@tapugan'; attachments.push({ '@odata.type': '#microsoft.graph.fileAttachment', name: 'photo-' + (i + 1) + '.jpg', contentType: 'image/jpeg', contentBytes: b64(pics[u]), isInline: true, contentId: cid }); photos.set(x.src, { cid }); }
          else if (links[u]) photos.set(x.src, { link: links[u] });
        });
      }
      if (photos.size || closeLinks.size) rep = buildReport(rep0.dept, data.rows, data.rcpt, data.texts, today, photos, closeLinks);
      if (want.indexOf(rep.dept) < 0) continue;
      if (!rep.count) { skipped.push({ dept: rep.dept, why: '\u05d0\u05d9\u05df \u05de\u05e4\u05d2\u05e2\u05d9\u05dd \u05e4\u05ea\u05d5\u05d7\u05d9\u05dd' }); continue; }
      if (!test && !rep.to.length) { skipped.push({ dept: rep.dept, why: '\u05d0\u05d9\u05df \u05e0\u05de\u05e2\u05df \u05d1\u05d2\u05d9\u05dc\u05d9\u05d5\u05df \u05e0\u05de\u05e2\u05e0\u05d9\u05dd' }); continue; }
      const to = test ? [me] : rep.to, cc = test ? [] : rep.cc;
      const subject = (test ? '\u05d1\u05d3\u05d9\u05e7\u05d4 - ' : '') + rep.title;
      const html = test ? '<div dir="rtl" style="font-family:Arial,sans-serif;font-size:13px;background:#fff8e1;border:1px solid #e0c46c;padding:8px;margin-bottom:10px">\u05de\u05d9\u05d9\u05dc \u05d1\u05d3\u05d9\u05e7\u05d4, \u05e0\u05e9\u05dc\u05d7 \u05e8\u05e7 \u05d0\u05dc\u05d9\u05da. \u05d1\u05e9\u05dc\u05d9\u05d7\u05d4 \u05d0\u05de\u05d9\u05ea\u05d9\u05ea: \u05d0\u05dc ' + esc(rep.to.join(', ') || '(\u05d0\u05d9\u05df \u05e0\u05de\u05e2\u05df)') + ' | \u05e2\u05d5\u05ea\u05e7 ' + esc(rep.cc.join(', ')) + '</div>' + rep.html : rep.html;
      try { await sendMailTo(token, to, cc, subject, html, attachments); sent.push({ dept: rep.dept, to, cc, count: rep.count, test, photos: attachments.length }); }
      catch (e) { failed.push({ dept: rep.dept, error: String((e && e.message) || e).substring(0, 160) }); }
    }
    if (!test) await stateSet(env, { hazard_report_last: JSON.stringify({ at: new Date().toISOString(), by: (who.user && who.user.email) || null, sent: sent.map((x) => x.dept) }) }).catch(() => {});
    return jsonResp({ ok: !failed.length, sent, skipped, failed }, 200, cors);
  } catch (e) {
    return jsonResp({ ok: false, error: String((e && e.message) || e).substring(0, 200) }, 200, cors);
  }
}
