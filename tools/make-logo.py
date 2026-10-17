# Writes functions/_logo.js from logo.jpg (17/10/2026, "product for sale" step 1).
#
#   python3 tools/make-logo.py
#
# logo.jpg in the repo root is the one logo of the factory. The page shows it as
# /logo.jpg; the server cannot read that file (a Function has no repo, and the site
# is behind the Israel-only gate), so _logo.js carries a smaller copy as base64.
# LOGO_SRC_SHA256 records which logo.jpg the copy came from, and
# tests/harness/site-config-test.mjs fails when logo.jpg changes without this script.
# The home-screen icons are the other copy: tools/make-icons.js.
import base64, hashlib, io, os
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
src = open(os.path.join(ROOT, 'logo.jpg'), 'rb').read()
im = Image.open(io.BytesIO(src)).convert('RGB')
w = 260
im = im.resize((w, round(im.height * w / im.width)))
b = io.BytesIO()
im.save(b, 'JPEG', quality=85, optimize=True)
out = (
  "// The factory logo for documents the server builds (10/10/2026, Michael: \"\\u05d1\\u05d8\\u05d5\\u05e4\\u05e1\n"
  "// \\u05e9\\u05e0\\u05e9\\u05dc\\u05d7 \\u05d7\\u05e1\\u05e8 \\u05dc\\u05d5\\u05d2\\u05d5 \\u05e9\\u05dc \\u05ea\\u05e4\\u05d5\\u05d2\\u05df\"). A Function cannot read /logo.jpg from the\n"
  "// repo, and fetching it from the site goes through the Israel-only gate, so the\n"
  "// picture rides in the code: /logo.jpg at %dx%d, JPEG, base64.\n"
  "// Written by `python3 tools/make-logo.py` from logo.jpg; do not edit by hand.\n"
  "export const LOGO_SRC_SHA256 = '%s';\n"
  "export const LOGO_JPG = '%s';\n"
) % (im.width, im.height, hashlib.sha256(src).hexdigest(), base64.b64encode(b.getvalue()).decode())
open(os.path.join(ROOT, 'functions', '_logo.js'), 'w').write(out)
print('wrote functions/_logo.js (%dx%d) from logo.jpg' % (im.width, im.height))
