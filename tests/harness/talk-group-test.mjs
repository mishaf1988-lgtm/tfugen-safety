// Group mode of the weekly talk (05/10/2026, Michael: "approve"): a one-day link for
// the manager's own phone, passed from worker to worker after a face-to-face briefing.
// Each signature records how the worker was briefed (toolbox_reads.mode), only the
// group page marks who already signed, and the trainer closes with a signed
// declaration. Runs the real talk.js with fetch mocked.
import { onRequest, makeTalkToken, makeGroupToken, readGroupToken, readTalkToken, GROUP_TTL_DAYS, LANGS, TR_DECL } from './_build/talk.mjs';

let pass = 0, fail = 0;
const check = (l, c, d) => { if (c) { pass++; console.log('  ✓ ' + l); } else { fail++; console.log('  ✗ ' + l + (d !== undefined ? '  -> ' + JSON.stringify(d) : '')); } };
const SB = 'https://znhjtpcltrxxyfjczgvw.supabase.co';
const URL0 = 'https://tapugan-safety.pages.dev/api/talk';
const ENV = { SUPABASE_SERVICE_ROLE_KEY: 'srv', TRUSTEE_NOTIFY_SECRET: 'nsec' };
const PUB = { id: 'tt1', d: '2026-10-04', title: 'עבודה בגובה', body: 'רתמה', s: 'פורסמה', trainer: 'מיכאל פרייליך', trainer_qual: 'ממונה בטיחות' };
const EMPS = [{ id: 'e1', n: 'אחמד כהן', dep: 'ייצור' }, { id: 'e2', n: 'דנה לוי', dep: 'אחזקה' }, { id: 'e3', n: 'יוסי מזרחי', dep: 'ייצור', eid: '300000007' }];
const png = new Uint8Array(1024); png.set([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A], 0);
const SIG = 'data:image/png;base64,' + Buffer.from(png).toString('base64');

function world(o) {
  o = o || {};
  const w = { inserts: [], uploads: [], patches: [], empPatches: [], reads: (o.reads || []).slice() };
  globalThis.fetch = async (url, init) => {
    const u = String(url), m = (init && init.method) || 'GET', body = init && init.body;
    const json = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json' } });
    if (u.startsWith(SB + '/rest/v1/toolbox_talks') && m === 'PATCH') { w.patches.push({ u, b: JSON.parse(body) }); return new Response(null, { status: o.patchFail ? 500 : 204 }); }
    if (u.startsWith(SB + '/rest/v1/toolbox_talks')) return json([{ ...PUB, ...(o.talk || {}) }]);
    if (u.startsWith(SB + '/rest/v1/emp') && m === 'PATCH') { w.empPatches.push({ u: decodeURIComponent(u), b: JSON.parse(body) }); return new Response(null, { status: 204 }); }
    if (u.startsWith(SB + '/rest/v1/emp')) return json(EMPS);
    if (u.startsWith(SB + '/rest/v1/toolbox_reads')) {
      if (m === 'POST') { const r = JSON.parse(body); w.inserts.push(r); w.reads.push(r); return new Response(null, { status: 201 }); }
      const e = u.match(/emp_id=eq\.([^&]+)/);
      if (e) return json(w.reads.filter((r) => r.emp_id === decodeURIComponent(e[1])).map((r) => ({ id: r.id })));
      w.listCalls = (w.listCalls || 0) + 1;
      return json(w.reads.map((r) => ({ emp_id: r.emp_id })));
    }
    if (u.startsWith(SB + '/storage/v1/object/incidents-photos/')) { w.uploads.push({ u, upsert: init.headers['x-upsert'] }); return json({ Key: 'x' }); }
    if (u === SB + '/auth/v1/user') { const tok = init.headers.Authorization.replace('Bearer ', ''); return tok === 'good' ? json({ id: 'u1', email: 'michael@tfugen.local' }) : tok === 'rep' ? json({ id: 'u2', email: 'rep@tfugen.local' }) : new Response('no', { status: 401 }); }
    if (u.startsWith(SB + '/rest/v1/app_users')) return json([u.includes('id=eq.michael') ? { role: 'מנהל', active: true } : { role: 'מדווח', active: true }]);
    return json({ error: 'unexpected ' + u }, 599);
  };
  return w;
}
const get = (q) => onRequest({ request: new Request(URL0 + '?' + q), env: ENV });
const post = (fields) => { const fd = new FormData(); for (const [k, v] of Object.entries(fields)) fd.append(k, v); return onRequest({ request: new Request(URL0, { method: 'POST', body: fd, headers: { 'user-agent': 'Mozilla/5.0 (iPhone) Mobile' } }), env: ENV }); };
const link = (body, auth) => onRequest({ request: new Request(URL0, { method: 'POST', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json', Origin: 'https://tapugan-safety.pages.dev', ...(auth ? { Authorization: 'Bearer ' + auth } : {}) } }), env: ENV });

console.log('\n1. the group link');
{
  const w = world();
  const r = await link({ op: 'group', id: 'tt1' }, 'good'); const j = await r.json();
  check('a manager gets a group link with g=1', r.status === 200 && /[?&]g=1/.test(j.url) && j.days === GROUP_TTL_DAYS, j);
  check('it does not move the shared link expiry (link_at)', w.patches.length === 0, w.patches);
  check('a reporter is refused', (await link({ op: 'group', id: 'tt1' }, 'rep')).status === 403);
  const gt = await makeGroupToken(ENV, 'tt1'), lt = await makeTalkToken(ENV, 'tt1');
  check('valid ' + GROUP_TTL_DAYS + ' day, then expired', (await readGroupToken(ENV, gt)).id === 'tt1' && (await readGroupToken(ENV, gt, Date.now() + 2 * 864e5)).error === 'expired');
  check('a group token is not a shared-link token, and back', !!(await readTalkToken(ENV, gt)).error && !!(await readGroupToken(ENV, lt)).error);
  const forged = await get('k=' + encodeURIComponent(lt) + '&g=1');
  check('a shared link with g=1 added does not open the group page', forged.status === 403, forged.status);
}

console.log('\n2. the pages');
{
  world({ reads: [{ id: 'r1', talk_id: 'tt1', emp_id: 'e1' }] });
  const gt = await makeGroupToken(ENV, 'tt1'), lt = await makeTalkToken(ENV, 'tt1');
  const gp = await (await get('k=' + encodeURIComponent(gt) + '&g=1')).text();
  check('group page: the face-to-face banner and the trainer', gp.includes(LANGS.he.group) && gp.includes('מיכאל פרייליך'), gp.slice(0, 200));
  check('group page: a worker who signed is marked and cannot be picked', /<option value="" disabled>✓ אחמד כהן/.test(gp) && !gp.includes('value="e1"'));
  check('group page: the others can be picked', gp.includes('value="e2"'));
  check('group page: the form carries g=1', gp.includes('name="g" value="1"'));
  check('group page: a link to the trainer\'s closing signature', /g=1&amp;t=1/.test(gp));
  const lp = await (await get('k=' + encodeURIComponent(lt))).text();
  check('shared link page: nobody is marked as signed (the link holder does not learn who signed)', lp.includes('value="e1"') && !lp.includes('disabled>'));
  check('shared link page: no group banner, no trainer closing link, the trainer still shown', !lp.includes(LANGS.he.group) && !/&amp;t=1/.test(lp) && lp.includes('מיכאל פרייליך'));
}

console.log('\n3. each signature records how');
{
  const w = world();
  const gt = await makeGroupToken(ENV, 'tt1'), lt = await makeTalkToken(ENV, 'tt1');
  const r1 = await post({ k: gt, g: '1', l: 'he', emp: 'e1', oid: '1234567', ok: '1', sig: SIG });
  const t1 = await r1.text();
  check('group: mode "group"', w.inserts[0] && w.inserts[0].mode === 'group', w.inserts[0]);
  check('group: "next worker" stays in group mode', /g=1/.test(t1), t1.slice(-400));
  await post({ k: lt, l: 'he', emp: 'e2', oid: '7654321', ok: '1', sig: SIG });
  check('shared link: mode "link"', w.inserts[1] && w.inserts[1].mode === 'link', w.inserts[1]);
  const r3 = await post({ k: lt, g: '1', l: 'he', emp: 'e2', oid: '7654321', ok: '1', sig: SIG });
  check('a shared-link token sent with g=1 is refused', r3.status === 403 && w.inserts.length === 2, r3.status);
}

console.log('\n3b. the ID number in the group (regulation 6 as amended, 09/10/2026)');
{
  const w = world();
  const gt = await makeGroupToken(ENV, 'tt1');
  const gp = await (await get('k=' + encodeURIComponent(gt) + '&g=1')).text();
  check('group page: no ID from a card', !gp.includes('300000007'));
  const r1 = await post({ k: gt, g: '1', l: 'he', emp: 'e3', oid: '300000007', ok: '1', sig: SIG });
  check('group: a card with an ID, the same number typed: saved, the card untouched', r1.status === 200 && w.inserts[0] && w.inserts[0].id_no === '300000007' && w.empPatches.length === 0, w.inserts[0]);
  const r2 = await post({ k: gt, g: '1', l: 'ar', emp: 'e2', oid: '', ok: '1', sig: SIG });
  check('group: a card with no ID and nothing typed: refused in the page language', r2.status === 400 && w.inserts.length === 1 && (await r2.text()).includes(LANGS.ar.oIdNeed));
  const r3 = await post({ k: gt, g: '1', l: 'he', emp: 'e2', oid: '0123-4567', ok: '1', sig: SIG });
  check('group: the typed number in id_no and onto the empty card', r3.status === 200 && w.inserts[1] && w.inserts[1].id_no === '01234567' && w.empPatches.length === 1 && w.empPatches[0].b.eid === '01234567' && /id=eq\.e2&or=\(eid\.is\.null,eid\.eq\.\)/.test(w.empPatches[0].u), w.empPatches);
}

console.log('\n4. the trainer\'s declaration');
{
  const w = world();
  const gt = await makeGroupToken(ENV, 'tt1'), lt = await makeTalkToken(ENV, 'tt1');
  const tp = await (await get('k=' + encodeURIComponent(gt) + '&g=1&t=1')).text();
  check('the page shows the declaration, trainer and qualification', tp.includes(TR_DECL) && tp.includes('ממונה בטיחות'));
  const noOk = await post({ k: gt, g: '1', t: '1', sig: SIG });
  check('without the declaration ticked: refused, nothing saved', noOk.status === 400 && w.patches.length === 0 && w.uploads.length === 0);
  const ok = await post({ k: gt, g: '1', t: '1', ok: '1', sig: SIG });
  check('signed: the PNG saved as sig-tt1-trainer.png', ok.status === 200 && w.uploads.length === 1 && /sig-tt1-trainer\.png$/.test(w.uploads[0].u), w.uploads);
  const p = w.patches[0] && w.patches[0].b;
  check('signed: trainer_sig_url and trainer_signed_at on the talk', p && /sig-tt1-trainer\.png$/.test(p.trainer_sig_url) && !isNaN(Date.parse(p.trainer_signed_at)), p);
  check('no worker row is written for the trainer', w.inserts.length === 0);
  const viaLink = await post({ k: lt, t: '1', ok: '1', sig: SIG });
  check('t=1 on a shared link is not a trainer signature', w.patches.length === 1 && viaLink.status !== 200, viaLink.status);
}

console.log('\n5. every language has the new words');
check('group, trainerL, signedL in he/ar/ru/am', Object.values(LANGS).every((L) => L.group && L.trainerL && L.signedL));

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
