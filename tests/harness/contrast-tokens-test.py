#!/usr/bin/env python3
"""BACKLOG 13.21 (13/10/2026): the colour tokens behind most text stay at WCAG AA (4.5).

visual-audit.js section 6 found 148 text elements under AA on 65 pages, almost all from
three tokens: --t3 (#6b7280 on the page grey, 4.35: every page footer and the dashboard
date), --c-blue-400-3 (#3b82f6, white on it 3.68: primary buttons) and --c-teal-700-2
(#0d9488, white on it 3.74: the AI and mail buttons). They became #5f6673, the sign blue
#154889 and #0f766e. This fails if one of them, or the page grey, drifts back under 4.5.
Part B: the JS colour values below.
"""
import os, re, sys

HTML = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'index.html')
s = open(HTML, encoding='utf-8').read()
ok = bad = 0


def check(label, cond, detail=None):
    global ok, bad
    if cond:
        ok += 1; print('  ✓ ' + label)
    else:
        bad += 1; print('  ✗ %s  -> %s' % (label, detail))


def tok(name):
    m = re.search(r'(?<![\w-])--' + re.escape(name) + r':(#[0-9a-fA-F]{6});', s)
    return m and m.group(1)


def lum(h):
    f = lambda x: x / 12.92 if x <= 0.03928 else ((x + 0.055) / 1.055) ** 2.4
    r, g, b = (int(h[i:i + 2], 16) / 255 for i in (1, 3, 5))
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)


def ratio(a, b):
    la, lb = lum(a), lum(b)
    return (max(la, lb) + 0.05) / (min(la, lb) + 0.05)


bg = tok('bg')
pairs = [
    ('--t3 on the page grey (footer, dashboard date)', tok('t3'), bg),
    ('--t3 on white (cards)', tok('t3'), '#ffffff'),
    ('white on --c-blue-400-3 (primary buttons)', '#ffffff', tok('c-blue-400-3')),
    ('white on --c-teal-700-2 (AI / mail buttons)', '#ffffff', tok('c-teal-700-2')),
    ('--warn on white ("סיור הבוקר טרם בוצע", warnings)', tok('warn'), '#ffffff'),
    ('--c-gray-450 on white (field labels in every detail view)', tok('c-gray-450'), '#ffffff'),
]
for label, fg, back in pairs:
    if not fg or not back:
        check(label + ': token found', False, (fg, back)); continue
    r = ratio(fg, back)
    check('%s: %.2f >= 4.5' % (label, r), r >= 4.5, (fg, back))

# The page-title period labels sit on the sign yellow, where no grey reaches 4.5.
for pid in ('cal-period', 'mr-period'):
    m = re.search(r'<span id="' + pid + r'" style="[^"]*color:var\(--s-ink\)', s)
    check('#%s is ink on the yellow title, not --t3 (2.45)' % pid, bool(m))

# Part B (13/10/2026): the mid-tone colours written as JS values (dashboard numbers and
# legends, RPN, NCR priority, review badges) went to darker ones of the same meaning, which
# took the warnings to 0. A quoted one coming back is text under 4.5 on white again.
# '#16a34a' stays only as a cell background with ink text (env. aspects RPN, 5.3).
for h in ('#eab308', '#ca8a04', '#e07a00', '#3b82f6', '#10b981', '#06b6d4', '#a855f7', '#94a3b8'):
    n = s.count("'" + h + "'")
    check("no '%s' JS colour value (text under 4.5 on white)" % h, n == 0, n)
n = s.count("'#16a34a'")
check("'#16a34a' only in the two RPN background functions", n == 2, n)

# Part C (13/10/2026): visual-audit.js measures contrast in the modals, the detail views and the
# trustee kiosk too, not only on the page (68 labels in showView were never measured).
va = open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'visual-audit.js'), encoding='utf-8').read()
check('visual-audit: contrast measured inside each modal', '(${CONTRAST})(m,vis,desc)' in va and 'contrast in modal' in va)
check('visual-audit: contrast reported for the kiosk, its tour form and the detail view',
      va.count("'/emp-home', m.lowContrastCount") == 1 and 'in the tour form' in va and "'/view-' + tbl, m.lowContrastCount" in va)

print('\n%d passed, %d failed' % (ok, bad))
sys.exit(1 if bad else 0)
