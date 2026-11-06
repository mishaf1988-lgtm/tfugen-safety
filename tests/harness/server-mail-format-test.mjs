// Every mail the server sends: RTL that survives Outlook, the signature where it is owed, keyboard characters.
// 06/11/2026 (handoff 05/11 "next in queue", Michael approved in the questionnaire).
//
// Why: Outlook drops dir="rtl" (the attribute) and keeps inline styles, so the outermost element of a mail body
// must carry style="direction:rtl;text-align:right". Mails that go to other people end with SITE.signature
// (_site.js: Michael's Outlook signature + logo; DECISIONS "SITE.signature ... under every hazard report",
// 20/10/2026, and routine-db sendReply: "a mail through Graph gets no Outlook signature, so the server adds his").
// A mail only to Michael's own mailbox (codes, lock, watchdog, digest, approval, ask, "closed" notices) is exempt.
// The explicit list below is the inventory: a new sendMail/sendMailTo call site that is not in it fails this test,
// so a new mail cannot be added without a format check.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { SITE } from './_build/_site.mjs';
import { changeMailHtml } from './_build/codes.mjs';
import { mailHtml as watchdogHtml } from './_build/_watchdog.mjs';
import { digestOf, digestHtml } from './_build/weekly-digest.mjs';
import { buildReport, buildStatus, SIGNATURE } from './_build/hazard-report.mjs';
import { missMailHtml } from './_build/talk.mjs';
import { approvalHtml, decisionHtml, permitHtml, mailHtml as worksMailHtml, askHtml } from './_build/works.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FN = path.join(HERE, '..', '..', 'functions');
let pass = 0, fail = 0;
const check = (l, c, d) => { if (c) { pass++; console.log('  ✓ ' + l); } else { fail++; console.log('  ✗ ' + l + (d !== undefined ? '  -> ' + String(d).substring(0, 200) : '')); } };

// trustee-gate is not in run.sh's build list: same copy trick as codes-test.mjs
const gateSrc = fs.readFileSync(path.join(FN, 'api/trustee-gate.js'), 'utf8').replace("from '../_shared.js'", "from './_shared.mjs'").replace("from '../_onedrive.js'", "from './_onedrive.mjs'");
fs.writeFileSync(path.join(HERE, '_build/trustee-gate-mf.mjs'), gateSrc);
const { lockMailHtml: gateLockHtml } = await import('./_build/trustee-gate-mf.mjs');

// ---------- rules ----------
const SIG = SITE.signature;
// The outermost element: the first tag must be a block that carries the inline direction (dir= alone is dropped by Outlook).
const outer = (html) => { const m = /^\s*<([a-z0-9]+)\b([^>]*)>/i.exec(html); return m ? { tag: m[1].toLowerCase(), attrs: m[2] } : null; };
const rtlOuter = (html) => { const o = outer(html); return !!o && /^(div|table|p)$/.test(o.tag) && /style="[^"]*direction\s*:\s*rtl/i.test(o.attrs) && /style="[^"]*text-align\s*:\s*right/i.test(o.attrs); };
// Keyboard characters only: no long dash, smart quotes, ellipsis character (the visible text; escapes decoded for source windows).
const BAD = /[–—‘’“”…]/;
const decode = (s) => s.replace(/\\u([0-9a-fA-F]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
const textOf = (html) => String(html).replace(/<[^>]+>/g, ' ').replace(/&[a-z]+;/g, ' ');

// ---------- 1. inventory of call sites (grep) ----------
console.log('\n1. every mail call site is known');
// file -> number of call sites of sendMailTo( / sendMail( (definitions excluded). A new site anywhere = a failure.
const KNOWN_SITES = {
  'api/hazard-report.js': 2, 'api/weekly-digest.js': 1, 'api/works.js': 1, 'api/mail-inbox.js': 1, 'api/codes.js': 1,
  'api/trustee-gate.js': 1, 'api/talk.js': 4, 'api/trustee-notify.js': 1, 'api/close-hazard.js': 1, '_watchdog.js': 1,
};
const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(dir, e.name)) : e.name.endsWith('.js') ? [path.join(dir, e.name)] : []));
const files = walk(FN), found = {};
for (const f of files) {
  const rel = path.relative(FN, f).split(path.sep).join('/');
  const n = fs.readFileSync(f, 'utf8').split('\n').filter((l) => /\b(sendMailTo|sendMail)\(/.test(l) && !/^\s*(\/\/|\*)/.test(l) && !/function\s+(sendMailTo|sendMail)\b/.test(l) && !/^\s*import\b/.test(l)).length;
  // works.js sends through deps.sendMailTo (counted above) and the sendOut helper; wa-morning/routine-db only pass the deps along
  if (n) found[rel] = n;
}
for (const rel of Object.keys(found)) check('call site is in the list: ' + rel + ' (' + found[rel] + ')', KNOWN_SITES[rel] === found[rel], 'known=' + KNOWN_SITES[rel] + ' found=' + found[rel] + ' (add the new mail to this test with a format check)');
for (const rel of Object.keys(KNOWN_SITES)) check('listed site still exists: ' + rel, found[rel] === KNOWN_SITES[rel], 'found=' + found[rel]);
// no other way out of the building: the only Graph sendMail is in _onedrive.js; the only other mail path is the reply in routine-db
const graphSend = files.filter((f) => /\/me\/sendMail|createReply/.test(fs.readFileSync(f, 'utf8'))).map((f) => path.relative(FN, f).split(path.sep).join('/')).sort();
check('Graph sendMail/createReply appear only in _onedrive.js and routine-db.js', JSON.stringify(graphSend) === JSON.stringify(['_onedrive.js', 'api/routine-db.js']), graphSend.join(','));
// works.js: every HTML builder is one of the five checked below
const worksSrc = fs.readFileSync(path.join(FN, 'api/works.js'), 'utf8');
const worksBuilders = Array.from(new Set((worksSrc.match(/export function\s+\w*[Hh]tml\w*\(/g) || []).map((s) => s.replace(/export function\s+|\(/g, '')))).sort();
check('works.js HTML builders are exactly the five checked', JSON.stringify(worksBuilders) === JSON.stringify(['approvalHtml', 'askHtml', 'decisionHtml', 'mailHtml', 'permitHtml']), worksBuilders.join(','));

// ---------- 2. rendered builders ----------
console.log('\n2. rendered mails: inline RTL, signature where owed, keyboard characters');
const FRI = '2026-11-06', IL = '2026-11-05T08:00:00Z';
const work = { n: 1, desc: 'test work', dep: 'dep', area: 'area', who: 'con', con: 'contractor', cats: [], st: { flags: [], gate: [], notes: [] }, rows: [] };
const hrows = [];
const rcpt = { depts: {}, resp: {}, cc: [] };
const digest = digestOf([], '2026-11-06');
const RENDER = [
  // name, recipient type, html, signature owed
  ['codes.changeMailHtml', 'Michael only', changeMailHtml('test', 'who', IL), false],
  ['trustee-gate.lockMailHtml', 'Michael only', gateLockHtml('tru', IL), false],
  ['_watchdog.mailHtml', 'Michael only', watchdogHtml({ a: { title: 'A', detail: 'd' } }, ['a'], [], SITE.appUrl), false],
  ['weekly-digest.digestHtml', 'Michael only', digestHtml(digest, '2026-11-06', {}), false],
  ['hazard-report.buildReport', 'dept managers', buildReport('x', hrows, rcpt, {}, '2026-11-06', null, null).html, true],
  ['hazard-report.buildStatus', 'dept managers', buildStatus('x', hrows, rcpt, '', null, '2026-11-06', null, null).html, true],
  ['talk.missMailHtml', 'dept managers', missMailHtml({ id: 't', title: 'ttl', kind: 'weekly', d: '2026-11-05' }, 'dept', [{ n: 'name' }], 'https://x/y', []), false],
  ['works.approvalHtml', 'Michael only', approvalHtml(FRI, [{ w: work }], false), false],
  ['works.askHtml', 'Michael only', askHtml(FRI, { to: ['a@x.il'], cc: ['b@x.il'] }, 'https://x/y'), false],
  ['works.decisionHtml', 'contractor/dept', decisionHtml(true, work, FRI, 'note', 'https://x/y'), true],
  ['works.permitHtml', 'contractor/dept', permitHtml(work, FRI, false, 'a.pdf', 'https://x/y', true), true],
  ['works.mailHtml', 'contractor list', worksMailHtml(FRI, 'https://x/y'), true],
];
for (const [name, who, html, sig] of RENDER) {
  check(name + ' (' + who + '): produced html', typeof html === 'string' && html.length > 50);
  check(name + ': outermost element has inline direction:rtl + text-align:right', rtlOuter(String(html)), String(html).substring(0, 120));
  if (sig) check(name + ': carries SITE.signature', String(html).includes(SIG));
  check(name + ': keyboard characters only', !BAD.test(textOf(html)), (BAD.exec(textOf(html)) || [])[0]);
}

// ---------- 3. mails built inline at the call site (not exported): the source window ----------
console.log('\n3. inline mails: the source of the html built before the call');
// file, a marker that starts the html literal, the call text that ends the window, signature owed, recipient
const INLINE = [
  ['api/hazard-report.js', "const html = test ? '<div dir=\"rtl\"", 'await sendMailTo(token, to, cc, (test', false, 'test banner (to Michael), body = buildStatus (rendered above)'],
  ['api/hazard-report.js', "const html = test ? '<div dir=\"rtl\"", 'await sendMailTo(token, to, cc, subject', false, 'test banner (to Michael), body = buildReport (rendered above)'],
  ['api/talk.js', "const html = (test ? '<div dir=\"rtl\"", 'await sendMailTo(od.token, test ? [od.email]', false, 'test banner, body = missMailHtml (rendered above)'],
  ['api/talk.js', "const mail = '<div dir=\"rtl\"", "await sendMailTo(od.token, to, [], '\\u05d8\\u05d5\\u05e4\\u05e1 \\u05e7\\u05dc\\u05d9\\u05d8\\u05ea", null, 'induction form: Michael + HR'],
  ['api/talk.js', "const mail = '<div dir=\"rtl\"", "await sendMailTo(od.token, to, [], '\\u05d8\\u05d5\\u05e4\\u05e1 08.01", null, 'form 08.01: Michael + quality cc'],
  ['api/trustee-notify.js', "const html = '<div dir=\"rtl\"", 'await within(sendMail(token, to, subject, html)', false, 'trustee alert to Michael'],
  ['api/close-hazard.js', "const html = '<div dir=\"rtl\"", 'await sendMail(token, to,', false, 'closed notice to Michael'],
  ['api/mail-inbox.js', "const html = '<div dir=\"rtl\"", 'await sendMail(token, c.from,', null, 'closed notice to the person who replied'],
];
for (const [rel, start, end, sig, who] of INLINE) {
  const src = fs.readFileSync(path.join(FN, rel), 'utf8');
  let from = -1, to = -1;
  // the window is the html assignment that is nearest before the call text
  const e = src.indexOf(end);
  if (e >= 0) from = src.lastIndexOf(start, e);
  to = e;
  const ok = from >= 0 && to > from;
  check(rel + ' [' + who + ']: html literal found before its call', ok, 'start=' + start.substring(0, 40) + ' end=' + end.substring(0, 40));
  if (!ok) continue;
  const win = src.substring(from + start.indexOf('<div'), to);
  const lit = decode(win);
  check(rel + ' [' + who + ']: the literal opens with inline direction:rtl + text-align:right', /^<div dir="rtl" style="[^"]*direction:rtl;[^"]*text-align:right/.test(lit), lit.substring(0, 110));
  if (sig === true) check(rel + ' [' + who + ']: carries the signature', /SITE\.signature|SIGNATURE/.test(win));
  check(rel + ' [' + who + ']: keyboard characters only', !BAD.test(lit.replace(/\/\/[^\n]*/g, '')), (BAD.exec(lit) || [])[0]);
}

// routine-db: the reply mail (Graph createReply) Michael's assistant sends in a thread: RTL wrapper plus the signature
{
  const src = fs.readFileSync(path.join(FN, 'api/routine-db.js'), 'utf8');
  const wrappers = src.match(/html: '<div dir="rtl"[^']*'/g) || [];
  check('routine-db: mail wrappers found', wrappers.length >= 1, wrappers.length);
  for (const w of wrappers) check('routine-db wrapper has inline direction:rtl + text-align:right', /direction:rtl;text-align:right/.test(w), w.substring(0, 100));
  check('routine-db: the reply to other people adds SITE.signature', /'<div dir="rtl" style="direction:rtl;text-align:right;[^']*' \+ html \+ SITE\.signature \+ '<\/div>'/.test(src));
}

// ---------- 4. signature and builders are themselves sound ----------
console.log('\n4. the signature');
check('SITE.signature exists and is not a bare string', typeof SIG === 'string' && SIG.length > 200);
check('hazard-report SIGNATURE is SITE.signature', SIGNATURE === SIG);
check('SITE.signature has keyboard characters only', !BAD.test(textOf(SIG)));

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
