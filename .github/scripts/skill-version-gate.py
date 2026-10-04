#!/usr/bin/env python3
"""michael-assistant: a PR that changes the assistant must give it a version
higher than main's (04/10/2026, Michael: "approve all"). Twice in one day two
sessions wrote a different "(4)" and then a different "(5)"; only a merge
conflict found the second pair. Since 04/10/2026 a merge to main is uploaded to
the account by a task on Michael's computer, so the same number twice means
one of the two never reaches the account.

Since 04/10/2026 (Michael: the task uploads the repo skills too) the same rule
holds for every .claude/skills/<name>/SKILL.md that carries a version line, on
main or in the PR. A repo skill without one is not checked (opt-in): almost
every PR touches a skill (tfugen-learn), so a line on each would mean a bump,
and a conflict between parallel sessions, in nearly every PR.

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


def problem(changed, base_text, head_text, d=DIR, required=True):
    if not any(f.startswith(d) for f in changed):
        return None
    b, h = ver(base_text), ver(head_text)
    if h is None and (required or b is not None):
        return 'no version line in ' + d + 'SKILL.md'
    if h is not None and b is not None and h <= b:
        return '%s changed but its version %s is not above main %s: bump the line in %sSKILL.md' % (d.rstrip('/').split('/')[-1], h, b, d)
    return None


def skill_dirs(changed):
    """michael-assistant (version line required) + each changed repo skill (opt-in)."""
    out = [(DIR, True)]
    for f in changed:
        m = re.match(r'(\.claude/skills/[^/]+/)', f)
        if m and (m.group(1), False) not in out:
            out.append((m.group(1), False))
    return out


if __name__ == '__main__':
    base = os.environ.get('BASE', 'origin/main')
    git = lambda *a: subprocess.run(['git', '-c', 'core.quotepath=off'] + list(a), capture_output=True, text=True).stdout
    changed = git('diff', '--name-only', base).split('\n')
    bad = []
    for d, req in skill_dirs(changed):
        f = d + 'SKILL.md'
        head = open(f, encoding='utf-8').read() if os.path.exists(f) else ''
        p = problem(changed, git('show', base + ':' + f), head, d, req)
        if p:
            bad.append(p)
    if bad:
        print('skill-version-gate: ' + '; '.join(bad))
        sys.exit(1)
    print('skill-version-gate: ok')
