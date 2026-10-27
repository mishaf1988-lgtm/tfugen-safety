---
name: tfugen-dev
description: Use when developing features for the TFUGEN Safety Management System (tfugen-safety repo). Enforces project-specific conventions - single-file HTML app, Hebrew text as \uXXXX unicode escapes, Supabase integration with 17 tables, empty-dates-to-null rule, and the askDel + showView + VIEW_CONFIG pattern. Trigger when editing index.html, ncr-agent.js, api/claude.js, or adding new agents/modules/views to the safety system.
---

# TFUGEN Safety — Development Skill

## פרויקט Overview
- **Repo**: `mishaf1988-lgtm/tfugen-safety`
- **Live**: https://tfugen-safety.vercel.app
- **Architecture**: Single-file HTML app (`index.html`) + Vercel serverless API (`api/claude.js`) + Supabase backend (17 tables)
- **Language**: JavaScript vanilla, no build step, no framework

## חוקי פיתוח קריטיים (Critical Dev Rules)

### 1. Single-file HTML
- כל ה-UI וה-logic נמצא ב-`index.html` אחד
- אין build step, אין bundler
- מודולים נפרדים כמו `ncr-agent.js` נטענים כ-`<script src>`

### 2. Hebrew as Unicode Escapes
- **חובה** לכתוב עברית כ-`\uXXXX` ולא כתווים גולמיים
- דוגמה: `'\u05e7\u05e8\u05d9\u05d8\u05d9'` במקום `'קריטי'`
- המר עברית ב-JS/HTML inline strings. הערות רגילות יכולות להישאר.
- סקריפט המרה: `node -e "console.log([...'טקסט'].map(c=>'\\\\u'+c.charCodeAt(0).toString(16).padStart(4,'0')).join(''))"`
- **אימוג'י שברירת המחדל שלו טקסט** (🗑 🖨 👁 🌡 🗣) בכפתור: תמיד עם `\ufe0f` אחריו (`'\ud83d\uddd1\ufe0f'` או `&#128465;&#65039;`). בלעדיו כרום במחשב מצייר סמל טקסט בצבע הכפתור, והטלפון אימוג'י צבעוני. נאכף ב-`emoji-presentation-test.py` (14/10/2026, BACKLOG 13.22).

### 3. Empty Dates → null
- אל תשלח מחרוזת ריקה `''` לעמודת date ב-Supabase
- תמיד: `date_field: value || null`

### 4. Pattern: askDel + showView + VIEW_CONFIG
- מחיקות: השתמש בפונקציה הגלובלית `askDel(id, table, callback)`
- ניווט views: `showView(viewName)`
- הגדרת view חדשה: הוסף entry ל-`VIEW_CONFIG` object
- אל תיצור modals/forms custom - השתמש בתבניות הקיימות

### 5. Supabase Conventions
- Base URL: `https://znhjtpcltrxxyfjczgvw.supabase.co`
- Headers: `apikey` + `Authorization: Bearer <key>`
- 17 טבלאות; אחרי כל שינוי schema - וודא שכל ה-17 מחזירות `200 OK`
- Key table: `ncr` (375 records)
- **פונקציית שרת (`functions/api/*.js`): כל `fetch` החוצה עם `signal: tmo(...)`** מ-`_shared.js` (16/10/2026, BACKLOG 14.12): `SB_TIMEOUT_MS` 10 שניות למסד, `GRAPH_TIMEOUT_MS` 20 ל-Graph, `FILE_TIMEOUT_MS` 60 לקובץ שלם. בלי זה שירות תקוע משאיר את הטלפון מסתובב. הקריאה צריכה להיות בתוך `try` שמחזיר תשובה (דף או JSON), כי מגבלה שנגמרת זורקת שגיאה. `fetch-timeout-test.mjs` נועל: קובץ שתוקן נשאר 0, ושאר הקבצים לא עולים מהמספר הרשום ב-`LEFT`.
- **כתובת המסד מ-`env.SUPABASE_URL`, לא כקבוע** (BACKLOG 14.13): בתוך פונקציה `sbFrom(env)` מ-`_shared.js`; קבוע ברמת הקובץ רק כ-`let`, שמוצב מ-`sbFrom(env)` בשורה הראשונה של `onRequest`. קבוע שעוקף את ההגדרה פונה למסד החי גם מגרסת תצוגה. `sb-url-env-test.mjs` נועל.

### 6. AI Agents
- כל agent חדש צריך endpoint דרך `/api/claude`
- מודל: Claude Sonnet/Opus (ראה `api/claude.js`)
- שמור prompts בעברית כ-`\uXXXX`

### 7. שם המפעל וכתובות בשרת = `SITE` (17/10/2026)
שם, חברה, כתובת האתר והמסד, דומיין הכניסה, מיילים ותיקיית OneDrive יושבים רק ב-`functions/_site.js` (המוצר, שלב 1). קובץ ב-`functions/api` מקבל `SITE` / `SB_LIVE` מ-`'../_shared.js'`; קובץ בשורש `functions/` מייבא `'./_site.js'`. ערך חדש של המפעל = שדה חדש ב-`SITE`, לא קבוע בקובץ. `site-config-test.mjs` נכשל על `tapugan`/`tfugen`/`תפוגן`/מזהה המסד מחוץ ל-`_site.js` ו-`_logo.js`.

## Workflow לכל משימה חדשה

1. **קרא STATUS.md** - רק הסעיף «🔔 פתוח עכשיו» (ראה CLAUDE.md, «קרא חכם»)
2. **צור branch**: `routine/TASK-NAME-YYYY-MM-DD`
3. **פתח/ערוך** את `index.html` או module רלוונטי
4. **בדוק local** - פתח index.html בדפדפן
5. **בדיקות סיום**:
   - [ ] כל 17 הטבלאות מחזירות 200 OK
   - [ ] האפליקציה נטענת ללא שגיאות console
   - [ ] עברית מוצגת נכון (לא \uXXXX raw)
6. **עדכן STATUS.md** - פריט שנסגר עובר ל-`project-files/STATUS-archive.md` באותו PR
7. **tag**: `stable-YYYY-MM-DD`
8. **Push + PR**

## Common Patterns

### הוספת View חדש
```js
VIEW_CONFIG['new_view'] = {
  table: 'table_name',
  title: '\u05db\u05d5\u05ea\u05e8\u05ea',  // 'כותרת'
  columns: [...],
  // ...
};
```

### קריאה ל-Supabase
```js
fetch(_SB+'/rest/v1/TABLE?select=*&limit=500',{
  headers:{apikey:_SK, Authorization:'Bearer '+_SK}
})
.then(r=>r.json())
```

### קריאה ל-Claude API
```js
fetch('/api/claude', {
  method:'POST',
  headers:{'Content-Type':'application/json'},
  body: JSON.stringify({prompt: '...', model:'claude-sonnet-4-6'})
})
```

## Verification Checklist (לפני PR)
- [ ] `git diff` - שינויים קטנים וממוקדים בלבד
- [ ] אין עברית raw ב-strings של JS
- [ ] תאריכים ריקים = null
- [ ] אין console.error ב-DevTools
- [ ] STATUS.md עודכן
- [ ] tag נוצר

- [ ] קובץ ב-`functions/` שנערך בסקריפט: לאמת בהרצת הבדיקה שלו (`bash tests/harness/run.sh <שם>`), לא ב-`node --check`. ב-03/10/2026 `node --check` עבר על `talk.js` עם שגיאת תחביר (מודול ESM בקובץ `.js`), ורק `talk-test.mjs` תפס אותה.
- [ ] העלאה ל-Storage עם `x-upsert: false` כדי לזהות כפילות: שם קיים חוזר כ-409, ובגרסאות ישנות של Supabase כ-400 עם `"statusCode":"409"` / `Duplicate` בגוף. לבדוק את שניהם (`isDuplicate` ב-`talk.js`), וקובץ שנשאר בלי שורה (insert שנכשל) לדרוס פעם אחת עם `x-upsert: true`, אחרת העובד נתקע על "כבר חתמת" בלי חתימה (03/10/2026).
- [ ] דיבאג של בדיקת `.mjs`: `_build` נמחק בסוף `run.sh`, ו-`run.sh <שם>` מציג רק שורות `✗`. להדפיס ערך ביניים עם `console.log('  ✗ DBG ' + ...)` ולהסיר. בדיקה שמחפשת פרמטר ב-HTML (`t=1`): לחפש עם `&amp;` לפניו; `/t=1/` תפס `height=180` (05/10/2026).
- [ ] נתוני דמה בבדיקות כמו בשטח: תיאור NCR של משפט, הדרכה שפורסמה עם מדריך. ב-05/10/2026 שומר חדש (תיאור קצר מ-8 תווים, מדריך חובה לפרסום) שבר 5 בדיקות ישנות שהשתמשו ב"תיאור" / "שמן" ובהדרכה בלי מדריך; זה נמצא רק ב-`run.sh` המלא. שומר חדש: `grep` בבדיקות על הפונקציה, ולתקן את הנתונים, לא את הציפייה.
- [ ] טקסט שעובדים קוראים בשפה אחרת (`LANGS` ב-`talk.js`): כל מפתח בכל שפה, כולל הודעות שגיאה. נבדק ב-`talk-test.mjs` ("every language has every word").

## במחשב של מיכאל (Windows, 05/10/2026)
- `python3` שם הוא ה-stub של Microsoft Store (מדפיס "Python", exit 49), ו-Claude Code מתייחס ל-exit שאינו 0 או 2 כשגיאה שלא חוסמת. כלומר **כל hook של ה-repo כבוי בשקט** עד שיש `python3` אמיתי ב-PATH (`python3 --version` מחזיר מספר גרסה). **תוקן 05/10/2026** (מיכאל אישר): `python.exe` הועתק ל-`python3.exe` בתיקיית Python 3.12, שקודמת ל-stub ב-PATH. בדיקה מהירה בתחילת שיחה במחשב: `python3 --version`; אם חזר ה-stub (התקנה מחדש של Python), להעתיק שוב.
- אין `node` ואין `jq`: ב-`tests/harness/` רצות רק בדיקות ה-Python; `ci-wait-test.py` צריך `jq` (ה-`gh` המזויף שלו קורא לו). ה-JS רץ ב-CI. `run.sh` מלא במחשב: `PYTHONUTF8=1 PYTHONIOENCODING=utf-8 bash tests/harness/run.sh`, אחרת כ-15 בדיקות Python שמדפיסות ✓ נופלות על cp1255 (07/10/2026); הסינון לבדיקות Python: `grep -E "^\S+-test\.py " | grep -v " 0 failed"`.
- `gh` מחובר מ-07/10/2026 (`mishaf1988-lgtm`, keyring), כולל ל-michael-skills הפרטי: `bash .claude/hooks/ci-wait.sh main mishaf1988-lgtm/michael-skills` עבד חי. `merge-gate.py` קורא רק `GITHUB_TOKEN`/`GH_TOKEN` מהסביבה, לא את ה-keyring. `git push` עובד דרך Git Credential Manager. נתיב Windows ב-`git show origin/main:<path>` צריך `MSYS_NO_PATHCONV=1`.

## Anti-patterns (אל תעשה)
- **צבע hex בתוך הגדרת CSS** (12/10/2026, עיצוב מחדש שלב 1): `color:`, `background:`, `border:` וכו' רק דרך `var(--c-*)` מה-`:root`. בתוך מחרוזת JS עם גיבוי: `var(--c-red-650,#cc1f1f)`, כי חלון הדפסה לא רואה את `:root`. canvas, `fillStyle` ו-html2canvas `backgroundColor` לא מקבלים משתנה. נאכף: `color-tokens-test.py`.
- **לשנות `workers/*.js` ולחשוב שזה עלה** (12/10/2026): `tapugan-backup-cron` לא נפרס מ-`main`; מיכאל מדביק ומפרסם בלוח הבקרה של Cloudflare. שינוי שם = צעד ידני שלו, ולכן שווה רק כשהערך מצדיק אותו. רק `functions/` ו-`index.html` עולים לבד.
- **מקום חדש בשרת ששולח מייל או מוחק ב-OneDrive, בלי `graph-writes-test.py`** (14/10/2026, #1502: מייל הסטטוס הוסיף `sendMailTo` שני ב-`hazard-report.js`, ו-CI נפל על זה). כל קריאה חדשה ל-`sendMail`/`sendMailTo` או מחיקה ב-Graph תחת `functions/` מעלה את המספר ב-`APPROVED_SEND`/`APPROVED_DELETE` באותו PR, עם התאריך והאישור של מיכאל בהערה. בלי אישור שלו על השליחה: לא מוסיפים. נאכף: `push-gate.py` מריץ את הבדיקה לפני כל push כשקובץ ב-`functions/` השתנה.
- **עוד לוח חתימה באצבע שנכתב מאפס** (14/10/2026, מיכאל: "בצע את שתי ההצעות"): יש שלושה היום, ושלושתם חוזרים על אותו קוד (`fit`, `pt`, pointerdown/move/up, `touch-action:none`): דף העובד `sigScript` ודף המדריך `trScript` ב-`talk.js`, וחתימת המדריך בטופס ההדרכה `_tbtSigInit` ב-`index.html`. לוח חדש בדף שרת משתמש בתבנית של `sigScript`; באפליקציה: להכליל את `_tbtSigInit` לפונקציה שמקבלת id (ולא להעתיק אותה), ולהעלות דרך `_fileUpload` עם קידומת `sig-<id>-<מי>`. התמונה מהאפליקציה נשמרת כ-JPEG (`_fileUpload` דוחס), ולכן מי שמציג אותה מזהה את הסוג מהבייטים (`storageB64` ב-`talk.js`), לא מניח PNG.
- **סגירה של הדרכה שנתית או איכות = `closed_at`, טופס מתויק = `form_at`** (14/10/2026): עד אותו יום "סגור חתימות" רק העלה `link_v`; מאז op `close`/`reopen` כותב `closed_at`, ו-`isClosed` ב-`talk.js` חוסם דף, חתימה, הקראה וקישור. בדיקה חדשה של "פתוחה" בצד שרת עוברת דרך `isClosed`, לא דרך `link_v` או `s`. מצב "גמור" (יש ראיה) הוא `toolbox_talks.form_at` (נכתב אחרי תיוק 08.01). התראה או דוח על "הדרכות פתוחות" נשען עליו, לא על `link_v` ולא על `s`. כפתור שמוסיפים לחלון שהשרת כתב (תצוגה מקדימה) נוסף בצד האפליקציה עם `@media print` שמסתיר אותו, כדי לא לשנות את ה-HTML שמתויק כ-PDF (`_tbtPvPrint`).
- **סוג הדרכה חדש = לעבור על כל מי שקורא את `toolbox_talks`** (14/10/2026): שנתית ואיכות נוספו בלי מחלקה, ו-`latestTalk` במייל השבועי, שסינן רק קליטה, היה בוחר אותן כ"הדרכה השבועית". מסננים לפי רשימה (`PERM_KINDS` / `TYPED_KINDS` מ-`talk.js`), לא לפי `kind !== 'induction'`, ו-`grep -rn "toolbox_talks" functions/` לפני שמוסיפים סוג.
- **מייל למנהלי מחלקות = `readRecipients(token)` מ-`hazard-report.js`** (14/10/2026): גיליון "נמענים" בחוברת הסיורים הוא המקור היחיד לכתובות המנהלים (חלק 1 אל, חלק 3 עותק). לא לבנות רשימה שנייה. מחלקת עובד (`emp.dep`) עוברת דרך `TBT_DEPTS` ואז `TBT_REPORT` (ב-`talk.js`) למחלקת הדוח. קובץ ב-`functions/api` שמייבא קובץ אח חדש: להוסיף את כלל ה-`sed` שלו בשורה 50 של `tests/harness/run.sh`, אחרת הבדיקות לא נבנות.
- **`sbSync` שולח בתור, לא הכל בבת אחת** (15/10/2026): עד `_SB_POOL` בקשות, `_SB_FIRST` קודם. בדיקה שמחליפה את `sbGet` ב-stub צריכה להשאיר אותו עד שהתור נגמר (המתנה קצרה), אחרת הטבלאות המאוחרות הולכות ל-`sbGet` האמיתי ונראות "לא נשאלו". טבלה חדשה שמסך הבית צריך: להוסיף ל-`_SB_FIRST`.
- **סקריפט מ-CDN בלי `integrity` או בלי גרסה מדויקת** (13/10/2026, BACKLOG 13.13): כל `src` ל-jsdelivr/cdnjs/unpkg מקבל גרסה מלאה (`@4.2.4`, לא `@4`), `integrity='sha384-...'` ו-`crossOrigin='anonymous'` צמודים ל-`src`. ה-hash: `curl -sSfL <url> | openssl dgst -sha384 -binary | openssl base64 -A`. בדיקה שמחליפה את הקובץ בתחליף (`r.fulfill` ל-supabase-js) חייבת להוריד את ה-`integrity` מהתגית, אחרת הדפדפן חוסם את התחליף. חריגים: Turnstile (Cloudflare מעדכן את הקובץ במקום) ו-worker של pdf.js. נאכף: `sri-test.py` (בודק גם מול הקובץ האמיתי כשיש רשת).
- **מספר נייד או כתובת מייל של אדם בקובץ md** (13/10/2026, BACKLOG 13.17): ה-repo ציבורי. לכתוב של מי ("הנייד של מיכאל", "חדווה ממחלקת הרכש") או את הדומיין, את הערך המלא רק במקום שמשתמש בו. תיבת תפקיד חדשה שמותר לכתוב: להוסיף ל-`ALLOWED`. נאכף: `pii-md-test.py`.
- ❌ הוספת build step / webpack / vite
- ❌ framework חדש (React/Vue/etc)
- ❌ עברית raw ב-`index.html` JS strings
- ❌ יצירת קובץ HTML נוסף - הכל ב-`index.html`
- ❌ שליחת `''` לעמודת date
- ❌ duplicate code - השתמש ב-askDel/showView הקיימים

## הלקחים של התחום: `references/lessons.md`

הלקחים של תחום הפיתוח (כ-5,400 מילים) עברו לקובץ נפרד ב-27/10/2026 (מיכאל בשאלון: "בצע: לפצל את שני הגדולים"; המדריך של Anthropic לבניית skills). אותו מבנה ומספור כמו ב-`tfugen-lessons`, ו-`lessons-format-test.py` ו-`lessons-gate.py` קוראים גם אותו. **לפני שינוי באזור:** `grep -n -i "<מילת מפתח>" .claude/skills/tfugen-dev/references/lessons.md`. לקח חדש בתחום הפיתוח נכתב שם, לא כאן.
