// CLAUDE.md: text people read uses keyboard characters only (Michael,
// 2026-09-21). keyboard-only-test.js covers index.html; this one covers the
// server: every string literal in functions/api/*.js (email subjects and
// bodies, WhatsApp text, error and status messages, HTML the server returns).
// Comments are skipped, they are never shown to anyone. The middle dot is
// still allowed, pending Michael's answer.
// Checks: long dash, en dash, guillemets, curly quotes, arrows, one-character
// ellipsis - as the raw character, as a \uXXXX escape, or as an HTML entity.
const fs = require('fs');
const path = require('path');
const dir = path.resolve(__dirname, '../../functions/api');
let pass = 0, fail = 0;
const check = (l, c, d) => { if (c) { pass++; console.log('  ok ' + l); } else { fail++; console.log('  FAIL ' + l + (d !== undefined ? '  -> ' + JSON.stringify(d) : '')); } };

const BAD = new RegExp([
  '[\\u2014\\u2013\\u00ab\\u00bb\\u201c\\u201d\\u2018\\u2019\\u2192\\u2190\\u2026]',
  '\\\\u(?:2014|2013|00[aA][bB]|00[bB][bB]|201[cCdD89]|219[02]|2026)',
  '&(?:mdash|ndash|laquo|raquo|[lr][sd]quo|rarr|larr|hellip);',
  '&#(?:8212|8211|171|187|821[6-9]|8594|8592|8230);'
].join('|'));

// Returns [{ text, line }] for every string literal ('...', "...", `...`).
// Template literals are scanned as text, with ${ ... } expressions recursed
// into as code. Comments are skipped. Regex literals are skipped by the usual
// heuristic: a / where an operand cannot end is a regex.
function strings(src) {
  const out = [];
  let i = 0, line = 1;
  const n = src.length;
  let prevSig = ''; // last significant character outside strings/comments
  const advance = (k) => { for (let j = 0; j < k; j++) if (src[i + j] === '\n') line++; i += k; };
  function quoted(q) {
    const start = line; let s = '';
    advance(1);
    while (i < n && src[i] !== q) {
      if (src[i] === '\\') { s += src.slice(i, i + 2); advance(2); continue; }
      if (src[i] === '\n') break; // unterminated, stop
      s += src[i]; advance(1);
    }
    advance(1);
    out.push({ text: s, line: start });
  }
  function template() {
    let start = line, s = '';
    advance(1);
    while (i < n && src[i] !== '`') {
      if (src[i] === '\\') { s += src.slice(i, i + 2); advance(2); continue; }
      if (src[i] === '$' && src[i + 1] === '{') {
        out.push({ text: s, line: start }); s = '';
        advance(2); code(true); start = line; continue;
      }
      s += src[i]; advance(1);
    }
    advance(1);
    out.push({ text: s, line: start });
  }
  function code(inExpr) {
    let depth = 0;
    while (i < n) {
      const c = src[i], d = src[i + 1];
      if (c === '/' && d === '/') { while (i < n && src[i] !== '\n') advance(1); continue; }
      if (c === '/' && d === '*') { const e = src.indexOf('*/', i + 2); advance((e < 0 ? n : e + 2) - i); continue; }
      if (c === "'" || c === '"') { quoted(c); prevSig = 'a'; continue; }
      if (c === '`') { template(); prevSig = 'a'; continue; }
      if (c === '/' && (prevSig === '' || /[(,=:[!&|?{};+\-*%<>~^]/.test(prevSig) || /\b(return|typeof|case|in|of|delete|void|throw|new)\s*$/.test(src.slice(Math.max(0, i - 10), i)))) {
        advance(1); let cls = false;
        while (i < n && src[i] !== '\n') {
          if (src[i] === '\\') { advance(2); continue; }
          if (src[i] === '[') cls = true; else if (src[i] === ']') cls = false;
          else if (src[i] === '/' && !cls) break;
          advance(1);
        }
        advance(1); prevSig = 'a'; continue;
      }
      if (inExpr) {
        if (c === '{') depth++;
        else if (c === '}') { if (depth === 0) { advance(1); return; } depth--; }
      }
      if (!/\s/.test(c)) prevSig = c;
      advance(1);
    }
  }
  code(false);
  return out;
}

// The scanner must see strings and must not see comments.
{
  const s = strings("// a — b\n/* c — */ const x = 'p — q'; const r = /'/g; const t = `a ${'b'} —`;");
  check('scanner: finds the string, skips both comments', s.some(o => o.text === 'p — q') && !s.some(o => / a | c /.test(o.text)), s);
  check('scanner: a regex with a quote does not open a string', s.some(o => o.text === 'b') && s.some(o => /—$/.test(o.text)), s);
}

const files = fs.readdirSync(dir).filter(f => f.endsWith('.js')).sort();
check('there are server files to scan', files.length > 5, files.length);
const hits = [];
for (const f of files) {
  const src = fs.readFileSync(path.join(dir, f), 'utf8');
  for (const s of strings(src)) {
    const m = s.text.match(BAD);
    if (m) hits.push(f + ':' + s.line + ' ' + JSON.stringify(m[0]));
  }
}
check('no long dash, en dash, guillemet, curly quote, arrow or one-character ellipsis in a string literal of functions/api/*.js', hits.length === 0, hits.slice(0, 20));
console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
