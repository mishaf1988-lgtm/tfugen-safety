#!/usr/bin/env python3
"""PreToolUse (25/11/2026, Michael: "a method so nothing is missed... save tokens"; DECISIONS 25/11/2026 "action cards").

Before an action, the cards of project-files/action-cards.md that match it (tool, routine-db op, recipient, file) are added
as context next to the call. Each card is shown once per session, and again after the session is compacted
(session-start.py clears the list on source "compact"). It never blocks. The research behind it:
project-files/research/action-cards-25-11-2026.md (a rule pushed at the moment of action is followed; one left for the
model to fetch often is not).
"""
import importlib.util, json, os, sys, tempfile

sys.stdin.reconfigure(encoding="utf-8")
sys.stdout.reconfigure(encoding="utf-8")


def load_cards_mod(root):
    spec = importlib.util.spec_from_file_location("action_cards", os.path.join(root, "tools", "action-cards.py"))
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


def state_path(session):
    d = os.environ.get("ACTION_CARD_STATE") or tempfile.gettempdir()
    return os.path.join(d, "action-cards-" + "".join(ch for ch in str(session) if ch.isalnum() or ch in "-_")[:80] + ".json")


def main():
    try:
        d = json.load(sys.stdin)
    except Exception:
        return
    root = os.environ.get("CLAUDE_PROJECT_DIR") or d.get("cwd") or os.getcwd()
    try:
        ac = load_cards_mod(root)
        cards = ac.parse(os.path.join(root, "project-files", "action-cards.md"))
    except Exception:
        return
    hit = ac.for_action(cards, str(d.get("tool_name") or ""), d.get("tool_input") or {})
    if not hit:
        return
    sp = state_path(d.get("session_id") or "nosession")
    try:
        shown = set(json.load(open(sp, encoding="utf-8")))
    except Exception:
        shown = set()
    new = [c for c in hit if c["id"] not in shown]
    if not new:
        return
    try:
        with open(sp, "w", encoding="utf-8") as f:
            json.dump(sorted(shown | {c["id"] for c in new}), f)
    except OSError:
        pass
    print(json.dumps({"hookSpecificOutput": {"hookEventName": "PreToolUse", "additionalContext":
        "כרטיס פעולה (לפני הפעולה הזו):\n" + ac.render(new)}}, ensure_ascii=False))


if __name__ == "__main__":
    main()
