// Cloudflare Pages Function: the app's codes, managed from one admin screen
// (10/10/2026, Michael: "\u05d0\u05e0\u05d9 \u05e8\u05d5\u05e6\u05d4 \u05e4\u05dc\u05d8\u05e4\u05d5\u05e8\u05de\u05d4 \u05de\u05dc\u05d0\u05d4 \u05d1\u05d0\u05e4\u05dc\u05d9\u05e7\u05e6\u05d9\u05d4 \u05dc\u05e0\u05d9\u05d4\u05d5\u05dc \u05d4\u05e1\u05d9\u05e1\u05de\u05d5\u05ea", and in the
// questionnaire: "\u05d1\u05e6\u05e2: \u05d4\u05e7\u05d5\u05d3\u05d9\u05dd \u05e9\u05dc \u05d4\u05d0\u05e4\u05dc\u05d9\u05e7\u05e6\u05d9\u05d4", not passwords of outside systems).
//
// Two codes live on the server, in server_state (service key only, RLS without
// policies), so they can be changed from here without the Cloudflare dashboard:
//   induction_code  the HR code in front of the new-worker form (talk.js codeGate)
//   trustee_code    the trustee screen (trustee-gate.js; TRUSTEE_CODE in Cloudflare
//                   is the fallback while this row is empty)
// The delete password is per device, in the browser (index.html _delPw), and the
// screen changes it there; it is friction against a mis-tap, not a server secret.
//
// Admin only. Every change goes to audit_log with who and when, never the code.
//
//   POST {op:'list'}                       -> {codes:[{key,set,value,source,updated_at}]}
//   POST {op:'set', key, value?}           -> {key,value,updated_at}; no value = 6 random digits
import { defaultAllowedOrigins, corsHeaders, jsonResp, isAllowedCaller, requireRole } from '../_shared.js';

const SB = 'https://znhjtpcltrxxyfjczgvw.supabase.co';
export const CODE_KEYS = {
  induction_code: { label: '\u05e7\u05d5\u05d3 \u05de\u05e9\u05d0\u05d1\u05d9 \u05d0\u05e0\u05d5\u05e9 (\u05d8\u05d5\u05e4\u05e1 \u05e7\u05dc\u05d9\u05d8\u05d4)', env: null },
  trustee_code: { label: '\u05e7\u05d5\u05d3 \u05e0\u05d0\u05de\u05e0\u05d9 \u05d4\u05d1\u05d8\u05d9\u05d7\u05d5\u05ea', env: 'TRUSTEE_CODE' },
};
// Letters and digits, 8 to 32, at least one of each (10/10/2026, Michael: "\u05d0\u05e0\u05d9 \u05de\u05e2\u05d3\u05d9\u05e3 \u05e1\u05d9\u05e1\u05de\u05d4, \u05dc\u05d0 \u05e7\u05d5\u05d3
// \u05d1\u05de\u05e1\u05e4\u05e8\u05d9\u05dd"). Kept in lower case: capitals are not counted, so a phone's auto-capital does not lock
// anyone out. A numeric code set before this still works until it is changed.
export const CODE_RE = /^[a-z0-9]{8,32}$/;
export const pwOk = (v) => CODE_RE.test(v) && /[a-z]/.test(v) && /[0-9]/.test(v);
// No 0/o, 1/l/i: a password read out over the phone.
const PW_CHARS = 'abcdefghjkmnpqrstuvwxyz23456789';
const h = (env, extra) => Object.assign({ apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: 'Bearer ' + env.SUPABASE_SERVICE_ROLE_KEY }, extra || {});

export function randomCode(n) {
  for (;;) {
    const b = new Uint32Array(n || 10);
    crypto.getRandomValues(b);
    const v = Array.from(b, (x) => PW_CHARS[x % PW_CHARS.length]).join('');
    if (pwOk(v)) return v;
  }
}

async function readRows(env) {
  const r = await fetch(SB + '/rest/v1/server_state?key=in.(' + Object.keys(CODE_KEYS).join(',') + ')&select=key,value,updated_at', { headers: h(env) });
  if (!r.ok) throw new Error('server_state ' + r.status);
  const rows = await r.json();
  const by = {};
  for (const x of Array.isArray(rows) ? rows : []) by[x.key] = x;
  return by;
}

export async function onRequest({ request, env }) {
  const allowed = defaultAllowedOrigins(env);
  const cors = corsHeaders(request.headers.get('origin') || '', allowed, 'POST,OPTIONS');
  if (request.method === 'OPTIONS') return new Response(null, { headers: cors });
  if (request.method !== 'POST') return jsonResp({ error: 'method not allowed' }, 405, cors);
  if (!isAllowedCaller(request, allowed)) return jsonResp({ error: 'origin not allowed' }, 403, cors);
  if (!env.SUPABASE_SERVICE_ROLE_KEY) return jsonResp({ error: 'not configured' }, 503, cors);
  const who = await requireRole(request, env, ['admin']);
  if (!who.ok) return jsonResp({ error: who.error }, who.status || 401, cors);
  let b = {};
  try { b = await request.json(); } catch (e) { b = {}; }
  try {
    if (b.op === 'list') {
      const by = await readRows(env);
      const codes = Object.keys(CODE_KEYS).map((key) => {
        const row = by[key], v = String((row && row.value) || '').trim(), envName = CODE_KEYS[key].env;
        const envSet = !!(envName && String(env[envName] || '').trim());
        return { key, label: CODE_KEYS[key].label, set: !!v || envSet, value: v || null, source: v ? 'app' : (envSet ? 'cloudflare' : 'none'), updated_at: v && row ? row.updated_at : null };
      });
      // The last three changes, for the card (10/10/2026, Michael: "מאשר"): who, which, when.
      let recent = [];
      try {
        const r = await fetch(SB + '/rest/v1/audit_log?source=eq.codes&select=ts,user_email,record_id&order=ts.desc&limit=3', { headers: h(env) });
        if (r.ok) recent = (await r.json()).map((x) => ({ ts: x.ts, who: String(x.user_email || '').split('@')[0], key: x.record_id, label: (CODE_KEYS[x.record_id] || {}).label || x.record_id }));
      } catch (e) { recent = []; }
      return jsonResp({ codes, recent }, 200, cors);
    }
    if (b.op === 'set') {
      const key = String(b.key || '');
      if (!CODE_KEYS[key]) return jsonResp({ error: 'unknown code' }, 400, cors);
      const value = b.value === undefined || b.value === null || b.value === '' ? randomCode(10) : String(b.value).trim().toLowerCase();
      if (!pwOk(value)) return jsonResp({ error: 'format', message: '\u05d4\u05e1\u05d9\u05e1\u05de\u05d4: 8 \u05e2\u05d3 32 \u05ea\u05d5\u05d5\u05d9\u05dd, \u05d0\u05d5\u05ea\u05d9\u05d5\u05ea \u05d1\u05d0\u05e0\u05d2\u05dc\u05d9\u05ea \u05d5\u05de\u05e1\u05e4\u05e8\u05d9\u05dd, \u05dc\u05e4\u05d7\u05d5\u05ea \u05d0\u05d7\u05d3 \u05de\u05db\u05dc \u05e1\u05d5\u05d2' }, 400, cors);
      const at = new Date().toISOString();
      const w = await fetch(SB + '/rest/v1/server_state?on_conflict=key', { method: 'POST', headers: h(env, { 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' }), body: JSON.stringify({ key, value, updated_at: at }) });
      if (!w.ok) return jsonResp({ error: 'save failed' }, 502, cors);
      // Who and when, never the code. A failed log does not undo the change.
      try {
        await fetch(SB + '/rest/v1/audit_log', { method: 'POST', headers: h(env, { 'Content-Type': 'application/json', Prefer: 'return=minimal' }), body: JSON.stringify({ user_email: (who.user && who.user.email) || null, table_name: 'server_state', record_id: key, op: 'UPDATE', title: '\u05d4\u05d7\u05dc\u05e4\u05ea \u05e7\u05d5\u05d3: ' + CODE_KEYS[key].label, source: 'codes' }) });
      } catch (e) { /* the code is changed */ }
      return jsonResp({ key, value, updated_at: at }, 200, cors);
    }
    return jsonResp({ error: 'unknown op' }, 400, cors);
  } catch (e) {
    return jsonResp({ error: 'server' }, 502, cors);
  }
}
