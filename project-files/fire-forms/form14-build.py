# Form 14 (emergency team training) overlay on the official fire-department form.
# Inputs sit beside it at run time and are NOT committed (workers IDs, personal certificates):
# old14.pdf (official form from OneDrive), ../scan/hi-1.png (signed attendance), and the certificates.
import io, os
from pypdf import PdfReader, PdfWriter
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.utils import ImageReader
pdfmetrics.registerFont(TTFont('DV','/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'))
W,H=595.32,841.92
SIGNED='11.10.2026'   # date on page 1 = the day Michael signed (signing page, 11/10/2026)
def heb(s): return s[::-1]   # visual order for plain Hebrew words (no digits inside)
def overlay(draw):
    b=io.BytesIO(); c=canvas.Canvas(b,pagesize=(W,H)); draw(c); c.save(); b.seek(0); return PdfReader(b).pages[0]
def white(c,x0,y0,x1,y1):  # top-origin coords
    c.setFillColorRGB(1,1,1); c.setStrokeColorRGB(1,1,1); c.rect(x0,H-y1,x1-x0,y1-y0,fill=1,stroke=0); c.setFillColorRGB(0,0,0)
old=PdfReader('old14.pdf'); out=PdfWriter()
BIZ = dict(  # copied from fire forms 8 (01/09/2026) and 10 (06/09/2026) in OneDrive, Michael chose file 260012-1 (11/10/2026)
    hp='511969008', kind='מפעל מזון', name='תעשיות תפוגן בע"מ', file='260012-1',
    city='שדרות', street='אזה"ת שער הנגב', zip='8701402', pob='571',
    person='מיכאל פרייליך', role=('מנהל איכות סביבה','ובטיחות'), phone='0547940073', mail='sviva@tapugan.co.il')
def mid(c,x0,x1,y,s,size=9,rtl=True):  # centred in a cell, top-origin y of the text baseline
    c.setFont('DV',size); c.drawCentredString((x0+x1)/2,H-y,heb(s) if rtl else s)
def boxes(c,edges,s):  # one character per box, filling the rightmost boxes
    cells=list(zip(edges,edges[1:]))[-len(s):]
    c.setFont('DV',10)
    for (x0,x1),ch in zip(cells,s): c.drawCentredString((x0+x1)/2,H-315,ch)
def p1(c):
    white(c,60,203,124,221); c.setFont('DV',11); c.drawString(64,H-217,SIGNED)   # the day Michael signed on the signing page
    b=BIZ
    boxes(c,[43.2,55.8,68.4,81.4,94.0,106.6,119.5,132.1,144.0,157.7,169.9],b['hp'])     # box edges measured on the form at 200dpi
    boxes(c,[410.8,428.0,445.3,461.5,479.5,496.8,514.1,531.0,548.3,565.2],b['file'])
    mid(c,171,297,315,b['kind']); mid(c,298,412,315,b['name'])
    mid(c,462,574,359,b['city']); mid(c,280,461,359,b['street']); mid(c,145,234,359,b['zip'],10,False); mid(c,44,144,359,b['pob'],10,False)
    mid(c,419,574,405,b['person']); mid(c,361,418,401,b['role'][0],6.5); mid(c,361,418,408,b['role'][1],6.5)
    mid(c,235,360,405,b['phone'],10,False); mid(c,44,234,405,b['mail'],9,False)
    c.setFont('DV',10); c.drawCentredString(388,H-428,heb(b['person']))   # para 1, owner's name; the ID stays for Michael
    white(c,338,478,404,496); c.setFont('DV',11); c.drawString(345,H-492,'02.03.2026')
    white(c,195,478,262,496); c.drawRightString(260,H-492,heb('מיכאל פרייליך'))
    white(c,518,562,534,584); c.setFont('DV',13); c.drawString(521,H-579,'√')   # route 1, Michael chose it in a questionnaire (11/10/2026)
pg=old.pages[0]; pg.merge_page(overlay(p1)); out.add_page(pg)
def p2(c):
    white(c,40,98,560,518)
    if not os.path.exists('../scan/hi-1.png'): print('missing ../scan/hi-1.png'); return
    img=ImageReader('../scan/hi-1.png'); iw,ih=img.getSize()
    h=415; w=h*iw/ih; c.drawImage(img,(W-w)/2,H-100-h,w,h)
pg=old.pages[1]; pg.merge_page(overlay(p2)); out.add_page(pg)
SIG='sig.png'   # Michael's signature, saved on the signing page (artifact 8YG6U1r72asze2EFHxz4db, db doc sig/michael)
def sign(c,x0,x1,base):
    if not os.path.exists(SIG): print('missing',SIG); return
    img=ImageReader(SIG); iw,ih=img.getSize(); h=min(34,(x1-x0)*ih/iw); w=h*iw/ih
    c.drawImage(img,(x0+x1)/2-w/2,H-base-2,w,h,mask='auto')
def p3(c):
    c.setFont('DV',11); c.drawCentredString(378,H-370,heb('מיכאל פרייליך'))   # owner's name (Michael signs for the factory)
    sign(c,108,248,374)
    white(c,327,426,402,444); c.setFont('DV',11); c.drawRightString(400,H-439,heb('מיכאל פרייליך'))
    white(c,88,380,249,472); c.setStrokeColorRGB(0,0,0); c.line(90,H-442,248,H-442)
    sign(c,90,248,442)
pg=old.pages[2]; pg.merge_page(overlay(p3)); out.add_page(pg)
for f in ('safetycert.pdf','firecert.pdf','yoetz.pdf'):   # Michael (11/10/2026): the safety officer certificate itself, not the 2025 appointment letter
    if not os.path.exists(f): print('missing',f); continue
    for p in PdfReader(f).pages[:1]: out.add_page(p)
out.add_metadata({'/Title':'Form 14 - emergency team training 02.03.2026'})
out.write(open('form14-new.pdf','wb'))
