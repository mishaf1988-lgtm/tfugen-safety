# VM notifier — מייל על ליקוי נאמן, מתיבת הדואר שלך

סקריפט קטן שרץ על מחשב דלוק (המחשב הווירטואלי של מיכאל) ושולח מייל **מתיבת הדואר שלך** בכל פעם שנאמן בטיחות שומר ליקוי באפליקציה.

- **WhatsApp** ממשיך לצאת מהשרת (הערוץ הרשמי, עובד). הסקריפט הזה הוא רק ערוץ המייל, בשביל כתובות ש-Resend לא יכול להגיע אליהן.
- כל ליקוי נשלח **פעם אחת**. דיווחים תקינים לא נשלחים. בהפעלה הראשונה הסקריפט רק "זוכר" ליקויים קיימים ולא שולח אותם.
- אם המחשב נכבה — הליקויים של 48 השעות האחרונות יישלחו כשהוא יעלה. ישנים יותר לא.

## מה צריך על המחשב

- Windows עם **Outlook פתוח ומחובר** (מצב `outlook`, בלי סיסמאות), או כל מחשב עם SMTP (מצב `smtp`).
- Python 3 (מ-python.org; בהתקנה לסמן **Add Python to PATH**).

## התקנה (פעם אחת)

1. העתק את התיקייה `tools/vm-notifier` למחשב, למשל ל-`C:\tapugan-notifier`.
2. פתח שורת פקודה (cmd) בתיקייה והרץ:
   ```
   pip install requests pywin32
   ```
   (`pywin32` נחוץ רק למצב Outlook.)
3. העתק את `config.example.json` ל-`config.json` ומלא:
   - `to` — לאן לשלוח (למשל `sviva@tapugan.co.il`).
   - `mode` — `outlook` (Outlook פתוח על המחשב) או `smtp`.
   - במצב `smtp` — Gmail: `smtp.gmail.com`, פורט `465`, המשתמש, ו**סיסמת אפליקציה** (Google Account → Security → 2-Step Verification → App passwords). Microsoft 365: `smtp.office365.com`, פורט `587`.
4. בדיקת מסלול המייל (לא נוגע באפליקציה):
   ```
   python notify.py --test-email
   ```
   אמור להגיע מייל "🦺 ליקוי מנאמן בטיחות — בדיקה · עמדות כיבוי אש".
5. הפעלה:
   ```
   start.bat
   ```
   החלון נשאר פתוח ורץ. `start.bat` מפעיל מחדש את הסקריפט אם הוא נופל.

## הפעלה אוטומטית כשהמחשב עולה

Win+R → `shell:startup` → Enter → שים בתיקייה שנפתחה **קיצור דרך** ל-`start.bat`. מעכשיו הסקריפט עולה עם ההתחברות למחשב. (במצב Outlook — גם Outlook צריך לעלות; אפשר לשים גם לו קיצור באותה תיקייה.)

## שרת בענן במקום מחשב (מומלץ אם רוצים "דלוק תמיד" בלי תלות במחשב)

שרת לינוקס קטן (VPS) בעלות של כ-4–6 דולר לחודש מספיק: למשל Hetzner (CX22), DigitalOcean (Basic) או Vultr. בוחרים Ubuntu, מקבלים כתובת IP וסיסמה, ומתחברים ב-SSH (ב-Windows: אפליקציית Terminal, הפקודה `ssh root@<IP>`).

**אפשר גם מהטלפון בלבד**, בלי מחשב: אפליקציית **Termius** (חינם, iPhone/Android) → New Host → כתובת ה-IP, משתמש `root`, הסיסמה מהמייל → Connect.

על השרת (3 פקודות; האחרונה שואלת 3 שאלות וכותבת את ההגדרות לבד, שולחת מייל בדיקה ומפעילה את השירות):
```
apt-get install -y git
git clone https://github.com/mishaf1988-lgtm/tfugen-safety.git
bash tfugen-safety/tools/vm-notifier/install-linux.sh
```
השאלות: סוג התיבה ששולחת (1 = Gmail / Google Workspace עם **סיסמת אפליקציה** מ-Google Account → Security → App passwords; 2 = Microsoft 365 / Outlook עם סיסמת התיבה — ייתכן שמנהל ה-IT יצטרך להפעיל SMTP AUTH) · הכתובת ששולחת · הסיסמה · לאן לשלוח (ברירת מחדל sviva@tapugan.co.il). להחליף הגדרות: להריץ שוב את אותה פקודה.

הגדרה ידנית (למשל שליחה מ-Microsoft 365 במקום Gmail): `nano /opt/tapugan-notifier/config.json`, `"mode": "smtp"` ופרטי SMTP של תיבת הדואר ששולחת (בלינוקס אין Outlook):
- **Gmail:** host `smtp.gmail.com`, port `465`, user = הכתובת, password = **סיסמת אפליקציה** (Google Account → Security → 2-Step Verification → App passwords).
- **Microsoft 365 (למשל sviva@tapugan.co.il):** host `smtp.office365.com`, port `587`, user = הכתובת, password = סיסמת התיבה. אם השליחה נכשלת ב-"SMTP AUTH disabled", מנהל ה-IT צריך להפעיל SMTP AUTH לתיבה הזו (Microsoft 365 admin → Users → Mail → Manage email apps → Authenticated SMTP).

בדיקה והפעלה:
```
sudo -u notifier python3 /opt/tapugan-notifier/notify.py --test-email
sudo systemctl restart tapugan-notifier
sudo journalctl -u tapugan-notifier -f
```
השירות עולה לבד אחרי אתחול ומופעל מחדש אם נפל. עדכון גרסה: `git pull` בתיקיית הקוד ואז להריץ שוב את `install-linux.sh` (ה-config נשמר).

לחלופין, שרת **Windows** בענן (Azure / AWS Lightsail, כ-15–30 דולר לחודש) מאפשר את מצב `outlook` בדיוק כמו מחשב רגיל — ההוראות למעלה.

## באפליקציה

בהגדרות ההתראות (🔔) בשורה «ליקוי מנאמן בטיחות»:
- **WhatsApp** — מסומן (השרת שולח).
- **Email** — **לא** מסומן, כדי שלא יישלח פעמיים (הסקריפט הזה שולח את המייל).

## אם משהו לא עובד

- `notifier.log` באותה תיקייה מראה כל סבב, כל שליחה וכל שגיאה.
- `state.json` זוכר מה כבר נשלח. מחיקה שלו = הפעלה ראשונה מחדש (לא שולח ישנים).
- Outlook: אם קופצת אזהרת אבטחה "תוכנית מנסה לשלוח מייל" — Outlook → File → Options → Trust Center → Programmatic Access → "Never warn me" (דורש אנטי-וירוס פעיל).
- Gmail SMTP: חייב סיסמת אפליקציה, לא הסיסמה הרגילה.

## מה זה לא עושה

לא שולח WhatsApp מהמספר האישי (אוטומציה של WhatsApp Web מנוגדת לתנאי השימוש ומסכנת את המספר בחסימה). ה-WhatsApp יוצא מהשרת דרך המספר העסקי.
