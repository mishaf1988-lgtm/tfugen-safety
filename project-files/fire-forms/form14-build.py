# Form 14 (emergency team training) overlay on the official fire-department form.
# Inputs sit beside it at run time and are NOT committed (workers IDs, personal certificates):
# old14.pdf (official form from OneDrive), ../scan/hi-1.png (signed attendance), and the certificates.
import io
from pypdf import PdfReader, PdfWriter
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.utils import ImageReader
pdfmetrics.registerFont(TTFont('DV','/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'))
W,H=595.32,841.92
def heb(s): return s[::-1]   # visual order for plain Hebrew words (no digits inside)
def overlay(draw):
    b=io.BytesIO(); c=canvas.Canvas(b,pagesize=(W,H)); draw(c); c.save(); b.seek(0); return PdfReader(b).pages[0]
def white(c,x0,y0,x1,y1):  # top-origin coords
    c.setFillColorRGB(1,1,1); c.setStrokeColorRGB(1,1,1); c.rect(x0,H-y1,x1-x0,y1-y0,fill=1,stroke=0); c.setFillColorRGB(0,0,0)
old=PdfReader('old14.pdf'); out=PdfWriter()
def p1(c):
    white(c,60,203,124,221)            # old form date -> empty, Michael dates it when signing
    white(c,338,478,404,496); c.setFont('DV',11); c.drawString(345,H-492,'02.03.2026')
    white(c,195,478,262,496); c.drawRightString(260,H-492,heb('מיכאל פרייליך'))
    white(c,518,562,534,584)           # the old tick: Michael ticks the line that is true for him
pg=old.pages[0]; pg.merge_page(overlay(p1)); out.add_page(pg)
def p2(c):
    white(c,40,98,560,518)
    img=ImageReader('../scan/hi-1.png'); iw,ih=img.getSize()
    h=415; w=h*iw/ih; c.drawImage(img,(W-w)/2,H-100-h,w,h)
pg=old.pages[1]; pg.merge_page(overlay(p2)); out.add_page(pg)
def p3(c):
    white(c,327,426,402,444); c.setFont('DV',11); c.drawRightString(400,H-439,heb('מיכאל פרייליך'))
    white(c,88,392,249,472); c.setStrokeColorRGB(0,0,0); c.line(90,H-442,248,H-442)
pg=old.pages[2]; pg.merge_page(overlay(p3)); out.add_page(pg)
for f in ('appoint2025.pdf','firecert.pdf','yoetz.pdf'):
    for p in PdfReader(f).pages[:1]: out.add_page(p)
out.add_metadata({'/Title':'Form 14 - emergency team training 02.03.2026'})
out.write(open('form14-new.pdf','wb'))
