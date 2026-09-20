// The AI proxy translates between the client (which speaks Anthropic) and
// Workers AI. Until 2026-09-20 the translation discarded, in silence,
// everything it did not recognise:
//
//   * `system` — so legAskAI's "never invent an inspection interval, a
//     threshold or a date" never reached the model, while the answer panel
//     kept telling the safety manager that rule was in force;
//   * a content-block array — so the equipment-report importer's PDF arrived
//     as "[object Object]";
//   * `stream:true` — so a client reading SSE got one JSON blob and
//     accumulated the empty string.
//
// Runs the REAL functions/api/claude.js with env.AI and fetch mocked, so what
// is asserted is the proxy's behaviour, not a description of it.
import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
let pass = 0, fail = 0;
const check = (l, c, d) => { if (c) { pass++; console.log('  ✓ ' + l); } else { fail++; console.log('  ✗ ' + l + (d !== undefined ? '  -> ' + JSON.stringify(d) : '')); } };

const load = async (rel) => {
  const src = fs.readFileSync(path.join(ROOT, rel), 'utf8')
    .replace(/from '\.\.\/_shared\.js'/, "from '" + pathToFileURL(path.join(ROOT, 'functions/_shared.js')).href + "'");
  return import('data:text/javascript;charset=utf-8,' + encodeURIComponent(src));
};

const SB = 'https://znhjtpcltrxxyfjczgvw.supabase.co';
const ORIGIN = 'https://tapugan-safety.pages.dev';
const TEXT_MODEL = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';
const VISION_MODEL = '@cf/meta/llama-3.2-11b-vision-instruct';

// Records what env.AI.run was handed, and answers with a fixed string.
function makeEnv(answer) {
  const seen = [];
  return {
    seen,
    env: {
      SUPABASE_SERVICE_ROLE_KEY: 'svc',
      AI: { run: async (model, input) => { seen.push({ model, input }); return { response: answer }; } },
    },
  };
}
globalThis.fetch = async (url) => {
  if (String(url).startsWith(SB + '/auth/v1/user')) {
    return new Response(JSON.stringify({ id: 'u1', email: 'admin@tfugen.local', is_anonymous: false }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }
  throw new Error('unexpected fetch ' + url);
};
const req = (body) => new Request(ORIGIN + '/api/claude', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', origin: ORIGIN, Authorization: 'Bearer admin.jwt' },
  body: JSON.stringify(body),
});

(async () => {
  const ai = await load('functions/api/claude.js');

  console.log('\n1. the system prompt reaches the model');
  {
    const { seen, env } = makeEnv('ok');
    const sys = 'אסור בהחלט להמציא נתונים ספציפיים';
    const r = await ai.onRequest({ request: req({ model: TEXT_MODEL, max_tokens: 100, system: sys, messages: [{ role: 'user', content: 'מה תדירות בדיקת מטף?' }] }), env });
    check('the call succeeds', r.status === 200, r.status);
    const msgs = (seen[0] && seen[0].input.messages) || [];
    check('a system message is prepended, carrying the guardrail verbatim', msgs[0] && msgs[0].role === 'system' && msgs[0].content === sys, msgs);
    check('the user turn is still there, after it', msgs[1] && msgs[1].role === 'user', msgs);

    const plain = makeEnv('ok');
    await ai.onRequest({ request: req({ model: TEXT_MODEL, max_tokens: 100, messages: [{ role: 'user', content: 'hi' }] }), env: plain.env });
    check('a call with no system prompt gets no empty system message', plain.seen[0].input.messages.length === 1, plain.seen[0].input.messages);

    const blank = makeEnv('ok');
    await ai.onRequest({ request: req({ model: TEXT_MODEL, max_tokens: 100, system: '   ', messages: [{ role: 'user', content: 'hi' }] }), env: blank.env });
    check('a whitespace-only system prompt is not prepended either', blank.seen[0].input.messages.length === 1, blank.seen[0].input.messages);
  }

  console.log('\n2. a file handed to a text-only model is refused, not stringified');
  {
    const { seen, env } = makeEnv('ok');
    const r = await ai.onRequest({
      request: req({ model: TEXT_MODEL, max_tokens: 100, messages: [{ role: 'user', content: [
        { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: 'JVBER' } },
        { type: 'text', text: 'סרוק את התסקיר' },
      ] }] }), env });
    const body = await r.json();
    check('a PDF block gets 400, not a burnt quota and a nonsense answer', r.status === 400, { status: r.status, body });
    check('the reason names the block type, so the failure is readable', /document/.test(JSON.stringify(body)), body);
    check('nothing reached the model', seen.length === 0, seen);

    const img = makeEnv('ok');
    const r2 = await ai.onRequest({ request: req({ model: TEXT_MODEL, max_tokens: 100, messages: [{ role: 'user', content: [{ type: 'image', source: { data: 'x' } }] }] }), env: img.env });
    check('an image block to the text model is refused the same way', r2.status === 400, r2.status);

    const ok = makeEnv('ok');
    await ai.onRequest({ request: req({ model: TEXT_MODEL, max_tokens: 100, messages: [{ role: 'user', content: [{ type: 'text', text: 'א' }, { type: 'text', text: 'ב' }] }] }), env: ok.env });
    check('an all-text block array is joined into a plain string', ok.seen[0].input.messages[0].content === 'א\nב', ok.seen[0].input.messages);
  }

  console.log('\n3. stream:true answers with SSE the client can read');
  {
    const { env } = makeEnv('{"items":[{"equipment_name":"מטף"}]}');
    const r = await ai.onRequest({ request: req({ model: TEXT_MODEL, max_tokens: 100, stream: true, messages: [{ role: 'user', content: 'x' }] }), env });
    check('the response is an event stream, not JSON', (r.headers.get('content-type') || '').includes('text/event-stream'), r.headers.get('content-type'));
    const raw = await r.text();
    // Replay it through the same reader shape the client uses: lines that
    // start with "data: ", content_block_delta events, delta.text.
    let acc = '';
    for (const line of raw.split('\n')) {
      if (line.indexOf('data: ') !== 0) continue;
      const ev = JSON.parse(line.substring(6));
      if (ev.type === 'content_block_delta' && ev.delta && typeof ev.delta.text === 'string') acc += ev.delta.text;
    }
    check('replaying it the way the importer does recovers the whole answer', acc === '{"items":[{"equipment_name":"מטף"}]}', acc);
    check('it ends with message_stop, so the reader is not left hanging', /event: message_stop/.test(raw), raw.slice(-200));

    const { env: env2 } = makeEnv('plain');
    const r2 = await ai.onRequest({ request: req({ model: TEXT_MODEL, max_tokens: 100, messages: [{ role: 'user', content: 'x' }] }), env: env2 });
    const j = await r2.json();
    check('without stream, the answer is still ordinary Anthropic-shaped JSON', j.content && j.content[0].text === 'plain', j);
  }

  console.log('\n4. the vision model still gets its own request shape');
  {
    const { seen, env } = makeEnv('{"target":"equip_inspections"}');
    const r = await ai.onRequest({ request: req({ model: VISION_MODEL, max_tokens: 100, prompt: 'קרא את התעודה', image: 'BASE64' }), env });
    check('the photo path answers 200', r.status === 200, r.status);
    check('it is called with {prompt, image}, not messages', seen[0].input.prompt === 'קרא את התעודה' && seen[0].input.image === 'BASE64' && !seen[0].input.messages, seen[0] && seen[0].input);
  }

  console.log('\n5. no call site still hands a file to a text-only model');
  {
    const src = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
    // Ignore comment lines: the fix is explained in prose right above the code
    // it replaced, and the words "{type:'document'}" appear there.
    const code = src.split('\n').filter((l) => !/^\s*(\/\/|\*)/.test(l)).join('\n');
    const blocks = [...code.matchAll(/type:'(document|image)'/g)].map((m) => code.slice(Math.max(0, m.index - 1400), m.index + 600));
    const orphan = blocks.filter((ctx) => !/model:'claude-/.test(ctx));
    check('every remaining document/image block goes to an Anthropic model', orphan.length === 0, orphan.map((c) => c.slice(-260)));

    const fn = (name, next) => code.slice(code.indexOf('function ' + name), code.indexOf(next));
    const eqi = fn('_eqiPdfAnalyzeOne', '// Pick records in DB');
    check('the importer reads the PDF text layer instead of shipping the file', /_extractPdfText\(file,\s*20\)/.test(eqi), eqi.slice(0, 200));
    check('...and sends one plain string as the message content', !/type:'document'/.test(eqi) && /messages:\[\{role:'user',content:/.test(eqi));
    check('the untrusted-content fence from the OneDrive classifier is reused', /UNTRUSTED_DOC_CONTENT/.test(eqi));
    check('it no longer asks for 16000 output tokens, which Workers AI refuses', !/max_tokens:16000/.test(eqi), (eqi.match(/max_tokens:\d+/) || [])[0]);

    const cap = fn('_capAnalyze', 'function capShowReview');
    check('Smart Capture sends a photo to the vision model, not the text one', /model:_AI_VISION/.test(cap) && /image:String\(framesList\[0\]\)/.test(cap), cap.slice(0, 200));
    check('...and typed-text-only capture still goes to the text model', /model:_AI_MODEL, max_tokens:800, messages:/.test(cap));
    check('the vision model name is declared once, beside _AI_MODEL', (src.match(/var _AI_VISION=/g) || []).length === 1);
  }

  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('HARNESS ERROR', e); process.exit(2); });
