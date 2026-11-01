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
            if re.match(r'word/(document|header\d*|footer\d*)\.xml$', n):
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
    lines = str(value).split('\n')
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
def write_docx(src, dst, px):
    with zipfile.ZipFile(src) as zin, zipfile.ZipFile(dst, 'w', zipfile.ZIP_DEFLATED) as zout:
        for item in zin.infolist():
            data = zin.read(item.filename)
            if item.filename in px:
                data = etree.tostring(px[item.filename], xml_declaration=True, encoding='UTF-8', standalone=True)
            zout.writestr(item, data)


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
        out = os.path.abspath(a.out)
        os.makedirs(os.path.dirname(out), exist_ok=True)
        docx = out + '.docx'
        write_docx(acc, docx, px)
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
                    write_docx(acc, docx, px)
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
