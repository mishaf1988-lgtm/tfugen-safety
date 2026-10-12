#!/usr/bin/env python3
"""Redesign phase 1 (12/10/2026): colours in CSS declarations go through var(--c-*).

1779 inline colours became 189 tokens on :root, each with its old value, so phase 3
can change the look in one place. This keeps it that way: a new hex inside a CSS
declaration (color:, background:, border:...) fails here, and so does a var(--c-x)
that :root does not define. Canvas, chart and PDF colours (fillStyle=, a JS value)
are not declarations and stay as they are.
"""
import os, re, sys

HTML = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'index.html')
s = open(HTML, encoding='utf-8').read()
PROP = (r'(?:color|background(?:-color)?|border(?:-(?:top|bottom|left|right|inline-start|inline-end|block-start|block-end))?(?:-color)?'
        r'|outline(?:-color)?|box-shadow|text-shadow|fill|stroke|caret-color|text-decoration-color|accent-color)')
DECL = re.compile(r'(?<![\w-])' + PROP + r'\s*:[^;"\'{}<>]*')
HEX = re.compile(r'(?<![&\w,])#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b')
ok = bad = 0


def check(label, cond, detail=None):
    global ok, bad
    if cond:
        ok += 1; print('  ✓ ' + label)
    else:
        bad += 1; print('  ✗ %s  -> %s' % (label, detail))


raw = []
for d in DECL.finditer(s):
    seg = d.group(0)
    if 'url(' in seg:
        continue
    for m in HEX.finditer(seg):
        line = s.count('\n', 0, d.start()) + 1
        raw.append('%d: %s' % (line, seg[:60]))
check('no hex colour inside a CSS declaration (use a var(--c-*) on :root)', not raw, raw[:5])

root = s[s.index(':root{'):s.index('}', s.index(':root{'))]
defined = set(re.findall(r'--c-([a-z0-9-]+):#', root))
used = set(re.findall(r'var\(--c-([a-z0-9-]+)', s))
missing = sorted(used - defined)
check('every var(--c-*) in use is defined on :root', not missing, missing[:10])
check('the token set is there (phase 1 ran)', len(defined) >= 150, len(defined))

print('\n%d passed, %d failed' % (ok, bad))
sys.exit(1 if bad else 0)
