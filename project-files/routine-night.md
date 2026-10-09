# סבב לילה: קוד, בדיקות, מיזוג ואימות באתר החי

מיכאל, 09/10/2026, בשאלון: "בצע: קוד + בדיקות + תיקונים", "בצע: עד 2 פריטים", "בצע: ביטול אוטומטי ודיווח", ומועד: "רק היום עד 6 בבוקר מקסימום". כלומר ריצה אחת, בלילה שבין 09/10 ל-10/10/2026, שמסתיימת לכל המאוחר ב-06:00 שעון ישראל.

**הוקם:** ראה שורת "הוקם" למטה (נכתבת על ידי השיחה שמקימה את הטריגר).

---
0. ידע משותף (09/10/2026): קרא את project-files/agent-common.md (ב-repo tfugen-safety; אם אין: git clone https://github.com/mishaf1988-lgtm/tfugen-safety), סעיפי "פתיחה" ו"ידע משותף". בסוף הריצה: סעיף "סגירה" (שורת למידה אחת; שם הסוכן: routine-night).
1. שעון: `TZ=Asia/Jerusalem date`. אחרי 05:30 לא מתחילים פריט חדש. ב-06:00 עוצרים בכל מקרה: מה שלא מוזג נשאר ב-branch, ומדווחים עליו. כל הודעה בעברית, בלי מקף ארוך, תאריכים DD/MM/YYYY.
2. קרא CLAUDE.md במלואו, ואת skills tfugen-lean, tfugen-lessons ו-tfugen-ref. חוקי CLAUDE.md בתוקף: בלי מייל לאדם, בלי מחיקה או DROP, בלי migration או שינוי סכמה, בלי כתיבה ב-Microsoft 365, בלי "אזורים רגישים". פריט שדורש אחד מאלה: מדלגים עליו ורושמים למה.
3. בחירת עבודה, עד 2 פריטים, אחד אחרי השני: הפריט הפתוח הראשון ב-project-files/BACKLOG.md סעיף 12 ("קוד, לפי סדר"), בלי ✅ ובלי ❌, שאינו מחכה למיכאל ואינו דורש migration. לפני שמתחילים: `grep` ב-DECISIONS.md על מילת המפתח שלו (לקח 10). אם אין בסעיף 12 פריט כזה: סעיף 9, אותם תנאים. אין פריט מתאים = לא ממציאים עבודה; עוברים לצעד 6.
4. לכל פריט:
   a. `git fetch origin main && git checkout -B routine/night-<שם>-YYYY-MM-DD origin/main`.
   b. בונים את השינוי הקטן ביותר שעונה על הפריט. עברית ב-JS רק כ-\uXXXX. עזרים קיימים (fd, du, eb, g, gv, esc).
   c. בדיקה ב-tests/harness (playwright מקומי על index.html, או node לפונקציות שרת), ו**שבירה מכוונת**: לגבות ב-cp, לשבור את הקוד החדש, לראות שהבדיקה נכשלת, להחזיר. בלי שבירה שנכשלה = הבדיקה לא בודקת כלום.
   d. ה-harness המלא: `bash tests/harness/run.sh > /tmp/h.txt 2>&1; tail -3 /tmp/h.txt`. רק "ALL GREEN" ממשיך. אדום = לתקן (עד 2 ניסיונות), אחרת לוותר על הפריט, לרשום, ולעבור לבא.
   e. סימון הפריט ב-BACKLOG כ-✅ עם התאריך, commit, push, PR עם שורות `רטרו:` ו-`skill:`, `bash .claude/hooks/ci-wait.sh <branch> mishaf1988-lgtm/tfugen-safety` ברקע, ומיזוג (squash) רק כשירוק.
   f. **אימות באתר החי:** `bash project-files/live-check.sh`. יציאה 0 = האתר מגיש בדיוק את index.html של main שנבדק. אחר כך שוב `bash tests/harness/run.sh` על main (git checkout -B main origin/main).
   g. **כשל באימות (יציאה 4, או harness אדום על main):** ביטול אוטומטי. `git revert --no-edit <sha של המיזוג>` על branch חדש `routine/night-revert-YYYY-MM-DD`, PR בכותרת "ביטול: <שם הפריט>" עם הסיבה ושורות רטרו/skill, ci-wait, מיזוג כשירוק, ושוב live-check.sh. הפריט חוזר לפתוח ב-BACKLOG עם הסיבה.
5. בין פריט לפריט: בדיקת השעון (צעד 1).
6. סגירה: agent_report (agent-common, "סגירה") עם ok, line (מה מוזג, מה בוטל, מה דולג) ו-learned. שורה ב-project-files/agent-log.md ושורה בראש STATUS.md תחת "🔔 פתוח עכשיו" בשם "סבב לילה 10/10/2026", באותו PR אחרון (או PR קטן משלו). הודעה אחרונה, קצרה: לכל פריט מספר PR, מוזג או בוטל, ותוצאת live-check.
---
