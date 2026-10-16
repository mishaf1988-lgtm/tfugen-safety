#!/usr/bin/env python3
"""PreToolUse on AskUserQuestion (lesson 61, recurred 4 times by 08/10/2026):
a plan put to Michael leaned on something "existing" that was not live (the
mail scan off since 27/09, a public bucket that was private, a Routine bound to
another session). The rule in text did not stop it, so the first questionnaire
whose text says a thing already exists or already works is denied once, with
the instruction to check it against the live system (DB, token scopes, Graph,
get_trigger) and then ask again. The same question asked again passes: one
pause per question, never a loop.

Second check (lesson 15, recurred 4th time 16/10/2026): a questionnaire asked Michael
to approve `received_at`, built and verified the day before; a stale BACKLOG line said
it was open. A specific identifier in the question (snake_case, rare: at most 6 hits)
that already appears in DECISIONS.md or the STATUS archive denies once too, with where.

Test:  echo '{"tool_name":"AskUserQuestion","session_id":"t","tool_input":{"questions":[{"question":"סריקת המייל הקיימת?","options":[]}]}}' | python3 .claude/hooks/live-check.py
"""
import hashlib, json, os, re, sys, tempfile
sys.stdin.reconfigure(encoding="utf-8")  # Claude Code sends UTF-8; Windows reads cp1255 (05/10/2026)
sys.stdout.reconfigure(encoding="utf-8")  # the reason is Hebrew; Windows prints cp1255

# "existing", "already exists", "already works/runs/connected" (Hebrew forms).
CLAIM = re.compile(r"(הקיי(ם|מת|מים|מות)\b|כבר (קיי[םמ]|עובד|רץ|רצה|מחובר))")


def text_of(inp):
    parts = []
    for q in (inp or {}).get("questions") or []:
        parts.append(str(q.get("question") or ""))
        for o in q.get("options") or []:
            parts.append(str(o.get("label") or ""))
            parts.append(str(o.get("description") or ""))
    return "\n".join(parts)


IDENT = re.compile(r"\b[a-z][a-z0-9]*_[a-z0-9_]{2,}\b")


def decided(t):
    """Rare identifiers of the question already in a decision or a closed item: ['x: DECISIONS.md:12']."""
    root = os.environ.get("LIVE_CHECK_ROOT") or os.environ.get("CLAUDE_PROJECT_DIR") or os.getcwd()
    files = {}
    for rel in ("DECISIONS.md", os.path.join("project-files", "STATUS-archive.md")):
        try:
            with open(os.path.join(root, rel), encoding="utf-8") as f:
                files[os.path.basename(rel)] = f.read().split("\n")
        except OSError:
            pass
    out = []
    for w in sorted(set(IDENT.findall(t))):
        hits = [(n, i + 1) for n, lines in files.items() for i, l in enumerate(lines) if re.search(r"\b" + re.escape(w) + r"\b", l)]
        if 0 < len(hits) <= 6:
            out.append(w + ": " + hits[0][0] + ":" + str(hits[0][1]))
    return out


def main():
    try:
        d = json.load(sys.stdin)
    except Exception:
        return
    if d.get("tool_name") != "AskUserQuestion":
        return
    t = text_of(d.get("tool_input"))
    m = CLAIM.search(t)
    seen = [] if m else decided(t)
    if not m and not seen:
        return
    key = hashlib.sha1((str(d.get("session_id") or "") + "\n" + t).encode("utf-8")).hexdigest()[:16]
    mark = os.path.join(os.environ.get("LIVE_CHECK_STATE") or tempfile.gettempdir(), "live-check-" + key)
    if os.path.exists(mark):
        return  # asked again after the pause: let it through
    try:
        open(mark, "w").close()
    except OSError:
        return
    if not m:
        why = "live-check (לקח 15): מה שהשאלון שואל עליו כבר מופיע בהחלטה או בפריט שנסגר (" + ", ".join(seen[:3]) + "). לקרוא שם, ולבדוק בקוד ובמסד אם זה כבר נעשה, לפני שמבקשים ממיכאל לאשר. אותה שאלה בפעם השנייה עוברת."
        print(json.dumps({"hookSpecificOutput": {"hookEventName": "PreToolUse", "permissionDecision": "deny", "permissionDecisionReason": why}}, ensure_ascii=False))
        return
    print(json.dumps({"hookSpecificOutput": {
        "hookEventName": "PreToolUse",
        "permissionDecision": "deny",
        "permissionDecisionReason": "live-check (לקח 61): השאלון אומר שמשהו קיים או עובד ('" + m.group(0) + "'). לבדוק מול המערכת החיה (מסד, הרשאות הטוקן, Graph, get_trigger) שזה באמת פעיל, ורק אז לשאול שוב. אותה שאלה בפעם השנייה עוברת."}}, ensure_ascii=False))


main()
