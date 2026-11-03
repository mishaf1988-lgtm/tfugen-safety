#!/usr/bin/env python3
"""Update cells of an EXISTING row in Michael's accidents table, without touching anything else.

Built 03/11/2026 (dev request from the assistant: Michael wanted the row of 20/10/2026 corrected
after the production manager's investigation, and xlsx_add_rows.py only adds rows).
Same file and same rules as xlsx_add_rows.py: only the data sheet, the hidden ' Log' sheet and
workbook.xml (fullCalcOnLoad) change; the charts, the dashboards and the table range stay as they are.
Each cell keeps its style; the new text is written as an inline string.

Usage: python3 -I xlsx_update_row.py orig.xlsx new.xlsx spec.json
spec.json: {"row": 28, "date": "2026-10-20", "set": {"N": "...", "P": "...", "F": "..."},
            "log": {"C": "...", "D": "...", "E": "...", "F": "..."}}
"date" must equal column C of that row, otherwise nothing is written (the wrong row is never edited).
Allowed columns: B and D-R. A, S, T, U are formulas; C (the date) moves the row out of date order: ask Michael.
D is a time "HH:MM". Q must still match the department formula and R must be 'מדווח' or 'לא מדווח'
(lesson 179); when Q changes, the cached value of U changes with it. An empty string clears the cell.
"""
import datetime
import json
import re
import sys
import zipfile
from xml.sax.saxutils import escape

sys.path.insert(0, __import__('os').path.dirname(__file__))
from xlsx_add_rows import LOG, SHEET, cell_str, group, serial  # noqa: E402

ALLOWED = set('BDEFGHIJKLMNOPQR')


def cell_re(ref):
    return re.compile(rf'<c r="{ref}"(?:\s[^>]*)?(?:/>|>.*?</c>)', re.S)


def style_of(cell):
    m = re.search(r'\ss="(\d+)"', cell or '')
    return m.group(1) if m else None


def new_cell(col, r, x, st):
    ref = f'{col}{r}'
    s = f' s="{st}"' if st else ''
    if x in (None, ''):
        return f'<c r="{ref}"{s}/>'
    if col == 'D':
        h, mi = map(int, str(x).split(':'))
        return f'<c r="{ref}"{s}><v>{(h * 60 + mi) / 1440}</v></c>'
    return cell_str(ref, str(x), st)


def col_index(col):
    return ord(col) - 64


def put(row_xml, col, r, x):
    ref = f'{col}{r}'
    m = cell_re(ref).search(row_xml)
    if m:
        return row_xml.replace(m.group(0), new_cell(col, r, x, style_of(m.group(0))), 1)
    # the cell is missing in this row: insert it in column order
    cells = list(re.finditer(r'<c r="([A-Z]+)\d+"', row_xml))
    after = [c for c in cells if col_index(c.group(1)) > col_index(col)]
    cell = new_cell(col, r, x, None)
    if after:
        i = after[0].start()
        return row_xml[:i] + cell + row_xml[i:]
    return row_xml.replace('</row>', cell + '</row>', 1)


def main(src, out, spec_path):
    spec = json.load(open(spec_path, encoding='utf-8'))
    r, sets = int(spec['row']), spec.get('set') or {}
    if r < 2 or not sets:
        sys.exit('spec needs "row" (a data row) and "set"')
    bad = [c for c in sets if c not in ALLOWED]
    if bad:
        sys.exit(f'columns {bad} cannot be set here (A, S, T, U are formulas; C changes the date order: ask Michael)')
    if not spec.get('log'):
        sys.exit('spec needs "log" (C, D, E, F): every change to the table is written in the Log sheet')
    if 'R' in sets and sets['R'] not in ('מדווח', 'לא מדווח'):
        sys.exit('R must be מדווח or לא מדווח')
    g = None
    if 'Q' in sets:
        g = group(sets['Q'] or '')
        if not g:
            sys.exit(f'Q "{sets["Q"]}" does not match the department formula')
    z = zipfile.ZipFile(src)
    s1 = z.read(SHEET).decode('utf-8')
    m = re.search(rf'<row r="{r}"(?:\s[^>]*)?>.*?</row>', s1, re.S)
    if not m:
        sys.exit(f'row {r} is not in the sheet')
    row = m.group(0)
    c = re.search(rf'<c r="C{r}"[^>]*><v>(\d+)</v>', row)
    if not c or int(c.group(1)) != serial(spec['date']):
        sys.exit(f'row {r} is not dated {spec["date"]}: nothing written')
    for col, x in sets.items():
        row = put(row, col, r, x)
    if g:
        row = re.sub(rf'(<c r="U{r}"[^>]*>.*?<v>)[^<]*(</v>)', lambda mm: mm.group(1) + escape(g) + mm.group(2),
                     row, count=1, flags=re.S)
    s1 = s1.replace(m.group(0), row, 1)
    rep = {SHEET: s1}
    s5 = z.read(LOG).decode('utf-8')
    lr = max(int(n) for n in re.findall(r'<row r="(\d+)"', s5)) + 1
    today = datetime.date.today().isoformat()
    log = (f'<row r="{lr}" spans="1:6" x14ac:dyDescent="0.2"><c r="A{lr}"><v>{lr - 1}</v></c>'
           f'<c r="B{lr}" s="37"><v>{serial(today)}</v></c>'
           + ''.join(cell_str(f'{k}{lr}', spec['log'][k]) for k in 'CDEF') + '</row>')
    s5 = re.sub(r'<dimension ref="A1:F\d+"/>', f'<dimension ref="A1:F{lr}"/>', s5, count=1)
    rep[LOG] = s5.replace('</sheetData>', log + '</sheetData>', 1)
    wb = z.read('xl/workbook.xml').decode('utf-8')
    cp = re.search(r'<calcPr[^>]*/>', wb)
    if cp and 'fullCalcOnLoad' not in cp.group(0):
        rep['xl/workbook.xml'] = wb.replace(cp.group(0), cp.group(0)[:-2] + ' fullCalcOnLoad="1"/>')
    with zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED) as o:
        for i in z.infolist():
            o.writestr(i, rep[i.filename].encode('utf-8') if i.filename in rep else z.read(i.filename),
                       compress_type=zipfile.ZIP_DEFLATED)
    print(f'row {r}: {", ".join(sorted(sets))} updated, log row {lr}')


if __name__ == '__main__':
    main(*sys.argv[1:4])
