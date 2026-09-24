// Rule 1 in CLAUDE.md: Hebrew inside JS strings is written as \uXXXX.
//
// Until 2026-09-24 the rule was written as absolute and was not true. The
// documentation audit of 22/09 counted 773 script lines with raw Hebrew inside
// quotes, next to 47,255 escapes. Every session read the rule, assumed the code
// met it, and some added more. Michael decided to make the code meet the rule.
//
// The conversion used a real parser (acorn), not a regex over the file, so it
// could tell a string from a comment from a regex literal. 951 string literals
// and 13 regex literals were rewritten; each was proven to evaluate to exactly
// its old value before anything was written.
//
// This keeps it true. The hook in .claude/hooks/ warns inside a Claude session;
// this fails the harness in any session, including one with no hooks at all.
// Comments may carry Hebrew freely -- the rule is about strings.
const fs = require('fs');
const path = require('path');
let acorn;
for (const p of ['acorn', path.join(require('child_process').execSync('npm root -g').toString().trim(), 'eslint/node_modules/acorn')]) {
  try { acorn = require(p); break; } catch (e) { /* next */ }
}
let pass = 0, fail = 0;
const check = (l, c, d) => { if (c) { pass++; console.log('  ✓ ' + l); } else { fail++; console.log('  ✗ ' + l + (d !== undefined ? '  -> ' + JSON.stringify(d) : '')); } };

if (!acorn) {
  // No parser, no verdict. Saying "0 found" here would be the worst answer.
  console.log('  ✗ acorn is not available, so rule 1 cannot be checked');
  console.log('\n0 passed, 1 failed');
  process.exit(1);
}

const HEB = /[֐-׿]/;
const src = fs.readFileSync(path.resolve(__dirname, '../../index.html'), 'utf8');
const re = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g;
function walk(n, f) {
  if (!n || typeof n.type !== 'string') return;
  f(n);
  for (const k in n) {
    const v = n[k];
    if (Array.isArray(v)) v.forEach((x) => x && typeof x.type === 'string' && walk(x, f));
    else if (v && typeof v.type === 'string') walk(v, f);
  }
}

console.log('\nrule 1: no raw Hebrew in a string, template or regex');
let blocks = 0, parsed = 0;
const raw = [];
let m;
while ((m = re.exec(src))) {
  blocks++;
  const body = m[1];
  const base = src.slice(0, m.index).split('\n').length;
  let ast;
  try { ast = acorn.parse(body, { ecmaVersion: 'latest', sourceType: 'script', allowReturnOutsideFunction: true, locations: true }); parsed++; }
  catch (e) { raw.push('block at line ' + base + ' does not parse: ' + e.message); continue; }
  walk(ast, (n) => {
    const hit = (n.type === 'Literal' && typeof n.value === 'string' && HEB.test(n.raw))
      || (n.type === 'TemplateElement' && HEB.test(n.value.raw))
      || (n.type === 'Literal' && n.regex && HEB.test(n.regex.pattern));
    if (hit) raw.push('line ' + (base + n.loc.start.line - 1) + ': ' + String(n.raw || (n.value && n.value.raw) || '').slice(0, 50));
  });
}
check('every inline script parses (' + parsed + '/' + blocks + ')', parsed === blocks && blocks > 0, raw.filter((x) => /parse/.test(x)));
check('no string, template or regex carries raw Hebrew (' + raw.length + ')', raw.length === 0, raw.slice(0, 8));

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
