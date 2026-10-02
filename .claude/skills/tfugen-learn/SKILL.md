---
name: tfugen-learn
description: How the skills of the tfugen-safety repo keep learning from every task - at the end of each task Claude decides what was learned and writes it into the right skill (or creates a new one) in the same PR, without asking. Enforced by the "skill:" line that lessons-gate.py checks on every PR. Load at the end of every task, before writing the PR description, and whenever a procedure took more than one try.
---

# skills שלומדים מכל משימה

מיכאל, 02/10/2026: "אתה יכול לבד לפתח סקייל, חלק מהלימוד וההתפתחות שלך", ו"הסקייל צריך ללמוד ולהתפתח כל הזמן מכל עבודה שאנחנו עושים".
**Claude יוצר ומעדכן skills בעצמו, בלי לבקש אישור.** זה אישור עומד. מה שעדיין דורש אישור: שינוי ב-`.claude/hooks/` (נחסם בענן), וכל מה ש-CLAUDE.md מגדיר כרגיש.

## בסוף כל משימה, לפני תיאור ה-PR

שאלה אחת: **מה ייחסך בפעם הבאה אם זה יהיה כתוב?** ואז לבחור לאן זה הולך:

| מה נלמד | לאן |
|---|---|
| טעות (של Claude או של מיכאל) | `tfugen-lessons`: לקח חדש עם מספר |
| תהליך שלקח יותר מניסיון אחד (migration, פריסה, בדיקה) | ה-skill של התחום (`tfugen-db`, `tfugen-dev`), או skill חדש |
| עובדה על הקוד: טבלה, עזר, מספר שורה, מחרוזת | `tfugen-ref` |
| רקע והיסטוריה שלא צריך בכל משימה | `tfugen-history` |
| כלל שחל על כל עבודה, לא רק על ה-repo | `project-files/claude-ai-skill/michael-work-lessons/SKILL.md`, ואז zip ו-SendUserFile למיכאל עם "להעלות מחדש: Settings > Capabilities > Skills" |

ובתיאור ה-PR שורה: `skill: <מה נלמד ואיפה נכתב>` או `skill: אין`.
`lessons-gate.py` נכשל בלי השורה, וגם כשהשורה אומרת שנלמד משהו ואף קובץ skill לא השתנה.

## מתי skill חדש ומתי לעדכן

- **לעדכן** כשיש skill שהנושא שלו מתאים. עדיף שורה בקובץ קיים מאשר קובץ חדש.
- **חדש** כשאותו נושא חזר פעמיים ואין לו בית: שתי משימות שבהן חיפשתי את אותו דבר, או תהליך של יותר מ-3 צעדים שעשיתי מהזיכרון.
- מבנה: תיקייה `.claude/skills/<שם>/SKILL.md`, frontmatter עם `name` ו-`description` באנגלית שאומר **מתי לטעון** (זה מה שמפעיל אותו), גוף קצר בעברית. להוסיף שורה ל"הפניות" ב-CLAUDE.md.

## איך לא לנפח

- skill הוא הוראות, לא יומן. מה שקרה ולמה: `DECISIONS.md` או `tfugen-history`.
- כשמשהו נאכף ב-hook או בבדיקה, הטקסט מתקצר לשורה ("נאכף: ...").
- `tfugen-lessons` מוגבל ל-14KB (`lessons-format-test.py`); כשמתקרבים, לגזום לקחים שכבר נאכפים בקוד.
- לא לכתוב "נלמד" על משהו שלא נבדק. כלל שמבוסס על הנחה = עוד טעות שמחכה.
