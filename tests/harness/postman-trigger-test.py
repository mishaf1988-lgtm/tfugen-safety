# The postman's trigger id is hardcoded in functions/api/routine-db.js (POSTMAN_TRIGGER).
# When the postman moves to a new standing chat the trigger gets a new id; the code kept the
# old one on 21/11/2026 and nobody noticed (27/11/2026, lesson 242 follow-up).
# Check: the id in the code is the one that leads a row in ACCOUNT-INVENTORY.md (the live one).
import os, re, sys
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..')
passed = failed = 0
def check(label, cond, detail=None):
    global passed, failed
    if cond: passed += 1; print('  ✓ ' + label)
    else: failed += 1; print('  ✗ ' + label + ('  -> ' + str(detail) if detail is not None else ''))

code = open(os.path.join(ROOT, 'functions', 'api', 'routine-db.js'), encoding='utf-8').read()
m = re.search(r"POSTMAN_TRIGGER\s*=\s*'(trig_[0-9A-Za-z]{20,})'", code)
check('POSTMAN_TRIGGER is defined in routine-db.js', bool(m))
inv = open(os.path.join(ROOT, 'project-files', 'ACCOUNT-INVENTORY.md'), encoding='utf-8').read()
leading = set(re.findall(r'^\|\s*`(trig_[0-9A-Za-z]{20,})`', inv, re.M))
check('the id in the code leads a row of ACCOUNT-INVENTORY.md (the live trigger)',
      bool(m) and m.group(1) in leading, m.group(1) if m else None)
print(f'{passed} passed, {failed} failed')
sys.exit(1 if failed else 0)
