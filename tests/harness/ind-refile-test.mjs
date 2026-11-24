// routine-db ind_refile (24/11/2026, Michael: "send the updated mail with the updated link for the new worker, to me and to HR"):
// the induction mail again with a fresh correction link, built from the worker's signed values, to the two fixed recipients only.
import { onRequest } from './_build/routine-db.mjs';
import { readEditToken } from './_build/_indedit.mjs';
let pass = 0, fail = 0;
const check = (l, c, d) => { if (c) { pass++; console.log('  ✓ ' + l); } else { fail++; console.log('  ✗ ' + l + (d !== undefined ? '  -> ' + JSON.stringify(d).slice(0, 400) : '')); } };
const SB = 'https://znhjtpcltrxxyfjczgvw.supabase.co';
const GR = 'https://graph.microsoft.com/v1.0/me';
const ENV = { ROUTINE_KEY: 'k-123', SUPABASE_SERVICE_ROLE_KEY: 'srv', SUPABASE_URL: SB, TRUSTEE_NOTIFY_SECRET: 'nsec' };
const png = Buffer.from(new Uint8Array(1024).map((_, i) => (i < 8 ? [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a][i] : 0)));
const TALK = { id: 'ind1', title: 'הוראות כניסה', body: 'x', s: 'פורסמה', kind: 'induction', link_v: 0 };
const ROW = { id: 'r1abc2', talk_id: 'ind1', emp_name: 'סבטלנה לריונוב', id_no: '334455667', dept: 'מעוצבים', phone: '0521234567', job: 'מפעילה', sig_url: SB + '/storage/v1/object/public/incidents-photos/sig.png', lang: 'he', read_at: '2026-11-24T08:55:45Z', mailed_at: '2026-11-24T08:55:48Z', equip: null, edits: null };
async function run(body, row) {
  const w = { mails: [], puts: [] };
  const real = globalThis.fetch;
  globalThis.fetch = async (url, init = {}) => {
    const u = String(url), m = init.method || 'GET';
    const json = (o, st = 200) => new Response(JSON.stringify(o), { status: st, headers: { 'Content-Type': 'application/json' } });
    if (u.startsWith(SB + '/rest/v1/toolbox_talks')) return json([TALK]);
    if (u.startsWith(SB + '/rest/v1/toolbox_reads')) return m === 'PATCH' ? new Response(null, { status: 204 }) : json(/id=eq\.r1abc2/.test(u) ? [row] : []);
    if (u.startsWith(SB + '/storage/v1/object/public/incidents-photos/sig.png')) return new Response(png, { status: 200 });
    if (u.startsWith(SB + '/storage/v1/object/list/')) return json([]);
    if (u.startsWith(SB + '/storage/v1/object/')) return json({ Key: 'x' });
    if (u.startsWith(SB + '/rest/v1/oauth_tokens')) return json([{ user_email: 'sviva@tapugan.co.il', refresh_token: 'r', access_token: 'at', expires_at: new Date(Date.now() + 3600e3).toISOString(), scope: 'Files.ReadWrite Mail.Send' }]);
    if (u.startsWith(GR + '/drive/root:/') && m === 'PUT') { w.puts.push(decodeURIComponent(u.slice((GR + '/drive/root:/').length))); return json({ webUrl: 'https://od.example/x', size: 1 }); }
    if (u.startsWith(GR + '/drive/root:/') && /\?format=pdf$/.test(u)) { const b = new Uint8Array(2000); b.set([0x25, 0x50, 0x44, 0x46], 0); return new Response(b, { status: 200 }); }
    if (u === GR + '/sendMail') { w.mails.push(JSON.parse(init.body)); return new Response(null, { status: 202 }); }
    return json([]);
  };
  try {
    const r = await onRequest({ request: new Request('https://x/api/routine-db', { method: 'POST', headers: { 'x-routine-key': 'k-123', 'content-type': 'application/json' }, body: JSON.stringify(body) }), env: ENV });
    return { st: r.status, j: await r.json(), w };
  } finally { globalThis.fetch = real; }
}
{
  const r = await run({ op: 'ind_refile', id: 'r1abc2', force: true }, ROW);
  const ml = r.w.mails[0] && r.w.mails[0].message, to = ml ? ml.toRecipients.map((x) => x.emailAddress.address) : [];
  check('a mailed row sent again with force: ok, one mail', r.j.ok === true && r.w.mails.length === 1, r.j);
  check('only the signed-in Michael and HR get it, nobody else', to.length === 2 && to.includes('sviva@tapugan.co.il') && to.includes('hr-tap@tapugan.co.il') && !(ml.ccRecipients || []).length, to);
  const m = /href="([^"]*op=edit[^"]*)"/.exec(ml ? ml.body.content : '');
  const tok = m ? decodeURIComponent(m[1].replace(/&amp;/g, '&').split('e=')[1]) : '';
  check('the mail carries a fresh correction link of this row', (await readEditToken(ENV, tok)).id === 'r1abc2', tok.slice(0, 30));
  check('the signed form is attached', ml && ml.attachments && ml.attachments[0] && ml.attachments[0].contentType === 'application/pdf');
}
{
  const r = await run({ op: 'ind_refile', id: 'r1abc2' }, ROW);
  check('without force a row already mailed is refused (no second mail by a stale call)', r.j.ok === false && r.j.error === 'already sent' && r.w.mails.length === 0, r.j);
  const e = await run({ op: 'ind_refile', id: 'nope12' }, ROW);
  check('an unknown row: not found, nothing sent', e.j.ok === false && e.j.error === 'not found' && e.w.mails.length === 0, e.j);
  const b = await run({ op: 'ind_refile', id: 'a b; drop' }, ROW);
  check('a bad id: refused before any read', b.j.ok === false && /id/.test(b.j.error) && b.w.mails.length === 0, b.j);
  const k = await run({ op: 'ind_refile', id: 'r1abc2', to: 'x@y.co' }, ROW);
  check('there is no way to choose the recipient: a "to" field changes nothing', k.w.mails.length === 0 || k.w.mails[0].message.toRecipients.every((x) => ['sviva@tapugan.co.il', 'hr-tap@tapugan.co.il'].includes(x.emailAddress.address)));
}
{
  const corrected = { ...ROW, dept: 'אחזקה', edits: [{ at: 'x', changes: [{ k: 'dept', old: 'מעוצבים', new: 'אחזקה' }] }] };
  const r = await run({ op: 'ind_refile', id: 'r1abc2', force: true }, corrected);
  const src = r.w.puts.find((p) => p.startsWith('Apps/'));
  check('a corrected row: the signed form is built from the values the worker signed, not the corrected ones', r.j.ok === true && !!src, r.j);
}
console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
