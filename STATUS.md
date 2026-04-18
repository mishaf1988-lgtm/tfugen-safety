# TFUGEN Safety — STATUS

> מצב הפרויקט. מתעדכן אחרי כל משימה. Claude: קרא **קודם** את `CLAUDE.md`, ואז את הקובץ הזה.

**Last updated**: 2026-04-17
**Repo**: `mishaf1988-lgtm/tfugen-safety` · **Live**: https://tfugen-safety.vercel.app

---

## 🔖 Last Known Good

| שדה | ערך |
|---|---|
| Commit | `4bfcd32` (main) |
| תאריך | 2026-04-17 |
| Tag | `stable-2026-04-17-expiries` |
| מצב | 17 טבלאות OK · Expiries Agent עובד · Skills + CLAUDE.md פעילים |

---

## ✅ הושלם

- [x] Supabase sync — 17 טבלאות מחזירות 200 OK
- [x] 375 רשומות NCR הועלו
- [x] **Expiries Agent** (PR #4) — דף `pg-exp` מאוחד + התראות dashboard משודרגות
- [x] **Skill `tfugen-dev`** — אכיפת חוקי פיתוח אוטומטית
- [x] **תשתית סנכרון** — CLAUDE.md + DECISIONS.md

---

## 📋 תור משימות

### 🔴 עדיפות גבוהה
- [ ] **2. NCR/CAPA Agent** — ניתוח AI של NCR פתוחים + המלצות CAPA
- [ ] **3. Incident Investigation Agent** — 5 Whys אוטומטי + סיווג TRIR

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
