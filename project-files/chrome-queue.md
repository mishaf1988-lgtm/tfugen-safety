# משימות ל-Claude בכרום

מיכאל, 12/10/2026: "תזכור שיש תוסף של כרום, תזכור שצריך לרשום במשימות ולתזכר אותי לבקש מהכרום לעשות".

**מה נכנס לכאן:** כל פעולה שצריכה דפדפן ומחשב של מיכאל, ושאי אפשר לעשות מהענן: Power Automate, מסכי הגדרות (Supabase, Cloudflare, Microsoft 365), ובדיקה באתר החי (האתר מחזיר 403 לענן). פעולה בתיקיות של OneDrive עוברת קודם דרך `routine-db` או Cowork (`cowork-queue.md`), ורק אם אין דרך אחרת היא נכנסת לכאן.

**עדיפות ראשונה (מיכאל, 18/10/2026: "ברגע שאני על המחשב, תרשום הוראות לכרום לבצע את כל זה, ואל תסביר לי איך לעשות את זה. אם כרום כבר לא יכול לעשות את זה, אז אני אשתתף בפעולה"):** כל פעולה במחשב = טקסט אחד להדבקה ב-Claude בכרום, בלי הסבר למיכאל איך לעשות. דף הוראות עם צילומים רק כשכרום לא יכול (למשל הדבקת ערך סודי, שכרום מסרב לה), ושם רק החלק של מיכאל. **כרום לא מזין סיסמה** (18/10/2026: משימה 1 נעצרה במסך הכניסה של האפליקציה). משימה שצריכה כניסה לאתר מתחילה בשורה למיכאל: "להתחבר קודם ל-<אתר> בלשונית בקבוצה של Claude", ורק אחריה הבלוק לכרום.

**איך נכתבת משימה:** שורה `- [ ] **C<מספר>. <מה>** (<תאריך>, <מקור>)`, ומתחתיה הטקסט המוכן להדבקה בכרום, בבלוק. הטקסט כולל את ה"בצע" שכבר ניתן ואיפה ניתן, מה לבדוק בסוף, ומה לא לעשות (לא לשלוח מייל, לא למחוק). משימה חדשה נרשמת באותו PR שיצר את הצורך בה.

**בצ'אט: הטקסט לכרום תמיד בתיבה** (מיכאל, 20/10/2026: "רשום לי מה להעביר לכרום בתיבה תמיד"): כשמזכירים משימה פתוחה כאן בתשובה למיכאל, מדביקים בתשובה עצמה את הטקסט שלה בבלוק קוד, לא רק את המספר והנתיב.

**התזכורת:**
- `session-start.py` מציג את המשימות הפתוחות בתחילת כל שיחה.
- המפקח (`supervisor.py`) חוסם סיכום של משימה שמוזגה כשיש משימה פתוחה כאן ואין בסיכום שורה "🌐 לכרום".

**כשמשימה בוצעה:** לאמת מכאן מה שאפשר (`read_resource`, `routine-db`, מייל של Power Automate), לסמן `[x]` עם התאריך ואיך זה אומת, ולהעביר לסעיף "בוצע".

## מחשב בענן במקום המחשב של מיכאל (נבדק 12/10/2026, מיכאל בשאלון: "לבדוק מחשב בענן")

- **התוסף יודע לרוץ לבד:** ב-Claude in Chrome יש קיצורים מתוזמנים (שעון בפינת החלונית, יומי/שבועי/חודשי). כרום צריך להיות פתוח, והמחשב ער (המאמר הרשמי לא אומר מה קורה במחשב רדום). מקור: support.claude.com, "Get started with Claude in Chrome".
- **המחשב:** Windows 365 Business, מחשב בענן שדולק תמיד, כ-25.60 דולר לחודש (2 מעבדים, 4GB) עד 36 דולר (8GB). המחיר לפי מקורות משניים מ-2026, לא לפי הצעה של מיקרוסופט. רישיונות Office לא כלולים.
- **התנאי שמכריע:** Windows 365 נקנה ומוקצה על ידי מנהל ה-Microsoft 365 של תפוגן. זו תלות במנהל הארגון, שמיכאל ביקש להימנע ממנה (09/10/2026). חלופה בלי מנהל: מכונה וירטואלית ב-Azure על מנוי אישי, אבל ההתחברות שם ל-365 של תפוגן היא בכל זאת חשבון ארגוני על מכונה מרוחקת.
- **מה זה יפתור:** כל מה שבתור הזה, כולל Power Automate. הקיצור המתוזמן יקרא את התור ויבצע משימות מסומנות. **מה זה לא יפתור:** אימות דו-שלבי שפג (פעם בכמה שבועות) עדיין צריך את הטלפון של מיכאל.
- **לא רק האתר שלנו** (מיכאל, 12/10/2026: "יש שילוב של עבודה במספר אתרים כמו שנעשה היום"): Power Automate, Microsoft 365, Supabase, Cloudflare, נבו ופורטלים של ספקים, כולם בהתחברות של מיכאל. מעבר בשער המדינות שלנו לא פותר אותם (וגם נחסם במסווג, STATUS "בדיקות אתר מהענן"). הפתרון המלא לכולם: מחשב שדולק תמיד עם כרום מחובר וקיצור מתוזמן שקורא את התור הזה.
- **שלוש דרכים:** מחשב ישן במשרד שדולק תמיד (בלי עלות ובלי מנהל; סיכון: גישה פיזית); Windows 365 (מנהל 365); מכונה ב-Azure על מנוי אישי (חשבון ארגוני על מכונה אישית). בכולן: אימות דו-שלבי שפג צריך את הטלפון, כרום פתוח והמחשב לא נרדם. **מחכה לבחירה של מיכאל** (12/10/2026 השאלון נסגר בלי בחירה). **נבדק 12/10/2026 (צילום של מיכאל מ-admin.microsoft.com):** `sviva@tapugan.co.il` אינו מנהל ב-365 ("עבור לחשבון בעל הרשאה"). Windows 365 רק דרך מנהל ה-IT של תפוגן; בלי מנהל נשארים המחשב במשרד או Azure אישי.
- **13/10/2026, מיכאל: "תבחן לי מחשב וירטואלי... זה יהיה המחשב עבודה שלך":** התכנון ב-`project-files/work-vm-plan.md` (Windows ב-Azure ישראל, B2s, כ-41 דולר לחודש, Claude Code עם כרום ומשימה מתוזמנת על התור הזה). מחכה לאישור הוצאה.
- **המלצה (לפני ההבהרה על אתרים רבים):** רק אם המשימות כאן נהיות שבועיות. היום יש 2 פתוחות, וקודם בדיקות האתר יכולות לעבור לענן (מפתח נפרד בשער המדינות ב-`_middleware.js`, ומשתמש בדיקה). מחכה להחלטה של מיכאל (כסף, מנהל הארגון).

## פתוח

- [ ] **C32. להוסיף את ה-repo ל-Routine של הפיתוח המיידי** (נבדק בכרום 21/10/2026 17:20: הרשימה ריקה גם במחשב; ב-claude.ai/code אין בחירת מאגר בכלל; connect-github מפנה ל-Connectors, ושם אין חיבור GitHub, רק תוסף ה-MCP. **מושהה**: הבקשות עוברות לשיחת הפיתוח אחרי שעתיים. לפתוח מחדש רק אם יימצא מסך החיבור) (21/10/2026, ניסוי 4 של מיכאל: הקוד נבנה, ה-push נחסם כי tfugen-safety לא במקורות של `trig_0114iVUybrBb6vRqZt1EyoyL`). טקסט להדבקה בכרום:
  ```
  משימה: לחבר מאגר GitHub ל-Routine "פיתוח מיידי: בקשה מהעוזר". לא לשנות את ההוראות (Instructions), את המודל, את הטריגר או שום הגדרה אחרת. לא למחוק כלום. אם משהו לא נראה כמו שכתוב, לעצור ולתאר מה רואים.
  1. לפתוח https://claude.ai/code/routines/trig_0114iVUybrBb6vRqZt1EyoyL וללחוץ Edit.
  2. מתחת לתיבת ההוראות, משמאל ל-Default, ללחוץ "Select a repository". להשאיר את החיפוש ריק ולחכות שהרשימה תיטען.
  3. לבחור mishaf1988-lgtm/tfugen-safety ולשמור (Save).
  4. אם הרשימה ריקה ("No repositories found"): לא לשמור. לפתוח בלשונית חדשה https://claude.ai/code, לבדוק אם בבחירת מאגר לשיחה חדשה (בלי לפתוח שיחה) מופיע tfugen-safety, ואם יש שם כפתור לחיבור GitHub, ללחוץ עליו ולאשר. לחזור לצעד 1.
  5. בסוף: דוח קצר, מה רשום עכשיו ליד "Select a repository" ב-Routine, ואם צעד 4 היה נחוץ, מה ראית שם.
  ```
  אחרי הביצוע: Claude בודק ב-`get_trigger` ש-`sources` מכיל את ה-repo, ובבקשה הבאה ב-`list_events` שה-push עבר ושה-hooks נטענו.

- [ ] **C33. טוקן ל"עובד לפי דרישה"** (21/10/2026, מיכאל בשאלון: "בצע: עובד לפי דרישה"). **חלק 1 בוצע ואומת (21/10/2026 19:27, `get_trigger`: Microsoft-365 ב-`mcp_connections`).** חלקים 2-3 נשארים למיכאל ביד: הכרום מסרב לגעת בטוקן, ו"Call via API" בעריכה לא נשמר (אחרי רענון: "Manual only"). הדף עם הכפתורים: https://claude.ai/artifact/2Vj5MbGNxQy4Y3prJWFt73 משימה שהעוזר מעביר לעובד תפתח מיד שיחה של אותו עובד (`routine-worker-now.md`), והעובד יענה למיכאל בוואטסאפ, במקום לחכות לדוור. עד שהסוד קיים השרת לא מפעיל כלום, והעוזר מבצע בעצמו כמו היום. טקסט להדבקה בכרום:
  ```
  משימה: טוקן API ומחבר Microsoft 365 ל-Routine "עובד לפי דרישה: משימה מהעוזר". שלושה חלקים, לפי הסדר. לא לשנות את ההוראות (Instructions), את המודל או שום הגדרה אחרת, לא למחוק, ולא לכתוב את הטוקן בצ'אט, בצילום או בתשובה: רק להעתיק ישר משדה לשדה. אם משהו לא נראה כמו שכתוב, לעצור ולתאר מה רואים.
  חלק 1: https://claude.ai/code/routines/trig_011UyDNeQ1NV72NNyXJxwxtE > Edit > Connectors: להוסיף Microsoft 365 (אם יש אפשרות כזו; אם אין, לדלג ולכתוב בדוח) > שמירה.
  חלק 2: באותו דף > Edit > Select a trigger > Add another trigger > API > Generate token (להעתיק מיד) > שמירה.
  חלק 3: https://dash.cloudflare.com/c9d388e3a5f9ee9546e8aa6b6353ec87/pages/view/tapugan-safety/settings/environment-variables > Production > Add > Secret, WORKER_FIRE_TOKEN = הטוקן > Save. לא לגעת במשתנה אחר.
  בסוף: דוח קצר, אילו חלקים עברו.
  ```
  אחרי הביצוע: Claude מוודא ב-API של Cloudflare שהשם קיים, מזג כלשהו ל-main (פריסה), ומשימת ניסיון אחת (`worker_now` קטנה) מראה `fired.session`, שיחה חדשה ב-`list_events`, ו-`worker_done` שהגיע למיכאל.

- [x] **C31. טוקן לפיתוח המיידי** (21/10/2026, מיכאל בשאלון: "בצע: שיחה חדשה לכל בקשה"). בקשה מהעוזר ("העבר לפיתוח") תפתח מיד שיחת פיתוח חדשה (`routine-dev-fire.md`), במקום לחכות לדוור עד 4 שעות. עד שהסוד קיים השרת לא מפעיל כלום (הכל כמו היום). טקסט להדבקה בכרום:
  ```
  משימה: טוקן API ל-Routine "פיתוח מיידי: בקשה מהעוזר". שני חלקים, לפי הסדר. לא לשנות שום הגדרה אחרת, לא למחוק, ולא לכתוב את הטוקן בצ'אט, בצילום או בתשובה: רק להעתיק ישר משדה לשדה. אם משהו לא נראה כמו שכתוב, לעצור ולתאר מה רואים.
  חלק 1: https://claude.ai/code/routines/trig_0114iVUybrBb6vRqZt1EyoyL > Edit > Select a trigger > Add another trigger > API > Generate token (להעתיק מיד) > שמירה.
  חלק 2: https://dash.cloudflare.com/c9d388e3a5f9ee9546e8aa6b6353ec87/pages/view/tapugan-safety/settings/environment-variables > Production > Add > Secret, DEV_FIRE_TOKEN = הטוקן > Save. לא לגעת במשתנה אחר.
  בסוף: דוח קצר, האם שני החלקים עברו.
  ```
  אחרי הביצוע: Claude מוודא ב-API של Cloudflare שהשם קיים, מזג כלשהו ל-main (פריסה), ובקשת ניסיון אחת (`dev_request` קטנה) מראה `fired.session` ושיחה חדשה ב-`list_events`.

- [x] **C23. Power Automate: זרימת "טיוטות מהעוזר"** (נסגר 20/10/2026: נבנתה, הטיוטה לבדיקה הגיעה ל-Drafts) (20/10/2026, מיכאל: "אולי דרך כלים נוספים"). הפירוט: `power-automate-mail.md`, זרימה 3. טקסט להדבקה בכרום:
  ```
  אתה בונה בשבילי זרימה ב-Power Automate. עבור על השלבים ברצף, עצור רק אם משהו לא תואם, ותאר מה אתה רואה. אל תוסיף שום פעולה ששולחת מייל.
  1. ב-OneDrive (https://www.office.com/launch/onedrive), בתיקייה "שולחן העבודה" > "ניהול בטיחות", צור תיקייה חדשה בשם: _טיוטות למייל (אם קיימת, דלג).
  2. פתח https://make.powerautomate.com > Create > Automated cloud flow. שם: טיוטות מהעוזר. טריגר: OneDrive for Business "When a file is created (properties only)". Folder: /שולחן העבודה/ניהול בטיחות/_טיוטות למייל.
  3. New step: OneDrive for Business "Get file content". File: Id מהטריגר.
  4. New step: Data Operation "Compose". Inputs, בלשונית Expression: json(trim(string(body('Get_file_content'))))
  5. New step: Office 365 Outlook, חפש "Draft an email message". אם קיים: To = outputs('Compose')?['to'], Subject = outputs('Compose')?['subject'], Body = outputs('Compose')?['html'] (כל אחד כ-Expression). אם לא קיים: Office 365 Outlook "Send an HTTP request", Method POST, URI https://graph.microsoft.com/v1.0/me/messages, Content-Type application/json, Body:
     {"subject": "@{outputs('Compose')?['subject']}", "body": {"contentType": "HTML", "content": "@{outputs('Compose')?['html']}"}, "toRecipients": [{"emailAddress": {"address": "@{outputs('Compose')?['to']}"}}]}
  6. Save. אל תריץ בדיקה ידנית.
  בסוף: דוח קצר: איזו פעולה נבחרה בשלב 5 (Draft an email message או Send an HTTP request), והאם השמירה הצליחה.
  ```
  אחרי הביצוע: Claude שולח בקשת טיוטה אחת לבדיקה (`mail_draft`), ומיכאל מאשר שהטיוטה הופיעה ב-Drafts.
- [x] **C24. Power Automate: "תורים ליומן" ו"קבצים ממיילים ששלחתי"** (נסגר 20/10/2026: שתיהן נבנו, 5 תורים ביומן; קובץ ראשון מ"נשלח" נבדק במייל הבא) (20/10/2026, מיכאל בשאלון: "בצע: תורים ביומן לתפוגות (מומלץ), בצע: קבצים ממיילים ששלחתי (מומלץ)"). הפירוט: `power-automate-mail.md`, זרימות 4 ו-5. אפשר באותה ישיבה עם C23. טקסט להדבקה בכרום:
  ```
  אתה בונה בשבילי שתי זרימות ב-Power Automate. עבור על השלבים ברצף, עצור רק אם משהו לא תואם, ותאר מה אתה רואה. אל תוסיף שום פעולה ששולחת מייל או הזמנה, ואל תשנה זרימה קיימת.
  זרימה א, "תורים ליומן":
  1. ב-OneDrive (https://www.office.com/launch/onedrive), בתיקייה "שולחן העבודה" > "ניהול בטיחות", צור תיקייה חדשה בשם: _תורים ליומן (אם קיימת, דלג).
  2. https://make.powerautomate.com > Create > Automated cloud flow. שם: תורים ליומן. טריגר: OneDrive for Business "When a file is created (properties only)". Folder: /שולחן העבודה/ניהול בטיחות/_תורים ליומן.
  3. New step: OneDrive for Business "Get file content". File: Id מהטריגר.
  4. New step: Data Operation "Compose". Inputs, בלשונית Expression: json(trim(string(body('Get_file_content'))))
  5. New step: Office 365 Outlook "Create event (V4)". Calendar id: Calendar. כל אחד כ-Expression: Subject = outputs('Compose')?['subject'], Start time = outputs('Compose')?['start'], End time = outputs('Compose')?['end'], Body = outputs('Compose')?['html']. Time zone: (UTC+02:00) Jerusalem. Show as: busy. Reminder: 15. שדות Required attendees ו-Optional attendees נשארים ריקים.
  6. Save. אל תריץ בדיקה ידנית.
  זרימה ב, "קבצים ממיילים ששלחתי":
  7. ב-My flows פתח את הזרימה הקיימת "קבצים מספקים לנכנס מהמייל" (רק לקריאה, בלי לשמור בה שום שינוי). העתק את הביטוי createArray(...) מה-Condition הראשון שלה, ואת כל השורות של ה-Condition על סוג הקובץ בתוך Apply to each.
  8. Create > Automated cloud flow. שם: קבצים ממיילים ששלחתי. טריגר: Office 365 Outlook "When a new email arrives (V3)". Folder: Sent Items. Include Attachments: Yes. Only with Attachments: Yes.
  9. New step: Condition. שורה אחת, Expression: empty(intersection(<ה-createArray שהעתקת>,split(toLower(coalesce(triggerOutputs()?['body/toRecipients'],'')),';'))) , is equal to, true.
  10. בענף True: Apply to each על Attachments. בתוכו Condition עם אותן שורות שהעתקת משלב 7. בענף True שלו: OneDrive for Business "Create file". Folder Path: /שולחן העבודה/ניהול בטיחות/_נכנס מהמייל. File Name, Expression: concat(replace(replace(substring(string(triggerOutputs()?['body/receivedDateTime']),0,16),'T',' '),':',''),' - נשלח - ',item()?['name']). File Content, Expression: item()?['contentBytes'].
  11. Save, ובדוק ב-Flow checker שאין שגיאות. אל תריץ בדיקה ידנית.
  בסוף: דוח קצר: לכל זרימה נשמרה או לא, ומה הראה ה-Flow checker. בלי כתובות מייל בדוח.
  ```
  אחרי הביצוע: Claude קורא ל-`/api/wa-morning` עם `{"calendar":true}` (רק התורים, בלי וואטסאפ) ובודק ש-`cal.written` > 0, ומיכאל מאשר שהתורים הופיעו ביומן; הקובץ הראשון עם "נשלח" בשם יופיע ב-`_נכנס מהמייל` במייל הבא עם קובץ שמיכאל ישלח.
- [x] **C25. בדיקת קובץ המפגעים והדוח למחלקות** (נסגר 20/10/2026: הכל תקין, שישה פריטים נסגרו) (20/10/2026, מיכאל בשאלון: "צריך משימה לכרום"). סוגר שישה פריטים ב-STATUS (פעולה מתקנת, גובה שורות, "פגום", פילטר, תמונות, דוח למחלקות). קריאה בלבד. טקסט להדבקה בכרום:
  ```
  משימת בדיקה, קריאה בלבד: אל תשנה, אל תשמור, אל תשלח ואל תמחק שום דבר. עבור על השלבים ברצף, ובכל שלב כתוב מה ראית. עצור רק אם משהו לא נפתח.
  1. פתח את OneDrive (https://www.office.com/launch/onedrive) > שולחן העבודה > ניהול בטיחות > 13_סיורי מפגעים > 2026, ופתח בדפדפן (Excel באינטרנט) את "ניהול סיורי מפגעים.xlsm". אם קופצת הודעה שהקובץ פגום או שהתוכן תוקן: צלם את ההודעה, וכתוב "פגום". אם לא: כתוב "נפתח תקין".
  2. בגיליון "מאגר מפגעים": האם יש פילטר על העמודה של הסטטוס (K), ומה מסומן בו (פתוח, בטיפול, ריקות)? האם רואים שורות בסטטוס "סגור"?
  3. מצא שורה עם טקסט ארוך בעמודת התיאור או הפעולה: האם רואים את כל הטקסט, או שהוא נחתך בגובה השורה? צלם שורה אחת כזו.
  4. האם יש תמונות קטנות בתוך התאים של מפגעים פתוחים? כמה בערך? צלם אחת.
  5. האם יש עמודה "פעולה מתקנת", והאם היא מלאה בשורות של ליקויי נאמנים? העתק את הטקסט של שתיים מהן.
  6. פתח את "ניהול סיורי מפגעים.xlsx" באותה תיקייה ובדוק את שלבים 1-3 גם בו (רק כתוב מה שונה).
  7. ב-Outlook באינטרנט (https://outlook.office.com) > Sent Items, חפש מיילים מ-14/10/2026 עם "מפגעים" בנושא, למחלקות ייצור טוגנים, חומר גלם ואחזקה. לכל אחד: הנושא, האם יש טבלה עם המפגעים, האם יש תמונות. אל תפתח קישורים בתוכם.
  בסוף: דוח קצר, שורה לכל שלב. בלי שמות עובדים וכתובות מייל.
  ```
  אחרי הביצוע: Claude סוגר ב-STATUS כל פריט שהדוח מראה שעובד, ומתקן בקוד את מה שלא.
- [x] **C22. וואטסאפ: לחבר את העוזר (טוקן, Cloudflare, Meta)** (נסגר 20/10/2026: מיכאל כתב לעוזר בוואטסאפ וקיבל תשובה; Publish לא נדרש) (19/10/2026, מיכאל: "תכתוב לי הוראות מלאות לכרום שיעשה הכל"). ה-verify token בטקסט הוא אימות חד-פעמי של ה-webhook, לא מפתח גישה. אחרי הביצוע: retry לפריסה ב-API, בדיקת השמות ב-`pages/projects`, ו-`wa_me` בדיקה. **19/10/2026:** ה-webhook אומת. נשאר רק Subscribe ל-`messages` (מיכאל קיבל הוראות בצ'אט, שלבים 1-7, רצופים). אחרי: `routine-db.sh '{"op":"wa_check"}'` מאמת מול Meta את הסוד, ה-Subscribe והמינוי של ה-WABA, ו-`subscribe:true` משלים בעצמו מה שחסר.
```
משימה: לחבר את העוזר בוואטסאפ של מערכת הבטיחות. שלושה חלקים, לפי הסדר. לא לשנות שום הגדרה אחרת, לא למחוק שום דבר, ולא לכתוב אף ערך סודי (טוקן, App secret) בצ'אט, בצילום או בתשובה: רק להעתיק ישר משדה לשדה. אם משהו לא נראה כמו שכתוב, לעצור ולתאר מה רואים.
חלק 1: https://claude.ai/code/routines/trig_01TofqtqNWtrXMnqiNjHq1nZ > Edit > Select a trigger > Add another trigger > API > Generate token (להעתיק מיד) > שמירה. לא לגעת בתזמון 07:47.
חלק 2: https://dash.cloudflare.com/c9d388e3a5f9ee9546e8aa6b6353ec87/pages/view/tapugan-safety/settings/environment-variables > Production > Add > Secret, ASSISTANT_FIRE_TOKEN = הטוקן > Save. לא לגעת במשתנה אחר.
חלק 3: https://developers.facebook.com/apps/ > האפליקציה של הוואטסאפ העסקי (יותר מאחת: לעצור ולשאול) > WhatsApp > Configuration > Webhook > Edit: Callback URL https://tapugan-safety.pages.dev/api/wa-hook, Verify token = הערך מהדף של העוזר (Artifact GJaz2Vh5NtW1a5PjWJu1y9) > Verify and save. Webhook fields > messages > Subscribe. App settings > Basic > App secret > Show (סיסמה: לעצור ולבקש) > ב-Cloudflare Add > Secret, META_APP_SECRET.
בסוף: לכל חלק בוצע או לא; האם שני השמות מופיעים כ-Secret; האם האימות עבר ו-messages Subscribed. בלי שום ערך סודי.
```

- [x] **C26. Power Automate: קבצים מצורפים בזרימה "טיוטות מהעוזר"** (נסגר 20/10/2026: בוצע בכרום. התיקון הנדרש: ContentBytes = `@body('Get_file_content_using_path')` בלי מרכאות ובלי `$content`; בניסיון הראשון הקובץ קודד פעמיים, 282KB במקום 211KB, ולא נפתח. בדיקה 2: הגודל כמו המקור והטקסט נקרא) (20/10/2026, מיכאל: "יש לך כלי להכין טיוטה וצרף את הטיוטה ללא חתימה"). השרת כבר שולח בבקשת הטיוטה רשימת `attachments` (נתיב ושם של כל קובץ ב-OneDrive). הזרימה צריכה לצרף אותם. הראשונה שמחכה: ארבעת הקבצים של מפעילי דוד הקיטור (כתב מינוי לא חתום + תעודה) לגני ולצחי. טקסט להדבקה בכרום:
  ```
  אתה מעדכן זרימה קיימת ב-Power Automate. עבור על השלבים ברצף, עצור רק אם משהו לא תואם, ותאר מה אתה רואה. אל תוסיף שום פעולה ששולחת מייל, ואל תשנה את הטריגר.
  1. פתח https://make.powerautomate.com > My flows > "טיוטות מהעוזר" > Edit.
  2. אחרי הפעולה Compose: New step > Variables "Initialize variable". Name: att, Type: Array, Value: []
  3. אחריה: Control "Apply to each". בשדה "Select an output", בלשונית Expression: coalesce(outputs('Compose')?['attachments'], json('[]'))
  4. בתוך הלולאה: OneDrive for Business "Get file content using path". File Path, בלשונית Expression: items('Apply_to_each')?['path']
  5. בתוך הלולאה, אחריה: Variables "Append to array variable". Name: att. Value (טקסט, עם שני ביטויים במקומות המסומנים):
     {"Name": "<Expression: items('Apply_to_each')?['name']>", "ContentBytes": "<Expression: body('Get_file_content_using_path')?['$content']>"}
  6. בפעולה "Draft an email message" (אחרי הלולאה): פתח Show advanced options, בשדה Attachments לחץ על הכפתור שמחליף לקלט של מערך שלם (Switch to input entire array), ושים Expression: variables('att')
  7. Save. אל תריץ בדיקה ידנית. בדוק שה-Flow checker מראה 0 שגיאות.
  בסוף: דוח קצר: האם כל שבעת השלבים עברו, ומה ה-Flow checker הראה.
  ```
  אחרי הביצוע: Claude שולח `mail_draft` לבדיקה למיכאל עצמו עם קובץ מצורף אחד, ואז את הטיוטה לגני ולצחי עם ארבעת הקבצים.

- [x] **C27. טוקן לדוור, כדי שהשרת יעיר אותו מיד** (נסגר 20/10/2026: מיכאל ביצע מהטלפון, הסוד קיים ונפרס; אבל הבדיקה הראתה שהפעלה דרך ה-API פותחת שיחה חדשה בלי send_message, ולכן זה לא מוסר משימות. לקח 133) (20/10/2026, מיכאל בשאלון: "בצע: טוקן לדוור (מומלץ)"). משימה שהעוזר בוואטסאפ מעביר לעובד מחכה היום לסבב הדוור הבא (עד 4 שעות). עם הטוקן, `relay_fire` בשרת מעיר את הדוור מיד, ורק כשיש משימה. טקסט להדבקה בכרום:
  ```
  משימה: טוקן API לדוור של משרד הסוכנים. שני חלקים, לפי הסדר. לא לשנות שום הגדרה אחרת, לא למחוק, ולא לכתוב את הטוקן בצ'אט, בצילום או בתשובה: רק להעתיק ישר משדה לשדה. אם משהו לא נראה כמו שכתוב, לעצור ולתאר מה רואים.
  חלק 1: https://claude.ai/code/routines/trig_01Py8YXifD3HtnQUmFgoTRft > Edit > Select a trigger > Add another trigger > API > Generate token (להעתיק מיד) > שמירה. לא לגעת בתזמון (08:11, 12:11, 16:11).
  חלק 2: https://dash.cloudflare.com/c9d388e3a5f9ee9546e8aa6b6353ec87/pages/view/tapugan-safety/settings/environment-variables > Production > Add > Secret, POSTMAN_FIRE_TOKEN = הטוקן > Save. לא לגעת במשתנה אחר.
  בסוף: דוח קצר, האם שני החלקים עברו.
  ```
  אחרי הביצוע: Claude מוודא ב-API של Cloudflare שהשם קיים, מזג כלשהו ל-main (פריסה), ואז `routine-db.sh '{"op":"relay_fire","agent":"dev","expect_session":"session_01JT8Fct6Z6Qv2GbaBBqxtQT"}'`: מצופה `fired: true` ו-`landed: true`, ואירוע חדש בשיחה של הדוור (`list_events`). רק אז C27 נסגר.

## בוצע
- [x] **C30. מחיקת מחשב העבודה ב-Azure, עכשיו** (21/10/2026, מיכאל: "למחוק את המחשב ב-Azure עכשיו", אחרי מייל התקציב: 12.19 מתוך 15 דולר מהקרדיט. מחליף את C10 שבוטל ב-14/10/2026). בפרופיל הכרום "Azure פרטי" (mishaf1988@gmail.com), לא בפרופיל של העבודה. מוחקים את קבוצת המשאבים כולה (המחשב, הדיסק, כרטיס הרשת, הכתובת וחוקי הרשת). התקציב והמנוי נשארים, הם לא עולים כסף. **בוטל 21/10/2026, מיכאל: "אז לחכות שיימחק לבד, תבטל את C30"**, אחרי ההסבר שהמנוי מושבת לבד בערך ב-12/11/2026 ונמחק עד 90 יום אחר כך, בלי חיוב, כל עוד לא לוחצים Upgrade.
  ```
  משימה: למחוק את מחשב העבודה שלי ב-Azure. מיכאל אישר: "למחוק את המחשב ב-Azure עכשיו" (21/10/2026). לעבוד רק בפרופיל הכרום "Azure פרטי" (mishaf1988@gmail.com). לא ללחוץ Upgrade, לא להוסיף אמצעי תשלום, ולא למחוק שום דבר מעבר לקבוצה הזו.
  1. פתח https://portal.azure.com/#browse/resourcegroups
  2. פתח את קבוצת המשאבים tapugan-claude-rg. רשום את רשימת המשאבים שבה (שם וסוג). אם יש בה משהו שאינו קשור למחשב tapugan-claude (מחשב, דיסק, כרטיס רשת, כתובת IP, Network security group, רשת וירטואלית), עצור ודווח.
  3. Delete resource group. הקלד את השם tapugan-claude-rg לאישור, ומחק.
  4. חכה עד שההודעה בפעמון אומרת שהמחיקה הסתיימה, ורענן את רשימת קבוצות המשאבים.
  בסוף: דוח קצר: רשימת המשאבים שנמחקו, והאם tapugan-claude-rg עדיין מופיעה ברשימה.
  ```
  אחרי הביצוע: מיכאל מדביק את הדוח או שולח צילום של רשימת הקבוצות בלי `tapugan-claude-rg`. מכאן אין גישה ל-Azure, ולכן הדוח הוא האימות. מייל על 100% מהתקציב לא צפוי אחרי המחיקה (ההוצאה נעצרת סביב 12 דולר).
- [x] **C29. Power Automate: עותק (CC) בטיוטה, בזרימה "טיוטות מהעוזר"** (נסגר 20/10/2026: אומת בטיוטה אמיתית, דוח המים לספטמבר מרכז המסמכים: `ccRecipients` = שלושת העותקים, `toRecipients` = המפקח) (20/10/2026, דוח המים החודשי למשרד הבריאות: לאופיר, ובעותק צחי, סתיו וטל). השרת כבר שולח `cc` בבקשת הטיוטה. ניסיון ראשון 20/10/2026: הכרום התנתק, לא בוצע; הניסוח של השלבים עודכן לפי מה שהכרום תיאר (Advanced parameters, גלגל שיניים, fx). בתשובה בשרשור (C28) העותק כבר עובד; במייל חדש הזרימה מתעלמת ממנו עד שזה נעשה. טקסט להדבקה בכרום:
  ```
  אתה מעדכן זרימה קיימת ב-Power Automate. שינוי של שדה אחד בלבד. אל תוסיף שום פעולה ששולחת מייל, ואל תשנה שום דבר אחר.
  1. פתח https://make.powerautomate.com > My flows > "טיוטות מהעוזר" > Edit.
  2. בענף If yes (True) של ה-Condition, פתח את הפעולה "Draft an email message" > Advanced parameters, וסמן CC.
  3. בשדה CC: גלגל השיניים > Use dynamic content > fx, והדבק: outputs('Compose')?['cc']
  4. Save. בדוק שה-Flow checker מראה 0 שגיאות. אל תריץ בדיקה ידנית.
  בסוף: דוח קצר: האם השדה CC נמצא ומולא, ומה ה-Flow checker הראה.
  ```
  אחרי הביצוע: Claude שולח `mail_draft` לבדיקה למיכאל עצמו עם `cc` אליו, ובודק ב-`read_resource` שבטיוטה יש `ccRecipients`. רק אז C29 נסגר.

- [x] **C28. Power Automate: טיוטה כתשובה בתוך שרשור, בזרימה "טיוטות מהעוזר"** (נסגר 20/10/2026: בוצע בכרום, Flow checker 0/0; שמות אמיתיים: `Condition`, `Send_an_HTTP_request`, `Apply_to_each_1`, `Send_an_HTTP_request_1`. בדיקה 3 למיכאל עצמו: טיוטה "RE: מלגזנים תאילנדי" באותו conversationId, הטקסט והחתימה מעל הציטוט, ה-PDF מצורף 385,216 בתים מול 384,720 במקור) (20/10/2026, מיכאל: "זה דוגמה למייל שרשור, אז צריך לשלוח בשרשור של המיילים"). השרת כבר שולח בבקשת הטיוטה `reply_to` (המזהה של המייל האחרון בשרשור) ו-`reply_body` (גוף מוכן לבקשת createReply). עד שזה נעשה הזרימה מתעלמת מהם ויוצרת מייל חדש, כמו היום. טקסט להדבקה בכרום:
  ```
  אתה מעדכן זרימה קיימת ב-Power Automate. עבור על השלבים ברצף, עצור רק אם משהו לא תואם, ותאר מה אתה רואה. אל תוסיף שום פעולה ששולחת מייל (לא Send, לא Reply), ואל תשנה את הטריגר או את מה שכבר עובד בענף של מייל חדש.
  1. פתח https://make.powerautomate.com > My flows > "טיוטות מהעוזר" > Edit.
  2. אחרי הלולאה הקיימת (Apply to each שבונה את המשתנה att) ולפני "Draft an email message": New step > Control "Condition". שמאל, בלשונית Expression: empty(outputs('Compose')?['reply_to']) . אופרטור: is equal to. ימין, בלשונית Expression: true
  3. גרור את הפעולה הקיימת "Draft an email message" לתוך הענף If yes. בענף הזה לא משנים כלום.
  4. בענף If no: Office 365 Outlook "Send an HTTP request". Method: POST. URI (טקסט עם ביטוי במקום המסומן): https://graph.microsoft.com/v1.0/me/messages/<Expression: encodeUriComponent(outputs('Compose')?['reply_to'])>/createReply . Content-Type: application/json. Body, בלשונית Expression: outputs('Compose')?['reply_body']
  5. בענף If no, אחריה: Control "Apply to each", Select an output, Expression: variables('att') . בתוכה: Office 365 Outlook "Send an HTTP request". Method: POST. URI: https://graph.microsoft.com/v1.0/me/messages/<Expression: body('Send_an_HTTP_request')?['id']>/attachments . Content-Type: application/json. Body (טקסט עם שלושה ביטויים):
     {"@odata.type": "#microsoft.graph.fileAttachment", "name": "<Expression: items('Apply_to_each_2')?['Name']>", "contentBytes": "<Expression: items('Apply_to_each_2')?['ContentBytes']?['$content']>"}
     (אם השמות של הפעולות אצלך שונים, למשל Send_an_HTTP_request_2 או Apply_to_each_3, להשתמש בשמות האמיתיים.)
  6. Save. בדוק שה-Flow checker מראה 0 שגיאות. אל תריץ בדיקה ידנית.
  בסוף: דוח קצר: האם כל ששת השלבים עברו, מה ה-Flow checker הראה, ומה השמות האמיתיים של הפעולות שהוספת.
  ```
  אחרי הביצוע: Claude שולח `mail_draft` לבדיקה למיכאל עצמו עם `reply_to` של מייל שלו ועם קובץ מצורף אחד, ובודק ב-`outlook_email_search` (Drafts) שהטיוטה בשרשור (נושא "RE:"), שהטקסט מעל המייל המצוטט, ושהקובץ נפתח. רק אז C28 נסגר.


- [x] **C21. קיצור מתוזמן יומי ב-Claude בכרום שקורא את התור הזה** (18/10/2026, מיכאל בשאלון: "בצע: קיצור מתוזמן בכרום"). בוצע 18/10/2026 על ידי מיכאל: הקיצור "תור כרום תפוגן", יומי ב-08:00, רק מזכיר ולא מבצע. אומת לפי מיכאל בשאלון ("כבר יצרתי את הקיצור"); ב-18/10/2026 Claude בכרום קרא את התור, הציג את C21 ושאל לפני ביצוע. מהענן אין כלי שקורא קיצורים של כרום.
- [x] **C20. מפתח Supabase מוגבל למסד הניסוי** (18/10/2026). **בוצע 18/10/2026: Claude בכרום יצר, מיכאל הדביק ושמר.** Scoped PAT `claude-staging` (tfugen-staging בלבד: Project Settings קריאה, Database ו-Auth Config כתיבה), **תוקף 24 שעות** (הקצר שהיה; Custom לא נבחר). Network secret ל-`api.supabase.com`. אומת: `GET /v1/projects/ldzbjbsumzqjyvtpiwqo` = 200, החי `znhjtpcltrxxyfjczgvw` = 403, `config/auth` נקרא. אחרי 24 שעות: מפתח חדש רק כשיש משימה.
- [x] **C19. פרסום ההדרכה השבועית של 18/10/2026** (18/10/2026). **בוצע 18/10/2026 על ידי Claude בכרום** (מיכאל התחבר; כרום לא מזין סיסמה). אומת במסד: `w20261018` פורסמה, מדריך וכשירות מולאו. מעכשיו הטיוטות הבאות מקבלות מדריך וכשירות מההדרכה האחרונה (DECISIONS 10/10/2026).
- [x] **C15. סוד מסד הניסוי ב-Preview של Cloudflare** (16/10/2026). **בוצע 18/10/2026 על ידי מיכאל עם Claude בכרום**: Claude בכרום מילא Type ו-Name, מיכאל הדביק את המפתח ושמר. אומת 18/10/2026 דרך ה-API: ב-Preview 4 משתנים, `STAGING_SUPABASE_SERVICE_ROLE_KEY` מסוג secret_text; Production נשאר 19. ב-Production יש גם עותק של שני משתני `STAGING_` מ-16/10 (כשלא היה אפשר לבחור Preview מהטלפון); האתר החי לא קורא אותם (`functions/_middleware.js`), ולכן נשארים.
- [x] **C18. מחיקת שתי פונקציות עזר במסד החי** (18/10/2026). **בוצע 18/10/2026 על ידי מיכאל** ("בוצע"). אומת ב-`pg_proc`: `public.tmp_stray_close_ref_20261018` ו-`private.tmp_cap_60_200` כבר לא קיימות.
- [x] **C17. כניסה אנונימית במסד הניסוי** (17/10/2026). **בוצע 18/10/2026 על ידי מיכאל** ("בוצע"). אומת 18/10/2026: `tests/staging/e2e.js` 29/29, כולל סעיף 6: סשן אנונימי, הדיווח הגיע למסד, NCR ועובדים סגורים.
- [x] **C16. שני Projects ב-claude.ai: תפוגן והעסק** (17/10/2026). **בוצע 17/10/2026 על ידי מיכאל מהטלפון** ("פתחתי פריקטים"), עם השמות וההוראות מהדף https://claude.ai/artifact/S33o6jFNUumGNyZbxGUCua. מהענן אין כלי שקורא Projects, ולכן אומת לפי הדיווח שלו.
- [x] **C14. מחיקת הטיוטה הישנה של טופס הקליטה 08.02.01** (14/10/2026, מיכאל בשאלון: "למחק, רק תוודא שזה לא הטופס שאנחנו משתמשים בו"). נבדק במסד: `mv2knh1yhysp` היא טיוטה (דף העובד מסרב להדרכה שלא פורסמה), 0 חתימות, 2,935 תווים בלי אמהרית, נוצרה 10/10/2026. הטופס בשימוש הוא `ind-0802`: פורסם, הנוסח המלא (7,925 תווים, ערבית/רוסית/אמהרית), 5 חתימות, האחרונה 13/10/2026, ורק אליו מפנים הקוד והמדריך. **בוצע 14/10/2026 על ידי Claude בכרום, מיכאל הקליד את סיסמת המחיקה:** נמחקה רק הטיוטה. אומת במסד מהענן: `mv2knh1yhysp` לא קיימת, `ind-0802` פורסמה עם 5 חתימות, 5 הדרכות בטבלה.
- [x] **C13. מחיקת 14 הטיוטות השבועיות הישנות במסך "הדרכות"** (14/10/2026, מיכאל בשאלון: "בצע: למחוק ולהשאיר אחת משותפת", ואחרי שהמחיקה מהענן נחסמה: "תרשום הבהרות לכרום"; STATUS "הדרכה שבועית אחת לכל המחלקות"). כלי ה-SQL של Supabase חוסם מהענן כל DELETE, ולכן המחיקה דרך האפליקציה. הטיוטות לא חתומות ומגובות ב-`backup_ops_20260918.toolbox_talks_20261014`. **בוצע 14/10/2026 על ידי Claude בכרום, מיכאל הקליד את סיסמת המחיקה:** 14 טיוטות נמחקו, כולן "טיוטה" עם 0 חתימות. אומת במסד מהענן: נשארו 6 הדרכות (`mutj5juvwvv4`, `ind-0802`, `mv2knh1yhysp`, `ann-2026`, `qa-2026`, `w20261011`), אין שם שמתחיל ב"הדרכה שבועית:".
- [x] **C10. מחיקת מחשב העבודה ב-Azure** (13/10/2026, מיכאל בשאלון: "בצע: למחוק את המחשב", אחרי "למה אני צריך את זה?"; `work-vm-plan.md` "ההחלטה השנייה"). בפרופיל הכרום "Azure פרטי". **בוטל 14/10/2026, מיכאל: "המחשב יימחק לבד בעוד חודש".** נבדק בתיעוד של מיקרוסופט: מנוי ניסיון בלי Upgrade נשאר עם מגבלת הוצאה, כלומר אין חיוב בכלל. בסוף 30 הימים (בערך 12/11/2026) או כשה-200 דולר נגמרים, המנוי עובר ל-Disabled, ואחרי עד 90 ימים נמחק עם כל המשאבים. כלומר "לבד" נכון, אבל המחיקה הסופית יכולה לקחת עד 3 חודשים אחרי זה, לא בדיוק חודש. בינתיים המחשב עצור (deallocated), והדיסק מוריד רק מהקרדיט. התנאי היחיד: לא ללחוץ Upgrade ולא להוסיף תשלום רגיל. מיילים מ-Azure על השבתה ומחיקה צפויים, לא צריך לעשות איתם כלום.
- [x] **C1. שתי הזרימות ב-Power Automate: לא לשמור קובץ בלי סיומת או קטן מ-1KB** (12/10/2026, מיכאל "מאשר"; `power-automate-mail.md`) **בוצע 13/10/2026 על ידי Claude בכרום:** בשתי הזרימות נוספו `"equals": ["@contains(item()?['name'],'.')", true]` ו-`"greater": ["@item()?['size']", 1024]` (נבדק בתצוגת הקוד), Flow checker 0/0, שתיהן On. **לא נבדק עדיין במייל אמיתי:** לבדוק בהיסטוריית ההרצות אחרי המייל הבא עם קובץ.
- [x] **C12. GitHub OAuth: לבטל את Cursor ו-Netlify Auth** (13/10/2026, מיכאל בשאלון: "בצע: Cursor ו-Netlify Auth (מומלץ)"). **בוצע 13/10/2026 על ידי Claude בכרום.** נשארו ב-OAuth Apps: Cloudflare, DigitalOcean, Git Credential Manager, GitHub CLI, GitHub iOS, Ollama, Resend, Supabase. Cursor ו-Netlify לא מופיעים באף לשונית.
- [x] **C11. GitHub: להסיר את Vercel ו-Netlify, ו-Cursor מ-OAuth** (13/10/2026, מיכאל בשאלון: "בצע: להסיר Vercel ו-Netlify ולבדוק OAuth (מומלץ)"). Vercel נמחק ב-21/09/2026 ו-Netlify מושהה, אבל שתי האפליקציות עוד מותקנות עם גישה לקוד. **בוצע 13/10/2026 על ידי Claude בכרום:** Vercel ו-Netlify הוסרו מ-Installed; Cursor ו-Vercel בוטלו ב-Authorized GitHub Apps. נשארו Installed: Claude, Claude Design Import, Cloudflare Workers and Pages. Authorized GitHub Apps: ChatGPT Codex Connector, Claude, Claude Design Import, Cloudflare Workers and Pages, Copilot Chat App, Copilot SWE Agent, Manus Connector. OAuth Apps: Cloudflare, Cursor, DigitalOcean, Git Credential Manager, GitHub CLI, GitHub iOS, Netlify Auth, Ollama, Resend, Supabase. המשך: C12.
- [x] **C3. Cursor ב-GitHub: להסיר** (13/10/2026). **הבדיקה בוצעה 13/10/2026 על ידי Claude בכרום:** הותקן 11/04/2026, גישה ל-All repositories, כתיבה לקוד, workflows, PRs ו-issues; מבקש 7 הרשאות נוספות (Administration, Actions כתיבה, Email addresses ועוד) בנימוק merge queues. ב-GitHub אין שום PR או commit שלו. מיכאל בשאלון: **"בצע: להסיר את Cursor (מומלץ)"**. **הוסר 13/10/2026 על ידי Claude בכרום** ("A job has been queued to uninstall"), בלי לאשר את בקשת ההרשאות. נשארו: Claude, Claude Design Import, Cloudflare Workers and Pages, Netlify (מושהה), Vercel. המשך: C11.
- [x] **C2. בדיקה חוזרת של "הצע סיבה ופעולה" ב-NCR** (12/10/2026, STATUS "ה-AI ב-NCR"; בדיקת כרום של 12/10/2026 נכשלה ותוקנה) **בוצע 13/10/2026 על ידי Claude בכרום: עבר.** שלושת השדות מזכירים את המלגזה והדליפה, בלי "לעדכן נהלים". "ביטול" בסוף, שום NCR לא נשמר.
- [x] **C6. יצירת מחשב העבודה ב-Azure** (13/10/2026, מיכאל בשאלון: "בצע: ניסיון חינם בחשבון העבודה (מומלץ)"; `work-vm-setup.md` שלב 2). המנוי קיים (C9 בוצע 13/10/2026). **להריץ בפרופיל הכרום "Azure פרטי"**, לא בפרופיל של העבודה. **בוצע 13/10/2026 על ידי Claude בכרום:** `tapugan-claude` ב-`tapugan-claude-rg`, Israel Central, Standard_B2als_v2, smalldisk, 64GB Standard SSD, משתמש michael-vm (סיסמה של מיכאל), $0.0521 לשעה לפי מסך הסיכום. כלל ה-RDP מוגבל לכתובת של מיכאל בזמן היצירה. תקציב `tapugan-claude-budget` 15 דולר (התראות ב-80% וב-100% ל-Gmail). **Auto-shutdown לא נשמר** (Save כבוי ב-Israel Central). המחשב נעצר: Stopped (deallocated).
- [x] **C9. חשבון Azure פרטי על ה-Gmail (שלב 1, דרך כרום)** (13/10/2026, מיכאל: "רשום הוראות מלאות ש-Chrome יעשה את זה עבורי"; `work-vm-setup.md` שלב 1). לפני C6. **13/10/2026:** בפרופיל הרגיל הדף נפתח על חשבון תפוגן (כרום עצר, לא נחתם דבר), אבל הפעם נקרא. מיכאל בשאלון: "בצע: פרופיל כרום נפרד (מומלץ)": ההרשמה רצה בפרופיל "Azure פרטי" עם התוסף (`work-vm-setup.md` שלב 1). **בוצע 13/10/2026:** מיכאל נכנס לפורטל בפרופיל "Azure פרטי" עם mishaf1988@gmail.com, הפעיל אימות דו-שלבי, והמסך מציג "$200 in credits remaining" (צילום של מיכאל). לא נוצר שום משאב.
- [x] **C7. ניסיון חינם ב-Azure על חשבון תפוגן** (13/10/2026). **הוחלף 13/10/2026:** מיכאל בשאלון: "בצע: Azure על ה-Gmail שלי". ההרשמה הפרטית ממולאת ביד (`work-vm-setup.md` שלב 1), כי התוסף לא קורא את signup.azure.com. בניסיון על חשבון תפוגן לא נוצר מנוי.
- [x] **C8. מחיר Kamatera** (13/10/2026). **בוטל:** מיכאל בחר ב-Azure, מחשב לפי דרישה.
- [x] **C5. Azure: האם אפשר לפתוח מנוי עם החשבון של העבודה** (13/10/2026). **בוצע חלקית 13/10/2026 על ידי Claude בכרום:** Add פתח "Select an offer for your subscription" בלי הודעת חסימה: Free Trial, Pay-As-You-Go, Azure for students, תמיכה בתשלום, Visual Studio. המסך עוד לא מבקש כרטיס. **לא נבדק:** אחרי Sign up (התחברות חוזרת וכרטיס), שם תופיע חסימה של הארגון אם יש. נסגר בלי לבחור.
- [x] **C4. Azure: האם יש מנוי דרך העבודה** (13/10/2026). **בוצע 13/10/2026 על ידי Claude בכרום:** בספרייה tapugan.co.il אין מנוי ("Subscriptions: Filtered (0 of 0)", סינון על כל התפקידים והסטטוסים) ואין חשבון חיוב (Billing scopes ריק). לא נבדקה ספרייה אחרת ("Switch directories"). לא נלחץ Add ולא הופעל ניסיון.

