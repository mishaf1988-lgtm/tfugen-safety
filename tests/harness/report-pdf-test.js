// Saving a report as a PDF from inside the app.
//
// Michael, 2026-09-21: «לא מעניין אותי באיזו צורה, מצא פתרון לעבודה תקינה».
// Sending him to Safari was not one. iOS gives a home-screen web app no print
// dialog, so the report makes its own PDF: html2canvas renders the page that
// is already correct -- Hebrew, right-to-left, the real fonts -- and jsPDF
// carries it, and the share sheet takes it to WhatsApp, Mail or Files.
//
// What this suite can and cannot do: cdnjs is not reachable from this sandbox,
// so the two libraries are stubbed. Everything around them is real -- which
// page gets captured, what is hidden while it is, how the canvas is cut into
// A4 pages, where the file goes, and what happens at each way it can fail.
// The visual result of the real libraries is the one thing left for a phone.
const path = require('path');
let pw; try { pw = require('playwright'); } catch (e) { pw = require('playwright-core'); }
const HTML = 'file://' + path.resolve(__dirname, '../../index.html');
let pass = 0, fail = 0;
const check = (l, c, d) => { if (c) { pass++; console.log('  ✓ ' + l); } else { fail++; console.log('  ✗ ' + l + (d !== undefined ? '  -> ' + JSON.stringify(d) : '')); } };

(async () => {
  const browser = await pw.chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'he-IL' });
  const page = await ctx.newPage();
  page.on('dialog', (d) => d.accept().catch(() => {}));
  await page.route('**/*', (r) => r.request().url().startsWith('file://') ? r.continue() : r.abort());
  await page.goto(HTML, { waitUntil: 'load' });
  await page.waitForTimeout(700);

  // The real trend report, captured as it is written into its window.
  const doc = await page.evaluate(() => {
    window.toast = function () {}; window.alert = function () {};
    const mm = new Date().toISOString().substring(0, 7);
    DB.ncr = [{ id: 'n1', d: mm + '-05', s: 'פתוח', ts: mm + '-05T08:00:00Z' }];
    DB.inc = []; DB.near_miss = []; DB.rounds = []; DB.toolbox = []; DB.trustee_reports = [];
    let out = '';
    const realOpen = window.open;
    window.open = function () {
      return { document: { open: function () {}, close: function () {}, write: function (h) { out += h; } } };
    };
    try { window.safetyTrendReport(); } catch (e) { out = 'ERROR ' + (e && e.message); }
    window.open = realOpen;
    return out;
  });

  // o.standalone  running from the home screen
  // o.libs        'ok' | 'fail'      do the CDN scripts load
  // o.canvasH     rendered height in px, to force page splitting
  // o.canShare    will the platform take a file
  // o.shareErr    what share rejects with
  // o.h2cErr      html2canvas itself rejects
  const run = async (o) => {
    const p = await ctx.newPage();
    await p.setViewportSize({ width: 390, height: 844 });
    await p.setContent(doc, { waitUntil: 'load' });
    const r = await p.evaluate(async (opt) => {
      const asked = [];
      let printed = 0, shared = null, clicked = null, captured = null, hiddenDuring = null;
      window.print = function () { printed++; };

      // Stand in for the two CDN scripts. cdnjs is unreachable from the
      // sandbox, so what is verified here is every decision around them.
      const realAppend = document.head.appendChild.bind(document.head);
      document.head.appendChild = function (el) {
        if (el && el.tagName === 'SCRIPT' && el.src) {
          asked.push(el.src);
          setTimeout(function () {
            if (opt.libs === 'fail') { if (el.onerror) el.onerror(); return; }
            window.html2canvas = function (node, cfg) {
              captured = { tag: node.tagName, scale: cfg && cfg.scale, bg: cfg && cfg.backgroundColor,
                w: cfg && cfg.width, bodyW: document.body.style.width };
              // What is on screen at the moment of capture is the report only.
              hiddenDuring = [].slice.call(document.querySelectorAll('.no-print,.noprint'))
                .filter(function (x) { return x.style.display !== 'none'; }).length;
              if (opt.h2cErr) return Promise.reject(new Error('render'));
              const cv = document.createElement('canvas');
              cv.width = 900; cv.height = opt.canvasH || 600;
              const cx = cv.getContext('2d');
              cx.fillStyle = '#eee'; cx.fillRect(0, 0, cv.width, cv.height);
              return Promise.resolve(cv);
            };
            const pages = [];
            window.jspdf = {
              jsPDF: function (cfg) {
                this.cfg = cfg; this.imgs = [];
                this.addPage = function () { pages.push(1); };
                this.addImage = function (d, f, x, y, w, h) { this.imgs.push({ f: f, x: x, y: y, w: Math.round(w), h: Math.round(h) }); };
                this.output = function () { return new Blob(['%PDF-1.4 stub'], { type: 'application/pdf' }); };
                window.__pdf = this;
              },
            };
            if (el.onload) el.onload();
          }, 5);
          return el;
        }
        return realAppend(el);
      };

      const realMM = window.matchMedia;
      if (opt.standalone) {
        window.matchMedia = function (q) {
          if (String(q).indexOf('display-mode: standalone') >= 0) return { matches: true, media: q };
          return realMM.call(window, q);
        };
      }
      navigator.canShare = opt.canShare ? function () { return true; } : function () { return false; };
      navigator.share = function (d) {
        shared = { name: d.files && d.files[0] && d.files[0].name, type: d.files && d.files[0] && d.files[0].type };
        return opt.shareErr ? Promise.reject(Object.assign(new Error('x'), { name: opt.shareErr })) : Promise.resolve();
      };
      const realClick = HTMLAnchorElement.prototype.click;
      HTMLAnchorElement.prototype.click = function () { clicked = this.download; };
      // The document opens on a tap of its own, so window.open and the
      // navigation fallback both have to be observable.
      let opened = null, went = null;
      window.open = function (u) { opened = u; return opt.openBlocked ? null : { focus: function () {} }; };
      window._rptGo = function (u) { went = u; };

      const btn = document.querySelector('.no-print');
      const label0 = btn.textContent;
      _tryPrint(btn);
      await new Promise((r2) => setTimeout(r2, 300));
      // Each button is its own gesture; that is the whole reason they exist.
      if (opt.then === 'open') { const b2 = document.getElementById('rpt-open'); if (b2) b2.click(); }
      if (opt.then === 'share') { const b2 = document.getElementById('rpt-share'); if (b2) b2.click(); }
      await new Promise((r2) => setTimeout(r2, 120));

      HTMLAnchorElement.prototype.click = realClick;
      window.matchMedia = realMM;
      const msg = document.getElementById('rpt-msg');
      const p = window.__pdf;
      return {
        asked: asked, printed: printed, shared: shared, clicked: clicked,
        captured: captured, hiddenDuring: hiddenDuring,
        imgs: p ? p.imgs : null, fmt: p ? p.cfg : null,
        msg: msg ? msg.textContent.trim() : null,
        msgInHead: msg ? !!document.querySelector('.head').contains(msg) : null,
        label: btn.textContent, labelBack: btn.textContent === label0, disabled: btn.disabled,
        opened: opened, went: went, bodyWAfter: document.body.style.width,
        buttons: [].slice.call(document.querySelectorAll('#rpt-msg button')).map(function (x) { return x.id; }),
      };
    }, o);
    await p.close();
    return r;
  };

  console.log('\n1. on a desktop the browser makes a better PDF than a picture');
  {
    const r = await run({ standalone: false, libs: 'ok' });
    check('it uses the print dialog', r.printed === 1, r);
    check('...and fetches nothing', r.asked.length === 0, r.asked);
  }

  console.log('\n2. from the home screen it builds the PDF itself');
  {
    const r = await run({ standalone: true, libs: 'ok', canShare: true });
    check('no print dialog is attempted', r.printed === 0, r);
    check('html2canvas and jsPDF are fetched, both from cdnjs',
      r.asked.length === 2 && r.asked.every((u) => /^https:\/\/cdnjs\.cloudflare\.com\//.test(u))
      && r.asked.some((u) => /html2canvas/.test(u)) && r.asked.some((u) => /jspdf/.test(u)), r.asked);
    check('the whole page is captured, at 2x, on white',
      r.captured && r.captured.tag === 'BODY' && r.captured.scale === 2 && r.captured.bg === '#ffffff', r.captured);
    // 703px is 186mm at 96dpi: A4 less the margins the report already designs
    // for. Captured at the phone's width instead, the PDF is a photograph of a
    // phone screen stretched across a sheet of paper.
    check('...laid out at A4 width rather than the phone width',
      r.captured.w === 703 && r.captured.bodyW === '703px', r.captured);
    check('...and the page is put back afterwards', r.bodyWAfter === '', r.bodyWAfter);
    // The button and the status line must not appear in the document.
    check('nothing marked no-print is visible while it captures', r.hiddenDuring === 0, r.hiddenDuring);
    check('...and it is all back afterwards',
      r.labelBack && !r.disabled, { label: r.label, disabled: r.disabled });
    check('A4, portrait, millimetres', r.fmt && r.fmt.format === 'a4' && r.fmt.orientation === 'portrait' && r.fmt.unit === 'mm', r.fmt);
  }

  console.log('\n3. a long report becomes several pages');
  {
    const short = await run({ standalone: true, libs: 'ok', canShare: true, canvasH: 600 });
    check('a short one is a single page', short.imgs && short.imgs.length === 1, short.imgs);
    // 900px wide at 194mm means 1mm is ~4.6px; a 4000px page is about 862mm,
    // which is three A4 sheets.
    const tall = await run({ standalone: true, libs: 'ok', canShare: true, canvasH: 4000 });
    check('a tall one is split (' + (tall.imgs ? tall.imgs.length : 0) + ' pages)', tall.imgs && tall.imgs.length >= 3, tall.imgs);
    // The bug this guards: a slice taller than the sheet runs off the paper.
    const over = (tall.imgs || []).filter((i) => i.h > 297 - 24 + 1);
    check('...and no page is taller than the paper', over.length === 0, over);
    check('...each inset by the same A4 margin', (tall.imgs || []).every((i) => i.x === 12 && i.y === 12 && i.w === 186), tall.imgs);
  }

  console.log('\n4. the document is offered, not forced');
  {
    // iOS refuses a window.open or a navigation that is not tied to a gesture,
    // and the tap that started the render expired seconds ago while the page
    // was being rasterised. So nothing happens on its own: two buttons, two
    // fresh gestures.
    const r = await run({ standalone: true, libs: 'ok', canShare: true });
    check('it says the PDF is ready', /מוכן/.test(r.msg || ''), r.msg);
    check('...and offers both opening it and sending it',
      r.buttons.join() === 'rpt-open,rpt-share', r.buttons);
    check('...without opening or sharing anything by itself',
      !r.opened && !r.went && !r.shared && !r.clicked, r);
  }

  console.log('\n5. opening it');
  {
    const r = await run({ standalone: true, libs: 'ok', canShare: true, then: 'open' });
    check('the tap opens the PDF in a window', /^blob:/.test(r.opened || ''), r.opened);
    check('...and does not navigate away as well', !r.went, r);
    const blocked = await run({ standalone: true, libs: 'ok', canShare: true, then: 'open', openBlocked: true });
    // A blocked pop-up is common on a phone. The report window itself then
    // shows the document rather than nothing happening.
    check('a blocked window falls back to showing it here', /^blob:/.test(blocked.went || ''), blocked);
  }

  console.log('\n6. sending it');
  {
    const r = await run({ standalone: true, libs: 'ok', canShare: true, then: 'share' });
    check('the tap opens the share sheet with a real PDF',
      r.shared && /\.pdf$/.test(r.shared.name) && r.shared.type === 'application/pdf', r.shared);
    const noShare = await run({ standalone: true, libs: 'ok', canShare: false, then: 'share' });
    check('with no share sheet it saves the file instead', /\.pdf$/.test(noShare.clicked || ''), noShare);
    const abort = await run({ standalone: true, libs: 'ok', canShare: true, shareErr: 'AbortError', then: 'share' });
    check('cancelling does not then save it behind your back', !abort.clicked, abort);
    const denied = await run({ standalone: true, libs: 'ok', canShare: true, shareErr: 'NotAllowedError', then: 'share' });
    check('a refused share falls back to saving', /\.pdf$/.test(denied.clicked || ''), denied);
  }

  console.log('\n7. when it cannot be done, it says so');
  {
    // The failure that matters most: no network for the libraries. Silence
    // here would be the original bug all over again.
    const noLibs = await run({ standalone: true, libs: 'fail', canShare: true });
    check('a failed library load explains itself', /לא הצלחתי לייצר PDF/.test(noLibs.msg || ''), noLibs.msg);
    check('...and offers Safari, which always works', /פתח בספארי/.test(noLibs.msg || ''), noLibs.msg);
    check('...and gives the button back', noLibs.labelBack && !noLibs.disabled, noLibs);
    const broken = await run({ standalone: true, libs: 'ok', canShare: true, h2cErr: true });
    check('a render that fails says the same', /לא הצלחתי לייצר PDF/.test(broken.msg || ''), broken.msg);
    check('...and does not leave the report half hidden', broken.labelBack, broken);
  }

  console.log('\n8. the message sits where it can be read');
  {
    const r = await run({ standalone: true, libs: 'fail', canShare: true });
    check('outside the header, not over the logo', r.msgInHead === false, r.msgInHead);
  }

  await browser.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('HARNESS ERROR', e); process.exit(2); });
