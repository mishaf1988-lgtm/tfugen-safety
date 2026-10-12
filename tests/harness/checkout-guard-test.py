#!/usr/bin/env python3
"""checkout-guard.py (lesson 26, 08/10/2026): git checkout/restore of a file with
uncommitted changes is denied; branch switches and clean files pass."""
import os, subprocess, tempfile
from _common import run, check, done
r = tempfile.mkdtemp()
g = lambda *a: subprocess.run(["git", "-C", r] + list(a), capture_output=True, check=True)
g("init", "-q"); g("config", "user.email", "t@t"); g("config", "user.name", "t")
os.makedirs(os.path.join(r, "functions"))
for f in ("functions/a.js", "functions/b.js"):
    open(os.path.join(r, f), "w").write("x\n")
g("add", "."); g("commit", "-qm", "c"); g("branch", "side")
open(os.path.join(r, "functions/a.js"), "w").write("fixed\n")   # an uncommitted fix
def bash(cmd, cwd=r):
    return run("checkout-guard.py", {"tool_name": "Bash", "cwd": cwd, "tool_input": {"command": cmd}})
check("git checkout <changed file>: denied, names the file and the cp way", '"deny"' in bash("git checkout functions/a.js") and "functions/a.js" in bash("git checkout -- functions/a.js") and "cp" in bash("git checkout functions/a.js"))
check("git restore <changed file>: denied", '"deny"' in bash("git restore functions/a.js"))
check("cd + checkout, and git -C: denied", '"deny"' in bash("cd " + r + " && git checkout functions/a.js", cwd="/") and '"deny"' in bash("git -C " + r + " checkout functions/a.js", cwd="/"))
check("checkout . with a change: denied", '"deny"' in bash("git checkout ."))
check("with a redirect (2>/dev/null, >x, &>/dev/null) after the file: still denied (12/10/2026)", all('"deny"' in bash("true; git checkout -q functions/a.js " + rd + "; git stash -q") for rd in ("2>/dev/null", ">out.txt", "&>/dev/null")))
check("branch switch with a redirect: passes", bash("git checkout side 2>/dev/null") == "")
check("a clean file: passes", bash("git checkout functions/b.js") == "")
check("branch switch and -B: pass", bash("git checkout side") == "" and bash("git checkout -q -B routine/x side") == "")
check("restore --staged (unstage only): passes", bash("git restore --staged functions/a.js") == "")
check("other commands: nothing", bash("git status && ls functions") == "" and run("checkout-guard.py", {"tool_name": "Edit"}) == "")
done()
