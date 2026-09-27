# חיבור OneDrive לשרת - הוראות למיכאל (פעם אחת, מול מחשב, כחצי שעה)

אחרי ההגדרה הזו השרת כותב בעצמו את "יומן דיווחי נאמנים.xlsx" ל-OneDrive אחרי כל דיווח נאמן וכל סגירה. זה עובד גם בלילה, וגם כשאף אחד לא פתח את האפליקציה.

הקובץ יופיע ב-OneDrive במחשב בתיקייה:
OneDrive > Apps (אפליקציות) > Tapugan Safety > נאמני בטיחות > יומן דיווחי נאמנים.xlsx

## שלב 1: רישום אפליקציה ב-Microsoft (כ-15 דקות)

1. להיכנס ל-https://entra.microsoft.com עם החשבון sviva@tapugan.co.il.
2. בתפריט בצד: Applications > App registrations > New registration.
3. למלא:
   - Name: Tapugan Safety Server
   - Supported account types: Accounts in this organizational directory only
   - Redirect URI: לבחור Web, ולהדביק בדיוק:
     https://tapugan-safety.pages.dev/api/ms-auth
4. ללחוץ Register.
5. בדף שנפתח (Overview) להעתיק שני ערכים לפתק:
   - Application (client) ID
   - Directory (tenant) ID
6. בתפריט של האפליקציה: Certificates & secrets > Client secrets > New client secret.
   - Description: cloudflare
   - Expires: 24 months
   - Add
7. להעתיק מיד את העמודה Value (לא את Secret ID). הערך מוצג פעם אחת בלבד.
8. בתפריט של האפליקציה: API permissions > Add a permission > Microsoft Graph > Delegated permissions.
   לסמן: Files.ReadWrite ו-offline_access. ללחוץ Add permissions.
   (User.Read כבר מופיע, להשאיר.)

## שלב 2: שלושה ערכים ב-Cloudflare (כ-5 דקות)

1. dash.cloudflare.com > Workers & Pages > tapugan-safety > Settings > Variables and Secrets.
2. Add, שלוש פעמים:

| שם | סוג | ערך |
|---|---|---|
| ONEDRIVE_CLIENT_ID | Text | ה-Application (client) ID |
| ONEDRIVE_TENANT_ID | Text | ה-Directory (tenant) ID |
| ONEDRIVE_CLIENT_SECRET | Secret | ה-Value משלב 1.7 |

3. Save.
4. Deployments > הפריסה העליונה > שלוש נקודות > Retry deployment. בלי זה הערכים לא נכנסים לתוקף.

## שלב 3: חיבור מהאפליקציה (דקה)

1. לפתוח את האפליקציה ולרענן. בכרטיס "יומן דיווחי נאמנים" במסך הבית אמור להופיע: "השרת עוד לא מחובר ל-OneDrive".
2. ללחוץ "🔗 חבר את OneDrive לשרת".
3. להתחבר עם sviva@tapugan.co.il ולאשר את ההרשאות.
4. חוזרים לאפליקציה עם ההודעה "OneDrive חובר לשרת".
5. ללחוץ "☁️ שלח ל-OneDrive עכשיו". אמורה להופיע ההודעה "נשלח".
6. לבדוק ב-OneDrive במחשב שהקובץ הופיע.

## אם משהו נכשל

- "Need admin approval" בכניסה: הארגון חוסם אישור הרשאות על ידי משתמש רגיל. צריך מנהל ה-Microsoft 365 של החברה שיאשר (API permissions > Grant admin consent).
- "redirect URI mismatch": הכתובת בשלב 1.3 לא הודבקה בדיוק. לתקן ב-Authentication של האפליקציה.
- "server not configured" בכרטיס: הערכים ב-Cloudflare חסרים, או שלא נעשה Retry deployment.
- הכרטיס מציג שגיאה אחרת: לצלם ולשלוח לי.

## לדעת

- הסיסמה (Client secret) פגה אחרי 24 חודשים. לפני כן צריך ליצור חדשה (שלב 1.6) ולהחליף ב-Cloudflare.
- אם עוברים חודשים בלי אף דיווח נאמן, ייתכן שיהיה צריך ללחוץ שוב "חבר את OneDrive לשרת".
- עמודת "ימים פתוח" מתעדכנת כשהקובץ נכתב מחדש, כלומר בכל דיווח או סגירה.
