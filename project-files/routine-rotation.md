# Routine שבועי: המגייס מחליף לכל עובד את השיחה

מיכאל, 18/10/2026: "אם יש לך דרך לייעל את התהליך או להפוך אותו למהיר ואיכותי יותר, הצע לי שיטה", ובשאלון: "בצע: שיחה חדשה שבועית לכל עובד (מומלץ)". כל עובד הוא שיחה קבועה, וההקשר שלה גדל עם כל ריצה (ב-18/10/2026: כ-450 עד 520 אלף טוקנים), וכל הודעה וכל ריצה קוראות אותו מחדש. שיחה חדשה עם קובץ העברה קצר מתחילה בעשרות אלפים.

**למה מגייס:** שיחה שנפתחת מטריגר נקי (`create_new_session_on_fire`) לא מקבלת את כלי השיחות (ניסוי `trig_016qhxqqRhzzUcCWYmKTpsw2`, 18/10/2026: אין `create_session`, `send_message`, `get_session`). ושיחה שפותחת את הבאה מוסיפה דור, עד תקרה של 8. לכן שיחה אחת קבועה, "המגייס", שמיכאל פתח ביד (דור 1), פותחת את כל העובדים החדשים (דור 2, כל שבוע מחדש) ולא מתחלפת בעצמה. ההקשר שלה קטן: רק הריצות השבועיות האלה.

**המפה:** מסמך `meta/workers` בארטיפקט https://claude.ai/artifact/AmxFowGHYDqyhd1sE9qphi, שדה `sessions` (שם העובד > מזהה השיחה), ו-`rotated_at`. העמוד, הדוור ועדכון הבוקר קוראים ממנו.

**ה-Routine:** ו' 13:07 שעון ישראל (`CRON_TZ=Asia/Jerusalem 7 13 * * 5`; אין ריצה של עובד בין 12:30 ל-14:00 בשישי), לתוך השיחה של המגייס. המגייס יוצר אותו בעצמו בפתיחה (צעד 0).

---
0. ידע משותף: קרא את project-files/agent-common.md, סעיפי "פתיחה" ו"ידע משותף". המגייס לא כותב בלוג; הדוח שלו הוא ההודעה האחרונה והשורות במשרד.
0א. פעם ראשונה בלבד (אין טריגר בשם "המגייס: החלפה שבועית" ב-list_triggers): create_trigger עם השם הזה, cron `CRON_TZ=Asia/Jerusalem 7 13 * * 5`, persistent_session_id = השיחה הזו (get_session בלי מזהה), ופרומפט: "ריצה חדשה של המגייס: git fetch origin main && git checkout -B main origin/main, קרא את project-files/routine-rotation.md ובצע את מה שבין הקווים, מצעד 1." ואז לרשום את המזהה בטבלת ה-Routines ב-ACCOUNT-INVENTORY.md ב-PR, ולסיים.
1. ArtifactData get על `meta/workers`. לכל עובד ב-`sessions` (מנהל התפעול אחרון, כי הוא צופה בעמוד):
   א. send_message לשיחה הישנה: "[המגייס] סוף שבוע: כתוב קובץ העברה של עד 40 שורות: מה פתוח, מה מחכה למיכאל, מה למדת השבוע שלא כתוב ב-agent-common.md, ואיזה כלים עבדו ואיזה לא. ArtifactData set על https://claude.ai/artifact/AmxFowGHYDqyhd1sE9qphi, collection handoffs, doc_id <שם העובד בלי רווחים>, עם {text, at}. אין לך ArtifactData: שלח לי את הטקסט ב-send_message. אחר כך אל תתחיל משימה חדשה." לחכות עד 15 דקות (get_session פעם בדקה דרך Monitor, לא sleep בחזית) שהשיחה תסיים.
   ב. create_session: title "תפוגן: <שם העובד> (Routine, לא לארכב)", tags ["tapugan"], source_url https://github.com/mishaf1988-lgtm/tfugen-safety (עובד של קו העסק, שהמאגר של השיחה הישנה שלו הוא safety-platform, כמו מנהל השיווק מ-18/10/2026: title "עסק: ...", tags ["business"], source_url של safety-platform, ובפרומפט CLAUDE.md ו-handoff.md במקום agent-common.md; קבצים של תפוגן לא נכנסים לשיחה שלו), model = configured_model של השיחה הישנה, ופרומפט: "אתה <שם העובד> במשרד הסוכנים של תפוגן, ממשיך את השיחה <הישנה>. קרא את CLAUDE.md, את project-files/agent-common.md, ואת קובץ ההעברה שלך: ArtifactData get handoffs/<שם> על https://claude.ai/artifact/AmxFowGHYDqyhd1sE9qphi. מנהל התפעול בלבד: גם ArtifactComments watch על אותו ארטיפקט, ואימות ב-watch בלי url. בסוף: שורה אחת 'מוכן'. המשימות שלך יגיעו מהטריגרים."
   ג. list_triggers enabled=true: לכל טריגר עם persistent_session_id = הישנה: create_trigger עם אותו שם, cron (או run_once_at), ופרומפט, לתוך החדשה; ואז update_trigger על הישן enabled=false (מחיקה חסומה במסווג, 18/10/2026).
   ד. מנהל התפעול: send_message לישנה "[המגייס] ArtifactComments watch עם on false על המשרד, ואז סיימת". לחכות לסיום.
   ה. archive_session לשיחה הישנה, רק אחרי שהחדשה ענתה "מוכן" (list_events, kinds ["result"]).
2. ArtifactData update על `meta/workers`: `sessions` עם המזהים החדשים, `rotated_at` = עכשיו.
3. PR אחד: ACCOUNT-INVENTORY.md (המזהים החדשים של השיחות והטריגרים), בתיאור "בלי לקח: החלפה שבועית", "רטרו: <משפט>", "skill: אין"; ci-wait ומיזוג.
4. עובד שנכשל באחד הצעדים: להשאיר אותו בשיחה הישנה (בלי לכבות טריגרים), ולכתוב ב-`chat` שורה {worker: <העובד>, from: "worker", by: "המגייס", text: "ההחלפה השבועית נכשלה: <למה>", at}. כך זה מופיע במשרד.
4א. **החלפה מוקדמת** (18/10/2026, מיכאל בשאלון: "בצע: ... החלפה מוקדמת"): הודעה "[החלפה מוקדמת] <שם העובד>" מהדוור (`routine-chat-relay.md` 4א). לבצע את צעד 1 א-ה לעובד הזה בלבד, ואז ArtifactData update על `meta/workers`: `sessions.<שם>` = החדשה ו-`early.<שם>` = התאריך של היום (בלי לגעת ב-`rotated_at`), ואז צעד 3. העובד עובד ברגע שהגיעה ההודעה: לחכות לסיום (get_session פעם בדקה, עד 30 דקות), אחרת צעד 4.
5. אסור: מייל, כתיבה ב-365, מחיקה של טריגר או שורה, שינוי קוד מעבר ל-ACCOUNT-INVENTORY.md.
6. הודעה אחרונה, שורה אחת: כמה עובדים הוחלפו, כמה נכשלו.
---
