// A reply to a trustee alert closes the finding (27/09). Runs the real
// mail-inbox.js with fetch mocked: Graph inbox + attachments + sendMail,
// Supabase REST + Storage + server_state, the Microsoft token endpoint.
import { onRequest, runInbox, classify, replyText } from './_build/mail-inbox.mjs';
import { SCOPES } from './_build/_onedrive.mjs';

let pass = 0, fail = 0;
const check = (l, c, d) => { if (c) { pass++; console.log('  ✓ ' + l); } else { fail++; console.log('  ✗ ' + l + (d !== undefined ? '  -> ' + JSON.stringify(d) : '')); } };
const SB = 'https://znhjtpcltrxxyfjczgvw.supabase.co';
const ENV = { SUPABASE_SERVICE_ROLE_KEY: 'srv', ONEDRIVE_CLIENT_ID: 'cid', ONEDRIVE_CLIENT_SECRET: 'cs', TRUSTEE_NOTIFY_SECRET: 'nsec' };
const small = new Uint8Array(Buffer.from('/9j/4AAQSkZJRgABAQAAAQABAAD/4gHYSUNDX1BST0ZJTEUAAQEAAAHIAAAAAAQwAABtbnRyUkdCIFhZWiAH4AABAAEAAAAAAABhY3NwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAA9tYAAQAAAADTLQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAlkZXNjAAAA8AAAACRyWFlaAAABFAAAABRnWFlaAAABKAAAABRiWFlaAAABPAAAABR3dHB0AAABUAAAABRyVFJDAAABZAAAAChnVFJDAAABZAAAAChiVFJDAAABZAAAAChjcHJ0AAABjAAAADxtbHVjAAAAAAAAAAEAAAAMZW5VUwAAAAgAAAAcAHMAUgBHAEJYWVogAAAAAAAAb6IAADj1AAADkFhZWiAAAAAAAABimQAAt4UAABjaWFlaIAAAAAAAACSgAAAPhAAAts9YWVogAAAAAAAA9tYAAQAAAADTLXBhcmEAAAAAAAQAAAACZmYAAPKnAAANWQAAE9AAAApbAAAAAAAAAABtbHVjAAAAAAAAAAEAAAAMZW5VUwAAACAAAAAcAEcAbwBvAGcAbABlACAASQBuAGMALgAgADIAMAAxADb/2wBDABALDA4MChAODQ4SERATGCgaGBYWGDEjJR0oOjM9PDkzODdASFxOQERXRTc4UG1RV19iZ2hnPk1xeXBkeFxlZ2P/2wBDARESEhgVGC8aGi9jQjhCY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2P/wAARCAAeACgDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAX/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFgEBAQEAAAAAAAAAAAAAAAAAAAMG/8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAwDAQACEQMRAD8AmgItaAAAAAAAAAA//9k=', 'base64'));
// A "phone photo": a real JPEG header padded past the 15KB logo threshold.
const JPG = new Uint8Array(40000); JPG.set(small, 0);
const b64 = (u8) => Buffer.from(u8).toString('base64');
const msg = (id, subject, from, preview, extra) => Object.assign({ id, subject, from: { emailAddress: { address: from, name: from.split('@')[0] === 'avi' ? 'אבי כהן' : '' } }, receivedDateTime: '2026-09-27T15:0' + id.slice(-1) + ':00Z', bodyPreview: preview, hasAttachments: false }, extra || {});

function world(o) {
  o = o || {};
  const w = { state: Object.assign({}, o.state || {}), inserts: [], patches: [], uploads: [], mails: [], inboxQ: null, reports: JSON.parse(JSON.stringify(o.reports || [])) };
  globalThis.fetch = async (url, init) => {
    const u = String(url), m = (init && init.method) || 'GET', body = init && init.body;
    const json = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json' } });
    if (u.startsWith(SB + '/rest/v1/server_state')) {
      if (m === 'POST') { JSON.parse(body).forEach((r) => { w.state[r.key] = r.value; }); return new Response(null, { status: 201 }); }
      return json(Object.keys(w.state).map((k) => ({ key: k, value: w.state[k], updated_at: 'x' })));
    }
    if (u.startsWith(SB + '/rest/v1/oauth_tokens')) {
      if (m === 'POST') return new Response(null, { status: 201 });
      return json([{ user_email: 'sviva@tapugan.co.il', refresh_token: 'rt', access_token: 'at', expires_at: new Date(Date.now() + 3600e3).toISOString(), scope: o.scope === undefined ? 'Files.ReadWrite Mail.Send Mail.Read' : o.scope }]);
    }
    if (u.startsWith(SB + '/rest/v1/trustee_reports')) {
      if (m === 'POST') { const r = JSON.parse(body); w.inserts.push(r); if (o.insertFail) return new Response('x', { status: 500 }); return new Response(null, { status: 201 }); }
      if (m === 'PATCH') { w.patches.push({ u, body: JSON.parse(body) }); const id = decodeURIComponent(u.match(/id=eq\.([^&]+)/)[1]); const r = w.reports.find((x) => x.id === id); if (r) Object.assign(r, JSON.parse(body)); return new Response(null, { status: 204 }); }
      const id = decodeURIComponent((u.match(/id=eq\.([^&]+)/) || [])[1] || '');
      return json(w.reports.filter((r) => r.id === id));
    }
    if (u.startsWith(SB + '/storage/v1/object/incidents-photos/')) { w.uploads.push({ u, type: init.headers['Content-Type'], n: body.length }); return json({ Key: 'x' }); }
    if (u.startsWith('https://graph.microsoft.com/v1.0/me/mailFolders/inbox/messages')) { w.inboxQ = decodeURIComponent(u); return json({ value: o.messages || [] }); }
    if (/\/me\/messages\/[^/]+\/attachments/.test(u)) { const id = decodeURIComponent(u.split('/me/messages/')[1].split('/')[0]); return json({ value: (o.attachments || {})[id] || [] }); }
    if (u === 'https://graph.microsoft.com/v1.0/me/sendMail') { w.mails.push(JSON.parse(body)); return new Response(null, { status: 202 }); }
    if (u.startsWith('https://login.microsoftonline.com/')) return json({ access_token: 'at', refresh_token: 'rt2', expires_in: 3600 });
    return json({ error: 'unexpected ' + u }, 599);
  };
  return w;
}
const F1 = { id: 'mudmp1oysfpo', u: 'מוסא', t: 1, ok: false, s: 'פתוח', loc: 'חומר גלם · רחבת קירור', f: 'פנס תאורה' };
const tag = (id) => '🦺 ליקוי מנאמן בטיחות - מוסא, סיור [TS-' + id + ']';

console.log('\n1. classify');
check('RE: reply from the domain saying טופל -> close', classify(msg('m1', 'RE: ' + tag('abc123'), 'avi@tapugan.co.il', 'טופל, הפנס הוחלף\nFrom: sviva')).id === 'abc123');
check('Hebrew reply prefix השב: counts', !!classify(msg('m1', 'השב: ' + tag('abc123'), 'avi@tapugan.co.il', 'תוקן')).id);
check('the alert itself (no reply prefix) is not a reply', classify(msg('m1', tag('abc123'), 'sviva@tapugan.co.il', 'נסגר')).skip === 'not a reply');
check('outside the domain is ignored', classify(msg('m1', 'RE: ' + tag('abc123'), 'x@gmail.com', 'טופל')).skip === 'outside domain');
check('lookalike domain is ignored', classify(msg('m1', 'RE: ' + tag('abc123'), 'x@tapugan.co.il.evil.com', 'טופל')).skip === 'outside domain');
check('no done word -> not closed', classify(msg('m1', 'RE: ' + tag('abc123'), 'avi@tapugan.co.il', 'מתי מטפלים בזה?')).skip === 'no done word');
check('"לא טופל עדיין" is negated', classify(msg('m1', 'RE: ' + tag('abc123'), 'avi@tapugan.co.il', 'לא טופל עדיין')).skip === 'negated');
check('done word only in the quoted alert does not count', classify(msg('m1', 'RE: ' + tag('abc123'), 'avi@tapugan.co.il', 'אני בודק\nFrom: sviva\nדלת סגורה')).skip === 'no done word');
check('no tag -> ignored', classify(msg('m1', 'RE: something', 'avi@tapugan.co.il', 'טופל')).skip === 'no tag');
check('replyText cuts at the quoted part', replyText('תוקן\n\nמאת: sviva\nשלום') === 'תוקן');
check('SCOPES does NOT ask for Mail.Read (tenant needs admin consent; would block every sign-in)', !/Mail\.Read/.test(SCOPES));

console.log('\n2. a reply with a phone photo closes the finding');
{
  const w = world({ reports: [F1], messages: [msg('m1', 'RE: ' + tag(F1.id), 'avi@tapugan.co.il', 'טופל, הוחלף פנס', { hasAttachments: true })],
    attachments: { m1: [
      { '@odata.type': '#microsoft.graph.fileAttachment', name: 'logo.png', contentType: 'image/png', size: 3000, contentBytes: b64(small) },
      { '@odata.type': '#microsoft.graph.fileAttachment', name: 'IMG_1.jpg', contentType: 'image/jpeg', size: JPG.length, contentBytes: b64(JPG) }] } });
  const r = await runInbox(ENV);
  check('closed 1', r.closed === 1, r);
  const ins = w.inserts[0] || {};
  check('closure report: task 8, ref = finding, ok', ins.t === 8 && ins.ref === F1.id && ins.ok === true, ins);
  check('under the name of whoever replied', ins.u === 'אבי כהן', ins.u);
  check('reply text kept, note says by mail from whom', ins.f === 'טופל, הוחלף פנס' && /avi@tapugan\.co\.il/.test(ins.mgr_note), ins);
  check('date is YYYY-MM-DD', /^\d{4}-\d{2}-\d{2}$/.test(ins.d), ins.d);
  check('the phone photo uploaded, not the logo', w.uploads.length === 1 && w.uploads[0].n === JPG.length && w.uploads[0].type === 'image/jpeg', w.uploads);
  check('photo_url in the bucket pattern', /\/storage\/v1\/object\/public\/incidents-photos\/tru-mail-mudmp1oysfpo-\d+\.jpg$/.test(ins.photo_url || ''), ins.photo_url);
  check('finding marked closed', w.patches.length === 1 && w.patches[0].body.s === 'נסגר' && w.reports[0].s === 'נסגר', w.patches);
  check('confirmation mailed to the sender, without the tag', w.mails.length === 1 && w.mails[0].message.toRecipients[0].emailAddress.address === 'avi@tapugan.co.il' && !/\[TS-/.test(w.mails[0].message.subject), w.mails[0] && w.mails[0].message.subject);
  check('inbox read since a time, oldest first', /receivedDateTime ge /.test(w.inboxQ) && /orderby=receivedDateTime asc/.test(w.inboxQ), w.inboxQ);
  check('message remembered', JSON.parse(w.state.mail_inbox_done).indexOf('m1') >= 0 && w.state.mail_inbox_since === '2026-09-27T15:01:00Z', w.state);

  console.log('\n3. the same message next run: nothing happens twice');
  const w2 = world({ reports: w.reports, state: w.state, messages: [msg('m1', 'RE: ' + tag(F1.id), 'avi@tapugan.co.il', 'טופל', { hasAttachments: true })] });
  const r2 = await runInbox(ENV);
  check('no insert, no mail', w2.inserts.length === 0 && w2.mails.length === 0 && r2.closed === 0, r2);
}

console.log('\n4. edge cases');
{
  const w = world({ reports: [{ ...F1, s: 'נסגר' }], messages: [msg('m2', 'RE: ' + tag(F1.id), 'avi@tapugan.co.il', 'טופל')] });
  const r = await runInbox(ENV);
  check('already closed: no second closure', w.inserts.length === 0 && r.results[0].result === 'already closed', r);
}
{
  const w = world({ reports: [{ ...F1, ok: true, s: 'תקין' }], messages: [msg('m3', 'RE: ' + tag(F1.id), 'avi@tapugan.co.il', 'טופל')] });
  const r = await runInbox(ENV);
  check('a clean report cannot be "closed"', w.inserts.length === 0 && r.results[0].result === 'not a finding', r);
}
{
  const w = world({ reports: [F1], messages: [msg('m4', 'RE: ' + tag(F1.id), 'avi@tapugan.co.il', 'תוקן')] });
  const r = await runInbox(ENV);
  check('no photo: closed anyway, photo_url null', r.closed === 1 && w.inserts[0].photo_url === null && w.uploads.length === 0, r);
}
{
  const w = world({ reports: [F1], insertFail: true, messages: [msg('m5', 'RE: ' + tag(F1.id), 'avi@tapugan.co.il', 'טופל')] });
  const r = await runInbox(ENV);
  check('insert fails: not remembered, retried next run', r.closed === 0 && JSON.parse(w.state.mail_inbox_done).indexOf('m5') < 0 && !w.state.mail_inbox_since.startsWith('2026-09-27T15:05'), w.state);
}
{
  const w = world({ scope: 'Files.ReadWrite Mail.Send' });
  const r = await runInbox(ENV);
  check('no Mail.Read yet: skipped quietly, inbox not read', r.skipped === 'no Mail.Read' && w.inboxQ === null, r);
}

console.log('\n5. who may call it');
{
  world({ messages: [] });
  const bad = await onRequest({ request: new Request('https://tapugan-safety.pages.dev/api/mail-inbox', { method: 'POST', body: '{}' }), env: ENV });
  check('no secret -> 403', bad.status === 403);
  const noEnvSecret = await onRequest({ request: new Request('https://tapugan-safety.pages.dev/api/mail-inbox', { method: 'POST', body: '{}' }), env: { ...ENV, TRUSTEE_NOTIFY_SECRET: '' } });
  check('secret not configured -> still 403 (never open)', noEnvSecret.status === 403);
  const ok = await onRequest({ request: new Request('https://tapugan-safety.pages.dev/api/mail-inbox', { method: 'POST', headers: { 'x-notify-secret': 'nsec' }, body: '{}' }), env: ENV });
  const j = await ok.json();
  check('with the secret -> runs', ok.status === 200 && j.ok === true, j);
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
