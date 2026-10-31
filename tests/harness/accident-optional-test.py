#!/usr/bin/env python3
# 31/10/2026 (Michael: "250 לא טופס חובה לא תמיד נדרש", "אין חובה לחתום על התחקיר"; lesson 212):
# form 250 and a signature on the investigation are optional. The rule was fixed in assistant/accidents.md
# on 29/10 while routine-wa-assistant.md still listed 250 among "the three documents", and the assistant
# asked for it again. This test fails when any assistant instruction file lists them as required.
import glob, os, re, sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
NEG = ['אופציונלי', 'לא נרשם', 'לא נרשמים', 'לא נדרש', 'לא חובה', 'אין חובה', 'רק אם', 'לא תמיד', 'לא רושמים', 'לא מחכים', 'לפעמים', 'אם הוא מגיע', 'כשמגיע', 'רק כשנדרש']
REQ = ['חובה', 'שלושת', 'חסר', 'חסרים', 'לחכות ל']
SIGN = ['לחתום על התחקיר', 'חתימה על התחקיר', 'תחקיר חתום']
passed = failed = 0

def check(name, ok, info=''):
    global passed, failed
    if ok: passed += 1; print('  ✓ ' + name)
    else: failed += 1; print('  ✗ ' + name + ('  -> ' + str(info) if info else ''))

def problems(text):
    out = []
    if 'שלושת המסמכים' in text:
        out.append('"שלושת המסמכים" (250, תחקיר, הדרכה)')
    for m in re.finditer(r'250', text):
        w = text[max(0, m.start() - 120):m.end() + 120]
        if 'טופס' in w and any(r in w for r in REQ) and not any(n in w for n in NEG):
            out.append('250 as required: ' + w.replace('\n', ' ')[:160])
    for s in SIGN:
        for m in re.finditer(re.escape(s), text):
            w = text[max(0, m.start() - 120):m.end() + 120]
            if not any(n in w for n in NEG):
                out.append('signature as required: ' + w.replace('\n', ' ')[:160])
    return out

print('Accident: form 250 and signature are optional (31/10/2026)')
check('fixture: three documents fails', problems('מעקב על שלושת המסמכים: 250, תחקיר, הדרכה') != [])
check('fixture: 250 missing fails', problems('חסר: טופס 250 ממשאבי אנוש') != [])
check('fixture: signature fails', problems('נשאר לחתום על התחקיר') != [])
check('fixture: optional passes', problems('טופס 250 אופציונלי, לא נרשם כחסר. אין חובה לחתום על התחקיר') == [])
files = [os.path.join(ROOT, 'project-files', 'routine-wa-assistant.md')] + sorted(glob.glob(os.path.join(ROOT, 'project-files', 'assistant', '*.md')))
for f in files:
    p = problems(open(f, encoding='utf-8').read())
    check(os.path.relpath(f, ROOT) + ': no required 250 or signature', p == [], p)
print('%d passed, %d failed' % (passed, failed))
sys.exit(1 if failed else 0)
