# Shared helpers for the factory training decks (19/11/2026, Michael: "a professional deck on ammonia ... and then one
# on the steam boilers"). Tapugan look as in the safety committee deck (.claude/skills/safety-committee-builder, section 5):
# 13.333x7.5 in, Arial, every paragraph rtl=1, gradient title band 0B2635 -> 14485F.
# Hebrew in a deck is read from <a:cs>, so fix_fonts() must run on the saved file (trap 1 in that skill).
import re, zipfile, shutil, os
from pptx import Presentation
from pptx.util import Inches, Pt, Emu
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR
from pptx.enum.shapes import MSO_SHAPE
from pptx.oxml.ns import qn
from lxml import etree

NAVY, NAVY2, BLUE, TEXT = '0B2635', '14485F', '1F608C', '1A1A1A'
IDX, BAND, CARD, GREY = '1B4F6B', 'DCE1E6', 'EFF2F5', '7F8C99'
RED, AMBER, GREEN, DBLUE = 'C00000', 'FFC000', '53842B', '1F4E79'
W, H = 13.333, 7.5
# Light look (19/11/2026, Michael on both decks: "the blue is too much for the eyes, we need lighter colours"; text
# "not focused"). The decks keep naming the strong colours above; every fill is mapped here to a light tint, and white
# text on it to a dark shade of the same hue, so a deck never draws a dark block. A tinted box gets a strong strip on
# its right edge (RTL start) so the emphasis stays. Title bands and covers are light with dark text.
INK = '1F3A4D'          # dark slate for titles and headings
LINE = '7DB3D6'         # thin accent line under the title band
SOFT = {RED: ('FCE8E8', '8E1B1B', 'D9534F'), DBLUE: ('E6F0F8', INK, '7DB3D6'), IDX: ('DDEBF4', INK, None),
        BLUE: ('7DB3D6', 'FFFFFF', None), GREEN: ('E4F1DA', '2F5E17', '7DB357'), NAVY: ('E6F0F8', INK, '7DB3D6'),
        AMBER: ('FFE699', TEXT, None), 'E36C09': ('FCE3CF', '8A3B00', None)}


# 19/11/2026 (Michael: "numbers and English in the wrong place"): in a right-to-left paragraph "5 ppm" is drawn
# "ppm 5", and "Level A" or "Pac 8000" break the same way. A run of Latin words and numbers with spaces between them is
# wrapped in LRE ... PDF (U+202A / U+202C), so PowerPoint and LibreOffice keep it left-to-right as one piece.
LTR_RUN = re.compile(r'(?<![0-9A-Za-z])[0-9A-Za-z][0-9A-Za-z.,%°/+\-]*(?: [0-9A-Za-z][0-9A-Za-z.,%°/+\-]*)+')


def ltr(s):
    return LTR_RUN.sub(lambda m: '\u202a' + m.group(0) + '\u202c', s)


def soft(fill, color):
    """(fill, text colour, strip colour or None) for the light look."""
    if fill in SOFT:
        f, ink, strip = SOFT[fill]
        return f, (ink if color in ('FFFFFF', None) else (ink if color == fill else color)), strip
    return fill, color, None


def rgb(h):
    return RGBColor.from_string(h)


class Deck:
    def __init__(self, logo, footer):
        self.prs = Presentation()
        self.prs.slide_width, self.prs.slide_height = Inches(W), Inches(H)
        self.logo, self.footer, self.n = logo, footer, 0
        self.pages = []

    # ---- low level -------------------------------------------------------------------------------------------
    def _slide(self):
        s = self.prs.slides.add_slide(self.prs.slide_layouts[6])
        self.n += 1
        return s

    def rect(self, s, x, y, w, h, fill=None, line=None, shape=MSO_SHAPE.RECTANGLE, dash=False, lw=1.0):
        sh = s.shapes.add_shape(shape, Inches(x), Inches(y), Inches(w), Inches(h))
        sh.shadow.inherit = False
        if fill:
            sh.fill.solid(); sh.fill.fore_color.rgb = rgb(fill)
        else:
            sh.fill.background()
        if line:
            sh.line.color.rgb = rgb(line); sh.line.width = Pt(lw)
            if dash:
                ln = sh.line._get_or_add_ln()
                d = etree.SubElement(ln, qn('a:prstDash')); d.set('val', 'dash')
        else:
            sh.line.fill.background()
        return sh

    def text(self, s, x, y, w, h, lines, size=18, color=TEXT, bold=False, align='r', anchor='t', gap=6, shape=None):
        """lines: str or list of str / (str, {size,color,bold}) tuples. Each line is one RTL paragraph."""
        tb = shape or s.shapes.add_textbox(Inches(x), Inches(y), Inches(w), Inches(h))
        tf = tb.text_frame
        tf.word_wrap = True
        tf.margin_left = tf.margin_right = Inches(0.08)
        tf.margin_top = tf.margin_bottom = Inches(0.04)
        tf.vertical_anchor = {'t': MSO_ANCHOR.TOP, 'm': MSO_ANCHOR.MIDDLE, 'b': MSO_ANCHOR.BOTTOM}[anchor]
        if isinstance(lines, str):
            lines = [lines]
        first = True
        for ln in lines:
            opt = {}
            if isinstance(ln, tuple):
                ln, opt = ln
            p = tf.paragraphs[0] if first else tf.add_paragraph()
            first = False
            p.alignment = {'r': PP_ALIGN.RIGHT, 'c': PP_ALIGN.CENTER, 'l': PP_ALIGN.LEFT}[opt.get('align', align)]
            p._p.get_or_add_pPr().set('rtl', '1')
            p.space_after = Pt(opt.get('gap', gap))
            r = p.add_run()
            r.text = ltr(ln)
            f = r.font
            f.name = 'Arial'; f.size = Pt(opt.get('size', size)); f.bold = opt.get('bold', bold)
            f.color.rgb = rgb(opt.get('color', color))
        return tb

    def box(self, s, x, y, w, h, lines, fill=CARD, color=TEXT, size=16, bold=False, align='r', anchor='m', line=None,
            round_=True, gap=4):
        fill, color, strip = soft(fill, color)
        lines = self._recolor(lines)
        # 19/11/2026 (Michael: "the text is stuck to the side"): a card's text is centred, except a bullet list
        flat = [lines] if isinstance(lines, str) else [l[0] if isinstance(l, tuple) else l for l in lines]
        if align == 'r' and not any(str(l).lstrip().startswith(('•', '–')) for l in flat):
            align = 'c'
        sh = self.rect(s, x, y, w, h, fill=fill, line=line,
                       shape=MSO_SHAPE.ROUNDED_RECTANGLE if round_ else MSO_SHAPE.RECTANGLE)
        if round_:
            sh.adjustments[0] = 0.08
        # 19/11/2026 "not focused": text sits in the middle of its card, not stuck to the top with empty space below
        self.text(s, x, y, w, h, lines, size=size, color=color, bold=bold, align=align, anchor='m', gap=gap, shape=sh)
        if strip and w > 1.2:
            self.rect(s, x + w - 0.09, y + 0.08, 0.09, h - 0.16, fill=strip)
        return sh

    @staticmethod
    def _recolor(lines):
        """White text inside a tinted box becomes the box's dark ink (per-line colours set by a deck)."""
        if isinstance(lines, str):
            return lines
        outl = []
        for ln in lines:
            if isinstance(ln, tuple) and ln[1].get('color') == 'FFFFFF':
                o = dict(ln[1]); o.pop('color'); outl.append((ln[0], o))
            else:
                outl.append(ln)
        return outl

    def pic(self, s, path, x, y, w, h):
        """Fit the picture inside the frame, centred, keeping its proportions."""
        from PIL import Image
        iw, ih = Image.open(path).size
        k = min(w / iw, h / ih)
        pw, ph = iw * k, ih * k
        return s.shapes.add_picture(path, Inches(x + (w - pw) / 2), Inches(y + (h - ph) / 2), Inches(pw), Inches(ph))

    def photo_slot(self, s, x, y, w, h, what):
        self.rect(s, x, y, w, h, fill='F7F9FA', line=GREY, dash=True, lw=1.5)
        self.text(s, x, y, w, h, [('להוסיף תמונה', {'bold': True, 'size': 16, 'color': GREY}),
                                  (what, {'size': 13, 'color': GREY})], align='c', anchor='m')

    # ---- slide frames ----------------------------------------------------------------------------------------
    def cover(self, title, sub, lines):
        s = self._slide()
        self._gradient(self.rect(s, 0, 0, W, H))
        self.rect(s, 0, 5.55, W, 0.05, fill=LINE)
        self.pic(s, self.logo, W - 3.1, 0.55, 2.5, 1.6)
        self.text(s, 0.8, 2.3, W - 1.6, 1.5, title, size=46, color=INK, bold=True, anchor='m', align='c')
        self.text(s, 0.8, 3.85, W - 1.6, 1.2, sub, size=24, color='3F5B6E', anchor='t', align='c')
        self.text(s, 0.8, 5.8, W - 1.6, 1.3, lines, size=16, color='3F5B6E', align='c')
        return s

    def slide(self, title, source=None, kicker=None):
        s = self._slide()
        self.rect(s, 0, 0, W, 1.2, fill='F2F7FB')
        self.rect(s, 0, 1.2, W, 0.04, fill=LINE)
        self.pic(s, self.logo, 0.36, 0.2, 1.18, 0.8)
        if kicker:
            self.text(s, 1.8, 0.1, W - 2.2, 0.35, kicker, size=13, color=GREY)
            self.text(s, 1.8, 0.4, W - 2.2, 0.75, title, size=28, color=INK, bold=True, anchor='m')
        else:
            self.text(s, 1.8, 0.15, W - 2.2, 0.9, title, size=30, color=INK, bold=True, anchor='m')
        self.rect(s, 0.4, 7.02, W - 0.8, 0.012, fill=BAND)
        self.text(s, 0.4, 7.06, 1.2, 0.3, str(self.n), size=11, color=GREY, align='l')
        foot = self.footer + ('  |  מקור: ' + source if source else '')
        self.text(s, 1.7, 7.06, W - 2.1, 0.3, foot, size=10.5, color=GREY)
        return s

    def section(self, num, title, sub):
        s = self._slide()
        self._gradient(self.rect(s, 0, 0, W, H))
        self.text(s, 0.8, 1.9, W - 1.6, 1.3, num, size=80, color=LINE, bold=True, align='c')
        self.text(s, 0.8, 3.3, W - 1.6, 1.0, title, size=40, color=INK, bold=True, align='c')
        self.text(s, 0.8, 4.4, W - 1.6, 1.0, sub, size=20, color='3F5B6E', align='c')
        return s

    def _gradient(self, sh):
        sp = sh._element.spPr
        for tag in ('a:solidFill', 'a:noFill', 'a:gradFill'):
            for e in sp.findall(qn(tag)):
                sp.remove(e)
        g = etree.SubElement(sp, qn('a:gradFill')); g.set('rotWithShape', '1')
        gl = etree.SubElement(g, qn('a:gsLst'))
        for pos, col in (('0', 'FFFFFF'), ('100000', 'DCEAF4')):
            gs = etree.SubElement(gl, qn('a:gs')); gs.set('pos', pos)
            c = etree.SubElement(gs, qn('a:srgbClr')); c.set('val', col)
        lin = etree.SubElement(g, qn('a:lin')); lin.set('ang', '5400000'); lin.set('scaled', '1')
        # gradFill must come before <a:ln>
        ln = sp.find(qn('a:ln'))
        if ln is not None:
            sp.remove(g); ln.addprevious(g)
        sh.line.fill.background()

    # ---- content blocks --------------------------------------------------------------------------------------
    def bullets(self, s, x, y, w, h, items, size=19, gap=9, mark='•', color=TEXT):
        lines = []
        for it in items:
            if isinstance(it, tuple):
                t, o = it
                o = dict(o)
                if o.pop('head', False):
                    lines.append((t, dict({'bold': True, 'color': INK, 'size': size + 1}, **o)))
                elif o.pop('sub', False):
                    lines.append(('– ' + t, dict({'size': size - 2, 'color': '3A4750'}, **o)))
                else:
                    lines.append((mark + ' ' + t, o))
            else:
                lines.append(mark + ' ' + it)
        return self.text(s, x, y, w, h, lines, size=size, gap=gap, color=color)

    def table(self, s, x, y, w, rows, widths, size=14, head_h=0.56, row_h=0.5, fills=None, colors=None, bold_col0=True):
        """rows[0] is the header. Column 0 is the rightmost (the table is RTL). fills/colors: {(r,c): hex}."""
        nr, nc = len(rows), len(rows[0])
        gf = s.shapes.add_table(nr, nc, Inches(x), Inches(y), Inches(w), Inches(head_h + row_h * (nr - 1)))
        t = gf.table
        tblPr = t._tbl.tblPr
        tblPr.set('rtl', '1'); tblPr.set('firstRow', '0'); tblPr.set('bandRow', '0')
        tot = float(sum(widths))
        for c in range(nc):
            t.columns[c].width = Inches(w * widths[c] / tot)
        for r in range(nr):
            t.rows[r].height = Inches(head_h if r == 0 else row_h)
            for c in range(nc):
                cell = t.cell(r, c)
                cell.margin_left = cell.margin_right = Inches(0.08)
                cell.margin_top = cell.margin_bottom = Inches(0.04)
                cell.vertical_anchor = MSO_ANCHOR.MIDDLE
                if r == 0:
                    fill, col, b = IDX, 'FFFFFF', True
                else:
                    fill, col, b = ('F3F7FA' if r % 2 == 0 else 'FFFFFF'), TEXT, (c == 0 and bold_col0)
                fill = (fills or {}).get((r, c), fill)
                col = (colors or {}).get((r, c), col)
                fill, col, _ = soft(fill, col)
                cell.fill.solid(); cell.fill.fore_color.rgb = rgb(fill)
                tf = cell.text_frame; tf.word_wrap = True
                parts = str(rows[r][c]).split('\n')
                for i, part in enumerate(parts):
                    p = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
                    # short cells (numbers, dates, levels) centred; sentences stay right-aligned
                    p.alignment = PP_ALIGN.CENTER if len(str(rows[r][c])) <= 18 else PP_ALIGN.RIGHT
                    p._p.get_or_add_pPr().set('rtl', '1')
                    run = p.add_run(); run.text = ltr(part)
                    run.font.name = 'Arial'; run.font.size = Pt(11.5 if r == 0 and size < 11.5 else size)
                    run.font.bold = b; run.font.color.rgb = rgb(col)
        return gf

    def steps(self, s, x, y, w, items, h=0.78, gap=0.14, size=16, num_fill=BLUE):
        """Numbered rows, number badge on the right."""
        for i, it in enumerate(items):
            yy = y + i * (h + gap)
            self.box(s, x, yy, w - 0.85, h, it, size=size, fill=CARD)
            self.box(s, x + w - 0.72, yy, 0.72, h, str(i + 1), size=22, bold=True, color='FFFFFF', fill=num_fill, align='c')

    def save(self, path):
        self.prs.save(path)
        stamp(path)
        fix_fonts(path)


def fix_fonts(path):
    """Fill <a:cs typeface="Arial"/> and lang="he-IL" so Hebrew is not drawn in a fallback font."""
    tmp = path + '.tmp'
    zin = zipfile.ZipFile(path)
    zout = zipfile.ZipFile(tmp, 'w', zipfile.ZIP_DEFLATED)
    pat = re.compile(r'ppt/(slides|charts|theme|slideLayouts|slideMasters)/[^/]+\.xml$')
    for item in zin.infolist():
        data = zin.read(item.filename)
        if pat.match(item.filename):
            x = data.decode('utf-8')
            x = re.sub(r'<a:cs typeface="[^"]*"', '<a:cs typeface="Arial"', x)
            # a run with a latin font and no cs font: add one right after latin
            x = re.sub(r'(<a:latin typeface="Arial"[^>]*/>)(?!<a:ea|<a:cs)', r'\1<a:cs typeface="Arial"/>', x)

            def lang(m):
                tag = m.group(0)
                if ' lang=' in tag:
                    return tag
                return tag.replace('<a:' + m.group(1), '<a:' + m.group(1) + ' lang="he-IL" altLang="en-US"', 1)
            x = re.sub(r'<a:(rPr|defRPr|endParaRPr)\b[^>]*>', lang, x)
            data = x.encode('utf-8')
        zout.writestr(item, data)
    zin.close(); zout.close()
    shutil.move(tmp, path)


# 19/11/2026 (Michael: the decks must say they were prepared by him; questionnaire: "do it: on the cover and at the bottom
# of every slide", "do it: with the role"). stamp() works on a saved file, so it also marks a deck Michael already edited
# in PowerPoint (his pictures stay). A slide that already carries the line is left alone.
BY = '\u05d4\u05d5\u05db\u05df \u05e2\u05dc \u05d9\u05d3\u05d9: \u05de\u05d9\u05db\u05d0\u05dc \u05e4\u05e8\u05d9\u05d9\u05dc\u05d9\u05da, \u05de\u05de\u05d5\u05e0\u05d4 \u05d1\u05d8\u05d9\u05d7\u05d5\u05ea \u05d5\u05d0\u05d9\u05db\u05d5\u05ea \u05d4\u05e1\u05d1\u05d9\u05d1\u05d4'


def stamp(path):
    prs = Presentation(path)
    n = 0
    for i, s in enumerate(prs.slides):
        if any(sh.has_text_frame and BY in sh.text_frame.text for sh in s.shapes):
            continue
        cover = i == 0
        tb = s.shapes.add_textbox(Inches(0.8), Inches(6.72 if cover else 7.25), Inches(W - 1.6), Inches(0.5 if cover else 0.22))
        tf = tb.text_frame
        tf.margin_top = tf.margin_bottom = Inches(0)
        para = tf.paragraphs[0]
        para.alignment = PP_ALIGN.CENTER
        para._p.get_or_add_pPr().set('rtl', '1')
        r = para.add_run(); r.text = BY
        r.font.name = 'Arial'; r.font.size = Pt(16 if cover else 9); r.font.bold = cover
        r.font.color.rgb = rgb(INK if cover else GREY)
        n += 1
    prs.save(path)
    fix_fonts(path)
    return n


if __name__ == '__main__':
    import sys
    for f in sys.argv[1:]:
        print(stamp(f), f)
