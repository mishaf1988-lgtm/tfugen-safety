# CLAUDE.md

Claude Code loads this file automatically at the start of every session in this repo. Read it first, then `STATUS.md` and `DECISIONS.md` before acting.

## Project

**Tapugan Safety Management System** — מערכת ניהול בטיחות ואיכות סביבה לתעשיית תפוגן.
(הברנד נקרא **Tapugan Safety**. ה-repo עדיין נקרא `tfugen-safety` מסיבות היסטוריות — לא משנים את שם ה-repo.)

- **Repo**: `mishaf1988-lgtm/tfugen-safety`
- **Live (Production)**: 🟢 **https://tapugan-safety.pages.dev** ← השרת העיקרי, Cloudflare Pages
- **Live (Legacy fallback)**: 🟡 https://tfugen-safety.vercel.app — עובד עדיין כי 5 ה-WhatsApp templates של Meta מצביעים על ה-URL הזה. **אל תפיל אותו** עד ש-Meta יאשרו את העדכונים (24-48h מ-2026-05-02).
- **Standards**: ISO 14001 (סביבה) + ISO 45001 (בטיחות ובריאות תעסוקתית)
- **User**: מנהל בטיחות במפעל (לא מפתח מקצועי — מעדיף שינויים קטנים, ברורים, ומוסברים).

## Architecture (אל תשנה ללא סיבה)

| שכבה | טכנולוגיה |
|---|---|
| UI | **single-file** `index.html` (~7800 lines) — אין build step, אין framework |
| Backend | **Supabase** — 35+ טבלאות, REST API, `znhjtpcltrxxyfjczgvw.supabase.co` |
| AI | Cloudflare Pages Function `functions/api/claude.js` → Claude API |
| Deploy | **Cloudflare Pages** auto-deploy מ-`main` (project: `tapugan-safety`) |

### חשוב — יש 2 תיקיות API מקבילות:
- `/api/*.js` — קוד Vercel (Edge Functions, `process.env`, `default export`)
- `/functions/api/*.js` — קוד Cloudflare Pages Functions (`onRequest`, `env` arg, named export)

**שניהם פעילים במקביל**. שינוי קוד API צריך להתבצע **בשניהם** (או רק ב-Cloudflare ו-Vercel נשאר עם הגרסה הישנה — שווה לדון לפי המקרה). עד שמורידים סופית את Vercel, יש להחזיק קוד תקין בשני המקומות אם זה חשוב.

## חוקי פיתוח חובה

1. **עברית ב-JS strings = `\uXXXX`**. לעולם לא תווים גולמיים.
2. **תאריכים ריקים → `null`**. אף פעם לא `''`.
3. **שדה תפוגה = `e`** (אות בודדת) בכל הטבלאות: `ppe`, `med`, `tr`, `docs`, `ctr`. פורמט `YYYY-MM-DD`.
4. **עזרים קיימים** — השתמש, אל תשכפל:
   - `fd(d)` → תצוגה `DD/MM/YYYY`
   - `du(d)` → ימים עד תפוגה (שלילי = פג)
   - `eb(d)` → badge HTML (ירוק/צהוב/אדום)
   - `askDel(table, id)` → מחיקה עם אישור
   - `goPage(name)` → ניווט
   - `showView(table, id)` → צפייה בפריט
5. **אל תיצור קבצי HTML נוספים**. הכל ב-`index.html`.
6. **אל תוסיף framework / build step / bundler**.
7. **אין לסמן `[x]` בלי הוכחת הרצה** — פעולה ידנית ב-Supabase, migration, RLS, Storage policy או שינוי Auth תסומן כבוצעה ב-`STATUS.md` רק אחרי שהמשתמש אישר במפורש שההרצה והאימות עברו. `IF NOT EXISTS` אומר שההרצה בטוחה לחזרה, אבל לא מוכיח שהפעולה בוצעה או שהאפליקציה עובדת.

## שפה ותקשורת

- **ענה בעברית** כברירת מחדל.
- הסבר החלטות בקצרה, בלי ז'רגון מיותר.
- לפני שינוי משמעותי (>50 שורות) — הראה תוכנית ובקש אישור.
- אם לא בטוח — תשאל. עדיף לא להמציא.

## Workflow — כל משימה חדשה

1. **קרא** `STATUS.md` → מצא משימה לא-מסומנת
2. **קרא** `DECISIONS.md` → ודא שאתה לא סותר החלטה קודמת
3. **צור branch**: `routine/<name>-YYYY-MM-DD`
4. **ערוך** בשינויים ממוקדים
5. **בדוק**:
   - [ ] אין שגיאות console
   - [ ] אין עברית raw ב-JS
   - [ ] 23 טבלאות עדיין 200 OK
6. **עדכן** `STATUS.md` + הוסף שורה ל-`DECISIONS.md` אם יש החלטה ארכיטקטונית
7. **Commit + Push + PR + Merge ל-main מיידית** — ראה למטה.

## פריסה — חוק קבוע: למזג מיד, לא לחכות

Cloudflare Pages מפרסם **רק את `main`** ל-`tapugan-safety.pages.dev`. כל קוד שיושב על branch לא מגיע למשתמש. לכן:

- **בכל סיום משימה — פתח PR ומזג ל-`main` באותה הריצה** דרך `mcp__github__create_pull_request` + `mcp__github__merge_pull_request`. אסור לעצור על "המתנה לאישור מיזוג" — זה אישור עומד.
- **לפני כל סשן דיבאג של "קוד לא מגיע":** ראשון — `git log origin/main..HEAD`. אם יש commits שלא מוזגו, מזג אותם **לפני** שמתחילים לחקור קאש/SW/דברים אחרים.
- **חריג יחיד:** שינוי שאסור לפרסם בלי בדיקה ידנית — ציין במפורש שמשאיר על branch ובקש אישור.

## סנכרון בין 2 חשבונות Claude

המשתמש עובד מ-**שני חשבונות** Claude (טלפון + מחשב, או 2 Projects שונים). מכיוון שהקוד ב-GitHub וה-נתונים ב-Supabase — **הקוד עצמו מסונכרן אוטומטית**. מה שאינו מסונכרן פנימית הוא ההקשר/זיכרון של השיחה.

**הפתרון**: הכל חשוב הולך לקבצים ב-repo:
- **`CLAUDE.md`** — ההקשר הקבוע (הקובץ הזה)
- **`STATUS.md`** — משימות פתוחות + Last Known Good
- **`DECISIONS.md`** — יומן החלטות (מה נבחר ולמה)
- **`project-files/`** — קבצים להעלאה ל-Claude Project (מובייל)

**בתחילת כל שיחה** (גם בסשן חדש בחשבון אחר), Claude צריך:
1. לקרוא את 3 הקבצים הללו
2. לשאול את המשתמש מה המטרה של השיחה
3. לפעול לפי החוקים פה

## אזורים רגישים — בקש אישור לפני שינוי

- `api/claude.js` — API key של Claude, אל תחשוף בקומיטים
- קריאות Supabase — אל תשנה את ה-schema בלי דיון
- `ncr` table (375 רשומות production) — אין למחוק/להחליף
- `ncr_ai` table — ניתוחי AI של NCR (היסטוריה לפי `version`). אסור למחוק שורות היסטוריות
- `equip_inspections` table — בדיקות ציוד חובה לפי פקודת הבטיחות (שדה תפוגה: `e`)

## הפניות

- תבניות קוד: `project-files/PATTERNS.md`
- Checklist לפני PR: `project-files/CHECKLIST.md`
- Skill מפורט: `.claude/skills/tfugen-dev/SKILL.md`
