#!/usr/bin/env python3
"""PreToolUse on Bash (31/10/2026, Michael: "how do we make sure you do not miss decisions?", lesson 209).

live-check.py stops a questionnaire that repeats a decision, but nothing stopped Claude from BUILDING a factory document
without reading the decision on how factory documents are made (DECISIONS 24/10/2026: a new document is built on the
controlled template 13.07: logo, header table, document number, "page X of Y", update date). The draft of the emergency-team
guidelines came out without the logo and the header, and Michael had to say so.

Now the first command that creates a Word, Excel, PowerPoint or PDF file (python-docx, openpyxl, python-pptx, or an
od_put_pdf upload to the safety folder) is denied once, with the DECISIONS.md headings about making documents and
the ones sharing words with the file name. The same command asked again passes: one pause, never a loop.
"""
import hashlib, json, os, re, sys, tempfile

CREATES = re.compile(r"""['\"]op['\"]\s*:\s*['\"]od_put_pdf['\"]|(?=[\s\S]*\.save\()(?=[\s\S]*(?:\bDocument\(|\bWorkbook\(|\bPresentation\())""")
# Headings that say how factory documents are made, whatever the file is called.
TOPIC = re.compile("\u05de\u05e1\u05de\u05da \u05d7\u05d3\u05e9|\u05d8\u05d5\u05e4\u05e1 \u05e7\u05d9\u05d9\u05dd|\u05d4\u05e4\u05e7\u05ea \u05de\u05e1\u05de\u05db|\u05e2\u05d9\u05e6\u05d5\u05d1 \u05de\u05e1\u05de\u05db|\u05de\u05e1\u05de\u05db\u05d9\u05dd \u05e9\u05dc \u05d4\u05de\u05e4\u05e2\u05dc|\u05d2\u05d5\u05e4\u05df")


def headings(root):
    try:
        with open(os.path.join(root, "DECISIONS.md"), encoding="utf-8") as f:
            lines = f.read().split("\n")
    except OSError:
        return []
    return [(i + 1, l[4:].strip() if l.startswith("###") else l[3:].strip()) for i, l in enumerate(lines) if l.startswith("## ") or l.startswith("### ")]


def hits(root, cmd):
    hs = headings(root)
    out = [h for h in hs if TOPIC.search(h[1])]
    name = re.findall(r"[א-ת]{4,}", cmd)
    extra = [h for h in hs if h not in out and len(set(name) & set(re.findall(r"[א-ת]{4,}", h[1]))) >= 2]
    return (out[-3:] + extra[-2:])


def main():
    try:
        d = json.load(sys.stdin)
    except Exception:
        return
    if d.get("tool_name") != "Bash":
        return
    cmd = str((d.get("tool_input") or {}).get("command") or "")
    if not CREATES.search(cmd):
        return
    root = os.environ.get("DOC_DECISION_ROOT") or os.environ.get("CLAUDE_PROJECT_DIR") or os.getcwd()
    found = hits(root, cmd)
    if not found:
        return
    key = hashlib.sha1((str(d.get("session_id") or "") + "\n" + cmd).encode("utf-8")).hexdigest()[:16]
    mark = os.path.join(os.environ.get("DOC_DECISION_STATE") or tempfile.gettempdir(), "doc-decision-" + key)
    if os.path.exists(mark):
        return
    try:
        open(mark, "w").close()
    except OSError:
        return
    why = ("doc-decision (לקח 209): עומדים ליצור מסמך. לפני שממשיכים: לקרוא את ההחלטות של אופן הפקת מסמכים ב-DECISIONS.md ("
           + "; ".join("DECISIONS.md:%d %s" % (n, t[:70]) for n, t in found)
           + "), ולבנות לפיהן (תבנית 13.07: לוגו, טבלת כותרת, מספר, \"עמוד X מתוך Y\"). אחר כך להריץ שוב את אותה פקודה: הפעם הבאה היא עוברת.")
    print(json.dumps({"hookSpecificOutput": {"hookEventName": "PreToolUse", "permissionDecision": "deny", "permissionDecisionReason": why}}, ensure_ascii=False))


if __name__ == "__main__":
    main()
