#!/usr/bin/env python3
"""Judges the assistant's answers to the golden questions (02/11/2026, Michael in the questionnaire: "do it: golden
questions for the assistant", the idea of agent-regress / Promptfoo on GitHub). Deterministic, no model.

  python3 tools/golden-check.py answers.json    # {"g1": "<the answer>", ...}; a missing answer fails

Each question in project-files/assistant-golden.json: every list in "any" needs one of its phrases, no "none" regex
may match, and the answer is at most "max" characters, with no long dash anywhere.
Hebrew judge (02/11/2026, Michael in the questionnaire: "do it: a Hebrew judge for the golden questions", the idea of
algotouch/hebrew-agent-eval on GitHub; no model, since an API judge needs the API credit Michael declined): every answer
also passes hebrew_style: mostly Hebrew letters, no English word outside STYLE_LATIN_OK, dates DD/MM/YYYY, no internal ids
(trig_, session_, cse_, dev-), no Markdown headings or double stars. Prints one line per question, 'עברית: <passed>/<all>'
and 'זהב: <passed>/<all>'; exit 1 when any failed.
"""
import json, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


# English that belongs in a Hebrew answer: units, standards, product names, form codes
STYLE_LATIN_OK = {"ppm", "iso", "pdf", "word", "excel", "onedrive", "outlook", "whatsapp", "teams", "sds", "msds", "ppe",
                  "loto", "nh3", "co2", "ohsas", "lel", "mg", "kg", "bar", "psi", "id", "ok", "ncr", "capa", "ptw"}
HEB = re.compile(r"[\u05d0-\u05ea]")
LAT_WORD = re.compile(r"(?<![A-Za-z0-9_])[A-Za-z]{3,}(?![A-Za-z0-9_])")


def hebrew_style(a):
    a = str(a or "")
    why = []
    heb = len(HEB.findall(a))
    lat = sum(len(w) for w in re.findall(r"[A-Za-z]+", a) if w.lower() not in STYLE_LATIN_OK)
    if heb + lat and heb < 0.7 * (heb + lat):
        why.append("not mostly Hebrew (%d Hebrew, %d Latin letters)" % (heb, lat))
    eng = sorted({w for w in LAT_WORD.findall(a) if w.lower() not in STYLE_LATIN_OK})
    if eng:
        why.append("English words: " + ", ".join(eng[:5]))
    if re.search(r"(?<!\d)\d{4}-\d{2}-\d{2}(?!\d)", a) or re.search(r"(?<![\d/])\d{1,2}/\d{1,2}/\d{2}(?![\d])", a):
        why.append("date not DD/MM/YYYY")
    if re.search(r"(trig_|session_|cse_)[A-Za-z0-9]|\bdev-\d{8}", a):
        why.append("internal id")
    if re.search(r"(^|\n)\s*#{1,6}\s|\*\*", a):
        why.append("Markdown (## or **)")
    return why


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
    why += ["עברית: " + w for w in hebrew_style(a)]
    return why


def main(argv):
    if len(argv) < 2:
        print(__doc__); return 2
    gold = json.load(open(os.path.join(ROOT, "project-files/assistant-golden.json"), encoding="utf-8"))["questions"]
    ans = json.load(open(argv[1], encoding="utf-8"))
    ok = heb_ok = 0
    for q in gold:
        why = judge(q, ans.get(q["id"]))
        ok += not why
        heb_ok += bool(str(ans.get(q["id"]) or "").strip()) and not hebrew_style(ans.get(q["id"]))
        print("%s %s %s" % ("PASS" if not why else "FAIL", q["id"], "; ".join(why)))
    print("עברית: %d/%d" % (heb_ok, len(gold)))
    print("זהב: %d/%d" % (ok, len(gold)))
    return 0 if ok == len(gold) else 1


if __name__ == "__main__":
    sys.exit(main(sys.argv))
