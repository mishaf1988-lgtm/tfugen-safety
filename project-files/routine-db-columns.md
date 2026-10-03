# Routine חודשי: עמודות המסד מול הצילום ב-repo

מיכאל אישר ב-03/10/2026. מהשיחה בענן ה-Routine נוצר בלי חיבור Supabase ובלי ה-repo, ולכן נמחק. **להקים מ-claude.ai > Routines**, ידנית:

- **Repository:** `mishaf1988-lgtm/tfugen-safety`
- **Connectors:** Supabase
- **Schedule:** ב-1 לכל חודש, 06:52 שעון ישראל (`CRON_TZ=Asia/Jerusalem 52 6 1 * *`)
- **התראה:** לטלפון
- **פער = PR בלי מיזוג** (03/10/2026, הערת הסשן השני: מיזוג אוטומטי היה מאשר גם עמודה שנמחקה בטעות, והבדיקות היו מפסיקות לתפוס אותה)
- **Prompt:** הטקסט שבין הקווים

---
משימה חודשית ב-repo mishaf1988-lgtm/tfugen-safety. כל הודעה בעברית.
1. קרא את CLAUDE.md ואת .claude/skills/tfugen-db/SKILL.md.
2. בכלי execute_sql של Supabase (project_id znhjtpcltrxxyfjczgvw; מצא אותו ב-ToolSearch עם "execute_sql") הרץ:
select json_object_agg(table_name, cols) from (select table_name, json_agg(column_name order by column_name) cols from information_schema.columns where table_schema='public' group by table_name) t
אם הכלי לא זמין: כתוב את זה בשורה אחת וסיים, בלי לנחש.
3. השווה ל-tests/harness/db-columns.json (בלי המפתח _measured).
4. אם זהה: אל תשנה כלום, וסיים בשורה אחת "עמודות המסד זהות לצילום, נבדק DD/MM/YYYY".
5. אם שונה: כתוב דוח קצר בטבלה (טבלה, עמודה, נוספה או נמחקה). עמודה שנמחקה מהמסד: בדוק ב-grep אם index.html שולח אותה, ואם כן סמן אותה כתקלה (השדה נמחק בשקט בכל שמירה). ואז עדכן את הקובץ ואת _measured לתאריך היום, ב-branch routine/db-columns-sync-YYYY-MM-DD, והרץ node tests/harness/self-check-test.js, empty-dates-test.js, edit-everywhere-test.js, ncr-batch2-test.js. פתח PR עם הדוח בראש התיאור ושורות "רטרו:" ו-"skill:". אל תמזג: מיכאל מאשר כל שינוי במבנה המסד, כדי ששינוי שנעשה בטעות לא יאושר אוטומטית.
6. אל תשנה את סכמת המסד ואל תריץ שום SQL שכותב.
---
