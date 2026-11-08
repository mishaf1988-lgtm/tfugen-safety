#!/usr/bin/env python3
# tools/pii-redact.py (07/11/2026, Michael: "do it: hide personal details in a file"): every worker in an Excel or Word
# file becomes "worker N", unknown IDs / phones / mails become [hidden], the second checker refuses a copy with a
# detail left, and an unsupported format is refused. Plus meeting-stt.py's pieces and times (no network, no ffmpeg needed
# for the transcribe part).
import importlib.util, json, os, shutil, subprocess, sys, tempfile
sys.stdout.reconfigure(encoding="utf-8")
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
passed = failed = 0
def check(label, cond, detail=None):
    global passed, failed
    if cond: passed += 1; print("  ✓ " + label)
    else: failed += 1; print("  ✗ " + label + ("  -> " + str(detail)[:400] if detail is not None else ""))
def load(name):
    spec = importlib.util.spec_from_file_location(name.replace("-", "_"), os.path.join(ROOT, "tools", name + ".py"))
    m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m); return m

try:
    import openpyxl, docx
except ImportError:
    print("pii-redact-test: openpyxl / python-docx missing"); sys.exit(1)

pr = load("pii-redact")
tmp = tempfile.mkdtemp()
COHEN, LEVI = "דני כהן", "שרה לוי"   # "Dani Cohen", "Sara Levi"
people = [{"n": COHEN, "eid": "039337423", "ph": "052-1234567", "em": "dani@tapugan.co.il"},
          {"n": LEVI, "eid": "12345674", "ph": "0547654321", "em": "sara@x.co.il"},
          {"n": "אבי", "eid": "", "ph": "", "em": ""}]   # a 3-letter single name
pj = os.path.join(tmp, "people.json"); json.dump(people, open(pj, "w", encoding="utf-8"), ensure_ascii=False)

print("\n1. Excel")
src = os.path.join(tmp, "hearing.xlsx")
wb = openpyxl.Workbook(); ws = wb.active; ws.title = "שמיעה"
ws.append(["שם", "ת\"ז", "טלפון", "הערות"])
ws.append([COHEN, 39337423, "052-1234567", "לבדוק שוב עם " + LEVI])
ws.append(["לוי שרה", "012345674", "054-765-4321", "sara@x.co.il, קבלן 058-9998877 ext@out.com"])
ws.append(["אחר עם ת\"ז זרה", "123456782", 2026, "תקין, 12345 ק״ג"])
ws["D2"].comment = openpyxl.comments.Comment("x", COHEN)
wb.save(src)
out, key = os.path.join(tmp, "h-hidden.xlsx"), os.path.join(tmp, "h-key.xlsx")
rc = pr.main([src, out, key, "--people", pj])
check("the run ends clean (exit 0) and writes the copy and the key", rc == 0 and os.path.exists(out) and os.path.exists(key), rc)
txt = pr.all_text(out)
check("no worker name is left, in either order, in a cell or inside free text", COHEN not in txt and LEVI not in txt and "לוי שרה" not in txt, txt)
check("the same worker is the same number everywhere (Levi in a note and in her own row)", txt.count("עובד 2") >= 2 and "עובד 1" in txt, txt)
check("an ID stored as a number, a phone and a mail of a worker are hidden", "39337423" not in txt and "1234567" not in txt and "sara@x.co.il" not in txt, txt)
check("a stranger's valid ID, phone and mail become [hidden]; a year and a short number stay", "123456782" not in txt and "058-9998877" not in txt and "ext@out.com" not in txt and "2026" in txt and "12345" in txt, txt)
w2 = openpyxl.load_workbook(out)
check("the cell comment (it carries a name) is removed", w2.active["D2"].comment is None)
k = [r for r in openpyxl.load_workbook(key).active.iter_rows(values_only=True)]
check("the key lists worker 1 and 2 with the names, only for the workers found", len(k) == 3 and k[1][0] == "עובד 1" and k[1][1] == COHEN and k[2][1] == LEVI, k)
check("the second checker reads the copy clean", pr.verify(out, people) == [])

print("\n2. Word")
src = os.path.join(tmp, "protocol.docx")
d = docx.Document(); d.add_paragraph("נכחו: " + COHEN + ", " + LEVI)
p = d.add_paragraph(); p.add_run("החלטה: דני "); p.add_run("כהן מחליף מטף")
t = d.add_table(rows=1, cols=2); t.cell(0, 0).text = LEVI; t.cell(0, 1).text = "dani@tapugan.co.il"
d.sections[0].header.paragraphs[0].text = "רשם: " + COHEN
d.save(src)
out, key = os.path.join(tmp, "p-hidden.docx"), os.path.join(tmp, "p-key.xlsx")
rc = pr.main([src, out, key, "--people", pj])
txt = pr.all_text(out)
check("Word: names in text, in a name split over two runs, in a table and in the header are hidden", rc == 0 and COHEN not in txt and LEVI not in txt and "דני" not in txt and "dani@" not in txt, (rc, txt))

print("\n3. the second checker refuses a copy with a detail left (failure reason 1)")
class Lazy(pr.Redactor):
    def text(self, s): return s
saved = pr.Redactor; pr.Redactor = Lazy
out2 = os.path.join(tmp, "lazy.xlsx")
rc = pr.main([os.path.join(tmp, "hearing.xlsx"), out2, os.path.join(tmp, "lazy-key.xlsx"), "--people", pj])
pr.Redactor = saved
check("a redactor that missed everything: exit 7 and no key written", rc == 7 and not os.path.exists(os.path.join(tmp, "lazy-key.xlsx")) and not os.path.exists(out2), rc)

print("\n4. formats (failure reason 3)")
for bad in ["scan.pdf", "old.xls", "old.doc", "photo.jpg"]:
    open(os.path.join(tmp, bad), "wb").write(b"x")
check("a PDF, an old .xls/.doc and a photo are refused (exit 4)", all(pr.main([os.path.join(tmp, b), os.path.join(tmp, "o." + b.split(".")[-1]), key, "--people", pj]) == 4 for b in ["scan.pdf", "old.xls", "old.doc", "photo.jpg"]))
check("pairs: valid IDs pass the check digit, near misses do not", all(pr.id_ok(x) for x in ["039337423", "12345674", "123456782"]) and not any(pr.id_ok(x) for x in ["039337424", "000000000", "123456789"]))

print("\n4b. the security review's cases (07/11/2026)")
import zipfile
def rezip(src, dst, extra):
    with zipfile.ZipFile(src) as zi, zipfile.ZipFile(dst, "w") as zo:
        for n in zi.namelist():
            data = zi.read(n)
            if n in extra:
                data = extra.pop(n)(data)
            zo.writestr(n, data)
        for n, f in extra.items():
            zo.writestr(n, f(b""))
src = os.path.join(tmp, "rev.xlsx")
wb = openpyxl.Workbook(); ws = wb.active
ws.append(["\u05dc" + COHEN, "\u05d5" + LEVI, 501234567, "039-337-423"])
ws.append(["\u05d5\u05dc" + COHEN + " \u05d4\u05d2\u05d9\u05e2", 39337423.0, "\u05de\u05d9\u05d9\u05dc"])
ws["C2"].hyperlink = "mailto:dani@tapugan.co.il"
wb.save(src)
out = os.path.join(tmp, "rev-h.xlsx")
rc = pr.main([src, out, os.path.join(tmp, "rev-k.xlsx"), "--people", pj])
txt = pr.all_text(out) + pr.zip_text(out)
check("a name with one or two prefix letters is hidden and keeps its prefix", rc == 0 and COHEN not in txt and LEVI not in txt and "\u05dc\u05e2\u05d5\u05d1\u05d3 1" in txt and "\u05d5\u05e2\u05d5\u05d1\u05d3 2" in txt, (rc, txt[:300]))
check("a phone and an ID stored as numbers (Excel drops the 0), a dashed ID and a mailto link are hidden", "501234567" not in txt and "39337423" not in txt and "039-337-423" not in txt and "mailto" not in txt, txt[:400])
check("pairs: the checker sees a name, a prefixed name and a double prefix; a longer word, another letter before it and a name inside a word stay clean",
      bool(pr.name_re(COHEN).search("\u05dc" + COHEN)) and bool(pr.name_re(COHEN).search("\u05d5\u05dc" + COHEN)) and bool(pr.name_re(COHEN).search(COHEN))
      and not pr.name_re(COHEN).search("\u05d3\u05e0\u05d9 \u05db\u05d4\u05e0\u05d9\u05dd") and not pr.name_re(COHEN).search("\u05d0\u05d1" + COHEN) and not pr.name_re(COHEN).search("\u05d9\u05d5\u05d3\u05e0\u05d9 \u05db\u05d4\u05df"))
docp = os.path.join(tmp, "foot.docx"); docx.Document().save(docp)
bad = os.path.join(tmp, "foot2.docx")
# a part python-docx keeps but the redaction does not rewrite (a style named after a worker); an unlinked part would be dropped
rezip(docp, bad, {"word/styles.xml": lambda d: d.replace(b"</w:styles>", ('<w:style w:type="paragraph" w:styleId="x1"><w:name w:val="' + COHEN + '"/></w:style></w:styles>').encode())})
rc = pr.main([bad, os.path.join(tmp, "foot-h.docx"), os.path.join(tmp, "foot-k.xlsx"), "--people", pj])
check("a name in a part the redaction does not rewrite (a style name) is caught by the checker on the whole file: exit 7, no key", rc == 7 and not os.path.exists(os.path.join(tmp, "foot-k.xlsx")), rc)
trk = os.path.join(tmp, "trk.docx")
rezip(docp, trk, {"word/document.xml": lambda d: d.replace(b"<w:body>", b"<w:body><w:del w:id='1'/>")})
cmt = os.path.join(tmp, "cmt.docx"); rezip(docp, cmt, {"word/comments.xml": lambda d: b"<x/>"})
pv = os.path.join(tmp, "pv.xlsx"); rezip(os.path.join(tmp, "hearing.xlsx"), pv, {"xl/pivotCache/pivotCacheRecords1.xml": lambda d: b"<x/>"})
check("tracked changes, comments in Word and a pivot table in Excel are refused before anything is written (exit 4)",
      all(pr.main([f, os.path.join(tmp, "o" + os.path.splitext(f)[1]), os.path.join(tmp, "ok.xlsx"), "--people", pj]) == 4 for f in [trk, cmt, pv]))

print("\n5. meeting-stt.py")
ms = load("meeting-stt")
check("times: piece i starts at i x chunk", ms.hms(0) == "00:00:00" and ms.hms(300) == "00:05:00" and ms.hms(3900) == "01:05:00")
calls = []
def fake(p, key):
    calls.append(p); return (False, "stt: model down") if p.endswith("2") else (True, "שלום " + p)
lines, f = ms.transcribe(["p0", "p1", "p2"], 300, "k", post=fake)
check("one failed piece is written as not transcribed and the others stay (an hour is not lost to one minute)", f == 1 and lines[0].startswith("[00:00:00] ") and lines[2] == "[00:10:00] (not transcribed: stt: model down)" and len(calls) == 3, lines)
check("usage: a file that is not audio, or a chunk out of 60-600 seconds, is refused (exit 2)", ms.main(["a.pdf", "o.txt"]) == 2 and ms.main(["a.m4a", "o.txt", "--chunk=30"]) == 2)
if shutil.which("ffmpeg"):
    a = os.path.join(tmp, "a.m4a")
    subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-f", "lavfi", "-i", "sine=frequency=440:duration=130", "-c:a", "aac", a], check=True)
    pcs = ms.split(a, tmp, 60)
    check("ffmpeg cuts 130 seconds into 3 Opus pieces of 60 seconds", len(pcs) == 3 and all(open(x, "rb").read(4) == b"OggS" for x in pcs), pcs)
else:
    print("  (ffmpeg not here: the cut is checked where it is)")

shutil.rmtree(tmp, ignore_errors=True)
print("\n%d passed, %d failed" % (passed, failed))
sys.exit(1 if failed else 0)
