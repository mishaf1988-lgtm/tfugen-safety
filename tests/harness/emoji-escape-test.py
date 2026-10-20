# An emoji outside the BMP written as a five-digit escape (lesson 126, 20/10/2026): "\u1f6e0" in JS is
# U+1F6E + "0", a Greek letter and a digit, and the mail showed "Ὦ0" instead of the tool emoji. It
# happened twice in one day (trustee-notify "\u1f6a8", weekly-digest "\u1f6e0" and "\u1f4e7"), from a
# script that escaped every character as \uXXXX. The right form is a surrogate pair: \ud83d\udee0.
# The app has no Greek, so any \u1fXX in the code is this mistake.
import os, re, sys
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..')
BAD = re.compile(r'\\u1[fF][0-9a-fA-F]{3}')
passed = failed = 0
def check(label, cond, detail=None):
    global passed, failed
    if cond: passed += 1; print('  ✓ ' + label)
    else: failed += 1; print('  ✗ ' + label + ('  -> ' + str(detail) if detail is not None else ''))

def scan(paths):
    hits = []
    for p in paths:
        try: t = open(p, encoding='utf-8').read()
        except Exception: continue
        for n, l in enumerate(t.split('\n'), 1):
            for m in BAD.finditer(l): hits.append('%s:%d %s' % (os.path.relpath(p, ROOT), n, m.group(0)))
    return hits

files = [os.path.join(ROOT, 'index.html')]
for d in ['functions', 'tools']:
    for base, _, names in os.walk(os.path.join(ROOT, d)):
        files += [os.path.join(base, x) for x in names if x.endswith(('.js', '.mjs'))]
check('the scan sees the server files', len(files) > 20, len(files))
import tempfile
with tempfile.NamedTemporaryFile('w', suffix='.js', delete=False, encoding='utf-8') as f:
    f.write("const a = '\\u1f6e0 x', b = '\\ud83d\\udee0 ok', c = '\\u05d00';\n"); tmp = f.name
got = scan([tmp]); os.unlink(tmp)
check('a five-digit emoji escape is caught; a surrogate pair and Hebrew followed by a digit are not', len(got) == 1 and got[0].endswith('\\u1f6e0'), got)
hits = scan(files)
check('no five-digit emoji escape in index.html, functions/, tools/', not hits, hits[:5])
print('\nemoji-escape-test: %d passed, %d failed' % (passed, failed))
sys.exit(1 if failed else 0)
