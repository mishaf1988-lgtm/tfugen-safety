// /api/xlsx-gaps since 28/10/2026 (Michael in the questionnaire: "\u05d1\u05e6\u05e2: \u05e2\u05d3\u05db\u05d5\u05df \u05d0\u05d5\u05d8\u05d5\u05de\u05d8\u05d9 \u05de\u05d4\u05d0\u05e4\u05dc\u05d9\u05e7\u05e6\u05d9\u05d4 (\u05de\u05d5\u05de\u05dc\u05e5)"): the Excel
// control board is rebuilt from docs, equip_inspections and tasks every night, the board in place moves to
// 00_\u05d3\u05d5\u05d7\u05d5\u05ea \u05d5\u05de\u05e2\u05e7\u05d1/_\u05d2\u05e8\u05e1\u05d0\u05d5\u05ea \u05e7\u05d5\u05d3\u05de\u05d5\u05ea first, and nothing is written when the data did not change. The weekly mail line.
// The rows below are made up; the real board is never copied into the public repo.
import { onRequest, boardSheets, band, eqDomain, fdd, STATE_KEY, BOARD, ARCHIVE } from './_build/xlsx-gaps.mjs';
import { xlsxGapsLine } from './_build/weekly-digest.mjs';

let pass = 0, fail = 0;
const check = (l, c, d) => { if (c) { pass++; console.log('  \u2713 ' + l); } else { fail++; console.log('  \u2717 ' + l + (d !== undefined ? '  -> ' + JSON.stringify(d).slice(0, 400) : '')); } };
const SB = 'https://znhjtpcltrxxyfjczgvw.supabase.co';
const DAY = 86400000;
const DOCS = [
  { n: '\u05d4\u05d9\u05ea\u05e8 \u05e8\u05e2\u05dc\u05d9\u05dd', c: '\u05e8\u05d9\u05e9\u05d5\u05d9 \u05d5\u05d4\u05d9\u05ea\u05e8\u05d9\u05dd', e: '2026-10-20', s: '\u05d1\u05ea\u05d5\u05e7\u05e3', o: '\u05de\u05e9\u05e8\u05d3 \u05d4\u05e1\u05d1\u05d9\u05d1\u05d4', file_url: 'https://x.sharepoint.com/a.pdf' },
  { n: '\u05d8\u05d5\u05e4\u05e1 7', c: '\u05d8\u05e4\u05e1\u05d9\u05dd', e: '2027-12-01', s: '\u05d1\u05ea\u05d5\u05e7\u05e3', file_url: 'od:F1|a.pdf' },
  { n: '\u05d9\u05e9\u05df', c: '\u05d8\u05e4\u05e1\u05d9\u05dd', e: '2020-01-01', s: '\u05dc\u05d0 \u05e8\u05dc\u05d5\u05d5\u05e0\u05d8\u05d9 - \u05d4\u05d5\u05e6\u05d0' },
];
const EQ = [
  { code: 'FL-1', n: '\u05de\u05dc\u05d2\u05d6\u05d4', e: '2026-11-10', s: '\u05db\u05e9\u05d9\u05e8 \u05dc\u05e2\u05d1\u05d5\u05d3\u05d4', vendor: "\u05d2'\u05d5\u05e8\u05d2' \u05e4\u05e8\u05d9\u05d3", resp_area: null, inspection_type: '\u05de\u05dc\u05d2\u05d6\u05d4' },
  { code: 'CAL-1', n: '\u05db\u05d9\u05d5\u05dc', e: '2027-01-15', s: '\u05de\u05d5\u05ea\u05e8 \u05dc\u05e9\u05d9\u05de\u05d5\u05e9', resp_area: null, inspection_type: '\u05d0\u05d7\u05e8' },
  { code: 'NH3', n: '\u05e6\u05e0\u05e8\u05ea', e: null, s: '\u05de\u05d5\u05ea\u05e8 \u05dc\u05e9\u05d9\u05de\u05d5\u05e9', resp_area: '\u05e7\u05d9\u05e8\u05d5\u05e8 \u05d5\u05d0\u05de\u05d5\u05e0\u05d9\u05d4', inspection_type: '\u05d0\u05d7\u05e8' },
];
const TK = [
  { id: 't1', ext_id: 'xl1008-t3', title: '\u05dc\u05d9\u05e7\u05d5\u05d9 \u05ea\u05e8\u05de\u05d5\u05d2\u05e8\u05e4\u05d9', due: '2026-09-30', status: '\u05e4\u05ea\u05d5\u05d7', assignee: '\u05d0\u05d7\u05d6\u05e7\u05d4' },
  { id: 't2', ext_id: 'xl1008-t2', title: '\u05db\u05d9\u05d5\u05dc \u05e9\u05e4\u05db\u05d9\u05dd', due: null, status: '\u05d4\u05d5\u05e9\u05dc\u05dd', closed_date: '2026-09-09' },
  { id: 't3', title: '\u05ea\u05db\u05e0\u05d9\u05ea \u05d0\u05e9', due: '2026-12-31', status: '\u05d1\u05d4\u05ea\u05e7\u05d3\u05de\u05d5\u05ea' },
];

(async () => {
  console.log('1. the sheets');
  check('bands: past = expired, up to 30 urgent, 31-90 near, more fine, no date', band(-1) === 0 && band(0) === 1 && band(30) === 1 && band(31) === 2 && band(90) === 2 && band(91) === 3 && band(null) === 4);
  check('equipment domain: area, else calibrations for "\u05d0\u05d7\u05e8", else inspections', eqDomain(EQ[2]) === '\u05e7\u05d9\u05e8\u05d5\u05e8 \u05d5\u05d0\u05de\u05d5\u05e0\u05d9\u05d4' && eqDomain(EQ[1]) === '\u05db\u05d9\u05d5\u05dc\u05d9\u05dd \u05d5\u05d1\u05d3\u05d9\u05e7\u05d5\u05ea' && eqDomain(EQ[0]) === '\u05ea\u05e1\u05e7\u05d9\u05e8\u05d9 \u05e6\u05d9\u05d5\u05d3');
  check('dates DD/MM/YYYY, empty for none', fdd('2027-01-15') === '15/01/2027' && fdd(null) === '' && fdd('x') === '');
  const b = boardSheets(DOCS, EQ, TK, '2026-10-28', '28/10/2026 13:00');
  const [sum, sched, tasks] = b.sheets.map((x) => x.aoa);
  check('three sheets with the old names', b.sheets.map((x) => x.name).join('|') === '\u05dc\u05d5\u05d7 \u05d1\u05e7\u05e8\u05d4 \u05e8\u05d0\u05e9\u05d9|\u05dc\u05d5\u05d7 \u05d6\u05de\u05e0\u05d9\u05dd|\u05de\u05e9\u05d9\u05de\u05d5\u05ea \u05d5\u05dc\u05d9\u05e7\u05d5\u05d9\u05d9\u05dd');
  check('"\u05dc\u05d0 \u05e8\u05dc\u05d5\u05d5\u05e0\u05d8\u05d9" is left out: 5 items', sched.length === 6 && !sched.some((r) => r[1] === '\u05d9\u05e9\u05df') && b.counts.items === 5, sched);
  check('the schedule: most urgent first, no date last', sched[1][1] === '\u05d4\u05d9\u05ea\u05e8 \u05e8\u05e2\u05dc\u05d9\u05dd' && sched[1][3] === -8 && sched[1][4] === '\u05e4\u05d2 \u05ea\u05d5\u05e7\u05e3' && sched[2][1] === 'FL-1 - \u05de\u05dc\u05d2\u05d6\u05d4' && sched[2][4] === '\u05d3\u05d7\u05d5\u05e3' && sched[5][4] === '\u05dc\u05dc\u05d0 \u05ea\u05d0\u05e8\u05d9\u05da', sched);
  check('a link only for an https file, the date as DD/MM/YYYY', sched[1][6].link === 'https://x.sharepoint.com/a.pdf' && sched[1][2] === '20/10/2026' && sched.find((r) => r[1] === '\u05d8\u05d5\u05e4\u05e1 7')[6] === '', sched);
  const tot = sum.find((r) => r[0] === '\u05e1\u05d4"\u05db');
  check('the summary: a row per domain and a total by band', tot && tot[1] === 5 && tot[2] === 1 && tot[3] === 1 && sum.some((r) => r[0] === '\u05e7\u05d9\u05e8\u05d5\u05e8 \u05d5\u05d0\u05de\u05d5\u05e0\u05d9\u05d4' && r[6] === 1), sum);
  check('the summary says it is read only, and when it was built', sum.some((r) => /\u05dc\u05e7\u05e8\u05d9\u05d0\u05d4 \u05d1\u05dc\u05d1\u05d3/.test(r[0] || '')) && /28\/10\/2026 13:00/.test(sum[sum.length - 1][0]));
  check('tasks: open first, late marked, closed last with its date', tasks[1][1] === '\u05dc\u05d9\u05e7\u05d5\u05d9 \u05ea\u05e8\u05de\u05d5\u05d2\u05e8\u05e4\u05d9' && /\u05d1\u05d0\u05d9\u05d7\u05d5\u05e8/.test(tasks[1][4]) && tasks[1][3] === -28 && tasks[3][1] === '\u05db\u05d9\u05d5\u05dc \u05e9\u05e4\u05db\u05d9\u05dd' && tasks[3][7] === '09/09/2026' && tasks[3][3] === '', tasks);
  check('open and late counted', b.counts.open === 2 && b.counts.late === 1);
  const b2 = boardSheets(DOCS, EQ, TK, '2026-10-28', '28/10/2026 23:59');
  check('the hashed data leaves out the time it was built', JSON.stringify(b2.data) === JSON.stringify(b.data));
  const b3 = boardSheets(DOCS, EQ, TK, '2026-11-15', '15/11/2026 03:05');
  check('...and the days left, which move every night (security review 28/10/2026)', JSON.stringify(b3.data) === JSON.stringify(b.data) && b3.sheets[1].aoa[1][3] !== b.sheets[1].aoa[1][3]);
  const b4 = boardSheets([Object.assign({}, DOCS[0], { e: '2027-10-20' })].concat(DOCS.slice(1)), EQ, TK, '2026-10-28', 'x');
  check('a new expiry date changes it', JSON.stringify(b4.data) !== JSON.stringify(b.data));
  const b5 = boardSheets([Object.assign({}, DOCS[0], { file_url: 'https://evil.example/a.pdf' })], [], [], '2026-10-28', 'x');
  check('a link only to SharePoint or Supabase', b5.sheets[1].aoa[1][6] === '');

  console.log('\n2. the endpoint');
  const ENV = { SUPABASE_SERVICE_ROLE_KEY: 'srv', ONEDRIVE_CLIENT_ID: 'cid', ONEDRIVE_CLIENT_SECRET: 'cs', TRUSTEE_NOTIFY_SECRET: 'nsec' };
  function world(o) {
    const w = { state: Object.assign({}, o.state || {}), calls: [] };
    globalThis.fetch = async (url, init) => {
      const u = String(url), mth = (init && init.method) || 'GET', d = decodeURIComponent(u);
      const json = (x, st = 200) => new Response(JSON.stringify(x), { status: st, headers: { 'Content-Type': 'application/json' } });
      if (u.startsWith(SB + '/rest/v1/oauth_tokens')) return json([{ user_email: 'a@b', refresh_token: 'rt', access_token: 'at', expires_at: new Date(Date.now() + 3600e3).toISOString(), scope: 'offline_access User.Read Files.ReadWrite Mail.Send' }]);
      if (u.startsWith(SB + '/rest/v1/server_state')) {
        if (mth !== 'GET') { JSON.parse(init.body).forEach((x) => { w.state[x.key] = x.value; }); return new Response(null, { status: 201 }); }
        return json(Object.keys(w.state).map((k) => ({ key: k, value: w.state[k], updated_at: '2026-10-28T00:00:00Z' })));
      }
      if (u.startsWith(SB + '/rest/v1/docs')) return json(DOCS);
      if (u.startsWith(SB + '/rest/v1/equip_inspections')) return json(EQ);
      if (u.startsWith(SB + '/rest/v1/tasks')) return json(TK);
      if (u.startsWith('https://graph.microsoft.com/')) {
        w.calls.push(mth + ' ' + d);
        if (mth === 'GET' && d.includes(BOARD + '?')) return o.noBoard ? json({}, 404) : json({ id: 'B1', file: {} });
        if (mth === 'GET' && d.includes(ARCHIVE + '?')) return o.noArchive ? json({}, 404) : json({ id: 'A1', folder: {} });
        if (mth === 'GET') return json({ id: 'P1' });
        if (mth === 'POST') return json({ id: 'A2', folder: {} }, 201);
        if (mth === 'PATCH') return o.moveFail ? json({ error: 'locked' }, 423) : json({ id: 'B1' });
        if (mth === 'PUT') return o.putFail ? json({ error: { code: 'x' } }, 500) : json({ webUrl: 'https://w', size: 9 }, 201);
      }
      return json({ error: 'unexpected ' + u }, 599);
    };
    return w;
  }
  const req = (h) => new Request('https://x/api/xlsx-gaps', { method: 'POST', headers: Object.assign({ 'Content-Type': 'application/json' }, h || {}), body: '{}' });
  const S = { 'x-notify-secret': 'nsec' };
  let w = world({});
  let res = await onRequest({ request: req(), env: ENV });
  check('no secret: 403, nothing touched', res.status === 403 && !w.calls.length);
  res = await onRequest({ request: req(S), env: ENV });
  let s = JSON.parse(w.state[STATE_KEY] || '{}');
  const move = w.calls.find((c) => c.startsWith('PATCH')), put = w.calls.find((c) => c.startsWith('PUT'));
  check('first run: the old board moves to the archive with the date, never overwritten', !!move && /conflictBehavior=fail/.test(move) && w.calls.indexOf(move) < w.calls.indexOf(put), w.calls);
  check('then the new board is written in the same place and name', !!put && put.includes(BOARD + ':/content'), w.calls);
  check('state: ok, written, a hash, the counts', s.ok === true && s.board && s.board.changed === true && s.board.hash && s.board.items === 5 && /^00_.*\d{2}-\d{2}-\d{4} \d{2}\.\d{2}\.xlsx$/.test(s.board.archived), s);
  const st1 = w.state[STATE_KEY];
  w = world({ state: { [STATE_KEY]: st1 } });
  await onRequest({ request: req(S), env: ENV });
  s = JSON.parse(w.state[STATE_KEY] || '{}');
  check('same data the next night: nothing archived, the board rewritten in place (days left move)', !w.calls.some((c) => c.startsWith('PATCH')) && w.calls.some((c) => c.startsWith('PUT')) && s.ok === true && s.board.changed === false && s.board.archived === '', { calls: w.calls, s });
  w = world({ noBoard: true, noArchive: true });
  await onRequest({ request: req(S), env: ENV });
  s = JSON.parse(w.state[STATE_KEY] || '{}');
  check('no board in place: nothing moved, the board is written', !w.calls.some((c) => c.startsWith('PATCH')) && w.calls.some((c) => c.startsWith('PUT')) && s.ok && s.board.archived === '', w.calls);
  w = world({ moveFail: true });
  await onRequest({ request: req(S), env: ENV });
  s = JSON.parse(w.state[STATE_KEY] || '{}');
  check('the move fails: no new board over the old one, ok false with the reason', !w.calls.some((c) => c.startsWith('PUT')) && s.ok === false && /archive move 423/.test(s.error), s);
  w = world({ noArchive: true });
  await onRequest({ request: req(S), env: ENV });
  check('no archive folder: made once, then the move', w.calls.some((c) => c.startsWith('POST')) && w.calls.some((c) => c.startsWith('PATCH')), w.calls);

  console.log('\n3. the weekly mail');
  const now = Date.parse('2026-10-29T04:00:00Z'), at = '2026-10-29T03:05:00Z';
  const j = (x) => JSON.stringify(x);
  check('never ran: grey', !xlsxGapsLine(null, now).red && /\u05e2\u05d5\u05d3 \u05dc\u05d0 \u05e0\u05d1\u05e0\u05d4/.test(xlsxGapsLine(null, now).text));
  const l = xlsxGapsLine(j({ at, ok: true, board: { written: '2026-10-28T03:05:00Z', items: 5, expired: 1, open: 2 } }), now);
  check('built: grey with the date and the counts', !l.red && /\u05e0\u05d1\u05e0\u05d4 \u05de\u05d4\u05d0\u05e4\u05dc\u05d9\u05e7\u05e6\u05d9\u05d4 \u05d1-28\/10\/2026, 5 \u05e4\u05e8\u05d9\u05d8\u05d9\u05dd, 1 \u05e4\u05d2\u05d9 \u05ea\u05d5\u05e7\u05e3, 2 \u05de\u05e9\u05d9\u05de\u05d5\u05ea/.test(l.text), l);
  check('failed: red with the reason', xlsxGapsLine(j({ at, ok: false, error: 'archive move 423' }), now).red);
  check('older than 3 days: red (the cron stopped)', xlsxGapsLine(j({ at: new Date(now - 4 * DAY).toISOString(), ok: true, board: { written: at } }), now).red);

  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.log('HARNESS ERROR: ' + (e && e.stack || e)); process.exit(1); });
