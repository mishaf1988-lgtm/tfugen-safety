#!/usr/bin/env python3
"""pr-gate.py: a PR description without the retro / skill lines is denied
before the PR is opened; a good one passes; other tools pass."""
from _common import run, check, done, repo_root
R = repo_root()
PR = "mcp__github__create_pull_request"
base = {"tool_name": PR, "cwd": R}
# BASE=HEAD: an empty diff, so a real regex change in index.html on the branch under test is not read (16/11/2026)
env = {"CLAUDE_PROJECT_DIR": R, "PR_GATE_CHANGED": "chat/x.html", "BASE": "HEAD"}
deny = lambda o: '"deny"' in o
out = run("pr-gate.py", dict(base, tool_input={"title": "x", "body": "שינוי"}), env)
check("no retro line: deny", deny(out) and "retro" in out, out)
out = run("pr-gate.py", dict(base, tool_input={"title": "x", "body": "רטרו: אין"}), env)
check("retro but no skill line: deny", deny(out) and "skill" in out, out)
out = run("pr-gate.py", dict(base, tool_input={"title": "x", "body": "רטרו: אין\nskill: אין"}), env)
check("both lines: pass", out == "{}", out)
# 21/11/2026 (Michael: "do it: all the requirements at once"): a server change with nothing in the description gets
# every missing line in one answer (retro, skill, the review pair, what was not checked, the assistant line), numbered.
env_srv = dict(env, PR_GATE_CHANGED="functions/_wa.js")
out = run("pr-gate.py", dict(base, tool_input={"title": "x", "body": "שינוי"}), env_srv)
check("everything missing at once: one deny that names retro, skill, the review, the refutation, what was not checked and the assistant line",
      deny(out) and all(w in out for w in ("retro", "skill line", "סקירה:", "הפרכה:", "מה לא נבדק:", "עוזר:")) and "1. " in out and "6. " in out, out)
out = run("pr-gate.py", dict(base, tool_input={"title": "x", "body": "רטרו: אין\nskill: אין\nסקירה: סוכן נפרד, אין ממצא\nהפרכה: אין ממצא מאושר\nעוזר: לא רלוונטי"}), env_srv)
check("one thing missing: that one alone, not numbered", deny(out) and "מה לא נבדק:" in out and "1. " not in out and "retro" not in out, out)
out = run("pr-gate.py", dict(base, tool_input={"title": "x", "body": "רטרו: אין\nskill: למדתי משהו"}), env)
check("skill says learned, no skill file changed: deny", deny(out), out)
out = run("pr-gate.py", dict(base, tool_input={"title": "x", "body": "רטרו: אין\nskill: למדתי משהו"}),
          dict(env, PR_GATE_CHANGED="chat/x.html,.claude/skills/tfugen-ref/SKILL.md"))
check("skill says learned and a skill file changed: pass", out == "{}", out)
out = run("pr-gate.py", dict(base, tool_input={"title": "Fix: באג", "body": "רטרו: אין\nskill: אין"}), env)
check("fix PR without a lesson: deny", deny(out) and "lesson" in out, out)
md = dict(env, PR_GATE_CHANGED="project-files/x.md")
out = run("pr-gate.py", dict(base, tool_input={"title": "x", "body": "רטרו: אין\nskill: אין"}), dict(md, PR_GATE_PII_CMD="exit 1"))
check("a changed .md and the privacy test fails (a phone number): deny", deny(out) and "pii-md-test" in out, out)
out = run("pr-gate.py", dict(base, tool_input={"title": "x", "body": "רטרו: אין\nskill: אין"}), dict(md, PR_GATE_PII_CMD="exit 0"))
check("a changed .md and the privacy test passes: pass", out == "{}", out)
out = run("pr-gate.py", dict(base, tool_input={"title": "x", "body": "רטרו: אין\nskill: אין"}), dict(env, PR_GATE_PII_CMD="exit 1"))
check("no .md changed: the privacy test is not run", out == "{}", out)
# 24/11/2026: a decision without its decisions-map.tsv line is refused before the PR is opened (#3056 went red in CI on it).
dec = dict(env, PR_GATE_CHANGED="DECISIONS.md", PR_GATE_PII_CMD="exit 0")
ok_body = {"title": "x", "body": "רטרו: אין\nskill: אין\nעוזר: לא נוגע, hook בלבד"}
out = run("pr-gate.py", dict(base, tool_input=ok_body), dict(dec, PR_GATE_DOMAINS_CMD="echo 'missing line'; exit 1"))
check("a changed DECISIONS.md and domains-test fails: deny, with the test's output", deny(out) and "domains-test" in out and "missing line" in out, out)
out = run("pr-gate.py", dict(base, tool_input=ok_body), dict(dec, PR_GATE_DOMAINS_CMD="exit 0"))
check("a changed DECISIONS.md and domains-test passes: pass", out == "{}", out)
out = run("pr-gate.py", dict(base, tool_input=ok_body), dict(env, PR_GATE_DOMAINS_CMD="exit 1"))
check("DECISIONS.md not changed: domains-test is not run", out == "{}", out)
out = run("pr-gate.py", {"tool_name": "mcp__other__create_pull_request", "cwd": R, "tool_input": {"title": "x", "body": ""}}, env)
check("a create_pull_request with another prefix is also checked", deny(out), out)
out = run("pr-gate.py", {"tool_name": "Bash", "cwd": R, "tool_input": {"command": "ls"}}, env)
check("another tool: pass", out == "{}", out)
out = run("pr-gate.py", dict(base, tool_input={"title": "x", "body": ""}), dict(env, CLAUDE_PROJECT_DIR="/nonexistent"), cwd="/")
check("gate file missing: pass (CI still checks), no crash", out == "{}", out)
# 11/11/2026: the files come from the PR's head branch, not from the directory the session stands in
import importlib.util, os, subprocess, tempfile
spec = importlib.util.spec_from_file_location("pr_gate", os.path.join(R, ".claude/hooks/pr-gate.py"))
pg = importlib.util.module_from_spec(spec); spec.loader.exec_module(pg)
with tempfile.TemporaryDirectory() as t:
    g = lambda *a: subprocess.run(["git", "-c", "user.email=t@t", "-c", "user.name=t"] + list(a), cwd=t, capture_output=True, text=True)
    g("init", "-q", "-b", "main"); open(os.path.join(t, "a.txt"), "w").write("a"); g("add", "-A"); g("commit", "-q", "-m", "a")
    g("update-ref", "refs/remotes/origin/main", "HEAD")
    g("checkout", "-q", "-b", "routine/other"); os.makedirs(os.path.join(t, "functions/api")); open(os.path.join(t, "functions/api/routine-db.js"), "w").write("x"); g("add", "-A"); g("commit", "-q", "-m", "b")
    g("checkout", "-q", "main"); g("checkout", "-q", "-b", "routine/here"); open(os.path.join(t, "STATUS.md"), "w").write("s"); g("add", "-A"); g("commit", "-q", "-m", "c")
    os.environ.pop("PR_GATE_CHANGED", None)
    check("the PR's head branch decides the files, not the checked-out branch", pg.changed(t, "routine/other") == ["functions/api/routine-db.js"] and pg.changed(t, "routine/here") == ["STATUS.md"], pg.changed(t, "routine/other"))
    check("an unknown head, an owner:branch head, or a head that looks like an option falls back safely", pg.changed(t, "no-such") == ["STATUS.md"] and pg.changed(t, "me:routine/other") == ["functions/api/routine-db.js"] and pg.head_ref(t, "--upload-pack=x") == "HEAD" and pg.head_ref(t, None) == "HEAD")
    # 11/11/2026 retro: the PR's own files are what lessons-gate and pii-md-test read, not the directory the session stands in
    os.makedirs(os.path.join(t, ".github/scripts"), exist_ok=True)
    g("checkout", "-q", "routine/other"); open(os.path.join(t, ".github/scripts/lessons-gate.py"), "w").write("def check(t, b, f):\n    return True, ''\n")
    open(os.path.join(t, "x.md"), "w").write("BAD number"); g("add", "-A"); g("commit", "-q", "-m", "d"); g("checkout", "-q", "routine/here")
    d, cl = pg.src_dir(t, "routine/other")
    check("src_dir: a branch not checked out here gets a worktree of its own files, removed by cleanup", d != t and open(os.path.join(d, "x.md")).read() == "BAD number" and cl is not None and (cl() or True) and not os.path.exists(d), d)
    check("src_dir: the branch checked out here is this directory", pg.src_dir(t, "HEAD") == (t, None) and pg.src_dir(t, "routine/here")[0] == t)
    pii = "grep -q BAD x.md 2>/dev/null && exit 1 || exit 0"
    out = run("pr-gate.py", dict(base, cwd=t, tool_input={"title": "x", "body": "x", "head": "routine/other"}), {"CLAUDE_PROJECT_DIR": t, "PR_GATE_PII_CMD": pii})
    check("a PR from another branch with a number in its .md is denied here, though this directory has no such file (before: passed, failed in CI)", deny(out) and "pii-md-test" in out, out)
    out = run("pr-gate.py", dict(base, cwd=t, tool_input={"title": "x", "body": "x", "head": "routine/here"}), {"CLAUDE_PROJECT_DIR": t, "PR_GATE_PII_CMD": pii})
    check("the same check on the clean branch passes", out == "{}", out)

# 17/11/2026, four test rules (1): the screenshot named in the shot line is a phone PNG of this PR's index.html
import json, os, struct, tempfile
d = tempfile.mkdtemp()
def png(name, width=780, sha="abc", side=True, magic=b"\x89PNG\r\n\x1a\n"):
    p = os.path.join(d, name)
    open(p, "wb").write(magic + b"\x00\x00\x00\rIHDR" + struct.pack(">II", width, 1688) + b"\x08\x06\x00\x00\x00")
    if side:
        json.dump({"index_sha": sha}, open(p + ".json", "w"))
    return p
ix = dict(env, PR_GATE_CHANGED="index.html", PR_GATE_INDEX_SHA="abc")
B = "\u05e8\u05d8\u05e8\u05d5: \u05d0\u05d9\u05df\nskill: \u05d0\u05d9\u05df\n\u05e6\u05d9\u05dc\u05d5\u05dd: \u05de\u05e1\u05da \u05d4\u05d1\u05d9\u05ea, %s"
shot = lambda path, e=ix: run("pr-gate.py", dict(base, tool_input={"title": "x", "body": B % path}), e)
check("index.html, a phone screenshot of this index.html: pass", shot(png("ok.png")) == "{}", shot(png("ok.png")))
check("...no shot line: deny (lessons-gate)", deny(run("pr-gate.py", dict(base, tool_input={"title": "x", "body": "\u05e8\u05d8\u05e8\u05d5: \u05d0\u05d9\u05df\nskill: \u05d0\u05d9\u05df"}), ix)))
check("...the line names no png: deny", deny(shot("\u05d1\u05d3\u05e7\u05ea\u05d9 \u05d1\u05e2\u05d9\u05df")))
check("...the file is missing: deny", deny(shot(os.path.join(d, "none.png"))))
check("...no .json beside it (not made by pr-shot.js): deny", deny(shot(png("noside.png", side=False))))
check("...taken before the last edit of index.html: deny", deny(shot(png("old.png", sha="older"))) and "index.html" in shot(png("old.png", sha="older")))
check("...a desktop-wide picture: deny", deny(shot(png("wide.png", width=2880))))
check("...not a PNG: deny", deny(shot(png("fake.png", magic=b"GIF89a\x00\x00"))))
check("a PR without index.html: the shot is not asked for", run("pr-gate.py", dict(base, tool_input={"title": "x", "body": "\u05e8\u05d8\u05e8\u05d5: \u05d0\u05d9\u05df\nskill: \u05d0\u05d9\u05df"}), env) == "{}")
done()
