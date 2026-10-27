#!/usr/bin/env python3
"""merge=union in .gitattributes (27/10/2026): a local merge of origin/main keeps both sides of an
append conflict in DECISIONS.md / STATUS.md by itself, and a code file still stops with a conflict."""
import os, re, shutil, subprocess, sys, tempfile
sys.stdout.reconfigure(encoding="utf-8")
ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
passed = failed = 0
def check(label, cond, detail=None):
    global passed, failed
    if cond: passed += 1; print("  ✓ " + label)
    else: failed += 1; print("  ✗ " + label + ("  -> " + str(detail) if detail is not None else ""))

rules = [l.split() for l in open(os.path.join(ROOT, ".gitattributes"), encoding="utf-8") if l.strip() and not l.startswith("#")]
union = [r[0] for r in rules if "merge=union" in r[1:]]
check("union only on .md files", union and all(p.endswith(".md") for p in union), union)
check("DECISIONS.md and STATUS.md are in the list", "DECISIONS.md" in union and "STATUS.md" in union, union)

d = tempfile.mkdtemp()
def git(*a):
    return subprocess.run(["git", "-c", "user.name=t", "-c", "user.email=t@t", *a], cwd=d, capture_output=True, text=True, encoding="utf-8")
git("init", "-q", "-b", "main")
shutil.copy(os.path.join(ROOT, ".gitattributes"), d)
base = {"DECISIONS.md": "# החלטות\n\n## א\n", "STATUS.md": "## פתוח עכשיו\n- [ ] פריט\n", "index.html": "<script>\nvar a=1;\n</script>\n"}
for n, t in base.items():
    open(os.path.join(d, n), "w", encoding="utf-8").write(t)
git("add", "-A"); git("commit", "-qm", "base")
git("checkout", "-qb", "pr")
for n, add in (("DECISIONS.md", "\n## ב (PR)\n"), ("STATUS.md", "- [ ] פריט של ה-PR\n")):
    open(os.path.join(d, n), "a", encoding="utf-8").write(add)
open(os.path.join(d, "index.html"), "w", encoding="utf-8").write("<script>\nvar a=2;\n</script>\n")
git("commit", "-qam", "pr")
git("checkout", "-q", "main")
for n, add in (("DECISIONS.md", "\n## ג (main)\n"), ("STATUS.md", "- [ ] פריט של main\n")):
    open(os.path.join(d, n), "a", encoding="utf-8").write(add)
open(os.path.join(d, "index.html"), "w", encoding="utf-8").write("<script>\nvar a=3;\n</script>\n")
git("commit", "-qam", "main")
git("checkout", "-q", "pr")
git("merge", "--no-edit", "main")
dec = open(os.path.join(d, "DECISIONS.md"), encoding="utf-8").read()
st = open(os.path.join(d, "STATUS.md"), encoding="utf-8").read()
html = open(os.path.join(d, "index.html"), encoding="utf-8").read()
check("DECISIONS.md: both new decisions kept, no markers", "## ב (PR)" in dec and "## ג (main)" in dec and "<<<<<<<" not in dec, dec)
check("STATUS.md: both new items kept, no markers", "פריט של ה-PR" in st and "פריט של main" in st and "<<<<<<<" not in st, st)
check("index.html (code): still a conflict, not merged silently", "<<<<<<<" in html, html)
unmerged = git("diff", "--name-only", "--diff-filter=U").stdout.split()
check("only the code file is left unmerged", unmerged == ["index.html"], unmerged)
shutil.rmtree(d, ignore_errors=True)
print("%d passed, %d failed" % (passed, failed))
sys.exit(1 if failed else 0)
