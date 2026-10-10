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
const OPEN = '<script id="' + APP_ID + '">';

// The text of <script id="app-main"> in html, or null. An inline script cannot contain
// "</script>" (the HTML parser would end it there), so the first one closes it.
export function extractApp(html) {
  const s = String(html || '');
  const i = s.indexOf(OPEN);
  if (i < 0) return null;
  const j = s.indexOf('</script>', i + OPEN.length);
  return j < 0 ? null : s.substring(i + OPEN.length, j);
}

export const buildOf = (env) => String((env && env.CF_PAGES_COMMIT_SHA) || 'dev').substring(0, 7);
export const appSrc = (build) => '/app.js?v=' + build;
// Back to the inline page once, never in a loop.
export const ON_ERROR = "if(!/[?&]inline=1/.test(location.search))location.replace('/?inline=1')";

// The page with the script tag swapped, streamed by HTMLRewriter (native in Workers, so
// the 2.2MB page costs no JS time). Where there is no HTMLRewriter (Node tests), the page
// goes out unchanged: inline is the safe default.
export function rewriteApp(res, build, R) {
  const Rw = R || globalThis.HTMLRewriter;
  if (!Rw) return res;
  return new Rw().on('script#' + APP_ID, {
    element(el) {
      el.setAttribute('src', appSrc(build));
      el.setAttribute('onerror', ON_ERROR);
      el.setInnerContent('');
    },
  }).transform(res);
}
