# SRI on every script the app loads from a CDN (BACKLOG 13.13, 13/10/2026).
# The browser harness aborts or stubs CDN requests, so a wrong hash would pass it
# and break the live app: here every CDN .js URL in index.html must carry a
# sha384 next to it and a pinned version, and with network each hash is checked
# against the real file. No network = that part is skipped, not failed.
import base64, hashlib, os, re, ssl, sys, urllib.request
sys.stdout.reconfigure(encoding="utf-8")
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..')
passed = failed = 0
def check(label, cond, detail=None):
    global passed, failed
    if cond: passed += 1; print('  ✓ ' + label)
    else: failed += 1; print('  ✗ ' + label + ('  -> ' + str(detail)[:400] if detail is not None else ''))

CDN = re.compile(r"https://(?:cdn\.jsdelivr\.net|cdnjs\.cloudflare\.com|unpkg\.com)/[^'\"\\\s]+?\.js\b")
HASH = re.compile(r"sha384-[A-Za-z0-9+/=]{64}")
# Started by pdf.js itself (workerSrc), where no integrity can be given.
NO_SRI = {'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js'}

def pairs(src):
    """(url, hash or None) for each CDN URL: the first sha384 within 700 chars after it."""
    out = []
    for m in CDN.finditer(src):
        lt = src.rfind('<', 0, m.start())
        tag = src[lt:m.start()]
        if tag.startswith('<script') and '>' not in tag:  # a static tag: integrity="..." comes before src
            h = HASH.search(tag)
        else:
            h = HASH.search(src, m.end(), m.end() + 700)
        out.append((m.group(0), h.group(0) if h else None))
    return out

def pinned(url):
    if 'cdnjs.cloudflare.com' in url: return bool(re.search(r'/\d+\.\d+\.\d+/', url))
    return bool(re.search(r'@\d+\.\d+\.\d+/', url))

# The checker itself
check('a URL with no hash is caught', pairs("s.src='https://cdn.jsdelivr.net/npm/a@1.2.3/a.js';") == [('https://cdn.jsdelivr.net/npm/a@1.2.3/a.js', None)])
check('a major-only version is caught', not pinned('https://cdn.jsdelivr.net/npm/web-vitals@4/dist/web-vitals.iife.js'))
check('an exact version passes', pinned('https://cdn.jsdelivr.net/npm/web-vitals@4.2.4/dist/web-vitals.iife.js'))

src = open(os.path.join(ROOT, 'index.html'), encoding='utf-8').read()
ps = [(u, h) for u, h in pairs(src) if u not in NO_SRI]
check('index.html loads scripts from a CDN (the scan found them)', len(ps) >= 10, len(ps))
miss = [u for u, h in ps if not h]
check('every CDN script has a sha384 next to it', not miss, miss)
loose = sorted({u for u, h in ps if not pinned(u)})
check('every CDN script is pinned to an exact version', not loose, loose)
by = {}
for u, h in ps:
    if h: by.setdefault(u, set()).add(h)
split = {u: hs for u, hs in by.items() if len(hs) > 1}
check('one hash per URL across all copies', not split, split)
tags = re.findall(r'<script\b[^>]*\bsrc="https://[^"]+"[^>]*>', src)
bare = [t for t in tags if 'integrity=' not in t or 'crossorigin="anonymous"' not in t]
check('every static <script src=https://...> has integrity and crossorigin', tags and not bare, bare)

# The hashes against the real files
ctx = ssl.create_default_context(cafile=os.environ.get('SSL_CERT_FILE') or os.environ.get('REQUESTS_CA_BUNDLE') or None)
def fetch(url):
    with urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': 'sri-test'}), timeout=30, context=ctx) as r:
        return r.read()
online = True
for u in sorted(by):
    if not online: break
    try:
        body = fetch(u)
    except Exception as e:
        online = False; print('  - skip: no network for the hash check (%s)' % str(e)[:120]); break
    real = 'sha384-' + base64.b64encode(hashlib.sha384(body).digest()).decode()
    check('hash matches the file: ' + u, by[u] == {real}, {'have': sorted(by[u]), 'real': real})

print('%d passed, %d failed' % (passed, failed))
sys.exit(1 if failed else 0)
