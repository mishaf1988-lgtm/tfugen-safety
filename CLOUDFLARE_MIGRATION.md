# Cloudflare Pages Migration Guide

## למה?

- Vercel Hobby = 100 deployments ביום (חוסם בימים סוערים)
- Vercel Hobby = שימוש מסחרי "אסור פורמלית"
- Vercel Pro = $20/חודש (~75 ₪)

**Cloudflare Pages חינם** ומתיר שימוש מסחרי. אין הגבלת deployments, רוחב פס בלתי מוגבל, וביצועים טובים יותר בישראל (POP בתל אביב).

הפרויקט יעמוד תחת השם **`tapugan-safety`** ב-Cloudflare → URL סופי: **`https://tapugan-safety.pages.dev`**.

## מה נעשה כבר ב-PR הזה

- ✅ נוצרה תיקיה `/functions/api/` עם 5 endpoints (Cloudflare Pages Functions)
- ✅ קוד Vercel ב-`/api/*.js` נשאר ללא שינוי — המעבר הוא לא-מפר (Vercel ימשיך לעבוד במקביל)
- ✅ `_shared.js` עם helpers משותפים (CORS, origin validation)
- ✅ origin allowlist כולל גם את הדומיין החדש של Cloudflare

## מה צריך ממך עכשיו (פעם אחת)

### 1. צור חשבון Cloudflare (חינם)
- לך ל-https://dash.cloudflare.com/sign-up
- הירשם עם המייל הקיים שלך
- אין צורך בכרטיס אשראי לשירות החינמי

### 2. חבר ל-GitHub
- בלוח הבקרה: **Workers & Pages** → **Create** → **Pages** → **Connect to Git**
- אשר את החיבור ל-GitHub שלך
- בחר repo: **`mishaf1988-lgtm/tfugen-safety`**

### 3. הגדרות Build (חשוב!)
- **Project name**: `tapugan-safety`
- **Production branch**: `main`
- **Framework preset**: `None`
- **Build command**: השאר ריק
- **Build output directory**: השאר ברירת מחדל (`/`)
- **Root directory**: השאר ברירת מחדל

### 4. Environment Variables (חובה!)
לפני Deploy ראשון, הוסף את כל הסודות מ-Vercel:

לך ל-**Settings** → **Environment variables** → **Production** והוסף:

| Variable | ערך (העתק מ-Vercel) |
|----------|---------------------|
| `ANTHROPIC_KEY` | המפתח של Claude API |
| `META_ACCESS_TOKEN` | טוקן WhatsApp |
| `META_PHONE_NUMBER_ID` | `<מספר ה-Meta>` |
| `META_WABA_ID` | `4400035656982783` |
| `SUPABASE_SERVICE_ROLE_KEY` | המפתח השירות-תפקיד |
| `ALLOWED_ORIGINS` | (אופציונלי, אם רוצים origins נוספים) |

(אם לא זוכר אותם — לך ל-**Vercel Dashboard** → **tfugen-safety** → **Settings** → **Environment Variables** והעתק.)

### 5. Deploy ראשון
לחץ **Save and Deploy**. תוך ~2 דקות יהיה זמין ב-`https://tapugan-safety.pages.dev`.

### 6. בדיקה
פתח את הקישור החדש בדפדפן. אמור לעבוד בדיוק כמו `tfugen-safety.vercel.app`. ה-DB ב-Supabase משותף → אותם נתונים.

בדוק במיוחד:
- [ ] התחברות (קוד 6512)
- [ ] רשימת NCRs נטענת
- [ ] ניתוח NCR Agent (קריאה ל-`/api/claude`)
- [ ] שליחת WhatsApp (`/api/wa-send`)

אם משהו לא עובד → בדוק את ה-env vars (סיבה הנפוצה ביותר), או קבל לוגים מ-Cloudflare Dashboard.

## אחרי המעבר — מה לעשות עם Vercel?

### אופציה א (מומלצת): השאר Vercel כ-fallback
- לא משלמים כלום (עדיין Hobby)
- אם Cloudflare תפול אי-פעם → תחזור ל-`tfugen-safety.vercel.app`
- כך תהיה רשת ביטחון

### אופציה ב: בטל את הפרויקט ב-Vercel
- **Settings** → **General** → **Delete Project**
- הקוד נשאר ב-GitHub (לא נמחק)
- לא משלמים, לא נשאר משהו רץ

## URL סופי

`https://tapugan-safety.pages.dev` — עדכן את הסניף הזה ב:
- ה-PWA ב-iPhone (הסר את ה-PWA הישן, הוסף מחדש מהדומיין החדש)
- כל bookmark שיש לך
- כל מקום שמדבר על "האפליקציה" — תייק את ה-URL החדש
