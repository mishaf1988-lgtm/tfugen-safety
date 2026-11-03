# project-files/domain-tree/build.py (03/11/2026): the 3D domain tree is built from project-files/domains/,
# one branch per index.json key, light theme (Michael: "בצבע שחור זה לא נראה טוב").
import importlib.util, json, os, sys
sys.stdout.reconfigure(encoding="utf-8")
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..')
P = os.path.join(ROOT, 'project-files', 'domain-tree', 'build.py')
spec = importlib.util.spec_from_file_location('dt', P); dt = importlib.util.module_from_spec(spec); spec.loader.exec_module(dt)
passed = failed = 0
def check(label, cond, detail=None):
    global passed, failed
    if cond: passed += 1; print('  ✓ ' + label)
    else: failed += 1; print('  ✗ ' + label + ('  -> ' + str(detail) if detail is not None else ''))
idx = json.load(open(os.path.join(ROOT, 'project-files', 'domains', 'index.json'), encoding='utf-8'))
keys = [k for k in idx if not k.startswith('_')]
d = dt.data()
check('one branch per domain in index.json', [b['id'] for b in d['branches']] == keys, len(d['branches']))
check('every branch has rules counted', all(b['rules'] > 0 for b in d['branches']))
check('general decisions are counted for the trunk', d['general'] > 0)
t = open(os.path.join(ROOT, 'project-files', 'domain-tree', 'template.html'), encoding='utf-8').read()
check('template has the data slot', t.count('__DATA__') == 1)
check('light theme (no black sky)', 'color-scheme:light' in t and 'alpha:true' in t)
check('three.js pinned to an exact version', 'three.js/r128/three.min.js' in t and 'three@0.128.0' in t)
print('%d passed, %d failed' % (passed, failed))
sys.exit(1 if failed else 0)
