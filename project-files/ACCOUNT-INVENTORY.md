# מה קיים מחוץ ל-GitHub, ואיך מקימים אותו מחדש

מיכאל, 11/10/2026: "שנכיר את כל השינויים שעשינו... אם בהמשך אצטרך להעביר את כל הפעילות מהחשבון הזה, זה אמור להיות מתועד ב-GitHub".

**חשבון Claude שני לסירוגין (28/10/2026):** הקמה וסנכרון ב-`project-files/ACCOUNT-MOVE.md`.

הקוד, ההוראות של כל Routine וכל ההחלטות כבר ב-repo. הקובץ הזה מרכז את **מה שלא נמצא ב-repo**: הגדרות בחשבונות (Claude, Microsoft 365, Cloudflare, Supabase, Power Automate), כדי שאפשר יהיה לבנות אותן מחדש בחשבון אחר. **בלי ערכים סודיים**: רק שם, איפה הוא יושב, ומאיפה מקבלים אותו מחדש.

**כלל (11/10/2026):** כל דבר חדש שמוקם מחוץ ל-repo (Routine, זרימה, תיקייה שהאוטומציה תלויה בה, משתנה סביבה, pg_cron, connector) נרשם כאן באותו PR. `account-inventory-test.py` בודק שכל מזהה `trig_` שמופיע בקבצי ה-Routine נמצא כאן.

עודכן לאחרונה: 11/10/2026.

---

## 1. חשבון Claude (claude.ai, sviva@tapugan.co.il)

### Routines (טריגרים מתוזמנים)
**מפת המערכת** (https://claude.ai/artifact/KTMVcoPJBva43nKRacSLkc, 27/10/2026): נבנית מהטבלה הזו ומזרימות Power Automate למטה. שורה שנוספה או כובתה = `python3 project-files/system-map/build-map.py` ופרסום מחדש של `project-files/system-map/system-map.html` לאותו קישור, באותו PR (`system-map-test.py` נכשל אחרת).

**עץ הענפים** (https://claude.ai/artifact/3tVqQWHsc4kwgdKntufErG, 03/11/2026): 13 ענפי העבודה בתלת-ממד (אורך = חוקים, עובי = החלטות, עלים = מילות הפעלה, פירות = טפסים מבוקרים). נבנה מ-`project-files/domains/` ב-`python3 project-files/domain-tree/build.py` ומתפרסם **רק כשמיכאל מבקש** (מיכאל בשאלון: "בצע: עדכון רק כשאבקש").

ההוראות של כל אחד בקובץ `project-files/routine-*.md` (הטריגר רק אומר "קרא את הקובץ ובצע"). להעברה: `create_trigger` מחדש מתוך שיחה עובדת עם ה-repo, באותו cron ובאותו פרומפט קצר (התבנית: `tfugen-db` סעיף 7).

| מזהה | שם | מתי (שעון ישראל) | קובץ הוראות | שיחה |
|---|---|---|---|---|
| `trig_01LfFp3qxNuyTcwjxaBhgSEZ` | תיוק מהמייל ועדכון תוקף (סונט 5.5 מ-03/11/2026, קודם הייקו) | א'-ה' 17:52 | `routine-mail-filing.md` | משימת צ'אט מתוזמנת (Cowork), שיחה חדשה בכל ריצה, בלי מאגר (28/10/2026; המזהה הקודם `trig_01Kam3MRxBnWSdXA4qEguFaU` כבוי) |
| `trig_01BSS4f2n1vj1hYA9R6pGurs` | תיוק מהמייל ועדכון תוקף 10:52 (סונט 5.5 מ-03/11/2026, קודם הייקו) | א'-ה' 10:52 | `routine-mail-filing.md` | משימת צ'אט מתוזמנת (Cowork), שיחה חדשה בכל ריצה, בלי מאגר (28/10/2026; המזהה הקודם `trig_018Eo7D7nH6Cf5RcskU7A6ug` כבוי) |
| `trig_01W1SUAwixyb77K7Vr4vys7S` | בודק התוקף מול המסמכים | מוצ"ש 22:44 | `routine-validity.md` | Routine של Code, שיחה חדשה בכל ריצה, מאגרים: tfugen-safety + michael-skills (C56, 28/10/2026) |
| `trig_01DU2kgbfF66zPMDywVLt6UW` | דוח ציות חודשי | 1 לחודש 08:03 | `routine-compliance.md` | Routine של Code, שיחה חדשה בכל ריצה, מאגרים: tfugen-safety (C55, 28/10/2026) |
| `trig_01ERhgWGPzu6ibttZGV6EamW` | סידור תעודות COA של שפכים | 17 לחודש 07:47 | `routine-coa.md` | משימת צ'אט מתוזמנת (Cowork), שיחה חדשה בכל ריצה, בלי מאגר (28/10/2026; המזהה הקודם `trig_01G7MCCqLTwC9koU4X3RNcJf` כבוי) |
| `trig_016jtM2MCCrQdmBahCNF8qFf` | מסמכים חדשים בתיקיית הבטיחות | 2 לחודש 06:51 | `routine-od-scan.md` | Routine של Code, שיחה חדשה בכל ריצה, מאגרים: tfugen-safety + michael-skills (C55, 28/10/2026) |
| `trig_01JuPjwQTEUGDihK8RJWxM7U` | נוסח החוקים בנבו | 3 לחודש 06:52 | `routine-nevo-versions.md` | Routine של Code, שיחה חדשה בכל ריצה, מאגרים: tfugen-safety + michael-skills (C55, 28/10/2026) |
| `trig_01RHDbDAFU9uxPTUDnA3FTG4` | מגמות מנתוני המפעל | 4 לחודש 08:14 | `routine-factory-trends.md` | Routine של Code, שיחה חדשה בכל ריצה, מאגרים: tfugen-safety + michael-skills (C55, 28/10/2026) |
| `trig_01L7gduHbG8d72fn8fDp7LUP` | המפקח המדומה | 5 לחודש 08:16 | `routine-inspector.md` | Routine של Code, שיחה חדשה בכל ריצה, מאגרים: tfugen-safety (C55, 28/10/2026) |
| `trig_013hJJjH8yFEYbNPw1Xm9Nqt` | מודל ההעדפות של מיכאל | 6 לחודש 08:21 | `routine-preferences.md` | Routine של Code, שיחה חדשה בכל ריצה, מאגרים: tfugen-safety (C55, 28/10/2026) |
| `trig_01APzQCoZHsqJTQTFqvKbRcT` | מעקב הצעות מחיר | מוצ"ש 22:47 | `routine-quotes.md` | `session_01HFfaw84di3M2mqdh6499jY` |
| `trig_016ft9sEQH3PKT6pCfF5YMXX` (מ-01/11/2026, C68; הישן `trig_01PrGDTUzea2ewuNBTApskNc` מושהה) | חוקר העוזר | א'-ה' 06:47 | `routine-researcher.md` | שיחה חדשה בכל ריצה, סונט |
| `trig_01PiJpBmASES4tDqwdePUsH2` (**כבוי 12/11/2026**, הוחלף בשורה למטה; להדליק חזרה רק אם החדש נכשל) | רטרו יומי בשיחה קבועה | א'-ה' 07:52 | `retro-prompt.md` | `session_01HFfaw8i2zmdD94JPNpEzFw` |
| `trig_01XGrqU6JWc73ER7WozWdjbh` (11/11/2026; **פעיל מ-12/11/2026**, אחרי שמיכאל חיבר את המאגר, C82) | רטרו יומי בשיחה חדשה | א'-ה' 07:52 | `retro-prompt.md` | שיחה חדשה בכל ריצה, סונט |
| `trig_01WbNQpw5yDaBvtUZybwyb7m` | סקירת קוד עמוקה שבועית: Fable קורא את שינויי הקוד של השבוע ומעביר ממצאים מוכחים למפתח (11/11/2026, מיכאל: "אשר תוספת") | ד' 12:23 | `routine-deep-review.md` | שיחה חדשה בכל ריצה, Fable (`claude-fable-5-2`), בלי מאגר (קריאה בלבד) |
| `trig_01PxjFyeVEJcsbUaYVSxN5FZ` | הרדאר מלמד את העוזר | ב' 08:37 | `routine-radar-learn.md` | `session_01HFfaw8i2zmdD94JPNpEzFw` |
| `trig_01Xx4uqzZmT1J9xFW4ADZQf4` (מ-01/11/2026, C68; הישן `trig_01F6R3kkBFwxJMhrgVDJqvbF` מושהה) | חוקר ההמצאות | ו' 08:47 | `routine-inventor.md` | שיחה חדשה בכל ריצה, סונט |
| `trig_013mrn2cFrC79hD8vnTpbHd9` | הדרכה שבועית מהשטח | א' 05:53 | `routine-talk-field.md` | משימת צ'אט מתוזמנת (Cowork), שיחה חדשה בכל ריצה, בלי מאגר (28/10/2026; המזהה הקודם `trig_01VcYN6AFgRJTbxpmf3MYXdN` כבוי) |
| `trig_01SzAJJc2RDFcLoAeBEcWonK` | רדאר רגולציה שבועי | א' 08:17 | הפרומפט בטריגר עצמו (לא בקובץ) | שיחה חדשה בכל ריצה |
| `trig_01BimkS5EroGgvLB1tZo6zQo` | תור משימות מ-Claude Code (Cowork) | א'-ה' 08:19, 12:19, 16:19 (מ-01/11/2026, בדיקת החיסכון; קודם כל שעה) | הפרומפט בטריגר; הכללים ב-`cowork-queue.md` | Cowork, קשור למחשב של מיכאל |
| `trig_015oCa3o5whdXon9dTettfkB` | משרד הסוכנים: עדכון בוקר | כל יום 07:38 | `routine-office.md` | `session_01HFfaw8e1uNhVYnJ4Gwgzjk` |
| `trig_01UcmWkSPWDHkp49BftrPt86` | תפוגות שנתקעו אצל ספק | ב' 08:17 | `routine-supplier-followup.md` | `session_01HFfaw84di3M2mqdh6499jY` |
| `trig_015zHPtWJFZP77uqRzL5wfBA` | תזכורת פרסום ההדרכה | א' 12:13 | `routine-talk-publish.md` | משימת צ'אט מתוזמנת (Cowork), שיחה חדשה בכל ריצה, בלי מאגר (28/10/2026; המזהה הקודם `trig_01VtyJkVLuqYrQNVgWHhMzhV` כבוי) |
| `trig_01XJ5dBUN5dcbDqirQ7uZ6a5` | בודק לתור המשימות למחשב | כל יום 09:37 | `routine-cowork-check.md` | `session_01HFfaw8e1uNhVYnJ4Gwgzjk` |
| `trig_01CkizD1F41kU5BAzEA9DX4q` | בדיקת הניסוי השבועית | ד' 06:29 | `routine-staging-e2e.md` | `session_01HFfaw8e1uNhVYnJ4Gwgzjk` |
| `trig_017ita3taHBGjtRrgExMqxXS` (מ-01/11/2026, סונט; במקום `trig_01Fm5346rt5BNgeF49DqGbyz`, מושהה, C69) | המגייס: החלפה שבועית | ו' 13:07 (ראשונה 23/10/2026) | `routine-rotation.md` | `session_01HFfaw7Zw3uqx6WWgcneouV` (המגייס מ-01/11/2026; הקודם `session_01Q3LMWMr65icNtoe5zLifqr` בארכיון מ-03/11/2026, מיכאל בשאלון: "בצע: כל הארבע") |
| `trig_01Py8YXifD3HtnQUmFgoTRft` | הדוור של הצ'אט במשרד | א'-ה' 10:11, 14:11 (מ-01/11/2026, בדיקת החיסכון; קודם 08:11, 12:11, 16:11) | `routine-chat-relay.md` | `session_01JT8Fct6Z6Qv2GbaBBqxtQT` |
| `trig_0114iVUybrBb6vRqZt1EyoyL` | פיתוח מיידי: בקשה מהעוזר | בלי תזמון: השרת מפעיל לכל `dev_request` חדש (`DEV_FIRE_TOKEN`), שיחה חדשה בכל הפעלה | `routine-dev-fire.md` | אין (שיחה חדשה כל פעם) |
| `trig_011UyDNeQ1NV72NNyXJxwxtE` | עובד לפי דרישה: משימה מהעוזר | בלי תזמון: השרת מפעיל לכל `worker_now` חדש (`WORKER_FIRE_TOKEN`), שיחה חדשה בכל הפעלה | `routine-worker-now.md` | אין (שיחה חדשה כל פעם). מחבר Microsoft 365 מוסיפים בדף ה-Routine |
| `trig_01MB92o4ptUuC2a42SyP5S4e` | סריקת מיילים יומית: מיילים שמחכים לתשובה ממיכאל, עם נוסח וכפתורים | א'-ה' 08:13 (25/10/2026, מיכאל בשאלון: "בצע: פעם ביום, 08:30") | `routine-mail-triage.md` | אין (שיחה חדשה בכל ריצה); מחבר Microsoft 365 (מיכאל הוסיף ב-25/10/2026, C46) |
| `trig_01XgSGMbPk2UjxaCHFCJ9MWz` | בודק האיכות היומי: קורא מה שהסוכנים שלחו למיכאל, טיוטות וכתיבות למסד, מתקן ומדווח בשורה | א'-ה' 06:43 (27/10/2026, מיכאל בראיון) | `routine-quality.md` | אין (שיחה חדשה בכל ריצה; מחבר Microsoft 365 לקריאה, C52; גיבוי `drafts_text`) |
| `trig_01JTN476gVPuvyUkuvbEm8DY` | המאמן של העוזר: בונה תרגילים מהתיקונים של מיכאל בשבוע, שולח לעוזר ב-`drill_ask` (תשובה רק במשרד), שופט מול המקור, מלמד ב-`learn` ומריץ שוב (01/11/2026, מיכאל בשאלון: "בצע: מצב תרגיל + מאמן שבועי") | מוצ"ש 23:17 | `routine-coach.md` | אין (שיחה חדשה בכל ריצה; Microsoft 365 מחובר מ-02/11/2026, C71, אומת ב-`get_trigger`) |
| `trig_01LCkXtoN8kG89ExhRx4RgXa` | יומן תוספות: כותב כל ערב את מה שמוזג באותו יום לעמוד https://claude.ai/artifact/SgaJHrTPhxf3fdHsCMguH7 (אוסף `days`) | א'-ו' 20:37 (27/10/2026, מיכאל בשאלון) | `routine-additions-log.md` | אין (שיחה חדשה בכל ריצה; ArtifactData מובנה, לא מחבר) |
| `trig_01Rc6DsLXFzq9BnPKe8zn2DZ` | **כבוי מ-01/11/2026** (בדיקת החיסכון; במקומו `trig_01VVNZ6dJ3oEQWv9qnMGyrQ3`, רשת ביטחון יומית א'-ה' 19:23, סונט, שיחה חדשה, `routine-dev-safety.md`) המפתח התורן: בקשות קוד מהעוזר (מ-26/10/2026, שיחה חדשה) | א'-ה' 07:17 עד 19:17, כל שעתיים | `routine-dev-runner.md` | `session_01BLD52HhH67gxP2Yquk2mgy` (בארכיון מ-03/11/2026) |
| `trig_01JeSrrCNgCtEcvHxmRkZsSY` | נורות המפה: מעדכן את מצב הסוכנים במפת המערכת (https://claude.ai/code/artifact/957276a1-d1e7-4076-854f-cb1f50cebc45, מסמך `live/status`) | א'-ה' 07:58 (28/10/2026, מיכאל בשאלון: "בצע: נורה חיה ובנייה אוטומטית"; פעם ביום מ-31/10/2026, מיכאל: "בצע: נורות המפה פעם ביום") | `routine-map-lights.md` | משימת צ'אט מתוזמנת (Cowork), שיחה חדשה בכל ריצה; ArtifactData מובנה, list_triggers מהמחבר |
| `trig_01Xjk1pEG3w1TPfmQggCjgxL` | עוזר החיסכון השבועי: דוח חיסכון והצעות ל-`ideas-lab.md` (31/10/2026, לפי מיכאל בשאלון 30/10/2026: "בצע: דוח חיסכון שבועי + הצעות"; סונט) | ה' 13:37 | `savings-assistant.md` | שיחה חדשה בכל ריצה. **בלי מחברים**: נוצר מהצ'אט הראשי, שאי אפשר להעביר ממנו מחברים; Claude Code Remote לא מופיע ברשימת המחברים בדף ה-Routine (צילום של מיכאל, 31/10/2026), ולכן המדידה משורות העלות ב-handoff ומ-`agent_log`. **בלי מאגר** (05/11/2026: הריצה הראשונה נחסמה ב-push; C75 בכרום, ועד אז הדוח נשמר ב-`agent_report`) |
| `trig_019kyW1TMXvJeK38auAh1Bkt` | כבוי 26/10/2026: המפתח התורן הקודם (השיחה הגיעה לכ-400 אלף טוקנים אחרי עבודה אינטראקטיבית עם מיכאל, מיכאל: "השיחה פה כבר ארוכה") | א'-ה' 07:17 עד 19:17, כל שעתיים | `routine-dev-runner.md` | `session_01MSqAcaJBru46xLKoM4Pyhf` |
| `trig_017p7AWHAPjxncswGqdfab2p` | כבוי 23/10/2026: המפתח התורן הישן (השיחה התארכה, 1.9 דולר להשכמה) | א'-ה' 07:17 עד 19:17, כל שעתיים (מפעיל API ו-`RUNNER_FIRE_TOKEN` קיימים ולא בשימוש: הפעלה ב-API פותחת שיחה חדשה, 22/10/2026) | `routine-dev-runner.md` | `session_013Z9kiSW2ewwXYCq9cdoDT5` (נפתחה עם source_url, ולכן push עובד) |
| `trig_01Wm6Nzy3sYFXusWuA6H3VYJ` | בדיקת זמני Supabase ועלויות הסוכנים (חד-פעמי) | 22/10/2026 17:30 | הפרומפט בטריגר | `session_01FXKjCZExakD2sbqi9eZVin` (רכז הדוחות; מיכאל 18/10/2026: "בדיקה של עלויות יכולה להיות תחת סוכן אחד"; הקודם `trig_01TFsrFwbqQM9fAoT8GfiobF` כובה) |
| `trig_01MXDJXkrNjeSdF734sKJY4U` | בדיקת שגיאות ראשונות מהדפדפן (חד-פעמי, אחרי #2108) | 28/10/2026 18:14 | הפרומפט בטריגר | `session_01HFfaw9EpfbN8WWmBRkDMqn` (הצ'אט הראשי של מיכאל) |
| `trig_0128hGCGdd9Ht3LuR8nxee7H` | בדיקת הודעת יומן התוספות (חד-פעמי, אחרי #2117) | 28/10/2026 21:05 | הפרומפט בטריגר | `session_01HFfawAM5UiEu915NMFat1J` (הצ'אט הראשי של מיכאל) |
| `trig_01Moh9Yj1DSBe6Pg5d6YnvEz` (הועבר 03/11/2026 07:50 מ-`trig_01UVQxERFqCwFZJno9QHFchJ`, ולפניו 02/11/2026 19:13 מ-`trig_0156unHDvTgRXBAZAYHxeZQt`, ולפניו 15:45 מ-`trig_017S5DbN7Bmb1RVbfmwj6Ryz`, ולפניו 09:52 מ-`trig_018QVTF4WGaD74usTc6vJv56`, ולפניו מ-`trig_01AopwdsSEia6e6agstK6NBp`, ולפניו מ-`trig_01PB9SQHNyoKahy2wie2QvvK`, ולפניו `trig_01DLR4j3qxn4RfXV66mdf2MN` ו-`trig_016JDB6AZZwXGf2KrU78Tiz9`, שנמחקו; הישן יותר `trig_01LHgCVmUZq2TJX69UMjBotM` כבוי) | סיכום שבוע ניסוי מצב המכסה (חד-פעמי, ideas-lab 11) | 03/11/2026 09:31 | הפרומפט בטריגר | `session_01HFfaw7G9UZw2W9zFujjXcR` (הצ'אט הראשי של מיכאל) |
| `trig_01Wfm5H3LZ3K9krsYbb76ZvV` (הועבר 03/11/2026 19:00 מ-`trig_011Em4NU4ErPm3LF9zKEqfaX`, ולפניו 14:19 מ-`trig_01PDvpCHV7GQUR6YF8kRLwHq`, ולפניו 11:44 מ-`trig_01LHakF6Wk8BKoC6pjHsWZ4n`, ולפניו 07:50 מ-`trig_0184MVNXHgqdKAdcPTbwpeRn`, ולפניו 02/11/2026 19:13 מ-`trig_01JzSTfWh8cpxE9V26kiG1GW`, ולפניו 15:45 מ-`trig_01GBJqNTxSECSNNvayfcefZG`, ולפניו 09:52 מ-`trig_01WaN3x2EU42N2cG5FXd4jsc`, ולפניו מ-`trig_014rcFnr55ByqSaKxorm9sVJ`, ולפניו מ-`trig_01X3s9x4zkPmr3ecbEVDnP4a`, ולפניו `trig_01JGqAvu7thLDJnG2fur88ro` ו-`trig_01SPpRHnEjUXbFFYnaZ2RNx7`, שנמחקו) | מדידה חוזרת של מהירות העוזר (חד-פעמי) | 05/11/2026 09:12 | הפרומפט בטריגר | `session_01HFfaw8rVVKDV3EMNw7JT7j` (הצ'אט הראשי של מיכאל) |
| `trig_01KFLXpRPPpAowf9xHeFd2gg` (הועבר 03/11/2026 14:19 מ-`trig_013JbzkDZmbMFGon7QngfeUu`, ולפניו 11:44 מ-`trig_017DBkCeMgvbttm35BTJSpd9`, ולפניו 07:50 מ-`trig_01MNgJCWoeFMDh7Vv4yTC5RM`, שנמחקו) | בדיקת הקריאה למסד הניסוי אחרי #2483 (חד-פעמי) | 03/11/2026 15:20 | הפרומפט בטריגר | `session_01HFfaw9LNnYaBKC7mjfJ8BL` (הצ'אט הראשי של מיכאל) |
| `trig_01D2DFLENbmoCDHqNiwCkpgB` (הועבר 12/11/2026 17:44 מ-`trig_01DDbakWPVtm2M6rNUBnYGWG`, שנמחק; לפניו הועבר 12/11/2026 14:06 מ-`trig_01EhzVUrmvPRCtTcHbki6D9e`, שנמחק; לפניו הועבר 12/11/2026 09:07 מ-`trig_01FNA2j5uJVcQ8fdSMAe5nCJ`, שנמחק; לפניו הועבר 11/11/2026 19:46 מ-`trig_01FhBk1bqdoqZDLs64Ha5ydh`, שנמחק; לפניו הועבר 11/11/2026 11:37 מ-`trig_01HgahF4d7ZA1yZ18rdhszYR`, ולפניו 08:25 מ-`trig_015nMWctf2D22wvSdW9fjXvJ`, ולפניו 09/11/2026 16:23 מ-`trig_01Uo7iV43aN6udeemEfdaTz3`, ולפניו 08/11/2026 13:40 מ-`trig_01SqtWFLt2qzvmX5ogNowDer`, ולפניו 07:01 מ-`trig_016HFm62Pa1kCvwEbJTBtPXK`, ולפניו 07/11/2026 19:20 מ-`trig_01DGTrwn6SnzNHhqRpgxJHCj`, ולפניו 13:57 מ-`trig_019p2PxBEBHdnjq9vUxVrqS8`, ולפניו 12:29 מ-`trig_01VKBPXg6C5NvKUD44eESKgD`, ולפניו 06:32 מ-`trig_01K8mxwBgiYCLKDGSvn2n2XW`, ולפניו 06/11/2026 17:38 מ-`trig_01SLQxBD9QvRNBohgFreYtEw`, ולפניו 05/11/2026 12:43 מ-`trig_01QuVKDN4dnnG3uocFhELXsv`, ולפניו 10:37 מ-`trig_01W6SjwNKm9gQFGPuGQzgnfN`, ולפניו 06:31 מ-`trig_01GTDqoPoHET83nZ54829cCF`, ולפניו מ-`trig_018uytihJoa3rP3RSQWjZkSt`, ולפניו 03/11/2026 19:00 מ-`trig_01De2eTV9NfopFg5gXsLd94w`, ולפניו 14:19 מ-`trig_01GkWgZu315bqhLsn232sHoj`, ולפניו 11:44 מ-`trig_01FXM5HDLeTUdAmkXm5iMyEB`, שנמחק) | מדידת מכסה יומית (קבועה מ-10/11/2026, הדילוג אמיתי; חוזר, להעביר בכל מעבר צ'אט), ומ-12/11/2026 גם כותבת את רישום הסוכנים המשותף (`agents_registry`) | כל יום 08:41 | הפרומפט בטריגר | `session_01HFfaw8H7oGSbLuFaLVve65` (הצ'אט הראשי של מיכאל) |
| `trig_01FBFyg6rtEFEU8pZvJ2hEzA` (הועבר 12/11/2026 17:44 מ-`trig_01MdDc8w3d9ncazz4DHDxHgV`, שנמחק; לפניו הועבר 12/11/2026 14:06 מ-`trig_018u3gKWngwzHaRUM9TcvLYa`, שנמחק; לפניו הועבר 12/11/2026 09:07 מ-`trig_0171iYa7BExAKSR1eNjiQKRM`, שנמחק; לפניו הועבר 11/11/2026 19:46 מ-`trig_01BCogLJWFwh6vxH1omqmpqL`, שנמחק; לפניו הועבר 11/11/2026 11:37 מ-`trig_01Qb1H5aAeBkjPJXkmoRW1Sn`, ולפניו 08:25 מ-`trig_01GRrZPqZT1WKmZKwSYPhCi8`, שנמחק) | בדיקה: דוח הציות והמפקח המדומה רצים על Fable (חד-פעמי, DECISIONS 10/11/2026) | 01/12/2026 11:30 | הפרומפט בטריגר | `session_01HFfaw8H7oGSbLuFaLVve65` (הצ'אט הראשי של מיכאל) |
| `trig_01Xm6v9xoJ7YCV3hpyAnAYvJ` (הועבר 12/11/2026 17:44 מ-`trig_01XEo58y3i6fDpWY98h9dnRW`, שנמחק; לפניו הועבר 12/11/2026 14:06 מ-`trig_01SWbsH3sPF65Waep6jnKw9p`, שנמחק; לפניו הועבר 12/11/2026 09:07 מ-`trig_01VntsL3PsNbrZtp1nyaezdZ`, שנמחק; לפניו הועבר 11/11/2026 19:46 מ-`trig_01MmTvzPi86owKpstSwb2fdR`, שנמחק; לפניו הועבר 11/11/2026 11:37 מ-`trig_01J8J8473Ae1awb9WdS7QerP`, ולפניו 08:25 מ-`trig_01TdTTeWp4H5M3K3zWSDcc9c`, שנמחק) | מדידת מהירות העוזר, סבב 2 (חד-פעמי, מיכאל בשאלון 09/11/2026) | 16/11/2026 09:23 | הפרומפט בטריגר | `session_01HFfaw8H7oGSbLuFaLVve65` (הצ'אט הראשי של מיכאל) |
| `trig_01LVJS7iYtzdd2K8ihpXBbHy` (הועבר 12/11/2026 17:44 מ-`trig_01DsYsH7Jwv2FS8ueTmVFLcQ`, שנמחק; לפניו הועבר 12/11/2026 14:06 מ-`trig_01HZimaKW2V3wMdGey9RwrNy`, שנמחק; לפניו הועבר 12/11/2026 09:07 מ-`trig_01TtX18quyEdedbGWNzZyfHq`, שנמחק; לפניו הועבר 11/11/2026 19:46 מ-`trig_01TMX3hZvsJee6Wc1W584JbM`, שנמחק; לפניו הועבר 11/11/2026 11:37 מ-`trig_01XnaMhuACdyPSuLhhk5j13Q`, ולפניו 08:25 מ-`trig_01Wdk7M727sRxYAm1ZgeW7Hn`, שנמחק) | מדידה חוזרת: חיפוש לפי משמעות (חד-פעמי, רעיון 27, מיכאל בשאלון 08/11/2026) | 08/12/2026 09:27 | הפרומפט בטריגר | `session_01HFfaw8H7oGSbLuFaLVve65` (הצ'אט הראשי של מיכאל) |
| `trig_011pWdghc6jf8EzYpMKy2KJX` (הועבר 12/11/2026 17:44 מ-`trig_01REom4xJbssvTrzm9gapF9h`, שנמחק; לפניו הועבר 12/11/2026 14:06 מ-`trig_01XBJvwouLoK2ZUfk7jQBNQ6`, שנמחק; לפניו הועבר 12/11/2026 09:07 מ-`trig_01CeZMaRvP3GkmHki133AvYS`, שנמחק; לפניו הועבר 11/11/2026 19:46 מ-`trig_01SEdFsu5iKZy9mW1wXXbaHs`, שנמחק) | ספירת כפילויות שנחסכו (חד-פעמי, מיכאל בשאלון 11/11/2026) | 11/12/2026 09:40 | הפרומפט בטריגר | `session_01HFfaw8H7oGSbLuFaLVve65` (הצ'אט הראשי של מיכאל) |
| `trig_014wZVjasT8hTMmo2PwddtnW` (הועבר 12/11/2026 17:44 מ-`trig_01QnwK6GZn93iAd3VQqUHuou`, שנמחק) | בדיקה: הרטרו החדש רץ ושמר (חד-פעמי, DECISIONS 12/11/2026) | 15/11/2026 09:10 | הפרומפט בטריגר | `session_01HFfaw8H7oGSbLuFaLVve65` (הצ'אט הראשי של מיכאל) |
| `trig_019jha68bve4vjgQ8eiszbus` (הועבר 12/11/2026 17:44 מ-`trig_011g7sDHVnJg4nSmsSAiU1Bu`, שנמחק; לפניו הועבר 12/11/2026 14:06 מ-`trig_01RV8tZbtEPV6qnWEYvCChUe`, שנמחק) | בדיקה: המסלול המהיר של העוזר אחרי #2727 (חד-פעמי, DECISIONS 12/11/2026) | 13/11/2026 12:10 | הפרומפט בטריגר | `session_01HFfaw8H7oGSbLuFaLVve65` (הצ'אט הראשי של מיכאל) |
| `trig_01FfFd27nL2gZ8rsuQxZzrX8` (הועבר 05/11/2026 06:31 מ-`trig_01CQhS4GU5M3fnLfpMCYXdeo`, שנמחק) | מדידה חוזרת של מהירות העוזר (חד-פעמי) | 05/11/2026 09:12 | הפרומפט בטריגר | `session_01HFfaw6anNYivhisPEhhzQq` (הצ'אט הראשי של מיכאל) |
| `trig_01JnLThu7D5HthNMcE4Q5L6n` (הועבר 03/11/2026 19:00 מ-`trig_01BNXdiBKgfEAb6y4WiJjrtL`, שנמחק) | בדיקת ריצת התיוק הראשונה על סונט (חד-פעמי, מיכאל בשאלון 03/11/2026) | 04/11/2026 11:25 | הפרומפט בטריגר | `session_01HFfaw8rVVKDV3EMNw7JT7j` (הצ'אט הראשי של מיכאל) |
| `trig_017ohWuZ45Qq6MrDCNFaJ9wq` (הועבר 02/11/2026 07:06 מ-`trig_01McBt3C2EdfkPkACBwNhHhg`, ולפניו מ-`trig_014VryZDdRHS52FrzGs2bHFU`, שנמחק) | בדיקת נורות המפה ובודק האיכות (חד-פעמי, handoff 01/11/2026 "הבא בתור" 4) | 02/11/2026 08:20 | הפרומפט בטריגר | `session_01HFfaw7agCC49MMiW1kNGb5` |
| `trig_01UyuMvW1wTALxoMupDqBdQL` | סיכום שבוע: CLAUDE.md הקצר והבודק החכם (חד-פעמי, מיכאל בשאלון 28/10/2026) | 01/11/2026 08:43 | הפרומפט בטריגר | `session_01HFfawAM5UiEu915NMFat1J` (הצ'אט הראשי של מיכאל) |
| `trig_012bESHLAFkMXSQjhexduu5W` | בדיקת הודעת הבוקר אחרי #2133 (חד-פעמי, מיכאל בשאלון 28/10/2026) | 29/10/2026 08:05 | הפרומפט בטריגר | `session_01HFfawAM5UiEu915NMFat1J` (הצ'אט הראשי של מיכאל) |
| `trig_017b9VdFUF8bMAdnRezagEvj` | מנהל השיווק: פעמיים בשבוע (קו העסק) | א' ו-ד' 08:53 (ראשונה 21/10/2026) | `marketing/routine-marketing.md` ב-safety-platform | `session_01HFfaw7hWiZHMiCc9hTHYoU` |
| `trig_01TofqtqNWtrXMnqiNjHq1nZ` | העוזר בוואטסאפ (מודל: אופוס `claude-opus-5-5` מ-02/11/2026 16:43, לפני כן סונט מהבוקר; DECISIONS 02/11/2026 "מסונט לאופוס", בדיקת עלות 09/11/2026; מחבר Microsoft 365 מ-20/10/2026) | מפעיל API בלבד (הודעה ממיכאל: וואטסאפ, צ'אט, משרד). התזמון א'-ה' 07:47 הוסר ב-25/10/2026 (מיכאל בשאלון: "בצע: לבטל אותה"; ריצה שלא עשתה כלום מאז 20/10, כ-1.07$ במחירון), ו-`run_once_at` עומד על 01/01/2036 כי אי אפשר למחוק תזמון | `routine-wa-assistant.md` | `session_01ANNSTD9gftqbzoeDj9Fkmv` (Sonnet) |
| `trig_01H7nGfmT4NDgs9N9odMp6se` | העוזר בוואטסאפ: מסלול מהיר (סונט `claude-sonnet-5-5`, 12/11/2026, מיכאל: "עשה את התוספת"; DECISIONS 12/11/2026 "נתב מודלים"). שאלות קריאה קצרות שהשרת סיווג (`fastModel`) | מפעיל API בלבד (`ASSISTANT_FAST_FIRE_TOKEN` ומתג `ASSISTANT_FAST_ON=1` ב-Cloudflare, פעיל מ-12/11/2026; לכיבוי: למחוק את המתג), שיחה חדשה בכל הפעלה; מחבר Microsoft 365 | `routine-wa-core.md` (אותו פרומפט כמו העוזר) | שיחה חדשה בכל הפעלה |
| `trig_01UQJ7GvXnce9wX8h2tShTQn` | העוזר בוואטסאפ בחשבון ה-Gmail (29/10/2026, מיכאל: "פתרון קל ומהיר לעבור בין חשבון לחשבון"). **בחשבון ה-Gmail, לא בראשי. מ-31/10/2026 הדגל `assistant_account` על `main` (העוזר ב-Gmail אישר למיכאל "עברתי לחשבון הראשי"), והעוזר שבראשי (`trig_01TofqtqNWtrXMnqiNjHq1nZ`, Haiku, על `routine-wa-core.md`, נבדק ב-`get_trigger` 31/10/2026) ענה פעם אחת להודעת בדיקה. העוזר ב-Gmail לא מקבל הודעות, והושהה ב-31/10/2026 (מיכאל, צילום מסך מהדף: Paused, "All triggers are paused"; נבדק בצילום, לא ב-`list_triggers`, כי הטריגר לא נראה מהחשבון הראשי).** מחברים: Microsoft 365, Supabase, Cloudflare | מפעיל API בלבד, `run_once_at` 01/01/2036. השרת פונה אליו רק כשהדגל `assistant_account` = `gmail` (`routine-db` op `assistant_account`); ברירת המחדל הראשי | `routine-wa-assistant.md` (הפרומפט שבטריגר קצר ומפנה אליו) | שיחה חדשה בכל הפעלה **ניסוי פיצול הוראות (30/10/2026):** `routine-wa-core.md` ו-`project-files/wa-topics/`, עדיין לא מופנה מהטריגר; ההחלטה אחרי מדידה. |
| `trig_011XSXRjssx2uPNu1rk4P9L2` | כבוי 20/10/2026: העוזר בוואטסאפ (שיחה רזה) | מפעיל API בלבד, בלי שעון (את עדכון הבוקר שולח השרת) | `routine-wa-assistant.md` | `session_01NyqL1Nxaxeyn4cp8MRCfpd` (Sonnet). **כבוי (20/10/2026), השיחה בארכיון:** הפעלה עם `text` פותחת תמיד שיחה חדשה, כך שהזוג החדש לא נחוץ (`routine-wa-assistant.md`). `ASSISTANT2_FIRE_URL` ו-`ASSISTANT2_FIRE_TOKEN` נמחקו מ-Cloudflare (20/10/2026, מיכאל בשאלון) |
| `trig_01JfYyhTEaXb8Vwt724UXHDF` | כבוי 20/10/2026: העוזר בוואטסאפ (Opus), ניסיון | בלי שעון, בלי טוקן | `routine-wa-assistant.md` | `session_012r4x8zMkBEqBg64CFmpF9U` (Opus, בארכיון). **כבוי:** נפתח לבדיקה, והוכיח שבלי `text` ההפעלה נכנסת לשיחה ועם `text` לא |

שיחות "לא לארכב": השיחות בעמודה האחרונה, כולל המגייס. Routine יורה לתוך שיחה, וארכוב שלה עוצר אותו.

### Cowork
- **משימה מתוזמנת** "תור משימות מ-Claude Code" (למעלה). רצה רק כשהמחשב של מיכאל דלוק ואפליקציית Claude פתוחה. הפרומפט המלא: `get_trigger` על המזהה, או `cowork-queue.md`.
- **תור המשימות:** ארטיפקט פרטי `https://claude.ai/artifact/8YG6U1r72asze2EFHxz4db`, אוסף `cowork_tasks`, ו-assets (קבצים להעלאה). להעברה: ארטיפקט חדש, ולעדכן את הכתובת ב-`cowork-queue.md` ובפרומפט של המשימה. **לא לשתף אותו** (מי שכותב בו מאשר משימות).

- **משרד הסוכנים:** ארטיפקט פרטי `https://claude.ai/artifact/AmxFowGHYDqyhd1sE9qphi`, מוצמד בסרגל. אוסף `agents` (שולחן לכל טריגר) ומסמך `meta/office`, שה-Routine למעלה כותב כל בוקר. מקור העמוד: `project-files/agent-office-page.txt`. השיחה של מנהל התפעול צופה בו (`ArtifactComments` watch, מ-18/10/2026), כדי ששליחה מהצ'אט תעיר אותה מיד (`routine-chat-relay.md`, "הודעה מיידית"); אחרי העברה: לבקש מהשיחה החדשה watch. להעברה: לפרסם את המקור כארטיפקט חדש ולעדכן את הכתובת ב-`routine-office.md`.
- **דף החתימה על נהלים 26.03, 26.04 ו-146.03 (16/10/2026):** ארטיפקט פרטי `https://claude.ai/artifact/NQTGARqzS6t7tyeYNLyYPM`, מסמכים `sig/michael` ו-`sig/tzachi` (PNG של החתימה, `by`, `at`), ו-PDF של שלושת המסמכים ב-assets. להעברה: לקרוא את שני המסמכים (`ArtifactData get`) לפני שהחשבון נסגר; אחרי התיוק החתום אין בו צורך.
- **פרויקט Supabase לניסוי (16/10/2026):** `tfugen-staging`, מזהה `ldzbjbsumzqjyvtpiwqo`, eu-west-1, תוכנית Free, באותו ארגון של החי. שומר ער: קריאה יומית מ-`wa-morning.js` (`stagingPing`, 03/11/2026, אחרי מייל השהיה מ-Supabase). נתוני דוגמה בלבד. להעברה: לייצא סכמה (או לבנות מחדש מהמסמך ב-STATUS, פריט "סביבת פיתוח וניסוי"); אין בו נתונים שצריך לשמור.

### Connectors (claude.ai > Settings > Connectors)
Microsoft 365 (קריאה: מייל, OneDrive, יומן, Teams), Supabase (`execute_sql` על `znhjtpcltrxxyfjczgvw`), Cloudflare Developer Platform, GitHub (repos `tfugen-safety` ו-`michael-skills`), Claude Docs. בחשבון חדש: לחבר את כולם, ולאשר את GitHub App על שני ה-repos.

### Skills של החשבון
הכול ב-repo הפרטי `mishaf1988-lgtm/michael-skills` (plugin, מסונכרן לחשבון לבד; `project-files/claude-ai-skill/README.md`). להעברה: להתקין את ה-plugin בחשבון החדש.

### סביבת הענן של Claude Code
סביבה `env_016FAHJNzmeY9hnaYA4JDs5e`. משתנה סביבה: `ROUTINE_KEY` (אותו ערך כמו ב-Cloudflare; בלעדיו ה-Routines נופלים ל-`execute_sql` שמחכה ללחיצה). להעברה: סביבה חדשה עם המשתנה, ולפתוח בה את השיחות העובדות מחדש.
Network secret באותה סביבה (16/10/2026): מפתח API של Cloudflare, Host `api.cloudflare.com`, Bearer, הרשאת Pages בחשבון `c9d388e3a5f9ee9546e8aa6b6353ec87` (לא רואה את רשימת החשבונות, לכן המזהה רשום כאן). Claude משנה איתו משתני Preview של `tapugan-safety` בלי מחשב. להעברה: מפתח חדש ב-Cloudflare (My Profile > API Tokens) ו-Network secret בסביבה החדשה.

### החשבון השני (Gmail, mishaf1988@gmail.com), נוסף 29/10/2026

**השוואת סביבות (31/10/2026, מיכאל בשאלון: "בצע: להשוות עכשיו"; נבדק מהצד הראשי, הצד השני לפי הרישום כאן בלבד):**

| | ראשי, `Default` (`env_016FAHJNzmeY9hnaYA4JDs5e`) | Gmail, `tapugan` (`env_01HLs9Va3CDBVLMbRCt8N284`) |
|---|---|---|
| `ROUTINE_KEY` | יש (נבדק) | יש (רשום) |
| השרת שלנו (`routine-db.sh`) | עובד (נבדק) | רק דרך דומיין מותר אחד (רשום) |
| Meta (`graph.facebook.com`) | נגיש (נבדק) | חסום, דומיין אחד בלבד (רשום) |
| Supabase | מחבר עובד, שני פרויקטים (נבדק `list_projects`) | מחובר (רשום) |
| Microsoft 365 | עובד, יומן ומייל (נבדק) | מחובר (רשום) |
| GitHub | עובד, PRs (נבדק) | מחובר (רשום) |
| Cloudflare | מפתח בפרוקסי `api.cloudflare.com` ומחבר ישן | מחבר (רשום) |
| token-guard | הותקן ידנית 31/10/2026 (`claude plugin install`); ההגדרה בפרויקט לא התקינה לבד | לא ידוע |
| Routines | 37 | אין (העוזר הושהה 31/10/2026) |

בראשי יש גם סביבות `tapugan` (`env_01EfZkV5jCAf2J7zmryWphU3`) ו-`Micael` (`env_016QDsTJ6R7ze3EtVWpKHpW4`) שהרשת בהן חסומה: שם זהה לסביבה העובדת בחשבון השני, ולכן שיחה של תפוגן בראשי נפתחת רק ב-`Default`.
שיחות בלבד, בלי Routines (`ACCOUNT-MOVE.md`). סביבה `tapugan` (`env_01HLs9Va3CDBVLMbRCt8N284`): משתנה `ROUTINE_KEY` (אותו ערך), רשת Limited עם דומיין מותר אחד, `tapugan-safety.pages.dev` (בלעדיו `routine-db.sh` נכשל ב-`CONNECT tunnel failed, response 403`). Connectors: GitHub, Supabase, Microsoft 365 (עם sviva@tapugan.co.il), Cloudflare Developer Platform. המשרד ומפת המערכת משותפים אליו להערות ועריכה (הזמנה, תקפה עד 27/11/2026). נבדק 29/10/2026: שיחת בדיקה בסביבה החזירה `{"ok":true,"rows":[{"id":"xl1008-d9"}]}`, יציאה 0.
Network secret שני (18/10/2026, C20): Host `api.supabase.com`, מפתח Supabase מוגבל (`claude-staging`, scoped PAT) לפרויקט הניסוי `ldzbjbsumzqjyvtpiwqo` בלבד: Project Settings קריאה, Database ו-Auth Config כתיבה. החי מחזיר 403. **תוקף 24 שעות** מ-18/10/2026: אחרי זה לא עובד, ומפתח חדש נוצר רק כשיש משימה (supabase.com/dashboard/account/tokens, אותן הרשאות). **פג ב-19/10/2026, והסוד עדיין בסביבה:** כל שיחה בסביבה (גם שיחות מתוזמנות) מקבלת `401 Invalid access token` מ-`api.supabase.com` (נמדד 04/11 ו-05/11/2026, בקשה `dev-20261105044520-gnvd`). לא לסמוך עליו. גישה למסד הניסוי בשיחה מתוזמנת רק דרך מחבר Supabase (MCP), ואם אין אותו בשיחה: הצ'אט הראשי. להעברה: אותו דבר בחשבון החדש.

---

## 2. Microsoft 365 (sviva@tapugan.co.il)

### Power Automate (https://make.powerautomate.com)
פירוט מלא, ביטויים ולקחים: `project-files/power-automate-mail.md`.

| זרימה | טריגר | מה עושה |
|---|---|---|
| קבצים מספקים לנכנס מהמייל | מייל חדש עם קובץ (תיבת דואר נכנס) | כל שולח חוץ מ-11 מוחרגים ו"הזמנת קניה"; שומר קבצים מצורפים (בלי תמונות, וידאו, ics, zip) ב-`_נכנס מהמייל` |
| קבצים ממייל לפי בקשה | קובץ חדש ב-`_אוטומציה\_בקשות מהמייל` | קורא מזהה מייל מהקובץ, Get email (V2), שומר את הקבצים המצורפים ב-`_נכנס מהמייל` |
| טיוטות מהעוזר (20/10/2026, C23) | קובץ חדש ב-`_אוטומציה\_טיוטות למייל` | קורא JSON מהקובץ ושומר טיוטה ב-Outlook של מיכאל (`mail_draft`); אין שליחה |
| תורים ליומן (20/10/2026, C24) | קובץ חדש ב-`_אוטומציה\_תורים ליומן` | קורא JSON מהקובץ ויוצר אירוע ביומן של מיכאל (Create event V4), בלי מוזמנים |
| הזזות ביומן (25/10/2026, C47) | קובץ חדש ב-`_אוטומציה\_הזזות ביומן` | קורא JSON מהקובץ ומזיז אירוע ביומן של מיכאל (PATCH של start ו-end בלבד, `power-automate-mail.md` זרימה 7) |
| טיוטות מהעוזר: דיווח מזהה (06/11/2026, C76; שינוי בזרימה 3, עדיין לא בוצע) | אותו טריגר של זרימה 3 | אחרי יצירת הטיוטה כותבת קובץ `{id, subject}` בשם קובץ הבקשה ל-`_אוטומציה\_טיוטות שנוצרו`; השרת דורש `id` זהה בהעברה לפח (`power-automate-mail.md` זרימה 3) |
| טיוטות למחיקה (26/10/2026, C49) | קובץ חדש ב-`_אוטומציה\_טיוטות למחיקה` | קורא JSON, בודק שזו עדיין טיוטה עם אותו נושא, ומעביר אותה לפריטים שנמחקו (`power-automate-mail.md` זרימה 8) |
| זימונים (26/10/2026, C51, נבנתה ואומתה) | קובץ חדש ב-`_אוטומציה\_זימונים` | קורא JSON ויוצר פגישה ביומן של מיכאל עם מוזמנים (אירוע Graph); Outlook שולח את ההזמנות (`power-automate-mail.md` זרימה 9) |
| החלפות באתר iso (31/10/2026, C67) | קובץ חדש ב-`_אוטומציה\_החלפות iso` | קורא JSON, מעלה קובץ מ-OneDrive לאתר iso בלי דריסה ומעביר קובץ שם בלי דריסה (SharePoint REST, `power-automate-mail.md` זרימה 10) |
| העברות מייל כטיוטה (02/11/2026, C73, נבנתה ואומתה 02/11/2026; 7 כשלונות ב-01-08/11, C79) | קובץ חדש ב-`_אוטומציה\_העברות מייל` | קורא JSON ויוצר טיוטת העברה של המייל המקורי עם כל הקבצים, כולל zip (Graph createForward); אין שליחה (`mail_forward`, `power-automate-mail.md` זרימה 11) |
| קבצים ממיילים ששלחתי (20/10/2026, C24) | מייל חדש עם קובץ ב-Sent Items | אותן החרגות (על הנמענים) ואותם סוגים כמו הזרימה הראשונה; שומר ב-`_נכנס מהמייל` עם "נשלח" בשם |

להעברה: לבנות מחדש לפי `power-automate-mail.md` (Claude בכרום עשה את זה ב-11/10/2026). החיבורים: Office 365 Outlook, OneDrive for Business ו-SharePoint (זרימה 10) של החשבון, בלי אישור מנהל.

### תיקיות ש-אוטומציה תלויה בהן (OneDrive, `שולחן העבודה\ניהול בטיחות`)
| תיקייה | מי כותב | מי קורא |
|---|---|---|
| `_נכנס מהמייל` | זרימות 1, 2 ו-5 | `routine-mail-filing`, `od_move` |
| `_נכנס מהמייל\לא לתיוק` | `od_move` | `backup-od` (מוחק אחרי 30 יום) |
| `_אוטומציה\_בקשות מהמייל` | `mail_request` (השרת) | זרימה 2 |
| `_אוטומציה\_טיוטות למייל` | `mail_draft` (השרת) | זרימה 3 |
| `_אוטומציה\_תורים ליומן` | `wa-morning.js` (השרת, `calendarStep`; מה נכתב: `server_state.cal_sent`) | זרימה 4 |
| `_אוטומציה\_הזזות ביומן` | `cal_move` (השרת; מה נכתב: `server_state.cal_moved`) | זרימה 7 |
| `_אוטומציה\_טיוטות שנוצרו` | הזרימה בלבד (דיווח `id`); השרת קורא (`draftIds`), מצב: `server_state.drafts_id_live` | זרימה 3 |
| `_אוטומציה\_טיוטות למחיקה` | `draft_trash` (השרת; מה נכתב: `server_state.drafts_trashed`, ומה מותר: `drafts_made`) | זרימה 8 |
| `_אוטומציה\_החלפות iso` | `od_swap` עם `site:'iso'` ו-`iso_up` (השרת) | זרימה 10 |
| `_אוטומציה\_זימונים` | `cal_invite` (השרת; מה נכתב: `server_state.cal_invited`) | זרימה 9 |
| `מפתחות הסתרה` (07/11/2026, נוצרת בפעם הראשונה ב-`od_mkdir`) | העוזר: המפתח של עותק מוסתר, `tools/pii-redact.py` | מיכאל בלבד; השרת מסרב לצרף ממנה למייל או לוואטסאפ (`isPiiKey`) |
| `00_דוחות ומעקב\קטלוג מסמכים.xlsx`, גיליון Claude Log | Cowork | מיכאל |
| `Apps/Tapugan Safety/_Backups` (cron, monthly, photos, talks, code) | `backup-od` | שחזור. `code`: zip של שני המאגרים פעם בשבוע, 8 אחרונים (17/10/2026) |

### אפליקציית Azure (כניסת השרת ל-OneDrive ולמייל)
Client ID ו-Tenant: ב-`project-files/ONEDRIVE-SERVER-SETUP.md`. הרשאות delegated: `offline_access User.Read Files.ReadWrite Mail.Send` (`functions/_onedrive.js`, `SCOPES`). **בלי Mail.Read** (דורש אישור מנהל, DECISIONS 27/09/2026). הטוקן נשמר ב-Supabase, טבלה `oauth_tokens`; התחברות מחדש מהאפליקציה (מסך ההגדרות, חיבור OneDrive).

---

## 3. Cloudflare (פרויקט Pages `tapugan-safety`)

פריסה אוטומטית מ-`main`. **משתני סביבה וסודות** (Settings > Environment variables; שמות בלבד):

| שם | בשביל מה |
|---|---|
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | גישת השרת למסד |
| `ROUTINE_KEY` | `/api/routine-db` (Routines) |
| `ANTHROPIC_KEY` | `/api/claude` |
| `ONEDRIVE_CLIENT_ID`, `ONEDRIVE_CLIENT_SECRET`, `ONEDRIVE_TENANT_ID` | אפליקציית Azure |
| `TRUSTEE_NOTIFY_SECRET` | קריאות pg_cron לשרת, קישורי סגירה |
| `TRUSTEE_CODE`, `TRUSTEE_REMEMBER` | כניסת נאמנים |
| `GH_SKILLS_TOKEN` | המייל השבועי קורא את תור העוזר ב-michael-skills; `backup-od` מוריד איתו את ה-zip השבועי של michael-skills (17/10/2026) |
| `GEMINI_API_KEY`, `GEMINI_MODEL`, `TTS_MODEL`, `TTS_VOICE` | הקראה בקול |
| `AZURE_VISION_ENDPOINT`, `AZURE_VISION_KEY` | זיהוי טקסט בסריקות (`ocr_txt`, 24/10/2026). משאב Azure AI Vision בשכבה החינמית F0, `tapugan-ocr`, West Europe (C41). מפתח חדש: Azure Portal, המשאב, Keys and Endpoint |
| `META_ACCESS_TOKEN`, `META_PHONE_NUMBER_ID`, `META_WABA_ID` | וואטסאפ |
| `WA_PIN` | ה-PIN בן 6 הספרות של מספר העוזר (24/10/2026): השומר (`_watchdog.js`) רושם מחדש לבד מספר שנפל ל-PENDING, פעם בשעה לכל היותר; גם `wa_phone` step register. מיכאל מדביק אותו (C42) |
| `VAPID_PRIVATE` (לא בשימוש) | בוטל 25/10/2026 לפני שהוגדר: השרת יוצר את זוג מפתחות ההתראות בעצמו ושומר ב-`server_state` (`vapid_keys`, רק מפתח השירות קורא), כי הסוד לא צריך לעבור דרך שיחה. אם יוגדר יחד עם `VAPID_PUBLIC`, הוא גובר (`_push.js`). המנויים: `chat_push_subs`. מצב "רק לצ'אט": `wa_owner_mode` = `chat` |
| `META_APP_SECRET`, `WA_VERIFY_TOKEN`, `ASSISTANT_FIRE_URL`, `ASSISTANT_FIRE_TOKEN`, `ASSISTANT2_FIRE_URL` ו-`ASSISTANT2_FIRE_TOKEN` (מ-29/10/2026: ה-API trigger של `trig_01UQJ7GvXnce9wX8h2tShTQn` בחשבון ה-Gmail, נבחר בדגל `assistant_account`), `POSTMAN_FIRE_TOKEN` (מ-C27: הטוקן של הדוור `trig_01Py8YXifD3HtnQUmFgoTRft`, ל-`relay_fire`), `RUNNER_FIRE_TOKEN` (מ-C35, 22/10/2026: הטוקן של המפתח התורן; לא בשימוש, `RUNNER_RUNS` = false), `DEV_FIRE_TOKEN` (מ-C31: הטוקן של "פיתוח מיידי" `trig_0114iVUybrBb6vRqZt1EyoyL`, ל-`dev_request`), `WORKER_FIRE_TOKEN` (מ-C33, כשיישמר: הטוקן של "עובד לפי דרישה" `trig_011UyDNeQ1NV72NNyXJxwxtE`, ל-`worker_now`) | העוזר בוואטסאפ (19/10/2026): חתימת ה-webhook של Meta, אימות ה-webhook, וה-API trigger של `trig_01TofqtqNWtrXMnqiNjHq1nZ`. `WA_VERIFY_TOKEN` ו-`ASSISTANT_FIRE_URL` נכתבו דרך ה-API; השניים האחרים רק מיכאל (ערכים ש-Meta ו-claude.ai מראים פעם אחת) |
| `RESEND_KEY`, `RESEND_FROM` | מייל גיבוי |
| `VITRE_API_KEY_ID`, `VITRE_API_KEY_SECRET`, `VITRE_NOTIFY_CREATED_BY`, `VITRE_NOTIFY_ENABLED`, `VITRE_PHOTO_KEY`, `VITRE_PHOTO_TEMPLATE` | Vitre |
| `ALLOWED_COUNTRIES`, `ALLOWED_ORIGINS`, `SUBREQ_LIMIT` | הגבלות |

**המספר של העוזר נפל (24/10/2026):** `wa_me` החזיר 133010, `wa_check` הראה `phone.status` PENDING ו-platform NOT_APPLICABLE. זה מספר הבדיקה של Meta (בלי SIM), ולכן בלי קוד SMS: `routine-db.sh '{"op":"wa_phone","step":"register","pin":"<6 ספרות>"}'` החזיר CONNECTED / CLOUD_API, והודעת בדיקה עברה. ה-PIN (האימות הדו-שלבי של המספר) אצל מיכאל, לא ב-repo. `request_code` במספר הזה נכשל (136024) ואינו נדרש.

**אישור מסירה בוואטסאפ (07/11/2026, רעיון 13):** ה-webhook של Meta (`/api/wa-hook`, מנוי לשדה `messages` באפליקציה ב-Meta) מקבל גם סטטוסים של הודעות שהשרת שלח; נבדק במסד 07/11/2026: `server_state.wa_status_last` נכתב 7 שניות אחרי `wa_meta_out`. אין צורך בשינוי מנוי. `failed` של הודעה למיכאל = מייל לתיבה שלו (חיבור ה-Microsoft של השרת, `Mail.Send`), ו-`delivered` נרשם (`notifications_log` `wa_delivery`). מצב: `server_state` `wa_fail_pending`, `wa_fail_mail_last`.

Worker נפרד: `tapugan-backup-cron` (`workers/backup-cron.js`), גיבוי יומי לבאקט ב-Supabase. סודות שלו: `SUPABASE_SERVICE_KEY`, `MANUAL_KEY` (רק להפעלה ידנית של `/run`; שום אוטומציה לא משתמשת בו. הערך הישן היה גלוי ב-`INFRA-2026-05-06.md` עד 11/10/2026, הוסר מהקובץ ונשאר בהיסטוריית git: להחליף ב-Cloudflare).

---

## 4. Supabase (`znhjtpcltrxxyfjczgvw`)

הסכמה: `migrations/*.sql` ב-repo. **pg_cron** (נמדד 11/10/2026, שעות UTC):

| job | מתי | מה |
|---|---|---|
| `backup-od` | 03:30, 04:30 | גיבוי ל-OneDrive, וניקוי "לא לתיוק" |
| `vitre-sync` | 03:00, 04:00 | סנכרון Vitre |
| `xlsx-gaps` | 03:05 | בונה את לוח הבקרה ב-Excel מהאפליקציה (מ-28/10/2026; עד אז פערים מול ה-Excel) |
| `weather` | 14:07 | מזג האוויר של מחר (התחזית של השירות המטאורולוגי, שדרות), שורה במסך הבית. נכנס כשה-migration `2026-10-15_weather_cron.sql` רץ |
| `registry_probe` | 05:23 שלישי | בודק ש-data.gov.il (פנקס הקבלנים ומרשם האסבסט) עונה עם השדות שכרטיס הקבלן קורא; תקלה או בדיקה ישנה מ-8 ימים = שורה במייל השבועי. נכנס ב-migration `2026-11-08_ctr_cid.sql` (08/11/2026) |
| `wa-morning` | 04:47, 05:47 א'-ה' | עדכון הבוקר בוואטסאפ מהשרת (`/api/wa-morning`); נשלח רק בקריאה שנופלת על 07:xx בישראל, פעם ביום. בראשון מצורפת אליו רשימת ההודעות שנשמרו בשישי-שבת (`server_state.weekend_held`, 06/11/2026). נכנס כשה-migration `2026-10-20_wa_morning_cron.sql` רץ |
| `od-scan` | 02:50 | קבצים חדשים בתיקיית הבטיחות |
| `weekly-digest` | א' 04:00, 05:00 | המייל השבועי |
| `talk-week` | א' 02:17 | שיחת הבטיחות השבועית |
| `anon-users-cleanup` | א' 02:13 | ניקוי משתמשים אנונימיים |
| `db-columns-check` | 1 לחודש 02:41 | שינויי עמודות |
| `hazard-file-retry`, `trustee-log-retry` | כל 15 דק' | ניסיון חוזר לתיוק |

**רשימת העבודות לשישי (05/11/2026, `functions/api/works.js`):** קישור חתום לכל יום שישי (`works-link:v1`, 8 ימים) שרכזת האחזקה ממלאת; כל עבודה שורה ב-`ptw` (`wk-<שישי>-<מספר>`, "ממתין לאישור"). השעון של `wa-morning` (watch, כל 5 דקות) שולח את הקישור ברביעי 18:00, מזכיר למיכאל בחמישי 12:00, ומודיע ביום ראשון 08:00 על היתרים שלא נסגרו. אישורים מצורפים: בדלי `incidents-photos` (פרטי) תחת `works/<שישי>/<מספר>/`; להעברה: להעתיק את התיקייה. מפתחות ב-`server_state`: `works_mail_on` (כבוי עד שמיכאל מאשר את נוסח המייל), `works_mail_to` (הנמענים, JSON `{to, cc}`, רק כתובות בדומיין החברה; הכתובות במסד ולא בקוד הציבורי), `works_mail_last`, `works_remind_last`, `works_open_last`, `works_sub`. להעברה: להעתיק את ששת המפתחות.

ה-jobs קוראים לשרת עם `TRUSTEE_NOTIFY_SECRET` (שמור ב-Supabase Vault / בגוף ה-job). להעברה: להריץ את ה-migrations שיוצרים אותם (`grep -l "cron.schedule" migrations/`).

**קבצים בדלי `backups` שהשרת תלוי בהם** (לא ב-repo; 21/10/2026): `owner-signature/sig.png` = החתימה של מיכאל לחתימה על PDF (`functions/_sign.js`, `SIGN_OBJ`). בלעדיה כל "בצע" על בקשת חתימה עונה "תמונת החתימה עוד לא נשמרה בשרת". בהעברה: להעתיק את הקובץ לאותו נתיב (Storage > backups). `induction-docs/` של שיחת הבטיחות (`talk.js`, `DOCS_DIR`).

### מחשב העבודה ב-Azure (חשבון פרטי של מיכאל, לא של תפוגן)
- **חשבון:** חשבון Microsoft פרטי על ה-Gmail של מיכאל, Default Directory, "Azure subscription 1" (ניסיון, 13/10/2026; הקרדיט נגמר בערך 12/11/2026). מנהלים מפרופיל הכרום "Azure פרטי".
- **משאבים** ב-`tapugan-claude-rg`, Israel Central: המחשב `tapugan-claude` (Standard_B2als_v2, Windows Server 2022 Azure Edition smalldisk, משתמש `michael-vm`), דיסק 64GB, IP ציבורי קבוע `tapugan-claude-ip`, `tapugan-claude-nsg` (RDP רק מהכתובת של מיכאל), VNet `vnet-israelcentral-1`. תקציב `tapugan-claude-budget`, 15 דולר.
- **בלי כיבוי אוטומטי** (לא זמין באזור): Stop אחרי כל שימוש. התכנון וההחלטה: `work-vm-plan.md`, `work-vm-setup.md`, `work-vm-trial.md`.
- **להעברה:** אין מה להעביר מה-repo. מחשב חדש לפי `work-vm-setup.md`. הסיסמה אצל מיכאל בלבד.
- **סוף (14/10/2026, מיכאל):** לא בשימוש ולא נמחק ביד. בלי Upgrade המנוי נעצר לבד בסוף הניסיון (בערך 12/11/2026) ונמחק עם כל המשאבים עד 90 ימים אחר כך, בלי חיוב. **לא ללחוץ Upgrade.** מיילים מ-Azure על השבתה ומחיקה צפויים. כשהמנוי נמחק: להוריד את הסעיף הזה.

### אפליקציות GitHub (חשבון mishaf1988-lgtm, Settings, Applications; נבדק 13/10/2026)
- **בשימוש:** Claude (העבודה על הקוד מהשיחות), Claude Design Import, Cloudflare Workers and Pages (פריסה מ-main).
- **הוסר 13/10/2026:** Cursor (לא בשימוש, כתיבה לכל המאגרים, ביקש 7 הרשאות נוספות), Vercel (הפרויקט נמחק 21/09/2026), Netlify (מושהה). Cursor ו-Netlify Auth בוטלו גם ב-OAuth (C12, 13/10/2026).
- **Authorized GitHub Apps** (התחברות, לא התקנה): גם ChatGPT Codex Connector, Copilot Chat App, Copilot SWE Agent, Manus Connector. **OAuth Apps:** Cloudflare, Supabase, Resend, DigitalOcean, Ollama, GitHub CLI, Git Credential Manager, GitHub iOS. מיכאל השאיר אותם (13/10/2026); לא בשימוש של המערכת הזו.
- אפליקציה חדשה עם גישה לקוד נרשמת כאן באותו PR.

---

## 5. בדיקה אחרי העברה
1. `list_triggers`: כל השורות בטבלה בסעיף 1, `enabled`.
2. `bash project-files/routine-db.sh '{"op":"select","table":"docs","query":"select=id&limit=1"}'` יוצא 0.
3. מייל עם PDF מספק: תוך דקות ב-`_נכנס מהמייל`.
4. `select jobname from cron.job`: כל השורות בסעיף 4.
5. המייל של יום ראשון מגיע, ושורת "תקין" בתחתית מונה את כל הסוכנים.
