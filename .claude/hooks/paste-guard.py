#!/usr/bin/env python3
"""Stop hook: a block "to paste" into the business line names nothing of the factory (lesson 112).

17/10/2026: a reply to Michael ended with text meant for the safety-platform chat, and it named
two of the factory's zones and a production department. The business chat caught it; nothing here
did. The export scan (tools/export-platform.mjs) guards files, not text pasted between chats.

A paste block is the text after a line with "להדבקה" in a reply that is about the business line
(העסק / safety-platform / הצ'אט השני). In it, these are refused: the factory's own department and
zone names from functions/_site.js (SITE.depts, SITE.areaDept; generic words such as "אחזקה" are
allowed), the database and test-database ids, the mail domain, and the owner's family name.
The brand name itself is allowed: the business chat talks about the source line by name.

Never blocks twice in a row (stop_hook_active). Test: python3 tests/harness/paste-guard-test.py
"""
import json, os, re, subprocess, sys
sys.stdin.reconfigure(encoding="utf-8")

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
sys.path.insert(0, HERE)
from importlib import import_module
last_turn_blocks = import_module("hebrew-reply").last_turn_blocks

PASTE = re.compile("להדבקה")                       # להדבקה
BUSINESS = re.compile("העסק|safety-platform|הצ'אט השני")  # העסק / safety-platform / הצ'אט השני
# Words a factory of any kind has; they say nothing about this one.
GENERIC = {"אחזקה", "מעבדה", "מעבדות",
           "אריזה", "חצר", "שפכים",
           "תשתיות", "חומר גלם"}
# Spelled in parts, as in the export, so a scan of this file does not trip on itself.
FIXED = ["znhjtpclt" + "rxxyfjczgvw", "ldzbjbsum" + "zqjyvtpiwqo", "tapugan" + ".co.il", "פרי" + "יליך"]


def factory_words():
    js = ("import('" + os.path.join(ROOT, "functions", "_site.js").replace("\\", "/") + "').then((m) => console.log(JSON.stringify("
          "[...m.SITE.depts, ...Object.keys(m.SITE.areaDept), ...Object.values(m.SITE.areaDept)])))")
    try:
        out = subprocess.run(["node", "-e", js], capture_output=True, text=True, timeout=20, encoding="utf-8").stdout
        words = json.loads(out)
    except Exception:
        words = []
    return sorted({w for w in words if w and w not in GENERIC} | set(FIXED), key=len, reverse=True)


def paste_parts(blocks):
    """The text after each "להדבקה" line, in replies about the business line."""
    parts = []
    for b in blocks:
        if not BUSINESS.search(b):
            continue
        for m in PASTE.finditer(b):
            parts.append(b[m.end():])
    return parts


def hits(parts, words):
    found = []
    for p in parts:
        for w in words:
            if w in p and w not in found:
                found.append(w)
    return found


def main():
    try:
        data = json.load(sys.stdin)
    except Exception:
        sys.exit(0)
    if data.get("stop_hook_active") or not data.get("transcript_path"):
        sys.exit(0)
    try:
        parts = paste_parts(last_turn_blocks(data["transcript_path"]))
    except Exception:
        sys.exit(0)
    if not parts:
        sys.exit(0)
    found = hits(parts, factory_words())
    if not found:
        sys.exit(0)
    print(json.dumps({"decision": "block", "reason":
        "בבלוק להדבקה לעסק יש פרטי מפעל (לקח 112): "
        + ", ".join(found) + ". לכתוב את התשובה שוב בלי הם (מילה כללית: \"שני אזורים\", \"מחלקת ייצור\")."}, ensure_ascii=False))
    sys.exit(0)


if __name__ == "__main__":
    main()
