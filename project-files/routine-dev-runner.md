# Routine: המפתח התורן (בקשות קוד מהעוזר, כל שעתיים)

**הטריגר והשיחה:** `trig_017p7AWHAPjxncswGqdfab2p` בשיחה `session_013Z9kiSW2ewwXYCq9cdoDT5` (גם ב-`ACCOUNT-INVENTORY.md`). שיחה קבועה שנפתחה עם `source_url` של tfugen-safety, ולכן `git push` עובד בה (בשונה מ-`routine-dev-fire.md`, שבו ה-push נחסם, 21/10/2026). א'-ה', 07:17 עד 19:17 כל שעתיים.

מיכאל, 21/10/2026: "חייבים למצוא פתרון לעבודה רציפה", ובשאלון: "בצע: כל שעתיים". חיבור GitHub ל-Routine שנוצר מכלי אפשרי רק בהגדרות הארגון (נבדק בכרום, C32), ומיכאל לא רוצה תלות במנהל הארגון (09/10/2026). שם הסוכן: `dev-runner`.

---
0. ידע משותף: קרא את project-files/agent-common.md, סעיפי "פתיחה" ו"ידע משותף". בסוף: סעיף "סגירה" (שם הסוכן: dev-runner). ואת CLAUDE.md במלואו: את שיחת פיתוח של קו תפוגן לכל דבר, באותם חוקים.
1. **מתחילים מאפס.** `cd /home/user/tfugen-safety && git fetch -q origin main && git checkout -q main && git reset -q --hard origin/main`. לא להסתמך על ריצה קודמת בשיחה הזו.
2. **יש עבודה?** `bash project-files/routine-db.sh '{"op":"state_get","keys":["dev_inbox"]}'`. בקשות ב-`status: open`, מהישנה לחדשה. אין: `agent_report` עם `ok: true` ו-`line: "אין בקשות"`, ולסיים בשורה אחת. בלי עדכון קבצים, בלי PR.
3. **בקשה אחת בכל ריצה** (הישנה ביותר), כדי שהשיחה לא תגדל. `bash project-files/claim.sh dev-<id> "<הבקשה בקצרה>"`; יציאה 5 = שיחה אחרת עליה: לעבור לבאה, ואם אין, לסיים.
4. **ה-hooks.** בדיקת ה-hooks מ-CLAUDE.md ("בתחילת כל שיחה", צעד 4). לא נחסמה: רק הפקודה של session-start.py משם.
5. **העבודה ומה לא עושים:** כמו `routine-dev-fire.md` צעדים 4 ו-5 (DECISIONS לפני שבונים, branch, בדיקות, PR עם "רטרו:" ו-"skill:", `ci-wait.sh`, מיזוג כשירוק; בלי פעולה הרסנית, סכמה, אזור רגיש, מייל לאדם, 365, החלטה של מיכאל).
6. **סגירה:** `dev_done` עם `id` ו-`note` בעברית שמיכאל מבין, בלי מזהים, שעות בשעון ישראל. ואז `claim.sh dev-<id> --release`. לא הצליח: בלי `dev_done`, `agent_report` עם `ok: false` ו-`for_michael`.
7. **שיחה גדולה:** `get_session` (אם קיים) מראה `context_usage.used_tokens` מעל 600,000: `agent_report` עם `for_michael: "המפתח התורן צריך שיחה חדשה"`, כדי ששיחת הפיתוח תחליף אותו.
---
