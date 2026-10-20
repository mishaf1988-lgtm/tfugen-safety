// Buttons in WhatsApp (20/10/2026, Michael in the questionnaire: "do it: buttons in WhatsApp"). A question
// with up to 10 choices goes out inside the 24 hour window as reply buttons (up to 3) or a list (4 to 10),
// each choice numbered; a refusal falls back to the plain text; a closed window sends the template; a tap
// comes back with its number (choice) and reaches the assistant like a typed answer.
import { choicesPayload, cleanChoices, sendToOwner, inboundMessages, BTN_MAX, ROW_MAX } from './_build/_wa.mjs';
import { fireText } from './_build/wa-hook.mjs';
import { MORNING_CHOICES } from './_build/wa-morning.mjs';

let pass = 0, fail = 0;
const check = (l, c, d) => { if (c) { pass++; console.log('  ✓ ' + l); } else { fail++; console.log('  ✗ ' + l + (d !== undefined ? '  -> ' + JSON.stringify(d).slice(0, 400) : '')); } };
const TO = '972501234567';

console.log('\n1. the shape Meta takes');
const b3 = choicesPayload(TO, 'לאשר?', ['בצע', 'לא', 'פרטים']);
check('up to 3 choices = reply buttons, numbered, ids c1..c3', b3.type === 'interactive' && b3.interactive.type === 'button' && b3.interactive.action.buttons.map((x) => x.reply.id + '|' + x.reply.title).join(',') === 'c1|1. בצע,c2|2. לא,c3|3. פרטים', b3);
const l4 = choicesPayload(TO, 'מה עושים?', ['משימה למנהל המחלקה', 'אני מטפל', 'סודר במקום', 'לא מפגע']);
check('4 choices = a list with a "choose" button', l4.interactive.type === 'list' && l4.interactive.action.button === 'בחרו' && l4.interactive.action.sections[0].rows.length === 4);
const long = choicesPayload(TO, 'x', ['א'.repeat(40), 'ב', 'ג']);
check('a button title is cut to ' + BTN_MAX + ' characters', long.interactive.action.buttons[0].reply.title.length === BTN_MAX);
const l11 = choicesPayload(TO, 'x', Array.from({ length: 12 }, (_, i) => 'אפשרות ' + i));
check('at most 10 rows, each up to ' + ROW_MAX, l11.interactive.action.sections[0].rows.length === 10 && l11.interactive.action.sections[0].rows.every((r) => r.title.length <= ROW_MAX));
check('no choices, an empty body or a body over 1024 = no buttons', choicesPayload(TO, 'x', []) === null && choicesPayload(TO, '', ['a']) === null && choicesPayload(TO, 'x'.repeat(1025), ['a']) === null);
check('choices are keyboard text, trimmed, empty ones dropped', cleanChoices([' בצע — עכשיו ', '', null]).join('|') === 'בצע - עכשיו');
check('the morning update offers three short questions', MORNING_CHOICES.length === 3 && MORNING_CHOICES.every((c) => c.length <= BTN_MAX - 3));

console.log('\n2. sending');
const env = { META_PHONE_NUMBER_ID: 'p', META_ACCESS_TOKEN: 't' };
const run = async (answers, text, opts) => {
  const sent = []; let i = 0;
  globalThis.fetch = async (u, init) => { const b = JSON.parse(init.body); sent.push(b); const a = answers[Math.min(i++, answers.length - 1)];
    return { ok: a.ok, status: a.ok ? 200 : 400, text: async () => JSON.stringify(a.ok ? { messages: [{ id: 'wamid.' + i }] } : { error: { code: a.code } }) }; };
  const r = await sendToOwner(env, TO, text, opts);
  return { r, sent };
};
{ const { r, sent } = await run([{ ok: true }], 'לאשר?\n1. בצע\n2. לא', { windowOpen: true, choices: ['בצע', 'לא'] });
  check('window open: one interactive message', r.ok && r.via === 'interactive' && sent.length === 1 && sent[0].type === 'interactive', { r, sent }); }
{ const { r, sent } = await run([{ ok: false, code: 131009 }, { ok: true }], 'לאשר?', { windowOpen: true, choices: ['בצע'] });
  check('buttons refused (bad parameter): the plain text goes out instead', r.ok && r.via === 'text' && sent.length === 2 && sent[1].type === 'text', { r, sent }); }
{ const { r, sent } = await run([{ ok: true }], 'לאשר?', { windowOpen: false, choices: ['בצע', 'לא'] });
  check('window closed: the template, no buttons', r.ok && r.via === 'template' && sent.length === 1 && sent[0].type === 'template', { r, sent }); }
{ const { r, sent } = await run([{ ok: true }], 'שלום', { windowOpen: true });
  check('no choices: plain text as before', r.via === 'text' && sent[0].type === 'text'); }

console.log('\n3. a tap comes back');
const hook = (inter) => ({ entry: [{ changes: [{ value: { messages: [{ id: 'wamid.in', from: '+972-50-1234567', timestamp: '1792500000', type: 'interactive', context: { id: 'wamid.out' }, interactive: inter }] } }] }] });
const [btn] = inboundMessages(hook({ type: 'button_reply', button_reply: { id: 'c1', title: '1. בצע' } }));
check('a button tap: its title as text, its number as choice, the message it answers', btn.text === '1. בצע' && btn.choice === 1 && btn.context === 'wamid.out', btn);
const [row] = inboundMessages(hook({ type: 'list_reply', list_reply: { id: 'c4', title: '4. לא מפגע' } }));
check('a list tap: choice 4', row.choice === 4 && row.text === '4. לא מפגע', row);
const [odd] = inboundMessages(hook({ type: 'button_reply', button_reply: { id: 'x9', title: 'x' } }));
check('an id that is not ours = no choice', odd.choice === null, odd);
const ft = fireText(btn, '', null, null);
check('the assistant is told it was a tap, with the number', /\nchoice: 1 /.test(ft) && /\ntext: 1\. בצע$/.test(ft), ft);

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
