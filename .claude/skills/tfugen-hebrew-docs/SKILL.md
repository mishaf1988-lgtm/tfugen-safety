---
name: tfugen-hebrew-docs
description: Use when building or filling a Hebrew Word, PDF or PowerPoint file for the tfugen-safety work (a controlled factory form, an accident investigation, a weekly training, a committee deck or protocol, a guide PDF) or Hebrew strings in JS that end up in one. A map of the traps already hit - RTL in OOXML (bidi with jc=right shows on the left, schema order), the logo and the header table, the form number and the page X of Y field, Hebrew in JS as unicode escapes, DD/MM/YYYY, keyboard-only characters, python-pptx Hebrew font traps - and which repo tool or skill holds the full rule for each.
---

# מסמכים בעברית: Word, PDF ומצגות

כל שורה כאן היא הפניה. הכלל המלא נמצא במקור שבסוגריים; לא לשכפל אותו לכאן.

## לפני שמתחילים: לא בונים מאפס
- **קודם טופס קיים** (DECISIONS 24/10/2026, "קודם טופס קיים"; `project-files/iso-forms-index.md`). מסמך חדש רק אם אין.
- **הטופס המבוקר של המפעל:** קובץ ה-Word המקורי עם לוגו, טבלת כותרת, מספר טופס, "עמוד X מתוך Y" ות. עדכון. לא מ-HTML ולא מאפס (`project-files/domains/expiry.md` סעיף "לפני שמכינים מסמך" 2; 01/11/2026: טופס 08.01 בלי לוגו).
- **מסמך חדש למערכת הניהול:** הלוגו והכותרת מתבנית 13.07, המספר לפי הנוהל של המסמך (26.xx, 33.xx, 08.xx), לא 13.07 (DECISIONS 24/10/2026, שתי החלטות; לקח 209 ב-`tfugen-dev/references/lessons.md`).
- **תחקיר תאונה:** מעותק של תחקיר קודם של מיכאל, לא מ-32.02 ריק; אחרת `tools/investigation-doc.py` (לקח 274, `project-files/assistant/accidents.md`).
- **הורדת הטופס:** `bash tools/od-get.sh '<נתיב בתוך ניהול בטיחות>' <קובץ>` (טוקן חד פעמי ל-10 דקות, צריך `ROUTINE_KEY`).

## הכלים, לפי סוג
| מה | הכלי | מה הוא שומר |
|---|---|---|
| מילוי טופס מבוקר (Word, וגם PDF לבדיקה) | `tools/form-fill.py --template --spec --out` | מקבל שינויים במעקב קודם (`accept_docx.py`), נכשל אם ירדו תמונות (לוגו), אם חסר מספר טופס `NN.NN` בכותרת או "עמוד", או אם יש יותר עמודים מהתבנית (`fit_one_page`) |
| פסקאות וטבלאות עבריות חדשות ב-Word | `tools/rtl_ooxml.py` (`p_xml`, `tbl_xml`) | סדר סכמה, Arial, בלי jc ימין או שמאל; עמודה ראשונה = הימנית (לקח 317) |
| הדרכה שבועית על 08.01, וכל מסמך עברי על טופס מבוקר | `tools/talk-0801.py` | דוחה תבנית בלי לוגו בכותרת (לקח 245) |
| "עמוד X מתוך Y" עם ערך ישן | `python3 -I project-files/doc-review/page_fields.py <docx> <עמודים> <פלט>` | לקח 287 |
| בדיקה של ה-PDF הסופי, עמוד אחרי עמוד | `tools/pdf-visual-check.py <pdf>` | `page_of`, `logo_top`, `rtl`, `dir`, `font`, `date`, `punct`, `cut`, `rows` (לקח 323) |
| מצגת ופרוטוקול ועדה | skill `safety-committee-builder` (סעיפים 5-9) | |
| מדריך PDF וכרטיס | skill `tfugen-guides` (`build-pdf.js`, `KEYBOARD_ONLY`) | |

## RTL ב-Word (OOXML)
- **`<w:bidi/>` יחד עם `<w:jc w:val="right"/>` = Word מציג משמאל.** להשמיט `jc` (או `both` לגוף) (`safety-committee-builder` סעיף 9; לקחים 317, 245).
- **LibreOffice ו-PDF של Graph סולחים, Word לא:** תצוגה מקדימה שנראית תקינה אינה הוכחה. להשוות למסמך עברי שנכתב ב-Word אמיתי (לקח 317).
- **סדר הילדים ב-`<w:pPr>`:** pStyle, keepNext, pageBreakBefore, numPr, pBdr, bidi, spacing, ind, contextualSpacing, jc, rPr. אלמנט שנוסף בסוף נבלע (`safety-committee-builder` סעיף 9). בטבלה `bidiVisual` ראשון ב-`tblPr` (`rtl_ooxml.py`).
- **בלי מעבר עמוד מאולץ:** עמוד יתום. במקומו spacing ו-keepNext (`safety-committee-builder` סעיף 9).
- **`form-fill.py` עצמו נפל פעם באותה מלכודת** (הוסיף bidi בלי להסיר jc); נאכף היום ב-`form-fill.lint` (לקח 245).
- **כתובת מייל או מילה באנגלית בתוך עברית** נשברת בין שורות: `dir="ltr"` עם `unicode-bidi:isolate` (`tfugen-guides` כלל 9; ב-HTML של מדריך).

## לוגו, כותרת, מספר טופס ועמודים
- **לוגו בכותרת, לא רק "יש תמונה":** לוגואים בתחתית העבירו בדיקה כשעמודת הלוגו בכותרת נעלמה (לקח 245, `pdf-visual-check.py` `logo_top`).
- **תמונה מבחוץ לא מחליפה את הלוגו** (לקח 274). בפרוטוקול: לעדכן גם `word/header2.xml` (`safety-committee-builder` סעיף 9).
- **"עמוד X מתוך Y":** שדות `PAGE`/`NUMPAGES` שומרים ערך ישן; לקרוא את ה-PDF (`pdftotext`) מול `pdfinfo` (לקח 287). בכל עמוד, ועמוד 2 עם כותרת ולוגו (לקח 323).
- **בודק שני בשרת:** Word שהעוזר כותב עליו "נשמר" בלי לוגו נדחה, וטופס גם בלי מספר טופס או "עמוד" בכותרת (`docMarks`, `expiry.md` 2).
- **PDF שנשמר בתיקייה הוא של Microsoft:** `od_put_pdf` ל-Word ואז `od_pdf` (או `od-read` עם `"format":"pdf"`). LibreOffice רק לבדיקה (DECISIONS 24/10/2026; `form-fill.py`; `tfugen-db`). Word וגם PDF באותו שם ובאותה תיקייה.
- **EMF בתחתית:** LibreOffice משבש אותו; ה-docx שומר את המקור (`safety-committee-builder` סעיף 9).

## PowerPoint (python-pptx)
המקור: `safety-committee-builder` סעיף 6 ("חמש מלכודות").
- `font.name` כותב רק `<a:latin>`; עברית נקראת מ-`<a:cs>`. אחרי `prs.save()` פוסט-עיבוד על ה-zip: `<a:cs typeface="Arial"/>` ו-`lang="he-IL" altLang="en-US"` ב-slides, charts, theme, slideLayouts, slideMasters.
- כל פסקה `rtl=1` מיושרת לימין (סעיף 5). טבלאות: לכבות `firstRow` ו-`bandRow` ולצבוע ידנית. שורת כותרת לפחות 0.56 אינץ' (0.45 חותך עברית).
- החלפת טקסט קיים: `run.text` ולמחוק ריצות עודפות, לא `text_frame.text`; לא להעתיק `slideN.xml` ידנית.
- **טקסט מהמסד ל-XML של Office:** להסיר תווי בקרה (כמו `xmlEsc` ב-`_xlsxpatch.js`); `\u0007` מהדבקה גרם ל-PowerPoint להציע "תיקון" (לקח 280).
- בדיקה: המרה ל-PDF ול-JPG וחיתוך מוגדל לכל סוג רכיב, לא צילום שקופית בלבד (סעיף 7).

## טקסט, תאריך וקוד
- **עברית ב-JS = `\uXXXX`**, אף פעם לא תווים גולמיים (CLAUDE.md חוק 1, `.claude/rules/code.md`; נאכף ב-`raw-hebrew.py`, `code-raw-hebrew.py`). כלי העריכה יכול לשמור escape כתווים גולמיים: לבדוק (רטרו PR 3187, `rule1-hebrew-test`).
- **תאריך במסמך = DD/MM/YYYY**, לא נקודות (`pdf-visual-check.py` `date`; CLAUDE.md חוק 7). חריגים: שם קובץ שהשרת יוצר `DD-MM-YYYY`, ושמות בתיקיית התאונות `DD.MM.YYYY` כמו בטופס 250 (`.claude/rules/people-text.md`). באפליקציה: `fd(d)`.
- **רק תווי מקלדת** בכל מה שאדם קורא: בלי מקף ארוך, «», גרשיים מסולסלים, חצים, שלוש נקודות כתו אחד (`.claude/rules/people-text.md`; `KEYBOARD_ONLY`).
- **נקודתיים בצד הנכון** ברשימה עברית, וגופן Arial בלבד, לא David או Times (`pdf-visual-check.py` `punct`, `font`; לקח 323).
- **בלי פרטים אישיים ב-repo:** ה-JSON של תחקיר נשמר מחוץ ל-repo (`tools/investigation-doc.py`).

## לפני שמסמך יוצא לאדם
1. ה-PDF הסופי ב-`tools/pdf-visual-check.py`, וגם מבט בעין על כל עמוד (לקח 323; לעוזר `project-files/wa-topics/docs.md` 0ב2א).
2. מסמך שזז בו משהו נבדק גם על יותר מעמוד אחד (לקח 323).
3. אחרי "נשמר": לקרוא את הקובץ שנשמר ולכתוב מה שונה (`claimGate`, `savedFresh`, `expiry.md` 4).

## מה לא נמצא ב-repo
- כלל ל-Excel עברי (כיוון גיליון RTL, כותרות) מעבר ל-`xlsx_add_rows.py` / `xlsx_update_row.py` ו"לא openpyxl" (`project-files/assistant/accidents.md`): לא נמצא ב-repo, להשלים.
- בדיקה אוטומטית ל-RTL של מצגת (מקבילה ל-`pdf-visual-check.py`): לא נמצא ב-repo, להשלים; היום בדיקת התקינות של skill ה-pptx של Anthropic ומבט בעין (`safety-committee-builder` סעיף 7).
