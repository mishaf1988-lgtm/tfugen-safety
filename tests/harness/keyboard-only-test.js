// CLAUDE.md: text people see uses keyboard characters only. Michael asked on
// 02/10/2026 ("כן") to drop the long dash everywhere in the app, not only in
// toasts. This test reads index.html and fails on a long or en dash in: HTML
// text and attributes, HTML entities, JS string literals. Comments (HTML,
// CSS, JS) are not shown to anyone and are left alone.
// 02/10/2026 (this PR): also the other characters CLAUDE.md names: guillemets, curly
// quotes, the one-character ellipsis and the Hebrew maqaf. 03/10/2026: the middle dot too
// (see below); the arrows stay as button icons.
const fs = require('fs');
const path = require('path');
const src = fs.readFileSync(path.resolve(__dirname, '../../index.html'), 'utf8');
let pass = 0, fail = 0;
const check = (l, c, d) => { if (c) { pass++; console.log('  ✓ ' + l); } else { fail++; console.log('  ✗ ' + l + (d !== undefined ? '  -> ' + JSON.stringify(d) : '')); } };
const BAD = /—|–|\\u2014|\\u2013|&#8212;|&#8211;|&mdash;|&ndash;|«|»|\\u00ab|\\u00bb|&laquo;|&raquo;|&#171;|&#187;|\u201c|\u201d|\u2018|\u2019|\\u201[89cd]|&[lr][sd]quo;|&#821[6789];|\u2026|\\u2026|&hellip;|&#8230;|\u05be|\\u05be|&#1470;/;
const lineOf = (idx) => src.slice(0, idx).split('\n').length;
const hits = { html: [], js: [], mid: [] };
const parts = src.split(/(<script\b[^>]*>[\s\S]*?<\/script>)/);
let pos = 0;
for (const part of parts) {
  if (part.startsWith('<script')) {
    const segs = part.split(/(\/\*[\s\S]*?\*\/)/);
    let p2 = pos;
    for (const sg of segs) {
      if (!sg.startsWith('/*')) {
        const re = /'(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"|`(?:[^`\\]|\\.)*`/g;
        let m; while ((m = re.exec(sg))) { if (BAD.test(m[0])) hits.js.push(lineOf(p2 + m.index)); if (/·|\\u00b7|&middot;|&#183;/.test(m[0])) hits.mid.push(lineOf(p2 + m.index)); }
      }
      p2 += sg.length;
    }
  } else {
    const segs = part.split(/(<!--[\s\S]*?-->|<style\b[^>]*>[\s\S]*?<\/style>)/);
    let p2 = pos;
    for (const sg of segs) {
      if (!sg.startsWith('<!--') && !sg.startsWith('<style')) {
        const re = new RegExp(BAD.source, 'g'); let m; while ((m = re.exec(sg))) hits.html.push(lineOf(p2 + m.index));
        const rm = /·|&middot;|&#183;/g; let mm; while ((mm = rm.exec(sg))) hits.mid.push(lineOf(p2 + mm.index));
      }
      p2 += sg.length;
    }
  }
  pos += part.length;
}
const uniq = (a) => Array.from(new Set(a));
check('no long dash, guillemet, curly quote, ellipsis or maqaf in HTML text, attributes or entities', hits.html.length === 0, uniq(hits.html).slice(0, 15));
check('no long dash, guillemet, curly quote, ellipsis or maqaf in a JS string literal', hits.js.length === 0, uniq(hits.js).slice(0, 15));
// Michael, 03/10/2026 ("כן"): the middle dot goes too. Lines that read or write it as a DATA
// separator stay (trustee_reports.loc 'area · detail', mgr_note 'לא רלוונטי: ... · ...'):
// old rows in the DB carry it, so the parser must keep finding it.
const MID = /·|\\u00b7|&middot;|&#183;/;
const DATA_LINE = /^\s*\/\/|split\(|indexOf\(|replace\(\/|loc:loc\+|data format/;
const lines = src.split('\n');
const midHits = uniq(hits.mid).filter((ln) => !DATA_LINE.test(lines[ln - 1]));
check('no middle dot in text people see (data-format lines excepted)', midHits.length === 0, midHits.slice(0, 15));
check('the empty-date helper fd() shows a plain dash', /function fd\(d\)\{if\(!d\)return '-';/.test(src));
console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
