// tools/od-allowed.py (24/11/2026, Michael: "do it: a server action to download and file from OneDrive"): the "where may I
// file" list the WhatsApp assistant reads in wa-topics/docs.md 0ב1ג instead of grepping routine-db.js. This test keeps it
// true: the block in docs.md and in routine-wa-assistant.md is exactly what the script prints, and every folder the list
// forbids is refused by the server's own checks (od_mkdir, od_put_pdf, od_pdf, od_move), while an ordinary folder passes.
import { odMoveCheck, odMkdirCheck, odPutPdfCheck, odPdfCheck, odSwapCheck, OD_TRIGGER_DIRS, OD_SWAP_NEW_TOPS, OD_PUT_MAX, OD_MKDIR_DEPTH } from './_build/routine-db.mjs';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
let pass = 0, fail = 0;
const check = (l, c, d) => { if (c) { pass++; console.log('  ✓ ' + l); } else { fail++; console.log('  ✗ ' + l + (d !== undefined ? '  -> ' + JSON.stringify(d).slice(0, 400) : '')); } };
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '..');
const py = (...a) => spawnSync('python3', [path.join(ROOT, 'tools', 'od-allowed.py'), ...a], { encoding: 'utf8' });

const j = py('--json');
check('od-allowed.py --json runs', j.status === 0, j.stderr);
const v = JSON.parse(j.stdout || '{}');
const block = py().stdout.trimEnd();
for (const f of ['project-files/wa-topics/docs.md', 'project-files/routine-wa-assistant.md']) {
  const t = fs.readFileSync(path.join(ROOT, f), 'utf8');
  const i = t.indexOf('<!-- od-allowed:start'), k = t.indexOf('<!-- od-allowed:end -->');
  check(f + ': the block is what the script prints (run python3 tools/od-allowed.py --write)', i >= 0 && k > i && t.slice(i, k + '<!-- od-allowed:end -->'.length) === block);
}

const A = { agent: 'routine-wa-assistant', why: 'test of the allowed list' };
const tops = [v.inbox, v.auto, v.ocr].concat(v.auto_dirs || []);
check('the forbidden tops are exactly the server\'s OD_TRIGGER_DIRS', tops.length > 5 && [...tops].sort().join('|') === [...OD_TRIGGER_DIRS].sort().join('|'), { tops, OD_TRIGGER_DIRS });
check('the od_swap folders are exactly OD_SWAP_NEW_TOPS', (v.swap_tops || []).join('|') === OD_SWAP_NEW_TOPS.join('|'));
check('the size limit is OD_PUT_MAX', v.put_max_mb * 1024 * 1024 === OD_PUT_MAX, v.put_max_mb);
check('the folder depth is OD_MKDIR_DEPTH', v.mkdir_depth === OD_MKDIR_DEPTH, v.mkdir_depth);

const OK = '05_x/2026';
const pdfB64 = Buffer.from('%PDF-1.4 test').toString('base64');
const writes = (dir) => ({
  mkdir: odMkdirCheck({ ...A, parent: dir, name: 'new' }),
  put: odPutPdfCheck({ ...A, dir, name: 'a.pdf', b64: pdfB64 }),
  pdf: odPdfCheck({ ...A, path: dir + '/a.docx' }),
  move: odMoveCheck({ ...A, from: 'a.pdf', to_dir: dir, name: 'a.pdf' }),
});
const allOk = (r) => Object.values(r).every((x) => !x.error);
const allRefused = (r) => Object.values(r).every((x) => x.error);
check('an ordinary folder passes od_mkdir, od_put_pdf, od_pdf and od_move', allOk(writes(OK)), writes(OK));
for (const t of tops) check('forbidden top "' + t + '" is refused by all four', allRefused(writes(t + '/sub')), writes(t + '/sub'));
check('the forbidden anywhere names were found', (v.no_dir || []).length >= 3, v.no_dir);
for (const n of v.no_dir || []) check('"' + n + '" deep in a path is refused by all four', allRefused(writes('05_x/' + n + '/y')), writes('05_x/' + n + '/y'));
check('a parent of OD_MKDIR_DEPTH levels may get a new folder, one more may not',
  !odMkdirCheck({ ...A, parent: Array(OD_MKDIR_DEPTH).fill('d').join('/'), name: 'n' }).error && !!odMkdirCheck({ ...A, parent: Array(OD_MKDIR_DEPTH + 1).fill('d').join('/'), name: 'n' }).error);
for (const e of v.put_types || []) check('od_put_pdf knows .' + e + ' (refused for its bytes only, not its name)', odPutPdfCheck({ ...A, dir: OK, name: 'a.' + e, b64: 'AAAA' }).error === 'not a ' + e, odPutPdfCheck({ ...A, dir: OK, name: 'a.' + e, b64: 'AAAA' }));
check('a type not in the list is refused by name', odPutPdfCheck({ ...A, dir: OK, name: 'a.txt', b64: pdfB64 }).error === 'bad name');
for (const t of OD_SWAP_NEW_TOPS) check('od_swap into "' + t + '" passes the folder check', !odSwapCheck({ ...A, old: 'other/old.pdf', new: t + '/a.pdf' }).error, odSwapCheck({ ...A, old: 'other/old.pdf', new: t + '/a.pdf' }));
check('od_swap into an ordinary folder is refused', odSwapCheck({ ...A, old: 'other/old.pdf', new: OK + '/a.pdf' }).error === 'bad new');
console.log(pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
