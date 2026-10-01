// Daily copy of the backups to OneDrive (upgrade review 21; Michael,
// 01/10/2026). Only the caller with the secret or an admin runs it; the
// newest 15 of the bucket land in _Backups/cron and older ones are pruned;
// one complete backup per month in _Backups/monthly, 12 kept; the photos
// copied a few per run within Cloudflare's 50-subrequest budget, never
// pruned; a stale bucket or a refusing OneDrive is a failure in
// server_state.backup_od, and the weekly mail names it.
import { onRequest, missing, pruneList, monthlyPick, STATE_KEY, DAILY, MONTHLY, PHOTOS, DAILY_KEEP, MONTHLY_KEEP } from './_build/backup-od.mjs';
import { backupProblem } from './_build/weekly-digest.mjs';
import fs from 'fs';

let pass = 0, fail = 0;
const check = (l, c, d) => { if (c) { pass++; console.log('  ✓ ' + l); } else { fail++; console.log('  ✗ ' + l + (d !== undefined ? '  -> ' + JSON.stringify(d).slice(0, 400) : '')); } };
const SB = 'https://znhjtpcltrxxyfjczgvw.supabase.co';
const G = 'https://graph.microsoft.com/v1.0/me/drive';
const ENV = { SUPABASE_SERVICE_ROLE_KEY: 'srv', ONEDRIVE_CLIENT_ID: 'cid', ONEDRIVE_CLIENT_SECRET: 'cs', TRUSTEE_NOTIFY_SECRET: 'nsec' };
const DAY = 86400000;
const pad = (n) => String(n).padStart(2, '0');
const nameAt = (ms, partial) => { const d = new Date(ms); return 'tapugan-backup-' + d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate()) + '_03-00-' + pad(d.getUTCSeconds()) + (partial ? '-partial' : '') + '.json'; };
const at3 = (daysAgo) => { const d = new Date(Date.now() - daysAgo * DAY); d.setUTCHours(3, 0, 30, 0); return d.getTime() > Date.now() ? d.getTime() - DAY : d.getTime(); };
const daily = (n, from) => Array.from({ length: n }, (_, i) => nameAt(at3((from || 0) + i)));

(async () => {
  console.log('\n1. the rules');
  check('missing: what the source has and the target not', missing(['a', 'b', 'c'], ['b']).join() === 'a,c');
  check('pruneList: the oldest beyond keep, by the timestamp in the name', pruneList(['tapugan-backup-2026-09-03_x.json', 'tapugan-backup-2026-09-01_x.json', 'tapugan-backup-2026-09-02_x.json'], 2).join() === 'tapugan-backup-2026-09-01_x.json');
  const B = ['tapugan-backup-2026-10-01_03-00-56-partial.json', 'tapugan-backup-2026-10-02_03-00-50.json', 'tapugan-backup-2026-10-01_12-44-39.json', 'tapugan-backup-2026-09-30_03-00-49.json'];
  check('monthly: the first complete one of the month, a partial file never', monthlyPick(B, [], '2026-10-05') === 'tapugan-backup-2026-10-01_12-44-39.json', monthlyPick(B, [], '2026-10-05'));
  check('monthly: nothing when this month is already there', monthlyPick(B, ['tapugan-backup-2026-10-02_03-00-50.json'], '2026-10-05') === null);
  check('monthly: nothing when the bucket has none of this month yet', monthlyPick(B, [], '2026-11-01') === null);
  check('keep: 15 days, 12 months', DAILY_KEEP === 15 && MONTHLY_KEEP === 12);
  check('the folders: under Apps/Tapugan Safety/_Backups', DAILY === 'Apps/Tapugan Safety/_Backups/cron' && MONTHLY === 'Apps/Tapugan Safety/_Backups/monthly' && PHOTOS === 'Apps/Tapugan Safety/_Backups/photos');

  function world(o) {
    const w = { state: {}, od: { [DAILY]: new Map(), [MONTHLY]: new Map(), [PHOTOS]: new Map() }, puts: [], dels: [], seq: 0 };
    Object.keys(o.od || {}).forEach((k) => o.od[k].forEach((n) => w.od[k].set(n, 'id' + (++w.seq))));
    const buckets = { backups: o.backups || [], 'incidents-photos': o.photos || [] };
    globalThis.fetch = async (url, init) => {
      const u = String(url), mth = (init && init.method) || 'GET';
      const json = (x, st = 200) => new Response(JSON.stringify(x), { status: st, headers: { 'Content-Type': 'application/json' } });
      if (u.startsWith(SB + '/auth/v1/user')) return json(o.email ? { id: 'u1', email: o.email, is_anonymous: false } : { id: 'a', is_anonymous: true });
      if (u.startsWith(SB + '/rest/v1/app_users')) return json(o.row ? [o.row] : []);
      if (u.startsWith(SB + '/rest/v1/oauth_tokens')) return json(o.noToken ? [] : [{ user_email: 'sviva@tapugan.co.il', refresh_token: 'rt', access_token: 'at', expires_at: new Date(Date.now() + 3600e3).toISOString(), scope: 'offline_access User.Read Files.ReadWrite Mail.Send' }]);
      if (u.startsWith(SB + '/rest/v1/server_state')) { if (mth === 'POST') JSON.parse(init.body).forEach((r) => { w.state[r.key] = r.value; }); return new Response(null, { status: 201 }); }
      let m = /\/storage\/v1\/object\/list\/([^/?]+)$/.exec(u);
      if (m) { const b = JSON.parse(init.body); return json(buckets[m[1]].slice().sort().slice(b.offset, b.offset + b.limit).map((n) => ({ name: n, id: 'x' + n }))); }
      m = /\/storage\/v1\/object\/([^/]+)\/(.+)$/.exec(u);
      if (m) return buckets[m[1]].includes(decodeURIComponent(m[2])) ? new Response('data:' + m[2], { status: 200, headers: { 'Content-Type': m[1] === 'backups' ? 'application/json' : 'image/jpeg' } }) : json({}, 404);
      m = /\/root:\/(.+):\/children/.exec(u);
      if (m) { const f = decodeURIComponent(m[1]); const map = w.od[f]; if (!map || !map.size) return json({}, 404); return json({ value: [...map].map(([n, id]) => ({ id, name: n, file: {} })) }); }
      m = /\/root:\/(.+)\/([^/]+):\/content$/.exec(u);
      if (m && mth === 'PUT') { if (o.putFail) return json({ error: { message: 'quota' } }, 507); const f = decodeURIComponent(m[1]), n = decodeURIComponent(m[2]); w.od[f].set(n, 'id' + (++w.seq)); w.puts.push(f + '|' + n); return json({ id: 'x' }, 201); }
      m = /\/items\/([^/?]+)$/.exec(u);
      if (m && mth === 'DELETE') { const id = decodeURIComponent(m[1]); for (const map of Object.values(w.od)) for (const [n, i] of map) if (i === id) { map.delete(n); w.dels.push(n); } return new Response(null, { status: 204 }); }
      return json({ error: 'unexpected ' + mth + ' ' + u }, 599);
    };
    return w;
  }
  const call = async (o, secret) => {
    const w = world(o);
    const headers = { 'content-type': 'application/json' };
    if (secret) headers['x-notify-secret'] = secret; else headers.authorization = 'Bearer tok';
    const r = await onRequest({ request: new Request('https://tapugan-safety.pages.dev/api/backup-od', { method: 'POST', headers, body: '{}' }), env: ENV });
    let j = null; try { j = await r.json(); } catch (e) {}
    let rec = null; try { rec = JSON.parse(w.state[STATE_KEY]); } catch (e) {}
    return { status: r.status, j, w, rec };
  };

  console.log('\n2. who may run it');
  let c = await call({});
  check('anonymous: refused, nothing copied', (c.status === 401 || c.status === 403) && !c.w.puts.length, c.status);
  c = await call({}, 'wrong');
  check('a wrong secret: refused', (c.status === 401 || c.status === 403) && !c.w.puts.length, c.status);
  c = await call({ email: 'mgr@tfugen.local', row: { role: 'מנהל', active: true } });
  check('a manager: refused (admin only)', c.status === 403 && !c.w.puts.length, c.status);
  const cronAllowed = fs.readFileSync(new URL('../../functions/_middleware.js', import.meta.url), 'utf8').includes("'/api/backup-od'");
  check('the middleware lets pg_cron through the country gate', cronAllowed);

  console.log('\n3. the first run: empty OneDrive');
  const BK = daily(20);
  const PH = Array.from({ length: 30 }, (_, i) => 'tru-ph-' + i + '-1-17900000' + pad(i) + '.jpg');
  c = await call({ backups: BK, photos: PH }, 'nsec');
  const newest15 = BK.slice().sort().reverse().slice(0, 15);
  check('cron: the newest 15 copied, nothing older', c.j.ok && c.w.od[DAILY].size === 15 && newest15.every((n) => c.w.od[DAILY].has(n)), [c.j.errors, c.w.od[DAILY].size]);
  const ym = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jerusalem' }).substring(0, 7);
  const firstOfMonth = BK.filter((n) => n.includes('-backup-' + ym)).sort()[0];
  check('monthly: the first backup of this month', c.w.od[MONTHLY].size === 1 && c.w.od[MONTHLY].has(firstOfMonth) && c.rec.monthly.copied === firstOfMonth, [...c.w.od[MONTHLY].keys()]);
  check('photos: some copied, the rest counted for tomorrow, within the budget', c.rec.photos.copied > 0 && c.rec.photos.copied + c.rec.photos.left === 30 && c.rec.photos.total === 30 && c.rec.subrequests <= 44, c.rec.photos);
  check('recorded in server_state: ok, newest, when', c.rec && c.rec.ok && c.rec.newest === BK[0] && !!c.rec.at, c.rec);

  console.log('\n4. the next runs');
  const before = c.rec.photos.copied;
  c = await call({ backups: BK, photos: PH, od: { [DAILY]: newest15, [MONTHLY]: [firstOfMonth], [PHOTOS]: PH.slice(0, before) } }, 'nsec');
  check('nothing new in the bucket: no daily or monthly copy', c.j.ok && !c.rec.daily.copied.length && c.rec.monthly.copied === null && !c.w.puts.some((p) => !p.startsWith(PHOTOS)), c.w.puts);
  check('photos: up to 15 more, none twice', c.rec.photos.copied === Math.min(15, 30 - before) && new Set(c.w.puts).size === c.w.puts.length && c.w.puts.every((p) => !PH.slice(0, before).includes(p.split('|')[1])), c.rec.photos);
  const OLD = daily(18, 1); // OneDrive has 18 from earlier days, the bucket a new one today
  c = await call({ backups: [nameAt(at3(0))], photos: [], od: { [DAILY]: OLD } }, 'nsec');
  check('a new day: today copied, the oldest pruned so 15 stay', c.j.ok && c.rec.daily.copied.length === 1 && c.w.od[DAILY].size === 15 && c.rec.daily.pruned === 4 && c.w.dels.every((n) => OLD.slice(-4).includes(n)), [c.rec.daily, c.w.dels]);
  const MON = Array.from({ length: 12 }, (_, i) => 'tapugan-backup-20' + (24 + Math.floor(i / 12)) + '-' + pad(i + 1) + '-01_03-00-29.json');
  c = await call({ backups: BK, photos: [], od: { [DAILY]: newest15, [MONTHLY]: MON } }, 'nsec');
  check('monthly: the 13th month pushes out the oldest, 12 stay', c.w.od[MONTHLY].size === 12 && c.w.od[MONTHLY].has(firstOfMonth) && !c.w.od[MONTHLY].has(MON[0]) && c.rec.monthly.pruned === 1, [...c.w.od[MONTHLY].keys()]);
  c = await call({ backups: BK, photos: PH, od: { [PHOTOS]: PH.slice(0, 5) } }, 'nsec');
  check('photos are never pruned (a photo removed in the app stays in OneDrive)', c.w.dels.every((n) => !/\.jpg$/.test(n)));

  console.log('\n5. failures are recorded, not swallowed');
  c = await call({ backups: daily(5, 3), photos: [] }, 'nsec');
  check('the newest backup is 3 days old (the worker stopped): ok false, named', !c.j.ok && c.rec.errors.some((e) => /newest backup is old/.test(e)), c.rec.errors);
  c = await call({ backups: [], photos: [] }, 'nsec');
  check('an empty bucket: ok false', !c.j.ok && c.rec.errors.some((e) => /no complete backup/.test(e)), c.rec.errors);
  c = await call({ backups: BK, photos: PH, putFail: true }, 'nsec');
  check('OneDrive refuses: ok false, the status in the error, recorded', !c.j.ok && c.rec && !c.rec.ok && c.rec.errors.some((e) => /onedrive put .* 507/.test(e)), c.rec && c.rec.errors);
  c = await call({ backups: BK, noToken: true }, 'nsec');
  check('OneDrive not connected: ok false, recorded', !c.j.ok && c.rec && /not connected/.test(c.rec.errors.join()), c.rec);
  c = await call({ email: 'admin@tfugen.local', backups: BK, photos: [] });
  check('admin can run it by hand', c.j.ok && c.w.od[DAILY].size === 15);

  const rd = async (o, body, secret) => { const w = world(o); const headers = { 'content-type': 'application/json' }; if (secret) headers['x-notify-secret'] = secret; else headers.authorization = 'Bearer tok';
    const r = await onRequest({ request: new Request('https://tapugan-safety.pages.dev/api/backup-od', { method: 'POST', headers, body: JSON.stringify(body) }), env: ENV }); return { status: r.status, text: await r.text(), w }; };
  const odRead = (o) => { const w = world(o); const f0 = globalThis.fetch; globalThis.fetch = async (u, i) => { const m = /\/root:\/(.+)\/([^/]+):\/content$/.exec(String(u)); if (m && (!i || !i.method || i.method === 'GET')) { const f = decodeURIComponent(m[1]), n = decodeURIComponent(m[2]); return w.od[f] && w.od[f].has(n) ? new Response('{"from":"onedrive","f":"' + f + '"}', { status: 200 }) : new Response('{}', { status: 404 }); } return f0(u, i); }; return w; };
  let q = await rd({}, { op: 'read', name: BK[0] }, 'wrong');
  check('read-back for the drill: not without the secret', q.status === 401 || q.status === 403, q.status);
  q = await rd({ email: 'admin@tfugen.local' }, { op: 'read', name: BK[0] });
  check('... not even for an admin session', q.status === 403, q.status);
  q = await rd({}, { op: 'read', name: '../index.html' }, 'nsec');
  check('... a backup name only', q.status === 400, q.status);
  { const w = odRead({ od: { [DAILY]: [BK[0]] } }); const r = await onRequest({ request: new Request('https://x/api/backup-od', { method: 'POST', headers: { 'x-notify-secret': 'nsec' }, body: JSON.stringify({ op: 'read', name: BK[0] }) }), env: ENV });
    const t = await r.text(); check('... the file comes back from OneDrive _Backups/cron', r.status === 200 && t.includes('"from":"onedrive"') && t.includes(DAILY) && !w.puts.length, [r.status, t]); }
  { odRead({ od: { [MONTHLY]: [BK[0]] } }); const r = await onRequest({ request: new Request('https://x/api/backup-od', { method: 'POST', headers: { 'x-notify-secret': 'nsec' }, body: JSON.stringify({ op: 'read', folder: 'monthly', name: BK[0] }) }), env: ENV });
    check('... or from monthly; a missing file is an error, not an empty backup', r.status === 200 && (await r.text()).includes(MONTHLY)); }
  { odRead({}); const r = await onRequest({ request: new Request('https://x/api/backup-od', { method: 'POST', headers: { 'x-notify-secret': 'nsec' }, body: JSON.stringify({ op: 'read', name: BK[0] }) }), env: ENV });
    check('... missing in OneDrive: 502', r.status === 502, r.status); }

  console.log('\n6. the weekly mail');
  const now = Date.now();
  check('a fresh good run: no line', backupProblem(JSON.stringify({ at: new Date(now - 3600e3).toISOString(), ok: true }), now) === null);
  const failed = backupProblem(JSON.stringify({ at: new Date(now - 3600e3).toISOString(), ok: false, errors: ['onedrive put x 507'] }), now);
  check('a failed run: the line says failed, when (DD/MM/YYYY) and why', /^גיבוי ל-OneDrive: נכשל ב-\d{2}\/\d{2}\/\d{4} \d{2}:\d{2} \(onedrive put x 507\)$/.test(failed), failed);
  check('no run for 3 days: "not run since"', /^גיבוי ל-OneDrive: לא רץ מאז \d{2}\/\d{2}\/\d{4}/.test(backupProblem(JSON.stringify({ at: new Date(now - 3 * DAY).toISOString(), ok: true }), now)));
  check('never ran: "not run yet"', backupProblem('', now) === 'גיבוי ל-OneDrive: לא רץ עדיין');
  check('keyboard characters only', !/[—–־«»“”…•→←]/.test(failed));

  console.log('\n' + pass + ' passed, ' + fail + ' failed');
})();
