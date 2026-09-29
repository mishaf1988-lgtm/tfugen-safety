// Update the EXISTING committee deck in place (28/09, Michael: "the existing
// presentation must be updated from the data, looking exactly the same, the
// same design, by itself, in its folder"). DECISIONS 2026-09-28.
//
// Only numbers and the few data texts change. Every other byte of the deck is
// copied as it is (readZip/writeZip: untouched entries keep their compressed
// bytes). Shapes are found by the names the deck gives them (ClosedNote,
// DaysSafeText, HighSevPanel ...). Inside a paragraph the runs are kept: when
// the new text has the same shape as the old one apart from its numbers, only
// the digits are replaced run by run (so a bold number keeps its size and
// colour); otherwise the text goes into the first run and the others are
// dropped. List items are cloned from the deck's own first item, so a new line
// looks like the old ones; a list longer than the deck had room for ends with
// "\u05d5\u05e2\u05d5\u05d3 N" instead of spilling out of its box. Slide 4 (near misses) is not
// touched. A shape or part that is missing is skipped and reported, never
// invented.
import { readZip, writeZip, entryText } from './_xlsxpatch.js';

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const unesc = (s) => String(s).replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
const RUN = /<a:r>([\s\S]*?)<a:t>([\s\S]*?)<\/a:t><\/a:r>/g;
const skel = (t) => String(t).replace(/\d+/g, '#');

// One <a:p>: new = function(oldText) -> newText, or a string, or an array of
// run texts (used as is when the paragraph has that many runs).
export function patchPara(p, next) {
  const runs = []; let m; RUN.lastIndex = 0;
  while ((m = RUN.exec(p))) runs.push({ all: m[0], pr: m[1], t: unesc(m[2]) });
  if (!runs.length) return p;
  const old = runs.map((r) => r.t).join('');
  if (Array.isArray(next) && next.length === runs.length) {
    let i = 0;
    return p.replace(RUN, (all, pr) => '<a:r>' + pr + '<a:t>' + esc(next[i++]) + '</a:t></a:r>');
  }
  const nt = Array.isArray(next) ? next.join('') : typeof next === 'function' ? next(old) : String(next);
  if (nt === old) return p;
  // Digits only when each number sits whole in one run (PowerPoint may split
  // "12" into "1" + "2"; 28/09 review).
  const groups = runs.reduce((n, r) => n + (r.t.match(/\d+/g) || []).length, 0);
  if (skel(nt) === skel(old) && groups === (nt.match(/\d+/g) || []).length) {
    const nums = nt.match(/\d+/g) || []; let k = 0;
    return p.replace(RUN, (all, pr, t) => '<a:r>' + pr + '<a:t>' + esc(unesc(t).replace(/\d+/g, () => nums[k++])) + '</a:t></a:r>');
  }
  let first = true;
  return p.replace(RUN, (all, pr) => { if (!first) return ''; first = false; return '<a:r>' + pr + '<a:t>' + esc(nt) + '</a:t></a:r>'; });
}
const paraText = (p) => { let t = ''; let m; RUN.lastIndex = 0; while ((m = RUN.exec(p))) t += unesc(m[2]); return t; };

function findShape(xml, name) {
  const re = /<p:sp>[\s\S]*?<\/p:sp>/g; let m;
  while ((m = re.exec(xml))) if (m[0].indexOf('name="' + name + '"') >= 0) return { start: m.index, end: m.index + m[0].length, xml: m[0] };
  return null;
}
function splitParas(sp) {
  const i = sp.indexOf('<p:txBody>'), j = sp.lastIndexOf('</p:txBody>');
  if (i < 0 || j < 0) return null;
  const body = sp.substring(i, j), paras = [];
  const re = /<a:p>[\s\S]*?<\/a:p>|<a:p\/>/g; let m, last = 0, head = null;
  while ((m = re.exec(body))) { if (head == null) head = body.substring(0, m.index); paras.push(m[0]); last = m.index + m[0].length; }
  return { pre: sp.substring(0, i) + (head || ''), paras, post: body.substring(last) + sp.substring(j) };
}
// Set paragraphs by index: list[i] = next (see patchPara) or undefined to keep.
export function setShape(xml, name, list, report) {
  const s = findShape(xml, name); if (!s) { report.push('missing shape ' + name); return xml; }
  const sp = splitParas(s.xml); if (!sp) return xml;
  const paras = sp.paras.map((p, i) => (list[i] === undefined ? p : patchPara(p, list[i])));
  return xml.substring(0, s.start) + sp.pre + paras.join('') + sp.post + xml.substring(s.end);
}
// A shape holding sections: [{match: RegExp on the header text, header: next,
// items: [next...], empty: text}]. Items are cloned from the section's first
// item; at most as many as the deck had (the last one then says "\u05d5\u05e2\u05d5\u05d3 N").
export function setList(xml, name, sections, more, report) {
  const s = findShape(xml, name); if (!s) { report.push('missing shape ' + name); return xml; }
  const sp = splitParas(s.xml); if (!sp) return xml;
  const heads = sections.map((sec) => sp.paras.findIndex((p) => sec.match.test(paraText(p))));
  if (heads.some((h) => h < 0)) { report.push('missing section in ' + name); return xml; }
  const order = heads.map((h, k) => ({ h, k })).sort((a, b) => a.h - b.h);
  const out = sp.paras.slice(0, order[0].h);
  order.forEach(({ h, k }, n) => {
    const end = n + 1 < order.length ? order[n + 1].h : sp.paras.length;
    const sec = sections[k], tmpl = sp.paras[h + 1] && h + 1 < end ? sp.paras[h + 1] : null;
    out.push(patchPara(sp.paras[h], sec.header));
    if (!tmpl) return;
    // The room never shrinks: unused lines stay as empty lines with the
    // item's runs, and sec.room (the deck's own first layout) is the floor
    // (28/09 review: a week with 0 items used to leave one line for good).
    const room = Math.max(1, end - h - 1, sec.room || 0);
    const nRuns = (tmpl.match(/<a:r>/g) || []).length;
    const asRuns = (it) => (Array.isArray(it) ? it : nRuns > 1 ? [String(it)].concat(Array(nRuns - 1).fill('')) : it);
    let items = sec.items.length ? sec.items.slice() : [sec.empty];
    if (items.length > room) { const rest = items.length - (room - 1); items = items.slice(0, room - 1).concat([(sec.more || more)(rest)]); }
    items.forEach((it) => out.push(patchPara(tmpl, asRuns(it))));
    for (let q = items.length; q < room; q++) out.push(patchPara(tmpl, Array(nRuns).fill('')));
  });
  return xml.substring(0, s.start) + sp.pre + out.join('') + sp.post + xml.substring(s.end);
}

const pts = (vals) => '<c:ptCount val="' + vals.length + '"/>' + vals.map((v, i) => '<c:pt idx="' + i + '"><c:v>' + esc(v) + '</c:v></c:pt>').join('');
// Stacked bar by department: series values by the chart's own category order.
export function setBars(xml, bySeries, maxAxis, report) {
  let n = 0;
  xml = xml.replace(/<c:ser>[\s\S]*?<\/c:ser>/g, (ser) => {
    const name = unesc((/<c:tx>\s*(?:<c:strRef>[\s\S]*?<c:v>|<c:v>)([\s\S]*?)<\/c:v>/.exec(ser) || [])[1] || '');
    const vals = bySeries[name]; if (!vals) { report.push('chart series not updated: ' + name); return ser; }
    const cats = []; const cr = /<c:pt idx="(\d+)">\s*<c:v>([\s\S]*?)<\/c:v>/g; const cs = (/<c:cat>([\s\S]*?)<\/c:cat>/.exec(ser) || [])[1] || ''; let m;
    while ((m = cr.exec(cs))) cats[+m[1]] = unesc(m[2]);
    n++;
    return ser.replace(/(<c:val>[\s\S]*?<c:numLit>(?:<c:formatCode>[\s\S]*?<\/c:formatCode>)?)[\s\S]*?(<\/c:numLit>)/, (all, a, b) => a + pts(cats.map((c) => (vals[c] == null ? 0 : vals[c]))) + b);
  });
  if (maxAxis != null) xml = xml.replace(/(<c:valAx>[\s\S]*?<c:scaling>[\s\S]*?)<c:max val="[^"]*"\/>/, '$1<c:max val="' + maxAxis + '"/>');
  if (!n) report.push('no chart series updated');
  return xml;
}
// A single-series line: categories and values rebuilt.
export function setLine(xml, cats, vals, report) {
  if (!/<c:ser>/.test(xml)) { report.push('line chart has no series'); return xml; }
  return xml.replace(/(<c:cat>\s*<c:strLit>)[\s\S]*?(<\/c:strLit>)/, (a, x, y) => x + pts(cats) + y)
    .replace(/(<c:val>\s*<c:numLit>(?:<c:formatCode>[\s\S]*?<\/c:formatCode>)?)[\s\S]*?(<\/c:numLit>)/, (a, x, y) => x + pts(vals) + y);
}

// ---- the deck's content, from the meeting data ----
const ddmm = (ymd) => ymd.substring(8, 10) + '/' + ymd.substring(5, 7);
const HEB_MONTHS = ['\u05d9\u05e0\u05d5\u05d0\u05e8', '\u05e4\u05d1\u05e8\u05d5\u05d0\u05e8', '\u05de\u05e8\u05e5', '\u05d0\u05e4\u05e8\u05d9\u05dc', '\u05de\u05d0\u05d9', '\u05d9\u05d5\u05e0\u05d9', '\u05d9\u05d5\u05dc\u05d9', '\u05d0\u05d5\u05d2\u05d5\u05e1\u05d8', '\u05e1\u05e4\u05d8\u05de\u05d1\u05e8', '\u05d0\u05d5\u05e7\u05d8\u05d5\u05d1\u05e8', '\u05e0\u05d5\u05d1\u05de\u05d1\u05e8', '\u05d3\u05e6\u05de\u05d1\u05e8'];
// Michael, 28/09: 2024 stays 9 as in the deck (the 2024 file has 14 rows).
export const FIXED_YEARS = { 2024: 9 };

// m = /api/meeting-data result for the meeting date; rows = register rows
// (for the open lists and the month's closures).
export function deckContent(m, rows, meetingDate) {
  const h = m.hazards, a = m.accidents;
  const y = meetingDate.substring(0, 4), month = meetingDate.substring(0, 7);
  const by = {}; h.byDept.forEach((d) => { by[d.dept] = d; });
  const listDepts = (k) => h.byDept.filter((d) => d[k] > 0).sort((p, q) => q[k] - p[k]).map((d) => d.dept);
  const open = rows.filter((r) => r[10] !== '\u05e1\u05d2\u05d5\u05e8');
  const sevOf = (s) => open.filter((r) => r[6] === s);
  const d10 = (v) => (v && typeof v === 'object' ? v.date : v) || '';
  const oldestHigh = sevOf('\u05d2\u05d1\u05d5\u05d4\u05d4').slice().sort((p, q) => String(d10(p[1]) || '9').localeCompare(String(d10(q[1]) || '9')))[0];
  // Short, like the hand-written deck: the part of a description before its
  // " - " (the hazard, not the explanation), cut at a word, never mid-word.
  const short = (t, n) => {
    t = String(t || '').replace(/\s+/g, ' ').trim();
    if (t.length <= n) return t;
    const cut = t.substring(0, n - 3); const sp = cut.lastIndexOf(' ');
    return (sp > n / 2 ? cut.substring(0, sp) : cut).replace(/[\s,:;-]+$/, '') + '...';
  };
  // Never inside parentheses: "מסוע (חיבור שני מסועים - יציאה)" stays whole.
  const head = (t) => {
    t = String(t || ''); let depth = 0;
    for (let i = 0; i < t.length; i++) {
      const ch = t[i];
      if (ch === '(') depth++; else if (ch === ')') depth = Math.max(0, depth - 1);
      else if (!depth && t.substr(i, 3) === ' - ') return t.substring(0, i).trim();
    }
    return t.trim();
  };
  // One line in its box, like the deck's own items: n counts the department.
  // 76 = the longest one-line item of the 22/09 deck (Chrome check 29/09).
  // The hazard matters more than where: a location that does not fit with it is left out.
  const item = (r, n) => {
    const room = Math.max(20, n - String(r[3] || '').length - 3), d = head(r[5]), l = r[4] ? head(r[4]) : '';
    return [r[3], ' - ' + short(l && (l + ': ' + d).length <= room ? l + ': ' + d : d, room)];
  };
  const closedMonth = {}; rows.forEach((r) => { if (d10(r[11]).substring(0, 7) === month) closedMonth[r[3]] = (closedMonth[r[3]] || 0) + 1; });
  const closedList = Object.keys(closedMonth).sort((p, q) => closedMonth[q] - closedMonth[p]).map((d) => d + ': ' + (closedMonth[d] === 1 ? '\u05de\u05e4\u05d2\u05e2 \u05d0\u05d7\u05d3 \u05e0\u05e1\u05d2\u05e8' : closedMonth[d] + ' \u05de\u05e4\u05d2\u05e2\u05d9\u05dd \u05e0\u05e1\u05d2\u05e8\u05d5'));
  const nClosedMonth = Object.values(closedMonth).reduce((s, x) => s + x, 0);
  const maxTotal = h.byDept.reduce((s, d) => Math.max(s, d.total), 0);
  const inWeek = a.inWeek || 0;
  const nw = h.total.newThisWeek, nc = h.summary.newClosed, no = h.summary.newStillOpen;
  const hi = sevOf('\u05d2\u05d1\u05d5\u05d4\u05d4').length, med = sevOf('\u05d1\u05d9\u05e0\u05d5\u05e0\u05d9\u05ea').length, low = sevOf('\u05e0\u05de\u05d5\u05db\u05d4').length;
  const last = a.lastAccident;
  return {
    s1: {
      Header: [(t) => t.replace(/20\d{2}/, y).replace(/\d{2}\.\d{2}\.\d{4}/, meetingDate.substring(8, 10) + '.' + meetingDate.substring(5, 7) + '.' + y)],
      ClosedNote: [h.total.closedThisWeek === 1 ? '\u05de\u05e4\u05d2\u05e2 \u05d0\u05d7\u05d3 \u05e0\u05e1\u05d2\u05e8 \u05d4\u05e9\u05d1\u05d5\u05e2' : h.total.closedThisWeek ? h.total.closedThisWeek + ' \u05de\u05e4\u05d2\u05e2\u05d9\u05dd \u05e0\u05e1\u05d2\u05e8\u05d5 \u05d4\u05e9\u05d1\u05d5\u05e2' : '\u05dc\u05d0 \u05e0\u05e1\u05d2\u05e8\u05d5 \u05de\u05e4\u05d2\u05e2\u05d9\u05dd \u05d4\u05e9\u05d1\u05d5\u05e2', listDepts('closedThisWeek').join(', ') || '-'],
      OpenNote: [h.summary.openNow + ' \u05de\u05e4\u05d2\u05e2\u05d9\u05dd \u05e4\u05ea\u05d5\u05d7\u05d9\u05dd, \u05d4\u05d8\u05d9\u05e4\u05d5\u05dc \u05e0\u05de\u05e9\u05da', hi ? (hi === 1 ? '\u05d0\u05d7\u05d3' : hi) + ' \u05d1\u05d7\u05d5\u05de\u05e8\u05d4 \u05d2\u05d1\u05d5\u05d4\u05d4, ' + short(head(oldestHigh[5]), 42 - String(hi).length - 15) : '\u05d0\u05d9\u05df \u05de\u05e4\u05d2\u05e2\u05d9\u05dd \u05e4\u05ea\u05d5\u05d7\u05d9\u05dd \u05d1\u05d7\u05d5\u05de\u05e8\u05d4 \u05d2\u05d1\u05d5\u05d4\u05d4'],
      NewNote: [nw === 1 ? '\u05de\u05e4\u05d2\u05e2 \u05d7\u05d3\u05e9 \u05d0\u05d7\u05d3 \u05e0\u05e4\u05ea\u05d7 \u05d4\u05e9\u05d1\u05d5\u05e2' : nw ? nw + ' \u05de\u05e4\u05d2\u05e2\u05d9\u05dd \u05d7\u05d3\u05e9\u05d9\u05dd \u05e0\u05e4\u05ea\u05d7\u05d5 \u05d4\u05e9\u05d1\u05d5\u05e2' : '\u05dc\u05d0 \u05e0\u05e4\u05ea\u05d7\u05d5 \u05de\u05e4\u05d2\u05e2\u05d9\u05dd \u05d7\u05d3\u05e9\u05d9\u05dd \u05d4\u05e9\u05d1\u05d5\u05e2',
        nw ? listDepts('newThisWeek').join(', ') + ', ' + (!nc ? '\u05db\u05d5\u05dc\u05dd \u05e2\u05d3\u05d9\u05d9\u05df \u05e4\u05ea\u05d5\u05d7\u05d9\u05dd' : !no ? '\u05db\u05d5\u05dc\u05dd \u05db\u05d1\u05e8 \u05e0\u05e1\u05d2\u05e8\u05d5' : (nc === 1 ? '\u05d0\u05d7\u05d3 \u05e0\u05e1\u05d2\u05e8' : nc + ' \u05e0\u05e1\u05d2\u05e8\u05d5') + ' \u05d5' + (no === 1 ? '\u05d0\u05d7\u05d3 \u05e0\u05d5\u05ea\u05e8 \u05e4\u05ea\u05d5\u05d7' : '-' + no + ' \u05e0\u05d5\u05ea\u05e8\u05d5 \u05e4\u05ea\u05d5\u05d7\u05d9\u05dd')) : '-'],
      bars: {
        '\u05e1\u05d2\u05d5\u05e8': Object.fromEntries(h.byDept.map((d) => [d.dept, d.closed - d.newClosed])),
        '\u05e4\u05ea\u05d5\u05d7': Object.fromEntries(h.byDept.map((d) => [d.dept, d.openPrior])),
        '\u05d7\u05d3\u05e9 \u05d4\u05e9\u05d1\u05d5\u05e2': Object.fromEntries(h.byDept.map((d) => [d.dept, d.newThisWeek])),
        'Totals': Object.fromEntries(h.byDept.map((d) => [d.dept, d.total])),
      },
      axisMax: Math.max(1, Math.ceil(maxTotal * 1.25 * 10) / 10),
    },
    s2: {
      Header: [(t) => t.replace(/20\d{2}/, y)],
      NoAccBadge: ['\u05e1\u05d4"\u05db ' + a.summary.total + ' \u05ea\u05d0\u05d5\u05e0\u05d5\u05ea \u05e2\u05d1\u05d5\u05d3\u05d4 \u05d1-' + y,
        a.summary.reported + ' \u05de\u05d3\u05d5\u05d5\u05d7\u05d5\u05ea, ' + a.summary.notReported + ' \u05dc\u05d0 \u05de\u05d3\u05d5\u05d5\u05d7\u05d5\u05ea',
        last ? '\u05d0\u05d7\u05e8\u05d5\u05e0\u05d4: ' + ddmm(last.date) + (last.dept ? ', ' + last.dept : '') + ', ' + short(last.shortDescription, 40) : '\u05d0\u05d9\u05df \u05ea\u05d0\u05d5\u05e0\u05d5\u05ea \u05d4\u05e9\u05e0\u05d4',
        last ? (last.offSite ? '\u05de\u05d7\u05d5\u05e5 \u05dc\u05e9\u05d8\u05d7 \u05d4\u05de\u05e4\u05e2\u05dc - ' + short(last.location, 30) : '\u05d1\u05e9\u05d8\u05d7 \u05d4\u05de\u05e4\u05e2\u05dc - ' + short(last.location, 30)) : '-'],
      Y2026Box: [(t) => t.replace(/20\d{2}/, y), String(a.summary.total)],
      DaysSafeText: [String(a.daysSinceLastAccident == null ? '-' : a.daysSinceLastAccident)],
      NoChangeNote: [inWeek ? (inWeek === 1 ? '\u05ea\u05d0\u05d5\u05e0\u05d4 \u05d0\u05d7\u05ea \u05d1\u05e9\u05d1\u05d5\u05e2 \u05e9\u05e2\u05d1\u05e8' : inWeek + ' \u05ea\u05d0\u05d5\u05e0\u05d5\u05ea \u05d1\u05e9\u05d1\u05d5\u05e2 \u05e9\u05e2\u05d1\u05e8') : '\u05dc\u05dc\u05d0 \u05e9\u05d9\u05e0\u05d5\u05d9, \u05dc\u05dc\u05d0 \u05d0\u05d9\u05e8\u05d5\u05e2\u05d9\u05dd \u05de\u05e9\u05d1\u05d5\u05e2 \u05e9\u05e2\u05d1\u05e8'],
      line: {
        cats: [String(+y - 2), String(+y - 1)].concat(a.byMonth.map((x) => x.month)),
        vals: [FIXED_YEARS[+y - 2] != null ? FIXED_YEARS[+y - 2] : a.byYear[+y - 2] || 0, FIXED_YEARS[+y - 1] != null ? FIXED_YEARS[+y - 1] : a.byYear[+y - 1] || 0].concat(a.byMonth.map((x) => x.count)),
      },
    },
    s3: {
      Card0: [String(h.total.total)],
      Card1: [String(h.total.closed)],
      Card2: [String(h.total.open), '\u05e4\u05ea\u05d5\u05d7\u05d9\u05dd - ' + [hi ? hi + ' \u05d1\u05d7\u05d5\u05de\u05e8\u05d4 \u05d2\u05d1\u05d5\u05d4\u05d4' : '', med ? med + ' \u05d1\u05d9\u05e0\u05d5\u05e0\u05d9\u05ea' : '', low ? low + ' \u05e0\u05de\u05d5\u05db\u05d4' : ''].filter(Boolean).join(', ')],
      high: [{ match: /^\u05de\u05e4\u05d2\u05e2\u05d9\u05dd \u05e4\u05ea\u05d5\u05d7\u05d9\u05dd \u05d1\u05d7\u05d5\u05de\u05e8\u05d4 \u05d2\u05d1\u05d5\u05d4\u05d4/, header: '\u05de\u05e4\u05d2\u05e2\u05d9\u05dd \u05e4\u05ea\u05d5\u05d7\u05d9\u05dd \u05d1\u05d7\u05d5\u05de\u05e8\u05d4 \u05d2\u05d1\u05d5\u05d4\u05d4 (' + hi + ')', items: sevOf('\u05d2\u05d1\u05d5\u05d4\u05d4').map((r) => item(r, 76)), empty: '\u05d0\u05d9\u05df', room: 5 },
        { match: /\u05e4\u05e2\u05d5\u05dc\u05d5\u05ea \u05e1\u05d2\u05d9\u05e8\u05d4/, header: (t) => (/^\s/.test(t) ? ' ' : '') + '\u05e4\u05e2\u05d5\u05dc\u05d5\u05ea \u05e1\u05d2\u05d9\u05e8\u05d4 - ' + HEB_MONTHS[+month.substring(5, 7) - 1] + ' ' + y + ' (' + nClosedMonth + ')', items: closedList, empty: '\u05dc\u05d0 \u05e0\u05e1\u05d2\u05e8\u05d5 \u05de\u05e4\u05d2\u05e2\u05d9\u05dd \u05d4\u05d7\u05d5\u05d3\u05e9', room: 3, more: (n) => ['\u05d5\u05e2\u05d5\u05d3 ' + n + ' \u05de\u05d7\u05dc\u05e7\u05d5\u05ea', ''] }],
      med: [{ match: /^\u05de\u05e4\u05d2\u05e2\u05d9\u05dd \u05e4\u05ea\u05d5\u05d7\u05d9\u05dd \u05d1\u05d7\u05d5\u05de\u05e8\u05d4 \u05d1\u05d9\u05e0\u05d5\u05e0\u05d9\u05ea/, header: '\u05de\u05e4\u05d2\u05e2\u05d9\u05dd \u05e4\u05ea\u05d5\u05d7\u05d9\u05dd \u05d1\u05d7\u05d5\u05de\u05e8\u05d4 \u05d1\u05d9\u05e0\u05d5\u05e0\u05d9\u05ea (' + med + ')', items: sevOf('\u05d1\u05d9\u05e0\u05d5\u05e0\u05d9\u05ea').map((r) => item(r, 76)), empty: '\u05d0\u05d9\u05df', room: 12 }],
    },
  };
}

const SLIDE = (n) => 'ppt/slides/slide' + n + '.xml';
export async function patchDeck(bytes, c) {
  const entries = readZip(bytes), report = [];
  const get = (n) => entries.find((e) => e.name === n);
  const changed = [];
  const edit = async (name, fn) => { const e = get(name); if (!e) { report.push('missing part ' + name); return; } const old = await entryText(e); const nt = fn(old); if (nt !== old) { e.text = nt; changed.push(name); } };
  const shapes = (xml, obj) => { Object.keys(obj).forEach((k) => { if (Array.isArray(obj[k])) xml = setShape(xml, k, obj[k], report); }); return xml; };
  const more = (n) => ['\u05d5\u05e2\u05d5\u05d3 ' + n + ' \u05de\u05e4\u05d2\u05e2\u05d9\u05dd', ''];
  await edit(SLIDE(1), (x) => shapes(x, { Header: c.s1.Header, ClosedNote: c.s1.ClosedNote, OpenNote: c.s1.OpenNote, NewNote: c.s1.NewNote }));
  await edit('ppt/charts/chart1.xml', (x) => setBars(x, c.s1.bars, c.s1.axisMax, report));
  await edit(SLIDE(2), (x) => shapes(x, { Header: c.s2.Header, NoAccBadge: c.s2.NoAccBadge, Y2026Box: c.s2.Y2026Box, DaysSafeText: c.s2.DaysSafeText, NoChangeNote: c.s2.NoChangeNote }));
  await edit('ppt/charts/chart2.xml', (x) => setLine(x, c.s2.line.cats, c.s2.line.vals, report));
  await edit(SLIDE(3), (x) => {
    x = shapes(x, { Card0: c.s3.Card0, Card1: c.s3.Card1, Card2: c.s3.Card2 });
    x = setList(x, 'HighSevPanel', c.s3.high, more, report);
    return setList(x, 'MedSevPanel', c.s3.med, more, report);
  });
  return { bytes: changed.length ? await writeZip(entries) : bytes, report, changed };
}
