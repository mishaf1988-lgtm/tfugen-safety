// op=swagger: Vitre's own Swagger document, sliced by path, for reading from
// the phone (26/09). The cloud session cannot reach Vitre, so the two unknowns
// of the photo-in-the-form flow (POST /file/uploadImage, the image answer in
// /review/submit) are read through this op and pasted back.
//
// Runs the real module with fetch mocked. Order matters: the module keeps the
// document in memory for 10 minutes, so the failure cases run before a
// successful download fills that cache.
import { onRequest } from './_build/vitre.mjs';
let pass = 0, fail = 0;
const check = (l, c, d) => { if (c) { pass++; console.log('  ✓ ' + l); } else { fail++; console.log('  ✗ ' + l + (d !== undefined ? '  -> ' + JSON.stringify(d) : '')); } };
const SB = 'https://znhjtpcltrxxyfjczgvw.supabase.co';
const env = { VITRE_API_KEY_ID: 'kid', VITRE_API_KEY_SECRET: 'ksecret', SUPABASE_SERVICE_ROLE_KEY: 'srv' };

// A small Swagger 2 document with one OpenAPI-3 style ref mixed in, a nested
// model, a self-referencing model and a dangling ref.
const SWAGGER = {
  swagger: '2.0', info: { title: 'Vitre Public API', version: 'v1' },
  paths: {
    '/file/uploadImage': { post: { summary: 'Upload an image', consumes: ['multipart/form-data'],
      parameters: [{ name: 'file', in: 'formData', type: 'file', required: true }],
      responses: { 200: { description: 'ok', schema: { $ref: '#/definitions/UploadResult' } } } } },
    '/file/uploadFile': { post: { summary: 'Upload a file', responses: { 200: { schema: { $ref: '#/definitions/UploadResult' } } } } },
    '/review/submit': { post: { summary: 'Submit a review', parameters: [{ name: 'body', in: 'body', schema: { $ref: '#/components/schemas/SubmitBody' } }], responses: { 200: { description: 'x'.repeat(700) } } } },
    '/Employee': { get: { summary: 'Employees' }, post: { summary: 'Add employee' } },
    '/task/close': { put: { summary: 'Close a task', parameters: [{ name: 'model', in: 'body', schema: { $ref: '#/definitions/Missing' } }] } }
  },
  definitions: {
    UploadResult: { type: 'object', properties: { file: { $ref: '#/definitions/FileInfo' }, ok: { type: 'boolean' } } },
    FileInfo: { type: 'object', properties: { path: { type: 'string' }, parent: { $ref: '#/definitions/FileInfo' } } }
  },
  components: { schemas: { SubmitBody: { type: 'object', properties: { data: { type: 'object' } } } } }
};

function world(o) {
  const w = { calls: [], swaggerStatus: o.swaggerStatus || 200, needAuth: !!o.needAuth, email: o.email === undefined ? 'admin@tfugen.local' : o.email };
  globalThis.fetch = async (url, init) => {
    const u = String(url); const h = (init && init.headers) || {};
    w.calls.push({ u, method: (init && init.method) || 'GET', auth: !!h['X-api-key-id'] });
    const json = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json' } });
    if (u.startsWith(SB + '/auth/v1/user')) return json(w.email ? { id: 'u1', email: w.email, is_anonymous: false } : { id: 'a', is_anonymous: true });
    if (u.startsWith(SB + '/rest/v1/app_users')) return json(/manager/.test(u) ? [{ role: 'מנהל', active: true }] : []);
    if (u.includes('/api-docs/v1/swagger.json')) {
      if (w.needAuth && !h['X-api-key-id']) return json({ message: 'unauthorized' }, 401);
      return w.swaggerStatus === 200 ? json(SWAGGER) : json({ message: 'boom' }, w.swaggerStatus);
    }
    return json({ message: 'unexpected ' + u }, 404);
  };
  return w;
}
const run = async (qs) => {
  const r = await onRequest({ request: new Request('https://tapugan-safety.pages.dev/api/vitre?' + qs, {
    method: 'GET', headers: { origin: 'https://tapugan-safety.pages.dev', authorization: 'Bearer tok' } }), env });
  let j = null; try { j = await r.json(); } catch (e) {}
  return { status: r.status, json: j };
};
const swaggerCalls = (w) => w.calls.filter(c => c.u.includes('/api-docs/v1/swagger.json'));

console.log('\n1. admin only');
{
  let w = world({ email: 'manager@tfugen.local' });
  let r = await run('op=swagger');
  check('a manager is refused', r.status === 403 && r.json.error === 'admin only', r);
  check('...and Vitre was never asked', swaggerCalls(w).length === 0, w.calls.map(c => c.u));
  w = world({ email: null });
  r = await run('op=swagger&path=/file/uploadImage');
  check('an anonymous session is refused before the role check', r.status === 401 || r.status === 403, r);
}

console.log('\n2. upstream failure (before anything is cached)');
{
  const w = world({ swaggerStatus: 500 });
  const r = await run('op=swagger');
  check('Vitre 500 -> 502 with the message', r.status === 502 && /500/.test(r.json.error) && r.json.detail === 'boom', r);
  check('asked without the keys first, then with them', swaggerCalls(w).length === 2 && !swaggerCalls(w)[0].auth && swaggerCalls(w)[1].auth, swaggerCalls(w));
}

console.log('\n3. index of every path');
{
  const w = world({ needAuth: true });
  const r = await run('op=swagger');
  check('200 with the spec version and title', r.status === 200 && r.json.spec === '2.0' && r.json.info.title === 'Vitre Public API', r.json);
  check('one row per METHOD + path (6 ops in 5 paths)', r.json.total === 6 && r.json.paths.length === 6, r.json.paths);
  const emp = r.json.paths.filter(p => p.path === '/Employee').map(p => p.method).sort();
  check('/Employee lists GET and POST', emp.join(',') === 'GET,POST', emp);
  check('the summary rides along', r.json.paths.find(p => p.path === '/file/uploadImage').summary === 'Upload an image');
  check('a 401 without the keys is retried with them', swaggerCalls(w).length === 2 && swaggerCalls(w)[1].auth, swaggerCalls(w));
  check('the response says it was freshly downloaded', r.json.cached === false, r.json.cached);
  check('the keys are never in the response', !JSON.stringify(r.json).includes('ksecret'));
  const q = await run('op=swagger&q=upload');
  check('?q= narrows the index', q.json.count === 2 && q.json.total === 6 && q.json.paths.every(p => /upload/i.test(p.path)), q.json.paths);
}

console.log('\n4. one path with its models');
{
  const w = world({});
  const r = await run('op=swagger&path=/file/uploadImage');
  check('served from the cache: no second download', swaggerCalls(w).length === 0 && r.json.cached === true, swaggerCalls(w));
  check('exact match returns only that path', r.json.matched.length === 1 && r.json.matched[0].path === '/file/uploadImage', r.json.matched);
  const item = r.json.matched[0].item;
  check('the operation is returned whole (consumes, parameters, responses)', item.post.consumes[0] === 'multipart/form-data' && item.post.parameters[0].in === 'formData', item);
  check('#/definitions refs are resolved, nested ones too', r.json.models['#/definitions/UploadResult'] && r.json.models['#/definitions/FileInfo'], Object.keys(r.json.models));
  check('a self-referencing model does not loop', r.json.modelCount === 2, r.json.modelCount);
  const r2 = await run('op=swagger&path=/review/submit');
  check('#/components/schemas refs (OpenAPI 3) are resolved', r2.json.models['#/components/schemas/SubmitBody'].properties.data.type === 'object', r2.json.models);
  check('long strings are truncated', r2.json.matched[0].item.post.responses['200'].description.length < 700);
  const r3 = await run('op=swagger&path=/task/close');
  check('a dangling ref is marked missing, not thrown', r3.status === 200 && r3.json.models['#/definitions/Missing'].missing === true, r3.json.models);
  const r4 = await run('op=swagger&path=/file/upload');
  check('no exact match -> every path containing the text', r4.json.matched.length === 2, r4.json.matched.map(m => m.path));
  const r5 = await run('op=swagger&path=/FILE/UPLOADIMAGE');
  check('the path match ignores case', r5.json.matched.length === 1 && r5.json.matched[0].path === '/file/uploadImage', r5.json);
  const r6 = await run('op=swagger&path=/nope');
  check('unknown path -> 404 with a hint', r6.status === 404 && /not found/.test(r6.json.error) && r6.json.hint, r6.json);
  const r7 = await run('op=swagger&fresh=1');
  check('?fresh=1 downloads again', swaggerCalls(w).length >= 1 && r7.json.cached === false, swaggerCalls(w));
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
