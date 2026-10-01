# Checklist לפני PR

עודכן 01/10/2026 (המלצה 28). הגרסה הקודמת הפנתה ל-17 טבלאות שלא קיימות ולכתובת Vercel שנמחקה.

## לפני commit

- [ ] `git fetch origin main` ו-`git log HEAD..origin/main` ריק (או עבודה על main העדכני)
- [ ] `git diff`: שינויים קטנים וממוקדים בלבד
- [ ] אין עברית גולמית בתוך `<script>` או בקבצי `functions/` (רק `\uXXXX`). ה-hook `raw-hebrew.py` מזהיר, `rule1-hebrew-test.js` בודק
- [ ] תאריך ריק = `null`, לא `''`
- [ ] טקסט לאנשים (הודעות באפליקציה, מיילים, PDF): רק תווי מקלדת, בלי מקף ארוך, בלי «»
- [ ] בדיקה חדשה או מעודכנת לשינוי, ושבירה מכוונת שלה נכשלת
- [ ] אם ה-PR מתקן טעות שהתגלתה: כותרת שמתחילה ב-Fix, ולקח חדש ב-`.claude/skills/tfugen-lessons/SKILL.md` באותו PR (ואם אפשר, hook או בדיקה). טעות שחזרה: להעלות `חזר:` בלקח הקיים. אין מה ללמוד? שורה `בלי לקח: <סיבה>` בתיאור ה-PR

## הבדיקות

- [ ] מקומית, לשינוי שנוגע במשהו: `NODE_PATH=/opt/node22/lib/node_modules:/opt/node-tools/node_modules bash tests/harness/run.sh <שם>`
- [ ] **ב-GitHub: בדיקת `tests` ירוקה על ה-PR** (`.github/workflows/tests.yml`, 4 קבוצות במקביל). זה התנאי למיזוג, וה-hook `merge-gate.py` אוכף אותו

## migration / Supabase

- [ ] הקובץ ב-`migrations/YYYY-MM-DD_name.sql`, בטוח להרצה חוזרת
- [ ] הורץ דרך ה-Connector ואומת (policies / עמודות / cron.job / ספירת שורות). רק אז `[x]` ב-STATUS (כלל 7)
- [ ] מחיקת שורות, DROP, שינוי RLS policy קיימת: אישור מפורש של מיכאל מראש

## אחרי מיזוג

- [ ] STATUS.md עודכן (DD/MM/YYYY), ו-DECISIONS.md אם יש החלטה
- [ ] האתר היחיד: https://tapugan-safety.pages.dev (מהענן חסום, מיכאל או Claude in Chrome בודקים)
