// Builds the pilot guide of the annual safety training (15/10/2026, Michael: "a pilot of the annual
// training process ... a PDF with instructions and pictures"; and: "only the annual training for all
// the workers, not the weekly one"). One PDF for Michael: he runs the whole process once, end to end,
// with a training named "pilot", before the real one.
//
//   NODE_PATH=$(npm root -g) node tools/guide-annual-shots.mjs          # the pictures
//   NODE_PATH=$(npm root -g) node project-files/guide-annual/build-pdf.js
//   PREVIEW=/some/dir NODE_PATH=... node project-files/guide-annual/build-pdf.js
//
// Same rules as the other guides (skill tfugen-guides): the number on a picture is the step number
// here; pages are fixed-height boxes and a page that overflows refuses to build; a missing picture
// refuses to build; every word uses keyboard characters only (KEYBOARD_ONLY). Emoji stay: they are
// what is printed on the buttons.
//
// Facts in the text come from the code, so a change there changes the guide:
//   the folder            F0801_ROOT + F0801_SUB.annual + year (functions/api/talk.js)
//   20 to a page          F0801_ROWS
//   a week                _TBT_STALE_DAYS (index.html), TALK_OPEN_DAYS (weekly-digest.js)
//   recipients            the recipients sheet of the hazard workbook (readRecipients, hazard-report.js)
//   button names          index.html (#tbt-card, m-tbt, m-tbt-link, tbtWho) and talk.js (LANGS.he, ANN_OK)
const fs = require('fs');
const os = require('os');
const path = require('path');
let pw; try { pw = require('playwright'); } catch (e) { pw = require('playwright-core'); }

const HERE = __dirname;
const shot = (n) => 'file://' + path.join(HERE, n);
const step = (s) => `
  <section class="step${s.quiet ? ' quiet' : ''}">
    <div class="pic"><img src="${shot(s.img)}"></div>
    <div class="txt">
      <h2>${s.n ? '<span class="num">' + s.n + '</span>' : ''}${s.h}</h2>
      ${s.p.map((x) => '<p>' + x + '</p>').join('')}
    </div>
  </section>`;
const page = (inner) => '<div class="page">' + inner + '</div>';

const CSS = `
  @page { size: A4; margin: 14mm 12mm; }
  * { box-sizing: border-box; }
  body { margin:0; font-family:'DejaVu Sans','Liberation Sans',Arial,'Noto Color Emoji',sans-serif;
         color:#1a1a1a; font-size:10.5pt; line-height:1.6; }
  h1 { font-size:20pt; margin:0 0 2mm; color:#1e3a8a; line-height:1.25; }
  .sub { color:#666; font-size:10pt; margin:0 0 5mm; }
  .cover { border-bottom:3px solid #1e3a8a; padding-bottom:4mm; margin-bottom:5mm; }
  .box { border-radius:3mm; padding:3.5mm 5mm; margin:0 0 4mm; }
  .info { background:#f4f7fb; border:1px solid #d6e0ec; }
  .danger { background:#fff2f2; border:1.5px solid #e04a4a; }
  .danger b { color:#c8102e; }
  .oneline { background:#f6faf6; border:1px solid #cfe3cf; }
  .idea { background:#fff9ec; border:1px solid #e8d9ae; }
  .page { width:186mm; height:269mm; overflow:hidden; page-break-after:always; }
  .page:last-child { page-break-after:auto; }
  .step { display:grid; grid-template-columns:50mm 1fr; gap:7mm; align-items:start; margin-bottom:7mm; }
  .step img { width:50mm; display:block; border:1px solid #dcdcdc; border-radius:2mm; }
  .step h2 { font-size:12.5pt; margin:0 0 2mm; line-height:1.35; }
  .step p { margin:0 0 2mm; }
  .num { display:inline-block; background:#ff3b30; color:#fff; width:7mm; height:7mm; border-radius:50%;
         text-align:center; line-height:7mm; font-size:11pt; margin-left:2.5mm; vertical-align:middle; }
  .quiet h2 { color:#555; font-size:11pt; font-weight:normal; }
  h3 { font-size:13pt; color:#1e3a8a; margin:0 0 2mm; border-top:1.5px solid #eee; padding-top:3mm; }
  h3.first { border-top:none; padding-top:0; }
  ul, ol { margin:0 0 3mm; padding-right:5mm; }
  li { margin-bottom:1.3mm; }
  .doc { display:grid; grid-template-columns:96mm 1fr; gap:6mm; align-items:start; margin-bottom:4mm; }
  .doc img { width:96mm; border:1px solid #ccc; border-radius:1.5mm; display:block; }
  .chk li { list-style:none; margin-right:-5mm; }
  .chk li::before { content:'[ ]  '; font-family:monospace; color:#1e3a8a; }
  .foot { margin-top:5mm; padding-top:3mm; border-top:1px solid #eee; color:#888; font-size:9pt; }
  .en { direction:ltr; unicode-bidi:isolate; white-space:nowrap; }
`;
const FOOT = '<p class="foot">תעשיות תפוגן בע"מ | מערכת ניהול בטיחות ואיכות סביבה | נוהל 8, טופס 08.01 | ISO 45001</p>';

const GUIDE = `<!doctype html><html lang="he" dir="rtl"><meta charset="utf-8"><title>פיילוט הדרכה שנתית</title><style>${CSS}</style>
${page(`
<div class="cover">
  <h1>📅 פיילוט: הדרכה שנתית לכל העובדים</h1>
  <p class="sub">מדריך לממונה הבטיחות | מהטופס ועד טופס 08.01 בתיקייה | הדרכה אחת, QR אחד, טופס אחד לכולם</p>
</div>
<div class="box oneline">
  <b>בשורה אחת:</b> ההדרכה עצמה ניתנת מול מדריך, בחדר. הטלפון רק מחליף את דף הנוכחות:
  כל משתתף סורק QR, מקליד שם, תעודת זהות ומחלקה, מאשר שעבר הדרכה <b>בנושאים שהמדריך סימן</b>, וחותם באצבע.
  בסוף סוגרים את החתימות ומפיקים טופס 08.01 אחד עם כל המשתתפים, שמתויק לבד ונשלח אליך במייל.
  אותו תהליך לכל ההדרכות השנתיות של הבטיחות, וגם להדרכת האיכות.
</div>
<div class="box danger">
  <b>בפיילוט, שלושה כללים:</b>
  <ul style="margin:1mm 0 0">
    <li>נושא ההדרכה: <b>"פיילוט הדרכה שנתית"</b>, כדי שלא יתבלבל עם האמיתית.</li>
    <li><b>"שלח את טופס 08.01 גם אל"</b>: להשאיר ריק. הטופס יגיע רק אליך.</li>
    <li>בצעד 11 לוחצים רק <b>"🧪 שלח לי לבדיקה"</b>, ולא <b>"📧 שלח למנהלים"</b>.</li>
  </ul>
</div>
${step({
    img: 'a1-page.png', n: 1,
    h: 'פותחים טופס חדש',
    p: [
      'מודולים, <b>🎓 הדרכות</b>, לשונית <b>"הדרכות וחתימות"</b>.',
      'לוחצים <b>"+ הדרכה חדשה"</b>. אותו טופס משמש לכל סוגי ההדרכה, והסוג נבחר בצעד הבא.',
    ],
  })}
`)}
${page(step({
    img: 'a2-form.png', n: 2,
    h: 'פרטי ההדרכה, וסוג ההדרכה: שנתית',
    p: [
      '<b>תאריך:</b> היום. <b>נושא:</b> פיילוט הדרכה שנתית. <b>מחלקה:</b> כל המפעל.',
      '<b>סוג ההדרכה:</b> <b>"📅 שנתית"</b>. ברגע שבוחרים אותה נפתחים השדות של ההדרכה השנתית.',
      '<b>משך ההדרכה:</b> למשל "שעתיים". <b>מדריך</b> ו<b>כשירות המדריך:</b> השם והתפקיד של מי שמעביר.',
      'אין שדה "תוכן": ההדרכה ניתנת בעל פה, ובטלפון העובד רואה רק את הנושאים.',
    ],
  }) + step({
    img: 'a3-before.png', n: 3,
    h: 'התיבה "לפני פרסום (חובה)"',
    p: [
      '<b>סוגי ההדרכה שהועברו:</b> מסמנים את הנושאים שהועברו בחדר. נושא שלא ברשימה: בשורה "אחר". <b>על הנושאים האלה העובד חותם</b>, והם נכנסים לטופס 08.01.',
      '<b>בדיקת אפקטיביות:</b> הטקסט כבר כתוב. <b>אפקטיבי?</b> כן.',
      '<b>חתימת המדריך:</b> חותמים באצבע בתוך המסגרת. הכיתוב "המדריך עוד לא חתם" מתעדכן אחרי השמירה.',
      'בלי שלושת אלה ההדרכה לא מתפרסמת, ומופיעה הודעה שאומרת מה חסר.',
    ],
  }))}
${page(step({
    img: 'a4-send.png', n: 4,
    h: '"📤 שמור ושלח": שומר, מפרסם ופותח את ה-QR',
    p: [
      'כפתור אחד בתחתית הטופס. ההדרכה נשמרת כ"פורסמה" וחלון הקישור נפתח.',
      'אפשר גם <b>"שמור"</b> (טיוטה) ולפרסם מאוחר יותר. <b>"שלח את טופס 08.01 גם אל"</b> נשאר ריק בפיילוט.',
    ],
  }) + step({
    img: 'a5-qr.png', n: 5,
    h: 'ה-QR והקישור',
    p: [
      'בסוף ההדרכה מציגים את ה-QR בחדר: מודפס בגדול, או על המסך של המצגת. כולם סורקים יחד, וכל אחד חותם בטלפון שלו.',
      'מי שאין לו טלפון חכם חותם בטלפון של המדריך, אחד אחרי השני (<b>"עובד הבא חותם"</b>). ה-QR עובד עד שסוגרים את החתימות (צעד 12).',
      'בפיילוט: סורקים בטלפון אחר.',
      'ה-QR בתמונה הוא להמחשה בלבד.',
    ],
  }))}
${page(step({
    img: 'w6-details.png', n: 6,
    h: 'בטלפון של העובד: שם, תעודת זהות, מחלקה',
    p: [
      'העובד רואה את שם ההדרכה, המדריך ו<b>נושאי ההדרכה</b>, ומתחת מקליד <b>שם מלא</b>, <b>תעודת זהות או דרכון</b>, ובוחר <b>מחלקה</b> (או "אחר" ומקליד).',
      'אין רשימת שמות: כל אחד מקליד. עובד נחשב "חתם" לפי תעודת הזהות שבכרטיס העובד שלו.',
      '<b>כדאי לנסות:</b> חתימה אחת עם ת"ז של עובד אמיתי מהכרטיסים, ואחת עם ת"ז שלא קיימת.',
    ],
  }) + step({
    img: 'w7-sign.png', n: 7,
    h: 'אישור, חתימה באצבע, "חתום ושלח"',
    p: [
      'מסמנים את האישור. הנושאים כתובים בו מהטופס של המדריך, למשל: <b>"אני מאשר/ת שעברתי הדרכה בנושאים: כיבוי אש, עבודה בגובה. הבנתי אותם ואפעל לפיהם."</b>',
      'חותמים באצבע בתוך המסגרת ולוחצים <b>"חתום ושלח"</b>. מופיע "תודה" עם <b>"עובד הבא חותם"</b>, למי שחותם בטלפון משותף.',
    ],
  }))}
${page(step({
    img: 'a8-count.png', n: 8,
    h: 'במסך ההדרכות: כמה חתמו',
    p: [
      'בשורה של ההדרכה, ליד <b>"חתמו:"</b>, יש כפתור עם המספר. לוחצים עליו, ונפתח <b>"מי חתם"</b>.',
    ],
  }) + step({
    img: 'a9-preview.png', n: 9,
    h: '"👀 תצוגה מקדימה של 08.01"',
    p: [
      'ב"מי חתם" רואים את החותמים, ומתחת מי עוד לא חתם, לפי מחלקה.',
      '<b>"👀 תצוגה מקדימה של 08.01"</b> פותח את הטופס כמו שיתויק, בלי לשמור ובלי לשלוח. בפינה יש <b>"🖨️ הדפס"</b>. בעמוד הבא: מה לבדוק בטופס.',
    ],
  }))}
${page(`
<h3 class="first">טופס 08.01: מה בודקים</h3>
<div class="doc">
  <img src="${shot('form-0801.png')}">
  <div>
    <ul class="chk">
      <li>הלוגו, הכותרת "תיעוד ביצוע הדרכה" ומספר הטופס.</li>
      <li>תאריך ההדרכה ומשך ההדרכה.</li>
      <li><b>נושאי ההדרכה:</b> מה שסימנת בצעד 3.</li>
      <li>שם המדריך והכשירות, והחתימה שלך.</li>
      <li>טבלת החותמים: שם, מחלקה, תעודת זהות וחתימה. 20 חותמים בעמוד, ועמוד נוסף כשיש יותר.</li>
      <li><b>בדיקת האפקטיביות:</b> הטקסט, "כן", התאריך, והחתימה שלך שוב.</li>
    </ul>
    <p>משהו חסר או לא נכון? צילום מסך של התצוגה המקדימה, ואני מתקן לפני ההדרכה האמיתית.</p>
  </div>
</div>
`)}
${page(step({
    img: 'a10-who.png', n: 10,
    h: '"📧 מי לא חתם, למנהלים"',
    p: [
      'באותו מסך "מי חתם". הכפתור מכין לכל מחלקה מייל למנהל שלה, עם השמות של מי שלא חתם והקישור לחתימה.',
      'קודם מוצגת תצוגה מקדימה, ושום דבר לא נשלח בלי לחיצה נוספת.',
    ],
  }) + step({
    img: 'a11-miss.png', n: 11,
    h: 'בודקים, ושולחים רק לעצמך',
    p: [
      'בכל מחלקה: <b>אל</b> מי, <b>עותק</b> למי, ושמות העובדים. הנמענים הם אותו גיליון "נמענים" של דוח המחלקות. אריזה נשלחת לייצור טוגנים.',
      'מחלקה באדום <b>"אין נמען בגיליון הנמענים, לא יישלח"</b>: צריך להוסיף את המנהל שלה לגיליון.',
      'בפיילוט: <b>"🧪 שלח לי לבדיקה"</b> בלבד. במייל שיגיע כתוב למי הוא היה נשלח באמת.',
    ],
  }))}
${page(step({
    img: 'a12-close.png', n: 12,
    h: 'סוגרים את החתימות',
    p: [
      'בשורה של ההדרכה <b>"🔗 קישור"</b>, ואז <b>"⛔ סגור חתימות"</b>, ומאשרים.',
      'מי שכבר חתם נשאר. אפשר לפתוח מחדש בכל רגע.',
    ],
  }) + step({
    img: 'w13-closed.png', n: 13,
    h: 'סורקים שוב: "נסגרה לחתימות"',
    p: [
      'עובד שסורק אחרי הסגירה רואה <b>"ההדרכה הזו נסגרה לחתימות. לשאלות: הממונה על הבטיחות."</b> (בעברית, ערבית, רוסית או אמהרית). חתימה לא נשמרת.',
    ],
  }))}
${page(step({
    img: 'a14-closed.png', n: 14,
    h: 'בטבלה: "🔒 נסגרה לחתימות"',
    p: [
      'עם התאריך, וכפתור <b>"🔓 פתח מחדש"</b>. פתיחה מחזירה לעבודה את אותו QR שתלוי על הקיר.',
    ],
  }) + step({
    img: 'a15-form.png', n: 15,
    h: '"📄 טופס 08.01 עם כל החותמים"',
    p: [
      'ב"מי חתם". הטופס נשמר כ-PDF בתיקייה <b>11_הדרכות / הדרכה שנתית / 2026</b>, ונשלח אליך במייל עם ה-PDF.',
      'אפשר להפיק אותו שוב אחרי חתימות נוספות: נוצר קובץ מעודכן.',
    ],
  }))}
${page(`
<h3 class="first">רשימת בדיקה לפיילוט</h3>
<ul class="chk">
  <li>לא היה אפשר לפרסם לפני שסימנתי נושאים, אפקטיביות וחתימה.</li>
  <li>"📤 שמור ושלח" פתח את ה-QR.</li>
  <li>סרקתי בטלפון, והדף הראה את הנושאים שסימנתי, גם בשורת האישור.</li>
  <li>חתמתי עם ת"ז של עובד מהכרטיסים: הוא נספר כ"חתם" ב"מי חתם".</li>
  <li>התצוגה המקדימה של 08.01 נראית נכון (עמוד הקודם).</li>
  <li>"מי לא חתם, למנהלים": המחלקות והמנהלים נכונים, ומייל הבדיקה הגיע אליי.</li>
  <li>אחרי הסגירה ה-QR הראה "נסגרה לחתימות", ו"פתח מחדש" החזיר אותו לעבודה.</li>
  <li>טופס 08.01 נשמר בתיקייה והגיע במייל.</li>
</ul>

<h3>נתקעת?</h3>
<ul>
  <li><b>"לפני פרסום חסר: ..."</b>: ההודעה אומרת מה חסר בתיבה של צעד 3.</li>
  <li><b>"ההדרכה סגורה לחתימות":</b> בטבלה "🔓 פתח מחדש".</li>
  <li><b>"מספר תעודת הזהות לא תואם את הרשום אצלנו"</b> בטלפון: המספר שונה מהרשום בכרטיס העובד. לבדוק מול תעודת הזהות.</li>
  <li><b>המייל של 08.01 לא הגיע תוך רבע שעה:</b> צילום מסך של מה שכתוב מתחת לכפתור "טופס 08.01".</li>
</ul>

<h3>אחרי הפיילוט</h3>
<div class="box info">
  נשארים: ה-PDF של הפיילוט בתיקייה (אפשר להעביר לתיקיית "למחיקה"), המייל, וההדרכה עם החתימות במסך ההדרכות.
  הדרכה שמישהו חתם עליה לא נמחקת מהמסך, כדי לשמור על הרישום.
</div>
<div class="box idea">
  <b>הערות:</b> כל מקום שנתקעת בו, טקסט לא ברור, או משהו שנראה לא נכון. צילום מסך עוזר. אחרי התיקונים עוברים להדרכה האמיתית.
</div>
${FOOT}
`)}
</html>`;

// Copied from project-files/guide-trustees/build-pdf.js, where the reason is written out:
// these come back with every rewrite and cannot be seen by reading.
const KEYBOARD_ONLY = [
  ['—', 'em dash'], ['–', 'en dash'], ['‒', 'figure dash'],
  ['־', 'maqaf'], ['‐', 'hyphen U+2010'], ['−', 'minus sign'],
  ['«', 'guillemet'], ['»', 'guillemet'],
  ['“', 'curly quote'], ['”', 'curly quote'],
  ['‘', 'curly quote'], ['’', 'curly quote'],
  ['׳', 'geresh'], ['״', 'gershayim'],
  ['…', 'ellipsis'], ['·', 'middle dot'], ['•', 'bullet'],
  ['→', 'arrow'], ['←', 'arrow'], ['×', 'multiplication sign'],
  [' ', 'non-breaking space'], ['‏', 'RTL mark'], ['‎', 'LTR mark'],
];
const proseOf = (html) => html.replace(/<style[\s\S]*?<\/style>/g, ' ').replace(/<[^>]+>/g, ' ');
const offenders = (html) => KEYBOARD_ONLY.map(([ch, name]) => {
  const hits = proseOf(html).split(ch).length - 1;
  return hits ? name + ' (' + ch + ') x' + hits : null;
}).filter(Boolean);

const FILE = 'מדריך-פיילוט-הדרכה-שנתית.pdf';

(async () => {
  const bad = offenders(GUIDE);
  if (bad.length) { console.error('NON-KEYBOARD CHARACTERS: ' + bad.join(', ')); process.exit(1); }
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'annual-guide-'));
  const browser = await pw.chromium.launch();
  const pg = await browser.newPage();
  const src = path.join(tmp, 'x.html');
  fs.writeFileSync(src, GUIDE);
  await pg.goto('file://' + src, { waitUntil: 'load' });
  await pg.waitForTimeout(500);
  const broken = await pg.evaluate(() => [...document.images].filter((i) => !i.complete || !i.naturalWidth).map((i) => i.src.split('/').pop()));
  if (broken.length) { console.error('MISSING IMAGES: ' + broken.join(', ')); process.exit(1); }
  const over = await pg.evaluate(() => [...document.querySelectorAll('.page')]
    .map((el, i) => ({ n: i + 1, over: el.scrollHeight - el.clientHeight })).filter((x) => x.over > 2));
  if (over.length) { console.error('OVERFLOWING PAGES: ' + over.map((x) => '#' + x.n + ' by ' + x.over + 'px').join(', ')); process.exit(1); }
  const dest = path.join(HERE, FILE);
  await pg.pdf({ path: dest, format: 'A4', printBackground: true });
  if (process.env.PREVIEW) {
    fs.mkdirSync(process.env.PREVIEW, { recursive: true });
    const pages = await pg.locator('.page').all();
    for (let i = 0; i < pages.length; i++) await pages[i].screenshot({ path: path.join(process.env.PREVIEW, 'p' + (i + 1) + '.png') });
  }
  console.log('  ✓ ' + FILE + '  (' + Math.round(fs.statSync(dest).size / 1024) + ' KB, ' + (await pg.locator('.page').count()) + ' pages)');
  await browser.close();
  fs.rmSync(tmp, { recursive: true, force: true });
})();
