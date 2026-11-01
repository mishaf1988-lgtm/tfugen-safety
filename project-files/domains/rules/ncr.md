# כל כללי הענף: אי-התאמות ופעולות מתקנות

נבנה 01/11/2026 מסריקה של כל קבצי ה-md, ה-skills, הכללים, נהלי העוזר והסוכנים (מיכאל: "תעבור על כל מה שרשום ... ובכלל כל קובץ"). כל שורה: הכלל בקצרה, והמקור שבו הוא כתוב במלואו. התיק הקצר: `project-files/domains/ncr.md`. כלל חדש בענף נכנס גם לכאן.

## כללים מכל הקבצים
- `ncr.d` הוא תיאור, התאריך ב-`sd`; אין עמודה `src_date` (`.claude/skills/tfugen-ref/SKILL.md:28`)
- קישור כמעט ונפגע או ביקורת ל-NCR: בלי עמודה, מספר ה-NCR נכתב לטקסט המקור (`nm.notes`, `aud.sm`) (`.claude/skills/tfugen-ref/references/gotchas.md:19`)
- קטגוריית הסיבה (אדם, נוהל, ציוד, סביבה) היא סיווג; הטקסט צריך להסביר (`.claude/skills/tfugen-ncr-writing/SKILL.md:21`)
- שינוי prompt: להעביר את כל הקשר הטופס, לאסור ניסוחים כלליים, תווי מקלדת, ולבדוק מה נשלח (`.claude/skills/tfugen-ncr-writing/SKILL.md:37`)
- כפתור AI חדש: `_aiThin`, `_AI_THIN_RULE`, `_AI_THIN_ANS` (5-Why: `_AI_FW_RULE`), ושורה ב-`ai-thin-guard-test.js` (`.claude/skills/tfugen-ncr-writing/SKILL.md:43`)

## כל ההחלטות של הענף
`grep -P "\tncr$" project-files/domains/decisions-map.tsv` (מספר שורה ב-DECISIONS.md וכותרת).

## קבצים שעוסקים בענף
- `.claude/hooks/README.md`: טבלת כל ה-hooks ומה כל אחד חוסם (SQL על ncr/trustee_reports, כתיבה ב-365, מסמך בלי החלטות).
- `.claude/skills/tfugen-db/SKILL.md`: עבודה מול המסד החי, migration, routine-db, שלוש רמות גישה ל-OneDrive, מחיקה ב-del_ask.
- `.claude/skills/tfugen-history/SKILL.md`: רקע: Vercel, 375 שורות ה-ncr, שני חשבונות, מדיניות סיסמאות.
- `.claude/skills/tfugen-ncr-writing/SKILL.md`: איך כותבים NCR שאפשר לעבוד איתו, ומה בונים ב-prompt של ה-AI.
- `.claude/skills/tfugen-ref/SKILL.md`: מפת טבלאות, עזרים, מילון עברית ושלדי קוד.
- `.claude/skills/tfugen-ref/references/gotchas.md`: מלכודות בקוד ובנתונים לפי אזור (תפוגות, מצגת, נאמנים, טפסי כבאות, נבו).
- `.claude/skills/tfugen-screen-review/SKILL.md`: רשימת בדיקה לצילום מסך ולתשובות העוזר.
- `project-files/BACKLOG.md`: תור השדרוגים 09/2026 (75 פריטים, כולם סגורים) וסבבי בדיקה 9-14.
- `project-files/CLAUDE-detail.md`: הגרסה הארוכה של CLAUDE.md עם הנימוקים.
- `project-files/OVERNIGHT-2026-05-02.md`: סשן לילה 05/2026 (היסטורי).
- `project-files/lessons-archive.md`: לקחים שכבר נאכפים בקוד.

## פריטים פתוחים (נכון ל-01/11/2026)
- skill חינמי לכתיבת אי-התאמה, כרטיס ביקור (`STATUS.md:199`)
