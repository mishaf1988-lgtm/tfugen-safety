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
    for rel in ("index.html", "CLAUDE.md", "functions/_site.js", "db/schema.sql", "db/demo-data.sql", "SETUP.md", "README.md",
                "agents/README.md", "agents/routine-db.sh", "logo.jpg"):
        check("the copy has " + rel, os.path.exists(os.path.join(out, rel)))
    schema = open(os.path.join(out, "db", "schema.sql"), encoding="utf-8").read() if os.path.exists(os.path.join(out, "db", "schema.sql")) else ""
    check("db/schema.sql builds tables and holds no dump stamp", schema.count("create table if not exists") >= 50 and "-- dumped " not in schema)
finally:
    shutil.rmtree(out, ignore_errors=True)

# 17/10/2026: the out-dir may be a clone of safety-platform. Its own files survive; the rest is replaced.
clone = tempfile.mkdtemp(prefix="platform-clone-")
try:
    own = {".git/HEAD": "ref: refs/heads/main\n", "handoff.md": "# handoff\n", "checklist-day1.md": "- [ ] x\n",
           "demo/a.sql": "-- demo\n", "docs/terms.md": "# terms\n", "marketing/plan.md": "# plan\n",
           "automation/run.py": "# demo\n", "ci/check.py": "# ci\n", ".github/workflows/tests.yml": "on: push\n", ".gitignore": "*.pyc\n"}
    for rel, txt in own.items():
        os.makedirs(os.path.dirname(os.path.join(clone, rel)) or clone, exist_ok=True)
        open(os.path.join(clone, rel), "w", encoding="utf-8").write(txt)
    open(os.path.join(clone, "old-file.txt"), "w").write("from an earlier export")
    run = lambda *a: subprocess.run(["node", os.path.join(ROOT, "tools", "export-platform.mjs"), clone] + list(a),
                                    cwd=ROOT, capture_output=True, text=True, encoding="utf-8", timeout=240)
    # A file there that no export wrote (no manifest yet): stop, list it, delete nothing.
    p = run("--dry-run"); log = (p.stdout or "") + (p.stderr or "")
    check("--dry-run lists the file and writes nothing", p.returncode == 3 and "old-file.txt" in log and not os.path.exists(os.path.join(clone, "index.html")), log[-400:])
    p = run(); log = (p.stdout or "") + (p.stderr or "")
    check("a file the export did not write stops it (exit 3, listed)", p.returncode == 3 and "old-file.txt" in log and "(not from the export)" in log, log[-600:])
    check("...and nothing was deleted", os.path.exists(os.path.join(clone, "old-file.txt")))
    p = run("--force"); log = (p.stdout or "") + (p.stderr or "")
    check("export into a clone with --force exits 0 and ends clean", p.returncode == 0 and "clean:" in log, log[-800:])
    check("the clone's own files are kept, unchanged", all(os.path.exists(os.path.join(clone, r)) and open(os.path.join(clone, r), encoding="utf-8").read() == t for r, t in own.items()),
          [r for r in own if not os.path.exists(os.path.join(clone, r))])
    check("a file the export no longer makes is removed", not os.path.exists(os.path.join(clone, "old-file.txt")))
    check("the clone gets the app", os.path.exists(os.path.join(clone, "index.html")) and os.path.exists(os.path.join(clone, "CLAUDE.md")))
    check("the export leaves a manifest", os.path.exists(os.path.join(clone, ".export-manifest.json")))
    # 18/10/2026: a Windows checkout has CRLF; the same file must not count as edited there.
    cm = os.path.join(clone, "CLAUDE.md")
    with open(cm, "rb") as f: lf = f.read()
    with open(cm, "wb") as f: f.write(lf.replace(b"\r\n", b"\n").replace(b"\n", b"\r\n"))
    p = run("--dry-run"); log = (p.stdout or "") + (p.stderr or "")
    check("--dry-run after an export: nothing edited, exit 0 (CLAUDE.md in CRLF still counts as unedited)", p.returncode == 0 and "nothing edited there" in log, log[-400:])
    check("the line's own files never appear in the list", not any(k in log for k in ("handoff.md", "checklist-day1.md", "demo/", "docs/", "marketing/", "automation/", "ci/", ".github/", ".gitignore")), log[-400:])
    p = run(); log = (p.stdout or "") + (p.stderr or "")
    check("a second export with nothing edited there passes without --force", p.returncode == 0 and "clean:" in log, log[-600:])
    with open(os.path.join(clone, "CLAUDE.md"), "a", encoding="utf-8") as f: f.write("\nedited in safety-platform\n")
    p = run(); log = (p.stdout or "") + (p.stderr or "")
    check("CLAUDE.md edited there stops the export (exit 3, edited there)", p.returncode == 3 and "CLAUDE.md  (edited there)" in log, log[-600:])
    check("...and the edit is still there", "edited in safety-platform" in open(os.path.join(clone, "CLAUDE.md"), encoding="utf-8").read())
finally:
    shutil.rmtree(clone, ignore_errors=True)

# 18/10/2026 (retro): the scan never proved it catches anything. Each leak below is appended to a
# code line (not a comment, comments are rewritten) of a copied file, the export must stop with
# exit 1 and name the file; the file is restored afterwards. Spelled in parts so this file is clean.
victim = os.path.join(ROOT, "functions", "api", "od-read.js")
orig = open(victim, "rb").read()
try:
    for label, leak in (("a bare owner user name", "sviva" + "_x"), ("the owner phone", "0547" + "940073"),
                        ("the company name", "Tapu" + "gan"), ("the owner mail", "sviva" + "@x.co")):
        open(victim, "wb").write(orig + ("\nconst leak = '" + leak + "';\n").encode("utf-8"))
        tmp = tempfile.mkdtemp(prefix="platform-leak-")
        try:
            p = subprocess.run(["node", os.path.join(ROOT, "tools", "export-platform.mjs"), tmp],
                               cwd=ROOT, capture_output=True, text=True, encoding="utf-8", timeout=240)
            log = (p.stdout or "") + (p.stderr or "")
            check("a leak is caught (" + label + "): exit 1 and the file is named", p.returncode == 1 and "od-read.js" in log, (p.returncode, log[-400:]))
        finally:
            shutil.rmtree(tmp, ignore_errors=True)
finally:
    open(victim, "wb").write(orig)
check("the injected file is restored", open(victim, "rb").read() == orig)
print("\n%d passed, %d failed" % (ok, bad))
sys.exit(1 if bad else 0)
