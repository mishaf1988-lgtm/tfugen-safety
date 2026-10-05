#!/usr/bin/env python3
"""push-recheck.py: after a push, a red lessons test warns; green, another
file, or another command says nothing."""
import os, tempfile
from _common import run, check, done, repo_root
R = repo_root()
d = tempfile.mkdtemp()
red, green = os.path.join(d, "red.py"), os.path.join(d, "green.py")
open(red, "w").write("print('lessons file 14500 bytes, cap 14336'); raise SystemExit(1)\n")
open(green, "w").write("print('ok')\n")
L = ".claude/skills/tfugen-lessons/SKILL.md"
push = {"tool_name": "Bash", "cwd": R, "tool_input": {"command": "git commit -qam x && git push -u origin b"}}
e = lambda ch, t: {"CLAUDE_PROJECT_DIR": R, "PUSH_RECHECK_CHANGED": ch, "PUSH_RECHECK_TEST": t}
out = run("push-recheck.py", push, e(L, red))
check("lessons changed + test red: warning with the test output", "additionalContext" in out and "14336" in out, out)
check("lessons changed + test green: nothing", run("push-recheck.py", push, e(L, green)) == "{}")
check("lessons not changed: test not run, nothing", run("push-recheck.py", push, e("index.html", red)) == "{}")
check("not a push: nothing", run("push-recheck.py", {"tool_name": "Bash", "cwd": R, "tool_input": {"command": "git status"}}, e(L, red)) == "{}")
check("'git pushd' is not a push", run("push-recheck.py", {"tool_name": "Bash", "cwd": R, "tool_input": {"command": "echo git pushx"}}, e(L, red)) == "{}")
done()
