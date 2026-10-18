#!/usr/bin/env python3
"""PreToolUse (Bash): before `git push`, the file checks that CI would run on the
changed files run here first (lesson 41, 02/10/2026: the lessons file went out
170 bytes over its cap and CI went red for a round).

Checks (RULES): tests/harness/lessons-format-test.py when
.claude/skills/tfugen-lessons/SKILL.md differs from origin/main; and, from
14/10/2026 (Michael: "בצע את שתי ההצעות"), tests/harness/graph-writes-test.py
when a file under functions/ changed (PR #1502 went red in CI on a new mail
call site that this static test, under a second, would have caught); from 17/10/2026
hook-utf8-test.py for a changed hook and settings-test.py for settings.json (lesson 2). Red =
deny, with the test's last lines as the reason. Anything else passes.

Tests set PUSH_GATE_CHANGED (comma list of changed files) and PUSH_GATE_TEST
(a script to run instead of the real one).

Test:  python3 tests/harness/push-gate-test.py
"""
import json, os, re, subprocess, sys
sys.stdout.reconfigure(encoding="utf-8")  # Windows writes cp1255; Claude Code reads UTF-8 (05/10/2026)
sys.stdin.reconfigure(encoding="utf-8")  # Claude Code sends UTF-8; Windows reads cp1255 (05/10/2026)

LESSONS = ".claude/skills/tfugen-lessons/SKILL.md"
TEST = "tests/harness/lessons-format-test.py"
# (does a changed file need it, the test, the lesson it came from)
RULES = [
    (lambda f: f == LESSONS, TEST, "\u05dc\u05e7\u05d7 41: \u05e7\u05d5\u05d1\u05e5 \u05d4\u05dc\u05e7\u05d7\u05d9\u05dd \u05d4\u05e9\u05ea\u05e0\u05d4"),
    (lambda f: f.startswith("functions/"), "tests/harness/graph-writes-test.py", "14/10/2026: \u05e7\u05d5\u05d3 \u05e9\u05e8\u05ea \u05d4\u05e9\u05ea\u05e0\u05d4"),
    # 17/10/2026, lesson 2 recurred: a new hook without stdout UTF-8 passed its own test here and
    # went red in CI on hook-utf8-test.py (#1652). Under a second each, so every hook change runs them.
    (lambda f: f.startswith(".claude/hooks/") and f.endswith(".py"), "tests/harness/hook-utf8-test.py", "17/10/2026: hook \u05d4\u05e9\u05ea\u05e0\u05d4 (\u05dc\u05e7\u05d7 2)"),
    (lambda f: f == ".claude/settings.json", "tests/harness/settings-test.py", "17/10/2026: settings.json \u05d4\u05e9\u05ea\u05e0\u05d4"),
]


def changed(cwd):
    env = os.environ.get("PUSH_GATE_CHANGED")
    if env is not None:
        return [x for x in env.split(",") if x]
    try:
        p = subprocess.run(["git", "diff", "--name-only", "origin/main...HEAD"], cwd=cwd, capture_output=True, text=True, timeout=20)
        files = p.stdout.split()
        p = subprocess.run(["git", "status", "--porcelain", "--untracked-files=no"], cwd=cwd, capture_output=True, text=True, timeout=20)
        files += [l[3:] for l in p.stdout.splitlines() if len(l) > 3]
        return files
    except Exception:
        return []


def no_heredoc(cmd):
    """The command without heredoc bodies (05/10/2026: a test file written in a
    heredoc contained "git push" and the hook fired on a command that pushed nothing)."""
    out, lines, i = [], cmd.split("\n"), 0
    while i < len(lines):
        out.append(lines[i])
        tags = re.findall(r"(?<!<)<<(?!<)-?\s*['\"]?([A-Za-z_]\w*)['\"]?", lines[i])
        i += 1
        for t in tags:
            while i < len(lines) and lines[i].strip("\t ") != t:
                i += 1
            i += 1
    return "\n".join(out)


def main():
    try:
        d = json.load(sys.stdin)
    except Exception:
        print("{}"); return
    cmd = no_heredoc((d.get("tool_input") or {}).get("command", "") or "")
    if d.get("tool_name", "Bash") != "Bash":
        print("{}"); return
    # 18/10/2026 (Michael: "מאשר"): a compound command whose branch step was refused by another hook
    # never switched branch, and its commit landed on the local main (lesson 110). A commit on main
    # in this repo is refused, unless the same command first makes or switches to a branch.
    m = re.search(r"(^|[;&|\s])git\s+commit\b", cmd)
    if m and not re.search(r"git\s+(checkout\s+(-q\s+)?-[bB]|switch\s+(-q\s+)?-[cC])\s", cmd[:m.start() + 1]):
        br = os.environ.get("PUSH_GATE_BRANCH")
        if br is None:
            here = os.environ.get("CLAUDE_PROJECT_DIR") or d.get("cwd") or "."
            try:
                url = subprocess.run(["git", "remote", "get-url", "origin"], cwd=here, capture_output=True, text=True, timeout=10).stdout
                br = subprocess.run(["git", "branch", "--show-current"], cwd=here, capture_output=True, text=True, timeout=10).stdout.strip() if "tfugen-safety" in url else ""
            except Exception:
                br = ""
        if br == "main":
            print(json.dumps({"hookSpecificOutput": {"hookEventName": "PreToolUse", "permissionDecision": "deny",
                "permissionDecisionReason": "push-gate (\u05dc\u05e7\u05d7 110): commit \u05e2\u05dc main. \u05e7\u05d5\u05d3\u05dd branch: git checkout -B routine/<name>-<date> origin/main"}}, ensure_ascii=False))
            return
    if not re.search(r"(^|[;&|\s])git\s+push\b", cmd):
        print("{}"); return
    # The repo root, not the shell's cwd (the first live run came from tests/harness
    # and looked for tests/harness/tests/harness/...).
    cwd = os.environ.get("CLAUDE_PROJECT_DIR") or d.get("cwd") or "."
    try:
        top = subprocess.run(["git", "rev-parse", "--show-toplevel"], cwd=cwd, capture_output=True, text=True, timeout=10).stdout.strip()
        if top:
            cwd = top
    except Exception:
        pass
    files = changed(cwd)
    for need, rel, why in RULES:
        if not any(need(f) for f in files):
            continue
        test = os.environ.get("PUSH_GATE_TEST") or os.path.join(cwd, rel)
        try:
            p = subprocess.run([sys.executable, test], cwd=cwd, capture_output=True, text=True, encoding="utf-8", timeout=120,
                               env=dict(os.environ, PYTHONIOENCODING="utf-8"))  # Windows pipe = cp1255: the test crashed on its check mark
        except Exception:
            continue
        if p.returncode == 0:
            continue
        tail = "\n".join((p.stdout + p.stderr).strip().splitlines()[-4:])
        print(json.dumps({"hookSpecificOutput": {
            "hookEventName": "PreToolUse",
            "permissionDecision": "deny",
            "permissionDecisionReason":
                "push-gate (" + why + "): " + os.path.basename(rel) + " \u05d0\u05d3\u05d5\u05dd. \u05dc\u05ea\u05e7\u05df \u05dc\u05e4\u05e0\u05d9 push:\n" + tail}}, ensure_ascii=False))
        return
    print("{}")


if __name__ == "__main__":
    main()
