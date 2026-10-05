// Trainer and qualification on every weekly talk (05/10/2026): the amended training
// regulations, in force 16/10/2026, want them in the training record. Required to
// publish (from the form and from the publish button), a draft may wait, a new talk
// starts with the last trainer, and the record ("who signed", its print) shows them.
const path = require('path');
let pw; try { pw = require('playwright'); } catch (e) { pw = require('playwright-core'); }
const HTML = 'file://' + path.resolve(__dirname, '../../index.html');
const COLS = require('./db-columns.json');
let pass = 0, fail = 0;
const check = (l, c, d) => { if (c) { pass++; console.log('  ✓ ' + l); } else { fail++; console.log('  ✗ ' + l + (d !== undefined ? '  -> ' + JSON.stringify(d) : '')); } };

(async () => {
  check('db-columns.json has trainer and trainer_qual', COLS.toolbox_talks.includes('trainer') && COLS.toolbox_talks.includes('trainer_qual'), COLS.toolbox_talks);
  const browser = await pw.chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 375, height: 812 }, locale: 'he-IL' })).newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('dialog', (d) => d.accept().catch(() => {}));
  await page.route('**/*', (r) => r.request().url().startsWith('file://') ? r.continue() : r.abort());
  await page.goto(HTML, { waitUntil: 'load' });
  await page.waitForTimeout(700);
  const r = await page.evaluate(() => {
    window.sdb = function () {}; window.addLog = function () {};
    const ins = [], upd = [], toasts = [];
    window.sbIns = (t, x) => ins.push(JSON.parse(JSON.stringify(x)));
    window.sbUpd = (t, x) => upd.push(JSON.parse(JSON.stringify(x)));
    window.toast = (m) => toasts.push(String(m));
    _currentUser = { username: 'admin' };
    DB.toolbox_reads = [];
    DB.toolbox_talks = [
      { id: 'a', d: '2026-09-20', title: 'ישן', body: 'x', s: 'פורסמה', trainer: 'דני', trainer_qual: 'מדריך עבודה בגובה', ts: '2026-09-20T08:00:00Z' },
      { id: 'b', d: '2026-09-27', title: 'אחרון', body: 'x', s: 'פורסמה', trainer: 'מיכאל פרייליך', trainer_qual: 'ממונה בטיחות מוסמך', ts: '2026-09-27T08:00:00Z' },
      { id: 'c', d: '2026-10-04', title: 'בלי מדריך', body: 'x', s: 'טיוטה' },
    ];
    goPage('toolbox');
    const o = {};
    openModal('m-tbt');
    o.prefill = [gv('tbt-trainer'), gv('tbt-trainer-q')];
    // publish a new talk without a trainer: refused, nothing saved
    document.getElementById('tbt-title').value = 'מלגזות';
    document.getElementById('tbt-body').value = 'מהירות';
    document.getElementById('tbt-trainer').value = '';
    document.getElementById('tbt-s').value = 'פורסמה';
    svTbt(); o.pubNoTrainer = [ins.length, toasts.slice(-1)[0]];
    // a draft may wait
    document.getElementById('tbt-s').value = 'טיוטה';
    svTbt(); o.draft = ins.slice(-1)[0];
    // with the trainer: published and stored
    openModal('m-tbt');
    document.getElementById('tbt-title').value = 'רעש';
    document.getElementById('tbt-body').value = 'אטמים';
    document.getElementById('tbt-s').value = 'פורסמה';
    svTbt(); o.pub = ins.slice(-1)[0];
    // the publish button: refused for a draft without a trainer
    tbtPublish('c'); o.btn = [DB.toolbox_talks.find((x) => x.id === 'c').s, toasts.slice(-1)[0]];
    // edit keeps the trainer in the form
    _genEdit('toolbox_talks', 'a'); o.edit = [gv('tbt-trainer'), gv('tbt-trainer-q')]; closeModal('m-tbt');
    // the record
    tbtWho('b'); o.who = document.getElementById('tbt-who-body').textContent;
    o.view = JSON.stringify((VIEW_CONFIG.toolbox_talks || {}).fields || []);
    return o;
  });
  check('a new talk starts with the last trainer and qualification', r.prefill[0] === 'מיכאל פרייליך' && r.prefill[1] === 'ממונה בטיחות מוסמך', r.prefill);
  check('publishing without a trainer is refused, with the reason', r.pubNoTrainer[0] === 0 && /16\/10\/2026/.test(r.pubNoTrainer[1]), r.pubNoTrainer);
  check('a draft without a trainer saves, trainer null (not "")', r.draft && r.draft.s === 'טיוטה' && r.draft.trainer === null, r.draft);
  check('a published talk stores trainer and qualification', r.pub && r.pub.trainer === 'מיכאל פרייליך' && r.pub.trainer_qual === 'ממונה בטיחות מוסמך', r.pub);
  check('the publish button refuses a talk without a trainer', r.btn[0] === 'טיוטה' && /המדריך/.test(r.btn[1]), r.btn);
  check('editing fills the trainer fields from the row', r.edit[0] === 'דני' && r.edit[1] === 'מדריך עבודה בגובה', r.edit);
  check('"who signed" (and its print) shows the trainer and qualification', /מדריך: מיכאל פרייליך, ממונה בטיחות מוסמך/.test(r.who), r.who.slice(0, 200));
  check('the view shows both fields', /trainer_qual/.test(r.view) && /"trainer"/.test(r.view), r.view);
  check('no page errors', errors.length === 0, errors);
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  await browser.close();
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('HARNESS ERROR', e); process.exit(2); });
