# התקנת "עוזר מפעל" במחשב שבו Tapugan מותקנת (25/10/2026)

## למה Chrome לא מציע "התקנת עוזר מפעל"
Chrome מסתיר את פריט ההתקנה בתפריט כשהדף שייך לאפליקציה מותקנת שנפתחת בחלון משלה (`GetInstallPWALabel` ב-`chrome/browser/ui/web_applications/web_app_ui_utils.cc`). במקומו הוא מציג "פתיחה באמצעות". לאיזו אפליקציה הדף שייך נקבע לפי ה-scope הארוך ביותר שמכיל את הכתובת (`WebAppTabHelper`, `FindBestAppWithUrlInScope`). ל-Tapugan יש scope `/`, ולכן היא מכילה גם את `/chat`. כל עוד העוזר לא מותקן, אין אפליקציה עם scope ארוך יותר שתתפוס את `/chat`.

## הפתרון שנבחר: סדר התקנה (בלי שינוי קוד)
מסירים את Tapugan בלי למחוק נתונים, מתקינים את העוזר, ואז מתקינים שוב את Tapugan. אחרי זה שתיהן מותקנות יחד: `/chat` שייך לעוזר (ה-scope הארוך יותר), וכל השאר ל-Tapugan, כולל קיצורי הדרך `/?emp=1`.

## שמירה על הפתרון
`chat-test.mjs` נכשל אם ל-`manifest.webmanifest` נוסף `id`, או אם `start_url` או `scope` שלו השתנו (זהות האפליקציה של המשתמשים). הוא נכשל גם אם ה-manifest של העוזר מאבד את `id`, `scope` או `start_url` = `/chat`.

## הרצת הבדיקה בדפדפן אמיתי
```
cd tests/harness && KEEP_BUILD=1 bash run.sh   # או רק בניית _build
cd ../../project-files/chat-desktop-install && node server.mjs &
xvfb-run -a -s "-screen 0 1100x800x24" node ui.mjs "$PWD/shots" un
```
מצבים: `bug` (Tapugan קודם, משחזר את הבעיה), `fix` (העוזר קודם), `un` (התהליך המלא: הסרה, עוזר, Tapugan). צריך `pip install python-xlib`. Chromium של Playwright ב-`/opt/pw-browsers`.
