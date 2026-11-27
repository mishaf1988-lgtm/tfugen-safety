"""Hebrew (RTL) Word XML that Word itself honours (lesson 317, 18/11/2026).

Word ignores <w:bidi/>, <w:rtl/> and <w:bidiVisual/> that are appended out of schema order, and shows jc="right"
of an RTL paragraph on the LEFT; LibreOffice and Graph's PDF forgive it, so a preview looks right while Word does not.
These helpers write paragraphs, runs and tables in schema order, Arial, no left/right jc (start = right).
Use: from rtl_ooxml import p_xml, tbl_xml; body_sectPr.addprevious(docx.oxml.parse_xml(p_xml("...")))
First column of tbl_xml = the RIGHTMOST column.
"""
from xml.sax.saxutils import escape
from docx.oxml.ns import nsdecls

W = nsdecls('w')


def run(text, bold=False, size=22, color=None):
    b = '<w:b/><w:bCs/>' if bold else ''
    c = '<w:color w:val="%s"/>' % color if color else ''
    return ('<w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/>%s%s<w:sz w:val="%d"/><w:szCs w:val="%d"/><w:rtl/></w:rPr>'
            '<w:t xml:space="preserve">%s</w:t></w:r>') % (b, c, size, size, escape(text))


def p_xml(text, bold=False, size=22, before=0, after=80, justify=False, keep=False, color=None):
    kn = '<w:keepNext/>' if keep else ''
    jc = '<w:jc w:val="both"/>' if justify else ''
    return ('<w:p %s><w:pPr>%s<w:bidi/><w:spacing w:before="%d" w:after="%d" w:line="276" w:lineRule="auto"/>%s</w:pPr>%s</w:p>'
            % (W, kn, before, after, jc, run(text, bold, size, color) if text else ''))


def tbl_xml(head, rows, widths):
    total = sum(widths)
    grid = ''.join('<w:gridCol w:w="%d"/>' % w for w in widths)
    bd = ''.join('<w:%s w:val="single" w:sz="4" w:space="0" w:color="808080"/>' % s for s in ['top', 'left', 'bottom', 'right', 'insideH', 'insideV'])

    def cell(text, w, headrow):
        shd = '<w:shd w:val="clear" w:color="auto" w:fill="1F4E79"/>' if headrow else ''
        r = run(text, bold=headrow, size=20, color='FFFFFF' if headrow else None)
        return ('<w:tc><w:tcPr><w:tcW w:w="%d" w:type="dxa"/>%s</w:tcPr><w:p><w:pPr><w:bidi/><w:spacing w:before="20" w:after="20"/></w:pPr>%s</w:p></w:tc>'
                % (w, shd, r))

    trs = '<w:tr><w:trPr><w:tblHeader/></w:trPr>' + ''.join(cell(h, w, True) for h, w in zip(head, widths)) + '</w:tr>'
    for row in rows:
        trs += '<w:tr><w:trPr><w:cantSplit/></w:trPr>' + ''.join(cell(str(v), w, False) for v, w in zip(row, widths)) + '</w:tr>'
    return ('<w:tbl %s><w:tblPr><w:bidiVisual/><w:tblW w:w="%d" w:type="dxa"/><w:tblBorders>%s</w:tblBorders>'
            '<w:tblLayout w:type="fixed"/><w:tblCellMar><w:left w:w="80" w:type="dxa"/><w:right w:w="80" w:type="dxa"/></w:tblCellMar>'
            '<w:tblLook w:val="04A0"/></w:tblPr><w:tblGrid>%s</w:tblGrid>%s</w:tbl>' % (W, total, bd, grid, trs))
