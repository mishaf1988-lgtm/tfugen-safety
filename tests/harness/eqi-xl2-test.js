// The full equipment Excel intake (eqiXl2Read / _eqiXl2RowToRec in index.html), 04/10/2026.
// Run on Michael's real file ("תסקירי תפוגן - מאגר מרוכז.xlsx", 49 items) before importing it,
// every date came out impossible: sheet_to_json with raw:false returns a date cell as the US
// display text "7/25/25", and _eqiXl2Date read it as day 7 of month 25 ("2025-25-07").
// Now the sheet is read raw (a date cell is the Excel serial) and the date columns L and M
// go to _eqiXl2Date as the raw value, not through the string cell helper.
const fs = require('fs');
const path = require('path');
const src = fs.readFileSync(path.resolve(__dirname, '../../index.html'), 'utf8');
let pass = 0, fail = 0;
const check = (l, c, d) => { if (c) { pass++; console.log('  ✓ ' + l); } else { fail++; console.log('  ✗ ' + l + (d !== undefined ? '  -> ' + JSON.stringify(d) : '')); } };
const cut = (name) => { const i = src.indexOf('function ' + name + '('); if (i < 0) return ''; let d = 0; for (let k = src.indexOf('{', i); k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}' && !--d) return src.slice(i, k + 1); } return ''; };
const f = new Function(['_eqiXl2Date', '_eqiXl2Cell', '_eqiXl2Year', '_eqiXl2RowToRec'].map(cut).join('\n') + ';return {date:_eqiXl2Date,toRec:_eqiXl2RowToRec};')();

// A row as sheet_to_json(raw:true) returns it: numbers stay numbers, a date cell is its serial.
const row = ['אוטוקלב', 'AUTOCLAVE-22110905', 'דוד קיטור - אוטוקלאב', 'אוטוקלאב אנכי', 'אוטונאור', 'ELV-D3870', 22110905, 2023, 'מעבדה', 'מעבדה', 'תקופתית', 45863, 46290];
const r = f.toRec(row);
check('last inspection: serial 45863 = 25/07/2025', r.d === '2025-07-25', r.d);
check('next inspection: serial 46290 = 25/09/2026', r.e === '2026-09-25', r.e);
check('a number cell (serial no., year) is kept as text / year', r.serial_number === '22110905' && r.year_of_production === 2023, [r.serial_number, r.year_of_production]);
check('a date typed as text DD/MM/YYYY still works', f.toRec(Object.assign([], row, { 11: '29/04/2026' })).d === '2026-04-29');
check('an empty date cell = null, not ""', f.toRec(Object.assign([], row, { 12: '' })).e === null);
check('the US display text is not read as day/month any more by the reader (raw:true)', /sheet_to_json\(ws,\{header:1,defval:'',raw:true\}\)/.test(cut('eqiXl2Read') || src.slice(src.indexOf('window.eqiXl2Read='), src.indexOf('window.eqiXl2Read=') + 2500)));
check('the workbook is read without cellDates (a Date object would shift a day east of UTC)', !/XLSX\.read\(new Uint8Array\(ev\.target\.result\),\{type:'array',cellDates:true\}\);\s*\n\s*var items=\[\],history=\[\];/.test(src));
check('no ISO date out of the row is impossible', [r.d, r.e].every((x) => /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(x)));
console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
