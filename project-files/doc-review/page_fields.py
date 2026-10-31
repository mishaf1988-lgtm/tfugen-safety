#!/usr/bin/env python3
"""Check and fix the saved values of "page X of Y" in a Word file (lesson 210, 31/10/2026).

The factory template (13.07) keeps PAGE and NUMPAGES as fields with a saved result. Viewers that do not
recalculate (WhatsApp, a phone, Microsoft's PDF export) show the saved result as it is: a one-page document
said "page 2 of 2". Usage:
  python3 -I page_fields.py file.docx PAGES            check: exit 1 when a saved value differs from PAGES
  python3 -I page_fields.py file.docx PAGES out.docx   fix: write out.docx with both saved values set to PAGES
PAGES comes from the real PDF (pdfinfo, from Microsoft's export). Only the saved result after the field is
changed; the field itself and everything else stay.
"""
import re, sys, zipfile

FIELD = re.compile(r'(<w:instrText[^>]*>\s*(PAGE|NUMPAGES)\s*</w:instrText>.*?<w:t[^>]*>)(\d+)(</w:t>)', re.S)
PARTS = re.compile(r'^word/(document|header\d*|footer\d*)\.xml$')


def saved(xml):
    return [(m.group(2), int(m.group(3))) for m in FIELD.finditer(xml)]


def fix(xml, pages):
    # "page X of Y" on a one-page document: PAGE is the page itself, so with PAGES=1 both are 1; on a longer
    # document only NUMPAGES is fixed, because PAGE differs per page and Word recalculates it on open
    def sub(m):
        if m.group(2) == 'NUMPAGES' or pages == 1:
            return m.group(1) + str(pages) + m.group(4)
        return m.group(0)
    return FIELD.sub(sub, xml)


def main(argv):
    if len(argv) < 3:
        print(__doc__); return 2
    path, pages = argv[1], int(argv[2])
    out = argv[3] if len(argv) > 3 else None
    zin = zipfile.ZipFile(path)
    bad = []
    zout = zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED) if out else None
    for info in zin.infolist():
        data = zin.read(info.filename)
        if PARTS.match(info.filename):
            xml = data.decode('utf-8')
            for kind, val in saved(xml):
                if (kind == 'NUMPAGES' or pages == 1) and val != pages:
                    bad.append((info.filename, kind, val))
            if zout:
                data = fix(xml, pages).encode('utf-8')
        if zout:
            zout.writestr(info, data)
    if zout:
        zout.close()
    for f, k, v in bad:
        print('%s: %s saved as %d, real pages %d' % (f, k, v, pages))
    if not bad:
        print('saved page fields match %d page(s)' % pages)
    return 1 if bad and not out else 0


if __name__ == '__main__':
    sys.exit(main(sys.argv))
