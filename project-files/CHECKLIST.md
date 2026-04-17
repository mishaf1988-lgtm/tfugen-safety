# TFUGEN — Checklist לפני PR

## לפני Commit

- [ ] `git diff` — שינויים קטנים וממוקדים בלבד
- [ ] אין עברית raw ב-strings של JS (הכל `\uXXXX`)
- [ ] כל תאריך ריק הומר ל-`null`
- [ ] הדפדפן פותח את index.html בלי שגיאות console
- [ ] השתמשתי ב-askDel/showView הקיימים (לא יצרתי duplicates)

## בדיקות Supabase (17 טבלאות)

וודא ש-`curl -I` על כל אחת מחזיר `HTTP/1.1 200 OK`:

- [ ] ncr
- [ ] capa
- [ ] incidents
- [ ] expiries
- [ ] audits
- [ ] trainings
- [ ] employees
- [ ] equipment
- [ ] permits
- [ ] risks
- [ ] documents
- [ ] inspections
- [ ] suppliers
- [ ] contractors
- [ ] workorders
- [ ] reports
- [ ] settings

*(עדכן את הרשימה לפי הטבלאות בפועל ב-Supabase)*

## לפני Push

- [ ] עדכנתי STATUS.md — סימנתי V על המשימה
- [ ] שם branch בפורמט `routine/TASK-NAME-YYYY-MM-DD`
- [ ] commit message ברור

## אחרי Push

- [ ] יצרתי git tag: `stable-YYYY-MM-DD`
- [ ] דחפתי tag: `git push --tags`
- [ ] PR פתוח ב-GitHub

## בדיקת Production (אחרי merge)

- [ ] https://tfugen-safety.vercel.app נטען
- [ ] אין שגיאות console
- [ ] המודול ששיניתי עובד
- [ ] לא שברתי מודולים אחרים (smoke test)
