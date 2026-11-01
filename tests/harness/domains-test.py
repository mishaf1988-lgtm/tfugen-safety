#!/usr/bin/env python3
# The work branches (01/11/2026, Michael: "split all our work into branches ... for you and for the assistant").
# One word list (project-files/domains/index.json) feeds Claude's hook and the assistant's fire text; each branch
# file is one page with the document checklist on top, its controlled forms and its laws.
import importlib.util, json, os, subprocess, sys
sys.stdout.reconfigure(encoding="utf-8")
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
passed = failed = 0
def check(label, cond, detail=None):
    global passed, failed
    if cond: passed += 1; print("  ✓ " + label)
    else: failed += 1; print("  ✗ " + label + ("  -> " + str(detail)[:300] if detail is not None else ""))
idx = json.load(open(os.path.join(ROOT, "project-files/domains/index.json"), encoding="utf-8"))
doms = {k: v for k, v in idx.items() if not k.startswith("_")}
spec = importlib.util.spec_from_file_location("db", os.path.join(ROOT, "tools/domains-build.py")); db = importlib.util.module_from_spec(spec); spec.loader.exec_module(db)
check("functions/_domains.js is the build of index.json (run python3 tools/domains-build.py)", open(os.path.join(ROOT, "functions/_domains.js"), encoding="utf-8").read() == db.build())
for k, v in doms.items():
    p = os.path.join(ROOT, v["file"])
    ok = os.path.exists(p)
    check(k + ": the branch file exists", ok, v["file"])
    if not ok: continue
    lines = open(p, encoding="utf-8").read().splitlines()
    txt = "\n".join(lines)
    check(k + ": one page (at most 80 lines)", len(lines) <= 80, len(lines))
    check(k + ": the document checklist is in the first 15 lines", any("לפני שמכינים" in l for l in lines[:15]))
    for sec in ["טפסים מבוקרים", "חקיקה", "החלטות", "תיקיות"]:
        check(k + ": has a section " + sec, ("## " + sec) in txt)
    check(k + ": no long dash", "—" not in txt)
def hook(prompt):
    r = subprocess.run([sys.executable, os.path.join(ROOT, ".claude/hooks/domain-load.py")], input=json.dumps({"prompt": prompt, "cwd": ROOT}), capture_output=True, text=True, env=dict(os.environ, CLAUDE_PROJECT_DIR=ROOT), timeout=20)
    return json.loads(r.stdout or "{}")
h = hook("תכין טופס 08.01 להדרכה")
ctx = (h.get("hookSpecificOutput") or {}).get("additionalContext", "")
check("hook: 08.01 loads the training branch with its checklist", "training.md" in ctx and "לפני שמכינים" in ctx, ctx[:200])
check("hook: work at height and a risk survey load both branches", all(x in str(hook("עבודה בגובה בסקר סיכונים")) for x in ["height.md", "risk.md"]))
check("hook: an unrelated message loads nothing", hook("מה שלומך?") == {})
s = json.load(open(os.path.join(ROOT, ".claude/settings.json"), encoding="utf-8"))
check("settings: the hook runs on every message", any("domain-load.py" in x.get("command", "") for e in s["hooks"]["UserPromptSubmit"] for x in e["hooks"]))
for f in ["functions/api/wa-hook.js", "functions/api/chat.js"]:
    check(f + ": the assistant gets the branch line (domainLine)", "domainLine(" in open(os.path.join(ROOT, f), encoding="utf-8").read())
a = open(os.path.join(ROOT, "project-files/routine-wa-assistant.md"), encoding="utf-8").read()
check("the assistant's procedure says to read the branch file on a domain line", "project-files/domains/" in a)
print("\n%d passed, %d failed" % (passed, failed))
sys.exit(1 if failed else 0)
