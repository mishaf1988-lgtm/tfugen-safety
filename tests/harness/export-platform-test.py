#!/usr/bin/env python3
"""tools/export-platform.mjs on every PR (17/10/2026, Michael: "בצע" on the upgrade proposal).

The export ran only when someone remembered to run it, so a new Tapugan name in the code, a
migration newer than tools/platform/schema-live.sql, or a template key that functions/_site.js
gained would surface only on the day of the push to safety-platform. Here the whole export runs
into a temporary folder: it must end "clean", and the copy must hold what a new factory needs.
Needs node and Pillow (tools/make-logo.py), both installed in tests.yml.
"""
import os, shutil, subprocess, sys, tempfile

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..")
ok = bad = 0


def check(label, cond, detail=None):
    global ok, bad
    if cond: ok += 1; print("  ✓ " + label)
    else: bad += 1; print("  ✗ " + label + ("  -> " + str(detail) if detail is not None else ""))


out = tempfile.mkdtemp(prefix="platform-")
try:
    p = subprocess.run(["node", os.path.join(ROOT, "tools", "export-platform.mjs"), out],
                       cwd=ROOT, capture_output=True, text=True, encoding="utf-8", timeout=240)
    log = (p.stdout or "") + (p.stderr or "")
    check("the export exits 0", p.returncode == 0, log[-1500:])
    check("the scan ends clean (nothing names Tapugan)", "clean:" in log and "nothing names Tapugan" in log, log[-800:])
    for rel in ("index.html", "functions/_site.js", "db/schema.sql", "db/demo-data.sql", "SETUP.md", "README.md",
                "agents/README.md", "agents/routine-db.sh", "logo.jpg"):
        check("the copy has " + rel, os.path.exists(os.path.join(out, rel)))
    schema = open(os.path.join(out, "db", "schema.sql"), encoding="utf-8").read() if os.path.exists(os.path.join(out, "db", "schema.sql")) else ""
    check("db/schema.sql builds tables and holds no dump stamp", schema.count("create table if not exists") >= 50 and "-- dumped " not in schema)
finally:
    shutil.rmtree(out, ignore_errors=True)
print("\n%d passed, %d failed" % (ok, bad))
sys.exit(1 if bad else 0)
