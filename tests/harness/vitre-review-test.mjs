// Unit test of the Vitre notification-test ops (functions/api/vitre.js, real
// code, fetch mocked) and of the client-side schema key finder from index.html.
// Proves: the submission op is POST-only and admin-only, it can submit NOTHING
// but the locked test form id, it validates its body, and it returns Vitre's
// answer verbatim; the schema op is admin-only and read-only; the key finder
// reads question/answer dataKeys out of two plausible schema shapes.
import fs from 'node:fs';
import { onRequest } from './_build/vitre.mjs';
let pass = 0, fail = 0;
const check = (l, c, d) => { if (c) { pass++; console.log('  ✓ ' + l); } else { fail++; console.log('  ✗ ' + l + (d !== undefined ? '  -> ' + JSON.stringify(d) : '')); } };
const SB = 'https://znhjtpcltrxxyfjczgvw.supabase.co';
const env = { VITRE_API_KEY_ID: 'kid', VITRE_API_KEY_SECRET: 'ksecret', SUPABASE_SERVICE_ROLE_KEY: 'srv' };

function world(o) {
  const w = { calls: [], email: o.email === undefined ? 'admin@tfugen.local' : o.email, submitStatus: o.submitStatus || 200 };
  globalThis.fetch = async (url, init) => {
    const u = String(url); const method = (init && init.method) || 'GET';
    w.calls.push({ u, method, body: init && init.body ? JSON.parse(init.body) : null, headers: init && init.headers });
    const json = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json' } });
    if (u.startsWith(SB + '/auth/v1/user')) return json(w.email ? { id: 'u1', email: w.email, is_anonymous: false } : { id: 'a', is_anonymous: true });
    if (u.includes('/review/getSchema')) return json({ reviewId: 11997, categories: [{ questions: [{ dataKey: 'q1', title: 'x', answers: [{ dataKey: 'a1', text: 'y' }] }] }] });
    if (u.includes('/review/submit')) return json(w.submitStatus === 200 ? { appointmentId: 777, actionId: 888 } : { message: 'comment required' }, w.submitStatus);
    return json({ message: 'unexpected ' + u }, 404);
  };
  return w;
}
const req = (method, qs, body) => new Request('https://tapugan-safety.pages.dev/api/vitre?' + qs, {
  method, headers: { origin: 'https://tapugan-safety.pages.dev', authorization: 'Bearer tok', 'content-type': 'application/json' },
  body: body === undefined ? undefined : JSON.stringify(body)
});
const run = async (method, qs, body) => { const r = await onRequest({ request: req(method, qs, body), env }); return { status: r.status, json: await r.json() }; };

console.log('review_submit_test: gates');
{
  let w = world({});
  let r = await run('GET', 'op=review_submit_test');
  check('GET is refused (405)', r.status === 405, r);
  check('nothing reached Vitre', !w.calls.some(c => c.u.includes('hbinov')));
  w = world({ email: 'manager@tfugen.local' });
  r = await run('POST', 'op=review_submit_test', { createdBy: '654', data: { q: 'a' } });
  check('non-admin is refused (403)', r.status === 403 && r.json.error === 'admin only', r);
  check('nothing reached Vitre', !w.calls.some(c => c.u.includes('hbinov')));
  w = world({ email: null });
  r = await run('POST', 'op=review_submit_test', { createdBy: '654', data: { q: 'a' } });
  check('anonymous is refused', r.status === 403, r);
  w = world({});
  r = await run('POST', 'op=ping', {});
  check('POST on any other op is refused (405)', r.status === 405, r);
}

console.log('review_submit_test: body validation, then the locked submission');
{
  let w = world({});
  let r = await run('POST', 'op=review_submit_test', { createdBy: 'abc', data: { q: 'a' } });
  check('non-numeric createdBy -> 400', r.status === 400, r);
  r = await run('POST', 'op=review_submit_test', { createdBy: '654', data: {} });
  check('empty data -> 400', r.status === 400, r);
  r = await run('POST', 'op=review_submit_test', { createdBy: '654' });
  check('missing data -> 400', r.status === 400, r);
  check('no Vitre call so far', !w.calls.some(c => c.u.includes('hbinov')));
  w = world({});
  r = await run('POST', 'op=review_submit_test', { createdBy: '654', data: { q1: 'a1' }, reviewId: 5, projectId: 3 });
  const sub = w.calls.find(c => c.u.includes('/review/submit'));
  check('one POST to /review/submit', sub && sub.method === 'POST', w.calls.map(c => c.u));
  check('review id is the locked constant, a reviewId in the body is ignored', sub && /reviewId=11997(&|$)/.test(sub.u) && !/reviewId=5/.test(sub.u), sub && sub.u);
  check('createdBy and projectId pass through', sub && /createdBy=654/.test(sub.u) && /projectId=3/.test(sub.u), sub && sub.u);
  check('body is { data }', sub && JSON.stringify(sub.body) === JSON.stringify({ data: { q1: 'a1' } }), sub && sub.body);
  check('Vitre key headers present', sub && sub.headers['X-api-key-id'] === 'kid' && sub.headers['X-api-key-secret'] === 'ksecret');
  check('200 with Vitre result verbatim', r.status === 200 && r.json.ok && r.json.result.appointmentId === 777, r.json);
  check('response echoes what was sent', r.json.sent.data.q1 === 'a1' && r.json.reviewId === 11997 && r.json.createdBy === '654');
  w = world({ submitStatus: 400 });
  r = await run('POST', 'op=review_submit_test', { createdBy: '654', data: { q1: 'a1' } });
  check('Vitre 4xx -> 502 with the message readable', r.status === 502 && r.json.upstreamStatus === 400 && r.json.result.message === 'comment required', r.json);
}

console.log('review_schema: admin-only read');
{
  let w = world({ email: 'manager@tfugen.local' });
  let r = await run('GET', 'op=review_schema&id=11997');
  check('non-admin refused', r.status === 403);
  w = world({});
  r = await run('GET', 'op=review_schema');
  const sc = w.calls.find(c => c.u.includes('/review/getSchema'));
  check('defaults to the test form', sc && /reviewId=11997/.test(sc.u), sc && sc.u);
  check('GET only towards Vitre', sc && sc.method === 'GET');
  check('schema returned', r.status === 200 && r.json.schema.reviewId === 11997, r.json);
  r = await run('GET', 'op=review_schema&id=42');
  check('another id can be READ (read is harmless)', w.calls.some(c => /reviewId=42/.test(c.u)));
}

console.log('client key finder (_vitreFindKeys from index.html)');
{
  const html = fs.readFileSync(new URL('../../index.html', import.meta.url), 'utf8');
  const from = html.indexOf('function _vitreFindKeys'), to = html.indexOf('window._vitreReviewSubmitTest');
  const find = new Function(html.slice(from, to) + '\nreturn _vitreFindKeys;')();
  const Q = 'האם ההתראה הגיעה?', NO = 'לא', YES = 'כן';
  // shape A: categories -> questions -> answers, dataKey everywhere
  let k = find({ categories: [{ title: 'c', dataKey: 'c1', questions: [
    { dataKey: 'q-other', title: 'other', answers: [{ dataKey: 'x', text: NO }] },
    { dataKey: 'q-77', title: Q, answers: [{ dataKey: 'a-yes', text: YES }, { dataKey: 'a-no', text: NO }] }
  ] }] });
  check('A: question key found', k.q && k.q.key === 'q-77', k);
  check('A: the "no" answer of THAT question, not of another question', k.a && k.a.key === 'a-no', k);
  // shape B: flat questions with nested options and different label fields
  k = find({ questions: [{ key: 'qq', name: Q, options: { items: [{ key: 'aa', name: NO }] } }] });
  check('B: alternative field names work', k.q && k.q.key === 'qq' && k.a && k.a.key === 'aa', k);
  k = find({ categories: [{ questions: [{ dataKey: 'q1', title: 'unrelated', answers: [{ dataKey: 'n', text: NO }] }] }] });
  check('no match -> both null (the UI then shows the schema instead of guessing)', !k.q && !k.a, k);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
