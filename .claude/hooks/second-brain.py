#!/usr/bin/env python3
"""The second brain (31/10/2026, Michael: "I want a second and a third brain so we never get confused", and in the
questionnaire: "second = checker, third = critic", "on me and on the assistant").

A Stop hook, no model and no quota. Before a reply reaches Michael it looks at the reply and at the tool calls of the
same turn, for the two mistakes of 31/10/2026:
  1. "does not work / failed / missing / cannot" said with no check in the turn (client errors were called broken
     before the browser queue was looked at; they worked).
  2. A proposal that looks like a part that already exists on the system map (project-files/system-map/card.md),
     with no look at it in the turn (Twilio was sent to Chrome though the assistant had run on 08-6808365 for five
     days; an automatic fix was offered though the immediate developer existed).
Blocks once (stop_hook_active), names what to check. The third brain is the quality checker's morning step
(routine-quality.md, "critic").
"""
import importlib.util
import json
import os
import re
import sys

sys.stdin.reconfigure(encoding="utf-8")   # Claude Code sends UTF-8; Windows reads cp1255
sys.stdout.reconfigure(encoding="utf-8")  # the reason is Hebrew

HERE = os.path.dirname(os.path.abspath(__file__))
_s = importlib.util.spec_from_file_location("live_check", os.path.join(HERE, "live-check.py"))
_lc = importlib.util.module_from_spec(_s)
_s.loader.exec_module(_lc)
words = _lc.words

# a claim that something is broken, missing or impossible
NEG = re.compile("|".join([
    "לא עובד",            # לא עובד
    "לא מגיע",            # לא מגיע
    "לא נשלח",            # לא נשלח
    "נכשל",                          # נכשל
    "שבור",                          # שבור
    "אי אפשר",            # אי אפשר
    "מנהל מערכת",  # מנהל מערכת
    "אין רישום",  # אין רישום
]))
# a proposal to build or connect something
PROP = re.compile("|".join([
    "אפשר לבנות",  # אפשר לבנות
    "אפשר לחבר",        # אפשר לחבר
    "מציע",                                  # מציע
    "הצעה",                                  # הצעה
    "צריך לבנות",  # צריך לבנות
]))
# tools that count as having looked (the data, the logs, the files, the code)
LOOK_TOOLS = ("execute_sql", "query_logs", "read_resource", "sharepoint_search", "ArtifactData", "Grep", "Read",
              "list_triggers", "get_trigger", "get_job_logs")


def turn(path):
    """(texts, tool calls) of the assistant after the last real user message."""
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
            elif role == "assistant" and isinstance(content, list):
                for c in content:
                    if not isinstance(c, dict):
                        continue
                    if c.get("type") == "text":
                        texts.append(c.get("text", ""))
                    elif c.get("type") == "tool_use":
                        tools.append((str(c.get("name") or ""), json.dumps(c.get("input") or {}, ensure_ascii=False)))
            elif role == "assistant" and isinstance(content, str):
                texts.append(content)
    return texts, tools


def looked(tools):
    for name, inp in tools:
        if any(name.endswith(t) for t in LOOK_TOOLS):
            return True
        if name == "Bash" and re.search(r"routine-db\.sh|grep|sed -n|cat |run\.sh|-test\.", inp):
            return True
    return False


def card_parts(root):
    try:
        with open(os.path.join(root, "project-files", "system-map", "card.md"), encoding="utf-8") as f:
            return [(i + 1, l[2:]) for i, l in enumerate(f.read().split("\n")) if l.startswith("- ")]
    except OSError:
        return []


def map_like(text, parts):
    """card.md lines the proposal shares 3+ content words with, a third of the part's words at least."""
    tw = words(text)
    hits = []
    for n, l in parts:
        pw = words(l)
        c = len(tw & pw)
        if c >= 3 and c * 3 >= len(pw):
            hits.append((c, n, l.split(":")[0]))
    return ["card.md:%d %s" % (n, name[:50]) for c, n, name in sorted(hits, reverse=True)[:3]]


def verdict(texts, tools, root):
    """'' when fine, else the reason to block."""
    text = "\n".join(texts)
    plain = re.sub(r"```.*?```", " ", text, flags=re.S)
    if NEG.search(plain) and not looked(tools):
        m = NEG.search(plain)
        return ("המוח השני: התשובה אומרת '" + m.group(0) + "' ובתור הזה לא נבדק שום דבר (מסד, לוגים, קבצים, קוד). "
                "לבדוק עכשיו, ולכתוב בתשובה איך נבדק. אם בדקת בתור קודם, לכתוב מתי ובמה.")
    if PROP.search(plain):
        hits = map_like(plain, card_parts(root))
        seen = any("card.md" in inp for _, inp in tools)
        if hits and not seen:
            return ("המוח השני: ההצעה דומה למה שכבר קיים במערכת (" + "; ".join(hits) + "). לקרוא את השורות ב-"
                    "project-files/system-map/card.md ולבדוק אם זה כבר עושה את מה שמוצע, ולתקן את התשובה.")
    return ""


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
    root = os.environ.get("CLAUDE_PROJECT_DIR") or data.get("cwd") or os.getcwd()
    try:
        texts, tools = turn(path)
    except Exception:
        sys.exit(0)
    why = verdict(texts, tools, root)
    if why:
        print(json.dumps({"decision": "block", "reason": why}, ensure_ascii=False))
    sys.exit(0)


if __name__ == "__main__":
    main()
