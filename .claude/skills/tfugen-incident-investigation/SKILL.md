---
name: tfugen-incident-investigation
description: Use when investigating a work accident, incident or near miss in the tfugen-safety app (ISO 45001 10.2) - the investigation modal (5-Why, root cause, CAPA task, open NCR), the close gate of an incident, the 5-Why AI prompt, or the investigation Word document the assistant builds. Covers direct cause before root cause, 5-Why that ends at a system cause, CAPA with owner and date, a success criterion, and the target by priority, and points to tfugen-ncr-writing for the wording rules instead of repeating them.
---

# חקירת אירוע (ISO 45001 10.2)

הניסוח (תיאור, סיבת שורש, פעולה מתקנת, בלי האשמה, קריטריון הצלחה, יעד לפי עדיפות) נמצא ב-skill `tfugen-ncr-writing` וחל גם על תחקיר אירוע, כמעט תאונה ו-5 למה (שם, "ניסוח בלי האשמה", 08/11/2026). כאן רק מה שמיוחד לאירוע: איפה זה במערכת, הסדר, ומה חוסם סגירה.
התהליך המלא של תאונה (תיקייה, 250, קובץ מנוהל, `inc_add`, מעקב): `project-files/domains/accidents.md` ו-`project-files/assistant/accidents.md`. כל כללי הענף: `project-files/domains/rules/accidents.md`.

## איפה זה במערכת
- **טבלאות:** `inc` (תאונות ואירועים) ו-`near_miss` (כמעט ונפגע, התראה מיידית `/api/trustee-notify`, DECISIONS 21/09/2026). שדות החקירה ב-`inc`: `five_why` (ניתוח 5 למה), `rc` (סיבת שורש; עמודה משלה מ-29/09/2026, כי `r` הוא מהות הפגיעה וכתיבה אליו דרסה אותה), `p` (פעולות מתקנות), `sv` חומרה, `ty` סוג.
- **חלון "חקירת תקרית"** (`m-inv` ב-`index.html`, B1 18/09/2026): בחירת תקרית, עובדות (`_invPick`), 5-Why עם כפתור AI (`_invAI` -> `_incFiveWhyGenerate`), "סיבת שורש - סיכום" (`inv-rc`), ואז:
  - `_invSave`: שומר `five_why` ו-`rc` (5-Why ריק = לא נשמר).
  - `_invCapa`: משימה מקושרת (`openTskModal('inc', id)`, `source_table` = `inc`).
  - `_invNcr`: פותח NCR עם התיאור, סיבת השורש, תאריך האירוע ו-5-Why בהערות. ממשיכים לפי `tfugen-ncr-writing`.
- **בדיקות:** `tests/harness/inv-test.js` (החלון), `inc-close-test.js` (שער הסגירה), `inc-missing-test.js`.

## הסדר
1. **עובדות קודם:** מה קרה, איפה, מתי, מי נפגע ובמה, מהמקור (מייל משאבי אנוש, 250, תיאור של מיכאל). שדה בלי מקור נשאר ריק, ומה שחסר נכתב בהודעה (`assistant/accidents.md` 3; לקח 277: לא ממציאים חומרה או יעד).
2. **סיבה ישירה, ואחריה סיבות שורש** (`domains/accidents.md` 7, `tools/investigation-doc.py`: "direct cause first, then root causes"). לקח 274: הסיבה הישירה חסרה בתחקיר.
3. **5 למה:** כל "למה" שואל על התשובה הקודמת, והאחרונה היא שורש מערכתי (נוהל, הדרכה, פיקוח, ציוד, תכנון), לא "טעות אנוש" (`tfugen-ncr-writing`, "סיבת שורש"). ה-AI מקבל תאריך, תיאור, סוג, חומרה, מיקום וסיבה קיימת, ותיאור דל מחזיר "אין מספיק פרטים" (`_AI_FW_RULE`, `_aiThin`).
4. **סיבת שורש בשורה אחת** ב-`rc`. ה-AI מציע את השורה האחרונה של ה-5-Why רק כשהשדה ריק; לערוך לפני שמירה.
5. **CAPA:** פעולה מיידית נפרדת מפעולה מתקנת; כל פעולה עם מה, מי ועד מתי, על הפריט בשמו (`tfugen-ncr-writing`, "פעולה מתקנת").
   - פעולה מתקנת מתחקיר נכנסת ל-`tour_hazards` (`thz_add`, `src` = `investigation`) **בניסוח זהה מילה במילה** לתחקיר ול-`inc.p`, רק מפגע או נוהל, לא הדרכה (DECISIONS 29/10/2026; לקחים 277 ו-202 ב-`tfugen-dev/references/lessons.md`). "מיידי" = יום התחקיר; "להשלמה" = `due` ריק והמילים ב-`notes`.
   - נוהל שמנהל המחלקה כותב = `task_add` על התאונה, לא `thz_add` (03/11/2026).
6. **קריטריון הצלחה:** כמו ב-NCR, "איך יודעים בעוד 30 יום שזה עבד" (`tfugen-ncr-writing`). שדה ייעודי לזה ב-`inc`: לא נמצא ב-repo, להשלים.
7. **יעד לפי עדיפות:** ב-NCR קריטי 1 יום, גבוהה 7, בינונית 30, נמוכה 60 (#1064, `tfugen-ncr-writing`). כלל יעד לפי `inc.sv` או מילוי אוטומטי של יעד למשימת CAPA של אירוע: לא נמצא ב-repo, להשלים. עד אז: היעד מהתחקיר, ובלי מקור `due` ריק (לקח 277).

## שער הסגירה (BACKLOG 8, מיכאל 01/10/2026)
- אירוע **חדש** נסגר רק עם חקירה (`rc` או `five_why`, `_incInvestigated`) **ומשימה מתקנת מקושרת** (`_incCloseGap`). אירועים שכבר נסגרו נשארים, ומופיעים ברשימת העבודה (`_incTodo`).
- משימה שסוכן הוסיף (`tsk-`, `task_add`) נספרת רק כשהיא "הושלם", כדי שמייל לא יפתח את השער במשימה ריקה (03/11/2026, סקירת אבטחה, `_incCloseTasks`).
- בדוח ISO 10.2: תאונה מהשנה האחרונה בלי סיבת שורש ובלי 5 למה = צהוב עם המספר, לא אדום (DECISIONS 30/09/2026).

## מסמך התחקיר (Word) מול האפליקציה
- **במסמך התחקיר שהעוזר בונה: בלי סעיף 5 למה ובלי "המלצה שלי"** (`assistant/accidents.md` 3, `tools/investigation-doc.py`). ה-5-Why חי באפליקציה (`inc.five_why`), לא בטופס 32.02 כפי שמיכאל ממלא אותו.
- אין חובה לחתום; "מאושר" = מיכאל אישר את הנוסח (`assistant/accidents.md`).
- בניית המסמך (טופס מבוקר, לוגו, RTL, Word וגם PDF): skill `tfugen-hebrew-docs`.
- **בוואטסאפ ובהודעות:** תאריך ומחלקה, בלי שם העובד ובלי פרט רפואי (`domains/accidents.md` 9).

## כשמשנים את ה-prompt של 5-Why
- כמו ב-NCR (`tfugen-ncr-writing`, "כשמשנים prompt של AI"): להעביר את ההקשר מהטופס, לאסור ניסוח כללי, "רק תווי מקלדת", לבדוק את מה שנשלח בבדיקה (`inv-test.js` עם AI מדומה).
- כלל "ניסוח בלי האשמה" חל גם על 5 למה: נסגר 28/11/2026. ה-prompt של `_incFiveWhyGenerate` כולל את אותו משפט מילה במילה כמו `_ncrAIRcAction`, ו-`ncr-ai-prompt-test.js` נועל ששני הפרומפטים מכילים אותו.
- המודל ב-`_incFiveWhyGenerate`: `llama-3.3-70b-instruct-fp8-fast`.

## מה לא נמצא ב-repo
- קריטריון הצלחה ואימות אפקטיביות לאירוע (שדה, תאריך בדיקה): לא נמצא ב-repo, להשלים.
- יעד לפי עדיפות או חומרה לאירוע ולמשימת CAPA שלו: לא נמצא ב-repo, להשלים.
- נוהל חקירה ל-`near_miss` (5 למה, סיבת שורש) מעבר לקישור ל-NCR בטקסט (`nm.notes`, `domains/rules/ncr.md`): לא נמצא ב-repo, להשלים.
