# TFUGEN Safety — STATUS

> מצב הפרויקט. מתעדכן אחרי כל משימה. Claude: קרא **קודם** את `CLAUDE.md`, ואז את הקובץ הזה.

**Last updated**: 2026-04-19
**Repo**: `mishaf1988-lgtm/tfugen-safety` · **Live**: https://tfugen-safety.vercel.app

---

## 🔖 Last Known Good

| שדה | ערך |
|---|---|
| Commit | `abca665` |
| תאריך | 2026-04-19 |
| Tag | `stable-2026-04-19-reports-flow` |
| מצב | 20 טבלאות OK · Realtime sync פעיל · צילום/PDF בכל טפסי הדיווח · QR Stage A · Skills + CLAUDE.md פעילים |

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

---

## 📋 תור משימות

### 🔴 עדיפות גבוהה
- [ ] **2c. NCR Agent — UX/Filter** (PR 5c) — filter לסגורים ברשימת ה-modal, הגדלת sample, aggregate על הכל עם chunking
- [ ] **3. Incident Investigation Agent** — 5 Whys אוטומטי + סיווג TRIR

### ⚠️ פעולה ידנית נדרשת
- [ ] **הרץ migration ב-Supabase**: `migrations/2026-04-18_ncr_ai.sql` (SQL Editor → Paste → Run). ללא זה, שמירת ניתוחי AI תיכשל בשקט.
- [ ] **הרץ migration ב-Supabase**: `migrations/2026-04-18_equip_inspections.sql` (SQL Editor → Paste → Run). ללא זה, דף בדיקות ציוד לא יעבוד.

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
1. וודא 17 טבלאות 200 OK
2. וודא אין שגיאות console
3. עדכן STATUS.md (סמן V, עדכן Last Known Good)
4. הוסף שורה ל-DECISIONS.md אם יש החלטה ארכיטקטונית
5. צור tag: stable-YYYY-MM-DD-<name>
6. Push + פתח PR
```
