// BACKLOG 15, second part: an incident with no severity or no lost days is
// "missing data", not "קל" / 0. The incidents screen counts them in a pill that
// opens the oldest for editing; a new incident needs a severity; an empty
// lost-days field is saved as null (svInc saved it as 0 until 01/10/2026);
// the capture card fills the real i-* form fields.
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
    ['docs','auds','ncr','inc','tr','rsk','emp','ptw','ppe','ctr','equip_inspections','near_miss','rounds','tasks','locations','projects','inspection_types'].forEach(k => { if (!DB[k]) DB[k] = []; });
    try { localStorage.removeItem(_INC_DRAFT_KEY); } catch (e) {}
    DB.inc = [
      { id: 'full', d: 'חתך', dt: '2025-03-01T08:00:00+00:00', sv: 'קל', dy: 0, s: 'סגור' },
      { id: 'nody', d: 'מעידה', dt: '2025-02-01T08:00:00+00:00', sv: 'קל', dy: null, s: 'סגור' },
      { id: 'nosv', d: 'נפילה', dt: '2024-01-01T08:00:00+00:00', sv: null, dy: 3, s: 'סגור' },
    ];
    window.__alerts = []; window.alert = (m) => window.__alerts.push(String(m));
    window.__ins = []; window.sbIns = function (t, r) { window.__ins.push(JSON.parse(JSON.stringify(r))); };
    window.__upd = []; window.sbUpd = function (t, r) { window.__upd.push(JSON.parse(JSON.stringify(r))); };
    window.sdb = function () {}; window.toast = function () {};
  });

  console.log('\n1. the "חסרים נתונים" pill');
  {
    const r = await page.evaluate(() => {
      rInc();
      const pill = Array.from(document.querySelectorAll('#inc-summary span')).find(s => /חסרים נתונים/.test(s.textContent));
      const cells = Array.from(document.querySelectorAll('#tb-inc tr')).map(tr => tr.children[4] ? tr.children[4].textContent : '');
      if (pill) pill.click();
      return { txt: pill ? pill.textContent : '', open: document.getElementById('m-inc').style.display === 'block', id: g('i-id').value, cells };
    });
    check('counts the two incidents without sv or dy', /חסרים נתונים: 2/.test(r.txt), r.txt);
    check('click opens the oldest (nosv, 2024) for editing', r.open && r.id === 'nosv', r);
    check('an unknown dy shows "?", a real 0 shows 0', r.cells.includes('?') && r.cells.includes('0'), r.cells);
  }

  console.log('\n2. editing an old incident without sv is allowed, and keeps it empty');
  {
    const r = await page.evaluate(() => { window.__alerts = []; window.__upd = []; svInc(); return { alerts: window.__alerts, saved: window.__upd[0] }; });
    check('no alert, saved', !r.alerts.length && r.saved && r.saved.id === 'nosv', r);
    check('sv stays empty (not "קל"), dy 3 kept', !r.saved.sv && r.saved.dy === 3, r.saved);
  }

  console.log('\n3. an empty dy is saved as null, not 0');
  {
    const r = await page.evaluate(() => { window.__upd = []; editInc('nody'); svInc(); return window.__upd[0]; });
    check('nody edited: dy null', r && r.dy === null, r);
  }

  console.log('\n4. a new incident needs a severity');
  {
    const r = await page.evaluate(() => {
      editInc('full'); closeModal('m-inc');
      openNewIncModal();
      const sv0 = g('i-sv').value;
      g('i-d').value = 'אירוע חדש';
      window.__alerts = []; window.__ins = []; svInc();
      const blocked = { alerts: window.__alerts.slice(), ins: window.__ins.length };
      g('i-sv').value = 'בינוני'; svInc();
      return { sv0, blocked, rec: window.__ins[0] };
    });
    check('the new form starts with no severity (not the last edited "קל")', r.sv0 === '', r.sv0);
    check('saving without it alerts "יש לבחור חומרה" and saves nothing', /יש לבחור חומרה/.test(r.blocked.alerts.join()) && r.blocked.ins === 0, r.blocked);
    check('with it: saved, dy null', r.rec && r.rec.sv === 'בינוני' && r.rec.dy === null, r.rec);
  }

  console.log('\n5. the capture card fills the incident form');
  {
    const src = require('fs').readFileSync(path.resolve(__dirname, '../../index.html'), 'utf8');
    check('no _setIf on the nonexistent inc-* ids', !/_setIf\('inc-(dt|d|sv|l|r)'/.test(src));
    check('openModal("m-inc") only in openNewIncModal and editInc (lesson 23)', (src.match(/openModal\('m-inc'\)/g) || []).length === 2);
    check('the inc case opens through openNewIncModal (clears i-id)', /case 'inc':\s*\n(\s*\/\/.*\n)*\s*openNewIncModal\(\);\s*\n\s*_setIf\('i-dt'/.test(src));
  }

  check('no page errors', !errs.length, errs);
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  await browser.close();
  process.exit(fail ? 1 : 0);
})();
