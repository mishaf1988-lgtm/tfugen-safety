// 05/11/2026 (Michael in the questionnaire: "do it: a reset button for the admin"; retro 14/10/2026):
// a trainer signature saved by mistake is cleared by the admin from the training form. The button shows only
// to the admin on a signed training; the reset empties trainer_sig_url and trainer_signed_at, writes an audit
// row with the old file, and the trainer may sign again (signTrainer signs only where trainer_signed_at is null).
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
  const r = await page.evaluate(() => {
    window.sdb = function () {}; window.rTbt = function () {};
    const upd = [], toasts = []; let asked = 0;
    window.sbUpd = (t, x) => upd.push([t, JSON.parse(JSON.stringify(x))]);
    window.toast = (m) => toasts.push(String(m));
    window.confirm = () => { asked++; return true; };
    _currentUser = { username: 'admin' };
    localStorage.setItem('tfgn_outbox', '[]');
    const row = { id: 'ann-2026', kind: 'annual', trainer: 'x', trainer_signed_at: '2026-10-20T08:00:00Z', trainer_sig_url: 'https://h/storage/v1/object/public/b/sig-ann-2026-trainer-1.png', eff_by: 'x' };
    DB.toolbox_talks = [row];
    const btn = () => document.getElementById('tbt-trsig-reset').style.display;
    const o = {};
    _isAdmin = false; _tbtTypedFill(row); o.hiddenForNonAdmin = btn() === 'none';
    _tbtSigReset(); o.nonAdminRefused = row.trainer_signed_at !== null && upd.length === 0;
    _isAdmin = true; _tbtTypedFill(Object.assign({}, row, { trainer_signed_at: null })); o.hiddenUnsigned = btn() === 'none';
    _tbtTypedFill(Object.assign({}, row, { closed_at: '2026-10-21T08:00:00Z' })); o.hiddenClosed = btn() === 'none';
    _tbtTypedFill(row); o.shownForAdmin = btn() === 'inline-block';
    _svEditing.toolbox_talks = 'ann-2026';
    _tbtSigReset();
    const ob = JSON.parse(localStorage.getItem('tfgn_outbox') || '[]').filter((x) => x.tbl === 'audit_log');
    o.cleared = row.trainer_signed_at === null && row.trainer_sig_url === null && row.eff_by === null;
    o.saved = upd.length === 1 && upd[0][0] === 'toolbox_talks' && upd[0][1].trainer_signed_at === null;
    o.audit = ob.length === 1 && ob[0].row.source === 'trainer_sig_reset' && ob[0].row.record_id === 'ann-2026' && /sig-ann-2026-trainer-1\.png/.test(ob[0].row.title);
    o.asked = asked === 1;
    o.hiddenAfter = btn() === 'none';
    o.toast = toasts[toasts.length - 1];
    return o;
  });
  check('the button is hidden from a non-admin, and the reset refuses', r.hiddenForNonAdmin && r.nonAdminRefused, r);
  check('the button is hidden on an unsigned or a closed training, shown to the admin on a signed open one', r.hiddenUnsigned && r.hiddenClosed && r.shownForAdmin, r);
  check('the reset asks first, then clears the signature, its time and eff_by', r.asked && r.cleared, r);
  check('the row is saved through sbUpd', r.saved, r);
  check('an audit row names the reset and the old file', r.audit, r);
  check('after the reset the button is hidden and a toast says it', r.hiddenAfter && /אופסה/.test(r.toast || ''), r);
  check('no page errors', errors.length === 0, errors);
  await browser.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('HARNESS ERROR', e); process.exit(2); });
