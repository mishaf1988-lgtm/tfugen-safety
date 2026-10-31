#!/usr/bin/env python3
"""live-note.py (Stop hook, 31/10/2026): the note written at the end of every reply."""
import json, os, subprocess, sys, tempfile
from _common import hook, check, done

d = tempfile.mkdtemp()
tr = os.path.join(d, "t.jsonl")
dry = os.path.join(d, "out.json")


def write_transcript(lines):
    with open(tr, "w", encoding="utf-8") as f:
        for l in lines:
            f.write(json.dumps(l, ensure_ascii=False) + "\n")


def run(data=None, env=None, stdin=None):
    e = {k: v for k, v in os.environ.items() if k not in ("ROUTINE_KEY", "LIVE_NOTE_DRY", "CLAUDE_CODE_USER_EMAIL", "CLAUDE_CODE_SESSION_ATTENDED")}
    e.update(env or {})
    e["CLAUDE_PROJECT_DIR"] = d
    if os.path.exists(dry):
        os.remove(dry)
    p = subprocess.run([sys.executable, hook("live-note.py")], input=stdin if stdin is not None else json.dumps(data or {}, ensure_ascii=False),
                       capture_output=True, text=True, encoding="utf-8", timeout=30, env=e)
    return p, (json.load(open(dry, encoding="utf-8")) if os.path.exists(dry) else None)


write_transcript([
    {"message": {"role": "user", "content": "תבדוק את המפה"}},
    {"message": {"role": "assistant", "content": [{"type": "text", "text": "בודק"}, {"type": "tool_use", "name": "Bash"}]}},
    {"message": {"role": "user", "content": [{"type": "tool_result", "content": "פלט"}]}},
    {"message": {"role": "assistant", "content": [{"type": "text", "text": "המפה כוללת מתג חשבון."}]}},
])
p, body = run({"transcript_path": tr, "session_id": "session_X"}, {"LIVE_NOTE_DRY": dry, "CLAUDE_CODE_USER_EMAIL": "someone@gmail.com"})
check("exit 0 and prints nothing (never blocks)", p.returncode == 0 and p.stdout == "", p.stdout + p.stderr)
v = (body or {}).get("value", {})
check("the request is state_set on live_note", (body or {}).get("op") == "state_set" and (body or {}).get("key") == "live_note", body)
check("last user message: the real one, not a tool result", v.get("last_user") == "תבדוק את המפה", v)
check("last reply: the last text block", v.get("last_reply") == "המפה כוללת מתג חשבון.", v)
check("account: gmail for a gmail address, and the address is not stored", v.get("account") == "gmail" and "someone" not in json.dumps(body, ensure_ascii=False), body)
p, body = run({"transcript_path": tr}, {"LIVE_NOTE_DRY": dry, "CLAUDE_CODE_USER_EMAIL": "x@tapugan.co.il"})
check("account: main for the company address", (body or {}).get("value", {}).get("account") == "main", body)

secret = "sk-ant-oat01-" + "A" * 40
write_transcript([
    {"message": {"role": "user", "content": "המפתח הוא " + secret + " והטוקן Bearer abcdefghijklmnop1234 ו-" + "f" * 40}},
    {"message": {"role": "assistant", "content": [{"type": "text", "text": "ארוך " + "מ" * 3000}]}},
])
p, body = run({"transcript_path": tr}, {"LIVE_NOTE_DRY": dry})
raw = json.dumps(body, ensure_ascii=False)
check("secrets are scrubbed before they leave", secret not in raw and "abcdefghijklmnop1234" not in raw and "f" * 40 not in raw, raw)
check("the reply is cut to the fixed size", len(body["value"]["last_reply"]) <= 1200 and len(raw) < 3500, len(raw))

p, body = run({"transcript_path": tr}, {})
check("no key and no dry run: nothing is sent", p.returncode == 0 and body is None and p.stdout == "", p.stdout)
p, body = run(stdin="not json", env={"LIVE_NOTE_DRY": dry})
check("bad stdin: no crash, nothing written", p.returncode == 0 and body is None, p.stderr)
p, body = run({"transcript_path": os.path.join(d, "missing.jsonl")}, {"LIVE_NOTE_DRY": dry})
check("a missing transcript: no crash, nothing written", p.returncode == 0 and body is None, p.stderr)
# security review 31/10/2026: only a conversation with a person in it writes to the server; more secret shapes are scrubbed.
sh = os.path.join(d, "project-files"); os.makedirs(sh, exist_ok=True)
log = os.path.join(d, "called.txt")
open(os.path.join(sh, "routine-db.sh"), "w").write('#!/usr/bin/env bash\necho called > "%s"\n' % log)
write_transcript([{"message": {"role": "user", "content": "בקשה"}}, {"message": {"role": "assistant", "content": [{"type": "text", "text": "תשובה"}]}}])
if os.path.exists(log): os.remove(log)
run({"transcript_path": tr}, {"ROUTINE_KEY": "k"})
check("an unattended run (a Routine) with the key does not write", not os.path.exists(log))
run({"transcript_path": tr}, {"ROUTINE_KEY": "k", "CLAUDE_CODE_SESSION_ATTENDED": "1"})
check("a conversation with a person writes", os.path.exists(log))
write_transcript([{"message": {"role": "user", "content": "ghp_" + "a" * 30 + " ו-sb_secret_" + "b" * 30 + " הסיסמה: abc12345"}}, {"message": {"role": "assistant", "content": [{"type": "text", "text": "טוב"}]}}])
p, body = run({"transcript_path": tr}, {"LIVE_NOTE_DRY": dry})
raw = json.dumps(body, ensure_ascii=False)
check("github, supabase and Hebrew password shapes are scrubbed", "ghp_" + "a" * 30 not in raw and "b" * 30 not in raw and "abc12345" not in raw, raw)
done()
