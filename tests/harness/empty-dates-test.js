// CLAUDE.md rule 2: an empty date is saved as null, never ''. Postgres rejects ''
// in a date column, and '' in a text column breaks every du()/eb() comparison.
// The forms below read a type="date" input with a bare gv('x') and sent '' when
// the date was left empty (02/10/2026): docs u, emp s, ptw ds/de/sg1d..sg4d, hzm ms.
// Each form is opened, the dates left empty, saved, and the payload captured from
// the stubbed sbIns (new row) and sbUpd (edit). Also: the PTW printout of a permit
// with no dates must not print the word "null".
// Chromium, network blocked, Supabase stubbed.
const path = require('path');
let pw; try { pw = require('playwright'); } catch (e) { pw = require('playwright-core'); }
const HTML = 'file://' + path.resolve(__dirname, '../../index.html');
const res = [];
const say = (k, ok, d) => { res.push({ k, ok, d }); console.log((ok ? 'PASS ' : 'FAIL ') + k + (d !== undefined ? '  -> ' + JSON.stringify(d).slice(0, 400) : '')); };

// form -> modal, save function, table, required field [id, value], date fields [input id, record key]
const FORMS = [
  { tbl: 'docs', modal: 'm-doc', save: 'svDoc', req: ['d-n', 'doc test'], dates: [['d-u', 'u'], ['d-e', 'e']] },
  { tbl: 'emp', modal: 'm-emp', save: 'svEmp', req: ['e-n', 'emp test'], dates: [['e-s', 's']] },
  { tbl: 'ptw', modal: 'm-ptw', save: 'svPtw', req: ['ptw-con', 'contractor test'],
    dates: [['ptw-ds', 'ds'], ['ptw-de', 'de'], ['ptw-sg1d', 'sg1d'], ['ptw-sg2d', 'sg2d'], ['ptw-sg3d', 'sg3d'], ['ptw-sg4d', 'sg4d']] },
  { tbl: 'hzm', modal: 'm-hzm', save: 'svHzm', req: ['hzm-n', 'hazmat test'], dates: [['hzm-ms', 'ms']] },
];

(async () => {
  const browser = await pw.chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'he-IL' })).newPage();
  await page.route('**/*', (r) => r.request().url().startsWith('file://') ? r.continue() : r.abort());
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  page.on('dialog', (d) => d.accept().catch(() => {}));
  await page.goto(HTML, { waitUntil: 'load' }); await page.waitForTimeout(800);
  await page.evaluate(() => {
    document.getElementById('login').style.display = 'none'; document.getElementById('app').style.display = 'block';
    window.__ins = []; window.__upd = [];
    window.sbIns = function (t, r) { window.__ins.push({ t, r: JSON.parse(JSON.stringify(r)) }); };
    window.sbUpd = function (t, r) { window.__upd.push({ t, r: JSON.parse(JSON.stringify(r)) }); };
    window.sdb = function () {}; window.addLog = function () {}; window.toast = function () {};
    window._currentUser = { username: 'admin' }; _isAdmin = true;
    ['docs', 'emp', 'ptw', 'hzm'].forEach(function (t) { DB[t] = []; });
    _svEditing = {};
  });

  for (const f of FORMS) {
    // new record, every date empty
    let r = await page.evaluate((f) => {
      openModal(f.modal);
      f.dates.forEach(function (d) { var el = g(d[0]); if (el) el.value = ''; });
      g(f.req[0]).value = f.req[1];
      var n0 = window.__ins.length;
      window[f.save]();
      var hit = window.__ins.slice(n0).find(function (x) { return x.t === f.tbl; });
      try { closeModal(f.modal); } catch (e) {}
      return hit ? { id: hit.r.id, vals: f.dates.map(function (d) { return [d[1], hit.r[d[1]]]; }) } : { err: 'no sbIns for ' + f.tbl };
    }, f);
    say(f.tbl + ' new: empty dates saved as null (' + f.dates.map(d => d[1]).join(',') + ')', !r.err && r.vals.every(v => v[1] === null), r);
    if (r.err) continue;
    // edit the same record, dates still empty -> sbUpd payload
    const r2 = await page.evaluate((a) => {
      var f = a.f;
      _svEditing = {}; _genEdit(f.tbl, a.id); // the real edit path: pencil -> modal filled -> save
      f.dates.forEach(function (d) { var el = g(d[0]); if (el) el.value = ''; });
      g(f.req[0]).value = f.req[1] + ' 2';
      var n0 = window.__upd.length;
      window[f.save]();
      var hit = window.__upd.slice(n0).find(function (x) { return x.t === f.tbl; });
      _svEditing = {};
      try { closeModal(f.modal); } catch (e) {}
      return hit ? { vals: f.dates.map(function (d) { return [d[1], hit.r[d[1]]]; }) } : { err: 'no sbUpd for ' + f.tbl };
    }, { f, id: r.id });
    say(f.tbl + ' edit: empty dates saved as null', !r2.err && r2.vals.every(v => v[1] === null), r2);
    // a filled date still goes through unchanged
    const r3 = await page.evaluate((f) => {
      _svEditing = {};
      openModal(f.modal);
      f.dates.forEach(function (d) { var el = g(d[0]); if (el) el.value = '2026-10-02'; });
      g(f.req[0]).value = f.req[1] + ' 3';
      var n0 = window.__ins.length;
      window[f.save]();
      var hit = window.__ins.slice(n0).find(function (x) { return x.t === f.tbl; });
      try { closeModal(f.modal); } catch (e) {}
      return hit ? { vals: f.dates.map(function (d) { return [d[1], hit.r[d[1]]]; }) } : { err: 'no sbIns' };
    }, f);
    say(f.tbl + ' new: a filled date is kept as YYYY-MM-DD', !r3.err && r3.vals.every(v => v[1] === '2026-10-02'), r3);
  }

  // PTW printout with no dates: "-" rather than "null"
  const pr = await page.evaluate(() => {
    var html = '';
    var orig = window.open;
    window.open = function () { return { document: { write: function (s) { html += s; }, close: function () {} } }; };
    try {
      openModal('m-ptw');
      ['ptw-ds', 'ptw-de', 'ptw-sg1d', 'ptw-sg2d', 'ptw-sg3d', 'ptw-sg4d'].forEach(function (i) { g(i).value = ''; });
      g('ptw-con').value = 'print test';
      ptwPrint();
    } finally { window.open = orig; try { closeModal('m-ptw'); } catch (e) {} }
    var body = html.replace(/<script[\s\S]*?<\/script>/g, '');
    return { len: html.length, hasNull: /\bnull\b/.test(body), hasUndef: /\bundefined\b/.test(body) };
  });
  say('ptw print with empty dates: no "null" / "undefined" in the page', pr.len > 0 && !pr.hasNull && !pr.hasUndef, pr);

  // BACKLOG 10.1 / 03/10/2026: a key the DB has no column for is dropped by the PGRST204 self-heal
  // (ncr.src_date lost the discovery date of every Excel import). Compare every captured payload
  // with tests/harness/db-columns.json.
  {
    const COLS = require('./db-columns.json');
    const sent = await page.evaluate(() => [].concat(window.__ins || [], window.__upd || []).map(x => ({ t: x.t, k: Object.keys(x.r || {}) })));
    const unknown = [];
    sent.forEach(x => { if (!COLS[x.t]) return; x.k.forEach(k => { if (COLS[x.t].indexOf(k) < 0 && unknown.indexOf(x.t + '.' + k) < 0) unknown.push(x.t + '.' + k); }); });
    say('every saved field has a column in the DB (' + sent.length + ' payloads)', sent.length > 0 && unknown.length === 0, unknown);
  }
  say('no page errors', errs.length === 0, errs.slice(0, 5));
  await browser.close();
  const nf = res.filter(x => !x.ok).length; console.log('\n' + res.filter(x => x.ok).length + ' passed, ' + nf + ' failed'); process.exit(nf ? 1 : 0);
})().catch(e => { console.error('HARNESS ERROR', e); process.exit(1); });
