# tools/common-read.py (24/11/2026, Michael in the questionnaire: "do it: the shared knowledge file"): an agent reads only
# the sections of agent-common.md it needs, not the whole file. A renamed heading must fail here, not be skipped in silence.
import glob, os, re, subprocess, sys
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
sys.path.insert(0, os.path.join(ROOT, 'tools'))
import importlib.util
spec = importlib.util.spec_from_file_location('common_read', os.path.join(ROOT, 'tools', 'common-read.py'))
cr = importlib.util.module_from_spec(spec); spec.loader.exec_module(cr)
passed = failed = 0
def check(label, cond, detail=None):
    global passed, failed
    if cond: passed += 1; print('  ✓ ' + label)
    else: failed += 1; print('  ✗ ' + label + ('  -> ' + repr(detail)[:300] if detail is not None else ''))

full = open(cr.PATH, encoding='utf-8').read()
body, missing = cr.pick(full, ['פתיחה', 'ידע משותף'])
check('the two sections exist and come out whole', not missing and body.startswith('## פתיחה') and '## ידע משותף' in body, missing)
check('it is shorter than the whole file (the saving)', len(body) < len(full) * 0.9, (len(body), len(full)))
check('no other section leaks in', '## סגירה' not in body and '## שיטות לניסיון' not in body)
check('the closing section exists too', not cr.pick(full, ['סגירה'])[1])
check('a name with no section is reported', cr.pick(full, ['אין כזה'])[1] == ['אין כזה'])
r = subprocess.run([sys.executable, os.path.join(ROOT, 'tools', 'common-read.py'), 'אין כזה'], capture_output=True, text=True)
check('the script exits 2 on a missing section', r.returncode == 2 and 'no section' in r.stderr, (r.returncode, r.stderr))
toy = 'x\n## אלף (1)\na\n## בית\nb\n## אלףא\nc\n'
check('a heading matches by its start; two that start the same both come', cr.pick(toy, ['אלף'])[0] == '## אלף (1)\na\n## אלףא\nc\n', cr.pick(toy, ['אלף'])[0])
# every routine that calls the script names sections that exist
bad = []
for f in glob.glob(os.path.join(ROOT, 'project-files', 'routine-*.md')):
    for m in re.finditer(r'common-read\.py ([^`]+)`', open(f, encoding='utf-8').read()):
        names = re.findall(r'"([^"]+)"|(\S+)', m.group(1))
        names = [a or b for a, b in names]
        if cr.pick(full, names)[1]: bad.append((os.path.basename(f), names))
check('every routine asks for sections that exist', bad == [], bad)
print('\n%d passed, %d failed' % (passed, failed))
sys.exit(1 if failed else 0)
