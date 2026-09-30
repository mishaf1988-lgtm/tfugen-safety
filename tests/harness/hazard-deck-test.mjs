// The committee deck, updated in place (28/09). The fixture copies the real
// deck's structure as read with od-read on 28/09: shape names, paragraphs and
// runs (a bold 3200 number run, "dept" + " - text" item runs, the closures
// section inside HighSevPanel), and the real chart XML (stacked bar with a
// hidden "Totals" series and a fixed axis max; a literal line chart).
import { patchPara, setList, patchDeck, deckContent, FIXED_YEARS } from './_build/_deckpatch.mjs';
import { meetingHazards, meetingAccidents } from './_build/_meeting.mjs';
import { readZip, writeZip, entryText } from './_build/_xlsxpatch.mjs';
import { onRequest, runDeck, defaultMeeting, meetingDate } from './_build/hazard-deck.mjs';

let pass = 0, fail = 0;
const check = (l, c, d) => { if (c) { pass++; console.log('  ✓ ' + l); } else { fail++; console.log('  ✗ ' + l + (d !== undefined ? '  -> ' + JSON.stringify(d).slice(0, 500) : '')); } };
const SB = 'https://znhjtpcltrxxyfjczgvw.supabase.co';

const R = (t, sz, b, c) => '<a:r><a:rPr lang="he-IL" sz="' + sz + '"' + (b != null ? ' b="' + b + '"' : '') + ' dirty="0"><a:solidFill><a:srgbClr val="' + c + '"/></a:solidFill></a:rPr><a:t>' + t + '</a:t></a:r>';
const P = (...runs) => '<a:p><a:pPr algn="r" rtl="1"/>' + runs.join('') + '<a:endParaRPr lang="he-IL"/></a:p>';
const SP = (name, ...paras) => '<p:sp><p:nvSpPr><p:cNvPr id="9" name="' + name + '"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr><p:txBody><a:bodyPr wrap="square" rtlCol="1"><a:noAutofit/></a:bodyPr><a:lstStyle/>' + paras.join('') + '</p:txBody></p:sp>';
const SLD = (...sps) => '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:sld xmlns:a="a" xmlns:p="p" xmlns:r="r"><p:cSld><p:spTree>' + sps.join('') + '</p:spTree></p:cSld></p:sld>';
const slide1 = SLD(
  SP('Header', P(R('מפגעים ומוכנות חירום - 2026', 2800, 1, 'C00000'), R('   |   ישיבה שבועית · 22.09.2026', 1400, null, '595959'))),
  SP('ClosedNote', P(R('10 מפגעים נסגרו השבוע', 1500, 1, 'FFFFFF')), P(R('ייצור טוגנים, חומר גלם', 1300, 0, 'E6F4E6'))),
  SP('OpenNote', P(R('11 מפגעים פתוחים, הטיפול נמשך', 1500, 1, 'FFFFFF')), P(R('בחומרה גבוהה, בריחת קיטור בארובה בקילופים', 1300, 0, 'FBE4E4'))),
  SP('NewNote', P(R('6 מפגעים חדשים נפתחו השבוע', 1500, 1, 'FFFFFF')), P(R('ייצור טוגנים, 5 נסגרו ואחד נותר פתוח', 1300, 0, 'FFF0E6'))));
const slide2 = SLD(
  SP('Header', P(R('תאונות עבודה - מגמה חודשית 2026', 2800, 1, 'C00000'))),
  SP('NoAccBadge', P(R('סה"כ 14 תאונות עבודה ב-2026', 1500, 1, 'FFFFFF')), P(R('6 מדווחות, 8 לא מדווחות', 1400, 0, 'FFFFFF')), P(R('אחרונה: 01/09, מעוצבים, מעיכת אגודל יד ימין', 1400, 0, 'FFE0E0')), P(R('מחוץ לשטח המפעל - בדרך הביתה', 1400, 1, 'FFE0E0'))),
  SP('Y2026Box', P(R('סך תאונות עבודה 2026', 1500, 1, '0E2841')), P(R('14', 2000, 1, '0E2841'))),
  SP('DaysSafeText', P(R('21', 3200, 1, 'FFFFFF')), P(R('ימים ללא תאונת עבודה', 1400, 1, 'FFFFFF'))),
  SP('NoChangeNote', P(R('ללא שינוי, ללא אירועים משבוע שעבר', 1500, 1, 'FFFFFF'))));
const item = (d, t, sz) => P(R(d, sz, 1, '404040'), R(' - ' + t, sz, null, '595959'));
const slide3 = SLD(
  SP('Title', P(R('סטטוס מפגעים - ישיבה חודשית', 2800, 1, 'C00000'), R('   |   דוח חודשי - נתונים מעודכנים', 1400, null, '595959'))),
  SP('Card0', P(R('43', 3200, 1, '404040')), P(R('סה"כ מפגעים', 1400, 1, '595959'))),
  SP('Card1', P(R('26', 3200, 1, 'FFFFFF')), P(R('נסגרו', 1400, 1, 'FFFFFF'))),
  SP('Card2', P(R('17', 3200, 1, 'FFFFFF')), P(R('פתוחים - 5 בחומרה גבוהה, 12 בינונית', 1400, 1, 'FFFFFF'))),
  SP('HighSevPanel', P(R('מפגעים פתוחים בחומרה גבוהה (5)', 1600, 1, 'C00000')), item('ייצור טוגנים', 'נקודות צביטה', 1400), item('מעבדות', 'מנדף', 1400),
    P(R(' פעולות סגירה - ספטמבר 2026 (7)', 1500, 1, '196B24')), P(R('חומר גלם: 5 מפגעים נסגרו', 1400, null, '595959')), P(R('תוצג: מפגע אחד נסגר', 1400, null, '595959'))),
  SP('MedSevPanel', P(R('מפגעים פתוחים בחומרה בינונית (12)', 1600, 1, 'E97132')), item('מעצבים', 'גישה פתוחה לחדר חשמל', 1200), item('תוצג', 'שוחת ביוב', 1200), item('חומר גלם', 'רצפות', 1200)));
const slide4 = SLD(SP('Event1Card', P(R('החודש לא אירעו אירועי "כמעט ונפגע"', 1500, 1, '000000'))));
const lbl = '<c:dLbls><c:numFmt formatCode="#,##0" sourceLinked="0"/><c:showVal val="1"/></c:dLbls>';
const cats5 = '<c:cat><c:strLit><c:ptCount val="5"/><c:pt idx="0"><c:v>ייצור טוגנים</c:v></c:pt><c:pt idx="1"><c:v>מעצבים</c:v></c:pt><c:pt idx="2"><c:v>חומר גלם</c:v></c:pt><c:pt idx="3"><c:v>תוצג</c:v></c:pt><c:pt idx="4"><c:v>מעבדות</c:v></c:pt></c:strLit></c:cat>';
const vals = (a) => '<c:val><c:numLit><c:formatCode>General</c:formatCode><c:ptCount val="5"/>' + a.map((v, i) => '<c:pt idx="' + i + '"><c:v>' + v + '</c:v></c:pt>').join('') + '</c:numLit></c:val>';
const ser = (i, name, color, a) => '<c:ser><c:idx val="' + i + '"/><c:order val="' + i + '"/><c:tx><c:v>' + name + '</c:v></c:tx><c:spPr><a:solidFill><a:srgbClr val="' + color + '"/></a:solidFill></c:spPr><c:invertIfNegative val="1"/>' + lbl + cats5 + vals(a) + '</c:ser>';
const chart1 = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><c:chartSpace xmlns:c="c" xmlns:a="a"><c:chart><c:plotArea><c:barChart><c:barDir val="col"/><c:grouping val="stacked"/>'
  + ser(0, 'סגור', '4EA72E', [5, 4, 10, 5, 3]) + ser(1, 'פתוח', 'C00000', [2, 1, 3, 1, 3]) + ser(2, 'חדש השבוע', 'ED7D31', [6, 0, 0, 0, 0]) + ser(3, 'Totals', 'FFFFFF', [13, 5, 13, 6, 6])
  + '<c:gapWidth val="50"/><c:overlap val="100"/><c:axId val="1"/><c:axId val="2"/></c:barChart><c:catAx><c:axId val="1"/><c:scaling><c:orientation val="minMax"/></c:scaling></c:catAx><c:valAx><c:axId val="2"/><c:scaling><c:orientation val="minMax"/><c:max val="16.3"/><c:min val="0"/></c:scaling></c:valAx></c:plotArea></c:chart></c:chartSpace>';
const chart2 = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><c:chartSpace xmlns:c="c" xmlns:a="a"><c:chart><c:plotArea><c:lineChart><c:grouping val="standard"/><c:ser><c:idx val="0"/><c:order val="0"/><c:tx><c:v>תאונות עבודה</c:v></c:tx>' + lbl
  + '<c:cat><c:strLit><c:ptCount val="3"/><c:pt idx="0"><c:v>2024</c:v></c:pt><c:pt idx="1"><c:v>2025</c:v></c:pt><c:pt idx="2"><c:v>ינו-26</c:v></c:pt></c:strLit></c:cat><c:val><c:numLit><c:formatCode>General</c:formatCode><c:ptCount val="3"/><c:pt idx="0"><c:v>9</c:v></c:pt><c:pt idx="1"><c:v>13</c:v></c:pt><c:pt idx="2"><c:v>3</c:v></c:pt></c:numLit></c:val><c:smooth val="0"/></c:ser><c:marker val="1"/></c:lineChart><c:valAx><c:scaling><c:orientation val="minMax"/><c:min val="0"/></c:scaling></c:valAx></c:plotArea></c:chart></c:chartSpace>';
const IMG = new Uint8Array(4000).map((_, i) => (i * 13) % 251);
async function deck() {
  return writeZip([
    { name: '[Content_Types].xml', text: '<Types/>' },
    { name: 'ppt/presentation.xml', text: '<p:presentation/>' },
    { name: 'ppt/slides/slide1.xml', text: slide1 }, { name: 'ppt/slides/slide2.xml', text: slide2 },
    { name: 'ppt/slides/slide3.xml', text: slide3 }, { name: 'ppt/slides/slide4.xml', text: slide4 },
    { name: 'ppt/charts/chart1.xml', text: chart1 }, { name: 'ppt/charts/chart2.xml', text: chart2 },
    { name: 'ppt/media/image1.png', method: 0, crc: 0, csize: IMG.length, usize: IMG.length, raw: IMG, time: 0, date: 0x21 },
  ]);
}
const d = (x) => (x ? { date: x } : null);
const row = (n, date, dept, loc, descr, sev, due, s, closed) => [n, d(date), 1, dept, loc, descr, sev, '', '', d(due), s, d(closed), ''];
const ROWS = [
  row(1, '2026-09-14', 'ייצור טוגנים', 'קילופים', 'בריחת קיטור בחלק העליון של הארובה', 'גבוהה', '2026-09-20', 'פתוח', null),
  row(2, '2026-09-15', 'ייצור טוגנים', '', 'תעלה פתוחה', 'גבוהה', '2026-09-30', 'סגור', '2026-09-16'),
  row(3, '2026-06-01', 'מעבדות', 'מעבדת פיתוח', 'מנדף לא אפקטיבי', 'גבוהה', '2026-07-01', 'בטיפול', null),
  row(4, '2026-09-07', 'חומר גלם', '', 'רצפות', 'בינונית', '2026-10-07', 'סגור', '2026-09-18'),
  row(5, '2026-09-07', 'חומר גלם', '', 'מראה שבורה', 'בינונית', '2026-09-21', 'פתוח', null),
  row(6, '2026-09-01', 'תוצג', '', 'שוחה', 'בינונית', '2026-09-10', 'פתוח', null),
  row(7, '2026-09-01', 'מעצבים', '', 'חדר חשמל', 'בינונית', null, 'פתוח', null),
  row(8, '2026-09-01', 'מעצבים', '', 'כבלים', 'בינונית', null, 'פתוח', null),
  row(9, '2026-09-01', 'מעצבים', '', 'סולם', 'בינונית', null, 'פתוח', null),
];
const INC = [
  { id: 'a', dt: '2025-03-05T08:00:00Z', l: 'אחזקה', reported: false, r: 'מהות הפגיעה: עין' },
  { id: 'b', dt: '2026-01-21T05:00:00Z', l: 'החלפת סכינים', dept: 'ייצור טוגנים', reported: false, r: 'מהות הפגיעה: חתך' },
  { id: 'e', dt: '2026-09-01T15:40:00Z', l: 'בדרך הביתה', dept: 'מעוצבים', reported: true, r: 'מהות הפגיעה: מעיכת אגודל יד ימין. איבר: אגודל' },
];
const partText = async (bytes, n) => entryText(readZip(bytes).find((e) => e.name === n));

(async () => {
  console.log('\n1. text, run by run');
  const p2 = P(R('10 מפגעים נסגרו השבוע', 1500, 1, 'FFFFFF'));
  check('same wording, new number: only the digits change, the run and its formatting stay', patchPara(p2, '7 מפגעים נסגרו השבוע') === p2.replace('10 מפגעים', '7 מפגעים'));
  const ph = P(R('מפגעים ומוכנות חירום - 2026', 2800, 1, 'C00000'), R('   |   ישיבה שבועית · 22.09.2026', 1400, null, '595959'));
  const nh = patchPara(ph, (t) => t.replace(/\d{2}\.\d{2}\.\d{4}/, '29.09.2026'));
  check('the header date changes inside its own (small, grey) run; the bold red title is untouched', nh.includes('<a:t>   |   ישיבה שבועית · 29.09.2026</a:t>') && nh.includes('sz="1400"') && nh.includes('<a:t>מפגעים ומוכנות חירום - 2026</a:t>'), nh);
  const two = patchPara(item('ייצור טוגנים', 'x', 1400), ['מעבדות', ' - מנדף']);
  check('an item with two runs keeps both (bold department, grey text)', /b="1"[\s\S]*<a:t>מעבדות<\/a:t>[\s\S]*<a:t> - מנדף<\/a:t>/.test(two), two);
  const other = patchPara(P(R('ייצור טוגנים, חומר גלם', 1300, 0, 'E6F4E6')), 'מעבדות');
  check('different wording: the text goes into the first run, formatting kept', other.includes('<a:t>מעבדות</a:t>') && other.includes('E6F4E6'), other);
  check('text is escaped (a quote mark and < in a description)', patchPara(P(R('x', 1, 1, '0')), 'מט"ש <b>').includes('<a:t>מט"ש &lt;b&gt;</a:t>'));

  const split = patchPara(P(R('1', 1500, 1, 'FFFFFF'), R('2 מפגעים', 1500, 1, 'FFFFFF')), '5 מפגעים');
  check('a number split across two runs ("1" + "2"): written whole, never "undefined"', !/undefined/.test(split) && split.includes('<a:t>5 מפגעים</a:t>'), split);

  console.log('\n2. lists');
  const rep = [];
  const lx = setList(slide3, 'MedSevPanel', [{ match: /^מפגעים פתוחים בחומרה בינונית/, header: 'מפגעים פתוחים בחומרה בינונית (5)', items: [['א', ' - 1'], ['ב', ' - 2'], ['ג', ' - 3'], ['ד', ' - 4'], ['ה', ' - 5']], empty: 'אין' }], (n) => ['ועוד ' + n + ' מפגעים', ''], rep);
  const med = lx.substring(lx.indexOf('name="MedSevPanel"'));
  check('more items than the deck had room for (3): two, then "ועוד 3 מפגעים", cloned from the first item', (med.match(/<a:p>/g) || []).length === 4 && med.includes('<a:t>א</a:t>') && med.includes('<a:t>ב</a:t>') && med.includes('<a:t>ועוד 3 מפגעים</a:t>') && !med.includes('<a:t>ג</a:t>') && (med.match(/sz="1200"/g) || []).length >= 4, med.slice(0, 600));
  check('the header count updated', med.includes('<a:t>מפגעים פתוחים בחומרה בינונית (5)</a:t>'));
  const secs = (items) => [{ match: /^מפגעים פתוחים בחומרה בינונית/, header: 'מפגעים פתוחים בחומרה בינונית (' + items.length + ')', items, empty: 'אין' }];
  const zero = setList(slide3, 'MedSevPanel', secs([]), (n) => ['ועוד ' + n, ''], []);
  const back3 = setList(zero, 'MedSevPanel', secs([['א', ' - 1'], ['ב', ' - 2'], ['ג', ' - 3']]), (n) => ['ועוד ' + n, ''], []);
  const m3 = back3.substring(back3.indexOf('name="MedSevPanel"'));
  check('a week with no items does not shrink the list: the next week shows all 3, dept still bold', m3.includes('<a:t>א</a:t>') && m3.includes('<a:t>ב</a:t>') && m3.includes('<a:t>ג</a:t>') && !m3.includes('ועוד') && /b="1"[^>]*>[\s\S]{0,120}<a:t>ג<\/a:t>/.test(m3), m3.slice(0, 900));

  console.log('\n3. the whole deck');
  const ref = '2026-09-29';
  const m = { hazards: meetingHazards(ROWS, ref), accidents: meetingAccidents(INC, ref) };
  const src = await deck();
  const out = await patchDeck(src, deckContent(m, ROWS, ref, { s3Month: '2026-09' }));
  check('nothing reported missing', out.report.length === 0, out.report);
  const s1 = await partText(out.bytes, 'ppt/slides/slide1.xml');
  check('slide 1 header: the meeting date, the rest of the header as it was', s1.includes('   |   ישיבה שבועית · 29.09.2026') && s1.includes('מפגעים ומוכנות חירום - 2026'));
  // week 20-26.09: nothing new, nothing closed; open = 7 (all not closed)
  check('slide 1 notes from the data (week 20.09-26.09)', s1.includes('<a:t>לא נסגרו מפגעים השבוע</a:t>') && s1.includes('<a:t>7 מפגעים פתוחים, הטיפול נמשך</a:t>') && s1.includes('<a:t>2 בחומרה גבוהה, מנדף לא אפקטיבי</a:t>') && s1.includes('<a:t>לא נפתחו מפגעים חדשים השבוע</a:t>'), s1.slice(s1.indexOf('ClosedNote'), s1.indexOf('ClosedNote') + 900));
  const c1 = await partText(out.bytes, 'ppt/charts/chart1.xml');
  const serVals = (x, name) => { const s = x.substring(x.indexOf('<c:v>' + name + '</c:v>')); const v = s.substring(s.indexOf('<c:val>'), s.indexOf('</c:val>')); return (v.match(/<c:v>([^<]*)<\/c:v>/g) || []).map((q) => q.replace(/<\/?c:v>/g, '')).join(','); };
  // order in the chart: ייצור טוגנים, מעצבים, חומר גלם, תוצג, מעבדות
  check('chart: closed / open / new / totals per department, in the chart\'s own order', serVals(c1, 'סגור') === '1,0,1,0,0' && serVals(c1, 'פתוח') === '1,3,1,1,1' && serVals(c1, 'חדש השבוע') === '0,0,0,0,0' && serVals(c1, 'Totals') === '2,3,2,1,1', [serVals(c1, 'סגור'), serVals(c1, 'פתוח'), serVals(c1, 'Totals')]);
  check('chart axis max follows the tallest bar (3 x 1.25 = 3.8), colours and labels untouched', c1.includes('<c:max val="3.8"/>') && c1.includes('4EA72E') && c1.includes('<c:showVal val="1"/>'), c1.match(/<c:max[^>]*>/));
  const s2 = await partText(out.bytes, 'ppt/slides/slide2.xml');
  check('slide 2: total, reported, the last accident, off site, days since, the note', s2.includes('<a:t>סה"כ 2 תאונות עבודה ב-2026</a:t>') && s2.includes('<a:t>1 מדווחות, 1 לא מדווחות</a:t>') && s2.includes('<a:t>אחרונה: 01/09, מעוצבים, מעיכת אגודל יד ימין</a:t>') && s2.includes('<a:t>מחוץ לשטח המפעל - בדרך הביתה</a:t>') && s2.includes('<a:t>28</a:t>') && s2.includes('<a:t>ללא שינוי, ללא אירועים משבוע שעבר</a:t>'), s2.slice(s2.indexOf('NoAccBadge'), s2.indexOf('NoAccBadge') + 1200));
  check('the big "days" number keeps its size 3200', /sz="3200"[^>]*>[\s\S]{0,120}<a:t>28<\/a:t>/.test(s2));
  const c2 = await partText(out.bytes, 'ppt/charts/chart2.xml');
  check('line chart: 2024 fixed at 9 (Michael), 2025 from inc, Jan..Sep 2026', /<c:ptCount val="11"\/><c:pt idx="0"><c:v>2024<\/c:v>/.test(c2) && c2.includes('<c:pt idx="10"><c:v>ספט-26</c:v>') && /<c:pt idx="0"><c:v>9<\/c:v><\/c:pt><c:pt idx="1"><c:v>1<\/c:v><\/c:pt><c:pt idx="2"><c:v>1<\/c:v>/.test(c2) && FIXED_YEARS[2024] === 9, c2.slice(c2.indexOf('<c:cat>'), c2.indexOf('<c:cat>') + 300));
  const s3 = await partText(out.bytes, 'ppt/slides/slide3.xml');
  check('slide 3 cards: total 9, closed 2, open 7 by severity', s3.includes('<a:t>9</a:t>') && s3.includes('<a:t>2</a:t>') && s3.includes('<a:t>פתוחים - 2 בחומרה גבוהה, 5 בינונית</a:t>'), s3.slice(s3.indexOf('Card2'), s3.indexOf('Card2') + 500));
  check('slide 3 high list: 2 open high items as "dept" + " - loc: text"; closures of September by department', s3.includes('<a:t>מפגעים פתוחים בחומרה גבוהה (2)</a:t>') && s3.includes('<a:t> - קילופים: בריחת קיטור בחלק העליון של הארובה</a:t>') && s3.includes('<a:t> פעולות סגירה - ספטמבר 2026 (2)</a:t>') && s3.includes('<a:t>ייצור טוגנים: מפגע אחד נסגר</a:t>') && s3.includes('<a:t>חומר גלם: מפגע אחד נסגר</a:t>'), s3.slice(s3.indexOf('HighSevPanel'), s3.indexOf('HighSevPanel') + 1500));
  check('slide 3 medium list: room is the deck\'s own 12, so all 5 show, the rest empty lines', s3.includes('<a:t>מפגעים פתוחים בחומרה בינונית (5)</a:t>') && !s3.includes('ועוד') && s3.includes('<a:t> - סולם</a:t>'), s3.slice(s3.indexOf('MedSevPanel'), s3.indexOf('MedSevPanel') + 800));
  const zs = readZip(src), zo = readZip(out.bytes);
  const same = (n) => { const a = zs.find((e) => e.name === n), b = zo.find((e) => e.name === n); return a && b && a.crc === b.crc && a.csize === b.csize && Buffer.from(a.raw).equals(Buffer.from(b.raw)); };
  check('slide 4 (near misses), the picture and everything else: byte for byte the same', same('ppt/slides/slide4.xml') && same('ppt/media/image1.png') && same('ppt/presentation.xml') && same('[Content_Types].xml'));
  check('only the five parts that hold data were rewritten', out.changed.sort().join() === 'ppt/charts/chart1.xml,ppt/charts/chart2.xml,ppt/slides/slide1.xml,ppt/slides/slide2.xml,ppt/slides/slide3.xml', out.changed);
  const again = await patchDeck(out.bytes, deckContent(m, ROWS, ref, { s3Month: '2026-09' }));
  check('patching again with the same data changes nothing (no rewrite loop)', again.changed.length === 0 && again.bytes === out.bytes, again.changed);
  check('keyboard characters only in what the server writes', !/[—–־«»…]/.test(s1 + s2 + s3));

  const long = [row(20, '2026-09-22', 'מעצבים', 'מחסן חומרים מסוכנים', 'מחסן החומרים עמוס - חומרים לא הוחזרו למחסן המרכזי ואינם מאוחסנים על מאצרה', 'גבוהה', null, 'פתוח', null),
    row(21, '2026-09-23', 'מעצבים', 'מסוע אריזה (חיבור שני מסועים - יציאה לרובוט)', 'נקודות צביטה חשופות בחיבור בין שני המסועים ביציאה לרובוט', 'גבוהה', null, 'פתוח', null)];
  const ref2 = '2026-09-29', m2 = { hazards: meetingHazards(long, ref2), accidents: meetingAccidents(INC, ref2) };
  const c2x = deckContent(m2, long, ref2, { s3Month: '2026-09' });
  const it = c2x.s3.high[0].items.map((x) => x.join(''));
  const full = deckContent(m2, [row(40, '2026-09-22', 'ייצור טוגנים', '', 'נקודות צביטה חשופות בחיבור בין שני המסועים ביציאה לרובוט', 'גבוהה', null, 'פתוח', null)], ref2, { s3Month: '2026-09' }).s3.high[0].items[0].join('');
  check('a line as long as the 22/09 deck\'s own (72 characters) is not shortened', full === 'ייצור טוגנים - נקודות צביטה חשופות בחיבור בין שני המסועים ביציאה לרובוט', full);
  check('descriptions: the part before " - " (never inside parentheses), cut at a word, one line with the department', it[0] === 'מעצבים - מחסן חומרים מסוכנים: מחסן החומרים עמוס' && /^מעצבים - נקודות צביטה חשופות/.test(it[1]) && !/\(/.test(it[1]) && it.every((x) => x.length <= 76), it);
  check('new this week, none closed yet: "כולם עדיין פתוחים" (not "0 נסגרו")', c2x.s1.NewNote[0] === '2 מפגעים חדשים, כולם עדיין פתוחים' && c2x.s1.NewNote[1] === 'נפתחו השבוע: מעצבים', c2x.s1.NewNote);
  // 30/09/2026 (Michael: slide 1 said «8 new hazards» when some were closed;
  // chose «all on one line»): what became of them is in the first line.
  const nn = (rs) => deckContent({ hazards: meetingHazards(rs, ref2), accidents: meetingAccidents(INC, ref2) }, rs, ref2, {}).s1.NewNote;
  const wk = (n, dept, s) => row(n, '2026-09-22', dept, '', 'מפגע ' + n, 'בינונית', null, s, s === 'סגור' ? '2026-09-23' : null);
  const mix = [1, 2, 3, 4, 5].map((n) => wk(n, 'מעצבים', 'סגור')).concat([6, 7, 8].map((n) => wk(n, 'חומר גלם', 'פתוח')));
  check('8 new, 5 closed: "8 מפגעים חדשים: 5 נסגרו, 3 פתוחים"', nn(mix)[0] === '8 מפגעים חדשים: 5 נסגרו, 3 פתוחים', nn(mix));
  check('...and the departments on the second line', /^נפתחו השבוע: /.test(nn(mix)[1]) && /מעצבים/.test(nn(mix)[1]) && /חומר גלם/.test(nn(mix)[1]), nn(mix));
  check('all closed: "כולם כבר נסגרו"', nn(mix.slice(0, 5))[0] === '5 מפגעים חדשים, כולם כבר נסגרו', nn(mix.slice(0, 5)));
  check('one of each: "אחד נסגר, אחד פתוח"', nn([mix[0], mix[7]])[0] === '2 מפגעים חדשים: אחד נסגר, אחד פתוח', nn([mix[0], mix[7]]));
  check('a single one: "מפגע חדש אחד, כבר נסגר" / "נפתח השבוע: מעצבים"', nn([mix[0]])[0] === 'מפגע חדש אחד, כבר נסגר' && nn([mix[0]])[1] === 'נפתח השבוע: מעצבים' && nn([mix[7]])[0] === 'מפגע חדש אחד, עדיין פתוח', [nn([mix[0]]), nn([mix[7]])]);
  check('the first line never says "N new" alone when some are closed', !/^\d+ מפגעים חדשים נפתחו השבוע$/.test(nn(mix)[0]));
  check('the high-severity line fits its box (42 characters, like the deck)', c2x.s1.OpenNote[1] === '2 בחומרה גבוהה, מחסן החומרים עמוס' && c2x.s1.OpenNote[1].length <= 42, c2x.s1.OpenNote);

  const manyClosed = ['מעצבים', 'ייצור טוגנים', 'חומר גלם', 'תוצג', 'מעבדות'].map((dp, i) => row(30 + i, '2026-09-01', dp, '', 'x', 'נמוכה', null, 'סגור', '2026-09-1' + i));
  const cc = deckContent({ hazards: meetingHazards(manyClosed, ref2), accidents: meetingAccidents(INC, ref2) }, manyClosed, ref2, { s3Month: '2026-09' });
  const zs3 = setList(slide3, 'HighSevPanel', cc.s3.high, (n) => ['ועוד ' + n + ' מפגעים', ''], []);
  check('closures by department, more than the 3 lines: "ועוד N מחלקות" (not מפגעים)', zs3.includes('<a:t>ועוד 3 מחלקות</a:t>'), zs3.slice(zs3.indexOf('פעולות'), zs3.indexOf('פעולות') + 900));

  // Michael 29/09: a hazard of this week closed since is green, not orange.
  const wkRows = [row(44, '2026-09-22', 'מעצבים', '', 'ג\'ריקן', 'בינונית', null, 'סגור', '2026-09-23'), row(45, '2026-09-22', 'מעצבים', '', 'קופסה', 'בינונית', null, 'פתוח', null),
    row(46, '2026-09-22', 'מעצבים', '', 'ארון', 'בינונית', null, 'סגור', '2026-09-23'), row(7, '2026-09-01', 'מעצבים', '', 'חדר חשמל', 'בינונית', null, 'פתוח', null), row(2, '2026-09-01', 'מעצבים', '', 'ישן', 'בינונית', null, 'סגור', '2026-09-10')];
  const wb = deckContent({ hazards: meetingHazards(wkRows, '2026-09-29'), accidents: meetingAccidents(INC, '2026-09-29') }, wkRows, '2026-09-29', { s3Month: '2026-09' }).s1.bars;
  check('this week\'s closed hazards are counted green (closed), orange = new and still open', wb['סגור']['מעצבים'] === 3 && wb['חדש השבוע']['מעצבים'] === 1 && wb['פתוח']['מעצבים'] === 1 && wb['Totals']['מעצבים'] === 5, wb);

  // slide 3 = monthly (Michael 29/09)
  const noS3 = await patchDeck(src, deckContent(m, ROWS, ref));
  const same3 = (() => { const a = readZip(src).find((e) => e.name === 'ppt/slides/slide3.xml'), b = readZip(noS3.bytes).find((e) => e.name === 'ppt/slides/slide3.xml'); return a.crc === b.crc && Buffer.from(a.raw).equals(Buffer.from(b.raw)); })();
  check('mid-month: slide 3 is left exactly as it is (slides 1-2 still updated)', same3 && noS3.changed.includes('ppt/slides/slide1.xml') && !noS3.changed.includes('ppt/slides/slide3.xml'), noS3.changed);
  const mo = [row(1, '2026-08-10', 'תוצג', '', 'נסגר באוקטובר', 'גבוהה', null, 'סגור', '2026-10-02'), row(2, '2026-08-11', 'תוצג', '', 'נסגר באוגוסט', 'בינונית', null, 'סגור', '2026-08-20'), row(3, '2026-09-05', 'תוצג', '', 'נפתח בספטמבר', 'בינונית', null, 'פתוח', null), row(4, null, 'מעבדות', '', 'ישן בלי תאריך', 'נמוכה', null, 'פתוח', null)];
  const aug = deckContent({ hazards: meetingHazards(mo, '2026-10-06'), accidents: meetingAccidents(INC, '2026-10-06') }, mo, '2026-10-06', { s3Month: '2026-08' }).s3;
  check('the month\'s report is as of its end: closed later = open then, opened after = not counted, no date = counted', aug.Card0[0] === '3' && aug.Card1[0] === '1' && aug.Card2[0] === '2' && aug.Card2[1] === 'פתוחים - 1 בחומרה גבוהה, 1 נמוכה' && aug.high[1].items.join() === 'תוצג: מפגע אחד נסגר', aug);
  check('the closures header names that month', typeof aug.high[1].header === 'function' && aug.high[1].header(' x') === ' פעולות סגירה - אוגוסט 2026 (1)', aug.high[1].header(' x'));

  console.log('\n4. the meeting date');
  check('Sunday to Wednesday: this week\'s Tuesday; Thursday on: next week\'s', defaultMeeting('2026-09-27') === '2026-09-29' && defaultMeeting('2026-09-28') === '2026-09-29' && defaultMeeting('2026-09-30') === '2026-09-29' && defaultMeeting('2026-10-01') === '2026-10-06' && defaultMeeting('2026-10-03') === '2026-10-06');
  check('a date set in the app wins while current (e.g. Wednesday), an old one does not', meetingDate('2026-09-28', '2026-09-30') === '2026-09-30' && meetingDate('2026-10-05', '2026-09-30') === '2026-10-06');

  console.log('\n5. the endpoint');
  const ENV = { SUPABASE_SERVICE_ROLE_KEY: 'srv', ONEDRIVE_CLIENT_ID: 'cid', ONEDRIVE_CLIENT_SECRET: 'cs', TRUSTEE_NOTIFY_SECRET: 'nsec' };
  const HZ = [{ id: 'h1', n: 1, d: '2026-09-14', tour_no: 1, dept: 'ייצור טוגנים', descr: 'x', sev: 'גבוהה', s: 'פתוח' }];
  function world(o) {
    const w = { state: Object.assign({}, o.state || {}), puts: [], file: o.file, cTag: o.cTag || 'c1' };
    globalThis.fetch = async (url, init) => {
      const u = String(url), mth = (init && init.method) || 'GET';
      const json = (x, st = 200) => new Response(JSON.stringify(x), { status: st, headers: { 'Content-Type': 'application/json' } });
      if (u.startsWith(SB + '/auth/v1/user')) return json({ id: 'a', is_anonymous: true });
      if (u.startsWith(SB + '/rest/v1/tour_hazards')) return json(HZ);
      if (u.startsWith(SB + '/rest/v1/trustee_reports') || u.startsWith(SB + '/rest/v1/tasks')) return json([]);
      if (u.startsWith(SB + '/rest/v1/inc')) return json(INC);
      if (u.startsWith(SB + '/rest/v1/server_state')) { if (mth === 'POST') { JSON.parse(init.body).forEach((r) => { w.state[r.key] = r.value; }); return new Response(null, { status: 201 }); } return json(Object.keys(w.state).map((k) => ({ key: k, value: w.state[k] }))); }
      if (u.startsWith(SB + '/rest/v1/oauth_tokens')) return json([{ user_email: 'sviva@tapugan.co.il', refresh_token: 'rt', access_token: 'at', expires_at: new Date(Date.now() + 3600e3).toISOString(), scope: 'Files.ReadWrite' }]);
      if (u.startsWith('https://graph.microsoft.com/') && mth === 'GET') { if (o.missing) return json({}, 404); return json({ cTag: w.cTag, lastModifiedDateTime: '2026-09-22T06:23:00Z', webUrl: 'https://od/deck', '@microsoft.graph.downloadUrl': 'https://dl/deck' }); }
      if (u === 'https://dl/deck') return new Response(w.file, { status: 200 });
      if (u.startsWith('https://graph.microsoft.com/') && mth === 'PUT') {
        if (o.conflict && !/%D7%90%D7%A8%D7%9B%D7%99%D7%95%D7%9F/.test(u)) return json({ error: { code: 'resourceModified', message: 'The resource has changed since the caller last read it' } }, 409);
        if (o.locked && !/%D7%90%D7%A8%D7%9B%D7%99%D7%95%D7%9F/.test(u)) return json({ error: { code: 'resourceLocked' } }, 423);
        w.puts.push({ path: decodeURIComponent(u.split('/root:/')[1]), body: init.body }); return json({ cTag: 'c-ours-' + w.puts.length, webUrl: 'https://od/deck' });
      }
      return json({ error: 'unexpected ' + u }, 599);
    };
    return w;
  }
  let w = world({ file: src });
  let r = await runDeck(ENV, false);
  check('first run: the deck as it was is copied to ארכיון/מצגות, then the updated deck replaces it in folder 13', r.ok && r.pushed && w.puts.length === 2 && /13_סיורי מפגעים\/2026\/ארכיון\/מצגות\/מצגת שבועית\.חודשית - 22-09-2026 09\.23\.pptx/.test(w.puts[0].path) && /13_סיורי מפגעים\/2026\/מצגת שבועית\.חודשית\.pptx:\/content/.test(w.puts[1].path), w.puts.map((p) => p.path));
  const s1st = Object.assign({}, w.state);
  const prevM = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 0)).toISOString().substring(0, 7);
  check('the first run of a month writes slide 3 for the month that ended, and remembers it', w.state.deck_s3_month === prevM && (await partText(w.puts[1].body, 'ppt/slides/slide3.xml')) !== slide3, w.state.deck_s3_month);
  const written = w.puts[1].body;
  w = world({ file: written, state: s1st, cTag: 'c-ours-2' });
  r = await runDeck(ENV, false);
  check('nothing changed since: one metadata read, nothing written', !r.pushed && r.reason === 'unchanged' && !w.puts.length, r);
  w = world({ file: written, state: s1st, cTag: 'bumped-by-onedrive' });
  r = await runDeck(ENV, false);
  check('cTag bumped, the file already up to date: nothing written, cTag remembered (no loop)', !r.pushed && r.reason === 'already up to date' && !w.puts.length && w.state.deck_ctag === 'bumped-by-onedrive', r);
  w = world({ file: src, state: s1st, cTag: 'someone-saved-old' });
  r = await runDeck(ENV, false);
  check('same meeting date, the file changed: rewritten, not archived again', r.pushed && w.puts.length === 1 && !/ארכיון/.test(w.puts[0].path), w.puts.map((p) => p.path));
  // Michael 29/09: slide 3 now, for this month so far, once
  const curM = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jerusalem' }).substring(0, 7);
  w = world({ file: written, state: s1st, cTag: 'c-ours-2' });
  r = await runDeck(ENV, true, curM);
  const s3now = r.pushed && (await partText(w.puts[w.puts.length - 1].body, 'ppt/slides/slide3.xml'));
  const moName = ['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר'][+curM.substring(5) - 1];
  check('slide 3 on request: this month so far, and the month-end write is still due (deck_s3_month kept)', !!s3now && s3now.includes('פעולות סגירה - ' + moName) && !(await partText(written, 'ppt/slides/slide3.xml')).includes('פעולות סגירה - ' + moName) && w.state.deck_s3_month === s1st.deck_s3_month, [r.pushed, w.state.deck_s3_month]);
  w = world({ file: src, locked: true });
  r = await runDeck(ENV, false);
  check('open in PowerPoint (423): a clear message, retried by the next run', !r.ok && r.locked && /המצגת פתוחה/.test(r.error) && w.state.deck_err, r);
  w = world({ file: src, conflict: true });
  r = await runDeck(ENV, false);
  check('a parallel run wrote a moment ago (409): not recorded as an error, retried', !r.ok && r.retry && !w.state.deck_err, [r, w.state.deck_err]);
  w = world({ file: src, missing: true });
  r = await runDeck(ENV, false);
  check('no deck in the folder: says where it looked', !r.ok && /מצגת שבועית\.חודשית\.pptx/.test(r.error), r);
  w = world({ file: src });
  const req = (h, b) => new Request('https://tapugan-safety.pages.dev/api/hazard-deck', { method: 'POST', headers: Object.assign({ 'content-type': 'application/json' }, h), body: JSON.stringify(b || {}) });
  let res = await onRequest({ request: req({ authorization: 'Bearer anon' }, {}), env: ENV });
  check('anonymous: refused', res.status === 401 || res.status === 403, res.status);
  res = await onRequest({ request: req({ 'x-notify-secret': 'nsec' }, {}), env: ENV });
  const j = await res.json();
  check('with the server secret: runs', j.ok && j.pushed, j);

  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('HARNESS ERROR', e); process.exit(2); });
