# Only the latest handoff stays in the repo root; the previous one moves to
# project-files/handoffs/ in the same PR (CLAUDE.md, «שיחה ארוכה», Michael
# 02/10/2026). 33 of them had piled up in the root, and a session that reads
# "the handoff" could pick an old one. Lesson 10 recurred 4 times as text only.
import os, re, sys
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..')
passed = failed = 0
def check(label, cond, detail=None):
    global passed, failed
    if cond: passed += 1; print('  ✓ ' + label)
    else: failed += 1; print('  ✗ ' + label + ('  -> ' + str(detail) if detail is not None else ''))

def extra(names):
    """Handoff files in the root beyond the one allowed."""
    h = sorted(n for n in names if re.match(r'^handoff-.*\.md$', n))
    return h if len(h) > 1 else []

check('one handoff is fine', extra(['handoff-02-10-2026-18.20.md', 'CLAUDE.md']) == [])
check('none is fine', extra(['CLAUDE.md']) == [])
check('two handoffs fail', len(extra(['handoff-a.md', 'handoff-b.md'])) == 2)
live = extra(os.listdir(ROOT))
check('repo root holds at most one handoff (move the old one to project-files/handoffs/)', live == [], live)
print('%d passed, %d failed' % (passed, failed))
sys.exit(1 if failed else 0)
