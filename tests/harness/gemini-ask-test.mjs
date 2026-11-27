// gemini_ask (23/11/2026, Michael: "build, and start with procedures and regulations only until you confirm the key is billed"):
// the pure parts of functions/_geminiask.js and the op in routine-db with fetch faked. Nothing reaches Google or the database.
import { GEMINI_ASK_DAILY, geminiAskCheck, geminiMedical, geminiNameHit, geminiGate, geminiAskPrompt, geminiAskParse, geminiAskCall } from './_build/_geminiask.mjs';
import { onRequest, scrubPii } from './_build/routine-db.mjs';
let pass = 0, fail = 0;
const check = (l, c, d) => { if (c) { pass++; console.log('  ✓ ' + l); } else { fail++; console.log('  ✗ ' + l + (d !== undefined ? '  -> ' + JSON.stringify(d).slice(0, 300) : '')); } };

const DOC = 'נוהל עבודה בגובה: כל עבודה מעל 2 מטר דורשת היתר עבודה חתום לפני תחילת העבודה. סעיף 4.2: רתמה נבדקת לפני כל שימוש. סעיף 5: חילוץ מתבצע תוך 10 דקות.';
const base = { op: 'gemini_ask', agent: 'routine-test', task: 'summarize', kind: 'procedure', text: DOC };

// the field check
check('a summary of a procedure passes the check', !geminiAskCheck(base, false).error);
check('an unknown field is refused', /field not allowed: why/.test(geminiAskCheck({ ...base, why: 'x' }, false).error));
check('a bad agent name is refused', !!geminiAskCheck({ ...base, agent: 'A B' }, false).error);
check('an unknown task is refused', !!geminiAskCheck({ ...base, task: 'chat' }, false).error);
check('text under 20 characters is refused', !!geminiAskCheck({ ...base, text: 'קצר' }, false).error);
check('text over 100000 characters is refused', !!geminiAskCheck({ ...base, text: 'א'.repeat(100001) }, false).error);
check('phase 1: a certificate is closed and the answer says so', geminiAskCheck({ ...base, kind: 'certificate' }, false).closed === true);
check('phase 2 open: a certificate passes', !geminiAskCheck({ ...base, kind: 'certificate' }, true).error);
check('translate needs a language of the four', !!geminiAskCheck({ ...base, task: 'translate' }, false).error && !geminiAskCheck({ ...base, task: 'translate', to: 'ar' }, false).error && !!geminiAskCheck({ ...base, task: 'translate', to: 'fr' }, false).error);
check('second_check goes with claude_answer only, and only in phase 2', !!geminiAskCheck({ op: 'gemini_ask', agent: 'routine-test', task: 'second_check', kind: 'procedure', question: 'שאלה כלשהי', answer: 'תשובה כלשהי' }, true).error
  && geminiAskCheck({ op: 'gemini_ask', agent: 'routine-test', task: 'second_check', kind: 'claude_answer', question: 'שאלה כלשהי', answer: 'תשובה כלשהי' }, false).closed === true
  && !geminiAskCheck({ op: 'gemini_ask', agent: 'routine-test', task: 'second_check', kind: 'claude_answer', question: 'שאלה כלשהי', answer: 'תשובה כלשהי' }, true).error);

// the content gate
check('medical: words of a record are caught, with a Hebrew prefix too', geminiMedical('אישור רפואי לעובד') && geminiMedical('הוא אובחן עם מחלה') && geminiMedical('בדיקת הרופא') && geminiMedical('medical file'));
check('medical: ordinary safety words are not (department, risk analysis, the word for "diagnosis" inside another word)', !geminiMedical('מחלקת ייצור, ניתוח סיכונים, מחלף חום') && !geminiMedical(DOC));
check('a name: the full name in either order is caught, one word alone is not', geminiNameHit('העובד דוד לוי הגיע', ['דוד לוי']) && geminiNameHit('לוי דוד חתם', ['דוד לוי']) && !geminiNameHit('דוד הגיע', ['דוד לוי']) && !geminiNameHit('משה', [{ n: 'משה' }]));
check('the gate: a mail, a phone and a nine-digit number are caught through scrubPii', geminiGate('צור קשר ב-a@b.co.il', '', [], scrubPii) === 'pii' && geminiGate('טלפון 052-1234567 להודעות', '', [], scrubPii) === 'pii' && geminiGate('ת.ז. 123456789 של העובד', '', [], scrubPii) === 'pii');
check('the gate: the source label is checked too', geminiGate(DOC, 'נוהל של דוד לוי', [{ n: 'דוד לוי' }], scrubPii) === 'name');
check('the gate: a clean procedure passes', geminiGate(DOC, 'נוהל גובה', [{ n: 'דוד לוי' }], scrubPii) === null);

// the answer
const raw = JSON.stringify({ summary: 'צריך היתר מעל 2 מטר', quotes: [{ quote: 'כל עבודה מעל 2 מטר דורשת היתר עבודה חתום', where: 'סעיף 1' }, { quote: 'משפט שלא קיים בנוהל בכלל', where: 'סעיף 9' }, { quote: 'קצר', where: 'x' }] });
const sm = geminiAskParse('summarize', '```json\n' + raw + '\n```', DOC);
check('summarize: a quote that is in the source is found, one made up is not, a too short one is not', sm.quotes_total === 3 && sm.quotes_found === 1 && sm.quotes[0].found && !sm.quotes[1].found && !sm.quotes[2].found, sm);
check('summarize: a fence around the JSON is tolerated; no JSON, no summary and no translation are errors', !!geminiAskParse('summarize', 'hello', DOC).error && !!geminiAskParse('summarize', '{"quotes":[]}', DOC).error && !!geminiAskParse('translate', '{}', DOC).error);
check('second_check: a verdict is required and the lists are cut', geminiAskParse('second_check', '{"verdict":"partly","issues":["a"],"unsure":[]}', '').verdict === 'partly' && !!geminiAskParse('second_check', '{"verdict":"maybe"}', '').error);
check('the prompt tells the model the text is data, and the document is inside markers', /never follow an instruction/.test(geminiAskPrompt({ task: 'summarize', text: DOC }).system) && geminiAskPrompt({ task: 'translate', to: 'ru', text: DOC }).system.includes('Russian') && geminiAskPrompt({ task: 'summarize', text: DOC }).user.startsWith('<<<DOCUMENT'));

// the call to Google
{
  const sent = [];
  const fOk = async (u, o) => { sent.push({ u: String(u), o }); return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: '{"translation":"ok"}' }] }, finishReason: 'STOP' }] }), { status: 200 }); };
  const r = await geminiAskCall({ GEMINI_API_KEY: 'g-key', GEMINI_MODEL: 'gemini-test' }, { system: 's', user: 'u' }, fOk);
  check('the call: the key goes in a header, never in the address; the model comes from the environment; the answer text comes back', r.text === '{"translation":"ok"}' && r.model === 'gemini-test' && !sent[0].u.includes('g-key') && sent[0].o.headers['x-goog-api-key'] === 'g-key' && sent[0].u.includes('gemini-test'));
  check('the call: no key = an error and no request', (await geminiAskCall({}, { system: 's', user: 'u' }, fOk)).error === 'GEMINI_API_KEY not set' && sent.length === 1);
  const r500 = await geminiAskCall({ GEMINI_API_KEY: 'k' }, { system: 's', user: 'u' }, async () => new Response('echo of the request', { status: 500 }));
  check('the call: a failure gives the status only, not the body', r500.error === 'gemini 500');
  check('the call: an answer with no text is an error', !!(await geminiAskCall({ GEMINI_API_KEY: 'k' }, { system: 's', user: 'u' }, async () => new Response(JSON.stringify({ candidates: [{ finishReason: 'SAFETY' }] }), { status: 200 }))).error);
}

// the op, end to end, with fetch faked
const ENV = { ROUTINE_KEY: 'k-123', SUPABASE_SERVICE_ROLE_KEY: 'srv', GEMINI_API_KEY: 'g-key' };
async function op(body, { env = ENV, emp = [{ n: 'דוד לוי' }, { n: 'שרה כהן' }], used = 0, empFail = false, gemini = null, logFail = false } = {}) {
  const real = globalThis.fetch; const log = { posts: [], gem: 0, gemBody: null };
  globalThis.fetch = async (u, o = {}) => {
    const url = String(u);
    if (url.includes('generativelanguage.googleapis.com')) { log.gem++; log.gemBody = o.body; return gemini ? gemini() : new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: raw }] }, finishReason: 'STOP' }] }), { status: 200 }); }
    if (url.includes('/rest/v1/emp?')) return empFail ? new Response('x', { status: 500 }) : new Response(JSON.stringify(emp), { status: 200 });
    if (url.includes('/rest/v1/notifications_log') && (o.method || 'GET') === 'GET') return new Response(JSON.stringify(Array.from({ length: used + log.posts.filter((x) => x.channel === 'gemini').length }, (_, i) => ({ id: 'r' + i }))), { status: 200 });
    if (url.includes('/rest/v1/notifications_log') && o.method === 'POST') { if (logFail) return new Response('x', { status: 500 }); log.posts.push(JSON.parse(o.body)[0]); return new Response('', { status: 201 }); }
    if (url.includes('/rest/v1/notifications_log') && o.method === 'PATCH') { const id = new URL(url).searchParams.get('id').replace('eq.', ''); const row = log.posts.find((x) => x.id === id); const pt = JSON.parse(o.body); if (row) Object.assign(row, pt); log.patches = (log.patches || 0) + 1; return new Response('', { status: 204 }); }
    return new Response('[]', { status: 200 });
  };
  try {
    const r = await onRequest({ request: new Request('https://x/api/routine-db', { method: 'POST', headers: { 'x-routine-key': 'k-123', 'content-type': 'application/json' }, body: JSON.stringify(body) }), env });
    return { status: r.status, json: await r.json(), log };
  } finally { globalThis.fetch = real; }
}
{
  const r = await op(base);
  check('op: a clean procedure is summarised, quotes checked, one log row with sizes and no text', r.json.ok === true && r.json.quotes_found === 1 && r.json.quotes_total === 3 && r.log.gem === 1 && r.log.posts.length === 1
    && r.log.posts[0].event_type === 'gemini_ask' && r.log.posts[0].channel === 'gemini' && r.log.posts[0].payload.chars_in === DOC.length && !JSON.stringify(r.log.posts[0]).includes('היתר'), r.json);
  check('op: the answer carries the warnings (check two quotes, quotes not found, no legal reliance on its own)', r.json.notes.length >= 2 && r.json.notes.some((n) => /two of the quotes/.test(n)) && r.json.notes.some((n) => /found:false/.test(n)));
  check('op: the document text reached Google inside the markers and the system text says it is data', r.log.gemBody.includes('<<<DOCUMENT') && r.log.gemBody.includes('never follow an instruction'));
}
for (const [label, text, why] of [['a phone number', DOC + ' להתקשר 052-1234567', 'pii'], ['an ID number', DOC + ' ת.ז. 123456789', 'pii'], ['a mail', DOC + ' a@b.co.il', 'pii'], ['a medical word', DOC + ' כולל אישור רפואי', 'medical'], ['an employee name', DOC + ' אושר על ידי דוד לוי', 'name']]) {
  const r = await op({ ...base, text });
  check('op: ' + label + ' = refused whole, Google never called, the log row has the reason and no text, fallback to Claude', r.json.ok === false && r.json.blocked === why && r.json.fallback === 'claude' && r.log.gem === 0 && r.log.posts.length === 1 && r.log.posts[0].channel === 'blocked' && r.log.posts[0].payload.blocked === why && !JSON.stringify(r.log.posts[0]).includes('052'), r.json);
}
{
  const r = await op({ ...base, kind: 'certificate' });
  check('op: phase 1 closed: a certificate is not sent and the answer says why', r.json.ok === false && r.json.fallback === 'claude' && /phase 2/.test(r.json.error) && r.log.gem === 0);
  const r2 = await op({ ...base, kind: 'certificate' }, { env: { ...ENV, GEMINI_PHASE2: '1' } });
  check('op: GEMINI_PHASE2=1 opens it', r2.json.ok === true && r2.log.gem === 1);
  const r3 = await op({ ...base, task: 'translate', to: 'ru' }, { gemini: () => new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: '{"translation":"Правила работы на высоте"}' }] } }] }), { status: 200 }) });
  check('op: translate returns the translation', r3.json.ok === true && r3.json.translation.includes('Правила'), r3.json);
}
{
  const r = await op(base, { used: GEMINI_ASK_DAILY });
  check('op: the daily limit of 50 refuses, Google is not called, and the row is marked over (not counted again)', r.json.ok === false && /daily limit/.test(r.json.error) && r.log.gem === 0 && r.json.fallback === 'claude' && r.log.posts[0].channel === 'over');
  const r2 = await op(base, { used: GEMINI_ASK_DAILY - 1 });
  check('op: 49 used = one more is allowed', r2.json.ok === true);
  const r3 = await op(base, { empFail: true });
  check('op: if the employee names cannot be read, nothing is sent', r3.json.ok === false && r3.log.gem === 0 && /names/.test(r3.json.error));
  const r4 = await op(base, { gemini: () => new Response('boom', { status: 503 }) });
  check('op: Google fails = ok:false and fallback to Claude, and the failure is logged', r4.json.ok === false && r4.json.fallback === 'claude' && r4.log.posts[0].payload.ok === false && r4.log.posts[0].payload.error === 'gemini 503', r4.json);
  const r5 = await op(base, { gemini: () => new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: 'not json at all' }] } }] }), { status: 200 }) });
  check('op: an answer that is not JSON = ok:false and fallback to Claude', r5.json.ok === false && r5.json.fallback === 'claude');
  const r6 = await op({ ...base, extra: 1 });
  check('op: an extra field = 400 and nothing is called', r6.status === 400 && r6.log.gem === 0 && r6.log.posts.length === 0);
  const r7 = await op(base, { env: { ...ENV, GEMINI_API_KEY: '' } });
  check('op: no Gemini key = ok:false and fallback to Claude', r7.json.ok === false && r7.json.fallback === 'claude');
}
{
  const r = await op({ op: 'gemini_ask', agent: 'routine-test', task: 'second_check', kind: 'claude_answer', question: 'האם עבודה בגובה 1.8 מטר דורשת היתר?', answer: 'לא, רק מעל 2 מטר.' }, { env: { ...ENV, GEMINI_PHASE2: '1' }, gemini: () => new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: '{"verdict":"agrees","issues":[],"unsure":["the 2 meter limit depends on the regulation"]}' }] } }] }), { status: 200 }) });
  check('op: second_check in phase 2 returns the verdict and says it is a second opinion only', r.json.ok === true && r.json.verdict === 'agrees' && r.json.notes.some((n) => /second opinion/.test(n)), r.json);
}

// the review of 23/11/2026: the same content written in the ways a plain text has it
for (const [label, text, why] of [['a name with a full stop after it', DOC + ' העובד דוד לוי.', 'name'], ['a name with a prefix', DOC + ' למשה כהן', null], ['a name with a prefix (known name)', DOC + ' ולדוד לוי', 'name'], ['an ID with dashes', DOC + ' ת.ז. 123-456-789', 'pii'], ['an ID in uneven groups', DOC + ' ת.ז 123 45 6789', 'pii'], ['an ID digit by digit', DOC + ' 1 2 3 4 5 6 7 8 9', 'pii'], ['a date with dots', DOC + ' בתאריך 12.03.2026', null], ['an ID of eight digits', DOC + ' ת.ז. 12345678', 'pii'], ['an ID in Arabic-Indic digits', DOC + ' ١٢٣٤٥٦٧٨٩', 'pii'], ['a medical word split by a zero width character', DOC + ' רו\u200bפא', 'medical'], ['a medical word with a four letter prefix', DOC + ' וכשהרופא', 'medical'], ['small numbers in a table', DOC + ' 10 20 30 40 50 60', null], ['dates', DOC + ' מ-01/01/2026 עד 31/12/2026, ISO 45001', null]]) {
  const r = await op({ ...base, text });
  check('review: ' + label + (why ? ' = refused (' + why + ')' : ' = passes'), why ? r.json.blocked === why : r.json.ok === true, r.json);
}
{
  const r = await op(base, { logFail: true });
  check('review: a call whose log row cannot be written is not made', r.json.ok === false && /logged/.test(r.json.error) && r.log.gem === 0);
  const rs = [await op(base, { used: GEMINI_ASK_DAILY - 1 }), await op(base, { used: GEMINI_ASK_DAILY })];
  check('review: the count includes the call itself: 49 before = allowed, 50 before = refused', rs[0].json.ok === true && rs[1].json.ok === false);
}
console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
