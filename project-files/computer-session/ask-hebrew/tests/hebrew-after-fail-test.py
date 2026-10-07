#!/usr/bin/env python3
"""hebrew-after-fail.py: a failed tool adds the Hebrew reminder; a green one says nothing."""
from _common import run, check, done
R = lambda **k: run("hebrew-after-fail.py", dict({"hook_event_name": "PostToolUse", "tool_name": "Bash"}, **k))
check("PostToolUseFailure: reminder, same event name", "לקח 13" in run("hebrew-after-fail.py", {"hook_event_name": "PostToolUseFailure", "tool_name": "Bash", "error": "x"}) and '"PostToolUseFailure"' in run("hebrew-after-fail.py", {"hook_event_name": "PostToolUseFailure"}))
check("a Python traceback in stdout: reminder", "לקח 13" in R(tool_response={"stdout": "Traceback (most recent call last):\n  File x\nAssertionError", "stderr": ""}))
check("a red test summary (24 passed, 1 failed): reminder", "לקח 13" in R(tool_response={"stdout": "eqi-test.js  22 passed, 1 failed"}))
check("a red test mark: reminder", "לקח 13" in R(tool_response={"stdout": "  ✗ editing keeps the status"}))
check("Exit code 1: reminder", "לקח 13" in R(tool_response="Exit code 1\nerror"))
check("is_error on the response: reminder", "לקח 13" in R(tool_response={"is_error": True, "content": "x"}))
check("green (24 passed, 0 failed): nothing", R(tool_response={"stdout": "24 passed, 0 failed\nALL GREEN"}) == "{}")
check("an ordinary result: nothing", R(tool_response={"stdout": "M index.html"}) == "{}")
check("bad input: nothing, no crash", run("hebrew-after-fail.py", {}) == "{}")
done()
