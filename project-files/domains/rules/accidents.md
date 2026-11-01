# כל כללי הענף: תאונות, תחקירים וכמעט תאונה

נבנה 01/11/2026 מסריקה של כל קבצי ה-md, ה-skills, הכללים, נהלי העוזר והסוכנים (מיכאל: "תעבור על כל מה שרשום ... ובכלל כל קובץ"). כל שורה: הכלל בקצרה, והמקור שבו הוא כתוב במלואו. התיק הקצר: `project-files/domains/accidents.md`. כלל חדש בענף נכנס גם לכאן.

## כללים מכל הקבצים
- תאונת דרך נספרת ומסומנת "מחוץ לשטח המפעל" (`.claude/skills/safety-committee-builder/SKILL.md:45`)
- שורה בטבלת התאונות: לקרוא את נוסחאות הסיכום, מחלקה מוכרת ו"דיווח" לא ריק; אחרי: הפילוח = הסה"כ (`.claude/skills/tfugen-db/references/lessons.md:11`)
- `near_miss` עם עמודה `t`: לא להשתמש ב-`t` כ-alias (`.claude/skills/tfugen-screen-review/SKILL.md:33`)
- תמונות מסיור האתר משובצות בתוך קובץ התחקיר ליד הממצא; משתתפים בשדה "משתתפים"; הערות מנהל המפעל מגיעות כקובץ מצורף במייל (`project-files/routine-wa-assistant.md:91`)
- אין חובה לחתום על התחקיר; "מאושר" = מיכאל אישר את הנוסח, לא חתימה (`project-files/assistant/accidents.md:22`)
- ברשימת החסרים למיכאל רק מה שבסעיף המעקב, במילים שלו ("הדרכה לעובדים בעקבות התאונה"); "מייל ממשאבי אנוש" אינו מסמך חסר (`project-files/assistant/accidents.md:22`)
- בתחקיר: בלי סעיף 5 למה, בלי "המלצה שלי"; שדה בלי מקור נשאר ריק ומה שחסר נכתב בהודעה (`project-files/assistant/accidents.md:21`)
- תחקיר טיוטה וסופי: Word ו-PDF באותו שם; ה-PDF מ-`od-read` עם `format:pdf`, לא `soffice`; תיקון נוסח = שני הקבצים מחדש (`project-files/assistant/accidents.md:9`)
- לפני שמירת תחקיר: רינדור ובדיקה בעין: לוגו בכותרת, עד 2 עמודים (`project-files/assistant/accidents.md:8`)
- קובץ מנוהל: רק `xlsx_add_rows.py` (לא openpyxl), `cmp` מול הורדה טרייה לפני העלאה, `od_trash` לישן ואז העלאה באותו שם (`project-files/assistant/accidents.md:40`)
- "מחלקה" בקובץ המנוהל וב-`inc` רק מהרשימה (ייצור טוגנים, אריזה, חומר גלם...); "ייצור" לבד = "אחר"; "דיווח" = "מדווח"/"לא מדווח" (`project-files/assistant/accidents.md:25`)
- בדיקה בסוף: `read_resource` על "ריכוז תאונות", הסה"כ עלה באחד ו"מדווח"+"לא מדווח" = הסה"כ (`project-files/assistant/accidents.md:44`)
- `thz_add` מתחקיר: `loc` = מקום האירוע בלי שם המחלקה; "להשלמה" או "לקבוע לוז" = `due` ריק והמילים ב-`notes` (`project-files/assistant/accidents.md:27`)
- שם העובד רק מנושא המייל של משאבי אנוש ומשם קובץ 250; לא לנחש משם אחר (`project-files/assistant/accidents.md:33`)
- timeout מ-`od_trash`/`od_put_pdf`: קודם לבדוק בתיקייה, "name taken" = לבדוק גודל; לא לנסות שוב מיד (`project-files/assistant/accidents.md:39`)
- `od_move` עובד רק מ-`_נכנס מהמייל`; העתקת קובץ שכבר בתיקייה = הורדה, העלאה בשם חדש, השוואת גודל ורק אז `od_trash` (`project-files/assistant/accidents.md:37`)
- 250 סרוק: לקרוא ב-`ocr_txt` את התאריך וימי ההיעדרות (`project-files/assistant/accidents.md:22`)
- מסמך או צילום שמיכאל שולח רק להמרה ל-PDF: לא משייכים לתאונה ולא שומרים ב-`12_תאונות ואירועים` בגלל אזכור בריאותי (`project-files/wa-topics/docs.md:21`)
- תאונת דרך נספרת בסך הכל, מסומנת "מחוץ לשטח המפעל" (`project-files/assistant/committee.md:120`)
- מייל על תאונה ממשאבי אנוש או ממנהל נכנס תמיד לסריקת המיילים, גם ב-CC וגם כשמיכאל ענה, ראשון בהודעה עם כפתור "תאונה: DD/MM" (`project-files/routine-mail-triage.md:13`)

## כל ההחלטות של הענף
`grep -P "\taccidents$" project-files/domains/decisions-map.tsv` (מספר שורה ב-DECISIONS.md וכותרת).

## קבצים שעוסקים בענף
- `.claude/skills/safety-committee-builder/SKILL.md`: בניית מצגת הוועדה והפרוטוקול: מקורות, הצלבות, חוקי תוכן, תבנית, מלכודות pptx/docx.
- `.claude/skills/tfugen-db/references/lessons.md`: לקחי המסד וה-Routines (הצלבת מידע, Excel עם סיכום, טריגר הנאמנים, תיוק).
- `.claude/skills/tfugen-dev/references/lessons.md`: לקחי הפיתוח, כולל מסמכי מפעל, טיוטות, זרימות, שעון ישראל.
- `.claude/skills/tfugen-ncr-writing/SKILL.md`: איך כותבים NCR שאפשר לעבוד איתו, ומה בונים ב-prompt של ה-AI.
- `project-files/assistant/accidents.md`: נוהל תאונת עבודה מקצה לקצה: תיקייה, תחקיר, 250, קובץ מנוהל, `inc`, `thz_add`, מעקב.
- `project-files/assistant/committee.md`: נוהל ועדת הבטיחות: איסוף, הצלבות, מצגת, פרוטוקול, שמירה, והתאמה לענן.
- `project-files/routine-factory-trends.md`: מגמות חודשיות ומדד מקדים מחמש הטבלאות, ותיק המקרים.
- `project-files/routine-mail-filing.md`: תיוק מסמכים מהמייל ועדכון תוקף.
- `project-files/routine-mail-triage.md`: סריקת מיילים שמחכים לתשובה ובדיקת הזרימות.
- `project-files/routine-wa-assistant.md`: הנוהל הראשי והמלא של העוזר בוואטסאפ.
- `project-files/wa-topics/docs.md`: משימות מסמכים, מייל, קובץ, טיוטה וצילום.
- `project-files/wa-topics/ops.md`: משימת עובד, מפגעים, ציוד, תאונה, פיתוח, כרטיס פריט, סגירת ליקוי סיור.
- `project-files/CHROME-HAZARD-TOURS.md`: הוראות לכרום: איתור תיקיית סיורי המפגעים וקובץ התאונות (28/09/2026).
- `project-files/COWORK-HAZARD-TOURS.md`: הוראות ל-Cowork במעבר סיורי המפגעים לאפליקציה (28/09/2026).
- `project-files/mock-inspection.md`: דוחות המפקח המדומה (10/2026: 2 מתוך 5).
- `tools/platform/agents/trends.md`: סוכן המגמות ומדד מקדים לתרבות הבטיחות.

## פריטים פתוחים (נכון ל-01/11/2026)
- המפקח המדומה: הודעה בכתב למפקח על תאונה 19/05/2026 (`STATUS.md:95`)
