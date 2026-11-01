# כל כללי הענף: ISO ומסמכי מערכת

נבנה 01/11/2026 מסריקה של כל קבצי ה-md, ה-skills, הכללים, נהלי העוזר והסוכנים (מיכאל: "תעבור על כל מה שרשום ... ובכלל כל קובץ"). כל שורה: הכלל בקצרה, והמקור שבו הוא כתוב במלואו. התיק הקצר: `project-files/domains/iso.md`. כלל חדש בענף נכנס גם לכאן.

## כללים מכל הקבצים
- שורות ISO אפורות (`na`) כשריקות לפי DECISIONS 30/09/2026; לא להפוך לאדום בלי לשאול (`.claude/skills/tfugen-ref/references/gotchas.md:13`)
- יעד (`_OBJECTIVES`) על מרשם בלי שורות = `na`, לא 0% (`.claude/skills/tfugen-ref/references/gotchas.md:15`)
- "עותק נקי" נבדק בספירת `w:ins`/`w:del`, לא בקריאה; קבלת שינויים ב-`accept_docx.py` ובדיקת מספר עמודים (`.claude/skills/tfugen-db/SKILL.md:82`)
- Excel נשאר Excel בלי PDF; `.doc` בלי שינויים במעקב נשמר כמו שהוא (`.claude/skills/tfugen-db/SKILL.md:82`)
- עדכון קובץ קיים = שם חדש עם תאריך והקודם ל-`od_archive`; הפניה בקבצי md לפי תחילית השם (`.claude/skills/tfugen-db/SKILL.md:80`)
- קובץ דיגיטלי בלי חתימה אינו פער (החתימה על נייר); פער = חסר, לא עודכן, תוכן שגוי (`.claude/skills/tfugen-dev/references/lessons.md:244`)
- שם בעל תפקיד במסמך חדש מהמסמך העדכני ביותר, לא מהמקור שמעתיקים (`.claude/skills/tfugen-dev/references/lessons.md:150`)
- קובץ Office שכלי בנה נבדק בפתיחה אצל Microsoft (`od-read` `format: pdf`), לא רק ב-LibreOffice (`.claude/skills/tfugen-dev/references/lessons.md:262`)
- אחרי `track_docx`: להדפיס את רשימת `delText`/`ins` ולוודא שרק מה ששונה מסומן (`.claude/skills/tfugen-dev/references/lessons.md:268`)
- מסמך של העוזר: קובץ אחד לכל מסמך, Arial (לא David), PDF לצפייה לצידו (`.claude/skills/tfugen-dev/references/lessons.md:341`)
- "עמוד X מתוך Y" תואם `pdfinfo`, אחרת `page_fields.py` (`.claude/skills/tfugen-dev/references/lessons.md:406`)
- איתור חוק בנבו: WebSearch עם `allowed_domains` ובלי `site:`; סעיף או מועד = WebFetch שני "מילה במילה" (`.claude/skills/tfugen-ref/references/gotchas.md:30`)
- מספר למסמך מבוקר חדש רק ממנהלת האיכות; בכל עמוד: חברה, שם, מספר, תאריך, עמוד X מתוך Y, מחבר; בסוף מאשר (`project-files/iso-audit-prep.md:9`)
- קובץ בלי חתימה גלויה אינו פער (חתימות על נייר בקלסר, לקח 148) (`project-files/iso-audit-prep.md:33`)
- לא לכתוב "חסר" בלי חיפוש במייל ובתיקייה; לא לצטט סעיף תקן מהזיכרון (`project-files/iso-audit-prep.md:56`)
- המקור לציטוט = העותק ב"ניהול בטיחות", לא הכפילויות ב-ISO הכל או 90_ארכיון (`project-files/iso-audit-prep.md:42`)
- חלוקה: נוהל עבודה בחום, קבלנים והרשאות = מיכאל; מספרים כפולים ורשימת אב 02.01 = מנהלת האיכות (`project-files/iso-audit-prep.md:49`)
- תאריך נוהל = מהכותרת שבתוך המסמך, לא משם הקובץ (`project-files/iso-forms-index.md:15`)
- המפקח המדומה: כל "לא הוכח" נכנס ל-STATUS ונבדק שוב בחודש הבא; בלי שמות עובדים (`project-files/mock-inspection.md:4`)

## כל ההחלטות של הענף
`grep -P "\tiso$" project-files/domains/decisions-map.tsv` (מספר שורה ב-DECISIONS.md וכותרת).

## קבצים שעוסקים בענף
- `.claude/skills/tfugen-db/SKILL.md`: עבודה מול המסד החי, migration, routine-db, שלוש רמות גישה ל-OneDrive, מחיקה ב-del_ask.
- `.claude/skills/tfugen-dev/references/lessons.md`: לקחי הפיתוח, כולל מסמכי מפעל, טיוטות, זרימות, שעון ישראל.
- `.claude/skills/tfugen-ref/references/gotchas.md`: מלכודות בקוד ובנתונים לפי אזור (תפוגות, מצגת, נאמנים, טפסי כבאות, נבו).
- `project-files/briefs/owner-sign.md`: חתימה בשם מיכאל על PDF אחרי "בצע".
- `project-files/iso-audit-prep.md`: ידע להתעדה מחדש 2027: תעודות, פערים, סטטוס IQC.
- `project-files/iso-forms-index.md`: מפתח כל הטפסים המבוקרים ובעיות בנהלים.
- `project-files/mock-inspection.md`: דוחות המפקח המדומה (10/2026: 2 מתוך 5).
- `tools/platform/agents/inspector.md`: סוכן המפקח המדומה של המוצר.

## פריטים פתוחים (נכון ל-01/11/2026)
- המפקח המדומה: תכנית ניהול בטיחות, חתימה והתייעצות עם הוועדה (`STATUS.md:93`)
- מרשם החוקים מנבו: הצעה לאישור (`STATUS.md:73`)
- קניית נוסח ISO 14001:2026 לפני המבדק הפנימי (`STATUS.md:198`)
- רעיונות 1, 5, 6 (מפקח מדומה, לוח מודעות, שרשרת שינוי חוק) (`STATUS.md:86`)
