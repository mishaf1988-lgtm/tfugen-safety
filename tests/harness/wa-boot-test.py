#!/usr/bin/env python3
# tools/wa-boot.py (24/11/2026, Michael in the questionnaire: "do it: one opening command (recommended)"): the WhatsApp
# assistant's start-up in one round. The core must always come out whole; only the matching topic sections come with it,
# capped; every page fits under the Bash tool's spill limit; a missing topic file fails loudly.
import importlib.util, os, re, shutil, subprocess, sys, tempfile
sys.stdout.reconfigure(encoding="utf-8")
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
TOOL = os.path.join(ROOT, "tools", "wa-boot.py")
spec = importlib.util.spec_from_file_location("wa_boot", TOOL)
wb = importlib.util.module_from_spec(spec); spec.loader.exec_module(wb)
passed = failed = 0
def check(label, cond, detail=None):
    global passed, failed
    if cond: passed += 1; print("  ✓ " + label)
    else: failed += 1; print("  ✗ " + label + ("  -> " + repr(detail)[:300] if detail is not None else ""))

core = open(wb.CORE, encoding="utf-8").read()
STATUS = "מה המצב?"
DOC = "מה עם תעודת הכיול של המלגזה, מתי פג התוקף?"
SIGN = "תחתום בשמי על אישור הקבלן"
CAL = "תזמן פגישה עם צחי ביום שלישי על הסיור"
MAIL = "תכין טיוטת מייל לאילנה על החשבונית של רותם"
MUST = ["**אסור:**", "agent_report", "wa_me", "בעברית", "0-קצר. **מסלול קצר", "refusesWithoutFlow", "בצע", "365",
        "0-פתיחה. ", "## רק בנוהל המלא"]

def topic_ids(text):
    return re.findall(r"^--- ([\w.-]+\.md#\d+) \| ", text, re.M)

outs = {m: wb.build(m) for m in (STATUS, DOC, SIGN, CAL, MAIL, "")}
for m, t in outs.items():
    check("the whole core is in the output for %r" % m[:20], core.rstrip() in t)
    check("the must-have rules are there for %r" % m[:20], all(x in t for x in MUST), [x for x in MUST if x not in t])
    check("the last line says what was not printed, for %r" % m[:20], t.rstrip("\n").split("\n")[-1].startswith("=== wa-boot: לא הודפס ==="))

ids = topic_ids(outs[DOC])
check("a document/expiry question pulls docs.md sections", any(i.startswith("docs.md#") for i in ids), ids)
check("... and not unrelated topics (calendar, maps, meeting, privacy)", not any(i.split("#")[0] in ("calsign.md", "maps.md", "meeting.md", "privacy.md") for i in ids), ids)
check("a signature request pulls calsign.md", any(i.startswith("calsign.md#") for i in topic_ids(outs[SIGN])), topic_ids(outs[SIGN]))
check("a calendar request pulls calsign.md and no docs.md", any(i.startswith("calsign.md#") for i in topic_ids(outs[CAL])) and not any(i.startswith("docs.md#") for i in topic_ids(outs[CAL])), topic_ids(outs[CAL]))
check("a short status question pulls no topic section", topic_ids(outs[STATUS]) == [], topic_ids(outs[STATUS]))
check("a short status question adds under 1,000 characters to the core", len(outs[STATUS]) - len(core) < 1000, len(outs[STATUS]) - len(core))
for m in (DOC, SIGN, CAL, MAIL):
    t = outs[m]
    body = t.split("=== wa-boot: סעיפים מ-wa-topics", 1)[1].split("=== wa-boot: שורות מהמחברת", 1)[0]
    secs = re.split(r"^--- ", body, flags=re.M)[1:]
    check("caps for %r: at most %d sections, %d characters" % (m[:20], wb.MAX_SECTIONS, wb.TOPIC_CHARS),
          len(secs) <= wb.MAX_SECTIONS and sum(len(s.split("\n", 1)[1]) for s in secs) <= wb.TOPIC_CHARS + 200, (len(secs), len(body)))
    nb = t.split("=== wa-boot: שורות מהמחברת", 1)[1].split("=== wa-boot: לא הודפס", 1)[0]
    check("notebook lines capped for %r" % m[:20], nb.count("\n- [") <= wb.NB_LINES and len(nb) <= wb.NB_CHARS + 300, len(nb))
check("the docs question is much smaller than the core plus the whole docs.md",
      len(outs[DOC]) < len(core) + len(open(os.path.join(wb.TOPICS, "docs.md"), encoding="utf-8").read()) / 3)
check("deterministic: the same message gives the same output", wb.build(DOC) == outs[DOC])

# pages: every page under the Bash spill limit (measured: 28.5KB came back whole, 31.3KB spilled), joined they are the text
for m in (STATUS, MAIL):
    pg = wb.pages(outs[m])
    check("every page of %r fits under %d bytes" % (m[:20], wb.PAGE_BYTES), all(len(p.encode()) <= wb.PAGE_BYTES - 150 for p in pg), [len(p.encode()) for p in pg])
    check("the pages joined are the whole text (%r)" % m[:20], "".join(pg) == outs[m])
    check("at most 4 pages, so the four parallel calls cover it (%r)" % m[:20], len(pg) <= 4, len(pg))
long = ("א" * 60 + " ") * 1200 + "\nסוף\n"
check("a line longer than a page is cut at a space and nothing is lost", "".join(wb.pages(long)) == long and all(len(p.encode()) <= wb.PAGE_BYTES for p in wb.pages(long)))

def run(*args, stdin=""):
    return subprocess.run([sys.executable, TOOL] + list(args), input=stdin, capture_output=True, text=True, cwd=ROOT)
r1, r4 = run("--page", "1", stdin=DOC), run("--page", "9", stdin=DOC)
check("--page 1 from stdin prints the header and the core start", r1.returncode == 0 and r1.stdout.startswith("[wa-boot עמוד 1/") and "# Routine: העוזר בוואטסאפ" in r1.stdout, r1.stderr)
check("a page past the end says so in one line", r4.returncode == 0 and "אין עמוד 9" in r4.stdout and len(r4.stdout) < 100, r4.stdout)
allp = "".join(run("--page", str(i), stdin=DOC).stdout for i in (1, 2, 3, 4))
check("pages 1-4 together carry the whole core", all(x in allp for x in ("0-פתיחה. ", "**אסור:**", "## רק בנוהל המלא")))
rt = run("--topics-only", "--all", DOC)
check("--topics-only leaves the core out and keeps the sections", "**אסור:**" not in rt.stdout and topic_ids(rt.stdout) == ids, topic_ids(rt.stdout))
sid = ids[0] if ids else "docs.md#1"
rs = run("--section", sid)
check("--section prints one section by its id", rs.returncode == 0 and rs.stdout.startswith("--- " + sid + " | "), rs.stdout[:80])
check("--section with a bad id exits 2", run("--section", "docs.md#9999").returncode == 2)
check("the sections of a topic file cover it (no rule lost by the split)",
      all(len("".join(t for _, _, t in wb.sections(f, wb.read_topic(f)))) >= 0.97 * len(wb.read_topic(f)) - 400 for f in wb.ROUTES))

# a missing topic file fails loudly, and a new topic file with no route too
tmp = tempfile.mkdtemp()
try:
    for f in os.listdir(wb.TOPICS):
        shutil.copy(os.path.join(wb.TOPICS, f), tmp)
    real = wb.TOPICS
    wb.TOPICS = tmp
    os.remove(os.path.join(tmp, "docs.md"))
    try:
        wb.build(DOC); err = None
    except wb.BootError as e:
        err = str(e)
    check("a missing topic file is an error that names it", err is not None and "docs.md" in err, err)
    shutil.copy(os.path.join(real, "docs.md"), tmp)
    open(os.path.join(tmp, "new.md"), "w", encoding="utf-8").write("# x\n- **y** z\n")
    try:
        wb.build(DOC); err = None
    except wb.BootError as e:
        err = str(e)
    check("a topic file with no route is an error that names it", err is not None and "new.md" in err, err)
    wb.TOPICS = real
finally:
    shutil.rmtree(tmp)
env = dict(os.environ)
r = subprocess.run([sys.executable, "-c", "import importlib.util,sys;s=importlib.util.spec_from_file_location('w',sys.argv[1]);w=importlib.util.module_from_spec(s);s.loader.exec_module(w);w.ROUTES['gone.md']=[];sys.exit(w.main(['--all','x']))", TOOL], capture_output=True, text=True)
check("the script exits 2 with a message on a missing topic file", r.returncode == 2 and "gone.md" in r.stderr, (r.returncode, r.stderr))
print("\n%d passed, %d failed" % (passed, failed))
sys.exit(1 if failed else 0)
