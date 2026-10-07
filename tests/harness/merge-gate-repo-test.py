#!/usr/bin/env python3
"""merge-gate.py: the check name follows the repo (07/10/2026): michael-skills
looks for `checks`, tfugen-safety and an unknown repo for `tests`. A token in the
environment is sent; without one a 404 (private repo) is denied with a token hint.
No network: urlopen is replaced before the hook runs, and records each URL."""
import json, os, subprocess, sys, tempfile
from _common import hook, check, done

WRAP = r'''
import io, json, runpy, sys, urllib.error, urllib.request
cfg = json.load(open(sys.argv[1], encoding="utf-8")); log = []
def fake(req, timeout=None):
    url = req.full_url; log.append({"url": url, "auth": req.get_header("Authorization")})
    json.dump(log, open(cfg["log"], "w"))
    if cfg.get("status404"):
        raise urllib.error.HTTPError(url, 404, "Not Found", {}, io.BytesIO(b""))
    if "/pulls/" in url:
        body = {"head": {"sha": "abc1234def"}}
    else:
        body = {"check_runs": [{"status": "completed", "conclusion": "success", "started_at": "1"}]}
    return io.BytesIO(json.dumps(body).encode())  # BytesIO is its own context manager
urllib.request.urlopen = fake
sys.stdin = io.TextIOWrapper(io.BytesIO(json.dumps(cfg["input"]).encode()))  # the hook calls reconfigure
runpy.run_path(cfg["hook"], run_name="__main__")
'''

d = tempfile.mkdtemp(); wrap = os.path.join(d, "wrap.py"); open(wrap, "w", encoding="utf-8").write(WRAP)


def gate(repo, token=None, status404=False):
    log = os.path.join(d, "log.json")
    if os.path.exists(log):
        os.remove(log)
    cfg = {"hook": hook("merge-gate.py"), "log": log, "status404": status404,
           "input": {"tool_name": "mcp__github__merge_pull_request",
                     "tool_input": {"owner": "mishaf1988-lgtm", "repo": repo, "pullNumber": 7}}}
    cf = os.path.join(d, "cfg.json"); json.dump(cfg, open(cf, "w"))
    env = {k: v for k, v in os.environ.items() if k not in ("GITHUB_TOKEN", "GH_TOKEN")}
    if token:
        env["GH_TOKEN"] = token
    p = subprocess.run([sys.executable, wrap, cf], capture_output=True, text=True, encoding="utf-8", timeout=60, env=env)
    out = json.loads(p.stdout.strip() or "{}").get("hookSpecificOutput", {})
    calls = json.load(open(log)) if os.path.exists(log) else []
    return out, calls, p.stderr


def asked(calls):
    return [c["url"].split("check_name=")[1].split("&")[0] for c in calls if "check_name=" in c["url"]]


out, calls, err = gate("michael-skills")
check("michael-skills: asks for the `checks` check", asked(calls) == ["checks"], (calls, err))
check("michael-skills: green `checks` allows the merge", out.get("permissionDecision") == "allow" and "'checks'" in out.get("permissionDecisionReason", ""), out)
out, calls, err = gate("tfugen-safety")
check("tfugen-safety: asks for the `tests` check", asked(calls) == ["tests"], (calls, err))
check("tfugen-safety: green `tests` allows the merge", out.get("permissionDecision") == "allow", out)
out, calls, err = gate("some-other-repo")
check("unknown repo: falls back to `tests`", asked(calls) == ["tests"], (calls, err))
out, calls, err = gate("michael-skills", token="t0k")
check("a token in the environment is sent as Authorization", calls and all(c["auth"] == "Bearer t0k" for c in calls), calls)
out, calls, err = gate("michael-skills")
check("no token: no Authorization header", calls and all(c["auth"] is None for c in calls), calls)
out, calls, err = gate("michael-skills", status404=True)
check("no token + 404: denied, the message asks for a token", out.get("permissionDecision") == "deny" and "GITHUB_TOKEN" in out.get("permissionDecisionReason", ""), (out, err))
out, calls, err = gate("michael-skills", token="t0k", status404=True)
check("token + 404: still denied (fail closed)", out.get("permissionDecision") == "deny", (out, err))
done()
