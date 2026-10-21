// The server's fast lane (20/10/2026, Michael in the questionnaire: "do it: a fast lane in the server").
// A number 1-4 that answers a hazard alert, and "what is urgent" / "expiries", are answered by wa-hook
// itself by rules; everything else, and anything unclear, still goes to the assistant.
import { fastRoute, hazardRef, fastHazardText, FAST_BRIEF, rateOf, rateAdd, RATE_MAX } from './_build/wa-hook.mjs';
import { HAZARD_OPTIONS, hazardAsk, assistantFire, fireUrlOf } from './_build/_wa.mjs';

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
const rl = rateAdd(JSON.stringify(Array.from({ length: RATE_MAX }, () => ({ good: true }))), false, 'q '.repeat(300), '2026-10-21T08:00:00Z');
check('ratings: the newest kept, at most ' + RATE_MAX + ', question cut to 200', rl.length === RATE_MAX && rl[rl.length - 1].good === false && rl[rl.length - 1].q.length === 200);
console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
