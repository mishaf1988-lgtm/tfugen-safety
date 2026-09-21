// Unit test of the REAL trustee-notify function with fetch mocked: the DB
// lookups, the atomic claim, template fallback, recipients from prefs, test mode.
import { onRequest } from './_build/trustee-notify.mjs';
let pass = 0, fail = 0;
const check = (l, c, d) => { if (c) { pass++; console.log('  ✓ ' + l); } else { fail++; console.log('  ✗ ' + l + (d !== undefined ? '  -> ' + JSON.stringify(d) : '')); } };
const SB = 'https://znhjtpcltrxxyfjczgvw.supabase.co';
function world(opts) {
  const calls = [];
  const st = { row: opts.row, nm: opts.nm, prefs: opts.prefs, signOk: opts.signOk, resendUnverified: opts.resendUnverified, claimed: false, dedicatedMissing: opts.dedicatedMissing !== false, metaFail: opts.metaFail, resendOk: opts.resendOk !== false, authOk: opts.authOk !== false, tasks: opts.tasks, tasksStatus: opts.tasksStatus };
  globalThis.fetch = async (url, init) => {
    const u = String(url); const method = (init && init.method) || 'GET'; const body = init && init.body ? JSON.parse(init.body) : null;
    calls.push({ u, method, body, headers: init && init.headers });
    const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { 'Content-Type': 'application/json' } });
    if (u.startsWith(SB + '/auth/v1/user')) return json(st.authOk ? { id: 'u1', email: 'admin@tfugen.local', is_anonymous: false } : { error: 'bad' }, st.authOk ? 200 : 401);
    if (u.startsWith(SB + '/rest/v1/trustee_reports?id=eq.') && method === 'GET') return json(st.row ? [st.row] : []);
    if (u.startsWith(SB + '/rest/v1/trustee_reports?id=eq.') && method === 'PATCH') { if (st.claimed || !st.row || st.row.notified_at) return json([]); st.claimed = true; return json([{ id: st.row.id }]); }
    // near_miss, added 2026-09-21. Same shape of read and claim, different
    // table and different column names -- which is the whole risk.
    if (u.startsWith(SB + '/rest/v1/near_miss?id=eq.') && method === 'GET') return json(st.nm ? [st.nm] : []);
    if (u.startsWith(SB + '/rest/v1/near_miss?id=eq.') && method === 'PATCH') { if (st.claimed || !st.nm || st.nm.notified_at) return json([]); st.claimed = true; return json([{ id: st.nm.id }]); }
    // The catalogue table. undefined = the 2026-09-19 migration has not run,
    // which is the state production is in today.
    if (u.startsWith(SB + '/rest/v1/trustee_tasks')) {
      if (st.tasksStatus) return new Response('{"message":"relation does not exist"}', { status: st.tasksStatus });
      const n = parseInt((u.match(/n=eq\.(\d+)/) || [])[1], 10);
      const t = st.tasks && st.tasks[n];
      return json(t ? [{ t }] : []);
    }
    if (u.startsWith(SB + '/rest/v1/notification_prefs')) return json(st.prefs ? [{ prefs: st.prefs }] : []);
    if (u.startsWith(SB + '/rest/v1/notifications_log')) return new Response('', { status: 201 });
    if (u.includes('graph.facebook.com')) {
      if (st.metaFail) return json({ error: { code: 190, message: 'Invalid OAuth access token' } }, 401);
      if (body.template.name === 'tfugen_trustee_hazard' && st.dedicatedMissing) return json({ error: { code: 132001, message: 'Template name does not exist in the translation' } }, 404);
      return json({ messages: [{ id: 'wamid.1' }] });
    }
    // The bucket is private, so the email must carry a SIGNED link. st.signOk
    // false stands for a signing call that fails — the mail must then carry no
    // photo link at all rather than one that answers 400.
    if (u.startsWith(SB + '/storage/v1/object/sign/')) {
      if (st.signOk === false) return new Response('{"error":"nope"}', { status: 400 });
      return json({ signedURL: '/object/sign/incidents-photos/tru-ph-5-a-1758.jpg?token=SIGNED' });
    }
    if (u.includes('api.resend.com')) {
      // The real refusal, verbatim, from 2026-09-21: no verified domain means
      // Resend delivers only to the address the account was opened with.
      if (st.resendUnverified) return new Response(JSON.stringify({ statusCode: 403, name: 'validation_error', message: 'You can only send testing emails to your own email address (mishaf1988@gmail.com). To send emails to other recipients, please verify a domain at resend.com/domains, and change the `from` address to an email using this domain.' }), { status: 403 });
      return st.resendOk ? json({ id: 'em_1' }) : new Response('{"message":"nope"}', { status: 422 });
    }
    throw new Error('unexpected fetch ' + u);
  };
  return { calls, st };
}
const env = { SUPABASE_SERVICE_ROLE_KEY: 'svc', META_PHONE_NUMBER_ID: 'pn', META_ACCESS_TOKEN: 'tok', RESEND_KEY: 'rk' };
const req = (body, headers) => new Request('https://tapugan-safety.pages.dev/api/trustee-notify', { method: 'POST', headers: { 'Content-Type': 'application/json', origin: 'https://tapugan-safety.pages.dev', ...(headers || {}) }, body: JSON.stringify(body) });
const fresh = () => ({ id: 'r1', u: 'דנה', t: 5, d: '2026-09-19', loc: 'מחסן · הידרנט', f: 'ללא פלומבה', ok: false, s: 'פתוח', photo_url: SB + '/storage/v1/object/public/incidents-photos/tru-ph-5-a-1758.jpg', ts: new Date().toISOString(), notified_at: null });
const prefsOn = { trustee_hazard: { whatsapp: true, whatsapp_to: '972-50-1234567', email: true, email_to: 'sviva@tapugan.co.il' } };

(async () => {
  console.log('\n1. happy path: hazard → claim → WhatsApp (fallback template) + email → log');
  { const w = world({ row: fresh(), prefs: prefsOn }); const r = await onRequest({ request: req({ id: 'r1' }), env }); const j = await r.json();
    const meta = w.calls.filter(c => c.u.includes('graph.facebook.com')); const resend = w.calls.find(c => c.u.includes('resend')); const log = w.calls.find(c => c.u.includes('notifications_log'));
    check('200, whatsapp sent, email sent', r.status === 200 && j.ok && j.whatsapp === 'sent' && j.email === 'sent', j);
    check('dedicated template tried first, then the approved incident template with location / "ליקוי נאמן" / finding', meta.length === 2 && meta[0].body.template.name === 'tfugen_trustee_hazard' && meta[1].body.template.name === 'tfugen_incident_alert' && meta[1].body.to === '972501234567' && meta[1].body.template.components[0].parameters.map(p => p.text).join('|') === 'מחסן · הידרנט|ליקוי נאמן בטיחות - דנה, עמדות כיבוי אש|ללא פלומבה', meta.map(m => m.body.template));
    check('email to the saved address with trustee, task, location, finding, a SIGNED photo link and the app link', resend && resend.body.to[0] === 'sviva@tapugan.co.il' && /דנה/.test(resend.body.subject) && /הידרנט/.test(resend.body.html) && /ללא פלומבה/.test(resend.body.html) && /token=SIGNED/.test(resend.body.html) && !/object\/public\//.test(resend.body.html) && /tapugan-safety\.pages\.dev/.test(resend.body.html), resend && resend.body.subject);
    check('two log rows (whatsapp, email) written by the server', log && log.body.length === 2 && log.body.map(x => x.channel).join() === 'whatsapp,email' && log.body[0].event_type === 'trustee_hazard', log && log.body);
    check('the claim is a PATCH guarded by notified_at=is.null', w.calls.some(c => c.method === 'PATCH' && /notified_at=is\.null/.test(c.u) && c.body.notified_at), w.calls.filter(c => c.method === 'PATCH').map(c => c.u)); }
  {
    // A link that answers 400 is worse than no link: it reads as a broken
    // system to the manager who clicks it. When signing fails, the mail goes
    // out with everything else and simply carries no photo.
    const w = world({ row: fresh(), prefs: { trustee_hazard: { whatsapp: false, email: true, email_to: 'sviva@tapugan.co.il' } }, signOk: false });
    await onRequest({ request: req({ id: 'r1' }), env });
    const resend = w.calls.filter((c) => c.u.includes('api.resend.com'))[0];
    check('signing fails → the mail still goes out', !!resend, w.calls.map((c) => c.u));
    check('...with no photo link at all, rather than one that answers 400', resend && !/incidents-photos/.test(resend.body.html), resend && resend.body.html.slice(0, 200));
    check('...and the finding itself is still there', resend && /ללא פלומבה/.test(resend.body.html));
  }

  console.log('\n1b. the task name comes from the catalogue the manager edits');
  {
    // Once migrations/2026-09-19_trustee_tasks.sql has run, renaming a task in
    // the app is the whole point of that table. The notification still went
    // out in the wording frozen into this file.
    const w = world({ row: fresh(), prefs: prefsOn, tasks: { 5: 'עמדות כיבוי אש ומטפים' } });
    await onRequest({ request: req({ id: 'r1' }), env });
    const meta = w.calls.filter((c) => c.u.includes('graph.facebook.com'));
    const resend = w.calls.find((c) => c.u.includes('resend'));
    const log = w.calls.find((c) => c.u.includes('notifications_log'));
    check('the function reads trustee_tasks for the row\u2019s number', w.calls.some((c) => /trustee_tasks\?n=eq\.5/.test(c.u)), w.calls.map((c) => c.u));
    check('WhatsApp carries the renamed task, not the frozen wording', meta.length && /עמדות כיבוי אש ומטפים/.test(meta[meta.length - 1].body.template.components[0].parameters.map((p) => p.text).join('|')), meta.map((m) => m.body.template.components[0].parameters));
    check('...and so does the email subject', resend && /עמדות כיבוי אש ומטפים/.test(resend.body.subject + resend.body.html), resend && resend.body.subject);
    check('...and the log line, which is what the manager reads back later', log && /עמדות כיבוי אש ומטפים/.test(JSON.stringify(log.body)), log && log.body[0]);
  }
  {
    // Today, and for any row the table does not carry: the built-in map.
    const w = world({ row: fresh(), prefs: prefsOn, tasksStatus: 404 });
    const r = await onRequest({ request: req({ id: 'r1' }), env });
    const meta = w.calls.filter((c) => c.u.includes('graph.facebook.com'));
    check('the table missing does not stop the notification', r.status === 200 && meta.length > 0, r.status);
    check('...it falls back to the built-in name', /עמדות כיבוי אש/.test(meta[meta.length - 1].body.template.components[0].parameters.map((p) => p.text).join('|')), meta[meta.length - 1].body.template.components[0].parameters);
  }
  {
    const w = world({ row: Object.assign(fresh(), { t: 11 }), prefs: prefsOn, tasks: { 5: 'x' } });
    await onRequest({ request: req({ id: 'r1' }), env });
    const meta = w.calls.filter((c) => c.u.includes('graph.facebook.com'));
    check('a number nobody has named still gets a readable subject', /משימה 11/.test(meta[meta.length - 1].body.template.components[0].parameters.map((p) => p.text).join('|')), meta[meta.length - 1].body.template.components[0].parameters);
  }

  console.log('\n2. once only, and the guards');
  { const w = world({ row: Object.assign(fresh(), { notified_at: '2026-09-19T08:00:00Z' }), prefs: prefsOn }); const j = await (await onRequest({ request: req({ id: 'r1' }), env })).json();
    check('already notified → skipped, no Meta / Resend call', j.skipped === 'already notified' && !w.calls.some(c => /facebook|resend/.test(c.u)), j); }
  { const w = world({ row: fresh(), prefs: prefsOn }); w.st.claimed = true; const j = await (await onRequest({ request: req({ id: 'r1' }), env })).json();
    check('claim lost (another worker got there first) → skipped, nothing sent', j.skipped === 'already notified' && !w.calls.some(c => /facebook|resend/.test(c.u)), j); }
  { const w = world({ row: Object.assign(fresh(), { ok: true, s: 'תקין' }), prefs: prefsOn }); const j = await (await onRequest({ request: req({ id: 'r1' }), env })).json();
    check('a תקין report is never sent', j.skipped === 'not a hazard' && !w.calls.some(c => /facebook|resend/.test(c.u)), j); }
  { const w = world({ row: Object.assign(fresh(), { ts: '2026-01-01T00:00:00Z' }), prefs: prefsOn }); const j = await (await onRequest({ request: req({ id: 'r1' }), env })).json();
    check('an old row (replayed webhook) is not sent', j.skipped === 'too old', j); }
  { const w = world({ row: null, prefs: prefsOn }); const r = await onRequest({ request: req({ id: 'nope' }), env }); check('unknown id → 404', r.status === 404); }
  { const r = await onRequest({ request: req({}), env }); check('missing id → 400', r.status === 400); }
  { const r = await onRequest({ request: req({ id: 'r1;drop' }), env }); check('odd id characters → 400', r.status === 400); }
  { const w = world({ row: fresh(), prefs: null }); const j = await (await onRequest({ request: req({ id: 'r1' }), env })).json();
    check('no recipient saved yet → skipped and NOT claimed (so it sends once Michael sets a number)', j.skipped === 'no recipient configured' && !w.st.claimed, j); }
  { const w = world({ row: fresh(), prefs: { trustee_hazard: { whatsapp: false, whatsapp_to: '972501234567', email: false, email_to: 'a@b.c' } } }); const j = await (await onRequest({ request: req({ id: 'r1' }), env })).json();
    check('channels unticked in the matrix → nothing sent even with addresses', j.skipped === 'no recipient configured', j); }
  { const w = world({ row: fresh(), prefs: { trustee_hazard: { whatsapp: true, whatsapp_to: '972501234567' } }, metaFail: true }); const j = await (await onRequest({ request: req({ id: 'r1' }), env })).json();
    const log = w.calls.find(c => c.u.includes('notifications_log'));
    check('Meta failure is reported and logged as whatsapp_error; email not configured is not attempted', /error: Meta 401/.test(j.whatsapp) && !j.email && log.body[0].channel === 'whatsapp_error', j); }
  { const w = world({ row: fresh(), prefs: prefsOn }); const j = await (await onRequest({ request: req({ id: 'r1' }), env: { ...env, TRUSTEE_NOTIFY_SECRET: 's3' } })).json();
    check('with a secret configured, a call without the header is refused', j.error === 'forbidden'); 
    const j2 = await (await onRequest({ request: req({ id: 'r1' }, { 'x-notify-secret': 's3' }), env: { ...env, TRUSTEE_NOTIFY_SECRET: 's3' } })).json();
    check('…and accepted with it', j2.ok === true && j2.whatsapp === 'sent', j2); }
  { const r = await onRequest({ request: req({ id: 'r1' }), env: { META_ACCESS_TOKEN: 'x' } }); check('missing service key → 500', r.status === 500); }
  { const w = world({ row: fresh(), prefs: prefsOn, dedicatedMissing: false }); const j = await (await onRequest({ request: req({ id: 'r1' }), env })).json(); const meta = w.calls.filter(c => c.u.includes('graph.facebook.com'));
    check('once the dedicated template exists it is used directly: trustee / task — location / finding', j.whatsapp === 'sent' && meta.length === 1 && meta[0].body.template.name === 'tfugen_trustee_hazard' && meta[0].body.template.components[0].parameters.map(p => p.text).join('|') === 'דנה|עמדות כיבוי אש — מחסן · הידרנט|ללא פלומבה', meta.map(m => m.body.template)); }
  console.log('\n3. test mode from the settings screen');
  { const r = await onRequest({ request: req({ test: true, whatsapp_to: '972501234567' }), env }); check('test without a session → 401', r.status === 401); }
  { const w = world({ authOk: false }); const r = await onRequest({ request: req({ test: true, whatsapp_to: '972501234567' }, { Authorization: 'Bearer bad' }), env }); check('test with a bad session → 401', r.status === 401); }
  { const w = world({}); const r = await onRequest({ request: req({ test: true, whatsapp: true, whatsapp_to: '+972 50-123 4567', email: true, email_to: 'me@tapugan.co.il' }, { Authorization: 'Bearer good' }), env }); const j = await r.json(); const meta = w.calls.filter(c => c.u.includes('graph.facebook.com')); const resend = w.calls.find(c => c.u.includes('resend'));
    check('test: uses the numbers typed on the screen (digits only), sends the sample to both channels, does not touch trustee_reports', r.status === 200 && j.test && j.whatsapp === 'sent' && j.email === 'sent' && meta[meta.length - 1].body.to === '972501234567' && /בדיקה/.test(meta[meta.length - 1].body.template.components[0].parameters[2].text) && resend.body.to[0] === 'me@tapugan.co.il' && !w.calls.some(c => c.u.includes('trustee_reports')), j); }
  { const w = world({}); const r = await onRequest({ request: req({ test: true }, { Authorization: 'Bearer good' }), env }); check('test with no recipient → 400 with a clear message', r.status === 400); }
  { const w = world({}); const j = await (await onRequest({ request: req({ test: true, email: true, email_to: 'me@tapugan.co.il' }, { Authorization: 'Bearer good' }), env: { SUPABASE_SERVICE_ROLE_KEY: 'svc' } })).json();
    check('email without RESEND_KEY says exactly what is missing', /RESEND_KEY/.test(j.email), j); }
  // A near-miss can be filed by anyone, not just a trustee, and until today it
  // reached nobody until the manager next opened the app. It is the same event
  // on the floor -- something that was about to hurt somebody -- so it goes out
  // on the same channel, to the same recipient.
  console.log('\n4. near_miss: the second source');
  const nmFresh = () => ({ id: 'n1', rep: 'משה לוי', descr: 'משטח כמעט נפל מהמלגזה', area: 'רציף העמסה', sev: 'גבוהה', typ: 'ציוד הרמה', d: '2026-09-21', s: 'פתוח', photo_url: null, ts: new Date().toISOString(), notified_at: null });
  { const w = world({ nm: nmFresh(), prefs: prefsOn }); const r = await onRequest({ request: req({ id: 'n1', src: 'near_miss' }), env }); const j = await r.json();
    const meta = w.calls.filter(c => c.u.includes('graph.facebook.com')); const resend = w.calls.find(c => c.u.includes('resend')); const log = w.calls.find(c => c.u.includes('notifications_log'));
    check('200, both channels', r.status === 200 && j.whatsapp === 'sent' && j.email === 'sent', j);
    check('it reads near_miss, not trustee_reports', w.calls.some(c => /rest\/v1\/near_miss\?id=eq\.n1/.test(c.u)) && !w.calls.some(c => c.u.includes('trustee_reports')), w.calls.map(c => c.u));
    // rep/descr/area, not u/f/loc. Getting this wrong sends a message with the
    // reporter and the hazard both blank, which still looks like it worked.
    check('the reporter, the place and the description survive the different column names',
      /משה לוי/.test(resend.body.subject) && /רציף העמסה/.test(resend.body.html) && /משטח כמעט נפל/.test(resend.body.html), resend && resend.body.subject);
    check('severity and type become the line under the name', /חומרה גבוהה, ציוד הרמה/.test(resend.body.html), resend && resend.body.html.substring(0, 400));
    check('the mail is headed as a near-miss, not as a trustee finding', /כמעט ונפגע/.test(resend.body.subject) && !/ליקוי מנאמן/.test(resend.body.subject), resend && resend.body.subject);
    // There is no approved near-miss template. Trying the trustee one first
    // would burn a call on a guaranteed refusal.
    check('WhatsApp goes straight to the approved incident template, one call only',
      meta.length === 1 && meta[0].body.template.name === 'tfugen_incident_alert'
      && meta[0].body.template.components[0].parameters.map(p => p.text).join('|') === 'רציף העמסה|כמעט ונפגע - משה לוי, חומרה גבוהה, ציוד הרמה|משטח כמעט נפל מהמלגזה', meta.map(m => m.body.template));
    check('the log says near_miss, so the two are told apart afterwards', log && log.body[0].event_type === 'near_miss', log && log.body);
    check('the claim guards the near_miss row', w.calls.some(c => c.method === 'PATCH' && /near_miss\?id=eq\.n1&notified_at=is\.null/.test(c.u)), w.calls.filter(c => c.method === 'PATCH').map(c => c.u)); }
  { const w = world({ nm: { ...nmFresh(), notified_at: '2026-09-21T06:00:00Z' }, prefs: prefsOn }); const j = await (await onRequest({ request: req({ id: 'n1', src: 'near_miss' }), env })).json();
    check('a near-miss already notified is not sent twice', j.skipped === 'already notified' && !w.calls.some(c => c.u.includes('graph.facebook.com')), j); }
  { const w = world({ nm: { ...nmFresh(), sev: '', typ: '' }, prefs: prefsOn }); const j = await (await onRequest({ request: req({ id: 'n1', src: 'near_miss' }), env })).json(); const resend = w.calls.find(c => c.u.includes('resend'));
    check('with no severity and no type it still sends, with a plain line', j.email === 'sent' && /כמעט ונפגע/.test(resend.body.html), j); }
  // src reaches the query string. It is looked up as a key in a fixed map, so
  // anything else must be refused rather than concatenated into a URL.
  { const w = world({ nm: nmFresh(), prefs: prefsOn }); const r = await onRequest({ request: req({ id: 'n1', src: 'app_users' }), env });
    check('an unknown src is refused, and nothing is read', r.status === 400 && !w.calls.length, r.status); }
  { const w = world({ row: fresh(), prefs: prefsOn }); const r = await onRequest({ request: req({ id: 'r1' }), env });
    check('a request with no src still means trustee_reports, so the older DB trigger keeps working',
      r.status === 200 && w.calls.some(c => /rest\/v1\/trustee_reports\?id=eq\.r1/.test(c.u)), r.status); }

  // The log line is read by a safety manager on a phone. Handing him Resend's
  // English JSON is how a configuration step turns into "the system is broken":
  // on 2026-09-21 the only way to find out what to do was to read
  // net._http_response in the SQL editor.
  console.log('\n5. a refusal a person can act on');
  { const w = world({ row: fresh(), prefs: prefsOn, resendUnverified: true }); const j = await (await onRequest({ request: req({ id: 'r1' }), env })).json(); const log = w.calls.find(c => c.u.includes('notifications_log'));
    check('the 403 names the address Resend WILL accept', /mishaf1988@gmail\.com/.test(j.email), j.email);
    check('...says what to do about it, in Hebrew', /דומיין מאומת/.test(j.email) && /resend\.com\/domains/.test(j.email), j.email);
    check('...and does not hand over the raw JSON', !/statusCode/.test(j.email) && !/validation_error/.test(j.email), j.email);
    check('WhatsApp still went out — one channel failing does not lose the other', j.whatsapp === 'sent', j);
    check('the failure is logged, so it is visible in the app without the SQL editor',
      log && log.body.some(x => x.channel === 'email_error'), log && log.body.map(x => x.channel)); }
  { const w = world({ row: fresh(), prefs: prefsOn, resendOk: false }); const j = await (await onRequest({ request: req({ id: 'r1' }), env })).json();
    check('any other Resend failure still reports its status and body', /Resend 422/.test(j.email), j.email); }

  // CLAUDE.md, "שפה ותקשורת": text that goes to people uses keyboard characters
  // only. These alerts are exactly that -- Michael read one on his phone on
  // 2026-09-21 and it carried an em dash and a middle dot. The check is on what
  // is DELIVERED, not on the source, and the fixture carries none of these
  // characters so anything found came from our own wording.
  console.log('\n6. keyboard characters only in what is delivered');
  {
    const BANNED = [['—', 'em dash'], ['–', 'en dash'], ['־', 'maqaf'],
      ['«', 'guillemet'], ['»', 'guillemet'], ['“', 'curly quote'], ['”', 'curly quote'],
      ['‘', 'curly quote'], ['’', 'curly quote'], ['…', 'ellipsis'], ['·', 'middle dot'],
      ['→', 'arrow'], ['×', 'multiplication sign']];
    const offenders = (s) => BANNED.filter(([ch]) => String(s).includes(ch)).map(([ch, n]) => n + ' (' + ch + ')');
    const plain = () => ({ ...fresh(), loc: 'מחסן, הידרנט', photo_url: null });
    const plainNm = () => ({ ...nmFresh(), photo_url: null });

    const w1 = world({ row: plain(), prefs: prefsOn });
    await onRequest({ request: req({ id: 'r1' }), env });
    const m1 = w1.calls.filter(c => c.u.includes('graph.facebook.com')).slice(-1)[0];
    const e1 = w1.calls.find(c => c.u.includes('resend'));
    check('the trustee email subject is clean', !offenders(e1.body.subject).length, offenders(e1.body.subject).concat(e1.body.subject));
    check('...and its body, footer included', !offenders(e1.body.html).length, offenders(e1.body.html));
    check('...and the plain-text part', !offenders(e1.body.text).length, offenders(e1.body.text).concat(e1.body.text));
    check('...and the WhatsApp parameters', !offenders(JSON.stringify(m1.body)).length, offenders(JSON.stringify(m1.body)));

    const w2 = world({ nm: plainNm(), prefs: prefsOn });
    await onRequest({ request: req({ id: 'n1', src: 'near_miss' }), env });
    const m2 = w2.calls.filter(c => c.u.includes('graph.facebook.com')).slice(-1)[0];
    const e2 = w2.calls.find(c => c.u.includes('resend'));
    check('the same for a near-miss, subject and body', !offenders(e2.body.subject + e2.body.html + e2.body.text).length,
      offenders(e2.body.subject + e2.body.html + e2.body.text));
    check('...and its WhatsApp parameters', !offenders(JSON.stringify(m2.body)).length, offenders(JSON.stringify(m2.body)));

    // The sample the "send a test" button delivers is our wording too, and it
    // is the first message anyone ever sees from this system.
    const w3 = world({});
    await onRequest({ request: req({ test: true, whatsapp: true, whatsapp_to: '972501234567', email: true, email_to: 'me@tapugan.co.il' }, { Authorization: 'Bearer good' }), env });
    const e3 = w3.calls.find(c => c.u.includes('resend'));
    check('and the test message, which is the first one anyone sees',
      !offenders(e3.body.subject + e3.body.html + e3.body.text).length, offenders(e3.body.subject + e3.body.html + e3.body.text));
  }

  console.log('\n' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
})().catch(e => { console.error('HARNESS ERROR', e); process.exit(2); });
