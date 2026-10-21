// Tomorrow's weather at the factory (15/10/2026, /api/weather): the IMS forecast for Sderot,
// tomorrow in Israel between 06:00 and 18:00, alerts for heat stress level >= 2, gusts >= 50
// km/h and rain chance >= 60%, stored in server_state.weather_tomorrow, and the home-screen
// line in index.html (_wxLine). The forecasts below are made up; fetch is mocked.
import fs from 'fs';
import { onRequest, assess, daySummary, tomorrowIL, ilDate, runCheck, STATE_KEY, IMS_URL, HEAT_LEVEL, GUST_KMH, RAIN_PCT } from './_build/weather.mjs';

let pass = 0, fail = 0;
const check = (l, c, d) => { if (c) { pass++; console.log('  ✓ ' + l); } else { fail++; console.log('  ✗ ' + l + (d !== undefined ? '  -> ' + JSON.stringify(d).slice(0, 400) : '')); } };
const SB = 'https://znhjtpcltrxxyfjczgvw.supabase.co';
const ORIGIN = 'https://tapugan-safety.pages.dev';

// A day of 24 calm hours; over: {'HH': {field: value}}.
function day(date, over) {
  const hourly = {};
  for (let h = 0; h < 24; h++) {
    const k = ('0' + h).slice(-2) + ':00';
    hourly[k] = Object.assign({ hour: String(h), heat_stress_level: '0', gust_speed: '20', rain_chance: '0', temperature: '25' }, (over || {})[('0' + h).slice(-2)] || (over || {})[String(h)] || {});
  }
  return { daily: { forecast_date: date }, hourly };
}

(async () => {
  console.log('1. the Israel date');
  // 21:30 UTC on 15/10 is 00:30 on 16/10 in Israel (UTC+3): tomorrow is 17/10, not 16/10.
  check('after midnight in Israel, before midnight UTC: tomorrow is the day after the Israeli date', tomorrowIL(Date.parse('2026-10-15T21:30:00Z')) === '2026-10-17', tomorrowIL(Date.parse('2026-10-15T21:30:00Z')));
  check('the 17:07 run: tomorrow is the next day', tomorrowIL(Date.parse('2026-10-15T14:07:00Z')) === '2026-10-16');
  check('winter (UTC+2): 22:30 UTC is 00:30 Israel', ilDate(Date.parse('2026-12-31T22:30:00Z')) === '2027-01-01' && tomorrowIL(Date.parse('2026-12-31T22:30:00Z')) === '2027-01-02');
  check('end of month', tomorrowIL(Date.parse('2026-10-31T10:00:00Z')) === '2026-11-01');

  console.log('\n2. thresholds');
  const D = '2026-10-16';
  const one = (over) => assess({ [D]: day(D, over) }, D);
  check('calm day: no alert', one({}).length === 0);
  check('heat level ' + (HEAT_LEVEL - 1) + ': no alert', one({ 12: { heat_stress_level: String(HEAT_LEVEL - 1) } }).length === 0);
  let a = one({ 11: { heat_stress_level: '2' }, 12: { heat_stress_level: '3' }, 13: { heat_stress_level: '2' } });
  check('heat level 2 and 3: one heat alert, the hours, the highest level', a.length === 1 && a[0].kind === 'heat' && a[0].value === 3 && a[0].hours.join() === '11:00,12:00,13:00', a);
  check('gust 49.9: no alert', one({ 10: { gust_speed: '49.9' } }).length === 0);
  a = one({ 10: { gust_speed: String(GUST_KMH) } });
  check('gust 50: an alert', a.length === 1 && a[0].kind === 'gust' && a[0].value === 50 && a[0].hours.join() === '10:00', a);
  check('rain 59: no alert', one({ 9: { rain_chance: '59' } }).length === 0);
  a = one({ 9: { rain_chance: String(RAIN_PCT) } });
  check('rain 60: an alert', a.length === 1 && a[0].kind === 'rain' && a[0].value === 60 && a[0].hours.join() === '09:00', a);
  a = one({ 9: { rain_chance: '60' }, 10: { rain_chance: '80' } });
  check('the highest value of the hours is kept', a.length === 1 && a[0].value === 80 && a[0].hours.length === 2, a);
  check('empty or text values are not alerts', one({ 12: { heat_stress_level: null, gust_speed: '', rain_chance: 'x' } }).length === 0);

  console.log('\n3. only working hours of tomorrow');
  check('05:00 and 19:00 do not count', one({ '05': { heat_stress_level: '3', gust_speed: '90', rain_chance: '100' }, 19: { heat_stress_level: '3', gust_speed: '90', rain_chance: '100' } }).length === 0);
  a = one({ '06': { gust_speed: '60' }, 18: { gust_speed: '55' } });
  check('06:00 and 18:00 count', a.length === 1 && a[0].hours.join() === '06:00,18:00', a);
  check('another day in the data does not count', assess({ '2026-10-15': day('2026-10-15', { 12: { heat_stress_level: '3' } }), [D]: day(D) }, D).length === 0);
  // 20/10/2026, the morning update on WhatsApp: low/high from "daily", rain and gusts from working hours only.
  const sd = day(D, { 3: { gust_speed: '80', rain_chance: '90' }, 12: { gust_speed: '30', rain_chance: '40' } });
  sd.daily = { minimum_temperature: '17', maximum_temperature: '26' };
  const sm = daySummary({ [D]: sd }, D);
  check('summary: daily low/high, the 03:00 gust and rain do not count', sm && sm.tmin === 17 && sm.tmax === 26 && sm.gust === 30 && sm.rain === 40, sm);
  const nd = day(D, { 8: { temperature: '12' }, 14: { temperature: '29' } });
  const sm2 = daySummary({ [D]: nd }, D);
  check('summary without "daily": low/high from the hours', sm2 && sm2.tmin <= 12 && sm2.tmax >= 29, sm2);
  check('summary of a missing day: null, no throw', daySummary({}, D) === null && daySummary(null, D) === null);
  let threw = ''; try { assess({ '2026-10-15': day('2026-10-15') }, D); } catch (e) { threw = e.message; }
  check('tomorrow missing from the forecast: an error', /no forecast for 2026-10-16/.test(threw), threw);

  console.log('\n4. the endpoint');
  const ENV = { SUPABASE_SERVICE_ROLE_KEY: 'srv', TRUSTEE_NOTIFY_SECRET: 'nsec' };
  function world(o) {
    const w = { state: {}, ims: 0, other: [] };
    globalThis.fetch = async (url, init) => {
      const u = String(url), mth = (init && init.method) || 'GET';
      const json = (x, st = 200) => new Response(typeof x === 'string' ? x : JSON.stringify(x), { status: st, headers: { 'Content-Type': 'application/json' } });
      if (u.startsWith(SB + '/rest/v1/server_state') && mth === 'POST') { if (o.stateDown) return json({}, 500); JSON.parse(init.body).forEach((x) => { w.state[x.key] = x.value; }); return new Response(null, { status: 201 }); }
      if (u.startsWith(SB + '/rest/v1/server_state')) return json(o.stored ? [{ key: STATE_KEY, value: o.stored, updated_at: '2026-10-15T14:07:00Z' }] : []);
      if (u.startsWith(SB + '/auth/v1/user')) return o.user === 'anon' ? json({ id: 'a', is_anonymous: true }) : o.user ? json({ id: 'u1', email: 'x@tfugen.local' }) : json({ msg: 'bad' }, 401);
      if (u === IMS_URL) {
        w.ims++;
        if (!init || !init.signal) w.other.push('no time limit');
        if (o.ims === 'down') throw new Error('network down');
        if (o.ims === '502') return json({}, 502);
        if (o.ims === 'html') return json('<html>', 200);
        return json({ data: o.data, method: 'x' });
      }
      w.other.push(mth + ' ' + u);
      return json({}, 599);
    };
    return w;
  }
  const post = (h, op = 'check') => new Request('https://x/api/weather?op=' + op, { method: 'POST', headers: Object.assign({ 'Content-Type': 'application/json' }, h || {}), body: '{}' });
  const tmrw = tomorrowIL(Date.now());
  let w = world({ data: { [tmrw]: day(tmrw, { 12: { heat_stress_level: '2' } }) } });
  let res = await onRequest({ request: post(), env: ENV });
  check('no secret: 403, IMS not called, nothing stored', res.status === 403 && !w.ims && !Object.keys(w.state).length);
  res = await onRequest({ request: post({ 'x-notify-secret': 'wrong' }), env: ENV });
  check('a wrong secret: 403', res.status === 403 && !w.ims);
  res = await onRequest({ request: post({ 'x-notify-secret': 'nsec' }), env: ENV });
  let s = JSON.parse(w.state[STATE_KEY] || '{}');
  check('a run: stored ok, tomorrow, the heat alert, the source', res.status === 200 && s.ok === true && s.day === tmrw && s.alerts.length === 1 && s.alerts[0].kind === 'heat' && s.src === 'ims 62' && s.at, s);
  check('IMS called once, with a time limit, nothing else touched', w.ims === 1 && !w.other.length, w.other);
  for (const [why, ims, re] of [['IMS down', 'down', /network down/], ['IMS 502', '502', /ims HTTP 502/], ['IMS returns HTML', 'html', /not JSON/]]) {
    w = world({ ims });
    res = await onRequest({ request: post({ 'x-notify-secret': 'nsec' }), env: ENV });
    s = JSON.parse(w.state[STATE_KEY] || '{}');
    check(why + ': 200, stored ok:false with the reason', res.status === 200 && s.ok === false && re.test(s.error) && Array.isArray(s.alerts) && !s.alerts.length, s);
  }
  w = world({ data: { '2020-01-01': day('2020-01-01') } });
  await onRequest({ request: post({ 'x-notify-secret': 'nsec' }), env: ENV });
  s = JSON.parse(w.state[STATE_KEY] || '{}');
  check('tomorrow missing: stored ok:false', s.ok === false && /no forecast/.test(s.error), s);
  w = world({ ims: 'down', stateDown: true });
  const r2 = await runCheck(ENV);
  check('the store itself down: no throw, saved:false', r2.saved === false && r2.ok === false, r2);

  const get = (h, op = 'status') => new Request(ORIGIN + '/api/weather?op=' + op, { method: 'GET', headers: Object.assign({ Origin: ORIGIN }, h || {}) });
  w = world({ stored: JSON.stringify({ ok: true, day: tmrw, alerts: [] }) });
  res = await onRequest({ request: get(), env: ENV });
  check('status without a token: 401', res.status === 401);
  w = world({ user: 'anon', stored: '{}' });
  res = await onRequest({ request: get({ Authorization: 'Bearer anon' }), env: ENV });
  check('status for an anonymous trustee session: refused', res.status >= 400 && res.status < 500, res.status);
  w = world({ user: 'staff', stored: JSON.stringify({ ok: true, day: tmrw, alerts: [] }) });
  res = await onRequest({ request: get({ Authorization: 'Bearer good' }), env: ENV });
  const j = await res.json();
  check('status for a signed-in user: the stored record, IMS not called', res.status === 200 && j.last && j.last.day === tmrw && !w.ims, j);
  res = await onRequest({ request: new Request(ORIGIN + '/api/weather?op=check', { method: 'GET', headers: { Origin: ORIGIN, Authorization: 'Bearer good' } }), env: ENV });
  check('a user cannot run the check with GET', res.status === 400 && !w.ims);

  console.log('\n5. the home-screen line (_wxLine from index.html)');
  const html = fs.readFileSync(new URL('../../index.html', import.meta.url), 'utf8');
  const from = html.indexOf('function _wxIlDate'), to = html.indexOf('window._wxHomeRender');
  check('index.html has _wxLine and the box on the home screen', from > 0 && to > from && html.includes('<div id="dash-weather"></div>') && /_wxHomeRender\(\);/.test(html.slice(html.indexOf('function rDash'), html.indexOf('function rDash') + 3000)));
  const src = html.slice(from, to);
  check('no raw Hebrew in the script', !/[֐-׿]/.test(src));
  check('the browser never calls IMS', !/ims\.gov\.il/.test(html));
  const line = new Function(src + '\nreturn _wxLine;')();
  const now = Date.parse('2026-10-15T15:00:00Z'), at = '2026-10-15T14:07:00Z';
  const rec = (o) => Object.assign({ at, day: '2026-10-16', ok: true, alerts: [{ kind: 'heat', hours: ['11:00', '12:00', '13:00', '14:00', '15:00'], value: 2 }] }, o);
  check('heat tomorrow: the line Michael asked for', line(rec(), now) === 'מחר במפעל: עומס חום דרגה 2 בין 11:00 ל-15:00. לשקול: הקדמת עבודה בחוץ, שתייה והפסקות בצל.', line(rec(), now));
  const all = line(rec({ alerts: [{ kind: 'gust', hours: ['09:00', '10:00', '14:00'], value: 55 }, { kind: 'rain', hours: ['07:00'], value: 70 }] }), now);
  check('gusts and rain: both, broken hours, one hour', all === 'מחר במפעל: משבי רוח עד 55 קמ"ש בין 09:00 ל-10:00, ב-14:00. לשקול: לדחות עבודה בגובה, הרמות ועגורנים. סיכוי לגשם 70% ב-07:00. לשקול: רצפות חלקות ועבודה בחוץ.', all);
  check('keyboard characters only', !/[‐-―«»“-‟←-⇿·…]/.test(all + line(rec(), now)));
  check('the next morning the same record says "today"', /^היום במפעל: /.test(line(rec(), Date.parse('2026-10-16T05:00:00Z'))));
  check('no alerts: nothing', line(rec({ alerts: [] }), now) === '');
  check('a failed run: nothing', line(rec({ ok: false, error: 'x' }), now) === '');
  check('nothing stored: nothing', line(null, now) === '');
  check('30 hours old: shown; a minute later: nothing', line(rec(), Date.parse(at) + 30 * 3600e3) !== '' && line(rec(), Date.parse(at) + 30 * 3600e3 + 60e3) === '');
  check('a day that passed: nothing', line(rec({ day: '2026-10-14' }), now) === '');
  check('the Israel date, not UTC: 21:30 UTC on 15/10 is 16/10 in Israel, so day 16/10 is "today"', /^היום/.test(line(rec({ at: '2026-10-15T14:07:00Z' }), Date.parse('2026-10-15T21:30:00Z'))));

  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.log('HARNESS ERROR: ' + (e && e.stack || e)); process.exit(1); });
