# Routine: המפתח התורן (בקשות קוד מהעוזר, כל שעתיים)

**הטריגר והשיחה:** `trig_017p7AWHAPjxncswGqdfab2p` בשיחה `session_013Z9kiSW2ewwXYCq9cdoDT5` (גם ב-`ACCOUNT-INVENTORY.md`). שיחה קבועה שנפתחה עם `source_url` של tfugen-safety, ולכן `git push` עובד בה (בשונה מ-`routine-dev-fire.md`, שבו ה-push נחסם, 21/10/2026). א'-ה', 07:17 עד 19:17 כל שעתיים.

מיכאל, 21/10/2026: "חייבים למצוא פתרון לעבודה רציפה", ובשאלון: "בצע: כל שעתיים". חיבור GitHub ל-Routine שנוצר מכלי אפשרי רק בהגדרות הארגון (נבדק בכרום, C32), ומיכאל לא רוצה תלות במנהל הארגון (09/10/2026). שם הסוכן: `dev-runner`.


**מתי הוא מתעורר:** כל שעתיים, א'-ה' 07:17-19:17. ב-22/10/2026 נוסתה השכמה לפי בקשה (`RUNNER_FIRE_TOKEN`). הפעלה ב-API פתחה שיחה חדשה בלי ה-repo ולא נכנסה לשיחה הזו, ולכן הנתיב כבוי (`RUNNER_RUNS` ב-routine-db).
---
**אין שאלון ואין המתנה** (22/10/2026: ב-13:14 נשאל `AskUserQuestion` על קרדיט API, והשיחה עמדה שעתיים מול שלוש בקשות פתוחות, ומיכאל חיכה לחתימה). אף אחד לא רואה את השיחה הזו. החלטה של מיכאל נכתבת ב-`dev_done` (`note`, מגיע אליו בוואטסאפ) או ב-`wa_me`, וממשיכים לבקשה הבאה.
0. ידע משותף: קרא את project-files/agent-common.md, סעיפי "פתיחה" ו"ידע משותף". בסוף: סעיף "סגירה" (שם הסוכן: dev-runner). ואת CLAUDE.md במלואו: את שיחת פיתוח של קו תפוגן לכל דבר, באותם חוקים.
1. **מתחילים מאפס.** `cd /home/user/tfugen-safety && git fetch -q origin main && git checkout -q main && git reset -q --hard origin/main`. לא להסתמך על ריצה קודמת בשיחה הזו.
1א. **האתר מריץ את main?** (21/10/2026, מיכאל: "מאשר", אחרי ששני מיזוגים לא הגיעו לאתר ונמצאו רק כשמשימת ניסיון החזירה "unknown op"). `LIVE_TRIES=2 bash project-files/live-check.sh`. יציאה 0: להמשיך. יציאה 4, והמיזוג האחרון ל-main (`git log -1 --format=%cI origin/main`) לפני יותר מ-10 דקות: פריסה של main, `curl -s -X POST "https://api.cloudflare.com/client/v4/accounts/c9d388e3a5f9ee9546e8aa6b6353ec87/pages/projects/tapugan-safety/deployments" -F branch=main` (לא `retry`: הוא מפרסם מחדש את הפריסה האחרונה, שיכולה להיות גרסת תצוגה), ואחרי כ-2 דקות `bash project-files/live-check.sh` שוב. עבר: שורה ב-`agent_report` ("הפריסה נתקעה, הופעלה מחדש"). לא עבר: `agent_report` עם `ok: false` ו-`for_michael` במשפט אחד. מיזוג מלפני פחות מ-10 דקות: הפריסה עוד רצה, להמשיך.
2. **יש עבודה?** `bash project-files/routine-db.sh '{"op":"state_get","keys":["dev_inbox"]}'`. בקשות ב-`status: open`, מהישנה לחדשה. אין: `agent_report` עם `ok: true` ו-`line: "אין בקשות"`, ולסיים בשורה אחת. בלי עדכון קבצים, בלי PR.
3. **בקשה אחת בכל ריצה** (הישנה ביותר), כדי שהשיחה לא תגדל. `bash project-files/claim.sh dev-<id> "<הבקשה בקצרה>"`; יציאה 5 = שיחה אחרת עליה: לעבור לבאה, ואם אין, לסיים.
4. **ה-hooks.** בדיקת ה-hooks מ-CLAUDE.md ("בתחילת כל שיחה", צעד 4). לא נחסמה: רק הפקודה של session-start.py משם.
5. **העבודה ומה לא עושים:** כמו `routine-dev-fire.md` צעדים 4 ו-5 (DECISIONS לפני שבונים, branch, בדיקות, PR עם "רטרו:" ו-"skill:", `ci-wait.sh`, מיזוג כשירוק; בלי פעולה הרסנית, סכמה, אזור רגיש, מייל לאדם, 365, החלטה של מיכאל).
6. **סגירה:** `dev_done` עם `id` ו-`note` בעברית שמיכאל מבין, בלי מזהים, שעות בשעון ישראל. ואז `claim.sh dev-<id> --release`. לא הצליח: בלי `dev_done`, `agent_report` עם `ok: false` ו-`for_michael`.
7. **שיחה גדולה:** `get_session` (אם קיים) מראה `context_usage.used_tokens` מעל 600,000: `agent_report` עם `for_michael: "המפתח התורן צריך שיחה חדשה"`, כדי ששיחת הפיתוח תחליף אותו.
---
