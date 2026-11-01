#!/usr/bin/env python3
"""Remove the LAST row of Michael's accidents table, without touching anything else in the workbook.

Built 01/11/2026 for the event of 29/10/2026, which was an injury and not a work accident
(Michael in a questionnaire, 01/11/2026: "remove it from the Excel and from the app").
Same file and same rules as xlsx_add_rows.py: only the data sheet, the table range, the hidden
' Log' sheet and workbook.xml change. calcChain.xml is dropped (Excel rebuilds it on open),
because it still lists the formula cells of the removed row.

Only the last row can be removed: a row in the middle would shift every row under it, and the
'מס'' formula, the table and the dashboards would need renumbering. A middle row = ask Michael.

Usage: python3 -I xlsx_remove_last_row.py orig.xlsx new.xlsx spec.json
spec.json: {"date": "2026-10-29", "log": {"C": "...", "D": "...", "E": "...", "F": "..."}}
"date" must equal column C of the last row, otherwise nothing is written.
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
CALC = 'xl/calcChain.xml'


def serial(iso):
    y, m, d = map(int, iso.split('-'))
    return (datetime.date(y, m, d) - datetime.date(1899, 12, 30)).days


def cell_str(ref, txt):
    return f'<c r="{ref}" t="inlineStr"><is><t xml:space="preserve">{escape(txt)}</t></is></c>'


def main(src, out, spec_path):
    spec = json.load(open(spec_path, encoding='utf-8'))
    z = zipfile.ZipFile(src)
    s1 = z.read(SHEET).decode('utf-8')
    rows = re.findall(r'<row r="(\d+)"[^>]*>.*?</row>', s1, re.S)
    last = int(rows[-1])
    if last < 3:
        sys.exit('the table has no data row to remove')
    m = re.search(rf'<row r="{last}"[^>]*>.*?</row>', s1, re.S)
    c = re.search(rf'<c r="C{last}"[^>]*><v>(\d+)</v>', m.group(0))
    if not c or int(c.group(1)) != serial(spec['date']):
        sys.exit(f'row {last} is not dated {spec["date"]}: nothing written')
    s1 = s1.replace(m.group(0), '', 1)
    s1 = re.sub(r'<dimension ref="A1:U\d+"/>', f'<dimension ref="A1:U{last - 1}"/>', s1, count=1)
    if re.search(rf'[A-Z]\$?{last}\b', s1.split('</sheetData>')[1]):
        sys.exit(f'something after the data still points at row {last} (merge, validation): ask')
    t1 = z.read(TABLE).decode('utf-8')
    if t1.count(f'A1:U{last}') != 2:
        sys.exit('table range is not A1:U<last row>')
    t1 = t1.replace(f'A1:U{last}', f'A1:U{last - 1}')
    rep = {SHEET: s1, TABLE: t1}
    s5 = z.read(LOG).decode('utf-8')
    lr = max(int(n) for n in re.findall(r'<row r="(\d+)"', s5)) + 1
    today = datetime.date.today().isoformat()
    row = (f'<row r="{lr}" spans="1:6" x14ac:dyDescent="0.2"><c r="A{lr}"><v>{lr - 1}</v></c>'
           f'<c r="B{lr}" s="37"><v>{serial(today)}</v></c>'
           + ''.join(cell_str(f'{c}{lr}', spec['log'][c]) for c in 'CDEF') + '</row>')
    s5 = re.sub(r'<dimension ref="A1:F\d+"/>', f'<dimension ref="A1:F{lr}"/>', s5, count=1)
    rep[LOG] = s5.replace('</sheetData>', row + '</sheetData>', 1)
    wb = z.read('xl/workbook.xml').decode('utf-8')
    cp = re.search(r'<calcPr[^>]*/>', wb)
    if cp and 'fullCalcOnLoad' not in cp.group(0):
        rep['xl/workbook.xml'] = wb.replace(cp.group(0), cp.group(0)[:-2] + ' fullCalcOnLoad="1"/>')
    drop = set()
    if CALC in z.namelist():
        drop.add(CALC)
        rels = z.read('xl/_rels/workbook.xml.rels').decode('utf-8')
        rep['xl/_rels/workbook.xml.rels'] = re.sub(r'<Relationship [^>]*Target="calcChain.xml"/>', '', rels)
        ct = z.read('[Content_Types].xml').decode('utf-8')
        rep['[Content_Types].xml'] = re.sub(r'<Override PartName="/xl/calcChain.xml"[^>]*/>', '', ct)
    with zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED) as o:
        for i in z.infolist():
            if i.filename in drop:
                continue
            o.writestr(i, rep[i.filename].encode('utf-8') if i.filename in rep else z.read(i.filename),
                       compress_type=zipfile.ZIP_DEFLATED)
    print(f'row {last} removed, table A1:U{last - 1}, log row {lr}')


if __name__ == '__main__':
    main(*sys.argv[1:4])
