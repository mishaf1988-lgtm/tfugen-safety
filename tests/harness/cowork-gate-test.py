#!/usr/bin/env python3
"""cowork-gate.py (18/10/2026): a Cowork task without "בצע" in approved_by_michael
is denied before it reaches the queue; report-back updates and other
collections pass."""
from _common import run, check, done
B = "בצע"
def ad(ti):
    return run("cowork-gate.py", {"tool_name": "ArtifactData", "tool_input": ti})
deny = lambda ti: '"deny"' in ad(ti)
check("set without בצע: denied", deny({"action": "set", "collection": "cowork_tasks", "doc_id": "x", "data": {"status": "open", "approved_by_michael": "18/10/2026 בשאלון: תיקיית קבלן חדשה"}}))
check("set with no approved_by_michael: denied", deny({"action": "set", "collection": "cowork_tasks", "doc_id": "x", "data": {"status": "open"}}))
check("reopen without בצע: denied", deny({"action": "update", "collection": "cowork_tasks", "doc_id": "x", "data": {"status": "open"}}))
check("batch entry without בצע: denied", deny({"action": "batch", "writes": [{"op": "update", "collection": "chat", "doc_id": "a", "data": {"status": "done"}}, {"op": "set", "collection": "cowork_tasks", "doc_id": "y", "data": {"status": "open", "approved_by_michael": "ok"}}]}))
check("set with בצע: passes", ad({"action": "set", "collection": "cowork_tasks", "doc_id": "x", "data": {"status": "open", "approved_by_michael": B + ": ליצור תיקייה"}}) == "")
check("report-back update: passes", ad({"action": "update", "collection": "cowork_tasks", "doc_id": "x", "data": {"filed_checked": "18/10/2026"}}) == "")
check("other collection and other tools: pass", ad({"action": "set", "collection": "chat", "doc_id": "x", "data": {"status": "open"}}) == "" and run("cowork-gate.py", {"tool_name": "Bash", "tool_input": {"command": "ls"}}) == "")
check("approval that only contains the letters (לבצע): denied", deny({"action": "set", "collection": "cowork_tasks", "doc_id": "x", "data": {"status": "open", "approved_by_michael": "האם לבצע?"}}))
check("update from a file (file_path) into cowork_tasks: denied", deny({"action": "update", "collection": "cowork_tasks", "doc_id": "x", "file_path": "/tmp/t.json"}))
check("update from a file into another collection: passes", ad({"action": "update", "collection": "chat", "doc_id": "x", "file_path": "/tmp/t.json"}) == "")
check("batch entry from a file (file_path) into cowork_tasks: denied", deny({"action": "batch", "writes": [{"op": "set", "collection": "cowork_tasks", "doc_id": "x", "file_path": "/tmp/t.json"}]}))
check("str_replace on cowork_tasks: denied", deny({"action": "str_replace", "collection": "cowork_tasks", "doc_id": "x", "field": "approved_by_michael", "old_str": "a", "new_str": B}))
check("str_replace on another collection: passes", ad({"action": "str_replace", "collection": "chat", "doc_id": "x", "field": "t", "old_str": "a", "new_str": "b"}) == "")
check("approval that says לא בצע: denied", deny({"action": "set", "collection": "cowork_tasks", "doc_id": "x", "data": {"status": "open", "approved_by_michael": "לא " + B}}))
# every write-capable form against cowork_tasks must be denied when it carries no approval (matrix, retro 19/10/2026)
forms = {"set": {"action": "set", "collection": "cowork_tasks", "doc_id": "x", "data": {"status": "open"}},
         "update": {"action": "update", "collection": "cowork_tasks", "doc_id": "x", "data": {"approved_by_michael": "x"}},
         "update-file": {"action": "update", "collection": "cowork_tasks", "doc_id": "x", "file_path": "/tmp/t.json"},
         "batch": {"action": "batch", "writes": [{"op": "update", "collection": "cowork_tasks", "doc_id": "x", "data": {"status": "open"}}]},
         "batch-file": {"action": "batch", "writes": [{"op": "set", "collection": "cowork_tasks", "doc_id": "x", "file_path": "/tmp/t.json"}]},
         "str_replace": {"action": "str_replace", "collection": "cowork_tasks", "doc_id": "x", "field": "status", "old_str": "blocked", "new_str": "open"}}
for name, ti in forms.items():
    check("matrix: " + name + " without approval: denied", deny(ti))
done()
