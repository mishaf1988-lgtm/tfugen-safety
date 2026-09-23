// Cloudflare Pages Function — Vitre (HBSafety) Public API, READ-ONLY bridge.
//
// Usage (GET, signed-in non-anonymous user, allowed origin):
//   GET /api/vitre?op=ping                 env vars set? Vitre reachable? keys accepted?
//   GET /api/vitre?op=employees[&limit=N]  active employees (id, externalId, name, phone, email, ...)
//   GET /api/vitre?op=tasks[&limit=N]      company tasks (id, title, priority, dueDate, responsible, closeDate)
//   GET /api/vitre?op=orgunits             org units (id, externalId, name) — maps Employee.orgUnitId to a name
//
// This endpoint never writes to Vitre. Every op is a GET on their side.
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

export async function onRequest({ request, env }) {
  const allowed = defaultAllowedOrigins(env);
  const origin = request.headers.get('origin') || '';
  const cors = corsHeaders(origin, allowed, 'GET,OPTIONS');

  if (request.method === 'OPTIONS') return new Response(null, { headers: cors });
  if (request.method !== 'GET') return jsonResp({ error: 'method not allowed' }, 405, cors);
  if (!isAllowedCaller(request, allowed)) return jsonResp({ error: 'origin not allowed' }, 403, cors);

  // Employee rows carry phone numbers. Trustees sign in anonymously and must
  // not reach this; a signed-in staff account is the minimum.
  const who = await requireUser(request, env);
  if (!who.ok) return jsonResp({ error: who.error }, who.status, cors);

  const url = new URL(request.url);
  const op = (url.searchParams.get('op') || 'ping').toLowerCase();

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

  return jsonResp({ error: 'unknown op (ping | employees | tasks | orgunits)' }, 400, cors);
}
