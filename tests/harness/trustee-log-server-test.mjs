// The trustee log written to OneDrive by the server (27/09).
//
// Runs the real Pages Functions with fetch mocked: Supabase REST, the
// Microsoft token endpoint and Graph. Checks what goes into the file, that the
// file is a real xlsx, that the refresh token is used and rotated, that an
// unchanged log is not rewritten, that a failed upload is retried, and who may
// call it. Needs the _build copies that run.sh makes.
import { onRequest, buildAoa, runLog, HEADER, LOG_FOLDER, LOG_FILE } from './_build/trustee-log.mjs';
import { onRequest as msAuth, makeState, checkState } from './_build/ms-auth.mjs';
import { buildXlsx } from './_build/_xlsx.mjs';
import { refreshScopes, hasMail } from './_build/_onedrive.mjs';
import { onRequest as notify } from './_build/trustee-notify.mjs';
import { execFileSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

let pass = 0, fail = 0;
const check = (l, c, d) => { if (c) { pass++; console.log('  ✓ ' + l); } else { fail++; console.log('  ✗ ' + l + (d !== undefined ? '  -> ' + JSON.stringify(d) : '')); } };
const SB = 'https://znhjtpcltrxxyfjczgvw.supabase.co';
const ENV = { SUPABASE_SERVICE_ROLE_KEY: 'srv', ONEDRIVE_CLIENT_ID: 'cid', ONEDRIVE_CLIENT_SECRET: 'csecret', TRUSTEE_NOTIFY_SECRET: 'nsec' };

const REPORTS = [
  { id: 'ok1', u: 'דני', t: 5, d: '2026-09-18', loc: 'מעבדה', ok: true, s: 'תקין', ts: '2026-09-18T08:00:00Z' },
  { id: 'h1', u: 'דני', t: 5, d: '2026-09-20', loc: 'מחסן', f: 'מטף חסום', ok: false, s: 'נסגר', ts: '2026-09-20T08:00:00Z', mgr_note: 'נותב לאחזקה' },
  { id: 'c1', u: 'רונית', t: 8, d: '2026-09-24', loc: 'מחסן', f: 'תמונת אחרי', ok: true, s: 'תקין', ref: 'h1', ts: '2026-09-24T08:00:00Z' },
  { id: 'h2', u: 'יוסי', t: 5, d: '2026-09-25', location_id: 'L2', f: 'מעבר חסום', ok: false, s: 'פתוח', ts: '2026-09-25T08:00:00Z' },
];
const LOCS = [{ id: 'L1', name: 'אולם ייצור', parent_id: null }, { id: 'L2', name: 'מסוע 3', parent_id: 'L1' }];

function world(o) {
  o = o || {};
  const w = { calls: [], state: Object.assign({}, o.state || {}), tokens: o.tokens === undefined ? [{ user_email: 'sviva@tapugan.co.il', refresh_token: 'rt1', access_token: null, expires_at: null }] : o.tokens, puts: [], saved: [] };
  globalThis.fetch = async (url, init) => {
    const u = String(url), m = (init && init.method) || 'GET', body = init && init.body;
    w.calls.push({ u, m, headers: (init && init.headers) || {} });
    const json = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json' } });
    if (u.startsWith(SB + '/rest/v1/trustee_reports')) return json(/offset=0/.test(u) ? (o.reports || REPORTS) : []);
    if (u.startsWith(SB + '/rest/v1/trustee_tasks')) return json([{ n: 5, t: 'עמדות כיבוי אש' }]);
    if (u.startsWith(SB + '/rest/v1/locations')) return json(LOCS);
    if (u.startsWith(SB + '/rest/v1/server_state')) {
      if (m === 'POST') { JSON.parse(body).forEach((r) => { w.state[r.key] = r.value; }); return new Response(null, { status: 201 }); }
      return json(Object.keys(w.state).map((k) => ({ key: k, value: w.state[k], updated_at: '2026-09-27T09:00:00Z' })));
    }
    if (u.startsWith(SB + '/rest/v1/oauth_tokens')) {
      if (m === 'POST') { const r = JSON.parse(body); w.saved.push(r); w.tokens = [r]; return new Response(null, { status: 201 }); }
      if (m === 'DELETE') return new Response(null, { status: 204 });
      // Honour ?select= like PostgREST does: a column the code forgets to ask
      // for must come back missing, or a bug like the missing `scope` (27/09)
      // passes here and fails in production.
      const sel = (new URL(u).searchParams.get('select') || '').split(',').filter(Boolean);
      return json((w.tokens || []).map((row) => sel.length ? Object.fromEntries(sel.filter((k) => k in row).map((k) => [k, row[k]])) : row));
    }
    if (u.startsWith(SB + '/auth/v1/user')) {
      const tok = String(init.headers.Authorization || '').replace('Bearer ', '');
      if (tok === 'mgr') return json({ id: 'x', email: 'eli@tfugen.local' });
      if (tok === 'rep') return json({ id: 'y', email: 'moshe@tfugen.local' });
      return json({}, 401);
    }
    if (u.startsWith(SB + '/rest/v1/app_users')) return json([{ role: /id=eq\.eli/.test(u) ? 'מנהל' : 'מדווח', active: true }]);
    if (u.startsWith('https://login.microsoftonline.com/')) {
      const p = new URLSearchParams(body);
      w.tokenReq = Object.fromEntries(p.entries());
      if (o.tokenFail) return json({ error: 'invalid_grant', error_description: 'AADSTS70000: refresh token expired' }, 400);
      return json({ access_token: 'at-new', refresh_token: 'rt2', expires_in: 3600, scope: 'Files.ReadWrite' });
    }
    if (u.startsWith('https://graph.microsoft.com/v1.0/me/drive/root:/')) {
      w.puts.push({ u, auth: init.headers.Authorization, type: init.headers['Content-Type'], bytes: body });
      if (o.putStatus && o.putStatus !== 200) return json({ error: { code: 'resourceLocked', message: 'The resource you are attempting to access is locked' } }, o.putStatus);
      return json({ webUrl: 'https://tapugan-my.sharepoint.com/x.xlsx', size: 1234 });
    }
    if (u === 'https://graph.microsoft.com/v1.0/me/sendMail') {
      w.mails = w.mails || []; w.mails.push({ auth: init.headers.Authorization, body: JSON.parse(body) });
      return o.mailFail ? json({ error: { code: 'ErrorAccessDenied', message: 'Access is denied' } }, 403) : new Response(null, { status: 202 });
    }
    if (u.startsWith('https://api.resend.com/')) { w.resend = (w.resend || 0) + 1; return json({ id: 'em' }); }
    if (u.startsWith('https://graph.microsoft.com/v1.0/me')) return json({ mail: 'sviva@tapugan.co.il' });
    if (u.startsWith(SB + '/rest/v1/')) return json([]);
    return json({ error: 'unexpected ' + u }, 599);
  };
  return w;
}
const req = (body, headers) => new Request('https://tapugan-safety.pages.dev/api/trustee-log', { method: 'POST', headers: Object.assign({ 'Content-Type': 'application/json' }, headers || {}), body: JSON.stringify(body || {}) });
const call = async (env, body, headers) => { const r = await onRequest({ request: req(body, headers), env }); return { status: r.status, j: await r.json() }; };

console.log('\n1. the rows');
{
  const aoa = buildAoa(REPORTS, [{ n: 5, t: 'עמדות כיבוי אש' }], LOCS, Date.parse('2026-09-27T08:00:00Z'));
  const col = (n) => HEADER.indexOf(n);
  const by = {}; aoa.slice(1).forEach((r) => { by[r[r.length - 1]] = r; });
  check('every trustee report, header first', aoa.length === 5 && aoa[0][0] === 'תאריך', aoa.length);
  check('newest first', aoa[1][aoa[1].length - 1] === 'h2', aoa[1]);
  check('closed finding: סגור, date and closer from the task-8 report',
    by.h1[col('פתוח / סגור')] === 'סגור' && by.h1[col('תאריך סגירה')] === '24/09/2026' && by.h1[col('נסגר על ידי')] === 'רונית', by.h1);
  check('...days to closure (4)', by.h1[col('ימים פתוח / עד סגירה')] === 4, by.h1);
  check('open finding: פתוח and days so far (2)', by.h2[col('פתוח / סגור')] === 'פתוח' && by.h2[col('ימים פתוח / עד סגירה')] === 2, by.h2);
  check('location given only by id prints the full path', by.h2[col('אזור')] === 'אולם ייצור / מסוע 3', by.h2[col('אזור')]);
  check('clean check is תקין with "-"', by.ok1[col('סוג הדיווח')] === 'תקין' && by.ok1[col('פתוח / סגור')] === '-', by.ok1);
  check('the task name comes from the table', by.ok1[col('שם המשימה')] === 'עמדות כיבוי אש', by.ok1);
  check('a date is never an HTML entity', aoa.slice(1).every((r) => !/&#/.test(String(r[0]))), aoa.map((r) => r[0]));
}

console.log('\n2. the file is a real xlsx');
{
  const aoa = buildAoa(REPORTS, [], LOCS);
  const tmp = path.join(os.tmpdir(), 'tru-log-test.xlsx');
  fs.writeFileSync(tmp, buildXlsx(aoa, 'דיווחי נאמנים'));
  let out = '';
  try {
    out = execFileSync('python3', ['-c', [
      'import zipfile,sys,xml.dom.minidom as m',
      'z=zipfile.ZipFile(sys.argv[1]);assert z.testzip() is None',
      'names=set(z.namelist())',
      'need={"[Content_Types].xml","_rels/.rels","xl/workbook.xml","xl/_rels/workbook.xml.rels","xl/styles.xml","xl/worksheets/sheet1.xml"}',
      'assert need<=names, names',
      '[m.parseString(z.read(n)) for n in need]',
      'sh=z.read("xl/worksheets/sheet1.xml").decode()',
      'print("OK", sh.count("<row "), "rightToLeft=\\"1\\"" in sh, "\\u05de\\u05d8\\u05e3" in sh)',
    ].join('\n'), tmp]).toString().trim();
  } catch (e) { out = String(e.stdout || e.message); }
  check('zip intact, every part well-formed XML, 5 rows, right-to-left, Hebrew kept', out === 'OK 5 True True', out);
}

console.log('\n3. upload through Microsoft Graph');
{
  let w = world();
  const r1 = await runLog(ENV, false);
  check('first run uploads', r1.pushed === true && w.puts.length === 1, r1);
  check('...to Apps/Tapugan Safety/נאמני בטיחות/יומן דיווחי נאמנים.xlsx',
    w.puts[0] && decodeURIComponent(w.puts[0].u).indexOf('/root:/' + LOG_FOLDER + '/' + LOG_FILE + ':/content') > 0, w.puts[0] && w.puts[0].u);
  check('...with the refreshed access token, as xlsx', w.puts[0].auth === 'Bearer at-new' && /spreadsheetml/.test(w.puts[0].type), w.puts[0]);
  check('refresh used the stored token and the client secret', w.tokenReq.grant_type === 'refresh_token' && w.tokenReq.refresh_token === 'rt1' && w.tokenReq.client_secret === 'csecret', w.tokenReq);
  check('the rotated refresh token is saved', w.saved.length === 1 && w.saved[0].refresh_token === 'rt2', w.saved);
  check('success recorded, error cleared', w.state.trustee_log_at && w.state.trustee_log_err === '', w.state);
  const keep = w.state;
  w = world({ state: keep, tokens: [{ user_email: 'sviva@tapugan.co.il', refresh_token: 'rt2', access_token: 'at-new', expires_at: new Date(Date.now() + 3e6).toISOString() }] });
  const r2 = await runLog(ENV, false);
  check('nothing changed = nothing uploaded', r2.pushed === false && r2.reason === 'unchanged' && w.puts.length === 0, r2);
  check('...and no token call either', !w.tokenReq, w.tokenReq);
  const r3 = await runLog(ENV, true);
  check('"send now" (force) uploads anyway, reusing a valid access token', r3.pushed === true && w.puts.length === 1 && !w.tokenReq, r3);

  w = world({ putStatus: 423 });
  const r4 = await runLog(ENV, false);
  check('file locked in Excel: fails without throwing, says locked', r4.ok === false && r4.locked === true, r4);
  check('...signature not saved, so the next call retries', !w.state.trustee_log_sig && /423/.test(w.state.trustee_log_err || ''), w.state);

  w = world({ tokenFail: true });
  const r5 = await runLog(ENV, false);
  check('expired Microsoft sign-in is reported, not thrown', r5.ok === false && /invalid_grant|expired/.test(r5.error), r5);
  w = world({ tokens: [] });
  const r6 = await runLog(ENV, false);
  check('nobody connected yet = "not connected"', r6.ok === false && r6.error === 'not connected' && w.puts.length === 0, r6);
  w = world({ reports: [] });
  const r7 = await runLog(ENV, false);
  check('no reports = never overwrites the file with an empty one', r7.reason === 'empty' && w.puts.length === 0, r7);
}

console.log('\n4. who may call it');
{
  let w = world();
  let r = await call(ENV, {});
  check('database call without the secret is refused', r.status === 403 && w.puts.length === 0, r);
  r = await call(ENV, {}, { 'x-notify-secret': 'wrong' });
  check('...and with a wrong one', r.status === 403, r);
  r = await call(ENV, {}, { 'x-notify-secret': 'nsec' });
  check('with the secret it rebuilds the file', r.status === 200 && r.j.pushed === true, r);
  w = world({ state: w.state, tokens: [{ user_email: 'sviva@tapugan.co.il', refresh_token: 'rt2', access_token: 'at-new', expires_at: new Date(Date.now() + 3e6).toISOString() }] });
  r = await call(ENV, { force: true }, { 'x-notify-secret': 'nsec' });
  check('a database call cannot force a rewrite of an unchanged file', r.j.pushed === false && r.j.reason === 'unchanged' && w.puts.length === 0, r.j);
  w = world();
  r = await call(ENV, { force: true }, { Authorization: 'Bearer rep' });
  check('a reporter session is refused', r.status === 403 && w.puts.length === 0, r);
  r = await call(ENV, { op: 'status' }, { Authorization: 'Bearer mgr' });
  check('a manager reads the status', r.status === 200 && r.j.configured === true && r.j.connected === true && r.j.email === 'sviva@tapugan.co.il', r.j);
  r = await call({ SUPABASE_SERVICE_ROLE_KEY: 'srv' }, { op: 'status' }, { Authorization: 'Bearer mgr' });
  check('...and sees "not configured" before the Azure values are in Cloudflare', r.j.configured === false, r.j);
  r = await call({ SUPABASE_SERVICE_ROLE_KEY: 'srv' }, {}, {});
  check('unconfigured server does nothing, says so', r.j.ok === false && /not configured/.test(r.j.error), r.j);
}

console.log('\n5. the one-time sign-in');
{
  const now = Date.now();
  const st = await makeState(ENV, 'eli@tfugen.local', now);
  check('a state we signed is accepted', await checkState(ENV, st, now + 1000));
  check('...not after 15 minutes', !(await checkState(ENV, st, now + 16 * 60 * 1000)));
  check('...not when tampered', !(await checkState(ENV, st.slice(0, -2) + 'xx', now)));
  check('...not when signed with another secret', !(await checkState({ ONEDRIVE_CLIENT_SECRET: 'other' }, st, now)));
  let w = world();
  let res = await msAuth({ request: new Request('https://tapugan-safety.pages.dev/api/ms-auth', { method: 'POST', headers: { Authorization: 'Bearer mgr', 'Content-Type': 'application/json' }, body: JSON.stringify({ op: 'start' }) }), env: ENV });
  let j = await res.json();
  const au = j.url ? new URL(j.url) : null;
  check('a manager gets a Microsoft sign-in link', au && au.hostname === 'login.microsoftonline.com', j);
  check('...asking for offline access and Files.ReadWrite, back to /api/ms-auth',
    au && /offline_access/.test(au.searchParams.get('scope')) && /Files\.ReadWrite/.test(au.searchParams.get('scope')) && au.searchParams.get('redirect_uri') === 'https://tapugan-safety.pages.dev/api/ms-auth', j.url);
  res = await msAuth({ request: new Request('https://tapugan-safety.pages.dev/api/ms-auth', { method: 'POST', headers: { Authorization: 'Bearer rep', 'Content-Type': 'application/json' }, body: JSON.stringify({ op: 'start' }) }), env: ENV });
  check('a reporter cannot start it', res.status === 403, res.status);
  w = world({ tokens: [] });
  res = await msAuth({ request: new Request('https://tapugan-safety.pages.dev/api/ms-auth?code=abc&state=forged.sig'), env: ENV });
  check('a callback with a forged state stores nothing', res.status === 302 && /ms=err/.test(res.headers.get('Location')) && w.saved.length === 0, res.headers.get('Location'));
  const good = await makeState(ENV, 'eli@tfugen.local');
  res = await msAuth({ request: new Request('https://tapugan-safety.pages.dev/api/ms-auth?code=abc&state=' + encodeURIComponent(good)), env: ENV });
  check('a real callback stores the refresh token and returns to the app', res.status === 302 && /\?ms=ok$/.test(res.headers.get('Location')) && w.saved[0] && w.saved[0].refresh_token === 'rt2' && w.saved[0].user_email === 'sviva@tapugan.co.il', [res.headers.get('Location'), w.saved]);
  check('...exchanging the code with the same redirect address', w.tokenReq.grant_type === 'authorization_code' && w.tokenReq.code === 'abc' && w.tokenReq.redirect_uri === 'https://tapugan-safety.pages.dev/api/ms-auth', w.tokenReq);
}

console.log('\n6. alert mail through Outlook (Mail.Send)');
{
  check('a refresh asks only for what was granted, never for Mail.Send it did not get',
    refreshScopes('Files.ReadWrite User.Read profile openid email') === 'offline_access Files.ReadWrite User.Read', refreshScopes('Files.ReadWrite User.Read profile openid email'));
  check('...and keeps Mail.Send once granted', /Mail\.Send/.test(refreshScopes('Files.ReadWrite Mail.Send User.Read')));
  check('...and falls back to the base set when nothing is stored', refreshScopes('') === 'offline_access User.Read Files.ReadWrite' && !/Mail/.test(refreshScopes(null)));
  check('hasMail reads the stored scope', hasMail({ scope: 'Files.ReadWrite Mail.Send' }) && !hasMail({ scope: 'Files.ReadWrite User.Read' }) && !hasMail(null));
  let w = world();
  await runLog(ENV, true);
  check('the OneDrive refresh of an account without Mail.Send does not ask for it', w.tokenReq && !/Mail\.Send/.test(w.tokenReq.scope), w.tokenReq && w.tokenReq.scope);
  world();
  const res = await msAuth({ request: new Request('https://tapugan-safety.pages.dev/api/ms-auth', { method: 'POST', headers: { Authorization: 'Bearer mgr', 'Content-Type': 'application/json' }, body: JSON.stringify({ op: 'start' }) }), env: ENV });
  const j = await res.json();
  check('a new sign-in asks for Mail.Send', /Mail\.Send/.test(new URL(j.url).searchParams.get('scope')), j.url);
  const nreq = (b) => new Request('https://tapugan-safety.pages.dev/api/trustee-notify', { method: 'POST', headers: { Authorization: 'Bearer mgr', 'Content-Type': 'application/json' }, body: JSON.stringify(b) });
  const tokM = [{ user_email: 'sviva@tapugan.co.il', refresh_token: 'rt1', access_token: 'at-live', expires_at: new Date(Date.now() + 3e6).toISOString(), scope: 'Files.ReadWrite Mail.Send User.Read' }];
  const NENV = { ...ENV, RESEND_KEY: 're_x' };
  w = world({ tokens: tokM });
  let r = await notify({ request: nreq({ test: true, whatsapp: false, email: true, email_to: 'sviva@tapugan.co.il' }), env: NENV });
  let jj = await r.json();
  check('with Mail.Send: the alert goes out through Outlook, to the organisational address', jj.email === 'sent' && w.mails && w.mails.length === 1 && w.mails[0].body.message.toRecipients[0].emailAddress.address === 'sviva@tapugan.co.il' && w.mails[0].auth === 'Bearer at-live', [jj, w.mails]);
  check('...with the same Hebrew body, and Resend is not used', /הודעת בדיקה/.test(w.mails[0].body.message.body.content) && w.mails[0].body.message.body.contentType === 'HTML' && !w.resend, w.resend);
  w = world({ tokens: [{ ...tokM[0], scope: 'Files.ReadWrite User.Read' }] });
  r = await notify({ request: nreq({ test: true, whatsapp: false, email: true, email_to: 'mishaf1988@gmail.com' }), env: NENV });
  jj = await r.json();
  check('without Mail.Send: Resend, as before', jj.email === 'sent' && w.resend === 1 && !w.mails, [jj, w.resend]);
  w = world({ tokens: tokM, mailFail: true });
  r = await notify({ request: nreq({ test: true, whatsapp: false, email: true, email_to: 'sviva@tapugan.co.il' }), env: NENV });
  jj = await r.json();
  check('Outlook refuses: falls back to Resend instead of losing the alert', w.mails.length === 1 && w.resend === 1 && jj.email === 'sent', [jj, w.resend]);
  w = world({ tokens: tokM, mailFail: true });
  r = await notify({ request: nreq({ test: true, whatsapp: false, email: true, email_to: 'sviva@tapugan.co.il' }), env: ENV });
  jj = await r.json();
  check('Outlook refuses and no Resend key: the error says why', /outlook 403/.test(jj.email), jj.email);
  r = await call(ENV, { op: 'status' }, { Authorization: 'Bearer mgr' });
  w = world({ tokens: [{ ...tokM[0], access_token: null, expires_at: null }] });
  await runLog(ENV, true);
  check('a refresh of an account that granted Mail.Send keeps asking for it (scope read back from the DB)', w.tokenReq && /Mail\.Send/.test(w.tokenReq.scope), w.tokenReq && w.tokenReq.scope);
  w = world({ tokens: tokM });
  r = await call(ENV, { op: 'status' }, { Authorization: 'Bearer mgr' });
  check('status says mail is allowed once Mail.Send is stored', r.j.mail === true, r.j);
  w = world({ tokens: [{ ...tokM[0], scope: 'Files.ReadWrite User.Read' }] });
  r = await call(ENV, { op: 'status' }, { Authorization: 'Bearer mgr' });
  check('...and not allowed without it', r.j.mail === false, r.j);
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
