#!/usr/bin/env python3
"""The Stop hook .claude/hooks/supervisor.py (Michael, 01/10/2026).

A real git repo with an origin: uncommitted work and a branch ahead of
origin/main block; a merge with no next session blocks; a closing question to
Michael, a running ci-wait and stop_hook_active let the stop through.
"""
import importlib.util, json, os, subprocess, sys, tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
HOOK = os.path.join(HERE, "..", "..", ".claude", "hooks", "supervisor.py")
spec = importlib.util.spec_from_file_location("supervisor", HOOK)
sup = importlib.util.module_from_spec(spec); spec.loader.exec_module(sup)
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
open(os.path.join(work, "a.txt"), "w").write("1\n")
sh(work, "git", "add", "a.txt"); sh(work, "git", "commit", "-q", "-m", "1"); sh(work, "git", "push", "-q", "origin", "main")

MERGED = {"mcp__github__merge_pull_request"}
print("\nclean, nothing merged: lets the stop through")
check("no block", sup.verdict(work, "סיימתי.", set(), False) is None)

print("\nuncommitted work")
open(os.path.join(work, "a.txt"), "w").write("2\n")
r = sup.verdict(work, "סיימתי.", set(), False)
check("blocks, names the file", r and "a.txt" in r, r)
check("a closing question to Michael lets it through", sup.verdict(work, "לבצע את התוכנית?", set(), False) is None)
check("ci-wait running lets it through", sup.verdict(work, "ממתין.", set(), True) is None)

print("\na branch ahead of origin/main")
sh(work, "git", "checkout", "-q", "-b", "x"); sh(work, "git", "commit", "-q", "-am", "2")
r = sup.verdict(work, "סיימתי.", set(), False)
check("blocks: 1 commit not in main, ci-wait", r and "1 commits" in r and "ci-wait" in r, r)

print("\nmerged, no next session")
sh(work, "git", "push", "-q", "origin", "x:main"); sh(work, "git", "fetch", "-q", "origin")
r = sup.verdict(work, "מוזג.", MERGED, False)
check("merged without proposals: blocks and asks for the section", r and "הצעות לשדרוג" in r, r)
P = "מוזג.\n\n💡 הצעות לשדרוג\n1. בדיקה."
r = sup.verdict(work, P, MERGED, False)
check("blocks: lesson, next item or handoff", r and "tfugen-lessons" in r and "create_session" in r, r)
check("after create_session: lets it through", sup.verdict(work, P, MERGED | {"mcp__claude-code-remote__create_session"}, False) is None)
H = os.path.join(work, "handoff-02-10-2026-18.20.md")
open(H, "w", encoding="utf-8").write("### הבא בתור\nמשימה בקוד.\n")
check("a handoff with a next item: still blocks", sup.verdict(work, P, MERGED, False) is not None)
open(H, "w", encoding="utf-8").write("### הבא בתור\nבלי תשובה: אין פריט קוד.\n")
check("handoff says no code item: lets it through (#1099)", sup.verdict(work, P, MERGED, False) is None)
os.remove(H)
check("no merge: no proposals needed", sup.verdict(work, "סיימתי.", set(), False) is None)

print("\nthe hook end to end")
tr = os.path.join(root, "t.jsonl")
with open(tr, "w", encoding="utf-8") as f:
    f.write(json.dumps({"message": {"role": "user", "content": "המשך"}}) + "\n")
    f.write(json.dumps({"message": {"role": "assistant", "content": [{"type": "tool_use", "name": "mcp__github__merge_pull_request", "input": {}}]}}) + "\n")
    f.write(json.dumps({"message": {"role": "user", "content": [{"type": "tool_result", "content": "ok"}]}}) + "\n")
    f.write(json.dumps({"message": {"role": "assistant", "content": [{"type": "text", "text": "מוזג."}]}}) + "\n")
run = lambda active: subprocess.run([sys.executable, HOOK], input=json.dumps({"transcript_path": tr, "cwd": work, "stop_hook_active": active}), capture_output=True, text=True, timeout=30, env=dict(os.environ, SUPERVISOR_CI_WAIT="0")).stdout
out = run(False)
check("blocks with decision=block", '"decision": "block"' in out, out)
check("stop_hook_active: never twice in a row", run(True) == "", run(True))

print("\n%d passed, %d failed" % (passed, failed))
sys.exit(1 if failed else 0)
