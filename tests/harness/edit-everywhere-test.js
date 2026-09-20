// 14 modules could only be viewed and deleted. A typo in a training record
// meant delete-and-retype; a permit to work could never be closed; a near-miss
// stayed פתוח forever and kept generating a red overdue task. Every sv*
// function reads a fixed set of inputs, so the registry IS that set — whatever
// the saver reads, the editor fills — and each saver now upserts.
const path = require('path');
let pw; try { pw = require('playwright'); } catch (e) { pw = require('playwright-core'); }
const HTML = 'file://' + path.resolve(__dirname, '../../index.html');
let pass = 0, fail = 0;
const check = (l, c, d) => { if (c) { pass++; console.log('  ✓ ' + l); } else { fail++; console.log('  ✗ ' + l + (d !== undefined ? '  -> ' + JSON.stringify(d) : '')); } };

// One representative record per module, using the field names the savers read.
const TBLS = ['rsk', 'tr', 'ppe', 'emp', 'ctr', 'ins', 'drl', 'wst', 'hzm', 'env', 'toolbox', 'ptw', 'near_miss', 'auds'];

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
    window.__ins = []; window.__upd = [];
    window.sbIns = function (t, r) { window.__ins.push({ t: t, id: r.id }); };
    window.sbUpd = function (t, r) { window.__upd.push({ t: t, id: r.id }); };
    window.sdb = function () {}; window.addLog = function () {};
    window._currentUser = { username: 'admin' }; _isAdmin = true;
    _applyRoleGates(); goPage('dash');
  });

  console.log('\n1. the registry covers the modules that had no editor');
  {
    const r = await page.evaluate((tbls) => ({
      known: Object.keys(_EDIT_MODS).sort(),
      missing: tbls.filter((t) => !_EDIT_MODS[t]),
      fieldCounts: tbls.map((t) => [t, _EDIT_MODS[t] ? Object.keys(_EDIT_MODS[t].f).length : 0]),
      ptwChecks: _EDIT_MODS.ptw && _EDIT_MODS.ptw.c ? Object.keys(_EDIT_MODS.ptw.c).length : 0,
    }), TBLS);
    // 15 since #654: `docs` joined, which is how the ISO procedure register
    // got a ✎ at all — svDoc used to write id:gid() unconditionally.
    check('all 14 are registered, plus docs', r.missing.length === 0 && r.known.length === 15 && r.known.indexOf('docs') >= 0, r.known);
    check('every one carries a non-empty field map', r.fieldCounts.every((x) => x[1] > 0), r.fieldCounts.filter((x) => !x[1]));
    check('the permit’s 8 work-type checkboxes are mapped too', r.ptwChecks === 8, r.ptwChecks);
    const already = await page.evaluate(() => ['ncr', 'inc', 'tasks', 'equip_inspections'].filter((t) => _EDIT_MODS[t]));
    check('modules with their own editor are NOT hijacked', already.length === 0, already);
  }

  console.log('\n2. every module: save is an insert, editing is an update');
  {
    const bad = [];
    for (const tbl of TBLS) {
      const r = await page.evaluate((tbl) => {
        const cfg = _EDIT_MODS[tbl];
        DB[tbl] = [];
        window.__ins = []; window.__upd = [];
        // fill the form the way a person would, then save: a NEW record
        openModal(cfg.m);
        const doms = Object.keys(cfg.f);
        // A date input silently rejects 'A0', which leaves the required field empty
        // and makes the saver bail — that looked like a bug in the feature and was
        // a bug in the test. Give each input a value its own type accepts.
        doms.forEach((d, i) => {
          const el = g(d);
          if (!el || el.tagName === 'SELECT') return;
          const t = (el.getAttribute('type') || '').toLowerCase();
          if (t === 'date') el.value = '2026-0' + ((i % 9) + 1) + '-15';
          else if (t === 'number') el.value = String(i + 1);
          else el.value = 'A' + i;
        });
        window[({ rsk: 'svRsk', tr: 'svTr', ppe: 'svPpe', emp: 'svEmp', ctr: 'svCtr', ins: 'svIns', drl: 'svDrl', wst: 'svWst', hzm: 'svHzm', env: 'svEnv', toolbox: 'svToolbox', ptw: 'svPtw', near_miss: 'svNm', auds: 'svAud' })[tbl]]();
        const afterNew = { rows: DB[tbl].length, ins: window.__ins.length, upd: window.__upd.length, id: DB[tbl][0] && DB[tbl][0].id };
        if (!afterNew.id) return { tbl: tbl, stage: 'insert', afterNew: afterNew };
        // now edit it and save again: same row, an UPDATE, no new row
        window.__ins = []; window.__upd = [];
        _genEdit(tbl, afterNew.id);
        const editing = _svEditId(tbl);
        // edit a field that is definitely free text, so the change actually sticks
        const first = doms.filter((d) => { const e2 = g(d); return e2 && e2.tagName !== 'SELECT' && ['date', 'number'].indexOf((e2.getAttribute('type') || '').toLowerCase()) < 0; })[0] || doms[0];
        const el = g(first);
        if (el && el.tagName !== 'SELECT') el.value = 'עודכן';
        window[({ rsk: 'svRsk', tr: 'svTr', ppe: 'svPpe', emp: 'svEmp', ctr: 'svCtr', ins: 'svIns', drl: 'svDrl', wst: 'svWst', hzm: 'svHzm', env: 'svEnv', toolbox: 'svToolbox', ptw: 'svPtw', near_miss: 'svNm', auds: 'svAud' })[tbl]]();
        return {
          tbl: tbl, afterNew: afterNew, editing: editing,
          rowsAfterEdit: DB[tbl].length, ins: window.__ins.length, upd: window.__upd.length,
          sameId: DB[tbl][0] && DB[tbl][0].id === afterNew.id,
          newValue: DB[tbl][0] ? DB[tbl][0][cfg.f[first]] : null,
          cleared: _svEditId(tbl),
        };
      }, tbl);
      const ok = r.afterNew && r.afterNew.rows === 1 && r.afterNew.ins === 1 && r.afterNew.upd === 0
        && r.editing === r.afterNew.id
        && r.rowsAfterEdit === 1 && r.upd === 1 && r.ins === 0
        && r.sameId && r.cleared === null;
      if (!ok) bad.push(r);
    }
    check('all 14: one row in, one row after editing, insert then update, id unchanged', bad.length === 0, bad);
  }

  console.log('\n3. editing fills the form from the record');
  {
    const r = await page.evaluate(() => {
      DB.tr = [{ id: 't9', w: 'מוסא', n: 'עבודה בגובה', c: 'בטיחות', d: '2026-03-01', e: '2027-03-01' }];
      _genEdit('tr', 't9');
      return { w: g('t-w').value, n: g('t-n').value, e: g('t-e').value, open: getComputedStyle(g('m-tr')).display !== 'none' };
    });
    check('the training form opens holding the record’s own values', r.open && r.w === 'מוסא' && r.n === 'עבודה בגובה' && r.e === '2027-03-01', r);
    const blank = await page.evaluate(() => {
      DB.rsk = [{ id: 'r9', d: 'סיכון', a: 'אזור', o: null, ac: null }];
      _genEdit('rsk', 'r9');
      return { o: g('r-o').value, d: g('r-d').value };
    });
    check('a null field becomes an empty box, not the text "null"', blank.o === '' && blank.d === 'סיכון', blank);
  }

  console.log('\n4. the permit’s work-type checkboxes come back ticked');
  {
    // svPtw stores types as types.join(', ') — a STRING. The first version of
    // this test used an array, so it only ever exercised the defensive branch
    // and never the shape a real permit actually has.
    const r = await page.evaluate(() => {
      DB.ptw = [{ id: 'p9', con: 'קבלן א', types: 'עבודות חמות, חלל מוקף' }];
      _genEdit('ptw', 'p9');
      const on = Object.keys(_EDIT_MODS.ptw.c).filter((d) => { const el = g(d); return el && el.checked; });
      return { on: on.sort(), con: g('ptw-con').value };
    });
    check('the stored string "עבודות חמות, חלל מוקף" ticks exactly those two boxes', r.on.join() === 'ptw-cnf,ptw-hot', r.on);
    check('and the contractor name is filled', r.con === 'קבלן א', r);
    const arr = await page.evaluate(() => {
      DB.ptw = [{ id: 'p8', con: 'קבלן ב', types: ['עבודה בגובה'] }];
      _genEdit('ptw', 'p8');
      return Object.keys(_EDIT_MODS.ptw.c).filter((d) => { const el = g(d); return el && el.checked; });
    });
    check('an array still works too, for any row saved before the join', arr.join() === 'ptw-hgt', arr);
    const none = await page.evaluate(() => {
      DB.ptw = [{ id: 'p7', con: 'קבלן ג' }];
      _genEdit('ptw', 'p7');
      return Object.keys(_EDIT_MODS.ptw.c).filter((d) => { const el = g(d); return el && el.checked; });
    });
    check('a permit with no types ticks nothing, and leaves no box from the previous record', none.length === 0, none);
  }

  console.log('\n5. opening a form any other way starts a NEW record');
  {
    const r = await page.evaluate(() => {
      DB.rsk = [{ id: 'r1', d: 'קיים', a: 'א' }];
      _genEdit('rsk', 'r1');
      const during = _svEditId('rsk');
      openModal('m-rsk');                       // the ordinary "+ חדש" path
      const after = _svEditId('rsk');
      g('r-d').value = 'חדש לגמרי';
      svRsk();
      return { during: during, after: after, rows: DB.rsk.length, ids: DB.rsk.map((x) => x.id) };
    });
    check('reopening the blank form clears the edit, so nothing is overwritten', r.during === 'r1' && r.after === null, r);
    check('and a second, separate row is created', r.rows === 2 && r.ids[0] === 'r1', r);
  }

  console.log('\n6. the ✎ button appears only where there is an editor');
  {
    const r = await page.evaluate(() => {
      DB.rsk = [{ id: 'r1', d: 'סיכון', a: 'אזור' }];
      DB.ncr = [{ id: 'n1', num: 'NCR-1', d: 'אי-התאמה', s: 'פתוח' }];
      showView('rsk', 'r1');
      const onRsk = { shown: getComputedStyle(g('view-edit')).display !== 'none', tbl: g('view-edit').dataset.vtbl, id: g('view-edit').dataset.vid };
      showView('ncr', 'n1');
      const onNcr = { shown: getComputedStyle(g('view-edit')).display !== 'none' };
      return { onRsk: onRsk, onNcr: onNcr };
    });
    check('a risk gets ✎ ערוך, bound to that record', r.onRsk.shown && r.onRsk.tbl === 'rsk' && r.onRsk.id === 'r1', r.onRsk);
    check('an NCR does not — it has its own editor already', !r.onNcr.shown, r.onNcr);
  }

  await browser.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('HARNESS ERROR', e); process.exit(2); });
