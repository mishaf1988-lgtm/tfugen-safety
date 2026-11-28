# Worker שעון של Cloudflare (tapugan-clock): דיווח הסוכן, 28/11/2026

נבנה בצ'אט `session_01HFfaw8J6apDn9Cz2rKbnD4` ואבד כשהצ'אט נתקע (הקבצים היו ב-`git add` בעץ עבודה, בלי commit). הבסיס היה origin/main `4d9c997`. לבנות מחדש לפי זה.

## מה נמצא ב-middleware (נבדק בקוד)
- `functions/_middleware.js` `onRequest`: `if (!preview && machineCall(request, path)) return next();` ו-`mailLogo(...)` רצות **לפני** בדיקת המדינה (`request.cf.country`). נתיב ב-`MACHINE_PATHS` (בהם `/api/wa-hook`, `/api/db-health`, `/api/wa-morning`) עובר בלי קשר למדינה. הסוד נבדק בכל פונקציה: `wa-morning` בודק `x-notify-secret` (ב-pg_cron: `trustee_notify_secret` מה-Vault), `wa-hook` בודק חתימת Meta.
- לפי התיעוד, בקשה מ-Worker לאזור אחר מקבלת `CF-Connecting-IP = 2a06:98c0:3600::103`. לא נבדק לאיזו מדינה היא משויכת, ולכן ה-Worker קורא **רק** לנתיבים פטורים, והבדיקה קוראת את `MACHINE_PATHS` ונכשלת אם נתיב יוצא מהרשימה.

## מי קורא לשעונים היום (נבדק)
- `wa-morning` `{"watch":true}` כל 5 דקות: pg_cron `wa-watch` (`migrations/2026-10-20_wa_watch_cron.sql`).
- עדכון הבוקר: pg_cron `wa-morning`, `47 4,5 * * 0-4`.
- Power Automate: אין זרימה מתוזמנת שקוראת לכתובת.
- `daily-reminders.yml` בלי `schedule` מ-19/09/2026.

## מה ה-Worker מחליף
- `site-up.yml` (כל 15 דקות ב-GitHub): אותן בדיקות, ועוד POST ל-webhook בלי חתימה (מצפה ל-403 "forbidden"). שורת וואטסאפ בנפילה ובחזרה, בנוסח של site-up עם "בדיקה מ-Cloudflare".
- `wa-watch` ו-`wa-morning` כתובים אבל **כבויים**, מופעלים רק אם שמם במשתנה `CLOCK_JOBS` (DECISIONS 27/11/2026 "רעיון 48 חוזר לדחוי, pg_cron נשאר"; להעביר = החלטה של מיכאל).

## הקבצים שנבנו
- `workers/clock.js`: `scheduled()`, ו-`fetch` עם `/health` ו-`/run` (המפתח בכותרת `x-trigger` בלבד). פונקציות טהורות: `jobsFor`, `probeDue`, `stateOf`, `decide`, `waBodies`. עברית רק `\uXXXX`. נפילה מלאה = 14 בקשות החוצה (תקרה 50).
- `workers/clock.toml`: שעונים `*/5 * * * *` ו-`47 4,5 * * SUN-THU` (שמות ימים: ב-Cloudflare 1 = ראשון). KV בהערה.
- `tests/harness/clock-worker-test.mjs`: 61 בדיקות.
- `ACCOUNT-INVENTORY.md`: פסקה אחרי שורת backup-cron. `STATUS.md`: פריט "שיפורי Cloudflare" סעיף (2).

## לפריסה (לא נעשה)
1. PR עם סקירת אבטחה (סוד וכתובת מבחוץ, חוק 8), `עוזר: אין שינוי`.
2. Worker `tapugan-clock` עם שני השעונים (3 מתוך 5 השעונים החינמיים).
3. סודות: `META_ACCESS_TOKEN` ו-`WA_TO` (רק מיכאל: ה-API לא מחזיר ערך סוד), `MANUAL_KEY` (אקראי, Claude), `TRUSTEE_NOTIFY_SECRET` רק אם מפעילים עבודה.
4. אופציונלי: KV `CLOCK_STATE` (בלעדיו אין "חזר", ו"נפל" לכל היותר פעם בשעה).
5. ריצה מקבילה עם `site-up.yml` כשבוע, ואז להוריד ממנו את ה-`schedule`, רק באישור.
