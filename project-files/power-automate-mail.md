# זרימה ב-Power Automate: קבצים מהספקים לתיקיית "_נכנס מהמייל"

מיכאל, 11/10/2026, בשאלון: "בצע: Power Automate + השרת (מומלץ)". המטרה: תיוק המייל בלי תלות במחשב. הענן קורא את הטקסט של קובץ מצורף, אבל לא את הקובץ עצמו, ולאפליקציה אין הרשאת קריאת מייל (DECISIONS 27/09/2026). Power Automate רץ אצל מיקרוסופט, ושומר את הקובץ ב-OneDrive. משם השרת של האפליקציה מעביר אותו לתיקייה הנכונה (`routine-db.js`, `od_move`), לפי `routine-mail-filing.md`.

מיכאל מגדיר פעם אחת, כ-10 דקות, ממחשב או מהטלפון בדפדפן.

## לפני: תיקייה אחת
ב-OneDrive, בתוך "שולחן העבודה\ניהול בטיחות", ליצור תיקייה בשם `_נכנס מהמייל` (עם הקו התחתון בהתחלה, כדי שתופיע ראשונה).

## ההגדרה
1. להיכנס ל-https://make.powerautomate.com עם החשבון sviva@tapugan.co.il.
2. "יצירה" (Create), ואז "זרימת ענן אוטומטית" (Automated cloud flow). שם: `קבצים מספקים לנכנס מהמייל`.
3. הטריגר: לחפש `When a new email arrives (V3)` של Office 365 Outlook, ולבחור אותו. "יצירה".
4. בטריגר, "Show all" / "הצג הכל":
   - **Folder:** Inbox
   - **From:** להדביק את השורה הזו כמו שהיא:
     `Nurit@betihut.com;tamar@gafir-sys.com;scan@betihut.com;Adoram@betihut.com;bkeng.ltd@gmail.com;office@ulpa-cr.com;tammybeg@gazit.co.il;jonathan.schindler1@gmail.com;nissim@rotemsafety.co.il;eliyahu@ahlama.co.il;tali@alpinesystem.com`
   - **Include Attachments:** Yes
   - **Only with Attachments:** Yes
5. "+ New step", לחפש `Create file` של **OneDrive for Business**.
   - **Folder Path:** לבחור בתיקייה `/שולחן העבודה/ניהול בטיחות/_נכנס מהמייל`.
   - **File Name:** ללחוץ על "Expression" (fx) ולהדביק:
     `concat(formatDateTime(convertFromUtc(triggerOutputs()?['body/receivedDateTime'],'Israel Standard Time'),'yyyy-MM-dd HHmm'),' - ',item()?['name'])`
   - **File Content:** מהתוכן הדינמי, `Attachments Content`.
   Power Automate יעטוף את הצעד לבד ב-"Apply to each" על `Attachments`. זה נכון: קובץ אחד לכל קובץ מצורף.
6. **בלי תמונות חתימה:** בתוך ה-"Apply to each", לפני "Create file", "Add an action", ואז `Condition`. בצד שמאל: Expression `toLower(item()?['name'])`, האופרטור "does not end with", בצד ימין `.jpg`. להוסיף שורה ("Add row") עם `.png` באותה צורה (And). לגרור את "Create file" לענף "True" (If yes).
7. "Save". אחר כך "Test", "Manually", ולשלוח לעצמך מייל עם PDF מאחת הכתובות, או לחכות לדוח הבא.

## מה יקרה
- כל קובץ מצורף (חוץ מתמונות) ממייל של ספק מהרשימה נשמר ב-`_נכנס מהמייל`, בשם שמתחיל בתאריך ובשעה של המייל.
- ה-Routine היומי (א'-ה' 17:52) קורא את הקובץ, ואם זה דוח או תעודה של פריט שיש לו תיקייה, השרת מעביר אותו לשם בשם לפי הקבצים שכבר שם, ומעדכן את התוקף באפליקציה. שם תפוס = לא דורס, נשאר בנכנס ומופיע בדוח.
- חשבוניות, הצעות מחיר ומה שלא ברור נשארים ב-`_נכנס מהמייל`. אתה מנקה אותה מתי שנוח.

## ספק חדש
ספק שלא ברשימה: להוסיף את הכתובת לשדה **From** (עם `;` לפני). ה-Routine רושם בדוח מיילים עם קבצים מכתובות שלא ברשימה, כדי שיהיה ברור מה להוסיף.
