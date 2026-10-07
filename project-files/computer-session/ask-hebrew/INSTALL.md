# התקנה: שאלון במקום שאלה בטקסט + עברית אחרי כלי שנכשל

מיכאל אישר בשאלון, 07/10/2026: "בצע: להכין חבילה למחשב" ו"בצע: תזכורת אחרי כל כלי שנכשל".
בענן אי אפשר לשנות `.claude/hooks/` (לקח 42), לכן החבילה מוכנה כאן ומותקנת בשיחה במחשב.

## מה יש בחבילה
- `hooks/ask-form.py` (Stop): שאלה בטקסט בסוף התשובה, בלי שאלון באותו תור = עצירה אחת עם הסבר (לקח 64).
- `hooks/hebrew-after-fail.py` (PostToolUse + PostToolUseFailure): כלי שנכשל = תזכורת "ההודעה הבאה בעברית" (לקח 13).
- `tests/ask-form-test.py` (8), `tests/hebrew-after-fail-test.py` (9). שבירה מכוונת בענן: 3/3 נתפסו.
- `settings.proposed.json`: `.claude/settings.json` של main מ-07/10/2026 + שלוש רשומות.
- התקנה מדומה בענן (worktree): כל `tests/harness/*.py` ירוקים עם החבילה מותקנת.

## הודעה להדבקה בשיחה במחשב (Local, התיקייה tfugen-safety, branch main)

```
התקן את החבילה project-files/computer-session/ask-hebrew לפי INSTALL.md שלה:
1. git fetch origin main ו-reset --hard origin/main.
2. העתק hooks/*.py ל-.claude/hooks/, ו-tests/ask-form-test.py ו-tests/hebrew-after-fail-test.py ל-tests/harness/.
3. הוסף ל-.claude/settings.json את שלוש הרשומות שב-settings.proposed.json (השווה קודם: אם settings.json השתנה מאז 07/10/2026, הוסף רק את הרשומות, אל תדרוס).
4. בדיקה חיה: /hooks מראה את שני ה-hooks. אם PostToolUseFailure לא מוכר או ש-/hooks מראה שגיאה, מחק רק את הבלוק הזה.
   הרץ פקודה שנכשלת (python3 -c "raise SystemExit(1)") ובדוק שמופיעה השורה של hebrew-after-fail.
   כתוב לי שאלה בטקסט בסוף תשובה ובדוק שהעצירה מבקשת שאלון.
5. הוסף שתי שורות ל-.claude/hooks/README.md, הרץ python3 tests/harness/*.py, PR ומיזוג.
6. ב-STATUS: הפריט "שאלון + עברית אחרי כלי שנכשל" ל-[x] רק אחרי שלב 4.
```
