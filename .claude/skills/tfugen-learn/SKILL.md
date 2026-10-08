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
| כלל שחל על כל עבודה, לא רק על ה-repo | העוזר ב-`mishaf1988-lgtm/michael-skills` (מ-07/10/2026 המקור היחיד): `plugins/michael/skills/michael-assistant/references/lessons.md` (ידע מקצועי: קובץ הנושא ב-`references/`; שורה בהיסטוריה ב-`SKILL.md`), עם מספר גרסה חדש. שינוי טקסט נדחף שם ישר ל-main אחרי שתי הבדיקות מקומית, `.github/` ב-PR (08/10/2026); כל עדכון ל-main מגיע לחשבון לבד (סנכרון plugin). אין zip |

**שאלה שנייה, חובה, בכל משימה (מיכאל, 04-05/10/2026, פעמיים: "אל תשכח ללמד את העוזר שלי כשאתה לומד דברים חדשים ולפתח אותו"):** מה למדתי על **העבודה** של מיכאל, לא על הקוד?
| מה | קובץ בעוזר (`plugins/michael/skills/michael-assistant/references/` ב-michael-skills) |
|---|---|
| חוק, תקנה, סעיף שנבדק בנבו (ציטוט + קישור) | `law.md`, "ממצאים שנבדקו" |
| עובדה על המפעל: היתר, רישיון, ציוד, חומרים, מועד, ממצא מנתונים (מלגזה תקולה, עובדים בלי מיגון) | `factory.md` |
| החלטה או העדפה של מיכאל ("התכונות זהות") | הקובץ של הנושא, עם הציטוט והתאריך |
| מקור או כלי שעובד (פורטל, אתר, API) | `learning.md`, "יומן סריקות שדרוג" |
| טעות שלי שחלה גם מחוץ ל-repo | `lessons.md` (כלל חדש, או "(לקח שחזר)") |
עדכון ב-michael-skills (`add_repo` או `git clone`; טקסט: push ישר ל-main אחרי `account-skill-test.py` ו-`BASE=origin/main skill-version-gate.py`): להעלות את שורת `גרסה:` ב-`SKILL.md` של העוזר ולהוסיף שורה בהיסטוריה (`checks` שם אוכף את הגרסה). אם אין גישה לדחוף לשם: קובץ הצעה ב-`proposals/` שם, בלי שורת אישור, ולשאול את מיכאל. רק ידע שנבדק עכשיו, עם מקור ותאריך (כלל 0 בעוזר). אין מה ללמד = לכתוב את זה ברטרו, לא לדלג בשקט.

ובתיאור ה-PR שורה: `skill: <מה נלמד ואיפה נכתב>` או `skill: אין`. כשהעוזר עודכן, לציין אותו בשורה הזו עם `michael-skills@<sha>` (הדחיפה הישירה) או `michael-skills#N` (PR; `lessons-gate.py` מקבל אותו כקובץ skill שהשתנה).
`lessons-gate.py` נכשל בלי השורה, וגם כשהשורה אומרת שנלמד משהו ואף קובץ skill לא השתנה.

## לחפש ליקויים בלי שמבקשים (מיכאל, 02/10/2026)

"צריך להסתכל וגם בלי שאני תמיד אומר, לראות את הליקויים ולייעל." כשמיכאל שולח צילום או בודק תהליך:
- לעבור על **כל** המסך: תווים שלא במקלדת (מקף ארוך), ברירות מחדל שגויות, סטטוס שלא מתאים לתאריך, שדה שנראה מלא ובאמת ריק (לקח 36).
- להריץ את התהליך כולו ב-playwright כמו שמיכאל עושה, לא רק את השלב ששאל עליו, ולבדוק ב-DB שהשמירה הגיעה.
- ליקוי קטן: לתקן באותו PR. גדול: לכתוב עם הצעה. בתשובה: מה נמצא ומה תוקן.

## לפני שכותבים "הצעה לשדרוג" (02/10/2026)
`grep` אחד: האם זה ליקוי שהשינוי הנוכחי יצר (קורא של הקובץ שהזזתי, ספירה שתשתנה)? אם כן, זה חלק מה-PR, לא הצעה. ב-PR של ארכיון הלקחים "המדידה תספור גם את הארכיון" נכתב כהצעה והתברר כליקוי שהארכיון עצמו יצר.

## לחפש skills חדשים בחוץ (מיכאל, 02/10/2026)

"אני ממליץ לך גם לחפש skills חדשים באינטרנט שיעשו לך עבודה יותר טובה, תמיד להיות מעודכן."
- **מתי:** בכל משימת התפתחות, ולפחות פעם בחודש (עם שורת METRICS של ה-1 לחודש).
- **איפה:** הכלים `SearchPlugins` ו-`SearchSkills` (הקטלוג של החשבון), `anthropics/skills`, `anthropics/claude-plugins-official`, `supabase/agent-skills`, הרשימה `VoltAgent/awesome-agent-skills`.
- **איך שופטים:** (1) עושה משהו שה-harness וה-skills כאן לא עושים? (2) מה המחיר: hook שקורא ל-LLM בכל תור = טוקנים כל תור; תוכן בלבד = בטוח. (3) כולל קונפליקט עם חוקי ה-repo (אין framework, עברית `\uXXXX`)? התקנה של תוכן בלבד: לבד. hook או MCP: מיכאל. hook מסומן "לשיחה במחשב" כבר בהצעה: בענן שינוי ב-`.claude/hooks/` נחסם גם אחרי אישור (לקח 42). כלל שאפשר לאכוף ב-CI (`tests.yml`, `.github/scripts/`) עדיף שם, כי זה לא נחסם. hook שמוכן מהענן: חבילה ב-`project-files/computer-session/` (קוד, בדיקות, `settings.proposed.json`, `INSTALL.md` עם הודעה להדבקה), ו**התקנה מדומה** לפני ה-PR: `git worktree add` לעותק, להעתיק לשם, ולהריץ את כל ה-`.py` ב-`tests/harness/`. ב-05/10 זה תפס בדיקה קיימת שמחפשת טקסט מילולי (`gh api` ב-`ci-watch-test.py`) שהשינוי שבר.
- **יומן** (כדי לא לבדוק פעמיים):

| תאריך | skill | החלטה |
|---|---|---|
| 02/10/2026 | `webapp-testing` (anthropics/skills) | לא: Playwright כללי; `self-check-test.js` ו-`visual-audit.js` כבר עושים יותר (Supabase מדומה, 390px, עברית). השיטה "לצלם ולקרוא" כבר ב-`tfugen-screen-review` |
| 02/10/2026 | `security-guidance` (plugin רשמי) | לא: hook Stop שקורא ל-Opus בכל תור (עלות), והאזהרה על `innerHTML` תצעק על כל שורה באפליקציה הזו (יש `esc`). סקירת אבטחה נעשתה 24/09 |
| 02/10/2026 | `supabase-postgres-best-practices` (supabase/agent-skills) | לא הותקן כולו: 8 קטגוריות למיליוני שורות. 5 הכללים שחלים תומצתו ל-`tfugen-db` עם מדידה על ה-migrations (44 policies לא עטופות, BACKLOG 5.12). קישור לכלל המלא שם |
| 07/10/2026 | סריקה לבטיחות, סביבה ורגולציה: `SearchSkills`, `SearchPlugins` (EHS, ISO 45001/14001, hazard, compliance), VoltAgent/awesome-agent-skills, lawve-ai/awesome-legal-skills, anthropics/skills | אין skill בתחום. הכי קרובים: plugin Operations (`compliance-tracking` ל-SOC 2 ו-ISO 27001, `risk-assessment` 3x3) ו-Legal (חוזים בארה"ב), שניהם עם MCP ל-Gmail, Slack, Asana: לא. phuryn/summarize-meeting: כללי, לא. הערך בתחום הזה בא מהעוזר (`law.md`, `role.md`, `factory.md`) ומה-Routines שממלאים אותו |
| 08/10/2026 | 10 repos שמיכאל שלח: obra/superpowers, DietrichGebert/ponytail, Graphify-Labs/graphify, JuliusBrussee/caveman, Egonex-AI/Understand-Anything, mvanhorn/last30days-skill, ayghri/i-have-adhd, sickn33/agentic-awesome-skills, K-Dense-AI/scientific-agent-skills, cathrynlavery/diagram-design | לא הותקן אף אחד (hooks בענן נחסמים, ו-superpowers/caveman סותרים את חיסכון הטוקנים ואת ההסבר הפשוט למיכאל). שני רעיונות הועתקו כטקסט ל-`tfugen-lean` (מיכאל: "בצע: שניהם"): סולם לפני קוד (ponytail), ו"איפה אנחנו + צעד אחד" בסוף תשובה (i-have-adhd) |

## hook או בדיקה ב-CI (סקירה, 02/10/2026)
כל hook שאוכף כלל כבר יש לו בדיקה מקבילה ב-CI: עברית גולמית (`rule1-hebrew-test.js`), SQL הרסני על הטבלאות המוגנות בקבצי migration (`rls-policy-test.mjs`), פורמט הלקחים (`lessons-format-test.py`), כלל 7 (`rule7-gate.py`). השאר הם hooks של זמן ריצה (חסימת SQL חי, קיצור פלט, המפקח, עברית בתשובה) ואין להם תחליף ב-CI. מה ש-CI כן יכול לעשות להם: לבדוק את ההגדרה שלהם (`hook-coverage.py` מתריע כש-`guard-sql` לא מכסה שם כלי). כלל חדש: קודם בדיקה ב-CI, hook רק כשצריך לעצור משהו בזמן אמת.

## מתי skill חדש ומתי לעדכן

- **לעדכן** כשיש skill שהנושא שלו מתאים. עדיף שורה בקובץ קיים מאשר קובץ חדש.
- **חדש** כשאותו נושא חזר פעמיים ואין לו בית: שתי משימות שבהן חיפשתי את אותו דבר, או תהליך של יותר מ-3 צעדים שעשיתי מהזיכרון.
- מבנה: תיקייה `.claude/skills/<שם>/SKILL.md`, frontmatter עם `name` ו-`description` באנגלית שאומר **מתי לטעון** (זה מה שמפעיל אותו), גוף קצר בעברית. להוסיף שורה ל"הפניות" ב-CLAUDE.md.

## איך לא לנפח

- skill הוא הוראות, לא יומן. מה שקרה ולמה: `DECISIONS.md` או `tfugen-history`.
- כשמשהו נאכף ב-hook או בבדיקה, הטקסט מתקצר לשורה ("נאכף: ...").
- `tfugen-lessons` מוגבל ל-14KB (`lessons-format-test.py`); לקח שנאכף בקוד ולא חזר מתקצר לשורה אחת ועובר ל-`project-files/lessons-archive.md` (המספור משותף, הבדיקה מונה את שני הקבצים). לא מעלים את התקרה.
- לא לכתוב "נלמד" על משהו שלא נבדק. כלל שמבוסס על הנחה = עוד טעות שמחכה.
