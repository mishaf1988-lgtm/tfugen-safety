// Unit test of the REAL Vitre -> toolbox auto sync (index.html, STATUS #601
// «סנכרון שוטף») with fetch, DB, localStorage and the app helpers mocked.
// Proves: runs only for an admin after the server pull, at most once a day,
// imports only refreshers whose Vitre id is not yet in toolbox.ext_id, writes
// the same row shape as the manual import, stays quiet when nothing is new,
// does not mark the day when Vitre fails, and never runs beside the manual preview.
import fs from 'node:fs';
let pass = 0, fail = 0;
const check = (l, c, d) => { if (c) { pass++; console.log('  ✓ ' + l); } else { fail++; console.log('  ✗ ' + l + (d !== undefined ? '  -> ' + JSON.stringify(d) : '')); } };

const html = fs.readFileSync(new URL('../../index.html', import.meta.url), 'utf8');
const from = html.indexOf('var _vitreTr=null;');
const to = html.indexOf('// Open the photo of an imported refresher');
if (from < 0 || to < 0) { console.log('HARNESS ERROR: vitre block not found'); process.exit(1); }
const src = html.slice(from, to);

function world(o) {
  const w = {
    calls: [], inserted: [], toasts: [], logs: [], store: {}, session: {},
    pages: o.pages || [[]], failTrainings: !!o.failTrainings, trainingDetail: o.trainingDetail || {},
    admin: o.admin !== false, sbOn: o.sbOn !== false, toolbox: (o.toolbox || []).slice(), preview: !!o.preview,
    colsOk: o.colsOk !== false
  };
  const g = {};
  g.window = g;
  g.console = { warn() {}, info() {}, log() {}, error() {} };
  g.navigator = { onLine: o.online !== false };
  g.localStorage = { getItem: k => (k in w.store ? w.store[k] : null), setItem: (k, v) => { w.store[k] = String(v); }, removeItem: k => { delete w.store[k]; } };
  g.sessionStorage = { getItem: k => (k in w.session ? w.session[k] : null), setItem: (k, v) => { w.session[k] = String(v); } };
  g.document = { createElement: () => ({ style: {}, dataset: {}, classList: { add() {}, contains() { return false; } }, setAttribute() {} }), body: { appendChild() {} } };
  const box = { textContent: '', dataset: {} };
  g.g = id => (id === 'dash-vitre-result' ? box : null);
  w.box = box;
  g.DB = { toolbox: w.toolbox, hist: [] };
  g.SB_ON = w.sbOn; g.SBU = 'https://x.supabase.co'; g.SBK = 'k'; g._sbToken = 't'; g.CUR = 'dash';
  g._sbAuth = () => Promise.resolve();
  g._isAdminUser = () => w.admin;
  g.gid = (() => { let n = 0; return () => 'id' + (++n); })();
  g.sbIns = (tbl, row) => { w.inserted.push({ tbl, row }); };
  g.sbUpd = () => {};
  g.sdb = () => {};
  g.addLog = m => { w.logs.push(m); };
  g.toast = (m, opts) => { w.toasts.push(m); };
  g.rDash = () => {};
  g.rToolbox = () => {};
  g.openModal = () => {}; g.closeModal = () => {}; g.esc = s => s; g.fd = s => s;
  g._scanSeen = k => { try { if (g.localStorage.getItem(k)) return true; } catch (e) {} return !!g.sessionStorage.getItem(k); };
  g._scanMark = k => { g.localStorage.setItem(k, '1'); };
  g.fetch = async (url) => {
    const u = String(url); w.calls.push(u);
    const json = (obj, status = 200) => ({ ok: status < 400, status, json: async () => obj });
    if (u.startsWith(g.SBU + '/rest/v1/toolbox')) return json(w.colsOk ? [] : { message: 'column toolbox.dep does not exist' }, w.colsOk ? 200 : 400);
    if (u.includes('op=trainings&page=')) {
      if (w.failTrainings) return json({ error: 'upstream 503' }, 502);
      const p = parseInt(u.split('page=')[1], 10);
      const rows = w.pages[p - 1] || [];
      return json({ page: p, hasMore: p < w.pages.length, rows });
    }
    if (u.includes('op=training&id=')) {
      const id = u.split('id=')[1];
      const d = w.trainingDetail[id];
      if (d === 'fail') return json({ error: 'boom' }, 500);
      return json(Object.assign({ id: +id, createDate: '2026-09-2' + (id % 9) + 'T08:00:00', presenter: 'P' + id, depts: ['טוגנים'], files: 1 }, d || {}));
    }
    return json({ error: 'unexpected ' + u }, 404);
  };
  // run the real block; window.* assignments land on g because g.window === g
  const fn = new Function('with(this){' + src + '\nif(__preview)_vitreTr={items:[]};\nreturn {run:function(){return _vitreAutoSync();},preview:function(){return _vitreTrPreview();},row:_vitreTrRow};}');
  g.__preview = w.preview;
  w.api = fn.call(g);
  w.g = g;
  return w;
}
const tick = () => new Promise(r => setTimeout(r, 30));
const T = (id, createDate) => ({ id, title: 'ריענון', createDate: createDate || '2026-09-20T08:00:00', closeDate: '2026-09-20T09:00:00' });
const today = new Date().toISOString().substring(0, 10);

console.log('imports only refreshers not yet in toolbox.ext_id, toast + log once');
{
  const w = world({ pages: [[T(1), T(2), T(3)], [T(4), T(5)]], toolbox: [{ id: 'a', ext_id: '2' }, { id: 'b', ext_id: '4' }] });
  w.api.run(); await tick(); await tick();
  const ids = w.inserted.map(x => x.row.ext_id).sort();
  check('3 new rows inserted (1, 3, 5)', JSON.stringify(ids) === '["1","3","5"]', ids);
  check('all inserts go to toolbox', w.inserted.every(x => x.tbl === 'toolbox'));
  check('both pages were scanned', w.calls.filter(u => u.includes('op=trainings')).length === 2);
  check('detail pulled only for the new ones', w.calls.filter(u => u.includes('op=training&id=')).length === 3);
  const r = w.inserted[0].row;
  check('row shape matches the manual import', r.topic.includes('Vitre') && r.s === 'נמסרה' && r.file_url === null && r.attendees === null && r.dep === 'טוגנים' && r.presenter === 'P1' && /^\d{4}-\d{2}-\d{2}$/.test(r.d), r);
  check('DB.toolbox grew by 3', w.g.DB.toolbox.length === 5);
  check('one toast: 3 new', w.toasts.length === 1 && w.toasts[0].includes('3'), w.toasts);
  check('one log line', w.logs.length === 1 && w.logs[0].includes('3'), w.logs);
  check('day flag set in localStorage', w.store['tfgn_vitre_sync_' + today] === '1', w.store);
  check('card line shows the result', w.box.textContent.includes('3'), w.box.textContent);
  // second call in the same page load: nothing happens
  const before = w.calls.length;
  w.api.run(); await tick();
  check('second call in the same session is a no-op', w.calls.length === before);
}

console.log('quiet day: nothing new -> no toast, no log, day still marked');
{
  const w = world({ pages: [[T(1), T(2)]], toolbox: [{ id: 'a', ext_id: '1' }, { id: 'b', ext_id: '2' }] });
  w.api.run(); await tick(); await tick();
  check('no inserts', w.inserted.length === 0);
  check('no toast', w.toasts.length === 0, w.toasts);
  check('no log', w.logs.length === 0);
  check('day marked anyway', w.store['tfgn_vitre_sync_' + today] === '1');
}

console.log('once a day: flag from earlier today blocks a fresh page load');
{
  const w = world({ pages: [[T(1)]] });
  w.store['tfgn_vitre_sync_' + today] = '1';
  w.api.run(); await tick();
  check('no network call at all', w.calls.length === 0, w.calls);
}

console.log('guards: non-admin, before the server pull, offline, manual preview open');
{
  let w = world({ pages: [[T(1)]], admin: false }); w.api.run(); await tick();
  check('non-admin: nothing', w.calls.length === 0 && w.inserted.length === 0);
  w = world({ pages: [[T(1)]], sbOn: false }); w.api.run(); await tick();
  check('SB_ON false (toolbox not pulled yet): nothing, so "new" never means "everything"', w.calls.length === 0);
  w = world({ pages: [[T(1)]], online: false }); w.api.run(); await tick();
  check('offline: nothing', w.calls.length === 0);
  w = world({ pages: [[T(1)]], preview: true }); w.api.run(); await tick();
  check('manual preview open: nothing', w.calls.length === 0);
}

console.log('Vitre down: no day flag, so tomorrow (or the next page load) retries; nothing written');
{
  const w = world({ pages: [[T(1)]], failTrainings: true });
  w.api.run(); await tick(); await tick();
  check('no inserts', w.inserted.length === 0);
  check('day NOT marked', !w.store['tfgn_vitre_sync_' + today], w.store);
  check('no toast (silent failure, card line only)', w.toasts.length === 0);
  check('card line says it failed', w.box.textContent.includes('Vitre'), w.box.textContent);
}

console.log('missing columns: refuses before touching Vitre');
{
  const w = world({ pages: [[T(1)]], colsOk: false });
  w.api.run(); await tick(); await tick();
  check('no trainings call', !w.calls.some(u => u.includes('op=trainings')));
  check('no inserts, day not marked', w.inserted.length === 0 && !w.store['tfgn_vitre_sync_' + today]);
}

console.log('one detail fails: the others still land, the failure is counted, day marked');
{
  const w = world({ pages: [[T(1), T(2), T(3)]], trainingDetail: { '2': 'fail' } });
  w.api.run(); await tick(); await tick();
  const ids = w.inserted.map(x => x.row.ext_id).sort();
  check('1 and 3 inserted', JSON.stringify(ids) === '["1","3"]', ids);
  check('toast counts 2 new', w.toasts.length === 1 && w.toasts[0].includes('2'), w.toasts);
  check('log mentions the failure', w.logs[0].includes('1'), w.logs);
  check('day marked', w.store['tfgn_vitre_sync_' + today] === '1');
}

console.log('duplicate ids across pages are imported once');
{
  const w = world({ pages: [[T(7), T(8)], [T(8), T(9)]] });
  w.api.run(); await tick(); await tick();
  const ids = w.inserted.map(x => x.row.ext_id).sort();
  check('7, 8, 9 once each', JSON.stringify(ids) === '["7","8","9"]', ids);
}

console.log('manual preview refuses while the auto sync is running');
{
  const w = world({ pages: [[T(1)]] });
  w.api.run();                       // busy now (cols check pending)
  w.api.preview(); await tick(); await tick();
  check('preview toasted "running" instead of scanning', w.toasts.some(t => t.includes('Vitre')) && !w.calls.some(u => u.includes('op=trainings') && w.calls.indexOf(u) !== w.calls.lastIndexOf(u)), w.toasts);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
