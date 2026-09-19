const fs = require('fs');
const html = fs.readFileSync(require('path').resolve(__dirname, '../../index.html'), 'utf8');
function esc(s) {
  if (s === undefined || s === null) return '';
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
const src = html.substring(html.indexOf('function _insScoreNum'), html.indexOf('function rIns()'));
const f = new Function('esc', 'return (function(){' + src + 'return {_insScoreNum:_insScoreNum,_insScore:_insScore};})()')(esc);

const cases = [
  [null, 'null'], [undefined, 'undefined'], ['', 'empty str'], ['   ', 'spaces'],
  ['85%', '"85%"'], ['abc', '"abc"'], ['0', '"0"'], ['100', '"100"'],
  ['100.4', '"100.4"'], ['100.6', '"100.6"'], ['-0', '"-0"'], ['-1', '"-1"'],
  [0, '0 (number)'], [85, '85 (number)'], ['1e3', '"1e3"'],
  [NaN, 'NaN'], [Infinity, 'Infinity'], ['<img onerror=x>', 'xss probe'],
];
console.log('--- edge cases ---');
for (const [v, label] of cases) {
  const n = f._insScoreNum(v);
  const h = f._insScore(v);
  const shown = h.replace(/<[^>]*>/g, '') || '(dash)';
  console.log(String(label).padEnd(14) + ' num=' + String(n).padEnd(6) + ' shows=' + shown);
}

console.log('\n--- production ins.sc values ---');
const prod = [['111', 21], ['27', 7], ['-6', 5], ['58', 3], ['135', 2], ['345', 2], ['334', 1], ['1736', 1]];
let ok = 0, dash = 0;
for (const [v, n] of prod) {
  const num = f._insScoreNum(v);
  if (num === null) dash += n; else ok += n;
  console.log(v.padEnd(6) + ' x' + String(n).padEnd(3) + ' -> ' + (num === null ? '— (hidden)' : num + '%'));
}
console.log('rows showing a real score: ' + ok + ' | rows showing — : ' + dash);

console.log('\n--- xss check on the tooltip ---');
console.log(f._insScore('<img src=x onerror=alert(1)>'));
