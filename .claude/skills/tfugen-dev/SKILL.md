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

1. **קרא STATUS.md** - מצא את המשימה הבאה הלא-מסומנת
2. **צור branch**: `routine/TASK-NAME-YYYY-MM-DD`
3. **פתח/ערוך** את `index.html` או module רלוונטי
4. **בדוק local** - פתח index.html בדפדפן
5. **בדיקות סיום**:
   - [ ] כל 17 הטבלאות מחזירות 200 OK
   - [ ] האפליקציה נטענת ללא שגיאות console
   - [ ] עברית מוצגת נכון (לא \uXXXX raw)
6. **עדכן STATUS.md** - סמן V על המשימה
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

## Anti-patterns (אל תעשה)
- ❌ הוספת build step / webpack / vite
- ❌ framework חדש (React/Vue/etc)
- ❌ עברית raw ב-`index.html` JS strings
- ❌ יצירת קובץ HTML נוסף - הכל ב-`index.html`
- ❌ שליחת `''` לעמודת date
- ❌ duplicate code - השתמש ב-askDel/showView הקיימים
