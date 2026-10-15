// Cloudflare Pages Function: tomorrow's weather at the factory, a warning when working hours
// will be dangerous (15/10/2026, Michael: "בצע: מזג אוויר מול היתרי עבודה").
//
// The permits table (ptw) is still empty, so the warning stands on the forecast alone: the
// home screen shows one line when tomorrow between 06:00 and 18:00 brings
//  - heat stress (IMS heat_stress_level >= 2),
//  - gusts of 50 km/h and up (work at height, cranes, lifting),
//  - a 60% chance of rain and up (slippery floors, outdoor work).
// Source: the Israel Meteorological Service, location 62 = Sderot, the closest to the
// Sha'ar HaNegev industrial zone. Public JSON, no key, 7 days, hourly, values as strings.
// Only the server calls IMS; the browser reads the stored result.
//
//   POST /api/weather?op=check   pg_cron, daily 17:07 Israel (migration 2026-10-15_weather_cron.sql),
//                                with the Vault secret (x-notify-secret). Writes server_state.weather_tomorrow:
//                                {at, day, ok, error, alerts: [{kind, hours, value}], src}. A failure is stored
//                                as ok:false with the reason, never a bare 500.
//   GET  /api/weather?op=status  a signed-in (not anonymous) user: {last} for the home-screen line.
//
// server_state has RLS with no policies, so the app never reads it directly; this GET is the
// read path, with the service key, the same way /api/vitre?op=sync_status serves vitre_sync.

import { defaultAllowedOrigins, corsHeaders, jsonResp, isAllowedCaller, requireUser } from '../_shared.js';
import { stateGet, stateSet } from '../_onedrive.js';

export const STATE_KEY = 'weather_tomorrow';
export const IMS_URL = 'https://ims.gov.il/he/full_forecast_data/62';
export const SRC = 'ims 62';
export const IMS_TIMEOUT_MS = 15000;
export const HOUR_FROM = 6, HOUR_TO = 18;   // working hours, both ends counted
export const HEAT_LEVEL = 2, GUST_KMH = 50, RAIN_PCT = 60;

// The calendar date in Israel for an instant, 'YYYY-MM-DD'.
export function ilDate(ms) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jerusalem', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(ms));
}
// Tomorrow in Israel, whatever the UTC date of the server.
export function tomorrowIL(ms) {
  const [y, m, d] = ilDate(ms).split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
}

const num = (v) => { const n = parseFloat(v); return isFinite(n) ? n : null; };

// data: the IMS "data" object; day: 'YYYY-MM-DD'. Returns [{kind, hours, value}]; throws when
// the day or its hours are missing (the caller stores that as ok:false). Pure.
export function assess(data, day) {
  const d = data && data[day];
  const hourly = d && d.hourly;
  if (!hourly || typeof hourly !== 'object') throw new Error('no forecast for ' + day);
  const rows = Object.keys(hourly).map((k) => {
    const h = hourly[k] || {};
    const hr = parseInt(h.hour != null ? h.hour : k, 10);
    return { hr, h };
  }).filter((x) => x.hr >= HOUR_FROM && x.hr <= HOUR_TO).sort((a, b) => a.hr - b.hr);
  if (!rows.length) throw new Error('no working hours in the forecast for ' + day);
  const rules = [
    { kind: 'heat', field: 'heat_stress_level', min: HEAT_LEVEL },
    { kind: 'gust', field: 'gust_speed', min: GUST_KMH },
    { kind: 'rain', field: 'rain_chance', min: RAIN_PCT },
  ];
  const alerts = [];
  rules.forEach((r) => {
    const hit = rows.filter((x) => { const v = num(x.h[r.field]); return v !== null && v >= r.min; });
    if (!hit.length) return;
    alerts.push({
      kind: r.kind,
      hours: hit.map((x) => ('0' + x.hr).slice(-2) + ':00'),
      value: Math.max.apply(null, hit.map((x) => num(x.h[r.field]))),
    });
  });
  return alerts;
}

export async function runCheck(env, nowMs) {
  const now = nowMs || Date.now();
  const at = new Date(now).toISOString();
  const day = tomorrowIL(now);
  let rec;
  try {
    const r = await fetch(IMS_URL, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(IMS_TIMEOUT_MS) });
    if (r.status !== 200) throw new Error('ims HTTP ' + r.status);
    let j;
    try { j = await r.json(); } catch (e) { throw new Error('ims: not JSON'); }
    const alerts = assess(j && j.data, day);
    rec = { at, day, ok: true, error: '', alerts, src: SRC };
  } catch (e) {
    rec = { at, day, ok: false, error: String((e && e.message) || e).substring(0, 200), alerts: [], src: SRC };
  }
  let saved = true;
  await stateSet(env, { [STATE_KEY]: JSON.stringify(rec) }).catch(() => { saved = false; });
  return { ok: rec.ok, day, alerts: rec.alerts.length, error: rec.error, saved };
}

export async function onRequest({ request, env }) {
  const allowed = defaultAllowedOrigins(env);
  const cors = corsHeaders(request.headers.get('origin') || '', allowed, 'GET,POST,OPTIONS');
  if (request.method === 'OPTIONS') return new Response(null, { headers: cors });
  const op = (new URL(request.url).searchParams.get('op') || '').toLowerCase();

  if (request.method === 'POST') {
    // pg_cron: no Origin, no user, the shared secret from the Vault.
    const want = env.TRUSTEE_NOTIFY_SECRET;
    if (!want || (request.headers.get('x-notify-secret') || '') !== want) return jsonResp({ error: 'forbidden' }, 403, cors);
    if (op !== 'check') return jsonResp({ error: 'unknown op (check)' }, 400, cors);
    if (!env.SUPABASE_SERVICE_ROLE_KEY) return jsonResp({ ok: false, error: 'server not configured' }, 200, cors);
    return jsonResp(await runCheck(env), 200, cors);
  }
  if (request.method !== 'GET') return jsonResp({ error: 'method not allowed' }, 405, cors);
  if (!isAllowedCaller(request, allowed)) return jsonResp({ error: 'origin not allowed' }, 403, cors);
  const who = await requireUser(request, env);
  if (!who.ok) return jsonResp({ error: who.error }, who.status, cors);
  if (op !== 'status') return jsonResp({ error: 'unknown op (status)' }, 400, cors);
  const st = await stateGet(env, [STATE_KEY]).catch(() => ({}));
  let last = null;
  try { last = st[STATE_KEY] && st[STATE_KEY].value ? JSON.parse(st[STATE_KEY].value) : null; } catch (e) { last = null; }
  return jsonResp({ last }, 200, cors);
}
