# הוראה ל-Claude in Chrome: חיבור OneDrive לשרת של Tapugan Safety

להעתיק את כל מה שמתחת לקו ולהדביק ל-Claude בכרום, במחשב שבו מחובר החשבון sviva@tapugan.co.il.

---

אתה עוזר למיכאל, מנהל הבטיחות, להגדיר חיבור OneDrive לשרת של אפליקציית Tapugan Safety. עבוד בשלושה אתרים לפי הסדר. אל תשנה שום דבר אחר, ואל תמחק שום דבר קיים.

כלל חשוב על הסוד: את ערך ה-Client secret מעתיקים מ-Microsoft ומדביקים ל-Cloudflare בלבד. אל תכתוב אותו בצ'אט, בדוח או בשום מקום אחר. בדוח כתוב רק "הוגדר".

## חלק א: Microsoft Entra

1. היכנס ל-https://entra.microsoft.com. אם מבקשים התחברות, תעצור ותבקש ממיכאל להתחבר עם sviva@tapugan.co.il.
2. Applications > App registrations. בדוק אם כבר קיימת אפליקציה בשם "Tapugan Safety Server". אם כן, אל תיצור חדשה. היכנס אליה ודלג לסעיף 5.
3. New registration:
   - Name: Tapugan Safety Server
   - Supported account types: Accounts in this organizational directory only
   - Redirect URI: פלטפורמה Web, כתובת: https://tapugan-safety.pages.dev/api/ms-auth
   - Register
4. אם אין הרשאה ליצור אפליקציה (הכפתור חסום, או הודעת הרשאה), תעצור ותדווח.
5. בדף Overview רשום לעצמך את Application (client) ID ואת Directory (tenant) ID. את שני אלה מותר לכתוב בדוח.
6. Authentication: ודא שתחת Web מופיעה בדיוק הכתובת https://tapugan-safety.pages.dev/api/ms-auth. אם חסרה, הוסף ושמור.
7. API permissions > Add a permission > Microsoft Graph > Delegated permissions. סמן Files.ReadWrite ו-offline_access. Add permissions. אל תסיר את User.Read.
8. Certificates & secrets > Client secrets > New client secret. Description: cloudflare. Expires: 24 months. Add. העתק מיד את עמודת Value (לא Secret ID). היא מוצגת פעם אחת בלבד.

## חלק ב: Cloudflare

1. היכנס ל-https://dash.cloudflare.com > Workers & Pages > tapugan-safety > Settings > Variables and Secrets (Production).
2. הוסף שלושה משתנים. אם משתנה בשם הזה כבר קיים, ערוך אותו. אל תיגע במשתנים אחרים:
   - ONEDRIVE_CLIENT_ID, סוג Text, ערך: Application (client) ID
   - ONEDRIVE_TENANT_ID, סוג Text, ערך: Directory (tenant) ID
   - ONEDRIVE_CLIENT_SECRET, סוג Secret, ערך: ה-Value מחלק א סעיף 8
3. Save.
4. Deployments > הפריסה העליונה (Production) > שלוש נקודות > Retry deployment. חכה שהסטטוס יהיה Success.

## חלק ג: האפליקציה

1. פתח את https://tapugan-safety.pages.dev ורענן. אם מבקשים סיסמה, מיכאל מתחבר בעצמו.
2. במסך הבית, בכרטיס "יומן דיווחי נאמנים (אקסל)", אמורה להופיע השורה "השרת עוד לא מחובר ל-OneDrive". אם כתוב "המכשיר הזה לא מחובר", הפריסה עוד לא עלתה: חכה דקה ורענן.
3. לחץ "🔗 חבר את OneDrive לשרת" ואשר את החלון.
4. בדף של Microsoft בחר sviva@tapugan.co.il ואשר את ההרשאות (Accept).
   - אם מופיע "Need admin approval", תעצור ותדווח. זה אומר שצריך את מנהל ה-Microsoft 365 של החברה.
5. חוזרים לאפליקציה עם ההודעה "OneDrive חובר לשרת".
6. לחץ "☁️ שלח ל-OneDrive עכשיו". אמורה להופיע ההודעה "נשלח".
7. בדוק ב-https://onedrive.live.com או ב-OneDrive של הארגון, בתיקייה Apps > Tapugan Safety > נאמני בטיחות, שהקובץ "יומן דיווחי נאמנים.xlsx" קיים. פתח אותו וודא שיש בו שורות.

## הדוח למיכאל

כתוב בקצרה:
- מה בוצע בכל חלק (א, ב, ג).
- את ה-Application (client) ID ואת ה-Directory (tenant) ID.
- איזו הודעה הופיעה אחרי "שלח עכשיו".
- כמה שורות יש בקובץ.
- כל שגיאה, מילה במילה.
בלי ערך הסוד.
