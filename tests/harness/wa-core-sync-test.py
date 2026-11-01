#!/usr/bin/env python3
# The WhatsApp assistant runs on the short core (project-files/routine-wa-core.md, split 30/10/2026 for speed and cost)
# plus project-files/wa-topics/*.md. The full procedure (routine-wa-assistant.md) kept getting rules the core lacked
# (od_swap and flow 10, the tools rule 0ב4, the work-branch line, "saved", docMarks). This test fails when the full
# procedure names a routine-db op or a server gate that neither the core nor any topic file mentions, unless it is listed
# in FULL_ONLY with the reason the assistant does not need it on an ordinary WhatsApp message.
import glob, os, re, sys
sys.stdout.reconfigure(encoding="utf-8")
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
passed = failed = 0
def check(label, cond, detail=None):
    global passed, failed
    if cond: passed += 1; print("  ✓ " + label)
    else: failed += 1; print("  ✗ " + label + ("  -> " + str(detail)[:300] if detail is not None else ""))
def read(rel): return open(os.path.join(ROOT, rel), encoding="utf-8").read()

FULL_SECTION = "## רק בנוהל המלא"
# Names the full procedure mentions that the assistant does not use on a WhatsApp message. Each needs a reason.
# Do not add a name here to hide a real gap: add the rule to the core or to a wa-topics file instead.
FULL_ONLY = {
}

full = read("project-files/routine-wa-assistant.md")
core = read("project-files/routine-wa-core.md")
topics = {os.path.relpath(p, ROOT): open(p, encoding="utf-8").read() for p in sorted(glob.glob(os.path.join(ROOT, "project-files/wa-topics/*.md")))}
covered = core + "\n" + "\n".join(topics.values())

# The routine-db ops, from the server itself.
rdb = read("functions/api/routine-db.js")
ops = set(re.findall(r"\bop === '([A-Za-z0-9_-]+)'", rdb))
# Server functions (gates such as claimGate, refusesWithoutFlow, savedFresh): camelCase names declared in functions/.
src = ""
for p in glob.glob(os.path.join(ROOT, "functions/**/*.js"), recursive=True):
    src += open(p, encoding="utf-8").read() + "\n"
funcs = set(re.findall(r"\bfunction\s+([a-z][a-z0-9]*[A-Z][A-Za-z0-9]*)", src))
funcs |= set(re.findall(r"\b(?:const|let)\s+([a-z][a-z0-9]*[A-Z][A-Za-z0-9]*)\s*=\s*(?:async\s*)?(?:\(|function|[a-z_]+\s*=>)", src))
check("found the routine-db ops in the server (sanity)", len(ops) >= 40, len(ops))
check("found the server functions (sanity)", len(funcs) >= 40, len(funcs))

names = set()
for span in re.findall(r"`([^`\n]+)`", full):
    names.update(n for n in re.findall(r'"op"\s*:\s*"([\w-]+)"', span) if n in ops)
    if re.fullmatch(r"[A-Za-z_][\w-]*", span) and (span in ops or span in funcs): names.add(span)
check("the full procedure names ops and gates (sanity)", len(names) >= 30, sorted(names))

def mentioned(name, text): return re.search(r"(?<![\w-])" + re.escape(name) + r"(?![\w-])", text) is not None
for n in sorted(names):
    if n in FULL_ONLY: continue
    where = [f for f, t in topics.items() if mentioned(n, t)] + (["core"] if mentioned(n, core) else [])
    check("`" + n + "` is in the core or a wa-topics file", bool(where), "add a short line with a pointer, or FULL_ONLY with a reason")
for n, why in FULL_ONLY.items():
    check("FULL_ONLY `" + n + "` has a reason", bool(why.strip()))
    check("FULL_ONLY `" + n + "` is still in the full procedure", mentioned(n, full), "remove it from FULL_ONLY")
    check("FULL_ONLY `" + n + "` is really missing from the core and topics", not mentioned(n, covered), "remove it from FULL_ONLY")

# Rules that must be in the core itself (they apply to every message).
check("the core has the work-branch rule (domains/)", "domains/" in core)
check("the core has the tools rule (refusesWithoutFlow)", "refusesWithoutFlow" in core)
check("the core has the section " + FULL_SECTION, FULL_SECTION in core)
sec = core.split(FULL_SECTION, 1)[1] if FULL_SECTION in core else ""
check("the section lists at least one rule with where to read it", re.search(r"^- .*routine-wa-assistant|^- .*סעיף", sec, re.M) is not None or "routine-wa-assistant.md" in sec)
# Every topic file the core routes to exists.
for rel in sorted(set(re.findall(r"project-files/wa-topics/[\w-]+\.md", core))):
    check("the core points to an existing " + rel, os.path.exists(os.path.join(ROOT, rel)))
# The rule numbers the core points to in the topic files exist there.
docs = topics.get(os.path.join("project-files", "wa-topics", "docs.md"), "")
for num in ["0ב.", "0ב1.", "0ב2.", "0ב3.", "0ב5."]:
    check("wa-topics/docs.md has rule " + num, re.search(r"^" + re.escape(num) + r" ", docs, re.M) is not None)
for rel, t in [("project-files/routine-wa-core.md", core)] + list(topics.items()):
    check(rel + ": no long dash", "\u2014" not in t)

print("\n%d passed, %d failed" % (passed, failed))
sys.exit(1 if failed else 0)
