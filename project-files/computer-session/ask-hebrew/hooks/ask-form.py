#!/usr/bin/env python3
"""Stop hook: a question to Michael goes in a questionnaire, not in chat text
(CLAUDE.md "שפה ותקשורת", lesson 64; Michael, 07/10/2026: "תשאל אותי שאלות כל פעם
בשאלון, אלא אם כן אני מבקש אחרת").

The final text block of the turn is read from the transcript. If a line of it
ends with "?" (code, tables and quotes ignored) and the turn opened no
AskUserQuestion, the stop is blocked once with a reason. Never twice in a row
(stop_hook_active): if Michael asked for text, the second stop goes through.

Test:  python3 tests/harness/ask-form-test.py
"""
import json, re, sys
sys.stdout.reconfigure(encoding="utf-8")  # Windows writes cp1255 (lesson 57)
sys.stdin.reconfigure(encoding="utf-8")


def last_turn(path):
    """(text blocks, tool names) of the assistant after the last real user message."""
    texts, tools = [], []
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
                texts, tools = [], []
            elif role == "assistant":
                if isinstance(content, str):
                    texts.append(content)
                elif isinstance(content, list):
                    for c in content:
                        if not isinstance(c, dict):
                            continue
                        if c.get("type") == "text":
                            texts.append(c.get("text", ""))
                        elif c.get("type") == "tool_use":
                            tools.append(c.get("name", ""))
    return texts, tools


def questions(text):
    text = re.sub(r"```.*?```", " ", text, flags=re.S)
    out = []
    for ln in text.splitlines():
        s = re.sub(r"`[^`]*`", " ", ln).strip()
        if not s or s.startswith("|") or s.startswith(">"):
            continue
        s = re.sub(r'["\'”)*_\s]+$', "", s)
        if s.endswith("?"):
            out.append(s[-80:])
    return out


def main():
    try:
        d = json.load(sys.stdin)
    except Exception:
        return
    if d.get("stop_hook_active"):
        return
    try:
        texts, tools = last_turn(d["transcript_path"])
    except Exception:
        return
    if not texts or any(t == "AskUserQuestion" for t in tools):
        return
    q = questions(texts[-1])
    if not q:
        return
    print(json.dumps({"decision": "block", "reason":
        "ask-form (לקח 64): בתשובה יש שאלה בטקסט (\"%s\"). שאלה למיכאל = שאלון (AskUserQuestion), "
        "2-4 אפשרויות, המומלצת ראשונה. אם מיכאל ביקש תשובה בטקסט, להמשיך בלי שינוי." % q[0]}, ensure_ascii=False))


if __name__ == "__main__":
    main()
