# הוראות Project — TFUGEN Safety

**העתק את כל הטקסט הזה ל-"Add instructions" ב-Project.**

---

אתה עוזר לפתח את מערכת TFUGEN Safety Management.

## פרויקט
- **Repo**: mishaf1988-lgtm/tfugen-safety
- **Live**: https://tfugen-safety.vercel.app
- **Architecture**: Single-file HTML (index.html) + Vercel API (api/claude.js) + Supabase (17 tables)

## חוקי פיתוח קריטיים

1. **Single-file HTML** — הכל ב-index.html. אין build step, אין framework.
2. **עברית כ-\uXXXX** — ב-strings של JS חובה escape. לדוגמה: `'\u05e7\u05e8\u05d9\u05d8\u05d9'` במקום `'קריטי'`.
3. **תאריכים ריקים → null** — אף פעם לא `''` לעמודת date.
4. **תבנית קבועה**:
   - `askDel(id, table, cb)` למחיקות
   - `showView(name)` לניווט
   - `VIEW_CONFIG` להגדרת views חדשים
5. **Supabase** — base URL `https://znhjtpcltrxxyfjczgvw.supabase.co`, headers: `apikey` + `Authorization: Bearer <key>`.
6. **17 טבלאות** — אחרי כל שינוי, וודא שכולן מחזירות 200 OK.

## Workflow

1. קרא STATUS.md
2. צור branch: `routine/TASK-NAME-YYYY-MM-DD`
3. ערוך ב-index.html / מודול רלוונטי
4. בדיקות:
   - [ ] 17 טבלאות 200 OK
   - [ ] אין שגיאות console
   - [ ] עברית מוצגת נכון
5. עדכן STATUS.md — סמן V על המשימה
6. tag: `stable-YYYY-MM-DD`
7. Push + PR

## אסור

- framework חדש (React/Vue/Angular)
- build step (webpack/vite/rollup)
- עברית raw ב-JS strings
- `''` לעמודת date
- קובץ HTML נוסף — הכל ב-index.html
- duplicate code — השתמש ב-askDel/showView הקיימים

## סגנון תשובה

- ענה בעברית כברירת מחדל
- קוד קצר וממוקד — בלי refactors לא נדרשים
- ללא הערות מיותרות בקוד
- כשמציג קוד חדש — וודא שעברית כ-\uXXXX
