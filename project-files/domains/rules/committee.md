# כל כללי הענף: ועדת בטיחות

נבנה 01/11/2026 מסריקה של כל קבצי ה-md, ה-skills, הכללים, נהלי העוזר והסוכנים (מיכאל: "תעבור על כל מה שרשום ... ובכלל כל קובץ"). כל שורה: הכלל בקצרה, והמקור שבו הוא כתוב במלואו. התיק הקצר: `project-files/domains/committee.md`. כלל חדש בענף נכנס גם לכאן.

## כללים מכל הקבצים
- 8 ועדות בשנה; מספר הוועדה = הקודמת ועוד אחת; התקופה המסוקרת = מיום הוועדה הקודמת עד יום הנוכחית (`.claude/skills/safety-committee-builder/SKILL.md:8`)
- מקורות קבצים לפי גיליון: תאונות רק מגיליון "מאגר תאונות", מפגעים מגיליון "מאגר מפגעים" (`.claude/skills/safety-committee-builder/SKILL.md:20`)
- ב-`trustee_reports` (וגם `near_miss`) יש עמודה `t`: ב-SQL alias אחר (`x`), לא `t` (`.claude/skills/safety-committee-builder/SKILL.md:28`)
- קבצי Excel חייבים להיות סגורים ב-Excel לפני הקריאה (`.claude/skills/safety-committee-builder/SKILL.md:32`)
- הצלבות חובה (כל תאונה מול הסיכום השבועי, אקסל מול אפליקציה, פרוטוקול קודם מול מאגר, מפגע שהוא גם סעיף), והכלל: לחפש את מה שלא קרה (`.claude/skills/safety-committee-builder/SKILL.md:36`)
- תאונת דרך נספרת ומסומנת "מחוץ לשטח המפעל" (`.claude/skills/safety-committee-builder/SKILL.md:45`)
- נתון שהשתנה מאז הוועדה הקודמת: להסביר למה (`.claude/skills/safety-committee-builder/SKILL.md:46`)
- המלצה: ספציפית, עם מספר, אחראי וקשר לנתון במצגת (`.claude/skills/safety-committee-builder/SKILL.md:47`)
- כפילויות יורדות: נתון בשתי שקופיות, או שהוצג בוועדה הקודמת ולא השתנה; המצגת מציגה רק מה שהשתנה (`.claude/skills/safety-committee-builder/SKILL.md:48`)
- תבנית גרפית קבועה: 13.333x7.5, Blank, Arial, כל פסקה rtl, הצבעים וצבעי הסטטוסים שבסעיף 5 (`.claude/skills/safety-committee-builder/SKILL.md:52`)
- בנייה: פותחים את המצגת הקודמת ומוחקים הכל חוץ מהשער; לא להעתיק slideN.xml; מחליפים `run.text`, לא `text_frame.text` (`.claude/skills/safety-committee-builder/SKILL.md:60`)
- עברית ב-pptx: פוסט-עיבוד שממלא `<a:cs typeface="Arial"/>` ו-`lang="he-IL"` בכל החלקים, אחרת אותיות מחוברות (`.claude/skills/safety-committee-builder/SKILL.md:66`)
- טבלאות: `firstRow`/`bandRow` כבויים וצביעה ידנית; גרפים `major_unit = 1`; שורת כותרת לפחות 0.56 אינץ' (`.claude/skills/safety-committee-builder/SKILL.md:67`)
- בדיקת איכות: `validate.py --original` PASSED, PDF, JPG, וחיתוך מוגדל לכל סוג רכיב, לא רק צילום שקופית (`.claude/skills/safety-committee-builder/SKILL.md:74`)
- שמירה: שאלון "בצע", גיבוי `<שם> - גרסה DD-MM-YYYY.pptx`, דריסת הראשי, שמירת הסקריפט, אימות ברשימת קבצים; שליחה בצ'אט אינה שמירה (`.claude/skills/safety-committee-builder/SKILL.md:80`)
- בתיקיית הוועדה קובץ מצגת אחד, בלי "טיוטה" בשם (`.claude/skills/safety-committee-builder/SKILL.md:89`)
- פרוטוקול: עריכת `word/document.xml` בעותק הקודם, ולעדכן גם `word/header2.xml` (`.claude/skills/safety-committee-builder/SKILL.md:93`)
- מלכודות RTL בפרוטוקול: `bidi` בלי `jc right`, סדר ילדי `pPr`, בלי מעברי עמוד כפויים, EMF מוחלף ב-PNG רק ב-PDF (`.claude/skills/safety-committee-builder/SKILL.md:97`)
- בסוף כל בנייה למיכאל: מה במצגת, מה הונח בלי אישור, מה השתנה, מה חסר וממי (`.claude/skills/safety-committee-builder/SKILL.md:106`)
- מצגת המפגעים: שינוי מראה = להעלות `DECK_VERSION`; שלד טקסט שמשתנה = `.perRun`; לפני מיזוג להוריד את המצגת החיה ולרנדר (עם carlito) (`.claude/skills/tfugen-ref/references/gotchas.md:48`)
- `trustee_reports` בשאילתה: לא להשתמש ב-`t` כ-alias של הטבלה (מתנגש בעמודה) (`project-files/assistant/committee.md:82`)
- בשמות קבצים תאריך DD-MM-YYYY; גיבוי לפני דריסה "<שם> - גרסה DD-MM-YYYY" ב-`גרסאות קודמות`; בתיקיית הוועדה קובץ מצגת אחד (`project-files/assistant/committee.md:237`)
- שליחה בצ'אט אינה שמירה: אחרי "בצע" לשמור לתיקייה ולאמת ברשימה גודל ותאריך (`project-files/assistant/committee.md:230`)
- עברית ב-pptx: פוסט-עיבוד שממלא `<a:cs typeface="Arial"/>` ו-`lang="he-IL"`; טבלאות בלי `firstRow`/`bandRow`; ציר `major_unit=1` (`project-files/assistant/committee.md:192`)
- בדיקת איכות: חיתוך מוגדל לכל סוג רכיב (טבלה, כרטיס, גרף), לא רק צילום שקופית מלאה (`project-files/assistant/committee.md:215`)
- הכלל המרכזי: לחפש את מה שלא קרה (תחקיר שלא הגיע, החלטה שלא בוצעה); הצלבות ש-1 עד 6 תמיד (`project-files/assistant/committee.md:107`)
- מניעת כפילויות: נתון שמופיע ביותר משקופית אחת, או שהוצג ולא השתנה, יורד (`project-files/assistant/committee.md:126`)
- בפרוטוקול לעדכן גם את התאריך ב-`word/header2.xml`; לא מעברי עמוד כפויים (`project-files/assistant/committee.md:259`)
- שקף 3 הוא תמונת סוף חודש, כותרת "נכון ל-DD/MM/YYYY" ולא "נתונים מעודכנים" (`STATUS.md:156`)
- הכתיבה הראשונה במצגת החיה מעבירה קודם עותק לארכיון (`STATUS.md:13`)

## כל ההחלטות של הענף
`grep -P "\tcommittee$" project-files/domains/decisions-map.tsv` (מספר שורה ב-DECISIONS.md וכותרת).

## קבצים שעוסקים בענף
- `.claude/skills/safety-committee-builder/SKILL.md`: בניית מצגת הוועדה והפרוטוקול: מקורות, הצלבות, חוקי תוכן, תבנית, מלכודות pptx/docx.
- `.claude/skills/tfugen-dev/references/lessons.md`: לקחי הפיתוח, כולל מסמכי מפעל, טיוטות, זרימות, שעון ישראל.
- `.claude/skills/tfugen-ref/references/gotchas.md`: מלכודות בקוד ובנתונים לפי אזור (תפוגות, מצגת, נאמנים, טפסי כבאות, נבו).
- `project-files/assistant/accidents.md`: נוהל תאונת עבודה מקצה לקצה: תיקייה, תחקיר, 250, קובץ מנוהל, `inc`, `thz_add`, מעקב.
- `project-files/assistant/committee.md`: נוהל ועדת הבטיחות: איסוף, הצלבות, מצגת, פרוטוקול, שמירה, והתאמה לענן.
- `project-files/BACKLOG.md`: תור השדרוגים 09/2026 (75 פריטים, כולם סגורים) וסבבי בדיקה 9-14.
- `project-files/COWORK-HAZARD-TOURS.md`: הוראות ל-Cowork במעבר סיורי המפגעים לאפליקציה (28/09/2026).
- `project-files/iso-audit-prep.md`: ידע להתעדה מחדש 2027: תעודות, פערים, סטטוס IQC.

## פריטים פתוחים (נכון ל-01/11/2026)
- רשימה קבועה לוועדה: בדיקה על תחקיר אמיתי ושקף 5 בפועל (`STATUS.md:13`)
- שלב 5: נתוני ישיבה ותאונות באפליקציה (`STATUS.md:123`)
- סנכרון קובץ ומצגת, תיקוני 29/09 (`STATUS.md:133`)
- מצגת ומספרי ניהול המפגעים; 4 מפגעים "סגור" בלי תאריך (`STATUS.md:156`)
