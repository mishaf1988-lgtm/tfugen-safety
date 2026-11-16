const pptxgen = require("pptxgenjs");
const React = require("react");
const RDS = require("react-dom/server");
const sharp = require("sharp");
const gi = require("react-icons/gi");
const fa = require("react-icons/fa6");

// קפוא (כחול לילה וקרח) + צ'יפס (זהב) + סכנה (אדום)
const COL = {
  dark: "0E2A47", deep: "1C4268", gold: "F4B400", red: "D7263D", ink: "10243A", green: "2E8B57",
  white: "FFFFFF", tint: "FDF1C7", ice: "E3F1FB", mute: "5B6F84", soft: "9FC3E3",
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
  pres.defineSlideMaster({ title: "DARK", background: { color: COL.dark },
    slideNumber: { x: 0.4, y: 6.95, w: 0.6, h: 0.35, color: COL.soft, fontFace: FONT, fontSize: 11 } });
  pres.defineSlideMaster({ title: "LIGHT", background: { color: COL.white },
    slideNumber: { x: 0.4, y: 6.95, w: 0.6, h: 0.35, color: COL.mute, fontFace: FONT, fontSize: 11 } });

  const I = {
    potato: await icon(gi.GiPotato, COL.gold),
    fries: await icon(gi.GiFrenchFries, COL.gold),
    friesRed: await icon(gi.GiFrenchFries, COL.red),
    snow: await icon(fa.FaSnowflake, COL.soft),
    scroll: await icon(gi.GiTiedScroll, COL.dark),
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
    q: await icon(fa.FaQuestion, COL.dark),
    teacher: await icon(gi.GiTeacher, COL.gold),
    user: await icon(fa.FaUserShield, COL.white),
    flag: await icon(fa.FaFlag, COL.white),
    eyeGold: await icon(fa.FaEye, COL.dark),
    check: await icon(fa.FaCircleCheck, COL.white),
  };

  function title(s, t, sub) {
    s.addText(t, { ...R, x: 0.6, y: 0.4, w: 12.1, h: 0.9, fontSize: 36, bold: true, color: COL.ink, margin: 0 });
    if (sub) s.addText(sub, { ...R, x: 0.6, y: 1.25, w: 12.1, h: 0.5, fontSize: 18, color: COL.mute, margin: 0 });
  }
  function titleDark(s, t, sub) {
    s.addText(t, { ...R, x: 0.6, y: 0.4, w: 12.1, h: 0.9, fontSize: 34, bold: true, color: COL.white, margin: 0 });
    if (sub) s.addText(sub, { ...R, x: 0.6, y: 1.25, w: 12.1, h: 0.5, fontSize: 18, color: COL.soft, margin: 0 });
  }
  function method(s, t, dark) {
    s.addText(t, { ...R, align: "center", shape: pres.ShapeType.roundRect, rectRadius: 0.15,
      x: 0.5, y: 0.45, w: 2.6, h: 0.45, fontSize: 12, bold: true,
      color: dark ? COL.dark : COL.white, fill: { color: dark ? COL.gold : COL.dark } });
  }
  function src(s, t, dark) {
    s.addText("מקור: " + t, { ...R, x: 1.2, y: 6.95, w: 11.5, h: 0.35, fontSize: 10, color: dark ? COL.soft : COL.mute, margin: 0 });
  }
  function plant(s, t) {
    s.addShape(pres.ShapeType.roundRect, { x: 0.5, y: 1.0, w: 2.6, h: 0.45, rectRadius: 0.15, fill: { color: COL.green }, line: { color: COL.green } });
    s.addImage({ data: I.check, x: 2.7, y: 1.07, w: 0.3, h: 0.3 });
    s.addText(t, { ...R, align: "center", x: 0.55, y: 1.0, w: 2.1, h: 0.45, fontSize: 13, bold: true, color: COL.white, margin: 0, valign: "middle" });
  }
  function box(s, runs, o) {
    s.addText(runs, { ...R, shape: pres.ShapeType.roundRect, rectRadius: 0.2, margin: 18, valign: "middle", ...o });
  }

  // ===== 1. פתיחה =====
  let s = pres.addSlide({ masterName: "DARK" });
  s.addImage({ data: I.potato, x: 7.4, y: 0.7, w: 1.8, h: 1.8, objectName: "ani1_a" });
  s.addImage({ data: I.fries, x: 5.75, y: 0.7, w: 1.8, h: 1.8, objectName: "ani1_b" });
  s.addImage({ data: I.snow, x: 4.1, y: 0.8, w: 1.6, h: 1.6, objectName: "ani1_c" });
  s.addText("מתפוח אדמה למקפיא", { ...R, align: "center", x: 1.0, y: 2.9, w: 11.3, h: 1.2, fontSize: 54, bold: true, color: COL.white });
  s.addText("הסוד של הצ'יפס הקפוא, ב-10 דקות", { ...R, align: "center", x: 1.0, y: 4.1, w: 11.3, h: 0.7, fontSize: 26, color: COL.gold });
  s.addText("מיכאל פרייליך | קורס מדריכי בטיחות", { ...R, align: "center", x: 1.0, y: 5.6, w: 11.3, h: 0.5, fontSize: 16, color: COL.soft });
  s.addNotes("פתיחה (30 שניות). להחזיק תפוח אדמה ביד ולשתוק 3 שניות. אחר כך: 'במפעל שבו אני עובד, תפוח כזה הופך לצ'יפס קפוא בתוך פחות משעה. עד סוף ההדרכה תדעו בדיוק איך.' (לא לנקוב בזמן אם לא בדקת מול המפעל.) קליק: תפוח, צ'יפס ופתית שלג נכנסים. שיטה: פתיחה עם חפץ אמיתי ויצירת סקרנות (Hook).");

  // ===== 2. שאלת הפתעה: מהירות =====
  s = pres.addSlide({ masterName: "LIGHT" });
  method(s, "שלב 1: פתיח וואו");
  title(s, "שאלת הפתעה", "במפעל לא חותכים עם סכין ביד. תפוח האדמה נורה אל הסכינים בצינור מים. באיזו מהירות?");
  ["5 קמ\"ש", "20 קמ\"ש", "60 קמ\"ש", "150 קמ\"ש"].forEach((o, i) => {
    s.addText(o, { ...R, align: "center", shape: pres.ShapeType.roundRect, rectRadius: 0.2,
      x: 9.6 - i * 3.0, y: 2.3, w: 2.6, h: 1.5, fontSize: 30, bold: true, color: COL.ink, fill: { color: COL.tint } });
  });
  box(s, [
    { text: "בערך 45 עד 65 קמ\"ש, כמו מכונית בעיר", options: { bold: true, fontSize: 28, color: COL.white, breakLine: true } },
    { text: "זרם המים מאיץ את תפוח האדמה, מיישר אותו ומטיח אותו ברשת סכינים קבועה. יוצאים מקלות צ'יפס שלמים בבת אחת.", options: { fontSize: 18, color: COL.white } },
  ], { x: 0.6, y: 4.3, w: 12.1, h: 1.9, fill: { color: COL.dark }, objectName: "ani1_ans" });
  src(s, "פטנטים של מערכות חיתוך במים (Hydro cutting): 12 עד 18 מטר לשנייה");
  s.addNotes("להצביע עם הידיים: מי חושב 5? 20? 60? 150? (20 שניות). רק אחרי ההצבעה, קליק לתשובה. שיטה: שאלה מקדימה שיוצרת פער סקרנות. מבוגרים זוכרים יותר אחרי שהתחייבו לניחוש. המקור: פטנטים של מערכות חיתוך במים (Hydro cutting) נותנים 40 עד 60 רגל לשנייה, כלומר 12 עד 18 מטר לשנייה.");

  // ===== 3. הצגה עצמית =====
  s = pres.addSlide({ masterName: "LIGHT" });
  method(s, "שלב 2: הצגה עצמית");
  title(s, "מי אני");
  s.addShape(pres.ShapeType.roundRect, { x: 7.0, y: 1.6, w: 5.7, h: 4.9, rectRadius: 0.2, fill: { color: COL.dark }, line: { color: COL.dark }, objectName: "ani1_bg" });
  s.addShape(pres.ShapeType.ellipse, { x: 9.15, y: 1.95, w: 1.4, h: 1.4, fill: { color: COL.deep }, line: { color: COL.deep }, objectName: "ani1_c" });
  s.addImage({ data: I.user, x: 9.47, y: 2.27, w: 0.76, h: 0.76, objectName: "ani1_i" });
  s.addText([
    { text: "מיכאל פרייליך", options: { bold: true, fontSize: 30, color: COL.gold, breakLine: true } },
    { text: "מנהל בטיחות ואיכות סביבה", options: { fontSize: 22, color: COL.white, breakLine: true } },
    { text: "תפוגן, מפעל לצ'יפס קפוא", options: { fontSize: 22, color: COL.soft } },
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
  method(s, "שלב 3: החזון", true);
  s.addShape(pres.ShapeType.ellipse, { x: 5.9, y: 1.2, w: 1.5, h: 1.5, fill: { color: COL.gold }, line: { color: COL.gold } });
  s.addImage({ data: I.eyeGold, x: 6.27, y: 1.57, w: 0.76, h: 0.76 });
  s.addText("אחרי ההדרכה הזו, לא תסתכלו יותר על צלחת צ'יפס אותו דבר.", { ...R, align: "center", x: 1.2, y: 3.0, w: 10.9, h: 1.9, fontSize: 40, bold: true, color: COL.white, objectName: "ani1_v" });
  s.addText("כי תדעו כמה ידיים, מכונות ואנשי בטיחות עומדים מאחורי כל מקל.", { ...R, align: "center", x: 1.2, y: 5.0, w: 10.9, h: 0.8, fontSize: 22, color: COL.gold, objectName: "ani2_v" });
  s.addNotes("לומר את החזון לאט, ולעצור. קליק למשפט הראשון, קליק להמשך. שיטה: חזון (שלב 03 במבנה ההרצאה). חזון אומר לקהל מה ירגישו וידעו בסוף, לא רק על מה מדברים.");

  // ===== 5. המטרות =====
  s = pres.addSlide({ masterName: "LIGHT" });
  method(s, "שלב 4: מטרות");
  title(s, "3 מטרות ל-10 דקות", "בסוף נבדוק יחד אם הגענו");
  [["1", "להכיר את 8 התחנות בקו הייצור"], ["2", "להבין למה כל שלב קיים"], ["3", "לזהות את הסיכון הגדול בקו"]].forEach(([n, t], i) => {
    const x = 8.7 - i * 4.05;
    s.addShape(pres.ShapeType.roundRect, { x, y: 2.1, w: 3.75, h: 3.9, rectRadius: 0.2, fill: { color: i === 2 ? COL.red : COL.dark }, line: { color: i === 2 ? COL.red : COL.dark }, objectName: "ani" + (i + 1) + "_b" });
    s.addText(n, { ...R, align: "center", shape: pres.ShapeType.ellipse, x: x + 1.2, y: 2.45, w: 1.35, h: 1.35, fontSize: 44, bold: true, color: COL.dark, fill: { color: COL.gold }, valign: "middle", objectName: "ani" + (i + 1) + "_n" });
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
    const fill = i === 6 ? "2F80C1" : i === 5 ? COL.red : COL.dark;
    s.addShape(pres.ShapeType.roundRect, { x, y, w: 2.7, h: 2.0, rectRadius: 0.2, fill: { color: fill }, line: { color: fill }, objectName: n + "_bg" });
    s.addImage({ data: img, x: x + 1.0, y: y + 0.25, w: 0.7, h: 0.7, objectName: n + "_ic" });
    s.addText((i + 1) + ". " + label, { ...R, align: "center", x: x + 0.1, y: y + 1.1, w: 2.5, h: 0.6, fontSize: 17, bold: true, color: COL.white, objectName: n + "_tx" });
  });
  plant(s, "בכל תחנה: בדיקה");
  s.addNotes("כל קליק מוסיף תחנה (40 שניות לכל השקף). רק לתת שם, לא להסביר. שיטה: מארגן מקדים (Advance Organizer). מבוגר רוצה לדעת לאן ההדרכה הולכת לפני הפרטים. בהדרכת בטיחות: קודם שלבי העבודה, אחר כך הסיכון בכל שלב. אפשר להוסיף: 'כל תחנה כזו קיימת אצלנו במפעל'. מסר שתול: התגית הירוקה. לא להסביר אותה, רק לומר חצי משפט כמו: וגם פה, בודקים.");

  // ===== 5. הדגמה: קילוף =====
  s = pres.addSlide({ masterName: "DARK" });
  method(s, "הדגמה והשוואה", true);
  titleDark(s, "בבית מקלפים ככה. במפעל?", "אני מראה, אתם מסתכלים");
  s.addImage({ data: I.potato, x: 9.3, y: 2.1, w: 3.0, h: 3.0 });
  box(s, [
    { text: "בבית", options: { bold: true, fontSize: 24, color: COL.gold, breakLine: true } },
    { text: "סכין קילוף, דקה לתפוח אחד", options: { fontSize: 20, color: COL.white } },
  ], { x: 4.9, y: 2.1, w: 4.0, h: 1.8, fill: { color: COL.deep }, objectName: "ani1_home" });
  box(s, [
    { text: "במפעל", options: { bold: true, fontSize: 24, color: COL.gold, breakLine: true } },
    { text: "סיר לחץ ענק עם קיטור. משחררים את הלחץ בבת אחת, הקליפה מתנפחת ומתקלפת, ומברשות מורידות אותה.", options: { fontSize: 18, color: COL.white } },
  ], { x: 0.6, y: 2.1, w: 4.0, h: 3.0, fill: { color: COL.deep }, objectName: "ani2_fac" });
  s.addImage({ data: I.steamGold, x: 2.1, y: 5.3, w: 1.0, h: 1.0, objectName: "ani2_st" });
  s.addText("קיטור בלחץ של 6 עד 12 בר, לשניות ספורות", { ...R, x: 3.3, y: 5.5, w: 6.0, h: 0.6, fontSize: 18, bold: true, color: COL.gold, objectName: "ani3_tx" });
  plant(s, "נמדד בשניות");
  s.addNotes("להוציא את תפוח האדמה וסכין הקילוף ולקלף רצועה אחת מול הכיתה (20 שניות). קליק: 'בבית'. קליק: 'במפעל'. קליק: השורה התחתונה. שיטה: הדגמה חיה והשוואה (לפני ואחרי). ההשוואה בין מה שהם מכירים לבין המפעל היא מה שנחרט. נתון להוסיף בעל פה: כל שנייה נוספת בקיטור מורידה עוד חצי אחוז מתפוח האדמה לפסולת, ולכן מכוונים את הזמן בדיוק. השוואה: צמיג של רכב מנופח בערך ל-2 בר, כלומר הלחץ בקולף פי 3 עד 6. אם יש לך את הנתון של הקולף אצלנו, להחליף בו. מסר שתול: התגית הירוקה. לא להסביר אותה, רק לומר חצי משפט כמו: וגם פה, בודקים.");

  src(s, "FreshPlaza, Evolution of potato peeling; PotatoPro", true);

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
  s.addNotes("לשאול ולחכות 5 שניות בשקט. לא למהר לענות. אם אין תשובה, הרמז על השיש (תפוח חתוך משחיר). קליק לתשובה. שיטה: שאלה מנחה (סוקרטית). הקהל מגיע לתשובה בעצמו ולכן זוכר. בבטיחות: 'למה לדעתכם יש פה מעקה?' עדיף על 'חובה מעקה'. מסר שתול: התגית הירוקה. לא להסביר אותה, רק לומר חצי משפט כמו: וגם פה, בודקים.");

  src(s, "PotatoPro, Frozen French Fries; Idaho Potato Commission");

  // ===== 7. שלושה מספרים =====
  s = pres.addSlide({ masterName: "LIGHT" });
  method(s, "מנות קטנות");
  title(s, "טיגון והקפאה: 3 מספרים בלבד", "לא 20 נתונים. שלושה.");
  [["175°", "מעלות בשמן, בטיגון המקדים"], ["\u202A30-60\u202C", "שניות בלבד. לא עד הסוף"], ["\u202A-18°\u202C", "מעלות לפחות, באחסון ובהובלה"]].forEach(([n, l], i) => {
    s.addText([
      { text: n, options: { fontSize: 64, bold: true, color: i === 2 ? "2F80C1" : COL.red, breakLine: true } },
      { text: l, options: { fontSize: 18, color: COL.ink } },
    ], { ...R, align: "center", shape: pres.ShapeType.roundRect, rectRadius: 0.2, x: 8.9 - i * 4.1, y: 2.2, w: 3.8, h: 3.0,
      fill: { color: i === 2 ? COL.ice : COL.tint }, valign: "middle", objectName: "ani" + (i + 1) + "_st" });
  });
  s.addText("ההקפאה: אוויר של מינוס 35 עד 40 מעלות, וכל צ'יפס קופא לחוד (IQF). לכן הם לא נדבקים בשקית.", { ...R, x: 0.6, y: 5.45, w: 12.1, h: 0.6, fontSize: 18, color: COL.mute, objectName: "ani4_tx" });
  plant(s, "מודדים, לא מנחשים");
  s.addNotes("קליק לכל מספר, ולעצור אחרי כל אחד. שיטה: חלוקה למנות קטנות (Chunking). הזיכרון הקצר מחזיק מעט פריטים, ולכן 3 מספרים יישארו ו-20 לא. בבטיחות: 3 כללים לעבודה בגובה, לא שקף עם 15. הערה: הטמפרטורה והזמן משתנים לפי עובי החיתוך והמוצר; אם יש לך את הנתונים של הקו במפעל, להחליף בהם. קליק אחרון: המיתוס. לשאול קודם: מי חשב שהצ'יפס בשקית עוד לא טוגן? ורק אז קליק (שיטה: שבירת מיתוס, אמונה שמופרכת נחרטת חזק יותר). נתון בונוס: בטיגון המקדים הצ'יפס סופג 4 עד 8 אחוז שמן. מסר שתול: התגית הירוקה. לא להסביר אותה, רק לומר חצי משפט כמו: וגם פה, בודקים.");
  s.addText([
    { text: "ומיתוס: ", options: { bold: true, color: COL.red } },
    { text: "\"צ'יפס קפוא עוד לא טוגן\"? הוא כבר טוגן פעם אחת במפעל. בבית מטגנים בפעם השנייה.", options: { color: COL.ink, bold: true } },
  ], { ...R, x: 0.6, y: 6.15, w: 12.1, h: 0.6, fontSize: 18, objectName: "ani5_myth" });
  src(s, "PotatoPro, Turnkey frozen french fry line; יצרני מקפיאי IQF");

  // ===== 8. תרחיש: אמוניה =====
  s = pres.addSlide({ masterName: "DARK" });
  method(s, "תרחיש: מה תעשו?", true);
  titleDark(s, "ריח חריף ליד מנהרת ההקפאה. מה עושים?");
  s.addImage({ data: I.mask, x: 0.9, y: 1.85, w: 2.4, h: 2.4 });
  [["א", "נכנסים לבדוק מאיפה הריח"], ["ב", "מתרחקים נגד כיוון הרוח, מודיעים ומפעילים את נוהל החירום"], ["ג", "פותחים חלון וממשיכים לעבוד"]].forEach(([l, t], i) => {
    s.addText(l + ". " + t, { ...R, shape: pres.ShapeType.roundRect, rectRadius: 0.15, x: 3.9, y: 1.75 + i * 0.95, w: 8.8, h: 0.8,
      fontSize: 21, color: COL.ink, fill: { color: COL.tint }, margin: 14, valign: "middle" });
  });
  box(s, [
    { text: "ב. ", options: { bold: true, color: COL.gold } },
    { text: "במפעלי הקפאה מקררים לרוב באמוניה. היא רעילה ופוגעת בנשימה ובעיניים. לא נכנסים לבדוק לבד: מתרחקים, מודיעים, ונכנס רק צוות מוסמך עם מיגון מתאים, לפי נוהל המפעל.", options: { color: COL.white } },
  ], { x: 0.6, y: 4.85, w: 12.1, h: 1.8, fill: { color: COL.red }, fontSize: 19, objectName: "ani1_ans" });
  plant(s, "עוצרים ובודקים");
  s.addNotes("כאן נכנס הצד של מדריך הבטיחות. הצבעה: א, ב או ג (20 שניות). קליק לתשובה. שיטה: תרחיש וקבלת החלטה (Scenario-based learning). העובד מתרגל החלטה ולא רק שומע כלל, וזה הכי קרוב לשטח בלי לצאת מהכיתה. אם רוצים לחזק: 'מי יודע איפה נקודת הכינוס אצלנו?' מסר שתול: התגית הירוקה. לא להסביר אותה, רק לומר חצי משפט כמו: וגם פה, בודקים.");

  // ===== 11. חזרה =====
  s = pres.addSlide({ masterName: "DARK" });
  method(s, "שליפה מהזיכרון", true);
  titleDark(s, "3 שאלות, 3 שניות לכל אחת");
  [["באיזו מהירות תפוח האדמה פוגש את הסכין?", "כ-60 קמ\"ש"], ["למה חולטים לפני הטיגון?", "שלא ישחים"], ["כמה פעמים טוגן הצ'יפס שאכלתם?", "פעמיים"]].forEach(([q, a], i) => {
    const y = 1.7 + i * 1.65;
    s.addText(q, { ...R, shape: pres.ShapeType.roundRect, rectRadius: 0.15, x: 4.3, y, w: 8.4, h: 1.3, fontSize: 22, color: COL.ink, fill: { color: COL.tint }, margin: 16, valign: "middle" });
    s.addText(a, { ...R, align: "center", shape: pres.ShapeType.roundRect, rectRadius: 0.15, x: 0.6, y, w: 3.4, h: 1.3, fontSize: 26, bold: true, color: COL.dark, fill: { color: COL.gold }, valign: "middle", objectName: "ani" + (i + 1) + "_a" });
  });
  s.addNotes("לשאול כל שאלה בקול, לתת לכיתה לענות ביחד, ורק אז קליק לתשובה. שיטה: שליפה מהזיכרון (Retrieval practice). לשלוף מידע מחזק אותו יותר מלשמוע אותו שוב. זו גם בדיקה של רמה 2 במודל קירקפטריק: האם למדו.");

  // ===== 12. החשיפה =====
  s = pres.addSlide({ masterName: "DARK" });
  s.addImage({ data: I.teacher, x: 0.8, y: 0.5, w: 1.6, h: 1.6 });
  s.addText("רגע... מה בעצם עשיתי לכם?", { ...R, x: 2.8, y: 0.55, w: 9.9, h: 0.9, fontSize: 36, bold: true, color: COL.gold, margin: 0 });
  s.addText("לא לימדתי צ'יפס. הדגמתי 11 שיטות הדרכה:", { ...R, x: 2.8, y: 1.4, w: 9.9, h: 0.5, fontSize: 18, color: COL.white, margin: 0 });
  ["פתיחה עם חפץ (1)", "שאלה מקדימה (2)", "הצגה עצמית (3)", "חזון (4)", "מטרות (5)", "התמונה הגדולה (6)",
    "הדגמה והשוואה (7)", "שאלה מנחה (8)", "מנות קטנות ומיתוס (9)", "תרחיש והחלטה (10)", "חזרה ושליפה (11)"].forEach((m, i) => {
    const col = i % 4, row = Math.floor(i / 4);
    s.addText(m, { ...R, align: "center", shape: pres.ShapeType.roundRect, rectRadius: 0.15,
      x: 9.9 - col * 3.1, y: 2.25 + row * 1.08, w: 2.8, h: 0.85, fontSize: 16, bold: true, color: COL.dark,
      fill: { color: COL.gold }, valign: "middle", objectName: "ani" + (row + 1) + "_m" + i });
  });
  s.addText("ההדרכה הטובה ביותר היא זו שהקהל לא מרגיש שהוא בהדרכה.", { ...R, align: "center", x: 0.6, y: 6.25, w: 12.1, h: 0.55, fontSize: 18, italic: true, color: COL.soft, objectName: "ani5_q" });
  s.addText([
    { text: "והמסר ששתלתי: ", options: { bold: true, color: COL.white } },
    { text: "כמו שכל צ'יפס נבדק בכל תחנה, גם כל עבודה אצלנו נבדקת בכל שלב.", options: { bold: true, color: COL.dark } },
  ], { ...R, align: "center", shape: pres.ShapeType.roundRect, rectRadius: 0.15, x: 0.6, y: 5.45, w: 12.1, h: 0.7, fontSize: 19, fill: { color: COL.green }, valign: "middle", objectName: "ani4_msg" });
  s.addNotes("קליק 4: המסר השתול. לשאול לפני: מי שם לב לתגית הירוקה שחזרה בשקפים? רק אז קליק. שיטה: שתילת מסר, מסר שחוזר בלי להכריז עליו ונחשף בסוף. החשיפה: כל קליק מוסיף שורה. לחזור ל-3 המטרות משקף 5: הכרתם את התחנות? הבנתם למה? זיהיתם את הסיכון? לעצור אחרי השורה האחרונה ולתת לכיתה רגע. משפט סיום. אם נשאר זמן: 'איזו שיטה הכי עבדה עליכם?' (רמה 1 בקירקפטריק: תגובה). מקורות לשיטות: OSHA, Resource for Development and Delivery of Training to Workers; המוסד לבטיחות ולגיהות, הערכת יעילות הדרכה; עקרונות למידת מבוגרים של מלקולם נואלס.");

  await pres.writeFile({ fileName: "fries-raw.pptx" });
  console.log("ok");
})();
