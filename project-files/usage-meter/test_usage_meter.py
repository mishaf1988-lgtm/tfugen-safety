#!/usr/bin/env python3
"""statusline.py and usage-line.py (05/10/2026)."""
import json, os, subprocess, sys, tempfile
HERE = os.path.dirname(os.path.abspath(__file__))
res = [0, 0]
def check(l, c, d=None):
    res[0 if c else 1] += 1; print(("  ✓ " if c else "  ✗ ") + l + ("" if c or d is None else "  -> " + repr(d)[:300]))
def run(script, data):
    return subprocess.run([sys.executable, os.path.join(HERE, script)], input=data if isinstance(data, str) else json.dumps(data),
                          capture_output=True, text=True, timeout=30)
full = {"context_window": {"total_input_tokens": 240000, "total_output_tokens": 5000, "used_percentage": 24.4},
        "cost": {"total_cost_usd": 36.09}, "rate_limits": {"five_hour": {"used_percentage": 41}, "seven_day": {"utilization": 0.12}}}
o = run("statusline.py", full).stdout
check("status line: tokens, context %, cost", "245.0k" in o and "הקשר 24%" in o and "$36.09" in o, o)
check("status line: plan limits (percent and 0-1 utilization)", "5 שעות 41%" in o and "שבוע 12%" in o, o)
p = run("statusline.py", "not json")
check("status line: bad input, no crash, still prints", p.returncode == 0 and p.stdout.strip() == "📊", (p.returncode, p.stdout))
check("status line: only cost known", run("statusline.py", {"cost": {"total_cost_usd": 1.5}}).stdout == "$1.50")
d = tempfile.mkdtemp(); t = os.path.join(d, "t.jsonl")
def u(i, inp, cr, cw, out):
    return json.dumps({"message": {"role": "assistant", "id": i, "usage": {"input_tokens": inp, "cache_read_input_tokens": cr, "cache_creation_input_tokens": cw, "output_tokens": out}}})
with open(t, "w") as f:
    f.write(json.dumps({"message": {"role": "user", "content": "x"}}) + "\n")
    f.write(u("m1", 10, 1000, 0, 50) + "\n" + u("m1", 10, 1000, 0, 50) + "\n")   # a streamed message on two lines
    f.write(u("m2", 5, 20000, 1000, 80) + "\n")
o = run("usage-line.py", {"transcript_path": t}).stdout
j = json.loads(o) if o.strip() else {}
check("usage line: systemMessage with the last context (21.0k) and 2 calls (m1 once)", "21.0k" in j.get("systemMessage", "") and "2 קריאות" in j.get("systemMessage", ""), o)
check("usage line: points to the plan usage page", "claude.ai/settings/usage" in j.get("systemMessage", ""))
check("usage line: never blocks", "decision" not in j)
check("usage line: no transcript, nothing, exit 0", run("usage-line.py", {"transcript_path": "/nope"}).stdout == "")
print("\n%d passed, %d failed" % tuple(res)); sys.exit(1 if res[1] else 0)
