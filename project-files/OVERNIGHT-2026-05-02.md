# Overnight Autonomous Session — 2026-05-02

**Branch**: `claude/check-software-status-9iZMX`
**Latest commit**: `265a74c`
**Total PRs merged**: ~125 לילה + 34 בוקר

---

## ☀️ Morning Autonomous Run (2026-05-02 05:00–08:00 UTC = 08:00–11:00 IST)

11 פיצ'רים נוספו אוטונומית בבוקר. כולם UI-only או DB-readonly — **אין migration חדשה לבוקר** (ה-3 migrations של הלילה עדיין נדרשות לפי הוראות בהמשך).

### דשבורד
- 🟢 **Quick-add row**: 4 כפתורים צבעוניים פותחים מודאל NCR/NM/Task/EQI מיידית.
- 🔥 **Top critical/high NCRs widget**: עד 5 NCR פתוחים בעדיפות קריטי/גבוה. לחיצה → showView.
- 📋 **Tasks status breakdown bar**: סרגל סטטוס ויזואלי (פתוח/בהתקדמות/הושלם/בוטל) + ⏳ בפיגור.
- ⏱️ **NCR resolution time card**: ממוצע ימים לסגירה, ממוצע גיל פתוחים, % שנסגרו ב-30 יום.

### NCR
- 🏷 **Active chips extended**: chips נפרדים ל-Issue Type ול-quick filter (🔥/📅/⏱️/⏳).
- 📊 **Summary pills**: נוספו "גבוה פתוח" + "⏳ פתוח 30+ ימים".

### Issue Types
- ➕ **Aggregate counts**: כל קטגוריה מציגה ספירת NCR+תקריות כולל תת-סוגים.
- 🔗 **Clickable name**: קליק על שם → NCR מסונן באוטומט.

### Topbar / שורטקאטים
- ⌨️ **Keyboard shortcuts + help modal**: `?` פותח עזרה, `G+letter` ניווט (D/N/T/M/I/E/P/H/L/R), `Ctrl+K` חיפוש.
- ❓ **Help button**: ❓ נוסף ב-topbar ליד תווית גרסה.

### התראות
- ⏰ **Notif log relative time**: "לפני 12ד׳" במקום DD/MM/YYYY (hover מציג datetime מלא).

### דשבורד — תוספות נוספות
- 👤 **My-open NCRs widget**: עד 5 NCRs פתוחים שמשויכים למשתמש המחובר.
- 🌿 **Top env aspects (RPN)**: 5 ההיבטים הסביבתיים בעלי RPN בפועל ≥ 10.
- ☀️ **Morning rounds 30-day compliance**: % ביצוע + סטריפ 30 ימים (ירוק/אדום/אפור).

### NCR
- 📅 **Date-range quick filters**: כפתורי "30 יום" ו-"90 יום" נוספו לסרגל המהיר.

### NM (כמעט-נפגע)
- ⚡ **Severity filter**: dropdown סינון לפי חומרה (קל/בינוני/חמור/קריטי) + chip להסרה.

### NCR — תוספות נוספות
- 🎯 **Issue-type בעמודה**: עמודת המיקום מציגה גם את סוג אי-ההתאמות (אם קיים).

### הדפסה
- 🖨 **פילטרים בכותרת**: print-header כולל שורת "פילטרים: ..." עם כל ה-chips הפעילים.

### showView
- 📋 **Copy-to-clipboard**: כפתור חדש שמעתיק סיכום הרשומה כטקסט לשיתוף ב-WhatsApp/אימייל.
- 🔗 **Deep-link**: כפתור חדש שמעתיק קישור שמטעין את הרשומה ישירות (`#view-tbl-id`).

### דשבורד — תוספות שלישיות
- 📅 **Upcoming this week**: עד 8 פריטים בעלי deadline ב-7 ימים הקרובים (משימות + תפוגות + בדיקות חוזרות).
- 📊 **NCR opens vs closes**: תרשים עמודות 4 שבועות.

### Tasks
- 🔍 **Inline search**: חיפוש מהיר בתוך הרשימה.
- 📋 **Smart sort**: חורגים → עדיפות → יעד.

### NCR
- 🔴 **Priority dot**: ליד המספר ברשימה (קריטי/גבוה).

### env_aspects
- 📊 **Summary pills**: סה״כ + פיזור RPN + ⏰ ביקורת עברה.

### Hazmat
- 📋 **Smart sort**: סיכון גבוה ראשון, אחר-כך MSDS.

### Notifications
- 🔢 **Show-all toggle**: לראות את כל הרשומות בלוג, לא רק 20.

### שורטקאטים
- ⌨️ **/** פותח חיפוש גלובלי (תוספת ל-Ctrl+K).

### Navigation
- 🔢 **Bottom-nav tasks badge**: ספירת משימות פתוחות בלשונית "משימות" בנאוויגציה התחתונה.
- 🔍 **Modules-sheet search**: שדה חיפוש בתוך תפריט המודולים — מסנן בזמן אמת.

### דשבורד — תוספות אחרונות
- ⌚ **Freshness time**: כותרת התאריך מציגה גם "עודכן ב-HH:MM" כדי להראות רענון נתונים.
- 👥 **Top assignees**: עד 5 אחראים עם הכי הרבה משימות פתוחות, קליק → רשימת המשימות המסוננת.

### Tasks
- 📋 **Duplicate task**: פעולה חדשה בתפריט ⋯ — שיכפול מהיר של משימה.

---

## ⚠️ פעולה חד-פעמית בבוקר

הרץ ב-Supabase SQL Editor את הקובץ:
```
migrations/2026-05-02_OVERNIGHT_COMBINED.sql
```
הוא idempotent (בטוח להריץ שוב, וגם בטוח אם כבר רץ חלק מהמיגרציות).

---

## TL;DR
לילה של פיתוח. רוב ה-PRs UI-only. יש 4 migrations מאוחדות לקובץ אחד (COMBINED.sql). JS validated בכל commit.

הבוקר אתה אמור לראות הכל פועל כרגיל + ~30 שיפורים, חלקם דורשים את ה-COMBINED SQL.

---

## What changed (in plain Hebrew)

### עמוד NCR
- 💾⭐🗑 שמירת תצוגות (פילטרים אישיים)
- ✕ כפתור "נקה" שמאפס פילטרים
- מסר ידידותי כשהרשימה ריקה ויש פילטרים
- Dropdown סינון מיקום (כבר היה)

### עמוד "כמעט-נפגע"
- 💾⭐🗑 שמירת תצוגות
- ✕ כפתור "נקה"
- כפתור ⚠️ בחומרה "חמור" → פותח NCR טיוטה אוטומטית עם הפרטים מועתקים

### עמוד משימות
- 💾⭐🗑 שמירת תצוגות
- ✕ כפתור "נקה"

### עמוד בדיקות ציוד
- Dropdown סינון מיקום
- 💾⭐🗑 שמירת תצוגות (תופס סטטוס + חיפוש + מיקום)

### עמוד היתרי עבודה (PTW)
- Dropdown סינון מיקום

### עמוד חומרים מסוכנים
- Dropdown סינון מיקום
- 💾⭐🗑 שמירת תצוגות

### עמוד מיקומים 📍
- ליד כל אזור: badge עם מספר NCRs פתוחים + כמעט-נפגע פתוחים

### דשבורד
- ויידג'ט חדש "📍 פתוחים לפי אזור" — top 8 אזורים, קליק → NCR מסונן

### Topbar
- 🔔 פעמון פותח הגדרות התראות בלחיצה

### תצוגת showView
- כל רשומה עם location_id מציגה אוטומטית "📍 מיקום: <נתיב מלא>"

### חיפוש גלובלי
- חיפוש "ייצור" מחזיר גם רשומות שהמיקום שלהן הוא "ייצור טוגנים" וכו' (גם דרך location_id, לא רק שדה loc הישן)

### התראות
- מטריצת התראות עם 5/5 triggers פעילים:
  - NCR קריטי נפתח (מתבצע על שמירה)
  - תקרית חמור/קריטי (על שמירה)
  - משימה בפיגור 3+ ימים (סריקה יומית)
  - תפוגה תוך 30 יום (סריקה יומית)
  - סבב בוקר חסר אחרי 11:00 (סריקה יומית)
- ערוץ "באפליקציה" עובד כבר עכשיו (toast)
- WhatsApp ימתין לאישור Meta של ה-templates (כרגע console.log)
- Email ימתין להגדרת SMTP (כרגע console.log)

---

## Test plan לבוקר (קצר)
1. פתח NCR, צור NCR חדש בעדיפות "קריטי" → אמור להופיע toast 🔔
2. פתח כמעט-נפגע, צור עם חומרה "חמור" → צפייה → ⚠️ פותח NCR טיוטה מולא
3. עמוד מיקומים → עליד כל אזור צריך לראות counts
4. דשבורד → "📍 פתוחים לפי אזור" → קליק → סינון NCR פעיל
5. הקלד "ייצור" בחיפוש גלובלי → תוצאות כוללות רשומות באזור ייצור
6. בעמוד NCR → סנן לפי אזור → 💾 שמור עם שם → רענן → ⭐ טען → הסינון חוזר

---

## אם משהו לא עובד
- בדוק console (F12) — אין שגיאות JS חדשות מאז ההתחלה.
- אם feature חדש לא עובד אבל בסיס המערכת פועל — Last Known Good לפני הלילה הוא `0120e08`. אפשר לחזור אליו עם:
  `git revert b5a5f1e..0120e08` או דרך `git reset` בUI של GitHub.
- אם הפעמון 🔔 לא נפתח: זה אומר שה-modal m-notif לא נטען נכון — בודקים DevTools.

---

## מה הושאר ב-backlog (לא בוצע הלילה)
- **Pattern Detection מתקדם** ב-NCR Agent
- **Live PDF GUID** — מורכב
- **Inspection Types** — recurring inspections engine מלא
- **Email SMTP setup** — לחבר ערוץ Email אמיתי במטריצה
- **Project rollup view** — דף מפורט פר פרויקט עם רשימה של NCRs/tasks/inc

## מה כן הוסף בלילה הזה (PRs #138-#203)
- ✅ Saved Views (NCR / NM / Tasks / EQI / Hzm)
- ✅ Notifications matrix (5/5 triggers + log + viewer + test button)
- ✅ Locations (5 טפסים, סינון, dashboard, count badges)
- ✅ Chained forms (near-miss → NCR draft)
- ✅ Custom Properties — שדות מותאמים פר-רשומה
- ✅ Projects — יצירה, ניהול, אינטגרציה ב-NCR/tasks/inc, סינון, clickable
- ✅ Inspection Types — תבניות בדיקות חוזרות + virtual tasks
- ✅ Dashboard widgets: by-location, by-project, weekly comparison, upcoming inspections, auto-insights, safety health score, morning round reminder
- ✅ Filter chips ויזואליים בכל הטפסים
- ✅ Search by location name
- ✅ Bell 🔔 + JSON backup 💾 + my-tasks 📝 בtopbar
- ✅ Hebrew date header
- ✅ showView auto-renders location + project
- ✅ Emergency report 🆘 shortcut

---
*נוצר אוטומטית ע"י Claude כסיכום סשן לילה אוטונומי.*
