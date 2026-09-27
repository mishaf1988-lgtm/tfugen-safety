// Cloudflare Pages Function: the trustee reports log, written to OneDrive by
// the server (Michael, 2026-09-27).
//
// Every trustee report, one row each, rebuilt from the database and PUT to
//   OneDrive / Apps / Tapugan Safety / <trustees> / <trustee log>.xlsx
// of the account connected through /api/ms-auth. Same columns as the in-app
// download (_truLogAoa in index.html): a finding says open/closed, and when a
// task-8 report closed it, the closure date and who closed it.
//
// Callers:
//   1. The database (pg_net), after every INSERT or UPDATE statement on
//      trustee_reports: POST {} with x-notify-secret. Same secret as
//      trustee-notify (TRUSTEE_NOTIFY_SECRET in Cloudflare, trustee_notify_secret
//      in Vault): when it is set, a call without it is refused. The call can
//      only make us rebuild the file from the database, never change a row.
//   2. The app, a manager's "send now": POST {force:true}, Supabase session.
//   3. The app's tile: POST {op:'status'}, Supabase session.
//
// Nothing is uploaded when the content has not changed since the last upload
// (signature in public.server_state). A failed upload leaves the signature
// alone, so the next call tries again, and records the error for the tile.

import { defaultAllowedOrigins, corsHeaders, jsonResp, requireRole } from '../_shared.js';
import { buildXlsx, XLSX_TYPE, imageInfo } from '../_xlsx.js';
import { odConfigured, accessToken, putFile, itemUrl, stateGet, stateSet, tokenRow, hasMail, hasMailRead } from '../_onedrive.js';

export const LOG_FOLDER = 'Apps/Tapugan Safety/\u05e0\u05d0\u05de\u05e0\u05d9 \u05d1\u05d8\u05d9\u05d7\u05d5\u05ea';
// Every trustee photo is also copied, once, into this folder (Michael, 27/09:
// "why not keep the photos in OneDrive, there is room"): the company's own
// archive, a link that does not expire, opened only by a signed-in account.
export const PHOTO_FOLDER = 'Apps/Tapugan Safety/\u05e0\u05d0\u05de\u05e0\u05d9 \u05d1\u05d8\u05d9\u05d7\u05d5\u05ea/\u05ea\u05de\u05d5\u05e0\u05d5\u05ea';
// Copies per write: each is a download + an upload, inside the 50-subrequest
// budget with the 15 thumbnails. The rest go on the next write (the signature
// is not saved while copies are pending, so the next trigger writes again).
const MAX_COPIES = 6;
export const LOG_FILE = '\u05d9\u05d5\u05de\u05df \u05d3\u05d9\u05d5\u05d5\u05d7\u05d9 \u05e0\u05d0\u05de\u05e0\u05d9\u05dd.xlsx';
const SHEET = '\u05d3\u05d9\u05d5\u05d5\u05d7\u05d9 \u05e0\u05d0\u05de\u05e0\u05d9\u05dd';
const TASK_CLOSE = 8;
const S_CLOSED = '\u05e0\u05e1\u05d2\u05e8';
const TASKS = {
  1: '\u05e1\u05d9\u05d5\u05e8 \u05de\u05e4\u05d2\u05e2\u05d9\u05dd \u05d1\u05d0\u05d6\u05d5\u05e8', 2: '\u05de\u05e7\u05dc\u05d7\u05d5\u05ea \u05d7\u05d9\u05e8\u05d5\u05dd \u05d5\u05e9\u05d8\u05d9\u05e4\u05d5\u05ea \u05e2\u05d9\u05e0\u05d9\u05d9\u05dd', 3: '\u05d3\u05e8\u05db\u05d9 \u05de\u05d9\u05dc\u05d5\u05d8 \u05d5\u05d9\u05e6\u05d9\u05d0\u05d5\u05ea \u05d7\u05d9\u05e8\u05d5\u05dd',
  4: '\u05ea\u05e7\u05d9\u05e0\u05d5\u05ea \u05e1\u05d5\u05dc\u05de\u05d5\u05ea \u05d5\u05d2\u05d9\u05e9\u05d4 \u05dc\u05d2\u05d5\u05d1\u05d4', 5: '\u05e2\u05de\u05d3\u05d5\u05ea \u05db\u05d9\u05d1\u05d5\u05d9 \u05d0\u05e9', 6: '\u05de\u05d2\u05d9\u05e0\u05d9 \u05de\u05db\u05d5\u05e0\u05d5\u05ea \u05d5\u05dc\u05d7\u05e6\u05e0\u05d9 \u05e2\u05e6\u05d9\u05e8\u05d4',
  7: '\u05e2\u05d6\u05e8\u05d4 \u05e8\u05d0\u05e9\u05d5\u05e0\u05d4 \u05d5\u05e6\u05d9\u05d5\u05d3 \u05de\u05d2\u05df', 8: '\u05de\u05e2\u05e7\u05d1 \u05e1\u05d2\u05d9\u05e8\u05d4',
};
export const HEADER = ['\u05ea\u05d0\u05e8\u05d9\u05da', '\u05e0\u05d0\u05de\u05df', '\u05de\u05e1\u05e4\u05e8 \u05de\u05e9\u05d9\u05de\u05d4', '\u05e9\u05dd \u05d4\u05de\u05e9\u05d9\u05de\u05d4', '\u05d0\u05d6\u05d5\u05e8', '\u05e1\u05d5\u05d2 \u05d4\u05d3\u05d9\u05d5\u05d5\u05d7', '\u05de\u05de\u05e6\u05d0', '\u05e1\u05d8\u05d8\u05d5\u05e1',
  '\u05e4\u05ea\u05d5\u05d7 / \u05e1\u05d2\u05d5\u05e8', '\u05ea\u05d0\u05e8\u05d9\u05da \u05e1\u05d2\u05d9\u05e8\u05d4', '\u05e0\u05e1\u05d2\u05e8 \u05e2\u05dc \u05d9\u05d3\u05d9', '\u05d9\u05de\u05d9\u05dd \u05e4\u05ea\u05d5\u05d7 / \u05e2\u05d3 \u05e1\u05d2\u05d9\u05e8\u05d4', '\u05d4\u05e2\u05e8\u05ea \u05de\u05e0\u05d4\u05dc', '\u05ea\u05de\u05d5\u05e0\u05d4', '\u05de\u05d6\u05d4\u05d4'];
const WIDTHS = [11, 16, 8, 24, 24, 11, 40, 9, 10, 11, 16, 10, 30, 20, 14];
const PHOTO_COL = 13, ID_COL = 14, OPEN_COL = 8;
// Photos in the file (Michael, 27/09): open findings and the last 90 days are
// embedded as thumbnails; every photo cell links to the full picture. The
// bucket is private, so the stored /object/public/ URL does not open: the link
// is a signed URL (a year), refreshed each time the file is written. Caps keep
// one write inside the Worker's limits: 50 subrequests, and CPU (zipping 3MB
// measured ~12ms, the free plan allows 10ms). A thumbnail from Supabase image
// transforms (~20KB) is tried first; if the plan has none, the original.
// Open findings take the budget first, then the newest.
const PHOTO_DAYS = 90, MAX_IMAGES = 15, MAX_IMAGE_BYTES = 1536 * 1024, SIGN_SECONDS = 365 * 86400, THUMB_W = 240;
const PHOTO_TEXT = '\u05e4\u05ea\u05d9\u05d7\u05d4 \u05d1\u05d2\u05d5\u05d3\u05dc \u05de\u05dc\u05d0';
const DAY = 86400000;

function fdx(d) {
  const s = String(d || '').split('T')[0];
  const p = s.split('-');
  return p.length === 3 ? p[2] + '/' + p[1] + '/' + p[0] : s;
}

// Pure: rows from the three tables -> array of arrays, header first, newest first.
export function buildAoa(reports, tasks, locations, now) {
  now = now || Date.now();
  const taskName = {};
  Object.keys(TASKS).forEach((k) => { taskName[k] = TASKS[k]; });
  (tasks || []).forEach((t) => { if (t && t.n != null && t.t) taskName[t.n] = t.t; });
  const locById = {};
  (locations || []).forEach((l) => { if (l && l.id) locById[l.id] = l; });
  const locName = (id) => {
    let rec = locById[id]; if (!rec) return '';
    const path = [rec.name]; let guard = 0;
    while (rec && rec.parent_id && guard++ < 10) { rec = locById[rec.parent_id]; if (rec) path.unshift(rec.name); }
    return path.join(' / ');
  };
  const reps = (reports || []).filter((r) => r && r.id);
  const closer = {};
  reps.forEach((r) => {
    if (parseInt(r.t, 10) === TASK_CLOSE && r.ref) {
      const c = closer[r.ref];
      if (!c || String(r.ts || r.d || '') < String(c.ts || c.d || '')) closer[r.ref] = r;
    }
  });
  const rows = reps.slice().sort((x, y) => String(y.ts || y.d || '').localeCompare(String(x.ts || x.d || '')));
  const aoa = [HEADER.slice()];
  rows.forEach((r) => {
    const n = parseInt(r.t, 10), isClose = n === TASK_CLOSE, isF = !isClose && r.ok === false;
    const kind = isClose ? '\u05e1\u05d2\u05d9\u05e8\u05ea \u05de\u05de\u05e6\u05d0' : (r.ok === false ? '\u05dc\u05d9\u05e7\u05d5\u05d9' : '\u05ea\u05e7\u05d9\u05df');
    const closed = isF && r.s === S_CLOSED, c = isF ? closer[r.id] : null;
    const start = Date.parse(r.ts || r.d || '');
    let days = '';
    if (isF && !isNaN(start)) {
      const end = closed ? Date.parse((c && (c.ts || c.d)) || '') : now;
      if (!isNaN(end)) days = Math.max(0, Math.floor((end - start) / DAY));
    }
    aoa.push([
      fdx(r.d || r.ts), r.u || '', isNaN(n) ? '' : n, taskName[n] || '',
      r.loc || (r.location_id ? locName(r.location_id) : ''), kind, r.f || '', r.s || '',
      isF ? (closed ? '\u05e1\u05d2\u05d5\u05e8' : '\u05e4\u05ea\u05d5\u05d7') : '-',
      closed && c ? fdx(c.d || c.ts) : '', closed && c ? (c.u || '') : '',
      days, r.mgr_note || '', r.photo_url || '', r.id,
    ]);
  });
  return aoa;
}

// Signature of the content, without the day counter, so the file is not
// rewritten just because a day passed.
export async function signature(aoa) {
  const di = HEADER.indexOf('\u05d9\u05de\u05d9\u05dd \u05e4\u05ea\u05d5\u05d7 / \u05e2\u05d3 \u05e1\u05d2\u05d9\u05e8\u05d4');
  const s = JSON.stringify(aoa.map((row) => row.filter((_, i) => i !== di)));
  const h = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return Array.from(new Uint8Array(h)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

// {bucket, path} of a photo URL in our own Storage; null for anything else.
export function storagePath(url, base) {
  const u = String(url || '');
  if (u.indexOf(base + '/storage/v1/object/') !== 0) return null;
  const m = u.substring(base.length).match(/^\/storage\/v1\/object\/(?:public\/|sign\/|authenticated\/)?([^/?]+)\/([^?]+)/);
  return m ? { bucket: m[1], path: decodeURIComponent(m[2]) } : null;
}

// Replaces the photo cells with {text, link} and returns the thumbnails to
// embed. Never throws: a photo that fails is a row without a picture.
export async function attachPhotos(env, aoa, reports, now, od) {
  now = now || Date.now();
  // od: {token, copied: {reportId: webUrl}} to copy photos to OneDrive; absent = links only.
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  const base = env.SUPABASE_URL || 'https://znhjtpcltrxxyfjczgvw.supabase.co';
  const hdr = { apikey: key, Authorization: 'Bearer ' + key };
  const byId = {};
  (reports || []).forEach((r) => { if (r && r.id) byId[r.id] = r; });
  const rows = [];
  for (let i = 1; i < aoa.length; i++) {
    const sp = storagePath(aoa[i][PHOTO_COL], base);
    if (sp) rows.push({ i, sp });
  }
  // One call signs every photo, per bucket.
  const signed = {};
  const buckets = {};
  rows.forEach((x) => { (buckets[x.sp.bucket] = buckets[x.sp.bucket] || []).push(x.sp.path); });
  for (const b of Object.keys(buckets)) {
    try {
      const r = await fetch(base + '/storage/v1/object/sign/' + encodeURIComponent(b), {
        method: 'POST', headers: { ...hdr, 'Content-Type': 'application/json' },
        body: JSON.stringify({ expiresIn: SIGN_SECONDS, paths: buckets[b] }),
      });
      const j = r.ok ? await r.json() : [];
      (Array.isArray(j) ? j : []).forEach((e) => {
        if (e && e.signedURL && !e.error) signed[b + '/' + e.path] = /^https?:/.test(e.signedURL) ? e.signedURL : base + '/storage/v1' + e.signedURL;
      });
    } catch (e) { /* links stay as they were */ }
  }
  // Copy to OneDrive what is not there yet; link the OneDrive file when it is.
  let copies = 0, pending = 0;
  const orig = {}; // bytes downloaded for a copy, reused as the thumbnail
  for (const x of rows) {
    const id = aoa[x.i][ID_COL];
    if (!od || !od.token || id in od.copied) continue;
    if (copies >= MAX_COPIES) { pending++; continue; }
    copies++;
    try {
      const r = await fetch(base + '/storage/v1/object/authenticated/' + encodeURIComponent(x.sp.bucket) + '/' + x.sp.path.split('/').map(encodeURIComponent).join('/'), { headers: hdr });
      // Gone from Storage (404) or not a picture: remember it as '' so it is not
      // retried on every write; its row keeps the Storage link.
      if (r.status === 404 || r.status === 400) { od.copied[id] = ''; continue; }
      if (!r.ok) { pending++; continue; }
      const b = new Uint8Array(await r.arrayBuffer());
      const info = imageInfo(b);
      if (!info) { od.copied[id] = ''; continue; }
      orig[id] = b;
      const rep0 = byId[id] || {};
      const day = String(rep0.d || rep0.ts || '').substring(0, 10) || 'undated';
      const res = await putFile(od.token, PHOTO_FOLDER, day + '_' + String(id).replace(/[^A-Za-z0-9_-]/g, '') + '.' + (info.ext === 'png' ? 'png' : 'jpg'), b, 'image/' + info.ext);
      if (res && res.webUrl) od.copied[id] = res.webUrl;
    } catch (e) { pending++; /* retried on the next write */ }
  }
  if (od) od.pending = pending;
  const want = [];
  for (const x of rows) {
    const link = (od && od.copied[aoa[x.i][ID_COL]]) || signed[x.sp.bucket + '/' + x.sp.path];
    if (link) aoa[x.i][PHOTO_COL] = { text: PHOTO_TEXT, link };
    const rep = byId[aoa[x.i][ID_COL]] || {};
    const t = Date.parse(rep.ts || rep.d || '');
    x.open = aoa[x.i][OPEN_COL] === '\u05e4\u05ea\u05d5\u05d7';
    if (x.open || (!isNaN(t) && now - t <= PHOTO_DAYS * DAY)) want.push(x);
  }
  want.sort((a, b) => (a.open === b.open ? a.i - b.i : a.open ? -1 : 1));
  const images = [];
  let bytes = 0, thumbs = true;
  // What each photo became, returned with the result: the only way to see a
  // live run from here (27/09: thumbnails missing in the live file only).
  const diag = [];
  images.diag = diag;
  for (const x of want) {
    if (images.length >= MAX_IMAGES || bytes >= MAX_IMAGE_BYTES) break;
    const obj = encodeURIComponent(x.sp.bucket) + '/' + x.sp.path.split('/').map(encodeURIComponent).join('/');
    try {
      const have = orig[aoa[x.i][ID_COL]];
      if (have && !thumbs) {
        if (bytes + have.length > MAX_IMAGE_BYTES) continue;
        bytes += have.length; images.push({ row: x.i, col: PHOTO_COL, bytes: have });
        diag.push({ row: x.i, src: 'reuse', n: have.length, info: imageInfo(have) }); continue;
      }
      let r = null;
      if (thumbs) {
        // format=origin: without it Supabase may answer WebP, which Excel
        // does not embed and imageInfo does not read.
        r = await fetch(base + '/storage/v1/render/image/authenticated/' + obj + '?width=' + THUMB_W + '&quality=60&resize=contain&format=origin', { headers: hdr });
        if (!r.ok) { diag.push({ row: x.i, src: 'thumb', status: r.status }); thumbs = false; r = null; } // no transforms on this plan: stop asking
      }
      let src = r ? 'thumb' : 'orig';
      if (!r) r = await fetch(base + '/storage/v1/object/authenticated/' + obj, { headers: hdr });
      if (!r.ok) { diag.push({ row: x.i, src, status: r.status }); continue; }
      let b = new Uint8Array(await r.arrayBuffer());
      let info = imageInfo(b);
      if (!info && src === 'thumb') {
        // A thumbnail we cannot embed: take the original instead.
        diag.push({ row: x.i, src, n: b.length, type: r.headers.get('content-type'), info: null });
        src = 'orig';
        const r2 = await fetch(base + '/storage/v1/object/authenticated/' + obj, { headers: hdr });
        if (!r2.ok) continue;
        b = new Uint8Array(await r2.arrayBuffer()); info = imageInfo(b);
      }
      diag.push({ row: x.i, src, n: b.length, type: r.headers.get('content-type'), info });
      if (!info || bytes + b.length > MAX_IMAGE_BYTES) continue;
      bytes += b.length;
      images.push({ row: x.i, col: PHOTO_COL, bytes: b });
    } catch (e) { diag.push({ row: x.i, error: String((e && e.message) || e).substring(0, 80) }); }
  }
  return images;
}

// The saved signature covers the content AND which photos the file links to
// in OneDrive: copying a photo changes its link, so the file must be written
// again even though no report changed (seen live 27/09: copies done, log
// locked, next run said "unchanged" and the links stayed on Storage).
async function logSig(sig, reports, copied) {
  const ids = (reports || []).map((r) => r && r.id).filter((id) => id && copied[id]).sort();
  const s = sig + '|' + ids.map((id) => id + '=' + copied[id]).join(',');
  const h = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return Array.from(new Uint8Array(h)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function readAll(env, path) {
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  const base = (env.SUPABASE_URL || 'https://znhjtpcltrxxyfjczgvw.supabase.co') + '/rest/v1/';
  const out = [];
  for (let off = 0; off < 50000; off += 1000) {
    const r = await fetch(base + path + (path.indexOf('?') >= 0 ? '&' : '?') + 'limit=1000&offset=' + off,
      { headers: { apikey: key, Authorization: 'Bearer ' + key } });
    if (!r.ok) throw new Error('read ' + path.split('?')[0] + ' failed (' + r.status + ')');
    const rows = await r.json();
    if (!Array.isArray(rows)) break;
    out.push(...rows);
    if (rows.length < 1000) break;
  }
  return out;
}

export async function runLog(env, force) {
  const [reports, tasks, locations] = await Promise.all([
    readAll(env, 'trustee_reports?select=id,u,t,d,loc,location_id,ok,f,s,ref,mgr_note,photo_url,ts&order=ts.desc'),
    readAll(env, 'trustee_tasks?select=n,t').catch(() => []),
    readAll(env, 'locations?select=id,name,parent_id').catch(() => []),
  ]);
  const aoa = buildAoa(reports, tasks, locations);
  if (aoa.length < 2) return { ok: true, pushed: false, reason: 'empty', rows: 0 };
  const sig = await signature(aoa);
  if (!force) {
    const st = await stateGet(env, ['trustee_log_sig', 'trustee_photos']);
    // Unchanged AND every photo already in OneDrive = nothing to do. A photo
    // not yet copied (the ones from before 27/09, or a failed copy) makes it
    // write anyway, so copying never waits for the next report.
    let copied = {};
    try { copied = JSON.parse((st.trustee_photos && st.trustee_photos.value) || '{}') || {}; } catch (e) {}
    const base = env.SUPABASE_URL || 'https://znhjtpcltrxxyfjczgvw.supabase.co';
    const missing = (reports || []).some((r) => r && r.id && storagePath(r.photo_url, base) && !(r.id in copied));
    if (st.trustee_log_sig && st.trustee_log_sig.value === await logSig(sig, reports, copied) && !missing) return { ok: true, pushed: false, reason: 'unchanged', rows: aoa.length - 1 };
  }
  try {
    const { token } = await accessToken(env);
    const st2 = await stateGet(env, ['trustee_photos', 'trustee_photos_url']).catch(() => ({}));
    let copied = {};
    try { copied = JSON.parse((st2.trustee_photos && st2.trustee_photos.value) || '{}') || {}; } catch (e) { copied = {}; }
    const before = Object.keys(copied).length;
    const od = { token, copied, pending: 0 };
    // After the signature: signed links change on every write, the content does not.
    const images = await attachPhotos(env, aoa, reports, Date.now(), od);
    // Save the copies before the log upload: a locked log (423, open in Excel)
    // must not lose them, or they are uploaded again next time.
    if (Object.keys(od.copied).length !== before) await stateSet(env, { trustee_photos: JSON.stringify(od.copied) }).catch(() => {});
    const res = await putFile(token, LOG_FOLDER, LOG_FILE, buildXlsx(aoa, SHEET, WIDTHS, images), XLSX_TYPE);
    const save = { trustee_log_at: new Date().toISOString(), trustee_log_err: '', trustee_log_url: res.webUrl || '',
      trustee_log_diag: JSON.stringify({ images: images.length, diag: images.diag || [] }).substring(0, 4000) };
    // Copies still pending: keep the old signature so the next trigger writes again.
    if (!od.pending) save.trustee_log_sig = await logSig(sig, reports, od.copied);
    const n = Object.keys(od.copied).length;
    if (n && !(st2.trustee_photos_url && st2.trustee_photos_url.value)) {
      const fu = await itemUrl(token, PHOTO_FOLDER).catch(() => null);
      if (fu) save.trustee_photos_url = fu;
    }
    await stateSet(env, save);
    return { ok: true, pushed: true, rows: aoa.length - 1, images: images.length, images_diag: images.diag || [], photos_copied: n - before, photos_pending: od.pending, webUrl: res.webUrl || null };
  } catch (e) {
    const msg = (e && e.code === 'not_connected') ? 'not connected' : String((e && e.message) || e).substring(0, 200);
    await stateSet(env, { trustee_log_err: msg }).catch(() => {});
    return { ok: false, pushed: false, error: msg, locked: !!(e && e.status === 423), rows: aoa.length - 1 };
  }
}

export async function onRequest(context) {
  const { request, env } = context;
  const allowed = defaultAllowedOrigins(env);
  const origin = request.headers.get('Origin') || '';
  const cors = corsHeaders(origin, allowed, 'POST,OPTIONS');
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (request.method !== 'POST') return jsonResp({ error: 'method not allowed' }, 405, cors);
  if (!env.SUPABASE_SERVICE_ROLE_KEY) return jsonResp({ error: 'server misconfigured' }, 500, cors);

  let body = {}; try { body = await request.json(); } catch (e) {}
  const hasBearer = /^Bearer\s+\S/i.test(request.headers.get('authorization') || '');
  let force = false;
  if (hasBearer) {
    const who = await requireRole(request, env, ['admin', 'manager']);
    if (!who.ok) return jsonResp({ error: who.error }, who.status, cors);
    if (body.op === 'status') {
      const st = await stateGet(env, ['trustee_log_at', 'trustee_log_err', 'trustee_log_url', 'trustee_photos_url']).catch(() => ({}));
      let row = null; try { row = odConfigured(env) ? await tokenRow(env) : null; } catch (e) {}
      return jsonResp({
        configured: odConfigured(env), connected: !!(row && row.refresh_token), email: row ? row.user_email : null, mail: hasMail(row), mailRead: hasMailRead(row),
        last: st.trustee_log_at ? st.trustee_log_at.value : null,
        error: st.trustee_log_err && st.trustee_log_err.value ? st.trustee_log_err.value : null,
        webUrl: st.trustee_log_url && st.trustee_log_url.value ? st.trustee_log_url.value : null,
        photosUrl: st.trustee_photos_url && st.trustee_photos_url.value ? st.trustee_photos_url.value : null,
        folder: LOG_FOLDER, file: LOG_FILE,
      }, 200, cors);
    }
    force = body.force === true;
  } else {
    const want = env.TRUSTEE_NOTIFY_SECRET;
    if (want && (request.headers.get('x-notify-secret') || '') !== want) return jsonResp({ error: 'forbidden' }, 403, cors);
  }
  if (!odConfigured(env)) return jsonResp({ ok: false, error: 'server not configured' }, 200, cors);
  try {
    const r = await runLog(env, force);
    // More photos than one write may copy: call ourselves again (a new request,
    // a new subrequest budget) until none is pending. Only after progress, so a
    // photo that keeps failing cannot loop.
    if (r && r.photos_pending > 0 && r.photos_copied > 0 && context.waitUntil) {
      const h = { 'Content-Type': 'application/json' };
      if (env.TRUSTEE_NOTIFY_SECRET) h['x-notify-secret'] = env.TRUSTEE_NOTIFY_SECRET;
      context.waitUntil(fetch(new URL('/api/trustee-log', request.url).toString(), { method: 'POST', headers: h, body: '{}' }).catch(() => {}));
      r.continued = true;
    }
    // Which deploy answered: lets a check after an env change tell the new
    // deployment from the old one (Cloudflare Pages sets CF_PAGES_COMMIT_SHA).
    r.commit = String(env.CF_PAGES_COMMIT_SHA || '').substring(0, 7) || null;
    return jsonResp(r, 200, cors);
  } catch (e) {
    return jsonResp({ ok: false, error: String((e && e.message) || e).substring(0, 200) }, 200, cors);
  }
}
