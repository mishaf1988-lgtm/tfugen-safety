# Routine יומי: משרד הסוכנים

מיכאל, 16/10/2026: "הייתי רוצה מוד בטלפון שאני רואה משרד עם הסוכנים שלי בלחיצה בכפתור". בשאלון: "בצע: עמוד ב-Claude, מוצמד", "בצע: כל בוקר אוטומטית", ועל כל שולחן: מצב, מה עשה ומה למד, מה מחכה לו, עלות לריצה.

**העמוד:** ארטיפקט פרטי `https://claude.ai/artifact/AmxFowGHYDqyhd1sE9qphi` ("משרד הסוכנים", מוצמד בסרגל של claude.ai). העמוד רק קורא; הנתונים במסד של הארטיפקט (capability `db`): אוסף `agents` (מסמך לכל טריגר, המזהה = מזהה הטריגר) ומסמך `meta/office` (`updated_at`). מקור העמוד: `project-files/agent-office-page.txt` (טקסט ולא `.html`, חוק 5 ב-CLAUDE.md; לפרסום מחדש: להעתיק לקובץ `.html` בסקראץ' ולפרסם עם ה-url).

**ההגדרות:** כל יום 07:38 שעון ישראל (`CRON_TZ=Asia/Jerusalem 38 7 * * *`), לתוך `session_01JT8Fct6Z6Qv2GbaBBqxtQT` (השיחה של הסוכנים החודשיים, Sonnet, הזולה מבין הארבע ב-`agent-costs.md`).

**קישור לכל סוכן (17/10/2026, מיכאל: "הכל חייב לעבוד שם, כל הסוכנים שלי"):** בפרטי השולחן כפתור "פתח את הסוכן" ל-`https://claude.ai/code/routines/<מזהה>`: כל הריצות במלואן ו-Run now. כך כל סוכן נראה ומופעל מהטלפון ומכל פרויקט, בלי מחבר Routines בצ'אט. בעמוד בלבד, השדות לא השתנו.

**שדות של שולחן:** `name`, `role` (שורה אחת), `room` (אחד מ: חדר המחקר, חדר המסמכים, חדר הדוחות, תזכורות), `order`, `schedule` (בעברית), `status` (`done` / `run` / `fail` / `never`), `last_run`, `next_run` (ISO), `did`, `learned`, `waiting` (ריק = לא מחכה), `cost`.

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
   - room: חדר המחקר = researcher, inventor, radar-learn, רדאר רגולציה, retro, preferences. חדר המסמכים = mail-filing, validity, od-scan, quotes, תור משימות. חדר הדוחות = compliance, inspector, factory-trends, nevo-versions, talk-field. תזכורות = טריגר חד-פעמי (run_once_at). סוכן חדש שלא ברשימה: לפי מה שהוא עושה.
   - did ו-learned: השורה האחרונה של הסוכן ב-project-files/agent-log.md (עמודת התוצאה, וה"למדתי"), עד 200 תווים כל אחד. אין שורה = ריק.
   - waiting: מה שכתוב באותה שורה אחרי "מחכה למיכאל", אחרת ריק. לא להמציא.
   - cost: מ-project-files/agent-costs.md, רק מספר לריצה שנמדד, עם הבסיס (מחירון או חיוב). לא נמדד = "לא נמדד עדיין". לא לחשב לבד (לקח 103).
4. ArtifactData על https://claude.ai/artifact/AmxFowGHYDqyhd1sE9qphi, פעולת batch אחת: set לכל שולחן באוסף agents, delete לשולחן שהטריגר שלו כבר לא ברשימה, ו-set ל-meta/office עם updated_at (עכשיו, ISO) ו-count = מספר השולחנות שנשארו אחרי ה-delete (17/10/2026: נכתב 19 כשבמשרד היו 18).
5. אסור: מייל, הודעה, כתיבה ב-365, כתיבה במסד של האפליקציה, שינוי טריגר, PR. רק כתיבה במסד של הארטיפקט.
6. הודעה אחרונה, שורה אחת: כמה שולחנות, כמה נכשלו, כמה מחכים למיכאל.
---
