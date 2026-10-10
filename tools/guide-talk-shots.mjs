// Captures the screenshots for the training guides (HR and the department
// managers, 10/10/2026, Michael: "מדריך למשאבי אנוש והמנהלים לשימוש").
//
//   NODE_PATH=$(npm root -g) node tools/guide-talk-shots.mjs
//   NODE_PATH=$(npm root -g) node tools/guide-talk-shots.mjs w1-open w4-sign
//
// Neither HR nor the managers log in to the app: Michael publishes and sends
// them the link (Michael in the questionnaire, 10/10/2026). What they need to
// know is the page a worker opens, so every shot is the real worker page that
// functions/api/talk.js serves, rendered at 390x844 (iPhone width) at 2x, with
// the text of Michael's real drafts (ind-0802, wk-tuganim) and invented worker
// names. The network is fake: fetch answers from the data below.
//
// As in tools/guide-shots.js, the red ring and its number are drawn here and
// the number is the step number in the guide. The ring is measured after the
// page settled, and a ring that falls outside the frame refuses to be written.
import fs from 'fs';
import os from 'os';
import path from 'path';
import { createRequire } from 'module';
import { fileURLToPath, pathToFileURL } from 'url';

const require = createRequire(import.meta.url);
let pw; try { pw = require('playwright'); } catch (e) { pw = require('playwright-core'); }

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'project-files', 'guide-training');

// talk.js imports its neighbours as '../x.js'. Node runs them as ES modules
// only under .mjs, so copy the four into a temp dir, the same mapping as
// tests/harness/run.sh.
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'talk-shots-'));
for (const m of ['_shared', '_closelink', '_ai', '_onedrive', '_logo']) fs.copyFileSync(path.join(ROOT, 'functions', m + '.js'), path.join(tmp, m + '.mjs'));
fs.writeFileSync(path.join(tmp, 'talk.mjs'), fs.readFileSync(path.join(ROOT, 'functions/api/talk.js'), 'utf8')
  .replace(/'\.\.\/(_shared|_closelink|_ai|_onedrive|_logo)\.js'/g, "'./$1.mjs'"));
const T = await import(pathToFileURL(path.join(tmp, 'talk.mjs')).href);

const ENV = { SUPABASE_SERVICE_ROLE_KEY: 'srv', TRUSTEE_NOTIFY_SECRET: 'guide-shots', GEMINI_API_KEY: 'g' };
const PUB = 'פורסמה';
// The two drafts as they are in the database on 10/10/2026, published here
// with a trainer so the page shows what a worker will see.
const IND = {
  id: 'ind-0802', d: '2026-10-11', s: PUB, kind: 'induction', link_v: 0, dept: null,
  title: 'הוראות כניסה למשמרת לעובד חדש (טופס 08.02.01)', trainer: 'מיכאל פרייליך', trainer_qual: 'ממונה בטיחות',
  body: '1. חירום: בשמיעת "צבע אדום" הולכים מהר ובזהירות למרחב המוגן הקרוב. מפעיל הקו יראה לך איפה המרחבים המוגנים.\n\n2. כללי\n2.1. משמרת של 8.5 או 12 שעות, עם שתי הפסקות: 30 דקות לאוכל ו-10 דקות לשתייה. יוצאים להפסקה רק באישור הממונה.\n2.2. כל עובד מחתים כניסה ויציאה בכרטיס או באצבע.\n2.3. נכנסים ויוצאים מאזור האריזה והייצור רק בדלתות המוגדרות.\n2.4. לא מתחילים לעבוד לפני הוראות עבודה מהמנהל או מהמפעיל בתחנה.',
  // One line each, only so the language buttons appear: the shots are in Hebrew.
  body_ar: 'تعليمات الدخول إلى الوردية للعامل الجديد\n1.', body_ru: 'Инструкции для нового работника\n1.', body_am: 'ለአዲስ ሰራተኛ መመሪያ\n1.',
  quiz: [
    { q: 'מה עושים כששומעים "צבע אדום"?', a: ['ממשיכים לעבוד', 'הולכים מהר ובזהירות למרחב המוגן הקרוב', 'יוצאים מהמפעל לחניה', 'מתקשרים הביתה'], c: 1 },
    { q: 'מתי מורידים את החלוק?', a: ['רק בסוף המשמרת', 'אף פעם', 'לפני השירותים ובכל יציאה מאולם הייצור', 'רק כשחם'], c: 2 },
  ],
};
const WK = {
  id: 'wk-tuganim', d: '2026-10-11', s: PUB, kind: null, dept: 'טוגנים', title: 'הדרכה שבועית: טוגנים', trainer: 'מיכאל פרייליך', trainer_qual: 'ממונה בטיחות',
  body: 'אולם השטיפה - בונקר קבלת תפוחי אדמה\n1. מתחת לבונקרים חובשים כובע חבטה.\n2. רעש מזיק: אטמי אוזניים.',
  quiz: [{ q: 'מה חובשים מתחת לבונקרים?', a: ['כובע חבטה', 'כובע מצחייה', 'אוזניות מוזיקה', 'שום דבר'], c: 0 }],
};
// Invented: a guide is seen by the whole plant.
const EMPS = [
  { id: 'e1', n: 'משה אברהם', dep: 'יצור' }, { id: 'e2', n: 'סאמר חליל', dep: 'יצור' },
  { id: 'e3', n: 'אולגה פטרוב', dep: 'יצור' }, { id: 'e4', n: 'דוד מלכה', dep: 'יצור' },
  { id: 'e5', n: 'רינה שלום', dep: 'אריזה' },
];
let talk = IND, signed = [];
globalThis.fetch = async (u) => {
  u = String(u);
  const j = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json' } });
  if (u.includes('/rest/v1/toolbox_talks')) return j([talk]);
  if (u.includes('/rest/v1/toolbox_reads')) return j(signed.map((id) => ({ emp_id: id })));
  if (u.includes('/rest/v1/emp')) return j(EMPS);
  if (u.includes('/rest/v1/server_state')) return j([{ value: '000000' }]);
  return j({}, 599);
};
// The induction page sits behind the HR code (10/10/2026): the shots carry the device's cookie,
// except the shot of the code screen itself.
let cookie = '';
const serve = async (url) => (await T.onRequest({ request: new Request(url, { headers: cookie ? { cookie } : {} }), env: ENV })).text();
cookie = 'tsind=' + (await T.makeCodeCookie(ENV, 'ind-0802', '000000'));
const plain = async (t) => { talk = t; signed = []; return serve(T.talkUrl(await T.makeTalkToken(ENV, t.id))); };
const perm = async (t) => { talk = t; signed = []; return serve(T.talkUrl(await T.makePermToken(ENV, t.id, t.link_v))); };

// label -> the page, what to do on it, and what to ring.
const SHOTS = {
  'w0-code': {
    html: async () => { const c = cookie; cookie = ''; try { return await perm(IND); } finally { cookie = c; } },
    prepare: async (p) => { await p.fill('#icode', '••••••'); },
    ring: { sel: '#icode', n: null },
    crop: true,
  },
  'w1-open': {
    html: () => perm(IND),
    ring: { sel: 'body a[href*="l=ar"]', parent: true, n: 1 },
  },
  'w2-quiz': {
    html: () => perm(IND),
    prepare: async (p) => {
      await p.evaluate(() => { document.getElementById('qz').scrollIntoView({ block: 'start' }); window.scrollBy(0, -40); });
      await p.check('fieldset[data-q="0"] input[value="1"]');
      await p.check('fieldset[data-q="1"] input[value="0"]');
    },
    ring: { sel: '#qz', n: 2 },
  },
  'w3-name': {
    html: () => plain(WK),
    prepare: async (p) => {
      await p.selectOption('#emp', 'e2');
      await p.evaluate(() => document.getElementById('emp').scrollIntoView({ block: 'center' }));
    },
    ring: { sel: '#emp', n: 3 },
  },
  'w3b-other': {
    html: () => perm(IND),
    prepare: async (p) => {
      await p.selectOption('#emp', '__other');
      await p.fill('#oname', 'יוסף אלמו');
      await p.fill('[name=ocomp]', 'כוח אדם - חברת השמה');
      await p.fill('#oid', '123456782');
      await p.evaluate(() => document.getElementById('emp').scrollIntoView({ block: 'center' }));
    },
    ring: { sel: '#obox', n: null, also: '#emp' },
  },
  'w4-sign': {
    html: () => plain(WK),
    prepare: async (p) => {
      await p.selectOption('#emp', 'e2');
      await p.fill('#oid', '123456782');
      await p.check('input[name=ok]');
      await p.evaluate(() => { document.getElementById('go').scrollIntoView({ block: 'end' }); window.scrollBy(0, 40); });
      await p.waitForTimeout(150);
      await sign(p);
    },
    ring: { sel: '#go', n: 4 },
  },
  // The same two steps on the new-worker page, for the HR guide: the name is
  // typed under "not on the list", and the thanks page carries the induction title.
  'w4-sign-ind': {
    html: () => perm(IND),
    prepare: async (p) => {
      await p.selectOption('#emp', '__other');
      await p.fill('#oname', 'יוסף אלמו');
      await p.fill('#oid', '123456782');
      await p.check('input[name=ok]');
      await p.evaluate(() => { document.getElementById('go').scrollIntoView({ block: 'end' }); window.scrollBy(0, 40); });
      await p.waitForTimeout(150);
      await sign(p);
    },
    ring: { sel: '#go', n: 4 },
  },
  'w5-done-ind': {
    html: async () => (await T.page('תודה, יוסף אלמו', '<p>החתימה נשמרה.</p><p style="color:#6b7280;font-size:14px">' + IND.title + '</p><p><a href="#" style="display:block;text-align:center;padding:12px;border-radius:10px;background:#1e3a8a;color:#fff;font-weight:700;text-decoration:none">עובד הבא חותם</a></p>', 'ok', 200, '', 'he')).text(),
    ring: { sel: 'a', n: null },
    crop: true,
  },
  'w5-done': {
    html: async () => (await T.page('תודה, סאמר חליל', '<p>החתימה נשמרה.</p><p style="color:#6b7280;font-size:14px">' + WK.title + '</p><p><a href="#" style="display:block;text-align:center;padding:12px;border-radius:10px;background:#1e3a8a;color:#fff;font-weight:700;text-decoration:none">עובד הבא חותם</a></p>', 'ok', 200, '', 'he')).text(),
    ring: { sel: 'a', n: null },
    crop: true,
  },
  'm-group': {
    html: async () => { talk = WK; signed = ['e1', 'e3']; return serve(T.talkUrl(await T.makeGroupToken(ENV, WK.id), 'he', true)); },
    prepare: async (p) => { await p.selectOption('#emp', 'e2'); },
    ring: { sel: 'body div[style*="eff6ff"]', n: null },
  },
};

// A finger signature, drawn with the mouse on the real pad.
async function sign(p) {
  const b = await p.locator('#pad').boundingBox();
  const y = b.y + b.height / 2;
  await p.mouse.move(b.x + b.width * 0.75, y);
  await p.mouse.down();
  const pts = [[0.68, -30], [0.62, 25], [0.56, -20], [0.5, 30], [0.44, -25], [0.38, 20], [0.3, -10]];
  for (const [fx, dy] of pts) await p.mouse.move(b.x + b.width * fx, y + dy, { steps: 6 });
  await p.mouse.up();
}

async function ring(p, spec) {
  return p.evaluate((a) => {
    let el = document.querySelector(a.sel);
    if (el && a.parent) el = el.parentElement;
    if (!el) return { ok: false, why: 'no element ' + a.sel };
    let r = el.getBoundingClientRect();
    if (a.also) { const o = document.querySelector(a.also).getBoundingClientRect(); r = { top: Math.min(r.top, o.top), left: Math.min(r.left, o.left), right: Math.max(r.right, o.right), bottom: Math.max(r.bottom, o.bottom) }; r.width = r.right - r.left; r.height = r.bottom - r.top; }
    if (r.width < 2 || r.height < 2) return { ok: false, why: 'element has no size' };
    const pad = 6;
    const box = document.createElement('div');
    box.style.cssText = 'position:fixed;z-index:2147483647;pointer-events:none;border:4px solid #ff3b30;border-radius:14px;box-shadow:0 0 0 3px rgba(255,59,48,.22);'
      + 'top:' + (r.top - pad) + 'px;left:' + (r.left - pad) + 'px;width:' + (r.width + pad * 2) + 'px;height:' + (r.height + pad * 2) + 'px';
    document.body.appendChild(box);
    if (a.n !== null) {
      const b = document.createElement('div');
      b.textContent = String(a.n);
      b.style.cssText = 'position:fixed;z-index:2147483647;pointer-events:none;width:30px;height:30px;border-radius:50%;background:#ff3b30;color:#fff;'
        + 'font:700 17px/30px Arial,sans-serif;text-align:center;box-shadow:0 2px 6px rgba(0,0,0,.3);'
        + 'top:' + Math.max(0, r.top - pad - 15) + 'px;left:' + Math.max(0, r.left - pad - 15) + 'px';
      document.body.appendChild(b);
    }
    const fits = r.top - pad >= 0 && r.left - pad >= -2 && r.bottom + pad <= innerHeight && r.right + pad <= innerWidth + 2;
    return { ok: fits, why: fits ? '' : 'ring falls outside the frame ' + JSON.stringify([r.top, r.left, r.bottom, r.right]) };
  }, spec);
}

// The signed new-worker form as HR receives it: inductionHtml with a drawn
// signature, at A4 width. Not ringed: it is a picture of a document.
async function formShot(browser) {
  const ctx = await browser.newContext({ viewport: { width: 794, height: 400 }, deviceScaleFactor: 1.5 });
  const p = await ctx.newPage();
  await p.route('**/*', (r) => (r.request().url().startsWith('data:') ? r.continue() : r.abort()));
  await p.setContent('<canvas id="c" width="520" height="180"></canvas>');
  const sig = await p.evaluate(() => {
    const c = document.getElementById('c'), x = c.getContext('2d');
    x.lineWidth = 3; x.lineCap = 'round'; x.strokeStyle = '#111'; x.beginPath(); x.moveTo(420, 90);
    [[380, 50], [340, 120], [300, 60], [260, 130], [220, 70], [180, 110], [130, 85]].forEach(([a, b]) => x.lineTo(a, b));
    x.stroke(); return c.toDataURL('image/png').split(',')[1];
  });
  const row = { id: 'mgxk2a7f', emp_name: 'יוסף אלמו', id_no: '123456782', dept: 'כוח אדם - חברת השמה', quiz_ok: 1, quiz_n: 2 };
  await p.setContent(T.inductionHtml(IND, row, sig, 'he', { day: '2026-10-11', hm: '07:42' }, T.quizAnswers(IND, 'he', '0:1,1:0')));
  await p.waitForTimeout(200);
  const file = path.join(OUT, 'form-08.png');
  await p.screenshot({ path: file, fullPage: true });
  console.log('  ✓ form-08.png  (' + Math.round(fs.statSync(file).size / 1024) + ' KB)');
  await ctx.close();
}

const want = process.argv.slice(2);
const names = want.length ? want : Object.keys(SHOTS).concat('form-08');
const unknown = names.filter((n) => !SHOTS[n] && n !== 'form-08');
if (unknown.length) { console.error('unknown shot: ' + unknown.join(', ')); process.exit(1); }
fs.mkdirSync(OUT, { recursive: true });
const browser = await pw.chromium.launch();
let failed = 0;
for (const name of names) {
  if (name === 'form-08') { await formShot(browser); continue; }
  const spec = SHOTS[name];
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: 'he-IL', hasTouch: false });
  const p = await ctx.newPage();
  const errors = [];
  p.on('pageerror', (e) => errors.push(String(e)));
  await p.route('**/*', (r) => r.abort());
  await p.setContent(await spec.html());
  await p.waitForTimeout(250);
  if (spec.prepare) await spec.prepare(p);
  await p.evaluate(() => { try { document.activeElement && document.activeElement.blur(); } catch (e) {} });
  await p.waitForTimeout(200);
  const placed = await ring(p, spec.ring);
  if (!placed.ok || errors.length) { console.error('  ✗ ' + name + ': ' + (placed.why || errors.join(' | '))); failed++; await ctx.close(); continue; }
  const file = path.join(OUT, name + '.png');
  // The thanks page is short: crop it to what is on it, or the guide shows a
  // phone that is mostly empty grey.
  const clip = spec.crop ? await p.evaluate(() => { let b = 0; document.querySelectorAll('body *').forEach((e) => { const r = e.getBoundingClientRect(); if (r.width && r.bottom > b && r.bottom < innerHeight) b = r.bottom; }); return { x: 0, y: 0, width: innerWidth, height: Math.ceil(b + 20) }; }) : null;
  await p.screenshot(clip ? { path: file, clip } : { path: file });
  console.log('  ✓ ' + name + '.png  (' + Math.round(fs.statSync(file).size / 1024) + ' KB)');
  await ctx.close();
}
await browser.close();
fs.rmSync(tmp, { recursive: true, force: true });
process.exit(failed ? 1 : 0);
