# DECISIONS — יומן החלטות

> יומן של החלטות ארכיטקטוניות וטכניות. **מטרה**: למנוע "החזרה לאחור" כשעוברים בין חשבונות Claude או כשClaude נכנס לסשן חדש.

**פורמט לכל החלטה**:
```
## YYYY-MM-DD — כותרת קצרה
**החלטה**: מה הוחלט
**סיבה**: למה
**אלטרנטיבות שנדחו**: מה לא נבחר ולמה
**קישורים**: PR / commit / issue
```

---

## 2026-04-21 — הפרדת הרשאות admin/emp ב-RLS (Vuln #7)
**החלטה**: החלפת ה-policy היחיד `authenticated_all` (מ-Vuln #2) בשני policies מופרדים על כל 22 הטבלאות:
1. `admin_all` — FOR ALL, רק כשה-JWT claim `is_anonymous` הוא FALSE או חסר (כלומר email sign-in בלבד).
2. `emp_insert` על 4 טבלאות בלבד (`near_miss`, `rounds`, `equip_inspections`, `tr`) — INSERT only, לכל `authenticated` (כולל anonymous).
Anonymous sessions (emp mode) לא יכולים SELECT/UPDATE/DELETE שום דבר, ולא יכולים INSERT לטבלאות מעבר לארבע. גם הסרתי את `sbSync()` מתזרים ה-startup של emp mode — הוא היה מחזיר [] לכל הטבלאות (אין SELECT) ועלול היה למחוק localStorage מקומי.
**סיבה**: לפני השינוי, עובד שטח שנכנס עם "דיווח מהיר" קיבל session anonymous עם הרשאות מלאות ל-DB דרך ה-policy הפתוח. מהקונסול יכל למחוק NCRs, לערוך סיכוני סביבה, לראות הכל. ה-admin login שנוסף ב-Vuln #6 היה רק מחסום UI.
**בדיקה נדרשת לאחר deploy**: אדמין עדיין רואה ועורך הכל; עובד יכול לשלוח 4 סוגי דיווחים; ניסיון של emp לגשת ל-`/rest/v1/ncr` מה-DevTools מחזיר []/403.
**אלטרנטיבות שנדחו**: (1) created_by + row-level ownership — דורש migration לכל הטבלאות. (2) שני anon keys שונים (emp/admin) — Supabase לא תומך. (3) פונקציית RPC מתווכת — overkill כשיש JWT claim מובנה.

---

## 2026-04-21 — החלפת סיסמה קשיחה ב-Supabase Auth (Vuln #6)
**החלטה**: הסרת `PW='Medwp123'` מהקוד. `doLogin()` מתחבר דרך `supabase.auth.signInWithPassword({email:'admin@tfugen.local', password})`. דגל `_isAdmin` in-memory מחליף את `sessionStorage[SK]===PW`. מצב עובד ממשיך לעבוד דרך `_sbAuth()` (anonymous sign-in) + `EMP_KEY` ב-localStorage. ה-session של Supabase נשמר אוטומטית ב-`localStorage` (`tfgn_sb_auth`).
**סיבה**: הסיסמה היתה בקוד המקור — נצפית על ידי כל מי שפתח DevTools. עכשיו האימות אמיתי, עם session JWT שפג.
**הגדרה חד-פעמית נדרשת**: Supabase → Authentication → Users → Add user. Email: `admin@tfugen.local`, Password: בחירת המשתמש, Auto-confirm: ON. בלי זה ה-login יישבר.
**אלטרנטיבות שנדחו**: (1) hash של הסיסמה ב-localStorage — עדיין client-side, אפשר לזייף. (2) API serverless לבדיקת סיסמה — דורש תחזוקה והקוד כבר משתמש ב-Supabase. (3) Magic link — דורש שרת מייל. (4) OAuth — overkill למשתמש יחיד.

---

## 2026-04-19 — הוספת skill `tfugen-ref` לחיסכון בטוקנים
**החלטה**: יצירת skill פרויקטי חדש ב-`.claude/skills/tfugen-ref/SKILL.md` עם: סכימות 21 הטבלאות, מספרי שורות של helpers מרכזיים ב-`index.html`, מילון עברית→\\uXXXX מוכן, ו-skeletons של VIEW_CONFIG/save/row. נטען אוטומטית לפי ה-description כשעורכים את `index.html`.
**סיבה**: הפחתת קריאות/greps חוזרות ל-`index.html` (~2500 שורות). כל משימת view חדשה דרשה ~200 שורות קריאה רק כדי להיזכר במבנה. צפי חיסכון 30-40% טוקנים במשימות סטנדרטיות.
**אלטרנטיבות שנדחו**: (1) הרחבת `tfugen-dev` הקיים — עמוס ולא ברור מתי לטעון. (2) skill קטן ל-Hebrew בלבד — פותר רק בעיה אחת. (3) plugin חיצוני — אין marketplace רלוונטי למבנה הפרויקט.

---

## 2026-04-19 — QR Stage A: ממשק עובד עם 4 כפתורי דיווח
**החלטה**: להוסיף "מצב עובד" כתת-תצוגה של אותו `index.html` — כשנכנסים עם `?emp=1` (או עם flag ב-localStorage), האפליקציה מציגה רק `pg-emp-home` עם 4 כפתורים גדולים: קרוב-לתאונה, תקלה בציוד, סבב בוקר, דיווח הדרכה. כל כפתור פותח את המודאל הקיים (`m-nm`/`m-eqi`/`m-round`/`m-tr`) — ללא שכפול לוגיקת שמירה. היציאה ממצב עובד דרך כפתור "עבור למימשק המלא".
**סיבה**: שלב ראשון בהחלפת Vitre — לאפשר לעובדי שטח לדווח תקלות/קרוב-לתאונה/סיום הדרכה מבלי להיחשף לכל ה-UI הניהולי. תואם לעקרון "אין תוכנה חדשה; תוספות על הקוד הקיים" (`.claude/plans/bubbly-strolling-wombat.md`).
**אלטרנטיבות שנדחו**: (1) אפליקציה נפרדת — דורש תשתית, נוגד את עקרון single-file. (2) הסתרת `.bnav` בלבד בלי דף ייעודי — העובד עדיין היה רואה KPIs ניהוליים. (3) מסך login נפרד לעובדים — מיותר לשלב A; Supabase Auth מגיע בשלב E.
**השלכות**: בעתיד, סטיקרי QR ליחידות ציוד (שלב B) ו-QR→דיווח תקלה ייחודי לפריט (שלב C) ישתמשו באותה נקודת כניסה עם פרמטרים נוספים (`?emp=1&eqid=…`).

---

## 2026-04-19 — Revert: הסרת Dashboard 2.0 Phase A
**החלטה**: הסרת 4 הגרפים (Chart.js) שנוספו ב-PR #16. הוסרו: HTML (`.dash-charts` block), CSS (`.dash-charts/.chart-card/.chart-wrap`), `<script>` CDN ל-Chart.js, וכל פונקציית `_dashCharts` + `_dashChartInst`. `rDash` חוזר להיות KPI tiles + alerts בלבד.
**סיבה**: החלטה של המשתמש — הגרפים לא סיפקו ערך מספיק או לא התאימו לזרימת העבודה היומיומית.
**אלטרנטיבות שנדחו**: להשאיר מכובה (feature flag) — מיותר; אם בעתיד ירצה, קל להחזיר מההיסטוריה.
**השלכות**: הוסרה התלות ב-Chart.js CDN. `rDash` יותר קל ומהיר.

---

## 2026-04-18 — Outbox hardening (hotfix): 3 באגים שגרמו לאובדן נתונים
**החלטה**: תיקון שלושה באגים קריטיים במנגנון ה-outbox:
1. **`ldb()` לא שחזרה `equip_inspections`** — רשימת הטבלאות לשחזור מ-localStorage לא כללה את הטבלה החדשה. אחרי רענון, הנתונים "נעלמו" מה-DB בזיכרון גם אם נשמרו ב-localStorage. נוסף לרשימה.
2. **`_obDrain` שמט שגיאות 4xx בשקט** — אם Supabase החזיר 404 (טבלה לא קיימת), 401/403 (הרשאות) או 400 (סכמה לא תואמת), הפעולה הוסרה מהתור ונמחקה לנצח בלי להודיע למשתמש. תוקן: כל שגיאה (4xx או 5xx) משאירה את הפעולה בתור, מעלה מונה `tries`, שומרת את ה-body האחרון של השגיאה ב-`tfgn_outbox_lasterr`, ומציגה badge אדום.
3. **`sbSync` יכלה לדרוס נתונים מקומיים** — אם טבלה בענן ריקה אבל יש פעולות pending באאוטבוקס, sbSync מדלגת על fetch של אותה טבלה (מונע race של דריסה לפני ש-drain מצליח).

**נוסף גם**:
- **Upsert semantics** — POST עם `Prefer: resolution=merge-duplicates` → retry של אותה שורה לא מחזיר 409 conflict, אלא הופך ל-update.
- **Diagnostic popup** — לחיצה על sync-pill מציגה: מצב `SB_ON`, כמות פעולות בתור, פירוט הפעולות הראשונות (tbl/op/tries/lastError), השגיאה האחרונה עם body, ואפשרות להפעיל drain מידית.
- **`OB_ERR_KEY='tfgn_outbox_lasterr'`** ב-localStorage לשמירת השגיאה האחרונה בין טעינות.

**סיבה**: המשתמש דיווח: "העלתי ציוד דרך אקסל, עשיתי רענון, נעלם שוב". הסיבה המצטברת של 3 הבאגים מעל: localStorage שמר את הנתונים אבל ldb לא שחזרה אותם, הענן לא קיבל כי טבלה אולי חסרה במיגרציה → 404, והפעולה הוסרה בשקט. השילוב של 3 הבאגים שיצר חור שחור.

**אלטרנטיבות שנדחו**:
- להעביר ל-IndexedDB — overkill לבעיה של list missing in array.
- Real-time subscription (Supabase realtime) — לא פותר את הבעיה של failed writes; מוסיף מורכבות.
- Toast על כל שגיאה — רועש מדי; pill + click diagnostic עדיף.

**קישורים**: commit על branch `claude/resume-tfugen-safety-SJ4tU`

---

## 2026-04-18 — Outbox pattern לסנכרון ענן אמין
**החלטה**: כל פעולות הכתיבה ל-Supabase (`sbIns/sbUpd/sbDel`) עוברות דרך outbox queue ב-localStorage (`tfgn_outbox`). ה-queue נמשך (drain) ל-ענן ב-4 טריגרים: (1) אחרי ש-`sbSync` מסיים וקובע `SB_ON=true`; (2) `online` event; (3) `focus` event; (4) כל 30 שניות דרך setInterval. Badge ב-topbar (`#sync-pill`) מראה כמות פעולות ממתינות ומתחלף ל-"בענן ✓" לשנייה אחרי drain מוצלח.

**סיבה**:
- **תיקון באג קריטי**: `sbUpd` נקראה ב-2 מקומות (svNcr:1002, svEqi:1424) אבל **מעולם לא הוגדרה** → כל UPDATE של NCR/equip_inspections לא הגיע לענן.
- `sbIns` גם נחסם ב-`if(!SB_ON)return` — אם המשתמש העלה Excel לפני ש-sbSync הסתיים, הנתונים נעלמו בשקט (רק ב-localStorage).
- `.catch(function(){})` בלע שגיאות רשת — המשתמש לא ידע שהסנכרון נפל.
- דרישה מפורשת של המשתמש: "כל פעולה, מכל מקום, מיד בענן".

**אלטרנטיבות שנדחו**:
- להסיר רק את ה-`SB_ON` check — לא פותר את ה-swallow של שגיאות רשת
- להוסיף sync button ידני — דורש מעורבות, לא "מיד בענן"
- להשתמש ב-IndexedDB — overkill ל-queue קטן; localStorage מספיק

**מנגנון טכני**:
- `_obPush(op)` שומר `{op, tbl, row|id, ts, oid}` ב-queue
- `_obSend(op)` עושה את ה-fetch בפועל ומזרוק error עם `status`
- `_obDrain()` עובר על ה-queue, משאיר בה פעולות שנכשלו עם 5xx/network, מנקה 4xx (כנראה conflict/duplicate)
- `navigator.onLine===false` → לא מנסה כלל (שומר סוללה)
- `_obBusy` mutex מונע drains חופפים

**השלכות**:
- Badge חדש ב-topbar משמאל לפעמון
- `tfgn_outbox` חדש ב-localStorage של המשתמש
- אין schema changes, אין migration
- פעולות ישנות שהוחמצו (לפני התיקון) עדיין רק ב-localStorage — המשתמש יצטרך לייבא מחדש אם נמצא פער

## 2026-04-18 — Dashboard 2.0 (Phase A): גרפים ב-rDash (בוטל — ראה הסרה למעלה)
**החלטה**: הוספת 4 גרפים אינטראקטיביים לדשבורד באמצעות Chart.js 4 מ-CDN. גרפים: NCR trend (line, 12 חודשים, Safety vs Env), Incidents+lost-days (combo bar+line), Expiries stacked bar לפי 6 קטגוריות × 4 רמות דחיפות, Risk heatmap bubble chart 5×5. כל גרף עם `onclick` drill-down לעמוד המתאים.
**סיבה**:
- דרישה מפורשת של המשתמש להחליף את Vitre — Vitre יש visualizations, TFUGEN לא.
- Chart.js 4 UMD מ-CDN הוא ~60KB gzipped, בלי build step, מתאים ל-single-file architecture.
- Graceful fallback: אם CDN לא נטען, `if(typeof Chart==='undefined')return` → KPI tiles הקיימים ממשיכים לעבוד.
**אלטרנטיבות שנדחו**:
- D3.js — גמיש מדי, דורש יותר קוד ל-setup, overkill ל-4 גרפים
- ECharts — ~400KB, כבד מדי
- Google Charts — תלוי ב-Google API, פחות responsive
- SVG ידני — זמן פיתוח ארוך, תחזוקה קשה
**השלכות**:
- תלות חדשה: Chart.js 4.4.1 UMD מ-jsdelivr
- instances נשמרים ב-`_dashChartInst` וממוחזרים (destroy+create) ב-`rDash()` re-call
- עברית ב-labels — כולה `\uXXXX` (0 raw Hebrew חדש ב-JS)
- CSS חדש: `.dash-charts`, `.chart-card`, `.chart-wrap` — responsive (single col mobile, 2-col desktop ≥768px)

## 2026-04-18 — NCR Agent Accept & Apply (PR 5b)
**החלטה**: הוספת כפתור ירוק "✅ החל ניתוח על ה-NCR" בפאנל הסוכן. בלחיצה → PATCH ל-`ncr` עם 4 שדות:
- `root_cause` → `rc`
- `corrective_actions[0]` → `c` (לא `immediate_action` — סמנטית "פעולה מתקנת" = CAPA, לא containment)
- `owner_suggested` → `o`
- `due_suggested` → `u`
זיהוי "הוחל" משווה את 4 הערכים ב-`ncr` לאלה ב-`ncr_ai` — אם תואמים, הכפתור הופך ל-badge "✓ הוחל (v2)".
**סיבה**:
- סוגר את המעגל: הסוכן כבר מנתח ושומר היסטוריה — חסר היה step אחרון של החלה על רשומת ה-NCR.
- שמירה על היסטוריה: `ncr_ai` עדיין שומר כל ניתוח, גם אחרי apply.
- `corrective_actions[0]` ולא `immediate_action` כי `ncr.c` מסומן בטופס כ"פעולה מתקנת נדרשת" — זו CAPA.
**אלטרנטיבות שנדחו**:
- flag `applied` ב-`ncr_ai` — מיותר, אפשר להסיק מהשוואה.
- שינוי אוטומטי של status (פתוח→בטיפול) — החלטה של המשתמש, לא של הסוכן.
- PATCH דרך `svNcr` הקיים — `svNcr` עובד עם הטופס פתוח, כאן ה-NCR לא נערך ב-modal רגיל.
**השלכות**:
- אין schema changes, אין migration.
- `_ncrFmt` עכשיו מקבל `n` (הרשומה המלאה) כפרמטר שלישי.
- עדכון `_nad` + `window.DB.ncr` בזיכרון מיד אחרי apply — כדי שהרשימה הראשית של `pg-ncr` תרענן.

## 2026-04-18 — דף חדש: בדיקות ציוד (`equip_inspections`)
**החלטה**: דף נפרד `pg-eqi` לבדיקות ציוד חובה לפי פקודת הבטיחות. טבלה חדשה `equip_inspections` עם שדות `code/n/vendor/loc/d/e/s/notes`. השדה `e` (תוקף הבא) משולב אוטומטית ב-Expiries Agent.
**סיבה**:
- המשתמש העלה דוח ציוד ולא היה לו מקום מתאים (דף "סיורי בטיחות" היה לא מתאים).
- שמירת השדה `e` כ-single letter מתיישרת עם convention הפרויקט ומאפשרת שימוש ב-`eb()` / `fd()` / `du()` הקיימים.
- כולל ייבוא Excel/CSV גנרי עם זיהוי אוטומטי של headers (code/name/vendor/loc/dates/status/notes).
**אלטרנטיבות שנדחו**:
- לשנות את דף "סיורי בטיחות" הקיים → המשתמש ציין שיש לו גם סיורים אמיתיים (חובה ל-45001).
- לשמור כעמודה ב-`ins` → שני יישויות שונות. בדיקות ציוד לפי פקודה ≠ סיור בטיחות שבועי.
**השלכות**:
- 18 טבלאות → **19 טבלאות**. עודכן ב-CLAUDE.md.
- Migration ידני דרוש: `migrations/2026-04-18_equip_inspections.sql`.
- ה-Expiries Agent ו-`rDash()` סורקים עכשיו גם את הטבלה הזו.

## 2026-04-18 — NCR Agent v4: שמירה ל-DB בטבלה נפרדת `ncr_ai`
**החלטה**: ניתוחי AI של NCR נשמרים בטבלה חדשה `ncr_ai` (bigserial id, ncr_id text, version int, risk/rc/ia/ca/prev, owner_suggested, due_suggested, ts, created_by). כל ניתוח חדש = version חדש (שומר היסטוריה).
**סיבה**:
- לא נוגעים ב-`ncr` (375 רשומות production) ← תואם לכלל ב-CLAUDE.md
- היסטוריה מלאה — ריצה חוזרת לא דורסת
- query פשוטה: `?order=version.desc` לקבל את העדכני
**אלטרנטיבות שנדחו**:
- A: עמודות `ai_*` ב-`ncr` — נוגע ב-production
- C: עמודה אחת `ai jsonb` ב-`ncr` — אין היסטוריה, קשה ל-query
**השלכות**:
- 17 טבלאות → **18 טבלאות**. עודכן ב-CLAUDE.md/STATUS.md.
- Migration ידני דרוש: `migrations/2026-04-18_ncr_ai.sql` ב-Supabase SQL Editor.
**קישור**: PR (יושלם).

## 2026-04-18 — NCR Agent: מודל Claude ועברית ב-prompt
**החלטה**:
- מודל `claude-sonnet-4-6` (היה `claude-sonnet-4-20250514`).
- ה-prompt נכתב באנגלית ומבקש תשובה בעברית (JSON).
**סיבה**:
- מודל עדכני = איכות טובה יותר, תאימות לעתיד.
- Prompt אנגלי מונע צורך ב-`\uXXXX` מסובך בקוד וגם שומר consistency בסגנון הקוד הקיים; התוצאה בעברית כפי שהמשתמש צריך.
**אלטרנטיבה שנדחתה**: Prompt עברי מלא כ-`\uXXXX` — קשה לתחזק, מוריד קריאות.

## 2026-04-18 — NCR Aggregate: פתוחים בלבד, sample 150
**החלטה**: `ncrAgentAnalyzeAll` מסנן ל-status `פתוח`/`בטיפול` בלבד ולוקח דגימה של עד 150 (היה 50 מכל NCR).
**סיבה**: NCR סגורים לא רלוונטיים לזיהוי דפוסים חיים; 150 מכסים ~60-70% מהפעילות הפעילה.
**אלטרנטיבה שנדחתה**: Chunking ל-3 קריאות — מוקדם מדי; נשמר כ-PR 5c אם יגיעו ל-300+ פתוחים.

## 2026-04-17 — ארכיטקטורה: Single-file HTML
**החלטה**: כל ה-UI ב-`index.html` אחד (~1500 שורות), בלי framework ובלי build step.
**סיבה**: המשתמש הוא מנהל בטיחות ולא מפתח. אין סביבת dev מקומית, אין CI לבנייה. deploy מיידי ב-Vercel ללא תלויות.
**אלטרנטיבות שנדחו**: React/Vue (מורכב מדי), Next.js (build step), separate files (אין bundler).
**השלכה**: אסור להוסיף `import`/`require`/build tools.

## 2026-04-17 — עברית כ-`\uXXXX` ב-JS strings
**החלטה**: כל עברית ב-string literals של JavaScript חייבת להיכתב כ-Unicode escape (`\u05e7` וכו'), לא כתווים.
**סיבה**: קידוד עקבי בכל environments (mobile/desktop/iOS Safari), הימנעות מ-mojibake, שליחה בטוחה ל-Supabase.
**הערה**: HTML inline (לא בתוך JS) יכול להישאר עברית או `&#...;` entities.

## 2026-04-17 — שדה תפוגה אחיד = `e`
**החלטה**: בכל 5 הטבלאות עם תפוגה (`ppe`, `med`, `tr`, `docs`, `ctr`) שם העמודה הוא `e`, פורמט `YYYY-MM-DD`.
**סיבה**: נקבע כבר במוסכמת שמות קצרים (אות בודדת) בשאר העמודות. עקביות מאפשרת `_expCollect()` גנרי.
**אלטרנטיבה שנדחתה**: `expiry_date`, `valid_until` — שינוי schema דורש migration על 375 רשומות ריצות.

## 2026-04-17 — תאריכים ריקים = `null`
**החלטה**: בשליחה ל-Supabase, תאריך ריק תמיד `null` ולא מחרוזת ריקה `''`.
**סיבה**: Postgres דוחה `''` לעמודות `date`/`timestamp` עם שגיאת parse. `null` תקין ונכון סמנטית.
**תבנית**: `date_field: value || null`.

## 2026-04-17 — תוספה: Skill `.claude/skills/tfugen-dev`
**החלטה**: אוכף אוטומטית את חוקי הפיתוח (עברית, single-file, `e` field, וכו') בכל סשן של Claude Code על ה-repo.
**סיבה**: מניעת רגרסיה — סשנים חדשים יקבלו את החוקים בלי תלות בזיכרון המשתמש.
**קישור**: מוזג ב-PR #4.

## 2026-04-17 — תוספה: Expiries Agent
**החלטה**: דף `pg-exp` מאוחד שמראה תפוגות מ-5 טבלאות + שדרוג `rDash()` לכלול `ppe`/`med`/`ctr` + פריטים שפג תוקפם.
**סיבה**: דרישה חוזרת מהמשתמש — מפקחי בטיחות צריכים תצוגה אחת לכל התפוגות.
**קישור**: PR #4, commit `4bfcd32`.
**PRs שנסגרו**: #1 ו-#2 (ניסיונות קודמים שלא עבדו — שדה תפוגה היה שגוי).

## 2026-04-17 — תשתית סנכרון: CLAUDE.md + DECISIONS.md
**החלטה**: הקשר קבוע של הפרויקט עובר לקבצים ב-root של ה-repo — לא בזיכרון של חשבון Claude ספציפי.
**סיבה**: המשתמש עובד מ-2 חשבונות (מחשב + טלפון). GitHub הוא single source of truth.
**השלכה**: כל החלטה ארכיטקטונית חדשה — שורה ביומן הזה.

## 2026-04-19 — Near-Miss capture + Morning Round
**החלטה**: נוספו שני מודולים חדשים: `near_miss` (כמעט ונפגע) ו-`rounds` (סבב בוקר יומי).
**סיבה**: דרישות ISO 45001 — תיעוד אירועי כמעט ונפגע + checklist בוקר יומי.
**מבנה**: near_miss — שדות: id, d, t, desc, area, rep, sev, typ, s, notes. rounds — שדות: id, d, inspector, fire, corridors, ppe, samples, chemicals, firstaid, notes, s. שדות boolean ב-rounds (לא jsonb) לפשטות עם REST API.
**KPIs**: Dashboard מציג ספירת near_miss החודש + סטטוס סבב בוקר היום + התראה אם לא בוצע.
**Migrations**: `2026-04-19_near_miss.sql`, `2026-04-19_rounds.sql`.

---

<!-- הוסף החלטות חדשות מלמעלה. שמור על הפורמט. -->
