#!/usr/bin/env python3
"""settings.proposed.json: guard-sql covers every SQL tool name (the same check
as .github/scripts/hook-coverage.py), every hook it names exists, and nothing
in the current settings.json was dropped."""
import importlib.util, json, os
from _common import HERE, check, done, repo_root
R = repo_root()
P = os.path.join(HERE, "..", "settings.proposed.json")
if not os.path.exists(P):
    P = os.path.join(R, ".claude", "settings.json")     # after install
new = json.load(open(P, encoding="utf-8"))
old = json.load(open(os.path.join(R, ".claude", "settings.json"), encoding="utf-8"))
spec = importlib.util.spec_from_file_location("hc", os.path.join(R, ".github", "scripts", "hook-coverage.py"))
hc = importlib.util.module_from_spec(spec); spec.loader.exec_module(hc)
check("guard-sql covers every SQL name, UUID prefix included", hc.uncovered(new) == [], hc.uncovered(new))
check("guard-sql still covers Bash", hc.uncovered(new, names=["Bash"]) == [])
cmds = lambda s: {h["command"].split("/.claude/hooks/")[-1] for ev in s["hooks"].values() for e in ev for h in e["hooks"]}
missing = [c for c in cmds(new) if not any(os.path.exists(os.path.join(d, c)) for d in (os.path.join(HERE, "..", "hooks"), os.path.join(R, ".claude", "hooks")))]
check("every hook in the settings exists", not missing, missing)
check("no current hook dropped", cmds(old) <= cmds(new), cmds(old) - cmds(new))
check("permissions unchanged", new.get("permissions") == old.get("permissions"))
check("pr-gate, push-recheck, hebrew-midturn, session-start wired", {"pr-gate.py", "push-recheck.py", "hebrew-midturn.py", "session-start.py"} <= cmds(new))
done()
