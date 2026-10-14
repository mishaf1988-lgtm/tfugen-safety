// The trainings page and the annual / quality training in the manager's screens (14/10/2026,
// Michael: "all my trainings under one category", "a barcode for the annual training ... one form
// 08.01 with everyone"). A page of its own with a tile in the modules sheet; the form's kind select
// (weekly, induction, annual, quality) with duration and a copy address for the typed kinds; the
// link dialog says "until you close" and offers "close signatures"; who-signed counts a worker as
// signed by the typed ID, and makes form 08.01 through /api/talk op form0801.
const path = require('path');
let pw; try { pw = require('playwright'); } catch (e) { pw = require('playwright-core'); }
const HTML = 'file://' + path.resolve(__dirname, '../../index.html');
let pass = 0, fail = 0;
const check = (l, c, d) => { if (c) { pass++; console.log('  ✓ ' + l); } else { fail++; console.log('  ✗ ' + l + (d !== undefined ? '  -> ' + JSON.stringify(d) : '')); } };

(async () => {
  const browser = await pw.chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 375, height: 812 }, locale: 'he-IL' })).newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.route('**/*', (r) => r.request().url().startsWith('file://') ? r.continue() : r.abort());
  await page.goto(HTML, { waitUntil: 'load' });
  await page.waitForTimeout(700);
  const r = await page.evaluate(async () => {
    window.sdb = function () {}; window.addLog = function () {};
    const ins = [], toasts = [];
    window.sbIns = (t, x) => ins.push([t, JSON.parse(JSON.stringify(x))]); window.sbUpd = (t, x) => ins.push([t, JSON.parse(JSON.stringify(x))]);
    window.toast = (m) => toasts.push(String(m));
    _currentUser = { username: 'admin' }; window._sbToken = 'tok';
    window.qrcode = function () { return { addData() {}, make() {}, getModuleCount() { return 21; }, isDark() { return false; } }; };
    DB.emp = [{ id: 'e1', n: 'אחמד', dep: 'ייצור', eid: '1111111' }, { id: 'e2', n: 'דנה', dep: 'אריזה', eid: '2222222' }];
    DB.toolbox_talks = []; DB.toolbox_reads = [];
    const o = {};
    o.tile = !!document.querySelector('#m-modules-sheet [onclick="_goFromSheet(\'m-modules-sheet\',\'training\')"]');
    goPage('training');
    o.page = document.getElementById('pg-training').classList.contains('on') && document.getElementById('pg-training').contains(document.getElementById('tbt-card'));
    o.notOnToolbox = !document.getElementById('pg-toolbox').contains(document.getElementById('tbt-card'));
    const set = (id, v) => { document.getElementById(id).value = v; };
    openModal('m-tbt');
    const k = document.getElementById('tbt-kind');
    o.opts = Array.from(k.options).map((x) => x.value);
    o.durHidden = document.getElementById('tbt-dur-f').style.display === 'none';
    set('tbt-title', 'הדרכת בטיחות שנתית 2026'); set('tbt-body', '1. נהלים\n2. ציוד מגן'); set('tbt-trainer', 'מיכאל'); set('tbt-trainer-q', 'ממונה'); set('tbt-s', 'פורסמה');
    k.value = 'annual'; k.dispatchEvent(new Event('change'));
    o.durShown = document.getElementById('tbt-dur-f').style.display !== 'none' && document.getElementById('tbt-cc-f').style.display !== 'none';
    set('tbt-dur', 'שעתיים'); set('tbt-cc', 'quality@tapugan.co.il');
    svTbt(); const sv = ins.slice(-1)[0][1]; o.saved = { kind: sv.kind, dur: sv.dur, cc: sv.mail_cc }; const id = sv.id;
    openModal('m-tbt'); o.fresh = { kind: document.getElementById('tbt-kind').value, dur: document.getElementById('tbt-dur').value, hidden: document.getElementById('tbt-dur-f').style.display === 'none' }; closeModal('m-tbt');
    _genEdit('toolbox_talks', id); o.edit = { kind: document.getElementById('tbt-kind').value, dur: document.getElementById('tbt-dur').value, cc: document.getElementById('tbt-cc').value }; closeModal('m-tbt');
    // link: until closed, and "close signatures"
    const calls = [];
    window.fetch = (u, init) => { const b = JSON.parse(init.body); calls.push(b);
      const j = b.op === 'form0801' ? { ok: true, pdf: true, n: 2, mailed: true, url: 'https://od.example/f.pdf' } : { url: 'https://tapugan-safety.pages.dev/api/talk?k=perm0', perm: true, link_v: 0 };
      return Promise.resolve(new Response(JSON.stringify(j), { status: 200 })); };
    o.link = await tbtLink(id);
    o.days = document.getElementById('tbt-link-days').textContent;
    o.rv = document.getElementById('tbt-link-revoke').textContent;
    let asked = ''; window.confirm = (m) => { asked = m; return false; }; await tbtRevoke(); o.asked = asked;
    closeModal('m-tbt-link');
    // who signed: one worker typed his card's ID, one temp; the other worker did not sign
    DB.toolbox_reads = [{ id: 'r1', talk_id: id, emp_id: 'x:1111111:ahmad', emp_name: 'אחמד', id_no: '1111111', dept: 'טוגנים', read_at: '2026-10-20T07:00:00Z' },
      { id: 'r2', talk_id: id, emp_id: 'x:9999999:temp', emp_name: 'זמני', id_no: '9999999', dept: 'אריזה', read_at: '2026-10-20T07:02:00Z' }];
    tbtWho(id); const wb = document.getElementById('tbt-who-body').textContent;
    o.who = { out: wb.includes('מחוץ לרשימה') || wb.includes('לא ברשימת העובדים'), decl: wb.includes('בכל הנושאים שלמעלה'), miss: wb.includes('לא חתמו'), dana: wb.includes('דנה'), ahmadMissing: wb.includes('(1): אחמד'), danaMissing: wb.includes('אריזה (1): דנה') };
    o.btn = !!document.getElementById('tbt-0801-btn');
    o.form = await tbtForm0801(id);
    o.formCall = calls.filter((c) => c.op === 'form0801')[0];
    o.res = document.getElementById('tbt-0801-res').innerHTML;
    return o;
  });
  check('a "הדרכות" tile in the modules sheet', r.tile);
  check('the trainings card lives on its own page, no longer on "שיחות בטיחות"', r.page && r.notOnToolbox, r);
  check('the kind select: weekly, induction, annual, quality', r.opts.join() === ',induction,annual,quality', r.opts);
  check('duration and copy address only for annual / quality', r.durHidden && r.durShown);
  check('saved: kind annual, duration, copy address', r.saved.kind === 'annual' && r.saved.dur === 'שעתיים' && r.saved.cc === 'quality@tapugan.co.il', r.saved);
  check('a new form starts weekly, the fields empty and hidden', r.fresh.kind === '' && r.fresh.dur === '' && r.fresh.hidden, r.fresh);
  check('edit brings kind, duration and address back', r.edit.kind === 'annual' && r.edit.dur === 'שעתיים' && r.edit.cc === 'quality@tapugan.co.il', r.edit);
  check('the link dialog: permanent until closed, the worker types his details', r.link === 'shown' && /עד שתסגור/.test(r.days) && /מקליד/.test(r.days), r.days);
  check('...the button says "close signatures", and asks before closing', /סגור חתימות/.test(r.rv) && /לסגור את החתימות/.test(r.asked), [r.rv, r.asked]);
  check('who signed: nobody "outside the list", the annual declaration; a worker counts as signed by the typed ID', !r.who.out && r.who.decl && r.who.miss && r.who.danaMissing && !r.who.ahmadMissing, r.who);
  check('form 08.01: the button calls op form0801 and shows the result with a link', r.btn && r.form === 'ok' && r.formCall && r.formCall.id && /od\.example\/f\.pdf/.test(r.res) && /2/.test(r.res), r.res);
  check('no page errors', errors.length === 0, errors);
  await browser.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('HARNESS ERROR', e); process.exit(2); });
