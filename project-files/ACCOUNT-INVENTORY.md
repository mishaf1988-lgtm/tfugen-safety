# מה קיים מחוץ ל-GitHub, ואיך מקימים אותו מחדש

מיכאל, 11/10/2026: "שנכיר את כל השינויים שעשינו... אם בהמשך אצטרך להעביר את כל הפעילות מהחשבון הזה, זה אמור להיות מתועד ב-GitHub".

הקוד, ההוראות של כל Routine וכל ההחלטות כבר ב-repo. הקובץ הזה מרכז את **מה שלא נמצא ב-repo**: הגדרות בחשבונות (Claude, Microsoft 365, Cloudflare, Supabase, Power Automate), כדי שאפשר יהיה לבנות אותן מחדש בחשבון אחר. **בלי ערכים סודיים**: רק שם, איפה הוא יושב, ומאיפה מקבלים אותו מחדש.

**כלל (11/10/2026):** כל דבר חדש שמוקם מחוץ ל-repo (Routine, זרימה, תיקייה שהאוטומציה תלויה בה, משתנה סביבה, pg_cron, connector) נרשם כאן באותו PR. `account-inventory-test.py` בודק שכל מזהה `trig_` שמופיע בקבצי ה-Routine נמצא כאן.

עודכן לאחרונה: 11/10/2026.

---

## 1. חשבון Claude (claude.ai, sviva@tapugan.co.il)

### Routines (טריגרים מתוזמנים)
**מפת המערכת** (https://claude.ai/artifact/KTMVcoPJBva43nKRacSLkc, 27/10/2026): נבנית מהטבלה הזו ומזרימות Power Automate למטה. שורה שנוספה או כובתה = `python3 project-files/system-map/build-map.py` ופרסום מחדש של `project-files/system-map/system-map.html` לאותו קישור, באותו PR (`system-map-test.py` נכשל אחרת).

ההוראות של כל אחד בקובץ `project-files/routine-*.md` (הטריגר רק אומר "קרא את הקובץ ובצע"). להעברה: `create_trigger` מחדש מתוך שיחה עובדת עם ה-repo, באותו cron ובאותו פרומפט קצר (התבנית: `tfugen-db` סעיף 7).

| מזהה | שם | מתי (שעון ישראל) | קובץ הוראות | שיחה |
|---|---|---|---|---|
| `trig_0191nGk9xs9QPCejRAJWbGjA` | תיוק מהמייל ועדכון תוקף | א'-ה' 17:52 | `routine-mail-filing.md` | `session_01HK2YJUpeGksTy3KHZ2sGCm` |
| `trig_01URTB4VwhD3cc1cdDhkCvA7` | תיוק מהמייל ועדכון תוקף 10:52 | א'-ה' 10:52 | `routine-mail-filing.md` | `session_01HK2YJUpeGksTy3KHZ2sGCm` |
| `trig_01CyB8c6LpkB3ArivGH4oQku` | תיוק מהמייל ועדכון תוקף 13:52 | א'-ה' 13:52 | `routine-mail-filing.md` | `session_01HK2YJUpeGksTy3KHZ2sGCm` |
| `trig_01Mg4hEDfQKBBHw2sbZTTUAH` | בודק התוקף מול המסמכים | מוצ"ש 22:44 | `routine-validity.md` | `session_01HK2YJUpeGksTy3KHZ2sGCm` |
| `trig_01ARtxNGLkCWwQyY1ofKoVfX` | דוח ציות חודשי | 1 לחודש 08:03 | `routine-compliance.md` | `session_01FXKjCZExakD2sbqi9eZVin` |
| `trig_01LFRERke4X4ehYiUYaE44bK` | סידור תעודות COA של שפכים | 17 לחודש 07:47 | `routine-coa.md` | `session_01FXKjCZExakD2sbqi9eZVin` |
| `trig_015cu3tQjAe6oJsGziXAfZJN` | מסמכים חדשים בתיקיית הבטיחות | 2 לחודש 06:51 | `routine-od-scan.md` | `session_01HK2YJUpeGksTy3KHZ2sGCm` |
| `trig_019NrPDFDdsfkYrmKcLcABw5` | נוסח החוקים בנבו | 3 לחודש 06:52 | `routine-nevo-versions.md` | `session_01FXKjCZExakD2sbqi9eZVin` |
| `trig_012v3HyJ1xpKcKE177emqtji` | מגמות מנתוני המפעל | 4 לחודש 08:14 | `routine-factory-trends.md` | `session_01FXKjCZExakD2sbqi9eZVin` |
| `trig_01PCAkeVUANPkzuCgmszt9k5` | המפקח המדומה | 5 לחודש 08:16 | `routine-inspector.md` | `session_01FXKjCZExakD2sbqi9eZVin` |
| `trig_015nyt8LcbxN3pPj3fEfKjcm` | מודל ההעדפות של מיכאל | 6 לחודש 08:21 | `routine-preferences.md` | `session_01FXKjCZExakD2sbqi9eZVin` |
| `trig_0112ddFifkor46mUGHrEQVCD` | מעקב הצעות מחיר | מוצ"ש 22:47 | `routine-quotes.md` | `session_01SNYNvuNvJZiQVL1VPDNuhF` |
| `trig_01PrGDTUzea2ewuNBTApskNc` | חוקר העוזר | א'-ה' 06:47 | `routine-researcher.md` | `session_01XecBM5b3kHkbb67kjSpmPs` |
| `trig_01KKNK11KbArFxmStSuuawww` | רטרו יומי | א'-ה' 07:52 | `retro-prompt.md` | `session_01XecBM5b3kHkbb67kjSpmPs` |
| `trig_01WzoFsHLwgUUURuhyfFDAvS` | הרדאר מלמד את העוזר | ב' 08:37 | `routine-radar-learn.md` | `session_01XecBM5b3kHkbb67kjSpmPs` |
| `trig_01F6R3kkBFwxJMhrgVDJqvbF` | חוקר ההמצאות | ו' 08:47 | `routine-inventor.md` | `session_01XecBM5b3kHkbb67kjSpmPs` |
| `trig_01FKWxifq39whQgdyrVNo8CW` | הדרכה שבועית מהשטח | א' 05:53 | `routine-talk-field.md` | `session_01HK2YJUpeGksTy3KHZ2sGCm` |
| `trig_01SzAJJc2RDFcLoAeBEcWonK` | רדאר רגולציה שבועי | א' 08:17 | הפרומפט בטריגר עצמו (לא בקובץ) | שיחה חדשה בכל ריצה |
| `trig_01BimkS5EroGgvLB1tZo6zQo` | תור משימות מ-Claude Code (Cowork) | א'-ה' 07:19-18:19, כל שעה (מ-18/10/2026; קודם כל שעה כל יום) | הפרומפט בטריגר; הכללים ב-`cowork-queue.md` | Cowork, קשור למחשב של מיכאל |
| `trig_016Cc2xKxQ9W5AEf75yLhmtA` | משרד הסוכנים: עדכון בוקר | כל יום 07:38 | `routine-office.md` | `session_01JT8Fct6Z6Qv2GbaBBqxtQT` |
| `trig_01RzUquedmBPwvRU8Jx8t4yh` | תפוגות שנתקעו אצל ספק | ב' 08:17 | `routine-supplier-followup.md` | `session_01SNYNvuNvJZiQVL1VPDNuhF` |
| `trig_01CoMmnoXCbn1a3sxgtCsUca` | תזכורת פרסום ההדרכה | א' 12:13 | `routine-talk-publish.md` | `session_01HK2YJUpeGksTy3KHZ2sGCm` |
| `trig_01Hqt7G6RLWeJbKEHXFzXWHW` | בודק לתור המשימות למחשב | כל יום 09:37 | `routine-cowork-check.md` | `session_01JT8Fct6Z6Qv2GbaBBqxtQT` |
| `trig_01AVa8RiuYtaeXLrtkUsZqKH` | בדיקת הניסוי השבועית | ד' 06:29 | `routine-staging-e2e.md` | `session_01JT8Fct6Z6Qv2GbaBBqxtQT` |
| `trig_01Fm5346rt5BNgeF49DqGbyz` | המגייס: החלפה שבועית | ו' 13:07 (ראשונה 23/10/2026) | `routine-rotation.md` | `session_01Q3LMWMr65icNtoe5zLifqr` (המגייס, נפתחה ביד על ידי מיכאל, דור 1) |
| `trig_01Py8YXifD3HtnQUmFgoTRft` | הדוור של הצ'אט במשרד | א'-ה' 08:11, 12:11, 16:11 | `routine-chat-relay.md` | `session_01JT8Fct6Z6Qv2GbaBBqxtQT` |
| `trig_0114iVUybrBb6vRqZt1EyoyL` | פיתוח מיידי: בקשה מהעוזר | בלי תזמון: השרת מפעיל לכל `dev_request` חדש (`DEV_FIRE_TOKEN`), שיחה חדשה בכל הפעלה | `routine-dev-fire.md` | אין (שיחה חדשה כל פעם) |
| `trig_011UyDNeQ1NV72NNyXJxwxtE` | עובד לפי דרישה: משימה מהעוזר | בלי תזמון: השרת מפעיל לכל `worker_now` חדש (`WORKER_FIRE_TOKEN`), שיחה חדשה בכל הפעלה | `routine-worker-now.md` | אין (שיחה חדשה כל פעם). מחבר Microsoft 365 מוסיפים בדף ה-Routine |
| `trig_01MB92o4ptUuC2a42SyP5S4e` | סריקת מיילים יומית: מיילים שמחכים לתשובה ממיכאל, עם נוסח וכפתורים | א'-ה' 08:13 (25/10/2026, מיכאל בשאלון: "בצע: פעם ביום, 08:30") | `routine-mail-triage.md` | אין (שיחה חדשה בכל ריצה); מחבר Microsoft 365 (מיכאל הוסיף ב-25/10/2026, C46) |
| `trig_01XgSGMbPk2UjxaCHFCJ9MWz` | בודק האיכות היומי: קורא מה שהסוכנים שלחו למיכאל, טיוטות וכתיבות למסד, מתקן ומדווח בשורה | א'-ה' 06:43 (27/10/2026, מיכאל בראיון) | `routine-quality.md` | אין (שיחה חדשה בכל ריצה; מחבר Microsoft 365 לקריאה, C52; גיבוי `drafts_text`) |
| `trig_01LCkXtoN8kG89ExhRx4RgXa` | יומן תוספות: כותב כל ערב את מה שמוזג באותו יום לעמוד https://claude.ai/artifact/SgaJHrTPhxf3fdHsCMguH7 (אוסף `days`) | א'-ו' 20:37 (27/10/2026, מיכאל בשאלון) | `routine-additions-log.md` | אין (שיחה חדשה בכל ריצה; ArtifactData מובנה, לא מחבר) |
| `trig_01Rc6DsLXFzq9BnPKe8zn2DZ` | המפתח התורן: בקשות קוד מהעוזר (מ-26/10/2026, שיחה חדשה) | א'-ה' 07:17 עד 19:17, כל שעתיים | `routine-dev-runner.md` | `session_01BLD52HhH67gxP2Yquk2mgy` |
| `trig_019kyW1TMXvJeK38auAh1Bkt` | כבוי 26/10/2026: המפתח התורן הקודם (השיחה הגיעה לכ-400 אלף טוקנים אחרי עבודה אינטראקטיבית עם מיכאל, מיכאל: "השיחה פה כבר ארוכה") | א'-ה' 07:17 עד 19:17, כל שעתיים | `routine-dev-runner.md` | `session_01MSqAcaJBru46xLKoM4Pyhf` |
| `trig_017p7AWHAPjxncswGqdfab2p` | כבוי 23/10/2026: המפתח התורן הישן (השיחה התארכה, 1.9 דולר להשכמה) | א'-ה' 07:17 עד 19:17, כל שעתיים (מפעיל API ו-`RUNNER_FIRE_TOKEN` קיימים ולא בשימוש: הפעלה ב-API פותחת שיחה חדשה, 22/10/2026) | `routine-dev-runner.md` | `session_013Z9kiSW2ewwXYCq9cdoDT5` (נפתחה עם source_url, ולכן push עובד) |
| `trig_01Wm6Nzy3sYFXusWuA6H3VYJ` | בדיקת זמני Supabase ועלויות הסוכנים (חד-פעמי) | 22/10/2026 17:30 | הפרומפט בטריגר | `session_01FXKjCZExakD2sbqi9eZVin` (רכז הדוחות; מיכאל 18/10/2026: "בדיקה של עלויות יכולה להיות תחת סוכן אחד"; הקודם `trig_01TFsrFwbqQM9fAoT8GfiobF` כובה) |
| `trig_01DCyrQpEF6dnHjhsrZRZfJM` | בדיקת שגיאות ראשונות מהדפדפן (חד-פעמי, אחרי #2108) | 28/10/2026 18:14 | הפרומפט בטריגר | `session_01HFfaw78Zp5wM5Rm3bohBz7` (הצ'אט הראשי של מיכאל) |
| `trig_01To9T7gxjVxce3W19iZW44n` | בדיקת הודעת יומן התוספות (חד-פעמי, אחרי #2117) | 28/10/2026 21:05 | הפרומפט בטריגר | `session_01HFfaw78Zp5wM5Rm3bohBz7` (הצ'אט הראשי של מיכאל) |
| `trig_01GkXGfAz4t89gw4ik1hoC8a` | סיכום שבוע ניסוי מצב המכסה (חד-פעמי, ideas-lab 11) | 03/11/2026 09:31 | הפרומפט בטריגר | `session_01HFfaw78Zp5wM5Rm3bohBz7` (הצ'אט הראשי של מיכאל) |
| `trig_01FKenmRrWQ22S1566BReYri` | מנהל השיווק: פעמיים בשבוע (קו העסק) | א' ו-ד' 08:53 (ראשונה 21/10/2026) | `marketing/routine-marketing.md` ב-safety-platform | `session_01DRrGQfp26adBiipx3PkZdA` |
| `trig_01TofqtqNWtrXMnqiNjHq1nZ` | העוזר בוואטסאפ (מודל Opus להודעות; מחבר Microsoft 365 מ-20/10/2026) | מפעיל API בלבד (הודעה ממיכאל: וואטסאפ, צ'אט, משרד). התזמון א'-ה' 07:47 הוסר ב-25/10/2026 (מיכאל בשאלון: "בצע: לבטל אותה"; ריצה שלא עשתה כלום מאז 20/10, כ-1.07$ במחירון), ו-`run_once_at` עומד על 01/01/2036 כי אי אפשר למחוק תזמון | `routine-wa-assistant.md` | `session_01ANNSTD9gftqbzoeDj9Fkmv` (Sonnet) |
| `trig_011XSXRjssx2uPNu1rk4P9L2` | כבוי 20/10/2026: העוזר בוואטסאפ (שיחה רזה) | מפעיל API בלבד, בלי שעון (את עדכון הבוקר שולח השרת) | `routine-wa-assistant.md` | `session_01NyqL1Nxaxeyn4cp8MRCfpd` (Sonnet). **כבוי (20/10/2026), השיחה בארכיון:** הפעלה עם `text` פותחת תמיד שיחה חדשה, כך שהזוג החדש לא נחוץ (`routine-wa-assistant.md`). `ASSISTANT2_FIRE_URL` ו-`ASSISTANT2_FIRE_TOKEN` נמחקו מ-Cloudflare (20/10/2026, מיכאל בשאלון) |
| `trig_01JfYyhTEaXb8Vwt724UXHDF` | כבוי 20/10/2026: העוזר בוואטסאפ (Opus), ניסיון | בלי שעון, בלי טוקן | `routine-wa-assistant.md` | `session_012r4x8zMkBEqBg64CFmpF9U` (Opus, בארכיון). **כבוי:** נפתח לבדיקה, והוכיח שבלי `text` ההפעלה נכנסת לשיחה ועם `text` לא |

שיחות "לא לארכב": השיחות בעמודה האחרונה, כולל המגייס. Routine יורה לתוך שיחה, וארכוב שלה עוצר אותו.

### Cowork
- **משימה מתוזמנת** "תור משימות מ-Claude Code" (למעלה). רצה רק כשהמחשב של מיכאל דלוק ואפליקציית Claude פתוחה. הפרומפט המלא: `get_trigger` על המזהה, או `cowork-queue.md`.
- **תור המשימות:** ארטיפקט פרטי `https://claude.ai/artifact/8YG6U1r72asze2EFHxz4db`, אוסף `cowork_tasks`, ו-assets (קבצים להעלאה). להעברה: ארטיפקט חדש, ולעדכן את הכתובת ב-`cowork-queue.md` ובפרומפט של המשימה. **לא לשתף אותו** (מי שכותב בו מאשר משימות).

- **משרד הסוכנים:** ארטיפקט פרטי `https://claude.ai/artifact/AmxFowGHYDqyhd1sE9qphi`, מוצמד בסרגל. אוסף `agents` (שולחן לכל טריגר) ומסמך `meta/office`, שה-Routine למעלה כותב כל בוקר. מקור העמוד: `project-files/agent-office-page.txt`. השיחה של מנהל התפעול צופה בו (`ArtifactComments` watch, מ-18/10/2026), כדי ששליחה מהצ'אט תעיר אותה מיד (`routine-chat-relay.md`, "הודעה מיידית"); אחרי העברה: לבקש מהשיחה החדשה watch. להעברה: לפרסם את המקור כארטיפקט חדש ולעדכן את הכתובת ב-`routine-office.md`.
- **דף החתימה על נהלים 26.03, 26.04 ו-146.03 (16/10/2026):** ארטיפקט פרטי `https://claude.ai/artifact/NQTGARqzS6t7tyeYNLyYPM`, מסמכים `sig/michael` ו-`sig/tzachi` (PNG של החתימה, `by`, `at`), ו-PDF של שלושת המסמכים ב-assets. להעברה: לקרוא את שני המסמכים (`ArtifactData get`) לפני שהחשבון נסגר; אחרי התיוק החתום אין בו צורך.
- **פרויקט Supabase לניסוי (16/10/2026):** `tfugen-staging`, מזהה `ldzbjbsumzqjyvtpiwqo`, eu-west-1, תוכנית Free, באותו ארגון של החי. נתוני דוגמה בלבד. להעברה: לייצא סכמה (או לבנות מחדש מהמסמך ב-STATUS, פריט "סביבת פיתוח וניסוי"); אין בו נתונים שצריך לשמור.

### Connectors (claude.ai > Settings > Connectors)
Microsoft 365 (קריאה: מייל, OneDrive, יומן, Teams), Supabase (`execute_sql` על `znhjtpcltrxxyfjczgvw`), Cloudflare Developer Platform, GitHub (repos `tfugen-safety` ו-`michael-skills`), Claude Docs. בחשבון חדש: לחבר את כולם, ולאשר את GitHub App על שני ה-repos.

### Skills של החשבון
הכול ב-repo הפרטי `mishaf1988-lgtm/michael-skills` (plugin, מסונכרן לחשבון לבד; `project-files/claude-ai-skill/README.md`). להעברה: להתקין את ה-plugin בחשבון החדש.

### סביבת הענן של Claude Code
סביבה `env_016FAHJNzmeY9hnaYA4JDs5e`. משתנה סביבה: `ROUTINE_KEY` (אותו ערך כמו ב-Cloudflare; בלעדיו ה-Routines נופלים ל-`execute_sql` שמחכה ללחיצה). להעברה: סביבה חדשה עם המשתנה, ולפתוח בה את השיחות העובדות מחדש.
Network secret באותה סביבה (16/10/2026): מפתח API של Cloudflare, Host `api.cloudflare.com`, Bearer, הרשאת Pages בחשבון `c9d388e3a5f9ee9546e8aa6b6353ec87` (לא רואה את רשימת החשבונות, לכן המזהה רשום כאן). Claude משנה איתו משתני Preview של `tapugan-safety` בלי מחשב. להעברה: מפתח חדש ב-Cloudflare (My Profile > API Tokens) ו-Network secret בסביבה החדשה.
Network secret שני (18/10/2026, C20): Host `api.supabase.com`, מפתח Supabase מוגבל (`claude-staging`, scoped PAT) לפרויקט הניסוי `ldzbjbsumzqjyvtpiwqo` בלבד: Project Settings קריאה, Database ו-Auth Config כתיבה. החי מחזיר 403. **תוקף 24 שעות** מ-18/10/2026: אחרי זה לא עובד, ומפתח חדש נוצר רק כשיש משימה (supabase.com/dashboard/account/tokens, אותן הרשאות). להעברה: אותו דבר בחשבון החדש.

---

## 2. Microsoft 365 (sviva@tapugan.co.il)

### Power Automate (https://make.powerautomate.com)
פירוט מלא, ביטויים ולקחים: `project-files/power-automate-mail.md`.

| זרימה | טריגר | מה עושה |
|---|---|---|
| קבצים מספקים לנכנס מהמייל | מייל חדש עם קובץ (תיבת דואר נכנס) | כל שולח חוץ מ-11 מוחרגים ו"הזמנת קניה"; שומר קבצים מצורפים (בלי תמונות, וידאו, ics, zip) ב-`_נכנס מהמייל` |
| קבצים ממייל לפי בקשה | קובץ חדש ב-`_אוטומציה\_בקשות מהמייל` | קורא מזהה מייל מהקובץ, Get email (V2), שומר את הקבצים המצורפים ב-`_נכנס מהמייל` |
| טיוטות מהעוזר (20/10/2026, C23) | קובץ חדש ב-`_אוטומציה\_טיוטות למייל` | קורא JSON מהקובץ ושומר טיוטה ב-Outlook של מיכאל (`mail_draft`); אין שליחה |
| תורים ליומן (20/10/2026, C24) | קובץ חדש ב-`_אוטומציה\_תורים ליומן` | קורא JSON מהקובץ ויוצר אירוע ביומן של מיכאל (Create event V4), בלי מוזמנים |
| הזזות ביומן (25/10/2026, C47) | קובץ חדש ב-`_אוטומציה\_הזזות ביומן` | קורא JSON מהקובץ ומזיז אירוע ביומן של מיכאל (PATCH של start ו-end בלבד, `power-automate-mail.md` זרימה 7) |
| טיוטות למחיקה (26/10/2026, C49) | קובץ חדש ב-`_אוטומציה\_טיוטות למחיקה` | קורא JSON, בודק שזו עדיין טיוטה עם אותו נושא, ומעביר אותה לפריטים שנמחקו (`power-automate-mail.md` זרימה 8) |
| זימונים (26/10/2026, C51, נבנתה ואומתה) | קובץ חדש ב-`_אוטומציה\_זימונים` | קורא JSON ויוצר פגישה ביומן של מיכאל עם מוזמנים (אירוע Graph); Outlook שולח את ההזמנות (`power-automate-mail.md` זרימה 9) |
| קבצים ממיילים ששלחתי (20/10/2026, C24) | מייל חדש עם קובץ ב-Sent Items | אותן החרגות (על הנמענים) ואותם סוגים כמו הזרימה הראשונה; שומר ב-`_נכנס מהמייל` עם "נשלח" בשם |

להעברה: לבנות מחדש לפי `power-automate-mail.md` (Claude בכרום עשה את זה ב-11/10/2026). החיבורים: Office 365 Outlook ו-OneDrive for Business של החשבון, בלי אישור מנהל.

### תיקיות ש-אוטומציה תלויה בהן (OneDrive, `שולחן העבודה\ניהול בטיחות`)
| תיקייה | מי כותב | מי קורא |
|---|---|---|
| `_נכנס מהמייל` | זרימות 1, 2 ו-5 | `routine-mail-filing`, `od_move` |
| `_נכנס מהמייל\לא לתיוק` | `od_move` | `backup-od` (מוחק אחרי 30 יום) |
| `_אוטומציה\_בקשות מהמייל` | `mail_request` (השרת) | זרימה 2 |
| `_אוטומציה\_טיוטות למייל` | `mail_draft` (השרת) | זרימה 3 |
| `_אוטומציה\_תורים ליומן` | `wa-morning.js` (השרת, `calendarStep`; מה נכתב: `server_state.cal_sent`) | זרימה 4 |
| `_אוטומציה\_הזזות ביומן` | `cal_move` (השרת; מה נכתב: `server_state.cal_moved`) | זרימה 7 |
| `_אוטומציה\_טיוטות למחיקה` | `draft_trash` (השרת; מה נכתב: `server_state.drafts_trashed`, ומה מותר: `drafts_made`) | זרימה 8 |
| `_אוטומציה\_זימונים` | `cal_invite` (השרת; מה נכתב: `server_state.cal_invited`) | זרימה 9 |
| `00_דוחות ומעקב\קטלוג מסמכים.xlsx`, גיליון Claude Log | Cowork | מיכאל |
| `Apps/Tapugan Safety/_Backups` (cron, monthly, photos, talks, code) | `backup-od` | שחזור. `code`: zip של שני המאגרים פעם בשבוע, 8 אחרונים (17/10/2026) |

### אפליקציית Azure (כניסת השרת ל-OneDrive ולמייל)
Client ID ו-Tenant: ב-`project-files/ONEDRIVE-SERVER-SETUP.md`. הרשאות delegated: `offline_access User.Read Files.ReadWrite Mail.Send` (`functions/_onedrive.js`, `SCOPES`). **בלי Mail.Read** (דורש אישור מנהל, DECISIONS 27/09/2026). הטוקן נשמר ב-Supabase, טבלה `oauth_tokens`; התחברות מחדש מהאפליקציה (מסך ההגדרות, חיבור OneDrive).

---

## 3. Cloudflare (פרויקט Pages `tapugan-safety`)

פריסה אוטומטית מ-`main`. **משתני סביבה וסודות** (Settings > Environment variables; שמות בלבד):

| שם | בשביל מה |
|---|---|
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | גישת השרת למסד |
| `ROUTINE_KEY` | `/api/routine-db` (Routines) |
| `ANTHROPIC_KEY` | `/api/claude` |
| `ONEDRIVE_CLIENT_ID`, `ONEDRIVE_CLIENT_SECRET`, `ONEDRIVE_TENANT_ID` | אפליקציית Azure |
| `TRUSTEE_NOTIFY_SECRET` | קריאות pg_cron לשרת, קישורי סגירה |
| `TRUSTEE_CODE`, `TRUSTEE_REMEMBER` | כניסת נאמנים |
| `GH_SKILLS_TOKEN` | המייל השבועי קורא את תור העוזר ב-michael-skills; `backup-od` מוריד איתו את ה-zip השבועי של michael-skills (17/10/2026) |
| `GEMINI_API_KEY`, `GEMINI_MODEL`, `TTS_MODEL`, `TTS_VOICE` | הקראה בקול |
| `AZURE_VISION_ENDPOINT`, `AZURE_VISION_KEY` | זיהוי טקסט בסריקות (`ocr_txt`, 24/10/2026). משאב Azure AI Vision בשכבה החינמית F0, `tapugan-ocr`, West Europe (C41). מפתח חדש: Azure Portal, המשאב, Keys and Endpoint |
| `META_ACCESS_TOKEN`, `META_PHONE_NUMBER_ID`, `META_WABA_ID` | וואטסאפ |
| `WA_PIN` | ה-PIN בן 6 הספרות של מספר העוזר (24/10/2026): השומר (`_watchdog.js`) רושם מחדש לבד מספר שנפל ל-PENDING, פעם בשעה לכל היותר; גם `wa_phone` step register. מיכאל מדביק אותו (C42) |
| `VAPID_PRIVATE` (לא בשימוש) | בוטל 25/10/2026 לפני שהוגדר: השרת יוצר את זוג מפתחות ההתראות בעצמו ושומר ב-`server_state` (`vapid_keys`, רק מפתח השירות קורא), כי הסוד לא צריך לעבור דרך שיחה. אם יוגדר יחד עם `VAPID_PUBLIC`, הוא גובר (`_push.js`). המנויים: `chat_push_subs`. מצב "רק לצ'אט": `wa_owner_mode` = `chat` |
| `META_APP_SECRET`, `WA_VERIFY_TOKEN`, `ASSISTANT_FIRE_URL`, `ASSISTANT_FIRE_TOKEN`, `POSTMAN_FIRE_TOKEN` (מ-C27: הטוקן של הדוור `trig_01Py8YXifD3HtnQUmFgoTRft`, ל-`relay_fire`), `RUNNER_FIRE_TOKEN` (מ-C35, 22/10/2026: הטוקן של המפתח התורן; לא בשימוש, `RUNNER_RUNS` = false), `DEV_FIRE_TOKEN` (מ-C31: הטוקן של "פיתוח מיידי" `trig_0114iVUybrBb6vRqZt1EyoyL`, ל-`dev_request`), `WORKER_FIRE_TOKEN` (מ-C33, כשיישמר: הטוקן של "עובד לפי דרישה" `trig_011UyDNeQ1NV72NNyXJxwxtE`, ל-`worker_now`) | העוזר בוואטסאפ (19/10/2026): חתימת ה-webhook של Meta, אימות ה-webhook, וה-API trigger של `trig_01TofqtqNWtrXMnqiNjHq1nZ`. `WA_VERIFY_TOKEN` ו-`ASSISTANT_FIRE_URL` נכתבו דרך ה-API; השניים האחרים רק מיכאל (ערכים ש-Meta ו-claude.ai מראים פעם אחת) |
| `RESEND_KEY`, `RESEND_FROM` | מייל גיבוי |
| `VITRE_API_KEY_ID`, `VITRE_API_KEY_SECRET`, `VITRE_NOTIFY_CREATED_BY`, `VITRE_NOTIFY_ENABLED`, `VITRE_PHOTO_KEY`, `VITRE_PHOTO_TEMPLATE` | Vitre |
| `ALLOWED_COUNTRIES`, `ALLOWED_ORIGINS`, `SUBREQ_LIMIT` | הגבלות |

**המספר של העוזר נפל (24/10/2026):** `wa_me` החזיר 133010, `wa_check` הראה `phone.status` PENDING ו-platform NOT_APPLICABLE. זה מספר הבדיקה של Meta (בלי SIM), ולכן בלי קוד SMS: `routine-db.sh '{"op":"wa_phone","step":"register","pin":"<6 ספרות>"}'` החזיר CONNECTED / CLOUD_API, והודעת בדיקה עברה. ה-PIN (האימות הדו-שלבי של המספר) אצל מיכאל, לא ב-repo. `request_code` במספר הזה נכשל (136024) ואינו נדרש.

Worker נפרד: `tapugan-backup-cron` (`workers/backup-cron.js`), גיבוי יומי לבאקט ב-Supabase. סודות שלו: `SUPABASE_SERVICE_KEY`, `MANUAL_KEY` (רק להפעלה ידנית של `/run`; שום אוטומציה לא משתמשת בו. הערך הישן היה גלוי ב-`INFRA-2026-05-06.md` עד 11/10/2026, הוסר מהקובץ ונשאר בהיסטוריית git: להחליף ב-Cloudflare).

---

## 4. Supabase (`znhjtpcltrxxyfjczgvw`)

הסכמה: `migrations/*.sql` ב-repo. **pg_cron** (נמדד 11/10/2026, שעות UTC):

| job | מתי | מה |
|---|---|---|
| `backup-od` | 03:30, 04:30 | גיבוי ל-OneDrive, וניקוי "לא לתיוק" |
| `vitre-sync` | 03:00, 04:00 | סנכרון Vitre |
| `xlsx-gaps` | 03:05 | פערים מול ה-Excel |
| `weather` | 14:07 | מזג האוויר של מחר (התחזית של השירות המטאורולוגי, שדרות), שורה במסך הבית. נכנס כשה-migration `2026-10-15_weather_cron.sql` רץ |
| `wa-morning` | 04:47, 05:47 א'-ה' | עדכון הבוקר בוואטסאפ מהשרת (`/api/wa-morning`); נשלח רק בקריאה שנופלת על 07:xx בישראל, פעם ביום. נכנס כשה-migration `2026-10-20_wa_morning_cron.sql` רץ |
| `od-scan` | 02:50 | קבצים חדשים בתיקיית הבטיחות |
| `weekly-digest` | א' 04:00, 05:00 | המייל השבועי |
| `talk-week` | א' 02:17 | שיחת הבטיחות השבועית |
| `anon-users-cleanup` | א' 02:13 | ניקוי משתמשים אנונימיים |
| `db-columns-check` | 1 לחודש 02:41 | שינויי עמודות |
| `hazard-file-retry`, `trustee-log-retry` | כל 15 דק' | ניסיון חוזר לתיוק |

ה-jobs קוראים לשרת עם `TRUSTEE_NOTIFY_SECRET` (שמור ב-Supabase Vault / בגוף ה-job). להעברה: להריץ את ה-migrations שיוצרים אותם (`grep -l "cron.schedule" migrations/`).

**קבצים בדלי `backups` שהשרת תלוי בהם** (לא ב-repo; 21/10/2026): `owner-signature/sig.png` = החתימה של מיכאל לחתימה על PDF (`functions/_sign.js`, `SIGN_OBJ`). בלעדיה כל "בצע" על בקשת חתימה עונה "תמונת החתימה עוד לא נשמרה בשרת". בהעברה: להעתיק את הקובץ לאותו נתיב (Storage > backups). `induction-docs/` של שיחת הבטיחות (`talk.js`, `DOCS_DIR`).

### מחשב העבודה ב-Azure (חשבון פרטי של מיכאל, לא של תפוגן)
- **חשבון:** חשבון Microsoft פרטי על ה-Gmail של מיכאל, Default Directory, "Azure subscription 1" (ניסיון, 13/10/2026; הקרדיט נגמר בערך 12/11/2026). מנהלים מפרופיל הכרום "Azure פרטי".
- **משאבים** ב-`tapugan-claude-rg`, Israel Central: המחשב `tapugan-claude` (Standard_B2als_v2, Windows Server 2022 Azure Edition smalldisk, משתמש `michael-vm`), דיסק 64GB, IP ציבורי קבוע `tapugan-claude-ip`, `tapugan-claude-nsg` (RDP רק מהכתובת של מיכאל), VNet `vnet-israelcentral-1`. תקציב `tapugan-claude-budget`, 15 דולר.
- **בלי כיבוי אוטומטי** (לא זמין באזור): Stop אחרי כל שימוש. התכנון וההחלטה: `work-vm-plan.md`, `work-vm-setup.md`, `work-vm-trial.md`.
- **להעברה:** אין מה להעביר מה-repo. מחשב חדש לפי `work-vm-setup.md`. הסיסמה אצל מיכאל בלבד.
- **סוף (14/10/2026, מיכאל):** לא בשימוש ולא נמחק ביד. בלי Upgrade המנוי נעצר לבד בסוף הניסיון (בערך 12/11/2026) ונמחק עם כל המשאבים עד 90 ימים אחר כך, בלי חיוב. **לא ללחוץ Upgrade.** מיילים מ-Azure על השבתה ומחיקה צפויים. כשהמנוי נמחק: להוריד את הסעיף הזה.

### אפליקציות GitHub (חשבון mishaf1988-lgtm, Settings, Applications; נבדק 13/10/2026)
- **בשימוש:** Claude (העבודה על הקוד מהשיחות), Claude Design Import, Cloudflare Workers and Pages (פריסה מ-main).
- **הוסר 13/10/2026:** Cursor (לא בשימוש, כתיבה לכל המאגרים, ביקש 7 הרשאות נוספות), Vercel (הפרויקט נמחק 21/09/2026), Netlify (מושהה). Cursor ו-Netlify Auth בוטלו גם ב-OAuth (C12, 13/10/2026).
- **Authorized GitHub Apps** (התחברות, לא התקנה): גם ChatGPT Codex Connector, Copilot Chat App, Copilot SWE Agent, Manus Connector. **OAuth Apps:** Cloudflare, Supabase, Resend, DigitalOcean, Ollama, GitHub CLI, Git Credential Manager, GitHub iOS. מיכאל השאיר אותם (13/10/2026); לא בשימוש של המערכת הזו.
- אפליקציה חדשה עם גישה לקוד נרשמת כאן באותו PR.

---

## 5. בדיקה אחרי העברה
1. `list_triggers`: כל השורות בטבלה בסעיף 1, `enabled`.
2. `bash project-files/routine-db.sh '{"op":"select","table":"docs","query":"select=id&limit=1"}'` יוצא 0.
3. מייל עם PDF מספק: תוך דקות ב-`_נכנס מהמייל`.
4. `select jobname from cron.job`: כל השורות בסעיף 4.
5. המייל של יום ראשון מגיע, ושורת "תקין" בתחתית מונה את כל הסוכנים.
