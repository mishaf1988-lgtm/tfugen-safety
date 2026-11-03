# The scheduled agents that read a scan as an image must download it with tools/od-get.sh
# (token through routine-db), not with execute_sql: a scheduled run has no execute_sql.
# 03/11/2026: the filing run of 10:52 reported 3 scans "waiting for download approval"
# without ever trying, because routine-mail-filing.md step 3a required execute_sql.
import os, re, sys
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..')
passed = failed = 0
def check(label, cond, detail=None):
    global passed, failed
    if cond: passed += 1; print('  ✓ ' + label)
    else: failed += 1; print('  ✗ ' + label + ('  -> ' + str(detail) if detail is not None else ''))
def read(p): return open(os.path.join(ROOT, p), encoding='utf-8').read()

filing = read('project-files/routine-mail-filing.md')
validity = read('project-files/routine-validity.md')
for name, text in (('routine-mail-filing.md', filing), ('routine-validity.md', validity)):
    check(name + ' downloads a scan with tools/od-get.sh', 'tools/od-get.sh' in text)
    bad = [l for l in text.split('\n') if 'od_raw_token' in l and 'execute_sql' in l]
    check(name + ' does not set od_raw_token through execute_sql', not bad, bad[:1])
check('filing: must try the download before "מחכה לאישור הורדה"', 'חובה לנסות את ההורדה' in filing)
check('filing: a refused od_move is not retried in the same run', 'od_move`) שמסווג ההרשאות סירב' in filing)
og = read('tools/od-get.sh')
check('od-get.sh sets the token through routine-db state_set', 'routine-db.sh' in og and '"op\\":\\"state_set' in og)
check('od-get.sh revokes the token at the end', 'od_raw_exp' in og and '$now' in og)
print(f'{passed} passed, {failed} failed')
sys.exit(1 if failed else 0)
