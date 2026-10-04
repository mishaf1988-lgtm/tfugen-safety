#!/usr/bin/env python3
"""michael-assistant: a PR that changes the assistant must give it a version
higher than main's (04/10/2026, Michael: "approve all"). Twice in one day two
sessions wrote a different "(4)" and then a different "(5)"; only a merge
conflict found the second pair. Since 04/10/2026 a merge to main is uploaded to
the account by a task on Michael's computer, so the same number twice means
one of the two never reaches the account.

Usage in CI: BASE=<base sha> python3 .github/scripts/skill-version-gate.py
Exit 0 = ok (assistant untouched, or a higher version), 1 = bump the version.
Test: tests/harness/skill-version-gate-test.py
"""
import os, re, subprocess, sys

DIR = 'project-files/claude-ai-skill/michael-assistant/'
SKILL = DIR + 'SKILL.md'
# "גרסה: DD/MM/YYYY (N)"
VER = re.compile('גרסה: (\\d{2})/(\\d{2})/(\\d{4}) \\((\\d+)\\)')


def ver(text):
    m = VER.search(text or '')
    return (int(m.group(3)), int(m.group(2)), int(m.group(1)), int(m.group(4))) if m else None


def problem(changed, base_text, head_text):
    if not any(f.startswith(DIR) for f in changed):
        return None
    b, h = ver(base_text), ver(head_text)
    if h is None:
        return 'no version line in ' + SKILL
    if b is not None and h <= b:
        return 'michael-assistant changed but its version %s is not above main %s: bump the line in %s' % (h, b, SKILL)
    return None


if __name__ == '__main__':
    base = os.environ.get('BASE', 'origin/main')
    git = lambda *a: subprocess.run(['git', '-c', 'core.quotepath=off'] + list(a), capture_output=True, text=True).stdout
    changed = git('diff', '--name-only', base).split('\n')
    head = open(SKILL, encoding='utf-8').read() if os.path.exists(SKILL) else ''
    p = problem(changed, git('show', base + ':' + SKILL), head)
    if p:
        print('skill-version-gate: ' + p)
        sys.exit(1)
    print('skill-version-gate: ok')
