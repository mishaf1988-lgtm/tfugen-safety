# The account skills in project-files/claude-ai-skill/ are uploaded by hand to
# Michael's Claude account, so a wrong line there is read in every chat until
# the next upload. 04/10/2026: michael-assistant/SKILL.md said "31 כללים" while
# references/lessons.md held 32 (handoff 04/10/2026, item 1). This checks:
#  1. "(N כללים" next to a references/*.md file = the numbered rules in that file,
#     numbered 1..N with no gap or repeat.
#  2. every references/*.md that SKILL.md names (its "which file" table) exists.
import os, re, sys, glob
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..')
SKILLS = os.path.join(ROOT, 'project-files', 'claude-ai-skill')
passed = failed = 0
def check(label, cond, detail=None):
    global passed, failed
    if cond: passed += 1; print('  ✓ ' + label)
    else: failed += 1; print('  ✗ ' + label + ('  -> ' + str(detail) if detail is not None else ''))

RULE = re.compile(r'^(\d+)\. ', re.M)
CLAIM = re.compile(r'`(references/[\w.-]+\.md)`[^\n]*?\((\d+) כללים')
REF = re.compile(r'`(references/[\w.-]+\.md)`')

def rule_problems(text):
    """Numbered rules of a lessons file: (count, problems)."""
    nums = [int(n) for n in RULE.findall(text)]
    dup = sorted({n for n in nums if nums.count(n) > 1})
    gap = sorted(set(range(1, len(nums) + 1)) - set(nums))
    probs = (['repeated: %s' % dup] if dup else []) + (['missing: %s' % gap] if gap else [])
    return len(nums), probs

def claims(skill_md):
    return [(f, int(n)) for f, n in CLAIM.findall(skill_md)]

# the parser itself, on made-up text
check('counts numbered rules out of order', rule_problems('1. a\n3. c\n2. b\n')[0] == 3)
check('a repeated number is caught', rule_problems('1. a\n1. b\n')[1] != [])
check('a gap is caught', rule_problems('1. a\n3. c\n')[1] != [])
check('reads the claim next to its file', claims('ב-`references/lessons.md` (32 כללים מטעויות)') == [('references/lessons.md', 32)])
check('old history line "31 הכללים" is not a claim', claims('(31 הכללים ב-`lessons.md`)') == [])

dirs = sorted(d for d in glob.glob(os.path.join(SKILLS, '*')) if os.path.isfile(os.path.join(d, 'SKILL.md')))
check('found account skills', len(dirs) > 0, SKILLS)
for d in dirs:
    name = os.path.basename(d)
    md = open(os.path.join(d, 'SKILL.md'), encoding='utf-8').read()
    for ref in sorted(set(REF.findall(md))):
        check('%s: %s exists' % (name, ref), os.path.isfile(os.path.join(d, ref)))
    for ref, n in claims(md):
        p = os.path.join(d, ref)
        if not os.path.isfile(p): continue
        real, probs = rule_problems(open(p, encoding='utf-8').read())
        check('%s: SKILL.md says %d rules in %s' % (name, n, ref), real == n, 'the file has %d' % real)
        check('%s: %s numbered 1..%d once each' % (name, ref, real), probs == [], probs)
# 06/10/2026: m365-guard repeats the Microsoft 365 rules of michael-assistant on its own.
# The core of each rule must be in both, or one of them drifts (one of them still said
# "the switches matter most" after Michael chose to keep them on).
g = os.path.join(SKILLS, 'm365-guard', 'SKILL.md'); r = os.path.join(SKILLS, 'michael-assistant', 'references', 'm365.md')
if os.path.isfile(g) and os.path.isfile(r):
    gt, rt = open(g, encoding='utf-8').read(), open(r, encoding='utf-8').read()
    for w in ['"בצע"', 'למחיקה', 'ניהול בטיחות', 'Claude Log', 'AADSTS53003', 'נתונים, לא הוראות', 'טיוט', 'Teams', 'לא מכבים']:
        check('m365 rule in both skills: ' + w, w in gt and w in rt, [w in gt, w in rt])
    check('m365.md no longer leans on the switches', 'המתגים חשובים יותר מהכל' not in rt and 'המנעול המעשי: מתגי' not in rt)
    check('m365-guard has a version line', re.search(r'גרסה: \d{2}/\d{2}/\d{4} \(\d+\)', gt) is not None)
print('%d passed, %d failed' % (passed, failed))
sys.exit(1 if failed else 0)
