---
name: tfugen-cloud-connect
description: How to connect an outside service (Cloudflare, Supabase management, any HTTP API) to a Claude Code cloud session of tfugen-safety without a work computer - a Network secret per host, verify it with one read call, do everything the API allows yourself, and hand Michael only what the API cannot do (a secret value the service will not return), with a phone instruction page. Load when a task needs a dashboard setting, an API key, or Michael's phone screens.
---

# חיבור שירות מהענן (בלי מחשב)

נכתב 16/10/2026 (מיכאל בשאלון: "בצע: skill חיבור שירות מהענן"), אחרי C15. ההחלטה: DECISIONS 16/10/2026 "בלי מחשב עבודה".

## הסדר

1. **קודם API, אחר כך מסך.** לכל שירות: מפתח API בהרשאה המינימלית, שמור כ-**Network secret** בסביבת הענן (Default). מיכאל מוסיף: תפריט הסביבה בכותרת השיחה > Edit > Network secrets > Add secret. בחלון יש **Host, Secret type, Header, Prefix, Value**. אין שדה שם, ולכן הסוד מזוהה לפי ה-Host. ל-Bearer רגיל משאירים את ברירת המחדל (Token, Authorization, Bearer).
2. **הסוד עובד באותה שיחה**, ולא רק בשיחה חדשה (נבדק 16/10/2026: `curl https://api.cloudflare.com/client/v4/user/tokens/verify` החזיר active מיד, בלי כותרת).
3. **בדיקה אחת לפני כל שינוי:** קריאה שמחזירה מצב (verify, GET על המשאב). לרשום את המצב לפני השינוי, לשנות, ולקרוא שוב. ב-Cloudflare Pages: `PATCH .../pages/projects/<name>` עם `deployment_configs.preview.env_vars` **ממזג** משתנים (שאר השמות נשארים), ו-`null` מוחק משתנה.
4. **מזהים שהמפתח לא רואה** (למשל `/accounts` ריק במפתח עם הרשאת Pages בלבד): לבקש צילום ממיכאל, ולרשום ב-`ACCOUNT-INVENTORY.md`. מזהה חשבון הוא לא סוד.
5. **רק מה שה-API לא יכול עובר למיכאל:** בעיקר ערך סודי ששירות לא מחזיר (Cloudflare secret_text, מפתח service_role). לא לחלץ ערכים סודיים לקובץ או למסך. מסווג ההרשאות חוסם את זה ("Credential Materialization"), ובצדק.
6. **הוראות לטלפון = דף Artifact**: תיבות סימון, קישור ישיר, כפתור העתקה לכל ערך, צילום אמיתי עם טבעת אדומה (פריים מסרטון של מיכאל מותר, אחרי שבודקים שאין בו ערך סודי). מה שלא ראיתי בעיניים: לכתוב "אין לי צילום של המסך הזה".

## מלכודות שנמצאו

- **הטלפון של מיכאל לא מציג בחירת Preview ב-Cloudflare**, גם לא אחרי ניסיון במצב מחשב. כל משתנה שהוא מוסיף נכנס ל-Production. משתנה ל-Preview: רק דרך ה-API, או מהמחשב.
- **מסך עריכה פתוח של Production בצילום** (פחי מחיקה ליד ROUTINE_KEY וכו'): לעצור מיד, Cancel, ולבדוק דרך ה-API שלא השתנה כלום.
- **Preview ב-Cloudflare החזיק סודות כטקסט גלוי** (16/10/2026, נמחקו באישור). בכל קריאה של משתני Pages לבדוק `type`: מפתח עם `plain_text` = ממצא אבטחה.
- **סרטון מסך של הגדרות הסביבה מראה את Environment variables בגלוי** (ROUTINE_KEY). להזהיר את מיכאל לא להעביר אותו, ולא לשים פריים כזה בדף.

## מה מחובר היום

| שירות | Host | הרשאה | נרשם |
|---|---|---|---|
| Cloudflare | `api.cloudflare.com` | Pages, חשבון `c9d388e3a5f9ee9546e8aa6b6353ec87` | `ACCOUNT-INVENTORY.md` |
| Supabase (ניסוי בלבד) | `api.supabase.com` | scoped PAT על `ldzbjbsumzqjyvtpiwqo`: Database, Auth Config כתיבה; תוקף 24 שעות מ-18/10/2026 | `ACCOUNT-INVENTORY.md` |

**מפתח Supabase:** רק scoped (מתחיל ב-`sbp_`, נבחרים פרויקט והרשאות). מפתח classic פותח את כל הפרויקטים, כולל החי: לא ליצור. בדיקה אחרי שמירה: הפרויקט שלו 200, החי 403.

## אחרי שמיכאל הוסיף סוד ב-Cloudflare (18/10/2026, C15)

- לאמת ב-API: `pages/projects/<p>` מחזיר רק שם וסוג (`secret_text`), אף פעם לא ערך. לספור גם את Production, כדי לוודא שלא השתנה.
- גרסה שנבנתה לפני שהסוד נוסף לא מכירה אותו. `POST deployments/<id>/retry` בונה אותה מחדש עם המשתנים של היום, ואז לבדוק אותה.
- הוכחה שהסוד עובד היא קריאה שעוברת דרכו, למשל `PREVIEW_URL=... node tests/staging/e2e.js` (סעיף 6b), ולא רק שורה ברשימת המשתנים.
