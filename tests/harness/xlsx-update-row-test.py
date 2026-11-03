#!/usr/bin/env python3
# 03/11/2026 (dev request from the assistant): xlsx_update_row.py changes cells of an existing row in the
# accidents table. This test builds a small workbook with the same parts (data sheet, table, Log, a chart)
# and checks: only the requested cells change, styles stay, the chart and the table are byte-identical,
# a Log row is added, U follows Q, and a wrong date, a formula column or a bad R write nothing.
import json, os, subprocess, sys, tempfile, zipfile

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
TOOL = os.path.join(ROOT, 'project-files', 'assistant', 'xlsx_update_row.py')
passed = failed = 0


def check(name, ok, info=''):
    global passed, failed
    if ok: passed += 1; print('  ✓ ' + name)
    else: failed += 1; print('  ✗ ' + name + ('  -> ' + str(info) if info else ''))


def row(r, serial, n_text):
    return (f'<row r="{r}" spans="1:21"><c r="A{r}" s="13"><f>ROW()-1</f><v>{r - 1}</v></c>'
            f'<c r="B{r}" s="13" t="inlineStr"><is><t xml:space="preserve">worker{r}</t></is></c>'
            f'<c r="C{r}" s="14"><v>{serial}</v></c>'
            f'<c r="F{r}" s="13" t="s"><v>0</v></c>'
            f'<c r="N{r}" s="16" t="inlineStr"><is><t xml:space="preserve">{n_text}</t></is></c>'
            f'<c r="Q{r}" s="13" t="inlineStr"><is><t xml:space="preserve">ייצור טוגנים</t></is></c>'
            f'<c r="R{r}" s="13" t="inlineStr"><is><t xml:space="preserve">לא מדווח</t></is></c>'
            f'<c r="U{r}" s="13" t="str"><f>IF(1,1)</f><v>ייצור ואריזה</v></c></row>')


SHEET = ('<worksheet xmlns="x"><dimension ref="A1:U3"/><sheetData><row r="1"><c r="A1"/></row>'
         + row(2, 46310, 'old2') + row(3, 46315, 'old3') + '</sheetData></worksheet>')
LOGX = ('<worksheet xmlns="x"><dimension ref="A1:F2"/><sheetData><row r="1"><c r="A1"/></row>'
        '<row r="2"><c r="A2"><v>1</v></c></row></sheetData></worksheet>')
PARTS = {'xl/worksheets/sheet1.xml': SHEET, 'xl/worksheets/sheet5.xml': LOGX,
         'xl/tables/table1.xml': '<table ref="A1:U3"><autoFilter ref="A1:U3"/></table>',
         'xl/charts/chart1.xml': '<chart>keep me</chart>',
         'xl/workbook.xml': '<workbook><calcPr calcId="1"/></workbook>'}

tmp = tempfile.mkdtemp()
src = os.path.join(tmp, 'orig.xlsx')
with zipfile.ZipFile(src, 'w') as z:
    for k, v in PARTS.items():
        z.writestr(k, v)


def run(spec):
    p = os.path.join(tmp, 'spec.json'); out = os.path.join(tmp, 'new.xlsx')
    if os.path.exists(out): os.remove(out)
    json.dump(spec, open(p, 'w', encoding='utf-8'), ensure_ascii=False)
    r = subprocess.run([sys.executable, '-I', TOOL, src, out, p], capture_output=True, text=True)
    return r, out


LOG = {'C': 'עדכון', 'D': 'שורה 3', 'E': 'תחקיר', 'F': 'מיכאל'}
r, out = run({'row': 3, 'date': '2026-10-20', 'set': {'N': 'חדש & <מתוקן>', 'F': 'יד', 'P': 'פעולה', 'Q': 'אחזקה'}, 'log': LOG})
check('update runs', r.returncode == 0, r.stderr)
if r.returncode == 0:
    z = zipfile.ZipFile(out)
    s1 = z.read('xl/worksheets/sheet1.xml').decode()
    check('N replaced, style kept, text escaped', '<c r="N3" s="16" t="inlineStr"><is><t xml:space="preserve">חדש &amp; &lt;מתוקן&gt;</t></is></c>' in s1)
    check('shared-string F becomes inline text with its style', '<c r="F3" s="13" t="inlineStr"><is><t xml:space="preserve">יד</t>' in s1)
    check('missing P inserted before Q', s1.index('r="P3"') < s1.index('r="Q3"') and s1.index('r="N3"') < s1.index('r="P3"'))
    check('U cached value follows Q', '<v>אחזקה וחשמל</v></c></row></sheetData>' in s1)
    check('row 2 untouched', row(2, 46310, 'old2') in s1)
    for k in ('xl/tables/table1.xml', 'xl/charts/chart1.xml'):
        check(f'{k} identical', z.read(k).decode() == PARTS[k])
    s5 = z.read('xl/worksheets/sheet5.xml').decode()
    check('log row added', '<row r="3"' in s5 and 'A1:F3' in s5 and 'תחקיר' in s5)
    check('fullCalcOnLoad set', 'fullCalcOnLoad="1"' in z.read('xl/workbook.xml').decode())

for name, spec in [('wrong date refused', {'row': 3, 'date': '2026-10-21', 'set': {'N': 'x'}, 'log': LOG}),
                   ('formula column refused', {'row': 3, 'date': '2026-10-20', 'set': {'U': 'x'}, 'log': LOG}),
                   ('date column refused', {'row': 3, 'date': '2026-10-20', 'set': {'C': '2026-10-21'}, 'log': LOG}),
                   ('bad R refused', {'row': 3, 'date': '2026-10-20', 'set': {'R': 'כן'}, 'log': LOG}),
                   ('unknown department refused', {'row': 3, 'date': '2026-10-20', 'set': {'Q': 'ייצור'}, 'log': LOG}),
                   ('no log refused', {'row': 3, 'date': '2026-10-20', 'set': {'N': 'x'}}),
                   ('missing row refused', {'row': 9, 'date': '2026-10-20', 'set': {'N': 'x'}, 'log': LOG})]:
    r, out = run(spec)
    check(name, r.returncode != 0 and not os.path.exists(out), r.stdout + r.stderr)

print(f'\n{passed} passed, {failed} failed')
sys.exit(1 if failed else 0)
