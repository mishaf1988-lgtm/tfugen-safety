#!/usr/bin/env python3
"""UserPromptSubmit: a word of a work branch in Michael's message = the branch file goes into Claude's context
(01/11/2026, Michael: "split all our work into branches, each with its rules, its documents ... so you do not forget").
The words: project-files/domains/index.json (the same list the server gives the assistant, functions/_domains.js).
Prints the branch checklist and only the lines of the branch and its rules that share words with the message
(02/11/2026, branch_text), so it is read before the first step, not after a mistake. No match = nothing.

Test:  python3 tests/harness/domains-test.py
"""
import json, os, re, sys
sys.stdout.reconfigure(encoding="utf-8")  # Windows writes cp1255; Claude Code reads UTF-8 (05/10/2026)
sys.stdin.reconfigure(encoding="utf-8")

# 02/11/2026 (Michael in the questionnaire: "do it: precise retrieval from the branch"): not the first 40 lines of the
# branch, but its checklist (the top, up to "## תיקיות") and only the lines of the branch file and of rules/<key>.md that
# hold words of this message, the best RELEVANT_MAX by how many of its words they share. The whole file stays one Read away.
RELEVANT_MAX = 12
STOP = set("את של עם על אני רוצה צריך לי זה זו יש אם גם מה כל לא כן הוא היא הם אתה תכין הכן תבדוק בדוק שלח תשלח לגבי איך למה מתי איפה אבל או רק עוד כבר שלי שלך אותו אותה אחרי לפני היום מחר אתמול".split())
PREFIX = "והבלמשכ"


def tokens(text):
    out = set()
    for w in re.findall(r"[\w\u0590-\u05ff.-]+", text.lower()):
        w = w.strip(".-")
        for _ in range(2):
            if len(w) > 3 and w[0] in PREFIX and w not in STOP:
                w2 = w[1:]
                if len(w2) >= 3:
                    out.add(w2)
                w = w2
        if len(w) >= 3 and w not in STOP:
            out.add(w)
    for w in re.findall(r"[\w\u0590-\u05ff.-]+", text.lower()):
        if len(w) >= 3 and w not in STOP:
            out.add(w)
    return out


def branch_text(root, k, v, text):
    try:
        lines = open(os.path.join(root, v["file"]), encoding="utf-8").read().split("\n")
    except Exception:
        return "ענף " + v["name"] + " (" + v["file"] + "): (הקובץ חסר)"
    cut = next((i for i, l in enumerate(lines) if l.startswith("## ") and i > 3 and "לפני שמכינים" not in l), min(len(lines), 15))
    head, rest = lines[:cut], lines[cut:]
    rules_path = "project-files/domains/rules/" + k + ".md"
    try:
        rules = open(os.path.join(root, rules_path), encoding="utf-8").read().split("\n")
    except Exception:
        rules = []
    toks = tokens(text)
    scored = []
    for src, ls in ((v["file"], rest), (rules_path, rules)):
        for l in ls:
            t = l.strip()
            if not t.startswith("- "):
                continue
            n = sum(1 for w in toks if w in t.lower())
            if n:
                scored.append((-n, len(scored), src, t))
    scored.sort()
    picked = scored[:RELEVANT_MAX]
    body = "\n".join(head).rstrip()
    if picked:
        body += "\n\nמה שקשור למשימה (" + str(len(picked)) + " מתוך " + str(len(scored)) + " שורות עם מילים מההודעה, מהתיק ומ-" + rules_path + "):\n" + "\n".join(t for _, _, _, t in picked)
    body += "\n\nהתיק המלא: " + v["file"] + " (תיקיות, טפסים, חקיקה, החלטות, לקחים); כל הכללים: " + rules_path + ". לקרוא כולו כשמכינים מסמך, או כשהשורות כאן לא עונות."
    return "ענף " + v["name"] + " (" + v["file"] + "):\n" + body


def main():
    try:
        d = json.load(sys.stdin)
    except Exception:
        print("{}"); return
    text = str(d.get("prompt") or "").lower()
    root = os.environ.get("CLAUDE_PROJECT_DIR") or d.get("cwd") or "."
    try:
        idx = json.load(open(os.path.join(root, "project-files/domains/index.json"), encoding="utf-8"))
    except Exception:
        print("{}"); return
    # 01/11/2026: with 12 branches one long message (or an agent's report) matched many and loaded 25KB. A system
    # notification is not Michael's task: nothing. Otherwise the two branches with the most word hits load their head;
    # any other match is named in one line, to read if it is relevant.
    if "system notification" in text or "<task-notification>" in text or "[subagent hand-back]" in text:
        print("{}"); return
    hits = []
    for k, v in idx.items():
        if k.startswith("_"):
            continue
        n = sum(1 for w in v.get("words", []) if w.lower() in text)
        if n:
            hits.append((-n, k, v))
    hits.sort(key=lambda x: (x[0], x[1]))
    out = []
    for i, (_, k, v) in enumerate(hits):
        if i >= 2:
            out.append("ענף נוסף שנגעו בו: " + v["name"] + " (" + v["file"] + ")")
            continue
        out.append(branch_text(root, k, v, text))
    if not out:
        print("{}"); return
    print(json.dumps({"hookSpecificOutput": {"hookEventName": "UserPromptSubmit", "additionalContext": "\n\n".join(out)}}, ensure_ascii=False))


if __name__ == "__main__":
    main()
