#!/usr/bin/env bash
# Code map for tfugen-graph (01/11/2026, Michael: "if Graphify can be made more efficient, that is savings too").
# Builds a Graphify graph (AST only, no model, no key) of functions/ AND index.html's inline scripts.
# index.html: everything outside <script> is blanked line by line, so a node's L<n> is the line in index.html.
# Usage: bash tools/graph.sh <dir outside the repo>   -> then: cd <dir>/src && <dir>/venv/bin/graphify explain "<name>"
set -eu
G="${1:?dir outside the repo, e.g. the session scratchpad}/graph"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
case "$G" in "$ROOT"*) echo "graph.sh: the dir must be outside the repo" >&2; exit 2 ;; esac
[ -x "$G/venv/bin/graphify" ] || { python3 -m venv "$G/venv" && "$G/venv/bin/pip" install -q graphifyy; }
rm -rf "$G/src" && mkdir -p "$G/src/app" && cp -r "$ROOT/functions" "$G/src/"
python3 -I - "$ROOT/index.html" "$G/src/app/index.js" <<'PY'
import re, sys
s = open(sys.argv[1], encoding='utf-8').read()
out, pos = [], 0
for m in re.finditer(r'(<script(?![^>]*\bsrc=)[^>]*>)(.*?)(</script>)', s, re.S):
    out.append(re.sub(r'[^\n]', '', s[pos:m.end(1)]))   # HTML before the script: newlines only
    out.append(m.group(2)); pos = m.start(3)
out.append(re.sub(r'[^\n]', '', s[pos:]))
open(sys.argv[2], 'w', encoding='utf-8').write(''.join(out))
PY
cd "$G/src" && "$G/venv/bin/graphify" update . 2>&1 | grep -m1 Rebuilt
echo "graph.sh: ready. cd $G/src && $G/venv/bin/graphify explain \"<name>\"  (app/index.js L<n> = index.html line <n>)"
