// Four things about what the screen tells you, and what it does not.
//
// 1.14 Opening an NCR on an oil leak at filling station 3 told Michael
//      nothing about it being the fourth time this year at that station. He
//      writes a local root cause, closes it, and it comes back — which is
//      exactly the difference between a repair and the corrective action
//      §10.2 asks for. The only recurrence detection in the file was for
//      equipment inspections, and it never ran on DB.ncr.
//
// 1.15 Reopening an NCR wrote a line into notes and nothing else. So an NCR
//      that closed, reopened, closed and reopened again looks in every report
//      exactly like any other closed one — the false success counted twice.
//      «כמה מהפעולות המתקנות שלכם לא עבדו?» could only be answered by reading
//      375 notes fields by hand.
//
// 2.8  The bell opened the SETTINGS screen and looked identical whether
//      something had happened or not: no unread state anywhere, and a toast
//      that erases itself after 2.5 seconds. A missed toast — driving, screen
//      off, phone in a pocket — left no sign at all. (The history WAS there,
//      three taps deep inside a screen called "settings".)
//
// 2.11 ~20 statistics cards below «היום», and the section title that was
//      supposed to group them was a label, not a switch — and five of the
//      stat cards sat above it, so folding under it would not have caught them.
const path = require('path');
let pw; try { pw = require('playwright'); } catch (e) { pw = require('playwright-core'); }
const HTML = 'file://' + path.resolve(__dirname, '../../index.html');
let pass = 0, fail = 0;
const check = (l, c, d) => { if (c) { pass++; console.log('  ✓ ' + l); } else { fail++; console.log('  ✗ ' + l + (d !== undefined ? '  -> ' + JSON.stringify(d) : '')); } };

(async () => {
  const browser = await pw.chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, locale: 'he-IL' });
  const page = await ctx.newPage();
  const prompts = [];
  page.on('dialog', async (d) => { prompts.push(d.message()); await d.accept('חזר שוב באותו מקום').catch(() => {}); });
  await page.route('**/*', (r) => r.request().url().startsWith('file://') ? r.continue() : r.abort());
  await page.goto(HTML, { waitUntil: 'load' });
  await page.waitForTimeout(700);

  await page.evaluate(() => {
    document.getElementById('login').style.display = 'none';
    document.getElementById('app').style.display = 'block';
    window._currentUser = { username: 'admin' }; _isAdmin = true; _applyRoleGates();
    window.sbIns = function () {}; window.sbUpd = function () {}; window.sdb = function () {}; window.addLog = function () {};
    window.__toasts = []; window.toast = function (m) { window.__toasts.push(String(m)); };
    window.__iso = (d) => new Date(Date.now() + d * 864e5).toISOString().split('T')[0];
    window.__blank = function () {
      ['ncr', 'inc', 'near_miss', 'tasks', 'rounds', 'toolbox', 'trustee_reports', 'ppe', 'tr',
       'docs', 'ctr', 'equip_inspections', 'med', 'emp', 'locations', 'notifications_log',
       'auds', 'rsk', 'ptw', 'hzm', 'leg', 'env_aspects', 'projects'].forEach((t) => { DB[t] = []; });
    };
  });

  console.log('\n1.14 the fourth time this year, at the same station');
  {
    const r = await page.evaluate(() => {
      __blank();
      DB.locations = [{ id: 'L1', name: 'עמדת מילוי 3', level: 1 }, { id: 'L2', name: 'מחסן', level: 1 }];
      DB.ncr = [
        { id: 'a', num: 'NCR-0010', d: 'נזילת שמן מהמשאבה', location_id: 'L1', s: 'סגור', sd: __iso(-300), cd: __iso(-280) },
        { id: 'b', num: 'NCR-0021', d: 'נזילת שמן על הרצפה', location_id: 'L1', s: 'סגור', sd: __iso(-120), cd: __iso(-100) },
        { id: 'c', num: 'NCR-0044', d: 'נזילת שמן מתחת למשאבה', location_id: 'L1', s: 'פתוח', sd: __iso(-30) },
        // same words, different area
        { id: 'd', num: 'NCR-0050', d: 'נזילת שמן מהמשאבה', location_id: 'L2', s: 'פתוח', sd: __iso(-20) },
        // same area, unrelated
        { id: 'e', num: 'NCR-0051', d: 'מעקה חסר במדרגות', location_id: 'L1', s: 'פתוח', sd: __iso(-10) },
        // same everything, but two years ago
        { id: 'f', num: 'NCR-0001', d: 'נזילת שמן מהמשאבה', location_id: 'L1', s: 'סגור', sd: __iso(-800), cd: __iso(-790) },
      ];
      const hits = _ncrSimilar({ id: 'new', d: 'נזילת שמן מהמשאבה', location_id: 'L1' }, 12);
      return { ids: hits.map((h) => h.id) };
    });
    check('three similar findings in the same area inside 12 months', r.ids.length === 3, r.ids);
    check('...the same words in a different area do not count', r.ids.indexOf('d') < 0, r.ids);
    check('...nor something unrelated in the same area', r.ids.indexOf('e') < 0, r.ids);
    check('...nor the same thing two years ago', r.ids.indexOf('f') < 0, r.ids);
    check('closed ones DO count — they are the recurrence', r.ids.indexOf('a') >= 0 && r.ids.indexOf('b') >= 0, r.ids);

    const banner = await page.evaluate(() => {
      openNewNcrModal();
      const before = g('ncr-repeat').style.display;
      g('ncr-location-id').value = 'L1';
      g('ncr-d').value = 'נזילת שמן מהמשאבה';
      _ncrRepeatBanner();
      const box = g('ncr-repeat');
      return { before: before, shown: box.style.display !== 'none', html: box.innerHTML };
    });
    check('a blank form shows no banner', banner.before === 'none', banner.before);
    check('...and one appears once the area and description are in', banner.shown, banner);
    check('it says how many and how many already closed', /3 אי-התאמות דומות/.test(banner.html) && /2 מהן כבר נסגרו/.test(banner.html), banner.html.slice(0, 200));
    check('...and names §10.2, which is what this is about', /10\.2/.test(banner.html), banner.html.slice(0, 300));
    check('each one is a link to the record itself', (banner.html.match(/showView\('ncr'/g) || []).length >= 3, banner.html.slice(-300));

    const legacy = await page.evaluate(() => {
      // the 375 imported rows carry free-text loc, not the FK
      DB.ncr = [
        { id: 'x1', num: 'N1', d: 'דליפה מהברז הראשי', loc: 'מחסן', s: 'סגור', sd: __iso(-60), cd: __iso(-50) },
        { id: 'x2', num: 'N2', d: 'דליפה מהברז האחורי', loc: 'מחסן', s: 'פתוח', sd: __iso(-20) },
      ];
      return _ncrSimilar({ id: 'new', d: 'דליפה מהברז הראשי', loc: 'מחסן' }, 12).map((h) => h.id);
    });
    check('an imported row keyed only by free-text loc is matched too', legacy.join() === 'x2,x1' || legacy.length === 2, legacy);

    const thin = await page.evaluate(() => {
      DB.ncr = [{ id: 'y1', d: 'תקלה', loc: 'מחסן', s: 'פתוח', sd: __iso(-10) }];
      return {
        shortDesc: _ncrSimilar({ id: 'n', d: 'תקלה', loc: 'מחסן' }, 12).length,
        noArea: _ncrSimilar({ id: 'n', d: 'נזילת שמן מהמשאבה הראשית' }, 12).length,
      };
    });
    check('a two-word description is too little signal to claim a recurrence', thin.shortDesc === 0, thin);
    check('...and with no area at all nothing is claimed', thin.noArea === 0, thin);
  }

  console.log('\n1.15 a corrective action that did not hold');
  {
    const r = await page.evaluate(() => {
      __blank();
      DB.ncr = [
        { id: 'r1', num: 'NCR-7', d: 'דליפה', s: 'סגור', cd: __iso(-10), notes: 'הערה\n[נפתח מחדש 01/02/2026 על ידי admin: חזר]\n[נפתח מחדש 01/05/2026 על ידי admin: חזר שוב]' },
        { id: 'r2', num: 'NCR-8', d: 'x', s: 'סגור', cd: __iso(-10), notes: 'הערה רגילה' },
        { id: 'r3', num: 'NCR-9', d: 'y', s: 'סגור', cd: __iso(-10) },
      ];
      return {
        two: _reopenCount(DB.ncr[0]),
        none: _reopenCount(DB.ncr[1]),
        noNotes: _reopenCount(DB.ncr[2]),
        all: _reopenedNcrs().map((n) => n.id),
      };
    });
    check('two reopen stamps are counted as two', r.two === 2, r.two);
    check('an ordinary note is not mistaken for one', r.none === 0, r.none);
    check('a record with no notes at all is zero, not an error', r.noNotes === 0, r.noNotes);
    check('...and the set of reopened NCRs is exactly the one', r.all.join() === 'r1', r.all);

    const live = await page.evaluate(() => {
      DB.ncr = [{ id: 'r4', num: 'NCR-10', d: 'דליפה', s: 'סגור', cd: __iso(-5), notes: '', verified_by: null }];
      _reopen('ncr', 'r4');
      return { count: _reopenCount(DB.ncr[0]), s: DB.ncr[0].s, notes: DB.ncr[0].notes };
    });
    await page.waitForTimeout(80);
    check('reopening a record through the app is counted', live.count === 1, live);
    check('...and it really did reopen', live.s === 'פתוח', live.s);

    const shown = await page.evaluate(() => {
      DB.ncr = [{ id: 'r5', num: 'NCR-11', d: 'דליפה', s: 'סגור', cd: __iso(-5), notes: '[נפתח מחדש 01/01/2026 על ידי admin: א]\n[נפתח מחדש 01/03/2026 על ידי admin: ב]' }];
      showView('ncr', 'r5');
      const box = g('view-reopen');
      return { has: !!box, text: box ? box.textContent : '' };
    });
    check('the record says so, rather than hiding it in the notes', shown.has, shown);
    check('...with the count and what it means', /2 פעמים/.test(shown.text) && /לא החזיקה/.test(shown.text), shown.text);

    const clean = await page.evaluate(() => {
      DB.ncr = [{ id: 'r6', num: 'NCR-12', d: 'x', s: 'סגור', cd: __iso(-5), notes: '' }];
      showView('ncr', 'r6');
      return !!g('view-reopen');
    });
    check('a record that never reopened gets no banner', !clean, clean);

    const iso = await page.evaluate(() => {
      DB.ncr = [
        { id: 'a', s: 'סגור', cd: __iso(-5), notes: '[נפתח מחדש 01/01/2026 על ידי admin: x]' },
        { id: 'b', s: 'סגור', cd: __iso(-5), notes: '' },
      ];
      const rows = _isoClauses();
      const c = rows.filter((x) => x.cl === '10.2')[0];
      return c ? (c.ev || JSON.stringify(c)) : '';
    });
    check('the ISO §10.2 line carries it — that clause exists to ask whether it worked', /1 נפתחו מחדש/.test(iso), iso);
  }

  console.log('\n2.8 the bell says whether anything happened');
  {
    const r = await page.evaluate(() => {
      __blank();
      try { localStorage.removeItem('tfgn_notif_seen_ts'); } catch (e) {}
      DB.notifications_log = [
        { id: 'l1', ts: '2026-09-19T08:00:00Z', event_type: 'task_overdue', channel: 'inapp', payload: { title: 'א' } },
        { id: 'l2', ts: '2026-09-20T08:00:00Z', event_type: 'ncr_critical', channel: 'inapp', payload: { title: 'ב' } },
      ];
      _notifBadge();
      const b = g('notif-badge');
      return { unread: _notifUnread(), shown: b.style.display !== 'none', text: b.textContent, title: g('notif-btn').title };
    });
    check('two notifications nobody has looked at read as two unread', r.unread === 2, r.unread);
    check('the bell carries a badge saying so', r.shown && r.text === '2', r);
    check('...and its tooltip says it too, for a screen reader', /2 התראות חדשות/.test(r.title), r.title);

    const opened = await page.evaluate(() => {
      openNotifCenter();
      return new Promise((res) => setTimeout(() => res({
        open: (g('notif-log-acc') || {}).open,
        modal: getComputedStyle(g('m-notif')).display !== 'none',
        unread: _notifUnread(),
        badge: g('notif-badge').style.display,
      }), 200));
    });
    check('the bell opens the log, not the settings screen', opened.modal && opened.open === true, opened);
    check('...and looking at it marks it read', opened.unread === 0 && opened.badge === 'none', opened);

    const later = await page.evaluate(() => {
      DB.notifications_log.push({ id: 'l3', ts: '2026-09-21T08:00:00Z', event_type: 'round_missed', channel: 'inapp', payload: {} });
      _notifBadge();
      return { unread: _notifUnread(), text: g('notif-badge').textContent };
    });
    check('a new one after that is unread again', later.unread === 1 && later.text === '1', later);

    const settings = await page.evaluate(() => {
      closeModal('m-notif');
      openNotifSettings();
      return { modal: getComputedStyle(g('m-notif')).display !== 'none', table: !!g('notif-table'), self: !!g('notif-self-wa') };
    });
    check('the settings are still there, in the same screen — nothing was taken away', settings.modal && settings.table && settings.self, settings);
    await page.evaluate(() => { closeModal('m-notif'); try { localStorage.removeItem('tfgn_notif_seen_ts'); } catch (e) {} });
  }

  console.log('\n2.11 the statistics fold away');
  {
    const r = await page.evaluate(() => {
      __blank();
      try { localStorage.removeItem('tfgn_dash_stats_open'); } catch (e) {}
      DB.ncr = [{ id: 'n1', num: 'N1', d: 'x', s: 'פתוח', sd: __iso(-5), location_id: null, loc: 'מחסן' }];
      DB.tasks = [{ id: 't1', title: 'x', status: 'פתוח', due: __iso(-2) }];
      goPage('dash');
      const title = g('dash-stats-title');
      const cards = [];
      let el = title.nextElementSibling;
      while (el && el.classList && el.classList.contains('card')) { cards.push({ id: el.id, shown: el.style.display !== 'none' }); el = el.nextElementSibling; }
      return {
        clickable: title.getAttribute('role') === 'button' && /_dashStatsToggle/.test(title.getAttribute('onclick') || ''),
        under: cards.map((c) => c.id),
        visible: cards.filter((c) => c.shown).length,
        chev: (g('dash-stats-chev') || {}).textContent,
      };
    });
    check('the section title is a switch, not just a label', r.clickable, r.clickable);
    check('the five stat cards that used to sit ABOVE it are now under it',
      ['dash-weekly-card', 'dash-month-card', 'dash-tsk-bd-card', 'dash-ncr-time-card', 'dash-totals-card'].every((id) => r.under.indexOf(id) >= 0), r.under);
    check('something is visible to begin with', r.visible > 0, r.visible);
    check('and it starts open', /▾/.test(r.chev || ''), r.chev);

    const folded = await page.evaluate(() => {
      _dashStatsToggle();
      const title = g('dash-stats-title');
      const cards = []; let el = title.nextElementSibling;
      const SKIP = ['dash-wa-test', 'dash-vitre-test', 'dash-secaudit'];   // the app's own skip list since #792   // admin tools, not statistics
      while (el && el.classList && el.classList.contains('card')) { if (SKIP.indexOf(el.id) < 0) cards.push({ id: el.id, shown: el.style.display !== 'none' }); el = el.nextElementSibling; }
      return { visible: cards.filter((c) => c.shown).length, chev: (g('dash-stats-chev') || {}).textContent, saved: localStorage.getItem('tfgn_dash_stats_open') };
    });
    // the two admin tool cards below the title are not statistics and stay
    check('one tap folds every statistics card away', folded.visible === 0, folded);
    check('...and the chevron says how many are hidden', /▴ \d/.test(folded.chev || ''), folded.chev);
    check('the choice is remembered', folded.saved === '0', folded.saved);

    const survives = await page.evaluate(() => {
      rDash();                                   // a full re-render must not unfold it
      const title = g('dash-stats-title');
      const cards = []; let el = title.nextElementSibling;
      const SKIP = ['dash-wa-test', 'dash-vitre-test', 'dash-secaudit'];   // the app's own skip list since #792
      while (el && el.classList && el.classList.contains('card')) { if (SKIP.indexOf(el.id) < 0) cards.push(el.style.display !== 'none'); el = el.nextElementSibling; }
      return cards.filter(Boolean).length;
    });
    check('a dashboard re-render does not quietly unfold it', survives === 0, survives);

    const back = await page.evaluate(() => {
      _dashStatsToggle();
      const title = g('dash-stats-title');
      const cards = []; let el = title.nextElementSibling;
      while (el && el.classList && el.classList.contains('card')) { cards.push({ id: el.id, shown: el.style.display !== 'none' }); el = el.nextElementSibling; }
      return { visible: cards.filter((c) => c.shown).length, empties: cards.filter((c) => c.shown && ['dash-easp-card', 'dash-rounds-card'].indexOf(c.id) >= 0).length };
    });
    check('unfolding brings back what was there', back.visible > 0, back);
    check('...and NOT the cards that were empty anyway', back.empties === 0, back);

    const actionable = await page.evaluate(() => {
      _dashStatsToggle();                        // fold again
      return { today: !!g('today-items'), alerts: !!g('dash-alerts'), todayShown: getComputedStyle(g('today-items')).display !== 'none' };
    });
    check('«היום» stays put — the actionable part of the screen is not folded', actionable.today && actionable.todayShown, actionable);
    await page.evaluate(() => { try { localStorage.removeItem('tfgn_dash_stats_open'); } catch (e) {} });
  }

  await browser.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('HARNESS ERROR', e); process.exit(2); });
