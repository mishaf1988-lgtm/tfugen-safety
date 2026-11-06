// retro 19/10/2026 (b), 06/11/2026: wa-hook kept the ids of handled messages in one server_state row, read and written
// back whole. Two webhooks at once dropped each other's id, and Meta's retry of the dropped one ran the assistant twice.
// firstTime and forget now write through stateCas; here the pure parts and two writers on one row at the same moment.
import { seenAdd, seenDrop } from './_build/wa-hook.mjs';
import { stateCas } from './_build/_cas.mjs';
import fs from 'fs';

let pass = 0, fail = 0;
const check = (l, c, d) => { if (c) { pass++; console.log('  ✓ ' + l); } else { fail++; console.log('  ✗ ' + l + (d !== undefined ? '  -> ' + JSON.stringify(d).slice(0, 300) : '')); } };

check('seenAdd: a new id is added at the end', JSON.stringify(seenAdd(['a'], 'b')) === JSON.stringify({ value: ['a', 'b'] }));
check('seenAdd: an id already there is seen, nothing to write', seenAdd(['a', 'b'], 'a').seen === true && !('value' in seenAdd(['a'], 'a')));
check('seenAdd: no row or a broken value starts a new list', JSON.stringify(seenAdd(undefined, 'x').value) === '["x"]' && JSON.stringify(seenAdd('oops', 'x').value) === '["x"]');
check('seenAdd: keeps the newest 100', (() => { const big = Array.from({ length: 100 }, (_, i) => 'm' + i); const v = seenAdd(big, 'new').value; return v.length === 100 && v[0] === 'm1' && v[99] === 'new'; })());
check('seenDrop: removes only that id; an id not there writes nothing', JSON.stringify(seenDrop(['a', 'b'], 'a').value) === '["b"]' && seenDrop(['a'], 'z').write === false);

// two webhooks read the same version, then both write: with stateCas the second write sees a changed version and redoes
const SB = 'https://sb.test';
let row = { value: ['old'], updated_at: '2026-11-06T10:00:00.000Z' };
let hold = null;
globalThis.fetch = async (u, o = {}) => {
  const url = String(u);
  if ((o.method || 'GET') === 'GET') {
    const snap = { value: row.value.slice(), updated_at: row.updated_at };
    if (hold) { const h = hold; hold = null; await h; }
    return new Response(JSON.stringify([snap]), { status: 200 });
  }
  if (o.method === 'PATCH') {
    const v = decodeURIComponent(/updated_at=eq\.([^&]*)/.exec(url)[1]);
    if (v !== row.updated_at) return new Response('[]', { status: 200 });
    const b = JSON.parse(o.body); row = { value: b.value, updated_at: b.updated_at };
    return new Response(JSON.stringify([row]), { status: 200 });
  }
  return new Response('[]', { status: 200 });
};
const add = (id) => stateCas(SB, {}, 'wa_hook_seen', (raw) => { const a = seenAdd(raw, id); return a.seen ? { write: false } : a; });
{
  let release; hold = new Promise((r) => { release = r; });
  const p1 = add('w1');                  // reads, then waits before it writes
  await new Promise((r) => setTimeout(r, 5));
  const p2 = add('w2');                  // reads the same version and writes first
  await p2; release(); await p1;
  check('two messages at once: both ids are kept (the old read-and-write lost one)', row.value.indexOf('w1') >= 0 && row.value.indexOf('w2') >= 0 && row.value.indexOf('old') >= 0, row.value);
}

const src = fs.readFileSync(new URL('../../functions/api/wa-hook.js', import.meta.url), 'utf8');
const ft = src.slice(src.indexOf('async function firstTime'), src.indexOf('async function aboutAlert'));
check('firstTime and forget write through stateCas, never a whole-list POST', (ft.match(/stateCas\(/g) || []).length === 2 && !/merge-duplicates/.test(ft));

console.log('\nwa-seen-test: ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
