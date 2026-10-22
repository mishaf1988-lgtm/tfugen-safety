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

- **Routine שמופעל מהשרת עם `text` רץ בשיחה חדשה בלי מאגר** (21/10/2026, "פיתוח מיידי"): אין `add_repo`, `git push` נחסם ("המאגר לא ברשימת המאגרים שמותרים לריצה"), ובדף ה-Routine אין בחירת מאגר בכלל, גם לא במחשב (C32). קוד שצריך push: Routine בשעון שקשור לשיחה קבועה שנפתחה עם `source_url` (המפתח התורן). לא לבקש ממיכאל "להוסיף מאגר" בדף.

- **פריסה ב-API של Cloudflare Pages** (21/10/2026, #1851 ו-#1852 לא נפרסו לבד): `POST .../deployments/<id>/retry` מפרסם מחדש את הפריסה האחרונה, ואם היא של branch אחר זו גרסת תצוגה, לא האתר. פריסה של האתר: `POST .../pages/projects/tapugan-safety/deployments` עם `-F branch=main`. סוד חדש (`WORKER_FIRE_TOKEN` וכו') נכנס לפעולה רק בפריסה חדשה. לפני שמסיקים שקוד שבור ("unknown op"): `bash project-files/routine-db.sh '{"op":"live"}'` מראה איזה commit רץ.

- **חיפוש ב-OneDrive for Business (`/search(q=)` ב-Graph) מחזיר `parentReference` בלי `path`** (21/10/2026, "תחתום בשמי על Safetecs" ענה "לא מצאתי" והקובץ היה שם). קוד שבונה נתיב מתוצאת חיפוש קורא את הפריט לפי `id` (`/me/drive/items/<id>?$select=parentReference`). בדיקה עם mock שמחזיר חיפוש בלי `path` (`sign-ask-test.mjs`).

- **לשרת (Pages Functions) אין הרשאת קריאה למייל** (22/10/2026, "השב לשולח" אחרי חתימה): הטוקן של OneDrive ב-`_onedrive.js` בלי `Mail.Read`, כי ה-tenant של תפוגן דורש אישור מנהל (27/09/2026). השרת רק כותב טיוטה דרך הזרימה (`mail_draft`). כל דבר שצריך לקרוא מייל (שולח, שרשור, מזהה ל-`reply_to`) עובר לעוזר, שיש לו מחבר 365, כמשימה מוכנה עם כל מה שהשרת יודע (שם הקובץ, השעה). לבדוק את זה לפני שמתכננים פיצ'ר שתלוי במייל: `hasMailRead` ב-`_onedrive.js`. הדוגמה: `signReplyTask` ב-`wa-hook.js`.

- **הפעלה של Routine ב-API תמיד פותחת שיחה חדשה, גם בלי טקסט** (20/10/2026 `relay_fire` `landed: false`, ושוב 22/10/2026 C35: המפתח התורן נפתח בשיחה בלי ה-repo וכתב "הקובץ לא קיים"). רק השעון של ה-Routine, או `fire_trigger` מתוך שיחה, נכנסים לשיחה הקבועה. לכן אין להשתמש בטוקן API כדי להעיר שיחה שיש לה repo.

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
