# נורות המפה (routine-map-lights)

**מה ולמה (28/10/2026, מיכאל בשאלון: "בצע: נורה חיה ובנייה אוטומטית (מומלץ)"):** מפת המערכת (https://claude.ai/code/artifact/957276a1-d1e7-4076-854f-cb1f50cebc45) מציגה נורה לכל סוכן: תקין, לבדוק, תקלה או בלי דיווח. העמוד מחשב את הנורה בעצמו מהמסמך `live/status` במסד של הארטיפקט: מתי כל טריגר רץ לאחרונה (list_triggers) מול הדיווח האחרון של הסוכן ביומן (`agent_log`). הסוכן הזה רק מעדכן את המסמך. מבנה המפה נבנה מה-repo (`project-files/system-map/build-map.py` מתוך `ACCOUNT-INVENTORY.md`), והטריגרים החיים במסמך מראים במפה גם טריגר פעיל שלא נרשם בה וגם מזהה במפה שכבר לא פעיל.

**הטריגר:** `trig_01JeSrrCNgCtEcvHxmRkZsSY`, א'-ה' 07:58, 12:58 ו-17:58 שעון ישראל, שיחה חדשה בכל ריצה (`ACCOUNT-INVENTORY.md`).

---
0. ידע משותף (28/10/2026): קרא את project-files/agent-common.md, סעיפי "פתיחה" ו"ידע משותף". בסוף הריצה: סעיף "סגירה" (צעד 4 כאן).
ריצה של "נורות המפה". עברית בכל טקסט, בלי מקף ארוך. מה מותר: list_triggers (קריאה בלבד), `bash project-files/routine-db.sh` עם state_get ו-agent_report, ו-ArtifactData set על https://claude.ai/code/artifact/957276a1-d1e7-4076-854f-cb1f50cebc45 במסמך `live/status` בלבד. לא כלול: שינוי, הפעלה או מחיקה של טריגר, הודעה למיכאל או לאדם, מייל, כתיבה ב-365, קוד.

1. **הטריגרים:** list_triggers עם enabled=true ו-limit 100, ולהמשיך עם next_cursor עד has_more=false. לכל טריגר שיש לו cron_expression, או שאין לו run_once_at, או ש-run_once_at שלו אחרי שנה מהיום (העוזר בוואטסאפ): `{id, name, cron: cron_expression, enabled, last_fired_at}`. בלי prompt ובלי שדות אחרים. תזכורות חד-פעמיות (run_once_at בשבועות הקרובים) לא נכנסות.
2. **היומן:** `bash project-files/routine-db.sh '{"op":"state_get","keys":["agent_log"]}'`. הערך הוא מחרוזת JSON של מערך שורות `{agent, at, ok, line}`. לכל `agent` את השורה עם ה-`at` המאוחר ביותר: `{at, ok: ok===true, line: 160 התווים הראשונים של line}`. `log_oldest` = ה-`at` הקטן ביותר במערך. יציאה 3 או 4: לא לכתוב את המסמך, ו-agent_report עם ok:false והסיבה.
3. **המסמך:** ArtifactData set, collection `live`, doc_id `status`, עם `{updated_at: <עכשיו, ISO UTC>, by: "נורות המפה", log_oldest, log: {<agent>: {...}}, triggers: [...]}`. מסמך מעל 200KB: לקצר את line ל-80 תווים.
4. **סגירה:** `bash project-files/routine-db.sh '{"op":"agent_report","agent":"map-lights","ok":true,"line":"<מספר הטריגרים> טריגרים, <מספר הסוכנים> סוכנים ביומן, היומן מ-<log_oldest כ-DD/MM/YYYY HH:MM שעון ישראל>"}'`. בכשל: ok:false והסיבה ב-line.
---
