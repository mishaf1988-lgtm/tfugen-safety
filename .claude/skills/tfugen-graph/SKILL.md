---
name: tfugen-graph
description: Code map of the tfugen-safety server files (functions/) with Graphify - who calls a function, who imports a module, the path between two functions. Structural only (AST), no model and no key, nothing leaves the container. Load when a change in functions/ needs every caller or importer, before renaming or changing the signature of a shared server helper. Not for index.html (Graphify does not read it; use grep and tfugen-ref).
---

# Graphify לקבצי השרת

נוסף 01/11/2026 (מיכאל בשאלון: "בצע: להוסיף רק לשרת"; DECISIONS 01/11/2026). נמדד באותו יום: 64 קבצים, 1,796 צמתים, 25 שניות. `index.html` לא נקרא בכלל (0 צמתים), ולכן רק לשרת. בשאלה "מי קורא ל-`readRecipients`" הוא מצא בדיוק מה ש-`grep` מצא, ובנוסף את שם הפונקציה הקוראת (`makeLink` ב-`talk.js`).

## הפעלה (פעם אחת בשיחה)
```bash
G=<scratchpad>/graph   # נתיב מלא לתיקיית הסקראץ' של השיחה, לא המאגר
python3 -m venv $G/venv && $G/venv/bin/pip install -q graphifyy
mkdir -p $G/src && cp -r functions $G/src/ && cd $G/src && $G/venv/bin/graphify update .
```
- הגרף נבנה על **עותק** בסקראץ', כדי ש-`graphify-out/` לא ייכנס למאגר.
- רק `update` (קוד, AST). **לא** `/graphify` המלא ולא הסקיל שמגיע עם החבילה: הוא מעבד מסמכים דרך מודל (Gemini אם יש מפתח, אחרת סוכנים), ובמסמכים יש פרטי עובדים. לא `add <url>` ולא `clone`.
- שינית קוד בשרת: `$G/venv/bin/graphify update .` שוב על עותק טרי.

## שאלות
- מי משתמש בפונקציה: `graphify explain "readRecipients"` (מ-`$G/src`). `--all` לכל הקשרים.
- הדרך בין שתיים: `graphify path "functions_api_hazard_report_onrequest" "parseRecipients"`. שם שחוזר בכמה קבצים (`onRequest` ב-41) = "Ambiguous" עם רשימת מזהים; לשים את המזהה (`functions_api_<file>_<name>`).
- תמיד לאמת ב-`grep -rn` לפני "אין קורא נוסף": הגרף לא רואה קריאה דינמית (`env[x]`, `import()` במחרוזת) ולא את `index.html` שקורא לשרת ב-`fetch`.
