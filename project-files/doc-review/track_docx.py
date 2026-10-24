#!/usr/bin/env python3
"""Word with tracked changes (24/10/2026, Michael: "when we change forms we must work with Review, so whoever we
send it to can see the change we made, in Excel, Word and every controlled document").

    python3 track_docx.py OLD.docx NEW.docx OUT.docx [--author "מיכאל פרייליך"] [--date 2026-10-24]

OUT is NEW with every change marked as a Word revision (w:ins / w:del) against OLD: Review > Track Changes shows
what was added and removed, and Accept All gives NEW exactly. Paragraphs are matched in order (difflib), and
inside a paragraph that mostly stayed the words are compared, so a one-word edit shows as one word; a rewritten
paragraph shows as deleted old text above the new one.
The header, tables and formatting of NEW are kept; only body paragraphs are compared. A .doc must first become
.docx: soffice --headless --convert-to docx OLD.doc
"""
import copy, difflib, re, sys, zipfile
from lxml import etree as ET  # lxml keeps the w14/mc prefixes Word needs; ElementTree renames them

SIMILAR = 0.5  # word-level marks only when at least half of the words stayed
W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'
q = lambda t: '{%s}%s' % (W, t)


def body_paras(path):
    with zipfile.ZipFile(path) as z:
        root = ET.fromstring(z.read('word/document.xml'))
    return root, [p for p in root.iter(q('p'))]


def ptext(p):
    return ''.join(t.text or '' for t in p.iter(q('t')))


def tokens(s):
    return re.findall(r'\s+|[^\s]+', s)


class Rev:
    def __init__(self, author, date):
        self.author, self.date, self.n = author, date + 'T00:00:00Z', 1000

    def attrs(self, el):
        el.set(q('id'), str(self.n)); self.n += 1
        el.set(q('author'), self.author); el.set(q('date'), self.date)
        return el


def run_like(p, text, deleted=False):
    """A run with the first run's formatting of paragraph p and the given text."""
    r0 = p.find(q('r'))
    r = ET.Element(q('r'))
    if r0 is not None and r0.find(q('rPr')) is not None:
        r.append(copy.deepcopy(r0.find(q('rPr'))))
    t = ET.SubElement(r, q('delText') if deleted else q('t'))
    t.text = text
    t.set('{http://www.w3.org/XML/1998/namespace}space', 'preserve')
    return r


def rebuild(p, old_s, new_s, rev):
    """Paragraph p (new content) rewritten as word-level ins/del against old_s."""
    keep = [c for c in list(p) if c.tag == q('pPr')]
    proto = copy.deepcopy(p)
    for c in list(p):
        if c.tag != q('pPr'):
            p.remove(c)
    a, b = tokens(old_s), tokens(new_s)
    for op, i1, i2, j1, j2 in difflib.SequenceMatcher(None, a, b, autojunk=False).get_opcodes():
        if op == 'equal':
            p.append(run_like(proto, ''.join(b[j1:j2])))
            continue
        if i2 > i1:
            d = rev.attrs(ET.SubElement(p, q('del')))
            d.append(run_like(proto, ''.join(a[i1:i2]), deleted=True))
        if j2 > j1:
            ins = rev.attrs(ET.SubElement(p, q('ins')))
            ins.append(run_like(proto, ''.join(b[j1:j2])))


def rpr_of(p):
    # the paragraph mark's run properties (an Element with no children is falsy, so no `or` here)
    ppr = p.find(q('pPr'))
    if ppr is None:
        ppr = ET.Element(q('pPr')); p.insert(0, ppr)
    rpr = ppr.find(q('rPr'))
    if rpr is None:
        rpr = ET.SubElement(ppr, q('rPr'))
    return rpr


def mark_inserted(p, rev):
    for r in [c for c in list(p) if c.tag == q('r')]:
        i = list(p).index(r)
        p.remove(r)
        ins = rev.attrs(ET.Element(q('ins')))
        ins.append(r)
        p.insert(i, ins)
    rpr_of(p).append(rev.attrs(ET.Element(q('ins'))))


def deleted_para(text, like, rev):
    p = ET.Element(q('p'))
    if like is not None and like.find(q('pPr')) is not None:
        p.append(copy.deepcopy(like.find(q('pPr'))))
    rpr_of(p).append(rev.attrs(ET.Element(q('del'))))
    d = rev.attrs(ET.SubElement(p, q('del')))
    d.append(run_like(like if like is not None else p, text, deleted=True))
    return p


def track(old_path, new_path, out_path, author, date):
    _, old_ps = body_paras(old_path)
    old = [ptext(p) for p in old_ps]
    with zipfile.ZipFile(new_path) as z:
        files = {n: z.read(n) for n in z.namelist()}
    root = ET.fromstring(files['word/document.xml'])
    body = root.find(q('body'))
    new_ps = [p for p in body if p.tag == q('p')]
    new = [ptext(p) for p in new_ps]
    rev = Rev(author, date)
    for op, i1, i2, j1, j2 in difflib.SequenceMatcher(None, old, new, autojunk=False).get_opcodes():
        if op == 'equal':
            continue
        pairs = min(i2 - i1, j2 - j1) if op == 'replace' else 0
        gone = []
        for k in range(pairs):
            a, b = old[i1 + k], new[j1 + k]
            # a paragraph that changed only a little shows word by word; one that was rewritten shows as
            # one deleted paragraph and one new one, or the review pane becomes a mash of single words
            if difflib.SequenceMatcher(None, tokens(a), tokens(b), autojunk=False).ratio() >= SIMILAR:
                rebuild(new_ps[j1 + k], a, b, rev)
            else:
                mark_inserted(new_ps[j1 + k], rev)
                gone.append((new_ps[j1 + k], a))
        for k in range(j1 + pairs, j2):
            mark_inserted(new_ps[k], rev)
        anchor = new_ps[j2 - 1] if j2 > j1 else (new_ps[j1 - 1] if j1 > 0 else None)
        at = list(body).index(anchor) + 1 if anchor is not None else 0
        for k in range(i1 + pairs, i2):
            if old[k].strip():
                body.insert(at, deleted_para(old[k], anchor, rev)); at += 1
        for p_new, a in gone:
            if a.strip():
                body.insert(list(body).index(p_new), deleted_para(a, p_new, rev))
    files['word/document.xml'] = ET.tostring(root, xml_declaration=True, encoding='UTF-8', standalone=True)
    with zipfile.ZipFile(out_path, 'w', zipfile.ZIP_DEFLATED) as z:
        for n, data in files.items():
            z.writestr(n, data)
    return rev.n - 1000


if __name__ == '__main__':
    a = sys.argv[1:]
    author = a[a.index('--author') + 1] if '--author' in a else 'מיכאל פרייליך'
    date = a[a.index('--date') + 1] if '--date' in a else '2026-10-24'
    n = track(a[0], a[1], a[2], author, date)
    print('revisions:', n)
