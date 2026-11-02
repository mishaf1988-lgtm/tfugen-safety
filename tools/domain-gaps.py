#!/usr/bin/env python3
"""Michael's requests that reached no work branch, and what a new word would do (02/11/2026, Michael in the
questionnaire: "do it: words that learn by themselves"). Run weekly by the retro (retro-prompt.md 7c):

  bash project-files/routine-db.sh '{"op":"wa_review"}' > /tmp/wa.json
  python3 tools/domain-gaps.py /tmp/wa.json                      # the share per branch and the requests with no branch
  python3 tools/domain-gaps.py /tmp/wa.json mail=מייל iso=טופס   # the same with candidate words added (nothing written)

Only Michael's own requests: more than 30 characters (not a button), not a test ("[..." at the start). The match is
the server's (functions/_domains.js, tools/domain_match.py): a branch word anywhere in the lower-cased text, or one letter off. Exit 3 when a candidate word
adds requests to a branch that then loads on more than MAX_SHARE of them (a word that is too common), else 0.
"""
import json, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import domain_match as dm  # the same match as the hook and the server, with one-letter typos (02/11/2026)

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MAX_SHARE = 0.4
MIN_LEN = 30


def requests(rows):
    return [str(r.get("text") or "").lower() for r in rows
            if r.get("who") == "michael" and len(str(r.get("text") or "")) > MIN_LEN and not str(r.get("text") or "").startswith("[")]


def report(texts, idx, extra):
    ix = {k: dict(v, words=list(v["words"]) + [w for kk, w in extra if kk == k]) for k, v in idx.items() if not k.startswith("_")}
    hit = {k: 0 for k in ix}
    none = []
    for t in texts:
        bs = dm.branches(t, ix)
        for k, _, _ in bs:
            hit[k] += 1
        if not bs:
            none.append(t)
    return hit, none


def main(argv):
    if len(argv) < 2:
        print(__doc__); return 2
    idx = json.load(open(os.path.join(ROOT, "project-files/domains/index.json"), encoding="utf-8"))
    data = json.load(open(argv[1], encoding="utf-8"))
    texts = requests(data.get("rows") or [])
    extra = []
    for a in argv[2:]:
        k, _, w = a.partition("=")
        if k not in idx or k.startswith("_") or not w.strip():
            print("unknown branch or empty word: " + a); return 2
        extra.append((k, w.strip()))
    n = len(texts) or 1
    hits, none = report(texts, idx, extra)
    print("requests: %d, with no branch: %d (%d%%)" % (len(texts), len(none), round(100 * len(none) / n)))
    for k, h in sorted(hits.items(), key=lambda x: -x[1]):
        print("  %-10s %3d (%d%%)%s" % (k, h, round(100 * h / n), "  TOO COMMON" if h / n > MAX_SHARE else ""))
    print("no branch:")
    for t in none:
        print("  - " + t.replace("\n", " / ")[:160])
    base, _ = report(texts, idx, [])
    grew = [k for k, _ in extra if hits[k] > base[k] and hits[k] / n > MAX_SHARE]
    if grew:
        print("too common: " + ", ".join(sorted(set(grew))) + " would load on more than %d%% of the requests" % round(100 * MAX_SHARE))
    return 3 if grew else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
