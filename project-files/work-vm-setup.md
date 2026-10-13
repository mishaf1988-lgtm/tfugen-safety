# הקמת מחשב העבודה ב-Azure, צעד אחר צעד

מיכאל בשאלון, 13/10/2026: "בצע: ניסיון חינם בחשבון העבודה (מומלץ)". התכנון והסיבות: `work-vm-plan.md`.

**מי עושה מה:** את הכרטיס ואת הסיסמאות מזין רק מיכאל. Claude בכרום יוצר את המחשב (משימה C6 ב-`chrome-queue.md`). Claude בענן כותב את ההוראות ואת המשימה המתוזמנת.

## שלב 1: ניסיון חינם (מיכאל, כ-10 דקות)

אפשר דרך Claude בכרום: משימה C7 ב-`chrome-queue.md` (עוצרת לכרטיס, לקוד ה-SMS ולאישור התנאים).

1. https://portal.azure.com, מחובר עם `sviva@tapugan.co.il`.
2. Subscriptions, ואז Add, ואז **Try Azure for free**.
3. למלא את הפרטים ואת הכרטיס. בדרך כלל יש חיוב בדיקה קטן שמתבטל.
4. לקרוא את התנאים במסך לפני האישור: כמה קרדיט, לכמה ימים, ומה קורה בסוף. **לא בדקנו את התנאים מראש.** לפי מה שידוע לי, בסוף הניסיון המשאבים נעצרים עד שעוברים ל-Pay-As-You-Go, ולא מחויבים לבד. לבדוק את זה במסך.
5. אם מופיעה הודעה שהארגון חוסם: לצלם, ולעצור. אז נעבור לחשבון אישי.

## שלב 2: יצירת המחשב (Claude בכרום, C6)

ההגדרות:

| שדה | ערך | למה |
|---|---|---|
| Region | Israel Central | שער המדינות של האתר מכניס רק מישראל |
| Image | Windows Server 2022 Datacenter: Azure Edition (Desktop Experience) | הרישיון כלול במחיר. Windows 11 ב-Azure דורש רישיון נוסף |
| Size | Standard_B2s (2 מעבדים, 4GB) | מספיק לכרום ול-Claude Code |
| Disk | Standard SSD, 128GB | |
| שם המחשב | `tapugan-claude` | |
| משתמש | `michael-vm`, סיסמה ש**מיכאל** מזין | |
| Public inbound ports | RDP (3389), ואחרי היצירה: לצמצם את כלל ה-RDP ל-"My IP address" בלבד | שהמחשב לא יהיה פתוח לכל העולם |
| Auto-shutdown | **כבוי** | המחשב צריך לרוץ תמיד |
| Budget | התראה במייל ב-50 דולר לחודש (Cost Management, Budgets) | שלא יהיה חיוב מפתיע |

## שלב 3: כניסה ראשונה (מיכאל, כחצי שעה)

1. בפורטל: המחשב `tapugan-claude`, ואז Connect, ואז RDP, ואז Download RDP file. לפתוח את הקובץ, ולהתחבר עם `michael-vm` והסיסמה.
2. במחשב החדש:
   - להתקין את Google Chrome.
   - להתקין את Git for Windows (https://git-scm.com/downloads/win). זו המלצה של התיעוד, כדי ש-Claude Code יעבוד עם Bash.
   - להתקין את Claude Code. ב-PowerShell: `irm https://claude.ai/install.ps1 | iex` (מהתיעוד הרשמי, code.claude.com/docs/en/quickstart). לפתוח חלון חדש ולבדוק `claude --version`.
3. בכרום:
   - להתקין את התוסף Claude in Chrome מחנות כרום, ולהתחבר לחשבון Claude.
   - להתחבר לאתרים: Microsoft 365 (`sviva@tapugan.co.il`), Power Automate, GitHub, Supabase, Cloudflare, נבו. בכל אחד לסמן "הישאר מחובר".
4. ב-PowerShell: `claude`, ואז `/login` (התחברות דרך הדפדפן, לא מפתח API: בלי זה החיבור לכרום לא עובד, לפי התיעוד). אחר כך `/chrome`, ולבחור **Enabled by default**.
5. בדיקה: לכתוב ל-Claude Code "תפתח את tapugan-safety.pages.dev ותגיד לי מה מופיע". צריך להופיע מסך הכניסה של האפליקציה, לא "המערכת זמינה מישראל בלבד".

## שלב 4: המשימה המתוזמנת (Claude, אחרי שלב 3)

סקריפט ב-Task Scheduler שמריץ פעם ביום את Claude Code על `chrome-queue.md`, עם חלון כרום פתוח. ייכתב ויישמר ב-repo רק אחרי שהמחשב קיים, ויבדק שם על C1 ו-C2. **לא נבדק עדיין:** אם הרצה בלי חלון פתוח (`claude -p --chrome`) עובדת. אם לא, נשתמש בקיצור מתוזמן של Claude in Chrome.

## אחרי ההקמה

- רישום ב-`ACCOUNT-INVENTORY.md`: המנוי, המחשב, האזור, התקציב (בלי סיסמאות).
- גיבוי מיילים: תכנון נפרד (`work-vm-plan.md`).
