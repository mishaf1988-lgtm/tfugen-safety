// stateCas (30/10/2026, ideas-lab 12): a write to one server_state key that cannot overwrite what was saved after it was read.
// Reads the row with its updated_at, lets mutate(rawValue) build the new value, and writes with PATCH only if updated_at is
// still what was read. 0 rows changed = someone saved in between: read again and mutate again (mutate must be pure).
// A key that does not exist yet is created with POST that ignores a duplicate, so two first writes cannot both win.
// mutate returns { value } to write, or { write: false } to stop. Returns { written, conflict?, status? }.
export async function stateCas(url, h, key, mutate, signal, tries = 5) {
  const base = url + '/rest/v1/server_state';
  for (let i = 0; i < tries; i++) {
    const rd = await fetch(base + '?select=value,updated_at&key=eq.' + encodeURIComponent(key), { headers: h, signal: signal ? signal() : undefined });
    if (!rd.ok) throw new Error('read ' + rd.status);
    const row = (await rd.json())[0];
    const m = mutate(row ? row.value : undefined);
    if (!m || m.write === false) return { written: false };
    let at = new Date().toISOString();
    // the same millisecond as the version read would look unchanged: always move forward
    if (row && Date.parse(at) <= Date.parse(row.updated_at)) at = new Date(Date.parse(row.updated_at) + 1).toISOString();
    const w = row
      ? await fetch(base + '?key=eq.' + encodeURIComponent(key) + '&updated_at=eq.' + encodeURIComponent(row.updated_at), { method: 'PATCH', headers: { ...h, Prefer: 'return=representation' }, body: JSON.stringify({ value: m.value, updated_at: at }), signal: signal ? signal() : undefined })
      : await fetch(base + '?on_conflict=key', { method: 'POST', headers: { ...h, Prefer: 'resolution=ignore-duplicates,return=representation' }, body: JSON.stringify([{ key, value: m.value, updated_at: at }]), signal: signal ? signal() : undefined });
    if (!w.ok) return { written: false, status: w.status };
    const got = await w.json();
    if (Array.isArray(got) && got.length) return { written: true };
  }
  return { written: false, conflict: true };
}
