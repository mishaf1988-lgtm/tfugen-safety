# כל כללי הענף: נאמני בטיחות וקיוסק

נבנה 01/11/2026 מסריקה של כל קבצי ה-md, ה-skills, הכללים, נהלי העוזר והסוכנים (מיכאל: "תעבור על כל מה שרשום ... ובכלל כל קובץ"). כל שורה: הכלל בקצרה, והמקור שבו הוא כתוב במלואו. התיק הקצר: `project-files/domains/trustees.md`. כלל חדש בענף נכנס גם לכאן.

## כללים מכל הקבצים
- `trustee_reports` ו-`near_miss` עם עמודה `t`: ב-SQL `json_agg(x)`, לא `t` (`.claude/skills/tfugen-screen-review/SKILL.md:33`)
- לפני החלפת פונקציית טריגר (`trustee_reports_close_ref` ב-`private`): `pg_trigger` ולהחליף בדיוק אותה, ולאמת ב-ROLLBACK (`.claude/skills/tfugen-db/references/lessons.md:67`)
- קוד שסוגר ליקוי שולח את `closed_d` בעצמו, לא סומך על הטריגר (סגירה ממייל עם `u` שונה) (`.claude/skills/tfugen-db/references/lessons.md:73`)
- `trustee-notify`/`trustee-log` דורשים `x-notify-secret`, וחסר = 403 (fail closed) (`.claude/skills/tfugen-ref/references/gotchas.md:24`)
- שורת נאמן היא ליקוי רק עם `ok:false`; `showView('trustee_reports')` נופל לרשימה המלאה (`.claude/skills/tfugen-ref/references/gotchas.md:36`)
- נקודה אמצעית ב-`trustee_reports.loc` וב-`mgr_note` היא מפריד נתונים, לא להחליף בפסיק (`.claude/skills/tfugen-ref/references/gotchas.md:61`)
- בצילומי המדריך: שמות בדויים, תוכן אמיתי; עכבר לפינה לפני צילום (`.claude/skills/tfugen-guides/SKILL.md:28`)
- ליקוי נאמן (`trustee_reports`) נסגר רק מהאפליקציה, לא ב-`tour_close_ask` (`project-files/wa-topics/ops.md:17`)
- דיווח נאמן עם `s` סגור ו-`closed_d` ריק לא נכנס ל"אמרתם, עשינו" (`project-files/agent-log.md:33`)
- ניקוד: 10 לכל משימה, 2 לכל מפגע שנסגר (עד 20), זכאות מ-5 משימות; שינוי קבוע = עדכון המדריך (`project-files/guide-trustees/README.md:145`)
- דיווח נאמן לעולם לא נזקף לחובת הנאמן או המחלקה (`project-files/SPEC-trustees-2026-09-18.md:51`)
- ליקוי בלי תמונה לא נשלח (`project-files/SPEC-trustees-2026-09-18.md:23`)
- סכנה מיידית: טלפון לממונה, לא דיווח במערכת (גם בכל הודעה ומדריך) (`project-files/guide-trustees/README.md:87`)
- קוד הנאמנים לא נכנס למדריך; נמסר בהודעה נפרדת (`project-files/guide-trustees/README.md:186`)
- מסך שהשתנה: לצלם מחדש לפני תיקון הטקסט במדריך (`project-files/guide-trustees/README.md:65`)
- התראה על דיווח: "מפגע" או "ליקוי", לעולם לא "תקרית" ולא "מיידית", בלי 🚨 (`project-files/WHATSAPP-TEMPLATE.md:75`)
- סדר פרמטרי התבנית קבוע: מדווח, סוג, מיקום, ממצא (`trustee-notify-test.mjs`) (`project-files/WHATSAPP-TEMPLATE.md:93`)
- לא לשמור טלפון בטבלת `trustees` (קריאה לקיוסק האנונימי) (`project-files/privacy-map.md:28`)
- בלי דחיפת וואטסאפ לנאמנים (נדחה 19/09/2026) (`project-files/BACKLOG.md:186`)

## כל ההחלטות של הענף
`grep -P "\ttrustees$" project-files/domains/decisions-map.tsv` (מספר שורה ב-DECISIONS.md וכותרת).

## קבצים שעוסקים בענף
- `.claude/hooks/README.md`: טבלת כל ה-hooks ומה כל אחד חוסם (SQL על ncr/trustee_reports, כתיבה ב-365, מסמך בלי החלטות).
- `.claude/rules/people-text.md`: טקסט לאנשים רק בתווי מקלדת, תאריך בשם קובץ DD-MM-YYYY.
- `.claude/skills/safety-committee-builder/SKILL.md`: בניית מצגת הוועדה והפרוטוקול: מקורות, הצלבות, חוקי תוכן, תבנית, מלכודות pptx/docx.
- `.claude/skills/tfugen-db/SKILL.md`: עבודה מול המסד החי, migration, routine-db, שלוש רמות גישה ל-OneDrive, מחיקה ב-del_ask.
- `.claude/skills/tfugen-db/references/lessons.md`: לקחי המסד וה-Routines (הצלבת מידע, Excel עם סיכום, טריגר הנאמנים, תיוק).
- `.claude/skills/tfugen-guides/SKILL.md`: בניית מדריכי המשתמש (נאמנים, משאבי אנוש ומנהלים, הדרכה שנתית) עם צילומים.
- `.claude/skills/tfugen-ref/references/gotchas.md`: מלכודות בקוד ובנתונים לפי אזור (תפוגות, מצגת, נאמנים, טפסי כבאות, נבו).
- `.claude/skills/tfugen-screen-review/SKILL.md`: רשימת בדיקה לצילום מסך ולתשובות העוזר.
- `project-files/assistant/committee.md`: נוהל ועדת הבטיחות: איסוף, הצלבות, מצגת, פרוטוקול, שמירה, והתאמה לענן.
- `project-files/routine-factory-trends.md`: מגמות חודשיות ומדד מקדים מחמש הטבלאות, ותיק המקרים.
- `project-files/routine-talk-field.md`: "מה קרה אצלנו השבוע" ו"אמרתם, עשינו" בטיוטת ההדרכה השבועית.
- `project-files/wa-topics/ops.md`: משימת עובד, מפגעים, ציוד, תאונה, פיתוח, כרטיס פריט, סגירת ליקוי סיור.
- `project-files/BACKLOG.md`: תור השדרוגים 09/2026 (75 פריטים, כולם סגורים) וסבבי בדיקה 9-14.
- `project-files/CLAUDE-detail.md`: הגרסה הארוכה של CLAUDE.md עם הנימוקים.
- `project-files/HANDOFF-2026-09-19.md`: העברת הקשר אחרי בניית פלטפורמת הנאמנים.
- `project-files/ONEDRIVE-SERVER-SETUP.md`: חיבור OneDrive לשרת ליומן הנאמנים.
- `project-files/PENTEST-2026-09-24.md`: בדיקת חדירה ותיקונים.
- `project-files/SPEC-trustees-2026-09-18.md`: מפרט פלטפורמת הנאמנים: טבלה, משימות, ניקוד, מסכים.
- `project-files/VITRE-API.md`: תמצית ה-API של Vitre.
- `project-files/VITRE-QUESTIONS.md`: שאלות לספק Vitre ומה עושים עם כל תשובה.
- `project-files/WHATSAPP-TEMPLATE.md`: תבנית Meta להתראת דיווח בטיחות.
- `project-files/guide-trustees/README.md`: מקור מדריך הנאמנים והכרטיס המהיר.
- `project-files/privacy-map.md`: מיפוי מידע אישי וטיוטת הודעה לעובדים.
- `tools/platform/agents/talk-field.md`: סוכן "מה קרה אצלנו השבוע" בהדרכה השבועית.
- `tools/vm-notifier/README.md`: סקריפט מייל על ליקוי נאמן מהמחשב הווירטואלי.

## פריטים פתוחים (נכון ל-01/11/2026)
- נעילת ניחוש קוד: מייל ופתיחה מהכרטיס (`STATUS.md:20`)
- נעילה על ניחוש קוד, משאבי אנוש ונאמנים (`STATUS.md:41`)
- ניתוב לפני שליחת הדוח, לממונה ולנאמנים (`STATUS.md:76`)
- קישור "סמן כטופל" (לבדיקת מיכאל) (`STATUS.md:129`)
