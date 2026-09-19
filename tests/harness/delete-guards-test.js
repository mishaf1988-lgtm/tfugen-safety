// Deleting used to be the least careful thing in the app:
//   * DEL_PW = '123456' was a literal in the page source, the only gate
//   * the confirmation never said WHAT was about to be destroyed — and the red
//     trash on the tasks page deletes the production NCR behind the row
//   * the audit log recorded "del | ncr | <uuid> | —", so an auditor could see
//     that something was destroyed but never what
//   * delAllHearing() wiped the whole statutory audiometric register behind one
//     confirm(), with no password and no export
const path = require('path');
let pw; try { pw = require('playwright'); } catch (e) { pw = require('playwright-core'); }
const HTML = 'file://' + path.resolve(__dirname, '../../index.html');
let pass = 0, fail = 0;
const check = (l, c, d) => { if (c) { pass++; console.log('  ✓ ' + l); } else { fail++; console.log('  ✗ ' + l + (d !== undefined ? '  -> ' + JSON.stringify(d) : '')); } };

(async () => {
  const browser = await pw.chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, locale: 'he-IL' });
  const page = await ctx.newPage();
  let prompts = [], answer = true;
  page.on('dialog', (d) => { prompts.push(d.message()); (answer ? d.accept() : d.dismiss()).catch(() => {}); });
  await page.route('**/*', (r) => r.request().url().startsWith('file://') ? r.continue() : r.abort());
  await page.goto(HTML, { waitUntil: 'load' });
  await page.waitForTimeout(700);

  const boot = () => page.evaluate(() => {
    document.getElementById('login').style.display = 'none';
    document.getElementById('app').style.display = 'block';
    window.__audit = [];
    window._obPush = function (op) { if (op.tbl === 'audit_log') window.__audit.push(op.row); };
    window.sdb = function () {};
    DB.ncr = [{ id: 'n1', num: 'NCR-0247', d: 'דלת חירום חסומה במחסן', s: 'פתוח' }];
    DB.tasks = [{ id: 'tk1', title: 'משימה רגילה', status: 'פתוח' }];
    DB.hearing_tests = [{ id: 'h1', n: 'לב', d: '2026-01-10', res: 'תקין' }, { id: 'h2', n: 'מוסא', d: '2026-02-11', res: 'ירידה קלה' }];
    try { localStorage.removeItem('tfgn_del_pw'); } catch (e) {}
    window._currentUser = { username: 'admin' }; _isAdmin = true;
    _applyRoleGates(); goPage('dash');
  });
  const modal = () => page.evaluate(() => ({
    what: (document.getElementById('del-what') || {}).innerText || '',
    warnShown: (() => { const w = document.getElementById('del-warn'); return !!w && getComputedStyle(w).display !== 'none'; })(),
    warn: (document.getElementById('del-warn') || {}).innerText || '',
    hintShown: (() => { const h = document.getElementById('del-pw-hint'); return !!h && getComputedStyle(h).display !== 'none'; })(),
  }));

  console.log('\n1. the confirmation says what is about to be destroyed');
  {
    await boot();
    await page.evaluate(() => askDel('ncr', 'n1'));
    const m = await modal();
    check('it names the record type and its title, not just an id', /אי-התאמה/.test(m.what) && /NCR-0247|דלת חירום/.test(m.what), m.what);
    check('a protected table gets a red warning that the row leaves the server too', m.warnShown && /אינה הפיכה/.test(m.warn), m);
    await page.evaluate(() => cancelDel());
  }

  console.log('\n2. the tasks-page trash reveals that it deletes the NCR itself');
  {
    await boot();
    // exactly what the virtual-task row's red button does
    await page.evaluate(() => askDel('ncr', 'n1'));
    const m = await modal();
    check('opening it from a task row still describes an אי-התאמה, so it cannot surprise', /אי-התאמה/.test(m.what) && m.warnShown, m.what);
    await page.evaluate(() => cancelDel());
    await page.evaluate(() => askDel('tasks', 'tk1'));
    const m2 = await modal();
    check('an ordinary task shows no such warning', /משימה/.test(m2.what) && !m2.warnShown, m2);
    await page.evaluate(() => cancelDel());
  }

  console.log('\n3. the audit log records WHAT was deleted');
  {
    await boot();
    const r = await page.evaluate(() => {
      sbDel('ncr', 'n1');
      return window.__audit.filter((a) => a.op === 'del');
    });
    check('one del entry was written', r.length === 1, r);
    check('it carries the record title, not null', r[0] && r[0].title && /NCR-0247|דלת/.test(r[0].title), r[0]);
    check('and still the table and id', r[0] && r[0].table_name === 'ncr' && r[0].record_id === 'n1', r[0]);
  }

  console.log('\n4. the password is no longer a constant in the page');
  {
    await boot();
    const r = await page.evaluate(() => ({ isDefault: _delPwIsDefault(), pw: _delPw() }));
    check('the shipped default still works, so nothing is locked out today', r.isDefault && r.pw === '123456', r);
    await page.evaluate(() => askDel('tasks', 'tk1'));
    const m = await modal();
    check('but the modal says the default is still in use', m.hintShown, m);
    await page.evaluate(() => cancelDel());
    const changed = await page.evaluate(() => {
      const ok = setDeletePassword('7788kk');
      return { ok: ok, now: _delPw(), isDefault: _delPwIsDefault() };
    });
    check('it can be changed per device', changed.ok === true && changed.now === '7788kk' && !changed.isDefault, changed);
    const short = await page.evaluate(() => setDeletePassword('12'));
    check('a too-short one is refused', short === false, short);
    await page.evaluate(() => askDel('tasks', 'tk1'));
    const m2 = await modal();
    check('and once changed, the hint goes away', !m2.hintShown, m2);
    const gate = await page.evaluate(() => {
      document.getElementById('del-pw').value = '123456'; confirmDel();
      const stillThere = !!DB.tasks.filter((t) => t.id === 'tk1')[0];
      document.getElementById('del-pw').value = '7788kk'; confirmDel();
      return { rejectedOld: stillThere, goneNow: !DB.tasks.filter((t) => t.id === 'tk1')[0] };
    });
    check('the old password is rejected and the new one works', gate.rejectedOld && gate.goneNow, gate);
  }

  console.log('\n5. the audiometric register is not a scratch list any more');
  {
    await boot(); prompts = []; answer = false;
    await page.evaluate(() => delAllHearing());
    await page.waitForTimeout(150);
    check('it warns this is statutory medical data and offers a backup first', /מעקב רפואי|חובת שמירה/.test(prompts[0] || '') && /גיבוי/.test(prompts[0] || ''), prompts[0]);
    check('it names the row count: 2', /2 רשומות/.test(prompts[0] || ''), prompts[0]);
    const after = await page.evaluate(() => DB.hearing_tests.length);
    check('declining keeps every row', after === 2, after);

    prompts = []; answer = true;
    const dl = [];
    page.on('download', (d) => dl.push(d.suggestedFilename()));
    await page.evaluate(() => delAllHearing());
    await page.waitForTimeout(250);
    const m = await modal();
    check('accepting does NOT delete yet — it opens the password gate', m.what.indexOf('שמיעה') >= 0 && (await page.evaluate(() => DB.hearing_tests.length)) === 2, m.what);
    check('...with the statutory warning shown', m.warnShown, m);
    const done = await page.evaluate(() => {
      document.getElementById('del-pw').value = '123456'; confirmDel();
      return { left: DB.hearing_tests.length, audits: window.__audit.filter((a) => a.op === 'del' && a.table_name === 'hearing_tests').length };
    });
    check('only after the password does it clear, and every row is logged', done.left === 0 && done.audits === 2, done);
  }

  await browser.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('HARNESS ERROR', e); process.exit(2); });
