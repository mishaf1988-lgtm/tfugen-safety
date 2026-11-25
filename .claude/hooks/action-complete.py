#!/usr/bin/env python3
"""Stop (25/11/2026, DECISIONS 25/11/2026 "action cards"; the research: a promise to follow a procedure is not seen in
the text, only in the tool log).

A card with "then" (project-files/action-cards.md) says what must follow an action in the same session, e.g. after a
controlled form NN.NN is saved, an edit of iso-forms-index.md; after mail_draft, a search in Drafts. At the end of a
turn the transcript's tool calls are read: an action that matched such a card with no later call matching "then"
stops the turn once (per card and action), with the card text. Never twice for the same one, never when
stop_hook_active (one round only).
"""
import hashlib, importlib.util, json, os, re, sys, tempfile

sys.stdin.reconfigure(encoding="utf-8")
sys.stdout.reconfigure(encoding="utf-8")


def load_cards_mod(root):
    spec = importlib.util.spec_from_file_location("action_cards", os.path.join(root, "tools", "action-cards.py"))
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


def tool_calls(path):
    out = []
    try:
        with open(path, encoding="utf-8") as f:
            for line in f:
                try:
                    e = json.loads(line)
                except Exception:
                    continue
                msg = e.get("message") or {}
                if e.get("type") != "assistant" or not isinstance(msg.get("content"), list):
                    continue
                for c in msg["content"]:
                    if isinstance(c, dict) and c.get("type") == "tool_use":
                        out.append((str(c.get("name") or ""), c.get("input") or {}))
    except OSError:
        pass
    return out


def missing(ac, cards, calls):
    """(card, action key) for each action whose card has "then" that no later call matched."""
    want = [c for c in cards if c.get("then")]
    res = []
    for i, (name, inp) in enumerate(calls):
        for c in want:
            if not ac.match(c, ac.facts(name, inp)):
                continue
            try:
                rx = re.compile(c["then"], re.I)
            except re.error:
                continue
            if not any(rx.search(n + " " + json.dumps(x, ensure_ascii=False)) for n, x in calls[i + 1:]):
                res.append((c, hashlib.sha1((c["id"] + json.dumps(inp, ensure_ascii=False, sort_keys=True)[:4000]).encode("utf-8")).hexdigest()[:12]))
    return res


def main():
    try:
        d = json.load(sys.stdin)
    except Exception:
        return
    if d.get("stop_hook_active"):
        return
    root = os.environ.get("CLAUDE_PROJECT_DIR") or d.get("cwd") or os.getcwd()
    try:
        ac = load_cards_mod(root)
        cards = ac.parse(os.path.join(root, "project-files", "action-cards.md"))
    except Exception:
        return
    calls = tool_calls(str(d.get("transcript_path") or ""))
    if not calls:
        return
    sd = os.environ.get("ACTION_CARD_STATE") or tempfile.gettempdir()
    sess = "".join(ch for ch in str(d.get("session_id") or "s") if ch.isalnum())[:60]
    todo = []
    for c, key in missing(ac, cards, calls):
        mark = os.path.join(sd, "action-done-" + sess + "-" + key)
        if os.path.exists(mark):
            continue
        try:
            open(mark, "w").close()
        except OSError:
            pass
        if c["id"] not in [t["id"] for t in todo]:
            todo.append(c)
    if not todo:
        return
    print(json.dumps({"decision": "block", "reason":
        "כרטיס פעולה: חסר צעד שאמור לבוא אחרי הפעולה (פעם אחת בלבד):\n" + ac.render(todo)
        + "\nלבצע את הצעד, או לכתוב למיכאל למה לא."}, ensure_ascii=False))


if __name__ == "__main__":
    main()
