#!/usr/bin/env python3
"""The Stop hook .claude/hooks/hebrew-reply.py (lesson 13, recurred 01/10/2026).

Real transcript shapes: an English waiting message is blocked, a Hebrew reply
with code, paths and a PR link passes, tool results do not reset the turn, a
short Latin-only line is not judged, and stop_hook_active never blocks twice.
"""
import json, os, subprocess, sys, tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
HOOK = os.path.join(HERE, "..", "..", ".claude", "hooks", "hebrew-reply.py")
passed = failed = 0


def check(label, cond, detail=None):
    global passed, failed
    if cond:
        passed += 1; print("  ✓ " + label)
    else:
        failed += 1; print("  ✗ " + label + ("  -> " + repr(detail) if detail is not None else ""))


def run(entries, active=False):
    fd, path = tempfile.mkstemp(suffix=".jsonl")
    with os.fdopen(fd, "w", encoding="utf-8") as f:
        for e in entries:
            f.write(json.dumps(e, ensure_ascii=False) + "\n")
    p = subprocess.run([sys.executable, HOOK], input=json.dumps({"transcript_path": path, "stop_hook_active": active}),
                       capture_output=True, text=True, timeout=20)
    os.unlink(path)
    out = p.stdout.strip()
    return json.loads(out) if out else None


def user(t): return {"type": "user", "message": {"role": "user", "content": t}}
def tool_result(): return {"type": "user", "message": {"role": "user", "content": [{"type": "tool_result", "tool_use_id": "x", "content": "ok"}]}}
def asst(t): return {"type": "assistant", "message": {"role": "assistant", "content": [{"type": "text", "text": t}]}}
def tool_use(): return {"type": "assistant", "message": {"role": "assistant", "content": [{"type": "tool_use", "id": "x", "name": "Bash", "input": {}}]}}

EN = "Those are Cloudflare preview deploys, nothing to act on. Still waiting on the tests run for the latest commit."
HE = "ממתין לבדיקת `tests` על הגרסה האחרונה."

r = run([user("x"), asst(EN)])
check("an English waiting message is blocked", r and r.get("decision") == "block", r)
check("the reason says to write it again in Hebrew", r and "Hebrew" in r.get("reason", ""), r)

r = run([user("x"), asst(HE)])
check("a Hebrew reply passes", r is None, r)

mixed = ("נכנס ל-`main`. קבצים: tests/harness/endpoint-inventory-test.mjs, "
         "functions/api/delete-user.js. https://github.com/mishaf1988-lgtm/tfugen-safety/pull/1018\n"
         "```js\nconst ok = typeof r.status === 'number' && r.status >= 300 && r.touched.length === 0;\n```\n"
         "שני באגים שנמצאו ותוקנו במסך ניהול המשתמשים.")
r = run([user("x"), asst(mixed)])
check("Hebrew with code, paths and a link passes", r is None, r)

r = run([user("x"), asst(HE), tool_use(), tool_result(), asst(EN)])
check("tool results do not reset the turn; the English part is still judged", r and r.get("decision") == "block", r)

r = run([user("x"), asst(EN), user("y"), asst(HE)])
check("an English reply to an earlier message does not block the new one", r is None, r)

r = run([user("x"), asst("PR #1018 merged.")])
check("a short Latin-only line is not judged", r is None, r)

LONG_HE = "בוצע ומוזג. " + "בטופס ביקורת פנים חדשה שדה המבקר מתמלא בשם של מיכאל, ואפשר לשנות אותו. " * 6
r = run([user("x"), asst("Reading the handoff: next up is the small change, then the plans."), tool_use(), tool_result(), asst(LONG_HE)])
check("a short English progress line is blocked even when a long Hebrew summary follows", r and r.get("decision") == "block", r)

r = run([user("x"), asst(EN)], active=True)
check("stop_hook_active: never blocks twice in a row", r is None, r)

settings = json.load(open(os.path.join(HERE, "..", "..", ".claude", "settings.json"), encoding="utf-8"))
cmds = [h.get("command", "") for g in settings.get("hooks", {}).get("Stop", []) for h in g.get("hooks", [])]
check("wired as a Stop hook in .claude/settings.json", any("hebrew-reply.py" in c for c in cmds), cmds)

print("\n%d passed, %d failed" % (passed, failed))
sys.exit(1 if failed else 0)
