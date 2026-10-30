# Pinned subagents (30/10/2026, Michael: "בצע: סוכני עזר קבועים עם מודל נעול"): the routing table in
# tfugen-orchestrate is only text unless the agents are files with a model. A file without name,
# description or an allowed model would silently fall back to the main conversation's model.
import os, re, sys
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..')
D = os.path.join(ROOT, '.claude', 'agents')
passed = failed = 0
def check(label, cond, detail=None):
    global passed, failed
    if cond: passed += 1; print('  ✓ ' + label)
    else: failed += 1; print('  ✗ ' + label + ('  -> ' + str(detail) if detail is not None else ''))

def front(text):
    m = re.match(r'^---\n(.*?)\n---\n', text, re.S)
    return dict(l.split(':', 1) for l in m.group(1).split('\n') if ':' in l) if m else None

ALLOWED = {'haiku', 'sonnet', 'opus', 'fable'}
EXPECT = {'scout': 'haiku', 'ci-reader': 'haiku', 'security-reviewer': 'opus'}
check('the broken file is caught', front('no front matter') is None)
for name, model in EXPECT.items():
    p = os.path.join(D, name + '.md')
    ok = os.path.exists(p)
    check(name + ': file exists', ok)
    if not ok: continue
    f = front(open(p, encoding='utf-8').read()) or {}
    check(name + ': name matches the file', f.get('name', '').strip() == name, f.get('name'))
    check(name + ': description is not empty', len(f.get('description', '').strip()) > 10)
    check(name + ': model is pinned to ' + model, f.get('model', '').strip() == model, f.get('model'))
    check(name + ': model is an allowed alias', f.get('model', '').strip() in ALLOWED)
    if model == 'haiku':
        check(name + ': a haiku agent has no edit tools', not re.search(r'\b(Edit|Write|NotebookEdit)\b', f.get('tools', '')), f.get('tools'))
print('%d passed, %d failed' % (passed, failed))
sys.exit(1 if failed else 0)
