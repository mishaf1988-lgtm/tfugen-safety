// Five more things about the screen Michael looks at every morning, and the
// messages it sends out on his behalf.
//
// 2.6  Ticking off a task already done in the plant yesterday was: tap the
//      row, a modal with eight fields opens, open the status select, choose
//      הושלם, save. Four taps. So the list did not get cleaned, and then
//      «היום» showed a backlog that was not real.
//
// 2.7  The comment said "sort by priority, then by due date" and the code
//      sorted by priority alone. Array.sort is stable, so inside פיגור the
//      order was DB.tasks order — which comes back ts.desc, i.e. the task
//      touched most recently first and the one stuck longest last. With
//      TOP=6 a two-month-old overdue task could fall off the screen entirely.
//
// 2.9  All four automatic WhatsApp events fell back to _waLastTo() —
//      tfgn_wa_last, written in exactly one place: the admin «בדיקת WhatsApp»
//      card. So a notification whose owner could not be matched against
//      app_users (the normal case, since אחראי is free text) went, with no
//      confirm and no warning, to whichever number was last typed into a test
//      box. The comment two lines down promised the opposite.
//
// 2.10 Nowhere in the app was there a "my number". The only way to make an
//      alert reach Michael was to type it into that test card — and nothing
//      on screen said that typing it there made it the default for everything.
//
// 2.12 The version was hardcoded in three independent places, and all three
//      said 2026.05.02 while the app shipped many times a week.
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
    window.__upd = []; window.__ins = [];
    window.sbIns = function (t, r) { window.__ins.push({ t: t, r: JSON.parse(JSON.stringify(r)) }); };
    window.sbUpd = function (t, r) { window.__upd.push({ t: t, r: JSON.parse(JSON.stringify(r)) }); };
    window.sbDel = function () {}; window.sdb = function () {}; window.addLog = function () {};
    window.__toasts = []; window.toast = function (m) { window.__toasts.push(String(m)); };
    window.__iso = (d) => new Date(Date.now() + d * 864e5).toISOString().split('T')[0];
    window.__blank = function () {
      ['ncr', 'inc', 'near_miss', 'tasks', 'rounds', 'ppe', 'tr', 'docs', 'ctr',
       'equip_inspections', 'med', 'inspection_types', 'trustee_reports', 'trustees',
       'app_users', 'notification_prefs'].forEach((t) => { DB[t] = []; });
    };
    const ue = document.getElementById('user-email');
    if (ue) ue.textContent = 'admin@tfugen.local';
  });

  console.log('\n2.6 one tap to tick off what was already done');
  {
    const r = await page.evaluate(() => {
      __blank();
      DB.tasks = [
        { id: 't1', title: 'החלפת מטף', status: 'פתוח', due: __iso(-4), assignee: 'דני' },
        { id: 't2', title: 'בדיקת מעקה', status: 'פתוח', due: __iso(0), assignee: 'דני' },
      ];
      DB.ncr = [{ id: 'n1', num: 'NCR-1', d: 'ממצא', s: 'פתוח', u: __iso(-6), sd: __iso(-30) }];
      goPage('dash');
      const rows = [...document.querySelectorAll('#today-items .today-item')];
      return {
        withTick: rows.filter((el) => el.querySelector('.ti-done')).length,
        total: rows.length,
        tids: rows.map((el) => (el.querySelector('.ti-done') || {}).dataset && el.querySelector('.ti-done').dataset.tid).filter(Boolean),
        stops: rows.some((el) => /stopPropagation/.test((el.querySelector('.ti-done') || {}).outerHTML || '')),
      };
    });
    check('a real task row carries a ✓', r.withTick === 2, r);
    check('...for the right ids', r.tids.sort().join() === 't1,t2', r.tids);
    check('a virtual row (an overdue NCR) gets none — it is a record, not a task', r.total > r.withTick, r);
    check('the ✓ does not also open the row behind it', r.stops, r.stops);

    const done = await page.evaluate(() => {
      window.__upd = []; window.__toasts = [];
      _todayDone('t1');
      return {
        status: DB.tasks[0].status,
        closed: DB.tasks[0].closed_date,
        upd: window.__upd.filter((x) => x.t === 'tasks').length,
        rows: [...document.querySelectorAll('#today-items .today-item')].map((e) => e.textContent).join('|'),
      };
    });
    check('one tap marks it done', done.status === 'הושלם', done);
    check('...with a closing date, which the monthly report needs', !!done.closed, done);
    check('...and it is sent to the server', done.upd === 1, done.upd);
    check('and the row leaves the list immediately', !/החלפת מטף/.test(done.rows), done.rows.slice(0, 200));

    const safety = await page.evaluate(() => { _todayDone(''); _todayDone('no-such-id'); return DB.tasks.length; });
    check('a missing id does nothing rather than throwing', safety === 2, safety);
  }

  console.log('\n2.7 inside «פיגור», the oldest is first');
  {
    const r = await page.evaluate(() => {
      __blank();
      // DB order is deliberately the reverse of the right order: this is what
      // the server returns, ts.desc — most recently touched first.
      DB.tasks = [
        { id: 'new', title: 'איחור של יומיים', status: 'פתוח', due: __iso(-2), ts: '2026-09-20' },
        { id: 'mid', title: 'איחור של חודש', status: 'פתוח', due: __iso(-30), ts: '2026-09-10' },
        { id: 'old', title: 'איחור של חודשיים', status: 'פתוח', due: __iso(-60), ts: '2026-08-01' },
        { id: 'f', title: 'עתידי', status: 'פתוח', due: __iso(6), ts: '2026-09-19' },
      ];
      DB.rounds = [{ id: 'r', d: new Date().toISOString().split('T')[0] }];   // silence the priority-0 morning round
      goPage('dash');
      return [...document.querySelectorAll('#today-items .today-item .ti-title')].map((e) => e.textContent);
    });
    check('the two-month-old one is first, not last', r[0] === 'איחור של חודשיים', r);
    check('...then the month, then the two days', r.slice(0, 3).join('|') === 'איחור של חודשיים|איחור של חודש|איחור של יומיים', r);
    check('a future task is still below all of the overdue ones', r.indexOf('עתידי') > 2, r);

    const mixed = await page.evaluate(() => {
      __blank();
      DB.rounds = [];                                  // the morning round has no due date
      DB.tasks = [{ id: 'o', title: 'איחור', status: 'פתוח', due: __iso(-40) }];
      goPage('dash');
      return [...document.querySelectorAll('#today-items .today-item .ti-title')].map((e) => e.textContent);
    });
    check('a row with no due date keeps its own priority band', /סבב בוקר/.test(mixed[0] || ''), mixed);
    check('...and does not displace an overdue task from a lower band', mixed.indexOf('איחור') > 0, mixed);

    const stable = await page.evaluate(() => {
      __blank();
      DB.rounds = [{ id: 'r', d: new Date().toISOString().split('T')[0] }];
      DB.tasks = [
        { id: 'a', title: 'אלף', status: 'פתוח', due: __iso(-5) },
        { id: 'b', title: 'בית', status: 'פתוח', due: __iso(-5) },
      ];
      goPage('dash');
      return [...document.querySelectorAll('#today-items .today-item .ti-title')].map((e) => e.textContent);
    });
    check('two tasks with the same date keep a stable order rather than jumping', stable.join('|') === 'אלף|בית', stable);
  }

  console.log('\n2.9 + 2.10 a notification goes where somebody decided it should');
  {
    const r = await page.evaluate(() => {
      __blank();
      try { localStorage.setItem('tfgn_wa_last', '972500000000'); } catch (e) {}   // a supplier, from some test last month
      DB.notification_prefs = [];
      DB.tasks = [{ id: 't1', title: 'משימה', status: 'פתוח', due: __iso(-10), assignee: 'שם חופשי שאינו משתמש' }];
      DB.app_users = [];
      return {
        self: _notifSelfWa(),
        args: _notifBuildWaArgs('task_overdue', { id: 't1' }),
        last: _waLastTo(),
      };
    });
    check('the last number typed into a test box is still sitting there', r.last === '972500000000', r.last);
    check('...and is NOT used — an unresolved notification is not sent to it', r.args === null, r.args);
    check('with no «my number» saved there is nothing to fall back to', r.self === '', r.self);

    const configured = await page.evaluate(() => {
      openNotifSettings();
      const has = !!g('notif-self-wa');
      if (has) g('notif-self-wa').value = '972-52-111-2222';   // absent: the check below says so
      try { saveNotifSettings(); } catch (e) { /* the field is gone; the checks report it */ }
      const rows = window.__ins.concat(window.__upd).filter((x) => x.t === 'notification_prefs');
      return { has: has, self: _notifSelfWa(), saved: rows[rows.length - 1] };
    });
    check('the settings screen has a «my number» field at all', configured.has, configured.has);
    check('it is stored digits-only, as WhatsApp needs', configured.self === '972521112222', configured.self);
    check('...and written to the prefs row', !!(configured.saved && configured.saved.r.prefs._self && configured.saved.r.prefs._self.whatsapp_to === '972521112222'), configured.saved && configured.saved.r.prefs);

    const routed = await page.evaluate(() => {
      const out = {};
      DB.ncr = [{ id: 'n1', num: 'NCR-9', d: 'ממצא', a: 'בטיחות', o: 'אחראי חופשי' }];
      DB.inc = [{ id: 'i1', l: 'מחסן', sv: 'גבוהה', r: 'מישהו' }];
      DB.tasks = [{ id: 't1', title: 'משימה', due: __iso(-10), assignee: 'מישהו' }];
      DB.equip_inspections = [{ id: 'e1', n: 'מלגזה', e: __iso(10), vendor: 'ספק' }];
      out.ncr = _notifBuildWaArgs('ncr_critical', { id: 'n1' });
      out.inc = _notifBuildWaArgs('incident_critical', { id: 'i1' });
      out.task = _notifBuildWaArgs('task_overdue', { id: 't1' });
      out.exp = _notifBuildWaArgs('expiry_30days', { id: 'e1', table: 'equip_inspections' });
      out.round = _notifBuildWaArgs('round_missed', { id: 'x' });
      return out;
    });
    check('all four per-person events now fall back to the configured number', ['ncr', 'inc', 'task', 'exp'].every((k) => routed[k] && routed[k].to === '972521112222'), routed);
    check('...and so does «סבב חסר», which never even tried to resolve one', routed.round && routed.round.to === '972521112222', routed.round);

    const resolved = await page.evaluate(() => {
      DB.app_users = [{ id: 'u1', username: 'dani', full_name: 'דני כהן', phone: '972-54-999-8888', active: true }];
      DB.tasks = [{ id: 't2', title: 'משימה', due: __iso(-10), assignee: 'דני כהן' }];
      return _notifBuildWaArgs('task_overdue', { id: 't2' });
    });
    // Found while testing: app_users.phone is free text and routinely holds
    // dashes, and _waResolvePhone returned it raw — so every automatic message
    // to a resolved person went to Meta malformed, and failed on Meta's side.
    check('a name that DOES resolve still goes to that person, not to me', resolved && resolved.to === '972549998888', resolved);

    const kept = await page.evaluate(() => {
      _notifEnableRecommended();
      return _notifSelfWa();
    });
    check('«הפעל התראות בתוך האפליקציה» does not wipe the number — both writers rebuild prefs from scratch', kept === '972521112222', kept);
    await page.evaluate(() => { try { localStorage.removeItem('tfgn_wa_last'); } catch (e) {} });
  }

  console.log('\n2.12 the version is one constant');
  {
    const r = await page.evaluate(() => {
      const src = [...document.querySelectorAll('script')].map((s) => s.textContent).join('');
      let snapshot = null;
      const realCreate = URL.createObjectURL.bind(URL);
      URL.createObjectURL = function (b) { window.__b = b; return realCreate(b); };
      HTMLAnchorElement.prototype.click = function () {};
      try { _exportBackup(); } catch (e) {}
      return {
        ver: window.APP_VER,
        // comments are allowed to mention it; code is not
        hardcoded: (src.split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n').match(/2026\.05\.02|overnight-2026-05-02/g) || []),
        // the source keeps its Hebrew as \\uXXXX escapes (project rule 1), so
        // match on the code around APP_VER rather than on the label.
        menuUsesIt: /\(v'\+APP_VER\+'\)/.test(src),
        aboutUsesIt: src.indexOf("'+APP_VER+'") >= 0 && /alert\('TFUGEN[^\n]*APP_VER/.test(src),
        backupUsesIt: /version:APP_VER/.test(src),
      };
    });
    check('there is an APP_VER constant', typeof r.ver === 'string' && /^\d{4}\.\d{2}\.\d{2}$/.test(r.ver), r.ver);
    check('it is not the May date that was stuck in three places', r.ver !== '2026.05.02', r.ver);
    check('nothing hardcodes a version any more', r.hardcoded.length === 0, r.hardcoded);
    check('the ⋯ menu reads it', r.menuUsesIt, r.menuUsesIt);
    check('so does the about dialog', r.aboutUsesIt, r.aboutUsesIt);
    check('and so does the JSON backup, which is what a restore reads back', r.backupUsesIt, r.backupUsesIt);

    // Michael, 2026-09-21: «הורד את הרישום מפתח קלוד ורשום שם שלי». This is a
    // system he presents inside his own plant, and the about box is where
    // somebody looks to see whose it is. Checked on the text that is actually
    // shown, not on the source, because the source keeps its Hebrew escaped.
    const about = await page.evaluate(() => {
      let said = null;
      const real = window.alert;
      window.alert = function (t) { said = String(t); };
      try { _showAbout(); } catch (e) { said = 'ERROR ' + (e && e.message); }
      window.alert = real;
      return said;
    });
    check('the about box names Michael', /מיכאל פריילך/.test(about || ''), about);
    check('...and credits nobody else as its developer', !/Claude/.test(about || ''), about);
    check('...and still carries the version and the date',
      about && about.indexOf(r.ver) > 0 && /\d{4}-\d{2}-\d{2}/.test(about), about);

    const inBackup = await page.evaluate(() => {
      return window.__b ? window.__b.text().then((t) => { try { return JSON.parse(t).version; } catch (e) { return 'unparsed'; } }) : null;
    });
    if (inBackup !== null) check('the exported file really carries it', inBackup === r.ver, inBackup);
  }

  await browser.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('HARNESS ERROR', e); process.exit(2); });
