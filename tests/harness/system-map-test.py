#!/usr/bin/env python3
"""The system map (project-files/system-map, 27/10/2026, Michael: a 3D model of his work and the agents). Failure reason 2
of the interview: the map goes stale as agents are added. Every active Routine in ACCOUNT-INVENTORY.md is on the map,
and the committed data.json / system-map.html are what build-map.py makes from the repo now."""
import importlib.util, json, os, re, sys
sys.stdout.reconfigure(encoding="utf-8")
ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
D = os.path.join(ROOT, "project-files", "system-map")
spec = importlib.util.spec_from_file_location("bm", os.path.join(D, "build-map.py")); bm = importlib.util.module_from_spec(spec); spec.loader.exec_module(bm)
passed = failed = 0
def check(label, cond, detail=None):
    global passed, failed
    if cond: passed += 1; print("  ✓ " + label)
    else: failed += 1; print("  ✗ " + label + ("  -> " + str(detail) if detail is not None else ""))

data = bm.build()
inv = open(os.path.join(ROOT, "project-files", "ACCOUNT-INVENTORY.md"), encoding="utf-8").read()
active = [m.group(1) for m in re.finditer(r"^\| `(trig_[A-Za-z0-9]+)` \| (?!כבוי)([^|]*)\|", inv, re.M) if "חד-פעמי" not in m.group(2)]
on_map = {n.get("id") for n in data["nodes"]}
missing = [t for t in active if t not in on_map]
check("every active Routine in ACCOUNT-INVENTORY.md is on the map (%d)" % len(active), active and not missing, missing)
check("disabled Routines are not on the map", not any(n.get("id") and n["name"].startswith("כבוי") for n in data["nodes"]))
zones = {z["id"] for z in data["zones"]}
check("every part and every line belongs to a zone that exists", all(n["zone"] in zones for n in data["nodes"]) and all(e["from"] in zones and e["to"] in zones for e in data["edges"]))
check("every zone has at least one part (two levels)", all(any(n["zone"] == z for n in data["nodes"]) for z in zones), [z for z in zones if not any(n["zone"] == z for n in data["nodes"])])
committed = json.load(open(os.path.join(D, "data.json"), encoding="utf-8"))
check("data.json is up to date (run project-files/system-map/build-map.py and republish)", committed == data)
html = open(os.path.join(D, "system-map.html"), encoding="utf-8").read()
check("system-map.html carries the same data", json.dumps(data, ensure_ascii=False) in html and "/*DATA*/null" not in html)
check("the page loads three.js pinned to one version", re.search(r"three@\d+\.\d+\.\d+/build/three\.module\.js", html) is not None)
print("%d passed, %d failed" % (passed, failed))
sys.exit(1 if failed else 0)
