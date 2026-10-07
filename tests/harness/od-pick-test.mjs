// od-pick (07/10/2026, Michael: "all the files in one place, not uploaded twice"):
// pick a file that is already in the safety folder. Manager only, read only, never
// outside "שולחן העבודה/ניהול בטיחות". Graph and Supabase auth mocked.
import { onRequest, insideRoot, ROOT_REF, ID_RE } from './_build/od-pick.mjs';

let pass = 0, fail = 0;
const check = (l, c, d) => { if (c) { pass++; console.log('  ✓ ' + l); } else { fail++; console.log('  ✗ ' + l + (d !== undefined ? '  -> ' + JSON.stringify(d).slice(0, 400) : '')); } };
const SB = 'https://znhjtpcltrxxyfjczgvw.supabase.co';
const ENV = { SUPABASE_SERVICE_ROLE_KEY: 'srv', ONEDRIVE_CLIENT_ID: 'cid', ONEDRIVE_CLIENT_SECRET: 'cs' };
const R = '/drive/root:/שולחן העבודה/ניהול בטיחות';

(async () => {
  const calls = [];
  globalThis.fetch = async (url, init) => {
    const u = String(url), d = decodeURIComponent(u), m = (init && init.method) || 'GET';
    const json = (x, st = 200) => new Response(JSON.stringify(x), { status: st, headers: { 'Content-Type': 'application/json' } });
    if (u.startsWith(SB + '/auth/v1/user')) {
      const t = ((init && init.headers && init.headers.Authorization) || '').replace('Bearer ', '');
      if (t === 'mgr') return json({ id: 'u1', email: 'avi@tfugen.local' });
      if (t === 'rep') return json({ id: 'u2', email: 'dov@tfugen.local' });
      if (t === 'anon') return json({ id: 'u3', is_anonymous: true });
      return json({ error: 'bad' }, 401);
    }
    if (u.startsWith(SB + '/rest/v1/app_users')) return json([{ role: u.includes('id=eq.avi') ? 'מנהל' : 'מדווח', active: true }]);
    if (u.startsWith(SB + '/rest/v1/oauth_tokens')) return json([{ user_email: 'sviva@tapugan.co.il', refresh_token: 'rt', access_token: 'at', expires_at: new Date(Date.now() + 3600e3).toISOString(), scope: 'Files.ReadWrite' }]);
    if (u.startsWith('https://graph.microsoft.com/')) {
      calls.push({ m, d });
      if (d.includes(':/children')) return json({ value: [
        { id: 'F2', name: 'ב תעודות.pdf', size: 10, file: {}, lastModifiedDateTime: 'x' },
        { id: 'D1', name: '12_תאונות', folder: { childCount: 4 } },
        { id: 'F1', name: 'א נוהל.docx', size: 5, file: {} }] });
      // As the organisation's OneDrive answers (Chrome check 07/10/2026): no parentReference.path on a search hit, only the parent's id.
      if (d.includes(":/search(q='WIDE")) return json({ error: 'nope' }, 400);
      if (d.includes("/search(q='WIDE")) return json({ value: [{ id: 'W1abc', name: 'WIDE.pdf', file: {}, parentReference: { id: 'P1abc' } }] });
      if (d.includes('page=2')) return json({ value: Array.from({ length: 5 }, (_, k) => ({ id: 'M2x' + k + 'abc', name: 'נוהל ' + k + '.doc', file: {}, parentReference: { id: 'P1abc' } })), '@odata.nextLink': 'https://graph.microsoft.com/v1.0/x?page=3' });
      if (d.includes("/search(q='MANY")) return json({ value: Array.from({ length: 150 }, (_, k) => ({ id: 'M1x' + k + 'abc', name: 'נוהל ' + k + '.doc', file: {}, parentReference: { id: 'Q' + (k % 40) + 'abcd' } })), '@odata.nextLink': 'https://graph.microsoft.com/v1.0/me/drive/search?page=2' });
      if (d.includes('/search(q=')) return json({ value: [
        { id: 'S1abc', name: 'SDS אקונומיקה.pdf', file: {}, size: 3, parentReference: { id: 'P1abc' } },
        { id: 'S2abc', name: 'SDS פרטי.pdf', file: {}, parentReference: { id: 'P2abc' } },
        { id: 'S3abc', name: 'SDS תיקייה', folder: {}, parentReference: { id: 'P1abc' } },
        { id: 'S4abc', name: 'SDS זיוף.pdf', file: {}, parentReference: { id: 'P4abc' } },
        { id: 'S6abc', name: 'SDS שורש.pdf', file: {}, parentReference: { id: 'P0abc' } },
        { id: 'S5abc', name: 'SDS נעלם.pdf', file: {} }] });
      if (d.includes('/items/P0abc')) return json({ id: 'P0abc', name: 'ניהול בטיחות', parentReference: { path: '/drive/root:/שולחן העבודה' } });
      if (d.includes('/items/P1abc')) return json({ id: 'P1abc', name: 'SDS', parentReference: { path: encodeURI(R + '/07_חומרים מסוכנים') } });
      if (d.includes('/items/P2abc')) return json({ id: 'P2abc', name: 'אישי', parentReference: { path: '/drive/root:/שולחן העבודה' } });
      if (d.includes('/items/P4abc')) return json({ id: 'P4abc', name: 'ניהול בטיחות-זיוף', parentReference: { path: '/drive/root:/שולחן העבודה' } });
      const qm = d.match(/\/items\/(Q\d+abcd)/);
      if (qm) return json({ id: qm[1], name: 'נהלים ' + qm[1], parentReference: { path: encodeURI(R + '/15_נהלים') } });
      if (d.includes('/items/IN12345')) return json({ id: 'IN12345', name: 'נוהל.docx', webUrl: 'https://tapugan-my.sharepoint.com/x/נוהל.docx', parentReference: { path: encodeURI(R + '/03_נהלים') } });
      if (d.includes('/items/OUT12345')) return json({ id: 'OUT12345', name: 'שכר.xlsx', webUrl: 'https://x/שכר.xlsx', parentReference: { path: '/drive/root:/שולחן העבודה/אישי' } });
      return json({ error: 'nf' }, 404);
    }
    return json({ error: 'unexpected ' + u }, 599);
  };
  const call = async (tok, body, method) => {
    const res = await onRequest({ request: new Request('https://tapugan-safety.pages.dev/api/od-pick', { method: method || 'POST', headers: Object.assign({ 'Content-Type': 'application/json' }, tok ? { Authorization: 'Bearer ' + tok } : {}), body: method === 'GET' ? undefined : JSON.stringify(body || {}) }), env: ENV });
    let j = null; try { j = await res.json(); } catch (e) {}
    return { status: res.status, j };
  };

  console.log('\n1. who may call');
  let r = await call(null, { op: 'list', path: '' });
  check('no session: 401, Graph not touched', r.status === 401 && !calls.length, r);
  r = await call('anon', { op: 'list', path: '' });
  check('anonymous (the trustee kiosk): 403', r.status === 403 && !calls.length, r);
  r = await call('rep', { op: 'list', path: '' });
  check('a reporter: 403', r.status === 403 && !calls.length, r);
  r = await call('mgr', {}, 'GET');
  check('GET: 405', r.status === 405, r);

  console.log('\n2. list');
  r = await call('mgr', { op: 'list', path: '' });
  check('the safety folder itself: folders first, then files by name', r.j.ok && r.j.items.map((x) => x.name).join('|') === '12_תאונות|א נוהל.docx|ב תעודות.pdf' && r.j.items[0].dir && r.j.items[0].n === 4 && r.j.items[1].id === 'F1', r.j);
  check('...read from the safety folder, a GET', calls.length === 1 && calls[0].m === 'GET' && calls[0].d.includes('/me/drive/root:/שולחן העבודה/ניהול בטיחות:/children'), calls);
  r = await call('mgr', { op: 'list', path: '12_תאונות/2026' });
  check('a sub-folder: its path back, relative', r.j.ok && r.j.path === '12_תאונות/2026' && calls[1].d.includes('/ניהול בטיחות/12_תאונות/2026:/children'), [r.j.path, calls[1]]);
  const n0 = calls.length;
  r = await call('mgr', { op: 'list', path: '../אישי' });
  check('a path that climbs out: 400, Graph not touched', r.status === 400 && calls.length === n0, r);

  console.log('\n3. search');
  let c0 = calls.length;
  r = await call('mgr', { op: 'search', q: 'SDS' });
  let sc = calls.slice(c0);
  check('files inside the safety folder only (not outside, not a look-alike folder name, not folders, not a hit with no parent)', r.j.ok && r.j.items.map((x) => x.id).join() === 'S1abc,S6abc' && r.j.more === false, r.j);
  check('...with where each one sits (a file right in the safety folder: empty)', r.j.items[0].where === '07_חומרים מסוכנים/SDS' && r.j.items[1].where === '', r.j.items);
  check('...searched inside the safety folder, once, a GET', sc.filter((c) => c.d.includes('/search(q=')).length === 1 && sc[0].d.includes("/me/drive/root:/שולחן העבודה/ניהול בטיחות:/search(q='SDS')") && r.j.scope === 'folder', sc.map((c) => c.d));
  check('...each parent folder read once, the files themselves not read', ['P0abc', 'P1abc', 'P2abc', 'P4abc'].every((id) => sc.filter((c) => c.d.includes('/items/' + id + '?')).length === 1) && !sc.some((c) => c.d.includes('/items/S')), sc.map((c) => c.d.slice(-50)));
  c0 = calls.length;
  r = await call('mgr', { op: 'search', q: 'MANY' });
  sc = calls.slice(c0);
  check('many hits: at most 100 shown, more:true (the app says "refine")', r.j.ok && r.j.items.length === 100 && r.j.more === true, [r.j.items && r.j.items.length, r.j.more]);
  check('...two pages at most, at most 30 parent reads (Pages: 50 subrequests)', sc.filter((c) => c.d.includes('search')).length === 2 && sc.filter((c) => c.d.includes('/items/')).length === 30, sc.length);
  c0 = calls.length;
  r = await call('mgr', { op: 'search', q: 'WIDE' });
  check('Graph refuses the folder search: the whole drive, still filtered by parent', r.j.ok && r.j.scope === 'drive' && r.j.items.map((x) => x.id).join() === 'W1abc' && r.j.items[0].where === '07_חומרים מסוכנים/SDS', r.j);
  r = await call('mgr', { op: 'search', q: 'a' });
  check('a one-letter query: 400', r.status === 400, r);
  r = await call('mgr', { op: 'search', q: "x') or (q='" });
  check('a quote in the query cannot close the search expression', calls.filter((c) => c.d.includes('/search(q=')).every((c) => !c.d.includes("x')")), calls.filter((c) => c.d.includes('/search(q=')).map((c) => c.d));

  console.log('\n4. url (the link of a picked file)');
  r = await call('mgr', { op: 'url', id: 'IN12345' });
  check('inside the safety folder: its current address and name', r.j.ok && r.j.url === 'https://tapugan-my.sharepoint.com/x/נוהל.docx' && r.j.name === 'נוהל.docx', r.j);
  r = await call('mgr', { op: 'url', id: 'OUT12345' });
  check('a file outside the safety folder, even by id: 403, no address', r.status === 403 && !r.j.url, r);
  const n1 = calls.length;
  r = await call('mgr', { op: 'url', id: '../me' });
  check('a malformed id: 400, Graph not touched', r.status === 400 && calls.length === n1, r);
  r = await call('mgr', { op: 'nope' });
  check('an unknown op: 400', r.status === 400, r);

  console.log('\n5. never writes');
  check('every Graph call is a GET (nothing written, moved or shared)', calls.length > 0 && calls.every((c) => c.m === 'GET'), calls.map((c) => c.m));
  check('insideRoot: the folder, below it, encoded; not a look-alike, not above', insideRoot({ path: ROOT_REF }) && insideRoot({ path: ROOT_REF + '/a' }) && insideRoot({ path: encodeURI(ROOT_REF + '/a') }) && !insideRoot({ path: ROOT_REF + 'x' }) && !insideRoot({ path: '/drive/root:/שולחן העבודה' }) && !insideRoot(null));
  check('ID_RE: OneDrive ids, nothing with / or spaces', ID_RE.test('01OOKSGJLMNU4QMQYVVFCI32K6WDEHIPO4') && !ID_RE.test('a/b..x') && !ID_RE.test('ab'));

  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error("HARNESS ERROR", e); process.exit(2); });
