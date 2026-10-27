// _errReport in index.html (27/10/2026, Michael in the questionnaire: "do it: to our own server"): an error in a user's
// browser goes to audit_log through the outbox, once per error, five a session at most, only for a signed-in non-viewer,
// only for this site's own code. Runs the real function out of index.html with stand-ins for what it calls.
const fs = require('fs'), path = require('path'), vm = require('vm');
let pass = 0, fail = 0;
const check = (l, c, d) => { if (c) { pass++; console.log('  ✓ ' + l); } else { fail++; console.log('  ✗ ' + l + (d !== undefined ? '  -> ' + JSON.stringify(d) : '')); } };
const src = fs.readFileSync(path.resolve(__dirname, '../../index.html'), 'utf8');
const at = src.indexOf('var _errSent = {}, _errN = 0;');
const end = src.indexOf('\n}', src.indexOf('function _errReport', at)) + 2;
check('_errReport is in index.html, and both error listeners call it', at > 0 && (src.match(/_errReport\(rec\);/g) || []).length === 2);
const code = src.slice(at, end);
function run(opts) {
  const pushed = [];
  const ctx = { SB_ON: true, location: { origin: 'https://tapugan-safety.pages.dev' }, window: { innerWidth: 390 }, CUR: 'ncr',
    _viewOnly: () => !!opts.viewer, _sbNamed: () => !opts.kiosk && !opts.anon,
    _obPush: (op) => { pushed.push(op); }, JSON, String };
  if (opts.signedOut) ctx.SB_ON = false;
  vm.createContext(ctx); vm.runInContext(code, ctx);
  (opts.recs || []).forEach((r) => ctx._errReport(r));
  return pushed;
}
const OWN = 'https://tapugan-safety.pages.dev/index.html?v=3';
const rec = (m, line) => ({ msg: m, src: OWN, line: line || 1, col: 2, stack: 'at f (index.html:1)' + 'x'.repeat(500) });
let p = run({ recs: [rec('a is undefined', 10)] });
const row = p[0] && p[0].row, t = row ? JSON.parse(row.title) : {};
check('an error goes to audit_log as client_error, through the outbox', p.length === 1 && p[0].tbl === 'audit_log' && row.table_name === 'client_error' && row.source === 'jserr', p);
check('the row says what, where and on which page, with the stack cut to 300', t.m === 'a is undefined' && t.f === 'index.html' && t.l === 10 && t.p === 'ncr' && t.st.length === 300, t);
check('the same error twice is sent once', run({ recs: [rec('a', 1), rec('a', 1), rec('a', 1)] }).length === 1);
check('five different errors a session at most', run({ recs: [1, 2, 3, 4, 5, 6, 7].map((i) => rec('e' + i, i)) }).length === 5);
check('a viewer, the kiosk and a signed-out phone send nothing', !run({ viewer: true, recs: [rec('a')] }).length && !run({ kiosk: true, recs: [rec('a')] }).length && !run({ signedOut: true, recs: [rec('a')] }).length);
check('an extension\'s error, or a cross-origin "Script error.", is not ours', !run({ recs: [{ msg: 'x', src: 'chrome-extension://abc/x.js', line: 1 }, { msg: 'Script error.', src: '', line: 0 }] }).length);
check('an anonymous trustee sends nothing (RLS would refuse it and the outbox would show a stuck action)', !run({ anon: true, recs: [rec('a')] }).length);
check('a rejection from another site\'s code (by the URLs in its stack) is not ours', !run({ recs: [{ msg: 'unhandled-rejection: x', stack: 'at f (chrome-extension://abc/x.js:1:2)' }] }).length);
{ const q = run({ recs: [{ msg: 'Unexpected token "secret name" is not valid JSON', src: OWN, line: 5, stack: 'at g (https://tapugan-safety.pages.dev/index.html?token=abc#x:5:1)' }] }); const tt = q[0] ? JSON.parse(q[0].row.title) : {};
  check('quoted text is cut out of the message, and query strings out of the stack', tt.m === 'Unexpected token "*" is not valid JSON' && tt.st.indexOf('token=') < 0 && tt.st.indexOf('index.html') > 0, tt); }
check('the user name is not sent from the browser (the trigger takes it from the session)', p[0].row.user_email === null);
check('an unhandled rejection (no file) is sent', run({ recs: [{ msg: 'unhandled-rejection: boom', stack: '' }] }).length === 1);
check('a failing outbox does not throw out of the error handler', (() => { const c = { SB_ON: true, location: { origin: 'o' }, window: {}, _viewOnly: () => false, _sbNamed: () => true, _obPush: () => { throw new Error('full'); }, JSON, String }; vm.createContext(c); vm.runInContext(code, c); try { c._errReport(rec('z')); return true; } catch (e) { return false; } })());
console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
