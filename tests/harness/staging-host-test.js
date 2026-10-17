// Which database the app talks to, by host (16/10/2026, Michael: "a development and test
// environment"; project-files/staging/README.md). A Cloudflare preview build
// (<hash>.tapugan-safety.pages.dev) must use the test project tfugen-staging; production
// (tapugan-safety.pages.dev itself), file:// and localhost must keep the live one. A slip
// here either writes test data into the live database or points the live app at the
// test one, so both directions are checked, on the code as it sits in index.html.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const html = fs.readFileSync(path.resolve(__dirname, '../../index.html'), 'utf8');
let pass = 0, fail = 0;
const check = (l, c, d) => { if (c) { pass++; console.log('  ✓ ' + l); } else { fail++; console.log('  ✗ ' + l + (d !== undefined ? '  -> ' + JSON.stringify(d) : '')); } };

const LIVE = 'https://znhjtpcltrxxyfjczgvw.supabase.co', TEST = 'https://ldzbjbsumzqjyvtpiwqo.supabase.co';
const a = html.indexOf('var _STAGING='), b = html.indexOf('\n', html.indexOf("if(_STAGING){", a));
// The addresses come from SITE (17/10/2026, functions/_site.js), the page's own copy of which runs first.
const cfg = /<script id="site-config">([^<]*)<\/script>/.exec(html);
const snippet = cfg && a > 0 && b > a ? cfg[1] + '\n' + html.substring(a, b) : '';
check('the host switch is in index.html', !!snippet);
const run = (host) => {
  const doc = { title: 'Tapugan Safety' };
  const ctx = { location: { hostname: host }, document: doc };
  vm.runInNewContext(snippet + '\n;this.out={SBU:SBU,SBK:SBK,st:_STAGING};', ctx);
  return Object.assign({ title: doc.title }, ctx.out);
};

console.log('\n1. live: production, file:// and localhost');
for (const h of ['tapugan-safety.pages.dev', '', 'localhost', '127.0.0.1']) {
  const r = run(h);
  check('"' + (h || 'file://') + '": the live database, live key, title unchanged', r.SBU === LIVE && /^sb_publishable_N2ih/.test(r.SBK) && !r.st && r.title === 'Tapugan Safety', r);
}

console.log('\n2. test: a preview build');
for (const h of ['a1b2c3d4.tapugan-safety.pages.dev', 'routine-x.tapugan-safety.pages.dev', 'ABC.Tapugan-Safety.pages.dev']) {
  const r = run(h);
  check('"' + h + '": the test database and its own key, title says ניסוי', r.SBU === TEST && /^sb_publishable_zITt/.test(r.SBK) && r.st && /^ניסוי - /.test(r.title), r);
}

console.log('\n3. not fooled by a look-alike host');
for (const h of ['tapugan-safety.pages.dev.evil.com', 'xtapugan-safety.pages.dev', 'tapugan-safety.pages.dev.']) {
  const r = run(h);
  check('"' + h + '": stays on the live database (no test data mixing, no surprise)', r.SBU === LIVE && !r.st, r);
}

console.log('\n4. the second client (_SB/_SK) follows the same choice');
check('_SB and _SK are SBU and SBK, not a second hard-coded live URL', /var _SB=SBU;/.test(html) && /var _SK=SBK;/.test(html) && (html.match(/znhjtpcltrxxyfjczgvw\.supabase\.co'/g) || []).length === 0 && /var SBU=_STAGING\?SITE\.stagingSupabaseUrl:SITE\.supabaseUrl;/.test(html), (html.match(/znhjtpcltrxxyfjczgvw\.supabase\.co'/g) || []).length);

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
