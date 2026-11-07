#!/usr/bin/env python3
"""tools/stale-refs.py (07/11/2026, "self-correcting memory"): an instruction that names a file, a
function or a routine-db op that no longer exists fails here, in the PR that removed it."""
import importlib.util, os, sys, tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
spec = importlib.util.spec_from_file_location("stale_refs", os.path.join(ROOT, "tools", "stale-refs.py"))
sr = importlib.util.module_from_spec(spec); spec.loader.exec_module(sr)
passed = failed = 0
def check(label, cond, detail=""):
    global passed, failed
    if cond: passed += 1; print("  ✓ " + label)
    else: failed += 1; print("  ✗ " + label + "  -> " + str(detail))

real = sr.scan()
check("the real skills, assistant instructions and domain rules point only at code that exists", not real,
      ["%s:%d %s %s" % f for f in real][:20])

with tempfile.TemporaryDirectory() as t:
    def w(rel, text):
        os.makedirs(os.path.dirname(os.path.join(t, rel)), exist_ok=True)
        open(os.path.join(t, rel), "w", encoding="utf-8").write(text)
    w("functions/api/routine-db.js", "if (op === 'state_get') {}\nfunction savedFresh(){}\n")
    w("tools/real-tool.py", "")
    w("project-files/wa-topics/x.md", "\n".join([
        "a `functions/api/routine-db.js` b `functions/api/gone.js:12` c `real-tool.py` d `gone-tool.py`",
        "e `savedFresh` f `weekendGone()` g `afterDateTime` h `{\"op\":\"state_get\"}` i `{\"op\":\"no_such_op\"}`",
        "j `tools/*.py` k `ordinary words`"]))
    w(".claude/skills/systematic-debugging/SKILL.md", "`missingFromAnotherProject`")
    old = sr.ROOT; sr.ROOT = t
    try:
        got = sorted((f[2], f[3]) for f in sr.scan())
    finally:
        sr.ROOT = old
    want = [("file", "functions/api/gone.js"), ("file", "gone-tool.py"), ("name", "weekendGone"), ("op", "no_such_op")]
    check("finds a missing path (with :line), bare file, function and op; skips what exists", got == want, got)
    check("names of outside APIs (Graph afterDateTime) and copied outside skills are not ours", ("name", "afterDateTime") not in got and ("name", "missingFromAnotherProject") not in got, got)

print("\n%d passed, %d failed" % (passed, failed))
sys.exit(1 if failed else 0)
