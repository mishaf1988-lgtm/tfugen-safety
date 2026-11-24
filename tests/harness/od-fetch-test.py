#!/usr/bin/env python3
# tools/od-fetch.py (24/11/2026, Michael: "בצע: פעולת שרת להורדה ותיוק מ-OneDrive"): one Bash call that downloads a file of
# the safety folder through tools/od-get.sh and renders a PDF to PNG pages. The server is mocked: a fake routine-db.sh (logs
# the state_set calls) and a fake curl on PATH (answers with a fixture file), in a copy of tools/ in a temp folder, so the
# real od-get.sh runs end to end without the network.
import os, re, shutil, struct, subprocess, sys, tempfile, zipfile
sys.stdout.reconfigure(encoding="utf-8")
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
passed = failed = 0
def check(label, cond, detail=None):
    global passed, failed
    if cond: passed += 1; print("  ✓ " + label)
    else: failed += 1; print("  ✗ " + label + ("  -> " + repr(detail)[:400] if detail is not None else ""))

def pdf(pages_text):
    """A small valid PDF, one page per item; an empty item = a page with no text (a scan)."""
    objs = ["<< /Type /Catalog /Pages 2 0 R >>", None, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"]
    kids = []
    for t in pages_text:
        body = ("BT /F1 10 Tf 20 250 Td (%s) Tj ET" % t) if t else "0 0 1 rg 20 20 100 100 re f"
        objs.append("<< /Length %d >>\nstream\n%s\nendstream" % (len(body), body))
        objs.append("<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 300] /Contents %d 0 R /Resources << /Font << /F1 3 0 R >> >> >>" % len(objs))
        kids.append(len(objs))
    objs[1] = "<< /Type /Pages /Kids [%s] /Count %d >>" % (" ".join("%d 0 R" % k for k in kids), len(kids))
    out, offs = b"%PDF-1.4\n", []
    for i, o in enumerate(objs, 1):
        offs.append(len(out)); out += ("%d 0 obj\n%s\nendobj\n" % (i, o)).encode()
    x = len(out)
    out += ("xref\n0 %d\n0000000000 65535 f \n" % (len(objs) + 1)).encode() + b"".join(b"%010d 00000 n \n" % o for o in offs)
    out += ("trailer\n<< /Size %d /Root 1 0 R >>\nstartxref\n%d\n%%%%EOF\n" % (len(objs) + 1, x)).encode()
    return out

tmp = tempfile.mkdtemp(prefix="odfetch-")
try:
    tree, bin_, fx, out = (os.path.join(tmp, d) for d in ("tree", "bin", "fx", "out"))
    for d in (tree + "/tools", tree + "/project-files", bin_, fx):
        os.makedirs(d)
    for f in ("od-fetch.py", "od-get.sh"):
        shutil.copy(os.path.join(ROOT, "tools", f), tree + "/tools/" + f)
    log = os.path.join(tmp, "calls.log")
    with open(tree + "/project-files/routine-db.sh", "w") as f:
        f.write('#!/usr/bin/env bash\n[ -z "${ROUTINE_KEY:-}" ] && exit 3\necho "rdb $1" >> "%s"\n[ -n "${FAIL_STATE:-}" ] && exit 4\necho \'{"ok":true}\'\n' % log)
    with open(bin_ + "/curl", "w") as f:
        f.write('''#!/usr/bin/env bash
o=""; tok=""; data=""
while [ $# -gt 0 ]; do case "$1" in -o) o=$2; shift;; -H) case "$2" in x-raw-token:*) tok=${2#x-raw-token: };; esac; shift;; --data) data=$2; shift;; esac; shift; done
echo "curl tok=$tok data=$data" >> "%s"
if [ -n "${FAKE_404:-}" ]; then echo '{"error":"not found"}' > "$o"; printf 404; exit 0; fi
cp "$FAKE_FILE" "$o"; printf 200
''' % log)
    os.chmod(bin_ + "/curl", 0o755)
    open(fx + "/text.pdf", "wb").write(pdf(["Pressure vessel inspection report E-1227 serial 4455667 next test 12.05.2027 inspector approved"] * 3))
    open(fx + "/scan.pdf", "wb").write(pdf(["", ""]))
    with zipfile.ZipFile(fx + "/form.docx", "w") as z:
        z.writestr("word/document.xml", "<w:document><w:body><w:p><w:r><w:t>Work at height permit 18.03</w:t></w:r></w:p><w:p><w:r><w:t>Second line</w:t></w:r></w:p></w:body></w:document>")
    open(fx + "/photo.jpg", "wb").write(b"\xff\xd8\xff\xe0" + b"0" * 100)

    def run(args, fixture="text.pdf", key=True, **extra):
        env = dict(os.environ, PATH=bin_ + ":" + os.environ["PATH"], OD_FETCH_DIR=out, FAKE_FILE=os.path.join(fx, fixture))
        env.pop("ROUTINE_KEY", None)
        if key: env["ROUTINE_KEY"] = "test-key"
        env.update(extra)
        open(log, "w").close()
        r = subprocess.run([sys.executable, tree + "/tools/od-fetch.py"] + args, capture_output=True, text=True, env=env)
        return r, open(log).read()

    def png_width(p):
        with open(p, "rb") as f:
            h = f.read(24)
        return struct.unpack(">I", h[16:20])[0] if h[:8] == b"\x89PNG\r\n\x1a\n" else -1

    POPPLER = os.environ.get("OD_FETCH_POPPLER") != "0" and all(shutil.which(t) for t in ("pdfinfo", "pdftoppm", "pdftotext"))
    print("  (poppler %s)" % ("found: the PDF render checks run" if POPPLER else "missing: the no-poppler checks run"))
    if POPPLER:
        # 1. a text PDF of 3 pages: one call, 2 pages rendered at 70 dpi, the text, the token set and revoked, never printed
        r, calls = run(["22_ISO/report E-1227.pdf"])
        check("a PDF: exit 0", r.returncode == 0, r.stderr)
        check("... saved as OUT/1.pdf", os.path.join(out, "1.pdf") in r.stdout, r.stdout)
        pngs = re.findall(r"\S+\.png", r.stdout)
        check("... 2 pages rendered by default (of 3)", pngs == [out + "/1-1.png", out + "/1-2.png"] and all(os.path.exists(p) for p in pngs), r.stdout)
        check("... the page count says 3 and how to get more", "pages: 3 (rendered 2" in r.stdout, r.stdout)
        w = png_width(out + "/1-1.png")
        check("... rendered at 70 dpi (a 300pt page is about 292px)", 280 <= w <= 300, w)
        check("... prints the text layer", "Pressure vessel inspection report E-1227" in r.stdout, r.stdout)
        check("... the text is capped at about 800 characters", len(r.stdout.split("text:\n", 1)[-1]) <= 820, len(r.stdout))
        tok = (re.search(r"curl tok=(\S+)", calls) or [None, ""])[1]
        check("... the download carried a one-off token", len(tok) == 48, calls)
        check("... the token was set (od_raw_token) and then ended (od_raw_exp twice)", calls.count("od_raw_token") == 1 and calls.count("od_raw_exp") == 2, calls)
        check("... the token and ROUTINE_KEY are never printed", tok and tok not in r.stdout + r.stderr and "test-key" not in r.stdout + r.stderr)
        check("... the path went to od-read as raw", '"raw": true' in calls and "22_ISO/report E-1227.pdf" in calls, calls)

        # 2. a second file gets the next number; --pages 3 renders all 3; --pages 50 is capped at 10
        r, _ = run(["a/b.pdf", "--pages", "3"])
        check("a second file is OUT/2.pdf, 3 pages with --pages 3", out + "/2.pdf" in r.stdout and len(re.findall(r"2-\d\.png", r.stdout)) == 3, r.stdout)
        check("... and says nothing about more pages", "rendered" not in r.stdout, r.stdout)

        # 3. a scan: no text layer -> the scan line with the ocr_txt command for that path
        r, _ = run(["x/scan.pdf"], fixture="scan.pdf")
        check("a scan: exit 0 and PNGs", r.returncode == 0 and len(re.findall(r"\.png", r.stdout)) == 2, r.stdout + r.stderr)
        check("... says scan and gives the ocr_txt call for the path", "a scan" in r.stdout and 'ocr_txt {"paths":["x/scan.pdf"]}' in r.stdout, r.stdout)

    else:
        # 24/11/2026: CI has no poppler. The script must say so and not crash, and the download itself still works
        r, calls = run(["22_ISO/report E-1227.pdf"])
        check("no poppler: exit 0, the file is saved", r.returncode == 0 and os.path.join(out, "1.pdf") in r.stdout, r.stdout + r.stderr)
        check("... says poppler is missing, no PNG, not called a scan", "poppler not installed" in r.stdout and ".png" not in r.stdout and "a scan" not in r.stdout, r.stdout)
        check("... gives the ocr_txt call for the path", 'ocr_txt {"paths":["22_ISO/report E-1227.pdf"]}' in r.stdout, r.stdout)
        tok = (re.search(r"curl tok=(\S+)", calls) or [None, ""])[1]
        check("... the token was set and ended, never printed", calls.count("od_raw_token") == 1 and calls.count("od_raw_exp") == 2 and tok and tok not in r.stdout + r.stderr, calls)

    # 4. Word: the start of its text; a photo: its path to Read
    r, _ = run(["f/form.docx"], fixture="form.docx")
    check("a docx: prints its text, paragraphs on lines", "Work at height permit 18.03\nSecond line" in r.stdout, r.stdout)
    r, _ = run(["f/p.jpg"], fixture="photo.jpg")
    check("a photo: says to Read its path", re.search(r"image: Read \S+\.jpg", r.stdout) is not None, r.stdout)

    # 5. refusals: bad path, no key, a failed download
    n_before = len(os.listdir(out))
    r, calls = run(["a/../../secret.pdf"])
    check("'..' in the path: exit 2, no token, no download", r.returncode == 2 and calls == "", (r.returncode, calls))
    r, calls = run([])
    check("no path: exit 2", r.returncode == 2)
    r, calls = run(["a.pdf", "--pages"])
    check("--pages without a number: exit 2", r.returncode == 2)
    r, calls = run(["a/b.pdf"], key=False)
    check("no ROUTINE_KEY: exit 3 and no download", r.returncode == 3 and "curl" not in calls, (r.returncode, calls))
    pdfs_before = len([f for f in os.listdir(out) if f.endswith(".pdf")])
    r, calls = run(["a/missing.pdf"], FAKE_404="1")
    check("... the JSON error is not left as a .pdf to look at", len([f for f in os.listdir(out) if f.endswith(".pdf")]) == pdfs_before, os.listdir(out))
    check("a 404: exit 5, says the download failed", r.returncode == 5 and "download failed" in r.stdout, (r.returncode, r.stdout))
    check("... and the token was ended anyway", calls.count("od_raw_exp") == 2, calls)
    check("... no PNG was made for it", not any(re.match(r"\d+-\d+\.png$", f) and f.startswith(str(n_before)) for f in os.listdir(out)), os.listdir(out))
    r, calls = run(["a/b.pdf"], FAIL_STATE="1")
    check("the token cannot be set: exit 4, no download", r.returncode == 4 and "curl" not in calls, (r.returncode, calls))
finally:
    shutil.rmtree(tmp, ignore_errors=True)
print(f"{passed} passed, {failed} failed")
sys.exit(1 if failed else 0)
