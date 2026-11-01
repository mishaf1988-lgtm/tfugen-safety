# כל כללי הענף: תאונות, תחקירים וכמעט תאונה

נבנה 01/11/2026 מסריקה של כל קבצי ה-md, ה-skills, הכללים, נהלי העוזר והסוכנים (מיכאל: "תעבור על כל מה שרשום ... ובכלל כל קובץ"). כל שורה: הכלל בקצרה, והמקור שבו הוא כתוב במלואו. התיק הקצר: `project-files/domains/accidents.md`. כלל חדש בענף נכנס גם לכאן.

## כללים מכל הקבצים
- תאונת דרך נספרת ומסומנת "מחוץ לשטח המפעל" (`.claude/skills/safety-committee-builder/SKILL.md:45`)
- שורה בטבלת התאונות: לקרוא את נוסחאות הסיכום, מחלקה מוכרת ו"דיווח" לא ריק; אחרי: הפילוח = הסה"כ (`.claude/skills/tfugen-db/references/lessons.md:11`)
- `near_miss` עם עמודה `t`: לא להשתמש ב-`t` כ-alias (`.claude/skills/tfugen-screen-review/SKILL.md:33`)

## כל ההחלטות של הענף
`grep -P "\taccidents$" project-files/domains/decisions-map.tsv` (מספר שורה ב-DECISIONS.md וכותרת).

## קבצים שעוסקים בענף
- `.claude/skills/safety-committee-builder/SKILL.md`: בניית מצגת הוועדה והפרוטוקול: מקורות, הצלבות, חוקי תוכן, תבנית, מלכודות pptx/docx.
- `.claude/skills/tfugen-db/references/lessons.md`: לקחי המסד וה-Routines (הצלבת מידע, Excel עם סיכום, טריגר הנאמנים, תיוק).
- `.claude/skills/tfugen-dev/references/lessons.md`: לקחי הפיתוח, כולל מסמכי מפעל, טיוטות, זרימות, שעון ישראל.
- `.claude/skills/tfugen-ncr-writing/SKILL.md`: איך כותבים NCR שאפשר לעבוד איתו, ומה בונים ב-prompt של ה-AI.
- `project-files/CHROME-HAZARD-TOURS.md`: הוראות לכרום: איתור תיקיית סיורי המפגעים וקובץ התאונות (28/09/2026).
- `project-files/COWORK-HAZARD-TOURS.md`: הוראות ל-Cowork במעבר סיורי המפגעים לאפליקציה (28/09/2026).
- `project-files/mock-inspection.md`: דוחות המפקח המדומה (10/2026: 2 מתוך 5).
- `tools/platform/agents/trends.md`: סוכן המגמות ומדד מקדים לתרבות הבטיחות.

## פריטים פתוחים (נכון ל-01/11/2026)
- המפקח המדומה: הודעה בכתב למפקח על תאונה 19/05/2026 (`STATUS.md:95`)
