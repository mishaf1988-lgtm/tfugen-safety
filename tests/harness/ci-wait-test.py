#!/usr/bin/env python3
"""ci-wait.sh: only the newest non-cancelled `tests` run of the sha decides.
A fake gh (first on PATH) answers from a JSON file and applies the real --jq."""
import json, os, subprocess, tempfile
from _common import hook, check, done
d = tempfile.mkdtemp(); runs = os.path.join(d, "runs.json"); gh = os.path.join(d, "gh")
open(gh, "w").write('''#!/usr/bin/env bash
# fake gh: api <path> --jq <expr>
path="$2"; expr="$4"
case "$path" in
  */check-runs*) jq -r "$expr" "%s" ;;
  *) echo ${FAKE_SHA:-abc1234def} ;;
esac
''' % runs)
os.chmod(gh, 0o755)
fails = os.path.join(d, "fails"); sha = ["abc1234def"]
def clear():
    import shutil; shutil.rmtree(fails, ignore_errors=True)
keep = [False]
def wait(rs, repo=None):
    json.dump({"check_runs": rs}, open(runs, "w"))
    if not keep[0]: clear()
    p = subprocess.run(["bash", hook("ci-wait.sh"), "b"] + ([repo] if repo else []), capture_output=True, text=True, timeout=60,
                       env=dict(os.environ, PATH=d + os.pathsep + os.environ["PATH"], CI_WAIT_SLEEP="0", CI_FAILS_DIR=fails, FAKE_SHA=sha[0]))
    return p.returncode, p.stdout
r = lambda i, s, c=None: {"id": i, "status": s, "conclusion": c}
rc, o = wait([r(1, "completed", "failure"), r(2, "completed", "success")])
check("old failure + new success: green (exit 0)", rc == 0, (rc, o))
rc, o = wait([r(2, "completed", "success"), r(1, "completed", "failure")])
check("order in the answer does not matter (sort by id)", rc == 0, (rc, o))
rc, o = wait([r(1, "completed", "success"), r(2, "completed", "failure")])
check("old success + new failure: red (exit 1)", rc == 1, (rc, o))
rc, o = wait([r(1, "completed", "success"), r(2, "completed", "cancelled")])
check("newest cancelled is skipped: the success decides", rc == 0, (rc, o))
# 05/10/2026 (#1200): a cancelled workflow run leaves `tests` as "failure" while its harness
# jobs are "cancelled"; that `tests` must not decide. Named runs with check suites, as GitHub sends them.
s = lambda i, n, c, suite: {"id": i, "name": n, "status": "completed", "conclusion": c, "check_suite": {"id": suite}}
rc, o = wait([s(1, "tests", "success", 10), s(5, "harness (0)", "cancelled", 11), s(6, "tests", "failure", 11)])
check("`tests` failure of a run whose jobs were cancelled is ignored: the older success decides", rc == 0, (rc, o))
rc, o = wait([s(1, "tests", "success", 10), s(5, "harness (0)", "success", 11), s(6, "tests", "failure", 11)])
check("a real `tests` failure (siblings not cancelled) is red", rc == 1, (rc, o))
rc, o = wait([s(5, "harness (0)", "cancelled", 11), s(6, "tests", "failure", 11), s(7, "lessons", "success", 11), s(9, "tests", "success", 12), s(8, "harness (0)", "success", 12)])
check("two runs on one sha: the newest complete run decides", rc == 0, (rc, o))
rc, o = wait([r(1, "completed", "success")])
check("one green run: exit 0 and prints the result", rc == 0 and "completed:success" in o, (rc, o))
# 07/10/2026: michael-skills has `checks`, not `tests`; an unknown repo keeps `tests`.
n = lambda i, name, c: {"id": i, "name": name, "status": "completed", "conclusion": c}
rc, o = wait([n(1, "checks", "success"), n(2, "tests", "failure")], "mishaf1988-lgtm/michael-skills")
check("michael-skills: `checks` decides, `tests` is ignored", rc == 0 and "checks = completed:success" in o, (rc, o))
rc, o = wait([n(1, "checks", "failure"), n(2, "tests", "success")], "mishaf1988-lgtm/michael-skills")
check("michael-skills: a red `checks` is red", rc == 1, (rc, o))
rc, o = wait([n(1, "checks", "failure"), n(2, "tests", "success")], "someone/other-repo")
check("unknown repo: `tests` decides", rc == 0 and "tests = completed:success" in o, (rc, o))
# 17/11/2026, four test rules (4) and (3): red heads are counted per branch, the third in a row exits 3,
# green clears, and a sha that was red and is green with no change is called a flaky test.
keep[0] = True; clear()
RED, GREEN = [r(1, "completed", "failure")], [r(1, "completed", "success")]
cnt = lambda: subprocess.run(["bash", hook("ci-wait.sh"), "--count", "b"], capture_output=True, text=True, env=dict(os.environ, CI_FAILS_DIR=fails)).stdout.strip()
sha[0] = "s1"; rc1, o1 = wait(RED)
check("first red: exit 1, counted 1 of 3", rc1 == 1 and cnt() == "1" and "1 " in o1, (rc1, o1, cnt()))
rc, o = wait(RED)
check("the same sha read again is not counted twice", rc == 1 and cnt() == "1", (rc, cnt()))
sha[0] = "s2"; rc2, _ = wait(RED)
sha[0] = "s3"; rc3, o3 = wait(RED)
check("second red: exit 1; third red in a row: exit 3 and says to stop and ask Michael", rc2 == 1 and rc3 == 3 and "--continue" in o3 and "\u05e9\u05d0\u05dc\u05d5\u05df" in o3, (rc2, rc3, o3))
c = subprocess.run(["bash", hook("ci-wait.sh"), "--continue", "b"], capture_output=True, text=True, env=dict(os.environ, CI_FAILS_DIR=fails))
check("--continue without Michael's answer: refused, the count stays", c.returncode == 2 and cnt() == "3", (c.returncode, cnt()))
c = subprocess.run(["bash", hook("ci-wait.sh"), "--continue", "b", "\u05d1\u05e6\u05e2: \u05dc\u05d4\u05de\u05e9\u05d9\u05da"], capture_output=True, text=True, env=dict(os.environ, CI_FAILS_DIR=fails))
check("--continue with his answer: cleared and logged", c.returncode == 0 and cnt() == "0" and os.path.exists(os.path.join(fails, "continued.log")), (c.returncode, cnt()))
sha[0] = "s4"; wait(RED); sha[0] = "s5"; wait(RED); sha[0] = "s6"; rc, o = wait(GREEN)
check("green after two reds: exit 0 and the count is cleared (in a row, not in total)", rc == 0 and cnt() == "0" and "flaky" not in o, (rc, o, cnt()))
sha[0] = "s7"; wait(RED); rc, o = wait(GREEN)
check("red then green on the same sha: exit 0 with the flaky-test notice", rc == 0 and "flaky.md" in o, (rc, o))
sha[0] = "s8"; wait(RED)
other = subprocess.run(["bash", hook("ci-wait.sh"), "--count", "other"], capture_output=True, text=True, env=dict(os.environ, CI_FAILS_DIR=fails)).stdout.strip()
check("the count is per branch", cnt() == "1" and other == "0", (cnt(), other))
done()
