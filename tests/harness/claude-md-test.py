# CLAUDE.md is a short core of rules (27/10/2026, Michael in the questionnaire: "בצע: כמו בתוכנית").
# The detail moved to project-files/CLAUDE-detail.md and to path-scoped rules in .claude/rules/.
# This keeps it from growing back to 24KB, and keeps every rule file loadable.
import os, re, glob, sys
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..")
fails = 0
passed = 0
def check(name, cond, info=""):
    global fails, passed
    passed += 1 if cond else 0
    print(("PASS " if cond else "FAIL ") + name + ("" if cond else "  " + str(info)))
    fails += 0 if cond else 1
cm = open(os.path.join(ROOT, "CLAUDE.md"), encoding="utf-8").read()
check("CLAUDE.md stays a short core (under 9KB, under 80 lines)", len(cm.encode("utf-8")) < 9000 and cm.count("\n") < 80, (len(cm.encode("utf-8")), cm.count("\n")))
core = re.findall(r"^\d+\. \*\*", cm, re.M)
check("the core has 10 numbered rules", len(core) == 10, len(core))
for ref in ("project-files/CLAUDE-detail.md", ".claude/rules/", "project-files/security-review.md", "tfugen-sessions", "claim.sh"):
    check("CLAUDE.md points to " + ref, ref in cm)
check("the detail file exists", os.path.exists(os.path.join(ROOT, "project-files", "CLAUDE-detail.md")))
rules = glob.glob(os.path.join(ROOT, ".claude", "rules", "*.md"))
check("there are rule files", len(rules) >= 4, rules)
for f in rules:
    t = open(f, encoding="utf-8").read()
    m = re.match(r"---\npaths:\n((?:  - \"[^\"]+\"\n)+)---\n", t)
    check(os.path.basename(f) + ": paths frontmatter (a rule without paths loads at start and saves nothing)", bool(m), t[:120])
    if m:
        for g in re.findall(r"\"([^\"]+)\"", m.group(1)):
            hit = glob.glob(os.path.join(ROOT, g), recursive=True)
            check(os.path.basename(f) + ": " + g + " matches a file", bool(hit))
print("\n%d passed, %d failed" % (passed, fails)); sys.exit(1 if fails else 0)
