---
name: tfugen-guides
description: How the user guides of the tfugen-safety app are built and kept true - the trustee guide and the training guides (HR, department managers), real screenshots with numbered red rings, a PDF and a WhatsApp card built by a script that refuses a missing picture, an overflowing page or a non-keyboard character. Load when a screen a guide shows changes, when Michael asks for a guide or a quick card for any audience, or when a guide PDF is rebuilt.
---

# מדריכי משתמש: איך בונים ואיך שומרים שהם נכונים

מיכאל, 10/10/2026: "מאשר" להצעה לרכז את הידע הזה. שני מדריכים קיימים, ושניהם נבנים באותה שיטה.

| מדריך | תיקייה | צילומים | בנייה |
|---|---|---|---|
| נאמני בטיחות | `project-files/guide-trustees/` | `tools/guide-shots.js` (האפליקציה, `index.html`) | `build-pdf.js` שם |
| משאבי אנוש + מנהלים | `project-files/guide-training/` | `tools/guide-talk-shots.mjs` (דף העובד, `functions/api/talk.js`) | `build-pdf.js` שם |

```bash
NODE_PATH=$(npm root -g) node tools/guide-talk-shots.mjs            # או guide-shots.js
PREVIEW=<scratchpad>/prev NODE_PATH=$(npm root -g) node project-files/guide-training/build-pdf.js
```

## הכללים (כל אחד מטעות שקרתה)

1. **מסך השתנה = לצלם מחדש לפני שמתקנים טקסט.** מדריך שמצביע על כפתור שזז גרוע ממדריך שלא קיים. 10/10/2026: כפתור "הקרא בקול" הפך לגלוי בכל טלפון, והצילום `w1-open` ומשפט במדריך שונו באותו PR.
2. **המספר על התמונה = מספר הצעד בטקסט.** הטבעת והמספר מצוירים בסקריפט, לא באפליקציה. צעד בלי מספר (`n: null`) כשאין מה להבדיל, או כשמספר היה מחייב לצלם מחדש את כל מה שאחריו.
3. **לגלול, לחכות, ורק אז למדוד את הטבעת** (`position:fixed`). טבעת מחוץ למסגרת = הסקריפט מסרב לכתוב.
4. **רק תווים שיש במקלדת** בכל מה שאדם קורא (`KEYBOARD_ONLY`). אימוג'י מותר, כי הוא מה שכתוב על הכפתור. ברשימה, תו בלתי נראה נכתב כ-escape (`' '`): ב-10/10/2026 רווח קשיח הועתק כרווח רגיל, והבדיקה תפסה 898 רווחים.
5. **עמוד הוא קופסה בגובה קבוע.** עמוד שגולש = הבנייה נעצרת, לא חותכת בשקט. תמונה קצרה (מסך "תודה") נחתכת לגובה התוכן (`crop`), אחרת היא נראית כמו טלפון אפור וריק.
6. **נתונים בדויים בצילום, טקסט אמיתי.** שמות עובדים בדויים (המדריך נראה בכל המפעל), אבל התוכן מהטיוטות האמיתיות של מיכאל, כדי שמה שבמדריך הוא מה שהעובד יראה.
7. **עובדות מהקוד כתובות ליד המקור** (14 יום = `TALK_TTL_DAYS`, נמען = `IND_HR`). שינוי שם = לעדכן במדריך. הרשימה בראש `build-pdf.js` וב-README.
8. **לפני ששולחים מדריך: הדבר שהוא מתאר קיים באוויר.** המדריכים של 10/10 הראו הדרכות מפורסמות כשהן היו טיוטות. ב-STATUS נכתב "לשלוח רק אחרי פרסום".
9. **לבדוק כל עמוד בעין** (`PREVIEW`): כתובת מייל באנגלית בתוך עברית נשברת בין שורות (`dir="ltr"` עם `unicode-bidi:isolate`).

## מדריך חדש לקהל חדש

- קודם לבדוק אם לקהל יש משתמש באפליקציה (`app_users`, `role`). למנהלים ולמשאבי אנוש אין, ולכן המדריך שלהם מצלם את הדף שהם פוגשים, לא את האפליקציה.
- לשאול את מיכאל בשאלון רק על מה שמשנה את התוכן (מי מפיק את הקישור, PDF או כרטיס). המבנה הקבוע: עמוד שער עם "בשורה אחת", צעדים עם תמונה, "נתקעתם?", "יש לכם הערה?".
- כרטיס מהיר (PNG אחד) לוואטסאפ, למי שלא יפתח PDF.

