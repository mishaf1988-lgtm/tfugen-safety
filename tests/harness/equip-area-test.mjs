// The area responsible for equipment (20/10/2026, Michael in the questionnaire): equip_inspections.resp_area
// holds an area, not a person; who runs each area sits in SITE.equipAreas (one line). The weekly mail
// names the area next to an item that expired or is near, marks it as not Michael's and sends no quote
// link for it; the expiry page shows it in the "responsible" column with a mark; the equipment card
// has the field, saves it, and the item view shows it. A row with no area behaves as before.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import { expiringOf, attachQuotes, digestHtml, digestOf } from './_build/weekly-digest.mjs';
import { SITE, CLIENT_KEYS } from './_build/_site.mjs';

const require = createRequire(import.meta.url);
let pass = 0, fail = 0;
const check = (l, c, d) => { if (c) { pass++; console.log('  ✓ ' + l); } else { fail++; console.log('  ✗ ' + l + (d !== undefined ? '  -> ' + JSON.stringify(d).slice(0, 400) : '')); } };
const here = path.dirname(fileURLToPath(import.meta.url));
const AREA = 'תשתיות ואמוניה', WHO = 'שלומי ויורי', NOT_MINE = 'לא באחריותך, להעביר לאחראי';
const TODAY = '2026-10-20';

console.log('\n1. one place for the areas');
check('SITE.equipAreas maps the area to who runs it', SITE.equipAreas && SITE.equipAreas[AREA] === WHO, SITE.equipAreas);
check('the page gets it (CLIENT_KEYS)', CLIENT_KEYS.includes('equipAreas'));
check('no mail address in it (a public file)', !/@/.test(JSON.stringify(SITE.equipAreas)));
const cols = JSON.parse(fs.readFileSync(path.join(here, 'db-columns.json'), 'utf8'));
check('db-columns.json has equip_inspections.resp_area', (cols.equip_inspections || []).includes('resp_area'));
check('a migration adds it', fs.readdirSync(path.join(here, '../../migrations')).some((f) => /resp_area/.test(f) && /add column if not exists resp_area/.test(fs.readFileSync(path.join(here, '../../migrations', f), 'utf8'))));

console.log('\n2. the weekly mail');
const rows = [
  { id: 'a1', n: 'כיול גלאי אמוניה', vendor: 'עמוס גזית בע"מ', e: '2026-10-10', resp_area: AREA },
  { id: 'b1', n: 'מלגזה', vendor: 'ג\'ורג\' פריד מהנדסים בע"מ', e: '2026-10-25', resp_area: null },
];
const list = expiringOf([['בדיקת ציוד', ['n'], ['vendor', 'loc'], rows, 'equip_inspections', 'equip_inspections']], TODAY);
const a = list.find((x) => x.id === 'a1'), b = list.find((x) => x.id === 'b1');
check('an item with an area carries it and who runs it', a && a.area === AREA && a.who === WHO, a);
check('an item with no area has none', b && !b.area && !b.who, b);
attachQuotes(list, [['גזית', 'g@example.com'], ['פריד', 'f@example.com']], {}, TODAY);
check('no quote link for another area\'s item (only marked)', a && !a.quote, a && a.quote);
check('the item with no area still gets its quote link', b && b.quote && b.quote.href, b && b.quote);
const html = digestHtml(digestOf([], TODAY), TODAY, { expiring: list, expFail: [] });
check('the mail names the area and who', html.includes(AREA + ': ' + WHO));
check('the mail marks it as not Michael\'s', html.includes(NOT_MINE));
check('the supplier stays under it', html.includes('עמוס גזית'));
check('the mark appears once (the other row has no area)', html.split(NOT_MINE).length === 2);
const src = fs.readFileSync(path.join(here, '../../functions/api/weekly-digest.js'), 'utf8');
check('the expiry read selects resp_area for equipment', /t === 'equip_inspections' \? \['resp_area'\]/.test(src));

console.log('\n3. the app');
let pw; try { pw = require('playwright'); } catch (e) { pw = require('playwright-core'); }
const HTML = 'file://' + path.resolve(here, '../../index.html');
const iso = (days) => { const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() + days); return d.toISOString().substring(0, 10); };
const browser = await pw.chromium.launch();
try {
  const page = await (await browser.newContext({ viewport: { width: 1200, height: 900 }, locale: 'he-IL' })).newPage();
  await page.route('**/*', (r) => r.request().url().startsWith('file://') ? r.continue() : r.abort());
  await page.goto(HTML, { waitUntil: 'load' });
  await page.waitForTimeout(600);
  const r = await page.evaluate(([AREA, iso1, iso2]) => {
    document.getElementById('login').style.display = 'none';
    document.getElementById('app').style.display = 'block';
    DB.equip_inspections = [
      { id: 'a1', n: 'גלאי', vendor: 'גזית', e: iso1, resp_area: AREA },
      { id: 'b1', n: 'מלגזה', vendor: 'פריד', e: iso2, resp_area: null },
    ];
    ['docs', 'tr', 'ppe', 'ctr', 'med', 'hearing_tests'].forEach((k) => { DB[k] = []; });
    let saved = null;
    window.sbIns = function () {}; window.sbUpd = function (t, rec) { saved = rec; }; window.sdb = function () {};
    window._currentUser = { username: 'admin' }; _isAdmin = true;
    _applyRoleGates(); goPage('exp'); rExp();
    const tr = [...document.querySelectorAll('#tb-exp tr')].map((x) => x.textContent);
    const out = { gl: tr.find((t) => t.includes('גלאי')) || '', ml: tr.find((t) => t.includes('מלגזה')) || '' };
    eqiEdit('a1');
    return new Promise((res) => setTimeout(() => {
      const sel = document.getElementById('eqi-resp-area');
      out.opts = sel ? [...sel.options].map((o) => o.value + '|' + o.textContent) : null;
      out.val = sel && sel.value;
      sel.value = '';
      svEqi();
      out.cleared = saved && saved.resp_area;
      eqiEdit('b1');
      setTimeout(() => {
        document.getElementById('eqi-resp-area').value = AREA;
        svEqi();
        out.set = saved && saved.resp_area;
        out.view = VIEW_CONFIG.equip_inspections.fields.some((f) => f[1] === 'resp_area');
        res(out);
      }, 80);
    }, 80));
  }, [AREA, iso(-3), iso(5)]);
  check('expiry page: the area and who in the responsible column', r.gl.includes(AREA + ': ' + 'שלומי ויורי'), r.gl);
  check('expiry page: marked "pass to the responsible"', r.gl.includes('להעביר לאחראי'), r.gl);
  check('expiry page: an item with no area shows its supplier, no mark', r.ml.includes('פריד') && !r.ml.includes('להעביר לאחראי'), r.ml);
  check('the card offers the safety manager (empty) and the area with who', r.opts && r.opts[0].startsWith('|') && r.opts.some((o) => o === AREA + '|' + AREA + ': שלומי ויורי'), r.opts);
  check('the card opens on the saved area', r.val === AREA, r.val);
  check('saving with the safety manager stores null, not \'\'', r.cleared === null, r.cleared);
  check('saving with an area stores it', r.set === AREA, r.set);
  check('the item view shows the area (VIEW_CONFIG)', r.view === true);
} finally { await browser.close(); }

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
