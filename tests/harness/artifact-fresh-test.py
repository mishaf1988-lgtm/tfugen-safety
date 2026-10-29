#!/usr/bin/env python3
"""artifact-fresh.py (29/10/2026, lesson 194): publishing a tracked file whose
working copy lacks a change already merged to origin/main is denied."""
import json, os, subprocess, sys, tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE); from _common import run
passed = failed = 0


def check(label, cond, detail=None):
    global passed, failed
    if cond:
        passed += 1; print("  ✓ " + label)
    else:
        failed += 1; print("  ✗ " + label + ("  -> " + repr(detail) if detail is not None else ""))


def sh(cwd, *a):
    subprocess.run(list(a), cwd=cwd, check=True, capture_output=True)


root = tempfile.mkdtemp()
origin, work = os.path.join(root, "o.git"), os.path.join(root, "w")
sh(root, "git", "init", "-q", "--bare", "-b", "main", origin)
sh(root, "git", "clone", "-q", origin, work)
for k, v in (("user.email", "t@t"), ("user.name", "t")):
    sh(work, "git", "config", k, v)
MAP = os.path.join(work, "map.html")
open(MAP, "w").write("v1\n"); open(os.path.join(work, "other.txt"), "w").write("a\n")
sh(work, "git", "add", "-A"); sh(work, "git", "commit", "-q", "-m", "1"); sh(work, "git", "push", "-q", "origin", "main")
sh(work, "git", "checkout", "-q", "-b", "old")
# main moves on: map.html gets the band (the #2206 case)
sh(work, "git", "checkout", "-q", "-b", "m", "origin/main")
open(MAP, "w").write("v2 band\n"); sh(work, "git", "commit", "-q", "-am", "band"); sh(work, "git", "push", "-q", "origin", "m:main")
sh(work, "git", "fetch", "-q", "origin")
ENV = {"ARTIFACT_FRESH_FETCH": "0"}
pub = lambda fp, **kw: run("artifact-fresh.py", {"tool_name": "Artifact", "tool_input": dict({"file_path": fp}, **kw)}, env=ENV)

print("\nartifact-fresh")
sh(work, "git", "checkout", "-q", "old")
out = pub(MAP)
check("a branch opened before the merge: denied", '"deny"' in out and "194" in out, out)
check("action read of the same file: passes", pub(MAP, action="read") == "")
check("an asset upload: passes", pub(MAP, asset=True) == "")
sh(work, "git", "checkout", "-q", "-b", "new", "origin/main")
check("a branch from the current main: passes", pub(MAP) == "")
open(MAP, "w").write("v3 local\n"); sh(work, "git", "commit", "-q", "-am", "v3")
check("main's change plus a local one: passes", pub(MAP) == "")
sh(work, "git", "checkout", "-q", "old")
check("an untracked file in the repo: passes", pub(os.path.join(work, "new.html")) == "")
open(os.path.join(root, "x.html"), "w").write("x\n")
check("a file outside any repo (scratchpad): passes", pub(os.path.join(root, "x.html")) == "")
check("another tool: passes", run("artifact-fresh.py", {"tool_name": "Bash", "tool_input": {"file_path": MAP}}, env=ENV) == "")

print("\n%d passed, %d failed" % (passed, failed))
sys.exit(1 if failed else 0)
