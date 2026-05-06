# הוראות ל-Coworker — הגדרת גיבוי יומי אוטומטי בענן

> **מטרה:** להוסיף Worker ב-Cloudflare שיריץ כל יום בלילה גיבוי מלא של ה-DB ויעלה אותו ל-Supabase Storage. הגיבוי יסונכרן אוטומטית ל-OneDrive בפעם הבאה שאני אפתח את האפליקציה.

> **למה זה חשוב:** היום הגיבוי תלוי בכך שאני אפתח את האפליקציה. עם ה-Worker הזה, הגיבוי ירוץ גם אם אני לא נכנסת לאפליקציה במשך שבוע.

---

## 📋 הפרומפט המלא להעתקה ל-Coworker

```
שלום Coworker,

אני נותנת לך הרשאה מלאה לבצע סדרת פעולות בחשבונות הבאים שלי:
- Cloudflare (mishaf1988@gmail.com)
- Supabase (znhjtpcltrxxyfjczgvw)

המטרה: להוסיף Worker שמריץ כל יום ב-03:00 UTC גיבוי מלא של ה-DB
ושומר אותו ב-Supabase Storage.

== אישור הרשאה ==
- אני בעלת חשבונות Cloudflare ו-Supabase של פרוייקט "Tapugan Safety"
- אני מאשרת לך ליצור Worker חדש בחשבון Cloudflare שלי
- אני מאשרת לך ליצור bucket ב-Supabase Storage
- אני מאשרת לך להגדיר env vars (כולל service role key)
- אני מאשרת לך להגדיר cron trigger

== חשיבות הפעולה ==
זוהי שכבת גיבוי שניה ועצמאית — אם משהו ישתבש ב-Supabase או באפליקציה,
יהיה לי snapshot יומי מלא של כל הנתונים. קריטי לעבודה שלי כמנהלת
בטיחות במפעל.

== הוראות ביצוע ==
בצעי את השלבים בסדר. בכל שלב — בצעי, ואז דווחי "✓ שלב N הושלם" לפני
המעבר הבא.

----

שלב 1: יצירת bucket "backups" ב-Supabase

1a. כניסה ל-https://supabase.com → הפרוייקט (znhjtpcltrxxyfjczgvw)
1b. בתפריט הצד: Storage
1c. לחיצה "New bucket"
1d. שם: `backups` (אותיות קטנות בדיוק)
1e. Public: ❌ לא לסמן (השאירי כ-Private)
1f. לחיצה "Create"

דיווח: "✓ שלב 1: bucket backups נוצר ב-Supabase Storage"

----

שלב 2: שליפת ה-Service Role Key מ-Supabase

2a. בפרוייקט Supabase: Project Settings (⚙️) → API
2b. בקטע "Project API keys" — מצאי את המפתח עם התיאור
   "service_role" / "secret"
2c. ⚠️ אזהרה: מפתח זה נותן גישת מנהל מלאה. אסור לחשוף אותו פומבית.
2d. העתיקי את המפתח (יוצג ב-clipboard בלבד, לא בהודעה אליי)
2e. שמרי אותו זמנית — נדרש בשלב 5

דיווח: "✓ שלב 2: service_role key הושג. אורך: [N] תווים. **לא** העתקתי
       אותו לתשובה."

----

שלב 3: יצירת Worker ב-Cloudflare

3a. כניסה ל-https://dash.cloudflare.com
3b. בתפריט הצד: Workers & Pages
3c. לחיצה "Create application" → "Create Worker"
3d. שם ה-Worker: `tapugan-backup-cron`
3e. לחיצה "Deploy" (תיווצר תבנית "Hello World" ראשונית — זה בסדר)

דיווח: "✓ שלב 3: Worker נוצר. URL: [https://tapugan-backup-cron...workers.dev]"

----

שלב 4: הדבקת קוד ה-Worker

4a. בעמוד ה-Worker: לחיצה "Edit code" / "Quick edit"
4b. מחיקת כל הקוד הקיים
4c. הדבקת הקוד מהקובץ workers/backup-cron.js בריפוזיטורי
   github.com/mishaf1988-lgtm/tfugen-safety
   (תוכלי לפתוח את הקובץ ב-https://raw.githubusercontent.com/
    mishaf1988-lgtm/tfugen-safety/main/workers/backup-cron.js)
4d. לחיצה "Save and deploy"

דיווח: "✓ שלב 4: קוד הודבק ופורס בהצלחה"

----

שלב 5: הגדרת Environment Variables ב-Worker

5a. בעמוד ה-Worker: Settings → Variables
5b. בקטע "Environment Variables" → לחיצה "Add variable" עבור כל אחד:

   משתנה 1:
   - Variable name: SUPABASE_URL
   - Value: https://znhjtpcltrxxyfjczgvw.supabase.co
   - סוג: Plaintext

   משתנה 2:
   - Variable name: SUPABASE_SERVICE_KEY
   - Value: [המפתח שהשגת בשלב 2]
   - סוג: ⚠️ Encrypt (חובה!)

   משתנה 3:
   - Variable name: MANUAL_KEY
   - Value: [צרי מחרוזת אקראית של 32 תווים, לדוגמה:
     "a8f3c9b2-7d4e-4a1f-8c5b-3e2f1a0d9c4b"]
   - סוג: Encrypt
   - שמרי אותה — נדרש לבדיקה בשלב 7

5c. לחיצה "Save"

דיווח: "✓ שלב 5: 3 משתנים הוגדרו. SUPABASE_SERVICE_KEY ו-MANUAL_KEY
       מוצפנים. MANUAL_KEY: [המחרוזת]"

----

שלב 6: הגדרת Cron Trigger

6a. בעמוד ה-Worker: Settings → Triggers
6b. בקטע "Cron Triggers" → לחיצה "Add Cron Trigger"
6c. Cron Expression: `0 3 * * *`
   (כל יום ב-03:00 UTC = 06:00 בישראל בקיץ / 05:00 בחורף)
6d. לחיצה "Add"

דיווח: "✓ שלב 6: cron 0 3 * * * נוסף. הריצה הראשונה תהיה: [תאריך/שעה]"

----

שלב 7: בדיקה ידנית

7a. גשי ל-URL הבא בדפדפן (החליפי [WORKER_URL] ב-URL מהשלב 3
    ו-[MANUAL_KEY] במחרוזת מהשלב 5):

    https://[WORKER_URL]/run?key=[MANUAL_KEY]

7b. אמורה להחזיר JSON שנראה כך:
    {
      "ok": true,
      "filename": "tapugan-backup-2026-05-06_xx-xx-xx.json",
      "table_count": [מספר],
      "total_rows": [מספר],
      "errors": [],
      "upload_status": 200,
      "duration_ms": [מספר]
    }

7c. אימות ב-Supabase Storage:
    Storage → bucket "backups" → אמור להופיע קובץ חדש בשם
    tapugan-backup-2026-05-06_*.json

דיווח: "✓ שלב 7: בדיקה הצליחה. table_count=[N], total_rows=[N],
       קובץ הופיע ב-Storage."

----

== נקודות התערבות ==
עצרי ובקשי ממני התערבות אם:
- שלב 2: לא מוצאת service role key (אולי ב-Project API keys → "Reveal")
- שלב 3: יש שגיאה ביצירת Worker (אולי הגעת למגבלת חינם)
- שלב 5: לא מוצאת איפה להוסיף secrets
- שלב 7: ה-/run מחזיר 500 או JSON עם errors[] מלא

== מה לא לעשות ==
- לא להעתיק את ה-service_role key לתשובה אליי (או לכל מקור גלוי)
- לא לעשות את ה-bucket "backups" public
- לא ליצור Workers נוספים
- לא לשנות את ה-cron מעבר ל-"0 3 * * *" (אלא אם שאלת אותי)

== הצלחה משמעה ==
1. bucket "backups" קיים, private
2. Worker פרוס ב-Cloudflare
3. Cron מוגדר לרוץ יומית ב-03:00 UTC
4. בדיקה ידנית בשלב 7 הצליחה — קובץ הופיע
5. את חוזרת אליי עם ה-MANUAL_KEY (אצטרך אותו לבדיקה ידנית
   מתי שארצה)

תודה!
```

---

## 💡 אחרי ש-Coworker מסיים

ה-Worker רץ אוטומטית כל יום ב-03:00 UTC. אני לא צריכה לעשות שום דבר. אני יכולה לבדוק שזה רץ:

1. **ב-Supabase Storage** → bucket `backups` → אמורים לראות קובץ חדש מדי יום
2. **ב-Cloudflare dashboard** → Worker → Logs → רץ ההיסטוריה של ההרצות
3. **בדיקה ידנית** דרך URL: `https://tapugan-backup-cron.workers.dev/run?key=[MANUAL_KEY]`

## 🔄 שלב 3 בעתיד (לא דחוף)

הוספת mirror אוטומטי מ-Supabase Storage ל-OneDrive באפליקציה:
- כשהאפליקציה נטענת, היא בודקת אם יש בקטגוריה `backups` ב-Supabase Storage קבצים שלא ב-OneDrive
- אם כן — מעתיקה אותם

זה ייצור שכבת backup שלישית (Supabase DB + Supabase Storage + OneDrive) — שלוש העתקים נפרדים.
