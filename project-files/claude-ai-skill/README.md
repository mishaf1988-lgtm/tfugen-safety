# skill לחשבון claude.ai של מיכאל

**`michael-assistant/`: העוזר האישי של מיכאל (04/10/2026).** נטען בצ'אט, ב-Cowork וב-Claude Code. `SKILL.md` קצר (נטען בכל שיחה), והידע לפי נושא ב-`references/`: `lessons.md` (הכללים מטעויות), `role.md`, `mail.md`, `iso.md`, `ncr.md`, `excel-decks.md`, `law.md`, `learning.md` (לולאת הלמידה וסריקת השדרוג).
מחליף את `michael-work-lessons/` ואת `ncr-capa-writing/`, שנשארים פה לעיון עד שמיכאל מוחק אותם מהחשבון. עדכון חדש נכנס רק ל-`michael-assistant/`.

**`m365-guard/`: שומר Microsoft 365 (06/10/2026).** אותם כללים כמו `michael-assistant/references/m365.md`, ב-skill קצר שעומד לבד, כדי שייטען בכל פעולה על 365 גם כשהעוזר לא נטען. שינוי בכלל: בשני המקומות (`account-skill-test.py` בודק שהכללים המרכזיים בשניהם).

**`proposals/`: הצעות לעוזר (07/10/2026).** כל צ'אט כותב לשם תוספות בלבד, עם `אושר ע"י מיכאל`; משימת מיזוג בענן (א'-ה' 17:55) ממזגת, מעלה גרסה ומעבירה ל-`proposals/merged/`. ראו `proposals/README.md`.

להעלאה: `cd project-files/claude-ai-skill && zip -r michael-assistant.zip michael-assistant`, ואז ב-claude.ai: Settings > Capabilities > Skills > Upload skill.
כשנוסף לקח כללי ל-`tfugen-lessons`, להוסיף אותו גם ל-`michael-assistant/references/lessons.md` (בלי נתיבים של ה-repo), שורה בהיסטוריה ב-`SKILL.md`, ולשלוח zip למיכאל.
