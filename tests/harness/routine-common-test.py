# Every Routine prompt kept in the repo opens with step 0: read project-files/agent-common.md
# (09/10/2026, Michael: "self-development and shared knowledge for all the agents").
# A new routine-*.md written without it would run without the shared knowledge and
# without writing its learning line. A file marked "הוחלף, לא נחוץ" is skipped.
import glob, os, sys
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..')
passed = failed = 0
def check(label, cond, detail=None):
    global passed, failed
    if cond: passed += 1; print('  ✓ ' + label)
    else: failed += 1; print('  ✗ ' + label + ('  -> ' + str(detail) if detail is not None else ''))

def problems(name, text):
    if 'הוחלף, לא נחוץ' in text: return []
    lines = text.split('\n')
    marks = [i for i, l in enumerate(lines) if l == '---']
    if len(marks) < 2: return [name + ': the prompt needs an opening and a closing ---']
    prompt = lines[marks[0] + 1:marks[1]]
    if not (prompt and prompt[0].startswith('0. ') and 'agent-common.md' in prompt[0]):
        return [name + ': the first prompt line is not step 0 with agent-common.md']
    return []

files = sorted(glob.glob(os.path.join(ROOT, 'project-files', 'routine-*.md'))) + [os.path.join(ROOT, 'project-files', 'retro-prompt.md')]
real = [p for f in files for p in problems(os.path.basename(f), open(f, encoding='utf-8').read())]
check('every Routine prompt in the repo opens with step 0 (agent-common.md)', real == [], real)

ok = 'x\n---\n0. ידע משותף: קרא את project-files/agent-common.md.\nצעד 1\n---\n'
check('a prompt with step 0 passes', problems('a', ok) == [])
check('a prompt without step 0 fails', len(problems('a', 'x\n---\n1. צעד\n---\n')) == 1)
check('step 0 that is not the first line fails', len(problems('a', 'x\n---\n1. צעד\n0. agent-common.md\n---\n')) == 1)
check('a prompt with no closing --- fails', len(problems('a', 'x\n---\n0. agent-common.md\n')) == 1)
check('a replaced Routine is skipped', problems('a', '**הוחלף, לא נחוץ**\n---\n1. צעד\n---\n') == [])
print('%d passed, %d failed' % (passed, failed))
sys.exit(1 if failed else 0)
