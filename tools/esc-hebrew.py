#!/usr/bin/env python3
"""Escape raw Hebrew and hidden direction characters in the server code lines this branch added (CLAUDE.md rule 1).

15/11/2026 (Michael: "מאשר" on the upgrade ideas): three times in one day a Python edit script put raw Hebrew into
functions/api/routine-db.js; once a whole-file escape also changed 38 old comment lines. This tool touches only lines
added against HEAD (git diff -U0), only in functions/**/*.js, and leaves a line that is all comment alone.
Usage: python3 tools/esc-hebrew.py            (fix)
       python3 tools/esc-hebrew.py --check    (list, exit 1 if any)
"""
import os, re, subprocess, sys
sys.stdout.reconfigure(encoding="utf-8")
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW = re.compile(r"[֐-׿​-‏‪-‮⁦-⁩]")


def is_comment(line):
    s = line.strip()
    return s.startswith("//") or s.startswith("*") or s.startswith("/*")


def esc(line):
    return "".join("\\u%04x" % ord(c) if RAW.match(c) else c for c in line)


def added(root=ROOT):
    """{file: [line numbers added against HEAD]} for functions/**/*.js"""
    p = subprocess.run(["git", "diff", "-U0", "HEAD", "--", "functions/"], cwd=root, capture_output=True, text=True, encoding="utf-8", timeout=20)
    out, cur = {}, None
    for l in p.stdout.split("\n"):
        if l.startswith("+++ "):
            cur = l[6:] if l.startswith("+++ b/") and l.endswith(".js") else None
        elif cur and l.startswith("@@"):
            m = re.match(r"@@ -\S+ \+(\d+)(?:,(\d+))? @@", l)
            if m:
                a, n = int(m.group(1)), int(m.group(2) if m.group(2) is not None else 1)
                out.setdefault(cur, []).extend(range(a, a + n))
    # a new file not yet added to git is invisible to git diff HEAD: all its lines count as added (16/11/2026, retro)
    u = subprocess.run(["git", "ls-files", "--others", "--exclude-standard", "--", "functions/"], cwd=root, capture_output=True, text=True, encoding="utf-8", timeout=20)
    for f in u.stdout.split("\n"):
        fp = os.path.join(root, f)
        if f.endswith(".js") and os.path.isfile(fp):
            n = len(open(fp, encoding="utf-8").read().split("\n"))
            out.setdefault(f, []).extend(range(1, n + 1))
    return out


def hits(root=ROOT):
    res = []
    for f, nums in added(root).items():
        fp = os.path.join(root, f)
        if not os.path.exists(fp):
            continue
        L = open(fp, encoding="utf-8").read().split("\n")
        for n in nums:
            if 0 < n <= len(L) and RAW.search(L[n - 1]) and not is_comment(L[n - 1]):
                res.append((f, n, L[n - 1]))
    return res


def main():
    h = hits()
    if "--check" in sys.argv:
        for f, n, l in h:
            print("%s:%d  %s" % (f, n, l.strip()[:120]))
        sys.exit(1 if h else 0)
    by = {}
    for f, n, _ in h:
        by.setdefault(f, []).append(n)
    for f, nums in by.items():
        fp = os.path.join(ROOT, f)
        L = open(fp, encoding="utf-8").read().split("\n")
        for n in nums:
            L[n - 1] = esc(L[n - 1])
        open(fp, "w", encoding="utf-8").write("\n".join(L))
        print("escaped %d lines in %s" % (len(nums), f))
    if not h:
        print("nothing to escape")


if __name__ == "__main__":
    main()
