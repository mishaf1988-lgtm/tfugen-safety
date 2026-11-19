# Emergency, fire fighting and first aid training deck for ALL employees (19/11/2026, Michael's brief for the training
# decks: field Hebrew, ~15 slides, roles only, quiz at the end, every number from a source read in this run).
# Background: emergency-preparedness audit 30/11/2026 (DECISIONS 18/11/2026; the emergency file is ready in 17_חירום).
# Usage: python3 emergency_deck.py <out.pptx> <logo.jpg>
# Sources read on 19/11/2026 (OneDrive "ניהול בטיחות" unless noted):
#   - 15_תיק ניהול הבטיחות ונהלים/תיק מפעל/תיק מפעל - 31.03.2026.pdf: fire scenario (oil/diesel/mazut by foam or powder,
#     electrical = powder or gas, no water/foam near live power), evacuation (main gate or emergency gate, wind, assembly
#     point outside the main gate), roles table 2.1 (chair, senior operator, emergency+first-aid team, gate guards,
#     assembly-point officer), 5.5.3 (PA from all phone extensions, megaphone, 4 radios), 5.6.2 (4 eye-wash stations:
#     wastewater, lab, entrance to refrigeration machine room A, yard by the ammonia fill valves; showers), Mosaf G 2.4.
#   - 17_חירום/נהלים ותרחישים/תרחישים ונוהל פעולה.pdf (created 31/03/2026): short circuit = CO2 or powder only, stages A-E,
#     evacuation (shift lead guides, registration at the collection point, missing persons), roles section 6.
#   - 17_חירום/תרגילי חירום/2026/סיכום תרגיל חירום - דליפת אמוניה - 14.01.2026 (גרסה מורחבת).pdf: 10:30 PA, 10:33 fire team
#     at the receiver roof with hose reels, 10:46 back to routine.
#   - 01_כיבוי אש ובטיחות אש/טפסי כבאות/טופס 1+2/בתוקף/2026-07-20 ... תוקף עד 20.07.2027.pdf: 42 hose-reel stations (form 1
#     list, numbered 1-42), extinguisher types: powder 6 kg and 50 kg, halotron gas 3 kg and 6 kg (electrical rooms,
#     offices, lab), foam 6 kg and 50 kg; inspected 20/07/2026, valid to 20/07/2027.
#   - 01_כיבוי אש ובטיחות אש/2026/מכתב לכבאות - השבתה זמנית של חדר המשאבות אחרי שריפת 27.07.2026 - 28.07.2026.pdf and
#     אישור משאבת כיבוי לאחר שריפה - גפיר - 29.07.2026.pdf (fire 27/07/2026 in the "יבולים" compound, diesel pumps out
#     of fuel, pump back in order 29/07/2026).
#   - 17_חירום/ציוד חירום (listing): defibrillator check certificate for 2 devices, 23/05/2024.
#   - project-files/nh3-procedures/content.json, procedure 26.03 (16/10/2026) section 1.4 and project-files/decks/nh3_deck.py
#     slide 15: fixed assembly point outside the main gate, alternative outside the חו"ג (yellow) gate by the wind sock,
#     announced on the PA by the emergency HQ. This deck repeats it word for word.
#   - DB (routine-db select, 19/11/2026): tour_hazards (blocked fire cabinets 07/09/2026 and 22/09/2026, broken eye-wash
#     handle in peeling 14/09/2026), inc (hot oil burn to the hand, fryers, 26/07/2026; caustic soda burn 19/05/2026),
#     tasks drl1811y27 (next drill by 14/01/2027). equip_inspections has NO extinguisher or hose-reel rows (checked).
#   - Nevo through source_read: 74822 תקנות הבטיחות בעבודה (עזרה ראשונה במקומות עבודה), תשמ"ח-1988, regs 1, 2, 3, 4, 6;
#     121241 תקנות ארגון הפיקוח על העבודה (תכנית לניהול הבטיחות), תשע"ג-2013, reg 5(5)(ב)(3) and 5(6)(ג).
# Left out on purpose: names and phone numbers (also the public emergency numbers listed in the plant file, per the brief);
# the total number of extinguishers (the form lists rows that I could not count reliably from the PDF text); the location
# of the 2 defibrillators and of the first-aid kits (no source; photo slots instead); the defibrillator check date
# 23/05/2024 (looks out of date; for Michael); the number of water cannons (plant file 4, Michael 6, other documents 1
# and 3: DECISIONS 19/11/2026, so no number); eye-wash minutes (no factory source); the regulator's name for the audit.
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from deck_lib import *

out, logo = sys.argv[1], sys.argv[2]
D = Deck(logo, 'הדרכת חירום, כיבוי אש ועזרה ראשונה  |  תעשיות תפוגן  |  19/11/2026')

IMG = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'img', 'emergency')


def photo(s, x, y, w, h, files, credit):
    """Illustrative internet picture(s) in the old photo-slot frame, with the credit line at the frame bottom.
    Licences and source links: img/emergency/credits.json."""
    D.rect(s, x, y, w, h, fill='F7F9FA', line=GREY, lw=0.75)
    files = [files] if isinstance(files, str) else files
    if w / h > 2.8:  # low wide frame: picture on the left, credit beside it on the right
        D.pic(s, os.path.join(IMG, files[0]), x + 0.08, y + 0.06, w - 2.1, h - 0.12)
        D.text(s, x + w - 1.95, y + 0.1, 1.85, h - 0.2, ['תמונה להמחשה:'] + credit.split(', ', 1), size=10, color=GREY,
               align='c', anchor='m', gap=2)
        return
    pw = (w - 0.1) / len(files)
    for i, f in enumerate(files):
        D.pic(s, os.path.join(IMG, f), x + 0.05 + i * pw + 0.03, y + 0.06, pw - 0.06, h - 0.42)
    D.text(s, x, y + h - 0.36, w, 0.33, 'תמונה להמחשה: ' + credit, size=9 if w < 3.3 else 10, color=GREY,
           align='c', anchor='m')

PLANT = 'תיק מפעל 31/03/2026'
SCEN = 'נוהל חירום מפעלי, מיפוי תרחישים (03/2026)'
P2603 = 'נוהל 26.03, סעיף 1.4'
F12 = 'טופס 1+2 כבאות, 20/07/2026'
FA = 'תקנות עזרה ראשונה במקומות עבודה, תשמ"ח-1988'

# 1 ---------------------------------------------------------------------------------------------------------------
D.cover('חירום, כיבוי אש ועזרה ראשונה',
        'מה כל עובד צריך לדעת ולעשות ברגע האמת',
        ['הדרכה לכל עובדי המפעל',
         'תעשיות תפוגן בע"מ  |  מחלקת בטיחות ואיכות הסביבה  |  19/11/2026'])

# 2 ---------------------------------------------------------------------------------------------------------------
s = D.slide('מה נלמד היום', source='DECISIONS 18/11/2026; משימת תרגיל 2027')
parts = [('1', 'מודיעים ומתפנים', 'איך מזעיקים, לאן מתפנים, ומי עושה מה'),
         ('2', 'כיבוי אש', 'איזה מטף לאיזו אש, איך מפעילים, ושמן בטיגון'),
         ('3', 'עזרה ראשונה', 'מה עושים עד שהעזרה מגיעה, ואיפה הציוד'),
         ('4', 'לקחים מהמפעל שלנו', 'מה קרה אצלנו, ומה למדנו')]
for i, (n, t, d) in enumerate(parts):
    y = 1.5 + i * 1.12
    D.box(s, 11.5, y, 1.2, 0.98, n, size=36, bold=True, color='FFFFFF', fill=BLUE, align='c')
    D.box(s, 0.7, y, 10.65, 0.98, [(t, {'bold': True, 'size': 22, 'color': NAVY}), (d, {'size': 16})], fill=CARD, gap=2)
D.box(s, 0.7, 6.0, W - 1.4, 0.85, [('למה עכשיו: ב-30/11/2026 יש ביקורת מוכנות לחירום, והתרגיל המפעלי הבא עד 14/01/2027.',
                                   {'size': 16, 'bold': True})], fill=AMBER)

# 3 ---------------------------------------------------------------------------------------------------------------
D.section('1', 'מודיעים ומתפנים', 'איך מזעיקים, לאן הולכים, ומי עושה מה')

# 4 ---------------------------------------------------------------------------------------------------------------
s = D.slide('רואים אש, עשן או נפגע: מה עושים', source=PLANT + ', סעיף 2א; ' + SCEN + ', שלב א')
D.steps(s, 4.9, 1.5, 7.85, [
    [('צועקים ומזהירים', {'bold': True, 'color': NAVY}), ('"אש!" או "דליפה!". שכל מי שקרוב ישמע ויתרחק.', {'size': 14})],
    [('מודיעים מיד', {'bold': True, 'color': NAVY}), ('למנהל המשמרת או למנהל המחלקה. הוא מפעיל את הכריזה ואת השומר בשער.', {'size': 14})],
    [('לא מחכים לאישור כדי לברוח', {'bold': True, 'color': RED}), ('בסכנה לחיים: קודם מתרחקים, אחר כך מודיעים.', {'size': 14})],
    [('הכריזה', {'bold': True, 'color': NAVY}), ('מכל שלוחת טלפון במפעל אפשר להפעיל כריזה ואזעקה.', {'size': 14})],
], h=1.0, gap=0.17, size=17)
D.box(s, 0.6, 1.5, 4.05, 5.35, [
    ('מה אומרים בהודעה', {'bold': True, 'size': 19, 'color': NAVY}),
    ('• איפה בדיוק.', {'size': 16}),
    ('• מה קרה: אש, דליפה, פיצוץ, נפגע.', {'size': 16}),
    ('• איזה חומר מעורב, אם יודעים.', {'size': 16}),
    ('• כמה נפגעים, ובאיזה מצב.', {'size': 16}),
    ('• לאן האש או הענן מתפשטים.', {'size': 16}),
    ('מדברים לאט וברור. עונים על שאלות.', {'size': 15, 'bold': True})], fill=CARD, anchor='t')

# 5 ---------------------------------------------------------------------------------------------------------------
s = D.slide('פינוי ונקודת הכינוס', source=PLANT + ', פינוי עובדים; ' + P2603)
D.box(s, 6.85, 1.5, 5.9, 2.0, [('נקודת הכינוס הקבועה', {'bold': True, 'size': 20, 'color': 'FFFFFF'}),
                               ('מחוץ לשער הכניסה הראשי.', {'size': 18, 'color': 'FFFFFF'}),
                               ('לשם מתפנים בכל אירוע, אלא אם הכריזו אחרת.', {'size': 15, 'color': 'FFFFFF'})],
      fill=GREEN)
D.box(s, 0.6, 1.5, 6.05, 2.0, [('נקודת כינוס חלופית', {'bold': True, 'size': 20}),
                              ('מחוץ לשער חו"ג (השער הצהוב).', {'size': 18}),
                              ('כשהרוח מביאה ענן אמוניה לשער הראשי. מטה החירום מודיע בכריזה.', {'size': 15})],
      fill=AMBER)
D.bullets(s, 0.6, 3.75, 7.6, 3.15, [
    ('איך מתפנים', {'head': True}),
    'שומעים כריזה? עוזבים את העבודה ויוצאים מיד.',
    'יוצאים בדרך הקרובה: השער הראשי או שער החירום.',
    'קבלנים ואורחים שאיתך יוצאים איתך.',
    'הולכים, לא רצים. לא חוזרים לקחת דברים.'], size=20, gap=14)
D.box(s, 8.45, 3.75, 4.3, 3.1, [
    ('בנקודת הכינוס', {'bold': True, 'size': 19, 'color': 'FFFFFF'}),
    ('נרשמים אצל האחראי על הנקודה.', {'size': 15.5, 'color': 'FFFFFF'}),
    ('הוא בודק מי חסר ומדווח למטה החירום.', {'size': 15.5, 'color': 'FFFFFF'}),
    ('לא עוזבים ולא חוזרים פנימה עד הודעה על חזרה לשגרה.', {'size': 15.5, 'color': 'FFFFFF', 'bold': True})],
      fill=DBLUE)

# 6 ---------------------------------------------------------------------------------------------------------------
s = D.slide('מי עושה מה באירוע', source=PLANT + ', טבלה 2.1; ' + SCEN + ', סעיף 6')
D.table(s, 0.6, 1.5, W - 1.2, [
    ['תפקיד', 'מה הוא עושה'],
    ['יו"ר מטה החירום (מנכ"לית, ובהיעדרה מנהל התפעול)', 'מנהל את האירוע, מחליט על פינוי, ומכריז על סיום'],
    ['מפעיל בכיר במשמרת', 'מפעיל את הנוהל ומנהל עד שמנהל התפעול מגיע'],
    ['צוות חירום ועזרה ראשונה (בראשות ממונה הבטיחות)', 'מכבה, מנטרל, נותן עזרה ראשונה ומפנה נפגעים'],
    ['שומר בשער', 'מזעיק כוחות חירום, חוסם כניסה ומכוון את הכבאים'],
    ['אחראי נקודת הכינוס', 'רושם את המפונים, ומדווח על נעדרים'],
    ['מנהל המחלקה', 'מתריע, מכוון את העובדים, ומעביר מידע מהשטח'],
    ['כל עובד', 'מודיע, מתפנה, נרשם בנקודת הכינוס ומחכה להוראות'],
], [5.0, 7.13], size=15, row_h=0.62, fills={(7, 0): GREEN, (7, 1): GREEN})
D.text(s, 0.6, 6.45, W - 1.2, 0.45, 'השמות והטלפונים של בעלי התפקידים: בתיק החירום ובדף הקשר של המפעל.',
       size=14, color=GREY)

# 7 ---------------------------------------------------------------------------------------------------------------
D.section('2', 'כיבוי אש', 'איזה מטף לאיזו אש, ואיך מפעילים')

# 8 ---------------------------------------------------------------------------------------------------------------
s = D.slide('ציוד הכיבוי אצלנו', source=F12 + '; ' + PLANT + ', מוסף ג')
cards = [('מטף אבקה', 'הכי נפוץ במפעל.\n6 ק"ג, וגם עגלות של 50 ק"ג.'),
         ('מטף גז (הלוטרון)', 'בחדרי חשמל, משרדים ומעבדה.\n3 ק"ג ו-6 ק"ג.'),
         ('מטף קצף', 'במפעל היצוא ועוד.\n6 ק"ג, וגם עגלה של 50 ק"ג.'),
         ('גלגלון (מים)', '42 עמדות כיבוי ברחבי המפעל.\nבכל עמדה: גלגלון, זרנוקים וארון.')]
for i, (t, d) in enumerate(cards):
    x = 0.6 + (3 - i) * 3.08
    D.box(s, x, 1.55, 2.9, 0.7, t, size=18, bold=True, color='FFFFFF', fill=IDX, align='c')
    D.box(s, x, 2.3, 2.9, 1.95, d.split('\n'), size=15.5, fill=CARD)
D.box(s, 0.6, 4.5, 6.6, 2.35, [
    ('הכל נבדק', {'bold': True, 'size': 18, 'color': NAVY}),
    ('המטפים והגלגלונים נבדקו ב-20/07/2026 ונמצאו תקינים. האישור בתוקף עד 20/07/2027.', {'size': 15.5}),
    ('יש גם תותחי מים ווילון מים באזור חומר הגלם, ו-5 עגלות קצף במחלקות.', {'size': 15})], fill=CARD)
photo(s, 7.45, 4.5, 5.3, 2.35, ['hose_reel.jpg', 'extinguishers.jpg'], 'Alina Kakshapati, CC0; Bruno Girin, CC BY-SA 2.0')

# 9 ---------------------------------------------------------------------------------------------------------------
s = D.slide('איזה מטף לאיזו אש', source=PLANT + ', אירוע שריפה; ' + SCEN)
D.table(s, 5.0, 1.5, 7.75, [
    ['מה בוער', 'במה מכבים', 'אסור'],
    ['שמן, סולר, מזוט', 'אבקה או קצף', 'מים'],
    ['חשמל, לוח, מנוע', 'גז או אבקה', 'מים וקצף'],
    ['קרטון, עץ, משטחים', 'מים (גלגלון) או אבקה', 'ליד חשמל פעיל'],
], [2.6, 2.75, 2.4], size=16, row_h=0.8, fills={(1, 2): RED, (2, 2): RED, (3, 2): RED},
    colors={(1, 2): 'FFFFFF', (2, 2): 'FFFFFF', (3, 2): 'FFFFFF'})
D.box(s, 5.0, 4.75, 7.75, 2.1, [
    ('אש בחשמל', {'bold': True, 'size': 18, 'color': NAVY}),
    ('לא מים ולא קצף, עד שחשמלאי מוסמך ניתק את המתח.', {'size': 15.5}),
    ('מים מוליכים חשמל. מי שמתיז מים על לוח יכול להתחשמל.', {'size': 15.5})], fill=CARD)
D.box(s, 0.6, 1.5, 4.15, 5.35, [
    ('שמן בוער בטיגון', {'bold': True, 'size': 22, 'color': 'FFFFFF'}),
    ('לעולם לא מים!', {'bold': True, 'size': 26, 'color': 'FFFFFF'}),
    ('מים בשמן רותח הופכים לאדים בבת אחת ומעיפים את השמן הבוער לכל הכיוונים.', {'size': 15.5, 'color': 'FFFFFF'}),
    ('מכבים באבקה או בקצף.', {'size': 16, 'color': 'FFFFFF', 'bold': True}),
    ('אם אפשר בלי סיכון: מפסיקים את החימום.', {'size': 15.5, 'color': 'FFFFFF'})], fill=RED)

# 10 --------------------------------------------------------------------------------------------------------------
s = D.slide('איך מפעילים מטף: ש.כ.ל.ט', source='שיטת PASS; ' + PLANT + ', אירוע שריפה')
D.steps(s, 5.4, 1.5, 7.35, [
    [('שלוף', {'bold': True, 'color': NAVY}), ('את הנצרה מהידית.', {'size': 14.5})],
    [('כוון', {'bold': True, 'color': NAVY}), ('את הצינור לבסיס הלהבות, לא ללהבות עצמן.', {'size': 14.5})],
    [('לחץ', {'bold': True, 'color': NAVY}), ('על הידית, חזק ועד הסוף.', {'size': 14.5})],
    [('טאטא', {'bold': True, 'color': NAVY}), ('מצד לצד על בסיס האש, עד שהיא כבה.', {'size': 14.5})],
], h=0.95, gap=0.15, size=17)
D.box(s, 5.4, 5.85, 7.35, 1.0, [('גלגלון: פותחים את הברז, מושכים את הצינור עד האש, ופותחים את המזנק.',
                                 {'size': 15})], fill=BAND)
D.box(s, 0.6, 1.5, 4.55, 2.6, [
    ('לפני שמכבים', {'bold': True, 'size': 18, 'color': NAVY}),
    ('• קודם מודיעים. אחר כך מכבים.', {'size': 15}),
    ('• הגב שלך לכיוון היציאה.', {'size': 15}),
    ('• בחוץ: הרוח בגב שלך.', {'size': 15})], fill=CARD)
D.box(s, 0.6, 4.25, 4.55, 2.6, [
    ('מתי לא מכבים', {'bold': True, 'size': 18, 'color': 'FFFFFF'}),
    ('• האש גדולה או מתפשטת.', {'size': 15, 'color': 'FFFFFF'}),
    ('• הרבה עשן, או שהדרך החוצה נחסמת.', {'size': 15, 'color': 'FFFFFF'}),
    ('• המטף נגמר והאש לא כבתה.', {'size': 15, 'color': 'FFFFFF'}),
    ('יוצאים, סוגרים דלת, ומשאירים לצוות.', {'size': 15, 'color': 'FFFFFF', 'bold': True})], fill=RED)

# 11 --------------------------------------------------------------------------------------------------------------
D.section('3', 'עזרה ראשונה', 'מה עושים עד שהעזרה מגיעה, ואיפה הציוד')

# 12 --------------------------------------------------------------------------------------------------------------
s = D.slide('עזרה ראשונה: מה כל עובד עושה', source=FA + ', תקנות 1-4, 6')
D.steps(s, 5.4, 1.5, 7.35, [
    [('שומרים על עצמך', {'bold': True, 'color': NAVY}), ('לא נכנסים לאש, לגז או לחשמל כדי להציל. קודם מנתקים ומזעיקים.', {'size': 14})],
    [('מזעיקים עזרה', {'bold': True, 'color': NAVY}), ('מנהל המשמרת וצוות החירום. הם מזמינים אמבולנס.', {'size': 14})],
    [('חומר בעין או על העור', {'bold': True, 'color': NAVY}), ('שוטפים מיד בהרבה מים, במשטפת עיניים או במקלחת חירום.', {'size': 14})],
    [('כוויה מחום או משמן', {'bold': True, 'color': NAVY}), ('מקררים במים זורמים. לא מורחים כלום על הכוויה.', {'size': 14})],
    [('לא מזיזים נפגע', {'bold': True, 'color': NAVY}), ('אלא אם הוא בסכנה במקום. נשארים איתו עד שהצוות מגיע.', {'size': 14})],
], h=0.88, gap=0.12, size=16.5)
D.box(s, 0.6, 1.5, 4.55, 5.35, [
    ('מה החוק אומר', {'bold': True, 'size': 18, 'color': NAVY}),
    ('• בכל מקום עבודה חייב להיות ארגז עזרה ראשונה. (תקנה 2)', {'size': 14}),
    ('• ערכת החייאה אחת לכל קבוצה של עד 25 עובדים. (תקנה 3)', {'size': 14}),
    ('• הארגזים מסומנים במגן דוד אדום. (תקנה 4)', {'size': 14}),
    ('• מתקן לטיפול עצמי: לכל עובד, לפצע קטן.', {'size': 14}),
    ('• תיק עזרה ראשונה: רק מגיש מאומן משתמש בו. (תקנה 6)', {'size': 14})], fill=CARD)

# 13 --------------------------------------------------------------------------------------------------------------
s = D.slide('איפה הציוד: משטפות עיניים, דפיברילטור וערכות', source=PLANT + ', סעיף 5.6.2; אישור דפיברילטורים 05/2024')
D.table(s, 6.6, 1.5, 6.15, [
    ['משטפות עיניים לפי תיק המפעל'],
    ['מתקן טיפול בשפכים'],
    ['מעבדה'],
    ['כניסה לחדר מכונות קירור א\''],
    ['חצר המפעל, ליד ברזי מילוי וריקון האמוניה'],
], [6.15], size=15, row_h=0.56)
D.box(s, 6.6, 4.5, 6.15, 2.35, [
    ('ועוד במפעל', {'bold': True, 'size': 18, 'color': NAVY}),
    ('מקלחות חירום ברחבי המפעל.', {'size': 15}),
    ('2 דפיברילטורים (מכשירי החייאה).', {'size': 15}),
    ('ארגזי עזרה ראשונה ואלונקות. תדע איפה הקרוב אליך.', {'size': 15, 'bold': True})], fill=CARD)
photo(s, 0.6, 1.5, 2.9, 2.6, 'eyewash.jpg', 'eliduke, CC BY-SA 2.0')
photo(s, 3.55, 1.5, 2.9, 2.6, 'aed.jpg', 'Lee J Haywood, CC BY-SA 2.0')
photo(s, 0.6, 4.25, 5.85, 2.6, 'first_aid.jpg', 'Marcin Wichary, CC BY 2.0')

# 14 --------------------------------------------------------------------------------------------------------------
s = D.slide('לקחים מהמפעל שלנו', source='מכתב לכבאות 28/07/2026; סיורי בטיחות 2026; תרגיל 14/01/2026')
lessons = [('שריפה ב-27/07/2026', 'במתחם יבולים. החשמל נותק, ומשאבות הכיבוי נשארו בלי סולר. הן חזרו לפעולה ב-29/07/2026.',
            'ציוד שהשתמשו בו מחדשים מיד.'),
           ('ארונות כיבוי חסומים', 'בסיורים ב-07/09/2026 וב-22/09/2026 נמצאו ארונות כיבוי חסומים.',
            'לא מניחים כלום מול ארון כיבוי.'),
           ('משטפת עיניים שבורה', 'ב-14/09/2026 נמצאה בקילופים משטפת עיניים עם ידית שבורה.',
            'רואים תקלה בציוד חירום? מדווחים.'),
           ('כוויות שמן וחומרים', 'כוויה משמן חם בטוגנים (26/07/2026), וכוויה מסודה קאוסטית (19/05/2026).',
            'יודעים איפה המים הכי קרובים.')]
for i, (t, d, l) in enumerate(lessons):
    x = 0.6 + (3 - i) * 3.08
    D.box(s, x, 1.5, 2.9, 0.75, t, size=17, bold=True, color='FFFFFF', fill=RED, align='c')
    D.box(s, x, 2.32, 2.9, 2.4, d, size=15, fill=CARD)
    D.box(s, x, 4.8, 2.9, 1.0, l, size=15, bold=True, color='FFFFFF', fill=GREEN)
D.box(s, 0.6, 5.95, W - 1.2, 0.9, [('ומה עבד: בתרגיל 14/01/2026 הכריזה נשמעה בכל המפעל, וצוות הכיבוי פרס גלגלונים תוך 3 דקות.',
                                    {'size': 15.5, 'bold': True})], fill=DBLUE)

# 15 --------------------------------------------------------------------------------------------------------------
s = D.slide('בדיקת הבנה: חמש שאלות')
qs = [('שמן בוער במטגנת. במה מכבים?', 'אבקה או קצף. לעולם לא מים'),
      ('לוח חשמל בוער. מותר גלגלון?', 'לא! גז או אבקה, עד ניתוק החשמל'),
      ('שמעת כריזת פינוי. לאן הולכים?', 'לנקודת הכינוס מחוץ לשער הראשי, אלא אם הכריזו אחרת'),
      ('מה עושים בנקודת הכינוס?', 'נרשמים, ומחכים להודעה על חזרה לשגרה'),
      ('ניתז חומר ניקוי לעין. מה עושים?', 'שוטפים מיד בהרבה מים במשטפה, ומזעיקים עזרה')]
for i, (q, a) in enumerate(qs):
    y = 1.5 + i * 1.07
    D.box(s, 12.0, y, 0.75, 0.93, str(i + 1), size=22, bold=True, color='FFFFFF', fill=BLUE, align='c')
    D.box(s, 5.6, y, 6.25, 0.93, q, size=16, bold=True, color=NAVY, fill=CARD)
    D.box(s, 0.6, y, 4.85, 0.93, a, size=14.5, color='FFFFFF', fill=GREEN)

# 16 --------------------------------------------------------------------------------------------------------------
s = D.slide('שישה כללים לקחת מכאן')
rules = ['רואים סכנה? צועקים ומודיעים מיד.',
         'כריזה? יוצאים לנקודת הכינוס ונרשמים.',
         'שמן בוער? לעולם לא מים.',
         'חשמל בוער? לא מים ולא קצף.',
         'לא מכבים לבד אש גדולה.',
         'לא חוסמים ארון כיבוי או משטפה.']
for i, t in enumerate(rules):
    x = 6.85 if i % 2 == 0 else 0.6
    y = 1.6 + (i // 2) * 1.6
    D.box(s, x + 5.1, y, 0.8, 1.4, str(i + 1), size=28, bold=True, color='FFFFFF', fill=BLUE, align='c')
    D.box(s, x, y, 5.0, 1.4, t, size=18, bold=True, color=NAVY, fill=CARD)
D.text(s, 0.6, 6.45, W - 1.2, 0.45, 'שאלות? מנהל הבטיחות ואיכות הסביבה, או מנהל המשמרת שלך.', size=16, color=GREY, align='c')

D.save(out)
print('saved', out, 'slides', D.n)
