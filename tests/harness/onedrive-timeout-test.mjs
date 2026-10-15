// Time limits on the server's outbound calls (15/10/2026, review; owner: "no hang, no stop, no
// data that disappears"). Every fetch in _onedrive.js carries an AbortSignal.timeout: 10s for
// Supabase, 20s for Graph and the token endpoint, 30s for a file upload. A refused server_state
// write now throws (stateSet used to pass in silence). _shared.js's auth and role reads too.
import fs from 'fs';
import { stateGet, stateSet, stateLock, stateUnlock, tokenRow, saveTokens, accessToken, putFile, itemUrl, sendMail, sendMailTo, SB_MS, GRAPH_MS, PUT_MS } from './_build/_onedrive.mjs';

let pass = 0, fail = 0;
const check = (l, c, d) => { if (c) { pass++; console.log('  ✓ ' + l); } else { fail++; console.log('  ✗ ' + l + (d !== undefined ? '  -> ' + JSON.stringify(d).slice(0, 300) : '')); } };
const src = (f) => fs.readFileSync(new URL('../../functions/' + f, import.meta.url), 'utf8');

console.log('\n1. every fetch in _onedrive.js carries a signal (read in the source)');
{
  const s = src('_onedrive.js');
  // Each fetch( call, up to the end of its argument list.
  const calls = [];
  let i = -1;
  while ((i = s.indexOf('fetch(', i + 1)) >= 0) {
    if (/[A-Za-z_.]$/.test(s[i - 1] || '')) continue; // not a bare fetch(
    let depth = 0, j = i + 5;
    for (; j < s.length; j++) { if (s[j] === '(') depth++; else if (s[j] === ')') { depth--; if (!depth) break; } }
    calls.push(s.substring(i, j + 1));
  }
  check('there are fetch calls to look at (' + calls.length + ')', calls.length >= 13, calls.length);
  const bare = calls.filter((c) => !/signal: tmo\((SB_MS|GRAPH_MS|PUT_MS)\)/.test(c));
  check('...and every one has signal: tmo(SB_MS | GRAPH_MS | PUT_MS)', bare.length === 0, bare.map((c) => c.substring(0, 120)));
  check('the limits: Supabase 10s, Graph and token 20s, upload 30s', SB_MS === 10000 && GRAPH_MS === 20000 && PUT_MS === 30000);
  const sh = src('_shared.js');
  check('_shared.js: /auth/v1/user and the app_users role read have a time limit', /\/auth\/v1\/user'[\s\S]{0,200}signal: AbortSignal\.timeout\(SB_TIMEOUT_MS\)/.test(sh) && /app_users\?id=eq\.[\s\S]{0,200}signal: AbortSignal\.timeout\(SB_TIMEOUT_MS\)/.test(sh));
}

console.log('\n2. the same, at run time: which limit each call gets');
{
  const realTimeout = AbortSignal.timeout.bind(AbortSignal);
  let limits = [];
  AbortSignal.timeout = (ms) => { limits.push(ms); return realTimeout(ms); };
  const seen = [];
  let status = 200;
  globalThis.fetch = async (url, init) => {
    seen.push({ u: String(url), signal: !!(init && init.signal && init.signal instanceof AbortSignal) });
    const u = String(url);
    if (u.includes('/oauth2/v2.0/token')) return new Response(JSON.stringify({ access_token: 'a', refresh_token: 'r2', expires_in: 3600 }), { status: 200 });
    if (u.includes('/oauth_tokens?provider=eq.') && !(init && init.method)) return new Response(JSON.stringify([{ user_email: 'x@y', refresh_token: 'r', access_token: null, expires_at: null, scope: 'Files.ReadWrite' }]), { status: 200 });
    if (u.includes('/server_state?key=eq.') && init && init.method === 'PATCH') return new Response(JSON.stringify([{ key: 'k' }]), { status: 200 });
    if (u.includes('/server_state?select=')) return new Response('[]', { status });
    if (u.includes('/server_state')) return new Response(null, { status: status === 200 ? 201 : status });
    if (u.includes('/sendMail')) return new Response(null, { status: 202 });
    return new Response('{}', { status: 200 });
  };
  const env = { SUPABASE_SERVICE_ROLE_KEY: 'k', ONEDRIVE_CLIENT_ID: 'c', ONEDRIVE_CLIENT_SECRET: 's' };
  const run = async (name, fn, want) => { limits = []; seen.length = 0; await fn(); check(name + ': every fetch has a signal, limit ' + want.join('/'), seen.length > 0 && seen.every((x) => x.signal) && limits.length === seen.length && limits.every((x, k) => x === want[Math.min(k, want.length - 1)]), [seen, limits]); };
  await run('stateGet', () => stateGet(env, ['a']), [SB_MS]);
  await run('stateSet', () => stateSet(env, { a: '1' }), [SB_MS]);
  await run('stateLock', () => stateLock(env, 'l', 1000), [SB_MS]);
  await run('stateUnlock', () => stateUnlock(env, 'l', 'tok'), [SB_MS]);
  await run('tokenRow', () => tokenRow(env), [SB_MS]);
  await run('saveTokens', () => saveTokens(env, 'x@y', { refresh_token: 'r' }), [SB_MS]);
  await run('accessToken (read, refresh at Microsoft, save)', () => accessToken(env), [SB_MS, GRAPH_MS, SB_MS]);
  await run('putFile', () => putFile('t', 'a/b', 'f.xlsx', new Uint8Array(3)), [PUT_MS]);
  await run('itemUrl', () => itemUrl('t', 'a/b'), [GRAPH_MS]);
  await run('sendMail', () => sendMail('t', 'x@y', 's', 'h'), [GRAPH_MS]);
  await run('sendMailTo', () => sendMailTo('t', ['x@y'], [], 's', 'h'), [GRAPH_MS]);
  AbortSignal.timeout = realTimeout;

  console.log('\n3. a refused write is an error, not silence');
  status = 500;
  let err = null; try { await stateSet(env, { a: '1' }); } catch (e) { err = e; }
  check('stateSet on HTTP 500 throws "server_state write HTTP 500"', err && /server_state write HTTP 500/.test(err.message), err && err.message);
  status = 200;
  err = null; try { await stateSet(env, { a: '1' }); } catch (e) { err = e; }
  check('...and on 201 it does not', err === null);

  console.log('\n4. a call that times out throws, and the lock still answers "open"');
  globalThis.fetch = async () => { throw Object.assign(new Error('The operation was aborted due to timeout'), { name: 'TimeoutError' }); };
  err = null; try { await stateGet(env, ['a'], true); } catch (e) { err = e; }
  check('stateGet strict: a timeout throws', err && err.name === 'TimeoutError');
  err = null; try { await putFile('t', 'a', 'f', new Uint8Array(1)); } catch (e) { err = e; }
  check('putFile: a timeout throws (the run records it as its error)', !!err);
  check('stateLock: a timeout = "open" (the run goes ahead, as before the lock)', (await stateLock(env, 'l', 1000)) === 'open');
  let threw = false; try { await stateUnlock(env, 'l', 'tok'); } catch (e) { threw = true; }
  check('stateUnlock: a timeout is swallowed', threw === false);
}

console.log('\n5. callers that did not catch a stateSet now answer, not crash');
{
  const hf = src('api/hazard-file.js'), hd = src('api/hazard-deck.js'), ma = src('api/ms-auth.js');
  check('hazard-file "dismiss": a failed write answers 503 JSON', /try \{ await stateSet\(env, \{ \[sk\][\s\S]{0,200}\}\s*\n\s*catch \(e\) \{ return jsonResp\([\s\S]{0,120}503, cors\); \}/.test(hf));
  check('hazard-deck "setDate": a failed write answers 503 JSON', /try \{ await stateSet\(env, \{ deck_meeting_date: body\.date \}\); \}\s*\n\s*catch \(e\) \{ return jsonResp\([\s\S]{0,120}503, cors\); \}/.test(hd));
  check('ms-auth "start": no sign-in link without the saved nonce (503)', /try \{ await stateSet\(env, \{ \[NONCE_KEY\][\s\S]{0,120}\}\s*\n\s*catch \(e\) \{ return jsonResp\(\{ error: 'state store unavailable, try again' \}, 503, cors\); \}/.test(ma));
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
