const pptxgen = require("pptxgenjs");
const React = require("react");
const RDS = require("react-dom/server");
const sharp = require("sharp");
const gi = require("react-icons/gi");
const fa = require("react-icons/fa6");

// גוונים בהירים (מיכאל 17/11/2026: "הרבה רקעים שחורים, צריך צבעים יותר טובים לעיניים"): כחול בינוני במקום כחול לילה,
// שקפי הפתיחה, החזון והסיום על רקע תכלת בהיר. navy רק לטקסט, לא לרקע.
const COL = {
  dark: "1F608C", deep: "3A84B5", gold: "E09A2F", orange: "B86A0B", red: "C0453B", ink: "1A1A1A", green: "53842B",
  white: "FFFFFF", tint: "EFF2F5", ice: "DCE8F2", mute: "7F8C99", soft: "5F7385", accent: "1F608C", navy: "14485F",
  sky: "5BA4CF", pale: "EAF2F8",
};
const FONT = "Arial";
const R = { rtlMode: true, align: "right", fontFace: FONT, isTextBox: true };

async function icon(Comp, color, size = 512) {
  const svg = RDS.renderToStaticMarkup(React.createElement(Comp, { color: "#" + color, size }));
  return "image/png;base64," + (await sharp(Buffer.from(svg)).png().toBuffer()).toString("base64");
}

(async () => {
  const pres = new pptxgen();
  pres.layout = "LAYOUT_WIDE";
  pres.rtlMode = true;
  pres.title = "מתפוח אדמה למקפיא";
  pres.theme = { headFontFace: FONT, bodyFontFace: FONT };
  pres.defineSlideMaster({ title: "DARK", background: { color: COL.pale },
    slideNumber: { x: 0.4, y: 6.95, w: 0.6, h: 0.35, color: COL.soft, fontFace: FONT, fontSize: 11 } });
  pres.defineSlideMaster({ title: "LIGHT", background: { color: COL.white },
    slideNumber: { x: 0.4, y: 6.95, w: 0.6, h: 0.35, color: COL.mute, fontFace: FONT, fontSize: 11 } });
  // רקע מדורג (fx.py הופך כל צורה ששמה hdr_ למילוי מדורג)
  const bg = (s) => s.addShape(pres.ShapeType.rect, { x: 0, y: 0, w: 13.333, h: 7.5, fill: { color: COL.pale }, line: { color: COL.pale }, objectName: "hdr_bg" });

  const I = {
    potato: await icon(gi.GiPotato, COL.gold),
    fries: await icon(gi.GiFrenchFries, COL.gold),
    friesRed: await icon(gi.GiFrenchFries, COL.red),
    snow: await icon(fa.FaSnowflake, COL.sky),
    scroll: await icon(gi.GiTiedScroll, COL.navy),
    steam: await icon(gi.GiSteam, COL.white),
    steamGold: await icon(gi.GiSteam, COL.gold),
    drop: await icon(fa.FaDroplet, COL.white),
    gauge: await icon(fa.FaGaugeHigh, COL.white),
    eye: await icon(fa.FaEye, COL.white),
    temp: await icon(fa.FaTemperatureHigh, COL.white),
    snowW: await icon(fa.FaSnowflake, COL.white),
    seed: await icon(fa.FaSeedling, COL.white),
    box: await icon(fa.FaBoxOpen, COL.white),
    mask: await icon(gi.GiGasMask, COL.red),
    q: await icon(fa.FaQuestion, COL.navy),
    teacher: await icon(gi.GiTeacher, COL.gold),
    teacherW: await icon(gi.GiTeacher, COL.white),
    user: await icon(fa.FaUserShield, COL.white),
    flag: await icon(fa.FaFlag, COL.white),
    eyeGold: await icon(fa.FaEye, COL.navy),
    check: await icon(fa.FaCircleCheck, COL.white),
  };

  function title(s, t, sub) {
    s.addShape(pres.ShapeType.rect, { x: 0, y: 0, w: 13.333, h: 1.25, fill: { color: COL.dark }, line: { color: COL.dark }, objectName: "hdr_band" });
    s.addText(t, { ...R, x: 3.4, y: 0.15, w: 9.4, h: 0.95, fontSize: 32, bold: true, color: COL.white, margin: 0, valign: "middle", fit: "shrink", objectName: "auto1r_title" });
    if (s._m) method(s, s._m, true);
    if (sub) s.addText(sub, { ...R, x: 3.4, y: 1.38, w: 9.4, h: 0.7, fontSize: 17, color: COL.accent, margin: 0, valign: "top", objectName: "auto2b_sub" });
  }
  const titleDark = title;
  // התגית יושבת על פס הכותרת, ולכן מצוירת אחריו: method שומר, title מצייר (בשקף בלי פס: now)
  function method(s, t, now) {
    if (!now) { s._m = t; return; }
    s.addText(t, { ...R, align: "center", shape: pres.ShapeType.roundRect, rectRadius: 0.15,
      x: 0.5, y: 0.4, w: 2.6, h: 0.45, fontSize: 12, bold: true, color: COL.navy, fill: { color: COL.white } });
  }
  // המקורות ירדו מהשקפים (מיכאל 17/11/2026) ועברו להערות הדובר של כל שקף.
  function plant(s, t) {
    s.addShape(pres.ShapeType.roundRect, { x: 0.5, y: 1.4, w: 2.6, h: 0.45, rectRadius: 0.15, fill: { color: COL.green }, line: { color: COL.green } });
    s.addImage({ data: I.check, x: 2.7, y: 1.47, w: 0.3, h: 0.3 });
    s.addText(t, { ...R, align: "center", x: 0.55, y: 1.4, w: 2.1, h: 0.45, fontSize: 13, bold: true, color: COL.white, margin: 0, valign: "middle" });
  }
  function box(s, runs, o) {
    s.addText(runs, { ...R, shape: pres.ShapeType.roundRect, rectRadius: 0.2, margin: 18, valign: "middle", ...o });
  }

  // ===== 1. פתיחה =====
  let s = pres.addSlide({ masterName: "DARK" });
  bg(s);
  s.addImage({ data: I.potato, x: 7.4, y: 0.7, w: 1.8, h: 1.8, objectName: "auto1b_a" });
  s.addImage({ data: I.fries, x: 5.75, y: 0.7, w: 1.8, h: 1.8, objectName: "auto2b_b" });
  s.addImage({ data: I.snow, x: 4.1, y: 0.8, w: 1.6, h: 1.6, objectName: "auto3b_c" });
  s.addText("מתפוח אדמה למקפיא", { ...R, align: "center", x: 1.0, y: 2.9, w: 11.3, h: 1.2, fontSize: 54, bold: true, color: COL.navy, objectName: "auto4b_t" });
  s.addText("הסוד של הצ'יפס הקפוא, ב-10 דקות", { ...R, align: "center", x: 1.0, y: 4.0, w: 11.3, h: 0.7, fontSize: 26, bold: true, color: COL.orange, objectName: "auto5b_s" });
  ["קולפים.", "חותכים.", "מטגנים.", "מקפיאים."].forEach((w, i) => {
    s.addText(w, { ...R, align: "center", x: 9.15 - i * 2.75, y: 4.85, w: 2.5, h: 0.75, fontSize: 28, bold: true, color: i === 3 ? COL.sky : COL.accent, objectName: "auto" + (6 + i) + "r_k" });
  });
  s.addText("מיכאל פרייליך | קורס מדריכי בטיחות", { ...R, align: "center", x: 1.0, y: 6.1, w: 11.3, h: 0.5, fontSize: 16, color: COL.soft, objectName: "auto10b_m" });
  s.addNotes("פתיחה (30 שניות). לעמוד מול הכיתה ולשתוק 3 שניות עד שהשקף מסיים לעלות. אחר כך: 'במפעל שבו אני עובד, תפוח אדמה הופך לצ'יפס קפוא בתוך פחות משעה. עד סוף ההדרכה תדעו בדיוק איך.' (לא לנקוב בזמן אם לא בדקת מול המפעל.) בלי קליק: הכול נכנס לבד ברצף, כמו סרטון (בערך 5 שניות). לחכות שהמילה האחרונה תנחת ורק אז לדבר. שיטה: פתיחה שיוצרת סקרנות (Hook), בתמונה ובשתיקה.");

  // ===== 2. שאלת הפתעה: מהירות =====
  s = pres.addSlide({ masterName: "LIGHT" });
  method(s, "שלב 1: פתיח וואו");
  title(s, "שאלת הפתעה", "במפעל לא חותכים עם סכין ביד. תפוח האדמה נורה אל הסכינים בצינור מים. באיזו מהירות?");
  ["5 קמ\"ש", "20 קמ\"ש", "60 קמ\"ש", "150 קמ\"ש"].forEach((o, i) => {
    s.addText(o, { ...R, align: "center", shape: pres.ShapeType.roundRect, rectRadius: 0.2,
      x: 9.6 - i * 3.0, y: 2.3, w: 2.6, h: 1.5, fontSize: 30, bold: true, color: COL.ink, fill: { color: COL.tint } });
  });
  box(s, [
    { text: "בערך 45 עד 65 קמ\"ש, כמו מכונית בעיר", options: { bold: true, fontSize: 24, color: COL.white, breakLine: true } },
    { text: "זרם המים מאיץ את תפוח האדמה, מיישר אותו ומטיח אותו ברשת סכינים קבועה. יוצאים מקלות צ'יפס שלמים בבת אחת.", options: { fontSize: 16, color: COL.white } },
  ], { x: 5.0, y: 4.3, w: 7.7, h: 1.9, fill: { color: COL.dark }, objectName: "ani1_ans" });
  s.addImage({ path: __dirname + "/clip-cut.gif", x: 0.6, y: 4.3, w: 4.18, h: 1.9, objectName: "ani1_clip" });
  s.addNotes("להצביע עם הידיים: מי חושב 5? 20? 60? 150? (20 שניות). רק אחרי ההצבעה, קליק לתשובה. עם התשובה עולה גם קטע אנימציה קצר שמתנגן לבד בלולאה: תפוח האדמה נורה בצינור ויוצא כמקלות. שיטה: שאלה מקדימה שיוצרת פער סקרנות. מבוגרים זוכרים יותר אחרי שהתחייבו לניחוש. המקור: פטנטים של מערכות חיתוך במים (Hydro cutting) נותנים 40 עד 60 רגל לשנייה, כלומר 12 עד 18 מטר לשנייה. מקור הנתונים: פטנטים של מערכות חיתוך במים (Hydro cutting): 12 עד 18 מטר לשנייה.");

  // ===== 3. הצגה עצמית =====
  s = pres.addSlide({ masterName: "LIGHT" });
  method(s, "שלב 2: הצגה עצמית");
  title(s, "מי אני");
  s.addShape(pres.ShapeType.roundRect, { x: 7.0, y: 1.6, w: 5.7, h: 4.9, rectRadius: 0.2, fill: { color: COL.dark }, line: { color: COL.dark }, objectName: "ani1_bg" });
  s.addShape(pres.ShapeType.ellipse, { x: 9.15, y: 1.95, w: 1.4, h: 1.4, fill: { color: COL.deep }, line: { color: COL.deep }, objectName: "ani1_c" });
  s.addImage({ data: I.user, x: 9.47, y: 2.27, w: 0.76, h: 0.76, objectName: "ani1_i" });
  s.addText([
    { text: "מיכאל פרייליך", options: { bold: true, fontSize: 30, color: COL.white, breakLine: true } },
    { text: "מנהל בטיחות ואיכות סביבה", options: { fontSize: 22, color: COL.white, breakLine: true } },
    { text: "תפוגן, מפעל לצ'יפס קפוא", options: { fontSize: 22, color: COL.ice } },
  ], { ...R, align: "center", x: 7.2, y: 3.6, w: 5.3, h: 2.6, valign: "top", objectName: "ani1_tx" });
  [["את הקו הזה אני רואה כל יום", I.eye], ["אני אחראי שמי שעובד בו יחזור הביתה בשלום", I.user]].forEach(([t, img], i) => {
    const y = 2.0 + i * 2.1;
    s.addShape(pres.ShapeType.roundRect, { x: 0.6, y, w: 6.0, h: 1.7, rectRadius: 0.2, fill: { color: COL.tint }, line: { color: COL.tint }, objectName: "ani2_b" + i });
    s.addShape(pres.ShapeType.ellipse, { x: 0.9, y: y + 0.4, w: 0.9, h: 0.9, fill: { color: COL.dark }, line: { color: COL.dark }, objectName: "ani2_c" + i });
    s.addImage({ data: img, x: 1.1, y: y + 0.6, w: 0.5, h: 0.5, objectName: "ani2_i" + i });
    s.addText(t, { ...R, x: 2.0, y: y + 0.15, w: 4.4, h: 1.4, fontSize: 21, bold: true, color: COL.ink, valign: "middle", objectName: "ani2_t" + i });
  });
  s.addNotes("20 שניות בלבד. קליק: הכרטיס שלך. שם ותפקיד. קליק: למה להקשיב לי. שיטה: הצגה עצמית שבונה סמכות מקצועית (שלב 02 במבנה ההרצאה). הקהל צריך לדעת למה דווקא אתה מדבר על זה, לא קורות חיים.");

  // ===== 4. החזון =====
  s = pres.addSlide({ masterName: "DARK" });
  bg(s);
  method(s, "שלב 3: החזון", true);
  s.addShape(pres.ShapeType.ellipse, { x: 5.9, y: 1.2, w: 1.5, h: 1.5, fill: { color: COL.gold }, line: { color: COL.gold } });
  s.addImage({ data: I.eyeGold, x: 6.27, y: 1.57, w: 0.76, h: 0.76 });
  s.addText("אחרי ההדרכה הזו, לא תסתכלו יותר על צלחת צ'יפס אותו דבר.", { ...R, align: "center", x: 1.2, y: 3.0, w: 10.9, h: 1.9, fontSize: 40, bold: true, color: COL.navy, objectName: "auto1b_v" });
  s.addText("כי תדעו כמה ידיים, מכונות ואנשי בטיחות עומדים מאחורי כל מקל.", { ...R, align: "center", x: 1.2, y: 5.0, w: 10.9, h: 0.8, fontSize: 22, bold: true, color: COL.orange, objectName: "auto2b_v" });
  s.addNotes("לומר את החזון לאט, ולעצור. שני המשפטים עולים לבד מלמטה, בלי קליק. שיטה: חזון (שלב 03 במבנה ההרצאה). חזון אומר לקהל מה ירגישו וידעו בסוף, לא רק על מה מדברים.");

  // ===== 5. המטרות =====
  s = pres.addSlide({ masterName: "LIGHT" });
  method(s, "שלב 4: מטרות");
  title(s, "3 מטרות ל-10 דקות", "בסוף נבדוק יחד אם הגענו");
  [["1", "להכיר את 8 התחנות בקו הייצור"], ["2", "להבין למה כל שלב קיים"], ["3", "לזהות את הסיכון הגדול בקו"]].forEach(([n, t], i) => {
    const x = 8.7 - i * 4.05;
    s.addShape(pres.ShapeType.roundRect, { x, y: 2.1, w: 3.75, h: 3.9, rectRadius: 0.2, fill: { color: i === 2 ? COL.red : COL.dark }, line: { color: i === 2 ? COL.red : COL.dark }, objectName: "ani" + (i + 1) + "_b" });
    s.addText(n, { ...R, align: "center", shape: pres.ShapeType.ellipse, x: x + 1.2, y: 2.45, w: 1.35, h: 1.35, fontSize: 44, bold: true, color: COL.navy, fill: { color: COL.gold }, valign: "middle", objectName: "ani" + (i + 1) + "_n" });
    s.addText(t, { ...R, align: "center", x: x + 0.2, y: 4.1, w: 3.35, h: 1.6, fontSize: 22, bold: true, color: COL.white, valign: "middle", objectName: "ani" + (i + 1) + "_t" });
  });
  s.addNotes("קליק לכל מטרה. לקרוא אותה בקול. שיטה: מטרות ברורות (שלב 04 במבנה ההרצאה). מבוגר מקשיב יותר כשהוא יודע מה ירוויח. בשקף 11 בודקים אם הושגו.");

  // ===== 4. המפה: 8 תחנות =====
  s = pres.addSlide({ masterName: "LIGHT" });
  method(s, "קודם התמונה הגדולה");
  title(s, "המסלול: 8 תחנות בקו הייצור", "לפני הפרטים, המפה");
  const steps = [
    [I.seed, "קבלה ושטיפה"], [I.steam, "קילוף בקיטור"], [I.gauge, "חיתוך בזרם מים"], [I.eye, "מיון אופטי"],
    [I.drop, "חליטה במים חמים"], [I.temp, "טיגון מקדים"], [I.snowW, "הקפאה מהירה"], [I.box, "אריזה ואחסון"],
  ];
  steps.forEach(([img, label], i) => {
    const row = Math.floor(i / 4), col = i % 4;
    const x = 10.0 - col * 3.05, y = 2.1 + row * 2.4, n = "ani" + (i + 1) + "_s";
    const fill = i === 6 ? COL.sky : i === 5 ? COL.red : COL.dark;
    s.addShape(pres.ShapeType.roundRect, { x, y, w: 2.7, h: 2.0, rectRadius: 0.2, fill: { color: fill }, line: { color: fill }, objectName: n + "_bg" });
    s.addImage({ data: img, x: x + 1.0, y: y + 0.25, w: 0.7, h: 0.7, objectName: n + "_ic" });
    s.addText((i + 1) + ". " + label, { ...R, align: "center", x: x + 0.1, y: y + 1.1, w: 2.5, h: 0.6, fontSize: 17, bold: true, color: COL.white, objectName: n + "_tx" });
  });
  plant(s, "בכל תחנה: בדיקה");
  // סרטון אמיתי של קו צ'יפס (מיכאל בחר, 17/11/2026). נפתח ביוטיוב בלחיצה, דורש אינטרנט בכיתה.
  s.addText([{ text: "\u25B6  לראות קו אמיתי בסרטון", options: { hyperlink: { url: "https://www.youtube.com/watch?v=POqvMgQi-1U", tooltip: "How Millions of Frozen French Fries are Made in Factory" }, color: COL.white, bold: true } }],
    { ...R, align: "center", shape: pres.ShapeType.roundRect, rectRadius: 0.2, x: 4.67, y: 6.7, w: 4.0, h: 0.55, fontSize: 16, fill: { color: COL.red }, valign: "middle" });
  s.addNotes("כל קליק מוסיף תחנה (40 שניות לכל השקף). רק לתת שם, לא להסביר. אחרי התחנה השמינית: לחיצה על הכפתור האדום פותחת ביוטיוב סרטון אמיתי של קו צ'יפס. להראות 20 עד 30 שניות בלבד, לסגור את הדפדפן ולחזור למצגת. לפני ההדרכה: לבדוק שיש אינטרנט בכיתה ולפתוח את הסרטון פעם אחת כדי לדלג על הפרסומת. אם אין אינטרנט, מדלגים. שיטה: מארגן מקדים (Advance Organizer). מבוגר רוצה לדעת לאן ההדרכה הולכת לפני הפרטים. בהדרכת בטיחות: קודם שלבי העבודה, אחר כך הסיכון בכל שלב. אפשר להוסיף: 'כל תחנה כזו קיימת אצלנו במפעל'. מסר שתול: התגית הירוקה. לא להסביר אותה, רק לומר חצי משפט כמו: וגם פה, בודקים.");

  // ===== 5. הדגמה: קילוף =====
  s = pres.addSlide({ masterName: "LIGHT" });
  method(s, "ניחוש והשוואה");
  titleDark(s, "כמה זמן לוקח לכם לקלף תפוח אדמה?", "בבית, עם סכין קילוף. ובמפעל?");
  s.addImage({ data: I.potato, x: 9.3, y: 2.1, w: 3.0, h: 3.0 });
  box(s, [
    { text: "בבית", options: { bold: true, fontSize: 24, color: COL.accent, breakLine: true } },
    { text: "סכין קילוף, דקה לתפוח אחד", options: { fontSize: 20, color: COL.ink } },
  ], { x: 4.9, y: 2.1, w: 4.0, h: 1.8, fill: { color: COL.ice }, objectName: "ani1_home" });
  box(s, [
    { text: "במפעל", options: { bold: true, fontSize: 24, color: COL.accent, breakLine: true } },
    { text: "סיר לחץ ענק עם קיטור. משחררים את הלחץ בבת אחת, הקליפה מתנפחת ומתקלפת, ומברשות מורידות אותה.", options: { fontSize: 18, color: COL.ink } },
  ], { x: 0.6, y: 2.1, w: 4.0, h: 3.0, fill: { color: COL.ice }, objectName: "ani2_fac" });
  s.addImage({ path: __dirname + "/clip-peel.gif", x: 0.6, y: 5.25, w: 3.3, h: 1.5, objectName: "ani2_clip" });
  s.addText("קיטור בלחץ של 6 עד 12 בר, לשניות ספורות", { ...R, x: 4.1, y: 5.7, w: 5.2, h: 0.6, fontSize: 18, bold: true, color: COL.accent, objectName: "ani3_tx" });
  plant(s, "נמדד בשניות");
  s.addNotes("לשאול את הכיתה: כמה זמן לוקח לכם לקלף תפוח אדמה אחד בבית? לתת ל-2 או 3 אנשים לענות (15 שניות). קליק: 'בבית'. ואז: ובמפעל, כשצריך לקלף טונות בשעה? קליק: 'במפעל', ויחד איתו עולה קטע אנימציה שמתנגן לבד: הלחץ עולה, משתחרר, והקליפה עפה. קליק: השורה התחתונה. שיטה: ניחוש והשוואה בין המוכר לחדש. הקהל מתחיל ממה שהוא עושה בבית, ולכן הפער מול המפעל נחרט. נתון להוסיף בעל פה: כל שנייה נוספת בקיטור מורידה עוד חצי אחוז מתפוח האדמה לפסולת, ולכן מכוונים את הזמן בדיוק. השוואה: צמיג של רכב מנופח בערך ל-2 בר, כלומר הלחץ בקולף פי 3 עד 6. אם יש לך את הנתון של הקולף אצלנו, להחליף בו. מסר שתול: התגית הירוקה. לא להסביר אותה, רק לומר חצי משפט כמו: וגם פה, בודקים. מקור הנתונים: FreshPlaza, Evolution of potato peeling; PotatoPro.");

  // ===== 6. שאלה מנחה: למה חולטים =====
  s = pres.addSlide({ masterName: "LIGHT" });
  method(s, "שאלה מנחה");
  title(s, "למה חולטים את הצ'יפס במים חמים?", "רמז: מה קורה לתפוח אדמה חתוך שנשאר על השיש?");
  s.addShape(pres.ShapeType.ellipse, { x: 5.4, y: 2.1, w: 2.5, h: 2.5, fill: { color: COL.gold }, line: { color: COL.gold } });
  s.addImage({ data: I.q, x: 5.95, y: 2.65, w: 1.4, h: 1.4 });
  box(s, [
    { text: "כדי שלא ישחים ושיהיה רך בפנים", options: { bold: true, fontSize: 28, color: COL.red, breakLine: true } },
    { text: "החליטה (בלנשינג) במים של 60 עד 85 מעלות מנטרלת את האנזימים שמשחירים את תפוח האדמה, שוטפת סוכרים מהפנים כדי שהצבע יהיה אחיד, ומבשלת את הפנים מראש.", options: { fontSize: 19, color: COL.ink } },
  ], { x: 0.6, y: 4.9, w: 12.1, h: 1.75, fill: { color: COL.tint }, objectName: "ani1_ans" });
  plant(s, "נבדק בטמפרטורה");
  s.addNotes("לשאול ולחכות 5 שניות בשקט. לא למהר לענות. אם אין תשובה, הרמז על השיש (תפוח חתוך משחיר). קליק לתשובה. שיטה: שאלה מנחה (סוקרטית). הקהל מגיע לתשובה בעצמו ולכן זוכר. בבטיחות: 'למה לדעתכם יש פה מעקה?' עדיף על 'חובה מעקה'. מסר שתול: התגית הירוקה. לא להסביר אותה, רק לומר חצי משפט כמו: וגם פה, בודקים. מקור הנתונים: PotatoPro, Frozen French Fries; Idaho Potato Commission.");

  // ===== 7. שלושה מספרים =====
  s = pres.addSlide({ masterName: "LIGHT" });
  method(s, "מנות קטנות");
  title(s, "טיגון והקפאה: 3 מספרים בלבד", "לא 20 נתונים. שלושה.");
  [["175°", "מעלות בשמן, בטיגון המקדים"], ["\u202A30-60\u202C", "שניות בלבד. לא עד הסוף"], ["\u202A-18°\u202C", "מעלות לפחות, באחסון ובהובלה"]].forEach(([n, l], i) => {
    s.addText([
      { text: n, options: { fontSize: 64, bold: true, color: i === 2 ? COL.accent : COL.red, breakLine: true } },
      { text: l, options: { fontSize: 18, color: COL.ink } },
    ], { ...R, align: "center", shape: pres.ShapeType.roundRect, rectRadius: 0.2, x: 8.9 - i * 4.1, y: 2.2, w: 3.8, h: 3.0,
      fill: { color: i === 2 ? COL.ice : COL.tint }, valign: "middle", objectName: "ani" + (i + 1) + "_st" });
  });
  s.addText("ההקפאה: אוויר של מינוס 35 עד 40 מעלות, וכל צ'יפס קופא לחוד (IQF). לכן הם לא נדבקים בשקית.", { ...R, x: 0.6, y: 5.45, w: 12.1, h: 0.6, fontSize: 18, color: COL.mute, objectName: "ani4_tx" });
  plant(s, "מודדים, לא מנחשים");
  s.addNotes("קליק לכל מספר, ולעצור אחרי כל אחד. שיטה: חלוקה למנות קטנות (Chunking). הזיכרון הקצר מחזיק מעט פריטים, ולכן 3 מספרים יישארו ו-20 לא. בבטיחות: 3 כללים לעבודה בגובה, לא שקף עם 15. הערה: הטמפרטורה והזמן משתנים לפי עובי החיתוך והמוצר; אם יש לך את הנתונים של הקו במפעל, להחליף בהם. קליק אחרון: המיתוס. לשאול קודם: מי חשב שהצ'יפס בשקית עוד לא טוגן? ורק אז קליק (שיטה: שבירת מיתוס, אמונה שמופרכת נחרטת חזק יותר). נתון בונוס: בטיגון המקדים הצ'יפס סופג 4 עד 8 אחוז שמן. מסר שתול: התגית הירוקה. לא להסביר אותה, רק לומר חצי משפט כמו: וגם פה, בודקים. מקור הנתונים: PotatoPro, Turnkey frozen french fry line; יצרני מקפיאי IQF.");
  s.addText([
    { text: "ומיתוס: ", options: { bold: true, color: COL.red } },
    { text: "\"צ'יפס קפוא עוד לא טוגן\"? הוא כבר טוגן פעם אחת במפעל. בבית מטגנים בפעם השנייה.", options: { color: COL.ink, bold: true } },
  ], { ...R, x: 0.6, y: 6.15, w: 12.1, h: 0.6, fontSize: 18, objectName: "ani5_myth" });

  // ===== 8. תרחיש: אמוניה =====
  s = pres.addSlide({ masterName: "LIGHT" });
  method(s, "תרחיש: מה תעשו?");
  titleDark(s, "ריח חריף ליד מנהרת ההקפאה. מה עושים?");
  s.addImage({ data: I.mask, x: 0.9, y: 2.0, w: 2.4, h: 2.4 });
  [["א", "נכנסים לבדוק מאיפה הריח"], ["ב", "מתרחקים נגד כיוון הרוח, מודיעים ומפעילים את נוהל החירום"], ["ג", "פותחים חלון וממשיכים לעבוד"]].forEach(([l, t], i) => {
    s.addText(l + ". " + t, { ...R, shape: pres.ShapeType.roundRect, rectRadius: 0.15, x: 3.9, y: 1.5 + i * 1.05, w: 8.8, h: 0.85,
      fontSize: 21, color: COL.ink, fill: { color: COL.tint }, margin: 14, valign: "middle" });
  });
  box(s, [
    { text: "ב. ", options: { bold: true, color: COL.white } },
    { text: "במפעלי הקפאה מקררים לרוב באמוניה. היא רעילה ופוגעת בנשימה ובעיניים. לא נכנסים לבדוק לבד: מתרחקים, מודיעים, ונכנס רק צוות מוסמך עם מיגון מתאים, לפי נוהל המפעל.", options: { color: COL.white } },
  ], { x: 0.6, y: 4.85, w: 12.1, h: 1.8, fill: { color: COL.red }, fontSize: 19, objectName: "ani1_ans" });
  plant(s, "עוצרים ובודקים");
  s.addNotes("כאן נכנס הצד של מדריך הבטיחות. הצבעה: א, ב או ג (20 שניות). קליק לתשובה. שיטה: תרחיש וקבלת החלטה (Scenario-based learning). העובד מתרגל החלטה ולא רק שומע כלל, וזה הכי קרוב לשטח בלי לצאת מהכיתה. אם רוצים לחזק: 'מי יודע איפה נקודת הכינוס אצלנו?' מסר שתול: התגית הירוקה. לא להסביר אותה, רק לומר חצי משפט כמו: וגם פה, בודקים.");

  // ===== 11. חזרה =====
  s = pres.addSlide({ masterName: "LIGHT" });
  method(s, "שליפה מהזיכרון");
  titleDark(s, "3 שאלות, 3 שניות לכל אחת");
  [["באיזו מהירות תפוח האדמה פוגש את הסכין?", "כ-60 קמ\"ש"], ["למה חולטים לפני הטיגון?", "שלא ישחים"], ["כמה פעמים טוגן הצ'יפס שאכלתם?", "פעמיים"]].forEach(([q, a], i) => {
    const y = 1.75 + i * 1.65;
    s.addText(q, { ...R, shape: pres.ShapeType.roundRect, rectRadius: 0.15, x: 4.3, y, w: 8.4, h: 1.3, fontSize: 22, color: COL.ink, fill: { color: COL.tint }, margin: 16, valign: "middle" });
    s.addText(a, { ...R, align: "center", shape: pres.ShapeType.roundRect, rectRadius: 0.15, x: 0.6, y, w: 3.4, h: 1.3, fontSize: 26, bold: true, color: COL.navy, fill: { color: COL.gold }, valign: "middle", objectName: "ani" + (i + 1) + "_a" });
  });
  s.addNotes("לשאול כל שאלה בקול, לתת לכיתה לענות ביחד, ורק אז קליק לתשובה. שיטה: שליפה מהזיכרון (Retrieval practice). לשלוף מידע מחזק אותו יותר מלשמוע אותו שוב. זו גם בדיקה של רמה 2 במודל קירקפטריק: האם למדו.");

  // ===== 12. סיום: חזרה לתפוח האדמה =====
  s = pres.addSlide({ masterName: "DARK" });
  bg(s);
  s.addImage({ data: I.potato, x: 5.77, y: 0.75, w: 1.8, h: 1.8, objectName: "auto1b_p" });
  s.addText("התחלנו עם תפוח אדמה אחד.", { ...R, align: "center", x: 1.0, y: 2.75, w: 11.3, h: 0.8, fontSize: 30, color: COL.soft, objectName: "auto2b_a" });
  s.addText("עד שהגיע למקפיא, בדקו אותו בכל תחנה.", { ...R, align: "center", x: 0.8, y: 3.55, w: 11.7, h: 1.1, fontSize: 44, bold: true, color: COL.navy, objectName: "auto3b_b" });
  s.addText("כך שומרים גם על אנשים: בודקים בכל שלב, כדי שכולם יחזרו הביתה.", { ...R, align: "center", x: 0.8, y: 4.85, w: 11.7, h: 0.8, fontSize: 26, bold: true, color: COL.orange, objectName: "auto4b_c" });
  s.addText("תודה | מיכאל פרייליך", { ...R, align: "center", x: 1.0, y: 6.2, w: 11.3, h: 0.5, fontSize: 16, color: COL.soft, objectName: "auto5b_d" });
  s.addNotes("סיום (20 שניות). שלושת המשפטים עולים לבד, בלי קליק. לומר אותם לאט, ולשתוק אחרי האחרון. שיטה: סגירת מעגל, חוזרים לתפוח האדמה משקף הפתיחה, וזה גם פורע את התגית הירוקה שחזרה בשקפים 6 עד 10 ('בכל תחנה: בדיקה').");

  await pres.writeFile({ fileName: "fries-raw.pptx" });
  console.log("ok");
})();
