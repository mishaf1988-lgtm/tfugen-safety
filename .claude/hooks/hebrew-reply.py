#!/usr/bin/env python3
"""Stop hook: Claude's reply to Michael is in Hebrew (CLAUDE.md, lesson 13).

Lesson 13 was text only, and it recurred on 01/10/2026: short replies while
waiting on CI went out in English, and Michael had to say "it's a rule".
A rule that recurs needs code, so this reads the last assistant turn from the
transcript before the reply goes out. Code (``` blocks and `spans`), URLs and
paths are ignored. If what is left has a real amount of Latin text and little
Hebrew, the stop is blocked with a reason, and Claude writes it again in Hebrew.

Never blocks twice in a row (stop_hook_active), so it cannot loop.

Test:  python3 tests/harness/hebrew-reply-test.py
"""
import json, re, sys

MIN_LATIN = 40      # a short line like "PR #1018 merged" is not judged
HEB_SHARE = 0.25    # Hebrew letters / (Hebrew + Latin) below this = English reply


def strip(text):
    text = re.sub(r"```.*?```", " ", text, flags=re.S)
    text = re.sub(r"`[^`]*`", " ", text)
    text = re.sub(r"https?://\S+", " ", text)
    text = re.sub(r"\S*[/\\]\S*", " ", text)          # paths
    text = re.sub(r"\S+\.(js|mjs|py|md|html|json|sql|yml)\b", " ", text)
    return text


def last_turn_text(path):
    """Text of the assistant messages after the last real user message."""
    texts = []
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
                # a tool result is not the user speaking
                if isinstance(content, list) and all(isinstance(c, dict) and c.get("type") == "tool_result" for c in content):
                    continue
                texts = []
            elif role == "assistant":
                if isinstance(content, str):
                    texts.append(content)
                elif isinstance(content, list):
                    texts += [c.get("text", "") for c in content if isinstance(c, dict) and c.get("type") == "text"]
    return "\n".join(texts)


def verdict(text):
    t = strip(text)
    heb = len(re.findall(r"[֐-׿]", t))
    lat = len(re.findall(r"[A-Za-z]", t))
    if lat < MIN_LATIN:
        return True, heb, lat
    return heb / float(heb + lat) >= HEB_SHARE, heb, lat


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
        text = last_turn_text(path)
    except Exception:
        sys.exit(0)
    ok, heb, lat = verdict(text)
    if ok:
        sys.exit(0)
    print(json.dumps({"decision": "block", "reason":
        "The reply to Michael is in English (%d Latin letters, %d Hebrew). CLAUDE.md and lesson 13: "
        "always Hebrew, also short waiting messages. Write the same reply again in Hebrew." % (lat, heb)}))
    sys.exit(0)


if __name__ == "__main__":
    main()
