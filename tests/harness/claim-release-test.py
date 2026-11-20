# Release on merge (.claude/hooks/claim-release-on-merge.py, 20/11/2026): which of this session's claims a merge ends.
import importlib.util, json, os, sys
from datetime import datetime
sys.stdout.reconfigure(encoding="utf-8")
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..")
spec = importlib.util.spec_from_file_location("cr", os.path.join(ROOT, ".claude", "hooks", "claim-release-on-merge.py"))
cr = importlib.util.module_from_spec(spec); spec.loader.exec_module(cr)
passed = failed = 0
def check(label, cond, detail=None):
    global passed, failed
    if cond: passed += 1; print("  ✓ " + label)
    else: failed += 1; print("  ✗ " + label + ("  -> " + str(detail) if detail is not None else ""))

T = lambda s: datetime.fromisoformat(s + "+00:00")
ME, OTHER, BR = "session_me12345", "session_other99", "routine/folder-audit-22-open-2026-11-20"
fork, first = T("2026-11-20T13:08:00"), T("2026-11-20T13:25:00")
claims = {
    "status-md": {"session": ME, "at": "2026-11-20T13:30:00Z", "note": BR},
    "folder-audit-22-open": {"session": ME, "at": "2026-11-20T13:10:44Z", "note": "x"},
    "claim-auto-release": {"session": ME, "at": "2026-11-20T13:37:45Z", "note": "the next task"},
    "older": {"session": ME, "at": "2026-11-20T11:00:00Z", "note": "an earlier task"},
    "deck-videos": {"session": OTHER, "at": "2026-11-20T13:10:00Z", "note": "another session"},
}
got = cr.to_release(claims, ME, BR, fork, first)
check("the queue held for this branch is released", "status-md" in got, got)
check("the item claimed while this branch was open is released", "folder-audit-22-open" in got, got)
check("a claim taken after the branch's first commit (the next task) is kept", "claim-auto-release" not in got, got)
check("a claim from long before the branch is kept", "older" not in got, got)
check("another session's claim is never touched", "deck-videos" not in got, got)
other_q = dict(claims); other_q["status-md"] = {"session": ME, "at": "2026-11-20T13:30:00Z", "note": "routine/another-branch"}
check("the queue held for another branch of this session is kept", "status-md" not in cr.to_release(other_q, ME, BR, fork, first))
check("on main nothing is released", cr.to_release(claims, ME, "main", fork, first) == [])
check("no session id: nothing is released", cr.to_release(claims, "", BR, fork, first) == [])
check("no own commit yet: only the queue is released", cr.to_release(claims, ME, BR, fork, None) == ["status-md"])
check("a merged answer is recognised", cr.merged({"tool_response": {"merged": True, "sha": "x"}}) and cr.merged({"tool_response": '{"sha":"x","merged":true}'}))
check("a failed merge is not", not cr.merged({"tool_response": {"merged": False}}) and not cr.merged({"tool_response": "error"}))
s = json.load(open(os.path.join(ROOT, ".claude", "settings.json"), encoding="utf-8"))
hooked = any(h.get("matcher") == "mcp__github__merge_pull_request" and any("claim-release-on-merge.py" in x.get("command", "") for x in h.get("hooks", []))
             for h in s.get("hooks", {}).get("PostToolUse", []))
check("settings.json runs the hook after every merge", hooked)
print("%d passed, %d failed" % (passed, failed))
sys.exit(1 if failed else 0)
