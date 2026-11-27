#!/usr/bin/env python3
"""Fill the factory's CONTROLLED Word form instead of building a document (01/11/2026, Michael: the assistant and a
session built training form 08.01 from scratch twice and lost the factory logo and header, and once gave only a PDF).

Usage: python3 tools/form-fill.py --template <form.doc|form.docx> --spec <spec.json> --out <dir/name-without-ext>

The template is the form as it lies in the safety folder (tools/od-get.sh fetches it). A .doc goes through
soffice --convert-to docx. Tracked changes are always accepted first (project-files/doc-review/accept_docx.py):
old forms keep their text inside w:ins, which python-docx does not see.

spec.json (every key optional):
  "cells":       [{"label": "<text of a cell>", "value": "...", "side": "next"|"prev", "nth": 0}]
                 the value goes into the cell beside the label in the same row. "next" (default) = the next cell in
                 document order, which in an RTL table (bidiVisual) is the one to the LEFT of the label and in an LTR
                 table the one to the right; when the label is the last cell of its row, the previous one is used.
  "table_cells": [{"table": i, "row": r, "col": c, "value": "..."}]  exact placement (body tables, real cells).
  "rows":        {"header_contains": "...", "count": N, "number_col": 0, "data": [[...], ...]}  (or a list of those)
                 extends (or trims) the table whose header row holds that text to N data rows, numbered 1..N.
  "replace_text": [{"find": "...", "value": "..."}]  in body, tables, headers and footers.
  "fit_one_page": true  if the PDF has more pages than the template, the extended rows get an exact height,
                 lowered step by step down to 220 twips, until it fits; else a failure.

Always writes <out>.docx and, when soffice exists, <out>.pdf (a LibreOffice PDF, for the page check and a look; the PDF
to FILE is Microsoft's: upload the .docx with od_put_pdf, then routine-db op od_pdf, DECISIONS 24/10/2026).
Verifies the template's marks survived and exits 1 with a message when not: fewer images (logo lost), the form number
(\\d{2}.\\d{2} in the header) missing, the page-of text missing, or more pages than the template with fit_one_page.
Prints one JSON line: {ok, docx, pdf, pages, images, form_no, ...}."""
import argparse, copy, json, os, re, shutil, subprocess, sys, tempfile, zipfile

from lxml import etree

W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'
NS = {'w': W}
q = lambda t: '{%s}%s' % (W, t)
HERE = os.path.dirname(os.path.abspath(__file__))
ACCEPT = os.path.join(HERE, '..', 'project-files', 'doc-review', 'accept_docx.py')
FORM_NO = re.compile(r'(?<![\d.])\d{2}\.\d{2}(?![\d.])')
PAGE_WORD = '\u05e2\u05de\u05d5\u05d3'  # "page"
MIN_H = 220


class Fail(Exception):
    pass


def soffice():
    return shutil.which('soffice') or shutil.which('libreoffice')


def run_soffice(src, fmt, outdir):
    exe = soffice()
    prof = tempfile.mkdtemp(prefix='lo-')
    try:
        r = subprocess.run([exe, '-env:UserInstallation=file://' + prof, '--headless', '--convert-to', fmt, '--outdir', outdir, src],
                           capture_output=True, text=True, timeout=180)
    finally:
        shutil.rmtree(prof, ignore_errors=True)
    out = os.path.join(outdir, os.path.splitext(os.path.basename(src))[0] + '.' + fmt.split(':')[0])
    if r.returncode != 0 or not os.path.exists(out):
        raise Fail('soffice --convert-to %s failed: %s' % (fmt, (r.stderr or r.stdout)[:300]))
    return out


def pdf_pages(pdf):
    try:
        r = subprocess.run(['pdfinfo', pdf], capture_output=True, text=True, timeout=60)
        m = re.search(r'^Pages:\s+(\d+)', r.stdout, re.M)
        if m:
            return int(m.group(1))
    except (OSError, subprocess.SubprocessError):
        pass
    with open(pdf, 'rb') as f:
        return len(re.findall(rb'/Type\s*/Page(?!s)', f.read())) or None


def pdf_images(pdf):
    if not shutil.which('pdfimages'):
        return None
    r = subprocess.run(['pdfimages', '-list', pdf], capture_output=True, text=True, timeout=60)
    return max(0, len(r.stdout.strip().splitlines()) - 2)


def parts_xml(docx):
    """{part name: root} for the document, headers and footers."""
    out = {}
    with zipfile.ZipFile(docx) as z:
        for n in z.namelist():
            if re.match(r'word/(document|header\d*|footer\d*|styles)\.xml$', n):
                out[n] = etree.fromstring(z.read(n))
    return out


def para_texts(root):
    return [''.join(p.itertext()) for p in root.iter(q('p'))]


def marks(docx):
    """What a filled form must keep from its template: images, the form number in the header, the page-of text."""
    px = parts_xml(docx)
    images = 0
    for root in px.values():
        images += len(root.xpath('.//*[local-name()="blip"]')) + len(root.xpath('.//*[local-name()="imagedata"]'))
    head_text = '\n'.join(t for n, r in px.items() if not n.endswith('document.xml') for t in para_texts(r))
    doc = px.get('word/document.xml')
    first_tbl = ''
    if doc is not None:
        t = doc.find('.//' + q('tbl'))
        if t is not None:
            first_tbl = '\n'.join(para_texts(t))
    m = FORM_NO.search(head_text) or FORM_NO.search(first_tbl)
    all_text = '\n'.join(t for r in px.values() for t in para_texts(r))
    return {'images': images, 'form_no': m.group(0) if m else None, 'page_word': PAGE_WORD in (head_text + '\n' + first_tbl), 'text': all_text}


def to_docx(template, work):
    src = os.path.join(work, 'src' + os.path.splitext(template)[1].lower())
    shutil.copy(template, src)
    if src.endswith('.doc'):
        if not soffice():
            raise Fail('a .doc template needs soffice to become .docx')
        src = run_soffice(src, 'docx', work)
    elif not src.endswith('.docx'):
        raise Fail('template: a .doc or .docx file')
    acc = os.path.join(work, 'accepted.docx')
    r = subprocess.run([sys.executable, ACCEPT, src, acc], capture_output=True, text=True)
    if r.returncode != 0:
        raise Fail('accepting tracked changes failed: ' + r.stderr[:300])
    return acc, r.stdout.strip()


# ---- cells -------------------------------------------------------------------------------------------------
def tcs(tr):
    return tr.findall(q('tc'))


def cell_text(tc):
    return re.sub(r'\s+', ' ', ''.join(tc.itertext())).strip()


def norm(s):
    return re.sub(r'\s+', ' ', str(s)).strip().rstrip(':').strip()


def set_cell(tc, value):
    """The value into the cell, in the format of its first run (or of the paragraph mark), one paragraph per line."""
    ps = tc.findall(q('p'))
    if not ps:
        ps = [etree.SubElement(tc, q('p'))]
    p0 = ps[0]
    for p in ps[1:]:
        tc.remove(p)
    runs = p0.findall('.//' + q('r'))
    rpr = None
    for r in runs:
        if r.find(q('rPr')) is not None:
            rpr = copy.deepcopy(r.find(q('rPr')))
            break
    if rpr is None:
        mark = p0.find(q('pPr') + '/' + q('rPr'))
        if mark is not None:
            rpr = copy.deepcopy(mark)
            rpr.tag = q('rPr')
    for ch in list(p0):
        if ch.tag != q('pPr'):
            p0.remove(ch)
    lines = fix_value(value).split('\n')
    for i, line in enumerate(lines):
        p = p0 if i == 0 else copy.deepcopy(p0)
        if i:
            for ch in list(p):
                if ch.tag != q('pPr'):
                    p.remove(ch)
            tc.append(p)
        r = etree.SubElement(p, q('r'))
        if rpr is not None:
            r.append(copy.deepcopy(rpr))
        t = etree.SubElement(r, q('t'))
        t.text = line
        t.set('{http://www.w3.org/XML/1998/namespace}space', 'preserve')


def body_tables(doc):
    body = doc.find(q('body'))
    return body.findall(q('tbl'))


def all_tables(doc):
    return list(doc.iter(q('tbl')))


def fill_cells(doc, cells, log):
    for c in cells:
        label = norm(c['label'])
        side = c.get('side', 'next')
        found = []
        for tbl in all_tables(doc):
            for tr in tbl.findall(q('tr')):
                row = tcs(tr)
                for i, tc in enumerate(row):
                    if norm(cell_text(tc)) == label:
                        found.append((row, i))
        nth = int(c.get('nth', 0))
        if len(found) <= nth:
            raise Fail('cells: no cell with the text "%s" (label not found)' % c['label'])
        row, i = found[nth]
        j = i + 1 if side == 'next' else i - 1
        if not 0 <= j < len(row):
            j = i - 1 if side == 'next' else i + 1
        if not 0 <= j < len(row):
            raise Fail('cells: "%s" has no cell beside it' % c['label'])
        set_cell(row[j], c['value'])
        log.append('cell "%s"' % label)


def fill_table_cells(doc, items, log):
    tbls = body_tables(doc)
    for c in items:
        try:
            tc = tcs(tbls[int(c['table'])].findall(q('tr'))[int(c['row'])])[int(c['col'])]
        except (IndexError, KeyError, ValueError):
            raise Fail('table_cells: no cell table %s row %s col %s' % (c.get('table'), c.get('row'), c.get('col')))
        set_cell(tc, c['value'])
        log.append('table %s row %s col %s' % (c['table'], c['row'], c['col']))


# ---- rows --------------------------------------------------------------------------------------------------
def set_height(tr, twips):
    trpr = tr.find(q('trPr'))
    if trpr is None:
        trpr = etree.Element(q('trPr'))
        at = 1 if tr.find(q('tblPrEx')) is not None else 0
        tr.insert(at, trpr)
    h = trpr.find(q('trHeight'))
    if h is None:
        h = etree.SubElement(trpr, q('trHeight'))
    h.set(q('val'), str(int(twips)))
    h.set(q('hRule'), 'exact')


def row_height(tr):
    h = tr.find(q('trPr') + '/' + q('trHeight'))
    try:
        return int(h.get(q('val'))) if h is not None else None
    except (TypeError, ValueError):
        return None


def extend_rows(doc, spec):
    want = norm(spec['header_contains'])
    count = int(spec['count'])
    if count < 1 or count > 500:
        raise Fail('rows: count 1-500')
    ncol = int(spec.get('number_col', 0))
    for tbl in all_tables(doc):
        trs = tbl.findall(q('tr'))
        hi = next((k for k, tr in enumerate(trs[:4]) if want in norm(''.join(tr.itertext()))), None)
        if hi is None:
            continue
        data = trs[hi + 1:]
        if not data:
            raise Fail('rows: the table under "%s" has no data row to copy' % spec['header_contains'])
        while len(data) > count:
            tbl.remove(data.pop())
        while len(data) < count:
            new = copy.deepcopy(data[-1])
            data[-1].addnext(new)
            data.append(new)
        rows_data = spec.get('data') or []
        for k, tr in enumerate(data):
            row = tcs(tr)
            vals = rows_data[k] if k < len(rows_data) else []
            for ci, tc in enumerate(row):
                if ci == ncol and ncol >= 0:
                    set_cell(tc, str(k + 1))
                else:
                    vi = ci if ncol < 0 or ci < ncol else ci - 1
                    set_cell(tc, vals[vi] if vi < len(vals) else '')
        return data
    raise Fail('rows: no table with a header containing "%s"' % spec['header_contains'])


# ---- text --------------------------------------------------------------------------------------------------
def replace_in(root, find, value):
    n = 0
    for p in root.iter(q('p')):
        ts = p.findall('.//' + q('t'))
        full = ''.join(t.text or '' for t in ts)
        if find not in full:
            continue
        one = [t for t in ts if find in (t.text or '')]
        if one:
            for t in one:
                n += (t.text or '').count(find)
                t.text = t.text.replace(find, value)
        else:
            n += full.count(find)
            ts[0].text = full.replace(find, value)
            for t in ts[1:]:
                t.text = ''
        for t in ts:
            t.set('{http://www.w3.org/XML/1998/namespace}space', 'preserve')
    return n


# ---- main --------------------------------------------------------------------------------------------------
def write_docx(src, dst, px, extra=None):
    """extra: {part name: root} written as well (new parts, or rels / content types that replace the template's)."""
    extra = extra or {}
    ser = lambda r: etree.tostring(r, xml_declaration=True, encoding='UTF-8', standalone=True)
    with zipfile.ZipFile(src) as zin, zipfile.ZipFile(dst, 'w', zipfile.ZIP_DEFLATED) as zout:
        names = set()
        for item in zin.infolist():
            data = zin.read(item.filename)
            if item.filename in px:
                data = ser(px[item.filename])
            elif item.filename in extra:
                data = ser(extra[item.filename])
            zout.writestr(item, data)
            names.add(item.filename)
        for n, r in extra.items():
            if n not in names:
                zout.writestr(n, ser(r))


# ---- polish (22/11/2026, Michael on the training package sent to the department manager: page 1 said "page 2 of 2",
# page 2 had no header or logo, a heading alone at the bottom of page 1, David / Times beside Arial, ":signature",
# 22.11.2026). Every Word file this tool writes gets these; tools/pdf-visual-check.py then checks the PDF. -------------
R_NS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
PKG = 'http://schemas.openxmlformats.org/package/2006/relationships'
CT_NS = 'http://schemas.openxmlformats.org/package/2006/content-types'
HDR_CT = 'application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml'
HDR_REL = R_NS + '/header'
STATIC_PAGE_OF = re.compile('^(.*?)' + PAGE_WORD + r'\s*(\d+)\s*\u05de\u05ea\u05d5\u05da\s*(\d+)(.*)$', re.S)
HEADING = re.compile(r'^\s*\d{1,2}(\.\d{1,2})*\s*\.?\s+\S')
DOT_DATE = re.compile(r'(?<![\d.])(\d{1,2})\.(\d{1,2})\.(\d{4})(?![\d.])')
HEB = re.compile('[\u0590-\u05ff]')


def fix_value(v):
    """A value written into the form: dates DD/MM/YYYY, and a colon / dot typed at the start of Hebrew text moved to its end."""
    out = []
    for line in str(v).split('\n'):
        line = DOT_DATE.sub(r'\1/\2/\3', line)
        m = re.match(r'^\s*([:.,;])\s*(.+)$', line)
        if m and HEB.search(m.group(2)):
            line = m.group(2).rstrip() + m.group(1)
        out.append(line)
    return '\n'.join(out)


def arial(px):
    """Every font in the document, headers, footers and styles = Arial (David is not on an iPhone, Times looks foreign)."""
    n = 0
    for root in px.values():
        for f in root.iter(q('rFonts')):
            for k in ('ascii', 'hAnsi', 'cs', 'eastAsia'):
                if f.get(q(k)) not in (None, 'Arial'):
                    f.set(q(k), 'Arial')
                    n += 1
            for k in ('asciiTheme', 'hAnsiTheme', 'cstheme', 'eastAsiaTheme'):
                if f.get(q(k)) is not None:
                    del f.attrib[q(k)]
                    f.set(q(k.replace('Theme', '').replace('cstheme', 'cs')), 'Arial')
                    n += 1
    return n


def _run(rpr, text=None, fld=None):
    if fld:
        el = etree.Element(q('fldSimple'))
        el.set(q('instr'), ' %s ' % fld)
        r = etree.SubElement(el, q('r'))
    else:
        el = r = etree.Element(q('r'))
    if rpr is not None:
        r.append(copy.deepcopy(rpr))
    t = etree.SubElement(r, q('t'))
    t.text = text if text is not None else '1'
    t.set('{http://www.w3.org/XML/1998/namespace}space', 'preserve')
    return el


def page_fields(px):
    """A typed "page X of Y" becomes PAGE / NUMPAGES fields, so every page says its own number."""
    n = 0
    for root in px.values():
        for p in root.iter(q('p')):
            if p.find('.//' + q('fldSimple')) is not None or p.find('.//' + q('instrText')) is not None:
                continue
            full = ''.join(t.text or '' for t in p.iter(q('t')))
            m = STATIC_PAGE_OF.match(full)
            if not m:
                continue
            r0 = p.find('.//' + q('r'))
            rpr = r0.find(q('rPr')) if r0 is not None else None
            for ch in list(p):
                if ch.tag != q('pPr'):
                    p.remove(ch)
            for el in (_run(rpr, m.group(1) + PAGE_WORD + ' '), _run(rpr, m.group(2), 'PAGE'), _run(rpr, ' \u05de\u05ea\u05d5\u05da '),
                       _run(rpr, m.group(3), 'NUMPAGES'), _run(rpr, m.group(4)) if m.group(4) else None):
                if el is not None:
                    p.append(el)
            n += 1
    return n


def keep_headings(doc):
    """A numbered section heading in the body keeps with the paragraph after it (no heading alone at a page's foot)."""
    n = 0
    body = doc.find(q('body'))
    for p in body.findall(q('p')):
        t = ''.join(x.text or '' for x in p.iter(q('t'))).strip()
        if not t or not HEADING.match(t) or len(t.split()) > 8:
            continue
        ppr = p.find(q('pPr'))
        if ppr is None:
            ppr = etree.Element(q('pPr'))
            p.insert(0, ppr)
        if ppr.find(q('keepNext')) is None:
            k = etree.Element(q('keepNext'))
            at = 1 if ppr.find(q('pStyle')) is not None else 0
            ppr.insert(at, k)
            n += 1
    return n


PPR_AFTER_BIDI = ('adjustRightInd', 'snapToGrid', 'spacing', 'ind', 'contextualSpacing', 'mirrorIndents', 'suppressOverlap', 'jc',
                  'textDirection', 'textAlignment', 'textboxTightWrap', 'outlineLvl', 'divId', 'cnfStyle', 'rPr', 'sectPr', 'pPrChange')
STRONG = re.compile('[A-Za-z\u0590-\u05ff]')


def rtl_paras(px):
    """A paragraph whose text starts in Hebrew but has no RTL direction shows its colon / dot on the wrong side
    (":signature"); it gets w:bidi."""
    n = 0
    for name, root in px.items():
        if name.endswith('styles.xml'):
            continue
        for p in root.iter(q('p')):
            t = ''.join(x.text or '' for x in p.iter(q('t')))
            m = STRONG.search(t)
            if not m or not HEB.match(m.group(0)):
                continue
            ppr = p.find(q('pPr'))
            if ppr is None:
                ppr = etree.Element(q('pPr'))
                p.insert(0, ppr)
            if ppr.find(q('bidi')) is not None:
                continue
            # an LTR paragraph aligned right that becomes RTL: Word shows jc="right" of an RTL paragraph on the LEFT
            # (lesson 317; 23/11/2026, weekly training on 08.01 sent left to right). RTL start = right, so no jc.
            for jc in ppr.findall(q('jc')):
                if jc.get(q('val')) in ('right', 'left'):
                    ppr.remove(jc)
            b = etree.Element(q('bidi'))
            after = next((ch for ch in ppr if isinstance(ch.tag, str) and ch.tag.split('}')[1] in PPR_AFTER_BIDI), None)
            if after is not None:
                after.addprevious(b)
            else:
                ppr.append(b)
            n += 1
    return n


SECT_AFTER_TITLEPG = ('textDirection', 'bidi', 'rtlGutter', 'docGrid', 'printerSettings', 'sectPrChange')


def repeat_header(src, px):
    """The header table sits at the top of the body (31/10/2026: a phone preview does not show Word's header), so
    pages 2.. had no header, no logo and no page number. Copy it into Word's header for pages 2.. (first page: an empty
    header, the body copy is there), images and all. Returns the extra parts for write_docx, or None when not needed."""
    doc = px['word/document.xml']
    if any(not n.endswith(('document.xml', 'styles.xml')) and r.xpath('.//*[local-name()="blip"]') for n, r in px.items()):
        return None
    body = doc.find(q('body'))
    tbl = next((ch for ch in body if ch.tag == q('tbl')), None)
    if tbl is None or not tbl.xpath('.//*[local-name()="blip"]') or PAGE_WORD not in ''.join(tbl.itertext()):
        return None
    with zipfile.ZipFile(src) as z:
        rels = etree.fromstring(z.read('word/_rels/document.xml.rels'))
        ct = etree.fromstring(z.read('[Content_Types].xml'))
    by_id = {r.get('Id'): r for r in rels}
    hdr_rels = etree.Element('{%s}Relationships' % PKG, nsmap={None: PKG})
    copy_t = copy.deepcopy(tbl)
    for el in copy_t.iter():
        for k, v in el.attrib.items():
            if k.startswith('{%s}' % R_NS) and v in by_id and hdr_rels.find('*[@Id="%s"]' % v) is None:
                hdr_rels.append(copy.deepcopy(by_id[v]))
    nsmap = {'w': W, 'r': R_NS}

    def hdr(content):
        h = etree.Element(q('hdr'), nsmap=nsmap)
        for c in content:
            h.append(c)
        h.append(etree.Element(q('p')))
        return h
    ids = [r.get('Id') for r in rels]
    rid = lambda base: next(base + str(k) for k in range(1, 999) if base + str(k) not in ids)
    rid_d, rid_f = rid('rIdFfH'), rid('rIdFfF')
    for i_, t_ in ((rid_d, 'header-ff2.xml'), (rid_f, 'header-ff1.xml')):
        r = etree.SubElement(rels, '{%s}Relationship' % PKG)
        r.set('Id', i_); r.set('Type', HDR_REL); r.set('Target', t_)
    for part in ('/word/header-ff2.xml', '/word/header-ff1.xml'):
        o = etree.SubElement(ct, '{%s}Override' % CT_NS)
        o.set('PartName', part); o.set('ContentType', HDR_CT)
    for sp in doc.iter(q('sectPr')):
        for hr in sp.findall(q('headerReference')):
            if hr.get(q('type')) in ('default', 'first', None):
                sp.remove(hr)
        for typ, i_ in (('first', rid_f), ('default', rid_d)):
            hr = etree.Element(q('headerReference'))
            hr.set(q('type'), typ); hr.set('{%s}id' % R_NS, i_)
            sp.insert(0, hr)
        fd = next((f for f in sp.findall(q('footerReference')) if f.get(q('type')) in ('default', None)), None)
        if fd is not None and not any(f.get(q('type')) == 'first' for f in sp.findall(q('footerReference'))):
            ff = copy.deepcopy(fd); ff.set(q('type'), 'first'); fd.addnext(ff)
        if sp.find(q('titlePg')) is None:
            tp = etree.Element(q('titlePg'))
            after = next((ch for ch in sp if ch.tag.split('}')[1] in SECT_AFTER_TITLEPG), None)
            if after is not None:
                after.addprevious(tp)
            else:
                sp.append(tp)
    return {'word/header-ff2.xml': hdr([copy_t]), 'word/header-ff1.xml': hdr([]),
            'word/_rels/header-ff2.xml.rels': hdr_rels, 'word/_rels/document.xml.rels': rels, '[Content_Types].xml': ct}


def bidi_jc_right(px):
    """Paragraphs that are RTL (w:bidi) and also jc="right": Word draws them on the LEFT (23/11/2026)."""
    n = 0
    for name, root in px.items():
        if name.endswith('styles.xml'):
            continue
        for ppr in root.iter(q('pPr')):
            if ppr.find(q('bidi')) is not None and any(j.get(q('val')) == 'right' for j in ppr.findall(q('jc'))):
                n += 1
    return n


def head_logo(px):
    """An image in the form header: in a Word header part, or in the first table of the body (the header table copied
    to the top of the body, 31/10/2026). Footer images do not count (23/11/2026: only the footer logos were left)."""
    for n, r in px.items():
        if re.search(r'word/header[^/]*\.xml$', n) and r.xpath('.//*[local-name()="blip" or local-name()="imagedata"]'):
            return True
    doc = px.get('word/document.xml')
    body = doc.find(q('body')) if doc is not None else None
    if body is None:
        return False
    first = next((ch for ch in body if ch.tag in (q('tbl'), q('p')) and (ch.tag == q('tbl') or ''.join(ch.itertext()).strip())), None)
    return first is not None and first.tag == q('tbl') and bool(first.xpath('.//*[local-name()="blip" or local-name()="imagedata"]'))


def lint(before_px, after_px):
    """Word-side checks a LibreOffice preview hides: the header logo kept, no new RTL paragraph with jc=right."""
    errs = []
    if head_logo(before_px) and not head_logo(after_px):
        errs.append('header logo lost / \u05d4\u05dc\u05d5\u05d2\u05d5 \u05d1\u05db\u05d5\u05ea\u05e8\u05ea \u05d4\u05e2\u05dc\u05d9\u05d5\u05e0\u05d4 \u05d7\u05e1\u05e8')
    b, a = bidi_jc_right(before_px), bidi_jc_right(after_px)
    if a > b:
        errs.append('%d RTL paragraphs with jc=right (Word shows them on the left) / \u05e4\u05e1\u05e7\u05d0\u05d5\u05ea \u05e9\u05d9\u05e6\u05d0\u05d5 \u05de\u05e9\u05de\u05d0\u05dc' % (a - b))
    return errs


def polish(src, px, log):
    """All the fixes; returns the extra parts for write_docx."""
    extra = repeat_header(src, px)
    if extra:
        log.append('header repeated on every page')
    # the header copies first, so their page text becomes fields too
    parts = dict(px)
    for n, r in (extra or {}).items():
        if n.startswith('word/header-ff'):
            parts[n] = r
    for name, n in (('fonts to Arial', arial(parts)), ('page fields', page_fields(parts)), ('RTL paragraphs', rtl_paras(parts)), ('headings kept with next', keep_headings(px['word/document.xml']))):
        if n:
            log.append('%s x%d' % (name, n))
    return extra


def visual_check(pdf, expect):
    """tools/pdf-visual-check.py on the PDF; returns the problems (Hebrew lines), [] when clean or not checkable here."""
    tool = os.path.join(HERE, 'pdf-visual-check.py')
    if not (shutil.which('pdftotext') and os.path.exists(tool)):
        return []
    ef = None
    try:
        args = [sys.executable, tool, pdf, '--json']
        if expect:
            fd, ef = tempfile.mkstemp(suffix='.txt')
            with os.fdopen(fd, 'w', encoding='utf-8') as f:
                f.write('\n'.join(expect))
            args += ['--expect', ef]
        r = subprocess.run(args, capture_output=True, text=True, timeout=300)
        js = json.loads(r.stdout.strip().splitlines()[-1]) if r.stdout.strip() else {}
        return [x['msg'] for x in js.get('problems') or []] if isinstance(js.get('problems'), list) else []
    except (OSError, ValueError, subprocess.SubprocessError):
        return []
    finally:
        if ef:
            os.unlink(ef)


def main(argv=None):
    ap = argparse.ArgumentParser(description='Fill a controlled Word form from a JSON spec; Word + PDF; verify the template marks.')
    ap.add_argument('--template', required=True)
    ap.add_argument('--spec', required=True)
    ap.add_argument('--out', required=True, help='dir/name without extension')
    a = ap.parse_args(argv)
    summary = {'ok': False, 'docx': None, 'pdf': None, 'pages': None, 'images': None, 'form_no': None}
    work = tempfile.mkdtemp(prefix='form-fill-')
    try:
        with open(a.spec, encoding='utf-8') as f:
            spec = json.load(f)
        acc, accepted = to_docx(a.template, work)
        summary['accepted'] = accepted
        before = marks(acc)
        px = parts_xml(acc)
        doc = px['word/document.xml']
        log = []
        fill_cells(doc, spec.get('cells') or [], log)
        fill_table_cells(doc, spec.get('table_cells') or [], log)
        rs = spec.get('rows') or []
        rs = [rs] if isinstance(rs, dict) else rs
        extended = []
        for r in rs:
            extended += extend_rows(doc, r)
        for r in spec.get('replace_text') or []:
            n = sum(replace_in(root, r['find'], r['value']) for root in px.values())
            if not n:
                raise Fail('replace_text: "%s" not found' % r['find'])
            log.append('replace "%s" x%d' % (r['find'], n))
        extra = polish(acc, px, log) if spec.get('polish', True) else None
        out = os.path.abspath(a.out)
        os.makedirs(os.path.dirname(out), exist_ok=True)
        docx = out + '.docx'
        write_docx(acc, docx, px, extra)
        summary['docx'] = docx
        summary['filled'] = len(log)
        after = marks(docx)
        summary['images'] = after['images']
        summary['form_no'] = before['form_no']
        errs = []
        if after['images'] < before['images']:
            errs.append('logo lost / \u05d4\u05dc\u05d5\u05d2\u05d5 \u05d0\u05d1\u05d3: images %d < template %d' % (after['images'], before['images']))
        if before['form_no'] and before['form_no'] not in after['text']:
            errs.append('form number %s missing / \u05de\u05e1\u05e4\u05e8 \u05d4\u05d8\u05d5\u05e4\u05e1 \u05d7\u05e1\u05e8' % before['form_no'])
        errs += lint(parts_xml(acc), parts_xml(docx))
        if before['page_word'] and PAGE_WORD not in after['text']:
            errs.append('page header text missing / \u05d4\u05db\u05d5\u05ea\u05e8\u05ea "\u05e2\u05de\u05d5\u05d3" \u05d7\u05e1\u05e8\u05d4')
        if soffice():
            tpdf = run_soffice(acc, 'pdf', work)
            tpages = pdf_pages(tpdf)
            pdfdir = tempfile.mkdtemp(dir=work)
            pdf = run_soffice(docx, 'pdf', pdfdir)
            pages = pdf_pages(pdf)
            if spec.get('fit_one_page') and extended and tpages and pages and pages > tpages:
                h = min([x for x in (row_height(tr) for tr in extended) if x] or [480])
                while pages > tpages and h > MIN_H:
                    h = max(MIN_H, h - 20)
                    for tr in extended:
                        set_height(tr, h)
                    write_docx(acc, docx, px, extra)
                    pdf = run_soffice(docx, 'pdf', pdfdir)
                    pages = pdf_pages(pdf)
                summary['row_height'] = h
            shutil.copy(pdf, out + '.pdf')
            summary['pdf'] = out + '.pdf'
            summary['pages'] = pages
            summary['template_pages'] = tpages
            ti, oi = pdf_images(tpdf), pdf_images(out + '.pdf')
            if ti is not None and oi is not None and oi < ti:
                errs.append('PDF lost images / \u05ea\u05de\u05d5\u05e0\u05d4 \u05e0\u05e2\u05dc\u05de\u05d4 \u05d1-PDF: %d < template %d' % (oi, ti))
            if spec.get('fit_one_page') and tpages and pages and pages > tpages:
                errs.append('does not fit / \u05dc\u05d0 \u05e0\u05db\u05e0\u05e1: %d pages > template %d (rows already at %d twips)' % (pages, tpages, MIN_H))
            if spec.get('visual', True):
                expect = [fix_value(c.get('value', '')) for c in (spec.get('cells') or []) + (spec.get('table_cells') or [])]
                expect += [fix_value(v) for r in rs for row in (r.get('data') or []) for v in row]
                vis = visual_check(out + '.pdf', [x for x in expect if str(x).strip()])
                summary['visual'] = vis or 'ok'
                errs += ['visual / \u05d1\u05d3\u05d9\u05e7\u05d4 \u05d5\u05d9\u05d6\u05d5\u05d0\u05dc\u05d9\u05ea: ' + v for v in vis]
            summary['pdf_note'] = 'LibreOffice PDF for checking; the PDF to file: od_put_pdf the .docx, then op od_pdf (Microsoft)'
        else:
            summary['pdf_note'] = 'no soffice here: the PDF must be made by the server, od_put_pdf the .docx, then op od_pdf'
            print('NOTE: no soffice, the PDF must be made by the server (routine-db op od_pdf)', file=sys.stderr)
        if errs:
            summary['errors'] = errs
            for e in errs:
                print('FAIL: ' + e, file=sys.stderr)
            print(json.dumps(summary, ensure_ascii=False))
            return 1
        summary['ok'] = True
        print(json.dumps(summary, ensure_ascii=False))
        return 0
    except Fail as e:
        summary['errors'] = [str(e)]
        print('FAIL: ' + str(e), file=sys.stderr)
        print(json.dumps(summary, ensure_ascii=False))
        return 1
    finally:
        shutil.rmtree(work, ignore_errors=True)


if __name__ == '__main__':
    sys.exit(main())
