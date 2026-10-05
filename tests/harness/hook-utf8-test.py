#!/usr/bin/env python3
"""Every hook that prints non-ASCII text sets stdout to UTF-8 (lesson 57).
05/10/2026, Michael's computer: Windows writes stdout in cp1255, Claude Code
reads UTF-8. session-start lost its whole report on one emoji; the Hebrew in
the other hooks arrived garbled.
Same day, stdin: Claude Code sends UTF-8 JSON, Windows decoded it as cp1255, so
pr-gate missed the Hebrew retro line and denied every valid PR from the computer."""
import glob, os, re
from _common import check, done
d = os.path.dirname(__import__("_common").hook("ci-watch.py"))
LINE = 'sys.stdout.reconfigure(encoding="utf-8")'
for p in sorted(glob.glob(os.path.join(d, "*.py"))):
    s = open(p, encoding="utf-8").read()
    if "ensure_ascii=False" in s or "print(report(" in s:
        check(os.path.basename(p) + ": stdout set to UTF-8", LINE in s)
    if "sys.stdin" in s:
        check(os.path.basename(p) + ": stdin read as UTF-8", 'sys.stdin.reconfigure(encoding="utf-8")' in s)
done()
