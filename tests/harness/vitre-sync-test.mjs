// Unit test of the daily Vitre -> toolbox import that runs on the server
// (functions/api/vitre.js op=sync, real code, fetch mocked; Michael 30/09/2026)
// and of the home-screen line that shows it (index.html _vitreSyncLine).
// Proves: the cron path needs the shared secret and nothing else; a staff
// user cannot run it, the admin can; every page is walked; only refreshers
// whose Vitre id is not in toolbox.ext_id are inserted, in the same row shape
// as the manual import; at most 10 a run, the rest reported as pending; a
// Vitre failure inserts nothing and is written to server_state; a second run
// while one holds the lock does nothing; op=sync_status reads the result back.
import fs from 'node:fs';
import { onRequest } from './_build/vitre.mjs';
let pass = 0, fail = 0;
const check = (l, c, d) => { if (c) { pass++; console.log('  ✓ ' + l); } else { fail++; console.log('  ✗ ' + l + (d !== undefined ? '  -> ' + JSON.stringify(d) : '')); } };
const SB = 'https://znhjtpcltrxxyfjczgvw.supabase.co';
const env = { VITRE_API_KEY_ID: 'kid', VITRE_API_KEY_SECRET: 'ksecret', SUPABASE_SERVICE_ROLE_KEY: 'srv', TRUSTEE_NOTIFY_SECRET: 'cron-secret' };
const TOPIC = 'ריענון בטיחות שבועי (Vitre)';

// pages: arrays of Vitre tasks; a task is a refresher when its title has the word.
const task = (id, date, refresher = true) => ({ id, title: refresher ? 'טופס ביצוע ריענון בטיחות' : 'other', createDate: date + 'T08:00:00', closeDate: null });
function world(o) {
  const w = { calls: [], inserted: [], state: Object.assign({}, o.state || {}), email: o.email === undefined ? 'admin@tfugen.local' : o.email,
    pages: o.pages || [[]], have: o.have || [], failPage: o.failPage || 0, failDetail: o.failDetail || [], insertStatus: o.insertStatus || 201 };
  globalThis.fetch = async (url, init) => {
    const u = String(url); const method = (init && init.method) || 'GET';
    const body = init && init.body ? JSON.parse(init.body) : null;
    w.calls.push({ u, method, body });
    const json = (obj, status = 200) => new Response(obj === null ? null : JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json' } });
    if (u.startsWith(SB + '/auth/v1/user')) return json(w.email ? { id: 'u1', email: w.email, is_anonymous: false } : { id: 'a', is_anonymous: true });
    if (u.startsWith(SB + '/rest/v1/app_users')) {
      const id = decodeURIComponent(u.split('id=eq.')[1].split('&')[0]);
      return json(id === 'manager' ? [{ role: 'מנהל', active: true }] : []);
    }
    if (u.startsWith(SB + '/rest/v1/server_state')) {
      if (method === 'GET') {
        const keys = decodeURIComponent(u.split('key=in.(')[1]).replace(/\)$/, '').split(',');
        return json(keys.filter(k => k in w.state).map(k => ({ key: k, value: w.state[k], updated_at: 'x' })));
      }
      if (method === 'POST') {
        const ignore = /ignore-duplicates/.test(JSON.stringify(init.headers));
        body.forEach(r => { if (!(ignore && r.key in w.state)) w.state[r.key] = r.value; });
        return json(null, 201);
      }
      if (method === 'PATCH') {   // the lock: take it only when free (empty) or ours
        const key = decodeURIComponent(u.split('key=eq.')[1].split('&')[0]);
        const free = !w.state[key] || (u.includes('&value=eq.') && decodeURIComponent(u.split('&value=eq.')[1]) === w.state[key]);
        if (free) { w.state[key] = body.value; return json([{ key }]); }
        return json([]);
      }
    }
    if (u.startsWith(SB + '/rest/v1/toolbox')) {
      if (method === 'GET') return json(w.have.map(x => ({ ext_id: x })));
      if (method === 'POST') { if (w.insertStatus < 300) w.inserted.push(...body); return json(w.insertStatus < 300 ? null : { message: 'boom' }, w.insertStatus); }
    }
    if (u.includes('hbinov.com/task/get?PageNumber=')) {
      const p = parseInt(u.split('PageNumber=')[1], 10);
      if (p === w.failPage) return json({ message: 'down' }, 503);
      // hasMore is "a full page": pad every page but the last to 200 with non-refreshers.
      const rows = (w.pages[p - 1] || []).slice();
      if (p < w.pages.length) while (rows.length < 200) rows.push(task(900000 + p * 1000 + rows.length, '2020-01-01', false));
      return json(rows);
    }
    if (u.includes('hbinov.com/task/get/')) {
      const id = parseInt(u.split('/task/get/')[1], 10);
      if (w.failDetail.includes(id)) return json({ message: 'gone' }, 404);
      return json({ id, title: 't', createDate: '2026-09-29T07:00:00', createdByUser: { displayName: 'Manager ' + id }, closedByAppointmentId: 5000 + id });
    }
    if (u.includes('/appointmetResult/get-review-result/')) return json({ questions: [{ questionType: 'CheckBoxTemplate', title: 'טוגנים', selectedAnswers: [{ text: '1' }] }] });
    if (u.includes('/task/getFiles/')) return json({ files: [{ name: 'a.jpg', url: 'https://blob/x' }] });
    return json({ message: 'unexpected ' + u }, 404);
  };
  return w;
}
const cron = (secret, extra) => new Request('https://tapugan-safety.pages.dev/api/vitre?op=sync', {
  method: 'POST', headers: Object.assign({ 'content-type': 'application/json' }, secret === undefined ? {} : { 'x-notify-secret': secret }, extra || {}), body: '{}'
});
const user = (method, qs) => new Request('https://tapugan-safety.pages.dev/api/vitre?' + qs, {
  method, headers: { origin: 'https://tapugan-safety.pages.dev', authorization: 'Bearer tok', 'content-type': 'application/json' }, body: method === 'POST' ? '{}' : undefined
});
const go = async (request) => { const r = await onRequest({ request, env }); return { status: r.status, json: await r.json() }; };
const vitreCalls = w => w.calls.filter(c => c.u.includes('hbinov')).length;

console.log('op=sync: who may run it');
{
  let w = world({ pages: [[task(1, '2026-09-29')]] });
  let r = await go(cron(undefined));
  check('cron call without the secret: 403, Vitre untouched', r.status === 403 && vitreCalls(w) === 0, r);
  r = await go(cron('wrong'));
  check('wrong secret: 403', r.status === 403 && vitreCalls(w) === 0, r);
  r = await go(cron('cron-secret'));
  check('right secret, no Origin, no user: runs (200)', r.status === 200 && r.json.added === 1, r);
  w = world({ email: 'manager@tfugen.local', pages: [[task(1, '2026-09-29')]] });
  r = await go(user('POST', 'op=sync'));
  check('a manager signed in: 403, nothing inserted', r.status === 403 && !w.inserted.length, r);
  w = world({ pages: [[task(1, '2026-09-29')]] });
  r = await go(user('POST', 'op=sync'));
  check('the admin signed in: runs', r.status === 200 && r.json.added === 1, r);
  r = await go(user('GET', 'op=sync'));
  check('GET op=sync is refused (405)', r.status === 405, r);
  const env2 = Object.assign({}, env, { TRUSTEE_NOTIFY_SECRET: '' });
  w = world({ pages: [[task(1, '2026-09-29')]] });
  const r2 = await onRequest({ request: cron(''), env: env2 });
  check('no secret configured: 403 even with an empty header', r2.status === 403 && vitreCalls(w) === 0);
}

console.log('op=sync: what it imports');
{
  const w = world({ pages: [[task(10, '2026-08-01'), task(11, '2026-08-08')], [task(12, '2026-09-06'), task(13, '2026-09-27')], [task(14, '2026-09-29')]], have: ['10', '12'] });
  const r = await go(cron('cron-secret'));
  check('walks all three pages', r.json.pages === 3, r.json);
  check('found = every refresher in Vitre (5)', r.json.found === 5, r.json);
  check('inserts only the three we do not have', w.inserted.map(x => x.ext_id).join() === '11,13,14', w.inserted.map(x => x.ext_id));
  check('newest = the newest refresher date in Vitre', r.json.newest === '2026-09-29', r.json);
  const row = w.inserted[0];
  check('row shape = the manual import (_vitreTrRow)', row && row.topic === TOPIC && row.s === 'נמסרה' && row.presenter === 'Manager 11' && row.dep === 'טוגנים' && row.file_url === null && row.attendees === null && /^\d{4}-\d{2}-\d{2}$/.test(row.d) && row.notes.includes('#11') && !row.notes.includes('אין קובץ'), row);
  check('one insert call for all rows', w.calls.filter(c => c.u.startsWith(SB + '/rest/v1/toolbox') && c.method === 'POST').length === 1);
  const st = JSON.parse(w.state.vitre_sync);
  check('result saved to server_state', st.ok === true && st.added === 3 && st.error === null, st);
  check('the lock is released after the run', w.state.vitre_sync_lock === '', w.state.vitre_sync_lock);
  const s = await go(user('GET', 'op=sync_status'));
  check('op=sync_status returns it', s.status === 200 && s.json.last && s.json.last.added === 3, s.json);
}
{
  const w = world({ pages: [[task(10, '2026-08-01')]], have: ['10'] });
  const r = await go(cron('cron-secret'));
  check('nothing new: no insert, ok, added 0', r.json.ok && r.json.added === 0 && !w.calls.some(c => c.u.startsWith(SB + '/rest/v1/toolbox') && c.method === 'POST'), r.json);
}
{
  const many = []; for (let i = 1; i <= 14; i++) many.push(task(100 + i, '2026-09-01'));
  const w = world({ pages: [many] });
  const r = await go(cron('cron-secret'));
  check('at most 10 a run, 4 pending', r.json.added === 10 && r.json.pending === 4 && w.inserted.length === 10, r.json);
  check('the oldest first', w.inserted[0].ext_id === '101' && w.inserted[9].ext_id === '110');
  const sub = w.calls.length;
  check('stays under 50 subrequests (' + sub + ')', sub < 50, sub);
}

console.log('op=sync: failures');
{
  const w = world({ pages: [[task(1, '2026-09-29')], [task(2, '2026-09-30')]], failPage: 2 });
  const r = await go(cron('cron-secret'));
  check('a page fails: nothing inserted', !w.inserted.length, w.inserted);
  check('the error is in the answer and in server_state', !r.json.ok && /503/.test(r.json.error) && /503/.test(JSON.parse(w.state.vitre_sync).error), r.json);
}
{
  const w = world({ pages: [[task(1, '2026-09-29'), task(2, '2026-09-30')]], failDetail: [1] });
  const r = await go(cron('cron-secret'));
  check('one task unreadable: the other still goes in, the failure is reported', w.inserted.length === 1 && w.inserted[0].ext_id === '2' && r.json.failed === 1 && !r.json.ok && r.json.error, r.json);
}
{
  const w = world({ pages: [[task(1, '2026-09-29')]], insertStatus: 400 });
  const r = await go(cron('cron-secret'));
  check('the insert fails: reported, not ok', !r.json.ok && /toolbox insert 400/.test(r.json.error) && r.json.added === 0, r.json);
}
{
  const w = world({ pages: [[task(1, '2026-09-29')]], state: { vitre_sync_lock: new Date().toISOString() } });
  const r = await go(cron('cron-secret'));
  check('another run holds the lock: busy, Vitre untouched', r.json.busy === true && vitreCalls(w) === 0 && !w.inserted.length, r.json);
}

console.log('home-screen line (_vitreSyncLine from index.html)');
{
  const html = fs.readFileSync(new URL('../../index.html', import.meta.url), 'utf8');
  check('the browser no longer imports on its own (_vitreAutoSync gone)', !/window\._vitreAutoSync\s*=/.test(html) && !/setTimeout\(_vitreAutoSync/.test(html));
  check('rDash calls the line', /_vitreSyncHomeRender\(\)/.test(html.slice(html.indexOf('function rDash(){'), html.indexOf('function rDash(){') + 1500)));
  check('the line has its slot on the home screen', html.includes('id="dash-vitre-sync"'));
  const from = html.indexOf('function _vitreSyncLine'), to = html.indexOf('window._vitreSyncHomeRender');
  const fd = s => { const m = String(s).match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? m[3] + '/' + m[2] + '/' + m[1] : s; };
  const line = new Function('esc', 'fd', '_truTimeHtml', html.slice(from, to) + '\nreturn _vitreSyncLine;')(s => String(s), fd, iso => fd(iso));
  const now = new Date().toISOString();
  let t = line({ at: now, ok: true, added: 2, pending: 0, newest: '2026-09-29', error: null });
  check('ok run: count and the newest date in DD/MM/YYYY, not red', t.includes('2 ') && t.includes('29/09/2026') && !t.includes('#b91c1c'), t);
  t = line({ at: now, ok: true, added: 0, newest: '2026-09-06', error: null });
  check('quiet day: says nothing new and still shows the last date in Vitre', t.includes('06/09/2026') && !t.includes('#b91c1c'), t);
  t = line({ at: now, ok: false, added: 0, error: 'vitre 503 on page 2' });
  check('failed run: red with the reason', t.includes('#b91c1c') && t.includes('503'), t);
  t = line({ at: new Date(Date.now() - 30 * 3600 * 1000).toISOString(), ok: true, added: 0, error: null });
  check('no run for more than a day: red', t.includes('#b91c1c'), t);
  t = line(null);
  check('never ran: says so', t.includes('06:00'), t);
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
