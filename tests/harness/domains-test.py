#!/usr/bin/env python3
# The work branches (01/11/2026, Michael: "split all our work into branches ... for you and for the assistant").
# One word list (project-files/domains/index.json) feeds Claude's hook and the assistant's fire text; each branch
# file is one page with the document checklist on top, its controlled forms and its laws.
import importlib.util, json, os, subprocess, sys
sys.stdout.reconfigure(encoding="utf-8")
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
passed = failed = 0
def check(label, cond, detail=None):
    global passed, failed
    if cond: passed += 1; print("  ✓ " + label)
    else: failed += 1; print("  ✗ " + label + ("  -> " + str(detail)[:300] if detail is not None else ""))
idx = json.load(open(os.path.join(ROOT, "project-files/domains/index.json"), encoding="utf-8"))
doms = {k: v for k, v in idx.items() if not k.startswith("_")}
spec = importlib.util.spec_from_file_location("db", os.path.join(ROOT, "tools/domains-build.py")); db = importlib.util.module_from_spec(spec); spec.loader.exec_module(db)
check("functions/_domains.js is the build of index.json (run python3 tools/domains-build.py)", open(os.path.join(ROOT, "functions/_domains.js"), encoding="utf-8").read() == db.build())
for k, v in doms.items():
    p = os.path.join(ROOT, v["file"])
    ok = os.path.exists(p)
    check(k + ": the branch file exists", ok, v["file"])
    if not ok: continue
    lines = open(p, encoding="utf-8").read().splitlines()
    txt = "\n".join(lines)
    check(k + ": one page (at most 80 lines)", len(lines) <= 80, len(lines))
    check(k + ": the document checklist is in the first 15 lines", any("לפני שמכינים" in l for l in lines[:15]))
    for sec in ["טפסים מבוקרים", "חקיקה", "החלטות", "תיקיות"]:
        check(k + ": has a section " + sec, ("## " + sec) in txt)
    check(k + ": no long dash", "—" not in txt)
def hook(prompt):
    r = subprocess.run([sys.executable, os.path.join(ROOT, ".claude/hooks/domain-load.py")], input=json.dumps({"prompt": prompt, "cwd": ROOT}), capture_output=True, text=True, env=dict(os.environ, CLAUDE_PROJECT_DIR=ROOT), timeout=20)
    return json.loads(r.stdout or "{}")
h = hook("תכין טופס 08.01 להדרכה")
ctx = (h.get("hookSpecificOutput") or {}).get("additionalContext", "")
check("hook: 08.01 loads the training branch with its checklist", "training.md" in ctx and "לפני שמכינים" in ctx, ctx[:200])
check("hook: work at height and a risk survey load both branches", all(x in str(hook("עבודה בגובה בסקר סיכונים")) for x in ["height.md", "risk.md"]))
check("hook: an unrelated message loads nothing", hook("מה שלומך?") == {})
s = json.load(open(os.path.join(ROOT, ".claude/settings.json"), encoding="utf-8"))
check("settings: the hook runs on every message", any("domain-load.py" in x.get("command", "") for e in s["hooks"]["UserPromptSubmit"] for x in e["hooks"]))
for f in ["functions/api/wa-hook.js", "functions/api/chat.js"]:
    check(f + ": the assistant gets the branch line (domainLine)", "domainLine(" in open(os.path.join(ROOT, f), encoding="utf-8").read())
a = open(os.path.join(ROOT, "project-files/routine-wa-assistant.md"), encoding="utf-8").read()
check("the assistant's procedure says to read the branch file on a domain line", "project-files/domains/" in a)
# 01/11/2026: at most two branch heads per message, and nothing on an agent's report or a system notification
many = hook("\u05ea\u05d0\u05d5\u05e0\u05d4 \u05d1\u05d7\u05d9\u05e8\u05d5\u05dd \u05e2\u05dd \u05d0\u05de\u05d5\u05e0\u05d9\u05d4 \u05d5\u05e0\u05d0\u05de\u05df \u05d5\u05ea\u05d7\u05e7\u05d9\u05e8 \u05d5\u05e2\u05d3\u05ea \u05d1\u05d8\u05d9\u05d7\u05d5\u05ea")
mctx = (many.get("hookSpecificOutput") or {}).get("additionalContext", "")
check("hook: a message that touches many branches loads two heads and names the rest", mctx.count("\u05dc\u05e4\u05e0\u05d9 \u05e9\u05de\u05db\u05d9\u05e0\u05d9\u05dd") == 2 and len(mctx) < 16000, len(mctx))
check("hook: a system notification or an agent's report loads nothing", hook("<task-notification> \u05ea\u05d0\u05d5\u05e0\u05d4") == {} and hook("[Subagent hand-back] \u05ea\u05d0\u05d5\u05e0\u05d4") == {})
# 01/11/2026 (Michael: every rule in its branch): every decision in DECISIONS.md is mapped to a branch or to general
keys = set(doms) | {"general"}
mp = {}
for ln in open(os.path.join(ROOT, "project-files/domains/decisions-map.tsv"), encoding="utf-8"):
    parts = ln.rstrip("\n").split("\t")
    if len(parts) == 3: mp[parts[1].strip()] = parts[2].strip()
heads = [l[3:].strip() for l in open(os.path.join(ROOT, "DECISIONS.md"), encoding="utf-8") if l.startswith("## ")]
unmapped = [h for h in heads if h not in mp]
check("every decision in DECISIONS.md has a branch in decisions-map.tsv (a new decision adds a line: <line>\\t<heading>\\t<key>)", not unmapped, unmapped[:5])
check("decisions-map.tsv uses only real branch keys or general", all(v in keys for v in mp.values()), sorted(set(mp.values()) - keys))
for k, v in doms.items():
    rp = os.path.join(ROOT, "project-files/domains/rules/" + k + ".md")
    check(k + ": has rules/" + k + ".md and its branch file points to it in step 0", os.path.exists(rp) and ("domains/rules/" + k + ".md") in open(os.path.join(ROOT, v["file"]), encoding="utf-8").read())
# 02/11/2026 (Michael: "do it: precise retrieval from the branch"): the hook gives the checklist and only the lines that
# share words with the message, not the whole branch and its rules
pr = hook("\u05ea\u05db\u05d9\u05df \u05d8\u05d5\u05e4\u05e1 \u05d4\u05e8\u05e9\u05d0\u05ea \u05e2\u05d1\u05d5\u05d3\u05d4 \u05dc\u05e7\u05d1\u05dc\u05df \u05e9\u05e2\u05d5\u05d1\u05d3 \u05d1\u05d2\u05d5\u05d1\u05d4")
pctx = (pr.get("hookSpecificOutput") or {}).get("additionalContext", "")
full = "".join(open(os.path.join(ROOT, "project-files/domains/" + f), encoding="utf-8").read() for k in ("height", "iso") for f in (k + ".md", "rules/" + k + ".md"))  # "\u05d8\u05d5\u05e4\u05e1" loads ISO too
check("hook: precise retrieval, the checklist plus the related lines (146.03 for a contractor), shorter than the branch and its rules", "\u05dc\u05e4\u05e0\u05d9 \u05e9\u05de\u05db\u05d9\u05e0\u05d9\u05dd" in pctx and "146.03" in pctx and "\u05de\u05d4 \u05e9\u05e7\u05e9\u05d5\u05e8 \u05dc\u05de\u05e9\u05d9\u05de\u05d4" in pctx and len(pctx) < len(full) * 0.6, len(pctx))
check("the assistant's domain line names the rules file and says to read only the related lines", "rules/" in open(os.path.join(ROOT, "functions/_domains.js"), encoding="utf-8").read() and "grep -i" in open(os.path.join(ROOT, "functions/_domains.js"), encoding="utf-8").read())
# 02/11/2026 (Michael: "do it: words that learn by themselves"): domain-gaps.py finds the requests with no branch and refuses a too-common word
import subprocess, tempfile
tf = tempfile.NamedTemporaryFile("w", suffix=".json", delete=False, encoding="utf-8")
json.dump({"rows": [{"who": "michael", "text": "\u05d0\u05e0\u05d9 \u05e8\u05d5\u05e6\u05d4 \u05dc\u05d4\u05d6\u05d9\u05d6 \u05d0\u05ea \u05d9\u05de\u05d9 \u05d4\u05db\u05e9\u05e8\u05d5\u05ea \u05e9\u05dc\u05d9 \u05db\u05de\u05d5 \u05e9\u05d3\u05d9\u05d1\u05e8\u05e0\u05d5 \u05e7\u05d5\u05d3\u05dd"}, {"who": "michael", "text": "xyzzy plugh frotz gnusto rezrov blorb quux"}, {"who": "michael", "text": "[" + "x" * 40}, {"who": "assistant", "text": "y" * 50}]}, tf); tf.close()
g = lambda *a: subprocess.run([sys.executable, os.path.join(ROOT, "tools/domain-gaps.py"), tf.name] + list(a), capture_output=True, text=True, encoding="utf-8")
r0, r1 = g(), g("mail=xyzzy")
check("domain-gaps: counts only Michael's real requests and lists the one with no branch", "requests: 2," in r0.stdout and "xyzzy" in r0.stdout and r0.returncode == 0, r0.stdout[:300])
check("domain-gaps: a word that would load one branch on more than 40% exits 3", r1.returncode == 3, r1.stdout[:200])
os.unlink(tf.name)
check("retro-prompt: the weekly words step runs domain-gaps", "tools/domain-gaps.py" in open(os.path.join(ROOT, "project-files/retro-prompt.md"), encoding="utf-8").read())
# 02/11/2026 (Michael: "do it: smart ranking and spelling mistakes"): one letter off still finds the branch, here, in the
# server and in domain-gaps; BM25 puts the line with the rare word first
sys.path.insert(0, os.path.join(ROOT, "tools"))
import domain_match as dm
check("domain_match.lev1: one edit yes, two no", dm.lev1("abcde", "abxde") and dm.lev1("abcde", "abde") and not dm.lev1("abcde", "axcxe"))
ty = hook("\u05d9\u05e9 \u05e7\u05d1\u05dc\u05e0\u05d9\u05de \u05d7\u05d3\u05e9\u05d9\u05dd \u05d1\u05e9\u05d1\u05d5\u05e2 \u05d4\u05d1\u05d0")
check("hook: a one-letter typo (\u05e7\u05d1\u05dc\u05e0\u05d9\u05de) still loads its branch (height)", "height.md" in str(ty))
check("hook: a short word one letter off loads nothing (no fuzzy under 5 letters)", hook("\u05de\u05d4 \u05e9\u05dc\u05d5\u05de\u05da \u05d4\u05d9\u05d5\u05dd") == {})
rk = dm.rank(["- \u05d8\u05d5\u05e4\u05e1 \u05d0\u05d7\u05d3", "- \u05d8\u05d5\u05e4\u05e1 \u05e9\u05e0\u05d9", "- \u05d8\u05d5\u05e4\u05e1 146.03 \u05dc\u05e7\u05d1\u05dc\u05df", "- \u05d8\u05d5\u05e4\u05e1 \u05e9\u05dc\u05d9\u05e9\u05d9"], dm.tokens("\u05d8\u05d5\u05e4\u05e1 146.03"))
check("domain_match.rank (BM25): the line with the rare word (146.03) comes first", rk and "146.03" in rk[0][2], rk[:2])
js = subprocess.run(["node", "-e", "import(process.argv[1]).then((m) => console.log(JSON.stringify([m.domainsOf('\u05d9\u05e9 \u05e7\u05d1\u05dc\u05e0\u05d9\u05de \u05d7\u05d3\u05e9\u05d9\u05dd').map((d) => d.key), m.domainsOf('\u05de\u05d4 \u05e9\u05dc\u05d5\u05de\u05da').length])))", "file://" + os.path.join(ROOT, "functions/_domains.js")], capture_output=True, text=True)
check("server domainsOf: the same typo finds height, a greeting finds nothing", js.stdout.strip() == '[["height"],0]', js.stdout + js.stderr[:200])
# 02/11/2026, pairs (lessons-gate "\u05d6\u05d5\u05d2\u05d5\u05ea:"): 3 real-shaped lines with a one-letter typo that must find their branch, 3 real
# lines of Michael (02/11/2026, wa_review) that must find none; the hook's module and the server give the same answer
PAIRS = [("\u05d9\u05e9 \u05e7\u05d1\u05dc\u05e0\u05d9\u05de \u05d7\u05d3\u05e9\u05d9\u05dd \u05de\u05d7\u05e8", ["height"]), ("\u05de\u05d4 \u05e2\u05dd \u05d4\u05db\u05d1\u05d0\u05d5\u05d8", ["emergency"]), ("\u05ea\u05e9\u05dc\u05d7 \u05dc\u05d9 \u05d0\u05ea \u05d4\u05d8\u05e4\u05e1\u05d9\u05de", ["iso"]),
         ("\u05de\u05d4 \u05e9\u05dc\u05d5\u05de\u05da", []), ("\u05db\u05df \u05dc\u05d4\u05db\u05d9\u05df \u05d0\u05d1\u05dc \u05d6\u05d4 \u05e4\u05e0\u05d9\u05de\u05d9 \u05dc\u05e6\u05d5\u05d5\u05ea \u05e9\u05dc\u05e0\u05d5 \u05d1\u05e7\u05e9\u05d4 \u05e9\u05dc\u05d9 \u05dc\u05e7\u05d1\u05dc \u05e4\u05e8\u05d8\u05d9\u05dd", []), ("\u05e2\u05dc \u05d0\u05d9\u05d6\u05d4 \u05d7\u05e9\u05d1\u05d5\u05df \u05d0\u05ea\u05d4 \u05e2\u05d5\u05d1\u05d3?", [])]
idx = json.load(open(os.path.join(ROOT, "project-files/domains/index.json"), encoding="utf-8"))
py = [[k for k, _, _ in dm.branches(t, idx)] for t, _ in PAIRS]
jsr = subprocess.run(["node", "-e", "import(process.argv[1]).then((m) => console.log(JSON.stringify(JSON.parse(process.argv[2]).map((t) => m.domainsOf(t).map((d) => d.key)))))", "file://" + os.path.join(ROOT, "functions/_domains.js"), json.dumps([t for t, _ in PAIRS])], capture_output=True, text=True)
check("pairs: 3 typo lines find their branch and 3 real lines find none (domain_match)", py == [e for _, e in PAIRS], py)
check("pairs: the server's domainsOf gives the same 6 answers", jsr.stdout.strip() and json.loads(jsr.stdout) == [e for _, e in PAIRS], jsr.stdout + jsr.stderr[:200])
# 02/11/2026 (Michael: "do it: a cost per session" and "golden questions"): session-cost dedupes a message logged per
# content block and prices it; golden-check passes a right short answer and fails a wrong, long or dashed one
import tempfile
td = tempfile.mkdtemp()
tr = os.path.join(td, "s.jsonl")
msg = {"id": "m1", "model": "claude-opus-5-5", "usage": {"input_tokens": 1000000, "output_tokens": 0, "cache_read_input_tokens": 0, "cache_creation_input_tokens": 0}}
open(tr, "w").write("\n".join(json.dumps({"requestId": "r1", "message": msg}) for _ in range(3)) + "\n")
sc = subprocess.run([sys.executable, os.path.join(ROOT, "tools/session-cost.py"), tr], capture_output=True, text=True, encoding="utf-8")
check("session-cost: one message logged 3 times counts once (1M Opus input = 4.00 dollars)", "4.00" in sc.stdout and "1 " in sc.stdout, sc.stdout + sc.stderr[:200])
ga = os.path.join(td, "a.json")
json.dump({"g1": "\u05de\u05ea\u05d7\u05d9\u05dc\u05d9\u05dd \u05d9\u05e6\u05d9\u05d0\u05d4 \u05d1-150 \u05d1\u05e8", "g4": "3,000 \u05e9\"\u05d7 \u05dc\u05e4\u05d9 \u05d4\u05d7\u05d5\u05e7", "g10": "150 \u05d1\u05e8 \u2014 \u05e1\u05e2\u05d9\u05e3 1.5"}, open(ga, "w", encoding="utf-8"), ensure_ascii=False)
gc = subprocess.run([sys.executable, os.path.join(ROOT, "tools/golden-check.py"), ga], capture_output=True, text=True, encoding="utf-8")
check("golden-check: right answer passes; wrong fine, missing answer and long dash fail; exit 1", "PASS g1" in gc.stdout and "FAIL g4" in gc.stdout and "FAIL g2 no answer" in gc.stdout and "long dash" in gc.stdout and gc.returncode == 1, gc.stdout[:400])
check("golden set: 10 questions, each with a source", len(json.load(open(os.path.join(ROOT, "project-files/assistant-golden.json"), encoding="utf-8"))["questions"]) == 10 and all(q.get("source") for q in json.load(open(os.path.join(ROOT, "project-files/assistant-golden.json"), encoding="utf-8"))["questions"]))
print("\n%d passed, %d failed" % (passed, failed))
sys.exit(1 if failed else 0)
