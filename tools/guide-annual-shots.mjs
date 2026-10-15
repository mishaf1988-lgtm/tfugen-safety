// Captures the screenshots for the annual-training pilot guide (15/10/2026, Michael: "a pilot of the
// annual training process ... a PDF with instructions and pictures").
//
//   NODE_PATH=$(npm root -g) node tools/guide-annual-shots.mjs
//   NODE_PATH=$(npm root -g) node tools/guide-annual-shots.mjs a3-before w6-details
//
// Two kinds of picture, both real screens at 390x844 (iPhone width) at 2x:
//   a*  the manager's app (index.html), logged in as admin, seeded with the pilot training and
//       invented workers; every call to the server is answered in the page (fetch is stubbed).
//   w*  the worker's page that functions/api/talk.js serves, rendered with fetch stubbed in Node.
// As in tools/guide-shots.js: the red ring and its number are drawn here, the number is the step
// number in the guide, the ring is measured after the page settled, and a ring outside the frame
// refuses to be written. The QR in the link window is drawn from a fixed pattern (the real
// library comes from a CDN, and the shots run offline): it looks like a QR and opens nothing.
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { loadTalk } from './_talk-module.mjs';

const require = createRequire(import.meta.url);
let pw; try { pw = require('playwright'); } catch (e) { pw = require('playwright-core'); }
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'project-files', 'guide-annual');
const HTML = 'file://' + path.join(ROOT, 'index.html');
const { T, cleanup } = await loadTalk(ROOT);

const TODAY = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jerusalem' });
const PUB = 'פורסמה';
// The pilot as the guide tells Michael to fill it. Workers are invented: the guide is a document.
const PILOT = {
  id: 'pilot-ann', d: TODAY, s: PUB, kind: 'annual', link_v: 0, dept: null, title: 'פיילוט הדרכה שנתית',
  dur: '15 דקות', trainer: 'מיכאל פרייליך', trainer_qual: 'ממונה בטיחות',
  body: '1. נהלי בטיחות כלליים במפעל\n2. כיבוי אש: מיקום המטפים והגלגלונים\n3. עבודה בגובה: סולמות ורתמה',
  subjects: 'כיבוי אש\nעבודה בגובה', eff_req: true, eff_ok: true, eff_d: TODAY, eff_by: 'מיכאל פרייליך',
  eff_desc: 'נשאלו שאלות על נושאי ההדרכה בסיום ההדרכה, והעובדים ענו נכון.',
  trainer_signed_at: TODAY + 'T06:00:00Z', trainer_sig_url: null,
};
const EMPS = [
  { id: 'e1', n: 'משה אברהם', dep: 'יצור', eid: '111111118' }, { id: 'e2', n: 'סאמר חליל', dep: 'יצור', eid: '222222226' },
  { id: 'e3', n: 'אולגה פטרוב', dep: 'אריזה', eid: '333333334' }, { id: 'e4', n: 'דוד מלכה', dep: 'מעבדה', eid: '444444442' },
  { id: 'e5', n: 'רינה שלום', dep: 'חומרי גלם', eid: '555555550' },
];

// A finger signature as a PNG data URL, drawn on a canvas in the given page.
const SIG_JS = `(() => { const c = document.createElement('canvas'); c.width = 520; c.height = 180; const x = c.getContext('2d');
  x.lineWidth = 4; x.lineCap = 'round'; x.strokeStyle = '#111'; x.beginPath(); x.moveTo(420, 90);
  [[380, 50], [340, 120], [300, 60], [260, 130], [220, 70], [180, 110], [130, 85]].forEach(([a, b]) => x.lineTo(a, b));
  x.stroke(); return c.toDataURL('image/png'); })()`;

// ---------- the manager's app ----------
async function app(page, opt) {
  await page.evaluate((a) => {
    document.getElementById('login').style.display = 'none'; document.getElementById('app').style.display = 'block';
    window.sdb = function () {}; window.addLog = function () {}; window.sbIns = function () {}; window.sbUpd = function () {};
    window._currentUser = { username: 'admin' }; _isAdmin = true; window._sbToken = 'guide';
    // A QR-looking pattern: three corner squares and a fixed scatter.
    window.qrcode = function () { const N = 29; const fin = (r, c) => { const f = (R, C) => r >= R && r < R + 7 && c >= C && c < C + 7 && (r === R || r === R + 6 || c === C || c === C + 6 || (r >= R + 2 && r <= R + 4 && c >= C + 2 && c <= C + 4)); return f(0, 0) || f(0, N - 7) || f(N - 7, 0); };
      const inFin = (r, c) => (r < 8 && c < 8) || (r < 8 && c >= N - 8) || (r >= N - 8 && c < 8);
      return { addData() {}, make() {}, getModuleCount() { return N; }, isDark(r, c) { return inFin(r, c) ? fin(r, c) : ((r * 31 + c * 17 + r * c * 7) % 5) < 2; } }; };
    DB.emp = a.emps; DB.toolbox_talks = a.talks; DB.toolbox_reads = a.reads;
    window.fetch = (u, init) => {
      const b = JSON.parse((init && init.body) || '{}');
      const j = (o) => Promise.resolve(new Response(JSON.stringify(o), { status: 200, headers: { 'Content-Type': 'application/json' } }));
      if (b.op === 'link' || b.op === 'revoke') return j({ url: 'https://tapugan-safety.pages.dev/api/talk?k=pilot', perm: true, link_v: 0 });
      if (b.op === 'missMail' && b.preview) return j({ ok: true, preview: true, plan: [
        { dept: 'ייצור טוגנים', to: ['menahel.yizur@tapugan.co.il'], cc: ['sviva@tapugan.co.il'], names: ['משה אברהם', 'אולגה פטרוב'] },
        { dept: 'מעבדות', to: ['menahel.maabada@tapugan.co.il'], cc: ['sviva@tapugan.co.il'], names: ['דוד מלכה'] },
        { dept: 'חומר גלם', to: [], cc: [], names: ['רינה שלום'] }], noDept: [] });
      return j({ ok: true });
    };
    goPage('training');
  }, opt);
  await page.waitForTimeout(400);
}
const READS = (sig) => [
  { id: 'r1', talk_id: PILOT.id, emp_id: 'x:סאמר חליל', emp_name: 'סאמר חליל', id_no: '222222226', dept: 'יצור', read_at: TODAY + 'T07:10:00Z', sig_url: sig },
];
async function openForm(page, fill) {
  await page.evaluate((f) => {
    openModal('m-tbt');
    const set = (id, v) => { const el = document.getElementById(id); el.value = v; el.dispatchEvent(new Event('input')); };
    set('tbt-title', f.title); set('tbt-d', f.d); set('tbt-s', 'טיוטה');
    document.getElementById('tbt-kind').value = 'annual'; _tbtKindUi();
    set('tbt-dur', f.dur); set('tbt-trainer', f.trainer); set('tbt-trainer-q', f.trainer_qual); set('tbt-body', f.body);
  }, fill);
  await page.waitForTimeout(300);
}
async function scrollTo(page, sel, at) {
  await page.evaluate((a) => {
    const el = document.querySelector(a.sel);
    let sc = el.parentElement;
    while (sc && !(sc.scrollHeight > sc.clientHeight + 1 && /(auto|scroll)/.test(getComputedStyle(sc).overflowY))) sc = sc.parentElement;
    const dy = el.getBoundingClientRect().top - innerHeight * a.at;
    if (sc) sc.scrollTop += dy; else window.scrollBy(0, dy);
  }, { sel, at });
  await page.waitForTimeout(300);
}
async function drawOn(page, sel) {
  const b = await page.locator(sel).boundingBox();
  const y = b.y + b.height / 2;
  await page.mouse.move(b.x + b.width * 0.75, y); await page.mouse.down();
  for (const [fx, dy] of [[0.68, -30], [0.62, 25], [0.56, -20], [0.5, 30], [0.44, -25], [0.38, 20], [0.3, -10]]) await page.mouse.move(b.x + b.width * fx, y + dy, { steps: 6 });
  await page.mouse.up();
}
const rowBtn = (on) => '#tb-tbt tr:first-child [onclick^="' + on + '"]';

const APP = {
  'a1-page': { talks: [], prep: async () => {}, ring: { sel: '#tbt-card .row .btn-p', n: 1 } },
  'a2-form': {
    talks: [],
    prep: async (p) => { await openForm(p, PILOT); await scrollTo(p, '#tbt-title', 0.2); },
    ring: { sel: '#tbt-kind', n: 2 },
  },
  'a3-before': {
    talks: [],
    prep: async (p) => {
      await openForm(p, PILOT);
      await p.evaluate(() => { document.querySelectorAll('.tbt-subj').forEach((c) => { if (c.value === 'כיבוי אש' || c.value === 'עבודה בגובה') c.checked = true; }); document.getElementById('tbt-eff-ok-f').value = '1'; });
      await scrollTo(p, '#tbt-typed-f', 0.06);
      await drawOn(p, '#tbt-trsig');
    },
    // From the box's title to the signature pad: the box runs on under the window's buttons.
    ring: { sel: '#tbt-typed-f', to: '#tbt-trsig', n: 3 },
  },
  'a4-send': {
    talks: [],
    prep: async (p) => { await openForm(p, PILOT); await scrollTo(p, '#tbt-typed-f', 0.06); },
    ring: { sel: '[onclick="svTbt(1)"]', n: 4 },
  },
  'a5-qr': {
    talks: [PILOT],
    prep: async (p) => { await p.click(rowBtn('tbtLink')); await p.waitForSelector('#m-tbt-link', { state: 'visible' }); await p.waitForTimeout(500); await scrollTo(p, '#tbt-link-qr', 0.25); },
    ring: { sel: '#tbt-link-qr', n: 5 },
  },
  'a8-count': { talks: [PILOT], reads: true, prep: async () => {}, ring: { sel: rowBtn('tbtWho'), n: 8 } },
  'a9-preview': {
    talks: [PILOT], reads: true,
    prep: async (p) => { await p.evaluate(() => tbtWho('pilot-ann')); await p.waitForTimeout(400); await scrollTo(p, '[onclick^="tbtForm0801Preview"]', 0.6); },
    ring: { sel: '[onclick^="tbtForm0801Preview"]', n: 9 },
  },
  'a10-who': {
    talks: [PILOT], reads: true,
    prep: async (p) => { await p.evaluate(() => tbtWho('pilot-ann')); await p.waitForTimeout(400); await scrollTo(p, '[onclick^="tbtMissMail"]', 0.6); },
    ring: { sel: '[onclick^="tbtMissMail"]', n: 10 },
  },
  'a11-miss': {
    talks: [PILOT], reads: true,
    prep: async (p) => { await p.evaluate(() => { tbtWho('pilot-ann'); return tbtMissMail('pilot-ann'); }); await p.waitForTimeout(400); await scrollTo(p, '#tbt-miss-res', 0.18); },
    ring: { sel: '#tbt-miss-res [onclick^="tbtMissSend"]', n: 11 },
  },
  // 15/10/2026: "close signatures" sits in the row, next to publish (Michael), and files form 08.01.
  'a12-close': { talks: [PILOT], reads: true, prep: async () => {}, ring: { sel: rowBtn('tbtClose'), n: 12 } },
  'a14-closed': {
    talks: [Object.assign({}, PILOT, { closed_at: TODAY + 'T12:00:00Z' })], reads: true,
    prep: async () => {},
    ring: { sel: rowBtn('tbtClose'), n: 14, up: true },
  },
  'a15-form': {
    talks: [Object.assign({}, PILOT, { closed_at: TODAY + 'T12:00:00Z' })], reads: true,
    prep: async (p) => { await p.evaluate(() => tbtWho('pilot-ann')); await p.waitForTimeout(400); await scrollTo(p, '#tbt-0801-btn', 0.6); },
    ring: { sel: '#tbt-0801-btn', n: 15 },
  },
};

// ---------- the worker's page ----------
let signed = [], closed = false;
globalThis.fetch = async (u) => {
  u = String(u);
  const j = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json' } });
  if (u.includes('/rest/v1/toolbox_talks')) return j([Object.assign({}, PILOT, closed ? { closed_at: TODAY + 'T12:00:00Z' } : {})]);
  if (u.includes('/rest/v1/toolbox_reads')) return j(signed);
  if (u.includes('/rest/v1/emp')) return j(EMPS);
  if (u.includes('/rest/v1/server_state')) return j([]);
  return j({}, 599);
};
const ENV = { SUPABASE_SERVICE_ROLE_KEY: 'srv', TRUSTEE_NOTIFY_SECRET: 'guide-shots', GEMINI_API_KEY: 'g' };
const workerHtml = async (isClosed) => { closed = !!isClosed; const k = await T.makePermToken(ENV, PILOT.id, 0); return (await T.onRequest({ request: new Request(T.talkUrl(k)), env: ENV })).text(); };
const WORKER = {
  'w6-details': {
    prep: async (p) => {
      await p.fill('#oname', 'סאמר חליל'); await p.fill('#oid', '222222226'); await p.selectOption('#idep', { index: 1 });
      await p.evaluate(() => document.getElementById('oname').scrollIntoView({ block: 'center' }));
    },
    ring: { sel: '#oname', to: '#idep', n: 6 },
  },
  'w7-sign': {
    prep: async (p) => {
      await p.fill('#oname', 'סאמר חליל'); await p.fill('#oid', '222222226'); await p.selectOption('#idep', { index: 1 });
      await p.check('input[name=ok]');
      await p.evaluate(() => { document.getElementById('go').scrollIntoView({ block: 'end' }); window.scrollBy(0, 40); });
      await p.waitForTimeout(150);
      const b = await p.locator('#pad').boundingBox(); const y = b.y + b.height / 2;
      await p.mouse.move(b.x + b.width * 0.75, y); await p.mouse.down();
      for (const [fx, dy] of [[0.68, -30], [0.62, 25], [0.56, -20], [0.5, 30], [0.44, -25], [0.38, 20], [0.3, -10]]) await p.mouse.move(b.x + b.width * fx, y + dy, { steps: 6 });
      await p.mouse.up();
    },
    ring: { sel: '#go', n: 7 },
  },
  'w13-closed': { closed: true, prep: async () => {}, ring: null, crop: true },
};

async function ring(p, spec) {
  return p.evaluate((a) => {
    const el = document.querySelector(a.sel);
    if (!el) return { ok: false, why: 'no element ' + a.sel };
    let r = el.getBoundingClientRect();
    // up: the closed row's tag sits above its reopen button; ring both.
    if (a.to) { const o = document.querySelector(a.to).getBoundingClientRect(); r = { top: Math.min(r.top, o.top), left: Math.min(r.left, o.left), right: Math.max(r.right, o.right), bottom: o.bottom }; r.width = r.right - r.left; r.height = r.bottom - r.top; }
    if (a.up && el.previousElementSibling) { const o = el.previousElementSibling.getBoundingClientRect(); r = { top: Math.min(r.top, o.top), left: Math.min(r.left, o.left), right: Math.max(r.right, o.right), bottom: Math.max(r.bottom, o.bottom), width: 1, height: 1 }; r.width = r.right - r.left; r.height = r.bottom - r.top; }
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
    return { ok: fits, why: fits ? '' : 'ring falls outside the frame ' + JSON.stringify([Math.round(r.top), Math.round(r.left), Math.round(r.bottom), Math.round(r.right)]) };
  }, spec);
}

// Form 08.01 as the pilot will produce it: form0801Html with the trainer's and one worker's signature.
async function formShot(browser) {
  const ctx = await browser.newContext({ viewport: { width: 794, height: 400 }, deviceScaleFactor: 1.5 });
  const p = await ctx.newPage();
  await p.route('**/*', (r) => (r.request().url().startsWith('data:') ? r.continue() : r.abort()));
  const sig = await p.evaluate(SIG_JS);
  const reads = READS(sig).concat([{ id: 'r2', emp_name: 'אולגה פטרוב', id_no: '333333334', dept: 'אריזה', read_at: TODAY + 'T07:20:00Z', sig_url: sig }]);
  await p.setContent(T.form0801Html(PILOT, reads, (x) => x.sig_url, sig));
  await p.waitForTimeout(250);
  const file = path.join(OUT, 'form-0801.png');
  await p.screenshot({ path: file, fullPage: true });
  console.log('  ✓ form-0801.png  (' + Math.round(fs.statSync(file).size / 1024) + ' KB)');
  await ctx.close();
}

const ALL = Object.keys(APP).concat(Object.keys(WORKER), ['form-0801']);
const want = process.argv.slice(2);
const names = want.length ? want : ALL;
const unknown = names.filter((n) => !ALL.includes(n));
if (unknown.length) { console.error('unknown shot: ' + unknown.join(', ')); process.exit(1); }
fs.mkdirSync(OUT, { recursive: true });
const browser = await pw.chromium.launch();
let failed = 0;
for (const name of names) {
  if (name === 'form-0801') { await formShot(browser); continue; }
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: 'he-IL', hasTouch: false });
  const p = await ctx.newPage();
  const errors = [];
  p.on('pageerror', (e) => errors.push(String(e)));
  p.on('dialog', (d) => d.accept().catch(() => {}));
  let spec;
  if (APP[name]) {
    spec = APP[name];
    await p.route('**/*', (r) => {
      const u = r.request().url();
      if (!u.startsWith('file://')) return r.abort();
      const f = decodeURIComponent(new URL(u).pathname);
      if (fs.existsSync(f)) return r.continue();
      const inRepo = path.join(ROOT, path.basename(f));
      return fs.existsSync(inRepo) ? r.fulfill({ path: inRepo }) : r.continue();
    });
    await p.goto(HTML, { waitUntil: 'load' });
    await p.waitForTimeout(900);
    const sig = await p.evaluate(SIG_JS);
    await app(p, { emps: EMPS, talks: spec.talks, reads: spec.reads ? READS(sig) : [] });
  } else {
    spec = WORKER[name];
    await p.route('**/*', (r) => r.abort());
    await p.setContent(await workerHtml(spec.closed));
    await p.waitForTimeout(250);
  }
  await spec.prep(p);
  await p.evaluate(() => { try { document.activeElement && document.activeElement.blur(); } catch (e) {} });
  await p.mouse.move(1, 1);
  await p.waitForTimeout(350);
  const placed = spec.ring ? await ring(p, spec.ring) : { ok: true };
  if (!placed.ok || errors.length) { console.error('  ✗ ' + name + ': ' + (placed.why || errors.join(' | '))); failed++; await ctx.close(); continue; }
  const file = path.join(OUT, name + '.png');
  const clip = spec.crop ? await p.evaluate(() => { let b = 0; document.querySelectorAll('body *').forEach((e) => { const r = e.getBoundingClientRect(); if (r.width && r.bottom > b && r.bottom < innerHeight) b = r.bottom; }); return { x: 0, y: 0, width: innerWidth, height: Math.min(innerHeight, Math.ceil(b) + 24) }; }) : null;
  await p.screenshot(clip ? { path: file, clip } : { path: file });
  console.log('  ✓ ' + name + '.png  (' + Math.round(fs.statSync(file).size / 1024) + ' KB)');
  await ctx.close();
}
await browser.close();
cleanup();
process.exit(failed ? 1 : 0);
