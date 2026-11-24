#!/usr/bin/env python3
"""Fetch ONE file from the safety folder on OneDrive and make it ready to look at, in one Bash call (24/11/2026, Michael:
"בצע: פעולת שרת להורדה ותיוק מ-OneDrive"). Measured that day: the WhatsApp assistant spent 6-10 tool calls (state_set for a
one-off token, curl, download, pdftoppm, viewing) at 100-143K context each, every time it needed a file.

  python3 tools/od-fetch.py '<path under the safety folder>' [--pages N]
  e.g.  python3 tools/od-fetch.py '11_x/y/permit.pdf'            then Read the PNG paths it prints

What it does: tools/od-get.sh (the same one-off key, revoked right after; this file never sees ROUTINE_KEY or the key)
downloads to OUT/<n>.<ext>; a PDF is rendered, up to N pages (default 2, at most 10), at 70 dpi, to OUT/<n>-<page>.png
(pdftoppm), and the first TEXT_CHARS characters of its text layer are printed, or a "scan" line that says to read the PNGs
or run ocr_txt. A Word / Excel / PowerPoint file prints the start of its text; a photo prints its path to Read.
OUT is /tmp/od (OD_FETCH_DIR overrides it, for the tests). <n> = the next free number there, so two files never mix.
Exit: 0 ready; 2 usage; 3-5 = od-get.sh's own exit codes (no ROUTINE_KEY, token not set, download failed).
"""
import os, re, subprocess, sys, zipfile

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
OD_GET = os.path.join(ROOT, "tools", "od-get.sh")
OUT = os.environ.get("OD_FETCH_DIR") or "/tmp/od"
DPI = 70
PAGES_DEFAULT, PAGES_MAX = 2, 10
TEXT_CHARS = 800
SCAN_MIN = 40  # fewer letters than this in the text layer = a scan
EXTS = ("pdf", "docx", "xlsx", "pptx", "doc", "xls", "jpg", "jpeg", "png", "txt", "csv")


def usage(msg):
    print(msg, file=sys.stderr)
    print("usage: python3 tools/od-fetch.py '<path under the safety folder>' [--pages N]", file=sys.stderr)
    sys.exit(2)


def args(argv):
    path, pages, i = None, PAGES_DEFAULT, 0
    while i < len(argv):
        a = argv[i]
        if a == "--pages":
            if i + 1 >= len(argv) or not argv[i + 1].isdigit():
                usage("--pages needs a number")
            pages = int(argv[i + 1]); i += 2; continue
        if path is not None:
            usage("one path only")
        path = a; i += 1
    if not path or not path.strip("/"):
        usage("a path is required")
    parts = [p for p in path.split("/") if p]
    if any(p in (".", "..") for p in parts):
        usage("bad path")
    return "/".join(parts), max(1, min(pages, PAGES_MAX))


def next_n():
    os.makedirs(OUT, exist_ok=True)
    taken = {int(m.group(1)) for f in os.listdir(OUT) for m in [re.match(r"^(\d+)[.-]", f)] if m}
    n = 1
    while n in taken:
        n += 1
    return n


def clip(text):
    text = re.sub(r"[ \t]+", " ", text.replace("\f", "\n"))
    text = re.sub(r"\n\s*\n+", "\n", text).strip()
    return text[:TEXT_CHARS] + (" ..." if len(text) > TEXT_CHARS else "")


def zip_text(path, ext):
    try:
        z = zipfile.ZipFile(path)
    except zipfile.BadZipFile:
        return ""
    names = z.namelist()
    if ext == "docx":
        parts = ["word/document.xml"]
    elif ext == "xlsx":
        parts = ["xl/sharedStrings.xml"]
    else:
        parts = sorted((x for x in names if re.match(r"ppt/slides/slide\d+\.xml$", x)), key=lambda x: int(re.findall(r"\d+", x)[-1]))
    out = []
    for p in parts:
        if p not in names:
            continue
        xml = z.read(p)[:2_000_000].decode("utf-8", "replace")
        xml = re.sub(r"</(w:p|a:p|si)>", "\n", xml)
        out.append(re.sub(r"<[^>]+>", "", xml))
        if sum(len(x) for x in out) > TEXT_CHARS * 2:
            break
    return "".join(out)


def pdf_pages(path):
    r = subprocess.run(["pdfinfo", path], capture_output=True, text=True)
    m = re.search(r"^Pages:\s+(\d+)", r.stdout, re.M)
    return int(m.group(1)) if m else 0


def main():
    path, pages = args(sys.argv[1:])
    ext = (re.search(r"\.([A-Za-z0-9]{1,5})$", path) or [None, "bin"])[1].lower()
    if ext not in EXTS:
        ext = "bin"
    n = next_n()
    dest = os.path.join(OUT, "%d.%s" % (n, ext))
    r = subprocess.run(["bash", OD_GET, path, dest], capture_output=True, text=True)
    if r.returncode != 0:
        sys.stderr.write(r.stderr)
        if os.path.exists(dest):
            os.remove(dest)  # a JSON error saved as <n>.pdf is not a file to look at
        print("od-fetch: the download failed (od-get.sh exit %d); nothing to look at" % r.returncode)
        sys.exit(r.returncode)
    size = os.path.getsize(dest)
    print("file: %s" % path)
    print("saved: %s (%d KB)" % (dest, max(1, size // 1024)))
    if ext == "pdf":
        total = pdf_pages(dest)
        upto = min(pages, total) if total else pages
        pngs = []
        for p in range(1, upto + 1):
            base = os.path.join(OUT, "%d-%d" % (n, p))
            subprocess.run(["pdftoppm", "-r", str(DPI), "-png", "-f", str(p), "-l", str(p), "-singlefile", dest, base], capture_output=True)
            if os.path.exists(base + ".png"):
                pngs.append(base + ".png")
        print("pages: %s%s" % (total or "?", "" if not total or total <= upto else " (rendered %d; more: --pages N, up to %d)" % (upto, PAGES_MAX)))
        print("png: " + (" ".join(pngs) if pngs else "none (pdftoppm failed)"))
        t = subprocess.run(["pdftotext", "-layout", "-l", str(max(upto, 1)), dest, "-"], capture_output=True, text=True).stdout
        if len(re.sub(r"\W", "", t)) < SCAN_MIN:
            print("text: none, a scan. Read the png pages; for the text: ocr_txt {\"paths\":[\"%s\"]}" % path)
        else:
            print("text:\n" + clip(t))
    elif ext in ("jpg", "jpeg", "png"):
        print("image: Read %s" % dest)
    elif ext in ("docx", "xlsx", "pptx"):
        t = zip_text(dest, ext)
        print(("text:\n" + clip(t)) if t.strip() else "text: none found")
    elif ext in ("txt", "csv"):
        print("text:\n" + clip(open(dest, encoding="utf-8", errors="replace").read(TEXT_CHARS * 4)))
    else:
        print("no preview for .%s; the file is at %s" % (ext, dest))


if __name__ == "__main__":
    main()
