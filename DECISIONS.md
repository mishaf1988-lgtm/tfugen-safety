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

## 2026-04-23 — NCR columns migration (schema drift fix)

**החלטה**: נוסף קובץ `migrations/2026-04-22_ncr_columns.sql` שמוסיף 5 עמודות חסרות לטבלת `ncr`: `cd` (close date), `sd` (source date), `loc` (location), `root_cause`, `immediate`. הקוד ב-`svNcr` וב-`xlParse` שלח את השדות האלה אבל הטבלה ב-production לא כללה אותם → שגיאות `PGRST204` ו-6 פעולות ins תקועות ב-outbox.

**סיבה**: schema drift דומה לתיקון `category` מ-2026-04-22 — הקוד התפתח מעבר למה שיש ב-DB. ה-outbox החזיר שגיאות HTTP 400 בלי להעיר למשתמש. הוספתי `IF NOT EXISTS` לכל `ALTER` כדי שיהיה בטוח להרצה חוזרת.

**אלטרנטיבות שנדחו**: להסיר את השדות מהקוד — אבל הם בשימוש אמיתי (מסך "סגירת NCR" משתמש ב-`cd`, Excel import משתמש ב-`root_cause`/`immediate`).

**השלכות**: אין שינוי בקוד, רק SQL. נדרשת הרצה ידנית של ה-migration ב-Supabase. אחרי ההרצה — ה-outbox מתנקה אוטומטית ומטמיע את 6 הפעולות התקועות.

---

## 2026-04-23 — תיקון אבטחה: RLS של app_users נעולה לאדמין בלבד

**החלטה**: ה-policy `app_users_admin_write` שוחלפה — במקום `is_anonymous=false` (שאיפשר לכל משתמש מחובר לכתוב), התנאי עכשיו `auth.jwt() ->> 'email' = 'admin@tfugen.local'`. קובץ המיגרציה: `migrations/2026-04-23_app_users_admin_only_rls.sql`.

**סיבה**: חור אבטחה אמיתי — כל משתמש (כולל מדווח רגיל) היה יכול דרך DevTools לקרוא ל-REST API ישירות ולשנות/למחוק שורות בטבלת `app_users`. ב-UI הגבלנו רק את הכפתורים, אבל ה-backend היה פתוח.

**השלכות**:
- SELECT נשאר פתוח לכל משתמש מחובר (צריך למלא dropdown של "מדווח").
- רק `admin@tfugen.local` יכול INSERT/UPDATE/DELETE.
- ה-endpoints `/api/create-user`, `/api/rename-user`, `/api/reset-password`, `/api/delete-user` כבר משתמשים ב-service_role key (שעוקף RLS) — לכן ה-policy המחמירה לא שוברת אותם.
- בלי ההרצה: כל משתמש מחובר יכול לפגוע בטבלה.

**אלטרנטיבות שנדחו**:
- הצפנה/האפה של הרשאות ברמת הקוד — לא פתרון, ניתן לעקוף דרך DevTools.
- role-based RLS עם טבלת roles נפרדת — עודף תשתית לשלב זה.

**קישור**: session עם פתיחת המיגרציה + PR #75.

---

## 2026-04-23 — ניהול משתמשים מלא מתוך האפליקציה (CRUD)

**החלטה**: נוספו 4 serverless endpoints ב-Vercel תחת `api/`:
1. `create-user.js` — אדמין יוצר משתמש חדש, מייצר סיסמה רנדומלית (`Aa` + 6 תווים + `!`), שומר ב-Supabase Auth ובטבלת `app_users`, מציג את פרטי הכניסה פעם אחת.
2. `rename-user.js` — משנה username (גם ה-email ב-Auth וגם ה-id ב-`app_users`). משתמש ב-PATCH אטומי למניעת שורות זומבי.
3. `reset-password.js` — מייצר סיסמה חדשה רנדומלית למשתמש קיים.
4. `delete-user.js` — מוחק את חשבון ה-Auth ואת שורת `app_users`.

ה-UI התרחב: דף `pg-users` עם כפתור "+ משתמש חדש", מודאל עריכה עם 3 כפתורי פעולה (🔄 שנה שם, 🔑 איפוס סיסמה, 🗑 מחק).

**סיבה**: הגישה המקורית מ-2026-04-22 ("10 slots גנריים, admin משייך דרך האפליקציה") הייתה מוגבלת — חסרה אפשרות להוסיף משתמשים מעבר ל-10, ולא ניתן היה לשנות שם משתמש / לאפס סיסמה / למחוק בלי לעבור ל-Supabase Dashboard. המשתמש ביקש במפורש שהכל יהיה מהאפליקציה.

**תלויות חדשות**:
- `SUPABASE_SERVICE_ROLE_KEY` במשתני סביבה של Vercel (הוסף ידנית פעם אחת).
- כל endpoint מאמת `Authorization: Bearer <token>` של המשתמש, מוודא `email === admin@tfugen.local`, דוחה אחרת.

**אלטרנטיבות שנדחו**:
- להישאר ב-10 slots הקשיחים — הגבלה לא סבירה.
- לממש self-service password change למשתמש רגיל — דחוי לעתיד.

**השלכות**: אין שינוי schema. 4 endpoints חדשים → costs נמוכים (`admin` קוראים בלבד). דורש את `SERVICE_ROLE_KEY` בסביבת Vercel — אם לא מוגדר, ה-endpoint מחזיר שגיאה בצורה מסודרת.

**קישור**: PRs #72, #73, #74, #75, #76.

---

## 2026-04-23 — Design Polish Tiers 0-3 (15 המלצות מ-design review agent)

**החלטה**: יושמו 12 מתוך 15 המלצות מ-agent עיצוב UX שהורץ על הפרויקט. שינויים עיקריים:

**Tier 1 — מבניים**:
1. **ניווט 4 טאבים** במקום 24 כפתורים גוללים: `ראשי · משימות · דיווחים · מודולים`. "דיווחים" ו"מודולים" פותחים **bottom sheets** עם פריטים מקובצים.
2. **דשבורד היררכי**: רשימת "🎯 היום" actionable בראש (משימות בפיגור / תפוגות / סבב ממתין) → monthly-strip (4 KPI) → accordion "מדדים נוספים".
3. **FAB ✨ Smart Capture** הוזז לפינה ימין-תחתונה עם לייבל "דווח" (אזור האגודל הטבעי ב-RTL).

**Tier 2 — פולש**:
4. Tap targets 44×44 (תקן iOS HIG) בכל הכפתורים הקטנים.
5. Modal footer מאוחד עם safe-area + sticky-bottom.
6. Topbar RTL תקני (לוגו ימין, כותרת, actions שמאל, ללא absolute-centering שנהג להתנגש).
7. Time input auto-default ל"עכשיו".
8. Alerts מצומצמים + dismissable (✕).

**Tier 3 — Delight**:
9. Haptic vibrate + bounce animation על שמירה מוצלחת.
10. **מצב ניגודיות גבוהה 🌗** (toggle ב-topbar) — לאור חזק במפעל.
11. Empty states עם CTA (במקום "אין דיווחים" יבש).
12. Toast ירוק "ברוכים הבאים, [שם] ✨" אחרי login עם vibrate.

**נדחו**:
- #8 (swipe actions על שורות טבלה) — פרויקט נפרד הדורש gesture handlers מלאים.
- #13 (morning round banner גדול) — הועבר ל-Today list; לא נדרש נפרד.
- #14 (unify statuses cross-module) — דורש migration של נתונים קיימים.

**סיבה**: ה-agent הצביע על גלילה אופקית של 24 כפתורים בניווט כחיכוך הגדול ביותר, ועל 11 KPI tiles שוות-משקל כ"נקודת מוצא לא ברורה". השינוי הופך את המובייל מ"לא נוח" ל"שימושי".

**השלכות**: אין שינוי schema, אין תלויות חדשות, רק CSS/HTML/JS ב-`index.html`. אין הגירה נתונים. PRs: #62-#69.

---

## 2026-04-22 — ניהול משתמשים: 10 slots גנריים + דף ניהול + login עם שם משתמש

**החלטה**: במקום לבנות מערכת user-creation מלאה (שהייתה דורשת `/api/create-user` serverless endpoint עם `SUPABASE_SERVICE_ROLE_KEY`), נבחרה **גישת pre-provisioning**: מנהל יוצר ב-Supabase Dashboard פעם אחת 10 חשבונות Auth (`user1@tfugen.local` עד `user10@tfugen.local`), ומטה כל ההמשך נעשה באפליקציה — מנהל מזהה פרופילים לכל משתמש דרך דף "משתמשים" (פרטים: שם מלא, תפקיד, מחלקה, טלפון, אימייל, פעיל).

**סיבה**:
- המשתמש מתלבט אם ומתי יעבור ל-login אמיתי; רצה תשתית שתעבוד בלי setup מסובך. הגישה הזאת מביאה login פעיל מיד עם 2 דקות setup חד-פעמי.
- אין צורך ב-`SUPABASE_SERVICE_ROLE_KEY` במשתני סביבה של Vercel.
- אין צורך ב-serverless endpoint נוסף (מעבר ל-`api/claude.js` הקיים).
- תפקידים בסיסיים (אדמין / מנהל / מדווח) — כולם יכולים להיכנס ולדווח. בהמשך יהיה אפשר להוסיף RLS per-role מבלי לשבור משהו.

**שינויים טכניים**:
1. מיגרציה `2026-04-22_app_users.sql` — טבלה + 10 placeholder rows + 2 RLS policies (`app_users_read` לכולם, `app_users_admin_write` לאדמין בלבד).
2. דף `pg-users` (מודולים → משתמשים, מוסתר ללא-אדמינים).
3. מודאל `m-user` לעריכת פרופיל (שם משתמש לא ניתן לשינוי — `disabled`).
4. `doLogin()` — מקבל שדה חדש `uname`. מיפוי: שם `user1` → `user1@tfugen.local`. שם `admin` או ריק → ADMIN_EMAIL (תאימות אחורה).
5. `_currentUser` — אובייקט בזיכרון אחרי login, כולל role. `_fetchCurrentUserProfile()` ממלא אחרי sbSync.
6. `_applyRoleGates()` — מציג את כפתור "משתמשים" רק לאדמין.
7. `<datalist id="active-users-list">` עולמי, מאוכלס מ-`_refreshUsersDatalist()`. שדה "מדווח" בטפסים משתמש ב-`list=active-users-list` — autocomplete חלק בין משתמשים פעילים, עם fallback להקלדה חופשית.

**אלטרנטיבות שנדחו**:
- **Service role + `/api/create-user`**: דורש SERVICE_ROLE_KEY במשתני Vercel, endpoint נוסף. נכון להיות עם scale גדול, לא עכשיו.
- **App-level password hashing** (bcrypt ב-JS, סיסמה בטבלה): פחות בטוח, לא מנצל את הזמינות של Supabase Auth.
- **Supabase invite flow** (email confirmation + set password): דורש הגדרת SMTP, מסבך את onboarding.

**השלכות**:
- 22 → **23 טבלאות** (`app_users` נוספה).
- הוספתה ל-sync layer: `ldb()`, `sbSync`, `_rtStart`, `forceSync`, `_sbTsCol` — כולן כוללות עכשיו `app_users`.
- ב-login קיים שדה חדש "שם משתמש". אם נשאר ריק — נופל בחזרה ל-`admin@tfugen.local` (תאימות לאחור).
- משתמשים אנונימיים (עובדים) יכולים לקרוא את `app_users` אבל לא לכתוב.
- setup ידני: מנהל חייב לייצר את 10 חשבונות ה-Auth פעם אחת ב-Supabase Dashboard.

---

## 2026-04-22 — Smart Capture: דיווח בקול / תמונה / טקסט עם AI triage

**החלטה**: FAB סגול בתחתית משמאל פותח מודאל עם 3 מצבי קלט:
1. **קול** — Web Speech API בעברית (`he-IL`), מתמלל ל-textarea בזמן אמת.
2. **תמונה** — מצלמה/גלריה → _imgCompress → _fileUpload ל-Storage → base64 ל-Claude Vision.
3. **טקסט** — textarea פשוט לכתיבה.

לאחר הגשה, פרומפט מובנה נשלח ל-Claude (`claude-sonnet-4-6`): "Analyze input → classify type (nm/inc/ncr/eqi/ppe/tr/other) + extract fields". התשובה JSON. `capDispatch()` פותח את המודאל המתאים (m-nm/m-inc/m-ncr/...) עם **כל השדות ממולאים** (תיאור, אזור, חומרה, מדווח, תאריך, תמונה), והמשתמש רק בודק ושומר.

**סיבה**: המשתמש ציין במפורש שהוא רוצה "משהו יחודי שיעזור בעבודה עם המערכת". הקלדה בעברית במובייל איטית; ניווט בין 22 דפים כדי לבחור איזה דיווח לפתוח הוא פגיעה יומיומית. זה הופך את ההקלטה/צילום למסלול ה"default" — המהיר ביותר להוסיף נתונים לאפליקציה.

**השלכות**:
- `api/claude.js`: `MAX_BODY_BYTES` 50000 → **300000** — לאפשר תמונה JPEG base64 (~200KB דחוס).
- תלות חדשה: `Web Speech API` (SpeechRecognition). לא תמיד זמין (Safari iOS תומך מ-14.5+; Chrome Android תומך). Fallback לטקסט במקרה שלא זמין.
- שימוש ב-Claude Vision — כל תמונה = לפחות 400-1000 tokens. פרומפט + תשובה ≈ 500 tokens = ~$0.005 לקריאה.
- אין שינוי schema, אין migration. הדיווח נשמר דרך המודאלים הרגילים עם sbIns/sbUpd.
- ה-FAB מוסתר ב-emp-mode (עובד שטח לא מחבר ל-AI).

**אלטרנטיבות שנדחו**:
- סוכן תקריות (5 Whys + TRIR) — העתקת דפוס NCR Agent; המשתמש הגדיר "לא להעתיק — משהו חכם". זה עדיין בתור אם רוצים אחר כך.
- Webhook WhatsApp — דורש חשבון עסקי ב-Meta, תלות חיצונית, מורכבות.
- חיפוש חכם (natural-language search) — ניתן להוסיף על בסיס אותה תשתית בהמשך.

**קישור**: session `01P4FQFaoSbyN3xxquUquhvx`.

---

## 2026-04-22 — Phase C.1: משימות וירטואליות (שילוב NCR/inc/expired בדף המשימות)

**החלטה**: `rTasks()` ו-KPI הדשבורד משלבים שתי רשימות:
1. `DB.tasks` — משימות אמיתיות שהמשתמש יצר
2. תוצאת `_collectVirtualTasks()` — שורות מחושבות על-הרגע מ:
   - NCR עם `s` ∈ {פתוח, בטיפול}
   - תקריות עם `s` ∈ {פתוח, בטיפול} (קריטי אם חומרה=חמור)
   - near-miss עם `s` ∈ {פתוח, בטיפול}
   - PPE/tr/docs/ctr/equip_inspections עם `e < היום` (עדיפות גבוה)

ID של שורה וירטואלית = `v:<tbl>:<src_id>`. שורה וירטואלית שיש לה "אח ידני" (משימה ב-`DB.tasks` עם אותם `source_table`+`source_id`) מסוננת החוצה — מונע כפילות. שורות וירטואליות מסומנות "(אוטומטי)" בעמודת המקור, ומקבלות רק 2 כפתורים: 👁 (צפייה במקור) ו-➕ (הפוך למשימה עצמאית — פותח את המודאל עם title/assignee/due pre-filled מהמקור).

**סיבה**: המשתמש ביקש "אם יש NCR פתוח זה צריך להיות במשימות". אפשרות A מתוך 3 שהוצעו — הכי ישירה, ללא כפילות DB, ללא סנכרון ידני. מספר 90% מהמקרים שהמשתמש מחפש (תצוגה אחודה של כל מה שצריך לעשות).

**אלטרנטיבות שנדחו**:
- B (ידני בלבד — כפתור "פתח משימה" בכל NCR): דורש מהמשתמש לזכור; חצי מה-NCR הפתוחים לעולם לא יהפכו למשימות.
- C (אוטומציה היברידית עם sync): כפילות DB, שאלות "מי עדכן מה", מורכבות. ה-promote-button נותן את זה כשצריך.

**השלכות**:
- `openTskModal(srcTbl, srcId)` עכשיו ממלא אוטומטית title/assignee/due מהרשומה המקורית (ולא רק סימון).
- KPI בדשבורד כולל וירטואליים → מספר "משימות פתוחות" עכשיו יהיה גבוה בפרויקטים עם NCR פתוחים רבים. זה רצוי — נותן לו תמונה אמיתית של העומס.
- אין שינוי schema, אין migration.
- עלות חישוב: `_collectVirtualTasks()` עובר על 8 טבלאות (~500 שורות סה"כ בפרויקט) — <5ms. נקרא מ-rTasks ומ-rDash; פרויקטים גדולים יותר יצטרכו caching אם יעלה ל-20ms+.

---

## 2026-04-22 — Phase C: מודול משימות (tasks / CAPA follow-up)

**החלטה**: הוספת טבלה 22 (`tasks`) + דף `pg-tasks` + מודאל `m-tsk` + KPI בדשבורד. המודול משמש למעקב אחר משימות המשך / CAPA שנולדות מ-NCR / תקריות / סיכונים / תפוגות. כל משימה יכולה להיות קשורה לרשומת-מקור דרך `source_table`+`source_id`, או להיות עצמאית. סטטוסים: פתוח / בהתקדמות / הושלם / בוטל. עדיפויות: קריטי / גבוה / רגיל / נמוך.

**סיבה**: ערוץ ניהול מרכזי למשימות בטיחות. עד עכשיו — משתמש היה צריך לזכור לבד מה פתוח. עכשיו יש פידים משני הצדדים: (1) KPI בדשבורד מראה open count + alert אדום על פג-יעד; (2) filter `over` בדף מציג את כל המשימות שחצו את היעד.

**השלכות**:
- 21 טבלאות → **22 טבלאות** (עדכן `CLAUDE.md` במעבר הבא).
- Migration ידני דרוש: `migrations/2026-04-21_tasks.sql`.
- RLS: יש לחזור על התבנית מ-`2026-04-21_rls_roles.sql` ולהוסיף `admin_all` ל-`tasks`. **לא** נוסף ל-`emp_insert` — עובד שטח לא יוצר משימות (רק האדמין).
- `sbUpd` (שורה 1163) מקבל `(tbl,row)` — בשונה מהחתימה הראשונית שהייתי רוצה (`tbl,id,row`). נשמרה תאימות.
- `_TSK_*` קבועים top-level (שורות 1895-1899) — משמשים גם ב-rDash לסינון KPI, לא רק בתוך בלוק התjsון של המודול.
- HTML של הדף + המודאל משתמשים ב-`&#...;` entities כי זה HTML — JS strings משתמשים ב-`\uXXXX` כפי שמחייב הכלל.

**אלטרנטיבות שנדחו**:
- **טיול ב-`ncr.c` כ"משימה"** — `ncr.c` כבר משמש ל-"corrective action text" ב-NCR. אין לו deadline ואין לו סטטוס עצמאי. הרחבת הטבלה דורשת migration ב-375 שורות production.
- **jsonb array ב-`ncr`** — קשה ל-query, אין UI אחיד לכל הטבלאות.
- **שילוב באחת מהטבלאות הקיימות** (inc, rsk) — tasks לא שייך ליישות אחת; הוא cross-cutting.
- **כפתור "פתח משימה" בתוך view של NCR כבר עכשיו** — דחיתי ל-Phase C.2 לפי התוכנית המקורית (PR קטן, אחרי שהבסיס יושב).

**קישור**: continuation של session `01LPuHMNYpCLGLw2DP5ZB7L9` שהכין רק את ה-SQL migration (commit `4d7ebc5`). הקוד עצמו ב-branch `claude/check-project-status-zGyfb`.

---

## 2026-04-21 — XSS נוספים שנתפסו בבדיקה צולבת של 3 סוכנים (Vuln #9)
**החלטה**: תיקון 3 XSS HIGH נוספים + hardening של NCR agent:
1. `_printReportDo` (שורות 1989-1992) — `escU()` על `pUrl`/`fileSigned` לפני שילוב ב-`<img src>`/`<a href>`. `_sign()` fallback (שורה 2628) שונה מ-`cb(u)` ל-`cb('')` כדי לא להעביר URL-ים לא-storage/לא-data דרך הפונקציה.
2. `rTr` (שורה 1861) — `esc(t.w)`, `esc(t.n)` לפני שילוב ב-`innerHTML`.
3. `rEqi` (שורה 1599) — `esc(r.id)` על `data-eid` (רגרסיה מ-Vuln #8 שכיסה רק data-vid/data-did/data-pid).
4. NCR agent (`_ncrRender`/`_ncrSel`/`_ncrFmt` שורות 2398-2457) — `esc()` על כל שדות ה-NCR הממוסגרים + החלפת `onclick="_ncrSel('+n.id+')"` ל-`data-nid` + `this.dataset.nid`.
**סיבה**: לפני התיקון — (1) עובד anonymous שמכניס `photo_url="x\" onerror=\"…\""` ל-`near_miss`/`tr`/`equip_inspections` יכל לגרום ל-XSS ב-print-window של האדמין. (2) עובד שמכניס שם עובד עם `<img src=x onerror=>` יכל להפעיל XSS ב-`innerHTML` של רשימת ההדרכות. (3) שורה 1599 החמיצה את תיקון Vuln #8 — תוקף יכל לשתול `id` עם שבירת attribute. (4) NCR agent היה latent (fetch מה-API שבור אחרי Vuln #7 כי משתמש ב-`_SK` במקום JWT), אבל כשיתוקן — יש XSS פוטנציאלי דרך פלט LLM שנשמר ב-`ncr_ai`.
**שיטה**: בדיקה צולבת של 3 סוכנים עצמאיים — 2 מבצעים audit מקבילי; 1 מאמת ממצאים חלוקים. הסכמה מלאה על ממצאים 1-2; ממצא 3 זוהה רק על ידי B (A פספס); ממצא 4 זוהה רק על ידי A, ואומת כ-latent על ידי C.
**אלטרנטיבות שנדחו**: (1) CSP strict-dynamic — שינוי גדול לכל ה-inline handlers. (2) trusted-types — דורש refactor. (3) החלפת כל ה-innerHTML ב-textContent — מאבדים עיצוב.

---

## 2026-04-21 — XSS דרך `id` לא-מוכר באינליין onclick + sink שני של LLM (Vuln #8)
**החלטה**: (1) החלפת כל `onclick="fn('tbl','"+r.id+"')"` האינליין בתבנית `data-*` + `this.dataset.*`. (2) הוספת `esc()` לערכי attribute `data-vid/data-did/data-pid` (עצירת attribute break-out). (3) `esc()` על הטקסט המוחזר מה-LLM ב-`analyzeOne()` (שורה 2566) + על טקסטי שגיאה של API/Parse/Network (2564/2565/2567).
**סיבה**: מ-Vuln #7 עובד anonymous יכול `INSERT` לטבלאות `near_miss`/`rounds`/`equip_inspections`/`tr`. שדה `id` בקליינט נקבע לרוב מה-DB, אבל הכנסה ישירה דרך REST API מאפשרת לתוקף לשתול `id` כ-`x');alert(1);//` → אחרי רינדור אצל ה-admin הקוד יורץ. האיסקיפ של ערך ה-`data-*` מונע גם שבירת attribute עם `"`. התיקון ב-LLM sink משלים את `analyzeAll` שכבר תוקן ב-Vuln #4.
**אלטרנטיבות שנדחו**: (1) `CSP strict-dynamic` — דורש שינוי גדול של ה-inline handlers בכל הקובץ. (2) `textContent` במקום `innerHTML` לתוצאת LLM — מאבדים שבירות שורה/עיצוב. (3) UUID enforcement בצד DB בלבד — לא משנה שיש עדיין XSS דרך שדות אחרים בעתיד.

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
