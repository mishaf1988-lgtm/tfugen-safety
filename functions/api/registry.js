// Cloudflare Pages Function: a contractor against the government registries (08/11/2026, Michael in the
// questionnaire after the API-mega-list review: "do it: a contractor check against the registries",
// "a company-ID field + a suggestion by name", "build it like this"; DECISIONS 08/11/2026).
//
// Two public datasets on data.gov.il (CKAN datastore, no key, read only):
//  - pinkashakablanim: the register of licensed contractors. It covers building and engineering works only,
//    so "not found" is information, never a warning (a refrigeration or cleaning contractor is not in it).
//  - asbest: the asbestos-works licence holders, with the licence expiry. An expired licence is a warning.
// Only the server calls data.gov.il: fixed resource ids, the query only as a URL parameter (no host or path
// from the caller), a short timeout, and the answer trimmed to the fields the card shows.
//
//   GET  /api/registry?op=ctr&q=<name>      a signed-in user: up to 3 candidates from each registry by name
//   GET  /api/registry?op=ctr&cid=<9 digits> the same by company ID (exact, pinkas only: asbest has no ID)
//   POST /api/registry?op=check             pg_cron weekly (migration 2026-11-08_ctr_cid.sql) with the Vault
//                                           secret: one known query per registry, writes server_state.registry_probe
//                                           {at, ok, error}. The weekly mail reports a failure or a stale probe, so a
//                                           changed or fallen site never turns into a silent "nothing found".

import { defaultAllowedOrigins, corsHeaders, jsonResp, isAllowedCaller, requireUser } from '../_shared.js';
import { stateSet } from '../_onedrive.js';

export const CKAN = 'https://data.gov.il/api/3/action/datastore_search';
export const RES_PINKAS = '4eb61bd6-18cf-4e7c-9f9c-e166dfa0a2d8';
export const RES_ASBEST = '512d916e-07f0-4774-b84a-3a989e45e7eb';
export const PROBE_KEY = 'registry_probe';
export const TIMEOUT_MS = 12000;
export const MAX = 3;
// The probe: pinkas by a word in thousands of company names ("\u05d1\u05e2\u05de", ~10,000 on 08/11/2026), asbest unfiltered (most
// holders are people, the word matches one). A zero total or a missing field means the dataset changed.
export const PROBE_Q = '\u05d1\u05e2\u05de';   // "\u05d1\u05e2\u05de"

// The caller's name: letters, digits, spaces and a few marks, 2..60 characters. null = refuse. Pure.
export function cleanQ(raw) {
  const s = String(raw || '').replace(/[^\u0590-\u05ffa-zA-Z0-9 .'"\-&]/g, ' ').replace(/\s+/g, ' ').trim();
  return s.length >= 2 && s.length <= 60 ? s : null;
}
// A company ID: 9 digits (leading zeros kept). null = refuse. Pure.
export function cleanCid(raw) {
  const s = String(raw || '').replace(/\D/g, '');
  return /^\d{9}$/.test(s) ? s : null;
}

const str = (v, n) => String(v == null ? '' : v).trim().slice(0, n || 80);

// One pinkas record to the card: the same contractor appears once per field of work, so rows with the same
// company ID are merged and their fields listed. Pure.
export function pinkasRows(records) {
  const by = new Map();
  (records || []).forEach((r) => {
    const cid = str(r.MISPAR_YESHUT, 12);
    const key = cid || str(r.SHEM_YESHUT);
    if (!key) return;
    const cur = by.get(key) || { cid, name: str(r.SHEM_YESHUT), city: str(r.SHEM_YISHUV, 40), no: str(r.MISPAR_KABLAN, 12), anaf: [] };
    const a = [str(r.TEUR_ANAF, 40), str(r.SIVUG, 10)].filter(Boolean).join(' ');
    if (a && cur.anaf.indexOf(a) < 0 && cur.anaf.length < 4) cur.anaf.push(a);
    by.set(key, cur);
  });
  return Array.from(by.values()).slice(0, MAX);
}
// One asbest record: licence type and number, expiry as YYYY-MM-DD when it parses, expired against today. Pure.
export function asbestRows(records, today) {
  return (records || []).slice(0, MAX).map((r) => {
    const raw = str(r.LicenseExpirationDate, 30);
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(raw) || /^(\d{1,2})[./](\d{1,2})[./](\d{4})/.exec(raw);
    let exp = '';
    if (m) exp = m[1].length === 4 ? m[1] + '-' + m[2] + '-' + m[3] : m[3] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[1]).slice(-2);
    return { name: str(r.Name), lic: str(r.LicenseNumber, 20), type: str(r.LicenseType, 40), city: str(r.Settlement, 40), exp, expired: !!exp && exp < today };
  });
}

async function ckan(res, params) {
  const u = new URL(CKAN);
  u.searchParams.set('resource_id', res);
  u.searchParams.set('limit', '25');
  Object.keys(params).forEach((k) => u.searchParams.set(k, params[k]));
  const r = await fetch(u.toString(), { headers: { Accept: 'application/json', 'User-Agent': 'safety-app' }, signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (r.status !== 200) throw new Error('data.gov.il HTTP ' + r.status);
  let j; try { j = await r.json(); } catch (e) { throw new Error('data.gov.il: not JSON'); }
  if (!j || !j.success || !j.result) throw new Error('data.gov.il: no result');
  return j.result;
}

export async function lookup(q, cid, today) {
  const out = { ok: true, pinkas: [], asbest: [], error: '' };
  const jobs = [
    ckan(RES_PINKAS, cid ? { filters: JSON.stringify({ MISPAR_YESHUT: cid }) } : { q }).then((r) => { out.pinkas = pinkasRows(r.records); }),
    q ? ckan(RES_ASBEST, { q }).then((r) => { out.asbest = asbestRows(r.records, today); }) : Promise.resolve(),
  ];
  const res = await Promise.allSettled(jobs);
  const bad = res.filter((x) => x.status === 'rejected').map((x) => String((x.reason && x.reason.message) || x.reason).slice(0, 120));
  if (bad.length) { out.ok = false; out.error = bad.join('; '); }
  return out;
}

export async function runProbe(env, nowMs) {
  const at = new Date(nowMs || Date.now()).toISOString();
  let rec;
  try {
    const [a, b] = await Promise.all([ckan(RES_PINKAS, { q: PROBE_Q }), ckan(RES_ASBEST, {})]);
    const need = ['MISPAR_YESHUT', 'SHEM_YESHUT', 'TEUR_ANAF'], needA = ['Name', 'LicenseExpirationDate'];
    const miss = need.filter((f) => !(a.records && a.records[0] && f in a.records[0]))
      .concat(needA.filter((f) => !(b.records && b.records[0] && f in b.records[0])));
    if (!a.total || !b.total) throw new Error('empty answer (pinkas ' + (a.total || 0) + ', asbest ' + (b.total || 0) + ')');
    if (miss.length) throw new Error('missing fields: ' + miss.join(', '));
    rec = { at, ok: true, error: '', pinkas: a.total, asbest: b.total };
  } catch (e) {
    rec = { at, ok: false, error: String((e && e.message) || e).slice(0, 200) };
  }
  let saved = true;
  await stateSet(env, { [PROBE_KEY]: JSON.stringify(rec) }).catch(() => { saved = false; });
  return { ok: rec.ok, error: rec.error, saved };
}

export async function onRequest({ request, env }) {
  const allowed = defaultAllowedOrigins(env);
  const cors = corsHeaders(request.headers.get('origin') || '', allowed, 'GET,POST,OPTIONS');
  if (request.method === 'OPTIONS') return new Response(null, { headers: cors });
  const sp = new URL(request.url).searchParams;
  const op = (sp.get('op') || '').toLowerCase();

  if (request.method === 'POST') {
    const want = env.TRUSTEE_NOTIFY_SECRET;
    if (!want || (request.headers.get('x-notify-secret') || '') !== want) return jsonResp({ error: 'forbidden' }, 403, cors);
    if (op !== 'check') return jsonResp({ error: 'unknown op (check)' }, 400, cors);
    if (!env.SUPABASE_SERVICE_ROLE_KEY) return jsonResp({ ok: false, error: 'server not configured' }, 200, cors);
    return jsonResp(await runProbe(env), 200, cors);
  }
  if (request.method !== 'GET') return jsonResp({ error: 'method not allowed' }, 405, cors);
  if (!isAllowedCaller(request, allowed)) return jsonResp({ error: 'origin not allowed' }, 403, cors);
  const who = await requireUser(request, env);
  if (!who.ok) return jsonResp({ error: who.error }, who.status, cors);
  if (op !== 'ctr') return jsonResp({ error: 'unknown op (ctr)' }, 400, cors);
  const cid = sp.get('cid') ? cleanCid(sp.get('cid')) : null;
  const q = cid ? null : cleanQ(sp.get('q'));
  if (!cid && !q) return jsonResp({ error: 'bad query' }, 400, cors);
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jerusalem' }).format(new Date());
  return jsonResp(await lookup(q, cid, today), 200, cors);
}
