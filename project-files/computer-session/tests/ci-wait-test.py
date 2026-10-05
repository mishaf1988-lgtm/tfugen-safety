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
  *) echo abc1234def ;;
esac
''' % runs)
os.chmod(gh, 0o755)
def wait(rs):
    json.dump({"check_runs": rs}, open(runs, "w"))
    p = subprocess.run(["bash", hook("ci-wait.sh"), "b"], capture_output=True, text=True, timeout=60,
                       env=dict(os.environ, PATH=d + os.pathsep + os.environ["PATH"], CI_WAIT_SLEEP="0"))
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
rc, o = wait([r(1, "completed", "success")])
check("one green run: exit 0 and prints the result", rc == 0 and "completed:success" in o, (rc, o))
done()
