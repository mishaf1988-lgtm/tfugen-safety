#!/usr/bin/env python3
"""Add rows to Michael's accidents table without touching anything else in the workbook.

Built 28/10/2026 for the accidents table ('טבלת תאונות 2026-.xlsx', sheet 'מאגר תאונות', table 'מאגר'),
after Michael said: "you have control over OneDrive, you can do it and it will be saved".
openpyxl would drop the charts and the dashboards, so only three XML parts change: the data sheet
(new rows with inline strings, the dimension), the table range, and the hidden ' Log' sheet.
workbook.xml gets fullCalcOnLoad so Excel recomputes the summary and the dashboards on open.

Usage: python3 -I xlsx_add_rows.py orig.xlsx new.xlsx rows.json
rows.json: {"rows": [{"B": "<name>", "C": "2026-10-20", "D": "14:00", ... "Q": "<department>", "R": "<reported>"}],
            "log": {"C": "...", "D": "...", "E": "...", "F": "..."}}
Columns A, S, T, U are formulas and are written here. Q must hold one of the words the U formula
looks for (טוגנים, אריזה, חומר גלם, אחזקה, חשמל, הנדסה, אנרגיה, מעבדה, מעוצב), and R must be
'מדווח' or 'לא מדווח', otherwise the row is missing from the summary (28/10/2026, lesson 179).
"""
import datetime
import json
import re
import sys
import zipfile
from xml.sax.saxutils import escape

SHEET = 'xl/worksheets/sheet1.xml'
TABLE = 'xl/tables/table1.xml'
LOG = 'xl/worksheets/sheet5.xml'
GROUPS = [(('טוגנים', 'אריזה'), 'ייצור ואריזה'), (('חומר גלם',), 'חומר גלם'), (('אחזקה', 'חשמל'), 'אחזקה וחשמל'),
          (('הנדסה', 'אנרגיה'), 'הנדסה ואנרגיה'), (('מעבדה',), 'מעבדה'), (('מעוצב',), 'מעוצבים')]
U = ('IF(OR(ISNUMBER(SEARCH("טוגנים",$Q{r})),ISNUMBER(SEARCH("אריזה",$Q{r}))),"ייצור ואריזה",'
     'IF(ISNUMBER(SEARCH("חומר גלם",$Q{r})),"חומר גלם",IF(OR(ISNUMBER(SEARCH("אחזקה",$Q{r})),'
     'ISNUMBER(SEARCH("חשמל",$Q{r}))),"אחזקה וחשמל",IF(OR(ISNUMBER(SEARCH("הנדסה",$Q{r})),'
     'ISNUMBER(SEARCH("אנרגיה",$Q{r}))),"הנדסה ואנרגיה",IF(ISNUMBER(SEARCH("מעבדה",$Q{r})),"מעבדה",'
     'IF(ISNUMBER(SEARCH("מעוצב",$Q{r})),"מעוצבים","אחר"))))))')
STYLE = {'C': '14', 'D': '36', 'M': '16', 'N': '16', 'P': '16'}


def serial(iso):
    y, m, d = map(int, iso.split('-'))
    return (datetime.date(y, m, d) - datetime.date(1899, 12, 30)).days


def group(dept):
    for words, g in GROUPS:
        if any(w in dept for w in words):
            return g
    return None


def cell_str(ref, txt, style=None):
    s = f' s="{style}"' if style else ''
    return f'<c r="{ref}"{s} t="inlineStr"><is><t xml:space="preserve">{escape(txt)}</t></is></c>'


def data_row(r, v):
    g = group(v.get('Q', ''))
    if not g:
        sys.exit(f'row {r}: Q "{v.get("Q")}" does not match the department formula')
    if v.get('R') not in ('מדווח', 'לא מדווח'):
        sys.exit(f'row {r}: R must be מדווח or לא מדווח')
    y, m, _ = v['C'].split('-')
    cells = [f'<c r="A{r}" s="13"><f>ROW()-1</f><v>{r - 1}</v></c>']
    for c in 'BCDEFGHIJKLMNOPQR':
        st, x = STYLE.get(c, '13'), v.get(c)
        if c == 'C':
            cells.append(f'<c r="C{r}" s="{st}"><v>{serial(x)}</v></c>')
        elif c == 'D' and x:
            h, mi = map(int, x.split(':'))
            cells.append(f'<c r="D{r}" s="{st}"><v>{(h * 60 + mi) / 1440}</v></c>')
        elif x in (None, ''):
            cells.append(f'<c r="{c}{r}" s="{st}"/>')
        else:
            cells.append(cell_str(f'{c}{r}', str(x), st))
    cells.append(f'<c r="S{r}" s="13"><f>YEAR($C{r})</f><v>{int(y)}</v></c>')
    cells.append(f'<c r="T{r}" s="13"><f>MONTH($C{r})</f><v>{int(m)}</v></c>')
    cells.append(f'<c r="U{r}" s="13" t="str"><f>{escape(U.format(r=r))}</f><v>{g}</v></c>')
    return f'<row r="{r}" spans="1:21" ht="57" x14ac:dyDescent="0.2">' + ''.join(cells) + '</row>'


def main(src, out, spec_path):
    spec = json.load(open(spec_path, encoding='utf-8'))
    z = zipfile.ZipFile(src)
    s1 = z.read(SHEET).decode('utf-8')
    last = max(int(n) for n in re.findall(r'<row r="(\d+)"', s1))
    for v in spec['rows']:
        if '<t xml:space="preserve">' + escape(v['B']) + '</t>' in s1:
            sys.exit(f'{v["B"]} is already in the sheet')
    # rows stay in date order (Michael, 28/10/2026): a row older than the last one is refused, not appended out of place
    dates = [int(d) for d in re.findall(r'<c r="C\d+" s="14"><v>(\d+)</v>', s1)]
    prev = max(dates) if dates else 0
    for v in spec['rows']:
        if serial(v['C']) < prev:
            sys.exit(f'{v["C"]} is older than the last row: the table is kept in date order (ask Michael)')
        prev = serial(v['C'])
    new = ''.join(data_row(last + 1 + i, v) for i, v in enumerate(spec['rows']))
    end = last + len(spec['rows'])
    s1 = re.sub(r'<dimension ref="A1:U\d+"/>', f'<dimension ref="A1:U{end}"/>', s1, count=1)
    s1 = s1.replace('</sheetData>', new + '</sheetData>', 1)
    t1 = z.read(TABLE).decode('utf-8')
    if t1.count(f'A1:U{last}') != 2:
        sys.exit('table range is not A1:U<last row>')
    t1 = t1.replace(f'A1:U{last}', f'A1:U{end}')
    rep = {SHEET: s1, TABLE: t1}
    if spec.get('log'):
        s5 = z.read(LOG).decode('utf-8')
        lr = max(int(n) for n in re.findall(r'<row r="(\d+)"', s5)) + 1
        today = datetime.date.today().isoformat()
        row = (f'<row r="{lr}" spans="1:6" x14ac:dyDescent="0.2"><c r="A{lr}"><v>{lr - 1}</v></c>'
               f'<c r="B{lr}" s="37"><v>{serial(today)}</v></c>'
               + ''.join(cell_str(f'{c}{lr}', spec['log'][c]) for c in 'CDEF') + '</row>')
        s5 = re.sub(r'<dimension ref="A1:F\d+"/>', f'<dimension ref="A1:F{lr}"/>', s5, count=1)
        rep[LOG] = s5.replace('</sheetData>', row + '</sheetData>', 1)
    wb = z.read('xl/workbook.xml').decode('utf-8')
    m = re.search(r'<calcPr[^>]*/>', wb)
    if m and 'fullCalcOnLoad' not in m.group(0):
        rep['xl/workbook.xml'] = wb.replace(m.group(0), m.group(0)[:-2] + ' fullCalcOnLoad="1"/>')
    with zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED) as o:
        for i in z.infolist():
            o.writestr(i, rep[i.filename].encode('utf-8') if i.filename in rep else z.read(i.filename),
                       compress_type=zipfile.ZIP_DEFLATED)
    print(f'rows {last + 1}-{end} added, table A1:U{end}')


if __name__ == '__main__':
    main(*sys.argv[1:4])
