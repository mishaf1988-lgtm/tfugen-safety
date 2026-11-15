#!/usr/bin/env python3
"""tools/esc-hebrew.py and .claude/hooks/code-raw-hebrew.py (15/11/2026, Michael: "מאשר" on the upgrade ideas).
A temp git repo with functions/api/a.js: an added code line with raw Hebrew is found and escaped; an added comment line, an
old line and a line outside functions/ are not touched; the hook warns with the fix and is silent when clean."""
import json, os, subprocess, sys, tempfile, shutil
sys.stdout.reconfigure(encoding="utf-8")
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
passed = failed = 0
def check(label, cond, detail=None):
    global passed, failed
    if cond: passed += 1; print("  ✓ " + label)
    else: failed += 1; print("  ✗ " + label + ("  -> " + str(detail)[:400] if detail is not None else ""))

H = "תסקיר"
d = tempfile.mkdtemp()
try:
    g = lambda *a: subprocess.run(["git"] + list(a), cwd=d, capture_output=True, text=True)
    g("init", "-q"); g("config", "user.email", "t@t"); g("config", "user.name", "t")
    os.makedirs(os.path.join(d, "functions", "api")); os.makedirs(os.path.join(d, "tools"))
    shutil.copy(os.path.join(ROOT, "tools", "esc-hebrew.py"), os.path.join(d, "tools", "esc-hebrew.py"))
    a = os.path.join(d, "functions", "api", "a.js")
    open(a, "w", encoding="utf-8").write("// old comment " + H + "\nconst x = 1;\n")
    open(os.path.join(d, "notes.md"), "w", encoding="utf-8").write("x\n")
    g("add", "-A"); g("commit", "-qm", "base")
    open(a, "w", encoding="utf-8").write("// old comment " + H + "\nconst x = 1;\nconst y = '" + H + "';\n// new comment " + H + "\nconst z = /[​]/;\n")
    open(os.path.join(d, "notes.md"), "w", encoding="utf-8").write(H + "\n")
    tool = os.path.join(d, "tools", "esc-hebrew.py")
    p = subprocess.run([sys.executable, tool, "--check"], cwd=d, capture_output=True, text=True, encoding="utf-8")
    check("--check lists the two added code lines (raw Hebrew, a hidden character), exit 1; not the comments, not notes.md",
          p.returncode == 1 and "a.js:3" in p.stdout and "a.js:5" in p.stdout and "a.js:1" not in p.stdout and "a.js:4" not in p.stdout and "notes" not in p.stdout, p.stdout)
    env = dict(os.environ, CLAUDE_PROJECT_DIR=d)
    hook = os.path.join(ROOT, ".claude", "hooks", "code-raw-hebrew.py")
    hp = subprocess.run([sys.executable, hook], input=json.dumps({"tool_name": "Bash"}), cwd=d, capture_output=True, text=True, encoding="utf-8", env=env)
    j = json.loads(hp.stdout or "{}")
    ctx = (j.get("hookSpecificOutput") or {}).get("additionalContext", "")
    check("the hook warns after a Bash call, names the lines and the fix command", "a.js:3" in ctx and "esc-hebrew.py" in ctx, hp.stdout + hp.stderr)
    check("the hook is silent on another tool (Read)", subprocess.run([sys.executable, hook], input=json.dumps({"tool_name": "Read"}), cwd=d, capture_output=True, text=True, env=env).stdout.strip() == "{}")
    subprocess.run([sys.executable, tool], cwd=d, capture_output=True, text=True)
    t = open(a, encoding="utf-8").read().split("\n")
    check("the fix escapes only the added code lines; both comments keep their Hebrew", t[2] == "const y = '\\u05ea\\u05e1\\u05e7\\u05d9\\u05e8';" and t[4] == "const z = /[\\u200b]/;" and H in t[0] and H in t[3], t)
    hp = subprocess.run([sys.executable, hook], input=json.dumps({"tool_name": "Edit"}), cwd=d, capture_output=True, text=True, env=env)
    check("after the fix the hook is silent", hp.stdout.strip() == "{}", hp.stdout)
finally:
    shutil.rmtree(d, ignore_errors=True)
print("\n%d passed, %d failed" % (passed, failed))
sys.exit(1 if failed else 0)
