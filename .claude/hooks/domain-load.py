#!/usr/bin/env python3
"""UserPromptSubmit: a word of a work branch in Michael's message = the branch file goes into Claude's context
(01/11/2026, Michael: "split all our work into branches, each with its rules, its documents ... so you do not forget").
The words: project-files/domains/index.json (the same list the server gives the assistant, functions/_domains.js).
Prints the file's first 40 lines (the "before you make a document" checklist sits at the top), so it is read
before the first step, not after a mistake. No match = nothing.

Test:  python3 tests/harness/domains-test.py
"""
import json, os, sys
sys.stdout.reconfigure(encoding="utf-8")  # Windows writes cp1255; Claude Code reads UTF-8 (05/10/2026)
sys.stdin.reconfigure(encoding="utf-8")


def main():
    try:
        d = json.load(sys.stdin)
    except Exception:
        print("{}"); return
    text = str(d.get("prompt") or "").lower()
    root = os.environ.get("CLAUDE_PROJECT_DIR") or d.get("cwd") or "."
    try:
        idx = json.load(open(os.path.join(root, "project-files/domains/index.json"), encoding="utf-8"))
    except Exception:
        print("{}"); return
    out = []
    for k, v in idx.items():
        if k.startswith("_") or not any(w.lower() in text for w in v.get("words", [])):
            continue
        try:
            head = "".join(open(os.path.join(root, v["file"]), encoding="utf-8").readlines()[:40])
        except Exception:
            head = "(הקובץ חסר)"
        out.append("ענף " + v["name"] + " (" + v["file"] + ", לקרוא עד הסוף לפני הצעד הראשון):\n" + head)
    if not out:
        print("{}"); return
    print(json.dumps({"hookSpecificOutput": {"hookEventName": "UserPromptSubmit", "additionalContext": "\n\n".join(out)}}, ensure_ascii=False))


if __name__ == "__main__":
    main()
