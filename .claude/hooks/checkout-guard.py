#!/usr/bin/env python3
"""PreToolUse on Bash (lesson 26, recurred twice on 08/10/2026): undoing an
intentional break with `git checkout <file>` / `git restore <file>` also wiped
the fix that was not committed yet. The rule in text ("cp a backup, cp it
back") did not hold, so a checkout or restore of a FILE that has uncommitted
changes against HEAD is denied, with the cp way. Branch switches
(checkout -b/-B, a branch name that is not a path) and files with no changes
pass.

Test:  echo '{"tool_name":"Bash","cwd":".","tool_input":{"command":"git checkout functions/api/x.js"}}' | python3 .claude/hooks/checkout-guard.py
"""
import json, os, re, shlex, subprocess, sys
sys.stdin.reconfigure(encoding="utf-8")  # Claude Code sends UTF-8; Windows reads cp1255 (05/10/2026)
sys.stdout.reconfigure(encoding="utf-8")  # the reason is Hebrew; Windows prints cp1255

BRANCH_FLAGS = {"-b", "-B", "--orphan", "--detach"}


def targets(cmd, cwd):
    """[(dir, file)] that a git checkout/restore in cmd would overwrite."""
    out, d = [], cwd
    for seg in re.split(r"&&|\|\||;|\n", cmd):
        try:
            t = shlex.split(seg)
        except ValueError:
            continue
        if not t:
            continue
        if t[0] == "cd" and len(t) > 1:
            d = os.path.join(d, os.path.expanduser(t[1]))
            continue
        if t[0] != "git":
            continue
        i = 1
        while i < len(t) and t[i] == "-C" and i + 1 < len(t):
            d = os.path.join(d, t[i + 1]); i += 2
        if i >= len(t) or t[i] not in ("checkout", "restore"):
            continue
        sub, args = t[i], t[i + 1:]
        if BRANCH_FLAGS & set(args):
            continue
        if sub == "restore" and "--staged" in args and "--worktree" not in args and "-W" not in args:
            continue  # unstaging only: the working file stays
        if "--" in args:
            files = args[args.index("--") + 1:]
        else:
            files = [a for a in args if not a.startswith("-") and os.path.exists(os.path.join(d, a))]
            if sub == "checkout" and files and not os.path.exists(os.path.join(d, args[-1])):
                files = []  # git checkout <branch>: not a file
        out += [(d, f) for f in files if f not in (".", "HEAD")] + [(d, ".") for f in files if f == "."]
    return out


def dirty(d, f):
    try:
        r = subprocess.run(["git", "-C", d, "diff", "--quiet", "HEAD", "--", f], capture_output=True, timeout=20)
        return r.returncode == 1
    except Exception:
        return False


def main():
    try:
        data = json.load(sys.stdin)
    except Exception:
        return
    if data.get("tool_name") != "Bash":
        return
    cmd = str((data.get("tool_input") or {}).get("command") or "")
    if not re.search(r"\bgit\b.*\b(checkout|restore)\b", cmd):
        return
    bad = [f for d, f in targets(cmd, data.get("cwd") or os.getcwd()) if dirty(d, f)]
    if not bad:
        return
    print(json.dumps({"hookSpecificOutput": {
        "hookEventName": "PreToolUse",
        "permissionDecision": "deny",
        "permissionDecisionReason": "checkout-guard (לקח 26): יש שינויים שלא נשמרו ב-" + ", ".join(bad) + ", ו-checkout/restore ימחק גם אותם. לפני שבירה: cp לגיבוי, ולביטול: cp חזרה. אם באמת צריך לזרוק את השינויים: git stash."}}, ensure_ascii=False))


main()
