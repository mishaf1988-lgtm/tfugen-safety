#!/usr/bin/env python3
"""The golden questions as a promptfoo suite (experiment 03/11/2026, STATUS "three experiments from GitHub tools").
Without installing promptfoo: the suite's own provider (replay.py) and judge (judge.py) are run here over the saved
answers of the real run of 02/11/2026, and must give exactly what tools/golden-check.py gives (8/10 on the first answers,
10/10 after the two fixes). tests.json must be what build-tests.py makes from assistant-golden.json now."""
import importlib.util, json, os, re, sys
sys.stdout.reconfigure(encoding="utf-8")
ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
D = os.path.join(ROOT, "project-files", "research", "promptfoo-golden")
passed = failed = 0
def check(label, cond, detail=None):
    global passed, failed
    if cond: passed += 1; print("  ✓ " + label)
    else: failed += 1; print("  ✗ " + label + ("  -> " + str(detail) if detail is not None else ""))
def load(name, path):
    spec = importlib.util.spec_from_file_location(name, path); m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m); return m

bt = load("bt", os.path.join(D, "build-tests.py"))
judge = load("judge", os.path.join(D, "judge.py"))
replay = load("replay", os.path.join(D, "replay.py"))
gc = load("gc", os.path.join(ROOT, "tools", "golden-check.py"))
tests = json.load(open(os.path.join(D, "tests.json"), encoding="utf-8"))
check("tests.json is what build-tests.py makes now (run it after changing the questions)", tests == bt.build())
for c in ("promptfooconfig.yaml", "compare.yaml"):
    cfg = open(os.path.join(D, c), encoding="utf-8").read()
    refs = re.findall(r"file://([\w.\-]+)", cfg) + re.findall(r"answers: (\S+)", cfg)
    check("%s: every file it names exists (%s)" % (c, ", ".join(refs)), refs and all(os.path.exists(os.path.join(D, r)) or os.path.exists(os.path.join(ROOT, r)) for r in refs))
    check("%s pins a promptfoo version" % c, re.search(r"promptfoo@\d+\.\d+\.\d+", cfg))
gold = {q["id"]: q for q in json.load(open(os.path.join(ROOT, "project-files/assistant-golden.json"), encoding="utf-8"))["questions"]}

for name, want in (("answers-261102-first.json", 8), ("answers-261102-final.json", 10)):
    path = os.path.join(D, name)
    os.environ["ANSWERS"] = path
    ans = json.load(open(path, encoding="utf-8"))
    got = heb = 0; same = True
    for t in tests:
        ctx = {"vars": t["vars"]}
        out = replay.call_api(t["vars"]["q"], {}, ctx)["output"]
        g = judge.gold(out, ctx); h = judge.hebrew(out, ctx)
        got += g["pass"]; heb += h["pass"]
        same &= g["pass"] == (not gc.judge(gold[t["vars"]["id"]], ans.get(t["vars"]["id"])))
    check("%s: promptfoo judge = golden-check per question, gold %d/10 (want %d), Hebrew %d/10" % (name, got, want, heb), same and got == want)

os.environ.pop("ANSWERS", None)
r = replay.call_api("x", {"config": {"answers": "project-files/research/promptfoo-golden/answers-261102-first.json"}}, {"vars": {"id": "g10"}})
check("config.answers (the comparison config) is read relative to the repo root", "150" in r.get("output", ""), r)
check("the provider refuses to run without ANSWERS", "error" in replay.call_api("x", {}, {"vars": {"id": "g1"}}))
print("%d passed, %d failed" % (passed, failed))
sys.exit(1 if failed else 0)
