// BACKLOG 9.1, the code part: a statutory register with zero rows raises no
// expiry, so after the 18/09 reset the expiries page and the dashboard looked
// "all clear". Now both show one red line naming the empty registers, each a
// link to its page. Not before the sync (SB_ON), so an empty cache is no alarm.
const path = require('path');
let pw; try { pw = require('playwright'); } catch (e) { pw = require('playwright-core'); }
const HTML = 'file://' + path.resolve(__dirname, '../../index.html');
let pass = 0, fail = 0;
const check = (l, c, d) => { if (c) { pass++; console.log('  ✓ ' + l); } else { fail++; console.log('  ✗ ' + l + (d !== undefined ? '  -> ' + JSON.stringify(d) : '')); } };

(async () => {
  const browser = await pw.chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: 'he-IL' })).newPage();
  await page.route('**/*', (r) => r.request().url().startsWith('file://') ? r.continue() : r.abort());
  const errs = [];
  page.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
  await page.goto(HTML, { waitUntil: 'load' });
  await page.waitForTimeout(1000);
  await page.evaluate(() => {
    const lg = document.getElementById('login'); if (lg) lg.style.display = 'none';
    const app = document.getElementById('app'); if (app) app.style.display = 'block';
    ['docs','auds','ncr','inc','tr','rsk','emp','ptw','ppe','ctr','hzm','equip_inspections','hearing_tests','near_miss','rounds','tasks','locations','projects','inspection_types'].forEach(k => { DB[k] = []; });
    try { Object.keys(localStorage).filter(k => k.indexOf('tfgn_alert_dism_') === 0).forEach(k => localStorage.removeItem(k)); } catch (e) {}
    window.sdb = function () {}; window.toast = function () {};
    window._role = function () { return 'admin'; }; window._isAdminUser = function () { return true; };
  });
  const state = () => page.evaluate(() => {
    rExp(); try { rDash(); } catch (e) { window.__dashErr = e.message; }
    const ex = document.getElementById('exp-empty-reg');
    const da = document.getElementById('dash-alerts');
    return { exp: ex ? ex.textContent : null, dash: da ? da.textContent : null, dashErr: window.__dashErr || null };
  });

  console.log('\n1. before the sync: no alarm');
  {
    const r = await page.evaluate(() => { SB_ON = false; return 1; }).then(state);
    check('expiries page: empty', r.exp === '', r);
    check('dashboard: no empty-register line', !/מרשמי? חובה/.test(r.dash || ''), r);
  }

  console.log('\n2. after the sync, all four empty');
  {
    const r = await page.evaluate(() => { SB_ON = true; return 1; }).then(state);
    check('rDash ran clean', !r.dashErr, r.dashErr);
    check('expiries page names all four', /מרשמי חובה ריקים/.test(r.exp) && ['בדיקות ציוד','בדיקות שמיעה','הדרכות','חומרים מסוכנים'].every(w => r.exp.includes(w)), r.exp);
    check('dashboard shows it too', /מרשמי חובה ריקים/.test(r.dash), r.dash);
  }

  console.log('\n3. one register left empty: singular, only it');
  {
    const r = await page.evaluate(() => {
      DB.tr = [{ id: 't1', n: 'x', e: '2027-01-01' }];
      DB.hzm = [{ id: 'h1', n: 'x' }];
      DB.hearing_tests = [{ id: 'a1', emp_name: 'x' }];
      return 1;
    }).then(state);
    check('singular text, names only equipment', /מרשם חובה ריק:/.test(r.exp) && r.exp.includes('בדיקות ציוד') && !r.exp.includes('הדרכות'), r.exp);
  }

  console.log('\n4. the link opens the register page');
  {
    const r = await page.evaluate(() => {
      goPage('exp');
      const a = document.querySelector('#exp-empty-reg a[data-pg]');
      if (a) a.click();
      const pg = document.getElementById('pg-eqi');
      return { pg: a && a.dataset.pg, active: !!(pg && pg.classList.contains('on')) };
    });
    check('link points at eqi and opens it', r.pg === 'eqi' && r.active, r);
  }

  console.log('\n5. dismiss on the dashboard holds for today; nothing empty = nothing shown');
  {
    const r = await page.evaluate(() => {
      _dismissAlert('emptyreg'); rDash();
      const dism = document.getElementById('dash-alerts').textContent;
      DB.equip_inspections = [{ id: 'q1', n: 'x', e: '2027-01-01' }];
      rExp();
      return { dism, exp: document.getElementById('exp-empty-reg').textContent };
    });
    check('dismissed: gone from the dashboard', !/מרשם חובה/.test(r.dism), r.dism);
    check('all filled: expiries page line gone', r.exp === '', r.exp);
  }

  check('no page errors', !errs.length, errs);
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  await browser.close();
  process.exit(fail ? 1 : 0);
})();
