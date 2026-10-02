# .github/scripts/hook-coverage.py: which SQL tool names guard-sql.py misses.
import importlib.util, os, sys
P = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', '.github', 'scripts', 'hook-coverage.py')
spec = importlib.util.spec_from_file_location('hc', P); hc = importlib.util.module_from_spec(spec); spec.loader.exec_module(hc)
passed = failed = 0
def check(label, cond, detail=None):
    global passed, failed
    if cond: passed += 1; print('  ✓ ' + label)
    else: failed += 1; print('  ✗ ' + label + ('  -> ' + str(detail) if detail is not None else ''))
S = lambda m: {"hooks": {"PreToolUse": [{"matcher": m, "hooks": [{"command": "python3 x/guard-sql.py"}]}]}}
old = 'Bash|mcp__Supabase__execute_sql|mcp__Supabase__apply_migration'
new = 'Bash|mcp__.*__execute_sql|mcp__.*__apply_migration'
check('the old matcher misses the UUID names', len(hc.uncovered(S(old))) == 2, hc.uncovered(S(old)))
check('the proposed matcher covers all', hc.uncovered(S(new)) == [], hc.uncovered(S(new)))
check('no guard-sql hook at all: every name missing', len(hc.uncovered({"hooks": {}})) == 4)
check('another hook with a wide matcher does not count', len(hc.uncovered({"hooks": {"PreToolUse": [{"matcher": new, "hooks": [{"command": "other.py"}]}]}})) == 4)
print('%d passed, %d failed' % (passed, failed))
sys.exit(1 if failed else 0)
