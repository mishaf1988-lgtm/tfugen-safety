#!/usr/bin/env python3
"""Action cards (25/11/2026, DECISIONS "action cards"): the table parses, functions/_cards.js is in sync, the
PreToolUse hook adds the right cards once (and again after a compaction), the Stop hook stops once when a "then" step
is missing and not when it is there, and the two cases of 25/11/2026 are caught (a draft to Oxana, a form NN.NN)."""
import importlib.util, json, os, subprocess, sys, tempfile
from _common import hook, check, done

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
spec = importlib.util.spec_from_file_location("ac", os.path.join(ROOT, "tools", "action-cards.py"))
ac = importlib.util.module_from_spec(spec); spec.loader.exec_module(ac)
cards = ac.parse()
ids = {c["id"] for c in cards}
check("the table parses, the two cases of 25/11/2026 have cards", {"oxana-review", "form-index", "draft-check"} <= ids, ids)
check("every card is under 500 characters", all(len(c["text"]) <= ac.MAX for c in cards))
check("functions/_cards.js is in sync with the table", subprocess.run([sys.executable, os.path.join(ROOT, "tools", "action-cards.py"), "--check"], capture_output=True).returncode == 0)
check("an escaped | inside a regex stays a regex alternative", any("od_put_pdf|od_archive" in c["when"].get("op", "") for c in cards))

def got(tool, inp):
    return sorted(c["id"] for c in ac.for_action(cards, tool, inp))

ox = "bash project-files/routine-db.sh '{\"op\":\"mail_draft\",\"to\":\"oxana@tapugan.co.il\",\"subject\":\"x\"}'"
check("a draft to Oxana: the Oxana card and the draft card", got("Bash", {"command": ox}) == ["draft-check", "oxana-review"], got("Bash", {"command": ox}))
tz = ox.replace("oxana@", "tzachi@")
check("a draft to someone else: only the draft card", got("Bash", {"command": tz}) == ["draft-check"])
tmp = tempfile.mkdtemp()
pj = os.path.join(tmp, "put.json")
json.dump({"op": "od_put_pdf", "dir": "06_x", "name": "פריסה_13.08.docx", "b64": "QUFB"}, open(pj, "w", encoding="utf-8"), ensure_ascii=False)
check("an @file upload of form 13.08 is read: the form cards", got("Bash", {"command": "bash project-files/routine-db.sh @" + pj}) == ["form-build", "form-index"])
check("an xlsx upload without a form number: the Excel card only", got("Bash", {"command": "bash project-files/routine-db.sh '{\"op\":\"od_put_pdf\",\"name\":\"a.xlsx\"}'"}) == ["xlsx-save"])
check("od_archive_x is not od_archive (whole op)", got("Bash", {"command": "bash project-files/routine-db.sh '{\"op\":\"od_archive_x\"}'"}) == [])
check("git status: no card", got("Bash", {"command": "git status"}) == [])
check("an MCP delete_trigger: the trigger card", got("mcp__claude-code-remote__delete_trigger", {"trigger_id": "trig_1"}) == ["trigger-delete"])

st = tempfile.mkdtemp()
env = dict(os.environ, CLAUDE_PROJECT_DIR=ROOT, ACTION_CARD_STATE=st)
def pre(cmd, sid="s1"):
    p = subprocess.run([sys.executable, hook("action-card.py")], input=json.dumps({"tool_name": "Bash", "session_id": sid, "tool_input": {"command": cmd}}, ensure_ascii=False),
                       capture_output=True, text=True, encoding="utf-8", timeout=30, env=env)
    return p.stdout.strip()
o = pre(ox)
check("the hook adds the Oxana card as context, never a deny", "additionalContext" in o and "oxana-review" in o and "deny" not in o, o)
check("the same cards are not shown twice in a session", pre(ox) == "")
check("a new card in the same session is still shown (form)", "form-index" in pre("bash project-files/routine-db.sh @" + pj))
ss = subprocess.run([sys.executable, hook("session-start.py")], input=json.dumps({"source": "compact", "session_id": "s1", "cwd": ROOT}),
                    capture_output=True, text=True, encoding="utf-8", timeout=60, env=dict(env, HOME=tempfile.mkdtemp()))
check("session start prints the short index of the cards", "action-cards.md" in ss.stdout and "oxana-review" in ss.stdout)
check("after a compaction the cards are shown again", "oxana-review" in pre(ox))

def transcript(calls):
    p = os.path.join(tempfile.mkdtemp(), "t.jsonl")
    with open(p, "w", encoding="utf-8") as f:
        for name, inp in calls:
            f.write(json.dumps({"type": "assistant", "message": {"content": [{"type": "tool_use", "name": name, "input": inp}]}}, ensure_ascii=False) + "\n")
    return p
def stop(path, sid="t1", active=False):
    p = subprocess.run([sys.executable, hook("action-complete.py")], input=json.dumps({"session_id": sid, "transcript_path": path, "stop_hook_active": active}),
                       capture_output=True, text=True, encoding="utf-8", timeout=30, env=env)
    return p.stdout.strip()
form = ("Bash", {"command": "bash project-files/routine-db.sh @" + pj})
t1 = transcript([form])
o = stop(t1)
check("a form saved and the index not touched: the turn stops once with the card", '"block"' in o and "form-index" in o, o)
check("the same missing step does not stop twice", stop(t1) == "")
t2 = transcript([form, ("Edit", {"file_path": "/x/project-files/iso-forms-index.md", "old_string": "a", "new_string": "b"}),
                 ("mcp__Microsoft_365__outlook_email_search", {"folderName": "Drafts"})])
check("a form saved and the index edited: no stop", stop(t2, sid="t2") == "")
idx = "/x/project-files/iso-forms-index.md"
t2r = transcript([form, ("Read", {"file_path": idx}), ("Grep", {"pattern": "13.08", "path": idx}), ("Bash", {"command": "grep -n 13.08 " + idx})])
check("a form saved and the index only read (Read/Grep/grep): still stops", "form-index" in stop(t2r, sid="t2r"), stop(t2r, sid="t2r-b"))
t2w = transcript([form, ("Write", {"file_path": idx, "content": "x"})])
check("a form saved and the index written (Write): no stop", stop(t2w, sid="t2w") == "")
t2b = transcript([form, ("Bash", {"command": "echo '| 13.08 |' >> " + idx})])
check("a form saved and a Bash append to the index: no stop", stop(t2b, sid="t2b") == "")
t2s = transcript([form, ("Bash", {"command": "sed -i 's/a/b/' " + idx})])
check("a form saved and sed -i on the index: no stop", stop(t2s, sid="t2s") == "")
t2n = transcript([form, ("Grep", {"pattern": "Edit", "path": idx})])
check("a tool prefix matches the tool name, not the input (Grep for 'Edit'): still stops", "form-index" in stop(t2n, sid="t2n"))
t3 = transcript([("Bash", {"command": ox})])
check("a draft with no Drafts search after it: stop with the draft card", "draft-check" in stop(t3, sid="t3"))
t4 = transcript([("Bash", {"command": ox}), ("mcp__Microsoft_365__outlook_email_search", {"query": "x", "folderName": "Drafts"})])
check("a draft checked in Drafts: no stop", stop(t4, sid="t4") == "")
check("stop_hook_active: never a second round", stop(transcript([form]), sid="t5", active=True) == "")
check("a missing transcript: no stop, no crash", stop("/nonexistent.jsonl", sid="t6") == "")
done()
