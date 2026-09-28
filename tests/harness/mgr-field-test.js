// Safety manager field mode (28/09): the login-screen button "ממשק ממונה
// הבטיחות" and the one-screen hazard report it lands on. Drives the real
// mgrFieldLogin / mgrFieldOpen / mgrFieldSave against seeded tour_hazards.
const path = require('path');
let pw; try { pw = require('playwright'); } catch (e) { pw = require('playwright-core'); }
const HTML = 'file://' + path.resolve(__dirname, '../../index.html');
let pass = 0, fail = 0;
const check = (l, c, d) => { if (c) { pass++; console.log('  ✓ ' + l); } else { fail++; console.log('  ✗ ' + l + (d !== undefined ? '  -> ' + JSON.stringify(d) : '')); } };

(async () => {
  const browser = await pw.chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, locale: 'he-IL' });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.route('**/*', (r) => r.request().url().startsWith('file://') ? r.continue() : r.abort());
  await page.goto(HTML, { waitUntil: 'load' });
  await page.waitForTimeout(700);

  console.log('\n1. the login screen');
  const btn = await page.evaluate(() => { const b = document.getElementById('login-mgr-btn'); return b ? { text: b.textContent.trim(), shown: b.offsetParent !== null } : null; });
  check('a button "ממשק ממונה הבטיחות" on the login screen', btn && /ממשק ממונה הבטיחות/.test(btn.text) && btn.shown, btn);
  await page.click('#login-mgr-btn');
  const after = await page.evaluate(() => ({ wanted: _mfWanted(), hint: document.getElementById('pw-err').textContent, focus: document.activeElement && document.activeElement.id }));
  check('it asks for the same username and password, and remembers where to land', after.wanted && /הסיסמה שלך/.test(after.hint) && after.focus === 'uname', after);
  const hook = await page.evaluate(() => /_mfWanted\(\)\)setTimeout\(mgrFieldOpen/.test(String(_finishLogin)));
  check('after a successful login the report screen opens', hook);

  console.log('\n2. reporting');
  const out = await page.evaluate(() => {
    window.sdb = function () {}; window.addLog = function () {}; window.goPage = function (p) { window._went = p; };
    const ins = [], toasts = [];
    window.sbIns = function (t, r) { ins.push([t, JSON.parse(JSON.stringify(r))]); };
    window.sbUpd = function (t, r) { ins.push(['upd:' + t, JSON.parse(JSON.stringify(r))]); };
    window.toast = function (m) { toasts.push(String(m)); };
    const today = _thzToday();
    DB.tour_hazards = [
      { id: 'th-1', n: 1, d: '2026-09-01', tour_no: 9, dept: 'תוצג', descr: 'ישן', s: 'סגור' },
      { id: 'th-2', n: 7, d: today, tour_no: 10, dept: 'מעצבים', descr: 'מהסיור של היום', s: 'פתוח' },
    ];
    const res = {};
    mgrFieldOpen();
    const ov = document.getElementById('mf');
    res.open = ov && ov.style.display === 'block' && !_mfWanted();
    res.chips = Array.from(ov.querySelectorAll('.mf-chips')[0].children).map((b) => b.textContent);
    res.noScroll = document.documentElement.scrollWidth <= 375 && ov.scrollWidth <= 375;
    mgrFieldSave(); res.noDept = toasts.slice(-1)[0]; res.ins0 = ins.length;
    _mfPickDept('תוצג');
    res.sub = ov.querySelector('.mf-sub').textContent;
    mgrFieldSave(); res.noDescr = toasts.slice(-1)[0]; res.ins1 = ins.length;
    document.getElementById('mf-loc').value = 'מחסן';
    document.getElementById('mf-descr').value = 'כבל חשוף';
    _mfPickSev('גבוהה');                       // a re-render must keep what was typed
    res.keptDescr = document.getElementById('mf-descr').value;
    mgrFieldSave();
    res.first = ins[0];
    res.cleared = document.getElementById('mf-descr').value === '' && document.getElementById('mf-loc').value === '';
    res.keptDept = ov.querySelector('.mf-chip.on') && ov.querySelector('.mf-chip.on').textContent;
    document.getElementById('mf-descr').value = 'מטף חסר';
    mgrFieldSave(); res.second = ins[1];
    _mfPickDept('מעצבים'); document.getElementById('mf-descr').value = 'עוד אחד'; mgrFieldSave(); res.third = ins[2];
    res.done = ov.querySelector('.mf-done') && ov.querySelector('.mf-done').textContent;
    res.today = today;
    mgrFieldClose(); res.closed = ov.style.display === 'none' && window._went === 'thz';
    res.tourBtn = !!document.querySelector('#pg-thz [onclick="mgrFieldOpen()"]');
    return res;
  });
  check('opens full screen; the landing flag is used once', out.open, out.open);
  check('the 5 departments as big buttons', out.chips.length === 5, out.chips);
  check('fits a 375px phone (no sideways scroll)', out.noScroll);
  check('no department: refused', out.ins0 === 0 && /מחלקה/.test(out.noDept), out.noDept);
  check('no description: refused', out.ins1 === 0 && /תיאור/.test(out.noDescr), out.noDescr);
  check('a new department today: the next tour number (11), shown on top', /סיור מס' 11/.test(out.sub), out.sub);
  check('what was typed survives tapping a chip', out.keptDescr === 'כבל חשוף', out.keptDescr);
  const r = out.first && out.first[1];
  check('saved to tour_hazards: today, tour 11, next מס"ד (8), open, severity picked', out.first && out.first[0] === 'tour_hazards' && r.d === out.today && r.tour_no === 11 && r.n === 8 && r.s === 'פתוח' && r.sev === 'גבוהה' && r.dept === 'תוצג' && r.loc === 'מחסן' && r.resp === 'מנהל המחלקה', r);
  check('empty fields are null, never ""', r && r.action === null && r.due === null && r.notes === null && r.photo_url === null && r.closed_d === null, r);
  check('after saving: the hazard fields clear, the department stays', out.cleared && out.keptDept === 'תוצג', out.keptDept);
  check('the next hazard of the same tour: same tour number, next מס"ד', out.second && out.second[1].tour_no === 11 && out.second[1].n === 9 && out.second[1].sev === 'גבוהה', out.second);
  check('a department already toured today keeps that tour number (10)', out.third && out.third[1].tour_no === 10 && out.third[1].dept === 'מעצבים', out.third);
  check('a count of what was saved', /נשמרו 3/.test(out.done || ''), out.done);
  check('"למערכת" closes it and shows the tours screen', out.closed);
  check('the tours screen has a button to open it too', out.tourBtn);
  check('no page errors', errors.length === 0, errors);

  await browser.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('HARNESS ERROR', e); process.exit(2); });
