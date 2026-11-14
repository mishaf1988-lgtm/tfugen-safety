// WhatsApp card: install the app on a phone (14/11/2026, Michael: "easy install, free").
// One PNG, 1080x1350: a QR code to https://tapugan-safety.pages.dev/?install=1 and two steps.
//
// The picture of the blue bar is a REAL screenshot of index.html with an iPhone Safari user
// agent (the bar is ours, so it can be shot). Safari's own toolbar cannot be shot from the
// cloud, so it is a DRAWING, and the card says so under it (skill tfugen-phone-steps).
//
// The QR library is the same file the app loads (qrcode-generator 1.4.4, same sha384 as
// the integrity attribute in index.html). It is not in the repo; pass its path:
//   curl -sS -o <scratch>/qrcode.min.js https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.min.js
//   QRLIB=<scratch>/qrcode.min.js NODE_PATH=$(npm root -g) node project-files/guide-install/build-card.mjs
// The build refuses: a wrong library hash, a non-keyboard character in the text, a card that
// overflows its 1350px.
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
const require = createRequire(import.meta.url);
const pw = require('playwright');
const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
const LINK = 'https://tapugan-safety.pages.dev/?install=1';
const OUT = path.join(HERE, 'card-install.png');

const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const want = (html.match(/qrcode-generator@1\.4\.4\/qrcode\.min\.js';s\.integrity='(sha384-[^']+)'/) || [])[1];
const lib = fs.readFileSync(process.env.QRLIB || '', 'utf8');
const got = 'sha384-' + crypto.createHash('sha384').update(lib).digest('base64');
if (!want || got !== want) { console.error('REFUSED: QR library hash ' + got + ' is not the one index.html trusts (' + want + ')'); process.exit(1); }

// Everything a person reads on the card. Keyboard characters only (.claude/rules/people-text.md).
const T = {
  title: 'האפליקציה של הבטיחות, בטלפון',
  sub: 'מתקינים פעם אחת, בחינם, בלי חנות אפליקציות. אחר כך היא נפתחת מהאייקון כמו כל אפליקציה.',
  s1: 'סורקים את הקוד עם המצלמה ופותחים את הקישור.',
  s2: 'למטה יופיע פס כחול שאומר מה לעשות בטלפון שלכם:',
  ios: 'אייפון: לוחצים על כפתור השיתוף בספארי, ואז \'הוסף למסך הבית\'.',
  iosOther: 'נפתח בוואטסאפ או בכרום? פותחים את הקישור בספארי.',
  and: 'אנדרואיד: לוחצים \'התקנה\' בפס הכחול. אין כפתור? שלוש הנקודות למעלה ואז \'התקנת אפליקציה\'.',
  real: 'צילום מסך אמיתי של הפס באייפון',
  drawn: 'ציור, לא צילום מסך: הסרגל של ספארי בתחתית המסך',
  stuck: 'נתקעתם? פנו לממונה הבטיחות.',
};
const KEYBOARD_ONLY = /^[֐-ת׳״ a-zA-Z0-9.,:;'"?!()\-\/=&%+]*$/;
const bad = Object.entries(T).filter(([, v]) => !KEYBOARD_ONLY.test(v) || /[־׳״]/.test(v));
if (bad.length) { console.error('REFUSED: non-keyboard character in', bad.map(([k]) => k)); process.exit(1); }

const SHARE = '<svg width="34" height="38" viewBox="0 0 20 22"><path d="M6 8H3v12h14V8h-3M10 1v13M6 5l4-4 4 4" fill="none" stroke="#0a84ff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';

const browser = await pw.chromium.launch();
// 1. the real bar, from the app itself
const shotCtx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: 'he-IL',
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1' });
const sp = await shotCtx.newPage();
await sp.route('**/*', (r) => r.request().url().startsWith('file://') ? r.continue() : r.abort());
await sp.goto('file://' + path.join(ROOT, 'index.html') + '?install=1', { waitUntil: 'load' });
await sp.waitForTimeout(600);
await sp.mouse.move(1, 1);
const barEl = await sp.$('#pwa-bar');
if (!barEl) { console.error('REFUSED: the install bar did not appear in index.html'); process.exit(1); }
const barPng = (await barEl.screenshot()).toString('base64');
await shotCtx.close();

// 2. the card
const page = await (await browser.newContext({ viewport: { width: 1080, height: 1350 } })).newPage();
await page.setContent(`<!doctype html><html dir="rtl" lang="he"><head><meta charset="utf-8"><style>
*{box-sizing:border-box;margin:0}
body{width:1080px;height:1350px;font-family:Arial,'Noto Sans Hebrew',sans-serif;background:#fff;color:#1a1d23}
#card{height:1350px;display:flex;flex-direction:column;overflow:hidden}
.top{background:#a72920;color:#fff;padding:44px 56px 36px}
h1{font-size:58px;line-height:1.15}
.sub{font-size:30px;margin-top:14px;line-height:1.4}
.body{padding:34px 56px;flex:1;display:flex;flex-direction:column;gap:26px}
.row{display:flex;gap:30px;align-items:center}
.qr{width:330px;height:330px;flex:0 0 auto}
.qr img{width:100%;height:100%;image-rendering:pixelated}
.link{font-size:21px;white-space:nowrap;color:#475569;direction:ltr;unicode-bidi:isolate;margin-top:6px;text-align:center}
.n{display:inline-flex;width:54px;height:54px;border-radius:50%;background:#a72920;color:#fff;font-size:32px;font-weight:700;align-items:center;justify-content:center;flex:0 0 auto}
.step{display:flex;gap:18px;align-items:flex-start;font-size:32px;line-height:1.4;font-weight:600}
.pl{font-size:28px;line-height:1.45;margin:6px 72px 0 0}
.pl b{color:#154889}
.bar img{width:100%;border-radius:10px;display:block}
.cap{font-size:20px;color:#5f6673;margin-top:6px}
.safari{direction:ltr;background:#f2f2f7;border:2px dashed #9ca3af;border-radius:14px;padding:12px 40px;display:flex;justify-content:space-between;align-items:center;font-size:34px;color:#0a84ff;position:relative}
.ring{position:absolute;width:86px;height:86px;border:6px solid #e11d1d;border-radius:50%}
.stuck{font-size:28px;color:#475569;border-top:2px solid #e5e7eb;padding-top:16px}
</style></head><body><div id="card">
<div class="top"><h1>${T.title}</h1><div class="sub">${T.sub}</div></div>
<div class="body">
 <div class="row"><div><div class="qr"><img id="qr"></div><div class="link">${LINK.replace('https://', '')}</div></div>
  <div><div class="step"><span class="n">1</span><span>${T.s1}</span></div>
   <div class="step" style="margin-top:22px"><span class="n">2</span><span>${T.s2}</span></div></div></div>
 <div class="bar"><img src="data:image/png;base64,${barPng}"><div class="cap">${T.real}</div></div>
 <div><div class="pl"><b>${T.ios}</b></div><div class="pl">${T.iosOther}</div><div class="pl"><b>${T.and}</b></div></div>
 <div><div class="safari" id="safari"><span>&lsaquo;</span><span>&rsaquo;</span><span id="share">${SHARE}</span><span style="font-size:30px">&#9633;</span><span style="font-size:30px">&#9776;</span>
  <div class="ring" id="ring"></div></div><div class="cap">${T.drawn}</div></div>
 <div class="stuck">${T.stuck}</div>
</div></div></body></html>`);
await page.addScriptTag({ content: lib });
await page.evaluate((link) => {
  const q = window.qrcode(0, 'M'); q.addData(link); q.make();
  document.getElementById('qr').src = q.createDataURL(10, 2);
  // the ring around the drawn share button, measured, not guessed
  const s = document.getElementById('share').getBoundingClientRect(), box = document.getElementById('safari').getBoundingClientRect();
  const r = document.getElementById('ring');
  r.style.left = (s.left - box.left + s.width / 2 - 43) + 'px'; r.style.top = (s.top - box.top + s.height / 2 - 43) + 'px';
}, LINK);
await page.waitForTimeout(200);
const over = await page.evaluate(() => { const c = document.getElementById('card'); return c.scrollHeight - c.clientHeight; });
if (over > 0) { console.error('REFUSED: the card overflows by ' + over + 'px'); process.exit(1); }
await page.screenshot({ path: OUT });
await browser.close();
console.log('wrote ' + path.relative(ROOT, OUT));
