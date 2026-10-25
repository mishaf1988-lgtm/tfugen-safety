#!/usr/bin/env python3
"""Which harness files run in one CI shard, balanced by time (25/10/2026).

Usage: shard-plan.py <n> <i> <file>...  -> prints the files of shard i (0-based), one per line.

Until 25/10/2026 run.sh took every n-th file in name order, and shard 0 drew
changepw-wrong-test (78s), session-restore-test (19s) and home-button-test (14s):
it ended last at 2:38 of tests while shard 6 ended at 0:37, so eight shards were
no faster than four (Michael: "is there a way to make it faster?"). Now the
slowest file goes first to the least loaded shard (longest processing time first).
SLOW holds the seconds measured on GitHub (run 40176835144, 25/10/2026); any other
file counts by its kind. A slow file not listed here only costs balance, never a run:
every file still lands in exactly one shard.
"""
import sys

SLOW = {
    'changepw-wrong-test.js': 78, 'trustee-gate-client-test.js': 38, 'mfa-test.js': 28,
    'guess-lock-test.mjs': 24, 'session-restore-test.js': 19, 'home-button-test.js': 14,
    'talk-draft-test.mjs': 13, 'pwned-pw-test.js': 8, 'report-pdf-test.js': 8,
    'empty-dates-static-test.py': 7, 'talk-speak-test.mjs': 6, 'console-quiet-test.js': 6,
    'sync-core-test.js': 6, 'app-split-test.mjs': 6, 'backlog-visual-test.js': 6,
    'trustee-gate-test.mjs': 6, 'pwchange-app-metadata-test.mjs': 5, 'eqi-header-test.js': 5,
    'screens-visual-test.js': 5, 'sync-batch-test.js': 5, 'back-button-test.js': 4,
    'offline-photo-test.js': 4, 'self-check-test.js': 4, 'export-platform-test.py': 4,
}


def weight(f):
    if f in SLOW:
        return SLOW[f]
    return 1.6 if f.endswith('.js') else 0.2  # a browser suite vs a node or python one


def plan(n, files):
    load, out = [0.0] * n, [[] for _ in range(n)]
    # heaviest first; ties by name, so every shard computes the same plan
    for f in sorted(set(files), key=lambda x: (-weight(x), x)):
        k = min(range(n), key=lambda s: (load[s], s))
        load[k] += weight(f)
        out[k].append(f)
    return out, load


if __name__ == '__main__':
    n, i = int(sys.argv[1]), int(sys.argv[2])
    if n < 1 or not 0 <= i < n:
        sys.exit('shard-plan: need 0 <= i < n')
    print('\n'.join(plan(n, sys.argv[3:])[0][i]))
