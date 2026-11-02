#!/usr/bin/env python3
# site-up.yml, the "WhatsApp on a change" step (02/11/2026, retro 22/10/2026 (d)): the step's own script runs in bash
# with curl stubbed (GitHub's run list from a fixture, Meta's send recorded), so the test runs what GitHub runs.
import json, os, re, subprocess, sys, tempfile
ok = bad = 0
def check(label, cond, detail=None):
    global ok, bad
    if cond: ok += 1; print("  ✓ " + label)
    else: bad += 1; print("  ✗ " + label + ("  -> " + str(detail) if detail is not None else ""))

root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
lines = open(os.path.join(root, ".github/workflows/site-up.yml"), encoding="utf-8").read().split("\n")
i = next(n for n, l in enumerate(lines) if l.strip() == "- name: WhatsApp on a change")
j = next(n for n in range(i + 1, len(lines)) if lines[n].strip().startswith("- name: "))
r = next(n for n in range(i, j) if lines[n].strip() == "run: |")
body = [l for l in lines[r + 1:j]]
ind = min(len(l) - len(l.lstrip()) for l in body if l.strip())
script = "\n".join(l[ind:] for l in body).replace("${{ github.repository }}", "o/r")

tmp = tempfile.mkdtemp()
stub = r'''
curl() {
  case "$*" in
    *api.github.com*) cat "$FIX" ;;
    *graph.facebook.com*) for a in "$@"; do last="$a"; done; printf '%s\n' "$last" >> "$SENT"; echo '{}' > /tmp/wa.json; printf 200 ;;
  esac
}
'''
def run(conclusions, up, test="false", secrets=True):
    fix = os.path.join(tmp, "runs.json"); sent = os.path.join(tmp, "sent.txt")
    json.dump({"workflow_runs": [{"conclusion": c} for c in conclusions]}, open(fix, "w"))
    open(sent, "w").close()
    env = dict(os.environ, FIX=fix, SENT=sent, UP=up, TEST=test, GH_TOKEN="g",
               META_ACCESS_TOKEN="m" if secrets else "", WA_TO="972500000000" if secrets else "")
    p = subprocess.run(["bash", "-c", stub + script], env=env, capture_output=True, text=True, timeout=60)
    msgs = [json.loads(l)["template"]["components"][0]["parameters"][0]["text"] for l in open(sent) if l.strip()]
    return p, msgs

DOWN = "לא עונה"   # "does not answer"
BACK = "חזר"                        # "came back"
p, m = run(["success"], "false")
check("down after a passed run: one 'down' message", p.returncode == 0 and len(m) == 1 and DOWN in m[0], (p.stdout, p.stderr, m))
p, m = run(["failure"], "false")
check("still down after a failed run: no message", len(m) == 0, m)
p, m = run(["cancelled", "failure"], "false")
check("still down, a cancelled run in between: no second 'down' (the retro case)", len(m) == 0, (p.stdout, m))
p, m = run(["skipped", "cancelled", "failure"], "true")
check("back up after a failure with cancelled/skipped runs in between: one 'back' message", len(m) == 1 and BACK in m[0], (p.stdout, m))
p, m = run(["cancelled", "success"], "false")
check("down after cancelled then passed: one 'down' message", len(m) == 1 and DOWN in m[0], m)
p, m = run(["success"], "true")
check("up after up: no message", len(m) == 0, m)
p, m = run([], "false")
check("no earlier run at all: 'down' goes out", len(m) == 1 and DOWN in m[0], m)
p, m = run(["success"], "false", secrets=False)
check("no secrets: nothing sent, the step still exits 0 (the last step fails the run)", p.returncode == 0 and len(m) == 0 and "no WhatsApp secrets" in p.stdout, p.stdout)
p, m = run(["success"], "true", test="true")
check("a hand test run sends one message even when nothing changed", len(m) == 1, m)
print("\n%d passed, %d failed" % (ok, bad))
sys.exit(1 if bad else 0)
