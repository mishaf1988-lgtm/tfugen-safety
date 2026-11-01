# כל כללי הענף: ציוד, תסקירים ותוקף

נבנה 01/11/2026 מסריקה של כל קבצי ה-md, ה-skills, הכללים, נהלי העוזר והסוכנים (מיכאל: "תעבור על כל מה שרשום ... ובכלל כל קובץ"). כל שורה: הכלל בקצרה, והמקור שבו הוא כתוב במלואו. התיק הקצר: `project-files/domains/expiry.md`. כלל חדש בענף נכנס גם לכאן.

## כללים מכל הקבצים
- טבלת תפוגה חדשה = שורה גם ב-`_expCollect` וגם ב-`EXP_SRC` (מייל); חובה חוזרת = גם `REC_SRC` (`.claude/skills/tfugen-ref/references/gotchas.md:16`)
- ב-`ctr`, `ppe`, `med` השדה `e` טקסט: לסנן לפי `YYYY-MM-DD`, לא לסמוך על `lte` (`.claude/skills/tfugen-ref/references/gotchas.md:16`)
- מרשם חובה חדש = `_REQ_REGS` וגם `REQ_REGS` במייל; קריאה שנכשלה אינה "ריק" (`.claude/skills/tfugen-ref/references/gotchas.md:17`)
- הוצאה מכוונת ממעקב: `s` שמתחיל "לא רלוונטי" עם `e` ריק ו-`doc` (`expiry_set`); כל סורק תפוגה חדש בודק `_expOff` (`.claude/skills/tfugen-ref/references/gotchas.md:47`)
- מצב ציוד בכמה ניסוחים ("כשיר לעבודה", "תקין"): השוואה רק דרך `_eqiPass`/`_eqiFail`, מילוי ב-`_eqiSetS` (`.claude/skills/tfugen-ref/references/gotchas.md:51`)
- אחרי ייבוא: `select distinct` על כל שדה שהקוד משווה אליו (`.claude/skills/tfugen-dev/references/lessons.md:85`)
- ייבוא Excel: תאריך נקרא כמספר סידורי גולמי (`_eqiXl2Date`), לא כטקסט תצוגה (`.claude/skills/tfugen-ref/references/gotchas.md:53`)
- סריקה שלא נקראה: סיבה לכל דרך בנפרד; `ocr_txt` רץ על Workers AI, ולא מבקשים לטעון קרדיט (`.claude/skills/tfugen-db/references/lessons.md:37`)
- אחרי תיוק ידני מהנכנס: לעדכן `filed`/`wait` ברשומת `mail_filing` האחרונה (`.claude/skills/tfugen-db/references/lessons.md:149`)
- תג `eb` רק לתאריך תפוגה; כל תאריך אחר דרך `fd` (`.claude/skills/tfugen-screen-review/SKILL.md:17`)
- מחיקת שורה (`equip_inspections`, `docs`, `inc`) מהענן רק ב-`del_ask`, בקשה אחת פתוחה בכל פעם (`.claude/skills/tfugen-db/SKILL.md:89`)
- דוח ציות: פג (פחות מ-0), דחוף (0-30), קרוב (31-90); רפואה ושמיעה רק ספירה בלי פרטי עובד (`tools/platform/agents/compliance.md:18`)
- "לא לתיוק" נמחק אוטומטית אחרי 30 יום (`backup-od`) (`project-files/ACCOUNT-INVENTORY.md:137`)

## כל ההחלטות של הענף
`grep -P "\texpiry$" project-files/domains/decisions-map.tsv` (מספר שורה ב-DECISIONS.md וכותרת).

## קבצים שעוסקים בענף
- `.claude/rules/code.md`: כללי קוד, כולל שדה תפוגה `e` בכל הטבלאות.
- `.claude/skills/tfugen-db/SKILL.md`: עבודה מול המסד החי, migration, routine-db, שלוש רמות גישה ל-OneDrive, מחיקה ב-del_ask.
- `.claude/skills/tfugen-db/references/lessons.md`: לקחי המסד וה-Routines (הצלבת מידע, Excel עם סיכום, טריגר הנאמנים, תיוק).
- `.claude/skills/tfugen-dev/references/lessons.md`: לקחי הפיתוח, כולל מסמכי מפעל, טיוטות, זרימות, שעון ישראל.
- `.claude/skills/tfugen-lessons/SKILL.md`: לקחים כלליים לפי רגע (לפני טענה, לפני "חסר").
- `.claude/skills/tfugen-ref/SKILL.md`: מפת טבלאות, עזרים, מילון עברית ושלדי קוד.
- `.claude/skills/tfugen-ref/references/gotchas.md`: מלכודות בקוד ובנתונים לפי אזור (תפוגות, מצגת, נאמנים, טפסי כבאות, נבו).
- `.claude/skills/tfugen-screen-review/SKILL.md`: רשימת בדיקה לצילום מסך ולתשובות העוזר.
- `project-files/ACCOUNT-INVENTORY.md`: רשימת ה-Routines, הזרימות, הסודות והתיקיות שמחוץ ל-repo.
- `project-files/BACKLOG.md`: תור השדרוגים 09/2026 (75 פריטים, כולם סגורים) וסבבי בדיקה 9-14.
- `project-files/CLAUDE-detail.md`: הגרסה הארוכה של CLAUDE.md עם הנימוקים.
- `project-files/ideas-lab.md`: מעבדת הרעיונות וטבלאות החיסכון.
- `project-files/iso-audit-prep.md`: ידע להתעדה מחדש 2027: תעודות, פערים, סטטוס IQC.
- `project-files/lessons-archive.md`: לקחים שכבר נאכפים בקוד.
- `project-files/mock-inspection.md`: דוחות המפקח המדומה (10/2026: 2 מתוך 5).
- `project-files/privacy-map.md`: מיפוי מידע אישי וטיוטת הודעה לעובדים.
- `project-files/scba-inventory.md`: מנ"פים, מכלים וחליפות לפי מספר סידורי.
- `tools/platform/agents/compliance.md`: סוכן דוח הציות החודשי של המוצר.

## פריטים פתוחים (נכון ל-01/11/2026)
- בדיקת תוקף מול המסמכים, 111 פריטים (`STATUS.md:21`)
- חיפוש סלחני במסך התפוגות (`STATUS.md:17`)
- לוח הבקרה המרכזי (Excel) יובא (`STATUS.md:34`)
- דוח הציות החודשי מהמסד (`STATUS.md:35`)
- מרשמי ציוד ושמיעה יובאו; ממצאים למיכאל (`STATUS.md:66`)
- `od_move` ב"לא לתיוק" עם סוגריים בשם (החלטה) (`STATUS.md:196`)
- רעיון 14: מנהלי מחלקות שואלים את העוזר (ציוד, הדרכות, ליקויים) (`project-files/ideas-lab.md:40`)
