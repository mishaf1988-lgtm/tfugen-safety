# כל כללי הענף: העוזר והסוכנים

נפתח 02/11/2026 (מיכאל בשאלון: "בצע: ענף חדש העוזר"). כל שורה: הכלל בקצרה, והמקור שבו הוא כתוב במלואו. התיק הקצר: `project-files/domains/assistant.md`. כלל חדש בענף נכנס גם לכאן.

## כללים מכל הקבצים
- תשובה ב-`wa_me`: עברית, עד 400 תווים (700 לרשימה), קצר וישיר, בלי שמות עובדים ליד פרט רפואי או אישי (`project-files/routine-wa-core.md` צעד 2)
- "מחכה לך", "חסר", "פג", "בהצעה", "הגיעו היום" רק עם `checked` (נאכף בשרת, `claimGate`, `factGate`) (`project-files/routine-wa-core.md` צעד 2)
- מייל לאדם אחר: רק טיוטה, מיכאל שולח (`CLAUDE.md` חוק 9; `routine-wa-core.md`)
- סגירת ריצה: `agent_report` עם `ok` ו-`line`, לא `status`/`did` (`project-files/routine-wa-core.md` צעד 7)
- שינוי מודל של סוכן: `update_trigger` רק כשמיכאל ביקש במילים שלו, ובדיקה ב-`get_trigger` (`DECISIONS.md` 3646, 3919)
- הסוכנים המתוזמנים: סונט או Haiku לפי החלטת המודלים; העוזר על אופוס (`DECISIONS.md` 3646, 3919)
- עובד שמקבל משימת קוד מעביר אותה לשיחת הפיתוח (`project-files/agent-common.md`; `DECISIONS.md` 2744)
- בקשת פיתוח מהעוזר: `dev_request`, נסגרת ב-`dev_done` פעם אחת (סגירה שנייה לא נשלחת שוב, 02/11/2026) (`functions/api/routine-db.js`)
- ניסוי בעוזר משיחה אחרת: `office_ask` עם "קריאה בלבד, אל תכתוב ב-365 ואל תחתום" (`.claude/skills/tfugen-sessions/SKILL.md`)
- עלות ריצה: `get_session` `usage.cost_usd` (`.claude/skills/tfugen-sessions/SKILL.md`; `agent-costs.md`)
- הוראות העוזר: שינוי ב-`routine-wa-core.md` מסונכרן ל-`routine-wa-assistant.md` ולקבצי `wa-topics/` (`tests/harness/wa-core-sync-test.py`)

## פריטים פתוחים
- STATUS "🧠 העוזר בוואטסאפ על אופוס": בדיקת עלות ואורך תשובות 09/11/2026.
- STATUS "💸 בדיקת החיסכון": סעיף (3) ב-08/11/2026.

## כל ההחלטות של הענף
`grep -P "\tassistant$" project-files/domains/decisions-map.tsv` (מספר שורה ב-DECISIONS.md וכותרת).
