#!/usr/bin/env python3
"""Basic accessibility in index.html (27/10/2026, Michael in the questionnaire: "do it: basic accessibility",
after a site checklist with "alt text for images" and "clear labels on buttons"). That day 15 of 27 images had
no alt and 71 buttons were an icon only (65 of them the ✕ close) with no aria-label or title, so a screen reader
said nothing useful. Fixed then; this keeps it so.

In plain HTML the label is written in Hebrew; inside a <script> it is \\uXXXX (rule 1). A \\u escape in an HTML
attribute would be read out letter by letter, so that is checked too.
"""
import os, re, sys
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..')
ok = bad = 0
ICON = re.compile(r'^(?:&#\d+;|[^\w\u0590-\u05ff\s\\]){1,3}$')


def check(label, cond, detail=None):
    global ok, bad
    if cond: ok += 1; print('  ✓ ' + label)
    else: bad += 1; print('  ✗ ' + label + ('  -> ' + str(detail) if detail is not None else ''))


def problems(s):
    regions = [(m.end(), s.find('</script>', m.end())) for m in re.finditer(r'<script\b[^>]*>', s)]
    in_script = lambda pos: any(a <= pos < b for a, b in regions)
    out = []
    for m in re.finditer(r'<img\b[^>]*>', s):
        if 'alt=' not in m.group(0) and not s[max(0, m.start() - 40):m.start()].rstrip().endswith('//') and '//' not in s[s.rfind('\n', 0, m.start()):m.start()]:
            out.append('img without alt: ' + m.group(0)[:60])
    for m in re.finditer(r'<button\b([^>]*)>([^<]{1,12})</button>', s):
        if ICON.match(m.group(2).strip()) and 'aria-label' not in m.group(1) and 'title=' not in m.group(1):
            out.append('icon button without aria-label: ' + m.group(0)[:60])
    for m in re.finditer(r'aria-label="\\u05', s):
        if not in_script(m.start()):
            out.append('\\u escape in an HTML attribute (read letter by letter)')
    return out


p = problems(open(os.path.join(ROOT, 'index.html'), encoding='utf-8').read())
check('every image has alt, every icon-only button has aria-label or title, no \\u in plain HTML', not p, p[:5])
check('the check catches an image without alt', problems('<div><img src="x"></div>') != [])
check('the check catches an icon-only close button', problems('<button class="close-btn">&#10005;</button>') != [])
check('a labeled icon button passes', problems('<button aria-label="סגירה">&#10005;</button>') == [])
check('the check catches \\u in a plain HTML attribute', problems('<button aria-label="\\u05e1">x</button>') != [])
check('\\u inside a script is fine', problems('<script>var b=\'<button aria-label="\\u05e1">&#10005;</button>\';</script>') == [])
print('\n%d passed, %d failed' % (ok, bad))
sys.exit(1 if bad else 0)
