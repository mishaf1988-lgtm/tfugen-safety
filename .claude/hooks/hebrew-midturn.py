#!/usr/bin/env python3
"""PostToolUse (all tools): lesson 13 recurred 23 times; the Stop hook
hebrew-reply.py catches an English line only when the turn ends, after
Michael already saw it. This reads the last assistant text block from the
transcript after every tool call and, if it is English by the same measure
(strip + verdict of hebrew-reply.py), adds a reminder as additionalContext.
It warns once per block (the block's hash is kept in a state file), so a
long turn does not repeat the same warning after every tool.

Test:  python3 tests/harness/hebrew-midturn-test.py
"""
import hashlib, importlib.util, json, os, sys, tempfile
sys.stdout.reconfigure(encoding="utf-8")  # Windows writes cp1255; Claude Code reads UTF-8 (05/10/2026)

HERE = os.path.dirname(os.path.abspath(__file__))


def load_reply():
    # Next to this file once installed; from the package folder, the repo's copy.
    for p in (os.path.join(HERE, "hebrew-reply.py"),
              os.path.join(HERE, "..", "..", "..", ".claude", "hooks", "hebrew-reply.py"),
              os.path.join(os.environ.get("CLAUDE_PROJECT_DIR", "."), ".claude", "hooks", "hebrew-reply.py")):
        if os.path.exists(p):
            spec = importlib.util.spec_from_file_location("hebrew_reply", p)
            m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m)
            return m
    raise ImportError("hebrew-reply.py")


def state_file(session):
    return os.environ.get("HEB_MIDTURN_STATE") or os.path.join(tempfile.gettempdir(), "heb-midturn-%s" % (session or "x"))


def main():
    try:
        d = json.load(sys.stdin)
        hr = load_reply()
        blocks = hr.last_turn_blocks(d["transcript_path"])
    except Exception:
        print("{}"); return
    if not blocks:
        print("{}"); return
    last = blocks[-1]
    ok, heb, lat = hr.verdict(last)
    if ok:
        print("{}"); return
    h = hashlib.sha1(last.encode("utf-8")).hexdigest()
    sf = state_file(d.get("session_id"))
    try:
        if open(sf).read().strip() == h:
            print("{}"); return
    except Exception:
        pass
    try:
        open(sf, "w").write(h)
    except Exception:
        pass
    print(json.dumps({"hookSpecificOutput": {"hookEventName": "PostToolUse", "additionalContext":
        "hebrew-midturn (לקח 13): ההודעה האחרונה למיכאל יצאה באנגלית (%d אותיות לטיניות, %d עבריות). "
        "כל הודעה בעברית, גם הודעת ביניים. מעכשיו בעברית." % (lat, heb)}}, ensure_ascii=False))


if __name__ == "__main__":
    main()
