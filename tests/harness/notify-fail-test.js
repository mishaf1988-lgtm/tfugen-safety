// An alert the server gave up on (upgrade review 10, 29/09): trustee-notify.js
// tries three times, 15 minutes apart, then writes 'notify_failed' to
// notifications_log. Drives the real _notifFailed / _nfHomeRender /
// _sysChkDelivery against seeded log rows.
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
  const r = await page.evaluate(() => {
    const ago = (h) => new Date(Date.now() - h * 3600e3).toISOString();
    try { localStorage.removeItem('ts_nf_seen'); } catch (e) {}
    window._currentUser = { username: 'admin' }; if (typeof _applyRoleGates === 'function') _applyRoleGates();
    DB.notifications_log = [
      { id: 'L1', ts: ago(2), event_type: 'trustee_hazard', channel: 'notify_failed', payload: { id: 'r1', src: 'trustee_reports', title: 'דנה - מטף ללא פלומבה', detail: 'meta 401 | resend 422', tries: 3 } },
      { id: 'L2', ts: ago(3), event_type: 'near_miss', channel: 'notify_failed', payload: { id: 'n1', src: 'near_miss', title: 'משה - משטח נפל', detail: 'x', tries: 3 } },
      { id: 'L3', ts: ago(1), event_type: 'near_miss', channel: 'whatsapp', payload: { id: 'n1', title: 'משה', detail: 'sent' } },
      { id: 'L4', ts: ago(24 * 9), event_type: 'trustee_hazard', channel: 'notify_failed', payload: { id: 'r9', title: 'ישן מאוד' } },
    ];
    goPage('dash'); rDash();
    const box = () => document.getElementById('dash-notify-fail');
    const res = { home: box() && box().textContent, rows: box() ? box().querySelectorAll('[onclick^="nfSeen"]').length : 0 };
    res.sys = _sysChkDelivery();
    const sb = box().querySelector('[onclick^="nfSeen"]'); if (sb) sb.click();
    res.afterSeen = box().textContent;
    DB.notifications_log = DB.notifications_log.filter((x) => x.channel !== 'notify_failed' || x.id === 'L4');
    res.sysOk = _sysChkDelivery();
    window._currentUser = null; if (typeof _applyRoleGates === 'function') _applyRoleGates();
    try { localStorage.removeItem('ts_nf_seen'); } catch (e) {}
    DB.notifications_log.push({ id: 'L5', ts: ago(1), event_type: 'trustee_hazard', channel: 'notify_failed', payload: { id: 'r5', title: 'עוד אחד' } });
    _nfHomeRender(); res.reporter = box().textContent;
    return res;
  });
  check('home: "ההתראה נכשלה" with the report, its date and "פתח"', /ההתראה נכשלה \(1\)/.test(r.home || '') && /דנה - מטף ללא פלומבה/.test(r.home) && /פתח/.test(r.home), r.home);
  check('a failure later delivered (the near-miss sent on a later try) is not shown; older than 7 days is not shown', !/משה/.test(r.home || '') && !/ישן מאוד/.test(r.home) && r.rows === 1, r.home);
  check('system status: a red row naming it and the error', r.sys && r.sys.s === 'bad' && /3 ניסיונות/.test(r.sys.d) && /meta 401/.test(r.sys.d), r.sys);
  check('"ראיתי" hides it on this device', r.afterSeen === '', r.afterSeen);
  check('no failure left: the system row is not the failure one', r.sysOk && !/3 ניסיונות/.test(r.sysOk.d), r.sysOk);
  check('a reporter does not see it on the home screen', r.reporter === '', r.reporter);
  check('no page errors', errors.length === 0, errors);
  await browser.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('HARNESS ERROR', e); process.exit(2); });
