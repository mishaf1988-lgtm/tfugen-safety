// Builds the trustee guide — a PDF Michael can forward in WhatsApp, and a
// single-image quick card for the group chat.
//
//   NODE_PATH=$(npm root -g) node project-files/guide-trustees/build-pdf.js
//
// The screenshots next to this file are real captures of the running app at
// 390x844 (iPhone width), seeded with plausible Hebrew data. The red ring and
// its number are drawn by the capture script, not by the app — the numbers on
// the pictures match the numbered steps here, so a person reading the guide on
// one screen and holding the phone in the other hand is looking at the same
// thing. If a screen changes, recapture BEFORE editing the text: a guide that
// points at a button that moved is worse than no guide.
//
// PUNCTUATION: everything a trustee reads uses keyboard characters only. No
// em dash, no guillemets, no maqaf, no arrows, no middle dot — Michael asked
// for them out on 2026-09-21 and the build refuses if one comes back (see the
// KEYBOARD_ONLY check). Emoji stay: they are what is printed on the buttons,
// and a guide that says "לחצו על תקין" without the ✅ is naming a different
// button than the one on screen.
//
// The HTML is generated into a temp directory on purpose. CLAUDE.md rule 5
// says the repo holds one HTML file, index.html, and this is not it.
const fs = require('fs');
const os = require('os');
const path = require('path');
let pw; try { pw = require('playwright'); } catch (e) { pw = require('playwright-core'); }

const HERE = __dirname;
const LINK = 'https://tapugan-safety.pages.dev/?emp=1';

const shot = (n) => 'file://' + path.join(HERE, n);

// Each step: the picture, the number printed on it, the heading, and the body.
// The number is what ties the two together — do not renumber one without the
// other.
const STEPS = [
  {
    img: '01-login.png', n: 1,
    h: 'פותחים את הקישור ולוחצים על הכפתור עם האפוד',
    p: [
      'הקישור פותח את מסך הכניסה של המערכת. אתם <b>לא</b> צריכים שם משתמש וסיסמה אישיים.',
      'לוחצים על הכפתור התחתון: <b>"🦺 דיווח נאמני בטיחות"</b>.',
    ],
  },
  {
    // Added 2026-09-21 with the shared code. Deliberately unnumbered: a
    // numbered step here would renumber the pictures 2 to 6, and the numbers
    // are drawn into the images.
    img: '01b-code.png', n: null,
    h: 'מזינים את הקוד',
    p: [
      'יופיע מסך <b>"כניסת נאמני בטיחות"</b> עם שדה אחד. מקלידים את הקוד שקיבלתם מממונה הבטיחות ולוחצים <b>"כניסה"</b>.',
      '<b>הקוד נדרש בכל פתיחה של האפליקציה</b>, אז שמרו אותו במקום שנוח לכם להגיע אליו. הוא לא נמצא במדריך הזה בכוונה: אתם מקבלים אותו בהודעה נפרדת.',
      'הקוד משותף לכל הנאמנים, והוא מה ששומר שהמסך הזה לא פתוח לכל מי שנתקל בקישור. <b>אל תעבירו אותו הלאה.</b>',
    ],
    quiet: true,
  },
  {
    img: '02-name.png', n: 2,
    h: 'בוחרים את השם שלכם, פעם אחת בלבד',
    p: [
      'פותחים את הרשימה <b>"השם שלי"</b> ובוחרים את עצמכם. הטלפון זוכר, ובפעם הבאה תיכנסו ישר למסך שלכם.',
      'אם הטלפון משותף, אפשר להחליף שם באותו מקום בדיוק.',
      'למעלה יש <b>"ℹ️ איך זה עובד?"</b>, אותו הסבר קצר בתוך המערכת עצמה.',
    ],
  },
  {
    img: '03-home.png', n: null,
    h: 'וזה המסך שלכם',
    p: [
      'החודש הנוכחי, הניקוד שלכם, כמה משימות ביצעתם, וכמה מפגעים נסגרו בזכותכם.',
      'מתחת נמצאת רשימת המשימות של החודש. כל משימה פעם אחת בחודש, בזמן שנוח לכם.',
    ],
    quiet: true,
  },
  {
    img: '04-task-report.png', n: 3,
    h: 'לוחצים "דווח" ליד המשימה שביצעתם',
    p: [
      'כל משימה היא שורה. <b>"מה עושים?"</b> פותח בדיוק מה צריך לבדוק בה.',
      'עשיתם כמה משימות באותו סיור? לחצו למעלה על <b>"🧭 דווח סיור - כמה משימות בבת אחת"</b> וסמנו את כולן יחד, בטופס אחד.',
    ],
  },
  {
    img: '05-form.png', n: 4,
    h: 'כותבים איפה בדיוק',
    p: [
      '<b>"אזור / מיקום"</b> הוא שדה חובה. כתבו מקום שאפשר למצוא לפיו: <b>"אולם ייצור - מסוע 3"</b>, ולא "בייצור".',
      'התאריך ממולא אוטומטית להיום, ואפשר לשנות אותו אם הסיור היה אתמול.',
      'בתוך כל משימה יש <b>"עמדה / נקודה שנבדקה"</b>: איזה מטף, איזו דלת. לא חובה, אבל זה מה שמאפשר לעקוב.',
    ],
  },
  {
    img: '06-defect.png', n: 5,
    h: '✅ תקין או ⚠️ ליקוי, ולליקוי תמיד תמונה',
    p: [
      'הכל תקין? לוחצים <b>"✅ תקין"</b> ושולחים.',
      'משהו לא תקין? לוחצים <b>"⚠️ ליקוי"</b>, כותבים מה הליקוי, ו<b>מצלמים</b>. בלי תמונה המערכת לא תשלח. התמונה היא מה שמאפשר לתקן בלי לחזור לשאול איפה ומה.',
      'מצאתם עוד משהו באותה משימה? לוחצים <b>"+ עוד עמדה / מפגע באותה משימה"</b>, ולא צריך למלא טופס חדש.',
      'ובסוף: <b>"שלח דיווח"</b>.',
    ],
  },
  {
    img: '08-close.png', n: 6,
    h: 'סוגרים את המפגע: "📷 צלם אחרי"',
    p: [
      'הדיווחים שלכם מופיעים ב<b>"📝 הדיווחים שלי החודש"</b>. <b>תקין</b> ירוק פירושו שנסגר. <b>פתוח</b> אדום פירושו שהליקוי עדיין ממתין לטיפול.',
      'אחרי שתוקן, לוחצים <b>"📷 צלם אחרי"</b>, מצלמים את המצב החדש, והמפגע נסגר. זה גם מה שמזכה אתכם בשתי הנקודות.',
      '<b>אתם לא אחראים לתקן.</b> התפקיד שלכם: לאתר, לדווח, ולוודא שתוקן.',
    ],
  },
];

const step = (i) => {
  const s = STEPS[i];
  return `
  <section class="step${s.quiet ? ' quiet' : ''}">
    <div class="pic"><img src="${shot(s.img)}"></div>
    <div class="txt">
      <h2>${s.n ? '<span class="num">' + s.n + '</span>' : ''}${s.h}</h2>
      ${s.p.map((x) => '<p>' + x + '</p>').join('')}
    </div>
  </section>`;
};

// Pagination is explicit rather than left to page-break-inside. A step whose
// picture lands across a fold is unusable, and "avoid" is a hint the renderer
// is free to ignore — so each page is a fixed-height box and the contents are
// placed by hand. Two steps to a page, at a picture size a person can actually
// see the ringed button in.
const page = (inner) => '<div class="page">' + inner + '</div>';

const HTML = `<!doctype html><html lang="he" dir="rtl"><meta charset="utf-8">
<title>מדריך נאמני בטיחות</title>
<style>
  @page { size: A4; margin: 14mm 12mm; }
  * { box-sizing: border-box; }
  body { margin:0; font-family:'DejaVu Sans','Liberation Sans',Arial,'Noto Color Emoji',sans-serif;
         color:#1a1a1a; font-size:10.5pt; line-height:1.65; }
  h1 { font-size:21pt; margin:0 0 2mm; color:#c8102e; line-height:1.25; }
  .sub { color:#666; font-size:10pt; margin:0 0 6mm; }
  .cover { border-bottom:3px solid #c8102e; padding-bottom:5mm; margin-bottom:6mm; }

  .box { border-radius:3mm; padding:4mm 5mm; margin:0 0 5mm; }
  .link { background:#f4f7fb; border:1px solid #d6e0ec; }
  .link .url { direction:ltr; text-align:center; font-family:'DejaVu Sans Mono',monospace;
                font-size:11.5pt; font-weight:bold; color:#0b4a8f; margin:2mm 0; word-break:break-all; }
  .danger { background:#fff2f2; border:1.5px solid #e04a4a; }
  .danger b { color:#c8102e; }
  .oneline { background:#f6faf6; border:1px solid #cfe3cf; }
  .idea { background:#fff9ec; border:1px solid #e8d9ae; }

  .page { width:186mm; height:269mm; overflow:hidden; page-break-after:always; }
  .page:last-child { page-break-after:auto; }

  .step { display:grid; grid-template-columns:52mm 1fr; gap:7mm; align-items:start;
          margin-bottom:8mm; }
  .step img { width:52mm; display:block; border:1px solid #dcdcdc; border-radius:2mm; }
  .step h2 { font-size:12.5pt; margin:0 0 2mm; line-height:1.35; }
  .step p { margin:0 0 2mm; }
  .num { display:inline-block; background:#ff3b30; color:#fff; width:7mm; height:7mm;
         border-radius:50%; text-align:center; line-height:7mm; font-size:11pt;
         margin-left:2.5mm; vertical-align:middle; }
  .quiet h2 { color:#555; font-size:11pt; font-weight:normal; }

  h3 { font-size:13pt; color:#c8102e; margin:0 0 2mm; border-top:1.5px solid #eee; padding-top:4mm; }
  h3.first { border-top:none; padding-top:0; }
  ul { margin:0 0 4mm; padding-right:5mm; }
  li { margin-bottom:1.5mm; }
  .foot { margin-top:6mm; padding-top:3mm; border-top:1px solid #eee; color:#888; font-size:9pt; }
</style>

${page(`
<div class="cover">
  <h1>🦺 נאמן בטיחות: איך מדווחים מהטלפון</h1>
  <p class="sub">תעשיות תפוגן בע"מ | מערכת ניהול הבטיחות | מדריך בן שישה צעדים</p>
</div>

<div class="box link">
  <b>הקישור שלכם:</b>
  <div class="url">${LINK}</div>
  פותחים פעם אחת, ואז <b>"הוסף למסך הבית"</b>, ויש לכם אייקון בטלפון כמו כל אפליקציה.
  אין שם משתמש ואין מה להתקין. <b>יש קוד כניסה אחד</b>, תקבלו אותו בהודעה נפרדת
  ותקלידו אותו בכל פתיחה.
</div>

<div class="box danger">
  <b>🚨 סכנה מיידית: לא מדווחים, מתקשרים.</b><br>
  מגן מכונה שהוסר, נוזל על הרצפה ליד לוח חשמל, מישהו שכמעט נפגע:
  <b>מתקשרים לממונה הבטיחות מיד.</b> הדיווח במערכת בא אחר כך, לא במקום.
</div>

<div class="box oneline">
  <b>בשורה אחת:</b> פעם בחודש עוברים על המשימות שלכם באזור, מסמנים לכל עמדה
  <b>✅ תקין</b> או <b>⚠️ ליקוי</b>, ולליקוי מצרפים תמונה. זה הכל.
</div>

${step(0)}
`)}

${page(step(1) + step(2))}
${page(step(3) + step(4))}
${page(step(5) + step(6))}
${page(step(7) + `
<h3>עוד כפתור אחד שכדאי להכיר</h3>
<p>בתחתית המסך נמצא <b>"⛔ דווח כמעט ונפגע"</b>. אירוע שכמעט הסתיים ברע: מעידה
שנמנעה, עומס שכמעט נפל, רכב שכמעט פגע. אלה הדיווחים שמונעים את התאונה הבאה,
וגם עליהם מדווחים כאן.</p>
`)}

${page(`
<h3 class="first">איך צוברים ניקוד</h3>
<ul>
  <li><b>10 נקודות</b> לכל משימה שדיווחתם עליה החודש.</li>
  <li><b>2 נקודות נוספות</b> לכל מפגע שדיווחתם עליו <b>ונסגר</b>, עד 20 נקודות.</li>
  <li>מ-<b>5 משימות</b> בחודש אתם מועמדים לפרס.</li>
  <li>הניקוד מתאפס ב-1 לכל חודש ומתחילים מחדש. מי שמוביל מופיע ב<b>"🏆 מי מוביל החודש"</b>.</li>
</ul>

<h3>יש לכם המלצה לשיפור? תגידו</h3>
<div class="box idea">
  אם משהו בתהליך נראה לכם מסורבל, או שיש לכם רעיון איך לעשות אותו מהר יותר,
  פשוט יותר או בטוח יותר <b>- פנו לממונה הבטיחות והמליצו</b>. אתם נמצאים בשטח
  ורואים דברים שלא רואים מהמשרד.
  <br><br>
  זה נכון גם למערכת עצמה: שדה שחסר, מסך שלא ברור, משימה שלא מתאימה לאזור שלכם,
  בדיקה שלדעתכם צריכה להיות בקטלוג. אין צורך בטופס ואין צורך לנסח את זה יפה -
  מספיק לפנות ולהגיד.
</div>

<h3>נתקעתם?</h3>
<p>פנו לממונה הבטיחות. אם משהו במסך לא מתנהג כמו במדריך, זה שווה דיווח בפני עצמו.</p>

<p class="foot">תעשיות תפוגן בע"מ | מערכת ניהול בטיחות ואיכות סביבה | ISO 45001 / ISO 14001</p>
`)}
</html>`;

// The quick card is the same thing at a glance — one image for the WhatsApp
// group, for the people who will not open a PDF.
const CARD = `<!doctype html><html lang="he" dir="rtl"><meta charset="utf-8">
<style>
  *{box-sizing:border-box}
  body{margin:0;width:1080px;font-family:'DejaVu Sans','Liberation Sans',Arial,'Noto Color Emoji',sans-serif;
       background:#fff;color:#1a1a1a}
  .hd{background:#c8102e;color:#fff;padding:34px 40px}
  .hd h1{margin:0;font-size:46px;line-height:1.2}
  .hd p{margin:8px 0 0;font-size:22px;opacity:.9}
  .body{padding:32px 40px 40px}
  .url{direction:ltr;text-align:center;font-family:'DejaVu Sans Mono',monospace;font-size:30px;
       font-weight:bold;color:#0b4a8f;background:#f4f7fb;border:2px solid #d6e0ec;
       border-radius:14px;padding:20px;margin:0 0 14px;word-break:break-all}
  .note{text-align:center;font-size:21px;color:#555;margin:0 0 28px}
  ol{margin:0;padding-right:36px;font-size:27px;line-height:1.55}
  li{margin-bottom:15px}
  li b{color:#c8102e}
  .danger{margin-top:28px;background:#fff2f2;border:3px solid #e04a4a;border-radius:16px;
          padding:22px 26px;font-size:25px;line-height:1.5}
  .danger b{color:#c8102e}
  .score{margin-top:20px;background:#f6faf6;border:2px solid #cfe3cf;border-radius:16px;
         padding:20px 26px;font-size:23px;line-height:1.55}
  .idea{margin-top:20px;background:#fff9ec;border:2px solid #e8d9ae;border-radius:16px;
        padding:20px 26px;font-size:23px;line-height:1.55}
</style>
<div class="hd">
  <h1>🦺 נאמן בטיחות: דיווח מהטלפון</h1>
  <p>תעשיות תפוגן בע"מ | בלי התקנה, קוד כניסה אחד</p>
</div>
<div class="body">
  <div class="url">${LINK}</div>
  <p class="note">פותחים פעם אחת, מוסיפים למסך הבית, ויש לכם אייקון בטלפון</p>
  <ol>
    <li>לוחצים על <b>"🦺 דיווח נאמני בטיחות"</b>, ומקלידים את <b>הקוד</b> שקיבלתם. הקוד נדרש בכל פתיחה</li>
    <li>בוחרים את <b>השם שלכם</b>, פעם אחת, הטלפון זוכר</li>
    <li>לוחצים <b>"דווח"</b> ליד המשימה שביצעתם</li>
    <li>כותבים <b>איפה בדיוק</b>: "אולם ייצור - מסוע 3"</li>
    <li><b>✅ תקין</b> או <b>⚠️ ליקוי</b>. לליקוי <b>חובה תמונה</b></li>
    <li>תוקן? <b>"📷 צלם אחרי"</b>, והמפגע נסגר</li>
  </ol>
  <div class="danger">
    <b>🚨 סכנה מיידית: לא מדווחים, מתקשרים.</b><br>
    מתקשרים לממונה הבטיחות מיד. הדיווח במערכת בא אחר כך, לא במקום.
  </div>
  <div class="score">
    <b>ניקוד:</b> 10 לכל משימה, ועוד 2 לכל מפגע שנסגר (עד 20).
    מ-5 משימות בחודש אתם מועמדים לפרס.
  </div>
  <div class="idea">
    <b>המלצה לשיפור?</b> פנו לממונה הבטיחות והמליצו. אתם בשטח, אתם רואים
    מה מסורבל ומה אפשר לעשות אחרת.
  </div>
</div>
</html>`;

// Characters that are not on the keyboard Michael types on. They creep back in
// the moment a sentence gets rewritten, and nobody notices an em dash by
// reading. Emoji are exempt by design — they name buttons in the app.
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

// Only the text a trustee reads is checked — the CSS and the file:// image
// paths are not prose, and a stray character there is not something anyone
// sees. Run the check on what is left after the markup is taken out.
const proseOf = (html) => html
  .replace(/<style[\s\S]*?<\/style>/g, ' ')
  .replace(/<[^>]+>/g, ' ');

const offenders = (html) => KEYBOARD_ONLY
  .map(([ch, name]) => {
    const hits = proseOf(html).split(ch).length - 1;
    return hits ? name + ' (' + ch + ') x' + hits : null;
  })
  .filter(Boolean);

(async () => {
  for (const [label, html] of [['guide', HTML], ['card', CARD]]) {
    const bad = offenders(html);
    if (bad.length) {
      console.error('NON-KEYBOARD CHARACTERS in the ' + label + ': ' + bad.join(', '));
      process.exit(1);
    }
  }

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tru-guide-'));
  const pdfSrc = path.join(tmp, 'guide.html');
  const cardSrc = path.join(tmp, 'card.html');
  fs.writeFileSync(pdfSrc, HTML);
  fs.writeFileSync(cardSrc, CARD);

  const browser = await pw.chromium.launch();
  const page = await browser.newPage();

  await page.goto('file://' + pdfSrc, { waitUntil: 'load' });
  await page.waitForTimeout(600);
  // Every picture must actually be on the page. A broken <img> still lays out,
  // and the PDF would come out looking finished with empty boxes in it.
  const broken = await page.evaluate(() => [...document.images]
    .filter((i) => !i.complete || !i.naturalWidth)
    .map((i) => i.src.split('/').pop()));
  if (broken.length) { console.error('MISSING IMAGES: ' + broken.join(', ')); process.exit(1); }

  // Pages are fixed-height boxes with overflow:hidden, so content that does not
  // fit is content the PDF silently cuts off. Refuse rather than ship a guide
  // with a sentence missing off the bottom of a page.
  const over = await page.evaluate(() => [...document.querySelectorAll('.page')]
    .map((el, i) => ({ n: i + 1, over: el.scrollHeight - el.clientHeight }))
    .filter((x) => x.over > 2));
  if (over.length) {
    console.error('OVERFLOWING PAGES: ' + over.map((x) => '#' + x.n + ' by ' + x.over + 'px').join(', '));
    process.exit(1);
  }

  const pdf = path.join(HERE, 'מדריך-נאמני-בטיחות.pdf');
  await page.pdf({ path: pdf, format: 'A4', printBackground: true });
  console.log('  ✓ ' + path.basename(pdf) + '  (' + Math.round(fs.statSync(pdf).size / 1024) + ' KB)');

  // PREVIEW=<dir> also writes the pages as PNG. A PDF cannot be looked at from
  // here, and a step whose picture lands across the fold is exactly the kind of
  // thing that only shows up by looking. Each .page element is shot on its own,
  // so what the preview shows IS a page — slicing the scroll height by A4 would
  // just have drawn arbitrary lines through the document.
  if (process.env.PREVIEW) {
    const dir = process.env.PREVIEW;
    fs.mkdirSync(dir, { recursive: true });
    const pages = await page.locator('.page').all();
    for (let i = 0; i < pages.length; i++) {
      await pages[i].screenshot({ path: path.join(dir, 'page-' + (i + 1) + '.png') });
      console.log('    preview page-' + (i + 1) + '.png');
    }
  }

  await page.goto('file://' + cardSrc, { waitUntil: 'load' });
  await page.waitForTimeout(300);
  const card = path.join(HERE, 'כרטיס-מהיר.png');
  await page.locator('body').screenshot({ path: card });
  console.log('  ✓ ' + path.basename(card) + '  (' + Math.round(fs.statSync(card).size / 1024) + ' KB)');

  await browser.close();
})();
