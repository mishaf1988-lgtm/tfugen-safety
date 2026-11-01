---
name: tfugen-graph
description: Code map of tfugen-safety (functions/ and the inline scripts of index.html) with Graphify - who calls a function, what it calls, the path between two functions, in a short list instead of hundreds of grep lines. Structural only (AST), no model and no key, nothing leaves the container. Load when a change needs every caller of a function that is used in many places (askDel, showView, a shared server helper), before renaming or changing its signature, or when grep for a name returns more than about 30 lines.
---

# Graphify: מפת הקוד

נוסף 01/11/2026 (מיכאל: "בצע: להוסיף רק לשרת"), והורחב לאפליקציה באותו יום (מיכאל: "אם אפשר איכשהו לייעל את הגרפיפאי, זה גם חיסכון"). DECISIONS 01/11/2026.

## הפעלה: פקודה אחת, כחצי דקה
```bash
bash tools/graph.sh <נתיב מלא לתיקיית הסקראץ' של השיחה>
```
מתקין `graphifyy` (פעם אחת בשיחה), מעתיק את `functions/` ואת הסקריפטים של `index.html` לתיקייה מחוץ למאגר, ובונה גרף (כ-3,150 צמתים). ב-`index.html` כל מה שמחוץ ל-`<script>` מתרוקן שורה בשורה, ולכן **`app/index.js L<n>` = שורה `<n>` ב-`index.html`**, ואפשר לקרוא ישר `Read` עם `offset`.
- רק `update` (AST). **לא** `/graphify` המלא ולא הסקיל שמגיע עם החבילה: הוא מעבד מסמכים דרך מודל, ובמסמכים יש פרטי עובדים. לא `add <url>` ולא `clone`.
- שינית קוד: להריץ שוב את `graph.sh` לפני שאלה נוספת.

## שאלות (מתוך `<dir>/graph/src`)
- מי קורא ומה נקרא: `graphify explain "askDel"`. **ברירת המחדל: 20 הקשרים הראשונים.** לפני שינוי חתימה: `--all`.
- הדרך בין שתיים: `graphify path "<א>" "<ב>"`. שם שחוזר בכמה קבצים ("Ambiguous") = לשים את המזהה מהרשימה (`functions_api_<file>_<name>`, `app_index_<name>`).

## מתי זה חוסך (נמדד 01/11/2026, תווים שחזרו)
| שם | Graphify | grep |
|---|---|---|
| `showView` | 1,426 | 11,155 |
| `askDel` | 661 | 6,572 |
| `stateGet` (שרת) | 291 | 6,633 |
| `_mrNext` | 437 | 208 |
לפונקציה בשימוש רחב, Graphify. לפונקציה עם 1-3 שימושים, `grep` קצר יותר. ההרצה עולה כמה מאות טוקנים, ולכן רק כשצפויות כמה שאלות כאלה בשיחה.

## גבולות
הגרף לא רואה קריאה דינמית (`window[x]`, `onclick="..."` במחרוזת HTML, `env[x]`), ולא את הקריאות מ-`index.html` לשרת (`fetch`). לפני "אין קורא נוסף": `grep -c` על השם, וגם על השם בתוך מחרוזת.
