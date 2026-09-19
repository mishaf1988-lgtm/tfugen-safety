// Outbox drain race: ops pushed while a drain is in flight must survive the
// drain finishing (they used to be overwritten by the pre-drain snapshot).
// Runs the REAL _obGet/_obSet/_obPush/_obDrain source from index.html with
// _obSend stubbed as a controllable promise.
const fs = require('fs');
const html = fs.readFileSync(require('path').resolve(__dirname, '../../index.html'), 'utf8');
function slice(a, b) { const s = html.indexOf(a); const e = html.indexOf(b, s); if (s < 0 || e < 0) throw new Error('marker: ' + a); return html.substring(s, e); }
const src = slice('var OB_KEY=', 'function _obBadge(') + '\n' + slice('function _obDrain(){', 'function _audTitle(');
let pass = 0, fail = 0;
const check = (l, c, d) => { if (c) { pass++; console.log('  ✓ ' + l); } else { fail++; console.log('  ✗ ' + l + (d !== undefined ? '  -> ' + JSON.stringify(d) : '')); } };

function sandbox() {
  const store = {};
  const localStorage = { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } };
  const pending = [];                                  // controllable sends
  const env = { localStorage, SB_ON: true, _obSanitize() {}, _obBadge() {}, _obSend: (op) => new Promise((res, rej) => { pending.push({ op, res, rej }); }) };
  const f = new Function('localStorage', 'SB_ON', '_obSanitize', '_obBadge', '_obSend', src + '\nreturn {push:_obPush,drain:_obDrain,get:_obGet};');
  const api = f(env.localStorage, env.SB_ON, env._obSanitize, env._obBadge, env._obSend);
  return { api, pending };
}
const tick = () => new Promise(r => setTimeout(r, 5));

(async () => {
  console.log('\n1. first send succeeds while a second op is pushed mid-flight');
  {
    const { api, pending } = sandbox();
    api.push({ op: 'ins', tbl: 'trustee_reports', row: { id: 'A', t: 1 } });
    const d = api.drain(); await tick();
    check('drain took A in flight', pending.length === 1 && pending[0].op.row.id === 'A');
    api.push({ op: 'ins', tbl: 'trustee_reports', row: { id: 'B', t: 3 } });
    api.push({ op: 'ins', tbl: 'trustee_reports', row: { id: 'C', t: 3 } });
    check('B and C queued while A is in flight (3 in storage)', api.get().length === 3);
    pending[0].res(); await d; await tick();
    const ids = api.get().map(o => o.row.id);
    check('after A lands: B and C are still queued (used to be wiped), A gone', ids.join() === 'B,C', ids);
    check('the drain re-armed itself for the survivors', pending.length >= 2 && pending[1].op.row.id === 'B', pending.map(p => p.op.row.id));
  }
  console.log('\n2. first send fails (offline) while more ops arrive');
  {
    const { api, pending } = sandbox();
    api.push({ op: 'ins', tbl: 'trustee_reports', row: { id: 'A', t: 1 } });
    const d = api.drain(); await tick();
    api.push({ op: 'ins', tbl: 'trustee_reports', row: { id: 'B', t: 3 } });
    pending[0].rej({ status: 0, body: 'net' }); await d; await tick();
    const q = api.get();
    check('A kept with tries=1 and its error, B kept too, order preserved', q.map(o => o.row.id).join() === 'A,B' && q[0].tries === 1 && /net/.test(q[0].lastError) && !q[1].tries, q.map(o => ({ id: o.row.id, tries: o.tries })));
    check('no automatic re-drain after a failure (the 30s timer / focus will)', pending.length === 1, pending.length);
  }
  console.log('\n3. nothing in flight: plain success empties the queue');
  {
    const { api, pending } = sandbox();
    api.push({ op: 'del', tbl: 'ncr', id: 'X' }); api.push({ op: 'upd', tbl: 'ncr', row: { id: 'Y' } });
    const d = api.drain();
    // sends are sequential — resolve whatever is in flight until the drain settles
    for (let i = 0; i < 6; i++) { await tick(); pending.forEach(p => { if (!p.done) { p.done = true; p.res(); } }); }
    await d; await tick();
    check('queue empty after both land', api.get().length === 0, api.get());
  }
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('HARNESS ERROR', e); process.exit(2); });
