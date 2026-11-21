// One mock of the server_state table for the tests (21/11/2026, Michael in the questionnaire: "do it: a shared database
// mock for the tests"; on the night of 20/11/2026 the same versioned mock was written five times, once per test file).
// It answers like PostgREST does for what the server code uses:
//   GET   ?key=eq.K / ?key=in.(A,B) / no filter      rows {key, value, updated_at}
//   POST  ?on_conflict=key  merge-duplicates (replaces) or ignore-duplicates (an existing row stays);
//         return=representation gives the rows written, else 201 with no body
//   PATCH ?key=eq.K&updated_at=eq.V   compare-and-swap (stateCas): an old version changes nothing and returns []
//   PATCH ?key=eq.K&value=eq.T        the same on the value (a lease given back with its token)
//   PATCH ?key=eq.K                   a plain update
// value is a text column: an object or an array written as a value comes back as its JSON string.
// Use:  const db = stateMock(); ... if (url.startsWith(SB + '/rest/v1/server_state')) return db.handle(url, init);
//   stateMock(() => state) reads the test's own map on every call (the test may replace it).
//   db.state         {key: text}, read and written by the test directly; db.set(key, value) also moves the version
//   db.casRead[key]  a function that runs once right after the next versioned read of key (select has updated_at):
//                    "another writer between the read and the write". Change the row inside it with db.set.
export function stateMock(start) {
  // start: the first rows, or a function that gives the test's own map (a test that says `state = {}` between its
  // parts keeps working: the mock reads the map anew on every call).
  const db = { ver: {}, casRead: {}, calls: [] };
  if (typeof start === 'function') Object.defineProperty(db, 'state', { get: start });
  else db.state = Object.assign({}, start || {});
  const text = (v) => (v === null || v === undefined || typeof v === 'string' ? v : JSON.stringify(v));
  const json = (x, st = 200) => new Response(JSON.stringify(x), { status: st, headers: { 'Content-Type': 'application/json' } });
  db.at = (k) => new Date(Date.UTC(2026, 0, 1) + (db.ver[k] || 0)).toISOString();
  db.set = (k, v) => { db.state[k] = text(v); db.ver[k] = (db.ver[k] || 0) + 1; };
  db.row = (k) => ({ key: k, value: db.state[k], updated_at: db.at(k) });
  db.handle = (url, init) => {
    const u = decodeURIComponent(String(url)), m = (init && init.method) || 'GET';
    const pref = String((init && init.headers && (init.headers.Prefer || init.headers.prefer)) || '');
    const eq = /[?&]key=eq\.([^&]*)/.exec(u), inn = /[?&]key=in\.\(([^)]*)\)/.exec(u);
    db.calls.push({ url: u, m, body: init && init.body, prefer: pref });
    if (m === 'GET') {
      const keys = eq ? [eq[1]] : inn ? inn[1].split(',').map((s) => s.replace(/^"|"$/g, '')) : Object.keys(db.state);
      const out = keys.filter((k) => k in db.state).map(db.row);
      if (eq && /select=[^&]*updated_at/.test(u) && db.casRead[eq[1]]) { const f = db.casRead[eq[1]]; delete db.casRead[eq[1]]; f(db); }
      return json(out);
    }
    if (m === 'POST') {
      const rows = [].concat(JSON.parse(init.body)), ign = /ignore-duplicates/.test(pref), wrote = [];
      rows.forEach((r) => { if (ign && r.key in db.state) return; db.set(r.key, r.value); wrote.push({ key: r.key }); });
      return /return=representation/.test(pref) ? json(wrote, 201) : new Response(null, { status: 201 });
    }
    if (m === 'PATCH') {
      const k = eq && eq[1], body = JSON.parse(init.body);
      const ver = /[?&]updated_at=eq\.([^&]*)/.exec(u), val = /[?&]value=eq\.([^&]*)/.exec(u);
      if (!k || !(k in db.state)) return json([]);
      if (ver && ver[1] !== db.at(k)) return json([]);
      if (val && val[1] !== db.state[k]) return json([]);
      db.set(k, body.value);
      return /return=representation/.test(pref) ? json([{ key: k }]) : new Response(null, { status: 204 });
    }
    return json({ error: 'state mock: method ' + m }, 405);
  };
  return db;
}
