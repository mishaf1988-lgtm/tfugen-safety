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

# Part D (13/10/2026): JS colour values the audit never reaches with the demo data (Excel import
# status, morning-round warn button and print, NCR status in the mail list, backup age, AI
# confidence, lead tile, suggestion badge) went to the same dark shades: '#d97706' (3.19) and
# '#f59e0b' to '#b45309', '#0d9488' (white on it 3.74) to '#0f766e'. '#f59e0b' stays only as the
# border of the low-confidence badge.
for h in ('#d97706', '#0d9488'):
    n = s.count("'" + h + "'")
    check("no '%s' JS colour value (under 4.5 on white)" % h, n == 0, n)
n = s.count("'#f59e0b'")
check("'#f59e0b' only as the low-confidence badge border", n == 1 and "borderColor='#f59e0b'" in s, n)

# The NCR agent panel is dark: its bright colours pass there, but the 9px status and priority
# badges sit on the row colour tinted by their own colour (+'22'), where three were under 4.5.
def mix(c, back, a=0x22 / 255):
    return '#' + ''.join('%02x' % round(int(c[i:i + 2], 16) * a + int(back[i:i + 2], 16) * (1 - a)) for i in (1, 3, 5))

m = re.search(r"var _P=\{(.*?)\};", s)
P = dict((k, (bg, c)) for k, bg, c in re.findall(r"'(\w)':\{bg:'(#\w{6})',b:'#\w{6}',c:'(#\w{6})'\}", m.group(1))) if m else {}
check('NCR agent: four priority colours found', len(P) == 4, P)
for k, (back, c) in P.items():
    r = ratio(c, mix(c, back))
    check('NCR agent priority %s badge %s: %.2f >= 4.5' % (k, c, r), r >= 4.5)
g = re.search(r"function _gsc\(s\)\{(.*?)\}", s)
SC = re.findall(r"'(#\w{6})'", g.group(1)) if g else []
check('NCR agent: four status colours found', len(SC) == 4, SC)
for c in SC:
    worst = min(ratio(c, mix(c, back)) for back, _ in P.values()) if P else 0
    check('NCR agent status badge %s on every row colour: %.2f >= 4.5' % (c, worst), worst >= 4.5)

print('\n%d passed, %d failed' % (ok, bad))
sys.exit(1 if bad else 0)
