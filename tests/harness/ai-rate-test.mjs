// AI rate limit per user (BACKLOG 13.11, 13/10/2026): every call to /api/claude counts first in the
// guessing-lock counter (guess_hit) under a hashed user key; over AI_RATE_LIMIT in an hour = 429 and
// the model is not called; another user is not affected; a database that cannot count does not stop
// the AI; and the codes screen does not show the AI counter as a locked address.
import { onRequest, AI_RATE_LIMIT, aiRateKey } from './_build/claude.mjs';
import { lockedCount } from './_build/codes.mjs';
import fs from 'fs';
let pass = 0, fail = 0;
const check = (l, c, d) => { if (c) { pass++; console.log('  ✓ ' + l); } else { fail++; console.log('  ✗ ' + l + (d !== undefined ? '  -> ' + JSON.stringify(d).slice(0, 300) : '')); } };
const SB = 'https://znhjtpcltrxxyfjczgvw.supabase.co';
const ORIGIN = 'https://tapugan-safety.pages.dev';
const w = { counts: {}, rpcDown: false, rpcCalls: 0 };
const USERS = { 'a.jwt': { id: 'uid-a', email: 'admin@tfugen.local' }, 'b.jwt': { id: 'uid-b', email: 'mgr@tfugen.local' } };
globalThis.fetch = async (url, init) => {
  const u = String(url);
  const j = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json' } });
  if (u.startsWith(SB + '/auth/v1/user')) {
    const tok = String(init.headers.Authorization || init.headers.authorization || '').replace('Bearer ', '');
    return USERS[tok] ? j({ ...USERS[tok], is_anonymous: false }) : j({}, 401);
  }
  if (u.startsWith(SB + '/rest/v1/app_users')) return j([{ role: '\u05de\u05e0\u05d4\u05dc', active: true }]);
  if (u === SB + '/rest/v1/rpc/guess_hit') {
    w.rpcCalls++;
    if (w.rpcDown) return new Response('x', { status: 500 });
    const k = JSON.parse(init.body).p_key; w.lastKey = k; w.counts[k] = (w.counts[k] || 0) + 1; return j(w.counts[k]);
  }
  throw new Error('unexpected fetch ' + u);
};
let runs = 0;
const ENV = { SUPABASE_SERVICE_ROLE_KEY: 'svc', AI: { run: async () => { runs++; return { response: 'ok' }; } } };
const call = (tok, env) => onRequest({ request: new Request(ORIGIN + '/api/claude', { method: 'POST', headers: { 'Content-Type': 'application/json', origin: ORIGIN, Authorization: 'Bearer ' + tok }, body: JSON.stringify({ model: '@cf/meta/llama-3.1-8b-instruct-fast', max_tokens: 10, messages: [{ role: 'user', content: 'hi' }] }) }), env: env || ENV });

console.log('\n1. the key');
{
  check('the limit is 200 an hour', AI_RATE_LIMIT === 200, AI_RATE_LIMIT);
  const k = await aiRateKey('uid-a');
  check('the key is a hash of the user id, scope ai', /^guess:ai:[0-9a-f]{16}$/.test(k) && !k.includes('uid-a'), k);
  const sql = fs.readFileSync(new URL('../../migrations/2026-10-10_guess_lock.sql', import.meta.url), 'utf8');
  const re = /p_key !~ '([^']+)'/.exec(sql);
  check('guess_hit in the migration accepts the key', !!re && new RegExp(re[1]).test(k), re && re[1]);
  check('one user, one key; two users, two keys', k === await aiRateKey('uid-a') && k !== await aiRateKey('uid-b'));
}

console.log('\n2. over the limit');
{
  let st = [];
  for (let i = 0; i < AI_RATE_LIMIT; i++) st.push((await call('a.jwt')).status);
  check('the first 200 calls answer', st.every((s) => s === 200) && runs === AI_RATE_LIMIT, [st.filter((s) => s !== 200).length, runs]);
  check('every call counted under the user key', w.lastKey === await aiRateKey('uid-a') && w.counts[w.lastKey] === AI_RATE_LIMIT);
  const r = await call('a.jwt');
  const b = await r.json();
  check('the 201st: 429 with Retry-After', r.status === 429 && r.headers.get('Retry-After') === '3600' && b.error === 'rate limited', [r.status, b]);
  check('and the model was not called', runs === AI_RATE_LIMIT, runs);
  check('the CORS header is on the refusal', r.headers.get('Access-Control-Allow-Origin') === ORIGIN, r.headers.get('Access-Control-Allow-Origin'));
  const r2 = await call('b.jwt');
  check('another user still answers', r2.status === 200, r2.status);
}

console.log('\n3. the counter fails open');
{
  w.rpcDown = true;
  const r = await call('a.jwt');
  check('database down: the over-limit user answers, not 429', r.status === 200, r.status);
  w.rpcDown = false;
}

console.log('\n4. the codes screen');
{
  const rows = [{ key: 'guess:ai:0123456789abcdef', value: '150' }, { key: 'guess:ind:0123456789abcdef', value: '11' }, { key: 'guess:tru:0123456789abcdef', value: '3' }];
  check('the AI counter is not a locked address', lockedCount(rows) === 1, lockedCount(rows));
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
if (fail) process.exit(1);
