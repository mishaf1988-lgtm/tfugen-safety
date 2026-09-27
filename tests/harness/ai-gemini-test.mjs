// The "gemini" route in functions/api/claude.js: the request Google gets,
// the answer the client gets, and the fallback to Workers AI when Gemini
// cannot answer (no key, no credit, empty answer, file block).
// Runs the REAL function with fetch and env.AI mocked.
import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
let pass = 0, fail = 0;
const check = (l, c, d) => { if (c) { pass++; console.log('  ✓ ' + l); } else { fail++; console.log('  ✗ ' + l + (d !== undefined ? '  -> ' + JSON.stringify(d) : '')); } };
const load = async (rel) => {
  const src = fs.readFileSync(path.join(ROOT, rel), 'utf8')
    .replace(/from '\.\.\/(_[a-z]+)\.js'/g, (m, mod) => "from '" + pathToFileURL(path.join(ROOT, 'functions/' + mod + '.js')).href + "'");
  return import('data:text/javascript;charset=utf-8,' + encodeURIComponent(src));
};
const SB = 'https://znhjtpcltrxxyfjczgvw.supabase.co';
const ORIGIN = 'https://tapugan-safety.pages.dev';
const GURL = 'https://generativelanguage.googleapis.com/v1beta/models/';

let gemini = null; // { status, body } for the next Gemini call
const gCalls = [];
globalThis.fetch = async (url, init) => {
  url = String(url);
  if (url.startsWith(SB + '/auth/v1/user')) {
    return new Response(JSON.stringify({ id: 'u1', email: 'admin@tfugen.local', is_anonymous: false }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }
  if (url.startsWith(GURL)) {
    gCalls.push({ url, headers: init.headers, body: JSON.parse(init.body) });
    return new Response(JSON.stringify(gemini.body), { status: gemini.status });
  }
  throw new Error('unexpected fetch ' + url);
};
const mkEnv = (extra) => {
  const seen = [];
  return { seen, env: { SUPABASE_SERVICE_ROLE_KEY: 'svc', AI: { run: async (model, input) => { seen.push({ model, input }); return { response: 'llama says' }; } }, ...extra } };
};
const req = (body) => new Request(ORIGIN + '/api/claude', {
  method: 'POST', headers: { 'Content-Type': 'application/json', origin: ORIGIN, Authorization: 'Bearer admin.jwt' }, body: JSON.stringify(body),
});
const ok = (text) => ({ status: 200, body: { candidates: [{ content: { parts: [{ text: 'thinking...', thought: true }, { text }] }, finishReason: 'STOP' }] } });
const ask = { model: 'gemini', max_tokens: 600, system: 'מערכת', messages: [
  { role: 'user', content: 'שאלה 1' }, { role: 'assistant', content: 'תשובה 1' }, { role: 'user', content: 'שאלה 2' }] };

(async () => {
  const ai = await load('functions/api/claude.js');

  console.log('\n1. Gemini answers');
  {
    gemini = ok('4 ליקויים'); gCalls.length = 0;
    const { seen, env } = mkEnv({ GEMINI_API_KEY: 'gk' });
    const r = await ai.onRequest({ request: req(ask), env });
    const j = await r.json();
    const c = gCalls[0];
    check('200', r.status === 200, r.status);
    check('default model gemini-flash-latest', c && c.url === GURL + 'gemini-flash-latest:generateContent', c && c.url);
    check('key in header, not URL', c && c.headers['x-goog-api-key'] === 'gk' && c.url.indexOf('gk') < 0);
    check('assistant turn mapped to role model', c && c.body.contents.map((x) => x.role).join() === 'user,model,user', c && c.body.contents);
    check('system goes to systemInstruction', c && c.body.systemInstruction.parts[0].text === 'מערכת');
    check('maxOutputTokens raised to leave room for thinking', c && c.body.generationConfig.maxOutputTokens === 2048, c && c.body.generationConfig);
    check('answer in Anthropic shape, thought parts dropped', j.content[0].text === '4 ליקויים', j.content);
    check('model reported as gemini:...', j.model === 'gemini:gemini-flash-latest', j.model);
    check('no fallback flag', !j.fallback_from);
    check('Workers AI not called', seen.length === 0);
  }

  console.log('\n2. GEMINI_MODEL overrides the model');
  {
    gemini = ok('x'); gCalls.length = 0;
    const { env } = mkEnv({ GEMINI_API_KEY: 'gk', GEMINI_MODEL: 'gemini-2.5-pro' });
    await ai.onRequest({ request: req(ask), env });
    check('uses env model', gCalls[0] && gCalls[0].url === GURL + 'gemini-2.5-pro:generateContent', gCalls[0] && gCalls[0].url);
  }

  console.log('\n3. fallback to Llama');
  const cases = [
    ['no key', {}, null, /GEMINI_API_KEY not set/],
    ['out of credit (429)', { GEMINI_API_KEY: 'gk' }, { status: 429, body: { error: { message: 'quota' } } }, /Gemini 429/],
    ['empty answer', { GEMINI_API_KEY: 'gk' }, { status: 200, body: { candidates: [{ content: { parts: [{ text: '..', thought: true }] }, finishReason: 'MAX_TOKENS' }] } }, /empty answer \(MAX_TOKENS\)/],
  ];
  for (const [name, extra, g, re] of cases) {
    gemini = g; gCalls.length = 0;
    const { seen, env } = mkEnv(extra);
    const r = await ai.onRequest({ request: req(ask), env });
    const j = await r.json();
    check(name + ': 200 from Llama', r.status === 200 && j.content[0].text === 'llama says', j);
    check(name + ': Llama 3.3 got the same turns + system', seen[0] && seen[0].model === '@cf/meta/llama-3.3-70b-instruct-fp8-fast' && seen[0].input.messages.length === 4 && seen[0].input.messages[0].role === 'system', seen[0]);
    check(name + ': fallback_from says why', j.fallback_from && re.test(j.fallback_from.reason), j.fallback_from);
  }

  console.log('\n4. a file block on the Gemini route is still refused (via the Llama path)');
  {
    gemini = ok('x'); gCalls.length = 0;
    const { env } = mkEnv({ GEMINI_API_KEY: 'gk' });
    const r = await ai.onRequest({ request: req({ model: 'gemini', max_tokens: 10, messages: [{ role: 'user', content: [{ type: 'document', source: {} }] }] }), env });
    check('400, Google never called', r.status === 400 && gCalls.length === 0, r.status);
  }

  console.log('\n5. stream:true on Gemini emits SSE');
  {
    gemini = ok('שלום');
    const { env } = mkEnv({ GEMINI_API_KEY: 'gk' });
    const r = await ai.onRequest({ request: req({ ...ask, stream: true }), env });
    const t = await r.text();
    check('event-stream with the text', /text\/event-stream/.test(r.headers.get('Content-Type')) && t.indexOf('שלום') > 0 && t.indexOf('message_stop') > 0);
  }

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
