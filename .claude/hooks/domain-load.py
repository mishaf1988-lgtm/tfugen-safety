#!/usr/bin/env python3
"""UserPromptSubmit: a word of a work branch in Michael's message = the branch file goes into Claude's context
(01/11/2026, Michael: "split all our work into branches, each with its rules, its documents ... so you do not forget").
The words: project-files/domains/index.json (the same list the server gives the assistant, functions/_domains.js).
Prints the branch checklist and only the lines of the branch and its rules that share words with the message
(02/11/2026, branch_text), so it is read before the first step, not after a mistake. No match = nothing.

Test:  python3 tests/harness/domains-test.py
"""
import json, os, re, sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "tools"))
import domain_match as dm  # tools/domain_match.py: the branch match, typo tolerance and BM25 (02/11/2026)
sys.stdout.reconfigure(encoding="utf-8")  # Windows writes cp1255; Claude Code reads UTF-8 (05/10/2026)
sys.stdin.reconfigure(encoding="utf-8")

# 02/11/2026 (Michael in the questionnaire: "do it: precise retrieval from the branch"): not the first 40 lines of the
# branch, but its checklist (the top, up to "## תיקיות") and only the lines of the branch file and of rules/<key>.md that
# hold words of this message, the best RELEVANT_MAX by how many of its words they share. The whole file stays one Read away.
RELEVANT_MAX = 12


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
    toks = dm.tokens(text)
    cand = [(src, l.strip()) for src, ls in ((v["file"], rest), (rules_path, rules)) for l in ls if l.strip().startswith("- ")]
    # 02/11/2026 (Michael: "do it: smart ranking and spelling mistakes"): BM25, a rare word weighs more, one letter off still counts
    scored = [(-sc, i, cand[i][0], t) for sc, i, t in dm.rank([t for _, t in cand], toks)]
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
    hits = [(-n, k, v) for k, v, n in dm.branches(text, idx)]
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
