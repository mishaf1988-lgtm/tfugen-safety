---
name: tfugen-history
description: Background and incident history that used to live in CLAUDE.md for the tfugen-safety repo - why Vercel is gone, what happened to the 375 NCR rows, how the two-account sync failed three times on 2026-09-22, and how the Supabase MCP connection was verified. Load when a task touches Vercel, the ncr table, the backup schemas, two-account conflicts, or Supabase MCP connectivity, or when CLAUDE.md points here. Not needed for ordinary feature work.
---

# History - הרקע שהוצא מ-CLAUDE.md

CLAUDE.md נטען בכל הודעה, ולכן הוא מחזיק רק **חוקים**. ה"למה" וה"מה קרה" עברו לכאן
ב-2026-09-22, ונטענים רק כשמשימה נוגעת בהם. **החוקים עצמם נשארו ב-CLAUDE.md.**

## Vercel (2026-05-03 עד 2026-09-21)

השורה "אין יותר תיקיית `/api` של Vercel, הוסרה ב-2026-05-03" הייתה נכונה לגבי ה-repo
ולא לגבי המציאות. **פרויקט ה-Vercel עצמו נשאר מחובר ל-GitHub ופרס בכל דחיפה עוד
ארבעה חודשים**, בכתובת `tfugen-safety.vercel.app`: עותק ציבורי שני של אפליקציית
בטיחות, שבו 11 נקודות הקצה מחזירות 404 כי Vercel אינו מריץ Pages Functions.
התגלה ממיילי פריסה כושלת אצל מיכאל, **ונמחק על ידו ב-21/09**. החשבון ריק מפרויקטים.
Cloudflare Pages הוא הייצור היחיד, עכשיו גם בפועל.

לקח: "הוסר מה-repo" ו"הוסר מהעולם" הם שני דברים. כשמורידים אינטגרציה, לבדוק גם את
הדשבורד של הספק.

## טבלת `ncr`: 0 שורות בייצור, 375 בגיבוי

**נמדד מול ה-DB 2026-09-22: `public.ncr` = 0 שורות, `backup_ops_20260918.ncr` = 375.**

שתי גרסאות קודמות של השורה ב-CLAUDE.md היו שגויות: "375 רשומות production" (לא נכון
מאז 18/09) וגם "המספר מעולם לא היה נכון" (גם לא, הרשומות קיימות, בגיבוי). מה שקרה
בפועל: 375 רשומות יובאו, וב-18/09 בוצע **איפוס תפעול מכוון** עם גיבוי ל-
`backup_ops_20260918` (וגם `ins_backup_20260918`). `public.ncr` ריקה בכוונה.

האזהרה "אין למחוק/להחליף" נשארת בתוקף לקראת העלייה לאוויר, ומ-22/09 היא נאכפת
גם ב-hook: `.claude/hooks/guard-sql.py` חוסם `DELETE`/`TRUNCATE`/`DROP` על `ncr`,
`ncr_ai` ו-`trustee_reports`.

## סנכרון בין שני חשבונות: שלוש ההתנגשויות של 2026-09-22

שני החשבונות עורכים את אותו `index.html` בן 1.4MB במקביל. ביום אחד זה עלה שלוש פעמים:

1. PR שהתנגש אחרי 31 commits על main ונדרש יישום מחדש.
2. שתי עריכות STATUS שנפלו על עוגני טקסט ששוכתבו בינתיים.
3. "ממצא" על טבלת `ncr` שהחשבון השני כבר חקר וסגר יום קודם.

בכל הפעמים זו הייתה עבודה כפולה ולא אובדן. מכאן חמשת חוקי הסנכרון ב-CLAUDE.md
(fetch+reset לפני כל עריכה, קריאה מחדש של קבצי המצב, grep לפני דיווח ממצא, רבייס
ל-PR ארוך, חלוקת נתיבים).

## Supabase MCP: איך אומת (2026-09-22)

מחובר דרך **Connector ב-claude.ai** (OAuth, בלי טוקן בקוד). האימות: `list_projects`
מחזיר את `znhjtpcltrxxyfjczgvw` (ACTIVE_HEALTHY, Postgres 17), ו-`execute_sql` /
`get_advisors` עובדים. המחבר עובר דרך `api.anthropic.com` ולכן לא מושפע מחסימת הרשת
של סביבת הענן.

הרשת של הענן חוסמת את Supabase ישירות (`mcp.supabase.com`, `*.supabase.co` מחזירים
403 מפרוקסי ה-egress). לכן הרשומה `supabase` ב-`.mcp.json` בשורש ה-repo נכשלת בענן
בכל סשן ("Proxy refused to open a tunnel"). היא רלוונטית רק ל-checkout מקומי. וגם
`curl` ל-REST של Supabase מתוך הסשן נכשל: לאימות משתמשים ב-`execute_sql` של ה-MCP.

הפרויקט הוא היחיד בחשבון, לכן אין `project_ref` בכתובת, בכוונה, כדי ש-`get_advisors`
יעבוד.

## מדיניות הסיסמאות: למה ה"מלכודת" קיימת

`functions/api/create-user.js` ו-`functions/api/reset-password.js` מייצרות סיסמה
זמנית מהתווים `abcdefghjkmnpqrstuvwxyz23456789`: אותיות קטנות וספרות בלבד, 8 תווים.
זה מכוון, הסיסמה מוכתבת בטלפון, ולכן אין בה אותיות גדולות, סמלים, או תווים שקל
להתבלבל בהם (`i/l/o/0/1`). המשתמש מחליף אותה בכל מקרה בכניסה הראשונה
(`must_change_password`).

המצב הנכון (אומת בצילום מסך 2026-09-22): `Minimum password length = 8` מופעל,
`Password requirements` ריק בכוונה. הסיסמה שהמשתמש בוחר נאכפת בקוד בשני מסלולים:
החלפה כפויה בכניסה ראשונה דורשת 10 תווים (`index.html`, חפש `must_change_password`),
החלפה יזומה דורשת 8. "Prevent use of leaked passwords" אינו זמין בתוכנית החינמית
(Pro ומעלה), נסגר 2026-09-22.
