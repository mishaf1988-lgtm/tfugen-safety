"""Accept all tracked changes in a .docx, like "Accept All" in Word (24/10/2026: the ISO binder procedures were
filed with their revisions still showing). Drops w:del/moveFrom, unwraps w:ins/moveTo, drops property-change
marks. Usage: python3 accept_docx.py IN.docx OUT.docx  (prints the counts; a .doc goes through soffice first)."""
import sys, zipfile, shutil
from lxml import etree
W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'
ns = {'w': W}
src, dst = sys.argv[1], sys.argv[2]
zin = zipfile.ZipFile(src)
zout = zipfile.ZipFile(dst, 'w', zipfile.ZIP_DEFLATED)
tot = {'ins': 0, 'del': 0, 'chg': 0}
for item in zin.infolist():
    data = zin.read(item.filename)
    if item.filename.startswith('word/') and item.filename.endswith('.xml'):
        root = etree.fromstring(data)
        # a deleted paragraph mark (w:pPr/w:rPr/w:del) joins the paragraph with the next one, like Word does
        joined = root.xpath('//w:p[w:pPr/w:rPr/w:del or w:pPr/w:rPr/w:moveFrom]', namespaces=ns)
        for el in root.xpath('//w:del|//w:moveFrom', namespaces=ns):
            tot['del'] += 1; el.getparent().remove(el)
        for el in root.xpath('//w:ins|//w:moveTo', namespaces=ns):
            tot['ins'] += 1
            p = el.getparent(); i = p.index(el)
            for ch in list(el): p.insert(i, ch); i += 1
            p.remove(el)
        for el in root.xpath('//w:rPrChange|//w:pPrChange|//w:sectPrChange|//w:tblPrChange|//w:trPrChange|//w:tcPrChange|//w:numberingChange|//w:moveFromRangeStart|//w:moveFromRangeEnd|//w:moveToRangeStart|//w:moveToRangeEnd', namespaces=ns):
            tot['chg'] += 1; el.getparent().remove(el)
        for p_ in joined:
            nxt = p_.getnext()
            body = [c for c in p_ if c.tag != '{%s}pPr' % W]
            if nxt is not None and nxt.tag == '{%s}p' % W:
                at = 1 if len(nxt) and nxt[0].tag == '{%s}pPr' % W else 0
                for c in body: nxt.insert(at, c); at += 1
                p_.getparent().remove(p_)
            elif not ''.join(p_.itertext()).strip():
                p_.getparent().remove(p_)
        data = etree.tostring(root, xml_declaration=True, encoding='UTF-8', standalone=True)
    zout.writestr(item, data)
zout.close()
print(tot)
