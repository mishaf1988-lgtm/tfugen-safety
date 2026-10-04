// Files added to the OneDrive safety folder (04/10/2026, /api/od-scan): the
// delta feed of the drive, filtered to files CREATED since the last link and
// inside the safety folder, the path rebuilt from parent ids (delta has no
// path), a run that runs out of budget going on from the same page, a 410
// starting over from now, and the two lines of the weekly mail.
import { onRequest, relPath, keepFiles, scanPages, STATE_KEY, PAGE_MAX, LOOKUP_MAX } from './_build/od-scan.mjs';
import { ROOT } from './_build/od-read.mjs';
import { odScanProblem, odScanFiles, digestHtml, T } from './_build/weekly-digest.mjs';

let pass = 0, fail = 0;
const check = (l, c, d) => { if (c) { pass++; console.log('  ✓ ' + l); } else { fail++; console.log('  ✗ ' + l + (d !== undefined ? '  -> ' + JSON.stringify(d).slice(0, 400) : '')); } };
const G = 'https://graph.microsoft.com/v1.0/me/drive';
const SB = 'https://znhjtpcltrxxyfjczgvw.supabase.co';
const BASE = '/drive/root:/' + ROOT.replace(/\/$/, '');
const DAY = 86400000;
const DL0 = G + '/root/delta?token=A', DL1 = G + '/root/delta?token=B';
const SINCE = '2026-10-01T00:00:00Z';

// A small drive: root > Desktop(dsk) > safety(SAFE) > 01(f01) > sub(fsub); Documents(doc) outside.
const FOLDERS = {
  dsk: { name: 'Desktop-x', parent: 'droot', path: '/drive/root:' },
  SAFE: { name: 'safety', parent: 'dsk' },
  f01: { name: '01 licenses', parent: 'SAFE', path: BASE },
  fsub: { name: 'sub', parent: 'f01', path: BASE + '/01 licenses' },
  doc: { name: 'Documents', parent: 'droot', path: '/drive/root:' },
};
const fileIt = (id, name, parent, c, extra) => Object.assign({ id, name, file: {}, createdDateTime: c, size: 10, parentReference: { id: parent } }, extra || {});
const folderIt = (id) => ({ id, name: FOLDERS[id].name, folder: {}, parentReference: { id: FOLDERS[id].parent } });

function getter(pages, o) {
  const calls = [];
  const get = async (u) => {
    calls.push(u);
    const m = /\/items\/([^?]+)\?/.exec(u);
    if (m) { const f = FOLDERS[decodeURIComponent(m[1])]; return f && f.path ? { status: 200, json: { id: m[1], name: f.name, parentReference: { path: f.path } } } : { status: 404, json: null }; }
    const i = +(/page=(\d+)/.exec(u) || [0, 0])[1];
    if (o && o.gone) return { status: 410, json: null };
    const last = i === pages.length - 1;
    return { status: 200, json: Object.assign({ value: pages[i] }, last ? { '@odata.deltaLink': 'DL-new' } : { '@odata.nextLink': 'P?page=' + (i + 1) }) };
  };
  return { get, calls };
}

(async () => {
  console.log('\n1. the path under the safety folder');
  check('a folder right under it: its name', relPath(BASE, '01') === '01');
  check('deeper: the whole path', relPath(BASE + '/01/a', 'b') === '01/a/b');
  check('percent-encoded path is decoded', relPath(encodeURI(BASE) + '/01', 'b') === '01/b');
  check('outside: null', relPath('/drive/root:/Documents', 'x') === null);
  check('a sibling whose name starts the same: outside', relPath(BASE + 'X', 'x') === null && relPath('/drive/root:/' + ROOT.split('/')[0], ROOT.split('/')[1] + 'X') === null);

  console.log('\n2. one pass over the feed');
  // Page 0 has the folders as parents (delta sends them); page 1 a file whose parent was on page 0.
  const pages = [
    [folderIt('dsk'), folderIt('SAFE'), folderIt('f01'),
      fileIt('a', 'permit.pdf', 'f01', '2026-10-02T08:00:00Z'),
      fileIt('old', 'register.xlsx', 'f01', '2025-01-01T00:00:00Z'),
      fileIt('del', 'gone.pdf', 'f01', '2026-10-02T08:00:00Z', { deleted: {} }),
      fileIt('out', 'cv.docx', 'doc', '2026-10-02T09:00:00Z'),
      fileIt('top', 'letter.pdf', 'SAFE', '2026-10-03T09:00:00Z')],
    [fileIt('b', 'approval.pdf', 'fsub', '2026-10-03T10:00:00Z'), fileIt('a', 'permit.pdf', 'f01', '2026-10-02T08:00:00Z')],
  ];
  let g = getter(pages);
  let r = await scanPages(g.get, 'P?page=0', 'SAFE', SINCE);
  const ps = r.found.map((f) => f.p).sort();
  check('new files inside the folder, with their paths', ps.join('|') === ['01 licenses/permit.pdf', '01 licenses/permit.pdf', '01 licenses/sub/approval.pdf', 'letter.pdf'].join('|'), ps);
  check('a modified old file, a deleted one and one outside the folder: left out', !r.found.some((f) => ['old', 'del', 'out'].includes(f.id)));
  check('the feed read to its end: the new link, nothing pending', r.link === 'DL-new' && r.next === null && r.pages === 2);
  check('unknown parents looked up once each (doc, fsub)', r.lookups === 2 && g.calls.filter((u) => u.includes('/items/')).length === 2, g.calls);

  console.log('\n3. budget');
  const many = Array.from({ length: PAGE_MAX + 3 }, () => []);
  g = getter(many);
  r = await scanPages(g.get, 'P?page=0', 'SAFE', SINCE);
  check('pages beyond PAGE_MAX wait: next = the first page not read', r.next === 'P?page=' + PAGE_MAX && r.link === null && r.pages === PAGE_MAX, r);
  const deep = [Array.from({ length: LOOKUP_MAX + 2 }, (_, i) => fileIt('z' + i, 'n.pdf', 'unknown' + i, '2026-10-02T00:00:00Z'))];
  g = getter(deep);
  r = await scanPages(g.get, 'P?page=0', 'SAFE', SINCE);
  check('lookups beyond LOOKUP_MAX: stop and keep the SAME page for next time', r.next === 'P?page=0' && r.lookups === LOOKUP_MAX && r.link === null, r);
  g = getter([[]], { gone: true });
  r = await scanPages(g.get, 'P?page=0', 'SAFE', SINCE);
  check('410: gone, no link', r.gone === true && r.link === null);

  console.log('\n4. what is kept');
  const now = Date.parse('2026-10-04T00:00:00Z');
  const kept = keepFiles([{ id: 'x', c: '2026-07-01T00:00:00Z', p: 'old' }, { id: 'a', c: '2026-10-01T00:00:00Z', p: 'v1' }], [{ id: 'a', c: '2026-10-01T00:00:00Z', p: 'v2' }, { id: 'b', c: '2026-10-03T00:00:00Z', p: 'b' }], now);
  check('one per id (the newest seen), older than 62 days dropped, newest first', kept.map((f) => f.p).join() === 'b,v2', kept);

  console.log('\n5. the endpoint');
  const ENV = { SUPABASE_SERVICE_ROLE_KEY: 'srv', ONEDRIVE_CLIENT_ID: 'cid', ONEDRIVE_CLIENT_SECRET: 'cs', TRUSTEE_NOTIFY_SECRET: 'nsec' };
  function world(state, feed) {
    const w = { state: Object.assign({}, state), graph: [] };
    globalThis.fetch = async (url, init) => {
      const u = String(url), mth = (init && init.method) || 'GET';
      const json = (x, st = 200) => new Response(JSON.stringify(x), { status: st, headers: { 'Content-Type': 'application/json' } });
      if (u.startsWith(SB + '/rest/v1/oauth_tokens')) return json([{ user_email: 'sviva@tapugan.co.il', refresh_token: 'rt', access_token: 'at', expires_at: new Date(Date.now() + 3600e3).toISOString(), scope: 'offline_access User.Read Files.ReadWrite Mail.Send' }]);
      if (u.startsWith(SB + '/rest/v1/server_state') && mth === 'GET') return json(Object.keys(w.state).map((k) => ({ key: k, value: w.state[k], updated_at: 'x' })));
      if (u.startsWith(SB + '/rest/v1/server_state')) { JSON.parse(init.body).forEach((x) => { w.state[x.key] = x.value; }); return new Response(null, { status: 201 }); }
      if (u.startsWith(G)) {
        w.graph.push(u);
        if (u.includes('/root:/')) return json({ id: 'SAFE' });
        if (u.includes('token=latest')) return json({ value: [], '@odata.deltaLink': DL0 });
        if (feed.gone) return json({}, 410);
        if (u === DL0) return json({ value: [folderIt('f01'), fileIt('a', 'permit.pdf', 'f01', new Date().toISOString())], '@odata.deltaLink': DL1 });
      }
      return json({ error: 'unexpected ' + mth + ' ' + u }, 599);
    };
    return w;
  }
  const req = (h) => new Request('https://x/api/od-scan', { method: 'POST', headers: Object.assign({ 'Content-Type': 'application/json' }, h || {}), body: '{}' });
  let w = world({}, {});
  let res = await onRequest({ request: req(), env: ENV });
  check('no secret: 403, nothing read', res.status === 403 && !w.graph.length);
  res = await onRequest({ request: req({ 'x-notify-secret': 'nsec' }), env: ENV });
  let s = JSON.parse(w.state[STATE_KEY] || '{}');
  check('first run: only the start line (token=latest), no enumeration', s.ok === true && s.link === DL0 && s.root === 'SAFE' && !w.graph.some((u) => u.includes('/root/delta?') && !u.includes('token=latest')), s);
  res = await onRequest({ request: req({ 'x-notify-secret': 'nsec' }), env: ENV });
  s = JSON.parse(w.state[STATE_KEY]);
  check('second run: the new file, the new link', s.ok && s.link === DL1 && s.files.length === 1 && s.files[0].p === '01 licenses/permit.pdf' && s.next === null, s);
  check('the root id is read once, then kept', w.graph.filter((u) => u.includes('/root:/')).length === 1);
  w = world({ [STATE_KEY]: JSON.stringify({ root: 'SAFE', link: DL0, since: SINCE, files: [{ id: 'k', p: 'kept.pdf', c: new Date().toISOString() }] }) }, { gone: true });
  res = await onRequest({ request: req({ 'x-notify-secret': 'nsec' }), env: ENV });
  s = JSON.parse(w.state[STATE_KEY]);
  check('410: a fresh start line, ok false with the reason, the files kept', s.ok === false && /resync/.test(s.error) && s.link === DL0 && s.files.length === 1, s);

  console.log('\n6. the weekly mail');
  const nowMs = Date.now();
  check('never ran: named', /^סריקת/.test(odScanProblem(null, nowMs) || ''));
  check('ran 4 days ago: named', !!odScanProblem(JSON.stringify({ at: new Date(nowMs - 4 * DAY).toISOString(), ok: true }), nowMs));
  check('failed: named with the reason', /boom/.test(odScanProblem(JSON.stringify({ at: new Date(nowMs).toISOString(), ok: false, error: 'boom' }), nowMs) || ''));
  check('ok and fresh: nothing', odScanProblem(JSON.stringify({ at: new Date(nowMs).toISOString(), ok: true }), nowMs) === null);
  const raw = JSON.stringify({ files: [{ id: 'n', p: '01/new.pdf', c: new Date(nowMs - DAY).toISOString() }, { id: 'o', p: '01/old.pdf', c: new Date(nowMs - 9 * DAY).toISOString() }] });
  const nf = odScanFiles(raw, nowMs);
  check('the mail lists the last 7 days only', nf.length === 1 && nf[0].p === '01/new.pdf');
  const d = { open: 0, overdue: [], overdueCount: 0, soon: [], noDue: [], trustee: [], topics: [] };
  const html = digestHtml(d, '2026-10-04', { odNew: nf });
  check('the block in the mail: title, count, the path', html.includes(T.odNew) && html.includes('(1)') && html.includes('01/new.pdf'));
  check('no new files: "none" under the title', digestHtml(d, '2026-10-04', { odNew: [] }).includes(T.odNew + ' (0)'));

  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.log('HARNESS ERROR: ' + (e && e.stack || e)); process.exit(1); });
