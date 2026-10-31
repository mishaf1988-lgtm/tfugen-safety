# overlap-check.py (31/10/2026, Michael: "a process that checks there are no duplicate processes or ones that disturb
# each other"): every PR fails while two agents run the same file, share a busy conversation, two flows share a folder,
# or two agents write the same state key, unless overlap-ok.md says why that is on purpose.
import importlib.util, os, sys
D = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "project-files", "system-map")
s = importlib.util.spec_from_file_location("oc", os.path.join(D, "overlap-check.py")); m = importlib.util.module_from_spec(s); s.loader.exec_module(m)
p_ok = f_ok = 0
def check(l, c, d=None):
    global p_ok, f_ok
    if c: p_ok += 1; print("  ✓ " + l)
    else: f_ok += 1; print("  ✗ " + l + ("  -> " + repr(d) if d is not None else ""))
check("no duplicate or clashing process that overlap-ok.md does not explain", not m.problems(), m.problems())
check("weekdays and times are read: Sun-Thu 17:52", sorted(m.slots("א'-ה' 17:52")) == [(d, 17 * 60 + 52) for d in range(5)])
check("every two hours between two times", len(m.slots("א'-ה' 07:17 עד 19:17, כל שעתיים")) == 5 * 7)
check("a day of the month", m.slots("1 לחודש 08:03") == [("m1", 8 * 60 + 3)])
check("Saturday night", m.slots("מוצ\"ש 22:44") == [(6, 22 * 60 + 44)])
check("every line in overlap-ok.md is still a real finding (no stale excuse)", all(k in dict(m.findings()) for k in m.allowed()), [k for k in m.allowed() if k not in dict(m.findings())])
print("\n%d passed, %d failed" % (p_ok, f_ok))
sys.exit(1 if f_ok else 0)
