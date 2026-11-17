// Height-work approvals are shown but not scored (17/11/2026, Michael: "I want it shown, but not counted").
// Renders the real index.html, seeds expired training rows, and reads the home safety score.
const path = require('path');
let pw;
try { pw = require('playwright'); } catch (e) { pw = require('playwright-core'); }
const HTML = 'file://' + path.resolve(__dirname, '../../index.html');
let pass = 0, fail = 0;
function check(label, cond, detail) {
  if (cond) { pass++; console.log('  ✓ ' + label); }
  else { fail++; console.log('  ✗ ' + label + (detail !== undefined ? '  -> ' + JSON.stringify(detail) : '')); }
}
const HEIGHT = 'עבודה בגובה';
const FIRE = 'כיבוי אש';
function rows(name, n) {
  const out = [];
  for (let i = 0; i < n; i++) out.push({ id: name + i, w: 'w' + i, n: name, d: '2024-01-01', e: '2025-01-01', s: 'הושלם' });
  return out;
}
async function score(page, tr) {
  return page.evaluate((tr) => {
    const lg = document.getElementById('login'); if (lg) lg.style.display = 'none';
    const app = document.getElementById('app'); if (app) app.style.display = 'block';
    ['docs','auds','ncr','inc','tr','rsk','emp','ptw','ppe','ctr','equip_inspections','tasks'].forEach(k => { DB[k] = []; });
    DB.tr = tr;
    window.CUR = 'dash'; goPage('dash'); rDash();
    const t = (document.getElementById('dash-health') || {}).textContent || '';
    const m = t.match(/(\d+)\/100/);
    const dept = typeof _trByDept === 'function' ? _trByDept() : null;
    const tip = (document.querySelector('#dash-health [title]') || {}).title || t;
    return { score: m ? +m[1] : null, deptTotal: dept ? dept.reduce((s, r) => s + r.total, 0) : null, tip };
  }, tr);
}
(async () => {
  const browser = await pw.chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  const page = await (await browser.newContext({ viewport: { width: 375, height: 812 } })).newPage();
  await page.route(/^https?:\/\//, r => r.abort());
  await page.goto(HTML);
  await page.waitForFunction(() => typeof rDash === 'function' && typeof DB === 'object');
  // pairs: names that must count as height approvals, and names that must not
  const pairs = await page.evaluate(() => {
    const yes = ['\u05e2\u05d1\u05d5\u05d3\u05d4 \u05d1\u05d2\u05d5\u05d1\u05d4', '\u05d0\u05d9\u05e9\u05d5\u05e8 \u05e2\u05d1\u05d5\u05d3\u05d4 \u05d1\u05d2\u05d5\u05d1\u05d4 - \u05e8\u05e2\u05e0\u05d5\u05df', '\u05d4\u05d3\u05e8\u05db\u05ea \u05d2\u05d5\u05d1\u05d4'];
    const no = ['\u05db\u05d9\u05d1\u05d5\u05d9 \u05d0\u05e9', '\u05de\u05dc\u05d2\u05d6\u05d4', '\u05e2\u05d6\u05e8\u05d4 \u05e8\u05d0\u05e9\u05d5\u05e0\u05d4'];
    return { yes: yes.map(n => _trNoScore({ n })), no: no.map(n => _trNoScore({ n })), empty: _trNoScore(null) };
  });
  check('3 height names are not scored', pairs.yes.every(Boolean), pairs);
  check('3 other trainings are scored, and an empty row is safe', pairs.no.every(x => !x) && pairs.empty === false, pairs);
  const h = await score(page, rows(HEIGHT, 11));
  check('11 expired height approvals: score stays 100', h.score === 100, h);
  check('height approvals are not in the department percentages', h.deptTotal === 0, h);
  check('the score detail says they are shown and not counted', /לא נחשבים/.test(h.tip) && /11/.test(h.tip), h.tip.slice(0, 300));
  const f = await score(page, rows(FIRE, 11));
  check('11 expired other trainings still cost 20 points', f.score === 80, f);
  check('other trainings stay in the department percentages', f.deptTotal === 11, f);
  await browser.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
