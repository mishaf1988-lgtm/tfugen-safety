#!/usr/bin/env python3
"""PostToolUse ratchet for CLAUDE.md rule 1 (Hebrew in JS strings = \\uXXXX).

index.html already carries ~800 raw-Hebrew lines inside <script>, so a hard
block would fire on every edit. Instead: count them now, count them at HEAD,
and warn only when the edit ADDED some. A warning, not a deny: the new line
may be a comment or HTML inside a template string, and the model decides.

Test:  echo '{"tool_input":{"file_path":"'$PWD'/index.html"}}' | python3 .claude/hooks/raw-hebrew.py
"""
import json, os, re, subprocess, sys

d = json.load(sys.stdin)
fp = (d.get("tool_input", {}) or {}).get("file_path", "")
if not fp.endswith("index.html") or not os.path.exists(fp):
    print("{}")
    sys.exit(0)

heb = re.compile(r"[֐-׿]")

def count(src):
    n = 0
    for m in re.finditer(r"<script[^>]*>(.*?)</script>", src, re.S):
        n += sum(1 for ln in m.group(1).split("\n") if heb.search(ln))
    return n

with open(fp, encoding="utf-8", errors="replace") as f:
    now = count(f.read())
try:
    head = subprocess.run(["git", "-C", os.path.dirname(fp), "show", "HEAD:index.html"],
                          capture_output=True, text=True, check=True).stdout
    base = count(head)
except Exception:
    print("{}")
    sys.exit(0)

if now > base:
    print(json.dumps({"hookSpecificOutput": {
        "hookEventName": "PostToolUse",
        "additionalContext":
            "raw-hebrew: index.html now has %d raw-Hebrew lines inside <script> (HEAD had %d, +%d). "
            "CLAUDE.md rule 1: Hebrew in JS strings must be \\uXXXX. "
            "Escape the strings you just added, unless they are comments." % (now, base, now - base)}}))
else:
    print("{}")
