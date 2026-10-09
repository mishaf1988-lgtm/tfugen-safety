#!/usr/bin/env python3
"""project-files/live-check.sh (09/10/2026, night round): the live site must run the commit
that was merged (or a later main commit) and serve that commit's index.html. Before, only the
index was compared, so a PR that changed only functions/ passed at once on the old deployment
(#1294). Runs the real script in a throwaway clone, with a fake routine-db.sh that answers
op live from FAKE_LIVE."""
import hashlib, json, os, shutil, subprocess, tempfile
from _common import check, done, repo_root

SRC = os.path.join(repo_root(), "project-files", "live-check.sh")
T = tempfile.mkdtemp()


def git(cwd, *a):
    return subprocess.run(["git", "-c", "user.email=t@t", "-c", "user.name=t"] + list(a), cwd=cwd, capture_output=True, text=True, check=True).stdout.strip()


org = os.path.join(T, "origin")
os.makedirs(org)
git(org, "init", "-q", "-b", "main")
shas = []
for n, (fname, body) in enumerate([("index.html", "v1"), ("functions.js", "f2"), ("index.html", "v3")]):
    with open(os.path.join(org, fname), "w") as f:
        f.write(body)
    git(org, "add", "-A")
    git(org, "commit", "-q", "-m", "c%d" % n)
    shas.append(git(org, "rev-parse", "HEAD"))
# shas[0]: index v1; shas[1]: only functions changed (index still v1); shas[2]: index v3
cl = os.path.join(T, "clone")
git(T, "clone", "-q", org, cl)
os.makedirs(os.path.join(cl, "project-files"), exist_ok=True)
shutil.copy(SRC, os.path.join(cl, "project-files", "live-check.sh"))
with open(os.path.join(cl, "project-files", "routine-db.sh"), "w") as f:
    f.write('printf "%s" "$FAKE_LIVE"\n')



def run(commit, index_sha, want=None):
    env = dict(os.environ, FAKE_LIVE=json.dumps({"ok": True, "commit": commit, "index_sha256": index_sha}, separators=(",", ":")), LIVE_TRIES="1", LIVE_SLEEP="0")
    if want:
        env["LIVE_WANT"] = want
    p = subprocess.run(["bash", os.path.join(cl, "project-files", "live-check.sh")], capture_output=True, text=True, env=env, timeout=60)
    return p.returncode


v1 = hashlib.sha256(git(org, "show", shas[0] + ":index.html").encode()).hexdigest()
v3 = hashlib.sha256(git(org, "show", shas[2] + ":index.html").encode()).hexdigest()
check("live runs the wanted commit with its index: 0", run(shas[1], v1, shas[1]) == 0)
check("a functions-only PR: the old deployment has the same index but not the commit: 4", run(shas[0], v1, shas[1]) == 4)
check("the wanted commit but another index: 4", run(shas[1], v3, shas[1]) == 4)
check("main moved on while waiting: a later commit with ITS index: 0", run(shas[2], v3, shas[1]) == 0)
check("a later commit serving an older index: 4", run(shas[2], v1, shas[1]) == 4)
check("default want = origin/main: the tip with its index: 0", run(shas[2], v3) == 0)
check("no answer from op live: 4", run("", "") == 4)
shutil.rmtree(T, ignore_errors=True)
done()
