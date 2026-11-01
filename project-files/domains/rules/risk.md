# כל כללי הענף: סקר סיכונים וסיורים

נבנה 01/11/2026 מסריקה של כל קבצי ה-md, ה-skills, הכללים, נהלי העוזר והסוכנים (מיכאל: "תעבור על כל מה שרשום ... ובכלל כל קובץ"). כל שורה: הכלל בקצרה, והמקור שבו הוא כתוב במלואו. התיק הקצר: `project-files/domains/risk.md`. כלל חדש בענף נכנס גם לכאן.

## כללים מכל הקבצים
- ביקורת חוזרת על מפגע סגור: עמודה אחת `tour_hazards.recheck_d`, לא משימה וירטואלית (`.claude/skills/tfugen-ref/references/gotchas.md:14`)
- דוח המחלקות: `noAction` לפי הפעולה כפי שהוקלדה; `suggest` לא שומר, `setAction` רק כשריק (`.claude/skills/tfugen-ref/references/gotchas.md:42`)
- שמות העמודות בחוברת המפגעים (I "פעולה נדרשת", K סטטוס, P תמונה) להוראות לכרום; אין גיליון "מייל משימות" (`.claude/skills/tfugen-ref/references/gotchas.md:43`)
- מייל למנהלי מחלקות = `readRecipients` מגיליון "נמענים" בחוברת הסיורים, לא רשימה שנייה (`.claude/skills/tfugen-dev/SKILL.md:134`)
- תאריך בשם קובץ שהשרת כותב: `DD-MM-YYYY` (`stampName` ב-`hazard-file.js`) (`.claude/rules/people-text.md:11`)
- ליקוי אחזקה: "חשמל" כשיש בתיאור מילות חשמל (`ELEC`), אחרת "אחזקה" (`STATUS.md:130`)
- קובץ מפגעים חדש לכל שנה, מספור ממשיך ברצף, אזהרה ב-80% (`STATUS.md:131`)
- יעד מפגע לפי חומרה: גבוהה 3 ימים, בינונית 14, נמוכה 30, עד שנבחר ביד (`STATUS.md:143`)
- קישור תמונה ב"שלח לטיפול" = קישור חתום ל-30 יום (ה-bucket פרטי) (`STATUS.md:125`)
- משימת Vitre שנפתחה מממצא נסגרת ביד ב-Vitre כשהממצא נסגר; סגירה אוטומטית כבויה (`STATUS.md:135`)
- Vitre: אין יצירת משימה ישירה ב-API; מפתח החברה רק בסודות Cloudflare; קריאות רק מהשרת או מהדפדפן (`project-files/VITRE-API.md:17`)
- Vitre: לא לבנות לפני החלטת תקציב ולא להניח מבנה נתונים בלי תיעוד (`project-files/VITRE-QUESTIONS.md:41`)
- האפליקציה היא המקור לסיורים; תאריך חסר: לדווח, לא להמציא, ולעדכן באפליקציה ולא באקסל (`project-files/COWORK-HAZARD-TOURS.md:48`)
- תאריך סיור בלי מקור = יום שליחת הדוח במייל (החלטת מיכאל) (`STATUS.md:156`)
- מגמה = 3 ומעלה באותה מחלקה/מיקום/סוג בשתי טבלאות, או עלייה 50% עם 4 לפחות; נורה אדומה רק מעל 4 דיווחים (`tools/platform/agents/trends.md:17`)

## כל ההחלטות של הענף
`grep -P "\trisk$" project-files/domains/decisions-map.tsv` (מספר שורה ב-DECISIONS.md וכותרת).

## קבצים שעוסקים בענף
- `.claude/rules/people-text.md`: טקסט לאנשים רק בתווי מקלדת, תאריך בשם קובץ DD-MM-YYYY.
- `.claude/skills/safety-committee-builder/SKILL.md`: בניית מצגת הוועדה והפרוטוקול: מקורות, הצלבות, חוקי תוכן, תבנית, מלכודות pptx/docx.
- `.claude/skills/tfugen-dev/SKILL.md`: כללי פיתוח, הדרכות (closed_at/form_at, סוגי הדרכה), נמעני המנהלים.
- `.claude/skills/tfugen-ref/references/gotchas.md`: מלכודות בקוד ובנתונים לפי אזור (תפוגות, מצגת, נאמנים, טפסי כבאות, נבו).
- `project-files/BACKLOG.md`: תור השדרוגים 09/2026 (75 פריטים, כולם סגורים) וסבבי בדיקה 9-14.
- `project-files/CHROME-HAZARD-TOURS.md`: הוראות לכרום: איתור תיקיית סיורי המפגעים וקובץ התאונות (28/09/2026).
- `project-files/COWORK-HAZARD-TOURS.md`: הוראות ל-Cowork במעבר סיורי המפגעים לאפליקציה (28/09/2026).
- `project-files/VITRE-API.md`: תמצית ה-API של Vitre.
- `project-files/VITRE-QUESTIONS.md`: שאלות לספק Vitre ומה עושים עם כל תשובה.
- `project-files/WHATSAPP-TEMPLATE.md`: תבנית Meta להתראת דיווח בטיחות.
- `tools/platform/agents/trends.md`: סוכן המגמות ומדד מקדים לתרבות הבטיחות.

## פריטים פתוחים (נכון ל-01/11/2026)
- מדד מקדים לתרבות הבטיחות (רעיון 8) (`STATUS.md:87`)
- קישור תמונה ב"שלח לטיפול" (`STATUS.md:125`)
- הוראת עבודה PDF מ"שלח לטיפול" (`STATUS.md:126`)
- "מחלקה אחראית" אחזקה או חשמל (`STATUS.md:130`)
- קובץ מפגעים חדש לכל שנה (`STATUS.md:131`)
- מסך הסיור: הודעות, מצב שליחה ונעילה (`STATUS.md:132`)
- סיורי מפגעים של הממונה באפליקציה (`STATUS.md:134`)
- משימת Vitre 3367883 לסגירה ידנית (`STATUS.md:135`)
- כפתורי יעד בדיווח מפגע (לבדיקת מיכאל בטלפון) (`STATUS.md:143`)
- Vitre: חיבור קריאה, מסלול לאפליקציה, Vitre כערוץ הודעות (`STATUS.md:149`)
