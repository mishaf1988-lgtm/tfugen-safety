// A contractor against the government registries (08/11/2026, /api/registry): data.gov.il pinkas (licensed
// contractors) and asbest (asbestos licences), the weekly probe in server_state.registry_probe, the weekly-mail
// line, and the card in index.html (_ctrReg). data.gov.il is mocked; the records copy the real field names
// measured on 08/11/2026.
import fs from 'fs';
import { onRequest, cleanQ, cleanCid, pinkasRows, asbestRows, lookup, runProbe, CKAN, RES_PINKAS, RES_ASBEST, PROBE_KEY } from './_build/registry.mjs';
import { registryProblem } from './_build/weekly-digest.mjs';

let pass = 0, fail = 0;
const check = (l, c, d) => { if (c) { pass++; console.log('  ✓ ' + l); } else { fail++; console.log('  ✗ ' + l + (d !== undefined ? '  -> ' + JSON.stringify(d).slice(0, 400) : '')); } };
const SB = 'https://znhjtpcltrxxyfjczgvw.supabase.co';
const ORIGIN = 'https://tapugan-safety.pages.dev';
const P = (cid, name, anaf, sivug) => ({ MISPAR_YESHUT: cid, SHEM_YESHUT: name, SHEM_YISHUV: 'משמר הנגב', MISPAR_KABLAN: '33284', TEUR_ANAF: anaf, SIVUG: sivug });
const A = (name, exp) => ({ Name: name, LicenseNumber: '46194', LicenseType: 'מפקח אסבסט פריך', Settlement: 'ניר אליהו', LicenseExpirationDate: exp });

(async () => {
  console.log('1. input');
  check('a Hebrew name passes', cleanQ('  נגב   אקולוגיה ') === 'נגב אקולוגיה');
  check('one letter, 61 letters, empty: refused', cleanQ('א') === null && cleanQ('א'.repeat(61)) === null && cleanQ('') === null);
  check('URL and control characters are stripped, not passed on', cleanQ('a/b?c=d#e%0A') === 'a b c d e 0A', cleanQ('a/b?c=d#e%0A'));
  check('company ID: 9 digits, dashes dropped', cleanCid('51-234567-8') === '512345678' && cleanCid('12345678') === null && cleanCid('1234567890') === null);

  console.log('\n2. records to the card');
  const pr = pinkasRows([P('570049551', 'נגב אקולוגיה אגשח בעמ', 'בניה', '1'), P('570049551', 'נגב אקולוגיה אגשח בעמ', 'כבישים תשתית ופיתוח', '1'), P('511111111', 'אחר בעמ', 'בניה', '2')]);
  check('one row per company ID, the fields of work merged', pr.length === 2 && pr[0].anaf.length === 2 && pr[0].anaf[0] === 'בניה 1', pr);
  check('at most 3 candidates', pinkasRows([1, 2, 3, 4, 5].map((i) => P('50000000' + i, 'x' + i, 'בניה', '1'))).length === 3);
  const ar = asbestRows([A('א', '2026-11-07T00:00:00'), A('ב', '16/06/2027'), A('ג', '')], '2026-11-08');
  check('ISO expiry yesterday: expired', ar[0].exp === '2026-11-07' && ar[0].expired === true, ar[0]);
  check('DD/MM/YYYY expiry in the future: valid', ar[1].exp === '2027-06-16' && ar[1].expired === false, ar[1]);
  check('no expiry: not marked expired', ar[2].exp === '' && ar[2].expired === false);

  console.log('\n3. the endpoint');
  const ENV = { SUPABASE_SERVICE_ROLE_KEY: 'srv', TRUSTEE_NOTIFY_SECRET: 'nsec' };
  function world(o) {
    const w = { state: {}, calls: [], other: [] };
    globalThis.fetch = async (url, init) => {
      const u = String(url), mth = (init && init.method) || 'GET';
      const json = (x, st = 200) => new Response(typeof x === 'string' ? x : JSON.stringify(x), { status: st, headers: { 'Content-Type': 'application/json' } });
      if (u.startsWith(SB + '/rest/v1/server_state') && mth === 'POST') { JSON.parse(init.body).forEach((x) => { w.state[x.key] = x.value; }); return new Response(null, { status: 201 }); }
      if (u.startsWith(SB + '/auth/v1/user')) return o.user === 'anon' ? json({ id: 'a', is_anonymous: true }) : o.user ? json({ id: 'u1', email: 'x@tfugen.local' }) : json({ msg: 'bad' }, 401);
      if (u.startsWith(CKAN + '?')) {
        const sp = new URL(u).searchParams, res = sp.get('resource_id');
        w.calls.push({ res, q: sp.get('q'), filters: sp.get('filters'), signal: !!(init && init.signal) });
        if (o.down === res || o.down === 'all') throw new Error('network down');
        if (o.html) return json('<html>', 404);
        if (res === RES_PINKAS) return json({ success: true, result: { total: o.pTotal == null ? 2 : o.pTotal, records: o.pRec || [P('570049551', 'נגב אקולוגיה אגשח בעמ', 'בניה', '1')] } });
        if (res === RES_ASBEST) return json({ success: true, result: { total: o.aTotal == null ? 457 : o.aTotal, records: o.aRec || [A('נגב אקולוגיה', '2026-01-01')] } });
      }
      w.other.push(mth + ' ' + u);
      return json({}, 599);
    };
    return w;
  }
  const get = (qs, h) => new Request(ORIGIN + '/api/registry?' + qs, { method: 'GET', headers: Object.assign({ Origin: ORIGIN }, h || {}) });
  const post = (h) => new Request('https://x/api/registry?op=check', { method: 'POST', headers: Object.assign({ 'Content-Type': 'application/json' }, h || {}), body: '{}' });
  let w = world({ user: true });
  let res = await onRequest({ request: get('op=ctr&q=' + encodeURIComponent('נגב')), env: ENV });
  check('no token: 401, data.gov.il not called', res.status === 401 && w.calls.length === 0);
  w = world({ user: 'anon' });
  res = await onRequest({ request: get('op=ctr&q=x1', { Authorization: 'Bearer anon' }), env: ENV });
  check('anonymous user: refused', res.status === 401 || res.status === 403, res.status);
  w = world({ user: true });
  res = await onRequest({ request: new Request(ORIGIN + '/api/registry?op=ctr&q=ab', { headers: { Origin: 'https://evil.example', Authorization: 'Bearer good' } }), env: ENV });
  check('a foreign origin: 403', res.status === 403);
  res = await onRequest({ request: get('op=ctr&q=a', { Authorization: 'Bearer good' }), env: ENV });
  check('a one-letter query: 400, nothing fetched', res.status === 400 && w.calls.length === 0);
  res = await onRequest({ request: get('op=ctr&q=' + encodeURIComponent('נגב אקולוגיה'), { Authorization: 'Bearer good' }), env: ENV });
  let j = await res.json();
  check('by name: both registries, the expired asbestos licence marked', res.status === 200 && j.ok && j.pinkas[0].cid === '570049551' && j.asbest[0].expired === true, j);
  check('only data.gov.il, the fixed resources, with a time limit', w.other.length === 0 && w.calls.every((c) => [RES_PINKAS, RES_ASBEST].includes(c.res) && c.signal), w);
  w = world({ user: true });
  res = await onRequest({ request: get('op=ctr&cid=570049551', { Authorization: 'Bearer good' }), env: ENV });
  j = await res.json();
  check('by ID: an exact string filter on pinkas, asbest skipped (it has no ID)', j.ok && w.calls.length === 1 && w.calls[0].filters === '{"MISPAR_YESHUT":"570049551"}', w.calls);
  w = world({ user: true, down: RES_ASBEST });
  j = await (await onRequest({ request: get('op=ctr&q=' + encodeURIComponent('נגב'), { Authorization: 'Bearer good' }), env: ENV })).json();
  check('one registry down: ok:false with the reason, the other still answers', j.ok === false && j.pinkas.length === 1 && /network down/.test(j.error), j);
  w = world({ user: true, html: true });
  j = await (await onRequest({ request: get('op=ctr&q=' + encodeURIComponent('נגב'), { Authorization: 'Bearer good' }), env: ENV })).json();
  check('an HTML error page: ok:false, never "not found"', j.ok === false && /HTTP 404/.test(j.error), j);

  console.log('\n4. the weekly probe');
  w = world({});
  res = await onRequest({ request: post(), env: ENV });
  check('no secret: 403', res.status === 403);
  res = await onRequest({ request: post({ 'x-notify-secret': 'nsec' }), env: ENV });
  let rec = JSON.parse(w.state[PROBE_KEY] || 'null');
  check('a healthy answer: ok stored with both totals', rec && rec.ok === true && rec.pinkas === 2 && rec.asbest === 457, rec);
  w = world({ aTotal: 0 });
  await runProbe(ENV);
  rec = JSON.parse(w.state[PROBE_KEY]);
  check('an empty registry: ok:false', rec.ok === false && /empty answer/.test(rec.error), rec);
  w = world({ pRec: [{ ID: 1, NAME: 'renamed' }] });
  await runProbe(ENV);
  rec = JSON.parse(w.state[PROBE_KEY]);
  check('renamed fields: ok:false naming them', rec.ok === false && /MISPAR_YESHUT/.test(rec.error), rec);
  w = world({ down: 'all' });
  await runProbe(ENV);
  check('site down: ok:false', JSON.parse(w.state[PROBE_KEY]).ok === false);

  console.log('\n5. the weekly mail');
  const now = Date.parse('2026-11-11T16:00:00Z');
  check('never ran: a problem', /לא רצה עדיין/.test(registryProblem(null, now) || ''));
  check('ran yesterday and ok: nothing', registryProblem(JSON.stringify({ at: '2026-11-10T05:23:00Z', ok: true }), now) === null);
  check('failed: a problem with the reason', /נכשלה.*empty answer/.test(registryProblem(JSON.stringify({ at: '2026-11-10T05:23:00Z', ok: false, error: 'empty answer' }), now) || ''));
  check('9 days old: a problem', /לא רצה מאז/.test(registryProblem(JSON.stringify({ at: '2026-11-02T05:23:00Z', ok: true }), now) || ''));

  console.log('\n6. the card in index.html');
  const html = fs.readFileSync(new URL('../../index.html', import.meta.url), 'utf8');
  check('the ID field and the check button are in the contractor form', /id="ctr-cid"/.test(html) && /onclick="_ctrReg\(\)"/.test(html));
  check('the ID is saved and edited', /cid:cid\|\|null/.test(html) && /"ctr-cid":"cid"/.test(html));
  check('the view shows the ID', /\['\\u05d7\.\\u05e4','cid'\]/.test(html));
  const fn = html.slice(html.indexOf('function _ctrReg(){'), html.indexOf('function svCtr(){'));
  check('the card calls /api/registry with the user token', /\/api\/registry\?op=ctr&/.test(fn) && /_vitreHdr\(\)/.test(fn));
  check('"not in the register" only on a full answer; a failure says "not checked"', /else if\(j\.ok\)h\+=/.test(fn) && /\.catch\(function\(\)\{box\.innerHTML=/.test(fn));
  check('registry values are escaped', /esc\(p\.name\)/.test(html) && /esc\(a\.name\)/.test(fn));

  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.log('HARNESS ERROR: ' + (e && e.stack || e)); process.exit(1); });
