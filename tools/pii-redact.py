#!/usr/bin/env python3
"""A copy of an Excel or Word file with personal details hidden (07/11/2026, Michael in the questionnaire: "do it: hide
personal details in a file", "when I ask", "with the answers to the three failure reasons").

  python3 tools/pii-redact.py <in.xlsx|in.docx> <out> <key.xlsx> --people <people.json>

people.json: the emp rows [{"n": name, "eid": id, "ph": phone, "em": mail}, ...] (routine-db select on emp).
Every worker found in the file becomes "WORKER_WORD N" (numbered in order of first appearance), the same N everywhere;
the key file lists N -> name, id, phone, mail, and goes to a separate folder (routine-db PII_KEY_DIR; the server never
attaches it to a mail or a WhatsApp message). Beyond the list, any valid Israeli ID (9 digits, check digit), phone or
e-mail is replaced too, so a contractor or a former worker is not missed.

Second checker (failure reason 1, a name inside free text): after writing, the copy is opened again and read by
verify(), which shares no code with the replacing: any worker's full name (either order), a valid ID, a phone or an
e-mail left in it fails the run (exit 7) and the copy must not be used. Exit: 0 clean; 2 usage; 4 unsupported format
(failure reason 3: a scan or a PDF is refused, not half-done); 7 a detail left.
"""
import json, os, re, sys, unicodedata

WORKER_WORD = "עובד"          # "worker"
HIDDEN = "[מוסתר]"         # "[hidden]"
PHONE = re.compile(r"(?<!\d)(?:\+?972[-\s]?|0)(?:[23489]|5\d|7\d)[-\s]?\d{3}[-\s]?\d{4}(?!\d)")
MAIL = re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}")
NINE = re.compile(r"(?<!\d)\d{5,9}(?!\d)")
# an ID written with dashes or spaces, 039-337-423 (security review 07/11/2026)
SPLIT_ID = re.compile(r"(?<![\d-])\d{2,4}[-\s]\d{3}[-\s]\d{2,4}(?![\d-])")
# the one-letter prefixes Hebrew glues to a name: ו ב ל מ ש ה כ, up to two ("ולמשה כהן"; security review 07/11/2026)
PREFIX = "(?<![\u05d0-\u05eaA-Za-z])([\u05d5\u05d1\u05dc\u05de\u05e9\u05d4\u05db]{0,2})"
END = "(?![\u05d0-\u05eaA-Za-z])"
def name_re(nm):
    return re.compile(PREFIX + r"\s+".join(map(re.escape, nm.split(" "))) + END)


def norm(s):
    return re.sub(r"\s+", " ", unicodedata.normalize("NFC", str(s or ""))).strip()


def id_ok(d):
    d = d.zfill(9)
    if len(d) != 9 or not d.isdigit() or d == "000000000":
        return False
    t = 0
    for i, c in enumerate(d):
        x = int(c) * (1 + i % 2)
        t += x - 9 if x > 9 else x
    return t % 10 == 0


def digits(s):
    return re.sub(r"\D", "", str(s or ""))


class Redactor:
    def __init__(self, people):
        self.people = []
        for p in people:
            n = norm(p.get("n"))
            if len(n) < 3:
                continue
            parts = n.split(" ")
            names = {n}
            if len(parts) >= 2:
                names.add(" ".join(parts[1:] + parts[:1]))  # "last first" too
            self.people.append({"n": n, "names": sorted(names, key=len, reverse=True), "eid": digits(p.get("eid")).lstrip("0"),
                                "ph": digits(p.get("ph"))[-9:], "em": str(p.get("em") or "").strip().lower(), "raw": p})
        self.alias = {}   # index in self.people -> N

    def tag(self, i):
        if i not in self.alias:
            self.alias[i] = len(self.alias) + 1
        return "%s %d" % (WORKER_WORD, self.alias[i])

    def text(self, s):
        if s is None:
            return s
        t = unicodedata.normalize("NFC", str(s))
        for i, p in enumerate(self.people):
            for nm in p["names"]:
                pat = name_re(nm)
                if pat.search(t):
                    tg = self.tag(i)
                    t = pat.sub(lambda m: m.group(1) + tg, t)
            if p["em"] and p["em"] in t.lower():
                t = re.sub(re.escape(p["em"]), self.tag(i), t, flags=re.I)
        def one_mail(m):
            hit = [i for i, p in enumerate(self.people) if p["em"] and p["em"] == m.group(0).lower()]
            return self.tag(hit[0]) if hit else HIDDEN
        t = MAIL.sub(one_mail, t)
        def one_phone(m):
            d = digits(m.group(0))[-9:]
            hit = [i for i, p in enumerate(self.people) if p["ph"] and p["ph"] == d]
            return self.tag(hit[0]) if hit else HIDDEN
        t = PHONE.sub(one_phone, t)
        def one_id(m):
            d = m.group(0).lstrip("0")
            hit = [i for i, p in enumerate(self.people) if p["eid"] and p["eid"] == d]
            if hit:
                return self.tag(hit[0])
            return HIDDEN if len(m.group(0)) >= 8 and id_ok(m.group(0)) else m.group(0)
        t = NINE.sub(one_id, t)
        return SPLIT_ID.sub(lambda m: HIDDEN if id_ok(digits(m.group(0))) else m.group(0), t)

    def key_rows(self):
        rows = []
        for i, n in sorted(self.alias.items(), key=lambda x: x[1]):
            p = self.people[i]["raw"]
            rows.append(["%s %d" % (WORKER_WORD, n), norm(p.get("n")), str(p.get("eid") or ""), str(p.get("ph") or ""), str(p.get("em") or "")])
        return rows


def redact_xlsx(src, out, r):
    import openpyxl
    wb = openpyxl.load_workbook(src)
    for ws in wb.worksheets:
        for row in ws.iter_rows():
            for c in row:
                v = c.value
                if isinstance(v, str):
                    c.value = r.text(v)
                elif isinstance(v, (int, float)) and not isinstance(v, bool) and float(v).is_integer() and 5 <= len(str(int(v))) <= 9:
                    sv = str(int(v))
                    nv = r.text(sv)
                    # Excel drops the leading 0: 501234567 is a phone, 39337423 an ID (security review 07/11/2026)
                    if nv == sv and len(sv) in (8, 9) and (PHONE.fullmatch("0" + sv) or id_ok(sv)):
                        nv = r.text("0" + sv) if PHONE.fullmatch("0" + sv) else HIDDEN
                        if nv == "0" + sv:
                            nv = HIDDEN
                    if nv != sv:
                        c.value = nv
                if c.hyperlink is not None:
                    c.hyperlink = None  # a mailto: link keeps the address
                if c.comment is not None:
                    c.comment = None   # a comment carries its author's name
        for hf in (ws.oddHeader, ws.oddFooter, ws.evenHeader, ws.evenFooter):
            for part in (hf.left, hf.center, hf.right):
                if part.text:
                    part.text = r.text(part.text)
    wb.properties.creator = None
    wb.properties.lastModifiedBy = None
    wb.save(out)


def _paras(doc):
    secs = list(doc.sections)
    for p in doc.paragraphs:
        yield p
    def tables(ts):
        for t in ts:
            for row in t.rows:
                for cell in row.cells:
                    for p in cell.paragraphs:
                        yield p
                    yield from tables(cell.tables)
    yield from tables(doc.tables)
    for s in secs:
        for part in (s.header, s.footer):
            for p in part.paragraphs:
                yield p
            yield from tables(part.tables)


def redact_docx(src, out, r):
    import docx
    d = docx.Document(src)
    for p in _paras(d):
        full = "".join(x.text for x in p.runs)
        new = r.text(full)
        if new != full and p.runs:
            p.runs[0].text = new          # a name split over runs is joined: the copy keeps the words, not every font change
            for x in p.runs[1:]:
                x.text = ""
    d.core_properties.author = ""
    d.core_properties.last_modified_by = ""
    d.save(out)


def all_text(path):
    """The copy's words, read again from scratch (the second checker's view)."""
    if path.lower().endswith(".xlsx"):
        import openpyxl
        wb = openpyxl.load_workbook(path)
        out = []
        for ws in wb.worksheets:
            out.append(ws.title)
            for row in ws.iter_rows(values_only=True):
                out.extend(str(v) for v in row if v is not None)
        return "\n".join(out)
    import docx
    return "\n".join(p.text for p in _paras(docx.Document(path)))


def refuse_reason(path):
    """Parts the redaction does not rewrite: refused before anything is written (failure reason 3; review 07/11/2026)."""
    import zipfile
    try:
        z = zipfile.ZipFile(path)
    except zipfile.BadZipFile:
        return "not a real .xlsx/.docx"
    names = z.namelist()
    if any(n.startswith("xl/pivotCache/") for n in names):
        return "a pivot table keeps a copy of the source rows: remove it (copy, paste values) first"
    if path.lower().endswith(".docx"):
        doc = z.read("word/document.xml").decode("utf-8", "ignore") if "word/document.xml" in names else ""
        if re.search(r"<w:(ins|del|moveFrom|moveTo)\b", doc):
            return "tracked changes: accept or reject them all first"
        if any(n.startswith("word/comments") for n in names):
            return "comments: delete them first"
    return None


def zip_text(path):
    """Every text in every XML part of the file, tags removed, links included: what an auditor could open."""
    import zipfile, html
    out = []
    with zipfile.ZipFile(path) as z:
        for n in z.namelist():
            if n.endswith((".xml", ".rels")):
                x = z.read(n).decode("utf-8", "ignore")
                out.append(html.unescape(re.sub(r"<[^>]+>", " ", x)))
                # attribute values too: a link target, a style or a defined name can hold a name (test 07/11/2026)
                out += [html.unescape(u) for u in re.findall(r'="([^"]+)"', x) + re.findall(r"='([^']+)'", x)]
    return "\n".join(out)


def verify(path, people):
    """What is left in the copy: [(kind, value)], empty = clean. Independent of Redactor on purpose."""
    t = unicodedata.normalize("NFC", all_text(path) + "\n" + zip_text(path))
    flat = re.sub(r"\s+", " ", t)
    left = []
    for p in people:
        n = norm(p.get("n"))
        parts = n.split(" ")
        for nm in {n, " ".join(parts[1:] + parts[:1])} if len(parts) >= 2 else {n}:
            if len(nm) >= 3 and name_re(nm).search(flat):
                left.append(("name", nm))
        e = digits(p.get("eid")).lstrip("0")
        if len(e) >= 5 and re.search(r"(?<!\d)0*" + e + r"(?!\d)", t):
            left.append(("id of a worker", e[-3:]))
    left += [("e-mail", m) for m in MAIL.findall(t)]
    left += [("phone", m) for m in PHONE.findall(t)]
    left += [("id", m[-3:]) for m in re.findall(r"(?<!\d)\d{8,9}(?!\d)", t) if id_ok(m)]
    left += [("id", digits(m)[-3:]) for m in SPLIT_ID.findall(t) if id_ok(digits(m))]
    left += [("phone", "0" + m) for m in re.findall(r"(?<!\d)5\d{8}(?!\d)", t)]
    return left


def write_key(path, rows):
    import openpyxl
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "key"
    ws.append(["כינוי", "שם", "ת\"ז", "טלפון", "מייל"])
    for r in rows:
        ws.append(r)
    wb.save(path)


def main(argv):
    if len(argv) != 5 or argv[3] != "--people":
        print("usage: pii-redact.py <in.xlsx|in.docx> <out> <key.xlsx> --people <people.json>", file=sys.stderr)
        return 2
    src, out, key, _, pj = argv
    ext = src.lower().rsplit(".", 1)[-1]
    if ext not in ("xlsx", "docx") or not out.lower().endswith("." + ext) or not key.lower().endswith(".xlsx"):
        print("only .xlsx and .docx (a scan, a PDF or an old .xls/.doc: not supported)", file=sys.stderr)
        return 4
    why = refuse_reason(src)
    if why:
        print("not supported: " + why, file=sys.stderr)
        return 4
    people = json.load(open(pj, encoding="utf-8"))
    r = Redactor(people)
    (redact_xlsx if ext == "xlsx" else redact_docx)(src, out, r)
    left = verify(out, people)
    if left:
        try:
            os.remove(out)  # the copy still holds details: it must not stay in a synced folder (retro 08/11/2026)
        except OSError:
            pass
        print(json.dumps({"ok": False, "left": left[:20]}, ensure_ascii=False))
        return 7
    write_key(key, r.key_rows())
    print(json.dumps({"ok": True, "workers": len(r.alias), "out": out, "key": key}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
