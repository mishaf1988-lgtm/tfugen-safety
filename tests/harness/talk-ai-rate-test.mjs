// Gemini on the weekly-talk link (BACKLOG 13.9, 13/10/2026): "not on the list" with a name not in
// Hebrew letters asks Gemini for every box, from anyone holding a 14-day link. Every such call counts
// first in guess_hit under scope "tlk" per address; over TLK_AI_LIMIT in an hour the name is refused
// (null = the page asks for Hebrew letters) and Gemini is not called; a Hebrew name is never counted;
// a database that cannot count lets the call go; the codes screen does not show "tlk" as a lock;
// and every hebrewName call in talk.js goes through nameHe.
import { nameHe, TLK_AI_LIMIT, guessKey } from './_build/talk.mjs';
import { lockedCount } from './_build/codes.mjs';
import fs from 'fs';
let pass = 0, fail = 0;
const check = (l, c, d) => { if (c) { pass++; console.log('  ✓ ' + l); } else { fail++; console.log('  ✗ ' + l + (d !== undefined ? '  -> ' + JSON.stringify(d).slice(0, 300) : '')); } };
const SB = 'https://znhjtpcltrxxyfjczgvw.supabase.co';
const w = { counts: {}, rpcDown: false, gem: 0, lastKey: null };
globalThis.fetch = async (url, init) => {
  const u = String(url);
  const j = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json' } });
  if (u === SB + '/rest/v1/rpc/guess_hit') {
    if (w.rpcDown) return new Response('x', { status: 500 });
    const k = JSON.parse(init.body).p_key; w.lastKey = k; w.counts[k] = (w.counts[k] || 0) + 1; return j(w.counts[k]);
  }
  if (u.startsWith('https://generativelanguage.googleapis.com/')) { w.gem++; return j({ candidates: [{ content: { parts: [{ text: 'איוון' }] } }] }); }
  throw new Error('unexpected fetch ' + u);
};
const ENV = { SUPABASE_SERVICE_ROLE_KEY: 'svc', GEMINI_API_KEY: 'g' };
const req = (ip) => new Request('https://tapugan-safety.pages.dev/api/talk', { method: 'POST', headers: { 'cf-connecting-ip': ip } });

console.log('\n1. the key');
{
  check('the limit is 300 an hour', TLK_AI_LIMIT === 300, TLK_AI_LIMIT);
  const k = await guessKey('tlk', req('1.2.3.4'));
  check('scope tlk, the address hashed', /^guess:tlk:[0-9a-f]{16}$/.test(k) && !k.includes('1.2.3.4'), k);
  const sql = fs.readFileSync(new URL('../../migrations/2026-10-10_guess_lock.sql', import.meta.url), 'utf8');
  const re = /p_key !~ '([^']+)'/.exec(sql);
  check('guess_hit in the migration accepts the key', !!re && new RegExp(re[1]).test(k), re && re[1]);
}

console.log('\n2. a Hebrew name is not counted');
{
  const n = await nameHe(ENV, req('1.2.3.4'), 'יוסי לוי');
  check('kept as typed, no count, no Gemini', n === 'יוסי לוי' && w.lastKey === null && w.gem === 0, [n, w.lastKey, w.gem]);
}

console.log('\n3. over the limit');
{
  let ok = 0;
  for (let i = 0; i < TLK_AI_LIMIT; i++) if (await nameHe(ENV, req('1.2.3.4'), 'Ivan Petrov')) ok++;
  check('the first 300 names go to Gemini', ok === TLK_AI_LIMIT && w.gem === TLK_AI_LIMIT, [ok, w.gem]);
  check('every call counted under the address key', w.lastKey === await guessKey('tlk', req('1.2.3.4')) && w.counts[w.lastKey] === TLK_AI_LIMIT);
  const n = await nameHe(ENV, req('1.2.3.4'), 'Ivan Petrov');
  check('the 301st: refused, Gemini not called', n === null && w.gem === TLK_AI_LIMIT, [n, w.gem]);
  check('a Hebrew name still passes over the limit', (await nameHe(ENV, req('1.2.3.4'), 'אבי')) === 'אבי');
  check('another address still answers', !!(await nameHe(ENV, req('9.9.9.9'), 'Ivan Petrov')) && w.gem === TLK_AI_LIMIT + 1, w.gem);
}

console.log('\n4. the counter fails open');
{
  w.rpcDown = true;
  check('database down: the over-limit address answers', !!(await nameHe(ENV, req('1.2.3.4'), 'Ivan Petrov')));
  w.rpcDown = false;
}

console.log('\n5. the wiring');
{
  const src = fs.readFileSync(new URL('../../functions/api/talk.js', import.meta.url), 'utf8');
  const direct = src.split('\n').filter((l) => /hebrewName\(env/.test(l));
  check('hebrewName is called only inside nameHe', direct.length === 1 && /return hebrewName\(env, raw\)/.test(direct[0]), direct);
  // 14/10/2026: + the department typed under "other" in the annual / quality training.
  // Annual / quality names and a typed department are Hebrew letters only (heName, no AI) since 15/10/2026.
check('name, company, job and agency go through nameHe (annual / quality: Hebrew only, no AI)', (src.match(/await nameHe\(env, request, /g) || []).length === 4 && /if \(typed && !heName\(raw\)\) return bad\('errNameT', 'heOnly', 422\)/.test(src));
  const rows = [{ key: 'guess:tlk:0123456789abcdef', value: '400' }, { key: 'guess:ai:0123456789abcdef', value: '250' }, { key: 'guess:ind:0123456789abcdef', value: '11' }];
  check('the codes screen does not count tlk as a locked address', lockedCount(rows) === 1, lockedCount(rows));
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
if (fail) process.exit(1);
