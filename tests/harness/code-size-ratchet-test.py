#!/usr/bin/env python3
"""index.html does not get harder to maintain (27/10/2026, Michael: "is the code split into small functions with
clear comments, so we can maintain it more easily in the future?", and in the questionnaire: "do it: gradual
improvement"). Measured that day: 1,594 functions, a typical one 9 lines, 13% comment lines; but 12 blocks over 100
lines and 380 lines over 500 characters (HTML templates written on one line).

A ratchet, not a rewrite: the counts below are a ceiling. A change may not add a long block or a long line; a
change that splits one lowers the number here in the same PR (tfugen-dev, "anti-patterns"). A "block" is the
distance from one function start to the next, so code between functions counts too: crude, but stable.
"""
import os, re, sys
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..')
MAX_LONG_BLOCKS = 12      # blocks over 100 lines (27/10/2026)
MAX_LONG_LINES = 380      # lines over 500 characters (27/10/2026)
MIN_COMMENT_SHARE = 0.12  # comment lines; 13% that day
ok = bad = 0


def check(label, cond, detail=None):
    global ok, bad
    if cond: ok += 1; print('  ✓ ' + label)
    else: bad += 1; print('  ✗ ' + label + ('  -> ' + str(detail) if detail is not None else ''))


def measure(text):
    lines = text.split('\n')
    starts = [i for i, l in enumerate(lines) if re.match(r'\s*(async\s+)?function\s+\w+\s*\(|\s*window\.\w+\s*=\s*function', l)]
    long_blocks = [(starts[k + 1] - starts[k], starts[k] + 1) for k in range(len(starts) - 1) if starts[k + 1] - starts[k] > 100]
    long_lines = sum(1 for l in lines if len(l) > 500)
    comments = sum(1 for l in lines if l.strip().startswith('//'))
    return {'functions': len(starts), 'long_blocks': len(long_blocks), 'long_lines': long_lines,
            'comment_share': comments / max(1, len(lines)), 'blocks': sorted(long_blocks, reverse=True)}


m = measure(open(os.path.join(ROOT, 'index.html'), encoding='utf-8').read())
print('  measured: %(functions)d functions, %(long_blocks)d blocks over 100 lines, %(long_lines)d lines over 500 chars, ' % m
      + '%.1f%% comments' % (100 * m['comment_share']))
check('no new block over 100 lines (ceiling %d)' % MAX_LONG_BLOCKS, m['long_blocks'] <= MAX_LONG_BLOCKS, m['blocks'][:5])
check('no new line over 500 characters (ceiling %d)' % MAX_LONG_LINES, m['long_lines'] <= MAX_LONG_LINES, m['long_lines'])
check('comment lines stay at %d%%+' % int(100 * MIN_COMMENT_SHARE), m['comment_share'] >= MIN_COMMENT_SHARE, m['comment_share'])
if m['long_blocks'] < MAX_LONG_BLOCKS or m['long_lines'] < MAX_LONG_LINES:
    print('  note: below the ceiling. Lower MAX_LONG_BLOCKS / MAX_LONG_LINES here to %d / %d in this PR.' % (m['long_blocks'], m['long_lines']))

# the check itself
small = 'function a(){\n}\n' + 'function b(){\n' + 'x\n' * 150 + '}\nfunction c(){}\n' + 'y' * 600 + '\n// note\n'
s = measure(small)
check('measure: a 150-line block and a 600-char line are counted', s['long_blocks'] == 1 and s['long_lines'] == 1, s)
print('\n%d passed, %d failed' % (ok, bad))
sys.exit(1 if bad else 0)
