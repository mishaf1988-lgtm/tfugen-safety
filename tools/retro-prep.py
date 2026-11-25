#!/usr/bin/env python3
"""One call for steps 1-3 of the daily retro (25/11/2026, Michael in the questionnaire: "do it: one action for the daily retro";
Code Mode principle, DECISIONS 24/11/2026). The last run (24/11/2026) made 13 tool calls in its first round ($2.07, 46 commits);
each call re-reads the whole context, and the diff passed through the retro's own context twice (read, then pasted into the
reviewer's and the challenger's prompts). This script does the git work and writes the diff to a FILE the two sub-agents read
themselves, so the diff never enters the retro's context.

What it does: leaves a dirty work tree stashed (and says so), fetches origin/main, checks out `retro-work`, lists the commits of the
window (1 day; Sunday 3 days; `--days N` overrides) except "Monthly metrics", and writes one bundle file: the commit list and each
commit's diff hunks, WITHOUT index.html (only its stat line) and capped per commit. It prints a short summary, never the diff.

Usage: python3 tools/retro-prep.py [--days N] [--out FILE] [--repo DIR]
Exit 0 = bundle written (path printed), 2 = no commits in the window ("nothing new": the retro writes one line and stops),
4 = a git command failed (message printed).
"""
import argparse
import os
import subprocess
import sys
from datetime import datetime
from zoneinfo import ZoneInfo

HUNK_CAP = 10000       # characters of diff per commit, then "[cut]"
TOTAL_CAP = 300000     # characters of the whole bundle; past it a commit gets its stat line only
SKIP_SUBJECT = 'Monthly metrics'
# files that grow every day or are huge: the bundle shows their stat line, not their lines
BIG_FILES = ('index.html', 'DECISIONS.md', 'STATUS.md', 'STATUS-archive.md', 'RETRO-LOG.md', 'agent-log.md', 'decisions-map.tsv', 'BACKLOG.md')


def git(repo, *args, check=True):
    p = subprocess.run(['git', '-C', repo] + list(args), capture_output=True, text=True)
    if check and p.returncode != 0:
        raise RuntimeError('git %s failed: %s' % (' '.join(args), (p.stderr or p.stdout).strip()[:300]))
    return p.stdout


def window_days(now=None):
    """3 on Sunday (Israel), else 1."""
    now = now or datetime.now(ZoneInfo('Asia/Jerusalem'))
    return 3 if now.weekday() == 6 else 1


def commits(repo, days):
    out = git(repo, 'log', '--since=%d days ago' % days, 'origin/main', '--format=%H\t%s')
    rows = [l.split('\t', 1) for l in out.splitlines() if '\t' in l]
    return [(h, s) for h, s in rows if SKIP_SUBJECT not in s]


def commit_diff(repo, h):
    """The commit's diff hunks without the big files (stat line only) and capped."""
    names = [n for n in git(repo, 'diff-tree', '--root', '--no-commit-id', '--name-only', '-r', h).splitlines() if n]
    keep = [n for n in names if os.path.basename(n) not in BIG_FILES]
    big = [n for n in names if os.path.basename(n) in BIG_FILES]
    parts = []
    if keep:
        d = git(repo, 'show', '--format=', '--unified=3', h, '--', *keep)
        parts.append(d if len(d) <= HUNK_CAP else d[:HUNK_CAP] + '\n[cut: diff longer than %d characters]\n' % HUNK_CAP)
    for n in big:
        parts.append('[%s changed: %s]\n' % (n, git(repo, 'show', '--format=', '--shortstat', h, '--', n).strip()))
    return ''.join(parts)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--days', type=int)
    ap.add_argument('--out', default='/tmp/retro-bundle.md')
    ap.add_argument('--repo', default=os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    a = ap.parse_args()
    try:
        stashed = False
        if git(a.repo, 'status', '--porcelain').strip():
            git(a.repo, 'stash', '-u')
            stashed = True
        git(a.repo, 'fetch', '-q', 'origin', 'main')
        git(a.repo, 'checkout', '-q', '-B', 'retro-work', 'origin/main')
        days = a.days if a.days is not None else window_days()
        cs = commits(a.repo, days)
        if stashed:
            print('NOTE: the work tree was dirty, stashed (git stash list) - write it in the closing line')
        if not cs:
            print('nothing new in %d day(s) (Monthly metrics aside)' % days)
            return 2
        with open(a.out, 'w', encoding='utf-8') as f:
            f.write('# retro bundle: %d commits, last %d day(s)\n\n## commits\n' % (len(cs), days))
            for h, s in cs:
                f.write('- %s %s\n' % (h[:9], s))
            used = 0
            for h, s in cs:
                if used > TOTAL_CAP:
                    d = '[bundle full: stat only] ' + git(a.repo, 'show', '--format=', '--shortstat', h).strip() + '\n'
                else:
                    d = commit_diff(a.repo, h)
                used += len(d)
                f.write('\n## %s %s\n```diff\n%s```\n' % (h[:9], s, d))
        size = os.path.getsize(a.out)
        print('%d commits, last %d day(s); bundle: %s (%d KB). Give the path to the reviewer and the challenger; do not print it.'
              % (len(cs), days, a.out, size // 1024))
        return 0
    except RuntimeError as e:
        print(str(e), file=sys.stderr)
        return 4


if __name__ == '__main__':
    sys.exit(main())
