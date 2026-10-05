# חבילה לשיחה במחשב (05/10/2026)

שינויים ב-`.claude/hooks/` וב-`.claude/settings.json` נחסמים בענן (לקח 42), ולכן הכל הוכן כאן: הקוד, בדיקה לכל hook (כל אחת עברה שבירה מכוונת), `settings.json` מוצע, והתקנה מדומה על עותק של ה-repo שבה כל בדיקות ה-Python ב-`tests/harness/` ירוקות.

## ההודעה להדבקה בשיחה במחשב

```
קרא את CLAUDE.md ואת project-files/computer-session/INSTALL.md, ובצע את ההתקנה לפי הסדר שם: בדיקות לפני, העתקה, בדיקות אחרי, עדכון README של ה-hooks, PR ומיזוג. אחר כך עבור על "עוד דברים לשיחה במחשב" בסוף הקובץ.
```

## מה בחבילה

| קובץ | אירוע | מה הוא עושה | למה |
|---|---|---|---|
| `hooks/pr-gate.py` (חדש) | PreToolUse על `mcp__.*__create_pull_request` | **חוסם** פתיחת PR כשבתיאור אין `רטרו:` / `skill:`, או ש-skill אומר "למדתי" בלי קובץ skill ששונה, או Fix בלי לקח. מריץ את `check()` של `.github/scripts/lessons-gate.py` על `git diff origin/main...HEAD` | היום זה נתפס רק ב-CI, אחרי שה-PR נפתח: סבב אדום ועריכה |
| `hooks/session-start.py` (חדש) | SessionStart | מדפיס לשיחה חדשה: ה-skills לטעון, ה-handoff, הפריטים הפתוחים ב-STATUS, השורה האחרונה ב-METRICS | שיחה חדשה מתחילה בלי לקרוא 600KB ובלי לשכוח את ה-handoff |
| `hooks/hebrew-midturn.py` (חדש) | PostToolUse על כל כלי | אם הודעת הביניים האחרונה באנגלית (אותו מדד של `hebrew-reply.py`), מוסיף תזכורת. פעם אחת לכל הודעה | לקח 13 חזר 23 פעמים; ה-Stop hook תופס רק בסוף התור, אחרי שמיכאל כבר ראה |
| `hooks/push-recheck.py` (חדש) | PostToolUse על Bash עם `git push` | מריץ שוב את `lessons-format-test.py` אחרי ה-push ומזהיר אם אדום | `push-gate.py` בודק לפני שהפקודה רצה, ולא רואה commit שנעשה באותה פקודה |
| `hooks/supervisor.py` (מתוקן) | Stop | דורש "הצעות לשדרוג" רק כשהיה מיזוג **מאז** התשובה האחרונה שכבר כללה את הסעיף | היום מיזוג אחד בתחילת שיחה ארוכה מחייב את הסעיף בכל תשובה קצרה אחריו |
| `hooks/ci-wait.sh` (מתוקן) | (כלי, לא hook) | רק ריצת `tests` האחרונה של ה-sha קובעת, ו-cancelled לא נספרת | ריצה ישנה שנכשלה על אותו sha החזירה exit 1 כשהחדשה ירוקה (קרה 3 פעמים ב-04/10) |
| `settings.proposed.json` | | ה-settings הנוכחי + ארבעת ה-hooks החדשים + matcher של guard-sql: `Bash\|mcp__.*__execute_sql\|mcp__.*__apply_migration` | ה-connector מגיע עם קידומת UUID, וה-matcher היום מכסה רק `mcp__Supabase__*`. כלומר `DELETE` על `ncr` דרך ה-connector לא נחסם (`hook-coverage.py` מזהיר על זה בכל PR) |
| `tests/*.py` | | בדיקה לכל hook + `settings-test.py` + `_common.py` (עזר, עם בדיקה עצמית כי `run.sh` מריץ כל `.py`) | |

## התקנה (בשיחה במחשב)

```bash
git fetch origin main && git checkout -B routine/computer-hooks-$(date +%F) origin/main
bash project-files/computer-session/test-all.sh            # לפני: 7 קבצים, הכל "0 failed"
cp project-files/computer-session/hooks/*.py project-files/computer-session/hooks/*.sh .claude/hooks/
cp project-files/computer-session/settings.proposed.json .claude/settings.json
cp project-files/computer-session/tests/*.py tests/harness/
python3 .github/scripts/hook-coverage.py                    # צריך: "guard-sql covers every SQL tool name"
bash tests/harness/run.sh                                   # הכל ירוק
```

אחרי ההעתקה, `supervisor-test.py` של החבילה מחליף את הקיים (הוא אותו קובץ ועוד 4 בדיקות).

**בדיקה חיה אחרי ההתקנה** (ה-hooks נטענים רק בשיחה חדשה):
1. שיחה חדשה: בראשה מופיע "== התחלת שיחה (session-start.py) ==".
2. לבקש `create_pull_request` עם תיאור ריק על branch בדיקה: נחסם עם "pr-gate".
3. לבקש `execute_sql` עם `select 1`: עובר. (`DELETE FROM ncr` לא מנסים, הבדיקה בקוד מספיקה.)

**אחרי שעבר:**
- `.claude/hooks/README.md`: שורה לכל hook חדש בטבלה (האירוע, מה עושה, הבדיקה), ותיקון השורה של `supervisor.py` ("מאז התשובה האחרונה עם הסעיף").
- `hook-coverage.py` יפסיק להזהיר; את האזהרה אפשר להפוך לכישלון (`sys.exit(1)`), כי עכשיו היא מכוסה.
- `STATUS.md`: לסמן את פריטי ה-hooks מה-handoff של 03/10 כבוצעו (כלל 7: אחרי הבדיקה החיה).
- להעביר את התיקייה `project-files/computer-session/` לארכיון או למחוק, באותו PR.

## עוד דברים לשיחה במחשב (לא קוד בחבילה)

1. **העוזר (10):** לבדוק ב-`יומן.txt` שהמשימה במחשב העלתה את גרסה (10) של michael-assistant לחשבון.
2. **skills של ה-repo:** איך המשימה במחשב מזהה גרסה חדשה של skill של ה-repo (שער הגרסה ב-CI כבר בודק, ההעלאה עצמה לא נבדקה).
3. **שורה יומית ב-`יומן.txt` גם כשאין העלאה**, כדי שהמייל השבועי יבדיל בין "לא היה מה להעלות" לבין "המשימה לא רצה".
4. **`metrics.yml`:** החלטה עד 01/11/2026.
5. **Connector של Microsoft 365.**
6. **ci-watch.py ו-push-gate.py מגיבים ל-"git push" בתוך heredoc** (נראה היום: קובץ בדיקה שנכתב ב-heredoc הכיל את המחרוזת, ו-ci-watch הציע להריץ ci-wait על branch בשם `b`). תיקון אפשרי: להסיר גופי heredoc מהפקודה לפני ההתאמה. לא בחבילה, כי צריך לבדוק את זה מול ה-test הקיים של heredoc ב-`ci-watch-test.py`.
