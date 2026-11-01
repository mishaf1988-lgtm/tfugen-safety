---
paths:
  - "STATUS.md"
  - "DECISIONS.md"
  - "project-files/BACKLOG.md"
  - "project-files/STATUS-archive.md"
  - "handoff-*.md"
---
# קבצי המעקב (מ-CLAUDE.md, 27/10/2026)

- `STATUS.md` = רק מה שפתוח. פריט שנסגר עובר באותו PR ל-`project-files/STATUS-archive.md`. פריט חדש נכנס לסוף "פתוח עכשיו", לא לראשו.
- `[x]` על פעולה במסד, migration, RLS או Auth רק אחרי שאומתה (`rule7-gate.py`).
- כל החלטה ב-`DECISIONS.md` עם "נבחר: מומלץ" או "נבחר אחר: <מה>" (`decisions-chosen-test.py`).
- תאריכים ברשומות חדשות: DD/MM/YYYY.
- handoff: רק האחרון בשורש (`handoff-root-test.py`), הקודמים ב-`project-files/handoffs/`.
- החלטה חדשה ב-`DECISIONS.md` מוסיפה שורה ל-`project-files/domains/decisions-map.tsv`: `<מספר שורה>\t<הכותרת אחרי "## ">\t<ענף או general>` (`domains-test.py`, 01/11/2026).
