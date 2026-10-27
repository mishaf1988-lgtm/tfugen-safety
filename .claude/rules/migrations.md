---
paths:
  - "migrations/**"
---
# migration (מ-CLAUDE.md, 27/10/2026)

- Claude מריץ בעצמו דרך Supabase MCP ואז מאמת (policies, עמודות, ספירת שורות). `[x]` ב-`STATUS.md` רק אחרי אימות, עם המילה "אומת" (`rule7-gate.py`). `IF NOT EXISTS` לא מוכיח שהפעולה בוצעה.
- גיבוי לפני שינוי סכמה בטבלה עם נתונים (תקדים: `backup_ops_20260918`, `ins_backup_20260918`).
- פעולה הרסנית (`DROP`, `DELETE`, `TRUNCATE`, `DROP COLUMN`, שינוי RLS קיימת) = אישור מפורש מראש. מחיקה מ-`ncr`, `ncr_ai`, `trustee_reports` אסורה גם עם אישור.
- שם הקובץ `YYYY-MM-DD_<נושא>.sql`. הפירוט: skill `tfugen-db`.
