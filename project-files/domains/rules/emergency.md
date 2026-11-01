# כל כללי הענף: חירום, אמוניה וכיבוי אש

נבנה 01/11/2026 מסריקה של כל קבצי ה-md, ה-skills, הכללים, נהלי העוזר והסוכנים (מיכאל: "תעבור על כל מה שרשום ... ובכלל כל קובץ"). כל שורה: הכלל בקצרה, והמקור שבו הוא כתוב במלואו. התיק הקצר: `project-files/domains/emergency.md`. כלל חדש בענף נכנס גם לכאן.

## כללים מכל הקבצים
- טופס 14: המדריך חייב הסמכות שהטופס מונה; לא לסמן מסלול הסמכה במקום מיכאל (`.claude/skills/tfugen-ref/references/gotchas.md:31`)
- גפיר: דוח הבדיקה החודשי והחשבונית הם שני מיילים נפרדים; חיפוש לפי הדומיין, חשבונית אינה דוח (`.claude/skills/tfugen-ref/references/gotchas.md:46`)
- כותרת בכותרת העליונה של Word לא נראית בוואטסאפ ובטלפון: להעביר לגוף; שמות אנשי קשר מתיק המפעל העדכני (`.claude/skills/tfugen-dev/references/lessons.md:405`)
- 26.04 סעיף 11: מנעול ותג של מנהל הקירור, 0 ppm לפני פתיחה, רק מנהל הקירור מסיר (`project-files/model-compare.md:120`)
- ריקון אמוניה גזית: אישור מנהל המפעל אחרי תיאום עם הממונה במחוז (26.04 סעיפים 7, 10) (`project-files/model-compare.md:123`)
- הפלת כל מערכת הקירור: מנהל האירוע מחליט, בלי זמן קבוע (`project-files/nh3-emergency-equipment.md:106`)
- נקודת כינוס חלופית בשער חו"ג כששרוול הרוח מראה ענן לשער הראשי (`project-files/nh3-emergency-equipment.md:105`)
- לא להעלות כפער: דלתות יציאה מול יחידת הקירור, הערכה רפואית ו-fit test (מיכאל: לא רלוונטי) (`project-files/nh3-emergency-equipment.md:97`)
- ציוד חירום נכנס למרשם רק עם מדבקה או מסמך; תאריך שלא כתוב לא מומצא (`project-files/nh3-emergency-equipment.md:80`)
- מנ"פים: לא לרשום "פג תוקף" (מה שפג כנראה מחוץ למפעל); מיכאל מוסיף למרשם בעצמו (`project-files/scba-inventory.md:53`)
- חליפת Level A: בדיקה שנתית כולל לחץ מלא; מנ"פ טיפול שנתי, מכל הידרוסטטית כל 5 שנים (`project-files/scba-inventory.md:22`)
- "אושר ע"י" ב-26.03, 26.04 ו-146.03: צחי וולפוביץ, סמנכ"ל תפעול (לא איתי) (`STATUS.md:88`)
- ציוד חירום שלא במפעל: עדכון לרותם רק כטיוטה ב"בצע", ורישום הוצאה משירות (`STATUS.md:158`)

## כל ההחלטות של הענף
`grep -P "\temergency$" project-files/domains/decisions-map.tsv` (מספר שורה ב-DECISIONS.md וכותרת).

## קבצים שעוסקים בענף
- `.claude/skills/tfugen-db/SKILL.md`: עבודה מול המסד החי, migration, routine-db, שלוש רמות גישה ל-OneDrive, מחיקה ב-del_ask.
- `.claude/skills/tfugen-dev/references/lessons.md`: לקחי הפיתוח, כולל מסמכי מפעל, טיוטות, זרימות, שעון ישראל.
- `.claude/skills/tfugen-ref/references/gotchas.md`: מלכודות בקוד ובנתונים לפי אזור (תפוגות, מצגת, נאמנים, טפסי כבאות, נבו).
- `project-files/ideas-lab.md`: מעבדת הרעיונות וטבלאות החיסכון.
- `project-files/iso-audit-prep.md`: ידע להתעדה מחדש 2027: תעודות, פערים, סטטוס IQC.
- `project-files/model-compare.md`: השוואת סונט/אופוס/Haiku, כולל שאלות אמוניה וקבלנים.
- `project-files/nh3-emergency-equipment.md`: ציוד חירום אמוניה: דרישות היתר 70011, מה יש, פערים, אירועים מהענף.
- `project-files/rag-test.md`: בדיקת חיפוש חכם על נהלי האמוניה ו-146.03.
- `project-files/scba-inventory.md`: מנ"פים, מכלים וחליפות לפי מספר סידורי.

## פריטים פתוחים (נכון ל-01/11/2026)
- חתימה על 26.03, 26.04 ו-146.03 (`STATUS.md:88`)
- ציוד נשימה וחליפות לא במרשם; מחכה לתמונות צוות האמוניה (`STATUS.md:158`)
