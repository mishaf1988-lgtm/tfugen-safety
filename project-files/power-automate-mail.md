# זרימה ב-Power Automate: קבצים מהמייל לתיקיית "_נכנס מהמייל"

מיכאל, 11/10/2026, בשאלון: "בצע: Power Automate + השרת (מומלץ)". המטרה: תיוק המייל בלי תלות במחשב. הענן קורא את הטקסט של קובץ מצורף, אבל לא את הקובץ עצמו, ולאפליקציה אין הרשאת קריאת מייל (DECISIONS 27/09/2026). Power Automate רץ אצל מיקרוסופט, ושומר את הקובץ ב-OneDrive. משם השרת של האפליקציה מעביר אותו לתיקייה הנכונה (`routine-db.js`, `od_move`), לפי `routine-mail-filing.md`.

**גרסה 2 (11/10/2026, מיכאל בשאלון: "בצע: כל מה שמגיע, חוץ מרעש (מומלץ)").** גרסה 1 קלטה רק 11 כתובות. סריקת המייל של שנה (01/10/2025 עד 11/10/2026, כ-1,710 מיילים עם קבצים) מצאה כ-30 שולחים חיצוניים רלוונטיים שלא היו ברשימה (מעבדות, משרד העבודה, המשרד להגנת הסביבה, פיקוד העורף, כבאות, בודקים, קבלנים), ומסמכים רבים שמגיעים רק דרך עובדים שמעבירים (אריה, שלומי, צחי, חדוה, אוקסנה). לכן: כל שולח, חוץ מרשימת החרגה. לקח 76.

## הזרימה (גרסה 2)
- **טריגר:** `When a new email arrives (V3)`, Folder: תיבת דואר נכנס, Include Attachments: Yes, Only with Attachments: Yes, **From: ריק** (כל שולח).
- **החרגה (Condition ראשון, לפני Apply to each):** Expression, "is equal to", `true`:
  `not(contains(createArray('sviva@tapugan.co.il','geny@tapugan.co.il','hr-tap@tapugan.co.il','prod@tapugan.co.il','gideon@tapugan.co.il','tami@k-t.co.il','odoo@k-t.co.il','meital@mishlav.co.il','varditma@ztni.org.il','info@vitre.io','harel@vitre.io'),toLower(triggerOutputs()?['body/from'])))`
  - רגישים (לא לתייק אוטומטית): `geny@`, `hr-tap@`, `prod@` (טופסי תאונה, רשימות עובדים עם תעודות זהות).
  - רעש: `gideon@` (תוכניות ייצור), k-t (הצעות IT), mishlav, ztni, vitre.
  - `sviva@`: המיילים של מיכאל עצמו.
- **בענף True:** Apply to each על Attachments, ובתוכו Condition על סוג הקובץ: `toLower(item()?['name'])` "does not end with" `.jpg`, `.png`, `.gif`, `.ics`, `.zip` (And), ובענף True שלו Create file:
  - Folder Path: `/שולחן העבודה/ניהול בטיחות/_נכנס מהמייל`
  - File Name: `concat(formatDateTime(convertFromUtc(triggerOutputs()?['body/receivedDateTime'],'Israel Standard Time'),'yyyy-MM-dd HHmm'),' - ',item()?['name'])`
  - File Content: `item()?['contentBytes']`
- **תיקייה נוספת:** `_נכנס מהמייל\לא לתיוק`. לשם השרת מעביר מה שלא מתויק (חשבוניות, הצעות מחיר, לא ברור), כך שב-`_נכנס מהמייל` נשאר רק מה שחדש.

## זרימה 2: קבצים ממייל ישן לפי בקשה (11/10/2026)
מיכאל: "אני לא רוצה לכתוב כל פעם לכרום... שהכול יתבצע דרך צ'אט אחד", ובשאלון: "בצע: זרימה שנייה (מומלץ)". אף אחד מהענן, מהשרת או מ-Cowork לא מקבל את הקובץ עצמו של קובץ מצורף (נבדק 11/10/2026), ו-Power Automate כן. לכן:
- **הבקשה:** `routine-db.sh` עם `{"op":"mail_request","agent":"...","message_id":"<id מ-outlook_email_search>","why":"..."}`. השרת כותב קובץ טקסט חדש, שתוכנו מזהה המייל, לתיקייה `ניהול בטיחות\_בקשות מהמייל`.
- **הזרימה** "קבצים ממייל לפי בקשה": טריגר `When a file is created (properties only)` של OneDrive for Business על `/שולחן העבודה/ניהול בטיחות/_בקשות מהמייל`; `Get file content` (Id מהטריגר); `Get email (V2)` של Office 365 Outlook עם Message Id = `trim(string(body('Get_file_content')))` ו-Include Attachments = Yes; Apply to each על `Attachments` מ-Get email, עם אותו תנאי סוגים (jpg, png, gif, ics, zip) ו-Create file ל-`_נכנס מהמייל`, בשם `concat(replace(replace(substring(string(body('Get_email_(V2)')?['receivedDateTime']),0,16),'T',' '),':',''),' - ',item()?['name'])` (שעת UTC; `convertFromUtc` על הערך של Get email נכשל ב-InvalidTemplate, נבדק 11/10/2026), תוכן Attachments Content.
- קובץ הבקשה נשאר בתיקייה (בלי מחיקה); הוא קטן, ומיכאל מנקה מתי שנוח.
- **נבדק 11/10/2026:** בקשה אחת (דוח משאבות 2/26) הגיעה לתיקיית הנכנס כ-`2026-02-17 1103 - חודשית פברואר.pdf`, 315,776 בתים. מזהה המייל מ-`outlook_email_search` עובד ב-`Get email (V2)` כמו שהוא, ו-Get file content מחזיר טקסט רגיל. בריצה הראשונה נכשל רק שם הקובץ (convertFromUtc), ותוקן.
- **גודל:** הגודל של קובץ מצורף בתוצאות החיפוש במייל (316,094) שונה מגודל הקובץ שנשמר (315,776). כפילות מזהים לפי התאריך שבשם ולפי קובץ שכבר בתיקייה, לא לפי הגודל שבמייל.

## מה לא נתפס (ידוע ומתועד)
- **מייל שכלל ב-Outlook מעביר לתיקייה אחרת:** הזרימה מסתכלת רק על תיבת הדואר הנכנס. בסריקה נמצאו בתיקיות אחרות אישורי דיווח תאונה מ-gov.il וחשבוניות. ה-Routine מחפש במייל בכל התיקיות (צעד 2), וקובץ שלא הגיע לתיקיית הנכנס עובר ל-Cowork או לדוח.
- **קובץ מצורף שהוא מייל שלם (.msg), zip או תמונה של מסמך:** לא נשמר (zip ותמונות), או נשמר אבל לא נקרא (.msg). ה-Routine רושם אותו בדוח.
- **שולח חדש ברשימת הרעש:** רק מה שברשימה מוחרג. רעש חדש נשמר, וה-Routine מעביר אותו ל"לא לתיוק".

## הוראות ל-Claude בכרום (שינוי מגרסה 1)
הטקסט להדבקה נמצא בתשובה למיכאל ב-11/10/2026, ועקרונותיו: אישור "בצע" כבר ניתן בשאלון של Claude Code; ליצור את `לא לתיוק` בתוך `_נכנס מהמייל`; לרוקן את From; להוסיף את Condition ההחרגה מעל Apply to each; להרחיב את Condition הסוגים; לבדוק ב-Code view; לא לשלוח מייל לבדיקה.

## הערות מההגדרה (11/10/2026, Claude בכרום, גרסה 1)
- Folder מופיע בעברית: "תיבת דואר נכנס".
- שדה From בוחר אנשים: הדבקה של כל הרשימה מוחקת את הנקודה-פסיק. להוסיף כתובת אחת בכל פעם.
- ביטוי: בלחיצה הראשונה על Add לפעמים "This expression has a problem", בשנייה הוא מתקבל.
- File Content: `item()?['contentBytes']` עבד.
- Claude בכרום עצר לבקש "בצע" לפני כתיבה ב-365 (ה-guard שלו). בהוראות לכתוב מראש שיש אישור ומאיזה שאלון.

## רעש או רגיש חדש
להוסיף את הכתובת, באותיות קטנות, לרשימה ב-`createArray` (פסיק וגרש בודד). ה-Routine רושם בדוח שולחים שכל הקבצים שלהם עברו ל"לא לתיוק" במשך חודש, כהצעה להחרגה.
