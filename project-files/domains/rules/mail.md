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
- "הכנתי טיוטה" רק אחרי שהטיוטה נראתה ב-Drafts, עם `checked` "Drafts <נושא> HH:MM"; לא הופיעה אחרי 3 דקות = "ביקשתי, עוד לא הופיעה" ו-`promise` (`project-files/wa-topics/docs.md:16`)
- פתיחה לפי שעה: עד 11:00 "בוקר טוב <שם>," ואחר כך "היי <שם>,"; בלי סיום ובלי שם בגוף, השרת מוסיף חתימה (`project-files/wa-topics/docs.md:22`)
- לא לכתוב למיכאל שהחתימה כפולה בלי לקרוא את הטיוטה עצמה ב-Drafts (`project-files/wa-topics/docs.md:22`)
- בחירה בכפתור הצעה ("טיוטה ליגאל") היא בחירת נושא: קודם `wa_me` עם הנוסח המלא ו-"בצע"/"לא", ורק ב"בצע" `mail_draft`; תשובה חופשית = תיקון נוסח (`project-files/wa-topics/docs.md:15`)
- בקשה מפורשת "תכין טיוטה ל..." עם נמען ברור = `mail_draft` מיד; טיוטה מיוזמתך = קודם נוסח עם "בצע" (`project-files/assistant/files-scans.md:14`)
- אחרי כל טיוטה `promise` "מעקב: טיוטה ל<נמען>" ל-2880 דקות; לכל טיוטה לכל היותר שורה אחת למיכאל (`project-files/wa-topics/docs.md:15`)
- תשובה בשרשור: ב-`to` כל מי שבשרשור חוץ ממיכאל, עד 5; עד 30 ב-`to` וב-`cc` כשכולם `@tapugan.co.il` (`project-files/wa-topics/docs.md:15`)
- איש קשר לפי תפקיד (הנה"ח, רכש, משאבי אנוש) = מי שמקבל את המיילים של התפקיד (`search_people`, ה-To של חשבוניות), לא רק לפי שם התפקיד (`project-files/wa-topics/docs.md:15`)
- נמען למייל לספק = מי ששלח את המסמך שעליו עונים, במיוחד "לתיאום פנו ל"; לא כתובת מנושא אחר; לכתוב למיכאל מאיפה הכתובת (`project-files/agent-common.md:129`)
- כתובת ספק חדשה רק כששולח מהספק מופיע פעמיים לפחות או בחתימה; שתי כתובות אפשריות = לא לבחור (`project-files/routine-supplier-followup.md:18`)
- "עד מתי"/"תחזרו אליי": לבדוק את כל השרשור ב-Sent Items ולהבחין בין שאלה חדשה לטקסט מצוטט; שאלה רק מתחת ל-"From:" כבר נענתה (`project-files/routine-mail-triage.md:25`)
- "הצעה מעודכנת": לפתוח את הקובץ ואת הגרסה הקודמת בשרשור ולכתוב "מה השתנה" (מחיר, מה כלול) (`project-files/routine-mail-triage.md:26`)
- שולח או נושא שמיכאל סימן "לא צריך" פעמיים = לא מציעים יותר; "לא צריך" נרשם `learn` שמתחיל ב-"מיילים:" (`project-files/routine-mail-triage.md:14`)
- מייל עם גוף ריק או רק קובץ מצורף (הזמנת רכש) אינו שאלה שמחכה לתשובה (`project-files/agent-log.md:106`)
- תמונה מוטבעת שנראית ריקה ב-`read_resource` מופיעה ב-`attachments` עם `isInline`; לא לדווח "חסרה תמונה" (`project-files/agent-common.md:128`)
- חיפוש מסמך של גוף חיצוני (מעבדה, בודק, ספק) לפי כתובת השולח ושם הגוף ובקבצים המצורפים, לא רק לפי נושא (`project-files/routine-wa-assistant.md:88`)
- תיקון טיוטה שכבר נוצרה = `mail_draft` חדשה עם `replaces`, כי אי אפשר לערוך טיוטה קיימת (`project-files/wa-topics/docs.md:15`)
- מגבלה, מספר או שעה של המערכת כותבים רק מתוך תשובת השרת; לא ידוע = "השרת סירב: <error>" (`project-files/wa-topics/docs.md:15`)
- זימון לפגישה: ברירת המחדל "טיוטת זימון" בלי מוזמנים (`cal_invite_ask` עם `draft:true`); שליחה ישירה רק כשמיכאל ביקש; אחרי 5 דקות לבדוק ביומן (`project-files/wa-topics/calsign.md:9`)
- הזזת אירוע: רק אירוע שמיכאל ארגן, דרך `cal_move_ask`; אירוע של אחר = טיוטת תשובה למארגן (`project-files/wa-topics/calsign.md:8`)
- שעה ממייל נכתבת כמו במקור עם UTC ("10:07 UTC"), השרת ממיר; אף פעם לא +2/+3 בראש (`project-files/wa-topics/promises.md:11`)
- ספק עם כמה כתובות: לחפש גם לפי שם איש הקשר מההערה, לא רק שם הספק (`project-files/agent-log.md:51`)
- מעקב הצעות: שלבים sent, quote, order, planned רק קדימה; `planned` רק תאריך שסוכם בכתב (`project-files/routine-quotes.md:24`)
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
- `project-files/agent-common.md`: הידע המשותף, הפתיחה והסגירה של כל סוכן, העברת משימות, הצלבת מידע וגרף הקישורים.
- `project-files/agent-log.md`: יומן "למדתי" של כל ריצת סוכן.
- `project-files/assistant/files-scans.md`: קבצים מחוץ לתיקייה, סריקות, `ocr_txt`, מילוי טפסים, חשבוניות בודק, טופס 08.01.
- `project-files/power-automate-mail.md`: עשר זרימות Power Automate: נכנס, בקשות, טיוטות, יומן, זימונים, אתר iso, ניקוי "לא לתיוק".
- `project-files/routine-coa.md`: סידור תעודות COA של שפכים וטיוטת דוח המים החודשי למשרד הבריאות.
- `project-files/routine-mail-filing.md`: תיוק מסמכים מהמייל ועדכון תוקף.
- `project-files/routine-mail-triage.md`: סריקת מיילים שמחכים לתשובה ובדיקת הזרימות.
- `project-files/routine-quality.md`: בודק האיכות היומי: הודעות, טיוטות, כתיבות למסד, חשבוניות, ניסוחי אחראי, טפסי הענפים.
- `project-files/routine-quotes.md`: מעקב שלבי הצעות מחיר (`quote_track`).
- `project-files/routine-supplier-followup.md`: תפוגות שנתקעו אצל ספק וכתובות ספקים חסרות.
- `project-files/routine-wa-assistant.md`: הנוהל הראשי והמלא של העוזר בוואטסאפ.
- `project-files/wa-topics/calsign.md`: יומן, זימון וחתימה (`sign_offer`, `cal_move_ask`, `cal_invite_ask`).
- `project-files/wa-topics/docs.md`: משימות מסמכים, מייל, קובץ, טיוטה וצילום.
- `project-files/wa-topics/maps.md`: מפות ותוכניות האש של המפעל.
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
