#!/usr/bin/env python3
"""doc-decision-check.py (31/10/2026, lesson 209): the first command that creates a factory document is denied once
with the DECISIONS headings about making documents; the same command again passes; reading a file or any other command
is left alone."""
import json, os, subprocess, sys, tempfile
from _common import hook, check, done
root = tempfile.mkdtemp(); st = tempfile.mkdtemp()
open(os.path.join(root, "DECISIONS.md"), "w", encoding="utf-8").write(
    "## 24/10/2026: מסמך חדש למערכת הניהול נבנה על התבנית המבוקרת של המפעל\nטקסט\n## 20/10/2026: משהו אחר לגמרי\n")
def run(cmd, sid="s1", r=root):
    p = subprocess.run([sys.executable, hook("doc-decision-check.py")], input=json.dumps({"tool_name": "Bash", "session_id": sid, "tool_input": {"command": cmd}}, ensure_ascii=False),
                       capture_output=True, text=True, encoding="utf-8", timeout=30, env=dict(os.environ, DOC_DECISION_ROOT=r, DOC_DECISION_STATE=st))
    return p.stdout.strip()
up = "bash project-files/routine-db.sh '{\"op\":\"od_put_pdf\",\"name\":\"x.docx\"}'"
o = run(up)
check("an upload of a document is denied once, with the decision heading", '"deny"' in o and "DECISIONS.md:1" in o and "13.07" in o, o)
check("the same command again passes", run(up) == "")
py = "python3 -c \"from docx import Document; d=Document(); d.save('a.docx')\""
check("a python-docx build is denied once too", '"deny"' in run(py), run(py))
check("reading a docx (no save) is left alone", run("python3 -c \"from docx import Document; d=Document('a.docx'); print(d.paragraphs)\"") == "")
check("another command is left alone", run("git status") == "")
check("another session is paused once again", '"deny"' in run(up, sid="s2"))
empty = tempfile.mkdtemp()
check("no DECISIONS.md or no matching heading: no stop, no crash", run(up, sid="s3", r=empty) == "")
done()
