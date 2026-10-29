# Builds an accident investigation (Word + PDF) from a JSON file (29/10/2026).
#
#   python3 tools/investigation-doc.py data.json out-dir [--no-pdf]
#
# The repo holds NO personal data: the JSON lives outside the repo (scratchpad) and the
# script only lays it out. Structure follows form 32.02 as Michael fills it
# (project-files/assistant/accidents.md): details, event description, witnesses,
# numbered findings (direct cause first, then root causes), recommendations table
# with owner and due date, participants / writer / date. No 5-why section, no "to
# complete" notes: a field with no source stays empty and is listed on stdout so the
# message to Michael can name it.
#
# data.json:
# {
#   "title": "...", "output_name": "<file name without extension>",
#   "details": [["label", "value"], ...],
#   "description": "text (blank line = new paragraph)",
#   "witnesses": ["..."],
#   "findings": [{"text": "...", "images": [{"path": "/abs/pic.jpg", "caption": "..."}]}],
#   "actions": [{"action": "...", "owner": "...", "due": "DD/MM/YYYY"}],
#   "participants": ["name - role"], "writer": "...", "date": "DD/MM/YYYY"
# }
# Findings are numbered by the script; images sit right under the finding they show.
import json, os, subprocess, sys
from docx import Document
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Cm, Pt

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FONT = 'Arial'
L = {
    'details': 'פרטים',
    'desc': 'תיאור האירוע',
    'wit': 'עדים',
    'find': 'ממצאים',
    'rec': 'המלצות ופעולות מתקנות',
    'act': 'פעולה',
    'own': 'אחראי',
    'due': 'יעד',
    'part': 'משתתפים',
    'writer': 'נכתב על ידי',
    'date': 'תאריך',
    'pic': 'תמונה',
}
empty = []


def rtl(p, align=WD_ALIGN_PARAGRAPH.RIGHT):
    ppr = p._p.get_or_add_pPr()
    b = OxmlElement('w:bidi')
    ppr.append(b)
    p.alignment = align


def run(p, text, bold=False, size=11):
    r = p.add_run(text)
    r.bold = bold
    r.font.size = Pt(size)
    r.font.name = FONT
    rpr = r._r.get_or_add_rPr()
    rpr.rFonts.set(qn('w:cs'), FONT)
    rpr.append(OxmlElement('w:rtl'))
    if bold:
        rpr.append(OxmlElement('w:bCs'))
    return r


def para(doc, text='', bold=False, size=11, align=WD_ALIGN_PARAGRAPH.RIGHT):
    p = doc.add_paragraph()
    rtl(p, align)
    p.paragraph_format.space_after = Pt(4)
    if text:
        run(p, text, bold, size)
    return p


def heading(doc, text):
    p = para(doc, text, bold=True, size=13)
    p.paragraph_format.space_before = Pt(10)
    p.paragraph_format.keep_with_next = True
    return p


def cell_text(c, text, bold=False):
    c.text = ''
    p = c.paragraphs[0]
    rtl(p)
    run(p, text, bold, 10.5)


def table(doc, rows, widths, header=None):
    t = doc.add_table(rows=0, cols=len(widths))
    t.style = 'Table Grid'
    t.alignment = WD_TABLE_ALIGNMENT.RIGHT
    tp = t._tbl.tblPr
    tp.append(OxmlElement('w:bidiVisual'))
    if header:
        cs = t.add_row().cells
        for c, h in zip(cs, header):
            cell_text(c, h, True)
    for r in rows:
        cs = t.add_row().cells
        for i, v in enumerate(r):
            cell_text(cs[i], v, bold=(i == 0 and len(widths) == 2))
    for row in t.rows:
        for c, w in zip(row.cells, widths):
            c.width = Cm(w)
    return t


def need(label, value):
    if not str(value or '').strip():
        empty.append(label)
        return ''
    return str(value)


def build(d, out_dir):
    for f in d.get('findings', []):
        for im in f.get('images', []):
            if not os.path.isfile(im['path']):
                sys.exit('image missing: ' + im['path'])
    doc = Document()
    sec = doc.sections[0]
    sec.page_width, sec.page_height = Cm(21), Cm(29.7)
    sec.left_margin = sec.right_margin = Cm(2)
    sec.top_margin = sec.bottom_margin = Cm(1.8)
    st = doc.styles['Normal']
    st.font.name = FONT
    st.font.size = Pt(11)

    logo = os.path.join(ROOT, 'logo.jpg')
    hp = sec.header.paragraphs[0]
    rtl(hp)
    hp.add_run().add_picture(logo, height=Cm(1.6))

    para(doc, need('title', d.get('title')), bold=True, size=16, align=WD_ALIGN_PARAGRAPH.CENTER)

    heading(doc, L['details'])
    rows = [[k, need(k, v)] for k, v in d.get('details', [])]
    table(doc, rows, [11.5, 5.5])

    heading(doc, L['desc'])
    desc = need(L['desc'], d.get('description'))
    for chunk in desc.split('\n\n'):
        para(doc, chunk.strip())

    heading(doc, L['wit'])
    ws = d.get('witnesses') or []
    if not ws:
        empty.append(L['wit'])
    for w in ws:
        para(doc, '• ' + w if False else '- ' + w)

    heading(doc, L['find'])
    n = 0
    for i, f in enumerate(d.get('findings', []), 1):
        para(doc, '%d. %s' % (i, need('finding %d' % i, f.get('text'))))
        for im in f.get('images', []):
            n += 1
            p = para(doc, align=WD_ALIGN_PARAGRAPH.CENTER)
            p.paragraph_format.keep_with_next = True
            p.add_run().add_picture(im['path'], width=Cm(5))
            para(doc, '%s %d: %s' % (L['pic'], n, im.get('caption', '')), size=9.5,
                 align=WD_ALIGN_PARAGRAPH.CENTER)

    heading(doc, L['rec'])
    acts = d.get('actions') or []
    if not acts:
        empty.append(L['rec'])
    table(doc, [[a.get('action', ''), a.get('owner', ''), a.get('due', '')] for a in acts],
          [9.5, 4.5, 3], header=[L['act'], L['own'], L['due']])

    heading(doc, L['part'])
    for x in d.get('participants', []):
        para(doc, '- ' + x)
    para(doc, '%s: %s' % (L['writer'], need(L['writer'], d.get('writer'))))
    para(doc, '%s: %s' % (L['date'], need(L['date'], d.get('date'))))

    os.makedirs(out_dir, exist_ok=True)
    name = d.get('output_name') or 'investigation'
    path = os.path.join(out_dir, name + '.docx')
    doc.save(path)
    return path


def main():
    a = [x for x in sys.argv[1:] if not x.startswith('--')]
    if len(a) != 2:
        sys.exit(__doc__)
    d = json.load(open(a[0], encoding='utf-8'))
    path = build(d, a[1])
    print('docx:', path)
    if '--no-pdf' not in sys.argv:
        subprocess.run(['soffice', '--headless', '--convert-to', 'pdf', '--outdir', a[1], path],
                       check=True, capture_output=True)
        pdf = path[:-5] + '.pdf'
        pages = subprocess.run(['pdfinfo', pdf], capture_output=True, text=True).stdout
        print('pdf:', pdf, [l for l in pages.splitlines() if l.startswith('Pages')])
    print('empty fields:', empty if empty else 'none')


main()
