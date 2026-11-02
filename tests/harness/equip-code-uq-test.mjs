// One row per equipment code (02/11/2026, Michael in the questionnaire: "do it: only the code"; retro 28/10/2026 (b)).
// The database has a unique index on the code (migrations/2026-11-02_equip_code_unique.sql); the app stops a second
// row before saving (the form, the Excel imports, the inbox filing), so a save never stays red in the queue.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
let pass = 0, fail = 0;
const check = (l, c, d) => { if (c) { pass++; console.log('  ✓ ' + l); } else { fail++; console.log('  ✗ ' + l + (d !== undefined ? '  -> ' + JSON.stringify(d).slice(0, 300) : '')); } };
const here = path.dirname(fileURLToPath(import.meta.url));
const html = fs.readFileSync(path.join(here, '../../index.html'), 'utf8');
const mig = fs.readFileSync(path.join(here, '../../migrations/2026-11-02_equip_code_unique.sql'), 'utf8');

console.log('\n1. the database');
check('the migration: a unique index on the code, case and spaces aside, only for a real code (not empty, "?" or "-")',
  /CREATE UNIQUE INDEX IF NOT EXISTS equip_inspections_code_uq ON public\.equip_inspections \(lower\(btrim\(code\)\)\)/.test(mig) && /NOT IN \('', '\?', '-'\)/.test(mig));
check('the migration names the backup taken before it and its rollback', /backup_equip_20261102\.equip_inspections \(90 = 90/.test(mig) && /rollback: DROP INDEX IF EXISTS public\.equip_inspections_code_uq/.test(mig));

console.log('\n2. the app helpers, run');
const src = ['_eqiCodeKey', '_eqiCodeTaken'].map((n) => (new RegExp('function ' + n + '\\([^)]*\\)\\{.*?\\}\\n', 's').exec(html) || [''])[0]).join('');
const DB = { equip_inspections: [{ id: 'a1', code: 'CALIB-Sewage-01' }, { id: 'a2', code: '?' }, { id: 'a3', code: null }] };
const f = new Function('DB', src + 'return { key: _eqiCodeKey, taken: _eqiCodeTaken };')(DB);
check('the same code in another case or with spaces is taken; on its own row it is not', !!f.taken(' calib-sewage-01 ', null) && !f.taken('CALIB-SEWAGE-01', 'a1'));
check('"?", "-" and an empty code are never taken (the scan writes "?" when it finds no code)', !f.taken('?', null) && !f.taken('-', null) && !f.taken('', null) && f.key('?') === '');
check('a new code is free', !f.taken('NEW-9', null));

console.log('\n3. every place the app adds a row checks first');
const sv = html.slice(html.indexOf('function svEqi(){'), html.indexOf('function svEqi(){') + 1500);
check('the form: a taken code stops the save with a message, before the row is built', /var _dupEq=_eqiCodeTaken\(gv\('eqi-code'\),id\);\s*if\(_dupEq\)\{toast\([^;]*\);return;\}/.test(sv));
const xl = html.slice(html.indexOf('function eqiXlOk(){'), html.indexOf('function eqiXlOk(){') + 1200);
check('the Excel import: a taken code, or one twice in the file, is skipped and counted', /_eqiCodeTaken\(r\.code,null\)/.test(xl) && /_seenC\[k\]/.test(xl) && /_skipC\+\+/.test(xl));
const xl2 = html.slice(html.indexOf('window.eqiXl2Apply=function(){'), html.indexOf('window.eqiXl2Apply=function(){') + 1500);
check('the full Excel intake: the same, before any row goes out', /_eqiCodeTaken\(rec\.code,null\)/.test(xl2) && xl2.indexOf('_eqiCodeTaken') < xl2.indexOf("fetch(SBU+'/rest/v1/equip_inspections'"));
check('the inbox filing: a taken code goes to the notes and the row keeps "?"', /_eqiCodeTaken\(rec\.code,rec\.id\)\)\{rec\.notes=[^;]*;rec\.code='\?';\}/.test(html));

console.log('\nequip-code-uq-test: ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
