#!/usr/bin/env python3
"""hebrew-midturn.py: after a tool call, an English last text block warns once;
Hebrew, short lines and code say nothing."""
import json, os, tempfile
from _common import run, check, done
d = tempfile.mkdtemp()
def tr(*texts):
    p = os.path.join(d, "t%d.jsonl" % len(os.listdir(d)))
    with open(p, "w", encoding="utf-8") as f:
        f.write(json.dumps({"message": {"role": "user", "content": "תתחיל"}}) + "\n")
        for t in texts:
            f.write(json.dumps({"message": {"role": "assistant", "content": [{"type": "text", "text": t}, {"type": "tool_use", "name": "Bash"}]}}, ensure_ascii=False) + "\n")
            f.write(json.dumps({"message": {"role": "user", "content": [{"type": "tool_result", "content": "ok"}]}}) + "\n")
    return p
st = os.path.join(d, "state")
env = {"HEB_MIDTURN_STATE": st}
ENG = "Now I am waiting for the CI run to finish before merging the pull request."
HEB = "עכשיו ממתין לבדיקות ב-CI לפני המיזוג של ה-PR."
out = run("hebrew-midturn.py", {"transcript_path": tr(HEB, ENG), "session_id": "s"}, env)
check("last block English: warning", "additionalContext" in out and "לקח 13" in out, out)
p = tr(HEB, ENG)
check("same block again: no second warning", run("hebrew-midturn.py", {"transcript_path": p, "session_id": "s"}, env) == "{}")
check("last block Hebrew: nothing", run("hebrew-midturn.py", {"transcript_path": tr(ENG, HEB)}, {"HEB_MIDTURN_STATE": st + "2"}) == "{}")
check("short English line (PR #12 merged): nothing", run("hebrew-midturn.py", {"transcript_path": tr("PR #1171 merged")}, {"HEB_MIDTURN_STATE": st + "3"}) == "{}")
check("code only: nothing", run("hebrew-midturn.py", {"transcript_path": tr("```\n" + ENG * 3 + "\n```")}, {"HEB_MIDTURN_STATE": st + "4"}) == "{}")
check("no transcript: nothing, no crash", run("hebrew-midturn.py", {"transcript_path": "/nonexistent"}, env) == "{}")
done()
