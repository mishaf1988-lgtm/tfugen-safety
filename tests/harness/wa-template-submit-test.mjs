// Submitting a WhatsApp template for approval, from a button in the app.
//
// The alert the safety officer receives is carried by a Meta template, and the
// only approved one was written for road accidents: it opens «🚨 תקרית בטיחות»
// and ends «נא לטפל מיידית». Michael read the first real one on 2026-09-21,
// over a fire extinguisher missing its seal, and asked for calmer wording. The
// wording lives in the template, so the fix is a new template -- and submitting
// one is a Meta Business Suite form, on a phone, in English, with sample
// values. He asked me to do it for him. The token and the account id are
// already on the server, so it became one button.
//
// Two things this has to get right, and both are checked against the real
// module with fetch mocked:
//   * the template must match what trustee-notify actually sends, parameter
//     for parameter. A template approved with the wrong parameter count is
//     rejected at SEND time, days later, with the message already lost.
//   * nothing about it may come from the request. This endpoint submits text
//     for approval in the factory's name.
import { onRequest } from './_build/wa-templates.mjs';
let pass = 0, fail = 0;
const check = (l, c, d) => { if (c) { pass++; console.log('  ✓ ' + l); } else { fail++; console.log('  ✗ ' + l + (d !== undefined ? '  -> ' + JSON.stringify(d) : '')); } };
const SB = 'https://znhjtpcltrxxyfjczgvw.supabase.co';
const ORIGIN = 'https://tapugan-safety.pages.dev';

function world(opts) {
  const o = opts || {};
  const calls = [];
  globalThis.fetch = async (url, init) => {
    const u = String(url);
    calls.push({ u, method: (init && init.method) || 'GET', body: init && init.body ? JSON.parse(init.body) : null });
    const json = (x, status = 200) => new Response(JSON.stringify(x), { status, headers: { 'Content-Type': 'application/json' } });
    if (u.startsWith(SB + '/auth/v1/user')) {
      return json(o.authOk === false ? { error: 'bad' } : { id: 'u1', email: 'admin@tfugen.local', is_anonymous: false }, o.authOk === false ? 401 : 200);
    }
    if (u.includes('graph.facebook.com')) {
      if (o.metaExists) return json({ error: { message: 'Template name (tfugen_safety_report) already exists in he', code: 100 } }, 400);
      if (o.metaFail) return json({ error: { message: 'Invalid OAuth access token', code: 190 } }, 401);
      return json({ id: '1234567890', status: 'PENDING', category: 'UTILITY' });
    }
    throw new Error('unexpected fetch ' + u);
  };
  return { calls };
}

// requireUser validates the session against Supabase with the service key,
// exactly as the deployed function does.
const env = { META_ACCESS_TOKEN: 'tok', META_WABA_ID: '4400035656982783', SUPABASE_SERVICE_ROLE_KEY: 'svc' };
const req = (method, headers) => new Request(ORIGIN + '/api/wa-templates', {
  method, headers: { origin: ORIGIN, referer: ORIGIN + '/', 'Content-Type': 'application/json', ...(headers || {}) },
  body: method === 'POST' ? '{}' : undefined
});

(async () => {
  console.log('\n1. the submission');
  {
    const w = world({});
    const r = await onRequest({ request: req('POST', { Authorization: 'Bearer good' }), env });
    const j = await r.json();
    const meta = w.calls.find((c) => c.u.includes('graph.facebook.com'));
    check('200, and the review status comes back', r.status === 200 && j.ok && j.status === 'PENDING', j);
    check('it POSTs to the account\'s message_templates', meta && meta.method === 'POST' && /\/message_templates$/.test(meta.u), meta && meta.u);
    check('the name is the one trustee-notify looks for', meta.body.name === 'tfugen_safety_report', meta.body.name);
    check('Hebrew, and UTILITY rather than MARKETING', meta.body.language === 'he' && meta.body.category === 'UTILITY', meta.body);
  }

  console.log('\n2. it matches what we actually send');
  {
    const w = world({});
    await onRequest({ request: req('POST', { Authorization: 'Bearer good' }), env });
    const body = w.calls.find((c) => c.u.includes('graph.facebook.com')).body;
    const text = (body.components.find((c) => c.type === 'BODY') || {}).text || '';
    const ex = ((body.components.find((c) => c.type === 'BODY') || {}).example || {}).body_text;
    // A template approved with the wrong number of placeholders does not fail
    // now. It fails at SEND time, days later, on a real hazard.
    const holders = (text.match(/\{\{\d\}\}/g) || []);
    check('four placeholders, numbered 1 to 4', holders.join(',') === '{{1}},{{2}},{{3}},{{4}}', holders);
    check('...captioned reporter / kind / location / finding, in that order',
      /מדווח: \{\{1\}\}/.test(text) && /סוג: \{\{2\}\}/.test(text) && /מיקום: \{\{3\}\}/.test(text) && /הממצא: \{\{4\}\}/.test(text), text);
    check('Meta gets one sample per placeholder, or it refuses the submission',
      Array.isArray(ex) && ex.length === 1 && ex[0].length === 4, ex);
    // The whole point of the exercise.
    check('the wording is calm: no תקרית, no מיידית, no siren',
      !/תקרית/.test(text) && !/מיידית/.test(text) && !/🚨/.test(text), text);
    check('...and it still says what it is', /דיווח בטיחות חדש/.test(text), text);
  }

  console.log('\n3. nothing about it comes from the caller');
  {
    // Submitting text for approval in the factory's name. A request that could
    // choose the text could get anything approved under Tapugan's account.
    const w = world({});
    const evil = new Request(ORIGIN + '/api/wa-templates', {
      method: 'POST', headers: { origin: ORIGIN, referer: ORIGIN + '/', 'Content-Type': 'application/json', Authorization: 'Bearer good' },
      body: JSON.stringify({ name: 'attacker_template', category: 'MARKETING', components: [{ type: 'BODY', text: 'anything' }] })
    });
    await onRequest({ request: evil, env });
    const body = w.calls.find((c) => c.u.includes('graph.facebook.com')).body;
    check('a name in the request is ignored', body.name === 'tfugen_safety_report', body.name);
    check('...so is a category', body.category === 'UTILITY', body.category);
    check('...and so is the text', !JSON.stringify(body).includes('anything'), body.components);
  }

  console.log('\n4. who may press it');
  {
    world({});
    const r1 = await onRequest({ request: req('POST'), env });
    check('no session → 401', r1.status === 401, r1.status);
    const w = world({ authOk: false });
    const r2 = await onRequest({ request: req('POST', { Authorization: 'Bearer bad' }), env });
    check('a session Supabase rejects → 401', r2.status === 401, r2.status);
    check('...and Meta is never called', !w.calls.some((c) => c.u.includes('graph.facebook.com')), w.calls.map((c) => c.u));
    const r3 = await onRequest({ request: new Request(ORIGIN + '/api/wa-templates', { method: 'POST', headers: { origin: 'https://evil.example', 'Content-Type': 'application/json' }, body: '{}' }), env });
    check('another origin → 403, before anything else', r3.status === 403, r3.status);
  }

  console.log('\n5. pressing it twice');
  {
    // The button sits in a settings modal. Somebody will press it again.
    world({ metaExists: true });
    const r = await onRequest({ request: req('POST', { Authorization: 'Bearer good' }), env });
    const j = await r.json();
    check('"already exists" is reported as success, not as a failure to act on',
      r.status === 200 && j.ok && j.already === true, j);
  }
  {
    world({ metaFail: true });
    const r = await onRequest({ request: req('POST', { Authorization: 'Bearer good' }), env });
    const j = await r.json();
    check('a real refusal says what Meta said', r.status === 502 && /OAuth/.test(j.detail || ''), j);
  }

  console.log('\n6. listing still works');
  {
    const w = world({});
    const r = await onRequest({ request: req('GET'), env });
    check('GET still reaches the template list', r.status === 200 && w.calls.some((c) => /message_templates\?/.test(c.u)), w.calls.map((c) => c.u));
    const r2 = await onRequest({ request: new Request(ORIGIN + '/api/wa-templates', { method: 'DELETE', headers: { origin: ORIGIN } }), env });
    check('anything else → 405', r2.status === 405, r2.status);
  }

  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('HARNESS ERROR', e); process.exit(2); });
