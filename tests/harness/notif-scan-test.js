// Runs the REAL _notifDailyScan source extracted from index.html against
// production-shaped data, with every dependency stubbed.
const fs = require('fs');
const html = fs.readFileSync(require('path').resolve(__dirname, '../../index.html'), 'utf8');

const start = html.indexOf('function _notifDailyScan()');
const end = html.indexOf('// Generic notification dispatcher');
const src = html.substring(start, end);
if (start < 0 || end < 0) throw new Error('could not extract _notifDailyScan');

function run(label, DB, prefs) {
  const events = [];
  const store = {};
  const sessionStorage = { getItem: (k) => store[k] || null, setItem: (k, v) => { store[k] = v; } };
  const _notifyEvent = (key, payload) => {
    const on = prefs[key] && (prefs[key].whatsapp || prefs[key].email || prefs[key].inapp);
    events.push({ key, payload, sent: !!on });
    return on ? ['inapp'] : [];
  };
  const fn = new Function('DB', 'sessionStorage', '_notifyEvent', 'console',
    src + '\n_notifDailyScan();');
  fn(DB, sessionStorage, _notifyEvent, console);
  console.log('\n=== ' + label + ' ===');
  if (!events.length) console.log('  (no events)');
  events.forEach(e => console.log('  ' + e.key + ' | ' + e.payload.title +
    ' | table=' + (e.payload.table || '-') + ' | sent=' + e.sent));
  return events;
}

// Real production rows (equip_inspections), dates as stored.
const equip = [
  { id: 'AUTOCLAVE-22110905', n: 'דוד קיטור - אוטוקלאב', code: 'AUTOCLAVE-22110905', e: '2026-09-25' },
  { id: 'WASTE-49571', n: 'פסולתון', code: 'WASTE-49571', e: '2026-10-29' },
  { id: 'BASKET-1.3', n: 'סל הרמה למשאות', code: 'BASKET-1.3', e: '2026-10-29' },
  { id: 'EXPIRED-1', n: 'מלגזה ישנה', code: 'FORK-OLD', e: '2026-06-11' }, // already expired
  { id: 'BAD-DATE', n: 'רשומה פגומה', code: 'X', e: 'not-a-date' },
  { id: 'NO-E', n: 'ללא תפוגה', code: 'Y', e: null },
];

const emptyDB = { tasks: [], rounds: [{ d: new Date().toISOString().split('T')[0] }] };
const allOn = { expiry_30days: { inapp: true }, task_overdue: {}, round_missed: {} };
const allOff = { expiry_30days: { whatsapp: false, email: false, inapp: false }, task_overdue: {}, round_missed: {} };

// 1. The actual fix: equipment in the 0-30 window fires.
run('equip_inspections, channel ON', Object.assign({}, emptyDB, { equip_inspections: equip }), allOn);

// 2. All channels off -> event still evaluated, nothing sent (banner #537 path).
run('equip_inspections, all channels OFF', Object.assign({}, emptyDB, { equip_inspections: equip }), allOff);

// 3. Urgency ordering: the 3-item cap must keep the most urgent.
const many = [];
for (let i = 30; i >= 1; i--) {
  const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() + i);
  many.push({ id: 'E' + i, n: 'item-' + i + 'd', code: 'C' + i, e: d.toISOString().split('T')[0] });
}
run('30 items in window -> cap keeps the 3 most urgent', Object.assign({}, emptyDB, { equip_inspections: many }), allOn);

// 4. Regression: the pre-existing tables still scan.
run('ppe still scanned alongside equipment', Object.assign({}, emptyDB, {
  ppe: [{ id: 'P1', ty: 'קסדה', n: 'קסדה', e: (() => { const d = new Date(); d.setHours(0,0,0,0); d.setDate(d.getDate() + 2); return d.toISOString().split('T')[0]; })() }],
  equip_inspections: equip,
}), allOn);
