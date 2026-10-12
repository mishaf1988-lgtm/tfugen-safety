// Daily copy of the backups to OneDrive (upgrade review 21; Michael,
// 01/10/2026). Only the caller with the secret or an admin runs it; the
// newest 15 of the bucket land in _Backups/cron and older ones are pruned;
// one complete backup per month in _Backups/monthly, 12 kept; the photos
// copied a few per run within Cloudflare's 50-subrequest budget, never
// pruned; a stale bucket or a refusing OneDrive is a failure in
// server_state.backup_od, and the weekly mail names it.
import { onRequest, missing, pruneList, monthlyPick, STATE_KEY, DAILY, MONTHLY, PHOTOS, DAILY_KEEP, MONTHLY_KEEP, TALKS, TALKS_KEEP, talksName, talksPrune, talksFile, SKIP, SKIP_DAYS, SKIP_MAX, skipOld, skipSeen, SEEN_KEY } from './_build/backup-od.mjs';
import { backupProblem, schemaProblem } from './_build/weekly-digest.mjs';
import fs from 'fs';

let pass = 0, fail = 0;
const check = (l, c, d) => { if (c) { pass++; console.log('  ✓ ' + l); } else { fail++; console.log('  ✗ ' + l + (d !== undefined ? '  -> ' + JSON.stringify(d).slice(0, 400) : '')); } };
const SB = 'https://znhjtpcltrxxyfjczgvw.supabase.co';
const G = 'https://graph.microsoft.com/v1.0/me/drive';
const ENV = { SUPABASE_SERVICE_ROLE_KEY: 'srv', ONEDRIVE_CLIENT_ID: 'cid', ONEDRIVE_CLIENT_SECRET: 'cs', TRUSTEE_NOTIFY_SECRET: 'nsec' };
const DAY = 86400000;
const pad = (n) => String(n).padStart(2, '0');
const nameAt = (ms, partial) => { const d = new Date(ms); return 'tapugan-backup-' + d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate()) + '_03-00-' + pad(d.getUTCSeconds()) + (partial ? '-partial' : '') + '.json'; };
// The latest 03:00:30 UTC not in the future, then whole days back. Until 02/10/2026
// each day was shifted on its own: before 03:00:30 at3(0) moved to yesterday and
// at3(1) was yesterday too, so two names matched and CI failed in that window.
const at3 = (daysAgo) => { const d = new Date(); d.setUTCHours(3, 0, 30, 0); const t0 = d.getTime() > Date.now() ? d.getTime() - DAY : d.getTime(); return t0 - daysAgo * DAY; };
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
    const w = { state: Object.assign({}, o.state || {}), od: { [DAILY]: new Map(), [MONTHLY]: new Map(), [PHOTOS]: new Map(), [TALKS]: new Map(), [SKIP]: new Map() }, created: {}, puts: [], dels: [], seq: 0, bodies: {}, talkReads: [] };
    (o.skip || []).forEach((x) => { const id = 'id' + (++w.seq); w.od[SKIP].set(x.name, id); w.created[id] = x.created; });
    Object.keys(o.od || {}).forEach((k) => o.od[k].forEach((n) => w.od[k].set(n, 'id' + (++w.seq))));
    const buckets = { backups: o.backups || [], 'incidents-photos': o.photos || [] };
    globalThis.fetch = async (url, init) => {
      const u = String(url), mth = (init && init.method) || 'GET';
      const json = (x, st = 200) => new Response(JSON.stringify(x), { status: st, headers: { 'Content-Type': 'application/json' } });
      if (u.startsWith(SB + '/auth/v1/user')) return json(o.email ? { id: 'u1', email: o.email, is_anonymous: false } : { id: 'a', is_anonymous: true });
      if (u.startsWith(SB + '/rest/v1/app_users')) return json(o.row ? [o.row] : []);
      if (u.startsWith(SB + '/rest/v1/oauth_tokens')) return json(o.noToken ? [] : [{ user_email: 'sviva@tapugan.co.il', refresh_token: 'rt', access_token: 'at', expires_at: new Date(Date.now() + 3600e3).toISOString(), scope: 'offline_access User.Read Files.ReadWrite Mail.Send' }]);
      if (u.startsWith(SB + '/rest/v1/toolbox_talks')) { w.talkReads.push(u); return o.talksFail ? json({ message: 'x' }, 500) : json(o.talks || []); }
      if (u.startsWith(SB + '/rest/v1/server_state') && mth === 'GET') { const ks = decodeURIComponent((/key=in\.\(([^)]*)\)/.exec(u) || [])[1] || '').split(','); return json(ks.filter((k) => k in w.state).map((k) => ({ key: k, value: w.state[k], updated_at: null }))); }
      if (u.startsWith(SB + '/rest/v1/server_state')) { if (mth === 'POST') JSON.parse(init.body).forEach((r) => { w.state[r.key] = r.value; }); return new Response(null, { status: 201 }); }
      let m = /\/storage\/v1\/object\/list\/([^/?]+)$/.exec(u);
      if (m) { const b = JSON.parse(init.body); return json(buckets[m[1]].slice().sort().slice(b.offset, b.offset + b.limit).map((n) => ({ name: n, id: 'x' + n }))); }
      m = /\/storage\/v1\/object\/([^/]+)\/(.+)$/.exec(u);
      if (m) return buckets[m[1]].includes(decodeURIComponent(m[2])) ? new Response('data:' + m[2], { status: 200, headers: { 'Content-Type': m[1] === 'backups' ? 'application/json' : 'image/jpeg' } }) : json({}, 404);
      m = /\/root:\/(.+):\/children/.exec(u);
      if (m) { const f = decodeURIComponent(m[1]); const map = w.od[f]; if (!map || !map.size) return json({}, 404); return json({ value: [...map].map(([n, id]) => ({ id, name: n, file: {}, createdDateTime: w.created[id] })) }); }
      m = /\/root:\/(.+)\/([^/]+):\/content$/.exec(u);
      if (m && mth === 'PUT') { if (o.putFail) return json({ error: { message: 'quota' } }, 507); const f = decodeURIComponent(m[1]), n = decodeURIComponent(m[2]); w.od[f].set(n, 'id' + (++w.seq)); w.puts.push(f + '|' + n); w.bodies[f + '|' + n] = init.body; return json({ id: 'x' }, 201); }
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

  console.log('\n1b. "not filed": deleted after ' + SKIP_DAYS + ' days');
  {
    const now = Date.parse('2026-11-20T03:00:00Z');
    const ago = (d) => new Date(now - d * 864e5).toISOString();
    const items = [{ id: 'a', name: 'old.pdf', created: ago(31) }, { id: 'b', name: 'new.pdf', created: ago(29) }, { id: 'c', name: 'nodate.pdf', created: null }, { id: null, name: 'noid.pdf', created: ago(90) }];
    const seen = { a: ago(31), b: ago(29), x: ago(90) };
    check('seen more than 30 days ago only; never seen or no id: kept', skipOld(items, now, seen).map((x) => x.name).join() === 'old.pdf', skipOld(items, now, seen));
    // Retro 12/10/2026: a move keeps createdDateTime. A file created 90 days ago and moved in today is kept.
    const moved = [{ id: 'm', name: 'moved.pdf', created: ago(90) }];
    const s1 = skipSeen(moved, {}, ago(0));
    check('moved in today with an old createdDateTime: first seen today, kept', s1.m === ago(0) && skipOld(moved, now, s1).length === 0, s1);
    check('seen before: keeps its first time; gone from the folder: dropped', JSON.stringify(skipSeen([{ id: 'a' }, { id: 'n' }], { a: ago(40), z: ago(50) }, ago(0))) === JSON.stringify({ a: ago(40), n: ago(0) }));
    check('a bad stored time counts as today (only delays)', skipSeen([{ id: 'a' }], { a: 'garbage' }, ago(0)).a === ago(0));
    check('no seen map: nothing old', skipOld(items, now).length === 0);
    check('the folder: not filed, inside the mail inbox of the safety folder', /\/_נכנס מהמייל\/לא לתיוק$/.test(SKIP) && SKIP.indexOf('שולחן העבודה/ניהול בטיחות/') === 0);
  }

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
  check('nothing new in the bucket: no daily or monthly copy', c.j.ok && !c.rec.daily.copied.length && c.rec.monthly.copied === null && !c.w.puts.some((p) => !p.startsWith(PHOTOS) && !p.startsWith(TALKS)), c.w.puts);
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

  console.log('\n3. the weekly talk (03/10/2026, Michael: OneDrive, not Workers Paid)');
  check('file name in Michael\'s date order, DD-MM-YYYY', talksName('2026-10-03') === 'talks-03-10-2026.json');
  const TN = ['talks-01-10-2026.json', 'talks-30-09-2026.json', 'talks-02-10-2026.json', 'talks-15-08-2026.json', 'other.json'];
  check('prune by the date, not by the name (30-09 is older than 01-10)', talksPrune(TN, 2).join() === 'talks-30-09-2026.json,talks-15-08-2026.json', talksPrune(TN, 2));
  const f0 = talksFile([{ id: 't1', title: 'a', toolbox_reads: [{ id: 'r1', talk_id: 't1' }, { id: 'r2', talk_id: 't1' }] }, { id: 't2', title: 'b', toolbox_reads: [] }], 'AT');
  check('the file holds the two tables as rows, ready to insert back', f0.at === 'AT' && f0.tables.toolbox_talks.length === 2 && !('toolbox_reads' in f0.tables.toolbox_talks[0]) && f0.tables.toolbox_reads.map((x) => x.id).join() === 'r1,r2', f0);
  const TALK_ROWS = [{ id: 't1', title: 'עבודה בגובה', toolbox_reads: [{ id: 'r1', talk_id: 't1', emp_name: 'דנה', id_no: '0123' }] }];
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jerusalem' });
  const OLDT = Array.from({ length: 16 }, (_, i) => talksName(new Date(Date.now() - (i + 1) * DAY).toLocaleDateString('en-CA', { timeZone: 'Asia/Jerusalem' })));
  c = await call({ backups: BK, photos: PH, talks: TALK_ROWS, od: { [TALKS]: OLDT } }, 'nsec');
  const tf = TALKS + '|' + talksName(today), body = JSON.parse(c.w.bodies[tf] || '{}');
  check('one read for both tables, today\'s file written', c.j.ok && c.w.talkReads.length === 1 && /select=\*,toolbox_reads\(\*\)/.test(c.w.talkReads[0]) && !!c.w.bodies[tf], [c.j.errors, c.w.talkReads]);
  check('the file has the talk and the signature, ID included', body.tables && body.tables.toolbox_talks[0].title === 'עבודה בגובה' && body.tables.toolbox_reads[0].id_no === '0123', body);
  check('15 days kept, the oldest pruned, counts recorded', c.w.od[TALKS].size === TALKS_KEEP && !c.w.od[TALKS].has(OLDT[15]) && !c.w.od[TALKS].has(OLDT[14]) && c.rec.talks.pruned === 2 && c.rec.talks.talks === 1 && c.rec.talks.reads === 1, [c.w.od[TALKS].size, c.rec.talks]);
  check('still within the 50-subrequest budget, photos take what is left', c.rec.subrequests <= 44 && c.rec.photos.copied > 0, [c.rec.subrequests, c.rec.photos]);
  {
    const D = 864e5;
    const iso = (d) => new Date(Date.now() - d * D).toISOString();
    // world() gives the skip files ids id1, id2, ... in order.
    const sk = [{ name: 'a-old.pdf', created: iso(40) }, { name: 'b-new.pdf', created: iso(40) }];
    const t2 = iso(2);
    const c2 = await call({ backups: [], photos: [], talks: [], skip: sk, state: { [SEEN_KEY]: JSON.stringify({ id1: iso(40), id2: t2 }) } }, 'nsec');
    const seen2 = JSON.parse(c2.w.state[SEEN_KEY] || '{}');
    check('not filed: seen 40 days ago deleted, seen 2 days ago kept (same createdDateTime), counted', c2.w.dels.includes('a-old.pdf') && !c2.w.dels.includes('b-new.pdf') && c2.w.od[SKIP].has('b-new.pdf') && c2.rec.skip.pruned === 1 && c2.rec.skip.files === 2, [c2.w.dels, c2.rec.skip]);
    check('skip_seen saved: the kept one with its first time, the deleted one gone', seen2.id2 === t2 && !('id1' in seen2), seen2);
    const c1 = await call({ backups: [], photos: [], talks: [], skip: sk }, 'nsec');
    const seen1 = JSON.parse(c1.w.state[SEEN_KEY] || '{}');
    check('first run: old files are only recorded, none deleted', c1.rec.skip.pruned === 0 && !c1.w.dels.length && Object.keys(seen1).length === 2, [c1.rec.skip, seen1]);
    const many = Array.from({ length: SKIP_MAX + 5 }, (_, i) => ({ name: 'x' + i + '.pdf', created: iso(60) }));
    const old60 = {}; many.forEach((x, i) => { old60['id' + (i + 1)] = iso(60); });
    const c3 = await call({ backups: [], photos: [], talks: [], skip: many, state: { [SEEN_KEY]: JSON.stringify(old60) } }, 'nsec');
    check('at most ' + SKIP_MAX + ' a day', c3.rec.skip.pruned === SKIP_MAX && c3.w.od[SKIP].size === 5, c3.rec.skip);
    const c4 = await call({ backups: [], photos: [], talks: [] }, 'nsec');
    check('no such folder: nothing deleted, no error', c4.rec.skip.pruned === 0 && !c4.rec.errors.some((e) => /^skip/.test(e)), c4.rec);
  }
  c = await call({ backups: BK, photos: [], talksFail: true }, 'nsec');
  check('the talk read fails: named in the result (and so in the weekly mail), the rest still copied', !c.j.ok && c.rec.errors.some((e) => /^talks: read toolbox_talks 500/.test(e)) && c.w.od[DAILY].size === 15, c.rec.errors);
  check('the weekly mail names it', /talks: read toolbox_talks/.test(backupProblem(JSON.stringify(c.rec), Date.now()) || ''), backupProblem(JSON.stringify(c.rec), Date.now()));
  c = await call({ backups: BK, photos: [], talks: [] }, 'nsec');
  check('no talks yet: an empty file is still written (the path is proven every day)', c.j.ok && c.rec.talks.talks === 0 && !!c.w.bodies[tf], c.rec.talks);

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

  // Lesson 8: the browser prune of _Backups must never delete the server's folders
  // (the lesson said this test checked it; until the retro of 01/10/2026 it did not).
  { const html = fs.readFileSync(new URL('../../index.html', import.meta.url), 'utf8');
    const m = html.match(/var browserFolders=[^\n]*/);
    // Since 04/10/2026 only a timestamp folder is a candidate (a name list missed
    // `talks`); backup-prune-test.js runs the function itself.
    const re = html.match(/var _BACKUP_STAMP_RE=\/(.*)\/;/);
    const rx = re && new RegExp(re[1]);
    check('the browser prune of _Backups only takes timestamp folders', !!m && m[0].includes('_BACKUP_STAMP_RE.test(') && !!rx && ['cron', 'monthly', 'photos', 'talks'].every((f) => !rx.test(f)) && rx.test('2026-10-04_07-58-20'), m && m[0].slice(0, 200)); }

  console.log('\n6. the weekly mail');
  const now = Date.now();
  check('a fresh good run: no line', backupProblem(JSON.stringify({ at: new Date(now - 3600e3).toISOString(), ok: true }), now) === null);
  const failed = backupProblem(JSON.stringify({ at: new Date(now - 3600e3).toISOString(), ok: false, errors: ['onedrive put x 507'] }), now);
  check('a failed run: the line says failed, when (DD/MM/YYYY) and why', /^גיבוי ל-OneDrive: נכשל ב-\d{2}\/\d{2}\/\d{4} \d{2}:\d{2} \(onedrive put x 507\)$/.test(failed), failed);
  check('no run for 3 days: "not run since"', /^גיבוי ל-OneDrive: לא רץ מאז \d{2}\/\d{2}\/\d{4}/.test(backupProblem(JSON.stringify({ at: new Date(now - 3 * DAY).toISOString(), ok: true }), now)));
  check('never ran: "not run yet"', backupProblem('', now) === 'גיבוי ל-OneDrive: לא רץ עדיין');
  // 03/10/2026: private.db_columns_check() writes db_columns_drift; the mail names a column change.
  check('schema: no drift, no line', schemaProblem(JSON.stringify({ at: 'x', added: [], removed: [] })) === null && schemaProblem('') === null && schemaProblem('{bad') === null);
  const sp = schemaProblem(JSON.stringify({ at: 'x', added: ['hzm.ms'], removed: ['ncr.src_date'] }));
  check('schema: added and removed columns are named', sp === 'שינוי במבנה המסד: נוספו 1 (hzm.ms), נמחקו 1 (ncr.src_date). לבדוק עם Claude ולאשר', sp);
  const many = schemaProblem(JSON.stringify({ added: ['a.1', 'a.2', 'a.3', 'a.4', 'a.5', 'a.6', 'a.7', 'a.8'] }));
  check('schema: a long list is cut at 6 with +N', /נוספו 8 \(a\.1, a\.2, a\.3, a\.4, a\.5, a\.6 \+2\)/.test(many || ''), many);
  check('keyboard characters only', !/[—–־«»“”…•→←]/.test(failed));

  console.log('\n' + pass + ' passed, ' + fail + ' failed');
})();
