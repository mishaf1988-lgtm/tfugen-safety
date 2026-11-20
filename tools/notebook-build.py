#!/usr/bin/env python3
# Builds project-files/wa-topics/notebook.md from the "כללי עבודה מהמחברת" sections of routine-wa-assistant.md,
# one rule per line, so the WhatsApp assistant (which reads only routine-wa-core.md and wa-topics/) can grep it before
# wa_me. Found 20/11/2026: rules folded from the notebook since 01/11/2026 went only into the full procedure, and after
# learn_done they left the assistant's fire text without reaching any file it reads.
# Usage: python3 tools/notebook-build.py          (writes the file)
#        python3 tools/notebook-build.py --check  (exit 1 if the file is not up to date)
import os, re, sys
sys.stdout.reconfigure(encoding="utf-8")
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "project-files/routine-wa-assistant.md")
OUT = os.path.join(ROOT, "project-files/wa-topics/notebook.md")
MARK = "   - **כללי עבודה מהמחברת"  # "כללי עבודה מהמחברת"

HEAD = """# העוזר בוואטסאפ: כללים מהמחברת

נבנה לבד מסעיפי "כללי עבודה מהמחברת" ב-`routine-wa-assistant.md` (`python3 tools/notebook-build.py`; לא לערוך כאן ביד). שורה לכל כלל, בראשה התאריך של הסעיף. אלה תיקונים של מיכאל שכבר יצאו משורת `learned`: לפני `wa_me`, `grep -i -E "<2-4 מילים מההודעה>" project-files/wa-topics/notebook.md`, ושורה שמתאימה חלה כמו הליבה. הודעה חדשה של מיכאל גוברת על שורה כאן.
"""

def split_rules(body):
    # Split "(1) ... (2) ..." only on the next expected number, so "(5,000" or "3(ג)" never split.
    out, n, pos, start = [], 1, 0, None
    while True:
        m = re.compile(r"(?:^|(?<=[\s:]))\(" + str(n) + r"\)\s").search(body, pos)
        if not m: break
        if start is not None: out.append(body[start:m.start()].strip())
        start, pos, n = m.end(), m.end(), n + 1
    if start is None: return [body.strip()]
    pre = body[:body.find("(1)")].strip() if out or start else ""
    out.append(body[start:].strip())
    return ([pre] if pre else []) + out

def build():
    lines = open(SRC, encoding="utf-8").read().split("\n")
    rows = []
    for ln in lines:
        if not ln.startswith(MARK): continue
        m = re.match(r"\s*- \*\*(.+?)\*\*\s*(.*)$", ln)
        if not m: continue
        head, body = m.group(1).rstrip(":").strip(), m.group(2)
        d = re.search(r"\d{2}(?:-\d{2})?/\d{2}/\d{4}", head)
        label = d.group(0) if d else head
        for r in split_rules(body):
            if r: rows.append("- [" + label + "] " + r)
    return HEAD + "\n" + "\n".join(rows) + "\n", len(rows)

if __name__ == "__main__":
    text, n = build()
    if "--check" in sys.argv:
        cur = open(OUT, encoding="utf-8").read() if os.path.exists(OUT) else ""
        if cur != text:
            print("notebook.md is not up to date: python3 tools/notebook-build.py"); sys.exit(1)
        print("notebook.md up to date (" + str(n) + " rules)"); sys.exit(0)
    open(OUT, "w", encoding="utf-8").write(text)
    print("wrote " + os.path.relpath(OUT, ROOT) + " (" + str(n) + " rules)")
