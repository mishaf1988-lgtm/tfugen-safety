# מה קיים מחוץ ל-GitHub, ואיך מקימים אותו מחדש

מיכאל, 11/10/2026: "שנכיר את כל השינויים שעשינו... אם בהמשך אצטרך להעביר את כל הפעילות מהחשבון הזה, זה אמור להיות מתועד ב-GitHub".

הקוד, ההוראות של כל Routine וכל ההחלטות כבר ב-repo. הקובץ הזה מרכז את **מה שלא נמצא ב-repo**: הגדרות בחשבונות (Claude, Microsoft 365, Cloudflare, Supabase, Power Automate), כדי שאפשר יהיה לבנות אותן מחדש בחשבון אחר. **בלי ערכים סודיים**: רק שם, איפה הוא יושב, ומאיפה מקבלים אותו מחדש.

**כלל (11/10/2026):** כל דבר חדש שמוקם מחוץ ל-repo (Routine, זרימה, תיקייה שהאוטומציה תלויה בה, משתנה סביבה, pg_cron, connector) נרשם כאן באותו PR. `account-inventory-test.py` בודק שכל מזהה `trig_` שמופיע בקבצי ה-Routine נמצא כאן.

עודכן לאחרונה: 11/10/2026.

---

## 1. חשבון Claude (claude.ai, sviva@tapugan.co.il)

### Routines (טריגרים מתוזמנים)
ההוראות של כל אחד בקובץ `project-files/routine-*.md` (הטריגר רק אומר "קרא את הקובץ ובצע"). להעברה: `create_trigger` מחדש מתוך שיחה עובדת עם ה-repo, באותו cron ובאותו פרומפט קצר (התבנית: `tfugen-db` סעיף 7).

| מזהה | שם | מתי (שעון ישראל) | קובץ הוראות | שיחה |
|---|---|---|---|---|
| `trig_01SpyucrTXeti3BCYJHGtBiL` | תיוק מהמייל ועדכון תוקף | א'-ה' 17:52 | `routine-mail-filing.md` | `session_01Wu6gzvUs3SYbLQ5fiaGayV` |
| `trig_01QVjG6zoRDkqAniQhFqfpzF` | בודק התוקף מול המסמכים | מוצ"ש 22:44 | `routine-validity.md` | `session_01JT8Fct6Z6Qv2GbaBBqxtQT` |
| `trig_01Uq6xdHwgr3ymq1xqbMUhca` | דוח ציות חודשי | 1 לחודש 08:03 | `routine-compliance.md` | `session_01JT8Fct6Z6Qv2GbaBBqxtQT` |
| `trig_01PgHBDZYCBf8M9GsytoVMjd` | מסמכים חדשים בתיקיית הבטיחות | 2 לחודש 07:12 | `routine-od-scan.md` | `session_01JT8Fct6Z6Qv2GbaBBqxtQT` |
| `trig_01ELCjhJydNgjT9obYdDqnSu` | נוסח החוקים בנבו | 3 לחודש 07:22 | `routine-nevo-versions.md` | `session_01JT8Fct6Z6Qv2GbaBBqxtQT` |
| `trig_01AXicpR2Gn4DgterKACQ56A` | מגמות מנתוני המפעל | 4 לחודש 07:34 | `routine-factory-trends.md` | `session_01JT8Fct6Z6Qv2GbaBBqxtQT` |
| `trig_01SogHpEgS3nkMoworDxmfTh` | מעקב הצעות מחיר | מוצ"ש 22:47 | `routine-quotes.md` | `session_012U83ozxzQjH8BcQ2AvykSf` |
| `trig_01DskPcZDAt1uAjsZgPyWkam` | חוקר העוזר | א'-ה' 06:47 | `routine-researcher.md` | `session_019o8PKShtacN2m1BCbYdnQj` |
| `trig_01EDtjPSEhnt86YLLNFwxxm9` | רטרו יומי | א'-ה' 07:52 | `retro-prompt.md` | `session_019o8PKShtacN2m1BCbYdnQj` |
| `trig_01XPwRokY9GmbtX533Res2TU` | הרדאר מלמד את העוזר | ב' 08:37 | `routine-radar-learn.md` | `session_019o8PKShtacN2m1BCbYdnQj` |
| `trig_01SzAJJc2RDFcLoAeBEcWonK` | רדאר רגולציה שבועי | א' 08:17 | הפרומפט בטריגר עצמו (לא בקובץ) | שיחה חדשה בכל ריצה |
| `trig_01BimkS5EroGgvLB1tZo6zQo` | תור משימות מ-Claude Code (Cowork) | כל שעה, דקה 19 | הפרומפט בטריגר; הכללים ב-`cowork-queue.md` | Cowork, קשור למחשב של מיכאל |

שיחות "לא לארכב": ארבע השיחות בעמודה האחרונה. Routine יורה לתוך שיחה, וארכוב שלה עוצר אותו.

### Cowork
- **משימה מתוזמנת** "תור משימות מ-Claude Code" (למעלה). רצה רק כשהמחשב של מיכאל דלוק ואפליקציית Claude פתוחה. הפרומפט המלא: `get_trigger` על המזהה, או `cowork-queue.md`.
- **תור המשימות:** ארטיפקט פרטי `https://claude.ai/artifact/8YG6U1r72asze2EFHxz4db`, אוסף `cowork_tasks`, ו-assets (קבצים להעלאה). להעברה: ארטיפקט חדש, ולעדכן את הכתובת ב-`cowork-queue.md` ובפרומפט של המשימה. **לא לשתף אותו** (מי שכותב בו מאשר משימות).

### Connectors (claude.ai > Settings > Connectors)
Microsoft 365 (קריאה: מייל, OneDrive, יומן, Teams), Supabase (`execute_sql` על `znhjtpcltrxxyfjczgvw`), Cloudflare Developer Platform, GitHub (repos `tfugen-safety` ו-`michael-skills`), Claude Docs. בחשבון חדש: לחבר את כולם, ולאשר את GitHub App על שני ה-repos.

### Skills של החשבון
הכול ב-repo הפרטי `mishaf1988-lgtm/michael-skills` (plugin, מסונכרן לחשבון לבד; `project-files/claude-ai-skill/README.md`). להעברה: להתקין את ה-plugin בחשבון החדש.

### סביבת הענן של Claude Code
סביבה `env_016FAHJNzmeY9hnaYA4JDs5e`. משתנה סביבה: `ROUTINE_KEY` (אותו ערך כמו ב-Cloudflare; בלעדיו ה-Routines נופלים ל-`execute_sql` שמחכה ללחיצה). להעברה: סביבה חדשה עם המשתנה, ולפתוח בה את השיחות העובדות מחדש.

---

## 2. Microsoft 365 (sviva@tapugan.co.il)

### Power Automate (https://make.powerautomate.com)
פירוט מלא, ביטויים ולקחים: `project-files/power-automate-mail.md`.

| זרימה | טריגר | מה עושה |
|---|---|---|
| קבצים מספקים לנכנס מהמייל | מייל חדש עם קובץ (תיבת דואר נכנס) | כל שולח חוץ מ-11 מוחרגים ו"הזמנת קניה"; שומר קבצים מצורפים (בלי תמונות, וידאו, ics, zip) ב-`_נכנס מהמייל` |
| קבצים ממייל לפי בקשה | קובץ חדש ב-`_בקשות מהמייל` | קורא מזהה מייל מהקובץ, Get email (V2), שומר את הקבצים המצורפים ב-`_נכנס מהמייל` |

להעברה: לבנות מחדש לפי `power-automate-mail.md` (Claude בכרום עשה את זה ב-11/10/2026). החיבורים: Office 365 Outlook ו-OneDrive for Business של החשבון, בלי אישור מנהל.

### תיקיות ש-אוטומציה תלויה בהן (OneDrive, `שולחן העבודה\ניהול בטיחות`)
| תיקייה | מי כותב | מי קורא |
|---|---|---|
| `_נכנס מהמייל` | זרימות 1 ו-2 | `routine-mail-filing`, `od_move` |
| `_נכנס מהמייל\לא לתיוק` | `od_move` | `backup-od` (מוחק אחרי 30 יום) |
| `_בקשות מהמייל` | `mail_request` (השרת) | זרימה 2 |
| `00_דוחות ומעקב\קטלוג מסמכים.xlsx`, גיליון Claude Log | Cowork | מיכאל |
| `Apps/Tapugan Safety/_Backups` (cron, monthly, photos, talks) | `backup-od` | שחזור |

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
| `GH_SKILLS_TOKEN` | המייל השבועי קורא את תור העוזר ב-michael-skills |
| `GEMINI_API_KEY`, `GEMINI_MODEL`, `TTS_MODEL`, `TTS_VOICE` | הקראה בקול |
| `META_ACCESS_TOKEN`, `META_PHONE_NUMBER_ID`, `META_WABA_ID` | וואטסאפ |
| `RESEND_KEY`, `RESEND_FROM` | מייל גיבוי |
| `VITRE_API_KEY_ID`, `VITRE_API_KEY_SECRET`, `VITRE_NOTIFY_CREATED_BY`, `VITRE_NOTIFY_ENABLED`, `VITRE_PHOTO_KEY`, `VITRE_PHOTO_TEMPLATE` | Vitre |
| `ALLOWED_COUNTRIES`, `ALLOWED_ORIGINS`, `SUBREQ_LIMIT` | הגבלות |

Worker נפרד: `tapugan-backup-cron` (`workers/backup-cron.js`), גיבוי יומי לבאקט ב-Supabase. סודות שלו: `SUPABASE_SERVICE_KEY`, `MANUAL_KEY` (רק להפעלה ידנית של `/run`; שום אוטומציה לא משתמשת בו. הערך הישן היה גלוי ב-`INFRA-2026-05-06.md` עד 11/10/2026, הוסר מהקובץ ונשאר בהיסטוריית git: להחליף ב-Cloudflare).

---

## 4. Supabase (`znhjtpcltrxxyfjczgvw`)

הסכמה: `migrations/*.sql` ב-repo. **pg_cron** (נמדד 11/10/2026, שעות UTC):

| job | מתי | מה |
|---|---|---|
| `backup-od` | 03:30, 04:30 | גיבוי ל-OneDrive, וניקוי "לא לתיוק" |
| `vitre-sync` | 03:00, 04:00 | סנכרון Vitre |
| `xlsx-gaps` | 03:05 | פערים מול ה-Excel |
| `od-scan` | 02:50 | קבצים חדשים בתיקיית הבטיחות |
| `weekly-digest` | א' 04:00, 05:00 | המייל השבועי |
| `talk-week` | א' 02:17 | שיחת הבטיחות השבועית |
| `anon-users-cleanup` | א' 02:13 | ניקוי משתמשים אנונימיים |
| `db-columns-check` | 1 לחודש 02:41 | שינויי עמודות |
| `hazard-file-retry`, `trustee-log-retry` | כל 15 דק' | ניסיון חוזר לתיוק |

ה-jobs קוראים לשרת עם `TRUSTEE_NOTIFY_SECRET` (שמור ב-Supabase Vault / בגוף ה-job). להעברה: להריץ את ה-migrations שיוצרים אותם (`grep -l "cron.schedule" migrations/`).

### מחשב העבודה ב-Azure (חשבון פרטי של מיכאל, לא של תפוגן)
- **חשבון:** חשבון Microsoft פרטי על ה-Gmail של מיכאל, Default Directory, "Azure subscription 1" (ניסיון, 13/10/2026; הקרדיט נגמר בערך 12/11/2026). מנהלים מפרופיל הכרום "Azure פרטי".
- **משאבים** ב-`tapugan-claude-rg`, Israel Central: המחשב `tapugan-claude` (Standard_B2als_v2, Windows Server 2022 Azure Edition smalldisk, משתמש `michael-vm`), דיסק 64GB, IP ציבורי קבוע `tapugan-claude-ip`, `tapugan-claude-nsg` (RDP רק מהכתובת של מיכאל), VNet `vnet-israelcentral-1`. תקציב `tapugan-claude-budget`, 15 דולר.
- **בלי כיבוי אוטומטי** (לא זמין באזור): Stop אחרי כל שימוש. התכנון וההחלטה: `work-vm-plan.md`, `work-vm-setup.md`, `work-vm-trial.md`.
- **להעברה:** אין מה להעביר מה-repo. מחשב חדש לפי `work-vm-setup.md`. הסיסמה אצל מיכאל בלבד.

### אפליקציות GitHub (חשבון mishaf1988-lgtm, Settings, Applications; נבדק 13/10/2026)
- **בשימוש:** Claude (העבודה על הקוד מהשיחות), Claude Design Import, Cloudflare Workers and Pages (פריסה מ-main).
- **הוסר 13/10/2026:** Cursor (לא בשימוש, כתיבה לכל המאגרים, ביקש 7 הרשאות נוספות), Vercel (הפרויקט נמחק 21/09/2026), Netlify (מושהה). Cursor ו-Netlify Auth גם מ-OAuth (C12).
- **Authorized GitHub Apps** (התחברות, לא התקנה): גם ChatGPT Codex Connector, Copilot Chat App, Copilot SWE Agent, Manus Connector. **OAuth Apps:** Cloudflare, Supabase, Resend, DigitalOcean, Ollama, GitHub CLI, Git Credential Manager, GitHub iOS. מיכאל השאיר אותם (13/10/2026); לא בשימוש של המערכת הזו.
- אפליקציה חדשה עם גישה לקוד נרשמת כאן באותו PR.

---

## 5. בדיקה אחרי העברה
1. `list_triggers`: כל השורות בטבלה בסעיף 1, `enabled`.
2. `bash project-files/routine-db.sh '{"op":"select","table":"docs","query":"select=id&limit=1"}'` יוצא 0.
3. מייל עם PDF מספק: תוך דקות ב-`_נכנס מהמייל`.
4. `select jobname from cron.job`: כל השורות בסעיף 4.
5. המייל של יום ראשון מגיע, ושורת "תקין" בתחתית מונה את כל הסוכנים.
