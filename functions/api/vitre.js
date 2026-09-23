// Cloudflare Pages Function — Vitre (HBSafety) Public API, READ-ONLY bridge.
//
// Usage (GET, signed-in non-anonymous user, allowed origin):
//   GET /api/vitre?op=ping                 env vars set? Vitre reachable? keys accepted?
//   GET /api/vitre?op=employees[&limit=N]  active employees (id, externalId, name, phone, email, ...)
//   GET /api/vitre?op=tasks[&limit=N]      company tasks (id, title, priority, dueDate, responsible, closeDate)
//   GET /api/vitre?op=orgunits             org units (id, externalId, name) — maps Employee.orgUnitId to a name
//   GET /api/vitre?op=training_probe[&title=..|&id=N]  newest refresher-form task with detail, files, appointment + review result (shape discovery)
//   GET /api/vitre?op=trainings&page=N          one page (200) of tasks whose title contains the refresher needle; hasMore for paging
//   GET /api/vitre?op=training&id=N[&copy=1]    one task as a toolbox row (presenter, date, depts); copy=1 also copies the photo to our Storage
//   GET /api/vitre?op=training_photo&id=N       fresh 5-minute link to the task's photo, served from Vitre's storage
//   GET /api/vitre?op=review_schema&id=N        admin: schema of one form (question/answer dataKeys)
//   POST /api/vitre?op=review_submit_test       admin: ONE submission of the notification TEST form (id locked below)
//
// Read-only towards Vitre, with one deliberate exception: review_submit_test
// (23/09 evening) submits the test form "בדיקת התראות - למחיקה" to learn whether
// an API submission fires Vitre's SMS/email the way a manual one does. The
// review id is a constant here, so this endpoint cannot submit any other form.
// Reference for the upstream API: project-files/VITRE-API.md (Swagger summary).
//
// Secrets (Cloudflare Pages -> Settings -> Variables and Secrets, Production):
//   VITRE_API_KEY_ID      "מפתח API ציבורי"  -> header X-api-key-id
//   VITRE_API_KEY_SECRET  "מפתח סודי"        -> header X-api-key-secret
// Never in code, never in the browser. Same posture as META_ACCESS_TOKEN / RESEND_KEY.

import { defaultAllowedOrigins, corsHeaders, jsonResp, isAllowedCaller, requireUser } from '../_shared.js';

const VITRE_BASE = 'https://publicapi.hbinov.com';
const API_VERSION = '1.0';
const UPSTREAM_TIMEOUT_MS = 15000;
// The only form this endpoint may ever submit: "בדיקת התראות - למחיקה", built
// by Michael on 23/09 for the notification test. Change deliberately or never.
const VITRE_TEST_REVIEW_ID = 11997;
const ADMIN_EMAIL = 'admin@tfugen.local';

function vitreHeaders(env) {
  return {
    'X-api-key-id': env.VITRE_API_KEY_ID,
    'X-api-key-secret': env.VITRE_API_KEY_SECRET,
    'api-version': API_VERSION,
    'Accept': 'application/json'
  };
}

// GET against Vitre. Returns { status, ok, json, text, networkError } — never throws.
async function vitreGet(env, path, withAuth = true) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), UPSTREAM_TIMEOUT_MS);
  try {
    const resp = await fetch(VITRE_BASE + path, {
      method: 'GET',
      headers: withAuth ? vitreHeaders(env) : { 'api-version': API_VERSION, 'Accept': 'application/json' },
      signal: ctrl.signal
    });
    const text = await resp.text();
    let json = null;
    try { json = text ? JSON.parse(text) : null; } catch (e) {}
    return { status: resp.status, ok: resp.ok, json, text: json ? null : text.slice(0, 300), networkError: null };
  } catch (e) {
    return { status: 0, ok: false, json: null, text: null, networkError: String(e && e.message || e).slice(0, 200) };
  } finally {
    clearTimeout(timer);
  }
}

// POST against Vitre with a JSON body. Same return shape as vitreGet, never throws.
async function vitrePost(env, path, body) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), UPSTREAM_TIMEOUT_MS);
  try {
    const resp = await fetch(VITRE_BASE + path, {
      method: 'POST',
      headers: Object.assign({ 'Content-Type': 'application/json' }, vitreHeaders(env)),
      body: JSON.stringify(body || {}),
      signal: ctrl.signal
    });
    const text = await resp.text();
    let json = null;
    try { json = text ? JSON.parse(text) : null; } catch (e) {}
    return { status: resp.status, ok: resp.ok, json, text: json ? null : text.slice(0, 600), networkError: null };
  } catch (e) {
    return { status: 0, ok: false, json: null, text: null, networkError: String(e && e.message || e).slice(0, 200) };
  } finally {
    clearTimeout(timer);
  }
}

function clampLimit(raw, dflt, max) {
  const n = parseInt(raw, 10);
  if (!Number.isFinite(n) || n <= 0) return dflt;
  return Math.min(n, max);
}

// Vitre returns a PublicApiErrorResult on 4xx/5xx; surface message without leaking headers.
function upstreamError(r, cors) {
  const msg = (r.json && (r.json.message || r.json.description)) || r.text || r.networkError || 'upstream error';
  return jsonResp({ error: 'vitre ' + (r.status || 'unreachable'), detail: String(msg).slice(0, 300) }, r.status >= 400 ? 502 : 504, cors);
}

// Departments ticked on the refresher form. Shape seen 23/09 (task 3285307):
// reviewResult.questions[] with questionType "CheckBoxTemplate", title = the
// department name ("\u05d8\u05d5\u05d2\u05e0\u05d9\u05dd", "\u05ea\u05d5\u05e6\"\u05d2", ...), selectedAnswers[0].text "1" when
// ticked, "0" when not. Falls back to a generic "looks selected" walk for any
// other form shape, and returns [] rather than guessing.
function extractSelectedAnswers(rr) {
  const out = [];
  const qs = rr && Array.isArray(rr.questions) ? rr.questions : null;
  if (qs) {
    qs.forEach(q => {
      if (q.questionType !== 'CheckBoxTemplate') return;
      const on = Array.isArray(q.selectedAnswers) && q.selectedAnswers.some(a => a && (a.text === '1' || a.text === 'true' || a.text === true));
      const label = q.title && String(q.title).trim();
      if (on && label && out.indexOf(label) < 0) out.push(label);
    });
    return out;
  }
  return walkSelected(rr, out, 0);
}
function walkSelected(node, acc, depth) {
  if (!node || depth > 8) return acc;
  if (Array.isArray(node)) { node.forEach(n => walkSelected(n, acc, depth + 1)); return acc; }
  if (typeof node !== 'object') return acc;
  const picked = node.isSelected === true || node.selected === true || node.isChecked === true || node.checked === true || node.value === true;
  if (picked) {
    const label = node.text || node.title || node.name || node.answerText || node.label || node.displayName;
    if (label && typeof label === 'string' && acc.indexOf(label.trim()) < 0) acc.push(label.trim());
  }
  Object.keys(node).forEach(k => { const v = node[k]; if (v && typeof v === 'object') walkSelected(v, acc, depth + 1); });
  return acc;
}

// The form also carries the submitter's employee number ("\u05de\u05d1\u05e6\u05e2 \u05d4\u05d3\u05d9\u05d5\u05d5\u05d7" ->
// selectedAnswers[0].externalId), which is emp.ext_id on our side.
function extractPresenterExtId(rr) {
  const qs = rr && Array.isArray(rr.questions) ? rr.questions : [];
  for (const q of qs) {
    if (q.categoryId && q.questionType === 'TextOnlyTemplate' && Array.isArray(q.selectedAnswers)) {
      const a = q.selectedAnswers[0];
      if (a && a.externalId && /^\d+$/.test(String(a.externalId)) && a.text) return String(a.externalId);
    }
  }
  return null;
}

// First image attachment of a task, else the first file of any kind.
function pickImage(list) {
  return list.find(f => /\.(jpe?g|png|webp|heic)(\?|$)/i.test(String(f.name || f.url || ''))) || list[0] || null;
}

export async function onRequest({ request, env }) {
  const allowed = defaultAllowedOrigins(env);
  const origin = request.headers.get('origin') || '';
  const cors = corsHeaders(origin, allowed, 'GET,POST,OPTIONS');

  if (request.method === 'OPTIONS') return new Response(null, { headers: cors });
  if (request.method !== 'GET' && request.method !== 'POST') return jsonResp({ error: 'method not allowed' }, 405, cors);
  if (!isAllowedCaller(request, allowed)) return jsonResp({ error: 'origin not allowed' }, 403, cors);

  // Employee rows carry phone numbers. Trustees sign in anonymously and must
  // not reach this; a signed-in staff account is the minimum.
  const who = await requireUser(request, env);
  if (!who.ok) return jsonResp({ error: who.error }, who.status, cors);

  const url = new URL(request.url);
  const op = (url.searchParams.get('op') || 'ping').toLowerCase();
  // POST exists for exactly one op; everything else stays a GET.
  if (request.method === 'POST' && op !== 'review_submit_test') return jsonResp({ error: 'method not allowed' }, 405, cors);
  if (request.method === 'GET' && op === 'review_submit_test') return jsonResp({ error: 'POST required' }, 405, cors);
  // The form ops are admin-only: the schema names people, the submission writes to Vitre.
  const isAdmin = !!(who.user && who.user.email === ADMIN_EMAIL);
  if ((op === 'review_schema' || op === 'review_submit_test') && !isAdmin) return jsonResp({ error: 'admin only' }, 403, cors);

  const ID = env.VITRE_API_KEY_ID;
  const SECRET = env.VITRE_API_KEY_SECRET;
  const configured = !!(ID && SECRET);

  if (op === 'ping') {
    const status = {
      env: {
        VITRE_API_KEY_ID: ID ? ('set (...' + String(ID).slice(-4) + ')') : 'MISSING',
        VITRE_API_KEY_SECRET: SECRET ? ('set (' + String(SECRET).length + ' chars)') : 'MISSING'
      },
      reachability: null,   // GET /System/ping, no auth: is Vitre up and reachable from CF?
      auth: null,           // GET /Employee?PageSize=1: are the keys accepted?
      next_step: null
    };
    const ping = await vitreGet(env, '/System/ping', false);
    status.reachability = { status: ping.status, ok: ping.ok, version: ping.json && ping.json.version || null, networkError: ping.networkError };
    if (!configured) {
      status.next_step = 'Add VITRE_API_KEY_ID and VITRE_API_KEY_SECRET as Secrets in Cloudflare Pages (Production), then redeploy.';
      return jsonResp(status, 200, cors);
    }
    const auth = await vitreGet(env, '/Employee?IsActive=true&PageSize=1');
    status.auth = {
      status: auth.status, ok: auth.ok,
      sample_count: Array.isArray(auth.json) ? auth.json.length : null,
      error: auth.ok ? null : ((auth.json && auth.json.message) || auth.text || auth.networkError || null)
    };
    if (!auth.ok) status.next_step = auth.status === 401 ? 'Keys rejected (401): check the values in Cloudflare match app.vitre.io/publicApiKeys, and that the key was saved there.'
      : (auth.status === 403 ? 'Keys accepted but no permission for Employee (403).' : 'Vitre did not answer as expected; see auth.error.');
    return jsonResp(status, 200, cors);
  }

  if (!configured) return jsonResp({ error: 'Vitre not configured (VITRE_API_KEY_ID / VITRE_API_KEY_SECRET missing)' }, 500, cors);

  if (op === 'employees') {
    const limit = clampLimit(url.searchParams.get('limit'), 200, 500);
    const r = await vitreGet(env, '/Employee?IsActive=true&PageSize=' + limit + '&Start=0');
    if (!r.ok || !Array.isArray(r.json)) return upstreamError(r, cors);
    const rows = r.json.map(e => ({
      id: e.id,
      externalId: e.externalId || null,
      displayName: e.displayName || null,
      phone: e.phone || null,
      email: e.email || null,
      jobTitle: e.jobTitle || null,
      orgUnitId: e.orgUnitId || null,
      locationId: e.locationId || null,
      status: e.status || null,
      isUser: !!e.isUser
    }));
    return jsonResp({ count: rows.length, limit, rows }, 200, cors);
  }

  if (op === 'tasks') {
    const limit = clampLimit(url.searchParams.get('limit'), 50, 200);
    const r = await vitreGet(env, '/task/get?PageNumber=1&PageSize=' + limit);
    if (!r.ok || !Array.isArray(r.json)) return upstreamError(r, cors);
    const rows = r.json.map(t => ({
      id: t.id,
      title: t.title || null,
      priority: t.priority || null,
      createDate: t.createDate || null,
      dueDate: t.dueDate || null,
      responsibleUserId: t.responsibleUserId || null,
      closeDate: t.closeDate || null,
      generatedByAppointmentId: t.generatedByAppointmentId || null
    }));
    const open = rows.filter(t => !t.closeDate).length;
    return jsonResp({ count: rows.length, open, limit, rows }, 200, cors);
  }

  // Employee.orgUnitId is a number; the import into emp.dep wants the unit's name.
  if (op === 'orgunits') {
    const r = await vitreGet(env, '/OrgUnit?PageSize=500&Start=0');
    if (!r.ok) return upstreamError(r, cors);
    // Swagger lists a plain array; tolerate a wrapped { items: [...] } too.
    const list = Array.isArray(r.json) ? r.json : (r.json && Array.isArray(r.json.items) ? r.json.items : null);
    if (!list) return upstreamError(r, cors);
    const rows = list.map(u => ({
      id: u.id,
      externalId: u.externalId || null,
      name: u.name || u.displayName || u.title || null,
      parentId: u.parentId || null,
      isContractor: !!u.isContractor
    }));
    return jsonResp({ count: rows.length, rows }, 200, cors);
  }

  // One-off probe for the weekly safety-refresher flow: managers submit the
  // form "טופס ביצוע ריענון בטיחות" in Vitre, which spawns a CompanyTask.
  // Returns the newest matching task with everything the API has on it (detail,
  // files, comments, the appointment and its structured review result) so the
  // shape can be read from the dashboard before the import into `toolbox` is
  // written. Read-only. Long strings are truncated so the response stays small.
  if (op === 'training_probe') {
    const needle = (url.searchParams.get('title') || 'ריענון').toLowerCase();
    const idParam = url.searchParams.get('id');
    const cut = (v) => JSON.parse(JSON.stringify(v, (k, x) => (typeof x === 'string' && x.length > 400) ? x.slice(0, 400) + '...' : x));
    const grab = async (path) => { const r = await vitreGet(env, path); return r.ok ? cut(r.json) : { error: r.status, body: r.text || r.networkError || (r.json && r.json.message) || null }; };
    let task = null, listInfo = null;
    if (idParam) {
      task = { id: parseInt(idParam, 10) };
    } else {
      const list = await vitreGet(env, '/task/get?PageNumber=1&PageSize=100');
      if (!list.ok || !Array.isArray(list.json)) return upstreamError(list, cors);
      const hits = list.json.filter(t => String(t.title || '').toLowerCase().includes(needle));
      listInfo = { scanned: list.json.length, matching: hits.length, sampleTitles: list.json.slice(0, 5).map(t => t.title) };
      hits.sort((a, b) => String(b.createDate || '').localeCompare(String(a.createDate || '')));
      task = hits[0] || null;
      if (!task) return jsonResp({ list: listInfo, task: null, hint: 'no task title contains the needle; pass ?title=... or ?id=...' }, 200, cors);
    }
    const out = { list: listInfo, taskId: task.id, listRow: task.title ? cut(task) : null };
    out.detail = await grab('/task/get/' + task.id);
    out.files = await grab('/task/getFiles/' + task.id);
    out.comments = await grab('/task/getComments/' + task.id);
    const d = out.detail || {};
    // The refresher form is submitted as the task's closing appointment, so
    // closedByAppointmentId is where the review result lives (probe 23/09).
    const apptId = d.closedByAppointmentId || d.generatedByAppointmentId || (d.task && d.task.generatedByAppointmentId) || task.generatedByAppointmentId || null;
    out.appointmentId = apptId;
    if (apptId) {
      out.appointment = await grab('/appointmet/get/' + apptId);
      out.reviewResult = await grab('/appointmetResult/get-review-result/' + apptId);
      out.rawResult = await grab('/appointmetResult/get/' + apptId);
    }
    return jsonResp(out, 200, cors);
  }

  // ---- Notification test (23/09 evening): does an API submission fire SMS/email? ----
  // Step 1: the form schema, so the question/answer dataKeys can be read.
  if (op === 'review_schema') {
    const id = parseInt(url.searchParams.get('id'), 10) || VITRE_TEST_REVIEW_ID;
    const r = await vitreGet(env, '/review/getSchema?reviewId=' + id);
    if (!r.ok) return upstreamError(r, cors);
    const cut = JSON.parse(JSON.stringify(r.json, (k, x) => (typeof x === 'string' && x.length > 400) ? x.slice(0, 400) + '...' : x));
    return jsonResp({ reviewId: id, schema: cut }, 200, cors);
  }
  // Step 2: one submission of the TEST form only. Body: { createdBy, data, projectId? }.
  // createdBy = the submitter's Vitre employee externalId; data = { questionDataKey: answerDataKey|value }.
  // Whatever Vitre answers (200 or 4xx) is returned verbatim so the shape can be read.
  if (op === 'review_submit_test') {
    let body = null;
    try { body = await request.json(); } catch (e) { return jsonResp({ error: 'invalid JSON body' }, 400, cors); }
    const createdBy = String((body && body.createdBy) || '').trim();
    const data = body && body.data && typeof body.data === 'object' ? body.data : null;
    if (!/^\d{1,10}$/.test(createdBy)) return jsonResp({ error: 'createdBy (employee externalId, digits) required' }, 400, cors);
    if (!data || !Object.keys(data).length) return jsonResp({ error: 'data object required' }, 400, cors);
    let qs = '/review/submit?reviewId=' + VITRE_TEST_REVIEW_ID + '&createdBy=' + encodeURIComponent(createdBy);
    if (body.projectId) qs += '&projectId=' + encodeURIComponent(String(body.projectId));
    const r = await vitrePost(env, qs, { data });
    return jsonResp({
      reviewId: VITRE_TEST_REVIEW_ID, createdBy, sent: { data }, upstreamStatus: r.status, ok: r.ok,
      result: r.json, text: r.text, networkError: r.networkError
    }, r.ok ? 200 : 502, cors);
  }

  // ---- Weekly safety-refresher import (Vitre task -> our toolbox row) ----
  // Managers submit "טופס ביצוע ריענון בטיחות שבועיות" in Vitre; each
  // submission is a CompanyTask closed by an appointment (the form). The task
  // list pages oldest-first, so the browser walks the pages with op=trainings
  // and then pulls each selected task with op=training, which also copies the
  // attached photo into our Storage: the Vitre file link is a 5-minute SAS URL.

  // One page of the task list, filtered by title. hasMore lets the caller loop.
  if (op === 'trainings') {
    const needle = (url.searchParams.get('title') || 'ריענון').toLowerCase();
    const page = Math.max(1, parseInt(url.searchParams.get('page'), 10) || 1);
    const pageSize = 200;
    const r = await vitreGet(env, '/task/get?PageNumber=' + page + '&PageSize=' + pageSize);
    if (!r.ok || !Array.isArray(r.json)) return upstreamError(r, cors);
    const rows = r.json.filter(t => String(t.title || '').toLowerCase().includes(needle)).map(t => ({
      id: t.id, title: t.title || null, createDate: t.createDate || null, closeDate: t.closeDate || null,
      responsibleUserId: t.responsibleUserId || null
    }));
    return jsonResp({ page, pageSize, scanned: r.json.length, hasMore: r.json.length >= pageSize, rows }, 200, cors);
  }

  // One task, ready to become a toolbox row: presenter, date, ticked departments
  // (best effort from the review result), and the photo copied to our Storage.
  if (op === 'training') {
    const id = parseInt(url.searchParams.get('id'), 10);
    if (!id) return jsonResp({ error: 'id required' }, 400, cors);
    const detail = await vitreGet(env, '/task/get/' + id);
    if (!detail.ok || !detail.json) return upstreamError(detail, cors);
    const d = detail.json;
    const out = {
      id, title: d.title || d.displayName || null, createDate: d.createDate || null, closeDate: d.closeDate || null,
      presenter: (d.createdByUser && d.createdByUser.displayName) || (d.responsibleUser && d.responsibleUser.displayName) || null,
      presenterEmail: (d.createdByUser && d.createdByUser.email) || null,
      appointmentId: d.closedByAppointmentId || d.generatedByAppointmentId || null,
      depts: [], presenterExtId: null, reviewResult: null, photoUrl: null, photoError: null, files: 0
    };
    if (out.appointmentId) {
      const rr = await vitreGet(env, '/appointmetResult/get-review-result/' + out.appointmentId);
      if (rr.ok && rr.json) {
        out.reviewResult = JSON.parse(JSON.stringify(rr.json, (k, x) => (typeof x === 'string' && x.length > 300) ? x.slice(0, 300) + '...' : x));
        out.depts = extractSelectedAnswers(rr.json);
        out.presenterExtId = extractPresenterExtId(rr.json);
      } else out.reviewError = rr.status || rr.networkError || null;
    }
    // Michael, 23/09: Vitre stays the storage (he pays for it); our Supabase
    // free tier does not take 236+ phone photos. So by default only COUNT the
    // attachments; the viewer fetches a fresh link with op=training_photo when
    // someone opens the row. ?copy=1 copies the first image into our bucket
    // (kept for a future "bring my photos home" button). The Vitre URL is a
    // short-lived SAS link, so a copy has to happen right after listing.
    const files = await vitreGet(env, '/task/getFiles/' + id);
    const list = files.ok && files.json && Array.isArray(files.json.files) ? files.json.files : [];
    out.files = list.length;
    const img = pickImage(list);
    if (img && img.url && url.searchParams.get('copy') === '1') {
      const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
      const SUPABASE_URL = env.SUPABASE_URL || 'https://znhjtpcltrxxyfjczgvw.supabase.co';
      if (!serviceKey) out.photoError = 'missing SUPABASE_SERVICE_ROLE_KEY';
      else {
        try {
          const src = await fetch(img.url);
          if (!src.ok) out.photoError = 'vitre file ' + src.status;
          else {
            const ct = src.headers.get('content-type') || 'image/jpeg';
            const ext = /png/i.test(ct) ? '.png' : (/webp/i.test(ct) ? '.webp' : '.jpg');
            const fname = 'vitre-tr-' + id + ext;
            const body = await src.arrayBuffer();
            const up = await fetch(SUPABASE_URL + '/storage/v1/object/incidents-photos/' + fname, {
              method: 'POST',
              headers: { apikey: serviceKey, Authorization: 'Bearer ' + serviceKey, 'Content-Type': ct, 'x-upsert': 'true', 'cache-control': 'max-age=31536000' },
              body
            });
            if (up.ok) out.photoUrl = SUPABASE_URL + '/storage/v1/object/public/incidents-photos/' + fname;
            else out.photoError = 'storage ' + up.status + ' ' + (await up.text()).slice(0, 200);
          }
        } catch (e) { out.photoError = String(e && e.message || e).slice(0, 200); }
      }
    }
    return jsonResp(out, 200, cors);
  }

  // Fresh short-lived link to the photo attached to a refresher task. Nothing
  // is stored on our side; the browser opens the link straight from Vitre's
  // storage (Azure SAS URL, about five minutes).
  if (op === 'training_photo') {
    const id = parseInt(url.searchParams.get('id'), 10);
    if (!id) return jsonResp({ error: 'id required' }, 400, cors);
    const files = await vitreGet(env, '/task/getFiles/' + id);
    if (!files.ok) return upstreamError(files, cors);
    const list = files.json && Array.isArray(files.json.files) ? files.json.files : [];
    const img = pickImage(list);
    return jsonResp({ id, files: list.length, url: img && img.url || null, name: img && img.name || null,
      all: list.map(f => ({ name: f.name || null, url: f.url || null })) }, 200, cors);
  }

  return jsonResp({ error: 'unknown op (ping | employees | tasks | orgunits | training_probe | trainings | training | training_photo)' }, 400, cors);
}
