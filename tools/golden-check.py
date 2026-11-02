#!/usr/bin/env python3
"""Judges the assistant's answers to the golden questions (02/11/2026, Michael in the questionnaire: "do it: golden
questions for the assistant", the idea of agent-regress / Promptfoo on GitHub). Deterministic, no model.

  python3 tools/golden-check.py answers.json    # {"g1": "<the answer>", ...}; a missing answer fails

Each question in project-files/assistant-golden.json: every list in "any" needs one of its phrases, no "none" regex
may match, and the answer is at most "max" characters, with no long dash anywhere. Prints one line per question and
'זהב: <passed>/<all>'; exit 1 when any failed.
"""
import json, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def judge(q, a):
    a = str(a or "")
    why = []
    if not a.strip():
        return ["no answer"]
    for grp in q.get("any", []):
        if not any(p.lower() in a.lower() for p in grp):
            why.append("missing one of: " + " / ".join(grp))
    for rx in q.get("none", []):
        if re.search(rx, a):
            why.append("must not: " + rx)
    if len(a) > int(q.get("max", 400)):
        why.append("too long: %d > %s" % (len(a), q.get("max", 400)))
    if "—" in a:
        why.append("long dash")
    return why


def main(argv):
    if len(argv) < 2:
        print(__doc__); return 2
    gold = json.load(open(os.path.join(ROOT, "project-files/assistant-golden.json"), encoding="utf-8"))["questions"]
    ans = json.load(open(argv[1], encoding="utf-8"))
    ok = 0
    for q in gold:
        why = judge(q, ans.get(q["id"]))
        ok += not why
        print("%s %s %s" % ("PASS" if not why else "FAIL", q["id"], "; ".join(why)))
    print("זהב: %d/%d" % (ok, len(gold)))
    return 0 if ok == len(gold) else 1


if __name__ == "__main__":
    sys.exit(main(sys.argv))
