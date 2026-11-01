# כל כללי הענף: מיילים וספקים

נבנה 01/11/2026 מסריקה של כל קבצי ה-md, ה-skills, הכללים, נהלי העוזר והסוכנים (מיכאל: "תעבור על כל מה שרשום ... ובכלל כל קובץ"). כל שורה: הכלל בקצרה, והמקור שבו הוא כתוב במלואו. התיק הקצר: `project-files/domains/mail.md`. כלל חדש בענף נכנס גם לכאן.

## כללים מכל הקבצים
- קובץ שקיים רק במייל: ישר `mail_request`; `mailAtt` ב-od-read תמיד 403 (`.claude/skills/tfugen-db/references/lessons.md:123`)
- לשרת אין `Mail.Read`: כל מה שצריך לקרוא מייל (שולח, שרשור, `reply_to`) עובר לעוזר; לבדוק `hasMailRead` לפני תכנון (`.claude/skills/tfugen-cloud-connect/SKILL.md:32`)
- חיפוש שלא מצא: לפחות שלוש דרכים (שולח, טווח תאריכים, שם קובץ) לפני "חסר"; חשבונית אינה דוח (`.claude/skills/tfugen-dev/references/lessons.md:207`)
- "אין" או "לא נשלח": חיפוש עם `afterDateTime` בכל התיקיות, ולכל טענה המקור (`.claude/skills/tfugen-screen-review/SKILL.md:61`)
- לפני "הזרימה לא עבדה": רשימת ההחרגה ב-`power-automate-mail.md`, לא לבקש שוב את הקובץ, היסטוריית הריצות (`.claude/skills/tfugen-dev/references/lessons.md:391`)
- תיקייה שרק זרימה קוראת ממנה נכנסת ל-`ניהול בטיחות\_אוטומציה\` (`OD_AUTO_DIRS`) (`.claude/skills/tfugen-dev/references/lessons.md:370`)
- שעה ממייל מומרת בפקודה (`TZ=Asia/Jerusalem date`), לא בראש; בטקסט העוזר עם UTC (`.claude/skills/tfugen-dev/references/lessons.md:317`)
- כתובת ספק: מהמסמך שהבקשה עונה עליו ("לתיאום פנו ל"), ולכתוב למיכאל מאיפה הכתובת (לקח 129) (`project-files/lessons-archive.md:151`)
- טיוטה שנכשלה ב-timeout: מפתח קבוע מהתוכן לפני ניסיון חוזר, אחרת טיוטה כפולה (לקח 127) (`project-files/lessons-archive.md:147`)
- תיוק מהמייל: "הכל חוץ מהחרגה" עם דוח על מה שלא נקלט, לא רשימה סגורה של שולחים (לקח 76) (`project-files/lessons-archive.md:131`)
- לפני מייל לספק לשאול "מה מיכאל צריך מהספק", לא "מה לא מסתדר לי" (לקח 128) (`project-files/lessons-archive.md:149`)

## כל ההחלטות של הענף
`grep -P "\tmail$" project-files/domains/decisions-map.tsv` (מספר שורה ב-DECISIONS.md וכותרת).

## קבצים שעוסקים בענף
- `.claude/hooks/README.md`: טבלת כל ה-hooks ומה כל אחד חוסם (SQL על ncr/trustee_reports, כתיבה ב-365, מסמך בלי החלטות).
- `.claude/skills/tfugen-cloud-connect/SKILL.md`: חיבור שירות חיצוני מהענן (Network secret, Cloudflare, Routine), ושלשרת אין קריאת מייל.
- `.claude/skills/tfugen-db/references/lessons.md`: לקחי המסד וה-Routines (הצלבת מידע, Excel עם סיכום, טריגר הנאמנים, תיוק).
- `.claude/skills/tfugen-dev/SKILL.md`: כללי פיתוח, הדרכות (closed_at/form_at, סוגי הדרכה), נמעני המנהלים.
- `.claude/skills/tfugen-dev/references/lessons.md`: לקחי הפיתוח, כולל מסמכי מפעל, טיוטות, זרימות, שעון ישראל.
- `.claude/skills/tfugen-lessons/SKILL.md`: לקחים כלליים לפי רגע (לפני טענה, לפני "חסר").
- `handoff-01-11-2026-13.33.md`: ה-handoff האחרון: ענפים, טופס 08.01 לאחזקה, קובץ 08.01 שנעלם, טיוטת אינפרה רד.
- `project-files/ACCOUNT-INVENTORY.md`: רשימת ה-Routines, הזרימות, הסודות והתיקיות שמחוץ ל-repo.
- `project-files/COWORKER-EXEC.md`: הוספת Mail.Send ב-Azure (היסטורי).
- `project-files/COWORKER-GUIDE.md`: מדריך מאוחד למיילים האוטומטיים (היסטורי).
- `project-files/COWORKER-MAIL-SETUP.md`: הרשאת Mail.Send (היסטורי).
- `project-files/IT-REQUEST-DNS.md`: רשומות DNS להתראות במייל.
- `project-files/MAIL_SETUP.md`: הגדרת שליחת מיילים מ-Outlook (היסטורי).
- `project-files/lessons-archive.md`: לקחים שכבר נאכפים בקוד.
- `tools/vm-notifier/README.md`: סקריפט מייל על ליקוי נאמן מהמחשב הווירטואלי.

## פריטים פתוחים (נכון ל-01/11/2026)
- הזרימה גרסה 2: כל שולח חוץ מהחרגה (`STATUS.md:18`)
- טיוטת מייל עם קבצים מצורפים (`STATUS.md:98`)
- `reply_to` שהוא טיוטה (C70) וטיוטת אינפרה רד (`handoff-01-11-2026-13.33.md:23`)
