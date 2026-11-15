#!/usr/bin/env python3
"""Security round 15/11/2026 (Michael: "do it: one round"): a shared secret from a request header
(x-notify-secret, a raw token) is compared with secretOk from functions/_shared.js (SHA-256, constant time),
never with === or !==, so the time does not tell how much of it matched. 15 such compares were moved."""
import glob, os, re, subprocess, sys
sys.stdout.reconfigure(encoding="utf-8")
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
passed = failed = 0
def check(label, cond, detail=None):
    global passed, failed
    if cond: passed += 1; print("  ✓ " + label)
    else: failed += 1; print("  ✗ " + label + ("  -> " + str(detail)[:400] if detail is not None else ""))

BAD = re.compile(r"get\('x-notify-secret'\)[^;\n]{0,12}[!=]==|[!=]==\s*\(?request\.headers\.get\('x-notify-secret'\)|[!=]==\s*rawTok\b|\brawTok\s*[!=]==")
def bad_lines(text):
    return [i + 1 for i, l in enumerate(text.split("\n")) if BAD.search(l) and "secret-ok:" not in l]

hits = {}
for f in sorted(glob.glob(os.path.join(ROOT, "functions", "**", "*.js"), recursive=True)):
    rel = os.path.relpath(f, ROOT).replace(os.sep, "/")
    b = bad_lines(open(f, encoding="utf-8").read())
    if b: hits[rel] = b
check("no x-notify-secret or raw token compared with === / !== (use await secretOk(given, want) from _shared.js)", not hits, hits)
check("detector: the old forms are found",
      bad_lines("if (!want || (request.headers.get('x-notify-secret') || '') !== want) x();") == [1]
      and bad_lines("if (request.headers.get('x-notify-secret') !== env.S) x();") == [1]
      and bad_lines("ok = !!t && t === rawTok && 1;") == [1])
check("detector: the new form and a presence check are left alone",
      bad_lines("if (!(await secretOk(request.headers.get('x-notify-secret'), want))) x();") == []
      and bad_lines("if (path !== '/api/vitre' || !request.headers.get('x-notify-secret')) return false;") == [])

src = open(os.path.join(ROOT, "functions", "_shared.js"), encoding="utf-8").read()
fn = src[src.index("export async function secretOk"):]
fn = fn[:fn.index("\n}\n") + 3].replace("export ", "")
js = fn + "\nconst r = [await secretOk('abc', 'abc'), await secretOk('abd', 'abc'), await secretOk('', 'abc'), await secretOk('abc', ''), await secretOk(undefined, undefined), await secretOk('abc', 'abcd')];\nconsole.log(JSON.stringify(r));\n"
p = subprocess.run(["node", "--input-type=module", "-e", js], capture_output=True, text=True, timeout=60)
check("secretOk: equal = true; one char off, empty, missing, longer = false", p.stdout.strip() == "[true,false,false,false,false,false]", p.stdout + p.stderr)

print("\n%d passed, %d failed" % (passed, failed))
sys.exit(1 if failed else 0)
