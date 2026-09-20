// Six things about the NCR module. Together they are the gap between
// "the record says it is closed" and "somebody can show what was done".
//
// 1.3  xlParse wrote the imported root cause to `root_cause` and the immediate
//      action to `immediate`. The form, the AI and the apply path all work on
//      `rc`. The data is in the DB and nothing in the app shows it: the root
//      causes of every historic non-conformance simply do not exist as far as
//      the screen is concerned.
//
// 1.6  svNcr validated the description and nothing else. So סגור could be
//      saved with no root cause, no corrective action and nobody responsible —
//      and that record counts as closed in the dashboard, the ISO readiness
//      report and the average days-to-close, and then lands in the
//      effectiveness queue after 30 days asking somebody to verify an action
//      that was never written down. §10.2.1 is exactly this.
//
// 1.8  _chainNmToNcr wrote «נוצר מדיווח כמעט-נפגע #id» into the NCR's notes
//      and touched the near-miss not at all. It stayed פתוח, so the task list
//      showed TWO rows for one event and the near-miss one stayed open for
//      ever, dripping into every count that reads it.
//
// 1.9  svTsk stores source_table/source_id and _truTaskFor reads it back —
//      for trustees only. Every other record showed the same «+ פתח משימת
//      מעקב» button the next day as if nothing had happened.
//
// 1.10 _ncrAI's prompt never included the root cause, the 5-Why, the
//      corrective action or the owner, all of which sit on the object it is
//      given. And applying the result replaced all four outright — while
//      _ncrAIRcAction, the button in the modal, has always guarded.
//
// 1.12 _notifDailyScan filtered DB.tasks only. An NCR past its target sent
//      nothing out: no WhatsApp, no row in notifications_log.
const path = require('path');
let pw; try { pw = require('playwright'); } catch (e) { pw = require('playwright-core'); }
const HTML = 'file://' + path.resolve(__dirname, '../../index.html');
let pass = 0, fail = 0;
const check = (l, c, d) => { if (c) { pass++; console.log('  ✓ ' + l); } else { fail++; console.log('  ✗ ' + l + (d !== undefined ? '  -> ' + JSON.stringify(d) : '')); } };

let ACCEPT = true, DIALOGS = [];

(async () => {
  const browser = await pw.chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, locale: 'he-IL' });
  const page = await ctx.newPage();
  page.on('dialog', async (d) => { DIALOGS.push(d.message()); await (ACCEPT ? d.accept() : d.dismiss()).catch(() => {}); });
  await page.route('**/*', (r) => r.request().url().startsWith('file://') ? r.continue() : r.abort());
  await page.goto(HTML, { waitUntil: 'load' });
  await page.waitForTimeout(700);

  await page.evaluate(() => {
    document.getElementById('login').style.display = 'none';
    document.getElementById('app').style.display = 'block';
    window._currentUser = { username: 'admin' }; _isAdmin = true; _applyRoleGates();
    window.__ins = []; window.__upd = [];
    window.sbIns = function (t, r) { window.__ins.push({ t: t, r: JSON.parse(JSON.stringify(r)) }); };
    window.sbUpd = function (t, r) { window.__upd.push({ t: t, r: JSON.parse(JSON.stringify(r)) }); };
    window.sbDel = function () {}; window.sdb = function () {}; window.addLog = function () {};
    window.__toasts = []; window.toast = function (m) { window.__toasts.push(String(m)); };
    window.__events = []; window._notifyEvent = function (ev, p) { window.__events.push({ ev: ev, p: p }); };
    window.__iso = (d) => new Date(Date.now() + d * 864e5).toISOString().split('T')[0];
    window.__blank = function () {
      ['ncr', 'inc', 'near_miss', 'tasks', 'rounds', 'ppe', 'tr', 'docs', 'ctr',
       'equip_inspections', 'med', 'inspection_types'].forEach((t) => { DB[t] = []; });
    };
  });

  console.log('\n1.3 the imported root causes exist as far as the screen is concerned');
  {
    const r = await page.evaluate(() => {
      // a row shaped exactly as the app holds the 375 imported records
      DB.ncr = [{ id: 'imp1', num: 'NCR-0007', d: 'דליפת שמן', a: 'איכות סביבה', s: 'סגור',
        root_cause: 'אטם סדוק בצינור ההזנה', immediate: 'נספג ונאטם זמנית', c: 'הוחלף האטם', notes: '' }];
      editNcr('imp1');
      const shown = g('ncr-rc').value;
      const pairs = VIEW_CONFIG.ncr.fields.map((f) => f[0] + '=' + f[1]);
      showView('ncr', 'imp1');
      const text = (g('view-body') || {}).textContent || '';
      return { shown: shown, pairs: pairs, text: text };
    });
    check('opening an imported NCR shows its root cause in the form', r.shown === 'אטם סדוק בצינור ההזנה', r.shown);
    check('the view sheet carries the legacy columns too', r.pairs.indexOf('סיבת שורש (מייבוא)=root_cause') >= 0 && r.pairs.indexOf('פעולה מיידית (מייבוא)=immediate') >= 0, r.pairs);
    check('...so the imported root cause is on the screen at all', /אטם סדוק/.test(r.text), r.text.slice(0, 260));
    check('...and so is the immediate action', /נספג ונאטם/.test(r.text), r.text.slice(0, 260));

    const healed = await page.evaluate(() => {
      editNcr('imp1');
      g('ncr-o').value = 'דני';               // an ordinary edit
      svNcr();
      return { rc: DB.ncr[0].rc, legacy: DB.ncr[0].root_cause };
    });
    await page.waitForTimeout(80);
    check('saving moves it to rc — the data heals through ordinary use, no migration', healed.rc === 'אטם סדוק בצינור ההזנה', healed);

    // and a NEW import writes the right column from the start
    const imported = await page.evaluate(() => {
      const wb = {
        SheetNames: ['איכות סביבה'],
        Sheets: { 'איכות סביבה': {} },
      };
      window.XLSX = {
        utils: {
          sheet_to_json: () => ([
            ['#', 'תיאור', 'תאריך', 'סיבת שורש', 'פעולה מיידית', 'פעולה מתקנת', 'אחראי', 'יעד', 'סטטוס', 'הערות'],
            ['1', 'דליפה', '2026-01-05', 'ברז פגום', 'נסגר הברז', 'הוחלף הברז', 'דני', '2026-02-01', 'בוצע', 'הערה'],
          ]),
        },
      };
      const rows = xlParse(wb);
      return rows[0] || {};
    });
    check('a new Excel import writes rc, not root_cause', imported.rc === 'ברז פגום' && !imported.root_cause, imported);
    check('the corrective action still lands in c', imported.c === 'הוחלף הברז', imported.c);
    check('and the immediate action is kept, labelled, in the notes rather than dropped', /פעולה מיידית: נסגר הברז/.test(imported.notes || ''), imported.notes);
  }

  console.log('\n1.6 an NCR cannot be closed with nothing in it');
  {
    const blocked = await page.evaluate(() => {
      __blank();
      window.__toasts = []; window.__ins = [];
      openNewNcrModal ? openNewNcrModal() : openModal('m-ncr');
      g('ncr-d').value = 'מעקה חסר בגג'; g('ncr-s').value = 'סגור';
      svNcr();
      return { rows: DB.ncr.length, toasts: window.__toasts, ins: window.__ins.length };
    });
    check('closing with none of the three is refused', blocked.rows === 0 && blocked.ins === 0, blocked);
    check('...and the message names all three that are missing', /סיבת שורש/.test(blocked.toasts.join('|')) && /פעולה מתקנת/.test(blocked.toasts.join('|')) && /אחראי/.test(blocked.toasts.join('|')), blocked.toasts);

    const partial = await page.evaluate(() => {
      window.__toasts = [];
      g('ncr-rc').value = 'עבודה בגובה ללא תכנון';
      svNcr();
      return { rows: DB.ncr.length, toasts: window.__toasts };
    });
    check('two of three is still refused', partial.rows === 0, partial);
    check('...and the message now names only what is still missing', !/סיבת שורש/.test(partial.toasts.join('|')) && /פעולה מתקנת/.test(partial.toasts.join('|')), partial.toasts);

    const saved = await page.evaluate(() => {
      window.__toasts = [];
      g('ncr-c').value = 'הותקן מעקה תקני'; g('ncr-o').value = 'דני';
      svNcr();
      return { rows: DB.ncr.length, s: DB.ncr[0] && DB.ncr[0].s, cd: DB.ncr[0] && DB.ncr[0].cd };
    });
    check('with all three it saves', saved.rows === 1 && saved.s === 'סגור', saved);
    check('...and gets a closing date', !!saved.cd, saved.cd);

    const open = await page.evaluate(() => {
      __blank();
      openNewNcrModal();
      g('ncr-d').value = 'ממצא חדש'; g('ncr-s').value = 'פתוח';
      svNcr();
      return DB.ncr.length;
    });
    check('an OPEN NCR is not gated — that would make reporting harder, not safer', open === 1, open);

    // the 375 imported rows are already closed and mostly empty; editing one must work
    const legacy = await page.evaluate(() => {
      __blank();
      DB.ncr = [{ id: 'old1', num: 'NCR-0003', d: 'ממצא ישן', a: 'בטיחות', s: 'סגור', rc: '', c: '', o: '', cd: '2024-01-01' }];
      window.__toasts = [];
      editNcr('old1');
      g('ncr-loc').value = 'מחסן';            // fixing a typo on an old record
      svNcr();
      return { loc: DB.ncr[0].loc, s: DB.ncr[0].s, toasts: window.__toasts };
    });
    check('editing a record that was ALREADY closed still works — 375 of those exist', legacy.loc === 'מחסן' && legacy.s === 'סגור', legacy);
  }

  console.log('\n1.8 one event, one open item');
  {
    DIALOGS = []; ACCEPT = true;
    const r = await page.evaluate(() => {
      __blank();
      DB.near_miss = [{ id: 'nm1', descr: 'כמעט נפילה מסולם', area: 'מחסן', rep: 'דני', d: __iso(-2), sev: 'חמור', s: 'פתוח', notes: '' }];
      window.__upd = [];
      _chainNmToNcr('nm1');
      return new Promise((res) => setTimeout(() => {
        g('ncr-rc').value = 'סולם לא מאובטח'; g('ncr-c').value = 'הותקן מעצור'; g('ncr-o').value = 'דני';
        svNcr();
        setTimeout(() => res({
          nm: DB.near_miss[0],
          ncr: DB.ncr[0],
          upd: window.__upd.filter((x) => x.t === 'near_miss').length,
          virt: (typeof _collectVirtualTasks === 'function' ? _collectVirtualTasks() : []).map((t) => t.source_table + ':' + t.source_id),
          toasts: window.__toasts.slice(-1),
        }), 120);
      }, 700));
    });
    check('the NCR is created', !!r.ncr, r.ncr);
    check('the near-miss is no longer «פתוח» — it is being handled', r.nm.s === 'בטיפול', r.nm);
    check('...it names the NCR that came out of it, so the other direction works too', /NCR/.test(r.nm.notes || '') && r.nm.ncr_id === r.ncr.id, r.nm);
    check('...and that change was sent to the server', r.upd === 1, r.upd);
    check('the task list has ONE row for the event, not two', r.virt.filter((x) => /near_miss|ncr/.test(x)).length === 1, r.virt);
    check('...and it is the NCR', r.virt.indexOf('ncr:' + r.ncr.id) >= 0, r.virt);
    check('the toast says what happened to the near-miss', /כמעט/.test(r.toasts.join('|')), r.toasts);

    const abandoned = await page.evaluate(() => {
      __blank();
      DB.near_miss = [{ id: 'nm2', descr: 'x', area: 'y', d: __iso(-1), s: 'פתוח' }];
      _chainNmToNcr('nm2');
      return new Promise((res) => setTimeout(() => {
        closeModal('m-ncr');                   // the manager changes their mind
        res(DB.near_miss[0].s);
      }, 700));
    });
    check('abandoning the form changes nothing — the near-miss stays open', abandoned === 'פתוח', abandoned);

    const unrelated = await page.evaluate(() => {
      __blank();
      DB.near_miss = [{ id: 'nm3', descr: 'x', s: 'פתוח' }];
      openNewNcrModal();
      g('ncr-d').value = 'ממצא שלא קשור'; svNcr();
      return DB.near_miss[0].s;
    });
    check('an ordinary NCR does not touch some unrelated near-miss', unrelated === 'פתוח', unrelated);
  }

  console.log('\n1.9 a record shows the tasks it produced');
  {
    const r = await page.evaluate(() => {
      __blank();
      DB.ncr = [{ id: 'n9', num: 'NCR-0021', d: 'שמן על הרצפה', a: 'בטיחות', s: 'פתוח', sd: __iso(-5) }];
      DB.tasks = [
        { id: 't1', title: 'ניקוי ואיטום', status: 'פתוח', assignee: 'דני', due: __iso(-4), source_table: 'ncr', source_id: 'n9', ts: '2026-01-01' },
        { id: 't2', title: 'החלפת אטם', status: 'הושלם', assignee: 'רון', due: __iso(-1), source_table: 'ncr', source_id: 'n9', ts: '2026-02-01' },
        { id: 't3', title: 'לא קשור', status: 'פתוח', source_table: 'inc', source_id: 'i1', ts: '2026-03-01' },
      ];
      showView('ncr', 'n9');
      const box = g('view-tasks');
      return {
        has: !!box,
        html: box ? box.innerHTML : '',
        ids: box ? (box.innerHTML.match(/data-tid="([^"]+)"/g) || []).map((s) => s.slice(10, -1)) : [],
        body: (g('view-body') || {}).innerHTML || '',
        fn: _tasksFor('ncr', 'n9').map((t) => t.id),
      };
    });
    check('the NCR lists the tasks opened from it', r.has && r.ids.length === 2, r.ids);
    check('...newest first', r.fn.join() === 't2,t1', r.fn);
    check('an unrelated task is not in it', r.ids.indexOf('t3') < 0, r.ids);
    check('each row carries status, due date and owner', /הושלם/.test(r.html) && /דני/.test(r.html) && /רון/.test(r.html), r.html.slice(0, 400));
    check('the overdue one is marked, the done one ticked', /⚠/.test(r.html) && /✅/.test(r.html), r.html.slice(0, 400));
    check('the create button now says «another», not «open a follow-up»', /משימה נוספת/.test(r.body), r.body.slice(-400));

    const none = await page.evaluate(() => {
      DB.tasks = [];
      showView('ncr', 'n9');
      return { box: !!g('view-tasks'), body: (g('view-body') || {}).innerHTML || '' };
    });
    check('with no tasks there is no empty block', !none.box, none.box);
    check('...and the button reads as it always did', /פתח משימת מעקב/.test(none.body), none.body.slice(-300));

    const trustee = await page.evaluate(() => {
      DB.trustee_reports = [{ id: 'f1', u: 'מוסא', t: 6, d: __iso(-3), ok: false, s: 'פתוח', loc: 'x', f: 'y' }];
      DB.tasks = [{ id: 'tt', title: 'z', status: 'פתוח', source_table: 'trustee_reports', source_id: 'f1', ts: '2026-01-01' }];
      return !!_truTaskFor('f1');
    });
    check('the trustee path, which already worked, still does', trustee, trustee);
  }

  console.log('\n1.10 the model sees the work, and does not overwrite it');
  {
    const prompt = await page.evaluate(() => {
      let sent = null;
      window.fetch = function (u, o) {
        sent = JSON.parse((o && o.body) || '{}');
        return Promise.resolve({ ok: true, status: 200, text: () => Promise.resolve(JSON.stringify({ content: [{ text: '{"risk":"low"}' }] })) });
      };
      window._nad = [{ id: 'a1', num: 'NCR-1', d: 'שמן', a: 'בטיחות', p: 'גבוהה', notes: 'הערה',
        rc: 'אטם סדוק', five_why: '1. למה... 5. למה', c: 'החלפת אטם', o: 'דני' }];
      window._naf = {};
      return Promise.resolve(_ncrAI('a1')).then(() => sent).catch(() => sent);
    });
    const text = JSON.stringify(prompt || {});
    check('the prompt carries the root cause already recorded', /אטם סדוק/.test(text), text.slice(0, 300));
    check('...the 5-Why', /5-Why already recorded/.test(text) && /למה/.test(text), text.slice(0, 300));
    check('...the corrective action and the owner', /החלפת אטם/.test(text) && /דני/.test(text), text.slice(0, 300));
    check('...and tells the model not to silently replace them', /do not silently replace/.test(text), text.slice(0, 500));

    DIALOGS = []; ACCEPT = true;
    const guarded = await page.evaluate(() => {
      window.DB.ncr = [{ id: 'a1', num: 'NCR-1', d: 'שמן', rc: 'אטם סדוק', c: '', o: 'דני', u: null }];
      window._nad = [window.DB.ncr[0]];
      window._naf = { a1: { root_cause: 'ניחוש אחר לגמרי', corrective_actions: ['להחליף צינור'], owner_suggested: 'מישהו אחר', due_suggested: '2027-01-01', version: 1 } };
      let body = null;
      window.fetch = function (u, o) { body = JSON.parse((o && o.body) || '{}'); return Promise.resolve({ ok: true, status: 204, text: () => Promise.resolve('') }); };
      window._ncrRender = function () {}; window._ncrSel = function () {};
      _ncrApply('a1');
      return new Promise((res) => setTimeout(() => res({ body: body, rec: window.DB.ncr[0] }), 200));
    });
    check('a field that was already filled in is NOT replaced', guarded.rec.rc === 'אטם סדוק' && guarded.rec.o === 'דני', guarded.rec);
    check('...and is not even sent to the server', guarded.body && !('rc' in guarded.body) && !('o' in guarded.body), guarded.body);
    check('an empty field IS filled in — the analysis is still useful', guarded.rec.c === 'להחליף צינור' && guarded.rec.u === '2027-01-01', guarded.rec);
    check('the question names what will be filled and what is kept', /סיבת שורש/.test(DIALOGS.join('|')) && /נשמרים כמו שהם/.test(DIALOGS.join('|')), DIALOGS);

    DIALOGS = [];
    const nothing = await page.evaluate(() => {
      window.DB.ncr = [{ id: 'a2', rc: 'יש', c: 'יש', o: 'יש', u: '2027-01-01' }];
      window._nad = [window.DB.ncr[0]];
      window._naf = { a2: { root_cause: 'x', corrective_actions: ['y'], owner_suggested: 'z', due_suggested: '2028-01-01', version: 1 } };
      let called = false;
      window.fetch = function () { called = true; return Promise.resolve({ ok: true, status: 204, text: () => Promise.resolve('') }); };
      _ncrApply('a2');
      return new Promise((res) => setTimeout(() => res({ called: called, rec: window.DB.ncr[0] }), 150));
    });
    check('with everything already filled in, nothing is sent at all', !nothing.called && nothing.rec.u === '2027-01-01', nothing);
    check('...and it says so rather than silently doing nothing', /כבר מלאים/.test(DIALOGS.join('|')), DIALOGS);
  }

  console.log('\n1.12 an NCR past its target actually sends something');
  {
    const r = await page.evaluate(() => {
      __blank();
      const day = new Date().toISOString().substring(0, 10);
      try { localStorage.removeItem('tfgn_notif_' + day); localStorage.removeItem('tfgn_round_missed_' + day); } catch (e) {}
      DB.ncr = [{ id: 'n1', num: 'NCR-0044', d: 'מעקה חסר', a: 'בטיחות', s: 'פתוח', o: 'דני', u: __iso(-12), sd: __iso(-40) }];
      DB.tasks = [];
      window.__events = [];
      _notifDailyScan();
      return window.__events.filter((e) => e.ev === 'task_overdue');
    });
    check('an NCR twelve days past its target fires task_overdue', r.length === 1, r);
    check('...and the payload says it is a virtual task and where it came from', r[0] && r[0].p.virtual === true && r[0].p.src === 'ncr', r[0] && r[0].p);
    check('...and names the NCR', /NCR-0044/.test((r[0] && r[0].p.title) || ''), r[0] && r[0].p.title);

    const wa = await page.evaluate(() => {
      window._waResolvePhone = function () { return '972501234567'; };
      const ev = window.__events.filter((e) => e.ev === 'task_overdue')[0];
      if (!ev) return null;                  // nothing fired: the checks above say so
      return _notifBuildWaArgs('task_overdue', ev.p);
    });
    check('the WhatsApp message can be built for it — it used to find nothing and drop', !!wa, wa);
    check('...with the NCR name and how many days late', wa && /NCR-0044/.test(wa.params[0]) && Number(wa.params[1]) >= 12, wa && wa.params);

    const real = await page.evaluate(() => {
      const day = new Date().toISOString().substring(0, 10);
      try { localStorage.removeItem('tfgn_notif_' + day); } catch (e) {}
      DB.ncr = [];
      DB.tasks = [{ id: 'rt', title: 'משימה אמיתית', status: 'פתוח', due: __iso(-9), assignee: 'דני' }];
      window.__events = [];
      _notifDailyScan();
      const ev = window.__events.filter((e) => e.ev === 'task_overdue')[0];
      return { n: window.__events.filter((e) => e.ev === 'task_overdue').length, args: ev && _notifBuildWaArgs('task_overdue', ev.p) };
    });
    check('a real task still fires, exactly as before', real.n === 1 && real.args && /משימה אמיתית/.test(real.args.params[0]), real);
  }

  await browser.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('HARNESS ERROR', e); process.exit(2); });
