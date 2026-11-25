// Action cards on the server (25/11/2026, DECISIONS "action cards"): a successful mail_draft / od_put_pdf answer
// carries the matching cards for the assistant; a failure, another op, or no matching card leaves the answer as it is.
import { cardsFor } from './_build/_cards.mjs';
import { withCards, CARD_OPS } from './_build/routine-db.mjs';
let pass = 0, fail = 0;
const check = (l, c, d) => { if (c) { pass++; console.log('  ✓ ' + l); } else { fail++; console.log('  ✗ ' + l + (d !== undefined ? '  -> ' + JSON.stringify(d) : '')); } };
const ids = (b) => cardsFor(b).map((x) => x.split(':')[0]).sort();
check('a draft to Oxana: oxana-review and draft-check', JSON.stringify(ids({ op: 'mail_draft', to: 'oxana@tapugan.co.il' })) === '["draft-check","oxana-review"]', ids({ op: 'mail_draft', to: 'oxana@tapugan.co.il' }));
check('a draft to someone else: draft-check only', JSON.stringify(ids({ op: 'mail_draft', to: 'tzachi@tapugan.co.il' })) === '["draft-check"]');
check('form 13.08 saved: form-build and form-index', JSON.stringify(ids({ op: 'od_put_pdf', name: 'x_13.08.docx' })) === '["form-build","form-index"]');
check('an attachment named like a form counts as the file', ids({ op: 'od_pdf', path: 'a/b_26.07.docx' }).includes('form-index'));
check('a tool-only card (delete_trigger) never reaches the server', !ids({ op: 'delete_trigger' }).length);
check('the card ops', CARD_OPS.join(',') === 'mail_draft,od_put_pdf,od_archive,od_pdf');
const req = (b) => new Request('https://x/api/routine-db', { method: 'POST', body: JSON.stringify(b) });
const ok = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json' } });
let r = await withCards(req({ op: 'mail_draft', to: 'oxana@tapugan.co.il' }), ok({ ok: true, file: 'f' }));
let j = await r.json();
check('an ok answer gets the cards and keeps its fields', j.ok === true && j.file === 'f' && Array.isArray(j.cards) && j.cards.length === 2, j);
check('the cards text is Hebrew, with the source', /אוקסנה/.test(j.cards.join(' ')) && /DECISIONS/.test(j.cards.join(' ')));
r = await withCards(req({ op: 'mail_draft', to: 'oxana@tapugan.co.il' }), ok({ ok: false, error: 'x' }, 400));
j = await r.json();
check('a failed answer is left as it is', j.ok === false && !j.cards);
r = await withCards(req({ op: 'select', table: 'tasks' }), ok({ ok: true, rows: [] }));
j = await r.json();
check('another op is left as it is', !j.cards);
r = await withCards(null, ok({ ok: true }));
check('no request copy (GET): left as it is', !(await r.json()).cards);
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
