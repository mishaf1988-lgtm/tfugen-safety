# הוראות ל-Coworker — הוספת Mail.Send לאפליקציית Tapugan Safety

## רקע
המשתמשת (מנהלת הבטיחות בתפוגן) רוצה לקבל מייל אוטומטי עם דוח משימות פתוחות. הקוד מוכן ופרוס בפרודקשן. **נשארה פעולה ידנית אחת ב-Azure Portal** שאני (Claude Code) לא יכול לעשות בעצמי כי זה דורש כניסה לחשבון Microsoft של המשתמשת.

## מה צריך לעשות (10 דקות)

### 1️⃣ כניסה ל-Azure Portal
- URL: **https://portal.azure.com**
- כניסה עם החשבון `sviva@tapugan.co.il` (או החשבון Microsoft של המשתמשת)

### 2️⃣ מציאת האפליקציה
- בחיפוש למעלה: **"App registrations"** ולחיצה על התוצאה
- בלשונית **"Owned applications"** או **"All applications"** — למצוא את האפליקציה שיצרנו ל-Tapugan
- שם האפליקציה: **כנראה** "Tapugan Safety" או "Tapugan-OneDrive" (אם המשתמשת יצרה תחת שם אחר — לחפש לפי תאריך יצירה אחרון)
- אם לא מוצאים — לבקש מהמשתמשת את ה-**Application (client) ID** שמופיע באפליקציה (תפריט … → ☁️ חיבור OneDrive → "שלב 1: Azure App Client ID")

### 3️⃣ הוספת ההרשאה
1. בתפריט הצד של האפליקציה: **API permissions**
2. ללחוץ על **+ Add a permission**
3. לבחור **Microsoft Graph**
4. לבחור **Delegated permissions** (לא Application permissions!)
5. בחיפוש: לחפש **Mail.Send**
6. לסמן את התיבה ליד **Mail.Send** ("Send mail as a user")
7. ללחוץ **Add permissions** למטה

### 4️⃣ אישור (אם נדרש)
- אם רואים כפתור **"Grant admin consent for [Tenant Name]"** למעלה → ללחוץ עליו ולאשר
- אם הכפתור לא קיים או לא לחיץ → זה בסדר, אומר שהאישור הוא Self-consent וההרשאה כבר פעילה
- בעמודה **Status** ליד `Mail.Send` אמור להופיע סימן ירוק ✓ ו-"Granted for [Tenant]"

### 5️⃣ אימות (חובה לדווח חזרה)
- צילום מסך של הדף **API permissions** עם `Mail.Send` מסומן ✓
- או טקסט פשוט: "Mail.Send נוסף ויש Granted ירוק"

## מה הלאה (המשתמשת תעשה בעצמה)
אחרי שהדיווח חוזר חיובי, המשתמשת:
1. תפתח את האפליקציה (https://tapugan-safety.pages.dev)
2. תפריט … → ☁️ חיבור OneDrive → **התנתק**
3. **☁️ התחבר / זהו חשבון אחר** → בחלון Microsoft תאשר את ההרשאה החדשה ("Send mail as you")
4. תלחץ על **"📧 שלח דוח לעצמי עכשיו"** — מייל אמור להגיע תוך דקה.

## מה לא לעשות
- ❌ **לא לשנות** את ה-Client ID (חובה שיישאר זהה)
- ❌ **לא להוסיף** הרשאות אחרות שלא מבקשים
- ❌ **לא ליצור** אפליקציה חדשה — צריך להוסיף ל-קיימת בלבד
- ❌ **לא ליצור** Client Secret — האפליקציה משתמשת ב-PKCE, לא צריך secret

## אם משהו נתקע
- **לא רואים את האפליקציה** → המשתמשת צריכה להיכנס מהמכשיר שלה ולשתף את ה-Client ID
- **"Insufficient privileges to grant admin consent"** → צריך מנהל (admin) של ה-Tenant. אם המשתמשת היא הבעלת היחידה — לדלג על השלב, ההרשאה תעבוד ברמת המשתמש.
- **"Mail.Send לא מופיע ברשימה"** → בטוחים ש-Microsoft Graph נבחר ולא Microsoft Graph (legacy) או SharePoint?

## מי לעדכן
לחזור עם דיווח ל**מנהלת הבטיחות בתפוגן (sviva@tapugan.co.il)** ולכתוב לה בעברית פשוטה: "ההרשאה Mail.Send נוספה. את יכולה להתחבר מחדש ולנסות את הכפתור."
