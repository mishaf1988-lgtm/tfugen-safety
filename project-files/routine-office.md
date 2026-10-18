# Routine יומי: משרד הסוכנים

מיכאל, 16/10/2026: "הייתי רוצה מוד בטלפון שאני רואה משרד עם הסוכנים שלי בלחיצה בכפתור". בשאלון: "בצע: עמוד ב-Claude, מוצמד", "בצע: כל בוקר אוטומטית", ועל כל שולחן: מצב, מה עשה ומה למד, מה מחכה לו, עלות לריצה.

**העמוד:** ארטיפקט פרטי `https://claude.ai/artifact/AmxFowGHYDqyhd1sE9qphi` ("משרד הסוכנים", מוצמד בסרגל של claude.ai). העמוד רק קורא; הנתונים במסד של הארטיפקט (capability `db`): אוסף `agents` (מסמך לכל טריגר, המזהה = מזהה הטריגר) ומסמך `meta/office` (`updated_at`). מקור העמוד: `project-files/agent-office-page.txt` (טקסט ולא `.html`, חוק 5 ב-CLAUDE.md; לפרסום מחדש: להעתיק לקובץ `.html` בסקראץ' ולפרסם עם ה-url).

**ההגדרות:** כל יום 07:38 שעון ישראל (`CRON_TZ=Asia/Jerusalem 38 7 * * *`), לתוך `session_01JT8Fct6Z6Qv2GbaBBqxtQT` (השיחה של הסוכנים החודשיים, Sonnet, הזולה מבין הארבע ב-`agent-costs.md`).

**קישור לכל סוכן (17/10/2026, מיכאל: "הכל חייב לעבוד שם, כל הסוכנים שלי"):** בפרטי השולחן כפתור "פתח את הסוכן" ל-`https://claude.ai/code/routines/<מזהה>`: כל הריצות במלואן ו-Run now. כך כל סוכן נראה ומופעל מהטלפון ומכל פרויקט, בלי מחבר Routines בצ'אט. בעמוד בלבד, השדות לא השתנו.

**צ'אט עם עובד (18/10/2026, מיכאל: "להתכתב עם כל עובד"):** בכרטיס השולחן יש תיבת הודעה. היא שולחת `send_message` לשיחה הקבועה של העובד וקוראת `list_events` דרך המחבר "Claude Code Remote" של מיכאל. המפה עובד לשיחה בתוך העמוד (`SESS` ב-`agent-office-page.txt`) חייבת להתאים לטבלת ACCOUNT-INVENTORY: עובד חדש או שיחה שהוחלפה = לעדכן את `SESS` ולפרסם. הודעה מהצ'אט מתחילה ב-`[מיכאל כותב מהמשרד]`: כשעובד רואה אותה, זו בקשה של מיכאל (לענות בקצרה בשיחה). פעולה הרסנית, מייל ואזור רגיש עדיין מחכים ל"בצע" בשיחה עצמה.

**שדות של שולחן:** `name`, `worker`, `role` (שורה אחת), `room` (אחד מ: חדר המחקר, חדר המסמכים, חדר הדוחות, תזכורות), `order`, `schedule` (בעברית), `status` (`done` / `run` / `fail` / `never`), `last_run`, `next_run` (ISO), `did`, `learned`, `waiting` (ריק = לא מחכה), `cost`.

**הפרומפט (הטריגר קורא את הקובץ ומבצע את מה שבין הקווים):**

---
0. ידע משותף: קרא את project-files/agent-common.md (ב-repo tfugen-safety), סעיף "פתיחה". הסוכן הזה קורא את הלוג ולא כותב בו (ריצה יומית קצרה, בלי "סגירה"), חוץ מריצה שנכשלה: אז שורה אחת לפי "סגירה".
ריצה חדשה של משרד הסוכנים: לבצע מההתחלה, לא להסתמך על ריצות קודמות בשיחה הזו. עברית בלבד. בלי מקף ארוך. לחסוך: לא לקרוא קבצים מעבר למה שכתוב כאן.
1. בתיקיית tfugen-safety: git fetch origin main && git checkout -B main origin/main.
2. list_triggers (claude-code-remote) עם enabled=true ו-limit=100. כל טריגר = שולחן אחד, המזהה = מזהה הטריגר.
3. לכל טריגר:
   - status: last_run.status SUCCEEDED = done, FAILED = fail; fired_at בלי finished_at = run; אין last_run = never.
   - last_run = last_run.finished_at (או fired_at), next_run = next_run_at. schedule: התזמון בעברית מטבלת ה-Routines ב-project-files/ACCOUNT-INVENTORY.md.
   - name: השם מאותה טבלה (קצר). role: שורה אחת, מה הסוכן עושה, מהשורה הראשונה של קובץ ההוראות שלו (או מהפרומפט בטריגר).
   - worker (18/10/2026, מיכאל: "בצע: חמישה עובדים, משימות על כל שולחן"): לפי persistent_session_id של הטריגר. session_01JT8Fct6Z6Qv2GbaBBqxtQT = מנהל התפעול, session_01Wu6gzvUs3SYbLQ5fiaGayV = רכז המסמכים, session_012U83ozxzQjH8BcQ2AvykSf = רכז הרכש, session_01HPcF58y98mzJ19wJ27EDn5 = רכז הדוחות (מ-18/10/2026), session_019o8PKShtacN2m1BCbYdnQj = החוקר. בלי שיחה קבועה: רדאר רגולציה = הרדאר, "תור משימות" (Cowork) = העוזר שלך (18/10/2026, מיכאל: "העוזר שלך והמחשב שלך יכולים להיות כעובד אחד"; אותו שולחן כמו מסמך `assistant`), run_once_at = תזכורות. שיחה אחרת שלא ברשימה: "עובד חדש" ושורה בהודעה האחרונה. העמוד מציג שולחן לכל worker, והמשימות שלו ברשימה.
   - room: חדר המחקר = researcher, inventor, radar-learn, רדאר רגולציה, retro, preferences. חדר המסמכים = mail-filing, validity, od-scan, quotes, supplier-followup, cowork-check, תור משימות. חדר הדוחות = compliance, inspector, factory-trends, nevo-versions, talk-field, talk-publish, staging-e2e. תזכורות = טריגר חד-פעמי (run_once_at). סוכן חדש שלא ברשימה: לפי מה שהוא עושה.
   - did ו-learned: השורה האחרונה של הסוכן ב-project-files/agent-log.md (עמודת התוצאה, וה"למדתי"), עד 200 תווים כל אחד. אין שורה = ריק.
   - waiting: מה שכתוב באותה שורה אחרי "מחכה למיכאל", אחרת ריק. לא להמציא.
   - cost: מ-project-files/agent-costs.md, רק מספר לריצה שנמדד, עם הבסיס (מחירון או חיוב). לא נמדד = "לא נמדד עדיין". לא לחשב לבד (לקח 103).
3א. שולחן העוזר (18/10/2026, מיכאל: "אני לא רואה פה גם את העוזר שלי"): המסמך `assistant` באוסף agents אינו טריגר, ולכן לא נמחק בצעד 4. worker = "העוזר שלך", status = done, schedule = "כשאתה פונה אליו". did: "גרסה <N> (<DD/MM/YYYY>): <מה השתנה>" מה-commit האחרון שמעלה גרסה ב-mishaf1988-lgtm/michael-skills (mcp__github__list_commits, perPage 5; הגרסה מהודעת ה-commit). last_run = תאריך אותו commit. אין גישה: להשאיר את המסמך כמו שהוא.
4. ArtifactData על https://claude.ai/artifact/AmxFowGHYDqyhd1sE9qphi, פעולת batch אחת: set לכל שולחן באוסף agents, delete לשולחן שהטריגר שלו כבר לא ברשימה (חוץ מ-`assistant`), ו-set ל-meta/office עם updated_at (עכשיו, ISO) ו-count = מספר השולחנות שנשארו אחרי ה-delete (17/10/2026: נכתב 19 כשבמשרד היו 18).
5. אסור: מייל, הודעה, כתיבה ב-365, כתיבה במסד של האפליקציה, שינוי טריגר, PR. רק כתיבה במסד של הארטיפקט.
6. הודעה אחרונה, שורה אחת: כמה שולחנות, כמה נכשלו, כמה מחכים למיכאל.
---
