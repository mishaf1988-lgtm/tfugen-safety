# TFUGEN Safety — Claude Code Routine Status
# Last updated: 2026-04-17
# Repo: mishaf1988-lgtm/tfugen-safety
# Live: https://tfugen-safety.vercel.app

---

## ✅ הושלם

- Supabase sync — כל 17 טבלאות מחזירות 200 OK
- 375 רשומות NCR הועלו
- סקירה מקיפה של הפרויקט הושלמה
- מפת חיבורים תועדה
- ✅ **1. Expiries Agent** — הושלם 2026-04-17

---

## 📋 תור משימות

### 🔴 עדיפות גבוהה
- [x] 1. Expiries Agent
- [ ] 2. NCR/CAPA Agent
- [ ] 3. Incident Investigation Agent

### 🟡 עדיפות בינונית
- [ ] 4. ISO Compliance Agent
- [ ] 5. WhatsApp Meta API
- [ ] 6. NCR table debug
- [ ] 6b. Fix NCR Agent v3

### 🟢 עדיפות נמוכה
- [ ] 7. Agent Dashboard
- [ ] 8. UX improvements
- [ ] 9. Mobile optimization
- [ ] 10. Export to PDF

---

## 🔖 Last Known Good

| שדה | ערך |
|-----|-----|
| Git Tag | stable-2026-04-17-0200 |
| תאריך | 2026-04-17 |
| מצב | כל 19 מודולים + 17 טבלאות תקינים + Expiries Agent |

---

## 🤖 הערות לריצה הבאה

✅ Expiries Agent הושלם בהצלחה.

**מה נבנה:**
- דף חדש `pg-exp` — סוכן פקיעות מאוחד
- כפתור ניווט תחתון עם אייקון שעון (פקיעות)
- רשת KPI: פג תוקף / קריטי (≤7י) / אזהרה (≤30י) / תקין (≤60י)
- כפתורי סינון: הכל / פג / קריטי / אזהרה / קרוב
- סריקה מ-7 טבלאות: docs, tr, ppe, med, ctr, hzm, ptw
- עדכון ווידג'ט פקיעות בדשבורד — כולל PPE, med, ctr, hzm + קישור לסוכן

**הבא:**
- משימה 2: NCR/CAPA Agent — בניית ממשק agent עם ניתוח AI לאי-התאמות
- אפשר להסתמך על ncr-agent.js הקיים כבסיס

---

## 🤖 Prompt for Claude Code Routine

```
Read STATUS.md from repo root.
Work on next unchecked task.
Create branch: routine/TASK-NAME-YYYY-MM-DD

When done:
1. Verify all 17 tables return 200 OK
2. Verify app loads without errors
3. Update STATUS.md
4. Create git tag: stable-YYYY-MM-DD
5. Push tag and open PR

Rules:
- Single-file HTML app
- Hebrew as \uXXXX in JS (HTML entities in HTML)
- Empty dates → null
- Pattern: askDel + showView + VIEW_CONFIG
```
