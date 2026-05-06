# פרומפט מוכן ל-Copilot

> **איך להשתמש:** העתיקי את כל הטקסט שבתוך הבלוק האפור למטה (החל מ-"שלום Copilot" ועד הסוף), הדביקי ל-Copilot, ושלחי. הוא יבצע את הכל וידווח לך כשסיים.

---

## 📋 הפרומפט להעתקה

```
שלום Copilot,

אני צריכה את העזרה שלך בביצוע פעולה ידנית ב-Azure Portal עבור אפליקציה
שלי בשם "Tapugan Safety". זוהי אפליקציה לניהול בטיחות תעשייתית שאני
משתמשת בה במפעל "תפוגן".

## הקשר
האפליקציה מסונכרנת עם OneDrive ויש לה כבר רישום ב-Azure (App
registration) שמשתמש ב-PKCE עם הרשאות Files.ReadWrite.AppFolder,
offline_access, User.Read. רוצה להוסיף הרשאה אחת חדשה כדי שהאפליקציה
תוכל לשלוח לי אוטומטית מיילים עם דוחות (משימות באיחור, ציוד שתוקפו פג,
NCRs פתוחים וכו') ישירות מחשבון ה-Outlook שלי.

## המשימה
להוסיף את ההרשאה Mail.Send (Delegated) לאפליקציה הקיימת ב-Azure.

## שלבים מדויקים

1. כניסה ל-https://portal.azure.com עם החשבון sviva@tapugan.co.il

2. בחיפוש למעלה: "App registrations" → לחיצה

3. בלשונית "Owned applications" או "All applications" — מצאי את
   האפליקציה Tapugan Safety. אם השם לא ברור, חפשי לפי תאריך יצירה
   אחרון, או בקשי ממני את ה-Client ID (אני יכולה לתת לך אותו).

4. בתפריט הצד של האפליקציה: API permissions

5. לחצי "+ Add a permission"

6. בחרי "Microsoft Graph"

7. בחרי "Delegated permissions" (חשוב — לא Application permissions)

8. בחיפוש: "Mail.Send"

9. סמני את התיבה ליד Mail.Send ("Send mail as a user")

10. לחצי "Add permissions"

11. אם יש כפתור "Grant admin consent for [Tenant]" למעלה — לחצי עליו
    ואשרי. אם הכפתור לא קיים או לא לחיץ — דלגי, זה אומר שההרשאה אושרה
    אוטומטית ברמת המשתמש.

## אישור הצלחה
בעמודה Status ליד Mail.Send אמור להופיע סימן ירוק ✓ ו-"Granted for
[Tenant]". אם לא מופיע ירוק אבל גם לא הייתה שגיאה — זה גם בסדר.

## מה אסור לעשות
- לא לשנות את ה-Application (client) ID
- לא להוסיף הרשאות אחרות (User.Read.All, Files.Read.All, Mail.Read, וכו')
- לא ליצור אפליקציה חדשה (חובה להוסיף לאפליקציה הקיימת)
- לא ליצור Client Secret (האפליקציה משתמשת ב-PKCE)
- לא לשנות Redirect URIs

## דיווח חזרה
אנא דווחי לי:
1. שמצאת את האפליקציה הנכונה
2. שהוספת את Mail.Send בהצלחה
3. צילום מסך של דף API permissions עם Mail.Send בעמודה ✓ Granted

## אם נתקעת
- אם אין הרשאות "Grant admin consent" → דלגי על השלב, ההרשאה תפעל
- אם לא מצאת את האפליקציה → תני לי את הרשימה של App registrations
  שמופיעות לך
- אם יש כל שגיאה אחרת → צלמי מסך ותארי מה ראית

תודה!
```

---

## 🔄 מה אני אעשה אחרי שCopilot יסיים

ברגע שCopilot יאשר שההרשאה נוספה, אני אעשה את הצעדים הבאים בעצמי באפליקציה:

1. ☁️ **חיבור OneDrive** → התנתק → התחבר מחדש (כדי לקבל token חדש שכולל את Mail.Send)
2. בחלון Microsoft שיפתח, אאשר את ההרשאה החדשה ("Send mail as you")
3. ⚙️ **הגדרות מיילים** → אבחר כלל מבדיקה → 📤 שלחי עכשיו
4. אבדוק שהמייל מגיע לתיבה

## 💡 טיפ למקרה שCopilot מתבלבל

אם Copilot שואל "איזה אפליקציה?" או מתקשה למצוא אותה — תני לו את ה-Client ID:

1. פתחי את `tapugan-safety.pages.dev`
2. תפריט … → ☁️ חיבור OneDrive (סנכרון מסמכים)
3. תחת "שלב 1: Azure App Client ID" יופיע מספר בפורמט:
   `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`
4. העתיקי את המספר ושלחי לCopilot — הוא ימצא את האפליקציה לפי המספר הזה
