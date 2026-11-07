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

console.log('\n3. every place the app adds a row checks first, run (retro 03/11/2026 (d): not a regex on the source text)');
// cut a function (or a branch) out of index.html by its start text and brace matching, and run it with stubs
const cut = (start) => { const a = html.indexOf(start); let d = 0, k = html.indexOf('{', a); for (let q = k; q < html.length; q++) { if (html[q] === '{') d++; else if (html[q] === '}' && --d === 0) return html.slice(a, q + 1); } return ''; };
const mk = (body, args, db) => {
  const log = { toasts: [], posted: [], gvCalls: 0 };
  const vals = { 'eqi-n': 'Calibrator', 'eqi-code': 'calib-sewage-01 ', 'eqi-id': '' };
  const env = { DB: db, toast: (m) => log.toasts.push(m), _attachBusy: () => false, g: (k) => ({ value: vals[k] }), gv: (k) => { log.gvCalls++; return vals[k] || ''; },
    gid: () => 'new-id', sbIns: (t, r) => log.posted.push(r), addLog() {}, sdb() {}, closeEqiXl() {}, rEqi() {}, closeEqiXl2() {}, _sbAuth: () => Promise.resolve(), SBU: 'https://sb.test', sbHUpsert: () => ({}),
    fetch: async (u, o) => { log.posted.push(JSON.parse(o.body)); return { ok: true }; }, console, window: {}, alert() {}, document: { getElementById: () => ({ style: {}, textContent: '' }) } };
  return { log, env, run: (extra) => { Object.assign(env, extra || {}); return new Function(...Object.keys(env), body + '; return ' + args + ';')(...Object.values(env)); } };
};
const helpers = src;
const freshDB = () => ({ equip_inspections: [{ id: 'a1', code: 'CALIB-Sewage-01' }] });
{ // the form
  const t = mk(helpers + cut('function svEqi(){') + ';svEqi', 'svEqi', freshDB());
  const f1 = t.run();
  let threw = false; try { f1(); } catch (e) { threw = true; } // 'calib-sewage-01 ' with another id: taken; a save that goes on hits unstubbed code
  check('the form: a taken code stops the save with a message, before the row is built (only the description and code were read)', !threw && t.log.toasts.length === 1 && t.log.gvCalls === 2 && t.log.posted.length === 0, t.log);
  const t2 = mk(helpers + cut('function svEqi(){') + ';svEqi', 'svEqi', freshDB());
  t2.env.gv = (k) => { t2.log.gvCalls++; return k === 'eqi-code' ? 'BRAND-NEW' : k === 'eqi-n' ? 'x' : ''; };
  try { t2.run({ gv: t2.env.gv })(); } catch (e) { /* the later DOM calls are not stubbed: only how far it got matters */ }
  const built = t2.log.gvCalls > 2;
  check('the form: a free code goes on to build the row (control: the stop above is the code check, not something else)', built === true);
}
{ // the Excel import
  const db = freshDB();
  const t = mk(helpers + cut('function eqiXlOk(){') + ';eqiXlOk', 'eqiXlOk', db);
  const f = t.run({ window: { _eqiXlData: [{ code: 'calib-sewage-01', n: 'dup of DB' }, { code: 'X-1', n: 'new' }, { code: ' x-1', n: 'twice in file' }, { code: '?', n: 'no code 1' }, { code: '?', n: 'no code 2' }] } });
  f();
  check('the Excel import: a taken code, or one twice in the file, is skipped and counted; rows with no code all go in', t.log.posted.map((r) => r.n).join('|') === 'new|no code 1|no code 2' && t.log.toasts.some((m) => m.startsWith('2 ')), t.log);
}
{ // the full Excel intake
  const db = freshDB();
  const t = mk(helpers + cut('window.eqiXl2Apply=function(){') + ';', 'window.eqiXl2Apply', db);
  const win = { _eqiXl2: { items: [{ code: 'CALIB-SEWAGE-01', n: 'dup of DB' }, { code: 'N-5', n: 'new' }, { code: 'n-5', n: 'twice in file' }], history: [] } };
  const f = t.run({ window: win });
  f(); await new Promise((r) => setTimeout(r, 20));
  const sent = t.log.posted.filter((r) => r && r.n);
  check('the full Excel intake: the same, nothing taken goes out to the database', sent.length === 1 && sent[0].code === 'N-5', t.log.posted);
}
{ // the inbox filing (the branch for equip_inspections, run on its own)
  const head = "}else if(t==='equip_inspections'){", a = html.indexOf(head), body = html.slice(a + head.length, html.indexOf('}else{', a));
  const run = (code, id) => { const rec = { id }, db = freshDB(); const env = { DB: db, rec, p: { code }, nm: 'file.pdf', uploadedUrl: 'u', clean: (v) => String(v || '').trim(), dateOk: () => null, _eqiCodeTaken: new Function('DB', helpers + 'return _eqiCodeTaken;')(db), sbIns() {} };
    new Function(...Object.keys(env), body)(...Object.values(env)); return rec; };
  const r1 = run('CALIB-sewage-01', 'zz'), r2 = run('FREE-3', 'zz');
  check('the inbox filing: a taken code goes to the notes and the row keeps "?"; a free code stays', r1.code === '?' && /CALIB-sewage-01/.test(r1.notes) && r2.code === 'FREE-3' && !r2.notes, [r1, r2]);
}

console.log('\nequip-code-uq-test: ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
