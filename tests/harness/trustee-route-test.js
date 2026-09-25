// Sending a finding to someone outside the app (2026-09-23).
//
// Michael: the maintenance and electrical people do not work in the app, so
// a finding has to reach them on WhatsApp or e-mail, or as a one-page work
// order. Drives the real modal, the real text builder, and the real routing
// note; the two ways of leaving the page (window.open, location.href) are
// caught so the address can be inspected.
const path = require('path');
let pw; try { pw = require('playwright'); } catch (e) { pw = require('playwright-core'); }
const HTML = 'file://' + path.resolve(__dirname, '../../index.html');
let pass = 0, fail = 0;
const check = (l, c, d) => { if (c) { pass++; console.log('  ✓ ' + l); } else { fail++; console.log('  ✗ ' + l + (d !== undefined ? '  -> ' + JSON.stringify(d) : '')); } };
// Same list build-pdf.js enforces on the guide: text people read uses only
// what a keyboard has.
const NON_KEYBOARD = /[–—־«»‘’“”→←•·…]/;

(async () => {
  const browser = await pw.chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, locale: 'he-IL' });
  const page = await ctx.newPage();
  await page.route('**/*', (r) => r.request().url().startsWith('file://') ? r.continue() : r.abort());
  const errs = [];
  page.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
  await page.goto(HTML, { waitUntil: 'load' });
  await page.waitForTimeout(900);

  await page.evaluate(() => {
    const lg = document.getElementById('login'); if (lg) lg.style.display = 'none';
    const app = document.getElementById('app'); if (app) app.style.display = 'block';
    ['trustee_reports', 'trustees', 'trustee_winners', 'tasks', 'locations'].forEach(k => { if (!DB[k]) DB[k] = []; });
    window.__toasts = []; window.toast = function (m) { window.__toasts.push(String(m)); };
    window.__opened = []; window.open = function (u) { window.__opened.push(u); return {}; };
    window.__nav = []; window._truRouteNav = function (u) { window.__nav.push(u); };
    window.__upd = []; const realUpd = sbUpd; window.sbUpd = function (t, r) { window.__upd.push({ t, id: r.id, note: r.mgr_note }); return realUpd(t, r); };
    window._currentUser = { username: 'admin' }; _applyRoleGates();
    try { localStorage.removeItem('tfgn_route_contacts'); } catch (e) {}
    DB.trustee_reports = [{ id: 'r1', u: 'לב', t: 1, d: '2026-09-23', m: _truThisMonth(), loc: 'חומר גלם · גשר רחבה מרכזי', ok: false,
      f: 'פנסי אזהרה מהבהב לא עובדים', photo_url: 'https://sb.co/storage/v1/object/public/incidents-photos/r1.jpg', s: 'פתוח', ts: new Date().toISOString() }];
    goPage('trustees'); _truMgrSetFilter('all'); rTrustees();
  });

  console.log('\n1. the finding menu offers it, and the modal opens with the finding summarised');
  const m = await page.evaluate(() => {
    // Build the real menu off-screen and read its labels.
    const a = document.createElement('button'); document.body.appendChild(a);
    _truRowMenu(a, 'r1');
    const labels = [...document.querySelectorAll('#tru-row-menu button, #tru-row-menu .pm-item, #tru-row-menu [role=menuitem]')].map(b => b.textContent.trim());
    const all = (document.getElementById('tru-row-menu') || {}).textContent || '';
    document.querySelectorAll('#tru-row-menu').forEach(n => n.remove());
    _truRouteOpen('r1');
    return { has: /שלח לטיפול/.test(all), labels, shown: document.getElementById('m-tru-route').style.display === 'block',
      sum: document.getElementById('tru-route-sum').textContent, due: document.getElementById('tru-route-due').value, role: document.getElementById('tru-route-role').value };
  });
  check('«שלח לטיפול» is in the ⋯ menu of a hazard', m.has, m.labels);
  check('the modal opens', m.shown, m);
  check('...with the finding, its area and date in the summary', /פנסי אזהרה/.test(m.sum) && /חומר גלם/.test(m.sum) && /23\/09\/2026/.test(m.sum), m.sum);
  check('...due date a week out, first discipline preselected', /^\d{4}-\d{2}-\d{2}$/.test(m.due) && m.role === 'אחזקה', { due: m.due, role: m.role });

  console.log('\n2. WhatsApp: the message carries everything the fixer needs, in keyboard characters');
  const wa = await page.evaluate(() => {
    document.getElementById('tru-route-role').value = 'חשמל';
    document.getElementById('tru-route-name').value = 'דני';
    document.getElementById('tru-route-phone').value = '050-123-4567';
    document.getElementById('tru-route-due').value = '2026-09-30';
    document.getElementById('tru-route-notes').value = 'לבדוק גם את הפנס השני';
    window.__opened = []; window.__upd = []; window.__toasts = [];
    _truRouteWa();
    const u = window.__opened[0] || '';
    const q = u.indexOf('?text=') > 0 ? decodeURIComponent(u.slice(u.indexOf('?text=') + 6)) : '';
    return { url: u, text: q, upd: window.__upd, note: _truFind('r1').mgr_note, toasts: window.__toasts,
      contacts: JSON.parse(localStorage.getItem('tfgn_route_contacts') || '[]') };
  });
  check('opens wa.me with the number in international form', /^https:\/\/wa\.me\/972501234567\?text=/.test(wa.url), wa.url.slice(0, 60));
  check('the text has the finding, area, task, reporter, photo link, who, due date, instructions, id',
    /ליקוי: פנסי אזהרה/.test(wa.text) && /אזור: חומר גלם/.test(wa.text) && /משימה: 1\./.test(wa.text) && /על ידי לב/.test(wa.text)
    && /תמונה: https:\/\/sb\.co\/.*r1\.jpg/.test(wa.text) && /לטיפול: חשמל - דני, עד 30\/09\/2026/.test(wa.text) && /הנחיות: לבדוק גם/.test(wa.text) && /מספר ממצא: r1/.test(wa.text), wa.text);
  check('...and only keyboard characters (no long dash, no «», no middle dot)', !NON_KEYBOARD.test(wa.text), wa.text.match(NON_KEYBOARD));
  // 25/09: a link that opens the finding itself for anyone who has the app.
  check('the text carries a deep link to this finding (production URL off https)', /לפתיחה באפליקציה: https:\/\/tapugan-safety\.pages\.dev\/\?tru=r1/.test(wa.text), wa.text.split('\n').slice(-2));
  check('the routing note is written once, names who and until when', wa.upd.length === 1 && wa.upd[0].t === 'trustee_reports' && /נותב לחשמל - דני עד 30\/09\/2026 \(וואטסאפ/.test(wa.note), { upd: wa.upd, note: wa.note });
  check('the recipient is remembered on the device', wa.contacts.length === 1 && wa.contacts[0].name === 'דני' && wa.contacts[0].phone === '050-123-4567' && wa.contacts[0].role === 'חשמל', wa.contacts);
  check('the manager is told', wa.toasts.some(t => /וואטסאפ/.test(t)), wa.toasts);

  console.log('\n3. the finding leaves the «not routed» list and the trustee sees the note');
  const after = await page.evaluate(() => {
    rTrustees();
    const unrouted = typeof _truUnrouted === 'function' ? _truUnrouted().length : (function () { return (DB.trustee_reports || []).filter(r => _truIsHazard(r) && r.s !== TRUSTEE_S_CLOSED && !r.mgr_note && !_truTaskFor(r.id)).length; })();
    _truSetMe('לב'); _truRender();
    const mine = (document.getElementById('tru-mine') || {}).innerHTML || '';
    return { unrouted, mineHasNote: /נותב לחשמל/.test(mine) };
  });
  check('no longer counted as not routed', after.unrouted === 0, after);
  check('the trustee\'s own list shows the routing note', after.mineHasNote, after);

  console.log('\n4. e-mail: same text, address in the mailto, a remembered recipient is one tap');
  const ml = await page.evaluate(() => {
    _truRouteOpen('r1');
    const chip = document.querySelector('#tru-route-recent button');
    const chipTxt = chip ? chip.textContent : '';
    if (chip) chip.click();
    document.getElementById('tru-route-email').value = 'dani@example.com';
    window.__nav = []; window.__upd = [];
    _truRouteMail();
    const u = window.__nav[0] || '';
    return { chipTxt, name: document.getElementById('tru-route-name').value, url: u,
      subject: decodeURIComponent((u.match(/subject=([^&]*)/) || [])[1] || ''), body: decodeURIComponent((u.match(/body=(.*)$/) || [])[1] || ''), upd: window.__upd.length, note: _truFind('r1').mgr_note };
  });
  check('the remembered recipient appears as a chip and fills the form', /דני/.test(ml.chipTxt) && ml.name === 'דני', { chip: ml.chipTxt, name: ml.name });
  check('mailto to the address, subject names the finding and the area', /^mailto:dani%40example\.com\?/.test(ml.url) && /הוראת עבודה - פנסי אזהרה/.test(ml.subject) && /חומר גלם/.test(ml.subject), { url: ml.url.slice(0, 50), subject: ml.subject });
  check('the body is the same text', /ליקוי: פנסי אזהרה/.test(ml.body) && /תמונה: https/.test(ml.body) && !NON_KEYBOARD.test(ml.body), ml.body.slice(0, 120));
  check('the note is rewritten for this send', ml.upd === 1 && /\(מייל /.test(ml.note), ml.note);

  console.log('\n5. PDF: a one-page work order with the photo and signature lines');
  const pdf = await page.evaluate(() => {
    // Section 4 reopened the modal, which resets the due date to a week from
    // today. This check asserts 30/09/2026 -- and passed on 23/09 only because
    // a week from THAT day was 30/09. From 24/09 main was red. Pin it.
    document.getElementById('tru-route-due').value = '2026-09-30';
    window.__pdf = null; window._printViaWindow = function (on, hdr, title) { window.__pdf = { html: on.innerHTML, title }; return true; };
    window.__upd = [];
    _truRoutePdf();
    return { html: window.__pdf && window.__pdf.html, title: window.__pdf && window.__pdf.title, upd: window.__upd.length, note: _truFind('r1').mgr_note };
  });
  check('titled as a work order for the finding', /הוראת עבודה - פנסי אזהרה/.test(pdf.title || ''), pdf.title);
  check('carries who, due, finding, area, reporter, the photo, signature lines and the after-photo instruction',
    /חשמל - דני/.test(pdf.html) && /30\/09\/2026/.test(pdf.html) && /פנסי אזהרה/.test(pdf.html) && /חומר גלם/.test(pdf.html) && /על ידי לב/.test(pdf.html)
    && /<img src="https:\/\/sb\.co\/[^"]*r1\.jpg"/.test(pdf.html) && /טופל בתאריך/.test(pdf.html) && /שם וחתימה/.test(pdf.html) && /תמונת "אחרי"/.test(pdf.html), (pdf.html || '').slice(0, 200));
  check('the print toolbar is hidden on paper (no-print) and the text is keyboard-only', /class="no-print"/.test(pdf.html) && !NON_KEYBOARD.test(pdf.html.replace(/<[^>]+>/g, '')), (pdf.html || '').replace(/<[^>]+>/g, '').match(NON_KEYBOARD));
  check('the note records the PDF send', pdf.upd === 1 && /\(PDF /.test(pdf.note), pdf.note);

  console.log('\n6. a photo still waiting offline is not sent as a dead link');
  const pend = await page.evaluate(() => {
    DB.trustee_reports.push({ id: 'r2', u: 'לב', t: 2, d: '2026-09-23', m: _truThisMonth(), loc: 'מחסן', ok: false, f: 'מטף חסר', photo_url: 'pending:phXYZ', s: 'פתוח', ts: new Date().toISOString() });
    return _truRouteText(_truFind('r2'), { role: 'אחזקה', name: '', phone: '', email: '', due: null, notes: '' });
  });
  check('no «תמונה:» line for a pending photo; who/due line still well-formed', !/תמונה:/.test(pend) && /לטיפול: אחזקה\n/.test(pend + '\n'), pend);

  const realErrs = errs.filter(e => !/net::ERR|Failed to load|supabase|web-vitals/i.test(e));
  console.log('\n6. the deep link opens the finding');
  const dl = await page.evaluate(async () => {
    goPage('dash');
    window._truDeepId = 'r1'; window._isAdmin = true;
    rDash();
    await new Promise((r) => setTimeout(r, 700));
    const row = document.querySelector('tr[data-tru-row="r1"]');
    return { cur: CUR, consumed: window._truDeepId === null, row: !!row, lit: !!(row && row.style.background), url: _truLink({ id: 'a b' }) };
  });
  check('?tru=<id> lands on the trustees page, on that row, highlighted, once', dl.cur === 'trustees' && dl.row && dl.lit && dl.consumed, dl);
  check('the id is url-encoded in the link', /\?tru=a%20b$/.test(dl.url), dl.url);
  const kiosk = await page.evaluate(async () => { window._truDeepId = 'r1'; window._isAdmin = false; rDash(); await new Promise((r) => setTimeout(r, 100)); return window._truDeepId; });
  check('without a signed-in session (kiosk) the link is kept, not consumed', kiosk === 'r1', kiosk);
  await page.evaluate(() => { window._truDeepId = null; });

  check('no unexpected page errors', realErrs.length === 0, realErrs.slice(0, 5));
  await browser.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('HARNESS ERROR', e); process.exit(2); });
