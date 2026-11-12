#!/usr/bin/env python3
"""The queue for STATUS.md (12/11/2026, Michael in the questionnaire: "do it: a queue for the tracking file").

Several PRs that each add a line at the same place in STATUS.md conflict on GitHub, and CI does not run on a PR with a
conflict (3 times on 11/11/2026). push-gate.py runs this before a push whose changes include STATUS.md:

1. main moved in STATUS.md since this branch left it  -> exit 1: merge origin/main first (the conflict, if any, is
   solved here, not on GitHub).
2. the claim "status-md" (routine-db, 20 minutes, one branch at a time, also inside one session) is held by another
   branch -> exit 1: wait for that PR to merge, merge origin/main, push again.
Otherwise the claim is taken for this branch and the push goes on. After the merge: claim.sh status-md --release.
No key or the server is down (claim.sh exit 3/4): the push goes on; step 1 still holds.

Test: python3 tests/harness/status-queue-test.py
"""
import os, subprocess, sys
sys.stdout.reconfigure(encoding="utf-8")
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ITEM = "status-md"
# every PR appends to these at the same place: STATUS.md, and a new decision with its map line
QUEUED = ("STATUS.md", "DECISIONS.md", "project-files/domains/decisions-map.tsv")


def run(args, timeout=30):
    try:
        p = subprocess.run(args, cwd=ROOT, capture_output=True, text=True, encoding="utf-8", timeout=timeout)
        return p.returncode, (p.stdout or "") + (p.stderr or "")
    except Exception as e:
        return 99, str(e)


def verdict(main_moved, claim_rc, claim_out):
    """Pure: (exit code, message). main_moved = STATUS.md changed on origin/main since the merge base."""
    if main_moved:
        return 1, "status-queue: a tracking file this branch changes (STATUS.md, DECISIONS.md or decisions-map.tsv) also changed on main since the branch left it. git fetch origin main && git merge origin/main (solve it here: keep main's lines and add yours again; then python3 tools/domains-build.py), then push."
    if claim_rc == 5:
        return 1, "status-queue: another branch is writing the tracking files now (" + claim_out.strip().splitlines()[0][:300] + "). Wait until its PR is merged, then git fetch origin main && git merge origin/main, and push again."
    return 0, "status-queue: ok" + ("" if claim_rc == 0 else " (claim not taken, rc %d)" % claim_rc)


def main():
    run(["git", "fetch", "-q", "origin", "main"], 40)
    rc, out = run(["git", "diff", "--name-only", "HEAD...origin/main"])
    _, mine = run(["git", "diff", "--name-only", "origin/main...HEAD"])
    moved = rc == 0 and any(f in out.split() and f in mine.split() for f in QUEUED)
    crc, cout = (0, "")
    if not moved:
        _, br = run(["git", "branch", "--show-current"])
        crc, cout = run(["bash", os.path.join(ROOT, "project-files", "claim.sh"), ITEM, br.strip() or "?"], 40)
    code, msg = verdict(moved, crc, cout)
    print(msg)
    return code


if __name__ == "__main__":
    sys.exit(main())
