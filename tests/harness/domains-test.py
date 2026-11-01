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
# 01/11/2026: at most two branch heads per message, and nothing on an agent's report or a system notification
many = hook("\u05ea\u05d0\u05d5\u05e0\u05d4 \u05d1\u05d7\u05d9\u05e8\u05d5\u05dd \u05e2\u05dd \u05d0\u05de\u05d5\u05e0\u05d9\u05d4 \u05d5\u05e0\u05d0\u05de\u05df \u05d5\u05ea\u05d7\u05e7\u05d9\u05e8 \u05d5\u05e2\u05d3\u05ea \u05d1\u05d8\u05d9\u05d7\u05d5\u05ea")
mctx = (many.get("hookSpecificOutput") or {}).get("additionalContext", "")
check("hook: a message that touches many branches loads two heads and names the rest", mctx.count("\u05dc\u05e4\u05e0\u05d9 \u05e9\u05de\u05db\u05d9\u05e0\u05d9\u05dd") == 2 and len(mctx) < 16000, len(mctx))
check("hook: a system notification or an agent's report loads nothing", hook("<task-notification> \u05ea\u05d0\u05d5\u05e0\u05d4") == {} and hook("[Subagent hand-back] \u05ea\u05d0\u05d5\u05e0\u05d4") == {})
# 01/11/2026 (Michael: every rule in its branch): every decision in DECISIONS.md is mapped to a branch or to general
keys = set(doms) | {"general"}
mp = {}
for ln in open(os.path.join(ROOT, "project-files/domains/decisions-map.tsv"), encoding="utf-8"):
    parts = ln.rstrip("\n").split("\t")
    if len(parts) == 3: mp[parts[1].strip()] = parts[2].strip()
heads = [l[3:].strip() for l in open(os.path.join(ROOT, "DECISIONS.md"), encoding="utf-8") if l.startswith("## ")]
unmapped = [h for h in heads if h not in mp]
check("every decision in DECISIONS.md has a branch in decisions-map.tsv (a new decision adds a line: <line>\\t<heading>\\t<key>)", not unmapped, unmapped[:5])
check("decisions-map.tsv uses only real branch keys or general", all(v in keys for v in mp.values()), sorted(set(mp.values()) - keys))
for k, v in doms.items():
    rp = os.path.join(ROOT, "project-files/domains/rules/" + k + ".md")
    check(k + ": has rules/" + k + ".md and its branch file points to it in step 0", os.path.exists(rp) and ("domains/rules/" + k + ".md") in open(os.path.join(ROOT, v["file"]), encoding="utf-8").read())
print("\n%d passed, %d failed" % (passed, failed))
sys.exit(1 if failed else 0)
