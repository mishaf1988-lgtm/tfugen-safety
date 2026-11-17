#!/usr/bin/env python3
"""tools/pr-shot.js (Michael, 17/11/2026, four test rules, rule 1): a phone-wide PNG of the real index.html, with
the sha256 of that index.html beside it (pr-gate.py compares it), and no picture of an empty screen."""
import hashlib, json, os, subprocess, sys
sys.stdout.reconfigure(encoding="utf-8")
ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
res = [0, 0]
def check(label, cond, detail=None):
    res[0 if cond else 1] += 1
    print(("  ✓ " if cond else "  ✗ ") + label + ("" if cond or detail is None else "  -> " + repr(detail)[:300]))
def shot(*a):
    return subprocess.run(["node", os.path.join(ROOT, "tools", "pr-shot.js")] + list(a), cwd=ROOT, capture_output=True, text=True, encoding="utf-8", timeout=120)
name = "_pr-shot-test"
png = os.path.join(ROOT, ".shots", name + ".png")
for f in (png, png + ".json"):
    if os.path.exists(f):
        os.remove(f)
p = shot(name, "--page", "dash")
check("the home screen: exit 0, and it prints the line for the PR description", p.returncode == 0 and "צילום:" in p.stdout and ".shots/" + name + ".png" in p.stdout, (p.returncode, p.stdout, p.stderr))
head = open(png, "rb").read(24) if os.path.exists(png) else b""
check("a PNG 780 pixels wide (390 at 2x, a phone)", head[:8] == b"\x89PNG\r\n\x1a\n" and int.from_bytes(head[16:20], "big") == 780, head)
side = json.load(open(png + ".json", encoding="utf-8")) if os.path.exists(png + ".json") else {}
check("the .json beside it holds the sha256 of this index.html", side.get("index_sha") == hashlib.sha256(open(os.path.join(ROOT, "index.html"), "rb").read()).hexdigest(), side)
for f in (png, png + ".json"):
    if os.path.exists(f):
        os.remove(f)
p = shot(name, "--js", "document.body.innerHTML=''")
check("an empty screen: exit 1 and no picture", p.returncode == 1 and not os.path.exists(png), (p.returncode, p.stderr))
p = shot()
check("no name: usage, exit 2", p.returncode == 2, p.returncode)
print("\n%d passed, %d failed" % (res[0], res[1]))
sys.exit(1 if res[1] else 0)
