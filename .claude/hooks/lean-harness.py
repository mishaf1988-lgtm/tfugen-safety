#!/usr/bin/env python3
"""PreToolUse rewrite: a plain `bash tests/harness/run.sh [filter]` prints ~90
lines (one per suite). Rewrite it so a green run returns one summary line and
a red run returns the FULL log. Filtering may hide success, never a failure.
The full log is kept on disk either way.

Test:  echo '{"tool_input":{"command":"bash tests/harness/run.sh"}}' | python3 .claude/hooks/lean-harness.py
"""
import json, re, sys

d = json.load(sys.stdin)
ti = d.get("tool_input", {}) or {}
cmd = ti.get("command", "")
m = re.fullmatch(r"\s*(?:cd\s+\S+\s*&&\s*)?bash\s+tests/harness/run\.sh(\s+[\w.-]+)?\s*", cmd)
if not m:
    print("{}")
    sys.exit(0)
prefix = cmd[:cmd.index("bash tests/harness/run.sh")]
args = (m.group(1) or "").strip()
new = (prefix + 'LOG="${TMPDIR:-/tmp}/harness-$(date +%s).log"; '
       'bash tests/harness/run.sh ' + args + ' >"$LOG" 2>&1; rc=$?; '
       'if [ $rc -eq 0 ]; then '
       'echo "ALL GREEN: $(grep -c \' 0 failed\' "$LOG") suites passed, '
       '$(grep -c \'report only\' "$LOG") report-only (full log: $LOG)"; '
       'else cat "$LOG"; fi; exit $rc')
print(json.dumps({"hookSpecificOutput": {
    "hookEventName": "PreToolUse",
    "permissionDecision": "allow",
    "updatedInput": dict(ti, command=new)}}))
