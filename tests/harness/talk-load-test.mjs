// Fifty workers sign the annual training at the same moment (15/10/2026, Michael: "if fifty workers fill the form
// in parallel, can it get stuck, or not record all the names?"). The real signTalk against a stand-in Supabase that
// is slow (every request 40-400 ms, in random order, as on 15/10 when the free server answered in 600-800 ms under
// load), keeps its rows and files in memory, and refuses a second file of the same name like Storage does.
// Checks: all 50 rows and 50 signature files, every worker gets the thanks page, nobody's name or ID is lost or
// swapped, a worker who presses "sign" twice at once is one row, two workers with the same name and different IDs
// are two rows. Names typed in Arabic or Russian are refused with a clear message (Hebrew letters only, 15/10/2026,
// Michael: "no option at all to write in another language"), and no name goes to the AI.
import { onRequest, makePermToken, talkUrl } from './_build/talk.mjs';
let pass = 0, fail = 0;
const check = (l, c, d) => { if (c) { pass++; console.log('  ✓ ' + l); } else { fail++; console.log('  ✗ ' + l + (d !== undefined ? '  -> ' + JSON.stringify(d).slice(0, 400) : '')); } };
const SB = 'https://znhjtpcltrxxyfjczgvw.supabase.co';
const URL0 = 'https://tapugan-safety.pages.dev/api/talk';
const ENV = { SUPABASE_SERVICE_ROLE_KEY: 'srv', TRUSTEE_NOTIFY_SECRET: 'nsec', GEMINI_API_KEY: 'g' };
const TALK = { id: 'ann-load', d: '2026-10-15', title: 'הדרכת בטיחות שנתית 2026', s: 'פורסמה', kind: 'annual', link_v: 0, subjects: 'כיבוי אש\nעבודה בגובה', trainer: 'מיכאל פרייליך', trainer_signed_at: '2026-10-15T06:00:00Z' };
const db = { reads: [], files: new Set(), requests: 0, maxOpen: 0, open: 0, ai: 0 };
const slow = () => new Promise((r) => setTimeout(r, 40 + Math.floor(Math.random() * 360)));
globalThis.fetch = async (url, init) => {
  const u = decodeURIComponent(String(url)), m = (init && init.method) || 'GET';
  db.requests++; db.open++; db.maxOpen = Math.max(db.maxOpen, db.open);
  try {
    await slow();
    const json = (o, st = 200) => new Response(JSON.stringify(o), { status: st, headers: { 'Content-Type': 'application/json' } });
    if (u.startsWith(SB + '/rest/v1/toolbox_talks')) return json([{ ...TALK }]);
    if (u.startsWith(SB + '/rest/v1/emp')) return json([]);
    if (u.startsWith(SB + '/rest/v1/toolbox_reads')) {
      // the live table has a unique index on (talk_id, emp_id): a second row for the same worker = 409
      if (m === 'POST') { const row = JSON.parse(init.body); if (db.reads.some((x) => x.talk_id === row.talk_id && x.emp_id === row.emp_id)) return json({ code: '23505' }, 409); db.reads.push(row); return new Response(null, { status: 201 }); }
      const like = (u.match(/emp_id=like\.([^&]*)/) || [])[1];
      const rows = db.reads.filter((x) => x.talk_id === TALK.id && (!like || x.emp_id.startsWith(like.replace(/\*$/, ''))));
      return json(rows.map((x) => ({ id: x.id })));
    }
    if (u.startsWith(SB + '/storage/v1/object/')) {
      const name = u.split('/').pop(); const ups = init && init.headers && init.headers['x-upsert'] === 'true';
      if (db.files.has(name) && !ups) return json({ statusCode: '409', error: 'Duplicate' }, 400);
      db.files.add(name); return json({ Key: name });
    }
    if (u.startsWith(SB + '/rest/v1/server_state') || u.startsWith(SB + '/rest/v1/rpc/')) return json([]);
    if (u.startsWith('https://generativelanguage.googleapis.com/')) db.ai++;
    if (u.startsWith('https://generativelanguage.googleapis.com/')) return json({ error: { message: 'rate limit' } }, 429);
    return json({ error: 'unexpected ' + u }, 599);
  } finally { db.open--; }
};
const png = new Uint8Array(1024); png.set([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A], 0);
const SIG = 'data:image/png;base64,' + Buffer.from(png).toString('base64');
let k = new URL(talkUrl(await makePermToken(ENV, TALK.id, 0))).searchParams.get('k');
const sign = async (name, oid) => {
  const fd = new FormData();
  for (const [a, b] of Object.entries({ k, l: 'he', emp: '__other', oname: name, oid, idep: 'אריזה', ok: '1', sig: SIG })) fd.append(a, b);
  const r = await onRequest({ request: new Request(URL0, { method: 'POST', body: fd, headers: { 'user-agent': 'iPhone Mobile', 'cf-connecting-ip': '81.218.1.1' } }), env: ENV });
  return { st: r.status, h: await r.text() };
};
// A valid Israeli ID (check digit) for worker i.
const tz = (i) => { const b = String(100000000 + i * 7919).slice(1, 9); let s = 0; for (let j = 0; j < 8; j++) { let d = +b[j] * (j % 2 ? 2 : 1); if (d > 9) d -= 9; s += d; } return b + ((10 - (s % 10)) % 10); };
// Real-looking names, no digits (a name with a digit is refused, as it should be): 40 in Hebrew, 5 in Arabic, 5 in Russian.
const HE = ['אבי', 'בני', 'גיל', 'דנה', 'הדר', 'ורד', 'זיו', 'חן', 'טל', 'יעל'], HE2 = ['כהן', 'לוי', 'מזרחי', 'פרץ'];
const AR = ['محمد علي', 'أحمد حسن', 'سامر خليل', 'رامي سعيد', 'خالد عمر'], RU = ['Ольга Петрова', 'Иван Смирнов', 'Анна Волкова', 'Сергей Козлов', 'Мария Орлова'];
const NAMES = Array.from({ length: 50 }, (_, i) => (i % 10 === 3 ? AR[(i - 3) / 10] : i % 10 === 7 ? RU[(i - 7) / 10] : HE[i % 10] + ' ' + HE2[Math.floor(i / 10) % 4]));
NAMES[49] = NAMES[1]; // the same name as worker 1, another ID

console.log('\n1. fifty at once, one network address, a slow server');
const t0 = Date.now();
const res = await Promise.all(NAMES.map((n, i) => sign(n, tz(i))));
const took = Date.now() - t0;
const isHe = (n) => /^[\u05d0-\u05ea]/.test(n), HEI = NAMES.map((n, i) => i).filter((i) => isHe(NAMES[i])), FOR = NAMES.map((n, i) => i).filter((i) => !isHe(NAMES[i]));
const ok = HEI.filter((i) => res[i].st === 200 && /תודה/.test(res[i].h)).length;
check('every one of the 40 Hebrew names gets "thanks"', HEI.length === 40 && ok === 40, HEI.filter((i) => res[i].st !== 200).map((i) => [res[i].st, res[i].h.replace(/<[^>]+>/g, ' ').slice(0, 120)]).slice(0, 3));
check('40 rows saved, one per ID, 40 signature files', db.reads.length === 40 && new Set(db.reads.map((x) => x.id_no)).size === 40 && db.files.size === 40, { rows: db.reads.length, files: db.files.size });
check('every Hebrew name\'s ID is on its row with its own signature file', HEI.every((i) => db.reads.some((x) => x.id_no === tz(i) && x.emp_name === NAMES[i] && x.sig_url.endsWith('.png'))));
check('two workers with the same name and different IDs: both rows', [tz(1), tz(49)].every((id) => db.reads.some((x) => x.id_no === id && x.emp_name === NAMES[1])));
check('names typed in Arabic and Russian: refused (422) with "Hebrew letters only", nothing saved', FOR.length === 10 && FOR.every((i) => res[i].st === 422 && /באותיות עבריות בלבד/.test(res[i].h)) && !db.reads.some((x) => FOR.some((i) => x.id_no === tz(i))), FOR.map((i) => res[i].st));
check('no name goes to the AI (no wait, no rate limit)', db.ai === 0, db.ai);
console.log('    (' + db.requests + ' requests, at most ' + db.maxOpen + ' open at once, ' + (took / 1000).toFixed(1) + ' s for all 50)');
check('all 50 done within 20 seconds on a slow server', took < 20000, took);

console.log('\n2. the same worker presses "sign" twice at the same moment');
const before = db.reads.length;
const twice = await Promise.all([sign('כפול', tz(77)), sign('כפול', tz(77))]);
check('one row, and both presses end on a thanks page', db.reads.length === before + 1 && twice.every((x) => x.st === 200 && /תודה/.test(x.h)), { added: db.reads.length - before, st: twice.map((x) => x.st) });

console.log('\n3. the page itself: Hebrew-only field, a typed department in Hebrew only');
const pg = await (await onRequest({ request: new Request(URL0 + '?k=' + encodeURIComponent(k), { headers: { 'user-agent': 'iPhone Mobile' } }), env: ENV })).text();
const pat = (pg.match(/id="oname"[^>]*pattern="([^"]*)"/) || [])[1];
const re = pat && new RegExp('^(?:' + pat.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&') + ')$', 'v');
check('the name field accepts Hebrew only (the browser stops Arabic, Russian, digits before sending)', !!re && ['אבי כהן', "ג'ורג' בן-דוד", 'דנה '].every((t) => re.test(t)) && ['محمد علي', 'Иван', 'Avi', 'אבי1'].every((t) => !re.test(t)), pat);
check('the page says so under the field', /id="heonly"[^>]*>את השם כותבים באותיות עבריות בלבד/.test(pg));
check('the "other" department field has the same rule', /id="idepo"[^>]*pattern="/.test(pg));
const dep = async (d) => { const fd = new FormData(); for (const [a, b] of Object.entries({ k, l: 'he', emp: '__other', oname: 'רון לוי', oid: tz(88), idep: 'אחר', idepo: d, ok: '1', sig: SIG })) fd.append(a, b); const r = await onRequest({ request: new Request(URL0, { method: 'POST', body: fd, headers: { 'user-agent': 'iPhone Mobile', 'cf-connecting-ip': '81.218.1.1' } }), env: ENV }); return r.status; };
check('a department typed in English is refused, in Hebrew it is kept', (await dep('Logistics')) === 422 && (await dep('לוגיסטיקה')) === 200 && db.reads.some((x) => x.id_no === tz(88)));

console.log('\n4. the quality training: the same rule (15/10/2026, Michael: "everything I say applies to the quality training too")');
TALK.kind = 'quality'; TALK.id = 'qa-load'; k = new URL(talkUrl(await makePermToken(ENV, TALK.id, 0))).searchParams.get('k');
const qa = await Promise.all([sign('Иван Смирнов', tz(90)), sign('שרה כהן', tz(91))]);
check('quality: a Russian name is refused with "Hebrew letters only", a Hebrew name is saved', qa[0].st === 422 && /באותיות עבריות בלבד/.test(qa[0].h) && qa[1].st === 200 && db.reads.some((x) => x.talk_id === 'qa-load' && x.emp_name === 'שרה כהן') && !db.reads.some((x) => x.id_no === tz(90)), qa.map((x) => x.st));

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
