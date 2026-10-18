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
done()
