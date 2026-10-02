// CLAUDE.md: text shown to people uses only keyboard characters, no long
// dash. The toast messages carried 50 of them (02/10/2026, Michael saw
// "שדות מלאים — לא נדרש"). Every string literal from toast( to the end of
// its line is checked, escaped or raw.
const fs = require('fs');
const path = require('path');
const src = fs.readFileSync(path.resolve(__dirname, '../../index.html'), 'utf8');
let pass = 0, fail = 0;
const check = (l, c, d) => { if (c) { pass++; console.log('  ✓ ' + l); } else { fail++; console.log('  ✗ ' + l + (d !== undefined ? '  -> ' + JSON.stringify(d) : '')); } };
const bad = [];
src.split('\n').forEach((l, i) => {
  const k = l.indexOf('toast(');
  if (k < 0) return;
  const strs = l.slice(k).match(/'(?:[^'\\]|\\.)*'/g) || [];
  if (strs.some((s) => s.includes('\\u2014') || s.includes('—'))) bad.push(i + 1);
});
check('no long dash in a toast message', bad.length === 0, bad.slice(0, 10));
console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
