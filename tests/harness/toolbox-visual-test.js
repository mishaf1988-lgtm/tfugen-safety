// The manager's screens of the weekly talk as a phone shows them (03/10/2026,
// Michael: "2", the same measured check the worker's page got in
// talk-page-visual-test.mjs). At 375 pixels: the talks card, a new talk, the
// link dialog with its QR, "who signed", the employee card and the printout.
// For each: no sideways scroll, nothing off the screen, no button or field
// whose text is cut, no raw entity (&#...;) or "undefined" in what is shown.
// SHOTS=<dir> also saves a picture of each.
const path = require('path');
let pw; try { pw = require('playwright'); } catch (e) { pw = require('playwright-core'); }
const HTML = 'file://' + path.resolve(__dirname, '../../index.html');
let pass = 0, fail = 0;
const check = (l, c, d) => { if (c) { pass++; console.log('  ✓ ' + l); } else { fail++; console.log('  ✗ ' + l + (d !== undefined ? '  -> ' + JSON.stringify(d).slice(0, 500) : '')); } };

// Measured inside one root (a modal, or the page): what a person would see.
function measure(sel) {
  const W = window.innerWidth, root = sel ? document.querySelector(sel) : document.body;
  const out = { sw: document.documentElement.scrollWidth, off: [], cut: [], raw: [] };
  if (!root) return { missing: sel };
  const ctx = document.createElement('canvas').getContext('2d');
  root.querySelectorAll('input:not([type=hidden]),select,textarea,button,label,.b,h2,h3,.modal-title,.card-title').forEach((el) => {
    const r = el.getBoundingClientRect();
    if (!r.width || !el.offsetParent) return;
    // Inside a scrolling table box the box is what has to fit.
    const box = el.closest('.tbl-wrap');
    const lim = box ? box.getBoundingClientRect() : { left: 0, right: W };
    if (!box && (r.left < -1 || r.right > W + 1)) out.off.push((el.id || el.tagName + ':' + el.textContent.trim().slice(0, 18)) + ' ' + Math.round(r.left) + '..' + Math.round(r.right));
    if (box && (lim.left < -1 || lim.right > W + 1)) out.off.push('tbl-wrap ' + Math.round(lim.left) + '..' + Math.round(lim.right));
    const st = getComputedStyle(el);
    if (el.tagName === 'BUTTON' && el.scrollWidth > el.clientWidth + 1 && st.overflow !== 'visible') out.cut.push('button:' + el.textContent.trim().slice(0, 20));
    if (el.tagName === 'INPUT' && el.placeholder) {
      ctx.font = st.fontSize + ' ' + st.fontFamily;
      if (ctx.measureText(el.placeholder).width > el.clientWidth - parseFloat(st.paddingLeft) - parseFloat(st.paddingRight) + 1) out.cut.push('placeholder:' + (el.id || el.name));
    }
  });
  const txt = root.innerText || '';
  (txt.match(/&#\d+;|&[a-z]+;|\bundefined\b|\bNaN\b/g) || []).forEach((x) => out.raw.push(x));
  return out;
}
const fine = (m) => m && !m.missing && m.sw <= 375 && !m.off.length && !m.cut.length && !m.raw.length;

(async () => {
  const browser = await pw.chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, locale: 'he-IL', deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('dialog', (d) => d.accept().catch(() => {}));
  await page.route('**/*', (r) => r.request().url().startsWith('file://') ? r.continue() : r.abort());
  await page.goto(HTML, { waitUntil: 'load' });
  await page.waitForTimeout(700);
  const shots = process.env.SHOTS || '';
  const shot = async (n) => { if (shots) await page.screenshot({ path: shots + '/tbt-' + n + '.png', fullPage: true }); };
  await page.evaluate(() => {
    window._role = () => 'admin'; window._isAdminUser = () => true; window.sdb = function () {}; window.sbIns = function () {}; window.sbUpd = function () {}; window.addLog = function () {};
    window._currentUser = { username: 'admin' };
    document.getElementById('login').style.display = 'none'; document.getElementById('app').style.display = 'block';
    const now = new Date().toISOString();
    DB.emp = [{ id: 'e1', n: 'דנה כהן', dep: 'ייצור', eid: '012345678', s: '2026-01-01' }, { id: 'e2', n: 'אחמד חטיב', dep: 'ייצור' }, { id: 'e3', n: 'איוון פטרוב', dep: 'מחלקת אחזקה ותשתיות' }, { id: 'e4', n: 'משה לוי', dep: 'מחסן', left_d: '2026-09-01' }];
    DB.toolbox_talks = [
      { id: 't1', d: '2026-10-04', title: 'עבודה בגובה: רתמה, עיגון ונקודות עיגון מאושרות לפני כל עלייה לסולם או לבמה', body: '1. רתמה\n2. עיגון', body_ru: 'x', body_ar: 'y', body_am: 'z', s: 'פורסמה', link_at: now },
      { id: 't2', d: '2026-09-27', title: 'מלגזות', body: 'b', s: 'פורסמה', link_at: '2026-09-01T08:00:00Z' },
      { id: 't3', d: null, title: 'טיוטה בלי תאריך', body: 'c', s: 'טיוטה', ts: now },
    ];
    DB.toolbox_reads = [
      { id: 'r1', talk_id: 't1', emp_id: 'e1', emp_name: 'דנה כהן', id_no: '012345678', dept: 'ייצור', lang: 'he', device: 'phone', read_at: now, text_hash: 'old' },
      { id: 'r2', talk_id: 't1', emp_id: 'x:99887766:ivan', emp_name: 'איוון סמירנוב-קוזלובסקי', id_no: 'AB1234567', dept: 'קבלן ACME הנדסה ובניה', lang: 'ru', device: 'tablet', read_at: now },
      { id: 'r3', talk_id: 't1', emp_id: 'e4', emp_name: 'משה לוי', id_no: '33', dept: 'מחסן', lang: 'he', device: 'other', read_at: now },
    ];
    goPage('toolbox');
  });
  await page.waitForTimeout(300);

  let m = await page.evaluate(measure, '#tbt-card');
  check('the talks card fits, nothing cut', fine(m), m); await shot('card');

  await page.evaluate(() => openModal('m-tbt')); await page.waitForTimeout(200);
  m = await page.evaluate(measure, '#m-tbt');
  check('a new talk: the form fits, nothing cut', fine(m), m); await shot('new');
  await page.evaluate(() => closeModal('m-tbt'));

  await page.evaluate(() => {
    window.fetch = () => Promise.resolve(new Response(JSON.stringify({ url: 'https://tapugan-safety.pages.dev/api/talk?k=t1.abcdef.ghijklmnopqrstuvwxyz0123456789ABCDEFGH', days: 14, link_at: new Date().toISOString() }), { status: 200 }));
    window.qrcode = function () { return { addData() {}, make() {}, getModuleCount() { return 25; }, isDark(r, c) { return (r * c) % 3 === 0; } }; };
    return tbtLink('t1');
  });
  await page.waitForTimeout(300);
  m = await page.evaluate(measure, '#m-tbt-link');
  const qr = await page.evaluate(() => { const s = document.querySelector('#tbt-link-qr svg'); return s ? s.getBoundingClientRect().width : 0; });
  check('the link dialog fits, the QR is drawn and fits', fine(m) && qr > 150 && qr <= 375, [m, qr]); await shot('link');
  await page.evaluate(() => { closeModal('m-tbt-link'); document.querySelectorAll('.toast').forEach((t) => t.remove()); });

  await page.evaluate(() => tbtWho('t1')); await page.waitForTimeout(300);
  m = await page.evaluate(measure, '#m-tbt-who');
  check('"who signed" fits (a wide table scrolls inside its box), nothing cut', fine(m), m); await shot('who');

  const [pop] = await Promise.all([page.waitForEvent('popup'), page.evaluate(() => { window.print = function () {}; tbtWhoPrint(); })]);
  await pop.setViewportSize({ width: 375, height: 812 }); await pop.waitForTimeout(300);
  const pm = await pop.evaluate(measure, null);
  check('the printout on a phone fits, nothing cut', fine(pm), pm);
  if (shots) await pop.screenshot({ path: shots + '/tbt-print.png', fullPage: true });
  await pop.close();
  await page.evaluate(() => closeModal('m-tbt-who'));

  await page.evaluate(() => showView('emp', 'e1')); await page.waitForTimeout(300);
  m = await page.evaluate(measure, '#emp-talks');
  check('the employee card\'s weekly talks fit, nothing cut', fine(m), m); await shot('emp');

  await page.evaluate(() => { goPage('emp'); }); await page.waitForTimeout(200);
  m = await page.evaluate(measure, '#tb-emp');
  check('the employee list (with one who left) fits', fine(m), m);
  await page.evaluate(() => _genEdit('emp', 'e4')); await page.waitForTimeout(200);
  m = await page.evaluate(measure, '#m-emp');
  check('the employee form with the leaving date fits', fine(m), m); await shot('emp-form');

  check('no page errors', errors.length === 0, errors);
  await browser.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('HARNESS ERROR', e); process.exit(2); });
