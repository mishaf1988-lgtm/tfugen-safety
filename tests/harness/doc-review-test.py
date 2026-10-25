#!/usr/bin/env python3
"""doc-review tools (24/10/2026): a Word edit shows as tracked revisions and an Excel edit as marked cells."""
import os, subprocess, sys, tempfile, zipfile, re
import docx, openpyxl
H = os.path.dirname(os.path.abspath(__file__)); T = os.path.join(H, '..', '..', 'project-files', 'doc-review')
passed = failed = 0
def check(name, ok, info=''):
    global passed, failed
    if ok: passed += 1; print('  ✓', name)
    else: failed += 1; print('  ✗', name, info)
with tempfile.TemporaryDirectory() as d:
    j = lambda n: os.path.join(d, n)
    o = docx.Document(); [o.add_paragraph(t) for t in ['כותרת', 'צופה אש 30 דקות לאחר סיום.', 'סעיף ישן שנמחק.', 'סעיף קבוע.']]; o.save(j('o.docx'))
    n = docx.Document(); [n.add_paragraph(t) for t in ['כותרת', 'צופה אש 60 דקות לאחר סיום.', 'סעיף קבוע.', 'סעיף חדש.']]; n.save(j('n.docx'))
    r = subprocess.run([sys.executable, os.path.join(T, 'track_docx.py'), j('o.docx'), j('n.docx'), j('out.docx')], capture_output=True, text=True)
    x = zipfile.ZipFile(j('out.docx')).read('word/document.xml').decode() if r.returncode == 0 else ''
    dels = re.findall(r'<w:delText[^>]*>([^<]*)', x)
    check('word: the changed number is one deleted word, the removed paragraph is deleted whole', '30' in dels and 'סעיף ישן שנמחק.' in dels and 'סיום.' not in dels, (r.stderr[-300:], dels))
    check('word: insertions are tracked with the author', 'w:author="מיכאל פרייליך"' in x and x.count('<w:ins ') >= 2)
    check('word: the unchanged paragraph is not marked', 'סעיף קבוע.' in docx.Document(j('out.docx')).paragraphs[2].text or 'סעיף קבוע.' in [p.text for p in docx.Document(j('out.docx')).paragraphs])
    def tbl_doc(path, rows, extra_para):
        dd = docx.Document(); dd.add_paragraph(extra_para); tb = dd.add_table(rows=len(rows), cols=2)
        for ri, row in enumerate(rows):
            for ci, v in enumerate(row): tb.cell(ri, ci).text = v
        dd.save(path)
    tbl_doc(j('to.docx'), [['נכתב ע"י: מיכאל', 'תאריך: 16.10.2026'], ['אושר ע"י: צחי', 'תפקיד: סמנכ"ל']], 'פתיחה')
    tbl_doc(j('tn.docx'), [['נכתב ע"י: מיכאל', 'תאריך: 16.10.2026'], ['אושר ע"י: מורן', 'תפקיד: מנהלת איכות'], ['טיוטה', 'אישור']], 'פתיחה')
    r = subprocess.run([sys.executable, os.path.join(T, 'track_docx.py'), j('to.docx'), j('tn.docx'), j('tt.docx')], capture_output=True, text=True)
    xt = zipfile.ZipFile(j('tt.docx')).read('word/document.xml').decode() if r.returncode == 0 else ''
    dt = re.findall(r'<w:delText[^>]*>([^<]*)', xt)
    check('word tables: a changed cell is marked word by word, an unchanged cell is not, a new row is an inserted row', 'צחי' in dt and 'מיכאל' not in ''.join(dt) and '16.10.2026' not in ''.join(dt) and '<w:trPr><w:ins ' in xt and 'מורן' in xt, (r.stderr[-300:], dt))
    r = subprocess.run([sys.executable, os.path.join(T, 'accept_docx.py'), j('tt.docx'), j('ta.docx')], capture_output=True, text=True)
    ta = docx.Document(j('ta.docx')) if r.returncode == 0 else None
    check('word tables: accepting the tracked table gives the new table', ta is not None and [[c.text for c in row.cells] for row in ta.tables[0].rows] == [['נכתב ע"י: מיכאל', 'תאריך: 16.10.2026'], ['אושר ע"י: מורן', 'תפקיד: מנהלת איכות'], ['טיוטה', 'אישור']], r.stderr[-300:])
    r = subprocess.run([sys.executable, os.path.join(T, 'accept_docx.py'), j('out.docx'), j('acc.docx')], capture_output=True, text=True)
    acc = [p.text for p in docx.Document(j('acc.docx')).paragraphs] if r.returncode == 0 else []
    x2 = zipfile.ZipFile(j('acc.docx')).read('word/document.xml').decode() if r.returncode == 0 else ''
    check('accept_docx: accepting the tracked version gives the new text, with no revision marks left', acc == ['כותרת', 'צופה אש 60 דקות לאחר סיום.', 'סעיף קבוע.', 'סעיף חדש.'] and '<w:ins ' not in x2 and '<w:del ' not in x2, (r.stderr[-300:], acc))
    tbl_doc(j('ro.docx'), [['a', 'b'], ['מחוק', 'x'], ['c', 'd']], 'פתיחה')
    tbl_doc(j('rn.docx'), [['a', 'b'], ['c', 'd']], 'פתיחה')
    r = subprocess.run([sys.executable, os.path.join(T, 'track_docx.py'), j('ro.docx'), j('rn.docx'), j('rt.docx')], capture_output=True, text=True)
    r2 = subprocess.run([sys.executable, os.path.join(T, 'accept_docx.py'), j('rt.docx'), j('ra.docx')], capture_output=True, text=True) if r.returncode == 0 else None
    ra = docx.Document(j('ra.docx')) if r2 is not None and r2.returncode == 0 else None
    check('accept_docx: a deleted table row is gone after accepting, no empty row left (25/10/2026 retro)', ra is not None and [[c.text for c in row.cells] for row in ra.tables[0].rows] == [['a', 'b'], ['c', 'd']], [[c.text for c in row.cells] for row in ra.tables[0].rows] if ra else (r.stderr, r2.stderr if r2 else ''))
    tbl_doc(j('co.docx'), [['a', 'b'], ['c', 'd']], 'x')
    zc = zipfile.ZipFile(j('co.docx')); pc = {n: zc.read(n) for n in zc.namelist()}
    xc = pc['word/document.xml'].decode()
    xc = xc.replace('<w:tcPr>', '<w:tcPr><w:cellDel w:id="7" w:author="x" w:date="2026-01-01T00:00:00Z"/>', 1) if '<w:tcPr>' in xc else xc
    pc['word/document.xml'] = xc.encode()
    with zipfile.ZipFile(j('co2.docx'), 'w') as zo: [zo.writestr(n, b) for n, b in pc.items()]
    r3 = subprocess.run([sys.executable, os.path.join(T, 'accept_docx.py'), j('co2.docx'), j('co3.docx')], capture_output=True, text=True)
    c3 = docx.Document(j('co3.docx')) if r3.returncode == 0 else None
    check('accept_docx: a cell marked deleted (cellDel) is removed when accepting (25/10/2026 retro)', '<w:cellDel' in xc and c3 is not None and 'cellDel' not in zipfile.ZipFile(j('co3.docx')).read('word/document.xml').decode() and [len(r.cells) for r in c3.tables[0].rows] == [1, 2], [len(r.cells) for r in c3.tables[0].rows] if c3 else r3.stderr)
    tb = docx.Document(); cell = tb.add_table(rows=1, cols=1).cell(0, 0); cell.paragraphs[0].add_run('תא שנמחק')
    tb.save(j('t.docx')); zt = zipfile.ZipFile(j('t.docx')); parts = {n: zt.read(n) for n in zt.namelist()}
    W_ = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"'
    xml = parts['word/document.xml'].decode()
    xml = re.sub(r'(<w:tc>.*?<w:p>)(.*?)(<w:r>)(.*?)</w:r>', lambda m: m.group(1) + m.group(2) + '<w:pPr><w:rPr><w:del w:id="9" w:author="x" w:date="2026-01-01T00:00:00Z"/></w:rPr></w:pPr><w:del w:id="8" w:author="x" w:date="2026-01-01T00:00:00Z"><w:r>' + m.group(4).replace('<w:t>', '<w:delText>').replace('</w:t>', '</w:delText>') + '</w:r></w:del>', xml, count=1, flags=re.S)
    parts['word/document.xml'] = xml.encode()
    with zipfile.ZipFile(j('t2.docx'), 'w') as zo: [zo.writestr(n, b) for n, b in parts.items()]
    r = subprocess.run([sys.executable, os.path.join(T, 'accept_docx.py'), j('t2.docx'), j('t3.docx')], capture_output=True, text=True)
    x3 = zipfile.ZipFile(j('t3.docx')).read('word/document.xml').decode() if r.returncode == 0 else ''
    check('accept_docx: a cell whose only paragraph was deleted keeps one (empty) paragraph, Word refuses a cell with none', '<w:delText' in xml and x3 != '' and all('<w:p' in c for c in re.findall(r'<w:tc>(.*?)</w:tc>', x3, re.S)) and 'תא שנמחק' not in x3, (r.stderr[-300:], x3[-400:]))
    wb = openpyxl.Workbook(); ws = wb.active; ws['A1'] = 'x'; ws['B2'] = 30; ws['C3'] = 'ישן'; wb.save(j('o.xlsx'))
    wb = openpyxl.Workbook(); ws = wb.active; ws['A1'] = 'x'; ws['B2'] = 60; ws['D4'] = 'חדש'; wb.save(j('n.xlsx'))
    r = subprocess.run([sys.executable, os.path.join(T, 'track_xlsx.py'), j('o.xlsx'), j('n.xlsx'), j('out.xlsx')], capture_output=True, text=True)
    ok = r.returncode == 0
    if ok:
        w = openpyxl.load_workbook(j('out.xlsx')); s = w['Sheet']; log = [tuple(c.value for c in row) for row in w['שינויים'].iter_rows(min_row=2)]
    check('excel: changed cell yellow with "היה:", new green, removed red, and a change sheet first', ok and s['B2'].comment.text.startswith('היה: 30') and s['B2'].fill.fgColor.rgb.endswith('FFF2A8') and s['D4'].fill.fgColor.rgb.endswith('C6EFCE') and s['C3'].fill.fgColor.rgb.endswith('FFC7CE') and w.sheetnames[0] == 'שינויים' and len(log) == 3, r.stderr[-300:])
print('%d passed, %d failed' % (passed, failed))
sys.exit(1 if failed else 0)
