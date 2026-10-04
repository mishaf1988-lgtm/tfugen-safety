#!/usr/bin/env python3
"""Warning only: a fixed short wait added to a harness test (04/10/2026, #1156:
mfa-test waited 400 ms, passed here and failed on a slower GitHub runner).
Wait for the state instead (a loop, waitForFunction). 80 older ones exist, so
only lines this PR adds are named, and nothing fails.

Input: git diff -U0 BASE HEAD -- tests/harness on stdin. Test: tests/harness/skill-version-gate-test.py
"""
import re, sys

SHORT = re.compile(r'waitForTimeout\((\d+)\)')
FILE = re.compile(r'^\+\+\+ b/(.+)$')


def short_waits(diff, limit=500):
    out, cur = [], ''
    for l in diff.split('\n'):
        m = FILE.match(l)
        if m:
            cur = m.group(1)
            continue
        if l.startswith('+') and not l.startswith('+++'):
            for w in SHORT.findall(l):
                if int(w) <= limit:
                    out.append((cur, int(w)))
    return out


if __name__ == '__main__':
    for f, ms in short_waits(sys.stdin.read()):
        print('::warning title=short fixed wait::%s waits %d ms; wait for the state instead (lesson 2)' % (f, ms))
