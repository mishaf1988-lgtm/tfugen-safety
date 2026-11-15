#!/usr/bin/env python3
"""PostToolUse (Bash, Edit, Write): raw Hebrew or a hidden direction character in a server code line this branch added.

15/11/2026 (Michael: "מאשר" on the upgrade ideas): raw-hebrew.py watches index.html on Edit/Write only, so a
Python edit script run in Bash put raw Hebrew into functions/api/routine-db.js three times in one day, and each was caught
only by rule1-hebrew-test at the push. This hook looks right after every tool call and says how to fix it in one command.
A warning, not a deny: the fix is tools/esc-hebrew.py. Comment lines are left alone.
Test:  python3 tests/harness/code-raw-hebrew-test.py
"""
import json, os, sys
sys.stdout.reconfigure(encoding="utf-8")
sys.stdin.reconfigure(encoding="utf-8")
ROOT = os.environ.get("CLAUDE_PROJECT_DIR") or os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.join(ROOT, "tools"))


def main():
    try:
        d = json.load(sys.stdin)
    except Exception:
        d = {}
    if d.get("tool_name") not in (None, "Bash", "Edit", "Write", "MultiEdit"):
        print("{}"); return
    try:
        import runpy
        mod = runpy.run_path(os.path.join(ROOT, "tools", "esc-hebrew.py"), run_name="esc_hebrew")
        h = mod["hits"](ROOT)
    except Exception:
        print("{}"); return
    if not h:
        print("{}"); return
    lines = "; ".join("%s:%d" % (f, n) for f, n, _ in h[:6])
    print(json.dumps({"hookSpecificOutput": {"hookEventName": "PostToolUse", "additionalContext":
        "code-raw-hebrew (CLAUDE.md rule 1, 15/11/2026): raw Hebrew or a hidden direction character in %d server code line(s) "
        "you added: %s. Run now: python3 tools/esc-hebrew.py (escapes only the added code lines, never old comments)." % (len(h), lines)}}, ensure_ascii=False))


main()
