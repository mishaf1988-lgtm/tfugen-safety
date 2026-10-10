// "Listen" in the weekly-talk form (10/10/2026, Michael: "הדיבוב לא טוב כמו רובוט"): the manager
// hears the talk in the workers' voice before publishing. The button sends the text in the form
// (unsaved) to /api/talk op 'say' with the login, plays it through the player the worker's page
// uses (loaded once from ?op=player), and a second tap stops.
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
    const toasts = [], calls = [], loads = [];
    window.toast = (m) => toasts.push(String(m));
    _currentUser = { username: 'admin' }; window._sbToken = 'tok';
    DB.toolbox_talks = []; DB.toolbox_reads = [];
    goPage('toolbox');
    openModal('m-tbt');
    const o = {};
    const btn = document.getElementById('tbt-say-btn');
    o.btn = btn && btn.textContent;
    // the player is not on the page yet: the first tap loads it from the server
    const realAppend = document.head.appendChild.bind(document.head);
    document.head.appendChild = (el) => {
      if (el.tagName === 'SCRIPT') {
        loads.push(el.src);
        window.tapSay = (x) => { calls.push({ url: x.url, init: x.init, ac: !!x.ac }); window.__x = x; return { stop() { window.__stopped = (window.__stopped || 0) + 1; } }; };
        setTimeout(() => el.onload && el.onload(), 0);
        return el;
      }
      return realAppend(el);
    };
    document.getElementById('tbt-body').value = '';
    tbtSay(); o.empty = { toast: toasts.slice(-1)[0], loads: loads.length };
    document.getElementById('tbt-title').value = 'סולמות (טופס 08.01)';
    document.getElementById('tbt-body').value = '1. שלוש נקודות אחיזה';
    tbtSay();
    await new Promise((res) => setTimeout(res, 20));
    const c = calls[0];
    o.call = c ? { url: c.url, method: c.init.method, auth: c.init.headers.Authorization, body: JSON.parse(c.init.body), ac: c.ac } : null;
    o.loads = loads.slice();
    o.playing = btn.textContent;
    tbtSay(); o.stop = { stopped: window.__stopped, label: btn.textContent };
    tbtSay(); await new Promise((res) => setTimeout(res, 20));
    o.second = { loads: loads.length, calls: calls.length };
    window.__x.onEnd(); o.ended = btn.textContent;
    tbtSay(); await new Promise((res) => setTimeout(res, 20));
    window.__x.onFail('http 502'); o.fail = { label: btn.textContent, toast: toasts.slice(-1)[0] };
    // the other languages: that language's translation box, first line = the title
    const ar = document.getElementById('tbt-say-ar');
    o.arBtn = ar && ar.textContent;
    document.getElementById('tbt-ar').value = '';
    let n = calls.length; tbtSay('ar', ar); o.arEmpty = { toast: toasts.slice(-1)[0], calls: calls.length - n };
    document.getElementById('tbt-ar').value = 'السلالم\nثلاث نقاط تثبيت';
    n = calls.length; tbtSay('ar', ar); await new Promise((res) => setTimeout(res, 20));
    o.arCall = calls.length > n ? JSON.parse(calls[calls.length - 1].init.body) : null;
    o.arLabel = { ar: ar.textContent, he: btn.textContent };
    window.__x.onEnd(); o.arEnded = ar.textContent;
    document.getElementById('tbt-am').value = 'መሰላል';
    tbtSay('am', document.getElementById('tbt-say-am')); await new Promise((res) => setTimeout(res, 20));
    o.amCall = JSON.parse(calls[calls.length - 1].init.body); window.__x.onEnd();
    return o;
  });
  check('the button is in the form', r.btn && /שמע איך העובדים ישמעו/.test(r.btn), r.btn);
  check('no text: says so, loads nothing', /אין תוכן/.test(r.empty.toast) && r.empty.loads === 0, r.empty);
  check('the first tap loads the player from /api/talk?op=player', r.loads.length === 1 && /\/api\/talk\?op=player$/.test(r.loads[0]), r.loads);
  check('...and posts op say with the login, the title and the body as typed (the server cleans)', r.call && r.call.url === '/api/talk' && r.call.method === 'POST' && r.call.auth === 'Bearer tok' && r.call.body.op === 'say' && r.call.body.lang === 'he' && r.call.body.title === 'סולמות (טופס 08.01)' && r.call.body.body === '1. שלוש נקודות אחיזה', r.call);
  check('...with an audio context made inside the tap (a phone starts audio only from a tap)', r.call && r.call.ac === true);
  check('playing: the button says stop', /עצור/.test(r.playing), r.playing);
  check('a second tap stops', r.stop.stopped === 1 && /שמע/.test(r.stop.label), r.stop);
  check('the player loads once', r.second.loads === 1 && r.second.calls === 2, r.second);
  check('the end of the audio brings the button back', /שמע/.test(r.ended), r.ended);
  check('a failure: the button back and a message', /שמע/.test(r.fail.label) && /ההקראה נכשלה/.test(r.fail.toast), r.fail);
  check('a button per other language', /العربية/.test(r.arBtn || ''), r.arBtn);
  check('no translation yet: says so, nothing sent', /אין תרגום/.test(r.arEmpty.toast) && r.arEmpty.calls === 0, r.arEmpty);
  check('Arabic: lang ar, the first line as title and the rest as body', r.arCall && r.arCall.lang === 'ar' && r.arCall.title === 'السلالم' && r.arCall.body === 'ثلاث نقاط تثبيت', r.arCall);
  check('...the Arabic button says stop, the Hebrew one is untouched', /עצור/.test(r.arLabel.ar) && /שמע איך/.test(r.arLabel.he), r.arLabel);
  check('...and comes back when the audio ends', /العربية/.test(r.arEnded), r.arEnded);
  check('Amharic, one line only: the title, an empty body', r.amCall.lang === 'am' && r.amCall.title === 'መሰላል' && r.amCall.body === '', r.amCall);
  check('no page errors', errors.length === 0, errors);
  await browser.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
