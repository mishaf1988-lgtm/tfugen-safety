// The "read aloud" button on the weekly talk page (10/10/2026, Michael: "מאשר המלצות"):
// speechSynthesis, the phone's own voices. Shown only when there is a voice in the page's
// language, reads the title and the body, and the second tap stops.
import { createRequire } from 'module';
import { onRequest, makeTalkToken, SPEAK } from './_build/talk.mjs';

const require = createRequire(import.meta.url);
let pw; try { pw = require('playwright'); } catch (e) { pw = require('playwright-core'); }
let pass = 0, fail = 0;
const check = (l, c, d) => { if (c) { pass++; console.log('  ✓ ' + l); } else { fail++; console.log('  ✗ ' + l + (d !== undefined ? '  -> ' + JSON.stringify(d).slice(0, 300) : '')); } };
const ENV = { SUPABASE_SERVICE_ROLE_KEY: 'srv', TRUSTEE_NOTIFY_SECRET: 'nsec' };
const TALK = { id: 't1', d: '2026-10-04', s: 'פורסמה', title: 'עבודה בגובה', body: 'לבדוק את הרתמה לפני כל שימוש.', body_am: 'በከፍታ ላይ መስራት\nማሰሪያውን ይፈትሹ።', body_ru: 'Работа на высоте\nПроверьте привязь.' };
globalThis.fetch = async (u) => {
  u = String(u);
  const j = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json' } });
  if (u.includes('/rest/v1/toolbox_talks')) return j([TALK]);
  if (u.includes('/rest/v1/emp')) return j([{ id: 'e1', n: 'דנה', dep: 'ייצור' }]);
  return j({}, 599);
};
const html = async (k, l) => (await onRequest({ request: new Request('https://tapugan-safety.pages.dev/api/talk?k=' + encodeURIComponent(k) + (l ? '&l=' + l : '')), env: ENV })).text();
// A fake speechSynthesis with the given voice languages; records what was spoken.
const STUB = (langs) => {
  window.__said = []; window.__cancel = 0;
  window.SpeechSynthesisUtterance = function (t) { this.text = t; };
  Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: { getVoices: () => langs.map((l) => ({ lang: l, name: l })), addEventListener() {},
    speak(u) { window.__said.push({ text: u.text, lang: u.lang }); window.__u = u; }, cancel() { window.__cancel++; } } });
};

(async () => {
  const tok = await makeTalkToken(ENV, 't1');
  const browser = await pw.chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 375, height: 812 } });
  const errs = [];
  const open = async (langs, l) => {
    const p = await ctx.newPage();
    p.on('pageerror', (e) => errs.push(String(e)));
    await p.route('**/*', (r) => r.abort());
    await p.addInitScript(STUB, langs);
    await p.goto('about:blank');  // the init script runs on a navigation, not on setContent of the first blank page
    await p.setContent(await html(tok, l)); await p.waitForTimeout(60);
    return p;
  };
  const vis = (p) => p.evaluate(() => { const b = document.getElementById('say'); return !!b && getComputedStyle(b).display !== 'none'; });

  console.log('1. Hebrew phone');
  let p = await open(['en-US', 'he-IL'], 'he');
  check('the button shows', await vis(p));
  check('...labelled in Hebrew', /הקרא בקול/.test(await p.textContent('#say')));
  await p.click('#say');
  let r = await p.evaluate(() => ({ said: window.__said, label: document.getElementById('say').textContent }));
  check('a tap reads the title and the body, with the Hebrew voice', r.said.length === 1 && /עבודה בגובה/.test(r.said[0].text) && /הרתמה/.test(r.said[0].text) && r.said[0].lang === 'he-IL', r);
  check('...and the button becomes "stop"', /עצור/.test(r.label), r.label);
  await p.click('#say');
  r = await p.evaluate(() => ({ c: window.__cancel, label: document.getElementById('say').textContent }));
  check('a second tap stops', r.c >= 2 && /הקרא בקול/.test(r.label), r);
  await p.close();

  console.log('\n2. Android names Hebrew "iw"');
  p = await open(['iw-IL'], 'he');
  check('the button shows', await vis(p));
  await p.close();

  console.log('\n3. no voice in the language');
  p = await open(['en-US', 'he-IL'], 'am');
  check('Amharic page, no Amharic voice: no button', !(await vis(p)));
  await p.close();
  p = await open(['ru-RU'], 'ru');
  check('Russian page, Russian voice: the button, in Russian', (await vis(p)) && (await p.textContent('#say')).includes(SPEAK.ru.listen));
  await p.close();
  p = await open([], 'he');
  check('no voices at all: no button', !(await vis(p)));
  await p.close();

  check('no page errors', !errs.length, errs);
  await browser.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
