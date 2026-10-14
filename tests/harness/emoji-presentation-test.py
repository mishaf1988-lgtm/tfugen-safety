#!/usr/bin/env python3
"""BACKLOG 13.22 (13/10/2026): emoji that default to text presentation carry U+FE0F.

🗑 (1F5D1), 🖨 (1F5A8), 🌡 (1F321) and 🗣 (1F5E3) are emoji whose default form is text,
so a browser may draw them with a text font and show a box (iPhone). visual-audit.js
counted them on 61 pages at 390 (194 glyphs, both data states), almost all the delete and
print buttons. Each one in the app is now followed by U+FE0F (variation selector 16),
which asks for the emoji form. 👁 (1F441, the view button next to them) too: on a phone all
three were colour emoji already, on the computer they were plain red signs, and with only
two of them changed a row showed a colour bin beside a red eye (Michael in the
questionnaire, 14/10/2026: "בצע: גם 👁 צבעוני"). This fails if a new one is written without it, in any of
the three spellings the file uses: &#128465; in HTML, \\ud83d\\uddd1 in JS, or the raw
character in a JS string. The CSS comments at the top of the file are skipped.
The arrows the audit also notes (2191, 2193, 21BA, 21BB) are not emoji, so FE0F does
not change them and they are not checked here.
"""
import os, re, sys

HTML = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'index.html')
s = open(HTML, encoding='utf-8').read()
start = s.find('<body')
body = s[start:]
SEL = r'(?!️|\\ufe0f|&#65039;|&#xfe0f;)'
ok = bad = 0


def check(label, cond, detail=None):
    global ok, bad
    if cond:
        ok += 1; print('  ✓ ' + label)
    else:
        bad += 1; print('  ✗ %s  -> %s' % (label, detail))


check('index.html has a <body>', start > 0)
for cp, name in [(0x1F441, 'eye'), (0x1F5D1, 'wastebasket'), (0x1F5A8, 'printer'), (0x1F321, 'thermometer'), (0x1F5E3, 'speaking head')]:
    hi = 0xD800 + ((cp - 0x10000) >> 10); lo = 0xDC00 + ((cp - 0x10000) & 0x3FF)
    forms = [('&#%d;' % cp, re.escape('&#%d;' % cp)),
             ('\\u%04x\\u%04x' % (hi, lo), re.escape('\\u%04x\\u%04x' % (hi, lo))),
             ('raw', re.escape(chr(cp)))]
    total = 0
    for label, pat in forms:
        total += len(re.findall(pat, body, re.I))
        miss = [body.count('\n', 0, m.start()) for m in re.finditer(pat + SEL, body, re.I)]
        check('%s %s: every one followed by FE0F' % (name, label), not miss, '%d without, body lines %s' % (len(miss), miss[:5]))
    if cp in (0x1F441, 0x1F5D1, 0x1F5A8):
        check('%s: still in use (%d), so the check above means something' % (name, total), total >= 10, total)

print('\n%d passed, %d failed' % (ok, bad))
sys.exit(1 if bad else 0)
