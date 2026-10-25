// A PDF to Michael as a WhatsApp document (21/10/2026, _wa.js sendDocToOwner; the signature request sends the
// form first, and the signed copy after "do it"). Meta is mocked: upload to /media, then a document message.
import { sendDocToOwner, DOC_MAX, docMime, DOC_MIME } from './_build/_wa.mjs';

let pass = 0, fail = 0;
const check = (l, c, d) => { if (c) { pass++; console.log('  ✓ ' + l); } else { fail++; console.log('  ✗ ' + l + (d !== undefined ? '  -> ' + JSON.stringify(d).slice(0, 300) : '')); } };
const ENV = { META_PHONE_NUMBER_ID: 'P1', META_ACCESS_TOKEN: 'mt' };
let calls = [], mediaOk = true;
globalThis.fetch = async (u, o = {}) => {
  calls.push({ u, o });
  if (u.endsWith('/P1/media')) return mediaOk ? new Response(JSON.stringify({ id: 'MEDIA1' })) : new Response('{}', { status: 400 });
  if (u.endsWith('/P1/messages')) return new Response(JSON.stringify({ messages: [{ id: 'wamid.D' }] }));
  return new Response('{}', { status: 500 });
};
const pdf = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 1, 2, 3]);

(async () => {
  const r = await sendDocToOwner(ENV, '972501234567', pdf, 'form.pdf', '', true);
  const msg = calls[1] && JSON.parse(calls[1].o.body);
  check('upload first, then a document message to the owner with the media id and the file name', r.ok && calls.length === 2 && calls[0].u.endsWith('/P1/media') && calls[0].o.body instanceof FormData
    && msg.type === 'document' && msg.to === '972501234567' && msg.document.id === 'MEDIA1' && msg.document.filename === 'form.pdf', { r, msg });
  calls = [];
  check('window closed: nothing sent (a document is not a template)', (await sendDocToOwner(ENV, '972501234567', pdf, 'x.pdf', '', false)).ok === false && calls.length === 0);
  check('empty or too large: nothing sent', (await sendDocToOwner(ENV, '9725', new Uint8Array(0), 'x.pdf', '', true)).ok === false && (await sendDocToOwner(ENV, '9725', { length: DOC_MAX + 1 }, 'x.pdf', '', true)).ok === false && calls.length === 0);
  calls = [];
  await sendDocToOwner({ ...ENV, SUPABASE_SERVICE_ROLE_KEY: 'k', SUPABASE_URL: 'https://sb.example' }, '972501234567', pdf, 'f.pdf', '', true);
  const mo = calls.find((c) => /server_state/.test(c.u) && c.o.method === 'POST');
  check('a send that really reaches Meta records wa_meta_out (the watchdog waits for a status only after such a send; 25/10/2026 retro)', !!mo && JSON.parse(mo.o.body)[0].key === 'wa_meta_out' && !!JSON.parse(mo.o.body)[0].value.at, calls.map((c) => c.u));
  calls = [];
  mediaOk = false;
  const f = await sendDocToOwner(ENV, '972501234567', pdf, 'x.pdf', '', true);
  check('a failed upload: no message', f.ok === false && calls.length === 1, { f, calls: calls.length });
  check('docMime: Word and Excel go out as themselves, anything else as PDF', docMime('a.DOCX') === DOC_MIME.docx && docMime('b.xlsx') === DOC_MIME.xlsx && docMime('c.pdf') === DOC_MIME.pdf && docMime('d') === DOC_MIME.pdf);
console.log('\nwa-doc-test: ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
