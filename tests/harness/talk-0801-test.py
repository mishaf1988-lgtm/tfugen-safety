#!/usr/bin/env python3
"""tools/talk-0801.py and the Word-side lint in tools/form-fill.py (23/11/2026, Michael: "this is how a form is made,
learn from mistakes"). The weekly training on 08.01 went out (1) left to right: w:bidi together with jc="right", which
Word draws on the LEFT, and (2) without the Tapugan logo column in the header table (footer logos only).
Usage: python3 tests/harness/talk-0801-test.py"""
import importlib.util, json, os, re, shutil, struct, subprocess, sys, tempfile, zipfile, zlib

HERE = os.path.dirname(os.path.abspath(__file__))
TOOLS = os.path.join(HERE, '..', '..', 'tools')
TOOL = os.path.join(TOOLS, 'talk-0801.py')
fails = []
passed = 0
PAGE = 'עמוד'
OF = 'מתוך'
FORM = 'טופס 08.01 תיעוד ביצוע הדרכה'
TOPIC_L = 'נושא ההדרכה'  # training topic
NAME_H = 'שם העובד'
HEAD1 = '1. מה קרה'
HEAD2 = '2. מה עושים'


def check(name, ok, info=''):
    global passed
    if ok:
        passed += 1
        print('  ok   ' + name)
    else:
        fails.append(name)
        print('  FAIL ' + name + ('  ' + str(info)[:500] if info else ''))


def png(path):
    raw = b''.join(b'\x00' + b'\xcc\x22\x22' * 40 for _ in range(20))
    chunk = lambda t, d: struct.pack('>I', len(d)) + t + d + struct.pack('>I', zlib.crc32(t + d) & 0xffffffff)
    with open(path, 'wb') as f:
        f.write(b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', 40, 20, 8, 2, 0, 0, 0)) + chunk(b'IDAT', zlib.compress(raw)) + chunk(b'IEND', b''))


def build(path, logo, head_logo=True):
    """Like 08.01: the header table (logo, form name, page 1 of 1) at the top of the body, a topic row, a participants
    table, logos in the footer. A Hebrew paragraph without RTL but aligned right (the trap: adding bidi flips it)."""
    import docx
    from docx.shared import Cm
    from docx.enum.text import WD_ALIGN_PARAGRAPH
    from docx.oxml import OxmlElement
    d = docx.Document()
    t = d.add_table(rows=1, cols=3)
    if head_logo:
        t.cell(0, 0).paragraphs[0].add_run().add_picture(logo, width=Cm(2))
    t.cell(0, 1).text = FORM
    t.cell(0, 2).text = '%s 1 %s 1' % (PAGE, OF)
    f = d.add_table(rows=1, cols=2)
    f._tbl.tblPr.append(OxmlElement('w:bidiVisual'))
    f.cell(0, 0).text = TOPIC_L
    p = d.add_paragraph('הערות המדריך')
    p.alignment = WD_ALIGN_PARAGRAPH.RIGHT
    s = d.add_table(rows=2, cols=3)
    for i, h in enumerate(['#', NAME_H, 'חתימה']):
        s.cell(0, i).text = h
    d.sections[0].footer.paragraphs[0].add_run().add_picture(logo, width=Cm(2))
    d.save(path)


def run(*args):
    r = subprocess.run([sys.executable, TOOL] + list(args), capture_output=True, text=True, timeout=600)
    try:
        js = json.loads((r.stdout.strip().splitlines() or ['{}'])[-1])
    except ValueError:
        js = {}
    return r.returncode, js, r.stderr


def main():
    try:
        import docx  # noqa: F401
    except ImportError:
        print('  skipped: no python-docx')
        print('\ntalk-0801-test: 0 passed, 0 failed')
        return 0
    spec_ff = importlib.util.spec_from_file_location('ff', os.path.join(TOOLS, 'form-fill.py'))
    ff = importlib.util.module_from_spec(spec_ff)
    spec_ff.loader.exec_module(ff)
    tmp = tempfile.mkdtemp(prefix='talk0801-')
    try:
        logo = os.path.join(tmp, 'logo.png')
        png(logo)
        tpl = os.path.join(tmp, '08.01.docx')
        build(tpl, logo)
        spec = {'cells': [{'label': TOPIC_L, 'value': 'עבודה במכונת עיצוב'}],
                'content': [{'h': HEAD1, 'p': ['פסקה ראשונה על האירוע.']},
                            {'h': HEAD2, 'p': ['פסקה שנייה.', 'פסקה שלישית.']}],
                'content_before': NAME_H}
        sp = os.path.join(tmp, 's.json')
        with open(sp, 'w', encoding='utf-8') as f:
            json.dump(spec, f, ensure_ascii=False)
        out = os.path.join(tmp, 'out', 'talk')
        rc, js, err = run('--template', tpl, '--spec', sp, '--out', out)
        check('green run on a template like 08.01: exit 0, ok, the next steps say od_pdf and pdf-visual-check',
              rc == 0 and js.get('ok') and any('od_pdf' in x for x in js.get('next') or []) and any('pdf-visual-check' in x for x in js.get('next') or []), (rc, err[-600:], js))
        with zipfile.ZipFile(out + '.docx') as z:
            doc = z.read('word/document.xml').decode('utf-8')
        paras = re.findall(r'<w:p\b(?:(?!<w:p\b).)*?</w:p>', doc, re.S)
        mine = [p for p in paras if HEAD1[3:] in p or HEAD2[3:] in p or 'פסקה' in p]
        check('the training text is in the Word file, 5 paragraphs', len(mine) == 5, len(mine))
        check('every training paragraph: w:bidi, Arial, no jc left/right', mine and all('<w:bidi/>' in p and 'w:cs="Arial"' in p and not re.search(r'<w:jc w:val="(right|left)"', p) for p in mine), mine[:1])
        check('content placed before the participants table and after the header table',
              doc.find(HEAD1[3:]) > doc.find('08.01') and doc.find(HEAD2[3:]) < doc.find(NAME_H), (doc.find(HEAD1[3:]), doc.find(NAME_H)))
        check('the topic filled in its cell', 'מכונת עיצוב' in doc)
        trap = next((p for p in paras if 'הערות המדריך' in p), '')
        check('a template paragraph aligned right that became RTL lost jc="right" (Word would draw it on the left)',
              '<w:bidi/>' in trap and 'w:val="right"' not in trap, trap[:300])
        px = ff.parts_xml(out + '.docx')
        check('the header logo is kept (first body table)', ff.head_logo(px))
        check('no RTL paragraph with jc=right anywhere', ff.bidi_jc_right(px) == 0, ff.bidi_jc_right(px))
        if shutil.which('soffice') and shutil.which('pdftotext'):
            check('a preview PDF was made and the visual check passed (logo in the header, right to left)',
                  js.get('preview_pdf') and js.get('visual') == 'ok', js.get('visual'))
        else:
            print('  skipped: preview PDF (no soffice / poppler)')
        # (2) a template without the logo in the header (footer logos only): refused, not built
        bad = os.path.join(tmp, 'nologo.docx')
        build(bad, logo, head_logo=False)
        rc2, js2, err2 = run('--template', bad, '--spec', sp, '--out', os.path.join(tmp, 'out', 'bad'))
        check('a template with logos only in the footer: exit 1, "no logo in its header", no file',
              rc2 == 1 and 'no logo in its header' in err2 and not js2.get('docx'), (rc2, err2[-300:]))
        # (1) the lint catches a paragraph that is RTL and jc=right, and a lost header logo
        px_bad = ff.parts_xml(out + '.docx')
        d = px_bad['word/document.xml']
        ppr = next(d.iter(ff.q('pPr')))
        from lxml import etree
        if ppr.find(ff.q('bidi')) is None:
            ppr.append(etree.Element(ff.q('bidi')))
        jc = etree.SubElement(ppr, ff.q('jc'))
        jc.set(ff.q('val'), 'right')
        for blip in d.xpath('.//*[local-name()="blip"]'):
            blip.getparent().remove(blip)
        errs = ff.lint(ff.parts_xml(out + '.docx'), px_bad)
        check('lint: an RTL paragraph with jc=right is named', any('jc=right' in e for e in errs), errs)
        check('lint: the header logo lost is named', any('header logo lost' in e for e in errs), errs)
        rc3, _, _ = run('--template', tpl, '--spec', os.path.join(tmp, 'missing.json'), '--out', os.path.join(tmp, 'x'))
        check('a missing spec file: not exit 0', rc3 != 0)
    finally:
        shutil.rmtree(tmp, ignore_errors=True)
    print('\ntalk-0801-test: %d passed, %d failed' % (passed, len(fails)))
    return 1 if fails else 0


if __name__ == '__main__':
    sys.exit(main())
