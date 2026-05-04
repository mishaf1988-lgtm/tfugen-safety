# Tapugan Safety — STATUS

> מצב הפרויקט. מתעדכן אחרי כל משימה. Claude: קרא **קודם** את `CLAUDE.md`, ואז את הקובץ הזה.

**Last updated**: 2026-05-04 (Performance Phase 0+1+2+3lite+4+5(3/5)+6 shipped · 18 PRs · web-vitals · debounce · memoize · Cache-Control · SSE keepalive · Storage cacheControl · RLS perf wrap (initPlan) · poll 2→10min · per-page render-skip · rAF debounce realtime · hourly SW update + soft pill · plan in project-files/PERFORMANCE-PLAN-2026-05-04.md)
**Repo**: `mishaf1988-lgtm/tfugen-safety`

## 🌐 שרת

| תפקיד | URL | סטטוס |
|---|---|---|
| **Production (Cloudflare Pages, sole)** | 🟢 https://tapugan-safety.pages.dev | פעיל יחיד. WhatsApp templates עודכנו, `/api/*` של Vercel נמחק מה-repo, vercel.json הוסר. ניתן למחוק את פרוייקט ה-Vercel מה-dashboard ידנית. |

---

## 🔖 Last Known Good

| שדה | ערך |
|---|---|
| Commit | `f59541f` |
| תאריך | 2026-05-04 |
| Tag | — (טרם נוצר) |
| מצב | פאזות 0+1+2+3lite+4+5(3/5)+6 של תוכנית הביצועים שלמות · web-vitals + `_perf` + error capture · preconnect ל-Supabase/Fonts · `_headers` + `_routes.json` · `defer` SDK + `content-visibility` · `loading="lazy"` + `{passive:true}` · `_deb` + 6 search debounces · memoize שמות · `sdb` cleanup + cap log tables · split `_dashBadges` + guard `rDash` · `priority:'low'` ב-fetch · debounce `sdb` עם flush ב-unload · `_hayFor` haystack ב-`_srRun` · SSE keepalive ב-claude.js · Storage `cache-control: max-age=31536000` · RLS perf wrap (initPlan, ~100×) · poll 2→10min · per-page render-skip · rAF debounce realtime · hourly SW update + soft 'new version' pill · 28 טבלאות · Saved Views · Notifications matrix · Location filters · Chained forms · Dashboard widgets · NCR Agent feedback loop · Reopen flow · Smart Capture · RLS Stage 1+2 פעיל · m-modules-vis settings panel |

---

## ✅ הושלם

- [x] Supabase sync — 17 טבלאות מחזירות 200 OK (+ `ncr_ai` טבלה 18)
- [x] 375 רשומות NCR הועלו
- [x] **Expiries Agent** (PR #4) — דף `pg-exp` מאוחד + התראות dashboard משודרגות
- [x] **Skill `tfugen-dev`** — אכיפת חוקי פיתוח אוטומטית
- [x] **תשתית סנכרון** — CLAUDE.md + DECISIONS.md
- [x] **NCR Agent v4** (PR הנוכחי, 5a) — prompt ISO 45001/14001, שמירה ל-`ncr_ai`, badge עם version, aggregate על פתוחים בלבד (150)
- [x] **NCR Agent Accept & Apply** (PR 5b) — כפתור "החל ניתוח על ה-NCR" שמזרים `rc/c/o/u` מ-`ncr_ai` ל-`ncr` + זיהוי אוטומטי של מצב "הוחל"
- [x] ~~**Dashboard 2.0 — Phase A**~~ — הוסר ב-2026-04-19 לפי החלטת המשתמש. KPI tiles + alerts נשארו.
- [x] **Outbox cloud sync** — `sbIns/sbUpd/sbDel` עברו ל-queue ב-localStorage עם retry אוטומטי (online/focus/30s). תיקן באג קריטי: `sbUpd` כלל לא היה מוגדר → UPDATEs של NCR ו-equip_inspections לא נשמרו בענן. Badge ב-topbar מראה פעולות ממתינות.
- [x] **Outbox hardening (hotfix)** — תיקון 3 באגים שגרמו לנתונים להיעלם אחרי רענון: (1) `ldb()` לא שחזרה `equip_inspections` מ-localStorage, (2) שגיאות 4xx (כולל 404 "טבלה לא קיימת") נמחקו מהתור בשקט, (3) `sbSync` יכלה לדרוס נתונים מקומיים כשהטבלה בענן ריקה. נוסף upsert (`resolution=merge-duplicates`), חלון אבחון בלחיצה על ה-pill, ו-skip לטבלאות עם פעולות ממתינות.
- [x] **Equipment Inspections** — דף `pg-eqi` + טבלה `equip_inspections` + ייבוא Excel/CSV + אינטגרציה עם Expiries Agent
- [x] **Near-Miss capture** — דף `pg-nm` + טבלה `near_miss` + KPI בdashboard + פילטר לפי סטטוס
- [x] **Morning Round** — דף `pg-round` + טבלה `rounds` + checklist יומי (6 פריטים) + התראה בdashboard + KPI
- [x] **QR Stage A — Employee UI** — דף `pg-emp-home` עם 4 כפתורים גדולים (קרוב לתאונה / תקלה בציוד / סבב בוקר / דיווח הדרכה). נכנסים ב-`?emp=1`, יוצאים דרך כפתור "עבור למימשק המלא". לא נוגע במודאלים/שמירות הקיימות.
- [x] **QR Stage A polish** (PRs #29-31) — כפתור toggle למצב עובד ב-topbar, כפתור "דיווח מהיר" במסך login, תיקון סנכרון ל-emp-session (SB_ON לא היה נדלק).
- [x] **Photo/file upload** (PRs #32-34, #36, #39-41) — העלאה לכל טפסי הדיווח (near-miss, EQI, incidents, training). דחיסת תמונות לצד לקוח, תמיכה ב-PDF/Word/Excel. גלריה + מצלמה במובייל. חסימת שמירה תוך כדי העלאה. שגיאות מוצגות בתוך תיבת הצירוף.
- [x] **Realtime cross-device sync** (PR #35) — `supabase-js` + `postgres_changes` WebSocket. שינוי במכשיר אחד מופיע בכולם תוך פחות משנייה. Polling יורד ל-2 דקות כ-safety net.
- [x] **View + PDF per report** (PRs #37, #42-43) — כפתורי 👁 ו-🖨 PDF לדיווחי near-miss / rounds / equipment. הדפסה מציגה תמונה גדולה.
- [x] **Phase C — Tasks module (CAPA follow-up)** — דף `pg-tasks` + טבלה `tasks` + מודאל יצירה/עריכה (8 שדות) + KPI בדשבורד (פתוחות + בפיגור) + alert אדום כשיש משימות פג-יעד. VIEW_CONFIG, PDF ref prefix `TSK`, סינון (הכל/פתוחות/בהתקדמות/פג יעד/הושלמו).
- [x] **Phase C.1 — Virtual tasks (auto-derived)** — דף המשימות מציג אוטומטית גם: NCR פתוחים/בטיפול, תקריות פתוחות, near-miss פתוחים, ופריטים שפג תוקפם (PPE/הדרכה/מסמכים/קבלנים/בדיקות ציוד). שורות וירטואליות מסומנות "(אוטומטי)", יש להן רק 👁 (צפייה במקור) ו-➕ (הפוך למשימה עצמאית — פתיחה של המודאל עם הכל מוכן). אם יצרת ידנית משימה עם source_table+source_id התואמים — הוירטואלית לא תוצג (מניעת כפילות).
- [x] **NCR Agent — Feedback Loop (👍/👎/🔄)** — בהשראת Vitre §9.2. כל ניתוח AI ב-`ncr_ai` מקבל 3 כפתורים: 👍/👎 (toggle, אופטימי, rollback בשגיאה) ו-🔄 (יצירת ניתוח מחדש = גרסה חדשה). הכפתור הפעיל מודגש בצבע + שורה "משוב על ידי X" מתחת. Migration `2026-04-30_ncr_ai_feedback.sql` הורץ ידנית (3 עמודות חדשות + CHECK constraint). אומת ידנית 30/4: NCR-0357 קיבל feedback='up' עם feedback_user='admin'. בנה dataset של ניתוחים מדורגים לכוונון prompt בעתיד.
- [x] **Reopen flow על Task/NCR סגורים** — בהשראת Vitre §10.2. כשפותחים `showView` עבור task ב-`הושלם`/`בוטל` או NCR ב-`סגור`, מופיע כפתור 🔓 "פתח מחדש". בלחיצה: prompt לסיבה (חובה) → סטטוס חוזר ל-`פתוח`, `closed_date`/`cd` מתאפסים, ו-stamp מצורף ל-`notes` בפורמט `[נפתח מחדש YYYY-MM-DD על ידי USER: REASON]`. ללא migration — משתמש בעמודות קיימות. אין hooks ל-audit_log עדיין (נשמר ל-PR נפרד).
- [x] **Bulk actions על דף משימות** — בהשראת Vitre §14.2. checkbox column בכל שורה (לא וירטואליים) + select-all בכותרת. כשנבחרת לפחות אחת — sticky bar בתחתית הדף עם 3 כפתורים: "סגור הכל" (סטטוס=הושלם + closed_date היום), "בטל הכל" (סטטוס=בוטל), "נקה בחירה". האקציה רצה על כל ה-IDs דרך `sbUpd` עם confirm + toast. שינוי filter מנקה את הבחירה. ללא migration. שורות וירטואליות (NCR/inc/expired) נמנעות כי הן לא קיימות ב-`DB.tasks`.
- [x] **Sub-tasks (parent_id) על משימות** — בהשראת Vitre §16#4. עמודה חדשה `parent_id text` ב-`tasks` (migration `2026-04-30_tasks_parent.sql` + index חלקי). UI: dropdown "↳ משימה אב (אופציונלי)" במודאל יצירה/עריכה, שמכיל את כל המשימות הקיימות (פרט לזו הנערכת). תצוגה: badge "↳ <כותרת אב>" בראש כל שורת sub-task ברשימה. שמירה ב-`svTsk` כולל validation שמונעת self-parent. תאימות מלאה לאחור — שורות בלי `parent_id` נראות בדיוק כמו לפני.
- [x] **Sensitivity flag (sens) על NCR** — בהשראת Vitre §16#16. עמודה `sens boolean DEFAULT false` ב-`ncr` (migration `2026-04-30_ncr_sensitivity.sql` + partial index). UI: checkbox "🔒 רגיש (נראה לאדמין בלבד)" במודאל; badge 🔒 ליד מספר ה-NCR ברשימה. Gating: `rNcr` מסנן רשומות רגישות ל-non-admin, `editNcr`/`showView` חוסמים גישה ישירה, `_ncrLoad` (NCR Agent) מסנן גם. הגנה ברמת UI בלבד כרגע — RLS אמיתי יכול להוסיף בעתיד עם תנאי על ה-policy `ncr_admin_manager_all`.
- [x] **NCR Agent — 3 bug fixes קודמים שזוהו תוך הפיתוח** —
  1. **JWT auth**: 5 fetch calls השתמשו ב-`Bearer _SK` (publishable key) במקום `Bearer _sbToken` (JWT של admin). אחרי RLS Stage 2, זה החזיר 0 שורות במקום 375. תוקן עם `(_sbToken||_SK)`.
  2. **CORS preview origins**: `api/claude.js` חסם 403 כל preview deployment. נוסף regex `^https://tfugen-safety-[a-z0-9-]+-mishaf1988-lgtms-projects\.vercel\.app$` שמתיר רק previews של ה-team הזה.
  3. **max_tokens**: היה 900 → תשובות עברית נחתכו באמצע JSON (`Unterminated string at position 1347`). הועלה ל-1200.
- [x] **Smart Capture — דיווח בקול/תמונה/טקסט** — FAB סגול בצד שמאל-תחתון (✨). לחיצה פותחת מודאל עם 3 מצבים: 🎤 דבר (Web Speech API בעברית) / 📷 צלם (Claude Vision מנתח תמונה) / ✍ הקלד. ה-AI מזהה את סוג הדיווח (nm/inc/ncr/eqi/ppe/tr) ופותח את הטופס הנכון עם כל השדות מוכנים (תיאור, אזור, חומרה, מדווח, תאריך, תמונה). ה-endpoint `/api/claude` הועלה ל-300KB body limit כדי לאפשר תמונות base64.
- [x] **Fixes** — rename "משימות" → "משימות ומעקב" (5 מקומות), Phase B export toolbar wipe-then-insert (הורג כפילויות), מובייל thead `display:none` (נקי יותר מ-off-screen), data-label על כל td של משימות לתצוגת כרטיס תקנית במובייל.

---

## 📋 תור משימות

### 🔴 עדיפות גבוהה
- [x] ~~**🚨 אבטחה — RLS Stage 1: סגירת anonymous access**~~ — **הורץ ואומת ידנית ב-2026-04-24**. הוסרו 9 פוליסות `open USING true` (auds/docs/emp/files/hist/inc/ncr/rsk/tr), נוספה `public.is_admin_manager()` helper, הוגדרו policies ל-`files`+`hist`, ו-`app_users_read` הוגבל ל-`TO authenticated`. אומת ב-4 שאילתות Supabase (0 open, רק authenticated USING true, פונקציה קיימת, files/hist מוגנות) ובבדיקות UI (admin עם 375 NCRs, 7 דפים, emp-mode + דיווח near_miss, אין 401/403). PR #84. תוכנן לפי חוות דעת יועץ חיצוני — גישה בשלבים (לא all-in-one).
- [x] ~~**🚨 אבטחה — RLS Stage 2: החלפת 22 פוליסות `admin_all`**~~ — **הורץ ואומת ידנית ב-2026-04-24**. כל 22 הפוליסות `admin_all` (`is_anonymous=false`) נמחקו והוחלפו ב-`<table>_admin_manager_all` עם `public.is_admin_manager()`. אומת ב-3 שאילתות Supabase: (1) `COUNT admin_all = 0`, (2) 25 שורות `_admin_manager_all` (22 חדשות + tasks + files + hist), (3) `0 leftover_is_anonymous`. user1..user10 עם role=מדווח כעת חסומים מ-REST על 22 הטבלאות; admin + role=אדמין/מנהל יש להם CRUD מלא. emp_insert על 4 טבלאות עדיין פעיל (יוקשח בשלב 3). PR #85.
- [x] ~~**🚨 אבטחה — RLS Stage 3: הקשחת `emp_insert`**~~ — **נדחה ב-2026-04-24, לא נדרש כרגע**. המצב הנוכחי: `emp_insert` עם `WITH CHECK (true)` על 4 טבלאות — מאפשר INSERT חופשי לאנונימי. הסיכון נמוך: (1) רק INSERT (אין SELECT/UPDATE/DELETE), (2) admin יכול לנקות spam ב-CRUD, (3) הטבלאות מיועדות לדיווח חופשי. אם יזוהה spam בפועל — לפתוח שלב 3 אז עם `WITH CHECK` ספציפי לכל טבלה.
- [ ] **2c. NCR Agent — UX/Filter** (PR 5c) — filter לסגורים ברשימת ה-modal, הגדלת sample, aggregate על הכל עם chunking
- [ ] **3. Incident Investigation Agent** — 5 Whys אוטומטי + סיווג TRIR

### ⚠️ פעולה ידנית נדרשת
- [x] ~~**הרץ migration ב-Supabase**: `migrations/2026-04-18_ncr_ai.sql`~~ — **הורץ ואומת ידנית ב-2026-04-24**. הטבלה `ncr_ai` קיימת, 2 האינדקסים (`ncr_ai_ncr_id_idx`, `ncr_ai_ncr_id_version_idx`) קיימים, RLS disabled. אומת ב-Supabase (information_schema + pg_indexes + pg_class.relrowsecurity) ובבדיקה חיה — NCR Agent שומר ניתוחים בלי שגיאה.
- [x] ~~**הרץ migration ב-Supabase**: `migrations/2026-04-18_equip_inspections.sql`~~ — **הורץ ואומת ידנית ב-2026-04-24**. הטבלה `equip_inspections` קיימת, 2 האינדקסים (`equip_inspections_e_idx`, `equip_inspections_code_idx`) קיימים, RLS disabled. אומת ב-Supabase ובבדיקה חיה — דף בדיקות ציוד נטען ללא שגיאות.
- [x] ~~**הרץ migration ב-Supabase**: `migrations/2026-04-21_tasks.sql` + `migrations/2026-04-24_tasks_rls.sql`~~ — **הורצו ואומתו ידנית ב-2026-04-24**. הטבלה `tasks` נוצרה עם 10 עמודות ו-3 אינדקסים (`tasks_due_idx`, `tasks_status_idx`, `tasks_source_idx`). RLS מופעל עם policy יחיד `tasks_admin_manager_all` — רק `admin@tfugen.local` או משתמשים עם `role='אדמין'`/`role='מנהל'` מקבלים CRUD מלא. אומת ב-Supabase (pg_policy + pg_class) ובבדיקה חיה — admin יצר משימה חדשה ב-UI, המשימה שרדה רענון, outbox נשאר נקי.
- [x] ~~**הרץ migration ב-Supabase**: `migrations/2026-04-22_app_users.sql`~~ — טבלת `app_users` פעילה, 10 placeholders קיימים, RLS פעיל. דף ניהול משתמשים עובד בפרודקשן.
- [x] ~~**צור 10 משתמשי Supabase Auth ידנית**~~ — user1@tfugen.local עד user10@tfugen.local נוצרו, סיסמאות Aa000001! עד Aa000010!. אומת ע״י כניסה ישירה למערכת.
- [x] ~~**הרץ migration ב-Supabase**: `migrations/2026-04-22_ncr_columns.sql`~~ — הוסיף עמודות `cd`, `sd`, `loc`, `root_cause`, `immediate` לטבלת `ncr`. הורץ בתגובה לשגיאת `PGRST204 Could not find the 'cd' column` — ה-outbox התנקה מייד לאחר מכן.
- [x] ~~**🔒 קריטי — הרץ migration ב-Supabase**: `migrations/2026-04-23_app_users_admin_only_rls.sql`~~ — **הורץ ב-2026-04-24 ואומת ידנית**. ה-policy `app_users_admin_write` נעולה ל-`auth.jwt() ->> 'email' = 'admin@tfugen.local'` בלבד (במקום `is_anonymous = false`). אומת ב-3 בדיקות: (1) admin ניהל משתמשים בהצלחה, (2) משתמש רגיל לא יכול לכתוב ל-`app_users`, (3) dropdown של מדווחים עדיין נטען כרגיל. חור האבטחה סגור.

### ⚠️ פעולה ידנית נדרשת (חדש)
- [x] ~~**הרץ migration ב-Supabase**: `migrations/2026-04-30_tasks_parent.sql`~~ — **הורץ ואומת ידנית ב-2026-04-30**. עמודה `parent_id text` ב-`tasks` + partial index `tasks_parent_id_idx` נוצרו. תומך ב-Sub-tasks. אומת ב-`information_schema.columns`.
- [ ] **הרץ migration ב-Supabase**: `migrations/2026-05-01_ncr_capa_verify.sql` — מוסיף 3 עמודות ל-`ncr` עבור CAPA Verification (`verified_by`, `verified_at`, `verification_notes`). ה-UI כבר מוכן.
- [ ] **הרץ migration ב-Supabase**: `migrations/2026-05-01_ncr_comments.sql` — טבלה חדשה `ncr_comments` (id, ncr_id, author, text, ts) + RLS policy admin/manager. ה-UI כבר מוכן (חלק "💬 הערות" ב-NCR view). בלי הרצה: ה-fetch ייכשל בשקט.
- [ ] **הרץ migration ב-Supabase**: `migrations/2026-04-30_ncr_patterns.sql` — טבלה חדשה `ncr_patterns` (history של ניתוחים מצטברים) + RLS policy `_admin_manager_all`. ה-UI כבר מוכן (auto-save + history list בסוכן). בלי הרצה: ה-POST ייכשל בשקט וההיסטוריה לא תיבנה.
- [x] ~~**הרץ migration ב-Supabase**: `migrations/2026-04-30_ncr_sensitivity.sql`~~ — **הורץ ואומת ידנית ב-2026-04-30**. עמודה `sens boolean DEFAULT false` ב-`ncr` + partial index `ncr_sens_idx WHERE sens=true` נוצרו. תומך ב-Sensitivity flag (UI gating ב-4 נקודות). אומת ב-`information_schema.columns`.
- [x] ~~**הרץ migration ב-Supabase**: `migrations/2026-05-01_env_aspects_file_url.sql`~~ — **הורץ ואומת ידנית ב-2026-05-01**. הוסיף `file_url text` ל-`env_aspects`. תומך בצירוף קובץ פר-היבט סביבתי (PR #139).
- [x] ~~**הרץ migration ב-Supabase**: `migrations/2026-05-01_page_files.sql`~~ — **הורץ ואומת ידנית ב-2026-05-01**. טבלה חדשה `page_files(id PK, file_url, file_name, uploaded_by, ts)` עם RLS `_admin_manager_all`. תומך בבאנר "קובץ רשמי לעמוד" (PR #140).
- [x] ~~**הרץ migration ב-Supabase**: `migrations/2026-05-01_locations.sql`~~ — **הורץ ואומת ידנית ב-2026-05-01**. טבלה חדשה `locations(id PK, name, parent_id → locations.id, level 1-3, notes, ts)` עם RLS + 2 indexes. בסיס ל-feature מיקומים היררכי (PR #141).
- [x] ~~**הרץ migration ב-Supabase**: `migrations/2026-05-01_location_fk.sql`~~ — **הורץ ואומת ידנית ב-2026-05-01**. הוסיף `location_id text REFERENCES locations(id) ON DELETE SET NULL` ל-`ncr` ו-`near_miss` + 2 indexes. PR #142.
- [x] ~~**הרץ migration ב-Supabase**: `migrations/2026-05-01_location_fk_more.sql`~~ — **הורץ ואומת ידנית ב-2026-05-01**. אותו דבר ל-`ptw`, `equip_inspections`, `hzm` + 3 indexes. PR #143.
- [x] ~~**הרץ migration ב-Supabase**: `migrations/2026-05-01_saved_views.sql`~~ — **הורץ ב-2026-05-01**. טבלה חדשה `saved_views(id, user_email, page_slug, name, filters jsonb, ts)` עם RLS לפי `auth.jwt()->>'email'`. PR #147.
- [x] ~~**הרץ migration ב-Supabase**: `migrations/2026-05-01_notification_prefs.sql`~~ — **הורץ ב-2026-05-01**. טבלה חדשה `notification_prefs(id PK = email, prefs jsonb, ts)` עם RLS לפי email. PR #148.
- [x] ~~**הרץ ה-COMBINED SQL ב-Supabase**: `migrations/2026-05-02_OVERNIGHT_COMBINED.sql`~~ — **הורץ ידנית 2026-05-02**. כולל: location_id ל-inc/hearing_tests, custom_props, projects, project_id FK ל-ncr/tasks/inc, notifications_log, inspection_types.
- [x] ~~**הרץ ה-COMBINED SQL ב-Supabase**: `migrations/2026-05-02_MORNING_COMBINED.sql`~~ — **הורץ ידנית 2026-05-02**. כולל: issue_types schema + issue_type_id ב-ncr/inc + 30 issue_types seeds + 15 inspection_types seeds.
- [x] ~~**הרץ migration ב-Supabase**: `migrations/2026-04-30_external_ids.sql`~~ — **הורץ ואומת ידנית ב-2026-04-30**. 7 עמודות `ext_id text` נוספו (ncr, equip_inspections, emp, tr, ppe, med, tasks) + 7 partial indexes. אומת ב-`information_schema.columns` (7 שורות) ו-`pg_indexes` (7 idx). הכנה לאינטגרציות עתידיות ERP/SAP/payroll. Vitre §16#13.
- [x] ~~**הרץ migration ב-Supabase**: `migrations/2026-04-30_ncr_ai_feedback.sql`~~ — **הורץ ואומת ידנית ב-2026-04-30**. הוסיף 3 עמודות ל-`ncr_ai`: `feedback` (text, CHECK 'up'/'down'/null), `feedback_user` (text), `feedback_ts` (timestamptz). אומת בשאילתת `information_schema.columns` (3 עמודות חדשות) + בדיקה חיה (NCR-0357 קיבל `feedback='up'` עם `feedback_user='admin'`).
- [x] ~~**🚨 קריטי — הרץ migration ב-Supabase**: `migrations/2026-04-25_enable_rls_missing.sql`~~ — **הורץ ואומת ידנית ב-2026-04-27**. Supabase Security Advisor סימן 4 שגיאות (Policy Exists RLS Disabled + RLS Disabled in Public על `equip_inspections` ו-`ncr_ai`) — הפוליסות `_admin_manager_all` קיימות מ-Stage 2, אבל RLS לא הופעל ברמת הטבלה. אחרי הרצת 2 שורות `ALTER TABLE ... ENABLE ROW LEVEL SECURITY`: (1) Security Advisor מראה **0 errors** (37 warnings נותרו, לא קריטיים), (2) דף בדיקות ציוד נטען עם רשומות, (3) NCR Agent רץ ושומר ניתוחים.
- [x] ~~`migrations/2026-04-19_near_miss.sql`~~ — הורץ
- [x] ~~`migrations/2026-04-19_rounds.sql`~~ — הורץ
- [x] ~~`migrations/2026-04-19_photo_url.sql`~~ — הורץ
- [x] ~~`migrations/2026-04-19_inc_tr_file_url.sql`~~ — הורץ
- [x] ~~`migrations/2026-04-19_realtime_publication.sql`~~ — הורץ
- [x] ~~Storage bucket `incidents-photos` + INSERT policy לאנונימי~~ — הוגדר

### 🟡 תוספות ISO 14001/45001 (יומיומי)
- [x] **Toolbox Talks** — תיעוד שיחות בטיחות יומיות. **פעיל מלא**: `pg-toolbox` page, `m-toolbox` modal עם file attach, `rToolbox`/`svToolbox`, VIEW_CONFIG, sheet button, migration `2026-04-24_toolbox.sql` הורץ. אומת 30/4: טבלת `toolbox` קיימת עם רשומה.
- [ ] **Legal Register** — חוקים + סקירות תקופתיות (14001)
- [x] **Management Review Dashboard** — דף `pg-mr` admin-only עם KPI לסקירה רבעונית (ISO 45001:9.3, 14001:9.3). אוטומטית מזהה רבעון נוכחי. 3 קבוצות KPI: snapshot כללי (NCR פתוחים, משימות בפיגור, תפוגות 30 יום, סבבי בוקר החודש), אירועי תקופה (NCR נפתחו/נסגרו, תקריות + ימי אבדן, near-miss), מדדי ציות (% הדרכות/מסמכים/ציוד תקפים + שיחות בטיחות). 2 לוחות: 5 NCR קריטיים פתוחים + 10 תפוגות קרובות. ניתן להדפיס ל-PDF דרך כפתור 🖨 הקיים בtopbar. ניווט: מודולים → "הנהלה" → "סקירת הנהלה" (admin-only).
- [x] **CAPA Verification** — בהשראת ISO 45001:10.2 (אימות אפקטיביות פעולות מתקנות). מיגרציה `2026-05-01_ncr_capa_verify.sql` הוסיפה 3 עמודות ל-`ncr`: `verified_by`, `verified_at`, `verification_notes`. ב-showView של NCR סגור: אם עברו 30+ יום מ-`cd` ועדיין לא אומת — admin רואה כפתור "✅ אמת אפקטיביות". prompt לתיאור → שמירה. אחרי אימות מוצג badge ירוק "✓ אומת על ידי X ב-DD/MM/YYYY". פחות מ-30 יום: כיתוב "אימות יהיה זמין בעוד N ימים".
- [x] **Risk Matrix 5×5** — בהשראת ISO 45001:6.1.2 (HIRA). טאב חדש בדף `pg-rsk` עם תצוגת מטריצה ויזואלית 5×5 (P × S). כל ריבוע צבוע לפי RPN: ירוק (1-4), צהוב (5-9), כתום (10-15), אדום (16-25). מספר הסיכונים בכל ריבוע + קליק → showView של הסיכון הראשון. legend בתחתית.
- [x] **Calendar View** — דף חדש `pg-cal` עם לוח שנה חודשי. נקודות צבעוניות פר-יום: 🔴 משימות, 🟡 תפוגות, 🟢 סבב בוקר, 🟣 ביקורות, 🔵 שיחות בטיחות. ניווט חודשים (◀ ▶ + "היום"). קליק על יום → רשימת פריטים מתחת עם קליק → showView. ניווט: מודולים → "הנהלה" → "לוח שנה".
- [x] **NCR Comments Thread** — חלק חדש ב-`showView` של NCR בלבד. טבלה חדשה `ncr_comments(id, ncr_id, author, text, ts)` + RLS policy admin/manager. UI: רשימת הערות (descending by ts) עם author + תאריך, ושדה הזנה + כפתור פרסם. נטען אוטומטית מ-Supabase כשפותחים NCR. ערך: שיחה מובנית בין מנהל בטיחות ובעל אזור על כל NCR בלי לשרוף את שדה `notes`. מיגרציה `2026-05-01_ncr_comments.sql` הורצה.
- [x] **Environmental Aspects (ISO 14001:6.1.2) — מותאם למתודולוגיה הרשמית של תפוגן** — דף `pg-easp` + טבלה `env_aspects` עם **כל 18 השדות** של הסקר הרשמי (טופס 28.01): aspect, activity (פעילות/מתקן), lifecycle (שלב במחזור חיים), control_type (שליטה/השפעה), direction (כיוון השפעה), impact, controls (בקרות קיימות), p_curr/sv_curr (דירוג בפועל), additional_controls (בקרות נוספות), p_pot/sv_pot (דירוג פוטנציאלי), status, owner, review_date, explanation, legal_ref, notes. **26 רשומות אמיתיות מהמפעל יובאו** (כולל אנרגיה, מים, ריח, שפכים, חומ"ס, פליטות, פסולת, אמוניה, גז טבעי, מערכת קירור, רעידת אדמה, פח"ע, מזג אוויר). UI: רשימה ממוינת לפי RPN בפועל יורד עם 2 badges (בפועל / פוטנציאלי), modal מאורגן ב-3 קבוצות (זיהוי / הערכת סיכון / ניהול), VIEW_CONFIG מלא לצפייה ב-18 שדות, מיגרציה הורצה אוטומטית.
- [x] **sbGet 400 fix (PR #138)** — הבאג: `_sbTsCol` לא כלל `env_aspects` / `hearing_tests` / `ncr_comments` / `ncr_patterns` אז `sbGet()` שלח `order=created_at.desc` לטבלאות שיש להן רק `ts`. תוצאה: HTTP 400 ב-Supabase API logs, sync נכשל בשקט, וה-UI הציג 0 רשומות למרות 26 ב-DB. הוספת 4 הטבלאות למפה.
- [x] **env_aspects per-record file_url (PR #139)** — מיגרציה `2026-05-01_env_aspects_file_url.sql` הוסיפה `file_url text`. UI: כפתור "📎 העלה קובץ" במודאל m-easp (Excel/PDF/תמונה), 📎 indicator בטבלה ליד רשומה עם קובץ, showView מציג קישור הורדה אוטומטית. שימוש: דוח מעבדה / תעודת מערכת / תמונת המקור פר-היבט.
- [x] **page_files banner (PR #140)** — מנגנון כללי "קובץ רשמי לכל הטופס". טבלה חדשה `page_files(id PK = page slug, file_url, file_name, uploaded_by, ts)` + RLS `_admin_manager_all`. UI: באנר ירוק בראש הכרטיס של env_aspects עם כפתור העלאה / קישור הורדה / כפתור החלף. שימוש: טופס 28.01 הרשמי. helpers (`_pageFileGet`/`_pageFileRender`/`_pageFileUpload`) שימושיים בעתיד גם ל-rsk/ncr.
- [x] **Locations hierarchy — PR 1/4 foundation (#141)** — מיגרציה `2026-05-01_locations.sql` יצרה טבלה `locations(id, name, parent_id → locations.id, level 1-3, notes, ts)` עם RLS, partial index על parent_id. עמוד חדש 📍 "מיקומים" תחת תפריט "ניהול" עם תצוגת עץ צבעונית (אזור=כחול / קו=צהוב / תחנה=ירוק), כפתור ＋ פר-שורה להוספת תת-רמה. modal m-loc, פונקציות rLoc/_locRenderNode/_locOpenAdd/editLoc/svLoc.
- [x] **Locations hierarchy — PR 2/4 NCR + Near Miss (#142)** — מיגרציה `2026-05-01_location_fk.sql` הוסיפה `location_id text REFERENCES locations(id) ON DELETE SET NULL` ל-`ncr` ו-`near_miss`. UI: שדה הטקסט הישן (`ncr-loc`/`nm-area`) הוחלף ב-`<select>` שטוח עם הזחות; ערך ישן נשאר כשדה קריאה בלבד. helpers `_locFlatList`/`_locOptionsHtml`/`_locPopulate`/`_locName`. openModal hook אוטומטי מאוכלס כל `select[id$="-location-id"]`. רשימות NCR ו-Near Miss מציגות נתיב מלא דרך `_locName`.
- [x] **Locations hierarchy — PR 3/4 PTW + EQI + Hazmat (#143)** — מיגרציה `2026-05-01_location_fk_more.sql` הוסיפה `location_id` ל-`ptw`, `equip_inspections`, `hzm`. אותו pattern: select מקושר + legacy text fallback + display בנתיב מלא בכל 3 הטבלאות.
- [x] **Locations hierarchy — PR 4/4 filtering (#144)** — דרופדאון "סנן לפי מיקום" בעמוד NCR (ליד הטאבים) ובעמוד Near Miss. helper `_locFilterOptionsHtml` עם placeholder "— כל המיקומים —". `window._{ncr,nm}LocFilter` שומר state. אין migration.
- [x] **10 locations נטענו ידנית (2026-05-01)** — ייצור טוגנים, קילופים, מעוצבים, אריזה, שפכים, חומר גלם, חצר, תוצ"ג, תשתיות, מעבדה. כולם level 1 שטוחים אחרי החלטת המשתמש לוותר על היררכיה (UPDATE על LOC-002/003/004 שהיו תחת ייצור טוגנים).
- [x] **Saved Views per-user (PR #147)** — בהשראת Vitre §16#6. טבלה חדשה `saved_views(id, user_email, page_slug, name, filters jsonb, ts)` עם RLS לפי `auth.jwt()->>'email'`. UI: כפתור 💾 (שמור) + Dropdown ⭐ (טען) + 🗑 (מחק) ליד הטאבים בעמודי NCR ו-Near Miss. helpers `_svUser`/`_svListForPage`/`_svSave`/`_svDelete`/`_svRenderSelect` (גנריים) + per-page glue (`svNcrSave/Apply/Delete`, `svNmSave/Apply/Delete`). Filters jsonb: `{ncrFilter, ncrLocFilter}` ל-NCR, `{nmFilter, nmLocFilter}` ל-NM — extensible לעמודים נוספים בעתיד בלי schema change.
- [x] **Notifications Matrix (PR #148)** — בהשראת Vitre §11. טבלה חדשה `notification_prefs(id PK = user email, prefs jsonb, ts)` עם RLS לפי email. UI: מודאל 🔔 "הגדרות התראות" (תפריט → ניהול), מטריצה של 5 אירועים (`ncr_critical`, `task_overdue`, `expiry_30days`, `round_missed`, `incident_critical`) × 3 ערוצים (`whatsapp`, `email`, `inapp`) עם checkboxes. Generic dispatcher `_notifyEvent(eventKey, payload)` בודק העדפות ומפעיל ערוצים פעילים. **Trigger ראשון מחובר**: יצירת NCR בעדיפות "קריטי" → `_notifyEvent('ncr_critical', ...)`. Channels: in-app עובד מיידית (toast); WhatsApp — console.log עד שיאושרו ה-templates של Meta; Email — console.log עד שיוגדר SMTP/API. Hooks ל-task_overdue/expiry/round_missed/incident_critical יתווספו ב-PR נפרד.

### 🚀 Performance refresh — Phase 0+1+2 (2026-05-04, PRs #333-#344)

תוכנית מלאה: `project-files/PERFORMANCE-PLAN-2026-05-04.md` (סינתזה של 5 סוכני מחקר במקביל). 12 PRs ברצף, כולם CSS/JS surgical-only, `body.hc` נשמר, `prefers-reduced-motion` מכובד, smoke check עבר.

- [x] **Phase 0 — Instrumentation (PR #333)** — `web-vitals@4` IIFE מ-CDN, `window._perf(label, fn)` wrapper מאחורי `?perf=1`, `window.addEventListener('error'/'unhandledrejection')` עם buffer של 50, `window._wv` מתמלא ב-LCP/INP/CLS/TTFB/FCP בכל טעינה.
- [x] **Phase 1 — preconnect (PR #334)** — `<link rel="preconnect">` ל-Supabase + fonts.googleapis + fonts.gstatic. -150-300ms בקריאה ראשונה.
- [x] **Phase 1 — `_headers` + `_routes.json` (PR #335)** — Cache-Control מפורט (HTML+SW=no-cache, SVG/JPG=long-cache), security headers (X-Content-Type-Options, Referrer-Policy, Permissions-Policy, X-Frame-Options), `_routes.json` עם `include:["/api/*"]` כדי לחסוך Pages Functions invocations על קבצים סטטיים.
- [x] **Phase 1 — defer + content-visibility (PR #336)** — `defer` ל-supabase-js SDK (-150ms blocking parse), `content-visibility:auto; contain-intrinsic-size:0 48px` על `.tbl-wrap tbody tr` (INP ↓ ברשימות ארוכות).
- [x] **Phase 1 — lazy + passive (PR #337)** — `loading="lazy"` על תמונות בטבלאות (NM photo + global search results), `{passive:true}` על scroll listener.
- [x] **Phase 2 — `_deb` + 6 search debounces (PR #338)** — helper גנרי `window._deb(fn, ms)`, 6 wrappers מוכנים: `_debEqiSearch`, `_debTskSearch`, `_debRHearing`, `_debModFilter`, `_debGsearch`, `_debSrRun`. הקלדה מהירה → רינדור 1 במקום N.
- [x] **Phase 2 — memoize (PR #339)** — `_locNameCache` / `_prjNameCache` / `_itypeNameCache` ב-Map, invalidate ב-`_rtApply`. חוסך 800+ סריקות לינאריות לרינדור NCR.
- [x] **Phase 2 — sdb cleanup (PR #340)** — `_SDB_SKIP = {audit_log, notifications_log, hist}` בעת serialize, cap ל-200 שורות ב-`_rtApply`. חוסך 50-80% מ-blob size, מונע QuotaExceededError.
- [x] **Phase 2 — split badges + guard rDash (PR #341)** — `_dashBadges()` מופרד מ-`rDash`, ה-badges מתעדכנים תמיד, רינדור הדשבורד מדלג כש-`CUR!=='dash'`. חוסך ~30-100ms לכל שמירה מחוץ לדשבורד.
- [x] **Phase 2 — fetch priority:low (PR #342)** — `priority:'low'` ב-`sbGet` כדי שכתיבות user-initiated יקדימו את ה-polling.
- [x] **Phase 2 — debounce sdb (PR #343)** — `setTimeout(_sdbFlush, 250)`, `beforeunload`+`pagehide` flushes. Burst של 35 שמירות ב-sbSync ראשוני → flush אחד.
- [x] **Phase 2 — `_hayFor` haystack (PR #344)** — `_srRun` (חיפוש Ctrl+K) שומר lowercase JSON על property non-enumerable `_hs`. x10 מהיר בהקלדה.
- [x] **Phase 6 part 1 — SSE keepalive (PR #346)** — `claude.js` שולח `: keepalive\n\n` כל 5 שניות אם אין chunk כבר 14ש׳, נמנע 524 ב-PDF גדולים.
- [x] **Phase 6 part 2 — Storage cacheControl (PR #347)** — `cache-control: max-age=31536000` ב-`_fileUpload`. תמונות/PDFs נשמרים ב-cache של הדפדפן לשנה. משפיע על near-miss/incidents/env_aspects/page_files (כולם דרך `_fileUpload`).
- [x] **Phase 4 — RLS perf wrap migration** — `migrations/2026-05-04_rls_perf_wrap.sql` הורץ ידנית ב-Supabase ב-2026-05-04. עוטף כל קריאה ל-`is_admin_manager()` (ולגרסאות schema-qualified כמו `private.is_admin_manager()`) ב-`(select ...)` כדי שהפונקציה תרוץ פעם אחת לשאילתה (initPlan) במקום לכל row. עד ~100× שיפור על שאילתות RLS-bound. בנוסף: event trigger `pgrst_watch` ל-NOTIFY pgrst אוטומטי אחרי DDL. PR #347 (תוכן) + PR #349 (תיקון regex אחרי שגיאת syntax על schema-qualified call).
- [x] **Phase 5 part 1 — extend poll 2min → 10min (PR #351)** — `setInterval` של `sbSync` עבר מ-`120*1000` ל-`600*1000`. Realtime כבר תופס שינויים מיידית, ה-polling רק safety net. חוסך ~83% מבקשות REST ברקע. אם Realtime נופל, `online`/`focus` listeners עדיין מפעילים sync מיידי.
- [x] **Phase 5 parts 2+3 — per-page render-skip + rAF debounce (PR #352)** — מפת `_PAGE_PRIMARY` (page→main table) + `_LOOKUP_TBLS` (locations/projects/issue_types/inspection_types/app_users/emp). כשrealtime event מגיע על טבלה לא רלוונטית בעמוד single-table, `_sbRefresh` מדלג על `rPage()`. בנוסף, `_rtApply` דוחה `sdb()`+`_sbRefresh()` ל-rAF הבא, כך שbursts (35 events) מתקבצים ל-1 write + 1 render. עמודי aggregate (dash/mr/cal/tasks/audit/exp) תמיד מרנדרים.
- [x] **Phase 3 lite — hourly update + soft pill (PR #354)** — `setInterval(reg.update, 1h)` מכריח בדיקה שעתית של `/sw.js` (מתקן את 24h של iOS Safari). במקום auto-reload אחרי `sw-updated`, מוצג pill קבוע בתחתית: "🔄 גרסה חדשה זמינה — לחץ לרענון" — המשתמש שולט מתי לרענן, לא מאבד טפסי NCR באמצע מילוי. ה-SW עצמו לא השתנה — רק ה-handler ב-index.html. Auto-versioning (build hash injection) נדחה ל-PR נפרד.

**SW: v83 → v100** (17 גרסאות, bumped ידני בכל PR).

**מה נשאר בתוכנית:**
- Phase 3 part 2 (אופציונלי, נדחה): build-hash auto-versioning. דורש Cloudflare Pages function או git hook להחליף `__BUILD__` ב-`sw.js`. שווה PR נפרד עם חלון בדיקה משלו.
- Phase 5 parts 4+5 (אופציונלי, נדחה): column projection (`_sbCols` map ל-`sbGet`) — דורש אימות ידני שכל עמודה שה-UI נוגע נמצאת ברשימה, טבלה אחת בכל פעם, מתחיל מ-NCR. Server-side filter על `notifications_log` — דורש החלטה אם admin צריך לראות notifications של משתמשים אחרים (כרגע — כן).
- Phase 7: רק אם המדידות מצביעות.

### 🌙 Overnight autonomous polish (2026-05-02, PRs #150-#160)
- [x] **Saved Views ל-Tasks (PR #150)** — אותו pattern מ-#147, מרחיב לעמוד משימות.
- [x] **Location filters ל-PTW + EQI + Hzm (PR #151)** — משלים את הסינון בכל 5 הטפסים.
- [x] **Chained forms (PR #152)** — בכמעט-נפגע "חמור" → כפתור פותח NCR טיוטה עם פרטים מועתקים.
- [x] **3 triggers נוספים (PR #153)** — `_notifDailyScan` רץ פעם ביום (sessionStorage flag): task_overdue (3+ ימים פיגור), expiry_30days (תוך 30 יום), round_missed (אחרי 11:00).
- [x] **incident_critical trigger (PR #154)** — תקרית חדשה בחומרה "חמור"/"קריטי" → notification.
- [x] **Dashboard widget "פתוחים לפי אזור" (PR #155)** — top 8 אזורים ע"פ NCR פתוחים + כמעט-נפגע פתוחים.
- [x] **showView auto-renders location_id (PR #156)** — כל רשומה עם location_id מציגה "📍 מיקום: <נתיב מלא>" אוטומטית.
- [x] **Clickable by-location rows (PR #157)** — קליק על שורת אזור בדשבורד → NCR מסונן לאזור.
- [x] **Counts per location (PR #158)** — עמוד מיקומים מציג badges ליד כל אזור עם NCR פתוחים + כמעט-נפגע פתוחים.
- [x] **Saved Views ל-Equipment Inspections (PR #159)** — תופס סטטוס + חיפוש + מיקום.
- [x] **Bell 🔔 בtopbar (PR #160)** — פותח הגדרות התראות בלחיצה.
- [x] **Saved Views ל-Hazmat (PR #162)** — תופס פילטר מיקום.
- [x] **Clear-all-filters ב-NCR (PR #163)** — כפתור "✕ נקה" מאפס פילטרים בלחיצה.
- [x] **Smart empty-state ב-NCR (PR #164)** — כשהרשימה ריקה בעקבות סינון, מוצג לינק "נקה פילטרים" inline.
- [x] **Clear-filters ב-NM + Tasks (PR #165)** — לעקביות עם NCR.
- [x] **Global search by location name (PR #166)** — חיפוש "ייצור" יחזיר NCRs במיקום ייצור גם דרך location_id (לא רק טקסט loc/area).
- [x] **location_id ב-incidents + hearing_tests (PR #169)** — תוסיף Dropdown מיקום בטופס תקריות. migration ב-COMBINED.
- [x] **Active filters chips ב-NCR (PR #170)** — chips ויזואליים עם × להסרה.
- [x] **Custom Properties (PR #171)** — שדות מותאמים פר-רשומה דרך showView. כל רשומה יכולה לקבל k/v חופשיים. migration ב-COMBINED.
- [x] **Filter chips ב-NM (PR #172)** — אותו pattern.
- [x] **Weekly comparison widget (PR #173)** — ▲▼ NCRs/NM/inc השבוע מול שבוע שעבר.
- [x] **Projects foundation (PR #174)** — טבלה + עמוד 🏗️ "פרויקטים". migration ב-COMBINED.
- [x] **Projects integrated in NCR/Tasks/Inc (PR #175)** — Dropdown 🏗️ פרויקט בכל המודלים. migration ב-COMBINED.
- [x] **NCR filter by project (PR #176)** — Dropdown סינון פרויקט + chip.
- [x] **Combined SQL (PR #177)** — `migrations/2026-05-02_OVERNIGHT_COMBINED.sql` — migration אחד לכל ה-4 שינויי schema של הלילה.
- [x] **Tasks filter by project (PR #178)** — Dropdown סינון פרויקט.
- [x] **Project name in NCR list (PR #179)** — בעמודת המיקום מוצג גם 🏗️ פרויקט.
- [x] **Projects VIEW_CONFIG (PR #180)** — showView יודע להציג פרויקט.
- [x] **Notifications log table (PR #182)** — `notifications_log` שומר audit trail של כל התראה שמופעלת. Migration ב-COMBINED.
- [x] **Notifications log viewer (PR #183)** — בתחתית הגדרות התראות, section נפתח עם 20 התראות אחרונות.
- [x] **Project badge in tasks list (PR #185)** — תווית "🏗️ פרויקט" בעמודת המקור.
- [x] **Hebrew date header on dashboard (PR #186)** — "📅 יום שני, 5 במאי 2026".
- [x] **Test notification button (PR #187)** — "🧪 בדיקה" במודאל הגדרות התראות.
- [x] **Active-filters chips on Tasks (PR #188)** — לעקביות עם NCR/NM.
- [x] **Inspection Types — recurrence templates (PR #190)** — Vitre §12.2. עמוד 🔍 + טבלה. Migration ב-COMBINED.
- [x] **Inspection Types as virtual tasks (PR #191)** — בדיקה חוזרת תוך 30 יום מתאריך יעד מופיעה בעמוד המשימות.
- [x] **EQI active-filter chips (PR #192)** — לעקביות.
- [x] **Dashboard "by-project" widget (PR #193)** — top 5 פרויקטים פעילים.
- [x] **Hzm active-filter chip (PR #194)** — לעקביות.
- [x] **Dashboard inspection types upcoming widget (PR #195)** — top 5 בדיקות חוזרות בתוך 60 יום.
- [x] **Dashboard auto-insights panel (PR #196)** — עד 3 משפטים אוטומטיים על דפוסים.
- [x] **Dashboard safety health score (PR #197)** — ציון 0-100 צבעוני.
- [x] **JSON backup button (PR #199)** — 💾 בtopbar למנהל.
- [x] **Emergency report shortcut (PR #200)** — 🆘 בדשבורד.
- [x] **My-tasks badge (PR #201)** — 📝 בtopbar עם ספירה.
- [x] **Morning round reminder (PR #202)** — באנר אם סבב לא בוצע ולפני 14:00.
- [x] **Clickable project name (PR #203)** — בעמוד פרויקטים.
- [x] **Tasks-completed in weekly comparison (PR #205)** — שורה 4 ב-widget.
- [x] **Search projects + inspection_types (PR #206)** — חיפוש גלובלי מורחב.
- [x] **Tasks filter by assignee (PR #207)** — Dropdown.
- [x] **Version label (PR #208)** — v2026.05.02 בtopbar.
- [x] **Recent activity feed (PR #209)** — 5 רשומות עדכניות בדשבורד.
- [x] **Total counts widget (PR #211)** — pills צבעוניים בדשבורד.
- [x] **Scroll-to-top button (PR #212)** — כפתור צף.
- [x] **Clear notif log button (PR #213)** — בהגדרות התראות.
- [x] **Stale NCR indicator (PR #214)** — ⏳ על NCR לא מעודכן 30+ יום.
- [x] **Assignee autocomplete (PR #215)** — datalist מ-users + emp.
- [x] **NCR summary pills (PR #217)** — סה"כ/פתוח/בטיפול/סגור/קריטי בראש NCR list.
- [x] **Tasks summary pills (PR #218)** — אותו pattern.
- [x] **NM summary pills (PR #219)** — אותו pattern.
- [x] **This-month dashboard widget (PR #220)** — סיכום החודש.
- [x] **Tasks due today widget (PR #221)** — בדשבורד.
- [x] **Inc summary pills (PR #223)** — כולל ימי אבדן.
- [x] **EQI summary pills (PR #224)** — תפוגות+תקינים.
- [x] **Row hover desktop (PR #225)** — CSS only.
- [x] **Health score breakdown tooltip (PR #226)** — hover על הציון.
- [x] **Section divider on dashboard (PR #227)**.
- [x] **About modal (PR #228)** — קליק על תווית גרסה.
- [x] **NCR smart sort (PR #229)** — פתוחים → עדיפות → תאריך.
- [x] **NM smart sort (PR #231)** — פתוחים → severity → תאריך.
- [x] **Print CSS A4 landscape (PR #232 + #234)**.
- [x] **ITP summary pills (PR #235)**.
- [x] **HZM summary pills (PR #236)**.
- [x] **PTW summary pills (PR #237)**.
- [x] **Projects filter tabs (PR #238)** — כל/פעילים/הושלמו.
- [x] **NCR quick-filter presets (PR #240)** — 4 כפתורים מהירים: 🔥 קריטיים / 📅 השבוע / ⏱️ ישנים / ⏳ חורגים.
- [x] **Issue Types hierarchy (PR #248)** — Vitre §6.3. טבלה `issue_types` 3-level עם `issue_type_id` ב-NCR ו-`inc`. עמוד 🎯 + dropdown סינון.
- [x] **Issue Types seed data (PR #257)** — 30+ סוגי NCR ישראליים מוטמעים מראש.
- [x] **Inspection Types seed data (PR #256)** — 15 בדיקות ציוד ישראליות מוטמעות.
- [x] **Dashboard quick-add row (PR #259)** — 4 כפתורים צבעוניים: ⚠️ NCR / 🚨 כמעט-נפגע / ✅ משימה / 🔧 בדיקת ציוד.
- [x] **Keyboard shortcuts + help modal (PR #260)** — `?` פותח עזרה, `G+D/N/T/M/I/E/P/H/L/R` ניווט מהיר. ❓ בtopbar.
- [x] **Top critical/high NCRs widget (PR #261)** — 🔥 וידג'ט בדשבורד עם 5 NCRs פתוחים.
- [x] **Issue Types aggregate counts (PR #262)** — כל קטגוריה מציגה NCR+תקריות מצטברים מתת-סוגים.
- [x] **NCR resolution time KPI (PR #263)** — ⏱️ ממוצע ימים לסגירה / גיל פתוחים / % שנסגרו ב-30 יום.
- [x] **Tasks status breakdown bar (PR #264)** — סרגל ויזואלי של פתוח/בהתקדמות/הושלם/בוטל + ⏳ בפיגור.
- [x] **NCR summary pills extended (PR #265)** — נוספו "גבוה פתוח" ו-"⏳ פתוח 30+ ימים".
- [x] **NCR active chips - itype + quick filter (PR #266)** — chips ויזואליים לסינון Issue Type ו-quick filter.
- [x] **Issue Types clickable name (PR #267)** — קליק על שם → NCR מסונן.
- [x] **Help button in topbar (PR #268)** — ❓ פותח חלון עזרה.
- [x] **Notif log relative time (PR #269)** — "לפני 12ד׳" במקום DD/MM/YYYY.
- [x] **My-open-NCRs widget (PR #270)** — 👤 בדשבורד מציג עד 5 NCRs פתוחים שמשויכים למשתמש.
- [x] **NCR date-range quick filters (PR #271)** — 📅 30 יום / 90 יום נוספו לכפתורי quick-filter.
- [x] **Top env aspects RPN widget (PR #272)** — 🌿 בדשבורד 5 ההיבטים הסביבתיים עם RPN בפועל גבוה.
- [x] **Morning rounds 30-day compliance (PR #273)** — ☀️ בדשבורד % ביצוע + סטריפ ויזואלי 30 יום.
- [x] **NM severity filter dropdown (PR #274)** — סינון לפי חומרה בעמוד כמעט-נפגע.
- [x] **NCR list shows issue type (PR #275)** — בעמודת המיקום מוצג גם 🎯 סוג אי-התאמות.
- [x] **Print active filters (PR #276)** — print-header כולל את "פילטרים: chip1 · chip2 ..." האקטיביים.
- [x] **View copy-to-clipboard (PR #277)** — 📋 ב-showView מעתיק סיכום הרשומה לקליפבורד (לשיתוף ב-WhatsApp).
- [x] **Upcoming-this-week dashboard widget (PR #278)** — 📅 מציג עד 8 פריטים בעלי deadline ב-7 ימים הקרובים (משימות + תפוגות + בדיקות).
- [x] **Inline text search in Tasks (PR #279)** — שדה 🔍 לחיפוש בתוך כותרת/אחראי/הערות + chips.
- [x] **env_aspects summary pills (PR #280)** — 5 pills: סה״כ, RPN גבוה, בינוני, נמוך, ⏰ ביקורת עברה.
- [x] **NCR opens-vs-closes 4-week chart (PR #281)** — 📊 תרשים עמודות: 4 שבועות עם נפתח (אדום) מול נסגר (ירוק).
- [x] **Copy deep-link button (PR #282)** — 🔗 ב-showView יוצר קישור שמטעין את הרשומה ישירות.
- [x] **Slash key opens search (PR #283)** — `/` פותח חיפוש גלובלי (כמו Ctrl+K).
- [x] **Notif log show-all toggle (PR #284)** — לינק "הצג את כל ה-N הרשומות" כשיש >20.
- [x] **Hazmat default sort by severity+expiry (PR #285)** — סיכון גבוה ראשון, תוך כל קטגוריה לפי MSDS.
- [x] **Tasks smart sort (PR #286)** — חורגים → עדיפות → תאריך יעד.
- [x] **NCR priority dot in list (PR #287)** — 🔴 קריטי / 🟠 גבוה ליד מספר ה-NCR.
- [x] **Bottom-nav tasks badge (PR #288)** — תווית אדומה עם ספירת משימות פתוחות בלשונית "משימות".
- [x] **Dashboard freshness time (PR #289)** — "⌚ עודכן ב-HH:MM" בכותרת התאריך.
- [x] **Modules-sheet inline search (PR #290)** — 🔍 חיפוש בתוך תפריט המודולים, מסנן כפתורים וכותרות קבוצות.
- [x] **Task duplicate menu action (PR #291)** — 📋 "שכפל משימה" בתפריט ⋯ של כל משימה.
- [x] **Top-assignees-by-open-tasks widget (PR #292)** — 👥 בדשבורד מציג עד 5 אחראים שיש להם הכי הרבה משימות פתוחות, קליק → סינון לפי האחראי.

### 🟢 תשתית / UX
- [x] **PWA — install + offline (basic)** — Service Worker פשוט (`sw.js`) ב-shell-cache: cache-first ל-`index.html`/`manifest.webmanifest`/`icon.svg`/`logo.jpg`, network-first עם fallback. בקשות API (Supabase, /api/*, Anthropic) עוברות ישירות. `manifest.webmanifest` היה כבר. כפתור 📱 ב-topbar שמופיע ב-`beforeinstallprompt` event ומפעיל את ה-prompt של הדפדפן. **מה לא נעשה**: push notifications (דורש backend), background sync (יבוא עם WhatsApp).
- [x] **חיפוש גלובלי** — 🔍 על 9 הטבלאות הראשיות. כפתור 🔍 בtopbar פותח מודאל עם input חי. סורק `ncr`, `equip_inspections`, `near_miss`, `inc`, `tasks`, `tr`, `docs`, `emp`, `leg` (~5-10 שדות פר טבלה). תוצאות עם icon + label + preview, מקסימום 50, קליק → `showView`. סינון רגישות (NCR `sens=true` לא מוצג ל-non-admin). ללא migration. UI בלבד.
- [x] **ייצוא PDF גלובלי** — כפתור 🖨 בtopbar שמדפיס/מייצא ל-PDF את הדף הפעיל בלבד (תוקן באג בו ה-CSS להדפסה הראה את כל הדפים). מוסיף print-header אוטומטי עם כותרת + תאריך + שם משתמש. עובד מכל דף — דשבורד, NCR, משימות, ביקורות וכו'. ב-Chrome/Safari יש דיאלוג "Save as PDF". ללא תלות חיצונית (jsPDF), ללא migration.
- [x] **Recurrence Engine מזוער (Virtual Tasks 30-day window)** — בהשראת Vitre §12.2. עד היום `_collectVirtualTasks` הציג רק פריטים שכבר פגו (`r.e < today`). עכשיו: כל פריט במרחק עד 30 יום מתפוגה (PPE/הדרכה/מסמכים/קבלנים/בדיקות ציוד) נהפך לוירטואלי עם עדיפות מדורגת: **קריטי** (פג), **גבוה** (היום או 1-7 ימים), **בינונית** (8-30 ימים). הכותרת מציינת "פג בעוד X ימים" כדי שהמשתמש יבין מהר. אין צורך ב-cron — מחושב חי בכל רענון. ללא migration, ללא endpoint חדש.
- [x] **Pattern Detection History** — בהשראת Vitre §17 ("חוסר ב-AI עומק"). כל לחיצה על "ניתוח כללי" שומרת תוצאה ב-`ncr_patterns` (טבלה חדשה) עם snapshot של byArea/byPriority/byStatus + open/closed counts. במודאל הסוכן מופיע "📜 ניתוחים קודמים" עם 5 הניתוחים האחרונים — קליק על תאריך מציג את הניתוח של אז. בנה paper-trail היסטורי לזיהוי מגמות לאורך זמן.
- [x] **NCR Trend Chart (12 חודשים)** — כפתור "📈 מגמות" במודאל הסוכן. רנדר SVG inline (ללא תלות חיצונית) עם stacked bar chart: שורת בסיס לפי 12 חודשים אחרונים, אדום=בטיחות, ירוק=סביבה. מספר NCRs כותב מעל כל עמודה. מתחת: 3 KPI tiles (סה"כ בטיחות / סביבה / סגורים) על כל המאגר. נתון מתוך `_nad` (כל ה-NCRs שהsynced ב-Agent).
- [ ] **ייצוא PDF** — לכל דף
- [x] **WhatsApp Meta API — שלב 1 (פעיל מלא + token קבוע) — אומת end-to-end 30/4**: endpoint `/api/wa-send.js` (Vercel Edge) שמדבר עם Meta Cloud API. 3 modes: hello_world template, custom approved template עם params, free-form text. env vars `META_PHONE_NUMBER_ID`/`META_ACCESS_TOKEN` ב-Vercel. **System User Token קבוע** (לא יפוג) שנוצר דרך Meta Business Settings עם הרשאות `whatsapp_business_messaging` + `whatsapp_business_management`. UI: כרטיס "📱 בדיקת WhatsApp" בדשבורד (admin-only) עם input לטלפון + כפתור שלח. **2 אימותים end-to-end**: ב-11:04 עם temp token, ב-11:21 עם permanent token — שניהם הצליחו.
- [x] **WhatsApp שלב 2A — 3 Custom Hebrew Templates נשלחו ל-Meta approval (30/4 11:32)**: `tfugen_ncr_critical` (NCR קריטי, 3 params), `tfugen_task_overdue` (משימה בפיגור, 2 params), `tfugen_expiry_warning` (חידוש ציוד/הסמכה, 3 params). כל ה-3 ב-status "בבדיקה" — תוך 24-48h יעברו ל-"פעיל". כל אחד מבוסס Utility category, עברית, עם דוגמאות parameters.
- [x] **WhatsApp שלב 2B — כפתורי שליחה ידנית מ-`showView`** + **Smart routing**: כל NCR פתוח, משימה לא-סגורה, או פריט תפוגה תוך 30 יום — מציג כפתור "📱 שלח התראת WhatsApp" admin-only ב-detail view. הוספת `_waResolvePhone(name)` שמחפשת ב-`app_users` (active=true + phone) לפי `full_name` או `username` ומחזירה את הטלפון. אם נמצא — שולח לשם עם confirm "לשלוח ל-X (אחראי)?", אחרת fallback ל-localStorage/+972547940073. JS helpers: `_waNcrAlert`, `_waTaskAlert`, `_waExpiryAlert`, `_waAlertFromView`. שדה phone כבר קיים ב-app_users (אין migration).
- [x] **CSV Export גלובלי** — כפתור 📊 בtopbar שמייצא את הטבלה הנוכחית (ה-`.page.on table`) ל-CSV עם UTF-8 BOM. עברית מופיעה תקין ב-Excel. מנקה buttons/inputs מהתאים, quotes RFC 4180. Filename: `tfugen_<page>_<YYYY-MM-DD>.csv`. עובד על כל דף עם טבלה. ללא migration.
- [x] **Audit Trail** — דף `pg-audit` (אדמין/מנהל בלבד), טבלה `audit_log` עם RLS, וגאשת `_aud()` שמרשמת אוטומטית כל `sbIns`/`sbUpd`/`sbDel`. Migration `2026-04-24_audit_log.sql` הורץ ב-Supabase (הטבלה קיימת עם 25+ רשומות מ-2026-04-30 לפחות). הכפתור ב-modules sheet מוצג רק לאדמין דרך `_applyRoleGates`.
- [ ] **Agent Dashboard** — ריכוז כל ה-AI agents

### 🔵 באגים ידועים
- [ ] NCR table debug — התנהגות בעת insert ריק
- [ ] Fix NCR Agent v3 — edge cases

### 📌 Pull Requests פתוחים — דרושה החלטה
- [x] ~~**PR #45 — Toolbox Talks**~~ — **נסגר ב-2026-04-24**. הבסיס היה ישן (5 ימים), קונפליקטים ב-`index.html`, והמיגרציה הכילה `DISABLE ROW LEVEL SECURITY` שמנוגדת למדיניות ה-RLS החדשה. Toolbox Talks נשאר תחת "🟡 תוספות ISO" לטיפול עתידי במימוש טרי עם `is_admin_manager()` policy.

---

## 🔄 פרוטוקול סנכרון בין חשבונות

המשתמש עובד מ-**2 חשבונות Claude**. בתחילת כל שיחה (במיוחד בחשבון חדש):

1. Claude קורא: `CLAUDE.md` → `STATUS.md` → `DECISIONS.md`
2. Claude מסכם למשתמש איפה הפרויקט עומד
3. Claude שואל: מה המטרה של השיחה?

במובייל (Claude Project), המשתמש יכול להדביק:
```
קרא CLAUDE.md, STATUS.md, DECISIONS.md מ-mishaf1988-lgtm/tfugen-safety והסבר מצב
```

---

## 🤖 Routine Prompt (למשימות סטנדרטיות)

```
קרא CLAUDE.md + STATUS.md + DECISIONS.md.
בחר את המשימה הבאה שלא מסומנת.
צור branch: routine/TASK-NAME-YYYY-MM-DD.

כשמסיים:
1. וודא 23 טבלאות 200 OK
2. וודא אין שגיאות console
3. עדכן STATUS.md (סמן V, עדכן Last Known Good)
4. הוסף שורה ל-DECISIONS.md אם יש החלטה ארכיטקטונית
5. צור tag: stable-YYYY-MM-DD-<name>
6. Push + פתח PR
```
