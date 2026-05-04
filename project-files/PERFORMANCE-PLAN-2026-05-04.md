# תוכנית שדרוג ביצועים — Tapugan Safety End-to-End

**תאריך:** 2026-05-04
**מקור:** סינתזה של 5 סוכני מחקר במקביל — סקירת קוד פנימית + 4 חוקרי best-practice לשנים 2025-2026 (Supabase · Cloudflare Pages · Service Worker/PWA · Vanilla-JS).
**יעד:** לשפר זמן end-to-end מענן עד לחיצת כפתור, בלי לשבור שום פיצ'ר קיים.

---

## עקרון-על: שלא נשבור כלום

כל פעולה תצא ב-PR נפרד עם:

1. **Smoke checklist** לפני מיזוג: 28 טבלאות 200 OK · login · realtime · רינדור דשבורד · NCR list · שמירת רשומה.
2. **`Last Known Good` tag** בתחילת כל פאזה — חזרה מהירה אם משהו נשבר.
3. **Feature flag ב-`_appPrefs`** לשינויים החודרניים יותר (SW, sync rewrite).
4. **קודם instrumentation, אחר כך אופטימיזציה** — אסור "לתקן" בלי למדוד.
5. כל שינוי SQL הולך ל-Supabase ידנית עם `IF NOT EXISTS`/`OR REPLACE` כדי שהוא בטוח לחזרה.

**יעדי 2026** שנמדוד אחרי כל פאזה:
- LCP ≤ 2.5s
- INP ≤ 200ms (החליף את FID ב-2024)
- CLS ≤ 0.1

---

## פאזה 0 — Instrumentation (חובה ראשונה, 1 PR)

**למה ראשונה**: היום אין מדידות בכלל. לא נדע אם השינויים עוזרים בפועל.

| פעולה | קובץ | סיכון |
|---|---|---|
| הטמעת `web-vitals` IIFE מ-CDN, שולח LCP/INP/CLS ל-`audit_log` | `index.html` `<head>` | 0 |
| `_perf(label, fn)` wrapper מסביב ל-`rDash`/`rNcr`/`rEqi`/`sbSync`, מדפיס ל-console מאחורי `?perf=1` | `index.html` near top | 0 |
| `window.onerror` + `unhandledrejection` → `audit_log` | `index.html` near top | 0 |

---

## פאזה 1 — Quick wins אפס סיכון (3-5 PRs)

כולם CSS/headers/preconnect — בלי שינוי לוגיקה. שני סוכנים אישרו כל פריט.

| # | פעולה | קובץ | אומדן רווח | מקור |
|---|---|---|---|---|
| 1 | קובץ `_headers` ב-root — Cache-Control מדויק (HTML+SW=`no-cache`, SVG/JPG=long-cache, CSP headers בסיסי) | חדש: `_headers` | חוסך stale HTML אחרי deploy + מהיר יותר ב-repeat visits | Cloudflare |
| 2 | קובץ `_routes.json` — `include:["/api/*"]`, `exclude:[]` — לא מבזבז quota של Pages Functions על קבצים סטטיים | חדש: `_routes.json` | חוסך billing | Cloudflare |
| 3 | `<link rel="preconnect">` ל-Supabase + `fonts.googleapis.com` + `fonts.gstatic.com` | `index.html:14` | -150 עד -300ms בקריאה ראשונה ל-API | Vanilla-JS + Codebase |
| 4 | `defer` ל-supabase-js SDK | `index.html:16` | -150ms blocking parse | Codebase H7 |
| 5 | `content-visibility:auto; contain-intrinsic-size:0 48px` על `.tbl-wrap tbody tr` | `index.html` style block | INP ↓ ברשימת NCR/EQI/Tasks; אוטומטי לטבלאות עתידיות | Vanilla-JS #2 |
| 6 | `loading="lazy"` על כל `<img>` בטבלאות | `index.html` | חוסך bandwidth ראשוני | Codebase quick-win #9 |
| 7 | `{passive:true}` בכל ה-listeners של scroll/touch (lines ~2740, 10543) | `index.html` | iOS scroll smoothness | Codebase H9 + Vanilla-JS |
| 8 | אישור ב-Cloudflare Dashboard: Brotli ON · HTTP/3 ON · 0-RTT ON · Early Hints ON | (UI) | LCP ↓ | Cloudflare |
| 9 | הוספת אייקוני PWA 192 + 512 PNG ל-manifest | חדש | Lighthouse PWA installability | Cloudflare gap #7 |

**Smoke check**: רענן עמוד 5 פעמים — ה-HTML חוזר מ-network, הצבעים/SVG/לוגו מהcache.

### תוכן `_headers` מומלץ

```
/*
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(self), microphone=(), geolocation=(self)

/index.html
  Cache-Control: no-cache, must-revalidate

/
  Cache-Control: no-cache, must-revalidate

/sw.js
  Cache-Control: no-cache, must-revalidate

/manifest.webmanifest
  Cache-Control: public, max-age=300

/icon.svg
  Cache-Control: public, max-age=86400
/logo.jpg
  Cache-Control: public, max-age=86400
```

### תוכן `_routes.json` מומלץ

```json
{
  "version": 1,
  "include": ["/api/*"],
  "exclude": []
}
```

---

## פאזה 2 — Surgical JS hardening (4-6 PRs)

שינויים קטנים בקוד, סיכון נמוך, ROI גבוה. רוב הפריטים מופיעים אצל 2 סוכנים.

| # | פעולה | קובץ:שורה | רווח | סיכון |
|---|---|---|---|---|
| 1 | Helper משותף `window._deb=function(fn,ms){var t;return function(){clearTimeout(t);var a=arguments,th=this;t=setTimeout(function(){fn.apply(th,a);},ms);};};` | `index.html` near top | תשתית | 0 |
| 2 | Debounce 120-180ms על כל ה-search inputs: `eqiSearch`, `tskSearch`, `_gsearchRender`, `_srRun`, `_modulesSheetFilter`, `hearing-search` | lines 654, 856, 1209, 1396, 2041, 10408 | INP ↓ × 6 | 0 |
| 3 | Memoize `_locName` / `_prjName` / `_itypeName` ב-`Map`, invalidate ב-`_rtApply` כשהטבלה הרלוונטית משתנה | `index.html:7226` ועוד | חוסך 20-60ms לרינדור עם 100+ מיקומים | 0 |
| 4 | Guard `rDash()` בכל `sv*` handler: `if(CUR==='dash')rDash();` | ~15 places (e.g. 4779) | חוסך re-renders מיותרים | 0 |
| 5 | `priority:'low'` על `sbGet` בקריאות רקע (audit_log, history, _sbRefresh) | `index.html:2211, 2237, 2243` | INP ↓ תחת sync | 0 |
| 6 | הוצא `audit_log` / `notifications_log` / `hist` מ-`sdb()` לפני `JSON.stringify` | `index.html:2200` | חוסך 50-80% מגודל ה-blob | 0 |
| 7 | Cap `DB.audit_log` ל-200 שורות ב-`_rtApply` (כמו `DB.hist` כבר עכשיו) | `index.html:2199` | חוסך זיכרון + serialize time | 0 |
| 8 | החלף `_srRun`'s `JSON.stringify(x).toLowerCase()` ב-pre-computed haystack שמתחבא על property non-enumerable | `index.html:10427` | x10 שיפור בחיפוש גלובלי | 0 |
| 9 | Debounce `sdb()` ב-rAF/500ms idle (שמירה אחת אחרי burst) | `index.html:2200` | חוסך 30-80ms בכל realtime burst | low |

---

## פאזה 3 — Service Worker rewrite (1 PR גדול, נשלח עם feature flag)

הצלבת 3 סוכנים (SW + Codebase H6 + Cloudflare gap #8): הפתרון לבעיית ה-iOS-stale שאיבדה 5 שעות.

### השינויים:

```js
// sw.js — top
const BUILD = '__BUILD__';   // החלף ב-CI לפי git short-sha
const CACHE = `tfgn-${BUILD}`;
```

```js
// index.html — register
navigator.serviceWorker.register('/sw.js?v='+BUILD).then(reg=>{
  setInterval(()=>reg.update(), 60*60*1000); // hourly check
  reg.addEventListener('updatefound', ()=>{
    var nw=reg.installing;
    nw && nw.addEventListener('statechange', ()=>{
      if(nw.state==='installed' && navigator.serviceWorker.controller){
        // לא reload אוטומטי — toast עם כפתור
        toast('🔄 גרסה חדשה זמינה — לחץ לרענון', 0, ()=>location.reload());
      }
    });
  });
});
```

**מה נפתר**:
- אין יותר bumping ידני של `tfgn-vNN`
- אין יותר iOS Safari stuck on stale code (update() כל שעה במקום פעם ב-24h)
- אין יותר reload אוטומטי באמצע מילוי NCR

**Build hash injection**: שתי אופציות —
(א) Cloudflare Pages function שמחזירה את `BUILD_ID` ושמחליפה במקום
(ב) git pre-commit hook שעושה `sed -i "s/__BUILD__/$(git rev-parse --short HEAD)/" sw.js`

עדיפות ל-(א) — לא דורש changes ל-developer workflow.

**Rollback**: feature flag ב-`_appPrefs.swAutoUpdate=false` חוזר להתנהגות הישנה.

---

## פאזה 4 — Backend RLS perf (1 SQL migration, נדרשת הרצה ידנית)

הצלבת Supabase agent (top action #1) + Codebase audit: עד **100× שיפור** על טבלאות גדולות.

```sql
-- migrations/2026-05-04_rls_perf_wrap.sql
-- עוטף כל is_admin_manager() ב-(select ...) → init plan, פונקציה רצה פעם אחת לכל query
-- במקום לכל row.

DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT schemaname, tablename, policyname, qual, with_check
           FROM pg_policies
           WHERE schemaname='public' AND (qual LIKE '%is_admin_manager()%' OR with_check LIKE '%is_admin_manager()%')
  LOOP
    EXECUTE format('ALTER POLICY %I ON %I.%I USING ((select is_admin_manager())) WITH CHECK ((select is_admin_manager()))',
                   r.policyname, r.schemaname, r.tablename);
  END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';
```

### + event-trigger ל-NOTIFY pgrst אוטומטי

מונע PGRST204 אחרי DDL:

```sql
CREATE OR REPLACE FUNCTION public.pgrst_watch() RETURNS event_trigger AS $$
BEGIN NOTIFY pgrst, 'reload schema'; END;
$$ LANGUAGE plpgsql;
DROP EVENT TRIGGER IF EXISTS pgrst_watch;
CREATE EVENT TRIGGER pgrst_watch ON ddl_command_end EXECUTE FUNCTION public.pgrst_watch();
```

**אימות אחרי הרצה**: בדיקת query על `ncr` עם 375 שורות — צריך להיות מהיר במידה ניכרת. אין שינוי תוצאות.

---

## פאזה 5 — Sync + Realtime tame (2-3 PRs מבוקרים)

הצלבת Supabase agent #2/#3 + Codebase H2/H8: תפסיק לקבץ 35 round-trips כל 2 דקות.

| פעולה | מה זה עושה | סיכון |
|---|---|---|
| הוסף `_sbCols[tbl]` map עם רשימת עמודות לטבלאות החמות (NCR, audit_log, ncr_ai). `sbGet(tbl)` בונה `select=` מהמפה, fallback ל-`*` | חוסך 60-80% מ-payload בטבלאות הגדולות | low — חייב לכלול את כל העמודות שה-UI נוגע בהן. הולכים טבלה-טבלה. |
| מתח את ה-poll מ-2 דקות ל-10 דקות (`setInterval` ב-`index.html:2314`) — Realtime כבר מכסה | -83% בקשות REST | low — Realtime במצב SUBSCRIBED |
| Debounce `_rtApply` ב-rAF: אסוף events ל-Set, קרא `sdb()` + `_sbRefresh(true)` פעם אחת לכל animation frame | חוסך re-renders בvolume bursts | low |
| Server-side filter על channels רועשים (`audit_log`, `notifications_log`): `filter:'user_email=eq.<me>'` | פחות events לעיבוד | low |
| אם `CUR!=='dash'` — דלג על `_sbRefresh` בעקבות שינוי בטבלה שלא רלוונטית לעמוד הנוכחי | חוסך עוד re-renders | low |

---

## פאזה 6 — Edge function hardening (1 PR קטן)

הצלבת Cloudflare agent #5/#6: סוף סוף סוגר את ה-524 בקבצי PDF גדולים.

```js
// functions/api/claude.js — wrap upstream stream with keepalive
const enc = new TextEncoder();
const { readable, writable } = new TransformStream();
const writer = writable.getWriter();
let lastChunkAt = Date.now();

const ping = setInterval(()=>{
  if(Date.now()-lastChunkAt > 14000) writer.write(enc.encode(': keepalive\n\n'));
}, 5000);

(async ()=>{
  try{
    const reader = upstream.body.getReader();
    while(true){
      const {done,value} = await reader.read();
      if(done) break;
      lastChunkAt = Date.now();
      await writer.write(value);
    }
  } finally {
    clearInterval(ping);
    writer.close();
  }
})();

return new Response(readable, { headers: sseHeaders });
```

**+ Storage upload `cacheControl: '31536000'`** במקומות שמעלים קובץ ל-Supabase Storage (חיפוש ל-`storage.from(`).

---

## פאזה 7 — Bigger refactors (אופציונליים, רק אם נדרש)

| רעיון | מתי לעשות | סיכון |
|---|---|---|
| `CompressionStream('gzip')` על `tfgn2` localStorage עם backward-read | אם מקבלים QuotaExceededError | medium |
| Incremental sync: `?ts=gt.<lastTs>&limit=500` | אם הטבלה הכי גדולה עוברת 5000 שורות | medium — צריך טיפול ב-deletes |
| Index-by-id maps לטבלאות חמות (`DB.ncr_byId`) | אם רואים `Array.find` חם בפרופיל | medium |
| Event delegation במקום 481 inline `onclick=` | בהדרגה, תוך כדי עבודה אחרת | low (רק אזורים שאתה כבר נוגע בהם) |

---

## הצלבת ממצאים — מה דחוף לפי כמה סוכנים אמרו

| ממצא | Codebase | Supabase | Cloudflare | SW | Vanilla-JS |
|---|:-:|:-:|:-:|:-:|:-:|
| `_headers` Cache-Control | | | ✓ | ✓ | |
| SW auto-version (kill manual bump) | ✓ | | ✓ | ✓ | |
| `select=*` → column projection | ✓ | ✓ | | | |
| Realtime debounce + filter | ✓ | ✓ | | | |
| Search debounce | ✓ | | | | ✓ |
| Memoize `_locName` | ✓ | | | | |
| `{passive:true}` listeners | ✓ | | | | ✓ |
| `<link rel="preconnect">` | ✓ | | | | ✓ |
| `defer` Supabase SDK | ✓ | | | | |
| `content-visibility:auto` | | | | | ✓ |
| SSE keepalive (524 fix) | | | ✓ | | |
| Storage `cacheControl` | | ✓ | | | |
| RLS `(select fn())` | | ✓ | | | |
| Drop log tables from `sdb()` | ✓ | | | | |
| Skip `rDash()` when not on dash | ✓ | | | | |
| Web Vitals RUM | | | ✓ | | ✓ |

---

## מה לא עושים (אישור בין-סוכני)

- **React/Preact/Vue** — נוגד CLAUDE.md, ידרוש build step
- **Workbox** — עודף עבור 53 שורות SW עם בעיה אחת ספציפית שאפשר לתקן
- **Bundler/minifier** — נוגד CLAUDE.md; Brotli של Cloudflare כבר נותן 70%+ בלי שינוי workflow
- **Background Sync** — לא נתמך ב-iOS Safari (חצי מהמשתמשים)
- **Cloudflare Argo/Smart Routing** — לא מצדיק עבור קהל single-region
- **R2 + presigned URLs** במקום Supabase Storage — רק אם עלות egress הופכת בעיה (לא היום)
- **Web Workers** — אין משימה היום שמצדיקה (כל ה-DB.X arrays מתחת ל-1k שורות)
- **Virtual scrolling library** — `content-visibility:auto` נותן 90% מהרווח עם 10% מהמורכבות
- **רישינג 481 `onclick=` במכת רוח אחת** — אופורטוניסטית כשנוגעים ב-renderer בכל מקרה

---

## הצעת סדר ביצוע מומלץ

**שבוע ראשון:**
- פאזה 0 (instrumentation) — PR אחד
- פאזה 1 (quick wins) — 4-5 PRs ברצף
- מדידה: השווה Web Vitals לפני/אחרי

**שבוע שני:**
- פאזה 2 (surgical JS) — 6 PRs מבוקרים
- פאזה 6 (Edge hardening) — PR אחד קטן
- מדידה: INP אחרי דיבאונס + memoize

**שבוע שלישי:**
- פאזה 3 (SW rewrite) — 1 PR עם feature flag, מנוטר ידנית 48 שעות
- פאזה 4 (RLS migration) — SQL ידני ב-Supabase + אימות
- מדידה: זמן query ל-NCR list

**שבוע רביעי:**
- פאזה 5 (sync rewrite) — 2-3 PRs מבוקרים, 1 טבלה בפעם
- מדידה: בקשות REST למינוטה לפני/אחרי

**פאזה 7** — רק אם המדידות מצביעות עליה.

---

## מקורות מחקר (נבדק 2026-05-04)

### Cloudflare Pages
- [Pages Headers configuration](https://developers.cloudflare.com/pages/configuration/headers/)
- [Pages Functions Routing (`_routes.json`)](https://developers.cloudflare.com/pages/functions/routing/)
- [Eliminating cold starts with Workers](https://blog.cloudflare.com/eliminating-cold-starts-with-cloudflare-workers/)
- [Agents HTTP/SSE](https://developers.cloudflare.com/agents/api-reference/http-sse/)
- [Error 524 docs](https://developers.cloudflare.com/support/troubleshooting/http-status-codes/cloudflare-5xx-errors/error-524/)

### Supabase
- [RLS Performance and Best Practices](https://supabase.com/docs/guides/troubleshooting/rls-performance-and-best-practices-Z5Jjwv)
- [Realtime Limits](https://supabase.com/docs/guides/realtime/limits)
- [Smart CDN](https://supabase.com/docs/guides/storage/cdn/smart-cdn)
- [Refresh PostgREST schema cache](https://supabase.com/docs/guides/troubleshooting/refresh-postgrest-schema)
- [Optimizing RLS — AntStack](https://medium.com/@antstack/optimizing-rls-performance-with-supabase-postgres-fa4e2b6e196d)

### PWA / Service Worker
- [web.dev — Stale-while-revalidate](https://web.dev/articles/stale-while-revalidate)
- [iOS web app cache trap (2026)](https://mbhasin.com/blog/2026/caching-problems-and-solutions)
- [PWA iOS limitations 2026](https://www.magicbell.com/blog/pwa-ios-limitations-safari-support-complete-guide)
- [Vite PWA — Periodic SW updates](https://vite-pwa-org.netlify.app/guide/periodic-sw-updates)

### Vanilla JS performance
- [web.dev — Web Vitals](https://web.dev/articles/vitals)
- [patterns.dev — List Virtualization](https://www.patterns.dev/vanilla/virtual-lists/)
- [web.dev — Compression Streams everywhere](https://web.dev/blog/compressionstreams)
- [web.dev — Fetch Priority](https://web.dev/articles/fetch-priority)
- [Brian Grinstead — Web Workers without a JS file](https://briangrinstead.com/blog/load-web-workers-without-a-javascript-file/)
