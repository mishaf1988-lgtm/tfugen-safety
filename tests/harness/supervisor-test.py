#!/usr/bin/env python3
"""The Stop hook supervisor.py (Michael, 01/10/2026). Copy of\ntests/harness/supervisor-test.py pointed at the package, plus the proposals cases.

A real git repo with an origin: uncommitted work and a branch ahead of
origin/main block; a merge with no next session blocks; a closing question to
Michael, a running ci-wait and stop_hook_active let the stop through.
"""
import importlib.util, json, os, subprocess, sys, tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE); from _common import hook; HOOK = hook('supervisor.py')
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
open(H, "w", encoding="utf-8").write("השיחה היא **דור 8**. מיכאל פותח את הבאה ביד.\n### הבא בתור\nשלב 6.\n")
check("generation 8, next opened by hand: lets it through (create_session is refused there)", sup.verdict(work, P, MERGED, False) is None)
open(H, "w", encoding="utf-8").write("השיחה היא **דור 3**. מיכאל פותח את הבאה ביד.\n### הבא בתור\nשלב 6.\n")
check("... generation 3: still blocks", sup.verdict(work, P, MERGED, False) is not None)
open(H, "w", encoding="utf-8").write("השיחה היא **דור 8**.\n### הבא בתור\nשלב 6.\n")
check("... generation 8 without 'by hand': still blocks", sup.verdict(work, P, MERGED, False) is not None)
os.remove(H)
print("\nopen Chrome tasks (Michael, 12/10/2026)")
os.makedirs(os.path.join(work, "project-files"), exist_ok=True)
Q = os.path.join(work, "project-files", "chrome-queue.md")
open(Q, "w", encoding="utf-8").write("## פתוח\n\n- [ ] **C1. זרימה** (12/10/2026)\n\n## בוצע\n\n- [x] **C0. ישן**\n")
PC = P + "\n\nאין קוד"
r = sup.verdict(work, P, MERGED | {"mcp__claude-code-remote__create_session"}, False)
check("merged, an open Chrome task, no reminder: blocks and names the count", r and "1 משימות" in r and "chrome-queue" in r, r)
check("with a 🌐 לכרום line: lets it through", sup.verdict(work, P + "\n🌐 לכרום (1): C1.", MERGED | {"mcp__claude-code-remote__create_session"}, False) is None)
check("no merge since the last reply: no reminder needed", sup.verdict(work, "סיימתי.", set(), False) is None)
# 13/10/2026: a 🌐 line that names a task already closed (C0 is [x]) blocks; open only passes
r = sup.verdict(work, P + "\n🌐 לכרום: C0 ו-C1.", MERGED | {"mcp__claude-code-remote__create_session"}, False)
check("a 🌐 line naming a closed task (C0): blocks and names it", r and "C0" in r and "chrome-queue" in r and "C1" not in r.split(":")[1], r)
check("... C10 is not C1: no false match", sup.chrome_stale(work, "🌐 לכרום: C10") == [], sup.chrome_stale(work, "🌐 לכרום: C10"))
open(Q, "w", encoding="utf-8").write("## בוצע\n\n- [x] **C1. זרימה**\n")
check("only done tasks: lets it through", sup.verdict(work, P, MERGED | {"mcp__claude-code-remote__create_session"}, False) is None)
os.remove(Q)
check("no merge: no proposals needed", sup.verdict(work, "סיימתי.", set(), False) is None)

print("\nthe hook end to end")
tr = os.path.join(root, "t.jsonl")
with open(tr, "w", encoding="utf-8") as f:
    f.write(json.dumps({"message": {"role": "user", "content": "המשך"}}) + "\n")
    f.write(json.dumps({"message": {"role": "assistant", "content": [{"type": "tool_use", "name": "mcp__github__merge_pull_request", "input": {}}]}}) + "\n")
    f.write(json.dumps({"message": {"role": "user", "content": [{"type": "tool_result", "content": "ok"}]}}) + "\n")
    f.write(json.dumps({"message": {"role": "assistant", "content": [{"type": "text", "text": "מוזג."}]}}) + "\n")
run = lambda active: subprocess.run([sys.executable, HOOK], input=json.dumps({"transcript_path": tr, "cwd": work, "stop_hook_active": active}), capture_output=True, text=True, encoding="utf-8", timeout=30, env=dict(os.environ, SUPERVISOR_CI_WAIT="0")).stdout
out = run(False)
check("blocks with decision=block", '"decision": "block"' in out, out)
check("stop_hook_active: never twice in a row", run(True) == "", run(True))

print("\nproposals only for a merge since the last proposals section (05/10/2026)")
def tline(f, role, content):
    f.write(json.dumps({"message": {"role": role, "content": content}}, ensure_ascii=False) + "\n")
def session(parts):
    p = os.path.join(root, "s%d.jsonl" % len(parts))
    with open(p, "w", encoding="utf-8") as f:
        for kind, v in parts:
            if kind == "user": tline(f, "user", v)
            elif kind == "tool":
                tline(f, "assistant", [{"type": "tool_use", "name": v, "input": {}}])
                tline(f, "user", [{"type": "tool_result", "content": "ok"}])
            else: tline(f, "assistant", [{"type": "text", "text": v}])
    return p
M = "mcp__github__merge_pull_request"
old = session([("user", "א"), ("tool", M), ("text", "מוזג. 💡 הצעות לשדרוג: אין"), ("user", "ומה עכשיו?"), ("text", "אפשר X.")])
text, tools, recent = sup.transcript(old)
check("merge before the last proposals: not in recent", M in tools and M not in recent, (tools, recent))
r = sup.verdict(work, text, tools, False, recent)
check("a later short reply is not asked for proposals again", r is None or "הצעות לשדרוג" not in r, r)
new = session([("user", "א"), ("text", "💡 הצעות לשדרוג: אין"), ("user", "ב"), ("tool", M), ("text", "מוזג שוב.")])
text, tools, recent = sup.transcript(new)
r = sup.verdict(work, text, tools, False, recent)
check("a merge after the last proposals: asked again", r is not None and "הצעות לשדרוג" in r, r)
check("verdict without recent (old callers) still uses the whole session", "הצעות לשדרוג" in (sup.verdict(work, "מוזג.", MERGED, False) or ""))

print("\nsquash merge: the branch is ahead by hash, main has the content (09/10/2026)")
sh(work, "git", "checkout", "-q", "-b", "sq", "origin/main")
open(os.path.join(work, "b.txt"), "w").write("b1\n"); sh(work, "git", "add", "b.txt"); sh(work, "git", "commit", "-q", "-m", "b1")
open(os.path.join(work, "b.txt"), "w").write("b2\n"); sh(work, "git", "commit", "-q", "-am", "b2")
sh(work, "git", "checkout", "-q", "-b", "sqm", "origin/main"); sh(work, "git", "merge", "-q", "--squash", "sq"); sh(work, "git", "commit", "-q", "-m", "squash")
open(os.path.join(work, "c.txt"), "w").write("c\n"); sh(work, "git", "add", "c.txt"); sh(work, "git", "commit", "-q", "-m", "later on main")
sh(work, "git", "push", "-q", "origin", "sqm:main"); sh(work, "git", "fetch", "-q", "origin"); sh(work, "git", "checkout", "-q", "sq")
r = sup.verdict(work, "סיימתי.", set(), False)
check("squashed into main: no 'commits not in main' block", r is None or "commits" not in r, r)
open(os.path.join(work, "b.txt"), "w").write("b3\n"); sh(work, "git", "commit", "-q", "-am", "b3")
r = sup.verdict(work, "סיימתי.", set(), False)
check("a new commit after the squash: blocks again", r and "commits" in r, r)

print("\nthe office: opened after every SessionStart (16/10/2026, Michael: \"לא תמיד מציג את המשרד\")")
OFF = "https://claude.ai/artifact/AmxFowGHYDqyhd1sE9qphi"
def start(f, kind):
    f.write(json.dumps({"attachment": {"type": "hook_success", "hookName": "SessionStart:" + kind, "hookEvent": "SessionStart",
        "content": "== התחלת שיחה ==\n🏢 משרד הסוכנים: בתחילת השיחה Artifact עם action \"open\" ו-url " + OFF + " (מיכאל)"}}, ensure_ascii=False) + "\n")
def opened(f, url=OFF, action="open"):
    tline(f, "assistant", [{"type": "tool_use", "name": "Artifact", "input": {"action": action, "url": url}}])
def tr(steps):
    p = os.path.join(root, "o%d.jsonl" % len(os.listdir(root)))
    with open(p, "w", encoding="utf-8") as f:
        for s_ in steps: s_(f)
    return p
check("startup, opened: nothing pending", sup.office_pending(tr([lambda f: start(f, "startup"), opened])) is None)
check("startup, not opened: pending", sup.office_pending(tr([lambda f: start(f, "startup")])) == OFF)
check("opened, then resumed and not opened again: pending (the bug of 16/10/2026)", sup.office_pending(tr([lambda f: start(f, "startup"), opened, lambda f: start(f, "resume")])) == OFF)
check("resumed and opened again: nothing pending", sup.office_pending(tr([lambda f: start(f, "startup"), opened, lambda f: start(f, "resume"), opened])) is None)
check("a read of the office is not an open", sup.office_pending(tr([lambda f: start(f, "startup"), lambda f: opened(f, action="read")])) == OFF)
check("another artifact opened: still pending", sup.office_pending(tr([lambda f: start(f, "startup"), lambda f: opened(f, url="https://claude.ai/artifact/Other123")])) == OFF)
check("no office line in SessionStart: nothing pending", sup.office_pending(tr([lambda f: tline(f, "user", "שלום")])) is None)
def run_main(path):
    p = subprocess.run([sys.executable, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", ".claude", "hooks", "supervisor.py")],
        input=json.dumps({"transcript_path": path, "cwd": work}), capture_output=True, text=True, encoding="utf-8")
    return p.stdout
out = run_main(tr([lambda f: start(f, "resume"), lambda f: tline(f, "assistant", [{"type": "text", "text": "לבצע?"}])]))
check("the hook blocks with the url, even on a closing question", '"block"' in out and OFF in out, out)

print("\nSTATUS 99 (17/10/2026): 'I added to X' and X did not change")
g = os.path.join(root, "g"); sh(root, "git", "clone", "-q", origin, g)
for k, v in (("user.email", "t@t"), ("user.name", "t")):
    sh(g, "git", "config", k, v)
os.makedirs(os.path.join(g, ".claude", "skills", "tfugen-db"))
for f in ("STATUS.md", "DECISIONS.md", ".claude/skills/tfugen-db/SKILL.md"):
    open(os.path.join(g, f), "w").write("x\n")
sh(g, "git", "add", "-A")
subprocess.run(["git", "commit", "-q", "-m", "old"], cwd=g, check=True, capture_output=True,
               env=dict(os.environ, GIT_AUTHOR_DATE="2026-01-01T10:00:00", GIT_COMMITTER_DATE="2026-01-01T10:00:00"))
sh(g, "git", "push", "-q", "origin", "main"); sh(g, "git", "fetch", "-q", "origin")
check("'הוספתי ל-STATUS' with STATUS unchanged for months: named", sup.unchanged_claims(g, "הוספתי שורה ל-STATUS.") == ["STATUS.md"], sup.unchanged_claims(g, "הוספתי שורה ל-STATUS."))
check("a skill named next to 'עדכנתי': its SKILL.md is checked", sup.unchanged_claims(g, "עדכנתי את tfugen-db.") == [".claude/skills/tfugen-db/SKILL.md"])
check("verdict blocks with the file name", "STATUS.md" in (sup.verdict(g, "נרשם ב-STATUS.", set(), False) or ""))
open(os.path.join(g, "DECISIONS.md"), "a").write("y\n"); sh(g, "git", "commit", "-qam", "new"); sh(g, "git", "push", "-q", "origin", "main"); sh(g, "git", "fetch", "-q", "origin")
check("DECISIONS changed on main today: passes", sup.unchanged_claims(g, "הוספתי החלטה ל-DECISIONS.") == [])
open(os.path.join(g, "STATUS.md"), "a").write("z\n")
check("STATUS changed in the work tree: passes", sup.unchanged_claims(g, "הוספתי ל-STATUS.") == [])
check("STATUS-archive is not read as STATUS", sup.claimed_files("נרשם ב-STATUS-archive") == {"project-files/STATUS-archive.md"})
check("a file named without a claim verb: nothing", sup.claimed_files("קראתי את STATUS ואת DECISIONS") == set())

print("\n%d passed, %d failed" % (passed, failed))
sys.exit(1 if failed else 0)
