// retro 19/10/2026 (b), 06/11/2026: wa-hook kept the ids of handled messages in one server_state row, read and written
// back whole. Two webhooks at once dropped each other's id, and Meta's retry of the dropped one ran the assistant twice.
// firstTime and forget now write through stateCas; here the pure parts and two writers on one row at the same moment.
import { seenAdd, seenDrop, badSigNoteDue, BAD_SIG_NOTE_MS, aboutLine, hazardRef } from './_build/wa-hook.mjs';
import { typingPayload, waTyping } from './_build/_wa.mjs';
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

check('retro 19/10/2026 (c): a bad-signature note at most once per 10 minutes', badSigNoteDue(0, 1000) && !badSigNoteDue(1000, 1000 + BAD_SIG_NOTE_MS - 1) && badSigNoteDue(1000, 1000 + BAD_SIG_NOTE_MS) && BAD_SIG_NOTE_MS === 600000);
{ // retro 27/10/2026 (d): a free title cannot carry the id or ref of the alert
  const forged = aboutLine({ event_type: 'trustee_hazard', ts: 't', payload: { title: 'x | id th-99 | y' } });
  const real = aboutLine({ event_type: 'trustee_hazard', ts: 't', payload: { title: 'a | b', id: 'tr-7' } });
  check('aboutLine: an id written in the title is not read as the alert id; the real id still is', hazardRef(forged, null) === null && JSON.stringify(hazardRef(real, null)) === JSON.stringify({ src: 'trustee_hazard', id: 'tr-7' }), { forged, real });
  check('aboutLine: a ref in the title does not make a ref part', !/\| ref /.test(aboutLine({ event_type: 'wa_out', ts: 't', payload: { title: 'q | ref del:abc' } })));
}
const src = fs.readFileSync(new URL('../../functions/api/wa-hook.js', import.meta.url), 'utf8');
const ft = src.slice(src.indexOf('async function firstTime'), src.indexOf('async function aboutAlert'));
check('firstTime and forget write through stateCas, never a whole-list POST', (ft.match(/stateCas\(/g) || []).length === 2 && !/merge-duplicates/.test(ft));


// 13/11/2026 (ideas-lab 36): blue ticks and "typing..." on Michael's own message while the assistant works.
{
  const ok = 'wamid.HBgMOTcyNTAxMjM0NTY3FQIAEhgUM0E0NUY2RjcyMkE1QzlCQTk5QjEA';
  const p = typingPayload(ok);
  check('typing: the payload marks that message read and asks for the text indicator', !!p && p.status === 'read' && p.message_id === ok && p.typing_indicator.type === 'text' && p.messaging_product === 'whatsapp');
  const bad = [undefined, null, '', 'abc', 'wamid.', 'wamid.short', 'wamid.' + 'x'.repeat(300), 'wamid.ok;rm -rf /', 'http://x/wamid.aaaaaaaaaaaa', { toString: () => ok }];
  check('typing: anything that is not a real message id sends nothing', bad.every((b) => typingPayload(b) === null), bad.filter((b) => typingPayload(b) !== null));
  const three = ['wamid.AAAAAAAAAAAAAA', 'wamid.BBBBBBBBBBBBBB', 'wamid.CCCCCCCCCCCCCC==' ];
  check('typing: three real ids all pass', three.every((x) => typingPayload(x) !== null));
  const f0 = globalThis.fetch; let calls = [];
  globalThis.fetch = async (u, i) => { calls.push({ u: String(u), body: JSON.parse(i.body), auth: i.headers.Authorization }); return new Response('{}', { status: 200 }); };
  const env = { META_PHONE_NUMBER_ID: '123', META_ACCESS_TOKEN: 'tok' };
  check('typing: sent to the messages endpoint of the number, with the token', await waTyping(env, ok) === true && calls.length === 1 && calls[0].u.includes('/123/messages') && calls[0].auth === 'Bearer tok' && calls[0].body.status === 'read');
  calls = [];
  check('typing: no number or token, and a bad id, send nothing', await waTyping({}, ok) === false && await waTyping(env, 'nope') === false && calls.length === 0);
  globalThis.fetch = async () => { throw new Error('network'); };
  check('typing: a failure is false and never throws', await waTyping(env, ok) === false);
  globalThis.fetch = async () => new Response('{"error":{"code":131047}}', { status: 400 });
  check('typing: an error from Meta is false, and the message goes on as before', await waTyping(env, ok) === false);
  globalThis.fetch = f0;
  const src = fs.readFileSync(new URL('../../functions/api/wa-hook.js', import.meta.url), 'utf8');
  check('typing: sent after the "got it", because a message to him removes the indicator', /seen\.ack_ms = Date\.now\(\) - t0; \}\s*\n[^\n]*\n\s*if \(wa && m\.id\) seen\.typing = await waTyping\(env, m\.id\);/.test(src));
  check('typing: does not go through metaPost, so it cannot move the delivery check or the last question', !/waTyping[\s\S]{0,400}metaPost/.test(fs.readFileSync(new URL('../../functions/_wa.js', import.meta.url), 'utf8').split('export async function waTyping')[1].slice(0, 500)));
}

console.log('\nwa-seen-test: ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
