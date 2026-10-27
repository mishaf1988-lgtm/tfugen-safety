// The server's fast lane (20/10/2026, Michael in the questionnaire: "do it: a fast lane in the server").
// A number 1-4 that answers a hazard alert, and "what is urgent" / "expiries", are answered by wa-hook
// itself by rules; everything else, and anything unclear, still goes to the assistant.
import { ownerInPayload, recentLine, RECENT_MAX, fastRoute, hazardRef, fastHazardText, FAST_BRIEF, rateOf, ownAnswer, rateAdd, RATE_MAX } from './_build/wa-hook.mjs';
import { HAZARD_OPTIONS, hazardAsk, assistantFire, fireUrlOf } from './_build/_wa.mjs';
import { rateAgain } from './_build/chat.mjs';

let pass = 0, fail = 0;
const check = (l, c, d) => { if (c) { pass++; console.log('  ✓ ' + l); } else { fail++; console.log('  ✗ ' + l + (d !== undefined ? '  -> ' + JSON.stringify(d).slice(0, 300) : '')); } };
const ALERT = 'trustee_hazard | X - leak | id r9 | 2026-10-20';
const alertText = hazardAsk('מפגע חדש', 'ליקוי', 'מחסן', 'נזילה', false);
const prevAlert = { text: alertText, ref: 'trustee_hazard r9' };
const m = (text, choice) => ({ text, choice: choice || null });

console.log('\n1. hazard choices');
check('"2" in reply to the alert = hazard choice 2', JSON.stringify(fastRoute(m('2'), ALERT, null)) === JSON.stringify({ kind: 'hazard', src: 'trustee_hazard', id: 'r9', choice: 2 }));
check('a tap on the list ("3. סודר במקום", choice 3) = choice 3', fastRoute(m('3. סודר במקום', 3), ALERT, null).choice === 3);
check('"2" with no reply, right after the alert = choice 2 on that hazard', fastRoute(m('2'), '', prevAlert).id === 'r9');
check('"2" after another question under a hazard ref (not the alert) = to the assistant', fastRoute(m('2'), '', { text: 'מה לעשות?\n1. רכז המסמכים\n2. רכז הדוחות', ref: 'trustee_hazard r9' }) === null);
check('"5" = to the assistant (no such option)', fastRoute(m('5'), ALERT, null) === null);
check('"2 אבל קודם תבדוק עם שלומי מה קרה שם אתמול בערב" (long) = to the assistant', fastRoute(m('2 אבל קודם תבדוק עם שלומי מה קרה שם אתמול בערב'), ALERT, null) === null);
check('"2" in reply to some other message = not a hazard', fastRoute(m('2'), 'assistant | something | 2026', prevAlert) === null);
check('near miss alerts too', hazardRef('near_miss | y | id n1 | t', null).src === 'near_miss');
check('the answer names the choice; choice 1 says Michael routes it', /אני מטפל\.$/.test(fastHazardText(2, true)) && /מנהל המחלקה אתה עושה/.test(fastHazardText(1, true)) && /כבר היה רשום/.test(fastHazardText(3, false)));

console.log('\n2. the brief');
['מה דחוף?', 'דחוף', 'תפוגות', '1. מה דחוף', '3. תפוגות', 'מה פג'].forEach((w) => check('"' + w + '" = the brief', fastRoute(m(w), '', null) && fastRoute(m(w), '', null).kind === 'brief'));
['מה המצב?', '2. מה מחכה לי', 'תעביר לרכז המסמכים', 'בצע', 'כן'].forEach((w) => check('"' + w + '" = to the assistant', fastRoute(m(w), '', null) === null));
check('the four hazard options are what the alert lists', HAZARD_OPTIONS.every((o) => alertText.indexOf(o) >= 0));
check('the brief words are a closed list', FAST_BRIEF.test('דחוף') && !FAST_BRIEF.test('לא דחוף'));
check('the brief, in his words too (26/10/2026): "יש משהו דחוף", "מה דחוף היום", "מה פג עכשיו"; still not a longer or different question', FAST_BRIEF.test('יש משהו דחוף') && FAST_BRIEF.test('מה דחוף היום') && FAST_BRIEF.test('מה פג עכשיו') && !FAST_BRIEF.test('מה דחוף בנושא הגז') && !FAST_BRIEF.test('אילו תפוגות יש לנו בחודש הקרוב'));

console.log('\n3. which Routine the server wakes (the lean session, 20/10/2026)');
const O = { ASSISTANT_FIRE_URL: 'u1', ASSISTANT_FIRE_TOKEN: 't1' };
check('only the old pair: the old one', assistantFire(O).which === 'old' && assistantFire(O).url === 'u1');
check('the new URL alone (token not added yet): still the old one', assistantFire({ ...O, ASSISTANT2_FIRE_URL: 'u2' }).which === 'old');
check('both new: the new one, URL and token together', JSON.stringify(assistantFire({ ...O, ASSISTANT2_FIRE_URL: 'u2', ASSISTANT2_FIRE_TOKEN: 't2' })) === JSON.stringify({ url: 'u2', token: 't2', which: 'new' }));
check('nothing set: none', assistantFire({}) === null);
check('a probe URL only from a trigger id (lesson 133)', fireUrlOf('trig_011XSXRjssx2uPNu1rk4P9L2') === 'https://api.anthropic.com/v1/claude_code/routines/trig_011XSXRjssx2uPNu1rk4P9L2/fire' && fireUrlOf('https://evil/x') === null && fireUrlOf('trig_../../x') === null);

console.log('\n4. rating a professional answer (21/10/2026, Michael: "do it: accurate / not accurate buttons")');
const pro = { text: 'answer about lifting gear, section 75', ref: 'pro' };
check('the "accurate" button on a professional answer: answered by the server', JSON.stringify(fastRoute(m('1. \u05de\u05d3\u05d5\u05d9\u05e7', 1), '', pro)) === '{"kind":"rate"}');
check('typed "accurate" works too', rateOf(m('\u05de\u05d3\u05d5\u05d9\u05e7'), '', pro).good === true);
check('"not accurate": noted, but goes on to the assistant', rateOf(m('2. \u05dc\u05d0 \u05de\u05d3\u05d5\u05d9\u05e7', 2), '', pro).good === false && fastRoute(m('2. \u05dc\u05d0 \u05de\u05d3\u05d5\u05d9\u05e7', 2), '', pro) === null);
check('not after another kind of message (a hazard alert, a question)', rateOf(m('1', 1), '', prevAlert) === null && rateOf(m('\u05de\u05d3\u05d5\u05d9\u05e7'), '', { text: 'x', ref: 'brief' }) === null && rateOf(m('\u05de\u05d3\u05d5\u05d9\u05e7'), ALERT, pro) === null);
check('a hazard "1" still goes to the hazard, not to the rating', fastRoute(m('1', 1), '', prevAlert).kind === 'hazard');
check('a tap carries the answer as its context ("assistant | ..."): still a rating (21/10/2026, Michael\'s real tap)', rateOf(m('1. \u05de\u05d3\u05d5\u05d9\u05e7', 1), 'assistant | answer | ref pro | 2026-10-21', pro).good === true && JSON.stringify(fastRoute(m('1. \u05de\u05d3\u05d5\u05d9\u05e7', 1), 'assistant | answer | ref pro | 2026-10-21', pro)) === '{"kind":"rate"}');
check('a tap on an older professional answer is rated even when something else went out after it', rateOf(m('1. \u05de\u05d3\u05d5\u05d9\u05e7', 1), 'assistant | answer | ref pro | t', { text: 'done: x', ref: 'dev' }).good === true);
check('a tap on a non-professional message of the assistant: not a rating', rateOf(m('1', 1), 'assistant | a question | ref none | t', pro) === null);
check('an answer logged before the ref was kept: the last answer decides', rateOf(m('1. \u05de\u05d3\u05d5\u05d9\u05e7', 1), 'assistant | answer | t', pro).good === true && rateOf(m('1', 1), 'assistant | answer | t', { text: 'x', ref: 'dev' }) === null);
// 25/10/2026 (dev request: three taps on "1. accurate" in the chat ran the assistant twice): after the thanks
const thanks = { text: 'x', ref: 'rate' };
check('a tap on "accurate" again after the thanks: quiet, not a rating and not a run', rateOf(m('1. \u05de\u05d3\u05d5\u05d9\u05e7', 1), null, thanks) === null && rateAgain(m('1. \u05de\u05d3\u05d5\u05d9\u05e7', 1), thanks) === true && rateAgain(m('\u05de\u05d3\u05d5\u05d9\u05e7'), thanks) === true);
check('"not accurate" after the thanks still goes on, and "accurate" after anything else is not quiet', rateAgain(m('2. \u05dc\u05d0 \u05de\u05d3\u05d5\u05d9\u05e7', 2), thanks) === false && rateAgain(m('1', 1), pro) === false && rateAgain(m('1', 1), { text: 'x', ref: 'brief' }) === false && rateAgain(m('1', 1), null) === false);
const rl = rateAdd(JSON.stringify(Array.from({ length: RATE_MAX }, () => ({ good: true }))), false, 'q '.repeat(300), '2026-10-21T08:00:00Z');
check('ratings: the newest kept, at most ' + RATE_MAX + ', question cut to 200', rl.length === RATE_MAX && rl[rl.length - 1].good === false && rl[rl.length - 1].q.length === 200);
// 25/10/2026: five taps in nine seconds on one answer were two ratings; the same answer again replaces its rating
const r1 = rateAdd('[]', true, 'answer A', '2026-10-25T08:06:50Z'), r2 = rateAdd(JSON.stringify(r1), true, 'answer A', '2026-10-25T08:06:51Z'), r3 = rateAdd(JSON.stringify(r2), false, 'answer A', '2026-10-25T08:06:57Z');
check('ratings: one per answer, the last tap wins', r2.length === 1 && r3.length === 1 && r3[0].good === false && r3[0].at === '2026-10-25T08:06:57Z', r3);
{ const s1 = rateAdd('[]', true, 'מתחיל', '2026-10-26T08:00:05Z', '2026-10-26T08:00:00Z'), s2 = rateAdd(JSON.stringify(s1), false, 'מתחיל', '2026-10-26T09:00:05Z', '2026-10-26T09:00:00Z'), s3 = rateAdd(JSON.stringify(s2), true, 'מתחיל', '2026-10-26T09:00:09Z', '2026-10-26T09:00:00Z');
  check('ratings: two answers with the same short text keep two ratings; a second tap on the same answer replaces (26/10/2026 retro)', s2.length === 2 && s2[0].good === true && s2[1].good === false && s3.length === 2 && s3[1].good === true, { s2, s3 }); }
check('ratings: another answer is a new rating', rateAdd(JSON.stringify(r3), true, 'answer B', '2026-10-25T09:00:00Z').length === 2);
console.log('\n5. the conversation so far (recentLine)');
{
  const N = Date.parse('2026-10-21T10:30:00Z');
  const row = (min, who, text, w) => ({ ts: new Date(N - min * 60000).toISOString(), event_type: who, payload: { text, wamid: w || ('w' + min) } });
  const rows = [row(1, 'owner_in', 'now', 'CUR'), row(2, 'assistant', 'answer B'), row(3, 'owner_in', 'question B'), row(200, 'owner_in', 'too old'), row(5, 'watch', 'alert')];
  const r = recentLine(rows, 'CUR', N);
  check('oldest first, both sides, Israel time, without the message answered now, without old or other kinds', r === '13:27 \u05de\u05d9\u05db\u05d0\u05dc: question B || 13:28 \u05d4\u05e2\u05d5\u05d6\u05e8: answer B', r);
  const many = Array.from({ length: 30 }, (_, i) => row(i + 2, 'assistant', 'x'.repeat(300)));
  check('at most 8 lines and ' + RECENT_MAX + ' characters', recentLine(many, '', N).split(' || ').length <= 8 && recentLine(many, '', N).length <= RECENT_MAX);
}
console.log('\n6. a file Michael sends keeps its media id (26/10/2026, the PDF quote at 11:43)');
{
  const p = ownerInPayload({ id: 'w1', type: 'document', text: '', media: { id: '1234567890', mime: 'application/pdf', name: 'Q3594.pdf' } });
  check('a document with no caption: "\ud83d\udcce name" as text, with media_id, mime and name', p.text === '\ud83d\udcce Q3594.pdf' && p.media_id === '1234567890' && p.mime === 'application/pdf' && p.name === 'Q3594.pdf', p);
  const q = ownerInPayload({ id: 'w2', type: 'text', text: 'hi' });
  check('a text message: no media fields', q.text === 'hi' && !('media_id' in q), q);
  const N = Date.parse('2026-10-26T10:00:00Z');
  const r = recentLine([{ ts: '2026-10-26T09:43:00Z', event_type: 'owner_in', payload: p }], 'CUR', N);
  check('recent shows the file with its id for wa_media (it used to drop an empty line)', r.indexOf('Q3594.pdf') > 0 && r.indexOf('[wa_media 1234567890]') > 0, r);
}
console.log('\n7. close a tour finding only on his yes to that question (26/10/2026)');
{
  const prev = { ref: 'tourclose:th-12' };
  const y = fastRoute({ text: 'בצע' }, null, prev), n = fastRoute({ text: '2' }, null, prev), q = fastRoute({ text: 'רגע, איזה ליקוי?' }, null, prev);
  check('"בצע" = close, "2" = no, a question = to the assistant', y && y.kind === 'tour_close' && y.id === 'th-12' && y.yes === true && n && n.kind === 'tour_close' && n.yes === false && (!q || q.kind !== 'tour_close'), { y, n, q });
  check('"בצע" with no tour question before it is not a close', !(fastRoute({ text: 'בצע' }, null, { ref: 'brief' }) || {}).kind || fastRoute({ text: 'בצע' }, null, { ref: 'brief' }).kind !== 'tour_close');
}
console.log('\n8. send an invite only on his yes to that question (26/10/2026)');
{
  const prev = { ref: 'calinvite:ab12cd34' };
  const y = fastRoute({ text: 'בצע' }, null, prev), n = fastRoute({ text: 'לא' }, null, prev), q = fastRoute({ text: 'תוסיף גם את נחום' }, null, prev);
  check('"בצע" = send, "לא" = no, a correction = to the assistant', y && y.kind === 'cal_invite' && y.id === 'ab12cd34' && y.yes === true && n && n.kind === 'cal_invite' && n.yes === false && (!q || q.kind !== 'cal_invite'), { y, n, q });
}
console.log('\n9. move an event only on his yes to that question (26/10/2026 retro)');
{
  const prev = { ref: 'calmove:ab12cd34' };
  const y = fastRoute({ text: 'בצע' }, null, prev), n = fastRoute({ text: 'לא' }, null, prev), q = fastRoute({ text: 'לא, ליום חמישי' }, null, prev);
  check('"בצע" = move, "לא" = no, a correction = to the assistant', y && y.kind === 'cal_move' && y.id === 'ab12cd34' && y.yes === true && n && n.kind === 'cal_move' && n.yes === false && (!q || q.kind !== 'cal_move'), { y, n, q });
  check('"בצע" after an invite question is an invite, not a move', fastRoute({ text: 'בצע' }, null, { ref: 'calinvite:ab12cd34' }).kind === 'cal_invite');
}
console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
