#!/usr/bin/env python3
"""Self-correcting memory (07/11/2026, Michael in the questionnaire: "do it: build now", after the
Awesome Harness Engineering list / LangChain OpenWiki): every instruction Claude or the assistant reads
(skills, the assistant's core and topics, the domain rules, CLAUDE.md) that points at code, a file path
or a function name in backticks, is checked against the repo. A pointer whose target is gone is a
claim that may no longer be true, and is printed so it gets fixed or removed.

usage: python3 tools/stale-refs.py [--json]   exit 1 when a pointer is stale
CI: tests/harness/stale-refs-test.py, so removing or renaming code that an instruction names fails the PR
until the instruction is fixed in the same PR.
"""
import glob, json, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DOCS = [".claude/skills/**/*.md", "CLAUDE.md", "project-files/routine-wa-*.md", "project-files/wa-topics/*.md",
        "project-files/domains/**/*.md", "project-files/agent-common.md", "project-files/CLAUDE-detail.md"]
CODE = ["functions/**/*.js", "index.html", "chat/**/*.html", "tools/**/*", ".claude/hooks/**/*", "project-files/*.sh",
        "project-files/*.txt", "tests/**/*", "supabase/**/*.sql", ".github/**/*.yml", "*.js", "*.mjs"]
PATH_RE = re.compile(r"^(?:functions|tools|project-files|tests|\.claude|supabase|chat|\.github)/[\w./@-]+\.[a-z]{1,5}$")
# camelCase names that look like code (lower start, one capital inside), e.g. weekendHold, savedFresh
FN_RE = re.compile(r"^[a-z][a-z0-9]*[A-Z][A-Za-z0-9]*(?:\(\))?$")
BARE_RE = re.compile(r"^[\w.-]+\.(?:py|js|mjs|sh)$")
OP_RE = re.compile(r'"op"\s*:\s*"([\w-]+)"')
# Skills copied from outside (Superpowers, 07/11/2026): their examples name code of other projects.
EXTERNAL_SKILLS = ("systematic-debugging", "test-driven-development", "receiving-code-review")
# Names that are not ours: fields of outside APIs and placeholders. Each with why; a new one is added here on purpose.
NOT_OURS = {
    "afterDateTime": "Microsoft Graph filter field", "sentDateTime": "Microsoft Graph mail field",
    "isOrganizer": "Microsoft Graph event field", "convertFromUtc": "Power Automate expression",
    "firstRow": "PowerPoint table option (python-pptx)", "bandRow": "PowerPoint table option (python-pptx)",
    "editXxx": "placeholder", "svXxx": "placeholder", "sgNd": "placeholder for sg1d..sg4d (ptw columns)",
    "notDone": "a field of the worker report in tfugen-orchestrate itself",
    # files that live outside this repo on purpose
    "assistant-reads-test.py": "in the michael-skills repo", "account-skill-test.py": "in the michael-skills repo",
    "00_build_committee_deck.py": "written to Michael's disk by safety-committee-builder, not kept here",
    "copy.py": "lesson 150: the point is that such a file must NOT exist",
}


def files(globs):
    out = set()
    for g in globs:
        out.update(p for p in glob.glob(os.path.join(ROOT, g), recursive=True) if os.path.isfile(p))
    return sorted(out)


def code_text():
    parts = []
    for p in files(CODE):
        if os.path.basename(p) in ("stale-refs.py", "stale-refs-test.py"):
            continue  # the names this checker and its test mention must not count as code
        try:
            parts.append(open(p, encoding="utf-8", errors="ignore").read())
        except OSError:
            pass
    return "\n".join(parts)


def scan():
    words = set(re.findall(r"[A-Za-z_$][A-Za-z0-9_$]*", code_text()))
    rdb = os.path.join(ROOT, "functions", "api", "routine-db.js")
    ops = set(re.findall(r"\bop === '([A-Za-z0-9_-]+)'", open(rdb, encoding="utf-8").read())) if os.path.exists(rdb) else set()
    names = set()
    for dp, dn, fn in os.walk(ROOT):
        if "/.git/" in dp + "/" or "node_modules" in dp:
            continue
        names.update(fn)
    found = []
    for p in files(DOCS):
        rel = os.path.relpath(p, ROOT)
        if any("/skills/%s/" % e in p for e in EXTERNAL_SKILLS):
            continue
        for n, line in enumerate(open(p, encoding="utf-8", errors="ignore"), 1):
            for span in re.findall(r"`([^`\n]{2,120})`", line):
                s = span.strip()
                s = re.sub(r":\d+(?:-\d+)?$", "", s)  # file.js:120
                if PATH_RE.match(s):
                    if "*" not in s and not os.path.exists(os.path.join(ROOT, s)):
                        found.append((rel, n, "file", s))
                elif BARE_RE.match(s):
                    if s not in names and s not in NOT_OURS:
                        found.append((rel, n, "file", s))
                elif FN_RE.match(s):
                    name = s.rstrip("()")
                    if name not in NOT_OURS and name not in words:
                        found.append((rel, n, "name", name))
                for op in OP_RE.findall(s):
                    if ops and op not in ops:
                        found.append((rel, n, "op", op))
    return found


def main():
    found = scan()
    if "--json" in sys.argv:
        print(json.dumps({"stale": [list(f) for f in found]}, ensure_ascii=False))
    else:
        for f in found:
            print("%s:%d: %s `%s` not found in the repo" % f)
        print("stale-refs: %d stale" % len(found))
    return 1 if found else 0


if __name__ == "__main__":
    sys.exit(main())
