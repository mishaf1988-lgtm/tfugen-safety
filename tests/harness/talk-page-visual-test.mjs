// The worker's signing page as a phone shows it, in every language (03/10/2026,
// Michael: "yes" to an automatic screen check). The review of 03/10 found two
// defects only a screenshot showed: the ID field came between the list and the
// name under "not on the list", and its placeholder was cut off in Russian. This
// renders the real pages of talk.js at 375 pixels and measures what a person
// would see: no sideways scroll, nothing off the screen, no text cut inside a
// field or a button, the direction of the language, the field order. With
// SHOTS=<dir> it also saves a picture of each page, for a human look.
import { createRequire } from 'module';
import { onRequest, makeTalkToken, LANGS } from './_build/talk.mjs';

const require = createRequire(import.meta.url);
let pw; try { pw = require('playwright'); } catch (e) { pw = require('playwright-core'); }
let pass = 0, fail = 0;
const check = (l, c, d) => { if (c) { pass++; console.log('  ✓ ' + l); } else { fail++; console.log('  ✗ ' + l + (d !== undefined ? '  -> ' + JSON.stringify(d).slice(0, 400) : '')); } };
const SB = 'https://znhjtpcltrxxyfjczgvw.supabase.co';
const ENV = { SUPABASE_SERVICE_ROLE_KEY: 'srv', TRUSTEE_NOTIFY_SECRET: 'nsec', GEMINI_API_KEY: 'g' };
// Long texts on purpose: the longest real lines are where things get cut.
const TALK = {
  id: 't1', d: '2026-10-04', s: 'פורסמה', file_url: SB + '/storage/v1/object/public/incidents-photos/tb-1.pdf',
  title: 'עבודה בגובה: רתמה, עיגון ונקודות עיגון מאושרות לפני כל עלייה',
  body: '1. לבדוק את הרתמה לפני כל שימוש.\n2. לעגן לנקודה מאושרת בלבד.\n3. אסור לעבוד לבד בגובה.',
  body_ru: 'Работа на высоте: страховочная привязь и точки крепления\n1. Проверьте страховочную привязь перед каждым использованием.\n2. Крепитесь только к утвержденной точке.',
  body_ar: 'العمل على ارتفاع: الحزام ونقاط التثبيت المعتمدة\n1. افحص الحزام قبل كل استخدام.',
  body_am: 'በከፍታ ላይ መስራት: የደህንነት ማሰሪያ እና የተፈቀዱ መያዣ ነጥቦች\n1. ከእያንዳንዱ አጠቃቀም በፊት ማሰሪያውን ይፈትሹ።',
};
const EMPS = [{ id: 'e1', n: 'דנה כהן', dep: 'ייצור' }, { id: 'e2', n: 'עובד עם שם משפחה ארוך מאוד מאוד', dep: 'מחלקת אחזקה ותשתיות' }];
globalThis.fetch = async (u) => {
  u = String(u);
  const j = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json' } });
  if (u.includes('/rest/v1/toolbox_talks')) return j([TALK]);
  if (u.includes('/rest/v1/emp')) return j(EMPS);
  if (u.includes('/object/sign/')) return j({ signedURL: '/object/sign/incidents-photos/tb-1.pdf?token=a' });
  return j({}, 599);
};
const page0 = async (k, l) => { const r = await onRequest({ request: new Request('https://tapugan-safety.pages.dev/api/talk?k=' + encodeURIComponent(k) + (l ? '&l=' + l : '')), env: ENV }); return [r.status, await r.text()]; };

// What a person sees, measured in the page.
const MEASURE = () => {
  const W = window.innerWidth, out = { sw: document.documentElement.scrollWidth, dir: document.documentElement.dir, off: [], cut: [], undef: /undefined|null/.test(document.body.innerText) };
  const ctx = document.createElement('canvas').getContext('2d');
  document.querySelectorAll('input:not([type=hidden]),select,button,label,h2,a,canvas').forEach((el) => {
    const r = el.getBoundingClientRect(), st = getComputedStyle(el);
    if (!r.width || st.display === 'none' || el.closest('[style*="display:none"]')) return;
    if (r.left < -1 || r.right > W + 1) out.off.push((el.id || el.tagName) + ' ' + Math.round(r.left) + '..' + Math.round(r.right));
    if (el.tagName === 'INPUT' && el.placeholder) {
      ctx.font = st.fontSize + ' ' + st.fontFamily;
      const room = el.clientWidth - parseFloat(st.paddingLeft) - parseFloat(st.paddingRight);
      if (ctx.measureText(el.placeholder).width > room + 1) out.cut.push(el.id || el.name);
    }
    if ((el.tagName === 'BUTTON' || el.tagName === 'SELECT') && el.scrollWidth > el.clientWidth + 1 && el.tagName === 'BUTTON') out.cut.push(el.id || el.textContent.trim().slice(0, 20));
  });
  return out;
};

(async () => {
  const tok = await makeTalkToken(ENV, 't1');
  const old = await makeTalkToken(ENV, 't1', Date.now() - 20 * 864e5);
  const browser = await pw.chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 1 })).newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.route('**/*', (r) => r.abort());
  const shots = process.env.SHOTS || '';
  const want = { he: 'rtl', ar: 'rtl', ru: 'ltr', am: 'ltr' };

  for (const l of Object.keys(want)) {
    console.log('\n' + l);
    const [st, html] = await page0(tok, l);
    await page.setContent(html); await page.waitForTimeout(80);
    let m = await page.evaluate(MEASURE);
    check(l + ': the page opens, in its direction (' + want[l] + ')', st === 200 && m.dir === want[l] && LANGS[l].dir === want[l], [st, m.dir]);
    check(l + ': no sideways scroll at 375', m.sw <= 375, m.sw);
    check(l + ': nothing off the screen', !m.off.length, m.off);
    check(l + ': no text cut inside a field or a button', !m.cut.length, m.cut);
    check(l + ': no "undefined" or "null" on the page (a missing word)', !m.undef);
    if (shots) await page.screenshot({ path: shots + '/talk-' + l + '.png', fullPage: true });
    await page.selectOption('#emp', '__other'); await page.waitForTimeout(50);
    const o = await page.evaluate(() => { const y = (s) => { const e = document.querySelector(s); return e ? e.getBoundingClientRect().top : -1; }; return { box: getComputedStyle(document.getElementById('obox')).display, name: y('#oname'), comp: y('[name=ocomp]'), id: y('#oid'), sig: y('#pad') }; });
    m = await page.evaluate(MEASURE);
    check(l + ': "not on the list" shows full name, company, then the ID, then the signature', o.box === 'block' && o.name > 0 && o.name < o.comp && o.comp < o.id && o.id < o.sig, o);
    check(l + ': "not on the list" still fits and nothing is cut', m.sw <= 375 && !m.off.length && !m.cut.length, m);
    if (shots) await page.screenshot({ path: shots + '/talk-' + l + '-other.png', fullPage: true });
  }

  console.log('\nerror pages');
  for (const [n, k, l, code] of [['expired', old, 'ru', 410], ['bad link', 'zzz', 'ar', 403]]) {
    const [st, html] = await page0(k, l);
    await page.setContent(html); await page.waitForTimeout(50);
    const m = await page.evaluate(MEASURE);
    check(n + ' (' + l + '): its code, its language\'s direction, fits', st === code && m.dir === want[l] && m.sw <= 375 && !m.undef, [st, m]);
    if (shots) await page.screenshot({ path: shots + '/talk-' + n.replace(' ', '-') + '.png' });
  }
  check('no page errors', errors.length === 0, errors);
  await browser.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('HARNESS ERROR', e); process.exit(2); });
