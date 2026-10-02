// Lesson 38 as a detector, not a one-off fix (02/10/2026): every form that keeps
// its record in a hidden <input id="X-id"> is opened, with the id pre-set to a
// stale value, through every public entry: inline onclick strings that open the
// modal or call a function that opens it, top-level functions that open it
// (edit/show/_gen* excluded: they set the id on purpose), and each quick-capture
// type in capDispatch. An entry that shows the form with the stale id still in
// place would overwrite the last edited record on save. On main before #1079
// this reported capDispatch for ncr and eqi.
const path = require('path'); const fs = require('fs');
let pw; try { pw = require('playwright'); } catch (e) { pw = require('playwright-core'); }
const FILE = path.resolve(__dirname, '../../index.html');
const src = fs.readFileSync(FILE, 'utf8');
let pass = 0, fail = 0;
const check = (l, c, d) => { if (c) { pass++; console.log('  ✓ ' + l); } else { fail++; console.log('  ✗ ' + l + (d !== undefined ? '  -> ' + JSON.stringify(d) : '')); } };

function fnBody(name) {
  const i = src.indexOf('function ' + name + '(');
  if (i < 0) return '';
  const j = src.indexOf('\nfunction ', i + 10);
  return src.slice(i, j > 0 ? j : i + 6000);
}

(async () => {
  const forms = [...new Set([...src.matchAll(/type="hidden" id="([a-z]+)-id"/g)].map((m) => m[1]))].filter((f) => src.includes('id="m-' + f + '"'));
  check('forms with a hidden id and a modal found (' + forms.join(', ') + ')', forms.length >= 8, forms);
  const fnNames = [...new Set([...src.matchAll(/\nfunction\s+([A-Za-z_$][\w$]*)\s*\(/g)].map((m) => m[1]))];
  // capDispatch: which case opens which modal (directly or via openNew*Modal)
  const cap = fnBody('capDispatch');
  const capCases = [...cap.matchAll(/case '([a-z]+)':([\s\S]*?)break;/g)].map((m) => ({ type: m[1], body: m[2] }));

  const browser = await pw.chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'he-IL' })).newPage();
  await page.route('**/*', (r) => r.request().url().startsWith('file://') ? r.continue() : r.abort());
  page.on('dialog', (d) => d.dismiss().catch(() => {}));
  await page.goto('file://' + FILE, { waitUntil: 'load' }); await page.waitForTimeout(800);
  await page.evaluate(() => { document.getElementById('login').style.display = 'none'; document.getElementById('app').style.display = 'block'; window.sbIns = window.sbUpd = window.sdb = window.addLog = window.toast = function () {}; window._currentUser = { username: 'admin' }; _isAdmin = true; });

  let entriesTotal = 0;
  for (const f of forms) {
    const modal = 'm-' + f;
    const opening = fnNames.filter((n) => fnBody(n).includes("openModal('" + modal + "')"));
    const viaFn = (oc) => opening.some((n) => oc.includes(n + '('));
    const onclicks = [...new Set([...src.matchAll(/onclick="([^"]+)"/g)].map((m) => m[1]).filter((oc) => oc.includes("'" + modal + "'") || viaFn(oc)))]
      .filter((oc) => !/this\.dataset\.|\.id\)|editRow|_genEdit\(/.test(oc));   // row buttons carry a real id
    const fns = opening.filter((n) => !/^(edit|_genEdit|show|view|_sv|_rc|_cl)/.test(n) && !/Edit|Clone/.test(n)).map((n) => n + '()');
    const caps = capCases.filter((c) => c.body.includes("'" + modal + "'") || opening.some((n) => c.body.includes(n + '('))).map((c) => "capDispatch({type:'" + c.type + "',description:'x',area:'y',date:'2026-10-01'})");
    const entries = [...new Set(onclicks.concat(fns, caps))];
    entriesTotal += entries.length;
    const bad = [];
    for (const code of entries) {
      const r = await page.evaluate(async ({ f, modal, code }) => {
        const idEl = document.getElementById(f + '-id'); idEl.value = 'stale';
        let err = null; try { eval(code); } catch (e) { err = e.message; }
        await new Promise((res) => setTimeout(res, 350));
        const open = getComputedStyle(document.getElementById(modal)).display !== 'none';
        const id = idEl.value;
        try { closeModal(modal); } catch (e) {}
        document.querySelectorAll('.modal').forEach((m) => { m.style.display = 'none'; });
        document.querySelectorAll('[id^="ov-"]').forEach((o) => { o.style.display = 'none'; });
        return { open, id, err };
      }, { f, modal, code });
      if (r.open && r.id === 'stale') bad.push(code.slice(0, 100));
    }
    check(f + ': ' + entries.length + ' entries open the form, none keeps a stale id', bad.length === 0, bad);
  }
  check('enough entries were exercised (' + entriesTotal + ')', entriesTotal >= 20, entriesTotal);
  await browser.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('HARNESS ERROR', e); process.exit(1); });
