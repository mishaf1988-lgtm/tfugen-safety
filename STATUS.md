# TFUGEN Safety — STATUS

> מצב הפרויקט. מתעדכן אחרי כל משימה. Claude: קרא **קודם** את `CLAUDE.md`, ואז את הקובץ הזה.

**Last updated**: 2026-04-18
**Repo**: `mishaf1988-lgtm/tfugen-safety` · **Live**: https://tfugen-safety.vercel.app

---

## 🔖 Last Known Good

| שדה | ערך |
|---|---|
| Commit | *(יעודכן אחרי merge)* |
| תאריך | 2026-04-18 |
| Tag | `stable-2026-04-18-ncr-agent` |
| מצב | 18 טבלאות OK · NCR Agent v4 שומר ל-DB · Expiries עובד · Skills + CLAUDE.md פעילים |

---

## ✅ הושלם

- [x] Supabase sync — 17 טבלאות מחזירות 200 OK (+ `ncr_ai` טבלה 18)
- [x] 375 רשומות NCR הועלו
- [x] **Expiries Agent** (PR #4) — דף `pg-exp` מאוחד + התראות dashboard משודרגות
- [x] **Skill `tfugen-dev`** — אכיפת חוקי פיתוח אוטומטית
- [x] **תשתית סנכרון** — CLAUDE.md + DECISIONS.md
- [x] **NCR Agent v4** (PR הנוכחי, 5a) — prompt ISO 45001/14001, שמירה ל-`ncr_ai`, badge עם version, aggregate על פתוחים בלבד (150)
- [x] **NCR Agent Accept & Apply** (PR 5b) — כפתור "החל ניתוח על ה-NCR" שמזרים `rc/c/o/u` מ-`ncr_ai` ל-`ncr` + זיהוי אוטומטי של מצב "הוחל"
- [x] **Dashboard 2.0 — Phase A** — 4 גרפים אינטראקטיביים ב-`pg-dash`: NCR trend 12 חודשים, אירועים+ימי אבדן, תפוגות לפי קטגוריה ודחיפות, מפת סיכונים 5×5. Chart.js CDN. Drill-down ב-onclick.
- [x] **Outbox cloud sync** — `sbIns/sbUpd/sbDel` עברו ל-queue ב-localStorage עם retry אוטומטי (online/focus/30s). תיקן באג קריטי: `sbUpd` כלל לא היה מוגדר → UPDATEs של NCR ו-equip_inspections לא נשמרו בענן. Badge ב-topbar מראה פעולות ממתינות.
- [x] **Outbox hardening (hotfix)** — תיקון 3 באגים שגרמו לנתונים להיעלם אחרי רענון: (1) `ldb()` לא שחזרה `equip_inspections` מ-localStorage, (2) שגיאות 4xx (כולל 404 "טבלה לא קיימת") נמחקו מהתור בשקט, (3) `sbSync` יכלה לדרוס נתונים מקומיים כשהטבלה בענן ריקה. נוסף upsert (`resolution=merge-duplicates`), חלון אבחון בלחיצה על ה-pill, ו-skip לטבלאות עם פעולות ממתינות.
- [x] **Equipment Inspections** — דף `pg-eqi` + טבלה `equip_inspections` + ייבוא Excel/CSV + אינטגרציה עם Expiries Agent

---

## 📋 תור משימות

### 🔴 עדיפות גבוהה
- [ ] **2c. NCR Agent — UX/Filter** (PR 5c) — filter לסגורים ברשימת ה-modal, הגדלת sample, aggregate על הכל עם chunking
- [ ] **3. Incident Investigation Agent** — 5 Whys אוטומטי + סיווג TRIR

### ⚠️ פעולה ידנית נדרשת
- [ ] **הרץ migration ב-Supabase**: `migrations/2026-04-18_ncr_ai.sql` (SQL Editor → Paste → Run). ללא זה, שמירת ניתוחי AI תיכשל בשקט.
- [ ] **הרץ migration ב-Supabase**: `migrations/2026-04-18_equip_inspections.sql` (SQL Editor → Paste → Run). ללא זה, דף בדיקות ציוד לא יעבוד.

### 🟡 תוספות ISO 14001/45001 (יומיומי)
- [ ] **Morning Round** — checklist יומי (PPE/אש/מעברים/דגימות)
- [ ] **Near-Miss capture** — כפתור מהיר + יחס לincidents
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
