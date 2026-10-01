// Recurring hazards (ISO 45001 10.2, 01/10/2026): the same kind of hazard
// again and again, or the same department + place twice in a year, is shown
// on the tours screen and as a hint while a hazard is being written.
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

  await page.evaluate(() => {
    const ago = (n) => new Date(Date.parse(_thzToday() + 'T12:00:00Z') - n * 86400000).toISOString().substring(0, 10);
    window.__ago = ago;
    // The shape of the real data on 01/10/2026: electrical rooms in several departments.
    DB.tour_hazards = [
      { id: 'a', d: ago(5), dept: 'מעצבים', loc: 'חדר חשמל', descr: 'גישה פתוחה לחדר חשמל', s: 'סגור' },
      { id: 'b', d: ago(20), dept: 'ייצור טוגנים', loc: 'חדר חשמל', descr: 'חדר החשמל פתוח', s: 'סגור' },
      { id: 'c', d: ago(60), dept: 'מעבדות', loc: 'ארון חשמל', descr: 'ארון החשמל חסום בקרטונים', s: 'פתוח' },
      { id: 'd', d: ago(200), dept: 'חומר גלם', loc: 'ארון חשמל', descr: 'ארון חשמל פתוח', s: 'סגור' },
      { id: 'e', d: ago(10), dept: 'תוצג', loc: 'חדר 0', descr: 'גישה למגונית חסומה', s: 'סגור' },
      { id: 'f', d: ago(3), dept: 'תוצג', loc: 'חדר 0', descr: 'המיגונית בחדר 0 חסומה', s: 'פתוח' },
      { id: 'g', d: ago(400), dept: 'תוצג', loc: 'חדר 0', descr: 'ישן מאוד', s: 'סגור' },
      { id: 'h', d: null, dept: 'מעצבים', loc: 'ארון חשמל', descr: 'בלי תאריך', s: 'פתוח' },
      { id: 'i', d: ago(8), dept: 'מעצבים', loc: 'ארון כיבוי אש', descr: 'ארון כיבוי אש חסום', s: 'פתוח' },
    ];
    DB.trustee_reports = [];
  });

  console.log('\n1. kinds from words');
  const k = await page.evaluate(() => ({
    el: _thzKinds('ארון חשמל פתוח'), fire: _thzKinds('ארונות כיבוי אש חסומים'), shower: _thzKinds('מקלחת החירום מסובבת'),
    eye: _thzKinds('משטפת עיניים לא תקינה'), jerry: _thzKinds("ג'ריקן זרוק בכניסה"), none: _thzKinds('מראה שבורה'),
    shelter: _thzKinds('מרחב מוגן'), guard: _thzKinds('מגני דפנות המטגנת פתוחים'),
  }));
  check('electrical', k.el.join() === 'חשמל', k.el);
  check('fire equipment', k.fire.join() === 'ציוד כיבוי אש', k.fire);
  check('emergency shower and eye wash are emergency equipment', k.shower.join() === 'ציוד חירום' && k.eye.join() === 'ציוד חירום', [k.shower, k.eye]);
  check('a protected space is emergency equipment, not machine guarding', k.shelter.join() === 'ציוד חירום', k.shelter);
  check('jerrycan = hazardous materials', k.jerry.indexOf('חומרים מסוכנים') >= 0, k.jerry);
  check('machine guards', k.guard.indexOf('מיגון מכונות') >= 0, k.guard);
  check('a text with no keyword has no kind', k.none.length === 0, k.none);

  console.log('\n2. what counts as recurring');
  const r = await page.evaluate(() => ({ kinds: _thzRecurring().map((x) => [x.kind, x.rows.map((y) => y.id).sort().join(''), x.depts.length, x.closed]), places: _thzRepPlaces().map((p) => [p.dept, p.loc, p.rows.map((y) => y.id).sort().join('')]) }));
  const el = r.kinds.find((x) => x[0] === 'חשמל');
  check('electrical: 3 in 90 days across 3 departments, 2 closed', el && el[1] === 'abc' && el[2] === 3 && el[3] === 2, r.kinds);
  check('200 days ago and no date are not in the 90 days', el && el[1].indexOf('d') < 0 && el[1].indexOf('h') < 0, el);
  check('fire equipment once is not recurring', !r.kinds.find((x) => x[0] === 'ציוד כיבוי אש'), r.kinds);
  check('emergency equipment twice is below 3', !r.kinds.find((x) => x[0] === 'ציוד חירום'), r.kinds);
  check('the same place twice in a year: תוצג, חדר 0 (e, f; not the one 400 days ago)', r.places.length >= 1 && r.places.some((p) => p[0] === 'תוצג' && p[2] === 'ef'), r.places);
  check('the same loc in different departments is not the same place', !r.places.some((p) => p[1] === 'חדר חשמל'), r.places);

  console.log('\n3. trustees\' findings count too');
  const t = await page.evaluate(() => {
    const save = DB.trustee_reports;
    DB.trustee_reports = [{ id: 'tr1', ok: false, t: 3, loc: 'מעוצבים · כניסה', f: 'ארון כיבוי חסום', d: __ago(2), s: 'פתוח' },
      { id: 'tr2', ok: false, t: 3, loc: 'תוצ"ג · מחסן', f: 'מטף לא תקין', d: __ago(4), s: 'פתוח' }];
    const fire = _thzRecurring().find((x) => x[0] === 'ציוד כיבוי אש' || x.kind === 'ציוד כיבוי אש');
    const out = fire ? { n: fire.rows.length, tru: fire.rows.filter((x) => x.src === 'tru').length, html: _thzRepHtml() } : null;
    DB.trustee_reports = save; return out;
  });
  check('fire equipment: 1 tour hazard + 2 trustee findings = recurring', t && t.n === 3 && t.tru === 2, t && [t.n, t.tru]);
  check('trustee lines are marked (נאמן)', t && /\(נאמן\)/.test(t.html));

  console.log('\n4. the card on the tours screen');
  await page.evaluate(() => { goPage('thz'); if (typeof rThz === 'function') rThz(); });
  await page.waitForTimeout(300);
  const card = await page.evaluate(() => { const c = document.getElementById('thz-rep-card'); return c ? c.textContent : null; });
  check('the card is drawn', card && /מפגעים חוזרים/.test(card), card && card.substring(0, 120));
  check('it says why it matters (10.2)', card && /10\.2/.test(card) && /התיקון הקודם לא עבד/.test(card));
  check('electrical with its numbers', card && /חשמל: 3 ב-90 הימים האחרונים, 3 מחלקות, 2 כבר נסגרו/.test(card), card);
  check('the place line', card && /תוצג, חדר 0: 2 פעמים בשנה האחרונה/.test(card), card);
  const empty = await page.evaluate(() => { const s = DB.tour_hazards; DB.tour_hazards = []; const h = _thzRepHtml(); DB.tour_hazards = s; return h; });
  check('nothing recurring = no card at all', empty === '');

  console.log('\n5. the hint while writing (manager modal)');
  const m = await page.evaluate(() => {
    thzNew();
    const set = (id, v) => { const el = document.getElementById(id); el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); };
    set('thz-dept', 'תוצג'); set('thz-loc', 'חדר 0');
    const place = document.getElementById('thz-rep').textContent;
    set('thz-loc', 'מחסן'); set('thz-descr', 'לוח חשמל פתוח');
    const kind = document.getElementById('thz-rep').textContent;
    set('thz-descr', 'מראה שבורה');
    const none = document.getElementById('thz-rep').textContent;
    thzNew(); const cleared = document.getElementById('thz-rep').textContent;
    return { place, kind, none, cleared };
  });
  check('same place: "2 hazards here in the last year, 1 closed"', /במקום הזה נרשמו 2 מפגעים בשנה האחרונה, 1 מהם כבר נסגרו/.test(m.place), m.place);
  check('same kind: "systemic"', /מסוג "חשמל" נרשם 3 פעמים/.test(m.kind) && /בעיה מערכתית/.test(m.kind), m.kind);
  check('no match: no hint', m.none === '', m.none);
  check('a new hazard starts without the old hint', m.cleared === '', m.cleared);
  const self = await page.evaluate(() => ({ with: _thzRepHint('תוצג', 'חדר 0', '', null), self: _thzRepHint('תוצג', 'חדר 0', '', 'f') }));
  check('editing a hazard does not count it as its own repeat', /נרשמו 2/.test(self.with) && /נרשמו 1 /.test(self.self), self);

  console.log('\n6. the hint in the field form');
  const f = await page.evaluate(() => {
    window.sbIns = function () {}; window.sbUpd = function () {}; window.sdb = function () {};
    mgrFieldOpen(); _mfPickDept('מעצבים');
    const loc = document.getElementById('mf-loc'), de = document.getElementById('mf-descr');
    de.value = 'ארון חשמל פתוח'; de.dispatchEvent(new Event('input', { bubbles: true }));
    const after = document.getElementById('mf-rep').textContent;
    _mfPickSev('גבוהה'); // a chip tap redraws the form
    const redrawn = document.getElementById('mf-rep').textContent;
    mgrFieldClose();
    return { after, redrawn, locInput: !!loc };
  });
  check('typing the description shows the kind hint', /מסוג "חשמל"/.test(f.after), f.after);
  check('the hint survives a redraw (chip tap)', /מסוג "חשמל"/.test(f.redrawn), f.redrawn);

  check('no page errors', errors.length === 0, errors);
  await browser.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
