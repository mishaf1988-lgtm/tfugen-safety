// The app's main script served as its own file (10/10/2026, Michael: "בצע: הפרדה בשרת").
//
// Measured: the one inline <script> of index.html is 1.57MB. A browser parses an inline
// script on the main thread at every open and keeps no compiled copy of it; an external
// script it compiles off the main thread and caches. Chromium with the CPU slowed x4:
// DOMContentLoaded 1.1-2.2s inline, 0.65-0.76s as /app.js (4 loads each).
//
// The repo stays one file (CLAUDE.md rules 5 and 6, DECISIONS 19/09/2026): index.html is
// the only source and nothing is built. At serve time the middleware swaps the inline
// <script id="app-main"> for <script src="/app.js?v=<deploy>">, and /app.js (app.js.js)
// cuts the same bytes out of the deployed index.html. A failed load falls back to
// /?inline=1, which the middleware and the service worker leave untouched.
export const APP_ID = 'app-main';
// The two scripts after the page's markup (16/10/2026, BACKLOG 14.11: 139KB + 189KB that were
// still parsed inline at every open) go out the same way, each as its own file at its own
// place in the page, so they still run in the same order and after the same markup.
// p = the part name in the URL; the main script keeps the plain /app.js?v= it always had.
export const PARTS = { main: APP_ID, t1: 'app-tail-1', t2: 'app-tail-2' };

// The text of <script id="<id>"> in html, or null. An inline script cannot contain
// "</script>" (the HTML parser would end it there), so the first one closes it.
export function extractApp(html, id) {
  const s = String(html || '');
  const open = '<script id="' + (id || APP_ID) + '">';
  const i = s.indexOf(open);
  if (i < 0) return null;
  const j = s.indexOf('</script>', i + open.length);
  return j < 0 ? null : s.substring(i + open.length, j);
}

export const buildOf = (env) => String((env && env.CF_PAGES_COMMIT_SHA) || 'dev').substring(0, 7);
export const appSrc = (build, part) => (part && part !== 'main' ? '/app.js?p=' + part + '&v=' : '/app.js?v=') + build;
// Back to the inline page once, never in a loop.
export const ON_ERROR = "if(!/[?&]inline=1/.test(location.search))location.replace('/?inline=1')";

// The page with the script tag swapped, streamed by HTMLRewriter (native in Workers, so
// the 2.2MB page costs no JS time). Where there is no HTMLRewriter (Node tests), the page
// goes out unchanged: inline is the safe default.
export function rewriteApp(res, build, R) {
  const Rw = R || globalThis.HTMLRewriter;
  if (!Rw) return res;
  let rw = new Rw();
  Object.keys(PARTS).forEach((part) => {
    rw = rw.on('script#' + PARTS[part], {
      element(el) {
        el.setAttribute('src', appSrc(build, part));
        el.setAttribute('onerror', ON_ERROR);
        el.setInnerContent('');
      },
    });
  });
  return rw.transform(res);
}
