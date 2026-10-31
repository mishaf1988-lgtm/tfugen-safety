#!/usr/bin/env python3
"""page_fields.py (lesson 210, 31/10/2026): a Word file whose saved "page 2 of 2" sits on a one-page document is
caught, fixed to "1 of 1", and a correct file passes. A multi-page document keeps PAGE and fixes only NUMPAGES."""
import os, subprocess, sys, tempfile, zipfile
from _common import check, done, repo_root
TOOL = os.path.join(repo_root(), 'project-files', 'doc-review', 'page_fields.py')


def doc(page, total):
    f = lambda k, v: '<w:r><w:instrText> %s </w:instrText></w:r><w:r><w:t>%s</w:t></w:r>' % (k, v)
    return '<w:document><w:body><w:p>%s %s</w:p></w:body></w:document>' % (f('PAGE', page), f('NUMPAGES', total))


def make(page, total, d):
    p = os.path.join(d, 'a.docx')
    with zipfile.ZipFile(p, 'w') as z:
        z.writestr('word/document.xml', doc(page, total)); z.writestr('word/other.xml', '<x>PAGE 7</x>')
    return p


def run(*a):
    return subprocess.run([sys.executable, '-I', TOOL] + list(a), capture_output=True, text=True, encoding='utf-8')


with tempfile.TemporaryDirectory() as d:
    p = make(2, 2, d)
    r = run(p, '1')
    check('page 2 of 2 on one page: caught (exit 1)', r.returncode == 1 and 'NUMPAGES saved as 2' in r.stdout, r.stdout)
    o = os.path.join(d, 'b.docx')
    r = run(p, '1', o)
    xml = zipfile.ZipFile(o).read('word/document.xml').decode()
    check('fix: both saved values are 1, fields kept', r.returncode == 0 and xml == doc(1, 1), xml)
    check('fix: other parts untouched', zipfile.ZipFile(o).read('word/other.xml') == b'<x>PAGE 7</x>')
    check('a correct file passes', run(o, '1').returncode == 0)
    p3 = make(1, 5, d)
    o3 = os.path.join(d, 'c.docx')
    run(p3, '3', o3)
    check('three pages: PAGE kept, NUMPAGES fixed to 3', zipfile.ZipFile(o3).read('word/document.xml').decode() == doc(1, 3))
done()
