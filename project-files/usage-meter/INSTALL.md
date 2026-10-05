# מד שימוש בכל מקום (05/10/2026)

מיכאל: "בכל פלטפורמה של המחשב שאני פותח באפליקציה של קלוד, זה צריך לעבוד".

**העובדה שקובעת את הפתרון:** צ'אט, Cowork, Code והאפליקציה במחשב מושכים מאותה מכסה (5 שעות ושבוע), והעמוד הרשמי `claude.ai/settings/usage` מראה אותה. אי אפשר להוסיף רכיב לממשק של אפליקציית Claude (לפי התיעוד, status line ו-mods מצוירים רק בטרמינל), ולכן השכבה שעובדת בכל מקום היא חלון קטן משלנו, מעל כל החלונות.

| שכבה | איפה רואים | מה רואים | קובץ |
|---|---|---|---|
| 1. חלון שימוש מוצמד | **כל מסך במחשב**: צ'אט, Cowork, Code, דפדפן | מכסת 5 שעות ושבוע, מהעמוד הרשמי | `usage-window.ps1`, `install.ps1` |
| 2. status line | Claude Code בטרמינל (ובאפליקציה, אם היא מציגה: לבדוק) | טוקנים, אחוז הקשר, עלות, מכסות | `statusline.py` |
| 3. מד הטוקנים (mod) | Claude Code בטרמינל | הפס המלא + `/tokens` | `.claude/skills/token-meter/` |
| 4. שורה מתחת לכל תשובה | שיחות Claude Code בענן (באפליקציה / בדפדפן) | גודל ההקשר ומספר קריאות | `usage-line.py` |

בצ'אט רגיל ובשיחות Cowork אין hooks, ולכן אין שם מספר לכל שיחה, רק השכבה 1 (המכסה הכוללת, שהיא מה שנגמר).

## ההודעה להדבקה בשיחת Claude Code במחשב (בתיקייה tfugen-safety)

```
קרא את CLAUDE.md ואת project-files/usage-meter/INSTALL.md, ובצע את 4 השכבות לפי הסדר, עם הבדיקה של כל אחת. מה שלא עובד: לתקן ולבדוק שוב, לא לדלג. בסוף: PR עם התוצאות, ולרשום ב-STATUS מה עבד ואיפה.
```

## שכבה 1: חלון שימוש מוצמד (הכי חשובה)

```powershell
powershell -ExecutionPolicy Bypass -File project-files\usage-meter\install.ps1
```
- מיכאל בחר (05/10/2026): **עולה לבד בכל הפעלה, בלי פורט דיבאג** (פורט כזה נותן לכל תוכנה במחשב שליטה בחלון המחובר לחשבון). ביטול ההפעלה האוטומטית: למחוק את הקיצור.
- בפעם הראשונה החלון מבקש להתחבר ל-claude.ai (פרופיל Edge נפרד, `%LOCALAPPDATA%\ClaudeUsageWindow\profile`). מיכאל מתחבר פעם אחת.
- **בדיקה:** (א) חלון קטן בפינה הימנית התחתונה עם "Current session" ו-"Weekly limits"; (ב) נשאר מעל האפליקציה של Claude כשלוחצים עליה; (ג) שולחים כמה הודעות בצ'אט ובודקים אם האחוז בחלון עולה לבד, או רק אחרי F5 (לרשום את התשובה); (ד) אחרי הפעלה מחדש של המחשב החלון עולה לבד.
- **אם האחוז לא מתעדכן לבד:** F5 בחלון. **לא** להוסיף פורט דיבאג או תוסף בלי לשאול את מיכאל (הוא בחר בלי פורט).
- **אם (ב) נכשל:** `SetWindowPos` עם `HWND_TOPMOST`. אפשר גם PowerToys Always On Top (Win+Ctrl+T).
- ביטול: למחוק את `Claude usage.lnk` מתיקיית Startup ולסגור את החלון.

## שכבה 2: status line בכל שיחה של Claude Code במחשב

להעתיק את `statusline.py` ל-`%USERPROFILE%\.claude\statusline.py`, ולהוסיף ל-`%USERPROFILE%\.claude\settings.json` (רמת המשתמש, כל תיקייה):
```json
"statusLine": { "type": "command", "command": "python3 \"%USERPROFILE%\\.claude\\statusline.py\"" }
```
(אם `%USERPROFILE%` לא מתפרש, נתיב מלא.) **בדיקה:** שיחה חדשה בטרמינל, שורה "📊 ... טוקנים | הקשר ..%" למטה. **לבדוק גם בלשונית Code באפליקציה** ולרשום אם מוצג.

## שכבה 3: מד הטוקנים כפלאגין ברמת המשתמש

הקוד ב-`.claude/skills/token-meter/` (mod: `hooks/hooks.json` עם `modules`). היום הוא לא מותקן בשום מקום, ולכן `/tokens` לא מוכר (לקח 53). להתקין ברמת המשתמש לפי התיעוד העדכני (`/plugin`, או marketplace מקומי + `appendPlugins` ב-settings של המשתמש; לשאול את claude-code-guide). **בדיקה:** שיחה חדשה בתיקייה אחרת, `/tokens` מוכר והפס מופיע.

## שכבה 4: שורת שימוש בשיחות בענן

להוסיף ל-`.claude/settings.json` של ה-repo, ב-`Stop`, hook נוסף (שינוי hooks רק במחשב, לקח 42):
```json
{ "type": "command", "command": "python3 \"$CLAUDE_PROJECT_DIR\"/.claude/hooks/usage-line.py" }
```
ולהעתיק את `usage-line.py` ל-`.claude/hooks/`, ואת `test_usage_meter.py` ל-`tests/harness/usage-meter-test.py` (לעדכן בו את הנתיבים). **בדיקה:** שיחה חדשה בענן, ובסוף כל תשובה מופיע "📊 שיחה: הקשר ...". אם האפליקציה לא מציגה `systemMessage`: לרשום, ולהציע חלופה (Claude כותב את השורה, וה-hook רק מוודא).

## בדיקות שכבר רצו (בענן)
`python3 project-files/usage-meter/test_usage_meter.py`: 8 מ-8, ושתי שבירות מכוונות נתפסו. שכבה 4 נבדקה על transcript אמיתי של שיחה ארוכה. את סקריפטי ה-PowerShell אי אפשר להריץ בענן: הם נבדקים רק במחשב.
