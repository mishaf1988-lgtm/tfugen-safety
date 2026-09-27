// Photos in the trustee log (27/09): open findings and the last 90 days get a
// thumbnail in the file, every photo cell links to a signed URL (the bucket is
// private, the stored /object/public/ URL does not open), and a failed photo is
// a row without a picture, never a failed log. Storage is mocked.
// Writes the file to _build/ so it can be opened (LibreOffice/Excel) by hand.
import fs from 'fs';
import { buildAoa, attachPhotos, storagePath, HEADER } from './_build/trustee-log.mjs';
import { buildXlsx, imageInfo } from './_build/_xlsx.mjs';

let pass = 0, fail = 0;
const check = (l, c, d) => { if (c) { pass++; console.log('  ✓ ' + l); } else { fail++; console.log('  ✗ ' + l + (d !== undefined ? '  -> ' + JSON.stringify(d) : '')); } };
const SB = 'https://znhjtpcltrxxyfjczgvw.supabase.co';
const JPG = new Uint8Array(Buffer.from('/9j/4AAQSkZJRgABAQAAAQABAAD/4gHYSUNDX1BST0ZJTEUAAQEAAAHIAAAAAAQwAABtbnRyUkdCIFhZWiAH4AABAAEAAAAAAABhY3NwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAA9tYAAQAAAADTLQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAlkZXNjAAAA8AAAACRyWFlaAAABFAAAABRnWFlaAAABKAAAABRiWFlaAAABPAAAABR3dHB0AAABUAAAABRyVFJDAAABZAAAAChnVFJDAAABZAAAAChiVFJDAAABZAAAAChjcHJ0AAABjAAAADxtbHVjAAAAAAAAAAEAAAAMZW5VUwAAAAgAAAAcAHMAUgBHAEJYWVogAAAAAAAAb6IAADj1AAADkFhZWiAAAAAAAABimQAAt4UAABjaWFlaIAAAAAAAACSgAAAPhAAAts9YWVogAAAAAAAA9tYAAQAAAADTLXBhcmEAAAAAAAQAAAACZmYAAPKnAAANWQAAE9AAAApbAAAAAAAAAABtbHVjAAAAAAAAAAEAAAAMZW5VUwAAACAAAAAcAEcAbwBvAGcAbABlACAASQBuAGMALgAgADIAMAAxADb/2wBDABALDA4MChAODQ4SERATGCgaGBYWGDEjJR0oOjM9PDkzODdASFxOQERXRTc4UG1RV19iZ2hnPk1xeXBkeFxlZ2P/2wBDARESEhgVGC8aGi9jQjhCY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2P/wAARCAAeACgDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAX/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFgEBAQEAAAAAAAAAAAAAAAAAAAMG/8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAwDAQACEQMRAD8AmgItaAAAAAAAAAA//9k=', 'base64'));
const pub = (n) => SB + '/storage/v1/object/public/incidents-photos/' + n;
const now = Date.parse('2026-09-27T12:00:00Z'), day = 86400000, iso = (d) => new Date(now - d * day).toISOString();

const calls = { sign: 0, get: [] };
let brokenGet = 'bad.jpg';
globalThis.fetch = async (url, init) => {
  url = String(url);
  if (url === SB + '/storage/v1/object/sign/incidents-photos') {
    calls.sign++;
    const b = JSON.parse(init.body);
    calls.signBody = b;
    return new Response(JSON.stringify(b.paths.map((p) => ({ path: p, signedURL: '/object/sign/incidents-photos/' + p + '?token=T' + p, error: null }))), { status: 200 });
  }
  if (url.startsWith(SB + '/storage/v1/render/image/authenticated/')) { calls.render = (calls.render || 0) + 1; return new Response('no transforms', { status: 400 }); }
  if (url.startsWith(SB + '/storage/v1/object/authenticated/incidents-photos/')) {
    const n = url.split('/').pop();
    calls.get.push(n);
    if (n === brokenGet) return new Response('x', { status: 404 });
    if (n === 'notimg.jpg') return new Response('hello world, not a picture at all', { status: 200 });
    return new Response(JPG, { status: 200 });
  }
  throw new Error('unexpected fetch ' + url);
};
const env = { SUPABASE_SERVICE_ROLE_KEY: 'svc' };

const reports = [
  { id: 'open_old', u: 'a', t: 1, d: iso(200).slice(0, 10), ts: iso(200), ok: false, s: 'פתוח', f: 'ישן פתוח', photo_url: pub('open_old.jpg') },
  { id: 'closed_old', u: 'a', t: 1, d: iso(200).slice(0, 10), ts: iso(200), ok: false, s: 'נסגר', f: 'ישן סגור', photo_url: pub('closed_old.jpg') },
  { id: 'recent_ok', u: 'b', t: 2, d: iso(5).slice(0, 10), ts: iso(5), ok: true, s: 'תקין', photo_url: pub('recent_ok.jpg') },
  { id: 'bad', u: 'b', t: 2, d: iso(3).slice(0, 10), ts: iso(3), ok: false, s: 'פתוח', f: 'תמונה שבורה', photo_url: pub('bad.jpg') },
  { id: 'notimg', u: 'b', t: 2, d: iso(2).slice(0, 10), ts: iso(2), ok: false, s: 'פתוח', f: 'לא תמונה', photo_url: pub('notimg.jpg') },
  { id: 'foreign', u: 'c', t: 3, d: iso(1).slice(0, 10), ts: iso(1), ok: false, s: 'פתוח', f: 'קישור זר', photo_url: 'https://evil.example/x.jpg' },
  { id: 'nophoto', u: 'c', t: 3, d: iso(1).slice(0, 10), ts: iso(1), ok: true, s: 'תקין' },
];

console.log('\n1. which rows get what');
const PC = HEADER.indexOf('תמונה');
const aoa = buildAoa(reports, [], [], now);
const images = await attachPhotos(env, aoa, reports, now);
const rowOf = (id) => aoa.findIndex((r) => r[r.length - 1] === id);
const embedded = new Set(images.map((i) => aoa[i.row][aoa[i.row].length - 1]));
check('open finding older than 90 days: embedded', embedded.has('open_old'), [...embedded]);
check('recent clean report: embedded', embedded.has('recent_ok'));
check('closed finding older than 90 days: not embedded', !embedded.has('closed_old'));
check('404 photo: skipped, no throw', !embedded.has('bad'));
check('non-image bytes: skipped', !embedded.has('notimg'));
check('foreign URL: never fetched, never signed', !calls.get.some((n) => n === 'x.jpg') && calls.signBody.paths.indexOf('x.jpg') < 0);
check('foreign URL cell left as text', aoa[rowOf('foreign')][PC] === 'https://evil.example/x.jpg');
check('one sign call for all photos, 1-year expiry', calls.sign === 1 && calls.signBody.expiresIn === 365 * 86400, calls.signBody);
const cell = aoa[rowOf('closed_old')][PC];
check('photo cell becomes a signed link', cell && cell.link === SB + '/storage/v1/object/sign/incidents-photos/closed_old.jpg?token=Tclosed_old.jpg', cell);
check('image row/col point at the photo cell', images.every((i) => i.col === PC && aoa[i.row][PC] && aoa[i.row][PC].link));

check('no transforms: asked once, then originals', calls.render === 1, calls.render);
check('open findings fetched before newer closed ones', calls.get[0] === 'bad.jpg' || calls.get[0] === 'notimg.jpg' || calls.get[0] === 'open_old.jpg', calls.get);
{
  // With transforms, and a budget of 15: 20 open findings -> 15 thumbnails.
  const many = []; for (let i = 0; i < 20; i++) many.push({ id: 'm' + i, u: 'a', t: 1, d: iso(i).slice(0, 10), ts: iso(i), ok: false, s: 'פתוח', f: 'x', photo_url: pub('m' + i + '.jpg') });
  const saved = globalThis.fetch; let renders = 0, gets = 0;
  globalThis.fetch = async (url, init) => {
    url = String(url);
    if (url.indexOf('/render/image/authenticated/') > 0) { renders++; return new Response(JPG, { status: 200 }); }
    if (url.indexOf('/object/authenticated/') > 0) { gets++; return new Response(JPG, { status: 200 }); }
    return saved(url, init);
  };
  const a2 = buildAoa(many, [], [], now);
  const im2 = await attachPhotos(env, a2, many, now);
  globalThis.fetch = saved;
  check('capped at 15 images, thumbnails used, no originals', im2.length === 15 && renders === 15 && gets === 0, { n: im2.length, renders, gets });
}

console.log('\n2. storagePath');
check('public URL parsed', JSON.stringify(storagePath(pub('a/b.jpg'), SB)) === JSON.stringify({ bucket: 'incidents-photos', path: 'a/b.jpg' }));
check('other host refused', storagePath('https://x.supabase.co/storage/v1/object/public/b/c.jpg', SB) === null);
check('imageInfo reads JPEG size', JSON.stringify(imageInfo(JPG)) === JSON.stringify({ ext: 'jpeg', h: 30, w: 40 }), imageInfo(JPG));

console.log('\n3. the file');
const x = buildXlsx(aoa, 'דיווחי נאמנים', null, images);
const txt = Buffer.from(x).toString('latin1');
check('drawing part + rels', txt.indexOf('xl/drawings/drawing1.xml') >= 0 && txt.indexOf('xl/drawings/_rels/drawing1.xml.rels') >= 0);
check('one media file per image', (txt.match(/xl\/media\/image\d+\.jpeg/g) || []).length === images.length * 2, images.length);
check('content types for jpeg + drawing', txt.indexOf('Extension="jpeg"') >= 0 && txt.indexOf('drawing+xml') >= 0);
check('hyperlinks written as external rels', txt.indexOf('TargetMode="External"') >= 0 && txt.indexOf('<hyperlinks>') >= 0);
check('link cells use the Hyperlink style (blue, underlined)', (txt.match(/<c r="N\d+" s="2" t="inlineStr">/g) || []).length === 5 && txt.indexOf('builtinId="8"') >= 0 && txt.indexOf('<u/>') >= 0);
check('image rows are tall', (txt.match(/customHeight="1"/g) || []).length === images.length);
const plain = Buffer.from(buildXlsx(aoa.map((r) => r.map((v) => (v && typeof v === 'object' ? v.text : v))), 'x')).toString('latin1');
check('no images = no drawing part (old file shape)', plain.indexOf('drawing') < 0 && plain.indexOf('hyperlink') < 0);
fs.writeFileSync(new URL('./_build/trustee-log-photos.xlsx', import.meta.url), x);

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
