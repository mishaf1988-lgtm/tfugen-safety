// Michael's signature on a PDF only after his own "בצע" (21/10/2026, project-files/briefs/owner-sign.md).
// pdf-lib is the file that was checked, a request alone never signs, "בצע" on another message never signs,
// the original is never replaced, and a real small PDF is signed (pdf-lib in Node).
import { readFileSync } from 'fs';
import { createHash } from 'crypto';
import { PDFDocument, PDFName } from './_build/_pdflib.mjs';
import { CAPTION_PNG_B64 } from './_build/_signcaption.mjs';
import { signAdd, signTake, signMark, signRefOf, signAnswer, signedName, signAskText, stampPdf, signRun, ilDate, SIGN_TTL_MS, SIGN_KEY, SIGN_OBJ } from './_build/_sign.mjs';
import { fastRoute, fastSign } from './_build/wa-hook.mjs';
import { signRequestCheck, OD_ROOT } from './_build/routine-db.mjs';

let pass = 0, fail = 0;
const check = (l, c, d) => { if (c) { pass++; console.log('  ✓ ' + l); } else { fail++; console.log('  ✗ ' + l + (d !== undefined ? '  -> ' + JSON.stringify(d).slice(0, 300) : '')); } };
const T0 = '2026-10-21T10:00:00.000Z', ms0 = Date.parse(T0);
const iso = (h) => new Date(ms0 + h * 3600e3).toISOString();

console.log('\n1. pdf-lib is the file that was checked (owner-sign.md: 1.17.1, sha256)');
const lib = readFileSync(new URL('../../functions/_pdflib.js', import.meta.url));
check('523,417 bytes', lib.length === 523417, lib.length);
check('sha256 72c052d9...d969', createHash('sha256').update(lib).digest('hex') === '72c052d97b4d5d9fa6cdbdcb7ad709f03d4ddb1122390cb3afeba4d88651d969');
check('no import from outside', !/^\s*import\s/m.test(lib.toString('utf8')) && !/\bimport\(/.test(lib.toString('utf8')));
check('the signature image is not in the repo, only its place in the bucket', SIGN_OBJ === 'owner-signature/sig.png');

console.log('\n2. the request (routine-db sign_request)');
const ok = { agent: 'wa-assistant', why: 'Michael asked to sign', path: 'מינויים/מכתב מינוי.pdf' };
const c = signRequestCheck(ok);
check('a PDF in the safety folder: the full path under the root', c.path === OD_ROOT + 'מינויים/מכתב מינוי.pdf' && c.name === 'מכתב מינוי.pdf' && c.folder === 'מינויים', c);
check('not a PDF = refused', signRequestCheck({ ...ok, path: 'מינויים/x.docx' }).error === 'bad path');
check('the protected folders = refused', ['_גרסאות קודמות/a.pdf', 'למחיקה/a.pdf', 'x/ARCHIVE/a.pdf', '_בקשות מהמייל/a.pdf', '_טיוטות למייל/a.pdf'].every((p) => signRequestCheck({ ...ok, path: p }).error === 'bad path'));
// 21/10/2026: a quote that came by mail sits in the inbox; it is signed there (Michael tapped one at 21:44).
const ib = signRequestCheck({ ...ok, path: '_נכנס מהמייל/q.pdf' });
check('the mail inbox: allowed, the full path keeps the inbox', !ib.error && ib.path === OD_ROOT + '_נכנס מהמייל/q.pdf' && ib.folder === '_נכנס מהמייל', ib);
check('.. and a file at the root alone = refused', signRequestCheck({ ...ok, path: '../a.pdf' }).error && signRequestCheck({ ...ok, path: 'a.pdf' }).error);
check('a signed copy is not signed again', signRequestCheck({ ...ok, path: 'מינויים/מכתב מינוי - חתום.pdf' }).error === 'bad path');
check('no agent / no why = refused', signRequestCheck({ ...ok, agent: 'X Y' }).error === 'bad agent name' && signRequestCheck({ ...ok, why: '' }).error === 'why required');
check('page and place: numbers in range only', signRequestCheck({ ...ok, page: 2, x: 300, y: 80 }).page === 2 && signRequestCheck({ ...ok, page: 0 }).error && signRequestCheck({ ...ok, x: '5' }).error && signRequestCheck({ ...ok, page: 1.5 }).error);
const ask = signAskText('מכתב מינוי.pdf', 'מינויים');
check('the question names the file and the new name, keyboard characters only', /^לחתום בשמך על מכתב מינוי\.pdf\?/.test(ask) && ask.indexOf('מכתב מינוי - חתום.pdf') > 0 && !/[—–־«»“”→·…]/.test(ask));

console.log('\n3. waiting, answering, expiring (server_state ' + SIGN_KEY + ')');
const a = signAdd('[]', { agent: 'wa-assistant', path: c.path, name: c.name }, T0, 'ab12');
check('a new request waits', a.created && a.list.length === 1 && a.list[0].status === 'pending' && /^s[a-z0-9]{6,20}$/.test(a.id), a);
const a2 = signAdd(JSON.stringify(a.list), { agent: 'x', path: c.path, name: c.name }, iso(1));
check('the same file again within 24 hours = the same request, no second message', !a2.created && a2.id === a.id && a2.list.length === 1);
const no = signTake(JSON.stringify(a.list), a.id, false, iso(1), 'w1');
check('"no" = cancelled, nothing to sign', !no.error && no.req.status === 'cancelled');
const yes = signTake(JSON.stringify(a.list), a.id, true, iso(1), 'w2');
check('"do it" = approved, with the message that approved it', !yes.error && yes.req.status === 'approved' && yes.req.by === 'w2');
check('a second answer to the same request = done, not signed twice', signTake(JSON.stringify(yes.list), a.id, true, iso(2)).error === 'done');
check('after 24 hours = expired', signTake(JSON.stringify(a.list), a.id, true, new Date(ms0 + SIGN_TTL_MS).toISOString()).error === 'expired');
check('an unknown id = not ours', signTake(JSON.stringify(a.list), 'szzzzzzz', true, iso(1)).error === 'unknown');
check('signMark sets the outcome', signMark(JSON.stringify(yes.list), a.id, 'signed', { signed: 'n' })[0].status === 'signed');

console.log('\n4. which message is an answer (wa-hook fast lane)');
const m = (text, choice) => ({ text, choice: choice || null });
const prev = { text: ask, ref: 'sign:' + a.id };
const about = 'assistant | ' + ask.slice(0, 40) + ' | ref sign:' + a.id + ' | 2026-10-21';
check('"בצע" right after the question = sign yes', JSON.stringify(fastRoute(m('בצע'), '', prev)) === JSON.stringify({ kind: 'sign', id: a.id, yes: true }));
check('a tap on button 1 / "1" / "1. בצע" = yes', fastRoute(m('בצע', 1), about, prev).yes === true && fastRoute(m('1'), '', prev).yes === true && fastRoute(m('1. בצע'), '', prev).yes === true);
check('"לא" / "2" = no', fastRoute(m('לא'), '', prev).yes === false && fastRoute(m('2', 2), about, prev).yes === false);
check('a reply to the question itself = that request', fastRoute(m('בצע'), about, null).id === a.id);
// 21/10/2026 (Michael: "no need for exact words for the approval"): a plain yes word is a yes; a sentence is not.
['כן', 'אוקיי', 'תחתום', 'מאשר', '👍'].forEach((w) => check('"' + w + '" = approval', (fastRoute(m(w), '', prev) || {}).kind === 'sign' && fastRoute(m(w), '', prev).yes === true));
['בצע אבל רק בעמוד 2', 'מה המצב?', 'כן אבל לא בעמוד הזה'].forEach((w) => check('"' + w + '" = not an approval, to the assistant', !fastRoute(m(w), '', prev) || fastRoute(m(w), '', prev).kind !== 'sign'));
['בטל', 'עזוב'].forEach((w) => check('"' + w + '" = cancel', (fastRoute(m(w), '', prev) || {}).yes === false));
check('"בצע" with no signature question before it = not a signature', !fastRoute(m('בצע'), '', { text: 'x', ref: 'pro' }) || fastRoute(m('בצע'), '', { text: 'x', ref: 'pro' }).kind !== 'sign');
check('"בצע" in reply to ANOTHER message (an alert) = not a signature, even if the last question was one', !fastRoute(m('בצע'), 'trustee_hazard | x | id r9 | t', prev) || fastRoute(m('בצע'), 'trustee_hazard | x | id r9 | t', prev).kind !== 'sign');
check('"בצע" in reply to another answer of the assistant (ref pro) = not a signature', signRefOf('assistant | y | ref pro | t', prev) === null);
check('a ref that only looks like one = nothing', signRefOf('', { ref: 'sign:../x' }) === null && signAnswer(m('בצע!')) === true);

console.log('\n5. a real small PDF is signed (pdf-lib in Node)');
const src = await PDFDocument.create(); src.addPage([595, 842]); src.addPage([595, 842]);
const srcBytes = await src.save();
const before = Buffer.from(srcBytes).toString('base64');
const sig = Uint8Array.from(Buffer.from(CAPTION_PNG_B64, 'base64')); // any PNG stands in for the signature
const out = await stampPdf(srcBytes, sig, '21/10/2026', {});
check('the input bytes are not changed', Buffer.from(srcBytes).toString('base64') === before);
const back = await PDFDocument.load(out);
check('still two pages, a valid PDF', back.getPageCount() === 2 && Buffer.from(out.slice(0, 5)).toString() === '%PDF-');
const raw = Buffer.from(out).toString('latin1');
check('two images (signature + caption) and the date in Helvetica were added', (raw.match(/\/Subtype\s*\/Image/g) || []).length >= 2 && !!back.getPage(1).node.Resources().get(PDFName.of('Font')), (raw.match(/\/Subtype\s*\/Image/g) || []).length);
check('the default is the last page', !!back.getPage(1).node.Resources().get(PDFName.of('XObject')) && !back.getPage(0).node.Resources().get(PDFName.of('XObject')));
const p1 = await PDFDocument.load(await stampPdf(srcBytes, sig, '21/10/2026', { page: 1 }));
check('page: 1 = the first page', !!p1.getPage(0).node.Resources().get(PDFName.of('XObject')));
let thrown = false; try { await stampPdf(srcBytes, new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9]), 'd', {}); } catch (e) { thrown = true; }
check('a signature that is not an image = refused', thrown);
check('the date is DD/MM/YYYY, Israel time', ilDate(Date.parse('2026-10-21T22:30:00Z')) === '22/10/2026');
check('the new name keeps the old one', signedName('מכתב מינוי.pdf') === 'מכתב מינוי - חתום.pdf' && signedName('a.PDF') === 'a - חתום.pdf');

console.log('\n6. the server never replaces a file (signRun with Graph and the bucket mocked)');
const req = { path: OD_ROOT + 'מינויים/מכתב מינוי.pdf', name: 'מכתב מינוי.pdf' };
function mockFetch(opts) {
  const calls = [];
  const f = async (u, init) => {
    const method = (init && init.method) || 'GET'; calls.push({ u: String(u), method });
    const s = String(u);
    if (s.indexOf('/storage/v1/object/backups/owner-signature/sig.png') > 0) return opts.noSig ? new Response('{}', { status: 400 }) : new Response(sig, { status: 200 });
    if (method === 'PUT') return new Response(JSON.stringify({ webUrl: 'https://x/y', size: 1 }), { status: 201 });
    if (/:\/content$/.test(s)) return new Response(opts.notPdf ? new Uint8Array([1, 2, 3, 4, 5, 6]) : srcBytes, { status: 200 });
    if (s.indexOf(encodeURIComponent('מכתב מינוי - חתום.pdf') + '?select=id') > 0) return new Response(opts.taken ? '{"id":"1"}' : '{}', { status: opts.taken ? 200 : 404 });
    if (/%D7%97%D7%AA%D7%95%D7%9D%20[2-5]\.pdf\?select=id/.test(s)) return new Response(opts.takenAll ? '{"id":"1"}' : '{}', { status: opts.takenAll ? 200 : 404 });
    return new Response('{}', { status: 500 });
  };
  return { f, calls };
}
const env = { SUPABASE_SERVICE_ROLE_KEY: 'k' };
let mk = mockFetch({}); globalThis.fetch = mk.f;
let r = await signRun(env, 'https://sb', 'tok', req, ms0);
const puts = mk.calls.filter((x) => x.method === 'PUT');
check('signed: one PUT, to the new name, with conflictBehavior=fail', r.ok && puts.length === 1 && puts[0].u.indexOf(encodeURIComponent('מכתב מינוי - חתום.pdf') + ':/content?@microsoft.graph.conflictBehavior=fail') > 0, r);
check('no write to the original path', !mk.calls.some((x) => x.method !== 'GET' && x.u.indexOf(encodeURIComponent('מכתב מינוי.pdf') + ':') > 0));
check('no DELETE and no PATCH at all', !mk.calls.some((x) => x.method === 'DELETE' || x.method === 'PATCH'));
mk = mockFetch({ taken: true }); globalThis.fetch = mk.f;
r = await signRun(env, 'https://sb', 'tok', req, ms0);
check('a signed copy already there (22/10/2026): kept, the new one is "- \u05d7\u05ea\u05d5\u05dd 2.pdf"', r.ok && r.name === 'מכתב מינוי - חתום 2.pdf' && mk.calls.filter((x) => x.method === 'PUT').length === 1 && mk.calls.filter((x) => x.method === 'PUT')[0].u.indexOf(encodeURIComponent('מכתב מינוי - חתום 2.pdf') + ':/content?@microsoft.graph.conflictBehavior=fail') > 0, r);
mk = mockFetch({ taken: true, takenAll: true }); globalThis.fetch = mk.f;
r = await signRun(env, 'https://sb', 'tok', req, ms0);
check('five signed copies already there = not signed, nothing written', !r.ok && r.error === 'signed file exists' && !mk.calls.some((x) => x.method === 'PUT'));
mk = mockFetch({ noSig: true }); globalThis.fetch = mk.f;
r = await signRun(env, 'https://sb', 'tok', req, ms0);
check('no signature image in the bucket = not signed, nothing written', !r.ok && r.error === 'no signature image' && !mk.calls.some((x) => x.method === 'PUT'));
mk = mockFetch({ notPdf: true }); globalThis.fetch = mk.f;
r = await signRun(env, 'https://sb', 'tok', req, ms0);
check('not a PDF = not signed', !r.ok && r.error === 'not a pdf' && !mk.calls.some((x) => x.method === 'PUT'));

console.log('\n7. the answer in wa-hook: "no" and an old request never reach OneDrive');
function stateFetch(list) {
  const calls = []; let saved = null;
  globalThis.fetch = async (u, init) => {
    const s = String(u), method = (init && init.method) || 'GET'; calls.push({ u: s, method });
    if (s.indexOf('server_state?key=eq.' + SIGN_KEY) >= 0) return new Response(JSON.stringify([{ value: JSON.stringify(saved || list) }]), { status: 200 });
    if (s.indexOf('server_state?on_conflict') >= 0) { saved = JSON.parse(JSON.parse(init.body)[0].value); return new Response(null, { status: 204 }); }
    if (s.indexOf('notifications_log') >= 0) return new Response(null, { status: 201 });
    return new Response('{}', { status: 500 });
  };
  return { calls, saved: () => saved };
}
const fresh = signAdd('[]', { agent: 'wa-assistant', path: req.path, name: req.name }, new Date().toISOString(), 'cd34');
let st = stateFetch(fresh.list);
let t = await fastSign({ SUPABASE_SERVICE_ROLE_KEY: 'k' }, { id: fresh.id, yes: false }, 'w9');
check('"no": cancelled, logged, no Graph call', /^בוטל/.test(t) && st.saved()[0].status === 'cancelled' && !st.calls.some((x) => /graph|login\.microsoft/.test(x.u)) && st.calls.some((x) => x.u.indexOf('notifications_log') >= 0));
const old = signAdd('[]', { agent: 'wa-assistant', path: req.path, name: req.name }, new Date(Date.now() - SIGN_TTL_MS - 1000).toISOString(), 'ef56');
st = stateFetch(old.list);
t = await fastSign({ SUPABASE_SERVICE_ROLE_KEY: 'k' }, { id: old.id, yes: true }, 'w10');
check('"do it" after 24 hours: expired, no Graph call', /פגה/.test(t) && st.saved()[0].status === 'expired' && !st.calls.some((x) => /graph|login\.microsoft|oauth_tokens/.test(x.u)));
st = stateFetch(fresh.list);
t = await fastSign({ SUPABASE_SERVICE_ROLE_KEY: 'k' }, { id: 'szzzzzzz', yes: true }, 'w11');
check('an id that is not waiting = back to the assistant (null), nothing written', t === null && !st.calls.some((x) => x.method === 'POST'));

console.log('\n7. a question that did not go out is not left pending (22/10/2026 retro)');
{
  const q = signAdd('[]', { agent: 'wa-assistant', path: 'a/b.pdf', name: 'b.pdf' }, T0, 'zz11');
  check('still pending: a second request on the same file is "already waiting" (the bug)', signAdd(JSON.stringify(q.list), { agent: 'x', path: 'a/b.pdf', name: 'b.pdf' }, iso(1)).created === false);
  const failed = signMark(JSON.stringify(q.list), q.id, 'failed', { error: 'window' });
  check('marked failed: the next request creates a new one', signAdd(JSON.stringify(failed), { agent: 'x', path: 'a/b.pdf', name: 'b.pdf' }, iso(1)).created === true);
  const src = (await import('node:fs')).readFileSync(new URL('../../functions/api/routine-db.js', import.meta.url), 'utf8');
  const i = src.indexOf("const s = await sendToOwner(env, to, text, { windowOpen: win, choices: SIGN_CHOICES });");
  check('sign_request re-reads the state and marks the request failed when the question was not sent (a source check: the handler itself is not run here)', i > 0 && /if \(!s\.ok\)[\s\S]{0,300}stateRead\(\[SIGN_KEY\]\)[\s\S]{0,300}fetch\(url \+ '\/rest\/v1\/server_state[\s\S]{0,400}signMark\(fresh && fresh\[0\] \? fresh\[0\]\.value : JSON\.stringify\(r\.list\), r\.id, 'failed'/.test(src.slice(i, i + 1500)), i);
}

console.log('\nsign-test: ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
