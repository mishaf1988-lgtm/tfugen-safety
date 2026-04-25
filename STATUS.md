# TFUGEN Safety — STATUS

> מצב הפרויקט. מתעדכן אחרי כל משימה. Claude: קרא **קודם** את `CLAUDE.md`, ואז את הקובץ הזה.

**Last updated**: 2026-04-24 (tasks B + D closed · RLS Stages 1+2 deployed · PR #45 closed)
**Repo**: `mishaf1988-lgtm/tfugen-safety` · **Live**: https://tfugen-safety.vercel.app

---

## 🔖 Last Known Good

| שדה | ערך |
|---|---|
| Commit | `a7c2067` |
| תאריך | 2026-04-23 |
| Tag | — (טרם נוצר) |
| מצב | 23 טבלאות · ניהול משתמשים מלא דרך האפליקציה (create/rename/reset/delete) · Smart Capture (קול+תמונה+וידאו) · Tasks + Virtual Tasks · Design Polish Tiers 0-3 (nav 4-טאבים, דשבורד "היום", FAB ✨, high-contrast, 44×44 tap targets) · תיקון אבטחה RLS לאדמין בלבד |

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
- [x] ~~`migrations/2026-04-19_near_miss.sql`~~ — הורץ
- [x] ~~`migrations/2026-04-19_rounds.sql`~~ — הורץ
- [x] ~~`migrations/2026-04-19_photo_url.sql`~~ — הורץ
- [x] ~~`migrations/2026-04-19_inc_tr_file_url.sql`~~ — הורץ
- [x] ~~`migrations/2026-04-19_realtime_publication.sql`~~ — הורץ
- [x] ~~Storage bucket `incidents-photos` + INSERT policy לאנונימי~~ — הוגדר

### 🟡 תוספות ISO 14001/45001 (יומיומי)
- [ ] **Toolbox Talks** — תיעוד שיחות בטיחות יומיות
- [ ] **Legal Register** — חוקים + סקירות תקופתיות (14001)
- [ ] **Environmental Aspects** — רישום היבטים סביבתיים (14001:6.1.2)
- [ ] **Management Review Dashboard** — סיכום רבעוני ל-PDF

### 🟢 תשתית / UX
- [ ] **PWA** — install, offline, push notifications
- [ ] **חיפוש גלובלי** — 🔍 על כל המודולים
- [ ] **ייצוא PDF** — לכל דף
- [ ] **WhatsApp Meta API** — התראות לאחראי
- [ ] **Audit Trail** — מי שינה מה ומתי
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
