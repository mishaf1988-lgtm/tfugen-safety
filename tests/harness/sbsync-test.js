// Runs the REAL sbSync / _obLocalState / _obMarkSent source extracted from
// index.html, with sbGet, the outbox and the DB stubbed per scenario.
const fs = require('fs');
const html = fs.readFileSync(require('path').resolve(__dirname, '../../index.html'), 'utf8');

function slice(startMarker, endMarker) {
  const s = html.indexOf(startMarker);
  const e = html.indexOf(endMarker, s);
  if (s < 0 || e < 0) throw new Error('marker not found: ' + startMarker);
  return html.substring(s, e);
}
const obSrc = slice('var _obSentRecently={};', 'function _obBadge(');
// T2 (2026-09-18): the merge moved into _sbMergePull, defined right above sbSync — slice from there.
// 5.7 (2026-09-20): _sbMergePull now records the version each row arrived
// with, and the helpers that do it sit just above it. Slice from there so
// this suite keeps running the real source rather than a stub of it.
const syncSrc = slice('var _rowVer={};', "window.addEventListener('online'");

let pass = 0, fail = 0;
function check(label, cond, detail) {
  if (cond) { pass++; console.log('  ✓ ' + label); }
  else { fail++; console.log('  ✗ ' + label + (detail ? '  -> ' + detail : '')); }
}

// Build a fresh sandbox per scenario.
function sandbox({ db, outbox, cloud, sentRecently, authRejected }) {
  const calls = { sdb: 0, refresh: 0, drain: 0, badge: [] };
  const env = {
    DB: db,
    SB_ON: false,
    _obGet: () => outbox,
    sbGet: (t) => Promise.resolve(Object.prototype.hasOwnProperty.call(cloud, t) ? cloud[t] : []),
    sdb: () => { calls.sdb++; },
    _sbRefresh: () => { calls.refresh++; },
    _obDrain: () => { calls.drain++; },
    // Since #657 finish() asks whether the reads were REJECTED (401/403) as
    // opposed to unreachable, and paints the pill accordingly \u2014 a dead session
    // used to be indistinguishable from being offline, and both showed \u2713 \u05d1\u05e2\u05e0\u05df.
    _sbAuthRejected: () => !!authRejected,
    _obBadge: (state) => { calls.badge.push(state); },
    Date: Date,
    Object: Object,
    window: {},
  };
  const src = obSrc + '\n' + syncSrc +
    '\nif(__sent){Object.keys(__sent).forEach(function(k){_obSentRecently[k]=__sent[k];});}' +
    '\nreturn {sbSync:sbSync,_obLocalState:_obLocalState,_obMarkSent:_obMarkSent,getSB:function(){return SB_ON;},_obSentRecently:_obSentRecently};';
  const f = new Function('DB', 'SB_ON', '_obGet', 'sbGet', 'sdb', '_sbRefresh', '_obDrain', '_sbAuthRejected', '_obBadge', 'window', '__sent', src);
  const api = f(env.DB, env.SB_ON, env._obGet, env.sbGet, env.sdb, env._sbRefresh, env._obDrain, env._sbAuthRejected, env._obBadge, env.window, sentRecently || null);
  return { api, calls, db };
}
const tick = () => new Promise(r => setTimeout(r, 5));
const ids = (arr) => (arr || []).map(r => r.id);

(async () => {
  // S1 — the P0: stale cache, cloud returns [] for everything.
  console.log('\nS1  stale cache + empty cloud (the reported bug)');
  {
    const db = { equip_inspections: [{ id: 'OLD-1', n: 'x', e: '2026-01-01' }, { id: 'OLD-2', n: 'y', e: '2026-02-01' }], tasks: [{ id: 'T1' }], ncr: [{ id: 'N1' }] };
    const { api, calls } = sandbox({ db, outbox: [], cloud: {} });
    api.sbSync(true); await tick();
    check('equip_inspections wiped to []', db.equip_inspections.length === 0, JSON.stringify(ids(db.equip_inspections)));
    check('tasks wiped to []', db.tasks.length === 0);
    check('ncr wiped to []', db.ncr.length === 0);
    check('finish ran exactly once (sdb=1, refresh=1, drain=1)', calls.sdb === 1 && calls.refresh === 1 && calls.drain === 1, JSON.stringify(calls));
    check('SB_ON set true', api.getSB() === true);
  }

  // S2 — fetch failure must NOT delete local data.
  console.log('\nS2  fetch failed (null) -> keep local (offline safety)');
  {
    const db = { equip_inspections: [{ id: 'OLD-1' }], ncr: [{ id: 'N1' }] };
    const { api, calls } = sandbox({ db, outbox: [], cloud: { equip_inspections: null, ncr: null } });
    api.sbSync(true); await tick();
    check('equip_inspections kept', ids(db.equip_inspections).join() === 'OLD-1');
    check('ncr kept', ids(db.ncr).join() === 'N1');
    check('finish still ran once', calls.sdb === 1, JSON.stringify(calls));
  }

  // S3 — outbox pending INSERT survives an empty pull; other local-only row does not.
  console.log('\nS3  outbox pending ins X + empty cloud -> keep X only');
  {
    const db = { ncr: [{ id: 'X', d: 'offline created' }, { id: 'ZOMBIE', d: 'deleted on server' }] };
    const outbox = [{ op: 'ins', tbl: 'ncr', row: { id: 'X', d: 'offline created' } }];
    const { api } = sandbox({ db, outbox, cloud: { ncr: [] } });
    api.sbSync(true); await tick();
    check('X kept', ids(db.ncr).includes('X'), ids(db.ncr).join());
    check('ZOMBIE dropped', !ids(db.ncr).includes('ZOMBIE'), ids(db.ncr).join());
  }

  // S4 — outbox pending DELETE: cloud still has the row -> it must stay gone locally.
  console.log('\nS4  outbox pending del X, cloud still returns X -> X hidden');
  {
    const db = { ncr: [{ id: 'A' }] };
    const outbox = [{ op: 'del', tbl: 'ncr', id: 'X' }];
    const { api } = sandbox({ db, outbox, cloud: { ncr: [{ id: 'X' }, { id: 'A' }] } });
    api.sbSync(true); await tick();
    check('X not resurrected', !ids(db.ncr).includes('X'), ids(db.ncr).join());
    check('A present', ids(db.ncr).includes('A'));
  }

  // S5 — outbox pending UPDATE: local edit is newer than the cloud copy.
  console.log('\nS5  outbox pending upd X -> local version wins over stale cloud copy');
  {
    const db = { ncr: [{ id: 'X', s: 'סגור' }] };
    const outbox = [{ op: 'upd', tbl: 'ncr', row: { id: 'X', s: 'סגור' } }];
    const { api } = sandbox({ db, outbox, cloud: { ncr: [{ id: 'X', s: 'פתוח' }] } });
    api.sbSync(true); await tick();
    check('local edit kept', db.ncr[0].s === 'סגור', JSON.stringify(db.ncr));
    check('exactly one X', ids(db.ncr).filter(i => i === 'X').length === 1);
  }

  // S6 — race guard: op uploaded moments ago, outbox already empty, pull lacks it.
  console.log('\nS6  recently-sent ins X (outbox empty), cloud lacks X -> X kept; expired TTL -> dropped');
  {
    const db = { ncr: [{ id: 'X' }] };
    const sent = { 'ncr|X': { tbl: 'ncr', id: 'X', op: 'ins', ts: Date.now() } };
    const { api } = sandbox({ db, outbox: [], cloud: { ncr: [] }, sentRecently: sent });
    api.sbSync(true); await tick();
    check('X kept within TTL', ids(db.ncr).includes('X'), ids(db.ncr).join());
  }
  {
    const db = { ncr: [{ id: 'X' }] };
    const sent = { 'ncr|X': { tbl: 'ncr', id: 'X', op: 'ins', ts: Date.now() - 999999 } };
    const { api } = sandbox({ db, outbox: [], cloud: { ncr: [] }, sentRecently: sent });
    api.sbSync(true); await tick();
    check('X dropped after TTL', !ids(db.ncr).includes('X'), ids(db.ncr).join());
    check('expired entry pruned', Object.keys(api._obSentRecently).length === 0);
  }

  // S7 — normal pull: cloud rows replace cache, cloud order kept, stale local-only dropped.
  console.log('\nS7  normal pull with data');
  {
    const db = { ncr: [{ id: 'C2', v: 'old' }, { id: 'GONE' }] };
    const { api } = sandbox({ db, outbox: [], cloud: { ncr: [{ id: 'C1', v: 'new' }, { id: 'C2', v: 'new' }] } });
    api.sbSync(true); await tick();
    check('cloud order kept (C1,C2)', ids(db.ncr).join() === 'C1,C2', ids(db.ncr).join());
    check('cloud version replaces cached', db.ncr[1].v === 'new');
    check('GONE dropped', !ids(db.ncr).includes('GONE'));
  }

  // S8 — table with pending ops is no longer skipped: cloud additions still arrive.
  console.log('\nS8  table has pending outbox op -> pull still happens (was skipped before)');
  {
    const db = { ncr: [{ id: 'X' }] };
    const outbox = [{ op: 'ins', tbl: 'ncr', row: { id: 'X' } }];
    const { api } = sandbox({ db, outbox, cloud: { ncr: [{ id: 'FROM-CLOUD' }] } });
    api.sbSync(true); await tick();
    check('cloud row arrived', ids(db.ncr).includes('FROM-CLOUD'), ids(db.ncr).join());
    check('pending X kept', ids(db.ncr).includes('X'));
  }

  // S9 — _obMarkSent ignores audit_log and records others.
  console.log('\nS9  _obMarkSent bookkeeping');
  {
    const { api } = sandbox({ db: {}, outbox: [], cloud: {} });
    api._obMarkSent({ op: 'ins', tbl: 'audit_log', row: { id: 'L1' } });
    api._obMarkSent({ op: 'del', tbl: 'ncr', id: 'D1' });
    api._obMarkSent({ op: 'upd', tbl: 'tasks', row: { id: 'U1' } });
    const k = Object.keys(api._obSentRecently);
    check('audit_log skipped', !k.includes('audit_log|L1'), k.join());
    check('del + upd recorded', k.includes('ncr|D1') && k.includes('tasks|U1'), k.join());
    const st = api._obLocalState('ncr');
    check('_obLocalState sees recent del', st.D1 === 'del', JSON.stringify(st));
  }

  // S-auth \u2014 the reads were REJECTED, not unreachable.
  console.log('\nSA  a rejected session is not \u00abin the cloud\u00bb');
  {
    const db = { ncr: [{ id: 'N1' }] };
    const { api, calls } = sandbox({ db, outbox: [], cloud: {}, authRejected: true });
    api.sbSync(true); await tick();
    check('the sync still completes rather than hanging', calls.sdb === 1 && calls.refresh === 1, JSON.stringify(calls));
    check('...and the pill is told the session is rejected', calls.badge.indexOf('auth') >= 0, JSON.stringify(calls.badge));
  }
  {
    const db = { ncr: [{ id: 'N1' }] };
    const { api, calls } = sandbox({ db, outbox: [], cloud: {}, authRejected: false });
    api.sbSync(true); await tick();
    check('an ordinary sync says nothing about auth', calls.badge.indexOf('auth') < 0, JSON.stringify(calls.badge));
  }

  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
