# Routine שבועי: בדיקת הניסוי מול גרסת התצוגה האחרונה

**הטריגר הפעיל (20/10/2026, לפי `ACCOUNT-INVENTORY.md`):** `trig_01CkizD1F41kU5BAzEA9DX4q` (שיחה `session_01JT8Fct6Z6Qv2GbaBBqxtQT`). מזהים אחרים בקובץ הם היסטוריה; לפני `fire_trigger` או `update_trigger`: `get_trigger` על המזהה.

מיכאל, 18/10/2026, בשאלון: "בצע: בדיקת הניסוי שבועית". `tests/staging/e2e.js` עם `PREVIEW_URL` (31 בדיקות, #1666) רץ רק כשמישהו מפעיל אותו. כאן הוא רץ פעם בשבוע ומדווח רק כשמשהו נשבר.

**ה-Routine:** ייפתח מהשיחה הבאה. ד' 06:29 (`CRON_TZ=Asia/Jerusalem 29 6 * * 3`). שם הסוכן: `staging-e2e`.
**תלות:** הסיסמה הזמנית של `claude-test` נקבעת ב-`execute_sql` על `ldzbjbsumzqjyvtpiwqo` (Supabase MCP בשיחה העובדת), וכתובת גרסת התצוגה מ-Cloudflare (Network secret `api.cloudflare.com` בסביבה). בלי אחד מהם: ok:false עם הסיבה, לא לעקוף. Network secret של `api.supabase.com` בסביבה פג ב-19/10/2026 (401): לא תחליף ל-MCP.

---
0. ידע משותף: קרא את project-files/agent-common.md, סעיפי "פתיחה" ו"ידע משותף". בסוף: סעיף "סגירה" (שם הסוכן: staging-e2e).
ריצה חדשה של משימה מתוזמנת: לבצע מההתחלה. כל הודעה בעברית, בלי מקף ארוך, תאריכים DD/MM/YYYY. רק מסד הניסוי, אף פעם לא החי.
1. בתיקיית tfugen-safety: git fetch origin main && git checkout -B main origin/main. npm ci אם אין node_modules/playwright.
2. גרסת התצוגה האחרונה: curl -sS "https://api.cloudflare.com/client/v4/accounts/c9d388e3a5f9ee9546e8aa6b6353ec87/pages/projects/tapugan-safety/deployments?env=preview&per_page=1", השדה url של הראשונה (latest_stage.status=success). נבנתה לפני השינוי האחרון במשתני Preview: POST .../deployments/<id>/retry ולחכות ל-success (עד 5 דקות).
**11/11/2026 (בקשת פיתוח מהתראת התקלות):** הריצה של 06:29 נעצרה בצעד 3: `execute_sql` חיכה לאישור ידני ואף אחד לא ענה (ב-28/10/2026 אותה פקודה עברה בלי אישור). `guard-sql.py` לא ביקש אישור על הפקודה (נבדק: מחזיר `{}`), ו-`api.supabase.com` עדיין מחזיר 401. הסיבה כנראה בשם הכלי בשיחה (לא `mcp__Supabase__execute_sql` שברשימת ההיתרים) או במחבר שדורש אימות מחדש. לכן צעד 3א.
**11/11/2026, נמצא בצ'אט הראשי:** כלי ה-SQL של מחבר Supabase בחשבון נקרא `mcp__ea272696-c3b4-4b3b-bbcf-628f340e74ab__execute_sql` (מחבר claude.ai בשם מזהה), וברשימת ההיתרים יש רק `mcp__Supabase__execute_sql`. הוספה להיתרים היא שינוי הרשאות: מחכה לאישור מיכאל (STATUS). באותו יום הבדיקות הורצו ידנית: 31/31.
3א. **לפני צעד 3:** לטעון ב-`ToolSearch` את הכלי בשמו המלא (`mcp__Supabase__execute_sql` או `mcp__supabase__execute_sql`), ולכתוב ב-`learned` את השם המדויק של הכלי שנטען. פקודה שמחכה לאישור או שנחסמה: לא לנסות שוב; `agent_report` עם ok:false ו-line "לא רץ: execute_sql חיכה לאישור, הכלי <השם המדויק>". השם הזה מאפשר להוסיף אותו להיתרים ב-`.claude/settings.json`.
3. סיסמה זמנית אקראית (python3 secrets.token_hex(10)) ל-claude-test@tfugen.local: execute_sql על project_id ldzbjbsumzqjyvtpiwqo: update auth.users set encrypted_password = extensions.crypt('<הסיסמה>', extensions.gen_salt('bf')) where email='claude-test@tfugen.local'.
4. PREVIEW_URL=<url> STAGING_PW=<הסיסמה> timeout 600 node tests/staging/e2e.js. לשמור את השורות עם ✗ ואת שורת הסיכום.
5. תמיד, גם אם צעד 4 נכשל: סיסמה אקראית חדשה שוב (כמו צעד 3, עם encode(extensions.gen_random_bytes(18),'hex')). את הסיסמה לא כותבים בשום מקום.
6. agent_report: הכל עבר: ok:true, line "<n>/<n> מול <hash>". נכשל: ok:false, line "<n> נכשלו מול <hash>: <שמות הבדיקות שנכשלו, עד 3>. מחכה למיכאל: לא, Claude בשיחה הבאה מתקן" (הסוכן לא מתקן קוד בעצמו).
7. הודעה אחרונה: שורת הסיכום והשורות עם ✗.
---
