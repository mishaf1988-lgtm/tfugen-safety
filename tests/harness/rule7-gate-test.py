# .github/scripts/rule7-gate.py: CLAUDE.md rule 7 on the PR diff.
import importlib.util, os, sys
P = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', '.github', 'scripts', 'rule7-gate.py')
spec = importlib.util.spec_from_file_location('r7', P); r7 = importlib.util.module_from_spec(spec); spec.loader.exec_module(r7)
passed = failed = 0
def check(label, cond, detail=None):
    global passed, failed
    if cond: passed += 1; print('  ✓ ' + label)
    else: failed += 1; print('  ✗ ' + label + ('  -> ' + str(detail) if detail is not None else ''))

M = '`migrations/2026-10-02_x.sql`'
check('added [x] with a migration, no proof: fails', len(r7.bad_lines('+- [x] **A** ' + M + ' done')) == 1)
check('added [x] with "הורץ ואומת": ok', r7.bad_lines('+- [x] **A** ' + M + ' הורץ ואומת דרך Supabase MCP') == [])
check('verified in English: ok', r7.bad_lines('+  - [x] ' + M + ' verified 02/10/2026') == [])
check('open [ ] with a migration: ok', r7.bad_lines('+- [ ] **A** ' + M) == [])
check('removed line (-): ok', r7.bad_lines('-- [x] **A** ' + M) == [])
check('context line: ok', r7.bad_lines(' - [x] **A** ' + M) == [])
check('[x] without a migration file: ok', r7.bad_lines('+- [x] **A** UI only') == [])
print('%d passed, %d failed' % (passed, failed))
sys.exit(1 if failed else 0)
