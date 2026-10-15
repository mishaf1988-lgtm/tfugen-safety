#!/usr/bin/env python3
"""Stop hook: the end of a task, and every question, goes to Michael as a questionnaire.

Michael, 15/10/2026: "לא דיברנו פעם על שאלון עם משימות", then "הכוונה שאתה פותח
שאלון אלי, זה חוק לא?", and in the questionnaire: "בצע: hook שחוסם סיום בלי שאלון".
CLAUDE.md has said "שאלה למיכאל = שאלון" since 07/10/2026, and it was still missed:
a list of 33 tasks went out as text (lesson 101). A rule that recurs needs code.

Reads the last turn (after the last real user message) from the transcript and blocks when:
  A. a PR was merged in the turn (merge_pull_request), and no AskUserQuestion came after
     the last merge: the end of a task without the questionnaire of what waits for Michael.
  B. the last text ends with a question mark, and no AskUserQuestion came after it.
A line "בלי שאלון: <reason>" in the last text lets the turn end (for example, nothing
waits for Michael and he did not ask). Never blocks twice in a row (stop_hook_active).

Test:  python3 tests/harness/questionnaire-gate-test.py
"""
import json, re, sys
sys.stdin.reconfigure(encoding="utf-8")
sys.stdout.reconfigure(encoding="utf-8")  # Hebrew reason; Windows writes cp1255 (lesson 57)

ESCAPE = "בלי שאלון:"   # "בלי שאלון:"


def last_turn(path):
    """Events of the last turn, in order: ("tool", name) and ("text", text)."""
    ev = []
    with open(path, encoding="utf-8") as f:
        for line in f:
            try:
                e = json.loads(line)
            except Exception:
                continue
            msg = e.get("message") or {}
            role = msg.get("role") or e.get("type")
            content = msg.get("content")
            if role == "user":
                if isinstance(content, list) and all(isinstance(c, dict) and c.get("type") == "tool_result" for c in content):
                    continue
                ev = []
            elif role == "assistant":
                if isinstance(content, str):
                    ev.append(("text", content))
                elif isinstance(content, list):
                    for c in content:
                        if not isinstance(c, dict):
                            continue
                        if c.get("type") == "text":
                            ev.append(("text", c.get("text", "")))
                        elif c.get("type") == "tool_use":
                            ev.append(("tool", c.get("name", "")))
    return ev


def ends_with_question(text):
    t = re.sub(r"```.*?```", " ", text or "", flags=re.S)
    lines = [l.strip() for l in t.splitlines() if l.strip()]
    return bool(lines) and lines[-1].rstrip("*_ )").endswith("?")


def reason(ev):
    texts = [t for k, t in ev if k == "text" and t.strip()]
    last_text = texts[-1] if texts else ""
    if ESCAPE in last_text:
        return None
    ask = [i for i, (k, n) in enumerate(ev) if k == "tool" and n == "AskUserQuestion"]
    last_ask = ask[-1] if ask else -1
    merges = [i for i, (k, n) in enumerate(ev) if k == "tool" and n.endswith("merge_pull_request")]
    if merges and last_ask < merges[-1]:
        return ("סיום משימה (מוזג PR) בלי שאלון. "
                "CLAUDE.md: בסוף כל משימה שאלון עם מה שמחכה למיכאל (AskUserQuestion), "
                "או שורה \"בלי שאלון: <למה>\" כשאין מה לשאול.")
    text_idx = max((i for i, (k, t) in enumerate(ev) if k == "text" and t.strip()), default=-1)
    if text_idx >= 0 and ends_with_question(ev[text_idx][1]) and last_ask < text_idx:
        return ("שאלה למיכאל בטקסט. CLAUDE.md: שאלה למיכאל = שאלון (AskUserQuestion). "
                "לשאול אותה בשאלון, או לנסח בלי שאלה.")
    return None


def main():
    try:
        data = json.load(sys.stdin)
    except Exception:
        sys.exit(0)
    if data.get("stop_hook_active"):
        sys.exit(0)
    path = data.get("transcript_path")
    if not path:
        sys.exit(0)
    try:
        r = reason(last_turn(path))
    except Exception:
        sys.exit(0)
    if r:
        print(json.dumps({"decision": "block", "reason": r}, ensure_ascii=False))
    sys.exit(0)


if __name__ == "__main__":
    main()
