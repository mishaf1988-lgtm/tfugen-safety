// The app should not be findable in a search engine.
//
// Michael, 2026-09-21: «כל האפליקציה חשופה לעולם». Some of that is by design
// -- the trustee screen has to be reachable without a password -- but nothing
// here belongs in a search result: not the login page, not the trustee screen,
// and not a report somebody shared a link to. There was no robots.txt and no
// noindex of any kind.
//
// Three layers, because each fails differently. robots.txt asks and a polite
// crawler obeys. The meta tag covers the page itself. The X-Robots-Tag header
// covers every response including the manifest and the service worker, and is
// the one that still applies to a crawler that never reads robots.txt.
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '../..');
let pass = 0, fail = 0;
const check = (l, c, d) => { if (c) { pass++; console.log('  ✓ ' + l); } else { fail++; console.log('  ✗ ' + l + (d !== undefined ? '  -> ' + JSON.stringify(d) : '')); } };

const read = (f) => { try { return fs.readFileSync(path.join(ROOT, f), 'utf8'); } catch (e) { return null; } };

console.log('\n1. robots.txt exists and says no');
{
  const r = read('robots.txt');
  check('the file is there', r !== null, 'missing');
  const body = (r || '').split('\n').filter((l) => !/^\s*#/.test(l)).join('\n');
  check('it applies to every crawler', /User-agent:\s*\*/i.test(body), body);
  check('...and disallows the whole site', /Disallow:\s*\/\s*$/im.test(body), body);
  // Since the geo gate landed, EVERY path is routed through Functions, so
  // "the router does not claim it" is no longer the right question -- the
  // middleware claims it and hands it on. What still has to be true is that
  // something hands it on. That is asserted for real, against the running
  // middleware, in geo-gate-test; here we only check the two agree.
  let routes = null;
  try { routes = JSON.parse(read('_routes.json')); } catch (e) {}
  const all = (routes && routes.include || []).indexOf('/*') >= 0;
  const mw = read('functions/_middleware.js');
  check('if the router claims every path, a middleware exists to pass files on',
    !all || (mw && /next\(\)/.test(mw)), { include: routes && routes.include, middleware: !!mw });
}

console.log('\n2. the page itself carries noindex');
{
  const html = read('index.html') || '';
  const head = html.slice(0, html.indexOf('</head>'));
  const m = head.match(/<meta\s+name="robots"\s+content="([^"]*)"/i);
  check('the meta tag is in the head', !!m, 'not in <head>');
  check('...and it says noindex', !!m && /noindex/i.test(m[1]), m && m[1]);
  check('...and nofollow', !!m && /nofollow/i.test(m[1]), m && m[1]);
}

console.log('\n3. every response carries the header');
{
  const h = read('_headers') || '';
  // The header has to sit under the catch-all block, not under one path, or
  // the manifest and the icons stay indexable on their own.
  const blocks = h.split(/\n(?=\/)/);
  const all = blocks.filter((b) => /^\/\*/.test(b.trim()));
  check('there is a catch-all block', all.length === 1, all.length);
  const body = (all[0] || '').split('\n').filter((l) => !/^\s*#/.test(l)).join('\n');
  check('X-Robots-Tag is in it', /X-Robots-Tag:/i.test(body), body.slice(0, 200));
  check('...set to noindex', /X-Robots-Tag:[^\n]*noindex/i.test(body), body.match(/X-Robots-Tag:[^\n]*/i));
  // The rest of the hardening from the May review has to survive this edit.
  ['X-Content-Type-Options', 'Strict-Transport-Security', 'Content-Security-Policy',
    'X-Frame-Options', 'Referrer-Policy'].forEach(function (k) {
    check('...and ' + k + ' is still there', new RegExp(k + ':', 'i').test(body), k + ' missing');
  });
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
