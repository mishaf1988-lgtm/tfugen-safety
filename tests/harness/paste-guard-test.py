#!/usr/bin/env python3
"""The Stop hook .claude/hooks/paste-guard.py (lesson 112, 17/10/2026).

A paste block for the business line that names a factory zone or department is blocked; the same
words outside a paste block, or a paste block for another purpose, pass; generic words and the brand
name pass; the database id is blocked; stop_hook_active never blocks twice.
"""
import json, os, subprocess, sys, tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
HOOK = os.path.join(HERE, "..", "..", ".claude", "hooks", "paste-guard.py")
passed = failed = 0


def check(label, cond, detail=None):
    global passed, failed
    if cond:
        passed += 1; print("  ✓ " + label)
    else:
        failed += 1; print("  ✗ " + label + ("  -> " + repr(detail) if detail is not None else ""))


def run(texts, active=False):
    fd, path = tempfile.mkstemp(suffix=".jsonl")
    with os.fdopen(fd, "w", encoding="utf-8") as f:
        f.write(json.dumps({"type": "user", "message": {"role": "user", "content": "x"}}) + "\n")
        for t in texts:
            f.write(json.dumps({"type": "assistant", "message": {"role": "assistant", "content": [{"type": "text", "text": t}]}}, ensure_ascii=False) + "\n")
    p = subprocess.run([sys.executable, HOOK], input=json.dumps({"transcript_path": path, "stop_hook_active": active}),
                       capture_output=True, text=True, timeout=30, encoding="utf-8")
    os.unlink(path)
    out = p.stdout.strip()
    return json.loads(out) if out else None


ZONE = "מחסן טכני"                 # a zone in SITE.areaDept
DEPT = "ייצור טוגנים"     # a department in SITE.depts
HEAD = "להדבקה בצ'אט של העסק:\n"  # להדבקה בצ'אט של העסק:

r = run(["מוזג.\n\n" + HEAD + "שני אזורים קיבלו מחלקה: " + ZONE + " ל" + DEPT + "."])
check("a business paste block with a zone and a department is blocked", r and r.get("decision") == "block" and ZONE in r.get("reason", "") and DEPT in r.get("reason", ""), r)
check("...the reason is in Hebrew and names lesson 112", r and "112" in r.get("reason", "") and "לקח" in r.get("reason", ""), r)
check("the same words outside a paste block pass", run(["האזור " + ZONE + " שויך ל" + DEPT + " (בצע, העסק לא קשור)."]) is None)
check("a paste block for another purpose (not the business line) passes", run(["להדבקה בשיחה הבאה: " + ZONE]) is None)
check("generic words and the brand name in a business paste block pass",
      run([HEAD + "אחזקה, מעבדה וחצר. להעביר לתפוגן כל שינוי."]) is None)
r = run([HEAD + "המסד: znhjtpcltrxxyfjczgvw"])
check("the live database id in a business paste block is blocked", r and r.get("decision") == "block", r)
check("stop_hook_active never blocks twice", run([HEAD + ZONE], active=True) is None)

print("\n%d passed, %d failed" % (passed, failed))
sys.exit(1 if failed else 0)
