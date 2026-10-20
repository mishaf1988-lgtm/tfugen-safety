#!/usr/bin/env python3
"""PreToolUse on AskUserQuestion (lesson 13, 20/10/2026): a questionnaire went to
Michael in English and he refused it; he had to write "בעברית". hebrew-reply.py
and hebrew-midturn.py read only the chat text, never the questionnaire. This
measures the question, the labels and the descriptions by the same rule
(strip + verdict of hebrew-reply.py) and denies an English questionnaire, every
time, until it is written in Hebrew.

Test:  python3 tests/harness/questionnaire-hebrew-test.py
"""
import importlib.util, json, os, sys
sys.stdin.reconfigure(encoding="utf-8")  # Claude Code sends UTF-8; Windows reads cp1255 (05/10/2026)
sys.stdout.reconfigure(encoding="utf-8")  # the reason is Hebrew; Windows prints cp1255

HERE = os.path.dirname(os.path.abspath(__file__))


def load_reply():
    for p in (os.path.join(HERE, "hebrew-reply.py"),
              os.path.join(os.environ.get("CLAUDE_PROJECT_DIR", "."), ".claude", "hooks", "hebrew-reply.py")):
        if os.path.exists(p):
            spec = importlib.util.spec_from_file_location("hebrew_reply", p)
            m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m)
            return m
    raise ImportError("hebrew-reply.py")


def text_of(inp):
    parts = []
    for q in (inp or {}).get("questions") or []:
        parts += [str(q.get("question") or ""), str(q.get("header") or "")]
        for o in q.get("options") or []:
            parts += [str(o.get("label") or ""), str(o.get("description") or "")]
    return "\n".join(parts)


def main():
    try:
        data = json.load(sys.stdin)
    except Exception:
        print("{}"); return
    ok, heb, lat = load_reply().verdict(text_of(data.get("tool_input")))
    if ok:
        print("{}"); return
    why = ("questionnaire-hebrew (לקח 13): השאלון באנגלית (" + str(lat) + " אותיות לטיניות, " + str(heb) +
           " עבריות). מיכאל דחה שאלון כזה ב-20/10/2026. לכתוב את השאלה, הכותרת, האפשרויות וההסברים בעברית, ולשאול שוב.")
    print(json.dumps({"hookSpecificOutput": {"hookEventName": "PreToolUse", "permissionDecision": "deny",
                                             "permissionDecisionReason": why}}, ensure_ascii=False))


if __name__ == "__main__":
    main()
