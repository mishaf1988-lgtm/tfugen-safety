#!/usr/bin/env python3
"""tools/pdf-visual-check.py and the polish in tools/form-fill.py (22/11/2026, Michael on the circular-saw training
package: "go over it visually ... the page numbers, whether everything is centred ... and fix the whole process").
Part 1: analyze() on pages built by hand, one per defect Michael's package had (no poppler needed).
Part 2: form-fill on a Word file built like the assistant built the work instruction (header table with the logo and a
typed "page 2 of 2" at the top of the body, David, ":signature", 22.11.2026, a numbered heading): the header is copied
into Word's header for pages 2.., page fields, Arial, RTL, keepNext, the values fixed.
Part 3 (only with soffice and poppler): a real 2-page PDF with the defects and one without, through the tool.
Usage: python3 tests/harness/pdf-visual-check-test.py"""
import importlib.util, json, os, re, shutil, struct, subprocess, sys, tempfile, zipfile, zlib, base64

HERE = os.path.dirname(os.path.abspath(__file__))
TOOLS = os.path.join(HERE, '..', '..', 'tools')
fails = []
passed = 0
PAGE = 'עמוד'
OF = 'מתוך'
SIGN = 'חתימה'
APPROVAL = 'אישור'


def check(name, ok, info=''):
    global passed
    if ok:
        passed += 1
        print('  ok   ' + name)
    else:
        fails.append(name)
        print('  FAIL ' + name + ('  ' + str(info)[:500] if info else ''))


def load(name, file):
    spec = importlib.util.spec_from_file_location(name, os.path.join(TOOLS, file))
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


def vis(t):
    """How pdftotext gives a Hebrew word: letters in visual order."""
    return t[::-1] if re.search('[֐-׿]', t) else t


def line(text_logical, y, x_right=540, size=12):
    """A line of RTL words laid out from the right, as pdftotext would give them."""
    words, x = [], x_right
    for t in text_logical.split():
        w = 6 * len(t)
        words.append({'t': vis(t), 'x0': x - w, 'x1': x, 'y0': y, 'y1': y + size})
        x -= w + 4
    return {'text': text_logical, 'words': words, 'x0': min(w['x0'] for w in words), 'x1': x_right, 'y0': y, 'y1': y + size}


def page(lines, images=1, fonts=('ArialMT',), **kw):
    p = {'w': 595, 'h': 842, 'lines': lines, 'images': images, 'fonts': list(fonts)}
    p.update(kw)
    return p


def body(n, y0=150):
    return [line('שורת תוכן %d' % k, y0 + 16 * k) for k in range(n)]


def hdr(x, y):
    return line('תפוגן %s %d %s %d' % (PAGE, x, OF, y), 40)


def checks_of(probs):
    return sorted({(p['page'], p['check']) for p in probs})


def part1():
    m = load('pvc', 'pdf-visual-check.py')
    good = [page([hdr(1, 2)] + body(30)), page([hdr(2, 2)] + body(12))]
    check('a clean 2-page document: no problems', m.analyze(good) == [], m.analyze(good))
    # Michael's package, the Word part
    bad = [page([hdr(2, 2)] + body(38) + [line('6. ' + APPROVAL, 770)]),
           page([line(':' + SIGN + ' 22.11.2026', 60)], images=0, fonts=('ArialMT', 'David', 'TimesNewRomanPSMT'))]
    got = checks_of(m.analyze(bad))
    for want, what in (((1, 'page_of'), 'page 1 says "page 2 of 2": fixed text, not a PAGE field'),
                       ((2, 'page_of'), 'page 2 has no page number (no header)'),
                       ((2, 'logo'), 'page 2 has no logo'),
                       ((1, 'orphan'), 'heading "6." alone at the foot of page 1'),
                       ((2, 'empty'), 'page 2 almost empty'),
                       ((2, 'font'), 'David / Times beside Arial'),
                       ((2, 'punct'), '":signature": colon on the wrong side'),
                       ((2, 'date'), '22.11.2026 instead of 22/11/2026')):
        check('caught: ' + what, want in got, got)
    msgs = ' '.join(p['msg'] for p in m.analyze(bad))
    check('messages in Hebrew with the page number', 'עמוד 1:' in msgs and 'PAGE' in msgs, msgs[:200])
    # the Excel part: table off centre, a gap on top, 9 empty rows, cut text
    rules = [300 + 20 * k for k in range(14)]
    tl = [line('בקרות %d' % k, 302 + 20 * k, x_right=380) for k in range(4)]
    cut = dict(tl[0])
    cut['words'] = [dict(w, ink=(0, 40, 12)) for w in tl[0]['words']]
    xls = page([hdr(1, 1), cut] + tl[1:], ink_box=(40, 290, 400, 580), table_box=(40, 300, 400, 560), rules=rules)
    got = checks_of(m.analyze([xls]))
    check('caught: table not centred (margins 40 / 195)', (1, 'centre') in got, got)
    check('caught: 9 empty rows at the end of the table', (1, 'rows') in got, m.analyze([xls]))
    check('caught: a word with no ink at one end (cut by its cell)', (1, 'cut') in got, got)
    gap = page([hdr(1, 1)] + body(5, 400), ink_box=(40, 300, 555, 500))
    check('caught: a big gap on top of the page', (1, 'centre') in checks_of(m.analyze([gap])), m.analyze([gap]))
    rows10 = body(10)
    ok_tbl = page([hdr(1, 1)] + rows10, ink_box=(50, 30, 545, 400), table_box=(50, 148, 545, 312), rules=[ln['y0'] - 2 for ln in rows10] + [rows10[-1]['y1'] + 2])
    check('a centred, full table: no centre / rows problem', not [p for p in m.analyze([ok_tbl]) if p['check'] in ('centre', 'rows')], m.analyze([ok_tbl]))
    over = page([hdr(1, 1), line('אבגד הוזח', 200), line('טקסט אחר', 203)])
    check('caught: two words printed over each other', (1, 'overlap') in checks_of(m.analyze([over])), m.analyze([over]))
    exp = m.analyze([page([hdr(1, 1)] + body(3))], expect=['רמת סיכון שיורית', 'שורת תוכן 1'])
    check('--expect: a header cut out of its cell (words missing from the PDF) is named, a text that is there is not',
          len(exp) == 1 and exp[0]['check'] == 'cut' and 'שיורית' in exp[0]['msg'], exp)
    check('LiberationSans (Arial in LibreOffice) and symbol fonts are fine', not m.analyze([page([hdr(1, 1)] + body(3), fonts=('BAAAAA+LiberationSans', 'OpenSymbol'))]))
    # page X of Y by position, when the paragraph has no RTL direction (the words come in another order)
    ws = [{'t': vis(OF), 'x0': 392, 'x1': 416, 'y0': 49, 'y1': 61}, {'t': '1', 'x0': 419, 'x1': 425, 'y0': 49, 'y1': 61},
          {'t': vis(PAGE), 'x0': 428, 'x1': 451, 'y0': 49, 'y1': 61}, {'t': '3', 'x0': 454, 'x1': 460, 'y0': 49, 'y1': 61}]
    check('page X of Y found by position, not reading order', m.find_page_of([{'text': '3 %s 1 %s' % (PAGE, OF), 'words': ws}]) == (1, 3))
    two = [page([hdr(1, 2)] + body(20)), page([hdr(2, 2)] + body(20)), page([hdr(1, 1)] + body(5))]
    check('a package of two documents (1-2 of 2, then 1 of 1): fine', m.analyze(two) == [], m.analyze(two))
    # 23/11/2026, the weekly training: every Hebrew paragraph laid out left to right (short lines hug the left edge)
    texts = ['הדרכה שבועית בנושא בטיחות', 'שימוש בציוד מגן אישי', 'לפני העבודה בודקים את הכלי', 'דיווח על מפגע למנהל', 'סיכום']
    full = line(' '.join(['מילה'] * 18), 140, x_right=540)
    ltr = []
    for k, t in enumerate(texts):
        ln = line(t, 160 + 20 * k)
        sh = ln['x0'] - full['x0']
        ltr.append(dict(ln, words=[dict(w, x0=w['x0'] - sh, x1=w['x1'] - sh) for w in ln['words']], x0=full['x0'], x1=ln['x1'] - sh))
    got = m.analyze([page([hdr(1, 1), full] + ltr)])
    check('caught: Hebrew paragraphs aligned to the left (direction left to right)', (1, 'dir') in checks_of(got), got)
    check('direction message names the fix (rtl_ooxml / od_pdf)', any('od_pdf' in x['msg'] for x in got if x['check'] == 'dir'), got)
    check('right-aligned Hebrew body: no dir problem', not [x for x in m.analyze([page([hdr(1, 1), full] + body(12))]) if x['check'] == 'dir'])
    cen = []
    for k, t in enumerate(texts):
        ln = line(t, 160 + 20 * k)
        sh = (ln['x0'] + ln['x1']) / 2 - 297
        cen.append(dict(ln, words=[dict(w, x0=w['x0'] - sh, x1=w['x1'] - sh) for w in ln['words']], x0=ln['x0'] - sh, x1=ln['x1'] - sh))
    check('centred Hebrew titles: no dir problem', not [x for x in m.analyze([page([hdr(1, 1), full] + cen)]) if x['check'] == 'dir'])


def png(path):
    raw = b''.join(b'\x00' + b'\xcc\x22\x22' * 40 for _ in range(20))
    chunk = lambda t, d: struct.pack('>I', len(d)) + t + d + struct.pack('>I', zlib.crc32(t + d) & 0xffffffff)
    with open(path, 'wb') as f:
        f.write(b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', 40, 20, 8, 2, 0, 0, 0)) + chunk(b'IDAT', zlib.compress(raw)) + chunk(b'IEND', b''))


def build_instruction(path, logo):
    """Like the assistant built the work instruction: the header table (logo, name, "page 2 of 2" typed) at the top
    of the body, Word's header empty, David, a numbered heading, a signature table."""
    import docx
    from docx.shared import Cm
    from docx.oxml import OxmlElement
    from docx.oxml.ns import qn
    d = docx.Document()
    t = d.add_table(rows=1, cols=3)
    t.cell(0, 0).paragraphs[0].add_run().add_picture(logo, width=Cm(2))
    t.cell(0, 1).text = 'הוראת עבודה מסור עגול'
    t.cell(0, 2).text = '%s 2 %s 2' % (PAGE, OF)
    for k in range(40):
        p = d.add_paragraph('שורת תוכן %d של ההוראה' % k)
        r = p.runs[0]
        rf = OxmlElement('w:rFonts')
        for a in ('w:ascii', 'w:hAnsi', 'w:cs'):
            rf.set(qn(a), 'David')
        r._r.get_or_add_rPr().append(rf)
    d.add_paragraph('6. ' + APPROVAL)
    s = d.add_table(rows=1, cols=2)
    s.cell(0, 0).text = SIGN
    d.save(path)


def part2():
    try:
        import docx  # noqa: F401
    except ImportError:
        print('  skipped: part 2 (no python-docx)')
        return
    ff = load('ff', 'form-fill.py')
    tmp = tempfile.mkdtemp(prefix='pvc-test-')
    try:
        logo = os.path.join(tmp, 'logo.png')
        png(logo)
        tpl = os.path.join(tmp, 'wi.docx')
        build_instruction(tpl, logo)
        spec = {'cells': [{'label': SIGN, 'value': ':שימי 22.11.2026'}], 'visual': False}
        sp = os.path.join(tmp, 's.json')
        with open(sp, 'w', encoding='utf-8') as f:
            json.dump(spec, f, ensure_ascii=False)
        out = os.path.join(tmp, 'out')
        r = subprocess.run([sys.executable, os.path.join(TOOLS, 'form-fill.py'), '--template', tpl, '--spec', sp, '--out', out], capture_output=True, text=True, timeout=600)
        js = json.loads(r.stdout.strip().splitlines()[-1])
        check('form-fill runs green on the work instruction', r.returncode == 0 and js.get('ok'), (r.returncode, r.stderr[-400:], js))
        with zipfile.ZipFile(out + '.docx') as z:
            names = z.namelist()
            doc = z.read('word/document.xml').decode('utf-8')
            h2 = z.read('word/header-ff2.xml').decode('utf-8') if 'word/header-ff2.xml' in names else ''
            h2r = z.read('word/_rels/header-ff2.xml.rels').decode('utf-8') if 'word/_rels/header-ff2.xml.rels' in names else ''
            ct = z.read('[Content_Types].xml').decode('utf-8')
            rels = z.read('word/_rels/document.xml.rels').decode('utf-8')
            styles = z.read('word/styles.xml').decode('utf-8')
        check('the header table is copied into Word\'s header (pages 2..), logo and its image relation with it',
              'blip' in h2 and 'image' in h2r and 'header-ff2.xml' in ct and 'header-ff2.xml' in rels, (h2[:200], h2r))
        sect = re.search(r'<w:sectPr.*?</w:sectPr>', doc, re.S).group(0)
        check('first page: its own empty header (the body copy is there), titlePg on',
              'w:type="first"' in sect and 'w:type="default"' in sect and '<w:titlePg/>' in sect and 'header-ff1.xml' in rels, sect[:300])
        check('the typed "page 2 of 2" became PAGE / NUMPAGES fields, in the body and in the header copy',
              'PAGE ' in doc and 'NUMPAGES' in doc and 'NUMPAGES' in h2 and ('%s 2 %s 2' % (PAGE, OF)) not in doc, doc[doc.find('PAGE') - 200:doc.find('PAGE') + 100])
        check('David gone: every font Arial (document and styles)', 'David' not in doc and 'w:asciiTheme' not in styles, re.findall(r'w:ascii="[^"]+"', doc)[:3])
        hp = re.search(r'<w:p\b(?:(?!<w:p\b).)*?6\. ' + APPROVAL, doc, re.S)
        check('the numbered heading keeps with the next paragraph', hp and '<w:keepNext/>' in hp.group(0), hp.group(0)[:300] if hp else None)
        check('Hebrew paragraphs got RTL direction', doc.count('<w:bidi/>') >= 40, doc.count('<w:bidi/>'))
        check('the value: colon moved to the end, date 22/11/2026', 'שימי 22/11/2026:' in doc, re.findall('שימי[^<]*', doc))
        if shutil.which('soffice') and shutil.which('pdftotext'):
            pv = load('pvc2', 'pdf-visual-check.py')
            pages, _ = pv.extract(out + '.pdf')
            check('the PDF: every page has the logo and its own page number', len(pages) >= 2 and all(p['images'] for p in pages)
                  and [pv.find_page_of(p['lines']) for p in pages] == [(i + 1, len(pages)) for i in range(len(pages))],
                  [(p['images'], pv.find_page_of(p['lines'])) for p in pages])
        else:
            print('  skipped: PDF of part 2 (no soffice / poppler)')
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


FODT = '''<?xml version="1.0" encoding="UTF-8"?>
<office:document xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:style="urn:oasis:names:tc:opendocument:xmlns:style:1.0" xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0" xmlns:draw="urn:oasis:names:tc:opendocument:xmlns:drawing:1.0" xmlns:svg="urn:oasis:names:tc:opendocument:xmlns:svg-compatible:1.0" xmlns:fo="urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0" office:version="1.2" office:mimetype="application/vnd.oasis.opendocument.text">
<office:font-face-decls><style:font-face style:name="F" svg:font-family="'%s'"/></office:font-face-decls>
<office:automatic-styles><style:page-layout style:name="pm1"><style:page-layout-properties fo:page-width="21cm" fo:page-height="29.7cm" fo:margin="2cm"/><style:header-style/></style:page-layout>
<style:style style:name="P" style:family="paragraph"><style:paragraph-properties fo:text-align="end" style:writing-mode="rl-tb"/><style:text-properties style:font-name="F" style:font-name-complex="F" fo:font-size="12pt" style:font-size-complex="12pt"/></style:style></office:automatic-styles>
<office:master-styles>%s</office:master-styles>
<office:body><office:text>%s</office:text></office:body></office:document>'''


def fodt(good, logo_b64):
    P = lambda t: '<text:p text:style-name="P">%s</text:p>' % t
    pg = ('<text:page-number text:select-page="current">1</text:page-number> %s <text:page-count>2</text:page-count>' % OF) if good else '2 %s 2' % OF
    head = '<draw:frame draw:name="l" text:anchor-type="as-char" svg:width="2cm" svg:height="1cm"><draw:image><office:binary-data>%s</office:binary-data></draw:image></draw:frame> תעשיות תפוגן %s %s' % (logo_b64, PAGE, pg)
    rows = ''.join(P('שורת תוכן מספר %d עם טקסט בעברית' % k) for k in range(44 if good else 51))
    rows += P('6. ' + APPROVAL) + P((SIGN + ': 22/11/2026') if good else (':' + SIGN + ' 22.11.2026'))
    if good:
        rows += ''.join(P('שורה %d' % k) for k in range(12))
        master = '<style:master-page style:name="Standard" style:page-layout-name="pm1"><style:header>%s</style:header></style:master-page>' % P(head)
    else:
        rows = P(head) + rows
        master = '<style:master-page style:name="Standard" style:page-layout-name="pm1"/>'
    return FODT % ('Arial' if good else 'David CLM', master, rows)


def part3():
    if not (shutil.which('soffice') and shutil.which('pdftotext') and shutil.which('pdftoppm')):
        print('  skipped: part 3 (no soffice / poppler)')
        return
    tmp = tempfile.mkdtemp(prefix='pvc-real-')
    try:
        logo = os.path.join(tmp, 'logo.png')
        png(logo)
        b64 = base64.b64encode(open(logo, 'rb').read()).decode()
        res = {}
        for name, good in (('good', True), ('bad', False)):
            src = os.path.join(tmp, name + '.fodt')
            with open(src, 'w', encoding='utf-8') as f:
                f.write(fodt(good, b64))
            prof = tempfile.mkdtemp(prefix='lo-')
            subprocess.run(['soffice', '-env:UserInstallation=file://' + prof, '--headless', '--convert-to', 'pdf', '--outdir', tmp, src], capture_output=True, timeout=180)
            shutil.rmtree(prof, ignore_errors=True)
            r = subprocess.run([sys.executable, os.path.join(TOOLS, 'pdf-visual-check.py'), os.path.join(tmp, name + '.pdf'), '--json'], capture_output=True, text=True, timeout=300)
            res[name] = (r.returncode, json.loads(r.stdout.strip().splitlines()[-1]))
        check('a real PDF with the header in Word\'s header, page fields and Arial: exit 0', res['good'][0] == 0 and res['good'][1]['ok'], res['good'])
        got = {(p['page'], p['check']) for p in res['bad'][1].get('problems') or []}
        check('a real PDF like the package: exit 1, wrong page number, no header / logo on page 2, font, colon, date',
              res['bad'][0] == 1 and {(1, 'page_of'), (2, 'logo'), (2, 'page_of'), (2, 'date'), (2, 'punct')} <= got and any(c == 'font' for _, c in got), (res['bad'][0], sorted(got)))
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


def part4():
    """tools/xlsx-print.py on a form like 33.01: a table with 4 filled rows and 9 empty bordered rows under it."""
    try:
        import openpyxl
        from openpyxl.styles import Border, Side
    except ImportError:
        print('  skipped: part 4 (no openpyxl)')
        return
    tmp = tempfile.mkdtemp(prefix='pvc-xlsx-')
    try:
        src, dst = os.path.join(tmp, 'f.xlsx'), os.path.join(tmp, 'g.xlsx')
        wb = openpyxl.Workbook()
        ws = wb.active
        ws.title = "33.01"
        thin = Side(style='thin')
        for r in range(1, 15):
            for c in range(1, 7):
                cell = ws.cell(row=r, column=c)
                cell.border = Border(left=thin, right=thin, top=thin, bottom=thin)
                if r <= 5:
                    cell.value = '\u05e1\u05d9\u05db\u05d5\u05df %d-%d' % (r, c)
        wb.save(src)
        r = subprocess.run([sys.executable, os.path.join(TOOLS, 'xlsx-print.py'), src, dst, '--landscape'], capture_output=True, text=True, timeout=300)
        js = json.loads(r.stdout.strip().splitlines()[-1])
        check('xlsx-print runs green', r.returncode == 0 and js.get('ok'), (r.returncode, r.stderr[-300:], js))
        with zipfile.ZipFile(dst) as z:
            sh = z.read('xl/worksheets/sheet1.xml').decode('utf-8')
            wbx = z.read('xl/workbook.xml').decode('utf-8')
        check('centred both ways, fit to one page wide, landscape', 'horizontalCentered="1"' in sh and 'verticalCentered="1"' in sh and 'fitToPage="1"' in sh and 'fitToWidth="1"' in sh and 'landscape' in sh, sh[-600:])
        check('footer "page &P of &N" added', '&amp;P' in sh and '&amp;N' in sh and '\u05de\u05ea\u05d5\u05da' in sh, sh[-300:])
        check('print area cut to the last filled row (the 9 empty bordered rows are not printed)', "$A$1:$F$5" in wbx, wbx[-300:])
        wb2 = openpyxl.load_workbook(dst)
        check('the result opens again (valid file)', wb2.active['A1'].value == '\u05e1\u05d9\u05db\u05d5\u05df 1-1')
        if shutil.which('soffice') and shutil.which('pdftotext'):
            prof = tempfile.mkdtemp(prefix='lo-')
            subprocess.run(['soffice', '-env:UserInstallation=file://' + prof, '--headless', '--convert-to', 'pdf', '--outdir', tmp, dst], capture_output=True, timeout=180)
            shutil.rmtree(prof, ignore_errors=True)
            pv = load('pvc3', 'pdf-visual-check.py')
            pages, _ = pv.extract(os.path.join(tmp, 'g.pdf'))
            probs = {p['check'] for p in pv.analyze(pages)}
            check('the PDF: page number on the page, table centred, no empty rows', pv.find_page_of(pages[0]['lines']) == (1, 1) and not probs & {'centre', 'rows', 'page_of'}, pv.analyze(pages))
        else:
            print('  skipped: PDF of part 4 (no soffice / poppler)')
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


def main():
    part1()
    part2()
    part3()
    part4()
    print('\npdf-visual-check-test: %d passed, %d failed' % (passed, len(fails)))
    sys.exit(1 if fails else 0)


if __name__ == '__main__':
    main()
