# Routine שבועי: האם ההדרכה השבועית פורסמה

**הטריגר הפעיל (20/10/2026, לפי `ACCOUNT-INVENTORY.md`):** `trig_015zHPtWJFZP77uqRzL5wfBA` (שיחה `session_01HK2YJUpeGksTy3KHZ2sGCm`). מזהים אחרים בקובץ הם היסטוריה; לפני `fire_trigger` או `update_trigger`: `get_trigger` על המזהה.

מיכאל, 18/10/2026, בשאלון: "בצע: תזכורת פרסום ביום ראשון". הרקע: הטיוטות של 11/10 ושל 18/10/2026 נוצרו לבד (`private.talk_week`, א' 02:17 UTC) ונשארו טיוטה. אף עובד לא קרא אותן. הטיוטה לא מתפרסמת לבד (DECISIONS 10/10/2026: פרסום שולח עובדים לחתום על טקסט שאיש לא קרא), ולכן הסוכן רק מזכיר.

**ה-Routine:** ייפתח מהשיחה הבאה. א' 12:13 (`CRON_TZ=Asia/Jerusalem 13 12 * * 0`), אחרי "הדרכה שבועית מהשטח" (05:53). שם הסוכן: `talk-publish`.

---
0. ידע משותף: קרא את project-files/agent-common.md, סעיפי "פתיחה" ו"ידע משותף". בסוף: סעיף "סגירה" (שם הסוכן: talk-publish).
ריצה חדשה של משימה מתוזמנת: לבצע מההתחלה. כל הודעה בעברית, בלי מקף ארוך, תאריכים DD/MM/YYYY. בלי כתיבה בשום מקום חוץ מ-agent_report.
1. המזהה של השבוע: w ואחריו תאריך יום ראשון האחרון (היום, אם היום ראשון) בשעון ישראל, YYYYMMDD.
2. `bash project-files/routine-db.sh '{"op":"select","table":"toolbox_talks","query":"select=id,s,trainer,trainer_qual&id=eq.<המזהה>"}'` (יציאה 3 או ok:false: execute_sql, project_id znhjtpcltrxxyfjczgvw).
3. agent_report:
   - אין שורה: ok:false, line "הטיוטה <המזהה> לא נוצרה (talk_week לא רצה?)".
   - s = פורסמה: ok:true, line "ההדרכה של DD/MM/YYYY פורסמה".
   - s = טיוטה: ok:true, line "ההדרכה של DD/MM/YYYY עדיין טיוטה. מחכה למיכאל: לפרסם (שטח, הדרכות, עין, ערוך, שמור ושלח)<, בלי מדריך וכשירות אם ריקים>".
4. הודעה אחרונה: אותה שורה.
---


**18/10/2026: עבר לרכז המסמכים** (מיכאל בשאלון: "בצע: לפי תחום"): `trig_019ETBjyiSvoqVzFVtCcavmG` לתוך `session_01Wu6gzvUs3SYbLQ5fiaGayV`; הקודם `trig_01HVj1UxeRaYm1btAAsuwDHW` כובה.
