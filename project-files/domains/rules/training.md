# כל כללי הענף: הדרכות

נבנה 01/11/2026 מסריקה של כל קבצי ה-md, ה-skills, הכללים, נהלי העוזר והסוכנים (מיכאל: "תעבור על כל מה שרשום ... ובכלל כל קובץ"). כל שורה: הכלל בקצרה, והמקור שבו הוא כתוב במלואו. התיק הקצר: `project-files/domains/training.md`. כלל חדש בענף נכנס גם לכאן.

## כללים מכל הקבצים
- הדרכה "גמורה" = `toolbox_talks.form_at`; "פתוחה" בשרת דרך `isClosed` (`closed_at`), לא `link_v` ולא `s` (`.claude/skills/tfugen-dev/SKILL.md:132`)
- סוג הדרכה חדש: לעבור על כל מי שקורא `toolbox_talks`, סינון לפי `PERM_KINDS`/`TYPED_KINDS` (`.claude/skills/tfugen-dev/SKILL.md:133`)
- דף העובד: כל מפתח בכל שפה ב-`LANGS`, כולל הודעות שגיאה (`.claude/skills/tfugen-dev/SKILL.md:120`)
- לוח חתימה חדש לא נכתב מאפס (`sigScript`, `_tbtSigInit`); תמונה מהאפליקציה היא JPEG (`.claude/skills/tfugen-dev/SKILL.md:131`)
- טקסט להקראה עובר הכנה: בלי מספרי טופס ומספור שורות (`.claude/skills/tfugen-dev/references/lessons.md:91`)
- מסך השתנה = לצלם מחדש לפני תיקון הטקסט במדריך (`.claude/skills/tfugen-guides/SKILL.md:23`)
- לפני ששולחים מדריך: מה שהוא מתאר כבר קיים באוויר (הדרכה מפורסמת) (`.claude/skills/tfugen-guides/SKILL.md:30`)
- מדריך משאבי האנוש קפוא; מדריך המנהלים מצלם את דף ההדרכה השבועית (`.claude/skills/tfugen-guides/SKILL.md:45`)
- לפני מדריך לתהליך: לשאול איך הוא קורה בשטח (שנתית = מול מדריך, העובד רק חותם) (`.claude/skills/tfugen-guides/SKILL.md:57`)
- ביצוע אוטומטי של תכנית ההדרכות: `_TP_AUTO` ו-`PLAN_AUTO` חייבים להישאר זהים (`.claude/skills/tfugen-ref/SKILL.md:25`)
- קישור ההדרכה פג אחרי 14 יום מ-`link_at`; המייל מזהיר 7 ימים לפני ומתחת ל-80% חתומים (`.claude/skills/tfugen-ref/SKILL.md:104`)
- חתימה מחוץ לרשימת העובדים = `x:<ת"ז או דרכון>:<שם>`, חתימה אחת למספר בהדרכה (`.claude/skills/tfugen-ref/SKILL.md:105`)
- עובד שעזב (`emp.left_d`) לא נספר בהדרכה השבועית; הגרסה שנחתמה = `text_hash` (`.claude/skills/tfugen-ref/references/gotchas.md:40`)
- תזכורת מ"מי חתם": לא לקרוא ל-op `link` בתצוגה (מזיז את התפוגה ומשתיק את האזהרה) (`.claude/skills/tfugen-ref/references/gotchas.md:54`)
- הדרכה שבועית: טיוטה אחת משותפת לכל המחלקות, העובד בוחר מחלקה; ייצור עובר על כל הנושאים (`STATUS.md:78`)
- תקנות 16/10/2026: מדריך וכשירות חובה לפרסום הדרכה, ולכל משתתף ת"ז או דרכון (`STATUS.md:49`)
- בדיקת אפקטיביות: "לא אפקטיבי" מחייב המשך טיפול (`STATUS.md:50`)
- טופס הקליטה: "הטופס הוכן על ידי" ולא שם מדריך (`STATUS.md:42`)
- הקראה בקול בלי מספרי טופס ובלי מספור סעיפים (`STATUS.md:45`)
- תכנית ההדרכות: 30 הסעיפים מ-08.01, רבעון יעד לכל סעיף, אוטומטי וידני (`STATUS.md:82`)
- מדריכי ההדרכה: עובדות מהקוד (תוקף קישור 14 יום, קבוצה יום אחד, נמען IND_HR); שינוי בקוד = עדכון המדריך ובנייה מחדש (`project-files/guide-training/README.md:43`)
- מדריך משאבי אנוש קפוא בכוונה; לא לשלוח לפני החלטת מיכאל (`project-files/guide-training/README.md:57`)
- לשלוח מדריך רק אחרי שמיכאל פרסם, תרגם והדפיס QR (`project-files/guide-training/README.md:65`)
- צילומי מדריכים עם שמות עובדים בדויים ובלי מילים שאינן במקלדת (`project-files/guide-training/README.md:16`)
- "אמרתם, עשינו" בהדרכה: רק מ-close_note או action, בלי יום, מספר ליקוי או מקום מדויק (`tools/platform/agents/talk-field.md:20`)
- אירועי השבוע בטיוטה: רק מה שכתוב באירוע, בלי לנחש סיבה, עד 2 אירועים למחלקה (`tools/platform/agents/talk-field.md:19`)

## כל ההחלטות של הענף
`grep -P "\ttraining$" project-files/domains/decisions-map.tsv` (מספר שורה ב-DECISIONS.md וכותרת).

## קבצים שעוסקים בענף
- `.claude/rules/people-text.md`: טקסט לאנשים רק בתווי מקלדת, תאריך בשם קובץ DD-MM-YYYY.
- `.claude/skills/tfugen-dev/SKILL.md`: כללי פיתוח, הדרכות (closed_at/form_at, סוגי הדרכה), נמעני המנהלים.
- `.claude/skills/tfugen-dev/references/lessons.md`: לקחי הפיתוח, כולל מסמכי מפעל, טיוטות, זרימות, שעון ישראל.
- `.claude/skills/tfugen-guides/SKILL.md`: בניית מדריכי המשתמש (נאמנים, משאבי אנוש ומנהלים, הדרכה שנתית) עם צילומים.
- `.claude/skills/tfugen-ref/SKILL.md`: מפת טבלאות, עזרים, מילון עברית ושלדי קוד.
- `.claude/skills/tfugen-ref/references/gotchas.md`: מלכודות בקוד ובנתונים לפי אזור (תפוגות, מצגת, נאמנים, טפסי כבאות, נבו).
- `handoff-01-11-2026-13.33.md`: ה-handoff האחרון: ענפים, טופס 08.01 לאחזקה, קובץ 08.01 שנעלם, טיוטת אינפרה רד.
- `project-files/VITRE-API.md`: תמצית ה-API של Vitre.
- `project-files/guide-training/README.md`: מקור מדריכי משאבי אנוש והמנהלים (קליטה, הדרכה שבועית).
- `project-files/ideas-lab.md`: מעבדת הרעיונות וטבלאות החיסכון.
- `project-files/privacy-map.md`: מיפוי מידע אישי וטיוטת הודעה לעובדים.
- `tools/platform/agents/talk-field.md`: סוכן "מה קרה אצלנו השבוע" בהדרכה השבועית.

## פריטים פתוחים (נכון ל-01/11/2026)
- קוד משאבי אנוש לטופס הקליטה (`STATUS.md:43`)
- טופס הקליטה 08.02.01 פעיל תמיד (`STATUS.md:44`)
- קול מדריך בהקראה (`STATUS.md:45`)
- מדריכים למשאבי אנוש ולמנהלים (`STATUS.md:46`)
- סרטון ושאלות הבנה בהדרכה השבועית (`STATUS.md:47`)
- הדרכה שבועית שעובד קורא וחותם (`STATUS.md:48`)
- התקנות החדשות להדרכה מ-16/10/2026 (`STATUS.md:49`)
- בדיקת אפקטיביות להדרכה השבועית (`STATUS.md:50`)
- מסך "הדרכות" עם 08.01 (`STATUS.md:77`)
- הדרכה שבועית אחת לכל המחלקות (`STATUS.md:78`)
- תכנית ההדרכות השנתית כמסך (`STATUS.md:82`)
- "אמרתם, עשינו" בהדרכה השבועית (`STATUS.md:90`)
- חתימת מדריך שגויה בלי דרך תיקון (החלטה) (`STATUS.md:195`)
- `od_put_pdf` לא נרשם ב-Claude Log (נמצא ב-08.01) (`STATUS.md:172`)
- קובץ 08.01 שנתי 2026 נעלם מהתיקייה (`handoff-01-11-2026-13.33.md:16`)
