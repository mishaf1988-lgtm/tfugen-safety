#!/usr/bin/env python3
"""rerun-guard.py: a CI re-run is refused until the flaky test is written in tests/harness/flaky.md."""
from _common import run, check, done, repo_root
R = repo_root()
T = "mcp__github__actions_run_trigger"
call = lambda m, listed, tool=T: run("rerun-guard.py", {"tool_name": tool, "cwd": R, "tool_input": {"method": m, "run_id": 1}}, {"CLAUDE_PROJECT_DIR": R, "RERUN_GUARD_LISTED": listed})
deny = lambda o: '"deny"' in o
check("rerun_failed_jobs, nothing written in flaky.md: deny, and the reason names the file", deny(call("rerun_failed_jobs", "0")) and "flaky.md" in call("rerun_failed_jobs", "0"))
check("rerun_workflow_run: deny too", deny(call("rerun_workflow_run", "0")))
check("after the test was written in flaky.md on this branch: pass", call("rerun_failed_jobs", "1") == "{}")
check("run_workflow and cancel are not re-runs: pass", call("run_workflow", "0") == "{}" and call("cancel_workflow_run", "0") == "{}")
check("another tool: pass", call("rerun_failed_jobs", "0", "mcp__github__merge_pull_request") == "{}")
check("the connector with a UUID prefix is the same tool: deny", deny(call("rerun_failed_jobs", "0", "mcp__1234abcd__actions_run_trigger")))
done()
