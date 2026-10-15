#!/usr/bin/env python3
"""lean-harness.py: a harness run returns one line when green and the FULL log when red.
Lesson 99 (15/10/2026): `PARALLEL=4 bash tests/harness/run.sh 2>&1 | tail -12` was not
rewritten, the tail cut two failures out, and the PR went to CI red in three shards."""
import json
from _common import run, check, done
def cmd(c):
    out = run("lean-harness.py", {"tool_input": {"command": c}})
    try: return json.loads(out).get("hookSpecificOutput", {}).get("updatedInput", {}).get("command", "")
    except Exception: return ""
plain = cmd("bash tests/harness/run.sh")
check("plain run: rewritten, log kept, full log on red", 'bash tests/harness/run.sh' in plain and '>"$LOG"' in plain and 'cat "$LOG"' in plain)
check("a filter is kept", 'bash tests/harness/run.sh mfa >' in cmd("bash tests/harness/run.sh mfa"))
t = cmd("PARALLEL=4 bash tests/harness/run.sh 2>&1 | tail -12")
check("PARALLEL=4 ... | tail -12: rewritten, the tail dropped, PARALLEL right before bash (exported)", t and 'tail' not in t and 'PARALLEL=4 bash tests/harness/run.sh' in t, t)
check("cd + | tail -n 5 and | head -3: rewritten", 'tail' not in cmd("cd /x && bash tests/harness/run.sh | tail -n 5") and cmd("cd /x && bash tests/harness/run.sh | tail -n 5").startswith("cd /x && ") and 'head' not in cmd("bash tests/harness/run.sh | head -3"))
check("anything chained after it: left alone", cmd("bash tests/harness/run.sh; rm -rf x") == "" and cmd("bash tests/harness/run.sh | grep x") == "")
done()
