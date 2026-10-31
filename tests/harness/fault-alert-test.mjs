// Fault alert (31/10/2026, functions/_faults.js): every watchdog tick tells Michael, in ONE WhatsApp, about errors in
// users' browsers and agents that reported a failure since the last tick; the same fault once a day.
import { faultItems, faultText, FAULT_LINES, FAULT_FIRST_MS } from './_build/_faults.mjs';
import fs from 'node:fs';
let pass = 0, fail = 0;
const check = (l, c, d) => { if (c) { pass++; console.log('  ✓ ' + l); } else { fail++; console.log('  ✗ ' + l + (d !== undefined ? '  -> ' + JSON.stringify(d) : '')); } };
const err = (ts, m, p) => ({ ts, title: JSON.stringify({ m, f: 'app.js', l: 9, p: p || 'dash' }) });
const NOW = '2026-10-31T14:50:00.000Z';

{ // first run: only the last FAULT_FIRST_MS count, nothing older is shouted about
  const old = new Date(Date.parse(NOW) - FAULT_FIRST_MS - 60e3).toISOString(), recent = new Date(Date.parse(NOW) - 60e3).toISOString();
  const r = faultItems(null, [err(old, 'old one'), err(recent, 'a is undefined')], [], NOW);
  check('first run: only what happened in the last minutes', r.items.length === 1 && r.items[0].text.indexOf('a is undefined') > 0, r.items);
  check('the mark moves to now', r.fault.at === NOW);
}
{ // the same error twice, and again later the same day: once
  const prev = { at: '2026-10-31T14:00:00.000Z', sent: {} };
  const r1 = faultItems(prev, [err('2026-10-31T14:10:00Z', 'boom'), err('2026-10-31T14:20:00Z', 'boom')], [], NOW);
  check('the same error twice in one tick is one line', r1.items.length === 1);
  const r2 = faultItems(r1.fault, [err('2026-10-31T15:00:00Z', 'boom')], [], '2026-10-31T15:05:00.000Z');
  check('the same error later the same day is not said again', r2.items.length === 0);
  const r3 = faultItems(r1.fault, [err('2026-11-01T06:00:00Z', 'boom')], [], '2026-11-01T06:05:00.000Z');
  check('the next day it is said again, and yesterday is forgotten', r3.items.length === 1 && Object.values(r3.fault.sent).every((d) => d === '2026-11-01'));
}
{ // agents: a failure since the mark, by the agent's short name; a success or an older failure is not
  const prev = { at: '2026-10-31T14:00:00.000Z', sent: {} };
  const log = [{ agent: 'routine-map-lights', at: '2026-10-31T14:10:00Z', ok: false, line: 'list_triggers missing' },
    { agent: 'wa-assistant', at: '2026-10-31T14:11:00Z', ok: true, line: 'fine' },
    { agent: 'dev-fire', at: '2026-10-31T13:00:00Z', ok: false, line: 'old' }];
  const r = faultItems(prev, [], log, NOW);
  check('an agent that failed since the last tick, once, by its short name', r.items.length === 1 && r.items[0].key === 'agent:map-lights', r.items);
}
{ // the text
  const items = Array.from({ length: FAULT_LINES + 3 }, (_, i) => ({ key: 'k' + i, text: 'x' + i }));
  const t = faultText(items);
  check('at most FAULT_LINES lines and "and N more"', t.split('\n').filter((l) => l.startsWith('- x')).length === FAULT_LINES && t.indexOf('3') > 0);
  check('only keyboard characters and no long dash', !/[—–«»“”]/.test(t));
}
{ // wiring: the watchdog calls it, and a fault-alert failure does not fail the watch
  const src = fs.readFileSync(new URL('../../functions/_watchdog.js', import.meta.url), 'utf8');
  check('runWatch calls runFaultAlert inside its own try', /try \{ r\.faults = await runFaultAlert\(/.test(src));
  const fsrc = fs.readFileSync(new URL('../../functions/_faults.js', import.meta.url), 'utf8');
  check('a failed audit_log read does not move the mark (no lost faults)', /if \(!r \|\| !r\.ok\) return/.test(fsrc) && /if \(sentOk\) await stateSet/.test(fsrc));
  check('no raw Hebrew in the server file', !/[א-ת]/.test(fsrc));
}
console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
