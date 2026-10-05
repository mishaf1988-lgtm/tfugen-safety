#!/usr/bin/env python3
"""pr-gate.py: a PR description without the retro / skill lines is denied
before the PR is opened; a good one passes; other tools pass."""
from _common import run, check, done, repo_root
R = repo_root()
PR = "mcp__github__create_pull_request"
base = {"tool_name": PR, "cwd": R}
env = {"CLAUDE_PROJECT_DIR": R, "PR_GATE_CHANGED": "index.html"}
deny = lambda o: '"deny"' in o
out = run("pr-gate.py", dict(base, tool_input={"title": "x", "body": "שינוי"}), env)
check("no retro line: deny", deny(out) and "retro" in out, out)
out = run("pr-gate.py", dict(base, tool_input={"title": "x", "body": "רטרו: אין"}), env)
check("retro but no skill line: deny", deny(out) and "skill" in out, out)
out = run("pr-gate.py", dict(base, tool_input={"title": "x", "body": "רטרו: אין\nskill: אין"}), env)
check("both lines: pass", out == "{}", out)
out = run("pr-gate.py", dict(base, tool_input={"title": "x", "body": "רטרו: אין\nskill: למדתי משהו"}), env)
check("skill says learned, no skill file changed: deny", deny(out), out)
out = run("pr-gate.py", dict(base, tool_input={"title": "x", "body": "רטרו: אין\nskill: למדתי משהו"}),
          dict(env, PR_GATE_CHANGED="index.html,.claude/skills/tfugen-ref/SKILL.md"))
check("skill says learned and a skill file changed: pass", out == "{}", out)
out = run("pr-gate.py", dict(base, tool_input={"title": "Fix: באג", "body": "רטרו: אין\nskill: אין"}), env)
check("fix PR without a lesson: deny", deny(out) and "lesson" in out, out)
out = run("pr-gate.py", {"tool_name": "mcp__other__create_pull_request", "cwd": R, "tool_input": {"title": "x", "body": ""}}, env)
check("a create_pull_request with another prefix is also checked", deny(out), out)
out = run("pr-gate.py", {"tool_name": "Bash", "cwd": R, "tool_input": {"command": "ls"}}, env)
check("another tool: pass", out == "{}", out)
out = run("pr-gate.py", dict(base, tool_input={"title": "x", "body": ""}), dict(env, CLAUDE_PROJECT_DIR="/nonexistent"), cwd="/")
check("gate file missing: pass (CI still checks), no crash", out == "{}", out)
done()
