// The AI assistant snapshot includes trustee reports: counts of findings
// open/closed and the open findings by age. Before 27/09 it had none, so
// "how many open trustee findings?" got "I don't have that data".
const path = require('path');
let pw; try { pw = require('playwright'); } catch (e) { pw = require('playwright-core'); }
const HTML = 'file://' + path.resolve(__dirname, '../../index.html');
let pass = 0, fail = 0;
const check = (l, c, d) => { if (c) { pass++; console.log('  ✓ ' + l); } else { fail++; console.log('  ✗ ' + l + (d !== undefined ? '  -> ' + JSON.stringify(d) : '')); } };

(async () => {
  const browser = await pw.chromium.launch();
  const page = await (await browser.newContext({ locale: 'he-IL' })).newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.route('**/*', (r) => r.request().url().startsWith('file://') ? r.continue() : r.abort());
  await page.goto(HTML, { waitUntil: 'load' });
  await page.waitForTimeout(700);

  const out = await page.evaluate(() => {
    const day = 86400000, iso = (n) => new Date(Date.now() - n * day).toISOString();
    DB.trustee_tasks = [{ id: 'k5', n: 5, t: 'עמדות כיבוי אש', active: true }, { id: 'k8', n: 8, t: 'מעקב סגירה', active: true }];
    DB.trustee_reports = [
      { id: 'ok1', u: 'דני', t: 5, d: iso(3).slice(0, 10), ts: iso(3), loc: 'מעבדה', ok: true, s: 'תקין' },
      { id: 'h1', u: 'דני', t: 5, d: iso(10).slice(0, 10), ts: iso(10), loc: 'מחסן', f: 'מטף חסום', ok: false, s: 'נסגר' },
      { id: 'c1', u: 'רונית', t: 8, d: iso(2).slice(0, 10), ts: iso(2), f: 'תמונת אחרי', ok: false, s: 'פתוח', ref: 'h1' },
      { id: 'h2', u: 'יוסי', t: 5, d: iso(4).slice(0, 10), ts: iso(4), loc: 'רציף', f: 'מעבר חסום', ok: false, s: 'פתוח', mgr_note: 'נותב לאחזקה' },
      { id: 'h3', u: 'יוסי', t: 5, d: iso(40).slice(0, 10), ts: iso(40), loc: 'חצר', f: 'שלט חסר', ok: false, s: 'פתוח' },
      { u: 'בלי מזהה', t: 5, ok: false, s: 'פתוח' }
    ];
    const s = _askBuildSnapshot();
    return { c: s.counts, list: s.trustee_open_findings, json: JSON.stringify(s) };
  });

  check('total counts only rows with id', out.c.trustee_reports_total === 5, out.c);
  check('30-day count excludes the 40-day-old report', out.c.trustee_reports_30d === 4, out.c);
  check('open findings = 2 (task-8 closure report is not a finding)', out.c.trustee_findings_open === 2, out.c);
  check('closed findings = 1', out.c.trustee_findings_closed === 1, out.c);
  check('open list sorted oldest first', out.list.length === 2 && out.list[0].finding === 'שלט חסר' && out.list[0].days_open === 40, out.list);
  check('open list carries trustee, task name, area, manager note', out.list[1].trustee === 'יוסי' && out.list[1].task === 'עמדות כיבוי אש' && out.list[1].area === 'רציף' && out.list[1].manager_note === 'נותב לאחזקה', out.list[1]);
  check('closed finding not in the open list', !out.list.some((r) => r.finding === 'מטף חסום'));
  check('existing snapshot keys still there', out.c.ncr_total !== undefined && out.c.tasks_open !== undefined);
  check('no page errors', errors.length === 0, errors);

  await browser.close();
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
