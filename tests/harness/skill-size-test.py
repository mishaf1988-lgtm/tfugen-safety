#!/usr/bin/env python3
"""Every repo skill's SKILL.md stays under 5,000 words (27/10/2026, Michael in the questionnaire: "do it: split
the two big ones"; Anthropic's "Complete Guide to Building Skills": keep SKILL.md under 5,000 words and move the
detail to references/, loaded only when needed). tfugen-dev (6,993) and tfugen-ref (6,549) were split that day.
Also the guide's frontmatter rules: name = folder (kebab-case), a description under 1,024 characters that says
what the skill does and when to load it, and no angle brackets in it (it goes into the system prompt).
"""
import glob, os, re, sys
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..')
MAX_WORDS = 5000
WARN_WORDS = 4700  # 28/10/2026: tfugen-db went from under to 5,232 in one day; warn before an .md PR has to split it
ok = bad = 0


def check(label, cond, detail=None):
    global ok, bad
    if cond: ok += 1; print('  ✓ ' + label)
    else: bad += 1; print('  ✗ ' + label + ('  -> ' + str(detail) if detail is not None else ''))


def problems(text, folder):
    out = []
    m = re.match(r'^---\n(.*?)\n---\n', text, re.S)
    if not m: return ['no frontmatter']
    fm = m.group(1)
    n = re.search(r'^name:\s*(.+)$', fm, re.M)
    d = re.search(r'^description:\s*(.+?)(?=^[\w-]+:|\Z)', fm, re.M | re.S)
    desc = d.group(1).strip() if d else ''
    if not n or n.group(1).strip() != folder: out.append('name is not the folder name')
    if not re.fullmatch(r'[a-z0-9]+(-[a-z0-9]+)*', folder): out.append('folder is not kebab-case')
    if not desc or len(desc) > 1024: out.append('description empty or over 1024 characters (%d)' % len(desc))
    if '<' in desc or '>' in desc: out.append('angle brackets in the description')
    words = len(text[m.end():].split())
    if words > MAX_WORDS: out.append('%d words in SKILL.md (move detail to references/)' % words)
    return out


skills = sorted(glob.glob(os.path.join(ROOT, '.claude', 'skills', 'tfugen-*', 'SKILL.md')))
check('found the repo skills (10+)', len(skills) >= 10, len(skills))
for f in skills:
    folder = os.path.basename(os.path.dirname(f))
    p = problems(open(f, encoding='utf-8').read(), folder)
    check(folder + ': under %d words, frontmatter by the guide' % MAX_WORDS, not p, p)
    w = len(open(f, encoding='utf-8').read().split())
    if WARN_WORDS < w <= MAX_WORDS:
        print('::warning::%s/SKILL.md has about %d words, near the %d limit: move detail to references/ in this PR' % (folder, w, MAX_WORDS))

# the check itself, on made-up skills
good = '---\nname: tfugen-x\ndescription: Does a thing. Load when a task touches the thing.\n---\nbody\n'
check('a good skill passes', problems(good, 'tfugen-x') == [])
check('too many words fails', problems(good + 'w ' * (MAX_WORDS + 1), 'tfugen-x') != [])
check('a name that is not the folder fails', problems(good, 'tfugen-y') != [])
check('angle brackets in the description fail', problems(good.replace('Does a thing', 'Does <b>a</b> thing'), 'tfugen-x') != [])
print('\n%d passed, %d failed' % (ok, bad))
sys.exit(1 if bad else 0)
