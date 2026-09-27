// The AI assistant asks for "gemini" and sends the last turns with each new
// question; a fallback answer carries a small note. fetch is mocked.
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

  const out = await page.evaluate(async () => {
    const sent = []; let n = 0;
    window.fetch = (url, init) => {
      const b = JSON.parse(init.body); sent.push(b); n++;
      const body = { content: [{ type: 'text', text: 'answer ' + n }] };
      if (n === 2) body.fallback_from = { model: 'gemini:x', reason: 'Gemini 429' };
      return Promise.resolve({ ok: true, status: 200, text: () => Promise.resolve(JSON.stringify(body)) });
    };
    let hist = document.getElementById('ask-history'), inp = document.getElementById('ask-input');
    if (!hist) { hist = document.createElement('div'); hist.id = 'ask-history'; document.body.appendChild(hist); }
    if (!inp) { inp = document.createElement('input'); inp.id = 'ask-input'; document.body.appendChild(inp); }
    const wait = () => new Promise((r) => setTimeout(r, 50));
    for (let i = 1; i <= 6; i++) { inp.value = 'q' + i; _askSend(); await wait(); }
    return { sent, html: hist.innerHTML };
  });

  const m = (i) => out.sent[i].messages;
  check('model is gemini', out.sent.every((b) => b.model === 'gemini'), out.sent.map((b) => b.model));
  check('first question: one message', m(0).length === 1 && m(0)[0].role === 'user');
  check('second question carries q1 + answer 1', m(1).length === 3 && m(1)[0].content === 'q1' && m(1)[1].role === 'assistant' && m(1)[1].content === 'answer 1', m(1));
  check('only the newest turn carries the snapshot', m(1)[0].content.indexOf('"counts"') < 0 && m(1)[2].content.indexOf('"counts"') > 0);
  check('capped at 4 previous turns (9 messages)', m(5).length === 9 && m(5)[0].content === 'q2', m(5).map((x) => String(x.content).slice(0, 4)));
  check('fallback answer gets the note', (out.html.match(/Gemini/g) || []).length === 1, out.html.length);
  const md = await page.evaluate(() => _askMd('**הממצא:** x <img src=x onerror=alert(1)> **b**'));
  check('**bold** rendered as <b>', md.indexOf('<b>הממצא:</b>') === 0 && md.indexOf('<b>b</b>') > 0, md);
  check('model text is escaped, not markup', md.indexOf('<img') < 0 && md.indexOf('&lt;img') > 0, md);
  check('no page errors', errors.length === 0, errors);
  await browser.close();
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
