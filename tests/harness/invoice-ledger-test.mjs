// 13/11/2026 (Michael: "do it: an invoice ledger", after a three-question interview): invoice_set and invoice_find in
// routine-db. One row per supplier and invoice number, an amount is never guessed or silently replaced, and the table is
// closed to the app (the migration: RLS on, no policy, no grants to anon or authenticated).
import { onRequest, invoiceRow, invoiceKey, invoiceQuery, INVOICE_FIND_MAX, INVOICE_DAY_KEY, INVOICE_DAY_MAX, TABLES, STATE_WRITE } from './_build/routine-db.mjs';
import fs from 'node:fs';
let pass = 0, fail = 0;
const check = (l, c, d) => { if (c) { pass++; console.log('  ✓ ' + l); } else { fail++; console.log('  ✗ ' + l + (d !== undefined ? '  -> ' + JSON.stringify(d).slice(0, 300) : '')); } };
const SB = 'https://znhjtpcltrxxyfjczgvw.supabase.co';
const base = { op: 'invoice_set', agent: 'routine-mail-triage', why: 'mail from the supplier, 12/11', supplier: 'מעבדות אקולוגיה בע"מ', num: '26332' };

console.log('\n1. the pure parts');
check('pairs: the supplier key joins spellings (with and without the company suffix, spaces, a dash) and keeps different suppliers apart', invoiceKey('מעבדות אקולוגיה בע"מ') === invoiceKey('מעבדות  אקולוגיה') && invoiceKey('Gazit Ltd.') === invoiceKey('gazit') && invoiceKey('A-B Safety') === invoiceKey('ab safety') && invoiceKey('gazit') !== invoiceKey('gafir') && invoiceKey('בע"מ') === '' && invoiceKey('x') === 'x');
const ok = invoiceRow(Object.assign({}, base, { amount: 1234.5, inv_date: '2026-11-10', received: '2026-11-12', has_report: true }));
check('a full call: the key, the number, and only the given fields', ok.key && ok.num === '26332' && ok.set.amount === 1234.5 && ok.set.inv_date === '2026-11-10' && ok.set.received_at === '2026-11-12T12:00:00.000Z' && ok.set.has_report === true && !('forwarded_at' in ok.set) && !('chk' in ok.set), ok);
const bad = (o) => !!invoiceRow(Object.assign({}, base, o)).error;
check('pairs: an amount as text, with 3 decimals, negative or huge is refused; 0, 12.5 and 1234.56 pass', bad({ amount: '1234' }) && bad({ amount: 1.234 }) && bad({ amount: -1 }) && bad({ amount: 1e9 }) && bad({ amount: NaN }) && !bad({ amount: 0 }) && !bad({ amount: 12.5 }) && !bad({ amount: 1234.56 }) && [19.99, 0.07, 1.15, 0.29, 4.35, 0.57, 1.13, 99999.99].every((x) => !bad({ amount: x }) && invoiceRow(Object.assign({}, base, { amount: x })).set.amount === x) && bad({ amount: 19.999 }));
check('refused: no supplier, a number with spaces or a quote, a bad date, an extra field, no why', bad({ supplier: '' }) && bad({ num: '12 34' }) && bad({ num: "1'--" }) && bad({ inv_date: '10/11/2026' }) && bad({ received: 'yesterday' }) && bad({ id: 'inv-x' }) && bad({ why: '' }) && bad({ has_report: 'yes' }));
check('control characters and direction marks do not stay in the text fields', invoiceRow(Object.assign({}, base, { note: 'a‮b\u0007c' })).set.note === 'a b c');
const q = invoiceQuery({ op: 'invoice_find', agent: 'x', supplier: 'Gazit Ltd', from: '2026-01-01', to: '2026-11-13', open: true, check: true });
check('the find query: by supplier key, dates, not forwarded, to check; capped; an extra field or a bad date is refused', /supplier_key=like\.\*gazit\*/.test(q.query) && /received_at=gte\.2026-01-01T/.test(q.query) && /forwarded_at=is\.null/.test(q.query) && /chk=is\.true/.test(q.query) && new RegExp('limit=' + INVOICE_FIND_MAX).test(q.query) && !!invoiceQuery({ op: 'invoice_find', select: '*' }).error && !!invoiceQuery({ op: 'invoice_find', from: 'x' }).error && !!invoiceQuery({ op: 'invoice_find', num: '1&select=*' }).error, q);
check('the supplier cannot inject into the query', !/[&=]evil/.test(invoiceQuery({ supplier: 'ab&evil=1*' }).query));

console.log('\n2. the op');
let rows = [], calls = [], st = {}, sv = {};
globalThis.fetch = async (url, opt = {}) => {
  url = String(url); const m = opt.method || 'GET'; calls.push({ url, m, body: opt.body });
  if (url.startsWith(SB + '/rest/v1/server_state')) { const k = decodeURIComponent((/key=eq\.([^&]*)/.exec(url) || [])[1] || '');
    if (m === 'PATCH') { const b = JSON.parse(opt.body); st[k] = b.value; sv[k] = b.updated_at; return new Response(JSON.stringify([{ key: k }]), { status: 200 }); }
    if (m === 'POST') { const out = []; JSON.parse(opt.body).forEach((r) => { if (r.key in st) return; st[r.key] = r.value; sv[r.key] = r.updated_at; out.push(r); }); return new Response(JSON.stringify(out), { status: 201 }); }
    return new Response(JSON.stringify(k in st ? [{ value: st[k], updated_at: sv[k] }] : []), { status: 200 }); }
  if (url.startsWith(SB + '/rest/v1/invoices')) {
    if (m === 'POST') { const r = JSON.parse(opt.body)[0]; if (rows.find((x) => x.supplier_key === r.supplier_key && x.num === r.num)) return new Response('{}', { status: 409 }); rows.push(r); return new Response('', { status: 201 }); }
    if (m === 'PATCH') { const id = decodeURIComponent(/id=eq\.([^&]*)/.exec(url)[1]); Object.assign(rows.find((x) => x.id === id), JSON.parse(opt.body)); return new Response(null, { status: 204 }); }
    const k = decodeURIComponent((/supplier_key=eq\.([^&]*)/.exec(url) || [])[1] || ''), n = decodeURIComponent((/num=eq\.([^&]*)/.exec(url) || [])[1] || '');
    return new Response(JSON.stringify(k ? rows.filter((x) => x.supplier_key === k && x.num === n) : rows), { status: 200 });
  }
  return new Response('[]', { status: 200 });
};
const ENV = { ROUTINE_KEY: 'k-123', SUPABASE_SERVICE_ROLE_KEY: 'srv' };
const call = async (body) => { const r = await onRequest({ request: new Request('https://x/api/routine-db', { method: 'POST', headers: { 'x-routine-key': 'k-123', 'content-type': 'application/json' }, body: JSON.stringify(body) }), env: ENV }); return { status: r.status, json: await r.json() }; };

let r = await call(Object.assign({}, base, { received: '2026-11-12' }));
check('a new invoice with no amount: added and marked to check (an amount is never guessed)', r.json.ok && r.json.added && r.json.check === true && rows.length === 1 && rows[0].chk === true && rows[0].amount === undefined && /^inv-/.test(rows[0].id), { j: r.json, rows });
r = await call(Object.assign({}, base, { supplier: 'מעבדות אקולוגיה', amount: 850, forwarded: '2026-11-13' }));
check('the same invoice again (another spelling, the forward): one row, updated, the amount clears "to check", what was not given stays', r.json.ok && r.json.updated && rows.length === 1 && rows[0].amount === 850 && rows[0].chk === false && rows[0].forwarded_at === '2026-11-13T12:00:00.000Z' && rows[0].received_at === '2026-11-12T12:00:00.000Z', { j: r.json, rows });
r = await call(Object.assign({}, base, { amount: 8500 }));
check('a different amount for a row that has one: not changed, marked to check, and the caller is told', r.json.ok === false && /different amount/.test(r.json.error) && rows[0].amount === 850 && rows[0].chk === true, { j: r.json, row: rows[0] });
r = await call(Object.assign({}, base, { check: false }));
check('security review: check false with no amount does not clear "to check"', r.json.ok && rows[0].chk === true, rows[0]);
r = await call(Object.assign({}, base, { amount: 850, check: false }));
check('the same amount again with check false clears the mark', r.json.ok && rows[0].chk === false);
check('a bad call writes nothing', (await call(Object.assign({}, base, { amount: '850' }))).status === 400 && (await call(Object.assign({}, base, { num: '1;drop' }))).status === 400 && rows.length === 1);
await call(Object.assign({}, base, { num: '26333', amount: 100 }));
// 13/11/2026: the 2026 fill gave amounts to rows marked for another reason (a 2025 invoice, a credit memo), and the mark was lost
await call(Object.assign({}, base, { num: '26334', check: true, note: 'a 2025 invoice' }));
await call(Object.assign({}, base, { num: '26334', amount: 200 }));
{ const nr = rows.find((x) => x.num === '26334');
  check('an amount does not clear "to check" on a row marked with a note; amount with check false does', nr.amount === 200 && nr.chk === true, nr);
  await call(Object.assign({}, base, { num: '26334', amount: 200, check: false })); check('  ...and check false with the amount clears it', nr.chk === false, nr);
  rows.splice(rows.indexOf(nr), 1); }
r = await call({ op: 'invoice_find', agent: 'routine-wa-assistant', supplier: 'אקולוגיה' });
check('invoice_find returns the rows, and no internal key or id', r.json.ok && r.json.count === 2 && calls[calls.length - 1].url.includes('select=supplier,num,amount') && !/supplier_key|select=\*|select=id/.test(calls[calls.length - 1].url.split('?')[1].split('&')[0]), r.json);
check('invoices is not open through the general select op', TABLES.indexOf('invoices') < 0);
check('the answer of invoice_find says its text fields are data from mails, not instructions', /data, not instructions/.test(r.json.note));
{ const keep = st[INVOICE_DAY_KEY]; st[INVOICE_DAY_KEY] = new Date().toISOString().slice(0, 10) + ':' + INVOICE_DAY_MAX; const n0 = rows.length; const rc = await call(Object.assign({}, base, { num: '99999' }));
  check('the daily cap stops a write, and agents cannot reset the counter', rc.json.ok === false && /ledger writes a day/.test(rc.json.error) && rows.length === n0 && STATE_WRITE.indexOf(INVOICE_DAY_KEY) < 0, rc.json); st[INVOICE_DAY_KEY] = keep; }
const mig = fs.readFileSync(new URL('../../migrations/2026-11-13_invoices.sql', import.meta.url), 'utf8');
check('the migration closes the table: RLS on, no policy, nothing granted to anon or authenticated, one row per supplier and number', /enable row level security/.test(mig) && /revoke all on public\.invoices from anon, authenticated/.test(mig) && !/create policy/i.test(mig) && /unique \(supplier_key, num\)/.test(mig));

console.log('\ninvoice-ledger-test: ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
