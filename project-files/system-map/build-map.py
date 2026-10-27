#!/usr/bin/env python3
"""The 3D map of Michael's system (27/10/2026, Michael: "a 3D model of my work and the agents", interview: two levels,
built from ACCOUNT-INVENTORY so it does not go stale). Zones and core parts are fixed here; the scheduled agents and the
Power Automate flows are read from project-files/ACCOUNT-INVENTORY.md, the server's actions from routine-db.js.
Writes data.json and system-map.html (the template with the data inside). Test: tests/harness/system-map-test.py.
Run: python3 project-files/system-map/build-map.py   then publish system-map.html to the same Artifact."""
import json, os, re, sys
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))

ZONES = [
    ("michael", "מיכאל", "person", "ממונה הבטיחות. נותן משימות בוואטסאפ, בצ'אט ובמשרד, מאשר ב\"בצע\", ושולח בעצמו כל מייל."),
    ("whatsapp", "וואטסאפ", "channel", "המספר של העוזר (08-6808365) ב-Meta. כל הודעה של מיכאל נכנסת דרכו, וכל תשובה יוצאת דרכו."),
    ("assistant", "העוזר", "agent", "הסוכן שעונה למיכאל: קורא מייל, תיקיות ומסד, מתייק, מכין טיוטות, ומעביר משימות."),
    ("routines", "סוכנים מתוזמנים", "agent", "Routines שרצים לבד לפי שעון: תיוק, תוקף, מחקר, דוחות ובקרה."),
    ("dev", "פיתוח", "agent", "שיחות הפיתוח, המפתח התורן, GitHub והבדיקות. כל קוד עובר בדיקות ומתמזג ל-main."),
    ("server", "השרת", "system", "Cloudflare Pages Functions: הדלת היחידה של הסוכנים למסד, ל-OneDrive ולוואטסאפ, עם כללים בקוד."),
    ("db", "המסד", "data", "Supabase: ציוד, מסמכים, NCR, הדרכות, נאמנים, ומצב הסוכנים."),
    ("m365", "Microsoft 365", "data", "המייל, היומן ותיקיית \"ניהול בטיחות\" ב-OneDrive, וזרימות Power Automate."),
    ("app", "האפליקציה", "system", "tapugan-safety.pages.dev: המסכים של מיכאל, הקיוסק לנאמנים, ההדרכה והצ'אט."),
    ("people", "עובדים ומנהלים", "person", "נאמני בטיחות, עובדים בהדרכה ובקליטה, מנהלי מחלקות, משאבי אנוש ורכש."),
    ("vendors", "ספקים ובודקים", "person", "בודקים מוסמכים, ספקים וקבלנים: תסקירים, הצעות מחיר וחשבוניות במייל."),
]
EDGES = [
    ("michael", "whatsapp", "הודעות ו\"בצע\""), ("whatsapp", "server", "webhook"), ("server", "assistant", "מפעיל"),
    ("assistant", "server", "פעולות"), ("routines", "server", "פעולות"), ("server", "db", "קריאה וכתיבה"),
    ("server", "m365", "קבצים ומייל"), ("assistant", "m365", "קריאה"), ("vendors", "m365", "מיילים"),
    ("assistant", "dev", "בקשת פיתוח"), ("dev", "server", "פריסה מ-main"), ("michael", "dev", "שאלונים"),
    ("app", "db", "נתונים"), ("people", "app", "קיוסק והדרכה"), ("michael", "app", "מסכים"), ("m365", "michael", "טיוטות לשליחה"),
]
FIXED = {
    "michael": [("וואטסאפ", "הערוץ העיקרי מול העוזר"), ("צ'אט באפליקציה", "/chat, אותו עוזר"), ("משרד הסוכנים", "ארטיפקט: שולחן לכל סוכן"),
                ("שאלונים", "החלטות בשיחת הפיתוח"), ("Outlook", "שולח בעצמו את הטיוטות")],
    "whatsapp": [("המספר של העוזר", "08-6808365, Cloud API"), ("תבנית עדכון", "safety_assistant_update"), ("עדכון בוקר", "יוצא מהשרת כל בוקר")],
    "assistant": [("מחברת הלמידה", "תיקונים והעדפות של מיכאל"), ("הבטחות ומעקב", "בדיקה חוזרת בשעה שקבע"), ("רשימת מחר", "כל יום ב-15:00")],
    "dev": [("הצ'אט הראשי", "השיחה שבה מיכאל עובד"), ("GitHub", "mishaf1988-lgtm/tfugen-safety"), ("בדיקות", "harness ב-8 קבוצות לכל PR"),
            ("hooks", "שומרים על החוקים בכל פעולה"), ("skills", "הידע של הפרויקט")],
    "server": [("wa-hook", "מקבל הודעות וואטסאפ"), ("wa-morning", "שעון כל 5 דקות: עדכון בוקר, הבטחות, סריקות"), ("od-read", "קריאת קבצים מ-OneDrive"),
               ("OCR", "קריאת סריקות, חינמי (Workers AI)"), ("claude.js", "ה-AI באפליקציה")],
    "db": [],
    "m365": [("Outlook", "מייל נכנס ויוצא, טיוטות בלבד"), ("OneDrive", "ניהול בטיחות: תסקירים, נהלים, טפסים"), ("יומן", "קריאה; הזזה וזימון אחרי \"בצע\"")],
    "app": [("תפוגות וציוד", "מה פג ומה קרוב"), ("NCR", "אי-התאמות ופעולות מתקנות"), ("קיוסק נאמנים", "דיווח מפגעים בלי כניסה"),
            ("הדרכה שבועית", "קריאה וחתימה בטלפון"), ("טופס קליטה", "08.02.01")],
    "people": [("נאמני בטיחות", "מדווחים מפגעים"), ("עובדים", "הדרכה וקליטה"), ("מנהלי מחלקות", "מייל שבועי"), ("רכש והנה\"ח", "הזמנות וחשבוניות")],
    "vendors": [("בודקים מוסמכים", "תסקירי ציוד"), ("ספקים", "הצעות מחיר וחשבוניות"), ("קבלנים", "הרשאות עבודה")],
}
DB_LABELS = {"docs": "מסמכים ותוקף", "equip_inspections": "ציוד ותסקירים", "tr": "הדרכות", "ppe": "ציוד מגן", "ctr": "קבלנים", "tasks": "משימות",
             "leg": "חקיקה", "ncr": "אי-התאמות", "trustee_reports": "דיווחי נאמנים", "toolbox_talks": "הדרכות שבועיות", "server_state": "מצב הסוכנים",
             "tour_hazards": "ליקויי סיור", "near_miss": "כמעט תאונה", "inc": "אירועים"}


def short(name):
    n = re.split(r"[:(]", name)[0].strip()
    return (n[:44] + "...") if len(n) > 47 else n


def routines():
    out = []
    for line in open(os.path.join(ROOT, "project-files", "ACCOUNT-INVENTORY.md"), encoding="utf-8"):
        if not line.startswith("| `trig_"):
            continue
        c = [x.strip() for x in line.strip().strip("|").split("|")]
        tid, name, when, doc = c[0].strip("`"), c[1], c[2], c[3]
        if name.startswith("כבוי") or "חד-פעמי" in name:
            continue
        zone = "assistant" if "wa-assistant" in doc else "dev" if re.search(r"dev-|worker-now", doc) else "routines"
        out.append({"id": tid, "zone": zone, "name": short(name), "what": name[:200], "when": re.sub(r"`", "", when)[:120],
                    "doc": re.sub(r"`", "", doc)[:80]})
    return out


def flows():
    out, on = [], False
    for line in open(os.path.join(ROOT, "project-files", "ACCOUNT-INVENTORY.md"), encoding="utf-8"):
        if line.startswith("### Power Automate"):
            on = True
            continue
        if on and line.startswith("#"):
            break
        if on and line.startswith("| ") and not line.startswith("| זרימה") and not line.startswith("|---"):
            c = [x.strip() for x in line.strip().strip("|").split("|")]
            out.append({"zone": "m365", "name": "זרימה: " + short(c[0]), "what": c[2][:200], "when": c[1][:120]})
    return out


def server_ops():
    src = open(os.path.join(ROOT, "functions", "api", "routine-db.js"), encoding="utf-8").read()
    return sorted(set(re.findall(r"body\.op === '([a-z_]+)'", src)))


def tables():
    src = open(os.path.join(ROOT, "functions", "api", "routine-db.js"), encoding="utf-8").read()
    m = re.search(r"export const TABLES = \[([^\]]*)\]", src)
    return re.findall(r"'([a-z_]+)'", m.group(1)) if m else []


def build():
    nodes = [{"zone": z, "name": n, "what": w} for z, items in FIXED.items() for n, w in items]
    ops = server_ops()
    nodes.append({"zone": "server", "name": "routine-db", "what": str(len(ops)) + " פעולות שהסוכנים מותרים בהן: " + ", ".join(ops)})
    for t in tables():
        nodes.append({"zone": "db", "name": DB_LABELS.get(t, t), "what": "טבלה " + t})
    nodes += routines() + flows()
    return {"zones": [{"id": i, "name": n, "kind": k, "what": w} for i, n, k, w in ZONES],
            "edges": [{"from": a, "to": b, "label": l} for a, b, l in EDGES], "nodes": nodes}


if __name__ == "__main__":
    data = build()
    js = json.dumps(data, ensure_ascii=False, indent=1)
    open(os.path.join(HERE, "data.json"), "w", encoding="utf-8").write(js + "\n")
    tpl = open(os.path.join(HERE, "template.html"), encoding="utf-8").read()
    open(os.path.join(HERE, "system-map.html"), "w", encoding="utf-8").write(tpl.replace("/*DATA*/null", json.dumps(data, ensure_ascii=False)))
    print("zones %d, parts %d (%d agents), flows %d" % (len(data["zones"]), len(data["nodes"]), sum(1 for n in data["nodes"] if "id" in n), sum(1 for n in data["nodes"] if n["name"].startswith("זרימה"))))
