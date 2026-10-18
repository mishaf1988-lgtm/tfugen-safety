# 18/10/2026 (Michael, questionnaire: "בצע: להוסיף את השורה לכל החלטה חדשה", and "בצע: לעשות את הצעות 1 עד 5"):
# a decision in DECISIONS.md that comes from a questionnaire answer says which option he chose,
# "נבחר: מומלץ" or "נבחר אחר: <מה>", so routine-preferences.md can measure its model (it could not on
# 18/10/2026: 64 records, no option kept). Entries dated before FROM are exempt (history is not rewritten).
import os, re, sys
FROM = (2026, 10, 19)
P = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'DECISIONS.md')
QUESTIONNAIRE = re.compile('מיכאל בשאלון|בצע:')
CHOSEN = re.compile('נבחר: מומלץ|נבחר אחר: ?\\S')
HEAD = re.compile(r'^## (\d{2})/(\d{2})/(\d{4})')
passed = failed = 0
def check(label, cond, detail=None):
    global passed, failed
    if cond: passed += 1; print('  ✓ ' + label)
    else: failed += 1; print('  ✗ ' + label + ('  -> ' + str(detail) if detail is not None else ''))

def missing(text):
    out = []
    for sec in re.split(r'\n(?=## )', text):
        m = HEAD.match(sec)
        if not m: continue
        d = (int(m.group(3)), int(m.group(2)), int(m.group(1)))
        if d >= FROM and QUESTIONNAIRE.search(sec) and not CHOSEN.search(sec):
            out.append(sec.split('\n')[0][:90])
    return out

print('decisions-chosen-test')
check('self: a new questionnaire decision without the line is caught', missing('## 20/10/2026: x\n- מיכאל בשאלון: "בצע: כן"') != [])
check('self: with "נבחר: מומלץ" it passes', missing('## 20/10/2026: x\n- מיכאל בשאלון: "בצע: כן". נבחר: מומלץ') == [])
check('self: with "נבחר אחר: <מה>" it passes', missing('## 20/10/2026: x\n- בצע: כן. נבחר אחר: האפשרות השנייה') == [])
check('self: an old entry is exempt', missing('## 18/10/2026: x\n- מיכאל בשאלון: "בצע"') == [])
check('self: a decision without a questionnaire is exempt', missing('## 20/10/2026: x\n- הוחלט בקוד') == [])
text = open(P, encoding='utf-8').read()
bad = missing(text)
check('DECISIONS.md: every questionnaire decision from %02d/%02d/%d says which option was chosen' % (FROM[2], FROM[1], FROM[0]), not bad, bad)
print('\ndecisions-chosen-test: %d passed, %d failed' % (passed, failed))
sys.exit(1 if failed else 0)
