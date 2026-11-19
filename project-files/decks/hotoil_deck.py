# Hot oil, fryers and thermal-oil heaters training deck for fryer-line operators and maintenance (19/11/2026, Michael:
# decks per training-coverage.md; "quality, interesting to teach", "attach pictures from the internet").
# Roles only, no names or phone numbers. The "prepared by" line is added by deck_lib.save().
# Usage: python3 hotoil_deck.py <out.pptx> <logo.jpg>
# Sources read on 19/11/2026 (OneDrive safety folder unless noted):
#   INV  12_תאונות ואירועים/תאונות עבודה/2026/<worker> 26.07.2026/<same name>.pdf (form 32.02, written 05/08/2026):
#        26/07/2026 06:30, fries production, oil pump area; pump stuck by filter cloth; bolts opened on the control
#        room's word only, no physical check of the valves, no draining, no zero-pressure check; hot oil on the hand;
#        the worker bandaged it himself and went back to work. Also "הדרכה.pdf" in the same folder (maintenance
#        refresher, scanned, read as images): energy sources incl. oil and heat, LOTO, zero-energy check.
#   INV2 12_תאונות ואירועים/תאונות עבודה/2026/<worker>/22.02.2026 <worker>.pdf: 22/02/2026 07:30, peeling, hot water
#        from the peeler condensate tank discharge pipe, fabric S3 shoes let it through, burn to the leg.
#   JSA  14_סקרי סיכונים/02_סקרי סיכונים מחלקתיים/מטוגנים/2025-06-18 - טבלת JSA מעובדת - מטוגנים.xlsx: row 5 oil
#        sampling (burns, eyes: goggles, heat gloves), oily floor, row 6 fire from the fryer (automatic extinguishing
#        system), row 12 LOTO. Also read: 2026-03-04 form 33.01 (same rows), 2019-06-06 risk assessment (nothing
#        specific on oil), 2025-03-12 JSA docx (no extractable text).
#   LOTO 14_סקרי סיכונים/03_LOTO וזירו אקסס/2026-05-06 - ניתוח LOTO וזירו אקסס - סקר מחלקות.xlsx, row "מטגנת +
#        מערכת שמן (לרבות פילטרים)": power off + wait for the oil to cool + personal lock.
#   A20  15_תיק ניהול הבטיחות ונהלים/הוראות עבודה/הוראות עבודה אחזקה - מהדורה C - 08.10.2026.pdf: 6.3, 6.8 (leather
#        and cloth gloves for hot equipment), 7.1 (release pipe pressure carefully and gradually, cover the opening,
#        eye/face/hand protection), 22.3 (burn: wash with cold water; serious: medical care), 27, 28 (frying oil
#        and thermal oil are combustible), 29.2, 29.5.
#   PLANT 15_תיק ניהול הבטיחות ונהלים/תיק מפעל/תיק מפעל - 31.03.2026.pdf: fire event b-d (oil by foam or powder, no
#        water, stop energy/heating to the unit), site description (thermal oil heaters, 4 frying-oil tanks).
#   EFF  02_תסקירי ציוד/דודי קיטור ומחוללים/TO-24076 .../נצילות/בתוקף/2026-01-25 ... 172-11573 (scanned, read as an
#        image): BBS thermal oil heater, actual working temperature 122 C on 25/01/2026. TO-23973 (15/02/2026,
#        172/11561א): "קטן 1", 500 KW, natural gas. TO-23919 (26/06/2024, 083510/207): right heater no. 2, shaped
#        products thermal oil room, 400 KW, natural gas, working pressure 10 bar.
#   DB   routine-db select: inc acc24-2, acc24-7, acc26-18, acc26-25; tour_hazards th-3, th-6, th-9,
#        th-muweg623dczz (n 56), th-mw3e2gnldn7y (n 67); equip_inspections TO rows; near_miss (nothing on oil).
#   LAW  Nevo 74793 (Safety at Work Ordinance) sections 44 and 51(a); Nevo 74835 (PPE regulations 1997) regs 3(a),
#        8(c), 9. All read word by word through source_read on 19/11/2026.
#   DECISIONS.md 16/11/2026: no written PPE procedure for hot oil yet (a task to write one).
# Left out on purpose: the frying-oil temperature and any flash/smoke point (no factory document in the safety folder
# states them; fire survey 08/2015 only gives a storage class); the power of the fries heater (report says "3,5000",
# the plant file 3,500 KW, the nameplate note in the DB 4,500 KW); flue-gas temperatures; the plant engineer's work
# instruction for the thermal oil heater (ARCHIVE, outside the safety folder, not read: the deck only says to work by
# it); the expired efficiency test of TO-23919 (a management follow-up, not a training point); minutes of cooling
# a burn (A20 22.3 gives none); hot work near fryers (covered in hotwork_deck.py).
# Pictures: project-files/decks/img/hotoil/ (credits.json), Openverse, CC0, CC BY 2.0 and CC BY-SA 2.0.
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from deck_lib import *

out, logo = sys.argv[1], sys.argv[2]
IMG = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'img', 'hotoil')
D = Deck(logo, 'הדרכת שמן חם ומטגנות  |  תעשיות תפוגן  |  19/11/2026')
A20 = 'הוראות בטיחות לאחזקה, מהדורה C'
INV = 'תחקיר תאונה 26/07/2026'
JSA = 'סקר סיכונים מטוגנים 18/06/2025'
PLANT = 'תיק מפעל 31/03/2026'


def photo(s, x, y, w, h, f, credit):
    """Illustrative internet picture in a light frame, with the credit line at the frame bottom.
    Licences and source links: img/hotoil/credits.json."""
    D.rect(s, x, y, w, h, fill='F7F9FA', line=GREY, lw=0.75)
    D.pic(s, os.path.join(IMG, f), x + 0.08, y + 0.06, w - 0.16, h - 0.42)
    D.text(s, x, y + h - 0.36, w, 0.33, 'תמונה להמחשה: ' + credit, size=10, color=GREY, align='c', anchor='m')


def ask(s, y, q, h=0.7, x=0.6, w=None, size=16):
    """One discussion line: the trainer asks the room."""
    D.box(s, x, y, w or (W - 1.2), h, [('שאלה לדיון:  ' + q, {'bold': True, 'size': size})], fill=AMBER)


# 1 ---------------------------------------------------------------------------------------------------------------
D.cover('שמן חם לא סולח',
        'מטגנות ודודי שמן תרמי: איפה נכווים, ואיך לא',
        ['הדרכה למפעילי קו הטיגון ולעובדי האחזקה',
         'תעשיות תפוגן בע"מ  |  מחלקת בטיחות ואיכות הסביבה  |  19/11/2026'])

# 2 ---------------------------------------------------------------------------------------------------------------
s = D.slide('מה נלמד היום')
parts = [('1', 'למה שמן חם שורף כל כך', 'ואיפה נכווים בקו הטיגון'),
         ('2', 'דודי השמן התרמי', 'מה זה, ואיך עובדים על מערכת שמן: קרה ומנותקת'),
         ('3', 'אש, ציוד מגן ועזרה ראשונה', 'שמן בוער, מה לובשים, ומה עושים בכוויה'),
         ('4', 'מה קרה אצלנו', 'כוויות מהמפעל, בדיקת הבנה ושישה כללים')]
for i, (n, t, d) in enumerate(parts):
    y = 1.6 + i * 1.3
    D.box(s, 11.6, y, 1.1, 1.12, n, size=34, bold=True, color='FFFFFF', fill=BLUE, align='c')
    D.box(s, 0.7, y, 10.75, 1.12, [(t, {'bold': True, 'size': 22, 'color': NAVY}), (d, {'size': 16})], fill=CARD, gap=2)

# 3 ---------------------------------------------------------------------------------------------------------------
s = D.slide('"אמרו לי שהברז סגור"', source=INV + ' (טופס 32.02)')
tl = [('26/07/2026, 06:30', 'משאבת השמן בטוגנים נתקעה. בד הפילטר נתפס בה.'),
      ('לפני העבודה', 'אנשי האחזקה עוברים בחדר הבקרה ומבקשים לסגור ברזים.'),
      ('מתחילים', 'חדר הבקרה מאשר. העובד, עם כפפות, פותח את הברגים.'),
      ('ואז', 'שמן חם ניתז מהקו ופוגע לו ביד.')]
for i, (t, d) in enumerate(tl):
    y = 1.5 + i * 0.93
    D.box(s, 9.95, y, 2.8, 0.8, t, size=16, bold=True, color='FFFFFF', fill=IDX, align='c')
    D.box(s, 4.9, y, 4.9, 0.8, d, size=15.5, fill=CARD)
D.box(s, 0.6, 1.5, 4.05, 3.59, [
    ('מה מצא התחקיר?', {'bold': True, 'size': 20, 'color': 'FFFFFF'}),
    ('אף אחד לא בדק בעצמו, ליד הברז, שהוא סגור.', {'size': 16, 'color': 'FFFFFF'}),
    ('הקו לא נוקז, ולא בדקו שאין בו לחץ.', {'size': 16, 'color': 'FFFFFF'}),
    ('נשאר בו שמן חם.', {'size': 16, 'color': 'FFFFFF', 'bold': True})], fill=RED)
D.box(s, 0.6, 5.3, W - 1.2, 1.5, [
    ('שאלה לחדר', {'bold': True, 'size': 19}),
    ('מה אתה בודק בעצמך, לפני שאתה פותח את הבורג הראשון?', {'size': 18, 'bold': True}),
    ('זה קרה אצלנו, לעובד ותיק, בבוקר רגיל. זה יכול לקרות לכל אחד מאיתנו.', {'size': 14})], fill=AMBER, gap=3)

# 4 ---------------------------------------------------------------------------------------------------------------
D.section('1', 'למה שמן חם שורף כל כך', 'ואיפה נכווים בקו הטיגון')

# 5 ---------------------------------------------------------------------------------------------------------------
s = D.slide('שמן חם זה לא מים חמים', source='תסקיר נצילות דוד הטוגנים 25/01/2026; ' + JSA)
photo(s, 0.6, 1.5, 4.3, 3.2, 'fryer.jpg', 'rawpixel, CC0')
why = [('חם יותר ממים רותחים', 'בבדיקת דוד הטוגנים (25/01/2026) השמן התרמי עבד ב-122 מעלות.'),
       ('נדבק, ולא נוזל הלאה', 'מים חמים נשפכים מהעור. שמן נשאר עליו ועל הבגד, וממשיך לשרוף.'),
       ('לא נראה חם', 'שמן בצינור או במכל נראה אותו דבר, קר או חם.'),
       ('מים + שמן חם = התזה', 'טיפת מים בשמן חם הופכת לאדים, ומעיפה שמן לכל הכיוונים.')]
for i, (t, d) in enumerate(why):
    y = 1.5 + i * 1.08
    D.box(s, 5.15, y, 7.6, 0.96, [(t, {'bold': True, 'size': 18, 'color': NAVY}), (d, {'size': 15})], fill=CARD, gap=2)
D.box(s, 0.6, 4.85, 4.3, 0.97, [
    ('וגם מחליק', {'bold': True, 'size': 16, 'color': 'FFFFFF'}),
    ('שמן על הרצפה? מנגבים מיד.', {'size': 15, 'color': 'FFFFFF'})], fill=RED, gap=2)
ask(s, 6.05, 'מי פה נכווה פעם משמן, בבית או בעבודה? מה קרה שם?')

# 6 ---------------------------------------------------------------------------------------------------------------
s = D.slide('איפה נכווים בקו הטיגון', source='סיורי מפגעים 06-11/2026; ' + JSA + '; סקר נעילה 06/05/2026')
D.table(s, 0.6, 1.45, W - 1.2, [
    ['איפה', 'מה קרה או נמצא אצלנו', 'מה עושים'],
    ['דגימת שמן', 'סקר הסיכונים: כוויה, ופגיעה בעיניים', 'משקפי מגן וכפפות חום. בלי זה לא דוגמים'],
    ['מסנן השמן', 'סיור 21/06/2026: המכסה פתוח, בד הסינון חם וזז', 'המכסה סגור כל זמן שהמסנן עובד'],
    ['דפנות המטגנת', 'סיורים 21/06/2026 ו-04/11/2026: מגנים פתוחים, סגירה קשה', 'מגן סגור תמיד. לא נסגר? מדווחים לאחזקה'],
    ['פתיחת קו או משאבה', 'תאונה 26/07/2026: שמן חם ניתז על היד', 'רק אחרי ניתוק, ניקוז ובדיקת לחץ'],
    ['ריקון והחלפת שמן', 'סיור 06/10/2026, מעבדת פיתוח: חסר צינור ניקוז', 'מרוקנים רק דרך צינור עמיד בחום'],
    ['ניקוי המטגנת', 'סקר הנעילה: כוויה משמן רותח', 'מנתקים חשמל, מחכים שיתקרר, מנעול אישי'],
    ['תעלות ורצפה', 'סיור 08/06/2026: תעלה פתוחה מתחת למטגנת', 'סוגרים תעלה אחרי ניקיון. מנגבים שמן'],
], [2.6, 5.2, 4.33], size=14, row_h=0.55)
ask(s, 6.22, 'איזו מהפעולות האלה עשית השבוע? מה היה הכי קרוב לכוויה?', h=0.65)

# 7 ---------------------------------------------------------------------------------------------------------------
s = D.slide('תרגיל: מה עושים קודם?', source=INV + '; ' + A20 + ', סעיפים 7.1, 27, 29.5')
photo(s, 0.6, 1.5, 4.9, 3.0, 'flange.jpg', 'spjwebster, Flickr, CC BY 2.0')
D.box(s, 0.6, 4.65, 4.9, 1.2, [
    ('שתי דקות בזוגות', {'bold': True, 'size': 19}),
    ('צריך לפתוח אוגן בקו שמן חם. סדרו את שש הפעולות.', {'size': 15})], fill=AMBER, gap=3)
cards = [('א', 'מנקזים את הקו, ובודקים שאין בו לחץ'),
         ('ב', 'מגן פנים וכפפות, ופותחים לאט'),
         ('ג', 'מודיעים למנהל המשמרת ולחדר הבקרה'),
         ('ד', 'בודקים בעצמך, ליד הברז, שהוא סגור'),
         ('ה', 'מחכים שהשמן יתקרר'),
         ('ו', 'סוגרים ברזים, נועלים ותולים תג')]
for i, (n, t) in enumerate(cards):
    y = 1.5 + i * 0.73
    D.box(s, 12.0, y, 0.75, 0.62, n, size=20, bold=True, color='FFFFFF', fill=BLUE, align='c')
    D.box(s, 5.75, y, 6.1, 0.62, t, size=16, fill=CARD)
D.box(s, 0.6, 6.0, W - 1.2, 0.85, [
    ('הסדר (למדריך):  ג, ו, ד, אחר כך א ו-ה, ובסוף ב.', {'bold': True, 'size': 16, 'color': 'FFFFFF'}),
    ('שאלו: איזה שלב דילגו עליו ב-26/07/2026? (ד, א)', {'size': 14, 'color': 'FFFFFF'})], fill=GREEN, gap=2)

# 8 ---------------------------------------------------------------------------------------------------------------
D.section('2', 'דודי השמן התרמי', 'מה זה, ואיך עובדים על מערכת שמן: קרה ומנותקת')

# 9 ---------------------------------------------------------------------------------------------------------------
s = D.slide('דודי השמן התרמי שלנו', source='תסקירי נצילות 25/01/2026, 15/02/2026, 26/06/2024; ' + PLANT)
photo(s, 0.6, 1.5, 4.3, 3.2, 'valve.jpg', 'EU-Ukraine cooperation, CC BY-SA 2.0')
D.box(s, 5.15, 1.5, 7.6, 0.7, 'מבער מחמם שמן בדוד, ומשאבה מזרימה אותו בצנרת',
      size=17, bold=True, color='FFFFFF', fill=NAVY, align='c')
D.table(s, 5.15, 2.32, 7.6, [
    ['הדוד', 'מה כתוב בתסקיר'],
    ['דוד הטוגנים (BBS)', 'מחמם שמן תרמי, מבער גז טבעי או מזוט'],
    ['קטן 1 (BBS)', '500 קילוואט, גז טבעי'],
    ['קטן 2 (BBS), חדר מעוצבים', '400 קילוואט, גז טבעי, לחץ עבודה 10 בר'],
], [3.2, 4.4], size=14.5, row_h=0.56)
D.box(s, 5.15, 4.72, 3.7, 1.33, [
    ('למה זה מסוכן', {'bold': True, 'size': 17, 'color': 'FFFFFF'}),
    ('הצנרת חמה לכל האורך.', {'size': 14.5, 'color': 'FFFFFF'}),
    ('דליפה: שמן חם, וגם חומר דליק.', {'size': 14.5, 'color': 'FFFFFF'})], fill=RED, gap=2)
D.box(s, 9.0, 4.72, 3.75, 1.33, [
    ('מי נוגע', {'bold': True, 'size': 17, 'color': NAVY}),
    ('רק מי שהוסמך, ולפי הוראת העבודה של מהנדס המפעל.', {'size': 14.5})], fill=CARD, gap=2)
D.box(s, 0.6, 4.85, 4.3, 1.2, [
    ('טפטוף, כתם שמן או עשן?', {'bold': True, 'size': 16, 'color': NAVY}),
    ('לא נוגעים ולא מהדקים. מתרחקים ומודיעים למנהל המשמרת.', {'size': 14})], fill=DBLUE, gap=2)
ask(s, 6.2, 'איפה עוברת צנרת השמן התרמי במחלקה שלך? מי מכיר את המסלול?', h=0.65)

# 10 --------------------------------------------------------------------------------------------------------------
s = D.slide('עובדים על מערכת שמן רק כשהיא קרה ומנותקת',
            source=INV + '; ' + A20 + ', 7.1, 27, 29; פקודת הבטיחות, סעיפים 44, 51')
D.steps(s, 4.9, 1.45, 7.85, [
    'מודיעים למנהל המשמרת ולחדר הבקרה, ומקבלים את המערכת.',
    'עוצרים ומנתקים: חשמל, משאבות וחימום.',
    'סוגרים ברזים, נועלים במנעול ותולים תג.',
    'בודקים בעצמך, ליד הברז, שהוא באמת סגור.',
    'מנקזים את הקו, ובודקים שאין בו לחץ.',
    'מחכים שהשמן יתקרר.',
    'פותחים לאט, מכסים את מקום הפתיחה, עם מגן פנים וכפפות.',
], h=0.64, gap=0.1, size=15.5)
D.box(s, 0.6, 1.45, 4.05, 2.1, [
    ('אישור בטלפון זה לא ניתוק', {'bold': True, 'size': 17, 'color': 'FFFFFF'}),
    ('ב-26/07/2026 סמכו על אישור של חדר הבקרה.', {'size': 14.5, 'color': 'FFFFFF'}),
    ('הברז לא נבדק, והקו היה מלא.', {'size': 14.5, 'color': 'FFFFFF'})], fill=RED, gap=3)
D.box(s, 0.6, 3.7, 4.05, 2.0, [
    ('מה אומרת פקודת הבטיחות', {'bold': True, 'size': 16, 'color': NAVY}),
    ('סעיף 44: מגן נשאר במקומו כשהמכונה עובדת.', {'size': 14}),
    ('סעיף 51: מכל נמוך עם נוזל כווה מכוסה או מגודר.', {'size': 14})], fill=DBLUE, gap=3)
ask(s, 5.85, 'מנעול של מי על הברז? ומי מסיר אותו בסוף?', h=0.85, w=4.05, size=14.5)

# 11 --------------------------------------------------------------------------------------------------------------
D.section('3', 'אש, ציוד מגן ועזרה ראשונה', 'שמן בוער, מה לובשים, ומה עושים בכוויה')

# 12 --------------------------------------------------------------------------------------------------------------
s = D.slide('שמן בוער: לעולם לא מים', source=PLANT + ', אירוע שריפה; ' + JSA)
photo(s, 0.6, 1.5, 5.0, 3.55, 'oil_fire.jpg', 'Daniel P. Fleming, Flickr, CC BY-SA 2.0')
D.box(s, 0.6, 5.15, 5.0, 0.8, 'סיר טיגון אחד בחצר. תחשבו על מטגנת שלמה.', size=15, bold=True, color=NAVY, fill=CARD,
      align='c')
D.box(s, 5.85, 1.5, 6.9, 1.55, [
    ('לעולם לא מים!', {'bold': True, 'size': 24, 'color': 'FFFFFF'}),
    ('מים בשמן רותח הופכים לאדים בבת אחת, ומעיפים שמן בוער לכל הכיוונים.', {'size': 15, 'color': 'FFFFFF'})],
      fill=RED, gap=3)
D.steps(s, 5.85, 3.2, 6.9, [
    'מזעיקים: מנהל המשמרת וצוות החירום.',
    'מפסיקים את החימום, אם אפשר בלי סיכון.',
    'מכבים באבקה או בקצף.',
], h=0.62, gap=0.1, size=16)
D.box(s, 5.85, 5.4, 6.9, 0.55, 'במטגנת יש מערכת כיבוי אוטומטית. מזעיקים בכל מקרה.', size=14.5, bold=True,
      color=NAVY, fill=DBLUE)
ask(s, 6.12, 'איפה המטף הכי קרוב למטגנת שלך, ואיזה סוג הוא?', h=0.7)

# 13 --------------------------------------------------------------------------------------------------------------
s = D.slide('מה לובשים ליד שמן חם', source=JSA + '; ' + A20 + ', 6.3, 6.8, 7.1; תקנות ציוד מגן אישי, 3, 8, 9')
photo(s, 0.6, 1.5, 3.7, 3.0, 'gloves.jpg', 'el cajon yacht club, CC BY 2.0')
ppe = [('דגימת שמן', 'משקפי מגן וכפפות חום.'),
       ('ציוד חם', 'כפפות עבודה בד-עור, נגד כוויות.'),
       ('פתיחת קו שמן', 'מגן פנים, משקפי מגן וכפפות.'),
       ('רגליים', 'נעלי בטיחות מעור. נעל בד לא עוצרת נוזל חם.'),
       ('גוף', 'מכנס ארוך וחולצה עם שרוולים.')]
for i, (t, d) in enumerate(ppe):
    y = 1.5 + i * 0.75
    D.box(s, 10.45, y, 2.3, 0.64, t, size=16, bold=True, color='FFFFFF', fill=IDX, align='c')
    D.box(s, 4.55, y, 5.75, 0.64, d, size=15, fill=CARD)
D.box(s, 4.55, 5.3, 8.2, 0.85, [
    ('החוק: המעסיק מספק ומפקח. העובד משתמש, ומחזיר ציוד פגום.', {'size': 14.5, 'bold': True}),
    ('לא משתמשים בציוד? הממונה על העבודה מפסיק את העבודה.', {'size': 14.5})], fill=DBLUE, gap=2)
D.box(s, 0.6, 4.65, 3.7, 1.5, [
    ('אחרי 26/07/2026', {'bold': True, 'size': 16, 'color': NAVY}),
    ('בוחנים כפפות ארוכות עמידות בחום, שרוולי מגן ומגן פנים לפתיחת קווי שמן.', {'size': 13.5})], fill=CARD, gap=2)
ask(s, 6.28, 'הכפפות שיש לך היום: היית מתקרב איתן לשמן חם?', h=0.6, size=15)

# 14 --------------------------------------------------------------------------------------------------------------
s = D.slide('נכווית? מים קרים, מיד', source=A20 + ', סעיף 22.3; ' + INV)
D.steps(s, 5.4, 1.5, 7.35, [
    [('מתרחקים מהשמן', {'bold': True, 'color': NAVY}),
     ('ועוצרים את מה שמתיז, רק אם אפשר בלי סיכון.', {'size': 14})],
    [('שוטפים במים קרים', {'bold': True, 'color': NAVY}),
     ('מיד, את כל אזור הכוויה.', {'size': 14})],
    [('לא מורחים כלום', {'bold': True, 'color': NAVY}),
     ('לא משחה, ולא שום דבר אחר.', {'size': 14})],
    [('מודיעים למנהל המשמרת', {'bold': True, 'color': NAVY}),
     ('גם על כוויה קטנה. כך היא נבדקת ונרשמת.', {'size': 14})],
    [('פגיעה רצינית', {'bold': True, 'color': NAVY}),
     ('מפנים לטיפול רפואי.', {'size': 14})],
], h=0.88, gap=0.12, size=16.5)
D.box(s, 0.6, 1.5, 4.55, 2.35, [
    ('ב-26/07/2026', {'bold': True, 'size': 18, 'color': NAVY}),
    ('העובד חבש את היד לבד וחזר לעבוד.', {'size': 15}),
    ('כוויה מדווחים ובודקים, גם כשהיא נראית קטנה.', {'size': 15, 'bold': True})], fill=CARD, gap=4)
D.box(s, 0.6, 4.0, 4.55, 1.3, [
    ('גם מים חמים וקיטור', {'bold': True, 'size': 16, 'color': 'FFFFFF'}),
    ('שורפים. אותו טיפול בדיוק.', {'size': 15, 'color': 'FFFFFF'})], fill=RED, gap=2)
ask(s, 5.45, 'איפה ברז המים הכי קרוב לעמדה שלך?', h=0.98, w=4.55, size=15)

# 15 --------------------------------------------------------------------------------------------------------------
s = D.slide('מה קרה אצלנו', source='טבלת התאונות 2024-2026; תחקירי תאונה 22/02/2026 ו-26/07/2026')
ev = [('24/06/2024, מטוגנים', 'התזה של מים חמים. כוויה.',
       'מים חמים וקיטור שורפים. נזהרים באותה מידה.'),
      ('31/07/2024', 'שמן חם על היד. כוויה.',
       'כפפות חום בכל עבודה ליד שמן חם.'),
      ('22/02/2026, קילופים', 'מים חמים מצינור פריקה נכנסו לנעל בד. כוויה ברגל.',
       'נעלי בטיחות מעור בלבד.'),
      ('26/07/2026, טוגנים', 'פתחו ברגים בקו שמן בלי לבדוק ברז ולחץ. כוויה ביד.',
       'בודקים בעצמך: ברז סגור, קו מנוקז, אין לחץ.')]
D.box(s, 9.6, 1.5, 3.15, 0.55, 'מתי ואיפה', size=15, bold=True, color='FFFFFF', fill=IDX, align='c')
D.box(s, 4.95, 1.5, 4.5, 0.55, 'מה קרה', size=15, bold=True, color='FFFFFF', fill=IDX, align='c')
D.box(s, 0.6, 1.5, 4.2, 0.55, 'מה לוקחים מזה', size=15, bold=True, color='FFFFFF', fill=GREEN, align='c')
for i, (w, what, lesson) in enumerate(ev):
    y = 2.17 + i * 1.02
    D.box(s, 9.6, y, 3.15, 0.9, w, size=15, bold=True, color=NAVY, fill=CARD)
    D.box(s, 4.95, y, 4.5, 0.9, what, size=14.5, fill=CARD)
    D.box(s, 0.6, y, 4.2, 0.9, lesson, size=14.5, bold=True, color='FFFFFF', fill=GREEN)
ask(s, 6.3, 'מי מכיר "כמעט כוויה" אצלנו שלא דווחה? ספרו.', h=0.62)

# 16 --------------------------------------------------------------------------------------------------------------
s = D.slide('בדיקת הבנה: חמש שאלות')
qs = [('שמן בוער במטגנת. במה מכבים?', 'אבקה או קצף. לעולם לא מים'),
      ('חדר הבקרה אמר שהברז סגור. אפשר לפתוח?', 'לא. בודקים בעצמך, מנקזים ובודקים לחץ'),
      ('המגן של המטגנת לא נסגר טוב. מה עושים?', 'מדווחים לאחזקה. לא עובדים עם מגן פתוח'),
      ('מה לובשים לדגימת שמן?', 'משקפי מגן וכפפות חום'),
      ('נכווית ביד משמן. מה עושים קודם?', 'מים קרים מיד, ומודיעים למנהל המשמרת')]
for i, (q, a) in enumerate(qs):
    y = 1.5 + i * 1.07
    D.box(s, 12.0, y, 0.75, 0.93, str(i + 1), size=22, bold=True, color='FFFFFF', fill=BLUE, align='c')
    D.box(s, 5.35, y, 6.5, 0.93, q, size=15.5, bold=True, color=NAVY, fill=CARD)
    D.box(s, 0.6, y, 4.6, 0.93, a, size=14, color='FFFFFF', fill=GREEN)

# 17 --------------------------------------------------------------------------------------------------------------
s = D.slide('שישה כללים לקחת מכאן')
rules = ['ליד שמן חם: כפפות חום ומשקפי מגן.',
         'מגן ומכסה של מטגנת נשארים סגורים.',
         'קו שמן פותחים רק קר, מנותק, מנוקז ונעול.',
         'בודקים בעצמך. "אמרו לי" זה לא בדיקה.',
         'שמן בוער? לעולם לא מים.',
         'כוויה: מים קרים מיד, ומדווחים.']
for i, t in enumerate(rules):
    x = 6.85 if i % 2 == 0 else 0.6
    y = 1.6 + (i // 2) * 1.6
    D.box(s, x + 5.1, y, 0.8, 1.4, str(i + 1), size=28, bold=True, color='FFFFFF', fill=BLUE, align='c')
    D.box(s, x, y, 5.0, 1.4, t, size=18, bold=True, color=NAVY, fill=CARD)
D.text(s, 0.6, 6.45, W - 1.2, 0.45, 'שאלות? מנהל הבטיחות ואיכות הסביבה, או מנהל האחזקה.', size=16, color=GREY, align='c')

D.save(out)
print('saved', out, 'slides', D.n)
