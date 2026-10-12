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

### 6. AI Agents
- כל agent חדש צריך endpoint דרך `/api/claude`
- מודל: Claude Sonnet/Opus (ראה `api/claude.js`)
- שמור prompts בעברית כ-`\uXXXX`

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
- **לשנות `workers/*.js` ולחשוב שזה עלה** (12/10/2026): `tapugan-backup-cron` לא נפרס מ-`main`; מיכאל מדביק ומפרסם בלוח הבקרה של Cloudflare. שינוי שם = צעד ידני שלו, ולכן שווה רק כשהערך מצדיק אותו. רק `functions/` ו-`index.html` עולים לבד.
- ❌ הוספת build step / webpack / vite
- ❌ framework חדש (React/Vue/etc)
- ❌ עברית raw ב-`index.html` JS strings
- ❌ יצירת קובץ HTML נוסף - הכל ב-`index.html`
- ❌ שליחת `''` לעמודת date
- ❌ duplicate code - השתמש ב-askDel/showView הקיימים

## לקחים בתחום (הועברו מ-tfugen-lessons, 11/10/2026)

אותו מבנה ואותו מספור כמו ב-`tfugen-lessons` (`lessons-format-test.py` בודק את כל הקבצים יחד). לקח שחל רק על התחום הזה נכתב כאן.

**23. "חדש" שלא מאפס את הטופס (01/10/2026, PR זה).**
מה קרה: "תאונה חדשה" השאיר ערכים מהקודמת.
הכלל: רשומה חדשה דרך פותח אחד שמאפס כל שדה.
נאכף: `inc-close-test.js`; `inc-missing-test.js`.
חזר: 1 (כרטיס הלכידה).

**32. escape שגוי בדרך לקובץ (02/10/2026, #1044).**
מה קרה: פוענח לעברית ב-Edit; אימוג'י 5 ספרות כזבל.
הכלל: סקריפט שממיר בעצמו (`ord(c)>127`, מעל FFFF זוג surrogate), גם בעוגן.
נאכף: hook ה-raw-hebrew, `rule1-hebrew-test.js` (גם 5 ספרות); ב-`functions/` רק assert.
חזר: 2

**65. ייבוא הביא מילים חדשות לשדה, והקוד משווה למילה אחת (07/10/2026, PR זה).**
מה קרה: מרשמי הציוד (04/10) ב"כשיר לעבודה"/"לתקן"; "תקינים" 0 מ-48, ועריכה שמרה "תקין" על "לתקן".
הכלל: אחרי ייבוא: `select distinct` על כל שדה שהקוד משווה אליו, ו-`grep` להשוואות.
נאכף: `eqi-test.js` סעיף 4; `edit-roundtrip-test.js` (עריכה ושמירה בלי שינוי = אין הבדל).
חזר: 2 (10/10: "כשיר לעבודה" בשדה הליקויים הוצג כליקוי; `eqi-nodef-test.js`. 07/10: היבטים סביבתיים, `_selSet`)

**72. טקסט להקראה נשלח כמו שהוא על המסך (10/10/2026, PR זה).**
מה קרה: "הקרא בקול" הקריא "טופס 08.02.01" ו-"2.1.", בקול הרובוטי של הטלפון. מיכאל: "הדיבוב לא טוב כמו רובוט... מקריא מספר טופס".
הכלל: טקסט לשמיעה עובר הכנה (בלי מספרי טופס ומספור שורות, עצירה בסוף שורה), ואיכות הקול נבחנת באוזן לפני שמציעים.
נאכף: `talk-speak-test.mjs` סעיף 1; איכות הקול: טקסט (אין דרך בקוד: נבדקת באוזן).
חזר: 0

**81. תיקון התנהגות של מודל בלי לראות את התשובה שלו (12/10/2026, PR זה).**
מה קרה: "הצע סיבה ופעולה" ב-NCR החזיר "אין מספיק פרטים" לתיאור ברור. ב-#1387 שיניתי את ה-prompt לפי ניחוש, בלי לראות מה המודל ענה (מסלול התשובה הריקה לא רשם כלום), ובדיקת כרום החוזרת נכשלה באותה צורה. הקוד הישן גם קרא רק `parsed.rc` ברמה העליונה, ומשפט לפני ה-JSON או שדות מקוננים נקראו כ"ריק".
הכלל: לפני שינוי prompt בגלל תשובה גרועה: (1) לוודא שמסלול הכישלון רושם את התשובה הגולמית ואת המודל ל-console, (2) לבדוק את הפענוח מול צורות שמודל אמיתי מחזיר (משפט מסביב, רמה נוספת), (3) רק אז לגעת בניסוח. ובעברית: Gemini, לא Llama (DECISIONS 27/09/2026).
נאכף: `ncr-ai-prompt-test.js` סעיף 5 (משפט מסביב, שדות מקוננים, מודל gemini); הרישום ל-console: טקסט.
חזר: 0
