# Routine חודשי: עמודות המסד מול הצילום ב-repo

מיכאל אישר ב-03/10/2026. מהשיחה בענן ה-Routine נוצר בלי חיבור Supabase ובלי ה-repo, ולכן נמחק. **להקים מ-claude.ai > Routines**, ידנית:

- **Repository:** `mishaf1988-lgtm/tfugen-safety`
- **Connectors:** Supabase
- **Schedule:** ב-1 לכל חודש, 06:52 שעון ישראל
- **Prompt:** הטקסט שבין הקווים

---
משימה חודשית ב-repo mishaf1988-lgtm/tfugen-safety. כל הודעה בעברית.
1. קרא את CLAUDE.md ואת .claude/skills/tfugen-db/SKILL.md.
2. בכלי execute_sql של Supabase (project_id znhjtpcltrxxyfjczgvw; מצא אותו ב-ToolSearch עם "execute_sql") הרץ:
select json_object_agg(table_name, cols) from (select table_name, json_agg(column_name order by column_name) cols from information_schema.columns where table_schema='public' group by table_name) t
אם הכלי לא זמין: כתוב את זה בשורה אחת וסיים, בלי לנחש.
3. השווה ל-tests/harness/db-columns.json (בלי המפתח _measured).
4. אם זהה: אל תשנה כלום, וסיים בשורה אחת "עמודות המסד זהות לצילום, נבדק DD/MM/YYYY".
5. אם שונה: עמודה או טבלה שנוספו במסד = לעדכן את הקובץ. עמודה שנמחקה מהמסד = לבדוק ב-grep אם index.html שולח אותה; אם כן, זו תקלה (השדה נמחק בשקט בכל שמירה), ולכתוב אותה בראש תיאור ה-PR ובהודעה הסופית. לעדכן את _measured לתאריך היום. branch routine/db-columns-sync-YYYY-MM-DD, להריץ node tests/harness/self-check-test.js, empty-dates-test.js, edit-everywhere-test.js, ncr-batch2-test.js, לפתוח PR עם שורות "רטרו:" ו-"skill:", להריץ ברקע bash .claude/hooks/ci-wait.sh על ה-branch, ולמזג כשירוק.
6. לא לשנות את סכמת המסד ולא להריץ SQL שכותב.
---
