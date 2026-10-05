"""Shared by the computer-session tests: find the hook (here in ../hooks before
install, in .claude/hooks after it), run it with a JSON stdin, count results."""
import json, os, subprocess, sys

sys.stdout.reconfigure(encoding="utf-8")  # Windows: a piped stdout is cp1255 (lesson 57)

HERE = os.path.dirname(os.path.abspath(__file__))
DIRS = [os.path.join(HERE, "..", "hooks"), os.path.join(HERE, "..", "..", ".claude", "hooks")]
res = {"pass": 0, "fail": 0}


def hook(name):
    for d in DIRS:
        p = os.path.abspath(os.path.join(d, name))
        if os.path.exists(p):
            return p
    raise SystemExit("hook not found: " + name)


def repo_root():
    p = subprocess.run(["git", "rev-parse", "--show-toplevel"], cwd=HERE, capture_output=True, text=True, encoding="utf-8")
    return p.stdout.strip()


def run(name, data, env=None, cwd=None):
    p = subprocess.run([sys.executable, hook(name)], input=json.dumps(data, ensure_ascii=False), capture_output=True, encoding="utf-8",
                       text=True, timeout=60, env=dict(os.environ, **(env or {})), cwd=cwd)
    return p.stdout.strip()


def check(label, cond, detail=None):
    if cond:
        res["pass"] += 1; print("  ✓ " + label)
    else:
        res["fail"] += 1; print("  ✗ " + label + ("  -> " + repr(detail)[:400] if detail is not None else ""))


def done():
    print("\n%d passed, %d failed" % (res["pass"], res["fail"]))
    sys.exit(1 if res["fail"] else 0)


if __name__ == "__main__":
    # run.sh runs every *.py in tests/harness: a self-check, so this file has a summary too.
    for n in ("supervisor.py", "pr-gate.py", "session-start.py", "hebrew-midturn.py", "push-recheck.py", "ci-wait.sh"):
        check("finds " + n, os.path.exists(hook(n)))
    done()
