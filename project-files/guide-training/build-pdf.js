// Builds the two training guides (10/10/2026, Michael: "מדריך למשאבי אנוש
// והמנהלים לשימוש"): one for HR (the new-worker induction, fixed QR), one for
// the department managers (the weekly talk). Each is a PDF to forward in
// WhatsApp or mail, plus a single-image quick card.
//
//   NODE_PATH=$(npm root -g) node tools/guide-talk-shots.mjs        # the pictures
//   NODE_PATH=$(npm root -g) node project-files/guide-training/build-pdf.js
//   PREVIEW=/some/dir NODE_PATH=... node project-files/guide-training/build-pdf.js
//
// Neither HR nor the managers log in to the app (Michael in the questionnaire,
// 10/10/2026: managers get the link from him). So the pictures are the page a
// worker opens, and the guide says what each of them does around it.
//
// Same rules as project-files/guide-trustees/build-pdf.js: the number on a
// picture is the step number here; pages are fixed-height boxes and a page that
// overflows refuses to build; a missing picture refuses to build; and every
// word a person reads uses keyboard characters only (KEYBOARD_ONLY). Emoji
// stay, they are what is printed on the buttons.
//
// Facts in the text come from the code, so a change there changes the guide:
//   14 days            TALK_TTL_DAYS in functions/api/talk.js
//   one day            GROUP_TTL_DAYS (the face-to-face link)
//   hr-tap@...         IND_HR
//   the folder         IND_ROOT (11_הדרכות/12_קליטת עובדים חדשים/<year>)
//   the mail subject   fileInduction
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
         color:#1a1a1a; font-size:10.5pt; line-height:1.65; }
  h1 { font-size:20pt; margin:0 0 2mm; color:#1e3a8a; line-height:1.25; }
  .sub { color:#666; font-size:10pt; margin:0 0 6mm; }
  .cover { border-bottom:3px solid #1e3a8a; padding-bottom:5mm; margin-bottom:6mm; }
  .box { border-radius:3mm; padding:4mm 5mm; margin:0 0 5mm; }
  .info { background:#f4f7fb; border:1px solid #d6e0ec; }
  .danger { background:#fff2f2; border:1.5px solid #e04a4a; }
  .danger b { color:#c8102e; }
  .oneline { background:#f6faf6; border:1px solid #cfe3cf; }
  .idea { background:#fff9ec; border:1px solid #e8d9ae; }
  .page { width:186mm; height:269mm; overflow:hidden; page-break-after:always; }
  .page:last-child { page-break-after:auto; }
  .step { display:grid; grid-template-columns:52mm 1fr; gap:7mm; align-items:start; margin-bottom:8mm; }
  .step img { width:52mm; display:block; border:1px solid #dcdcdc; border-radius:2mm; }
  .step h2 { font-size:12.5pt; margin:0 0 2mm; line-height:1.35; }
  .step p { margin:0 0 2mm; }
  .num { display:inline-block; background:#ff3b30; color:#fff; width:7mm; height:7mm; border-radius:50%;
         text-align:center; line-height:7mm; font-size:11pt; margin-left:2.5mm; vertical-align:middle; }
  .quiet h2 { color:#555; font-size:11pt; font-weight:normal; }
  h3 { font-size:13pt; color:#1e3a8a; margin:0 0 2mm; border-top:1.5px solid #eee; padding-top:4mm; }
  h3.first { border-top:none; padding-top:0; }
  ul, ol { margin:0 0 4mm; padding-right:5mm; }
  li { margin-bottom:1.5mm; }
  .doc { display:grid; grid-template-columns:88mm 1fr; gap:6mm; align-items:start; margin-bottom:5mm; }
  .doc img { width:88mm; border:1px solid #ccc; border-radius:1.5mm; display:block; }
  .foot { margin-top:6mm; padding-top:3mm; border-top:1px solid #eee; color:#888; font-size:9pt; }
`;
const doc = (title, pages) => `<!doctype html><html lang="he" dir="rtl"><meta charset="utf-8"><title>${title}</title><style>${CSS}</style>${pages.join('\n')}</html>`;
const FOOT = '<p class="foot">תעשיות תפוגן בע"מ | מערכת ניהול בטיחות ואיכות סביבה | ISO 45001 / ISO 14001</p>';

// The four steps of the worker's page. Both guides show them: HR stands next
// to a new worker on the first day, a manager helps the one who got stuck.
const W = {
  open: (ind) => ({
    img: 'w1-open.png', n: 1,
    h: ind ? 'סורקים את ה-QR ובוחרים שפה' : 'פותחים את הקישור ובוחרים שפה',
    p: [
      ind ? 'העובד סורק עם המצלמה של הטלפון את ה-QR שתלוי אצלכם, והדף נפתח. אין התקנה, אין שם משתמש ואין סיסמה.'
        : 'העובד לוחץ על הקישור בוואטסאפ, והדף נפתח בטלפון. אין התקנה, אין שם משתמש ואין סיסמה.',
      'למעלה יש כפתורי שפה: <b>עברית, العربية, Русский, አማርኛ</b>. העובד לוחץ על השפה שלו, וכל הדף עובר אליה.',
      'מתחת לכותרת יש <b>"🔊 הקרא בקול"</b>: קול של מדריך מקריא את ההדרכה בשפה שנבחרה, לעובד שקשה לו לקרוא.',
    ],
  }),
  quiz: {
    img: 'w2-quiz.png', n: 2,
    h: 'קוראים, ועונים על שאלות ההבנה',
    p: [
      'אחרי הטקסט (ולפעמים סרטון קצר) יש <b>"❓ בדיקת הבנה"</b>: 2-3 שאלות עם ארבע תשובות.',
      'אחרי כל תשובה העובד רואה מיד <b>"✓ נכון"</b>, או את התשובה הנכונה באדום. אפשר לחתום גם אם טעה. נשמרת התשובה הראשונה, והיא מראה אם ההדרכה הובנה.',
    ],
  },
  sign: (img) => ({
    img, n: 4,
    h: 'תעודת זהות, אישור, חתימה באצבע, "חתום ושלח"',
    p: [
      '<b>"תעודת זהות או דרכון"</b>: כל עובד מקליד את המספר שלו.',
      'מסמנים את התיבה <b>"אני מאשר/ת שקיבלתי הדרכה..."</b>, חותמים באצבע בתוך המסגרת, ולוחצים <b>"חתום ושלח"</b>.',
      'חתימה לא יצאה טוב? <b>"נקה חתימה"</b> וחותמים שוב.',
    ],
  }),
};

// ---------- HR ----------
const HR = doc('מדריך קליטת עובד חדש', [
  page(`
<div class="cover">
  <h1>🆕 קליטת עובד חדש: מדריך למשאבי אנוש</h1>
  <p class="sub">תעשיות תפוגן בע"מ | הוראות כניסה למשמרת, טופס 08.02.01 | חתימה בטלפון</p>
</div>
<div class="box oneline">
  <b>בשורה אחת:</b> ביום הראשון העובד החדש סורק את ה-QR שאצלכם (בפעם הראשונה במכשיר אתם מקלידים
  סיסמה), קורא את הוראות הכניסה למשמרת, עונה על שאלות ההבנה וחותם באצבע. הטופס החתום מגיע לבד למייל שלכם ולמייל של ממונה הבטיחות,
  ומתויק בתיקייה. אין טופס נייר ואין סריקה.
</div>
<div class="box info">
  <b>ה-QR קבוע.</b> ממונה הבטיחות מדפיס אותו פעם אחת ותולה אצלכם. הוא לא פג, ומשמש את כל העובדים
  החדשים. הוא מיועד <b>רק לעובדים חדשים</b>, לא לקבלנים ולא לנהגים.
</div>
${step({
    img: 'w0-code.png', n: null,
    h: 'פעם אחת בכל מכשיר: הסיסמה של משאבי אנוש',
    p: [
      'הטופס מוגן בסיסמה, כדי שמי שצילם את ה-QR לא יוכל לחתום מבחוץ. בפעם הראשונה שסורקים במכשיר מופיע מסך <b>"סיסמת משאבי אנוש"</b>.',
      '<b>אתם</b> מקלידים את הסיסמה ולוחצים <b>"כניסה"</b>, לא העובד. אותיות גדולות וקטנות נחשבות אותו דבר. המכשיר זוכר את הסיסמה שנה, ובפעם הבאה הטופס נפתח ישר.',
      'את הסיסמה מקבלים פעם אחת מממונה הבטיחות. <b>אל תעבירו אותה לעובדים.</b> אחרי 10 ניסיונות שגויים המכשיר ננעל לשעה.',
    ],
  })}
`),
  page(step(W.open(true)) + step(W.quiz)),
  page(step({
    img: 'w3b-other.png', n: 3,
    h: 'בוחרים שם, או "אני לא ברשימה"',
    p: [
      'עובד שכבר נקלט ברשימת העובדים מוצא את השם שלו ברשימה <b>"השם שלך"</b>, לפי המחלקה.',
      'עובד שעוד לא ברשימה, או עובד יומי מחברת כוח אדם: בוחרים <b>"אני לא ברשימה"</b> (בראש הרשימה), וכותבים <b>שם מלא</b> ו<b>חברה או מחלקה</b>.',
      'השם נכתב בכל שפה. המערכת רושמת אותו גם באותיות עבריות.',
    ],
  }) + step(W.sign('w4-sign-ind.png'))),
  page(step({
    img: 'w5-done-ind.png', n: null,
    h: '"תודה" על המסך: החתימה נשמרה',
    p: [
      'זה הסימן שהכל עבר. אם יש עוד עובד חדש באותו טלפון, לוחצים <b>"עובד הבא חותם"</b> והדף נפתח מחדש, ריק.',
      'אין לעובד טלפון חכם? הוא חותם בטלפון או בטאבלט שלכם, באותה דרך. <b>כל עובד חותם בעצמו</b>, אף פעם לא בשמו.',
    ],
    quiet: true,
  }) + `<h3>הטופס המלא</h3><p>העובד קורא את כל שלושת העמודים של טופס 08.02.01, מילה במילה, בשפה שלו: עברית, ערבית, רוסית או אמהרית.
  ההקראה (<b>"🔊 הקרא בקול"</b>) ארוכה, כמה דקות, ואפשר לעצור אותה בכל רגע.</p>`),
  page(`
<h3 class="first">מה מגיע אליכם</h3>
<div class="doc">
  <img src="${shot('form-08.png')}">
  <div>
    <p>תוך כמה דקות מהחתימה מגיע מייל לכתובת <b dir="ltr" style="white-space:nowrap;unicode-bidi:isolate">hr-tap@tapugan.co.il</b> ולממונה הבטיחות:</p>
    <p><b>"טופס קליטת עובד חדש חתום: (שם), (תאריך)"</b></p>
    <p>במייל: שם, תעודת זהות, חברה או מחלקה, תאריך ושעה, וכמה תשובות נכונות. מצורף הטופס החתום כ-PDF
    (בתמונה), עם כל הטקסט שהעובד קרא, ההצהרה, המדריך והחתימה.</p>
    <p>אותו טופס מתויק אוטומטית בתיקיית הבטיחות: <b>11_הדרכות / 12_קליטת עובדים חדשים / 2026</b>.
    שם הקובץ: תאריך, שם ותעודת זהות.</p>
    <p>אם אתם שומרים עותק בתיק האישי של העובד, שמרו את ה-PDF מהמייל.</p>
  </div>
</div>

<h3>נתקעתם?</h3>
<ul>
  <li><b>המייל לא הגיע תוך רבע שעה:</b> פנו לממונה הבטיחות. החתימה עצמה נשמרה, והוא רואה במערכת
    אם הטופס נשלח ומה נכשל.</li>
  <li><b>"מספר תעודת הזהות לא תואם את הרשום אצלנו":</b> המספר שהעובד הקליד שונה ממה שרשום
    בכרטיס העובד שלו. בדקו את המספר מול תעודת הזהות, ואם הכרטיס שגוי, עדכנו את ממונה הבטיחות.</li>
  <li><b>"כבר חתמת על ההדרכה הזו":</b> העובד כבר חתם. אין צורך לחתום שוב.</li>
  <li><b>ה-QR לא נפתח, או שצילום שלו הגיע למקום שלא צריך:</b> ממונה הבטיחות מבטל אותו ומדפיס חדש.
    הישן מפסיק לעבוד מיד.</li>
  <li><b>העובד לא מבין משהו בהוראות:</b> הוא שואל אתכם או את ממונה הבטיחות לפני שהוא חותם, לא אחרי.</li>
</ul>

<h3>יש לכם הערה על התהליך?</h3>
<div class="box idea">
  משהו מסורבל, שאלה שלא ברורה לעובדים, שפה שחסרה: פנו לממונה הבטיחות. אתם רואים את העובדים
  החדשים ביום הראשון, ואתם אלה שיודעים מה עובד.
</div>
${FOOT}
`),
]);

// ---------- Managers ----------
const MGR = doc('מדריך הדרכה שבועית למנהלים', [
  page(`
<div class="cover">
  <h1>📖 הדרכה שבועית במחלקה: מדריך למנהל</h1>
  <p class="sub">תעשיות תפוגן בע"מ | ריענון בטיחות שבועי, טופס 08.01 | חתימה בטלפון</p>
</div>
<div class="box oneline">
  <b>בשורה אחת:</b> בתחילת השבוע מקבלים מממונה הבטיחות קישור להדרכה של המחלקה שלכם.
  שולחים אותו לעובדים, וכל עובד קורא, עונה על שאלה או שתיים וחותם באצבע בטלפון שלו.
  התפקיד שלכם: שהקישור יגיע לכולם, ושכולם יחתמו עד סוף השבוע.
</div>

<h3 class="first">מה אתם עושים, בשלושה צעדים</h3>
<ol>
  <li><b>מקבלים את הקישור</b> מממונה הבטיחות, בוואטסאפ או במייל. כל שבוע נושא אחר מהטופס של המחלקה,
    בסבב.</li>
  <li><b>שולחים אותו לעובדים:</b> מעבירים לקבוצת הוואטסאפ של המחלקה, ומוסיפים שורה משלכם, למשל:
    "הדרכת הבטיחות של השבוע, לקרוא ולחתום עד יום חמישי". עובד בלי טלפון חכם חותם בטלפון שלכם.</li>
  <li><b>מוודאים שכולם חתמו:</b> ממונה הבטיחות רואה מי חתם ומי לא, ושולח לכם את השמות של מי שחסר.
    מדברים איתם, ושולחים להם שוב את אותו קישור.</li>
</ol>

<div class="box info">
  <b>הקישור תקף 14 יום.</b> ברשימת השמות בדף מופיעים רק עובדי המחלקה שלכם. עובד ממחלקה אחרת
  או מחליף יכול לחתום דרך <b>"אני לא ברשימה"</b>.
</div>
<div class="box danger">
  <b>⚠️ כל עובד חותם רק בעצמו.</b> החתימה היא רישום בפנקס ההדרכה לפי התקנות.
  חתימה בשם עובד אחר, גם "כדי לעזור", היא רישום כוזב. עובד שלא הבין, שואל לפני שהוא חותם.
</div>
`),
  page(`<h3 class="first">מה העובד רואה, כדי שתוכלו לעזור</h3>` + step(W.open(false)) + step(W.quiz)),
  page(step({
    img: 'w3-name.png', n: 3,
    h: 'בוחרים את השם מהרשימה',
    p: [
      'ברשימה <b>"השם שלך"</b> מופיעים עובדי המחלקה. העובד בוחר את עצמו.',
      'לא מוצא את השם? <b>"אני לא ברשימה"</b> בראש הרשימה, ואז שם מלא וחברה או מחלקה.',
    ],
  }) + step(W.sign('w4-sign.png'))),
  page(step({
    img: 'w5-done.png', n: null,
    h: '"תודה" על המסך: החתימה נשמרה',
    p: [
      'עובד חותם בטלפון שלכם? אחרי שהוא סיים, <b>"עובד הבא חותם"</b> פותח את הדף מחדש לעובד הבא.',
    ],
    quiet: true,
  }) + step({
    img: 'm-group.png', n: null,
    h: 'הדרכה פנים אל פנים, בטלפון אחד',
    p: [
      'מעבירים את ההדרכה בעמידה, כולם יחד? בקשו מממונה הבטיחות <b>"קישור לקבוצה"</b>. הוא תקף ליום אחד, ובראש הדף כתוב <b>"👥 הדרכה פנים אל פנים"</b>.',
      'הטלפון עובר מיד ליד. מי שכבר חתם מסומן ✓ ברשימה ואי אפשר לבחור אותו שוב.',
      'בסוף, מי שהעביר את ההדרכה לוחץ למטה על <b>"✍️ סיום ההדרכה: חתימת המדריך"</b> וחותם.',
    ],
  })),
  page(`
<h3 class="first">נתקעתם?</h3>
<ul>
  <li><b>"תוקף הקישור פג":</b> עברו 14 יום. בקשו מממונה הבטיחות קישור חדש.</li>
  <li><b>"כבר חתמת על ההדרכה הזו":</b> העובד כבר חתם. אין צורך לחתום שוב.</li>
  <li><b>"חסרה חתימה" או "חסר אישור":</b> צריך לחתום בתוך המסגרת המקווקוות, ולסמן את התיבה שמעל.</li>
  <li><b>"מספר תעודת הזהות לא תואם את הרשום אצלנו":</b> בדקו את המספר. אם הוא נכון, פנו לממונה הבטיחות.</li>
  <li><b>העובד קורא בשפה אחרת:</b> הדף בשפה שלו מתורגם אוטומטית. כתוב שם שבכל שאלה פונים לממונה הבטיחות.
    הסבירו לו בעל פה את מה שלא ברור.</li>
  <li><b>הקישור לא נפתח בכלל:</b> בדקו שהוא הועבר במלואו, בלי חיתוך. אם עדיין לא, פנו לממונה הבטיחות.</li>
</ul>

<h3>למה זה חשוב</h3>
<p>ההדרכה השבועית היא הריענון שהמחלקה עוברת על הסיכונים שלה: מכונות, חום, רעש, החלקה, חומרים.
מה שנחתם בדף הוא הרישום שנבדק בביקורת, והתשובות לשאלות מראות אם ההדרכה הובנה.
כמה דקות בשבוע, בטלפון, במקום טופס נייר שצריך לצלם ולשלוח.</p>

<h3>יש לכם הערה או רעיון?</h3>
<div class="box idea">
  נושא שחסר בהדרכה של המחלקה, שאלה שלא מתאימה, סיכון חדש שהופיע בשטח: פנו לממונה הבטיחות.
  אתם מכירים את המחלקה, וההדרכה טובה רק כמו מה שאתם מספרים.
</div>
${FOOT}
`),
]);

// ---------- Quick cards ----------
const CARD_CSS = `*{box-sizing:border-box}
  body{margin:0;width:1080px;font-family:'DejaVu Sans','Liberation Sans',Arial,'Noto Color Emoji',sans-serif;background:#fff;color:#1a1a1a}
  .hd{background:#1e3a8a;color:#fff;padding:34px 40px}.hd h1{margin:0;font-size:44px;line-height:1.2}.hd p{margin:8px 0 0;font-size:22px;opacity:.9}
  .body{padding:32px 40px 40px}ol{margin:0;padding-right:36px;font-size:27px;line-height:1.55}li{margin-bottom:15px}li b{color:#1e3a8a}
  .box{margin-top:24px;border-radius:16px;padding:20px 26px;font-size:24px;line-height:1.5}
  .danger{background:#fff2f2;border:3px solid #e04a4a}.danger b{color:#c8102e}.info{background:#f4f7fb;border:2px solid #d6e0ec}`;
const card = (h1, sub, items, boxes) => `<!doctype html><html lang="he" dir="rtl"><meta charset="utf-8"><style>${CARD_CSS}</style>
<div class="hd"><h1>${h1}</h1><p>${sub}</p></div><div class="body"><ol>${items.map((x) => '<li>' + x + '</li>').join('')}</ol>${boxes}</div></html>`;
const CARD_HR = card('🆕 קליטת עובד חדש: חתימה בטלפון', 'תעשיות תפוגן בע"מ | משאבי אנוש | טופס 08.02.01', [
  'העובד החדש סורק את <b>ה-QR</b> שאצלכם. פעם אחת בכל מכשיר <b>אתם</b> מקלידים את <b>הסיסמה</b>',
  'העובד בוחר <b>שפה</b>, קורא את הטופס המלא',
  'עונה על <b>שאלות ההבנה</b>',
  'בוחר את <b>השם</b> שלו, או <b>"אני לא ברשימה"</b> וכותב שם וחברה',
  'מקליד <b>תעודת זהות</b>, מסמן אישור, <b>חותם באצבע</b> ולוחץ <b>"חתום ושלח"</b>',
  'הטופס החתום מגיע <b>למייל שלכם</b> ולממונה הבטיחות, ומתויק לבד',
], '<div class="box info"><b>המייל לא הגיע תוך רבע שעה?</b> פנו לממונה הבטיחות. החתימה נשמרה.</div>'
  + '<div class="box danger"><b>כל עובד חותם בעצמו.</b> רק עובדים חדשים, לא קבלנים ולא נהגים.</div>');
const CARD_MGR = card('📖 הדרכה שבועית: מה המנהל עושה', 'תעשיות תפוגן בע"מ | מנהלי מחלקות | טופס 08.01', [
  'מקבלים מממונה הבטיחות את <b>הקישור</b> של המחלקה',
  'מעבירים אותו ל<b>קבוצת הוואטסאפ</b> של המחלקה, עם תאריך יעד',
  'כל עובד <b>קורא, עונה וחותם באצבע</b> בטלפון שלו. בלי טלפון: חותם בטלפון שלכם, <b>"עובד הבא חותם"</b>',
  'מקבלים מממונה הבטיחות את <b>מי שלא חתם</b>, ומזכירים לו',
  'הדרכה בעמידה, כולם יחד? בקשו <b>"קישור לקבוצה"</b> ליום אחד',
], '<div class="box info"><b>הקישור תקף 14 יום.</b> פג? בקשו חדש מממונה הבטיחות.</div>'
  + '<div class="box danger"><b>כל עובד חותם רק בעצמו.</b> חתימה בשם אחר היא רישום כוזב בפנקס ההדרכה.</div>');

// Copied from project-files/guide-trustees/build-pdf.js, where the reason is
// written out: these come back with every rewrite and cannot be seen by reading.
const KEYBOARD_ONLY = [
  ['—', 'em dash'], ['–', 'en dash'], ['‒', 'figure dash'],
  ['־', 'maqaf'], ['‐', 'hyphen U+2010'], ['−', 'minus sign'],
  ['«', 'guillemet'], ['»', 'guillemet'],
  ['“', 'curly quote'], ['”', 'curly quote'],
  ['‘', 'curly quote'], ['’', 'curly quote'],
  ['׳', 'geresh'], ['״', 'gershayim'],
  ['…', 'ellipsis'], ['·', 'middle dot'], ['•', 'bullet'],
  ['→', 'arrow'], ['←', 'arrow'], ['×', 'multiplication sign'],
  ['\u00a0', 'non-breaking space'], ['‏', 'RTL mark'], ['‎', 'LTR mark'],
];
const proseOf = (html) => html.replace(/<style[\s\S]*?<\/style>/g, ' ').replace(/<[^>]+>/g, ' ');
const offenders = (html) => KEYBOARD_ONLY.map(([ch, name]) => {
  const hits = proseOf(html).split(ch).length - 1;
  return hits ? name + ' (' + ch + ') x' + hits : null;
}).filter(Boolean);

const OUT = [
  { kind: 'pdf', html: HR, file: 'מדריך-קליטת-עובד-חדש-משאבי-אנוש.pdf' },
  { kind: 'pdf', html: MGR, file: 'מדריך-הדרכה-שבועית-למנהלים.pdf' },
  { kind: 'card', html: CARD_HR, file: 'כרטיס-משאבי-אנוש.png' },
  { kind: 'card', html: CARD_MGR, file: 'כרטיס-מנהלים.png' },
];

(async () => {
  for (const o of OUT) {
    const bad = offenders(o.html);
    if (bad.length) { console.error('NON-KEYBOARD CHARACTERS in ' + o.file + ': ' + bad.join(', ')); process.exit(1); }
  }
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'training-guide-'));
  const browser = await pw.chromium.launch();
  const pg = await browser.newPage();
  for (const o of OUT) {
    const src = path.join(tmp, 'x.html');
    fs.writeFileSync(src, o.html);
    await pg.goto('file://' + src, { waitUntil: 'load' });
    await pg.waitForTimeout(500);
    const broken = await pg.evaluate(() => [...document.images].filter((i) => !i.complete || !i.naturalWidth).map((i) => i.src.split('/').pop()));
    if (broken.length) { console.error('MISSING IMAGES in ' + o.file + ': ' + broken.join(', ')); process.exit(1); }
    const dest = path.join(HERE, o.file);
    if (o.kind === 'card') {
      await pg.locator('body').screenshot({ path: dest });
    } else {
      const over = await pg.evaluate(() => [...document.querySelectorAll('.page')]
        .map((el, i) => ({ n: i + 1, over: el.scrollHeight - el.clientHeight })).filter((x) => x.over > 2));
      if (over.length) { console.error('OVERFLOWING PAGES in ' + o.file + ': ' + over.map((x) => '#' + x.n + ' by ' + x.over + 'px').join(', ')); process.exit(1); }
      await pg.pdf({ path: dest, format: 'A4', printBackground: true });
      if (process.env.PREVIEW) {
        fs.mkdirSync(process.env.PREVIEW, { recursive: true });
        const pages = await pg.locator('.page').all();
        for (let i = 0; i < pages.length; i++) await pages[i].screenshot({ path: path.join(process.env.PREVIEW, path.basename(o.file, '.pdf') + '-' + (i + 1) + '.png') });
      }
    }
    console.log('  ✓ ' + o.file + '  (' + Math.round(fs.statSync(dest).size / 1024) + ' KB)');
  }
  await browser.close();
})();
