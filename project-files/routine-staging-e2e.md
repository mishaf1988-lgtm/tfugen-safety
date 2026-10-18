# Routine שבועי: בדיקת הניסוי מול גרסת התצוגה האחרונה

מיכאל, 18/10/2026, בשאלון: "בצע: בדיקת הניסוי שבועית". `tests/staging/e2e.js` עם `PREVIEW_URL` (31 בדיקות, #1666) רץ רק כשמישהו מפעיל אותו. כאן הוא רץ פעם בשבוע ומדווח רק כשמשהו נשבר.

**ה-Routine:** ייפתח מהשיחה הבאה. ד' 06:29 (`CRON_TZ=Asia/Jerusalem 29 6 * * 3`). שם הסוכן: `staging-e2e`.
**תלות:** הסיסמה הזמנית של `claude-test` נקבעת ב-`execute_sql` על `ldzbjbsumzqjyvtpiwqo` (Supabase MCP בשיחה העובדת), וכתובת גרסת התצוגה מ-Cloudflare (Network secret `api.cloudflare.com` בסביבה). בלי אחד מהם: ok:false עם הסיבה, לא לעקוף.

---
0. ידע משותף: קרא את project-files/agent-common.md, סעיפי "פתיחה" ו"ידע משותף". בסוף: סעיף "סגירה" (שם הסוכן: staging-e2e).
ריצה חדשה של משימה מתוזמנת: לבצע מההתחלה. כל הודעה בעברית, בלי מקף ארוך, תאריכים DD/MM/YYYY. רק מסד הניסוי, אף פעם לא החי.
1. בתיקיית tfugen-safety: git fetch origin main && git checkout -B main origin/main. npm ci אם אין node_modules/playwright.
2. גרסת התצוגה האחרונה: curl -sS "https://api.cloudflare.com/client/v4/accounts/c9d388e3a5f9ee9546e8aa6b6353ec87/pages/projects/tapugan-safety/deployments?env=preview&per_page=1", השדה url של הראשונה (latest_stage.status=success). נבנתה לפני השינוי האחרון במשתני Preview: POST .../deployments/<id>/retry ולחכות ל-success (עד 5 דקות).
3. סיסמה זמנית אקראית (python3 secrets.token_hex(10)) ל-claude-test@tfugen.local: execute_sql על project_id ldzbjbsumzqjyvtpiwqo: update auth.users set encrypted_password = extensions.crypt('<הסיסמה>', extensions.gen_salt('bf')) where email='claude-test@tfugen.local'.
4. PREVIEW_URL=<url> STAGING_PW=<הסיסמה> timeout 600 node tests/staging/e2e.js. לשמור את השורות עם ✗ ואת שורת הסיכום.
5. תמיד, גם אם צעד 4 נכשל: סיסמה אקראית חדשה שוב (כמו צעד 3, עם encode(extensions.gen_random_bytes(18),'hex')). את הסיסמה לא כותבים בשום מקום.
6. agent_report: הכל עבר: ok:true, line "<n>/<n> מול <hash>". נכשל: ok:false, line "<n> נכשלו מול <hash>: <שמות הבדיקות שנכשלו, עד 3>. מחכה למיכאל: לא, Claude בשיחה הבאה מתקן" (הסוכן לא מתקן קוד בעצמו).
7. הודעה אחרונה: שורת הסיכום והשורות עם ✗.
---
