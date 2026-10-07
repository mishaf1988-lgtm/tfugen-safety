# skills לחשבון claude.ai של מיכאל: עברו ל-michael-skills

**מ-07/10/2026 (שלב ב', מיכאל בשאלון: "המקור עובר ל-michael-skills") המקור היחיד הוא ה-repo הפרטי `mishaf1988-lgtm/michael-skills`** (https://github.com/mishaf1988-lgtm/michael-skills). אין פה עותק, בכוונה: שני עותקים התפצלו כבר כמה פעמים (עוזר לקח 34).

| מה | איפה ב-michael-skills |
|---|---|
| העוזר `michael-assistant` (כללים, `references/`) | `plugins/michael/skills/michael-assistant/` |
| כללי 365 לכל הממשקים | `plugins/michael/skills/michael-assistant/references/m365.md` ו-`plugins/michael/skills/m365-guard/SKILL.md` |
| הצעות לעוזר (מ-07/10/2026 מיזוג מיידי, בלי משימה יומית ובלי אישור) | `proposals/` (הכללים ב-`proposals/README.md`) |
| `michael-work-lessons`, `ncr-capa-writing` (העוזר החליף אותם) | `archive/`, מחוץ ל-plugin |

- **הגעה לחשבון:** סנכרון plugin, לבד, בכל push ל-main שם. אין zip ואין העלאה ידנית.
- **בדיקות:** `checks` שם (מספר גרסה גבוה מ-main, מונה הכללים, כללי 365 זהים בשני ה-skills). פה נשאר רק ה-hook `guard-365.py`, שאוכף את כללי 365 בקוד בכל שיחת Claude Code על ה-repo הזה.
- **שיחת Code פה שצריכה את העוזר או את m365.md:** `add_repo` (owner `mishaf1988-lgtm`, repo `michael-skills`), או `git clone https://github.com/mishaf1988-lgtm/michael-skills`. שינוי בעוזר = PR שם, ובתיאור ה-PR פה `skill: ... michael-skills#N`.
