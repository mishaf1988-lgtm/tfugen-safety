// The equipment-report PDF importer and Smart Capture, end to end.
//
// Both were dead. _AI_MODEL is a text-only llama since the move to the free
// tier, and both features were still packing files into Anthropic content
// blocks: the importer sent {type:'document'} and always ended at "JSON parse
// failed"; Smart Capture sent {type:'image'} and worked only if you typed
// instead of photographing. Neither failed loudly — the buttons were there.
//
// This test runs the REAL proxy in node to produce the bytes, then feeds those
// exact bytes to the REAL client reader in Chromium. Server output meets
// client parser; nothing in between is described rather than executed.
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
let pw; try { pw = require('playwright'); } catch (e) { pw = require('playwright-core'); }
const ROOT = path.resolve(__dirname, '../..');
const HTML = 'file://' + path.join(ROOT, 'index.html');
let pass = 0, fail = 0;
const check = (l, c, d) => { if (c) { pass++; console.log('  ✓ ' + l); } else { fail++; console.log('  ✗ ' + l + (d !== undefined ? '  -> ' + JSON.stringify(d) : '')); } };

const SB = 'https://znhjtpcltrxxyfjczgvw.supabase.co';
const ORIGIN = 'https://tapugan-safety.pages.dev';
// What the model would answer for a two-item forklift inspection report.
const MODEL_ANSWER = JSON.stringify({
  report_number: '179338', inspection_date: '2026-09-01', vendor: 'בודק מוסמך בע"מ',
  items: [
    { equipment_name: 'מלגזה', equipment_code: 'MLG-4', license_number: '77123', expiry_date: '2027-09-01' },
    { equipment_name: 'מנוף צריח', equipment_code: 'CRN-1', expiry_date: '2027-03-01' },
  ],
});

// Ask the real proxy for a streaming Workers AI answer and keep the raw bytes.
async function realProxySse() {
  const src = fs.readFileSync(path.join(ROOT, 'functions/api/claude.js'), 'utf8')
    .replace(/from '\.\.\/_shared\.js'/, "from '" + pathToFileURL(path.join(ROOT, 'functions/_shared.js')).href + "'");
  const mod = await import('data:text/javascript;charset=utf-8,' + encodeURIComponent(src));
  globalThis.fetch = async (url) => {
    if (String(url).startsWith(SB + '/auth/v1/user')) return new Response(JSON.stringify({ id: 'u1', email: 'a@b.c' }), { status: 200 });
    throw new Error('unexpected ' + url);
  };
  const env = { SUPABASE_SERVICE_ROLE_KEY: 'svc', AI: { run: async () => ({ response: MODEL_ANSWER }) } };
  const r = await mod.onRequest({
    request: new Request(ORIGIN + '/api/claude', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', origin: ORIGIN, Authorization: 'Bearer admin.jwt' },
      body: JSON.stringify({ model: '@cf/meta/llama-3.3-70b-instruct-fp8-fast', max_tokens: 4000, stream: true, system: 's', messages: [{ role: 'user', content: 'x' }] }),
    }), env,
  });
  return r.text();
}

(async () => {
  const SSE = await realProxySse();

  const browser = await pw.chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, locale: 'he-IL' });
  const page = await ctx.newPage();
  page.on('dialog', (d) => d.accept().catch(() => {}));
  await page.route('**/*', (r) => r.request().url().startsWith('file://') ? r.continue() : r.abort());
  await page.goto(HTML, { waitUntil: 'load' });
  await page.waitForTimeout(700);

  await page.evaluate((sse) => {
    document.getElementById('login').style.display = 'none';
    document.getElementById('app').style.display = 'block';
    window._currentUser = { username: 'admin' }; _isAdmin = true; _applyRoleGates();
    window.__sse = sse;
    window.__req = [];
    window.__pages = null;        // how many pages the stub was asked for
    window.__pdfText = 'תסקיר בדיקת ציוד\nמלגזה MLG-4 רישוי 77123 תוקף עד 01/09/2027\nמנוף צריח CRN-1 תוקף עד 01/03/2027\nבודק מוסמך\n';

    // pdf.js, stubbed. _ensurePdfJs short-circuits when pdfjsLib already exists,
    // so nothing is fetched from the CDN.
    window.pdfjsLib = {
      GlobalWorkerOptions: {},
      getDocument: function () {
        return { promise: Promise.resolve({
          numPages: 12,
          getPage: function (n) {
            window.__pages = Math.max(window.__pages || 0, n);
            return Promise.resolve({ getTextContent: function () {
              // An image-only scan yields NO text items at all, not empty ones.
              return Promise.resolve({ items: window.__pdfText ? [{ str: window.__pdfText + ' [page ' + n + ']' }] : [] });
            } });
          },
        }) };
      },
    };

    // Answer every AI call with the bytes the real proxy produced, delivered in
    // two chunks split in the MIDDLE of a line — a reader that forgets to carry
    // the partial line passes a single-chunk test and fails in production.
    window.fetch = function (u, o) {
      var body = JSON.parse(o.body);
      window.__req.push(body);
      var bytes = new TextEncoder().encode(window.__sse);
      var cut = Math.floor(bytes.length / 2);
      var parts = [bytes.slice(0, cut), bytes.slice(cut)], i = 0;
      return Promise.resolve({
        ok: true, status: 200,
        body: { getReader: function () { return { read: function () {
          return Promise.resolve(i < parts.length ? { done: false, value: parts[i++] } : { done: true });
        } }; } },
        text: function () { return Promise.resolve(window.__sse); },
      });
    };
  }, SSE);

  console.log('\n1. the importer reads the report and comes back with its items');
  {
    const r = await page.evaluate(() => {
      var f = new File([new Uint8Array([37, 80, 68, 70])], 'tskir.pdf', { type: 'application/pdf' });
      return _eqiPdfAnalyzeOne(f, 0).then(function (d) {
        return { ok: true, items: d.items.map(function (i) { return i.equipment_name; }), report: d.report_number, lic: d.items[0].license_number };
      }, function (e) { return { ok: false, err: String(e && e.message || e) }; });
    });
    check('it resolves instead of failing (it used to always reject)', r.ok, r);
    check('both items came back, with the report number and licence', r.ok && r.items.join() === 'מלגזה,מנוף צריח' && r.report === '179338' && r.lic === '77123', r);
  }

  console.log('\n2. what actually went on the wire');
  {
    const b = await page.evaluate(() => window.__req[0]);
    check('the text model is addressed', b.model === '@cf/meta/llama-3.3-70b-instruct-fp8-fast', b.model);
    check('the message content is a STRING, not a block array', typeof b.messages[0].content === 'string', typeof b.messages[0].content);
    check('no document block is left anywhere in the body', !/"type":"document"/.test(JSON.stringify(b)));
    check('the report’s own text is in it', b.messages[0].content.indexOf('MLG-4') > 0);
    check('page 12 is in it too, so the 3-page default did not truncate the report', b.messages[0].content.indexOf('[page 12]') > 0);
    check('the extractor was asked for more than 3 pages', await page.evaluate(() => window.__pages) === 12, await page.evaluate(() => window.__pages));
    check('the untrusted-content fence wraps it', /<UNTRUSTED_DOC_CONTENT>[\s\S]*<\/UNTRUSTED_DOC_CONTENT>/.test(b.messages[0].content));
    check('the system prompt is still sent — the proxy now forwards it', typeof b.system === 'string' && b.system.length > 100, (b.system || '').length);
    check('streaming is still requested, so a long report cannot hit the 100s timeout', b.stream === true);
  }

  console.log('\n3. a scanned PDF says so, instead of "JSON parse failed"');
  {
    const r = await page.evaluate(() => {
      window.__pdfText = '';       // an image-only scan has no text layer
      window.__req = [];
      var f = new File([new Uint8Array([37])], 'scan.pdf', { type: 'application/pdf' });
      return _eqiPdfAnalyzeOne(f, 0).then(function () { return { ok: true }; },
        function (e) { return { ok: false, err: String(e && e.message || e), calls: window.__req.length }; });
    });
    check('it is rejected', !r.ok, r);
    check('the message tells the user to photograph it instead', /תמונה/.test(r.err) && !/JSON parse/.test(r.err), r.err);
    check('and no AI quota was spent on a file with nothing in it', r.calls === 0, r.calls);
  }

  console.log('\n4. Smart Capture: a photo reaches a model that can see');
  {
    const r = await page.evaluate(() => {
      window.__req = [];
      _capPhotoB64 = 'data:image/jpeg;base64,QUJD';
      _capVideoFrames = null;
      // the reply shape capShowReview expects
      window.__sse = JSON.stringify({ content: [{ type: 'text', text: JSON.stringify({ type: 'near_miss', description: 'שמן על הרצפה', severity: 'בינוני', confidence: 0.8 }) }] });
      _capAnalyze('', false);
      return new Promise(function (res) { setTimeout(function () { res({ req: window.__req[0], result: window._capAiResult || null }); }, 400); });
    });
    check('the photo goes to the vision model', r.req && r.req.model === '@cf/meta/llama-3.2-11b-vision-instruct', r.req && r.req.model);
    check('it is sent as {prompt, image} — the shape the proxy passes to Workers AI', !!(r.req && r.req.prompt && r.req.image), r.req && Object.keys(r.req));
    check('the base64 prefix is stripped, as Workers AI wants', r.req && r.req.image === 'QUJD', r.req && r.req.image);
    check('no image block is left in the body', r.req && !/"type":"image"/.test(JSON.stringify(r.req)));
    check('the answer is parsed and the review screen has it', r.result && r.result.severity === 'בינוני', r.result);
  }

  console.log('\n5. typed capture with no photo still uses the text model');
  {
    const r = await page.evaluate(() => {
      window.__req = [];
      _capPhotoB64 = null; _capVideoFrames = null;
      _capAnalyze('נפלתי על מדרגה רטובה', false);
      return new Promise(function (res) { setTimeout(function () { res(window.__req[0]); }, 400); });
    });
    check('the text model is used', r && r.model === '@cf/meta/llama-3.3-70b-instruct-fp8-fast', r && r.model);
    check('the typed text is in the message', r && r.messages[0].content.indexOf('מדרגה רטובה') > 0);
  }

  console.log('\n6. a video: the user is told only one frame was read');
  {
    const r = await page.evaluate(() => {
      window.__req = [];
      _capPhotoB64 = null;
      _capVideoFrames = ['data:image/jpeg;base64,AAA', 'data:image/jpeg;base64,BBB', 'data:image/jpeg;base64,CCC'];
      _capAnalyze('', false);
      return { req: window.__req[0], status: g('cap-status').textContent };
    });
    check('the first frame is the one sent', r.req && r.req.image === 'AAA', r.req && r.req.image);
    check('the prompt does not claim the model saw all three', r.req && !/3 frames/.test(r.req.prompt), (r.req && r.req.prompt || '').slice(-120));
    check('the status line says one frame out of three was read', /1|אחת/.test(r.status) && /3/.test(r.status), r.status);
  }

  await browser.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('HARNESS ERROR', e); process.exit(2); });
