# הוראות ביצוע ל-Coworker — הגדרת Azure לאוטונומיה מלאה

> **הקשר:** סוויבה (sviva@tapugan.co.il) ביקשה אוטומציה מלאה של איפוס סיסמה ושל שליחת פרטי כניסה. הקוד החדש (`/api/self-recovery` + `/api/send-credentials`) משתמש ב-Microsoft Graph עם **client_credentials grant** במקום delegated tokens של המשתמש. זה דורש שינוי הגדרות חד-פעמי ב-Azure App registration + הוספת secrets ל-Cloudflare Pages.
>
> **סוויבה מולך** — היא תעשה את הקליקים, את (Coworker) תנחי. **אל תפעלי בלעדיה — היא הבעלים של חשבון Azure**.

---

## 🎯 מטרת הסשן

1. הוספת permission **Mail.Send (Application)** לאפליקציית Azure של תפוגן
2. מתן **admin consent** להרשאה (חובה)
3. יצירת **Client Secret** חדש
4. שמירה של 4 ערכים ב-**Cloudflare Pages env vars**:
   - `AZURE_TENANT_ID`
   - `AZURE_CLIENT_ID`
   - `AZURE_CLIENT_SECRET`
   - `MAIL_FROM_USER`

זמן צפוי: **15-25 דקות**.

---

## 🔑 פרטים מתועדים מסשנים קודמים (לשימוש)

מתוך `project-files/INFRA-2026-05-06.md`:
- **Azure App Client ID:** `fb56b67c-2d2d-4146-89ef-f8f77eae2526`
- **Tenant:** `tapugan.co.il`
- **Permissions קיימות (Delegated):** `Files.ReadWrite.AppFolder`, `offline_access`, `User.Read`, `Mail.Send`
- **Mailbox השליחה:** `sviva@tapugan.co.il`

⚠️ ה-**Mail.Send** הקיים הוא **Delegated** (פועל רק כשהמשתמשת מחוברת). אנחנו מוסיפים **Application** permission חדשה (פועלת אוטונומית).

---

## 📋 שלבים — בצעי בסדר. אחרי כל שלב — דווחי "✓ שלב N הושלם"

### שלב 1 — כניסה ל-Azure Portal

**פעולה:**
פתחי טאב חדש ל-`https://portal.azure.com`
התחברי עם `sviva@tapugan.co.il`.

**דיווח:**
- ✓ אם נכנסת לדשבורד Azure: *"שלב 1: ב-Azure Portal"*
- ⚠️ אם נדרש MFA או יש שגיאה — בקשי עזרה מ-sviva

---

### שלב 2 — מציאת אפליקציית Tapugan Safety

**פעולה:**
1. בשורת החיפוש למעלה — הקלידי "App registrations" → לחצי על התוצאה
2. בלשונית "Owned applications" — חפשי אפליקציה שה-**Client ID שלה הוא** `fb56b67c-2d2d-4146-89ef-f8f77eae2526`
3. אם לא רואה ב-Owned — עברי ל-"All applications"
4. לחצי על שם האפליקציה

**דיווח:** *"שלב 2: באפליקציה. שם: [שם]. Client ID מאומת: fb56b67c-2d2d-4146-89ef-f8f77eae2526"*

---

### שלב 3 — הוספת Mail.Send Application permission

**פעולה:**
1. בתפריט הצד השמאלי של האפליקציה — לחצי **"API permissions"**
2. בודקת את הרשימה — את אמורה לראות 4 הרשאות `Delegated`: Files.ReadWrite.AppFolder, offline_access, User.Read, Mail.Send. **אל תיגעי בהן.**
3. לחצי **"+ Add a permission"**
4. בחרי **"Microsoft Graph"**
5. **חשוב:** הפעם בחרי **"Application permissions"** (לא Delegated!)
6. בשורת חיפוש — הקלידי "Mail.Send"
7. סמני ✓ את התיבה ליד **Mail.Send** ("Send mail as any user")
8. לחצי **"Add permissions"** בתחתית

**דיווח:**
- ✓ הוספה בהצלחה: *"שלב 3: Mail.Send (Application) נוסף לרשימה. Status: לא Granted עדיין."*
- ⚠️ שגיאה: צילום מסך + עצירה

---

### שלב 4 — Grant admin consent

**זה החלק הקריטי.** Application permissions לא פועלות בלי admin consent.

**פעולה:**
1. בעמוד API permissions — חפשי כפתור למעלה: **"Grant admin consent for [שם הארגון]"**
2. לחצי עליו → תיפתח חלונית אישור
3. לחצי **"Yes"** באישור

**אם הכפתור אפור / לא לחיץ:**
- ייתכן ש-sviva לא admin של ה-Tenant. בקשי ממנה לוודא.
- אם היא admin אבל הכפתור עדיין אפור — צילום מסך + עצירה. ייתכן שיש policy מוגבל.

**דיווח לאחר Grant:**
- כל ההרשאות (Delegated + Application) צריכות להציג ✓ ירוק "Granted for [Org]" בעמודת Status.
- ✓ אם כן: *"שלב 4: admin consent ניתן. Mail.Send Application מסומן ירוק."*

---

### שלב 5 — יצירת Client Secret

**פעולה:**
1. בתפריט הצד — לחצי **"Certificates & secrets"**
2. בלשונית **"Client secrets"** — לחצי **"+ New client secret"**
3. בחלונית שנפתחת:
   - **Description:** `tapugan-server-auto-recovery`
   - **Expires:** **24 months** (אם יש; אחרת 12 months)
4. לחצי **"Add"**

⚠️ **קריטי:** Azure תציג את ערך ה-secret **פעם אחת בלבד**. אם הדף נסגר, אי אפשר לקבל אותו שוב — צריך ליצור secret חדש.

**פעולה (קריטית):**
1. **העתיקי מיד את הערך מעמודת "Value"** (לא "Secret ID"!)
2. שמרי במקום בטוח לרגע (Notes / clipboard מאובטח)

**דיווח:**
- ✓ *"שלב 5: secret נוצר. הערך הועתק. שם: tapugan-server-auto-recovery. תפוגה: [תאריך]."*
- ⚠️ אם פספסת את ההעתקה: צריך למחוק ולחזור על השלב

---

### שלב 6 — שמירה ב-Cloudflare Pages env vars

**פעולה:**
1. פתחי טאב חדש ל-`https://dash.cloudflare.com`
2. נווטי: **Workers & Pages → tapugan-safety → Settings → Environment variables**
3. **הוסיפי 4 משתנים** (ב-section "Production"):

| Variable name | Value | Encrypted? |
|---|---|---|
| `AZURE_TENANT_ID` | `tapugan.co.il` | Plaintext |
| `AZURE_CLIENT_ID` | `fb56b67c-2d2d-4146-89ef-f8f77eae2526` | Plaintext |
| `AZURE_CLIENT_SECRET` | (הערך מ-שלב 5) | **🔒 Encrypted** |
| `MAIL_FROM_USER` | `sviva@tapugan.co.il` | Plaintext |

4. לחצי **"Save"** אחרי כל הוספה

**דיווח:** *"שלב 6: 4 ערכים נוספו ל-Cloudflare. AZURE_CLIENT_SECRET מסומן Encrypted."*

---

### שלב 7 — Re-deploy

**פעולה:**
1. ב-Cloudflare Dashboard → Pages → tapugan-safety → **Deployments**
2. הדפלוי האחרון מוצג למעלה. לחצי על שלוש הנקודות (`⋯`) ליד הדפלוי האחרון
3. בחרי **"Retry deployment"** או **"Trigger deploy"** — מטרה: הדפלוי הבא יראה את ה-env vars החדשים
4. המתיני 1-2 דקות לסיום הפריסה (Status: Success)

**דיווח:** *"שלב 7: דפלוי חדש פורס בהצלחה."*

---

### שלב 8 — בדיקה אוטונומית

עכשיו בדיקה ש-`/api/self-recovery` עובד אוטונומית.

**פעולה:**
1. גשי ל-`https://tapugan-safety.pages.dev` (טאב חדש, לא מחוברת).
2. במסך login — לחצי "**שכחתי סיסמה?**"
3. הקלידי שם משתמש קיים (תשאלי את sviva איזה לבחור — לא admin, לא testagent).
4. לחצי "📱 שלח סיסמה חדשה".
5. אמור להופיע toast: *"✓ אם המשתמש קיים, סיסמה חדשה נשלחה למייל ולטלפון..."*

**אימות (נעשה ע"י sviva):**
- האם הגיע מייל לכתובת המייל הרשומה של אותו משתמש?
- (WhatsApp template עדיין לא אושר — נצפה לכישלון בערוץ זה. זה בסדר.)

**דיווח:**
- ✓ מייל הגיע: *"שלב 8: בדיקה הצליחה. מייל נשלח אוטומטית. WhatsApp נכשל — מצפה לאישור template ממטא."*
- ❌ מייל לא הגיע: צילום מסך של Cloudflare Logs (Pages → tapugan-safety → Functions → Logs) — sviva תעזור.

---

## 🛑 נקודות התערבות

| תרחיש | מה לעשות |
|---|---|
| שלב 4: admin consent אפור | sviva תוודא שהיא admin global של ה-tenant |
| שלב 5: secret אבד | למחוק ולייצר שוב |
| שלב 7: deploy נכשל | צילום של ה-error → sviva תבדוק |
| שלב 8: 500 / 401 בקריאה ל-Graph | secret שגוי או tenant ID שגוי — חזרי לשלב 6 |

---

## ❌ מה לא לעשות

- ❌ לא לשנות הרשאות Delegated קיימות
- ❌ לא ליצור App registration חדש
- ❌ לא לסמן AZURE_CLIENT_SECRET כ-Plaintext (חובה Encrypted)
- ❌ לא להשתמש ב-secret עצמו במייל / מקום פתוח

---

## 📞 בסיום

תדווחי ל-sviva:
*"✓ Azure setup הסתיים. סוכן אוטונומי פעיל בייצור. /api/self-recovery נבדק ועובד למייל. WhatsApp template ממתין לאישור מטא."*

ואז — לקראת הצעד הבא — sviva תגיש תבנית WhatsApp במטא Business Manager. אני (Claude) אכתוב הוראות נפרדות לכך אחרי הסשן הזה.
