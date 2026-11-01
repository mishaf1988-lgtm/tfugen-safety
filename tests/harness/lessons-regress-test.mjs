// Regression tests from the lessons (01/11/2026, Michael in the questionnaire: "do it: lesson tests"; mechanism 3 of the
// research, Anthropic "demystifying evals": the real failures become fixed cases that run after every change).
// Three parts, all in CI on every PR, so a change to the rules, the gates or the domains cannot bring an old mistake back:
//  1. CASES: the real text of a past mistake must still be refused by its gate, and a fair text must still pass.
//  2. Every file and function a lesson names as its enforcement (the "\u05e0\u05d0\u05db\u05e3:" line) still exists.
//  3. Every gate a domain file names (project-files/domains/*.md) still exists in the server code.
// A new lesson enforced by a server gate adds its real text to CASES in the PR that adds the lesson.
import { readFileSync, readdirSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { claimGate, draftAttachGate, mentionsQuoteValidity, asksOwnerToAttach, refusesWithoutFlow, asksApiCredit, hasPassport, replyToCheck, savedFresh } from './_build/routine-db.mjs';
import { hasInternalId } from './_build/_wa.mjs';

let pass = 0, fail = 0;
const check = (l, c, d) => { if (c) { pass++; console.log('  \u2713 ' + l); } else { fail++; console.log('  \u2717 ' + l + (d !== undefined ? '  -> ' + JSON.stringify(d).slice(0, 400) : '')); } };
const ROOT = new URL('../../', import.meta.url);
const read = (p) => readFileSync(new URL(p, ROOT), 'utf8');

// 1. [lesson or date, when, gate (true = refused), the real text of the mistake, a fair text]
const CASES = [
  ['190', '01/11/2026', (T) => asksApiCredit(T), '\u05d0\u05d9\u05df \u05d9\u05ea\u05e8\u05ea \u05e7\u05e8\u05d3\u05d9\u05d8 \u05dc-API, \u05dc\u05d0 \u05d4\u05e6\u05dc\u05d7\u05ea\u05d9 \u05dc\u05e7\u05e8\u05d5\u05d0 \u05d0\u05ea \u05d4\u05e1\u05e8\u05d9\u05e7\u05d4', '\u05d4\u05e1\u05e4\u05e7 \u05e0\u05ea\u05df \u05d0\u05e9\u05e8\u05d0\u05d9 \u05e9\u05dc 30 \u05d9\u05d5\u05dd \u05d1\u05d7\u05e9\u05d1\u05d5\u05e0\u05d9\u05ea'],
  ['191', '01/11/2026', (T) => !!claimGate(T, ''), '\u05d4\u05d2\u05e8\u05e1\u05d4 \u05d4\u05d7\u05d3\u05e9\u05d4 \u05e9\u05dc \u05d4\u05d8\u05d5\u05e4\u05e1 \u05db\u05d1\u05e8 \u05e0\u05e9\u05de\u05e8\u05d4 \u05d1\u05ea\u05d9\u05e7\u05d9\u05d9\u05d4', '\u05de\u05d7\u05e8 \u05d1\u05e9\u05e2\u05d4 11:00 \u05d4\u05d4\u05d3\u05e8\u05db\u05d4 \u05dc\u05d0\u05d7\u05d6\u05e7\u05d4'],
  ['192', '01/11/2026', (T) => !!draftAttachGate({ body: T }), '\u05d4\u05d9\u05d9 \u05e9\u05dc\u05d5\u05de\u05d9, \u05d4\u05d4\u05e6\u05e2\u05d4 \u05d4\u05de\u05e2\u05d5\u05d3\u05db\u05e0\u05ea \u05e0\u05de\u05e6\u05d0\u05ea \u05d1\u05de\u05d9\u05d9\u05dc \u05de\u05d0\u05d9\u05e0\u05e4\u05e8\u05d4 \u05e8\u05d3', '\u05d4\u05d9\u05d9 \u05e9\u05dc\u05d5\u05de\u05d9, \u05d0\u05e4\u05e9\u05e8 \u05dc\u05e2\u05d3\u05db\u05df \u05d0\u05ea \u05d4\u05d4\u05d6\u05de\u05e0\u05d4?'],
  ['26/10', '26/10/2026', (T) => mentionsQuoteValidity(T), '\u05d4\u05d4\u05e6\u05e2\u05d4 \u05d1\u05ea\u05d5\u05e7\u05e3 \u05e2\u05d3 30/11/2026', '\u05d4\u05d4\u05e6\u05e2\u05d4 \u05db\u05d5\u05dc\u05dc\u05ea \u05d1\u05d3\u05d9\u05e7\u05d4 \u05d1\u05e9\u05e0\u05d9 \u05d4\u05d7\u05d3\u05e8\u05d9\u05dd'],
  ['29/10', '29/10/2026', (T) => asksOwnerToAttach(T), '\u05d0\u05ea \u05d4\u05d4\u05e6\u05e2\u05d5\u05ea \u05e6\u05e8\u05d9\u05da \u05dc\u05e6\u05e8\u05e3 \u05d9\u05d3\u05e0\u05d9\u05ea \u05de\u05d4\u05e9\u05e8\u05e9\u05d5\u05e8 \u05d4\u05de\u05e7\u05d5\u05e8\u05d9', '\u05e6\u05d9\u05e8\u05e4\u05ea\u05d9 \u05d0\u05ea \u05d4\u05d4\u05e6\u05e2\u05d4 \u05dc\u05d8\u05d9\u05d5\u05d8\u05d4'],
  ['31/10', '31/10/2026', (T) => refusesWithoutFlow(T), '\u05d0\u05d9\u05df \u05dc\u05d9 \u05d4\u05e8\u05e9\u05d0\u05d4 \u05dc\u05e9\u05de\u05d5\u05e8 \u05d1\u05ea\u05d9\u05e7\u05d9\u05d9\u05d4 \u05d4\u05d6\u05d5, \u05e6\u05e8\u05d9\u05da \u05de\u05e0\u05d4\u05dc \u05de\u05e2\u05e8\u05db\u05ea', '\u05e9\u05de\u05e8\u05ea\u05d9 \u05d0\u05ea \u05d4\u05e7\u05d5\u05d1\u05e5 \u05d3\u05e8\u05da \u05d6\u05e8\u05d9\u05de\u05d4 9'],
  ['21/10', '21/10/2026', (T) => hasInternalId(T), '\u05d1\u05e7\u05e9\u05ea \u05d4\u05e4\u05d9\u05ea\u05d5\u05d7 dev-20261021053745-tqu3 \u05e0\u05e4\u05ea\u05d7\u05d4', '\u05d1\u05e7\u05e9\u05ea \u05d4\u05e4\u05d9\u05ea\u05d5\u05d7 \u05e0\u05e4\u05ea\u05d7\u05d4 \u05d5\u05ea\u05d9\u05d1\u05e0\u05d4 \u05d4\u05dc\u05d9\u05dc\u05d4'],
  ['26/10 PQ', '26/10/2026', (T) => hasPassport(T), '\u05de\u05e1\u05e4\u05e8 \u05d3\u05e8\u05db\u05d5\u05df AB1234567 \u05e9\u05dc \u05d4\u05e2\u05d5\u05d1\u05d3', '\u05d4\u05e6\u05e2\u05d4 PQ26001545 \u05de\u05e0\u05d2\u05d1 \u05d0\u05e7\u05d5\u05dc\u05d5\u05d2\u05d9\u05d4'],
];
for (const [les, d, gate, bad, good] of CASES) {
  check('lesson ' + les + ' (' + d + '): the text of the mistake is still refused', gate(bad) === true, bad);
  check('lesson ' + les + ' (' + d + '): a fair text still passes', gate(good) === false, good);
}
// lesson 193 (C70, 01/11/2026) and mechanism 1: gates on what Graph returns
check('lesson 193 (01/11/2026): a reply_to that is a draft is still refused', !!replyToCheck(200, { isDraft: true }) && replyToCheck(200, { isDraft: false }) === null);
check('lesson 191 (01/11/2026): "saved" on a file unchanged for two hours is still refused', !!savedFresh(200, { size: 5, lastModifiedDateTime: '2026-11-01T10:00:00Z' }, Date.parse('2026-11-01T12:00:00Z')));

// 2. the enforcement named in each lesson still exists
const lessonText = ['.claude/skills/tfugen-lessons/SKILL.md', '.claude/skills/tfugen-dev/references/lessons.md', 'project-files/lessons-archive.md'].map(read).join('\n');
const enf = (lessonText.match(/\u05e0\u05d0\u05db\u05e3:.*/g) || []).join('\n');
const tracked = execSync('git ls-files', { cwd: ROOT.pathname, encoding: 'utf8' }).split('\n');
const base = new Set(tracked.map((f) => f.split('/').pop()));
// outside the repository on purpose: the reason is the value
const OUTSIDE = { 'stop-hook-git-check.sh': 'the cloud environment\'s own Stop hook (~/.claude), not in the repository' };
const files = [...new Set((enf.match(/`[^`]+\.(py|mjs|js|sh)`/g) || []).map((x) => x.slice(1, -1)))];
const missingFiles = files.filter((f) => !f.startsWith('/') && !OUTSIDE[f.split('/').pop()] && !base.has(f.split('/').pop()));
check('every enforcement file a lesson names still exists (' + files.length + ' names)', files.length > 50 && missingFiles.length === 0, missingFiles);
const code = tracked.filter((f) => /^(functions\/|\.claude\/hooks\/|tools\/|index\.html$)/.test(f) && /\.(js|py|sh|html)$/.test(f)).map((f) => read(f)).join('\n');
const ids = [...new Set((enf.match(/`[a-z][a-z0-9]*[A-Z][A-Za-z0-9]*`/g) || []).map((x) => x.slice(1, -1)))];
const missingIds = ids.filter((i) => !new RegExp('\\b' + i + '\\b').test(code));
check('every enforcement function a lesson names still exists in the code (' + ids.length + ' names)', ids.length >= 10 && missingIds.length === 0, missingIds);

// 3. the gates the domain files name still exist
const dom = readdirSync(new URL('project-files/domains/', ROOT)).filter((f) => f.endsWith('.md')).map((f) => read('project-files/domains/' + f)).join('\n');
const dIds = [...new Set((dom.match(/`[a-z][a-z0-9]*[A-Z][A-Za-z0-9]*`/g) || []).map((x) => x.slice(1, -1)))];
const dMissing = dIds.filter((i) => !new RegExp('\\b' + i + '\\b').test(code));
check('every gate a domain file names still exists in the code (' + dIds.length + ' names)', dIds.length >= 8 && dMissing.length === 0, dMissing);

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
