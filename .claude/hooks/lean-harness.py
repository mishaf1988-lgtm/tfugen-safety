#!/usr/bin/env python3
"""PreToolUse rewrite: a plain `bash tests/harness/run.sh [filter]` prints ~90
lines (one per suite). Rewrite it so a green run returns one summary line and
a red run returns the FULL log. Filtering may hide success, never a failure.
The full log is kept on disk either way.

Test:  echo '{"tool_input":{"command":"bash tests/harness/run.sh"}}' | python3 .claude/hooks/lean-harness.py
"""
import json, re, sys
sys.stdin.reconfigure(encoding="utf-8")  # Claude Code sends UTF-8; Windows reads cp1255 (05/10/2026)

d = json.load(sys.stdin)
ti = d.get("tool_input", {}) or {}
cmd = ti.get("command", "")
# Also `PARALLEL=4 bash tests/harness/run.sh 2>&1 | tail -12` (15/10/2026, lesson 99): the tail cut
# two failures out of a red run and the PR went to CI red in three shards. The pipe is dropped:
# green is one line anyway, and red must be read in full.
m = re.fullmatch(r"\s*((?:cd\s+\S+\s*&&\s*)?)((?:PARALLEL=\d+\s+)?)bash\s+tests/harness/run\.sh(\s+[\w.-]+)?\s*(?:2>&1\s*)?(?:\|\s*(?:tail|head)(?:\s+-n)?\s+-?\d+\s*)?", cmd)
if not m:
    print("{}")
    sys.exit(0)
prefix, envp = m.group(1), m.group(2)  # envp right before bash: `PARALLEL=4 LOG=..;` would not export it
args = (m.group(3) or "").strip()
new = (prefix + 'LOG="${TMPDIR:-/tmp}/harness-$(date +%s).log"; ' +
       envp + 'bash tests/harness/run.sh ' + args + ' >"$LOG" 2>&1; rc=$?; '
       'if [ $rc -eq 0 ]; then '
       'echo "ALL GREEN: $(grep -c \' 0 failed\' "$LOG") suites passed, '
       '$(grep -c \'report only\' "$LOG") report-only (full log: $LOG)"; '
       'else cat "$LOG"; fi; exit $rc')
print(json.dumps({"hookSpecificOutput": {
    "hookEventName": "PreToolUse",
    "permissionDecision": "allow",
    "updatedInput": dict(ti, command=new)}}))
