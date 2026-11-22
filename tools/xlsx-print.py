#!/usr/bin/env python3
"""Print setup of a filled Excel form before it becomes a PDF (22/11/2026, Michael on form 33.01 in the circular-saw
training package: no page number, the table not centred, a big gap on top and 9 empty rows at the bottom).

Usage: python3 tools/xlsx-print.py <in.xlsx> <out.xlsx> [--landscape]
For every worksheet: centred on the page left/right and top/bottom, fit to one page wide, a footer "page &P of &N"
when the sheet has no page number yet (the header the form already has, logo included, is kept), and the print area
cut to the last row and column that hold a value (empty rows at the end are not printed). Prints one JSON line.
A .xls is first turned into .xlsx with soffice (the same as tools/form-fill.py does for .doc).
Then: od_put_pdf the .xlsx, routine-db op od_pdf, and tools/pdf-visual-check.py on the PDF."""
import argparse, json, os, re, shutil, subprocess, sys, tempfile, zipfile

from lxml import etree

S = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'
R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
q = lambda t: '{%s}%s' % (S, t)
# CT_Worksheet child order (ECMA-376): an element has to sit before the first of the ones listed after it
ORDER = ['sheetPr', 'dimension', 'sheetViews', 'sheetFormatPr', 'cols', 'sheetData', 'sheetCalcPr', 'sheetProtection',
         'protectedRanges', 'scenarios', 'autoFilter', 'sortState', 'dataConsolidate', 'customSheetViews', 'mergeCells',
         'phoneticPr', 'conditionalFormatting', 'dataValidations', 'hyperlinks', 'printOptions', 'pageMargins', 'pageSetup',
         'headerFooter', 'rowBreaks', 'colBreaks', 'customProperties', 'cellWatches', 'ignoredErrors', 'smartTags', 'drawing',
         'legacyDrawing', 'legacyDrawingHF', 'picture', 'oleObjects', 'controls', 'webPublishItems', 'tableParts', 'extLst']
FOOTER = '&Cעמוד &P מתוך &N'


def child(ws, tag):
    el = ws.find(q(tag))
    if el is None:
        el = etree.Element(q(tag))
        later = ORDER[ORDER.index(tag) + 1:]
        nxt = next((c for c in ws if isinstance(c.tag, str) and c.tag.split('}')[1] in later), None)
        if nxt is not None:
            nxt.addprevious(el)
        else:
            ws.append(el)
    return el


def col_num(ref):
    n = 0
    for ch in re.match(r'[A-Z]+', ref).group(0):
        n = n * 26 + ord(ch) - 64
    return n


def col_name(n):
    s = ''
    while n:
        n, r = divmod(n - 1, 26)
        s = chr(65 + r) + s
    return s


def used(ws):
    """(last row, last column) that hold a value; formatting alone does not count."""
    lr = lc = 0
    for c in ws.iter(q('c')):
        v, t = c.find(q('v')), c.find(q('is'))
        if (v is not None and (v.text or '').strip()) or (t is not None and ''.join(t.itertext()).strip()):
            ref = c.get('r') or ''
            m = re.match(r'([A-Z]+)(\d+)', ref)
            if m:
                lr, lc = max(lr, int(m.group(2))), max(lc, col_num(ref))
    for mc in ws.iter(q('mergeCell')):
        m = re.match(r'([A-Z]+)(\d+):([A-Z]+)(\d+)', mc.get('ref') or '')
        if m and int(m.group(2)) <= lr:
            lc = max(lc, col_num(m.group(3)))
    return lr, lc


def fix_sheet(ws, landscape):
    done = []
    po = child(ws, 'printOptions')
    po.set('horizontalCentered', '1')
    po.set('verticalCentered', '1')
    done.append('centred')
    sp = child(ws, 'sheetPr')
    psp = sp.find(q('pageSetUpPr'))
    if psp is None:
        psp = etree.SubElement(sp, q('pageSetUpPr'))  # the last child of sheetPr, after tabColor and outlinePr
    psp.set('fitToPage', '1')
    ps = child(ws, 'pageSetup')
    ps.set('fitToWidth', '1')
    ps.set('fitToHeight', '0')
    if landscape:
        ps.set('orientation', 'landscape')
    for a in ('scale',):
        if ps.get(a):
            del ps.attrib[a]
    done.append('fit to width')
    hf = ws.find(q('headerFooter'))
    has_page = hf is not None and '&P' in ''.join(hf.itertext())
    if not has_page:
        hf = child(ws, 'headerFooter')
        of = hf.find(q('oddFooter'))
        if of is None:
            of = etree.Element(q('oddFooter'))
            oh = hf.find(q('oddHeader'))
            if oh is not None:
                oh.addnext(of)
            else:
                hf.insert(0, of)
        of.text = (of.text or '') + FOOTER if '&C' not in (of.text or '') else FOOTER
        done.append('page X of Y footer')
    return done


def main(argv=None):
    ap = argparse.ArgumentParser()
    ap.add_argument('src')
    ap.add_argument('dst')
    ap.add_argument('--landscape', action='store_true')
    a = ap.parse_args(argv)
    work = tempfile.mkdtemp(prefix='xlsx-print-')
    try:
        src = a.src
        if src.lower().endswith('.xls'):
            exe = shutil.which('soffice') or shutil.which('libreoffice')
            if not exe:
                print(json.dumps({'ok': False, 'error': 'a .xls needs soffice to become .xlsx'}))
                return 1
            subprocess.run([exe, '--headless', '--convert-to', 'xlsx', '--outdir', work, src], capture_output=True, timeout=180)
            src = os.path.join(work, os.path.splitext(os.path.basename(src))[0] + '.xlsx')
        with zipfile.ZipFile(src) as z:
            wb = etree.fromstring(z.read('xl/workbook.xml'))
            rels = etree.fromstring(z.read('xl/_rels/workbook.xml.rels'))
            target = {r.get('Id'): 'xl/' + r.get('Target').lstrip('/').replace('xl/', '', 1) for r in rels}
            sheets = [(s.get('name'), target[s.get('{%s}id' % R)], i) for i, s in enumerate(wb.iter(q('sheet')))]
            parts = {path: etree.fromstring(z.read(path)) for _, path, _ in sheets}
        report = []
        dn = wb.find(q('definedNames'))
        for name, path, idx in sheets:
            ws = parts[path]
            done = fix_sheet(ws, a.landscape)
            lr, lc = used(ws)
            if lr and lc:
                if dn is None:
                    dn = etree.Element(q('definedNames'))
                    after = wb.find(q('sheets'))
                    after.addnext(dn)
                for d in dn.findall(q('definedName')):
                    if d.get('name') == '_xlnm.Print_Area' and d.get('localSheetId') == str(idx):
                        dn.remove(d)
                d = etree.SubElement(dn, q('definedName'))
                d.set('name', '_xlnm.Print_Area')
                d.set('localSheetId', str(idx))
                d.text = "'%s'!$A$1:$%s$%d" % (name.replace("'", "''"), col_name(lc), lr)
                done.append('print area A1:%s%d' % (col_name(lc), lr))
            report.append({'sheet': name, 'done': done})
        ser = lambda r: etree.tostring(r, xml_declaration=True, encoding='UTF-8', standalone=True)
        with zipfile.ZipFile(src) as zin, zipfile.ZipFile(a.dst, 'w', zipfile.ZIP_DEFLATED) as zout:
            for it in zin.infolist():
                data = zin.read(it.filename)
                if it.filename in parts:
                    data = ser(parts[it.filename])
                elif it.filename == 'xl/workbook.xml':
                    data = ser(wb)
                zout.writestr(it, data)
        print(json.dumps({'ok': True, 'out': a.dst, 'sheets': report}, ensure_ascii=False))
        return 0
    except (KeyError, zipfile.BadZipFile, etree.XMLSyntaxError, OSError) as e:
        print(json.dumps({'ok': False, 'error': str(e)}))
        return 1
    finally:
        shutil.rmtree(work, ignore_errors=True)


if __name__ == '__main__':
    sys.exit(main())
