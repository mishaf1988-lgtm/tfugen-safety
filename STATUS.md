# TFUGEN Safety — STATUS

> מצב הפרויקט. מתעדכן אחרי כל משימה. Claude: קרא **קודם** את `CLAUDE.md`, ואז את הקובץ הזה.

**Last updated**: 2026-04-30 (NCR Agent feedback loop 👍/👎/🔄 + Reopen flow + Bulk actions on tasks + 3 pre-existing bug fixes)
**Repo**: `mishaf1988-lgtm/tfugen-safety` · **Live**: https://tfugen-safety.vercel.app

---

## 🔖 Last Known Good

| שדה | ערך |
|---|---|
| Commit | `94fa091` |
| תאריך | 2026-04-30 |
| Tag | — (טרם נוצר) |
| מצב | 23 טבלאות · NCR Agent עם feedback loop (👍/👎/🔄) שמור ל-`ncr_ai` · Reopen flow על Task/NCR סגורים (עם סיבה+חתימה ב-notes) · 3 תיקוני bugs קודמים (auth JWT, CORS preview, max_tokens) · Smart Capture · Tasks + Virtual Tasks · RLS Stage 1+2 פעיל |

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
- [ ] **הרץ migration ב-Supabase**: `migrations/2026-04-30_tasks_parent.sql` — מוסיף עמודה `parent_id text` ל-`tasks` + partial index. תומך ב-Sub-tasks. ה-UI כבר מוכן בפרודקשן (dropdown במודאל + badge ברשימה).
- [ ] **הרץ migration ב-Supabase**: `migrations/2026-04-30_ncr_sensitivity.sql` — מוסיף עמודה `sens boolean DEFAULT false` ל-`ncr` + partial index. תומך ב-Sensitivity flag (UI כבר מוכן: checkbox במודאל, badge 🔒, gating ב-`rNcr`/`editNcr`/`showView`/NCR Agent).
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
- [ ] **Toolbox Talks** — תיעוד שיחות בטיחות יומיות. **קוד מימוש דחוף ל-merge ב-PR חדש** (יורש לוגי מ-PR #45 שנסגר). דורש הרצת `migrations/2026-04-24_toolbox.sql` ב-Supabase.
- [ ] **Legal Register** — חוקים + סקירות תקופתיות (14001)
- [ ] **Environmental Aspects** — רישום היבטים סביבתיים (14001:6.1.2)
- [ ] **Management Review Dashboard** — סיכום רבעוני ל-PDF

### 🟢 תשתית / UX
- [ ] **PWA** — install, offline, push notifications
- [x] **חיפוש גלובלי** — 🔍 על 9 הטבלאות הראשיות. כפתור 🔍 בtopbar פותח מודאל עם input חי. סורק `ncr`, `equip_inspections`, `near_miss`, `inc`, `tasks`, `tr`, `docs`, `emp`, `leg` (~5-10 שדות פר טבלה). תוצאות עם icon + label + preview, מקסימום 50, קליק → `showView`. סינון רגישות (NCR `sens=true` לא מוצג ל-non-admin). ללא migration. UI בלבד.
- [ ] **ייצוא PDF** — לכל דף
- [ ] **WhatsApp Meta API** — התראות לאחראי
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
