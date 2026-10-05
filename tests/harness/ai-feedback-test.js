// Michael's 👍/👎 on an NCR analysis teach the next one (01/10/2026, "a
// machine that learns"). The buttons and the ncr_ai.feedback column exist since
// 30/04; this checks that rated analyses reach the next prompt, chosen right.
const path = require('path');
let pw; try { pw = require('playwright'); } catch (e) { pw = require('playwright-core'); }
const HTML = 'file://' + path.resolve(__dirname, '../../index.html');
let pass = 0, fail = 0;
const check = (l, c, d) => { if (c) { pass++; console.log('  ✓ ' + l); } else { fail++; console.log('  ✗ ' + l + (d !== undefined ? '  -> ' + JSON.stringify(d) : '')); } };

(async () => {
  const browser = await pw.chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 375, height: 812 }, locale: 'he-IL' })).newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.route('**/*', (r) => r.request().url().startsWith('file://') ? r.continue() : r.abort());
  await page.goto(HTML, { waitUntil: 'load' });
  await page.waitForTimeout(700);

  const row = (id, v, fb, ts, rc) => ({ ncr_id: id, version: v, feedback: fb, feedback_ts: ts, risk: 'high', rc: rc, ia: 'עצירה', ca: ['פעולה'], prev: 'מניעה' });

  console.log('\n1. loading keeps the rated rows, every version');
  const load = await page.evaluate((rows) => {
    const real = window.fetch;
    window.fetch = (url) => String(url).indexOf('/rest/v1/ncr_ai') >= 0 ? Promise.resolve(new Response(JSON.stringify(rows), { status: 200 })) : real.apply(window, arguments);
    _naf = {}; _naVer = {};
    return _ncrLoadAI().then(() => { window.fetch = real; return { fb: _naFb.map((r) => r.ncr_id + ':' + r.version + ':' + r.feedback), latestA: _naf.a && _naf.a.version }; });
  }, [row('a', 2, null, null, 'גרסה 2'), row('a', 1, 'down', '2026-09-01', 'שטחי'), row('b', 1, 'up', '2026-09-10', 'עמוק ב'), row('c', 1, 'up', '2026-09-20', 'עמוק ג'), row('d', 1, null, null, 'לא דורג')]);
  check('3 rated rows kept, including the older version a:1 under a newer unrated a:2', load.fb.sort().join() === 'a:1:down,b:1:up,c:1:up', load);
  check('the panel still shows the latest version', load.latestA === 2, load);

  console.log('\n2. which examples go in');
  const ex = await page.evaluate(() => {
    _nad = [{ id: 'a', d: 'תיאור א', category: 'saf' }, { id: 'b', d: 'תיאור ב', category: 'env' }, { id: 'c', d: 'תיאור ג', category: 'saf' }, { id: 'x', d: 'החדש: כבל חשמל חשוף ליד הכניסה', category: 'saf' }];
    const e1 = _ncrFbExamples(_nad[3]);
    const env = _ncrFbExamples({ id: 'x', category: 'env' });
    const self = _ncrFbExamples(_nad[2]);
    return { up: e1.up.map((e) => e.id), down: e1.down.map((e) => e.id), envUp: env.up.map((e) => e.id), selfUp: self.up.map((e) => e.id), d: e1.up[0] && e1.up[0].d };
  });
  check('2 up (c, b), same category first', ex.up.join() === 'c,b', ex);
  check('1 down (a)', ex.down.join() === 'a', ex);
  check('for an env NCR the env example comes first', ex.envUp.join() === 'b,c', ex);
  check('the NCR being analysed is not its own example', ex.selfUp.indexOf('c') < 0, ex);
  check('the example carries the NCR description', ex.d === 'תיאור ג', ex);

  console.log('\n3. a rating given in this session counts before the next load');
  const sess = await page.evaluate(() => {
    _naf.e = { version: 1, feedback: 'up', root_cause: 'מהסשן', corrective_actions: [] };
    _nad.push({ id: 'e', d: 'תיאור ה', category: 'saf' });
    const withE = _ncrFbExamples({ id: 'x', category: 'saf' }).up.map((e) => e.id);
    _naf.c = { version: 1, feedback: null }; // un-rated c in this session
    const noC = _ncrFbExamples({ id: 'x', category: 'saf' }).up.map((e) => e.id);
    delete _naf.e; delete _naf.c;
    return { withE, noC };
  });
  check('a fresh 👍 is the newest example', sess.withE[0] === 'e', sess);
  check('removing a 👍 in this session drops it', sess.noC.indexOf('c') < 0, sess);

  console.log('\n4. the prompt');
  const pr = await page.evaluate(() => {
    _nad = _nad.filter((x) => x.id !== 'e');
    const p = _ncrFbPrompt({ id: 'x', category: 'saf' });
    const saveFb = _naFb, saveNaf = _naf; _naFb = []; _naf = {};
    const none = _ncrFbPrompt({ id: 'x', category: 'saf' });
    _naFb = saveFb; _naf = saveNaf;
    return { p, none };
  });
  check('rated GOOD section with the examples', /rated GOOD/.test(pr.p) && /עמוק ג/.test(pr.p) && /תיאור ג/.test(pr.p), pr.p.substring(0, 300));
  check('rated NOT GOOD section', /rated NOT GOOD/.test(pr.p) && /שטחי/.test(pr.p), pr.p);
  check('no ratings = nothing added (the prompt as before)', pr.none === '', pr.none);

  console.log('\n5. _ncrAI sends it');
  const sent = await page.evaluate(() => new Promise((res) => {
    ['docs','auds','ncr','inc','tr','rsk','emp','ptw','ppe','ctr','equip_inspections','near_miss','rounds','tasks','locations','projects','inspection_types','env_aspects','leg','hzm','wst','env','ins','drl','med','hearing_tests','toolbox'].forEach(k => { if (!DB[k]) DB[k] = []; });
    window._currentUser = { username: 'admin' }; _applyRoleGates();
    const keepNad = _nad.slice(), keepFb = _naFb;
    window._ncrLoad = function () { _nad = keepNad; _naf = {}; _ncrRender(); };
    window._ncrLoadAI = function () {}; window._ncrPatternsLoad = function () {};
    openNCRAgent(); _naFb = keepFb;
    const real = window.fetch; let prompt = null;
    window.fetch = function (url, opts) {
      if (String(url).indexOf('/api/claude') >= 0) { prompt = JSON.parse(opts.body).messages[0].content; window.fetch = real; res({ prompt }); return new Promise(() => {}); }
      return real.apply(this, arguments);
    };
    _ncrAI('x');
    setTimeout(() => res({ prompt }), 1500);
  }));
  check('the request to the AI includes the rated examples before the schema', sent.prompt && /rated GOOD/.test(sent.prompt) && sent.prompt.indexOf('rated GOOD') < sent.prompt.indexOf('Schema'), sent.prompt && sent.prompt.substring(0, 200));

  check('no page errors', errors.length === 0, errors);
  await browser.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
