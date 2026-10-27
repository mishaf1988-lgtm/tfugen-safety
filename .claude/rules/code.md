---
paths:
  - "index.html"
  - "functions/**/*.js"
  - "tools/**"
---
# כללי קוד (מ-CLAUDE.md, 27/10/2026)

1. עברית ב-JS strings = `\uXXXX`, אף פעם לא תווים גולמיים (`raw-hebrew.py` מזהיר).
2. תאריך ריק = `null`, אף פעם לא `''`.
3. שדה תפוגה = `e` בכל הטבלאות (`ppe`, `med`, `tr`, `docs`, `ctr`, `equip_inspections`), פורמט `YYYY-MM-DD`.
4. עזרים קיימים, לא לשכפל: `fd(d)` תצוגה DD/MM/YYYY, `du(d)` ימים עד תפוגה, `eb(d)` badge, `askDel(table, id)`, `goPage(name)`, `showView(table, id)`.
5. בלי קבצי HTML נוספים (חריג: `/chat`, `functions/chat.js`), בלי framework, build או bundler.
6. טקסט שאנשים קוראים (הודעה באפליקציה, מייל, PDF): רק תווים שיש במקלדת, ראה `.claude/rules/people-text.md`.
