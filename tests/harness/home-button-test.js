// One tap back to the home page, from any page. Covers the new 🏠 button, the
// logo that quietly did the same thing all along, and the top-bar reshuffle
// that made room for it on a phone (📝 steps aside, its count moves onto ☰).
const path = require('path');
let pw; try { pw = require('playwright'); } catch (e) { pw = require('playwright-core'); }
const HTML = 'file://' + path.resolve(__dirname, '../../index.html');
let pass = 0, fail = 0;
const check = (l, c, d) => { if (c) { pass++; console.log('  ✓ ' + l); } else { fail++; console.log('  ✗ ' + l + (d !== undefined ? '  -> ' + JSON.stringify(d) : '')); } };

const TASKS = [{ status: 'פתוח', assignee: 'admin' }, { status: 'פתוח', assignee: 'admin' }, { status: 'פתוח', assignee: 'admin' }];

(async () => {
  const browser = await pw.chromium.launch();
  const open = async (w, role) => {
    const ctx = await browser.newContext({ viewport: { width: w, height: 812 }, locale: 'he-IL' });
    const page = await ctx.newPage();
    await page.route('**/*', (r) => r.request().url().startsWith('file://') ? r.continue() : r.abort());
    await page.goto(HTML, { waitUntil: 'load' });
    await page.waitForTimeout(700);
    await page.evaluate((role) => {
      document.getElementById('login').style.display = 'none';
      document.getElementById('app').style.display = 'block';
      window._currentUser = { username: role === 'admin' ? 'admin' : role, role: role };
      _applyRoleGates(); goPage('dash');
    }, role || 'admin');
    return { ctx, page };
  };
  const vis = `(el)=>!!el&&getComputedStyle(el).display!=='none'&&el.getBoundingClientRect().width>0`;

  console.log('\n1. the button is there, and it goes home from anywhere');
  {
    const { ctx, page } = await open(375, 'admin');
    const there = await page.evaluate(`((v)=>{const b=document.getElementById('home-btn');return{exists:!!b,shown:v(b),title:b&&b.title,glyph:b&&b.textContent.trim()};})(${vis})`);
    check('a 🏠 button sits in the top bar with a "דף הבית" label', there.exists && there.shown && there.glyph === '\u{1F3E0}' && /דף הבית/.test(there.title), there);
    const pages = ['ncr', 'tasks', 'eqi', 'nm', 'trustees', 'docs'];
    const trip = await page.evaluate((pages) => pages.map((p) => {
      goPage(p); const from = CUR;
      document.getElementById('home-btn').click();
      return { from: from, to: CUR };
    }), pages);
    check('from ' + pages.length + ' different pages one tap lands on the dashboard', trip.every((t) => t.to === 'dash') && trip.map((t) => t.from).join() === pages.join(), trip);
    const scrolled = await page.evaluate(() => { goPage('ncr'); window.scrollTo(0, 400); const y = scrollY; document.getElementById('home-btn').click(); return { before: y, after: scrollY }; });
    check('it also scrolls back to the top, not just to the page', scrolled.after === 0, scrolled);
    await ctx.close();
  }

  console.log('\n2. the logo does the same thing, and now says so');
  {
    const { ctx, page } = await open(375, 'admin');
    const l = await page.evaluate(() => { goPage('eqi'); document.querySelector('.topbar-left').click(); return { cur: CUR, title: document.querySelector('.topbar-left').title }; });
    check('tapping the logo goes home too, and its tooltip reads דף הבית', l.cur === 'dash' && /דף הבית/.test(l.title), l);
    const frame = await page.evaluate(() => {
      const img = document.querySelector('.topbar-left img');
      const read = () => getComputedStyle(img).boxShadow;
      goPage('ncr'); const away = read();
      goPage('dash'); const home = read();
      return { away: away, home: home, onDash: document.body.classList.contains('on-dash') };
    });
    check('off the home page the logo gets a hairline frame — the hint that it is tappable', frame.away !== 'none' && /rgb/.test(frame.away), frame.away);
    check('on the home page the frame drops away (nowhere left to go)', frame.home === 'none' && frame.onDash, frame);
    await ctx.close();
  }

  console.log('\n3. room was made without shrinking the logo or losing the task count');
  {
    for (const w of [360, 375, 390, 414, 430]) {
      const { ctx, page } = await open(w, 'admin');
      const r = await page.evaluate(`((v)=>{DB.tasks=${JSON.stringify(TASKS)};_dashBadges();
        const tb=document.querySelector('.topbar');
        const img=tb.querySelector('.topbar-left img').getBoundingClientRect();
        const act=tb.querySelector('.topbar-actions').getBoundingClientRect();
        return {home:v(document.getElementById('home-btn')),tasksBtn:v(document.getElementById('my-tasks-btn')),
          menuBadge:v(document.getElementById('menu-tasks-badge'))?document.getElementById('menu-tasks-badge').textContent:null,
          tasksBadge:v(document.getElementById('my-tasks-badge'))?document.getElementById('my-tasks-badge').textContent:null,
          logoH:Math.round(img.height),gap:Math.round(act.left-img.right),overflow:tb.scrollWidth-tb.clientWidth};})(${vis})`);
      check(w + 'px: 🏠 shown, 📝 stepped aside, ☰ carries the count "3", logo still ' + r.logoH + 'px, nothing overflows',
        r.home && !r.tasksBtn && r.menuBadge === '3' && r.tasksBadge === null && r.logoH >= 48 && r.gap >= 0 && r.overflow === 0, r);
      await ctx.close();
    }
    for (const w of [431, 768]) {
      const { ctx, page } = await open(w, 'admin');
      const r = await page.evaluate(`((v)=>{DB.tasks=${JSON.stringify(TASKS)};_dashBadges();
        const tb=document.querySelector('.topbar');
        return {home:v(document.getElementById('home-btn')),tasksBtn:v(document.getElementById('my-tasks-btn')),
          menuBadge:v(document.getElementById('menu-tasks-badge')),
          tasksBadge:v(document.getElementById('my-tasks-badge'))?document.getElementById('my-tasks-badge').textContent:null,
          overflow:tb.scrollWidth-tb.clientWidth};})(${vis})`);
      check(w + 'px: there is room for both — 📝 is back with its own count, ☰ badge stays off', r.home && r.tasksBtn && r.tasksBadge === '3' && !r.menuBadge && r.overflow === 0, r);
      await ctx.close();
    }
  }

  console.log('\n4. the edges');
  {
    const { ctx, page } = await open(375, 'admin');
    const modal = await page.evaluate(() => {
      goPage('ncr'); openModal('m-ncr');
      const wasOpen = getComputedStyle(document.getElementById('m-ncr')).display !== 'none';
      goHome();
      return { wasOpen: wasOpen, stillOpen: getComputedStyle(document.getElementById('m-ncr')).display !== 'none', cur: CUR, bodyOverflow: document.body.style.overflow };
    });
    check('goHome() called with a form open closes it and releases the page scroll', modal.wasOpen && !modal.stillOpen && modal.cur === 'dash' && modal.bodyOverflow === '', modal);
    const twice = await page.evaluate(() => { goPage('dash'); const a = CUR; document.getElementById('home-btn').click(); return { a: a, b: CUR }; });
    check('tapping it while already home is harmless', twice.a === 'dash' && twice.b === 'dash', twice);
    await ctx.close();
  }
  {
    const { ctx, page } = await open(375, 'reporter');
    const r = await page.evaluate(() => { goPage('tasks'); document.getElementById('home-btn').click(); return { cur: CUR, shown: getComputedStyle(document.getElementById('home-btn')).display !== 'none' }; });
    check('a reporter sees it and lands on their dashboard', r.shown && r.cur === 'dash', r);
    await ctx.close();
  }
  {
    const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, locale: 'he-IL' });
    const page = await ctx.newPage();
    await page.route('**/*', (r) => r.request().url().startsWith('file://') ? r.continue() : r.abort());
    await page.goto(HTML, { waitUntil: 'load' }); await page.waitForTimeout(700);
    const emp = await page.evaluate(() => {
      document.body.classList.add('emp-mode');
      document.getElementById('login').style.display = 'none';
      document.getElementById('app').style.display = 'block';
      CUR = 'emp-home'; goPage('emp-home');
      const hb = document.getElementById('home-btn');
      const img = document.querySelector('.topbar-left img');
      window.scrollTo(0, 300);
      document.querySelector('.topbar-left').click();
      return { homeShown: getComputedStyle(hb).display !== 'none' && hb.getBoundingClientRect().width > 0, frame: getComputedStyle(img).boxShadow, cur: CUR, y: scrollY };
    });
    check('in trustee mode the top bar stays clean — no 🏠, no frame on the logo', !emp.homeShown && emp.frame === 'none', emp);
    check('and the logo there still just returns to the top of the trustee screen', emp.cur === 'emp-home' && emp.y === 0, emp);
    await ctx.close();
  }

  await browser.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('HARNESS ERROR', e); process.exit(2); });
