# The queue for STATUS.md (tools/status-queue.py, 12/11/2026): the pure verdict, and that push-gate runs it.
import importlib.util, os, sys
sys.stdout.reconfigure(encoding="utf-8")
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..")
spec = importlib.util.spec_from_file_location("sq", os.path.join(ROOT, "tools", "status-queue.py")); sq = importlib.util.module_from_spec(spec); spec.loader.exec_module(sq)
passed = failed = 0
def check(label, cond, detail=None):
    global passed, failed
    if cond: passed += 1; print("  ✓ " + label)
    else: failed += 1; print("  ✗ " + label + ("  -> " + str(detail) if detail is not None else ""))

check("main moved in STATUS.md: the push stops, merge first", sq.verdict(True, 0, "")[0] == 1 and "merge origin/main" in sq.verdict(True, 0, "")[1])
check("another branch holds the queue (claim.sh exit 5): the push stops and names the holder", sq.verdict(False, 5, '{"mine":false,"holder":{"note":"routine/x"}}\n')[0] == 1 and "routine/x" in sq.verdict(False, 5, '{"holder":{"note":"routine/x"}}')[1])
check("the claim is taken: the push goes on", sq.verdict(False, 0, "")[0] == 0)
check("no key or the server is down (exit 3, 4): the push goes on", sq.verdict(False, 3, "")[0] == 0 and sq.verdict(False, 4, "")[0] == 0)
gate = open(os.path.join(ROOT, ".claude", "hooks", "push-gate.py"), encoding="utf-8").read()
check("push-gate runs tools/status-queue.py when STATUS.md changed", '"tools/status-queue.py"' in gate and 'f in QUEUED' in gate and 'QUEUED = ' + repr(sq.QUEUED).replace("'", '"') in gate, repr(sq.QUEUED))
print("%d passed, %d failed" % (passed, failed))
sys.exit(1 if failed else 0)
