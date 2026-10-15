#!/usr/bin/env python3
"""pkill-guard.py (lesson 39, BACKLOG 13.19, 15/10/2026): pkill -f anywhere and
pgrep -f inside a while/until loop are denied; a bracketed pattern, a PID kill
and pkill/pgrep without -f pass."""
from _common import run, check, done
def bash(cmd):
    return run("pkill-guard.py", {"tool_name": "Bash", "tool_input": {"command": cmd}})
deny = lambda c: '"deny"' in bash(c)
check("pkill -f: denied, with the PID way and the bracket fix", deny("pkill -f run.sh") and "ps" in bash("pkill -f run.sh") and "[r]un.sh" in bash("pkill -f run.sh"))
check("pkill -f quoted, after other commands, -9 -f, -fx, --full: denied", all(deny(c) for c in ('cd /x && pkill -f "http.server"', "pkill -9 -f run.sh", "pkill -fx node", "pkill --full x", "sleep 1; /usr/bin/pkill -f x || true")))
check("pgrep -f in an until/while loop: denied", deny('until ! pgrep -f "run.sh"; do sleep 2; done') and deny("while pgrep -f harness >/dev/null; do sleep 1; done"))
check("pgrep -f in a loop, multi-line: denied", deny("while true\ndo\n  pgrep -f run.sh || break\n  sleep 1\ndone"))
check("bracketed pattern: passes", bash("pkill -f '[r]un.sh'") == "" and bash('until ! pgrep -f "[r]un.sh"; do sleep 2; done') == "")
check("pgrep -f outside a loop: passes", bash("pgrep -f run.sh") == "" and bash("ps aux | grep run.sh; pgrep -fa node") == "")
check("without -f (process name): passes", bash("pkill node") == "" and bash("pkill -9 node") == "" and bash("while pgrep node; do sleep 1; done") == "")
check("kill by PID and other commands: nothing", bash("kill 1234") == "" and bash("echo pkill is in a word") == "" and run("pkill-guard.py", {"tool_name": "Edit"}) == "")
check("pkill -f inside a quoted string (commit message, echo): passes (15/10/2026, the hook denied its own commit)", bash('git commit -qm "hook: blocks pkill -f and pgrep -f (lesson 39, 13.19)\n\nmore" && git push') == "" and bash("echo 'never pkill -f run.sh'") == "")
check("pkill -f inside a heredoc body (a script written to a file): passes", bash("cat > t.py <<'EOF'\nbash(\"pkill -f run.sh\")\nwhile x: pass\nEOF\npython3 t.py") == "" and bash("python3 - <<EOF\nprint('pkill -f x')\nEOF") == "" and bash("cat > n.md <<'EOF'\nnever run pkill -f run.sh, or while pgrep -f x\nEOF\ngit add n.md") == "")
check("a real pkill -f after a heredoc: still denied", deny("cat > t.txt <<'EOF'\nhello\nEOF\npkill -f run.sh"))
check("pgrep -f inside $(...) and backticks in a loop: denied", deny('while [ -n "$(pgrep -f run.sh)" ]; do sleep 1; done') and deny("until [ -z `pgrep -f run.sh` ]; do sleep 1; done"))
check("the pattern after -u user, and with 2>/dev/null: named in the fix", "[r]un.sh" in bash("pkill -u root -f run.sh 2>/dev/null"))
done()
