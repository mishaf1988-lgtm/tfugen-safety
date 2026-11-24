// A link in the induction mail to correct a new worker's details, equipment and documents (24/11/2026, Michael:
// "בקליטת עובדים חדשים לפעמים יש איזשהו פספוס... במייל עצמו יהיה קישור עם אופציה להוסיף דברים או לשנות דברים").
// Only HR and Michael, with the HR code; the signed copy stays, a correction page is filed beside it and a mail goes to both.
import { onRequest, makeCodeCookie, IND_HR, IND_ROOT, fileInduction } from './_build/talk.mjs';
import { makeEditToken, readEditToken, editUrl, diffRow, equipSummary, editEntry, correctionHtml, updateMailHtml, editFormHtml, equipPrefill, asSigned, EDIT_MAX } from './_build/_indedit.mjs';
let pass = 0, fail = 0;
const check = (l, c, d) => { if (c) { pass++; console.log('  ✓ ' + l); } else { fail++; console.log('  ✗ ' + l + (d !== undefined ? '  -> ' + JSON.stringify(d).slice(0, 500) : '')); } };
const SB = 'https://znhjtpcltrxxyfjczgvw.supabase.co';
const URL0 = 'https://tapugan-safety.pages.dev/api/talk';
const ENV = { SUPABASE_SERVICE_ROLE_KEY: 'srv', SUPABASE_URL: SB, TRUSTEE_NOTIFY_SECRET: 'nsec', GEMINI_API_KEY: 'g' };
const GR = 'https://graph.microsoft.com/v1.0/me';
const TALK = { id: 'ind1', title: 'הוראות כניסה', body: 'x', s: 'פורסמה', kind: 'induction', link_v: 0 };
const ROW = { id: 'r1', talk_id: 'ind1', emp_name: 'סבטלנה לריונוב', id_no: '334455667', emp_no: '1234', dept: 'טוגנים', phone: '0521234567', job: 'מפעילת קו', agency: null, equip: null, edits: null, read_at: '2026-11-24T08:55:45Z', doc_err: null };
let w, rowNow;
const reset = (o) => { w = { patches: [], puts: [], mails: [], ...o }; rowNow = { ...ROW, ...(o && o.row) }; };
globalThis.fetch = async (url, init) => {
  const u = String(url), m = (init && init.method) || 'GET';
  const json = (o, st = 200) => new Response(JSON.stringify(o), { status: st, headers: { 'Content-Type': 'application/json' } });
  if (u.startsWith(SB + '/rest/v1/toolbox_talks')) return json([TALK]);
  if (u.startsWith(SB + '/rest/v1/toolbox_reads')) {
    if (m === 'PATCH') { w.patches.push({ u, b: JSON.parse(init.body) }); return w.patchFail ? json({ error: 'x' }, 500) : new Response(null, { status: 204 }); }
    return json(/id=eq\.r1/.test(u) ? [rowNow] : []);
  }
  if (u.startsWith(SB + '/storage/v1/object/')) return json({ Key: 'x' });
  if (u.startsWith(SB + '/rest/v1/server_state')) return json([{ value: '246810' }]);
  if (u.startsWith(SB + '/rest/v1/rpc/guess_hit')) return json(1);
  if (u.startsWith(SB + '/rest/v1/rpc/guess_clear')) return json(null);
  if (u.startsWith(SB + '/rest/v1/oauth_tokens')) return json([{ user_email: 'sviva@tapugan.co.il', refresh_token: 'r', access_token: 'at', expires_at: new Date(Date.now() + 3600e3).toISOString(), scope: 'Files.ReadWrite Mail.Send' }]);
  if (u.startsWith(GR + '/drive/root:/') && m === 'PUT') {
    const path = decodeURIComponent(u.slice((GR + '/drive/root:/').length).replace(/:\/content$/, ''));
    w.puts.push({ path, txt: /html/.test(init.headers['Content-Type']) ? new TextDecoder().decode(init.body) : '' });
    return json({ webUrl: 'https://od.example/' + encodeURIComponent(path), size: init.body.length });
  }
  if (u.startsWith(GR + '/drive/root:/') && /\?format=pdf$/.test(u)) { const b = new Uint8Array(2000); b.set([0x25, 0x50, 0x44, 0x46], 0); return new Response(b, { status: 200 }); }
  if (u === GR + '/sendMail') { w.mails.push(JSON.parse(init.body)); return new Response(null, { status: 202 }); }
  if (u.startsWith('https://generativelanguage.googleapis.com/')) return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: 'טקסט בעברית' }] } }] }), { status: 200 });
  return json({ error: 'unexpected ' + u }, 599);
};
const cookie = async () => 'tsind=' + (await makeCodeCookie(ENV, 'ind1', '246810'));
const get = async (tok, ck) => { const r = await onRequest({ request: new Request(URL0 + '?op=edit&e=' + encodeURIComponent(tok), { headers: ck ? { cookie: ck } : {} }), env: ENV }); return { st: r.status, h: await r.text(), csp: r.headers.get('content-security-policy') }; };
const post = async (fields, ck, docs) => {
  const fd = new FormData();
  for (const [a, b] of Object.entries(fields)) fd.append(a, b);
  (docs || []).forEach((d) => fd.append('doc', d));
  const r = await onRequest({ request: new Request(URL0 + '?op=edit', { method: 'POST', body: fd, headers: ck ? { cookie: ck } : {} }), env: ENV, waitUntil: (p) => { w.bg = p; } });
  if (w.bg) { await w.bg; w.bg = null; }
  return { st: r.status, h: await r.text(), loc: r.headers.get('location'), setc: r.headers.get('set-cookie') };
};
const FORM = (tok, extra) => ({ e: tok, ename: ROW.emp_name, eid: ROW.id_no, ino: '1234', idep: 'טוגנים', iph: '0521234567', ijob: 'מפעילת קו', iagn: '', eqc: 'no', ...extra });
const tokOf = async (id = 'r1') => makeEditToken(ENV, id);

console.log('\n1. the link and what changed (pure)');
{
  const t = await tokOf();
  check('the token reads back to the row', (await readEditToken(ENV, t)).id === 'r1', await readEditToken(ENV, t));
  check('a token of another kind is refused', (await readEditToken(ENV, 'talk-link:v1:abc')).error, await readEditToken(ENV, 'talk-link:v1:abc'));
  check('expired after 14 days', (await readEditToken(ENV, t, Date.now() + 15 * 86400e3)).error === 'expired');
  check('the URL opens op=edit on the same page as the induction', editUrl(t).startsWith('https://tapugan-safety.pages.dev/api/talk?op=edit&e='), editUrl(t));
  const d = diffRow(ROW, { emp_name: ROW.emp_name, id_no: ROW.id_no, emp_no: '1234', dept: 'מעבדה', phone: '0521234567', job: 'מפעילת קו', agency: null });
  check('only the field that differs, with before and after', d.length === 1 && d[0].k === 'dept' && d[0].old === 'טוגנים' && d[0].new === 'מעבדה', d);
  check('null and empty text are the same (no false change)', diffRow({ agency: null }, { agency: '' }).length === 0);
  check('equipment as one line, or that nothing was handed over', equipSummary(null) === 'לא נמסר ציוד' && equipSummary({ items: [{ n: 'נעלי עבודה', q: 1 }, { n: 'כלי עבודה', q: 2, d: 'מפתח' }], ret: 'אחזקה' }).includes('נעלי עבודה x1') && equipSummary({ items: [{ n: 'כלי עבודה', q: 2, d: 'מפתח' }] }).includes('(מפתח)'));
  const p = equipPrefill({ items: [{ n: 'נעלי עבודה', q: 1 }, { n: 'פריט חופשי', q: 3 }], ret: 'אחזקה' }, ['צ\'יפ אישי', 'נעלי עבודה'], 1, 2, 'משאבי אנוש');
  check('the form is prefilled from the row: known items by place, others in the free rows', p.q[1] === 1 && p.free[0].n === 'פריט חופשי' && p.c === 'yes' && p.ret === 'אחזקה', p);
  const e = editEntry(d, null, { items: [{ n: 'נעלי עבודה', q: 1 }] }, 2, Date.parse('2026-11-24T10:00:00Z'));
  const pg = correctionHtml({ ...ROW, emp_name: 'דני <b>' }, e, ['QUJD'], { day: '2026-11-24', hm: '12:00' });
  check('the correction page: before and after, the equipment note, the photo, escaped', pg.includes('טוגנים') && pg.includes('מעבדה') && pg.includes('יש להחתים את העובד') && pg.includes('data:image/jpeg;base64,QUJD') && pg.includes('דני &lt;b&gt;') && !pg.includes('<b>'), pg.slice(0, 300));
  const ml = updateMailHtml(ROW, e, 'https://od.example/x', 'https://tapugan-safety.pages.dev/api/talk?op=edit&e=T', '');
  check('the update mail: the changes, the filed page and a fresh link', ml.includes('מעבדה') && ml.includes('od.example/x') && ml.includes('op=edit') && ml.includes('הסיסמה של משאבי אנוש'));
  const fh = editFormHtml({ ...ROW, emp_name: 'א"ב <i>' }, { tok: 'T', depts: ['טוגנים', 'מעבדה'], otherDep: 'אחר', items: ['נעלי עבודה'], tools: 0, free: 2, retDef: 'משאבי אנוש', nonce: 'N' });
  check('the form: name escaped, department selected, a nonce on the script', fh.includes('א&quot;ב &lt;i&gt;') && fh.includes('<option value="טוגנים" selected>') && fh.includes('nonce="N"') && fh.includes('name="e" value="T"'));
}

console.log('\n2. who may open it');
{
  reset();
  const t = await tokOf();
  const a = await get(t);
  check('a link without the HR code: the code page, not the details', a.st === 200 && a.h.includes('name="icode"') && !a.h.includes('334455667') && a.h.includes('op=edit'), a.h.slice(0, 300));
  const b = await get(t, await cookie());
  check('with the HR code cookie: the form with the worker\'s details', b.st === 200 && b.h.includes('סבטלנה לריונוב') && b.h.includes('334455667') && b.h.includes('0521234567') && b.h.includes('name="eqc"'), b.h.slice(0, 200));
  check('the page cannot be framed and has a nonce-only script policy', /frame-ancestors 'none'/.test(b.csp) && /script-src 'nonce-/.test(b.csp), b.csp);
  const c = await get('garbage', await cookie());
  check('a bad token: refused, no details', c.st === 403 && !c.h.includes('334455667'), c.st);
  const d = await get(await makeEditToken(ENV, 'r1', Date.now() - 20 * 86400e3), await cookie());
  check('an old token: 410', d.st === 410, d.st);
  const e = await get(await tokOf('nope'), await cookie());
  check('a token of a row that does not exist: refused', e.st === 403, e.st);
  const f = await post({ e: t, icode: '000000' });
  check('a wrong code: 403 and no cookie', f.st === 403 && !f.setc, f.st);
  const g = await post({ e: t, icode: '246810' });
  check('the right code: a cookie for the induction and back to the form', g.st === 303 && /tsind=/.test(g.setc || '') && /op=edit/.test(g.loc || ''), g);
  const h = await post(FORM(t, { ijob: 'מנהלת' }));
  check('a save without the code cookie is refused and writes nothing', h.st !== 200 || !w.patches.length ? w.patches.length === 0 : false, w.patches);
}

console.log('\n3. a correction is saved, filed and mailed');
{
  reset();
  const t = await tokOf(), ck = await cookie();
  const r = await post(FORM(t, { idep: 'מעבדה', iph: '052-7654321', eqc: 'yes', eqq1: '1', eqr: 'אחזקה' }), ck);
  const p = w.patches.find((x) => x.b.edits);
  check('saved (200)', r.st === 200 && r.h.includes('התיקון נשמר'), r.st);
  check('the row gets only what changed, plus the audit line (before and after)', p && p.b.dept === 'מעבדה' && p.b.phone === '0527654321' && !('emp_name' in p.b) && !('job' in p.b) && p.b.edits.length === 1 && p.b.edits[0].changes.length === 2 && p.b.edits[0].changes[0].old === 'טוגנים' && p.b.edits[0].by === 'hr' && p.b.edits[0].equip && p.b.edits[0].equip.old === 'לא נמסר ציוד', p && p.b);
  check('the equipment is saved on the row', p && p.b.equip && p.b.equip.items.length === 1 && p.b.equip.ret === 'אחזקה', p && p.b.equip);
  check('the signed form is never touched (no change to sig_url, doc_url, read_at)', p && !('sig_url' in p.b) && !('doc_url' in p.b) && !('read_at' in p.b));
  const filed = w.puts.find((x) => x.path.startsWith(IND_ROOT + '/'));
  check('a correction page filed beside the signed form, named with "תיקון"', filed && /\.pdf$/.test(filed.path) && filed.path.includes('תיקון'), filed && filed.path);
  const src = w.puts.find((x) => x.path.startsWith('Apps/') && x.txt);
  check('the page says what changed and that the worker must sign the equipment again', src && src.txt.includes('מעבדה') && src.txt.includes('יש להחתים את העובד'), src && src.txt.slice(-400));
  const ml = w.mails[0] && w.mails[0].message, to = ml ? ml.toRecipients.map((x) => x.emailAddress.address) : [];
  check('one update mail, to Michael and HR only', w.mails.length === 1 && to.length === 2 && to.includes('sviva@tapugan.co.il') && to.includes(IND_HR), to);
  check('the mail has the changes, the file link, and a fresh edit link', ml && ml.body.content.includes('מעבדה') && ml.body.content.includes('od.example') && ml.body.content.includes('op=edit') && ml.subject.includes('תיקון') && ml.attachments && ml.attachments[0], ml && ml.subject);
  // security review 24/11/2026, finding 1: a resend of the signed form is built from what the worker signed
  const signed = asSigned({ ...ROW, ...p.b });
  check('asSigned undoes the correction: details and equipment as signed', signed.dept === 'טוגנים' && signed.phone === '0521234567' && signed.equip === null && signed.edits.length === 1, signed);
  const two = asSigned({ ...ROW, dept: 'ג', edits: [{ changes: [{ k: 'dept', old: 'טוגנים', new: 'ב' }] }, { changes: [{ k: 'dept', old: 'ב', new: 'ג' }] }] });
  check('two corrections undone, the latest first', two.dept === 'טוגנים', two.dept);
  check('a row never corrected is returned as it is', asSigned(ROW).dept === 'טוגנים' && asSigned({ ...ROW, equip: { items: [] } }).equip.items.length === 0);
}

console.log('\n4. refusals and limits');
{
  reset();
  const t = await tokOf(), ck = await cookie();
  const a = await post(FORM(t), ck);
  check('nothing changed: says so, writes nothing, mails nothing', a.st === 200 && a.h.includes('לא שונה דבר') && !w.patches.length && !w.mails.length, w);
  const b = await post(FORM(t, { eid: '12' }), ck);
  check('an ID that is not an ID: refused, nothing written', b.st === 400 && !w.patches.length, b.st);
  const c = await post(FORM(t, { eqc: 'yes' }), ck);
  check('"equipment handed over" with no quantity: refused', c.st === 400 && !w.patches.length, c.st);
  const d = await post(FORM(t, { eqc: '' }), ck);
  check('no equipment choice: refused (HR must choose, 09/11/2026)', d.st === 400 && !w.patches.length, d.st);
  const e = await post(FORM(t, { iph: '12' }), ck);
  check('a bad phone: refused', e.st === 400 && !w.patches.length, e.st);
  reset({ row: { edits: Array.from({ length: EDIT_MAX }, (_, i) => ({ at: 'x' + i, changes: [] })) } });
  const f = await post(FORM(await tokOf(), { ijob: 'מנהלת' }), await cookie());
  check('after ' + EDIT_MAX + ' corrections a leaked link cannot go on: 429, nothing written', f.st === 429 && !w.patches.length && !w.mails.length, f.st);
  reset({ patchFail: true });
  const g = await post(FORM(await tokOf(), { idep: 'מעבדה' }), await cookie());
  check('the row cannot be saved: an error, and no page or mail goes out', g.st === 502 && !w.mails.length && !w.puts.length, g.st);
}

console.log('\n5. a photo is added');
{
  reset();
  const jpg = 'data:image/jpeg;base64,' + Buffer.alloc(4000, 7).toString('base64');
  const r = await post(FORM(await tokOf()), await cookie(), [jpg, 'data:text/html;base64,AAAA']);
  const p = w.patches.find((x) => x.b.edits);
  check('only a JPEG is taken (the other is dropped), counted on the audit line', r.st === 200 && p && p.b.edits[0].docs === 1, p && p.b);
  const src = w.puts.find((x) => x.path.startsWith('Apps/') && x.txt);
  check('the photo is inside the correction page', src && src.txt.includes('data:image/jpeg;base64,') && src.txt.includes('מסמך שנוסף 1 מתוך 1'), src && src.txt.slice(-200));
}

console.log('\n6. the induction mail itself carries the link');
{
  reset();
  const sig = 'iVBORw0KGgo=';
  const out = await fileInduction(ENV, TALK, { ...ROW }, Buffer.from(sig, 'base64'), 'he', Date.parse('2026-11-24T09:00:00Z'), [], [], 0, 0);
  const html = (w.mails[0] && w.mails[0].message.body.content) || '';
  const m = /href="([^"]*op=edit[^"]*)"/.exec(html);
  check('a link to correct, with the HR code and the 14 days said in words', out.mailed && m && html.includes('הסיסמה של משאבי אנוש') && html.includes('14'), html.slice(-700));
  const tok = m ? decodeURIComponent(m[1].replace(/&amp;/g, '&').split('e=')[1]) : '';
  check('the link\'s token is the row\'s', (await readEditToken(ENV, tok)).id === 'r1', tok.slice(0, 30));
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
