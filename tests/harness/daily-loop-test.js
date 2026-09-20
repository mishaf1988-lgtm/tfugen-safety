// The five things Michael touches every morning, each of which was quietly
// wrong. None of them threw, none of them looked broken; they just answered
// the wrong question.
//
// 2.1  "☀ סבב בוקר" in the Today list opened m-round directly, skipping
//      _roundOpenNew — the only function that fills the theme select and the
//      checklist. The modal opened empty.
// 2.2  «משימות להיום» filtered r.due === today, so everything already overdue
//      was hidden from the one list meant to show what is late.
// 2.3  The 📝 badge compared a Hebrew assignee name against an email, three
//      different ways, all of which fail. It was always 0.
// 2.4  The daily notification scan kept its "already ran" flag in
//      sessionStorage. In a PWA on an iPhone every cold open is a new session,
//      so the same toasts repeated all day — and round_missed could never fire
//      at all on a day the app was first opened before 11:00.
// 2.5  The 7-day lookahead card scanned ppe/tr/docs/ctr and not
//      equip_inspections — the statutory table, the one with legal exposure.
const path = require('path');
let pw; try { pw = require('playwright'); } catch (e) { pw = require('playwright-core'); }
const HTML = 'file://' + path.resolve(__dirname, '../../index.html');
let pass = 0, fail = 0;
const check = (l, c, d) => { if (c) { pass++; console.log('  ✓ ' + l); } else { fail++; console.log('  ✗ ' + l + (d !== undefined ? '  -> ' + JSON.stringify(d) : '')); } };

(async () => {
  const browser = await pw.chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, locale: 'he-IL' });
  const page = await ctx.newPage();
  page.on('dialog', (d) => d.accept().catch(() => {}));
  await page.route('**/*', (r) => r.request().url().startsWith('file://') ? r.continue() : r.abort());
  await page.goto(HTML, { waitUntil: 'load' });
  await page.waitForTimeout(700);

  await page.evaluate(() => {
    document.getElementById('login').style.display = 'none';
    document.getElementById('app').style.display = 'block';
    window._currentUser = { username: 'admin', full_name: 'מיכאל פרייליך' };
    _isAdmin = true; _applyRoleGates();
    window.sbIns = function () {}; window.sbUpd = function () {};
    window.sdb = function () {}; window.addLog = function () {};
    window.__toasts = []; window.toast = function (m) { window.__toasts.push(String(m)); };
    window.__events = [];
    window._notifyEvent = function (ev, p) { window.__events.push({ ev: ev, p: p }); };
    window.__iso = (d) => new Date(Date.now() + d * 864e5).toISOString().split('T')[0];
    // the user-email element _svUser reads
    const ue = document.getElementById('user-email');
    if (ue) ue.textContent = 'admin@tfugen.local';
  });

  console.log('\n2.1 the morning round opens ready to be filled in');
  {
    const r = await page.evaluate(() => {
      DB.rounds = []; DB.locations = [];
      closeModal('m-round');
      // blank the two things _roundOpenNew is responsible for populating
      const th = g('round-theme'); if (th) th.innerHTML = '';
      _todayClick('round');
      // _roundOpenNew fills the form inside a setTimeout, so read after a tick
      return new Promise(function (res) {
        setTimeout(function () {
          res({
            open: getComputedStyle(g('m-round')).display !== 'none',
            themes: (g('round-theme') || { options: [] }).options.length,
            items: (g('round-items-list') || { children: [] }).children.length,
            theme: (g('round-theme') || {}).value,
          });
        }, 150);
      });
    });
    check('the modal opens', r.open, r);
    check('the theme select is populated — it used to open empty', r.themes > 0, r.themes);
    check('and so is the checklist', r.items > 0, r.items);
    check('...on the morning theme', r.theme === 'morning', r.theme);
  }

  console.log('\n2.2 «משימות להיום» includes what is already late');
  {
    const r = await page.evaluate(() => {
      DB.tasks = [
        { id: 'o1', title: 'מעקה', status: 'פתוח', due: __iso(-9), assignee: 'דני', priority: 'רגיל' },
        { id: 'o2', title: 'מטף', status: 'פתוח', due: __iso(-2), assignee: 'דני', priority: 'רגיל' },
        { id: 't1', title: 'סיור', status: 'פתוח', due: __iso(0), assignee: 'דני', priority: 'רגיל' },
        { id: 'f1', title: 'עתידי', status: 'פתוח', due: __iso(5), assignee: 'דני', priority: 'רגיל' },
        { id: 'd1', title: 'בוצע', status: 'הושלם', due: __iso(-1), assignee: 'דני', priority: 'רגיל' },
      ];
      ['ppe', 'tr', 'docs', 'ctr', 'equip_inspections', 'ncr', 'inc', 'near_miss', 'inspection_types'].forEach((t) => { DB[t] = []; });
      goPage('tasks'); tskFilter('today');
      const txt = g('tb-tasks-cards').textContent;
      return {
        overdue: ['מעקה', 'מטף'].filter((n) => txt.indexOf(n) >= 0),
        today: txt.indexOf('סיור') >= 0,
        future: txt.indexOf('עתידי') >= 0,
        done: txt.indexOf('בוצע') >= 0,
      };
    });
    check('both overdue tasks are there — they used to be hidden', r.overdue.length === 2, r.overdue);
    check('today’s task is there too', r.today, r);
    check('a task due in five days is NOT', !r.future, r);
    check('a completed one is NOT', !r.done, r);
  }

  console.log('\n2.3 the 📝 badge counts the tasks that are actually mine');
  {
    const r = await page.evaluate(() => {
      DB.tasks = [
        { id: 'm1', title: 'א', status: 'פתוח', assignee: 'מיכאל פרייליך' },
        { id: 'm2', title: 'ב', status: 'בטיפול', assignee: 'admin' },
        { id: 'x1', title: 'ג', status: 'פתוח', assignee: 'דני' },
        { id: 'x2', title: 'ד', status: 'הושלם', assignee: 'מיכאל פרייליך' },
      ];
      _dashBadges();
      const b = g('my-tasks-badge');
      return { text: b && b.textContent, names: _meNames() };
    });
    check('the full name, the username and the email local part all count as me', r.names.length >= 2, r.names);
    check('the badge shows 2 — it was stuck on 0 for every Hebrew name', r.text === '2', r);

    const notMine = await page.evaluate(() => ({
      other: _isMine('דני'), mine: _isMine('מיכאל פרייליך'),
      partial: _isMine('מיכאל'),      // a different person with a shorter name
      blank: _isMine(''),
    }));
    check('someone else’s task is not mine', !notMine.other, notMine);
    check('mine is mine', notMine.mine, notMine);
    check('a blank assignee is nobody’s', !notMine.blank, notMine);
    check('the match is exact, not a substring — "מיכאל" alone is a different person', !notMine.partial, notMine);
  }

  console.log('\n2.4 the daily scan runs once a day, not once per cold open');
  {
    const r = await page.evaluate(() => {
      const day = new Date().toISOString().substring(0, 10);
      try { localStorage.removeItem('tfgn_notif_' + day); localStorage.removeItem('tfgn_round_missed_' + day); } catch (e) {}
      try { sessionStorage.clear(); } catch (e) {}
      DB.tasks = [{ id: 'x', title: 'באיחור', status: 'פתוח', due: __iso(-30), assignee: 'דני' }];
      ['ppe', 'tr', 'docs', 'ctr', 'equip_inspections'].forEach((t) => { DB[t] = []; });
      DB.ncr = []; DB.inc = []; DB.rounds = [];
      window.__events = [];
      _notifDailyScan();
      const first = window.__events.length;
      // a cold open of the PWA: new session, same day
      try { sessionStorage.clear(); } catch (e) {}
      window.__events = [];
      _notifDailyScan();
      const second = window.__events.length;
      return { first: first, second: second, flag: !!localStorage.getItem('tfgn_notif_' + day) };
    });
    check('the first scan of the day fires', r.first > 0, r);
    check('the flag is in localStorage, which survives a cold open', r.flag, r);
    check('a second cold open the same day fires nothing — it used to repeat every time', r.second === 0, r);

    const rm = await page.evaluate(() => {
      const day = new Date().toISOString().substring(0, 10);
      try { localStorage.removeItem('tfgn_notif_' + day); localStorage.removeItem('tfgn_round_missed_' + day); } catch (e) {}
      DB.rounds = [];
      // the app was opened early: the main scan marks itself done before 11:00
      localStorage.setItem('tfgn_notif_' + day, '1');
      window.__events = [];
      _roundMissedScan();
      const fired = window.__events.filter((e) => e.ev === 'round_missed').length;
      window.__events = [];
      _roundMissedScan();                       // and not a second time
      return { fired: fired, again: window.__events.length, hour: new Date().getHours() };
    });
    if (rm.hour >= 11) {
      check('«סבב חסר» fires even though the main scan already ran this morning', rm.fired === 1, rm);
      check('...and only once', rm.again === 0, rm);
    } else {
      check('before 11:00 it deliberately stays quiet', rm.fired === 0, rm);
    }
  }

  console.log('\n2.5 the 7-day card looks at the statutory equipment too');
  {
    const r = await page.evaluate(() => {
      DB.tasks = []; DB.ncr = []; DB.inc = []; DB.near_miss = []; DB.rounds = [];
      ['ppe', 'tr', 'docs', 'ctr'].forEach((t) => { DB[t] = []; });
      DB.tr = [{ id: 'tr1', n: 'עבודה בגובה', w: 'דני', e: __iso(5) }];
      DB.equip_inspections = [
        { id: 'e1', n: 'מלגזה 4', code: 'MLG-4', e: __iso(4) },
        { id: 'e2', n: 'מנוף צריח', code: 'CRN-1', e: __iso(40) },
      ];
      goPage('dash');
      const t = (g('dash-week') || {}).textContent || '';
      return { txt: t };
    });
    check('a forklift inspection lapsing in four days is on the card', /מלגזה 4/.test(r.txt), r.txt.slice(0, 220));
    check('it is labelled as an equipment inspection', /בדיקת ציוד/.test(r.txt), r.txt.slice(0, 220));
    check('the training expiring in five days is still there', /עבודה בגובה/.test(r.txt), r.txt.slice(0, 220));
    check('one lapsing in forty days is not', !/מנוף צריח/.test(r.txt), r.txt.slice(0, 220));
  }

  await browser.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('HARNESS ERROR', e); process.exit(2); });
