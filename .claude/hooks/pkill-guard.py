#!/usr/bin/env python3
"""PreToolUse on Bash (lesson 39, recurred twice: 05/10 and 10/10/2026; BACKLOG 13.19).
`pkill -f X` matches the full command line of every process, and the shell that
runs this very command has X in its own command line, so it kills itself
(exit 144). `pgrep -f X` inside a `while`/`until` loop finds that same shell,
so the loop never ends (agent-common, 09/10/2026: three harness runs stuck).
Both are denied, with the way out: a PID from `ps`, or a bracket in the
pattern (`pkill -f '[r]un.sh'`), which matches the process but not the text of
the command that holds it. pkill/pgrep without -f (process name only) pass.

Test:  echo '{"tool_name":"Bash","tool_input":{"command":"pkill -f run.sh"}}' | python3 .claude/hooks/pkill-guard.py
"""
import json, re, shlex, sys
sys.stdin.reconfigure(encoding="utf-8")  # Claude Code sends UTF-8; Windows reads cp1255 (05/10/2026)
sys.stdout.reconfigure(encoding="utf-8")  # the reason is Hebrew; Windows prints cp1255

FULL = re.compile(r"^-[a-z]*f[a-z]*$")  # -f, -fx, -af; signals (-9, -TERM) are not lower-case letters
STOP = set(";&|()<>")
VALUED = {"-u", "-U", "-g", "-G", "-P", "-s", "-t", "-F", "--signal", "--euid", "--uid", "--parent"}
HEREDOC = re.compile(r"<<-?\s*(['\"]?)(\w+)\1[^\n]*\n.*?\n[ \t]*\2[ \t]*(?=\n|$)", re.S)


def tokens(cmd):
    """Shell words; a quoted string stays one word, so "pkill -f" inside a commit
    message or an echo is not a call (15/10/2026: the hook denied its own commit).
    A heredoc body is text for another program (a test file, a python script), so
    it is cut first. Unbalanced quotes: [], the hook stays out."""
    cmd = HEREDOC.sub(lambda m: m.group(0).split("\n", 1)[0], cmd)
    lx = shlex.shlex(cmd, posix=True, punctuation_chars=True)
    lx.whitespace_split = True
    try:
        t = list(lx)
    except ValueError:
        return []
    # "$(pgrep -f x)" in double quotes is still a command: its words count too
    for w in list(t):
        for inner in re.findall(r"\$\(([^()]*)\)|`([^`]*)`", w):
            t += [";"] + tokens(inner[0] or inner[1])
    return t


def calls(t):
    """[(prog, pattern)] for every pkill/pgrep -f in the words; pattern None if not found."""
    out = []
    for i, w in enumerate(t):
        w = w.lstrip("`$")
        if w not in ("pkill", "pgrep") and not w.endswith(("/pkill", "/pgrep")):
            continue
        args = []
        for a in t[i + 1:]:
            if a and set(a) <= STOP:
                break
            args.append(a.rstrip("`"))
        if not any(a == "--full" or FULL.match(a) for a in args):
            continue
        rest, skip = [], False
        for a in args:
            if skip:
                skip = False
            elif a in VALUED:
                skip = True  # pkill -u user -f x: "user" is not the pattern
            elif not a.startswith("-") and not a.isdigit():  # "2" of 2>/dev/null
                rest.append(a)
        out.append((w.rsplit("/", 1)[-1], rest[0] if rest else None))
    return out


def safe(pattern):
    # '[r]un.sh' matches run.sh but not the literal text "[r]un.sh" in our own command line
    return pattern is not None and "[" in pattern


def main():
    try:
        data = json.load(sys.stdin)
    except Exception:
        return
    if data.get("tool_name") != "Bash":
        return
    cmd = str((data.get("tool_input") or {}).get("command") or "")
    if not re.search(r"\bp(kill|grep)\b", cmd):
        return
    t = tokens(cmd)
    loop = bool({"while", "until"} & set(t))
    bad = [(p, pat) for p, pat in calls(t) if not safe(pat) and (p == "pkill" or loop)]
    if not bad:
        return
    prog, pat = bad[0]
    why = ("pkill -f תופס גם את ה-shell שמריץ את הפקודה הזו (exit 144)" if prog == "pkill"
           else "pgrep -f בתוך לולאת while/until מוצא את ה-shell של הלולאה עצמה, והיא לא נגמרת")
    fix = "'[" + pat[0] + "]" + pat[1:] + "'" if pat else "'[r]un.sh'"
    print(json.dumps({"hookSpecificOutput": {
        "hookEventName": "PreToolUse",
        "permissionDecision": "deny",
        "permissionDecisionReason": "pkill-guard (לקח 39): " + why + ". במקום: PID מ-ps (kill <PID>), או סוגריים בתבנית: " + prog + " -f " + fix + "."}}, ensure_ascii=False))


main()
