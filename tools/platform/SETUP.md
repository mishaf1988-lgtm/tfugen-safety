# מפעל חדש: הקמה מאפס

בערך שעתיים, פעם אחת. צריך: חשבון GitHub, חשבון Supabase וחשבון Cloudflare (בשלושתם התוכנית החינמית מספיקה להתחלה).
הסדר חשוב: קודם המסד, אחר כך ההגדרות, ורק בסוף האתר.

## 1. המסד (Supabase)

1. פרויקט חדש. אזור קרוב (למשל Frankfurt או Ireland). לשמור את סיסמת המסד במקום בטוח.
2. SQL Editor: להדביק את כל `db/schema.sql` ולהריץ פעם אחת. הקובץ מקים 56 טבלאות ריקות, הרשאות, פונקציות ומשימות מתוזמנות.
3. **אימות:** `select count(*) from information_schema.tables where table_schema = 'public';` מחזיר 55.
4. הסוד שהמסד שולח לאתר: לבחור מחרוזת אקראית ארוכה (אותה מחרוזת תיכנס לאתר בשלב 3, בשם `TRUSTEE_NOTIFY_SECRET`), ולהריץ:
   `select vault.create_secret('<המחרוזת>', 'trustee_notify_secret');`
5. Authentication > Sign In / Providers:
   - Email: פעיל. "Confirm email" כבוי (המשתמשים לא מקבלים מייל; הכתובות פנימיות).
   - **Minimum password length = 8, ו-Password requirements ריק.** השרת יוצר סיסמה זמנית מאותיות קטנות וספרות. דרישת תווים מיוחדים תשבור את יצירת המשתמשים ואת "שכחתי סיסמה".
   - Anonymous sign-ins: **פעיל.** הקיוסק של הנאמנים נכנס כך, וההרשאות במסד מגבילות אותו לדיווח בלבד.
6. Authentication > Users > Add user: `admin@<דומיין הכניסה>` (למשל `admin@factory.local`) עם סיסמה חזקה. זה האדמין הראשון; את שאר המשתמשים הוא יוצר מתוך האפליקציה.
7. Project Settings > API: להעתיק את Project URL, את ה-publishable key ואת ה-service_role key (סודי).

## 2. ההגדרות (בקוד)

1. `functions/_site.js`: שם המפעל והחברה, שם מנהל הבטיחות, כתובת האתר (`HOST`), כתובת המסד וה-publishable key מסעיף 1.7, דומיין הכניסה (`loginDomain`, `adminEmail`), מיילים, המחלקות ותוכנית ההדרכות השנתית.
2. אם הכתובת או דומיין הכניסה שונים ממה שכתוב ב-`db/schema.sql`: להחליף גם שם, ולהריץ את השורות שהשתנו ב-SQL Editor.
3. הלוגו: להחליף את `logo.jpg`, ולהריץ `python3 tools/make-logo.py`.
4. `node tests/harness/site-config-test.mjs --write`, ואחר כך בלי `--write`. הבדיקה צריכה לעבור.
5. commit ו-push ל-main.

## 3. האתר (Cloudflare Pages)

1. Workers & Pages > Create > Pages > Connect to Git, ולבחור את ה-repo.
2. Build settings: Framework preset = None, Build command ריק, Build output directory = `/`. תיקיית `functions/` נטענת לבד.
3. Settings > Variables and Secrets (Production), חובה:

| שם | מה | מאיפה |
|---|---|---|
| `SUPABASE_URL` | כתובת המסד | סעיף 1.7 |
| `SUPABASE_SERVICE_ROLE_KEY` | המפתח הסודי של המסד | סעיף 1.7 |
| `TRUSTEE_NOTIFY_SECRET` | הסוד המשותף לאתר ולמסד | סעיף 1.4 |
| `TRUSTEE_CODE` | הקוד שנאמני הבטיחות מקלידים בקיוסק | לבחור |
| `ROUTINE_KEY` | המפתח של הסוכנים | לבחור (`agents/README.md`) |

   רשות, לפי מה שהמפעל צריך:

| שם | מה |
|---|---|
| `ALLOWED_COUNTRIES` | מאילו מדינות האתר נפתח (ברירת המחדל: IL) |
| `ANTHROPIC_KEY` או `GEMINI_API_KEY` | ניתוחי AI (NCR, 5 למה). בלי זה: Workers AI, אם הוגדר בסעיף 4 |
| `RESEND_KEY`, `RESEND_FROM` | התראות במייל |
| `META_ACCESS_TOKEN`, `META_PHONE_NUMBER_ID`, `META_WABA_ID` | התראות בוואטסאפ |
| `ONEDRIVE_CLIENT_ID`, `ONEDRIVE_CLIENT_SECRET`, `ONEDRIVE_TENANT_ID` | גיבוי וקבצים ב-OneDrive |

4. רשות: Settings > Bindings > Workers AI, בשם `AI`.
5. Deployments > Retry deployment, כדי שהמשתנים ייכנסו.

## 4. בדיקה ראשונה

1. לפתוח את כתובת האתר ולהיכנס עם `admin` והסיסמה מסעיף 1.6.
2. ליצור משתמש אחד מתוך האפליקציה (מסך המשתמשים, משתמש חדש) ולהיכנס איתו בטלפון. בכניסה הראשונה הוא מתבקש להחליף את הסיסמה הזמנית.
3. להוסיף מסמך אחד עם תאריך תפוגה, ולראות שהוא מופיע במסך התפוגות.
4. קיוסק הנאמנים: להיכנס עם `TRUSTEE_CODE`, ולשלוח דיווח בדיקה.
5. הסוכנים (רשות): `agents/README.md`.

## אם משהו לא עובד

- **הכניסה נכשלת:** לבדוק שהמשתמש קיים ב-Authentication > Users, ושדומיין הכניסה ב-`_site.js` זהה לכתובת שלו.
- **טבלה ריקה או שגיאה 401 בכל המסכים:** `SUPABASE_URL` או ה-publishable key לא תואמים לפרויקט.
- **יצירת משתמש נכשלת:** Password requirements לא ריק (סעיף 1.5).
- **האתר חסום:** `ALLOWED_COUNTRIES` לא כולל את המדינה שממנה פותחים.
