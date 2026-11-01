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
- תיוק תסקיר עד הסוף בריצה אחת: `expiry_set` עם `report_number`, `inspector` ו-`doc`; ציוד בלי שורה = `equip_add` רק כש"כשיר לעבודה"; לא `dev_request` (`project-files/wa-topics/docs.md:15`)
- אחרי תיוק תסקיר חדש: באותה הודעה "להעביר את הקודמים ל'פג תוקף'?" עם "בצע"/"לא", ואז `od_expire` לכל קובץ בפקודה נפרדת (`project-files/wa-topics/docs.md:15`)
- `od_expire` מעביר את הישן מ-`בתוקף` ל-`פג תוקף` שלידה, באותו שם; השרת מסרב אם החדש לא שם (`project-files/wa-topics/docs.md:15`)
- נבדק ואין עדיין תסקיר: `expiry_set` עם `d` = יום הבדיקה ו-`doc`; 14 יום בשורה "מחכה לתסקיר" (`project-files/wa-topics/ops.md:14`)
- התוקף עבר והתסקיר לא הגיע: `expiry_set` עם why "פג DD/MM, אסור בשימוש עד שיגיע תסקיר <מספר>", לא מזיזים `e`, שורה למיכאל עם אחראי התחום (`project-files/wa-topics/docs.md:15`)
- בדיקה של כמה פריטים יחד: לקרוא את מייל הבדיקה, למצוא את כולם במסד, שאלה אחת "לסמן נבדק את כל N?" עם "בצע"/"רק זה"/"לא" (`project-files/wa-topics/ops.md:14`)
- "כרטיס <שם>" / "מה המצב עם": `item_card`, מיילים, הצלבה, הודעה עד 900 תווים בסעיפים קבועים, בלי תוקף של הצעה (`project-files/wa-topics/ops.md:15`)
- כל מייל, הצעה, תסקיר או קובץ ששייך לפריט נרשם ב-`link_add`; לא בטוח לאיזה פריט = לא מקשרים (`project-files/agent-common.md:159`)
- טופס שירות חודשי (טופס 16, ניקוי מנדפים): לא לכתוב "לא מצאתי תיאום"; רק אם התוקף עבר ולא הגיע טופס חדש (`project-files/routine-wa-assistant.md:67`)
- ציוד עם `resp_area` (קירור ואמוניה, תשתיות) אינו של מיכאל: ההצעה "להעביר לאחראי התשתיות והאמוניה", טיוטה פנימית, בלי שמות בוואטסאפ (`project-files/agent-common.md:130`)
- ממצא בדוח ישן שיש אחריו דוח חדש יותר על אותו פריט אינו ליקוי פתוח; הדוח האחרון קובע (`project-files/agent-common.md:150`)
- תאריך מוקדם יותר מותר תמיד; מאוחר יותר רק עם מסמך שנקרא (`project-files/routine-validity.md:20`)
- פריט פג שכתוב עליו "מתוכנן" או "ממתין לספק" מקבל `task_add` (`exists` = לא לפתוח עוד); בלי תכנית נשאר "מחכה למיכאל" (`project-files/routine-validity.md:23`)
- המלגזה יונגהיינריך EFG430 (172-571, FN637226) יצאה מהמפעל: לא לשאול עליה (`project-files/routine-validity.md:17`)
- שם קובץ שסותר את התוכן: רק ברשימה בדוח, שינוי שם מחכה ל"בצע" (`project-files/routine-validity.md:24`)
- סיווג בדוחות: פג (עבר), דחוף עד 30 יום, קרוב 31-90; פערים מול ה-Excel רק נרשמים, לא מתקנים לבד (`project-files/routine-compliance.md:30`)
- הצעת מחיר או תזכורת שירות לציוד: לבדוק כל פריט במרשם; לא נמצא = "ציוד לא במרשם: <ספק, פריט, מס' סידורי>" בדוח, בלי להוסיף שורה (`project-files/routine-mail-filing.md:21`)
- מסמך עם מס' סידורי, תאריך בדיקה ובדיקה הבאה בלי שורה במסד: מתייקים, ו"הצעה למרשם" ממתינה ל"בצע" (`project-files/routine-mail-filing.md:24`)
- תיוק לתיקייה שבה הדוח הקודם של אותו פריט; תת-תיקיית שנה רק אם כבר קיימת; שם כמו הקבצים הקיימים, בלי "תוקף עד" (`project-files/routine-mail-filing.md:25`)
- כפילות לפי תאריך הבדיקה בשם או גודל זהה בתיקייה, לא לפי הגודל שבחיפוש המייל (`project-files/routine-mail-filing.md:26`)
- "לא לתיוק": השם עם הסיבה בסוגריים לפני הסיומת מתוך רשימה סגורה (חשבונית, הצעת מחיר, כבר בתיקייה, לא נקרא...) (`project-files/routine-mail-filing.md:30`)
- סריקה שלא נקראה נשארת בתיקיית הנכנס (`wait`), לא ל"לא לתיוק" שנמחק אחרי 30 יום (`project-files/routine-mail-filing.md:23`)
- לא לגעת בתיוק: מיילים מ-`geny@`, `hr-tap@`, `prod@`, טופס 250, רשימות עובדים עם ת"ז, בדיקות שמיעה ואישורי מחלה (`project-files/routine-mail-filing.md:19`)
- ביקורת המשאבות החודשית אינה שורה במסד: מתייקים בלי `expiry_set` (`project-files/agent-log.md:56`)
- תסקירי ג'ורג' פריד מגיעים כ-PDF אחד בלי טקסט בגוף: לקרוא ב-`ocr_txt` (`project-files/agent-log.md:121`)
- חשבונית בודק: לחשב כל שורה וסכום מול הסה"כ ב-python, להצליב מספרי תסקירים וכמויות; השוואה להצעה רק מאותו ספק ונושא (`project-files/assistant/files-scans.md:15`)
- בבקשה מבודק על תסקיר חסר: ליד כל ציוד מספר התסקיר הקודם ותאריכו מתוך שם הקובץ בתיקיית "בתוקף" (`project-files/assistant/files-scans.md:15`)
- "הגיעו היום" רק על מה שנראה בסריקה פריט פריט, עם `checked` של הקובץ והעמוד; מצב ברשימות לפי המסד, לא לפי המייל (`project-files/routine-wa-assistant.md:46`)
- מעקב ספקים: "מחכה לתסקיר" 3 ימים ומעלה = שורה עם כפתור "טיוטה ל<ספק>", לא כשיש טיוטה פתוחה אליו; תפוגות רק 7 ימים קדימה (`project-files/wa-topics/promises.md:5`)
- פריט "תקוע" = פג לפני יותר מ-7 ימים ואין לו בקשה ב-`quote_track` (`project-files/routine-supplier-followup.md:19`)
- המייל הפנימי על בדיקת אביזרי הרמה שמיכאל תיאם: לאחזקה, ייצור, מחסן טכני ובעלי הציוד; רכש לא בנמענים; מועד לפי התוקף בתסקיר (`project-files/wa-topics/prof.md:8`)
- טבלאות `tr`, `ppe`, `ctr`, `med` ריקות במסד: לשאר הרשומות התיקייה היא המקור (`project-files/agent-common.md:125`)
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
- `project-files/agent-common.md`: הידע המשותף, הפתיחה והסגירה של כל סוכן, העברת משימות, הצלבת מידע וגרף הקישורים.
- `project-files/agent-log.md`: יומן "למדתי" של כל ריצת סוכן.
- `project-files/assistant/files-scans.md`: קבצים מחוץ לתיקייה, סריקות, `ocr_txt`, מילוי טפסים, חשבוניות בודק, טופס 08.01.
- `project-files/power-automate-mail.md`: עשר זרימות Power Automate: נכנס, בקשות, טיוטות, יומן, זימונים, אתר iso, ניקוי "לא לתיוק".
- `project-files/routine-compliance.md`: דוח הציות החודשי מהמסד ופערים מול ה-Excel.
- `project-files/routine-inspector.md`: המפקח המדומה: 5 דרישות חוק והוכחה בתוך 3 חיפושים.
- `project-files/routine-mail-filing.md`: תיוק מסמכים מהמייל ועדכון תוקף.
- `project-files/routine-quality.md`: בודק האיכות היומי: הודעות, טיוטות, כתיבות למסד, חשבוניות, ניסוחי אחראי, טפסי הענפים.
- `project-files/routine-quotes.md`: מעקב שלבי הצעות מחיר (`quote_track`).
- `project-files/routine-supplier-followup.md`: תפוגות שנתקעו אצל ספק וכתובות ספקים חסרות.
- `project-files/routine-validity.md`: בודק התוקף השבועי מול המסמכים עצמם.
- `project-files/routine-wa-assistant.md`: הנוהל הראשי והמלא של העוזר בוואטסאפ.
- `project-files/wa-topics/docs.md`: משימות מסמכים, מייל, קובץ, טיוטה וצילום.
- `project-files/wa-topics/ops.md`: משימת עובד, מפגעים, ציוד, תאונה, פיתוח, כרטיס פריט, סגירת ליקוי סיור.
- `project-files/wa-topics/prof.md`: שאלה מקצועית: נבו, מקור רשמי, בודק שני, דירוג.
- `project-files/wa-topics/promises.md`: הבטחות, בדיקה חוזרת, רשימת מחר ומעקב ספקים.
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
