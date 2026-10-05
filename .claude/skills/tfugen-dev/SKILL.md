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
- [ ] טקסט שעובדים קוראים בשפה אחרת (`LANGS` ב-`talk.js`): כל מפתח בכל שפה, כולל הודעות שגיאה. נבדק ב-`talk-test.mjs` ("every language has every word").

## במחשב של מיכאל (Windows, 05/10/2026)
- `python3` שם הוא ה-stub של Microsoft Store (מדפיס "Python", exit 49), ו-Claude Code מתייחס ל-exit שאינו 0 או 2 כשגיאה שלא חוסמת. כלומר **כל hook של ה-repo כבוי בשקט** עד שיש `python3` אמיתי ב-PATH (`python3 --version` מחזיר מספר גרסה). בדיקה מהירה בתחילת שיחה במחשב.
- אין `node` ואין `jq`: ב-`tests/harness/` רצות רק בדיקות ה-Python; `ci-wait-test.py` צריך `jq` (ה-`gh` המזויף שלו קורא לו). ה-JS רץ ב-CI.
- `gh` לא מחובר; `git push` עובד דרך Git Credential Manager. נתיב Windows ב-`git show origin/main:<path>` צריך `MSYS_NO_PATHCONV=1`.

## Anti-patterns (אל תעשה)
- ❌ הוספת build step / webpack / vite
- ❌ framework חדש (React/Vue/etc)
- ❌ עברית raw ב-`index.html` JS strings
- ❌ יצירת קובץ HTML נוסף - הכל ב-`index.html`
- ❌ שליחת `''` לעמודת date
- ❌ duplicate code - השתמש ב-askDel/showView הקיימים
