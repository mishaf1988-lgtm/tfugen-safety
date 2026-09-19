# Test harnesses (Chromium headless + node/python unit tests)

כל קובץ כאן הוא הוכחה שהתכונה עובדת: מרנדר את `index.html` האמיתי ב-Chromium headless
(375px, רשת חסומה), או מריץ את קוד השרת/הכלים האמיתי עם `fetch`/`requests` מדומים.
נכתבו בסשן 2026-09-18/19 (PRs #535–#577) ורצו ירוק על `main` בסיום.

```
npm i -g playwright            # פעם אחת (הדפדפנים: npx playwright install chromium)
bash tests/harness/run.sh      # הכל
bash tests/harness/run.sh trustee   # רק הנאמנים
```

| קובץ | מה מוכיח |
|---|---|
| trustee-t1-test.js | חיווט `trustee_reports`, קטלוג 8 המשימות, ניקוד לפי המסמך |
| trustee-t2-test.js | מסך הנאמן: הסבר, חודש, מי מוביל, טופס סיור (משימות × פריטים), סגירה «צלם אחרי», pull |
| trustee-t3-test.js | מסך המנהל: פילים, לוח ניקוד, ממצאים, ⋯ (נסגר/פתח/משימה/הערה), CSV, היום |
| trustee-roster-test.js | רשימת הנאמנים: עורך המנהל, בוררים, לוח כולל 0 |
| notif-trustee-test.js | הגדרות התראות: שורת «ליקוי מנאמן», יעדים, «שלח בדיקה», toast ב-realtime |
| trustee-notify-test.mjs | הפונקציה `functions/api/trustee-notify.js` עם fetch מדומה (24 בדיקות) |
| sw-cache-test.mjs | ה-service worker האמיתי מ-`functions/sw.js.js`, רץ ב-global מדומה: install/activate, מעטפת מהמטמון בלי להמתין לרשת, אופליין, מה שלא נוגעים בו, ודיפלוי שמגיע למשתמש |
| console-quiet-test.js | הקונסול שקט: אין `console.log`/`console.info` חשופים, `dlog()` כבוי כברירת מחדל, `tfgnDebug(true)` / `?debug=1` מדליקים, והדשבורד נטען בלי חריגות בשני המצבים |
| home-button-test.js | כפתור 🏠: קיים ומחזיר הביתה מ-6 עמודים, הלוגו עושה אותו דבר ומסמן זאת, השורה לא גולשת ב-360–768px, המונה עובר בין 📝 ל-☰, ובמצב נאמן השורה נשארת נקייה |
| vm-notifier-test.py | `tools/vm-notifier/notify.py` עם requests/מיילר מדומים |
| offline-photo-test.js | תור תמונות אופליין: תמונה שנכשלה נשמרת ב-IndexedDB, הדיווח נשמר עם סימון `pending:`, ובחיבור הבא התמונה עולה והסימון מוחלף בכל מקום |
| outbox-race-test.js | `_obDrain` האמיתי: פעולות שנכנסו בזמן העלאה שורדות |
| sbsync-test.js | `sbSync`/`_sbMergePull` האמיתי: שרת = מקור אמת, outbox שורד |
| emp-topbar-test.js, login-label-test.js | טופ-בר נקי במצב נאמן, תווית הכניסה |
| home/nav/roles/print/modules/agents/eqi*/density/inv/ncr-* | רגרסיות של סבב ה-handoffs (#535–#558) |
