# כל כללי הענף: איכות סביבה

נבנה 01/11/2026 מסריקה של כל קבצי ה-md, ה-skills, הכללים, נהלי העוזר והסוכנים (מיכאל: "תעבור על כל מה שרשום ... ובכלל כל קובץ"). כל שורה: הכלל בקצרה, והמקור שבו הוא כתוב במלואו. התיק הקצר: `project-files/domains/env.md`. כלל חדש בענף נכנס גם לכאן.

## כללים מכל הקבצים
- SDS של Diversey: פורטל Solenis (בריטניה), תאריך הגרסה מעמוד 1 ב-`pdftotext`; Nalco/Ecolab רק בבקשה (`.claude/skills/tfugen-ref/references/gotchas.md:41`)
- מדידות סביבה ב-`_ENV_DUTIES`: 0 חודשים = פעם בשנה קלנדרית, יעד 31/12 של השנה הבאה (`.claude/skills/tfugen-ref/references/gotchas.md:13`)
- צריכת המים מ"קריאת מונה" של ויקה, הגיליון של 1 בחודש שאחרי, עמודת "הפרש"; לא "מים 2026.xls" (`project-files/routine-coa.md:21`)
- TSS "ראה הערות" או חסר = לא נבדק; התקינה נשארת לפי COD (אפריל 2026 באישור מיכאל) (`project-files/routine-coa.md:15`)
- קבצי COA נשארים בתיקיית הנכנס עד הסידור, לא ל"לא לתיוק" (`project-files/agent-log.md:64`)
- תעודה חדשה עם COD נמוך מהתקינה שכבר בתיקייה: לא מזיזים, מדווחים למיכאל (`project-files/routine-coa.md:17`)
- SDS שאינו של הספק מסומן "כללי, לא של הספק" או "תחליף לפי הרכב"; כמות ורמת סיכון ב-`hzm` ריקות בכוונה (`STATUS.md:68`)
- Tridol S3 (קצף): לבדוק תנאי PFAS בהיתר ולבקש SDS מהספק (`STATUS.md:67`)
- יומן פסולת: מוביל, אתר קליטה, תעודת משלוח וצירוף; בלי תעודה = "חסר" באדום (`STATUS.md:74`)

## כל ההחלטות של הענף
`grep -P "\tenv$" project-files/domains/decisions-map.tsv` (מספר שורה ב-DECISIONS.md וכותרת).

## קבצים שעוסקים בענף
- `.claude/skills/tfugen-db/references/lessons.md`: לקחי המסד וה-Routines (הצלבת מידע, Excel עם סיכום, טריגר הנאמנים, תיוק).
- `.claude/skills/tfugen-ref/SKILL.md`: מפת טבלאות, עזרים, מילון עברית ושלדי קוד.
- `.claude/skills/tfugen-ref/references/gotchas.md`: מלכודות בקוד ובנתונים לפי אזור (תפוגות, מצגת, נאמנים, טפסי כבאות, נבו).
- `project-files/agent-log.md`: יומן "למדתי" של כל ריצת סוכן.
- `project-files/routine-coa.md`: סידור תעודות COA של שפכים וטיוטת דוח המים החודשי למשרד הבריאות.
- `project-files/routine-mail-filing.md`: תיוק מסמכים מהמייל ועדכון תוקף.
- `project-files/routine-od-scan.md`: מסמכים רגולטוריים חדשים בתיקייה ל-`factory.md`.
- `project-files/wa-topics/prof.md`: שאלה מקצועית: נבו, מקור רשמי, בודק שני, דירוג.
- `project-files/ACCOUNT-INVENTORY.md`: רשימת ה-Routines, הזרימות, הסודות והתיקיות שמחוץ ל-repo.
- `project-files/nh3-emergency-equipment.md`: ציוד חירום אמוניה: דרישות היתר 70011, מה יש, פערים, אירועים מהענף.

## פריטים פתוחים (נכון ל-01/11/2026)
- מרשם החומרים המסוכנים מהיתר הרעלים (`STATUS.md:67`)
- SDS לחומרים (29 מתוך 32) ומדידת מהירות (`STATUS.md:68`)
- ראיה לפינוי ביומן הפסולת (`STATUS.md:74`)
