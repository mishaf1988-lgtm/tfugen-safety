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
- ✅ 1. Expiries Agent — דף פקיעות וחידושים (2026-04-17)

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
| Git Tag | stable-2026-04-17-0900 |
| תאריך | 2026-04-17 |
| מצב | כל 19 מודולים + 17 טבלאות תקינים + Expiries Agent |

---

## 🤖 הערות לריצה הבאה

✅ Expiries Agent הושלם בהצלחה (2026-04-17).
- דף חדש `pg-exp` נוסף עם KPI grid + filter tabs + טבלה מאוחדת
- מקורות נתונים: docs, tr, ppe, med, ctr (שדה `e`)
- לחצן ניווט `bn-exp` נוסף לתחתית
- Branch: routine/expiries-agent-2026-04-17-0900

🔄 הבאה בתור: NCR/CAPA Agent (משימה 2)
- לבנות modal/דף עם ניתוח AI של NCR records
- לחבר ל-ncr-agent.js הקיים
- לשפר את ה-UI של ה-agent הקיים

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
- Hebrew as \uXXXX
- Empty dates → null
- Pattern: askDel + showView + VIEW_CONFIG
```
