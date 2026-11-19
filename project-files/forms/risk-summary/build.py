#!/usr/bin/env python3
# Builds risk-summary.docx on the factory's controlled template (logo, header table, page X of Y are the template's
# own header2.xml and media; only the body, four header texts and the side margins change).
# Usage: python3 -I build.py <template-13.07.docx> <out.docx>
import re, sys, zipfile
from xml.sax.saxutils import escape

tpl, out = sys.argv[1], sys.argv[2]
TW = 9478  # the width of the template's header table
SZ = 20    # body text, half points
FONT = '<w:rFonts w:ascii="David" w:hAnsi="David" w:cs="David"/>'
BL = '________'


def run(t, b=False, sz=SZ):
    return ('<w:r><w:rPr>' + FONT + ('<w:b/><w:bCs/>' if b else '') + '<w:sz w:val="%d"/><w:szCs w:val="%d"/><w:rtl/></w:rPr>'
            '<w:t xml:space="preserve">%s</w:t></w:r>') % (sz, sz, escape(t))


def para(parts, align=None, before=0, after=0, shade=False, brk=False, sz=SZ, keep=False):
    # parts: a string, or a list of (text, bold)
    if isinstance(parts, str):
        parts = [(parts, False)]
    ppr = '<w:pPr>' + ('<w:keepNext/>' if keep else '') + ('<w:pageBreakBefore/>' if brk else '')
    if shade:
        ppr += '<w:shd w:val="clear" w:color="auto" w:fill="D9D9D9"/>'
    ppr += '<w:bidi/><w:spacing w:before="%d" w:after="%d"/>' % (before, after)
    if align:
        ppr += '<w:jc w:val="%s"/>' % align
    ppr += '<w:rPr>' + FONT + '<w:sz w:val="%d"/><w:szCs w:val="%d"/><w:rtl/></w:rPr></w:pPr>' % (sz, sz)
    return '<w:p>' + ppr + ''.join(run(t, b, sz) for t, b in parts) + '</w:p>'


def cell(w, content, span=1, fill=None):
    tcpr = '<w:tcPr><w:tcW w:w="%d" w:type="dxa"/>' % w
    if span > 1:
        tcpr += '<w:gridSpan w:val="%d"/>' % span
    if fill:
        tcpr += '<w:shd w:val="clear" w:color="auto" w:fill="%s"/>' % fill
    tcpr += '<w:vAlign w:val="center"/></w:tcPr>'
    return '<w:tc>' + tcpr + content + '</w:tc>'


def table(widths, rows, height=None, borders=True):
    # rows: list of lists of (content_xml, span, fill) ; height in twips (atLeast)
    b = ''.join('<w:%s w:val="single" w:sz="4" w:space="0" w:color="auto"/>' % k
                for k in ('top', 'left', 'bottom', 'right', 'insideH', 'insideV')) if borders else ''
    x = ('<w:tbl><w:tblPr><w:bidiVisual/><w:tblW w:w="%d" w:type="dxa"/><w:jc w:val="center"/>'
         '<w:tblBorders>%s</w:tblBorders><w:tblLayout w:type="fixed"/>'
         '<w:tblCellMar><w:top w:w="15" w:type="dxa"/><w:left w:w="70" w:type="dxa"/><w:bottom w:w="15" w:type="dxa"/>'
         '<w:right w:w="70" w:type="dxa"/></w:tblCellMar></w:tblPr><w:tblGrid>%s</w:tblGrid>') % (
        sum(widths), b, ''.join('<w:gridCol w:w="%d"/>' % w for w in widths))
    for r in rows:
        x += '<w:tr><w:trPr><w:cantSplit/>' + ('<w:trHeight w:val="%d"/>' % height if height else '') + '</w:trPr>'
        i = 0
        for c in r:
            content, span, fill = (tuple(c) + (1, None)[len(c) - 1:])[:3] if isinstance(c, tuple) else (c, 1, None)
            x += cell(sum(widths[i:i + span]), content, span, fill)
            i += span
        x += '</w:tr>'
    return x + '</w:tbl>'


def head(t):
    return para([(t, True)], before=70, after=20, shade=True, sz=21, keep=True)


GENERAL = [
    ('מלגזות, משאיות וכלי רכב', 'הולכים רק במדרכות ובמעברי החצייה, עם אפוד זוהר. מלגזה מפעיל רק מי שמורשה.'),
    ('מכונות ומסועים בתנועה', 'לא מכניסים יד למכונה פועלת או מחוברת לחשמל. לא מורידים מגן או חיישן. לא מטפסים על מכונה. '
                              'מפעילים רק מכונה שהודרכת עליה. תקלה: קוראים למפעיל.'),
    ('שמן חם, מים חמים וקיטור', 'לא נוגעים בצנרת ובמטגנת.'),
    ('רצפה רטובה', 'הולכים, לא רצים. נעלי בטיחות.'),
    ('רעש', 'אטמי אוזניים בכל אולמות המפעל.'),
    ('חומרי ניקוי וחומרים מסוכנים', 'מנקים רק אחרי הוראה ממנהל המחלקה או מהמפעיל, עם ציוד מגן מלא. לא מערבבים חומרים. '
                                    'לא מתיזים מים על שקעים ולוחות חשמל.'),
    ('אמוניה (מערכת הקירור)', 'ריח חריף: מתרחקים ומודיעים מיד. כריזה: מתפנים.'),
    ('חדרי קירור', 'ביגוד חם. נזהרים ממלגזות ומרצפה מחליקה.'),
    ('עבודה בגובה, מעל 2 מטר', 'רק מי שהוסמך לעבודה בגובה. לא מטפסים על שקים, מכלים ומסועים.'),
    ('חשמל', 'עובד לא מטפל בחשמל.'),
]

DEPTS = [
    ('ייצור טוגנים', [
        ('מכונות, מסועים וחילזון: היתפסות ופציעה',
         'לא מכניסים יד. לא פותחים מכונה בזמן עבודה. טיפול בתקלה: רק אחרי עצירה ונעילה, ורק מי שהוסמך.'),
        ('ירידה לבונקר וחילוץ מעצור: נפילה מסולם ומפולת תפוחי אדמה',
         'רק בזוג, בסולם תקין, ורק מי שהודרך.'),
        ('שמן חם, קיטור וצנרת חמה: כוויות ופגיעה בעיניים',
         'בדגימת שמן: משקפי מגן וכפפות חום. לא נוגעים בצנרת ובמקלפת. ליד המטגנת: אוחזים במסעד היד.')],
     'באולם ייצור הטוגנים חובשים קסדה. המעבר לאריזה: בצמוד לקיר, לא מתחת למכונות.'),
    ('מעוצבים', [
        ('מטחנה: סכינים מסתובבים אחרי פתיחת המכסה',
         'לא פותחים מכסה ולא מכניסים יד עד שהסכינים נעצרו לגמרי.'),
        ('מכונה מעצבת: פגיעה מחלקים נעים',
         'עובדים רק כשהמיגון במקום. לא מכניסים יד למכונה פועלת.'),
        ('מטגנת ודגימת שמן: כוויות ופגיעה בעיניים משמן חם',
         'משקפי מגן. שמים לב לשלט "זהירות חום גבוה".')], None),
    ('אריזה', [
        ('מכונת שרינק (עיטוף משטחים): פגיעה בזמן סיבוב המכונה',
         'לא נכנסים לאזור הסיבוב כשהמכונה עובדת. לא עוקפים את העין האופטית.'),
        ('רובוט האריזה: פגיעה בזמן תנועת הרובוט',
         'לא נכנסים לתחום הרובוט. לא עוברים את השרשרת ואת שלט "אין כניסה".'),
        ('מלגזות בחדר הרובוט: פגיעה בהולך רגל',
         'הולכים רק במסלול המסומן, עם אפוד זוהר. מסתכלים במראות.')], None),
    ('חומר גלם', [
        ('משאיות, מלגזות וכלי שינוע: פגיעה בהולך רגל',
         'אפוד זוהר תמיד. הולכים רק במעבר המסומן. שמים לב לשילוט ולמראות.'),
        ('פריקת משאית, פתיחת דלתות: נפילה',
         'רק מי שהודרך, ולפי ההדרכה. לא מטפסים על המשאית ועל המטען.'),
        ('אזור עבודה לח: החלקה',
         'נעלי עבודה נגד החלקה. הולכים, לא רצים. שומרים על אזור נקי.')], None),
    ('מחסנים ותוצרת גמורה', [
        ('רצפה רטובה או קפואה: החלקה ושברים',
         'הולכים לאט. מדווחים מיד על קרח או רטיבות.'),
        ('עבודה בקור ובמקררים: פגיעת קור, והילכדות במקרר',
         'ביגוד חם. הפסקות מסודרות. נלכדת: לוחצים על לחצן המצוקה "אדם לכוד".'),
        ('אחסון בגובה ומערום סחורה: נפילת סחורה וקריסת מערום',
         'קסדת מגן. מעמיסים רק עד הגובה המותר, ורק באזור המסומן.')], None),
    ('אחזקה', [
        ('עבודות חשמל וטיפול בתקלות: התחשמלות',
         'רק חשמלאי, שניים יחד. נעילה ותיוג לפני הטיפול. שטיח מבודד וציוד בדוק.'),
        ('ריתוך: קרינה, התזות והתחשמלות',
         'רק מי שהוכשר. מסכת ריתוך וביגוד מלא. בודקים את הציוד לפני העבודה.'),
        ('כניסה לחלל מוקף: חנק, גזים ואש',
         'רק עם אישור כניסה, מדידת גזים, מלווה וציוד חילוץ.')],
     'לפני טיפול במכונה: מנתקים את מקורות האנרגיה.'),
]

W2 = [2650, TW - 2650]
W3 = [3900, TW - 3900]


def page(dept, first):
    x = para([('תמצית מידע בכתב על סיכונים בעבודה', True)], align='center', sz=26, brk=not first)
    x += para('תעשיות תפוגן בע"מ. לפי תקנה 7 לתקנות ארגון הפיקוח על העבודה (מסירת מידע והדרכת עובדים), תשנ"ט-1999.',
              align='center', after=50, sz=18)
    name, rows, note = dept if dept else (None, None, None)
    wk = [3160, 3160, 3158]
    x += table(wk, [
        [para('שם העובד: '), para('מס\' ת.ז.: '), para('תאריך: ')],
        [para([('מחלקה: ', False), (name or '', True)]), (para('תפקיד / עמדה: '), 2)],
        [(para([('נמסר:', True), ('   [  ] ביום תחילת העבודה        [  ] במעבר לתפקיד או לעמדה חדשה', False)]), 3)],
    ], height=320)

    x += head('1. הסיכונים במפעל, ומה עושים')
    x += table(W2, [[para([(a, True)]), para(b)] for a, b in GENERAL])

    if dept:
        x += head('2. הסיכונים בעמדה שלך: מחלקת ' + name)
        x += table(W3, [[para([(a, True)]), para(b)] for a, b in rows])
        if note:
            x += para([('ועוד: ', True), (note, False)], before=30)
    else:
        x += head('2. הסיכונים בעמדה שלך (ממלא מנהל המחלקה)')
        x += table(W2, [[(para([('הסיכון', True)]), 1, 'F2F2F2'), (para([('מה עושים', True)]), 1, 'F2F2F2')]])
        x += table(W2, [[para(''), para('')] for _ in range(3)], height=420)
    x += para('מכונות וציוד שהודרכת עליהם: ' + BL * 8, before=50)

    x += head('3. ציוד מגן אישי שקיבלת')
    pw = [2370, 2370, 2370, 2368]
    x += table(pw, [[para('[  ] ' + t) for t in r] for r in (
        ('נעלי בטיחות', 'אטמי אוזניים', 'אפוד זוהר', 'קסדה'),
        ('כפפות', 'משקפי מגן', 'ביגוד חם לקירור', 'אחר: ' + BL))], borders=False)

    x += head('4. חירום')
    x += para([('"צבע אדום": ', True), ('הולכים מהר ובזהירות למרחב המוגן הקרוב. המפעיל מראה לך איפה הוא.', False)], before=20)
    x += para([('כריזת פינוי: ', True), ('יוצאים לנקודת הכינוס מחוץ לשער הכניסה הראשי. '
                                         'אם הכריזו: לנקודה החלופית, מחוץ לשער חו"ג (השער הצהוב).', False)])
    x += para([('בנקודת הכינוס: ', True), ('נרשמים, ולא חוזרים פנימה עד שמודיעים.', False)])

    x += head('5. מפגע, תאונה או כמעט תאונה')
    x += para('מודיעים מיד למפעיל או למנהל, לנאמן הבטיחות של המחלקה או לממונה הבטיחות. '
              'בתאונה קוראים גם למגיש העזרה הראשונה. '
              'השמות של ממונה הבטיחות ושל נאמני הבטיחות: על לוח המודעות.', before=20)

    x += head('6. החובות שלך (תקנה 13)')
    x += para('להודיע על כל סיכון שגילית בזמן העבודה. להגיע לכל הדרכה שהזמינו אותך אליה. '
              'וכן: להשתמש בציוד המגן שקיבלת, ולא להפעיל מכונה שלא הודרכת עליה.', before=20)

    x += para('התמצית נמסרה בעברית, ובשפה נוספת המובנת לעובד: ' + BL + '  לפי תקנה 7(ב).', before=80, after=40)
    ws = [TW // 2, TW - TW // 2]
    x += table(ws, [
        [para([('מסר התמצית', True)]), para([('העובד: קיבלתי, קראתי והבנתי', True)])],
        [para('שם ותפקיד: ' + BL * 2 + '   חתימה: ' + BL), para('חתימה: ' + BL * 2)],
    ], height=340)
    return x


body = page(None, True) + ''.join(page(d, False) for d in DEPTS)

zin = zipfile.ZipFile(tpl)
zout = zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED)
for it in zin.infolist():
    data = zin.read(it.filename)
    if it.filename == 'word/document.xml':
        d = data.decode('utf8')
        a = d.index('<w:body>') + len('<w:body>')
        b = d.rindex('<w:sectPr')
        sect = d[b:]
        sect, n = re.subn(r'<w:pgMar [^>]*/>',
                          '<w:pgMar w:top="1919" w:right="1214" w:bottom="900" w:left="1214" w:header="708" w:footer="500" w:gutter="0"/>',
                          sect)
        assert n == 1
        # the closing empty paragraph is tiny, so it never opens an eighth page
        tail = '<w:p><w:pPr><w:bidi/><w:spacing w:before="0" w:after="0" w:line="20" w:lineRule="exact"/><w:rPr><w:sz w:val="2"/><w:szCs w:val="2"/></w:rPr></w:pPr></w:p>'
        data = (d[:a] + body + tail + sect).encode('utf8')
    elif it.filename == 'word/header2.xml':
        h = data.decode('utf8')
        for old, new in [('מכשור לניטור מדידה ובקרה', 'הדרכה, הסמכה וכשירות'),
                         ('פריסת אמצעי גילוי והתראה לדליפת אמוניה ', 'תמצית מידע בכתב על סיכונים בעבודה'),
                         ('תיעוד 13.07', 'מספר טופס: ____'),
                         ('28/04/2026', '19/11/2026')]:
            assert h.count('>' + old + '<') == 1, old
            h = h.replace('>' + old + '<', '>' + new + '<')
        data = h.encode('utf8')
    elif it.filename == 'word/settings.xml':
        data = data.decode('utf8').replace('<w:trackRevisions/>', '').encode('utf8')
    elif it.filename == 'docProps/core.xml':
        c = data.decode('utf8')
        c = re.sub(r'<dc:title>[^<]*</dc:title>', '<dc:title>תמצית מידע בכתב על סיכונים בעבודה</dc:title>', c)
        data = c.encode('utf8')
    zout.writestr(it, data)
zout.close()
print('ok', out)
