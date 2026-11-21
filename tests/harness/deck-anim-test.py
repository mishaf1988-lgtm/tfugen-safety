#!/usr/bin/env python3
# Moving drawings in the training videos (tools/deck_anim.py, 21/11/2026, Michael: "do it: a trial in the next video").
# The render seeks one GSAP timeline, so a tween whose target id is missing breaks the scene, and a tween that starts
# before the scene or after it shows on the wrong slide. deck-video.py must refuse an unknown drawing name.
import json, os, re, subprocess, sys, tempfile
sys.stdout.reconfigure(encoding="utf-8")
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.join(ROOT, "tools"))
import deck_anim  # noqa: E402
passed = failed = 0
def check(label, cond, detail=None):
    global passed, failed
    if cond: passed += 1; print("  ✓ " + label)
    else: failed += 1; print("  ✗ " + label + ("  -> " + str(detail)[:300] if detail is not None else ""))

for name in deck_anim.NAMES:
    for t, d in ((0.0, 6.0), (100.0, 14.0)):
        svg, tl = deck_anim.anim(name, 7, t, d)
        ids = set(re.findall(r'id="([^"]+)"', svg))
        targets = set(re.findall(r'tl\.\w+\("#([^"]+)"', "".join(tl)))
        check("%s (%.0f s): every tween target is in the drawing" % (name, d), targets and targets <= ids, targets - ids)
        check("%s (%.0f s): every id carries the scene prefix s7_" % (name, d), all(i.startswith("s7_") for i in ids), ids)
        starts = [float(m) for m in re.findall(r",([0-9.]+)\);$", "\n".join(tl), re.M)]
        check("%s (%.0f s): every tween starts inside the scene" % (name, d), len(starts) == len(tl) and all(t <= s < t + d for s in starts),
              [s for s in starts if not t <= s < t + d])
        check("%s: an svg of 920x560 with no raw newline" % name, svg.startswith("<svg") and 'viewBox="0 0 920 560"' in svg and "\n" not in svg)

with tempfile.TemporaryDirectory() as tmp:
    bad = os.path.join(tmp, "s.json")
    json.dump([["anim", "", "כותרת", ["שורה"], None, "טקסט הקראה לבדיקה", "nope"]], open(bad, "w", encoding="utf-8"), ensure_ascii=False)
    r = subprocess.run([sys.executable, os.path.join(ROOT, "tools", "deck-video.py"), "html", bad, tmp], capture_output=True, text=True)
    check("deck-video.py refuses an unknown drawing name", r.returncode != 0 and "anim" in (r.stderr + r.stdout), r.stderr[-200:])

sc = json.load(open(os.path.join(ROOT, "project-files", "decks", "video", "hotwork", "scenes.json"), encoding="utf-8"))
used = [x[6] for x in sc if x[0] == "anim"]
check("hotwork: the trial uses the three drawings", sorted(used) == sorted(deck_anim.NAMES), used)
print("%d passed, %d failed" % (passed, failed))
sys.exit(1 if failed else 0)
