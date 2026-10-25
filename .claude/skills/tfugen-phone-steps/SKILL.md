---
name: tfugen-phone-steps
description: How to hand Michael a step he must do himself on his phone (create a GitHub repo, add a secret, approve an app, change a setting Claude has no access to) in the tfugen-safety work - first try it yourself and show the refusal, then one Artifact page with a direct link button, a drawn screen with numbered red rings marked as a drawing, how to know it worked, and what to do if it does not; afterwards verify it yourself. Load whenever Michael says "תראה לי", "תמונות", "קישורים", "פתח לי אתה", or a task stops on an action only he can take.
---

# צעד שרק מיכאל יכול לעשות: דף הוראות לטלפון

נכתב 17/10/2026 (מיכאל: "פתח הראות ותמונות ולינקים מה לעשות", ואז "מאשר" על ההצעה ל-skill הזה). המקרה: פתיחת `safety-platform` ב-GitHub. `create_repository` נדחה ב-403 ("Resource not accessible by integration"), ומיכאל פתח את ה-repo מהטלפון לפי הדף בדקה אחת (ארטיפקט `8UWnpgCE4GLKYkx2uPhRRy`).

## קודם: מיכאל מול המחשב = טקסט לכרום (18/10/2026)
מיכאל: "ברגע שאני על המחשב, תרשום הוראות לכרום לבצע את כל זה, ואל תסביר לי איך לעשות את זה. אם כרום כבר לא יכול לעשות את זה, אז אני אשתתף בפעולה". לכן כשהוא במחשב: בלוק אחד להדבקה ב-Claude בכרום (משימה ממוספרת, קישור, ערכים, נקודות עצירה, "דווח"), ונרשם ב-`chrome-queue.md`. בלי הסבר איך לעשות. החלק של מיכאל רק במה שכרום מסרב לו (הקלדת או הדבקת ערך סודי), במשפט אחד. דף הוראות עם צילומים נשאר לטלפון, או כשכרום לא זמין.

## הסדר
1. **קודם לנסות לבד.** הכלי, ה-API (`tfugen-cloud-connect`), `read_documentation` על הנושא. רק כשנדחה: לכתוב למיכאל במשפט אחד מה נדחה ולמה (הקוד, למשל 403), לא "אין לי גישה" כללי.
2. **דף אחד** (Artifact, `quickstart` ואז HTML), לא רשימה בצ'אט. מיכאל בטלפון, בעברית, RTL.
3. **אחרי שהוא כותב "עשיתי":** לבדוק בעצמי (למשל `list_repos`: `visibility`, `can_push`; `tokens/verify`; `get_trigger`), ולכתוב מה נבדק. לא לבקש ממנו לאשר מה שאפשר לבדוק.

## מה בדף
- **כפתור עם קישור ישיר** לדף שבו עושים את הפעולה (`https://github.com/new`), כ-`<a href>` אמיתי. ליד: "בדפדפן, לא באפליקציה" כשהאפליקציה לא יודעת לעשות את זה.
- **כל ערך שמקלידים בכפתור "העתק"** (`navigator.clipboard.writeText` בתוך הלחיצה, ונפילה לסימון הטקסט).
- **איור של המסך** ב-HTML, עם טבעות אדומות ממוספרות ורשימה ממוספרת מתחת עם אותם מספרים. **מסומן "איור, לא צילום"** כשאין צילום אמיתי (מסך שדורש את החשבון שלו), ומשפט ש"ייתכן שהעיצוב אצלך שונה, השמות אותם שמות". אם אפשר לצלם באמת (מסך של האפליקציה שלנו): צילום, לפי `tfugen-guides`.
- **"איך יודעים שזה הצליח"**: איור של המסך שאחרי, ומה בדיוק לכתוב לי בצ'אט ("פתחתי").
- **"אם משהו לא מסתדר"**: 2-3 שגיאות צפויות, ולכל אחת מה עושים.
- **בטלפון:** לציין כשצריך לגלול כדי לראות את הכפתור.

## מקרים שכבר עבדו
- **מחבר לריצה (Routine)** (25/10/2026, C46): `create_trigger` עם `connectors` נדחה ("not available for this organization"), ובלעדיו הריצה נוצרת בלי מחבר (אזהרה "stores no MCP connectors"). מיכאל הוסיף מהטלפון: `claude.ai/code/routines/<trig_id>` בדפדפן, Edit, Connectors, Microsoft 365, Save (דף: `UAc3LoDAUYPKkyPo4yqkUi`). אימות: `get_trigger` מראה אותו ב-`mcp_connections`, ואז `fire_trigger` אחד ובדיקה של התוצאה במסד.

## כללי הטקסט
רק תווים שיש במקלדת (CLAUDE.md, טקסט לאנשים): בלי מקף ארוך, בלי « », בלי חצים, בלי תו כיוון נסתר (U+200E, נמצא ונוקה ב-17/10/2026). בדיקה מהירה לפני פרסום: `python3 -c` שמדפיס כל תו מעל U+2000 בקובץ.
