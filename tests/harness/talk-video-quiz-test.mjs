// Video and comprehension questions on the worker page (10/10/2026): a Storage video plays
// through a one-hour signed link, YouTube through the no-cookie embed, both allowed by the CSP;
// the questions show on the Hebrew page only, the first answer to each counts, and the score
// lands on the signature row (quiz_ok / quiz_n). A bad question is left out, not shown broken.
import { onRequest, makeTalkToken, ytId, quizOf, quizScore } from './_build/talk.mjs';
let pass = 0, fail = 0;
const check = (l, c, d) => { if (c) { pass++; console.log('  ✓ ' + l); } else { fail++; console.log('  ✗ ' + l + (d !== undefined ? '  -> ' + JSON.stringify(d) : '')); } };
const SB = 'https://znhjtpcltrxxyfjczgvw.supabase.co';
const URL0 = 'https://tapugan-safety.pages.dev/api/talk';
const ENV = { SUPABASE_SERVICE_ROLE_KEY: 'srv', TRUSTEE_NOTIFY_SECRET: 'nsec', GEMINI_API_KEY: 'g' };
const QUIZ = [
  { q: 'כמה נקודות אחיזה בסולם?', a: ['אחת', 'שתיים', 'שלוש', 'ארבע'], c: 2 },
  { q: 'מה עושים בכבל פגום?', a: ['מתקנים לבד', 'מדווחים מיד', '', ''], c: 1 },
  { q: 'שאלה שבורה', a: ['רק אחת', '', '', ''], c: 0 },
  { q: '', a: ['x', 'y'], c: 0 },
  { q: 'תשובה נכונה ריקה', a: ['a', 'b', '', ''], c: 3 },
];
const TALKS = {
  v1: { id: 'v1', d: '2026-10-11', title: 'סולמות', body: 'שלוש נקודות אחיזה', s: 'פורסמה', trainer: 'מיכאל', video_url: SB + '/storage/v1/object/public/incidents-photos/talkvid-1.mp4', quiz: QUIZ, body_ar: 'سلالم\nثلاث نقاط' },
  v2: { id: 'v2', d: '2026-10-11', title: 'עייפות', body: 'x', s: 'פורסמה', video_url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=10', quiz: null },
  v3: { id: 'v3', d: '2026-10-11', title: 'קישור אחר', body: 'x', s: 'פורסמה', video_url: 'https://example.com/v.mp4' },
};
const EMPS = [{ id: 'e1', n: 'אחמד כהן', dep: 'ייצור', eid: '7777777' }];
const w = { inserts: [] };
globalThis.fetch = async (url, init) => {
  const u = String(url), m = (init && init.method) || 'GET';
  const json = (o, st = 200) => new Response(JSON.stringify(o), { status: st, headers: { 'Content-Type': 'application/json' } });
  if (u.startsWith(SB + '/rest/v1/toolbox_talks')) { const id = decodeURIComponent((u.match(/id=eq\.([^&]+)/) || [])[1] || ''); w.talkSel = u; return json(TALKS[id] ? [TALKS[id]] : []); }
  if (u.startsWith(SB + '/rest/v1/emp')) return m === 'PATCH' ? new Response(null, { status: 204 }) : json(EMPS);
  if (u.startsWith(SB + '/rest/v1/toolbox_reads')) { if (m === 'POST') { w.inserts.push(JSON.parse(init.body)); return new Response(null, { status: 201 }); } return json([]); }
  if (u.startsWith(SB + '/storage/v1/object/sign/incidents-photos/')) return json({ signedURL: '/object/sign/incidents-photos/' + u.split('/').pop() + '?token=abc' });
  if (u.startsWith(SB + '/storage/v1/object/incidents-photos/')) return json({ Key: 'x' });
  return json({ error: 'unexpected ' + u }, 599);
};
const get = async (id, l) => { const k = await makeTalkToken(ENV, id); const r = await onRequest({ request: new Request(URL0 + '?k=' + encodeURIComponent(k) + (l ? '&l=' + l : '')), env: ENV }); return { r, h: await r.text(), k }; };
const png = new Uint8Array(1024); png.set([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A], 0);
const SIG = 'data:image/png;base64,' + Buffer.from(png).toString('base64');
const post = async (k, extra) => { const fd = new FormData(); for (const [a, b] of Object.entries({ k, l: 'he', emp: 'e1', oid: '7777777', ok: '1', sig: SIG, ...extra })) fd.append(a, b); return onRequest({ request: new Request(URL0, { method: 'POST', body: fd, headers: { 'user-agent': 'Mozilla/5.0 (iPhone) Mobile' } }), env: ENV }); };

console.log('\n1. the helpers');
check('YouTube ids: watch, youtu.be, shorts', ytId('https://www.youtube.com/watch?v=dQw4w9WgXcQ') === 'dQw4w9WgXcQ' && ytId('https://youtu.be/dQw4w9WgXcQ?t=3') === 'dQw4w9WgXcQ' && ytId('https://youtube.com/shorts/dQw4w9WgXcQ') === 'dQw4w9WgXcQ');
check('not YouTube: http, another site, a broken id', !ytId('http://youtu.be/dQw4w9WgXcQ') && !ytId('https://evil.com/watch?v=dQw4w9WgXcQ') && !ytId('https://youtu.be/short'));
const Q = quizOf({ quiz: QUIZ });
check('only complete questions are kept (2 of 5)', Q.length === 2, Q.map((x) => x.q));
check('no quiz, or not an array, is no questions', quizOf({ quiz: null }).length === 0 && quizOf({ quiz: { q: 'x' } }).length === 0);
check('the first answer counts, a later one does not', JSON.stringify(quizScore(Q, '0:2,1:0,1:1')) === '{"ok":1,"n":2}');
check('nothing answered = no score', quizScore(Q, '') === null && quizScore(Q, 'junk') === null && quizScore([], '0:1') === null);
check('an answer to a question that is not there is ignored', JSON.stringify(quizScore(Q, '7:1,0:2')) === '{"ok":1,"n":2}');

console.log('\n2. the page');
{
  const { r, h } = await get('v1');
  const csp = r.headers.get('Content-Security-Policy') || '';
  check('the talk read asks for video_url and quiz', /video_url,quiz/.test(w.talkSel || ''));
  check('the Storage video plays from a signed link', /<video controls playsinline[^>]*src="https:\/\/znhjtpcltrxxyfjczgvw\.supabase\.co\/storage\/v1\/object\/sign\/incidents-photos\/talkvid-1\.mp4\?token=abc"/.test(h));
  check('the CSP allows the Storage media and the no-cookie YouTube frame, nothing wider', csp.includes('media-src ' + SB) && csp.includes('frame-src https://www.youtube-nocookie.com') && csp.includes("default-src 'none'"), csp);
  check('two questions, each its own group', (h.match(/<fieldset data-q=/g) || []).length === 2);
  check('an empty answer is not shown as a choice', (h.match(/name="q1"/g) || []).length === 2);
  check('the answers go in the form in a hidden field', h.includes('name="qa" id="qa"'));
  check('the quiz script runs with the page nonce', /<script nonce="[^"]+">\(function\(\)\{\nvar K=\[2,1\]/.test(h));
  check('the broken questions are not on the page', !h.includes('שאלה שבורה') && !h.includes('תשובה נכונה ריקה'));
}
{
  const { h } = await get('v1', 'ar');
  check('Arabic page: the video, no Hebrew questions', h.includes('<video') && !h.includes('fieldset data-q') && !h.includes('var K='));
}
{
  const { h } = await get('v2');
  check('YouTube: the no-cookie embed with the id', h.includes('src="https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?rel=0"'));
  check('no questions: no quiz block and no quiz script', !h.includes('id="qz"') && !h.includes('var K='));
}
{
  const { h } = await get('v3');
  check('another https link: a button that opens it, not an embed', h.includes('href="https://example.com/v.mp4"') && !h.includes('<iframe') && !h.includes('<video'));
}

console.log('\n3. the signature row');
{
  const { k } = await get('v1');
  w.inserts = [];
  const r = await post(k, { qa: '0:2,1:0,1:1' });
  const row = w.inserts[0] || {};
  check('signed (200)', r.status === 200, r.status);
  check('the score: 1 right of 2 (first answers only)', row.quiz_ok === 1 && row.quiz_n === 2, row);
  w.inserts = [];
  await post(k, {});
  const row2 = w.inserts[0] || {};
  check('no answers: no score fields at all', !('quiz_ok' in row2) && !('quiz_n' in row2), row2);
  w.inserts = [];
  const k2 = (await get('v2')).k;
  await post(k2, { qa: '0:1' });
  check('a talk without questions ignores a forged answer', !('quiz_ok' in (w.inserts[0] || {})), w.inserts[0]);
  w.inserts = [];
  const fd = { qa: '0:2', l: 'ar' };
  await post(k, fd);
  check('an Arabic signature has no score (the questions are Hebrew)', !('quiz_ok' in (w.inserts[0] || {})), w.inserts[0]);
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
