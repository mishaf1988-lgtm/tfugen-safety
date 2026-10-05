#!/usr/bin/env python3
"""Stop hook: a usage line under every reply, for Claude Code sessions where no
status line or mod is drawn (cloud sessions watched in the Claude app, the web).
Michael, 05/10/2026: "it has to work everywhere". Sums the usage of the
assistant messages in the transcript (each message id once: a streamed message
is written on several lines) and returns it as systemMessage, which Claude Code
shows to the user. Never blocks.
Test:  python3 project-files/usage-meter/test_usage_meter.py
"""
import json, sys


def k(n):
    return "%.2fM" % (n / 1e6) if n >= 1e6 else ("%.1fk" % (n / 1e3) if n >= 1e3 else "%d" % n)


def usage(path):
    seen, tot, last, turns = {}, 0, 0, 0
    with open(path, encoding="utf-8") as f:
        for l in f:
            try:
                m = json.loads(l).get("message") or {}
            except Exception:
                continue
            u = m.get("usage")
            if m.get("role") != "assistant" or not isinstance(u, dict):
                continue
            seen[m.get("id") or len(seen)] = u
    for u in seen.values():
        ctx = (u.get("input_tokens") or 0) + (u.get("cache_read_input_tokens") or 0) + (u.get("cache_creation_input_tokens") or 0)
        tot += ctx + (u.get("output_tokens") or 0)
        last = ctx
        turns += 1
    return tot, last, turns


def main():
    try:
        d = json.load(sys.stdin)
        tot, last, turns = usage(d["transcript_path"])
    except Exception:
        return
    if not turns:
        return
    # The context is what each new message costs; the cache-inclusive total ran to
    # 190M in one long session and said nothing to Michael, so it is left out.
    print(json.dumps({"systemMessage": "📊 שיחה: הקשר %s טוקנים, %d קריאות. מכסה כוללת: claude.ai/settings/usage" % (k(last), turns)}, ensure_ascii=False))


if __name__ == "__main__":
    main()
