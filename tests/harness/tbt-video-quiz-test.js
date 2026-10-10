// Video and comprehension questions in the weekly-talk form (10/10/2026): the video link or
// upload, up to 5 questions with a marked right answer, an incomplete question stops the save,
// the AI suggests questions that the manager can fix, edit and duplicate bring them back, and
// "who signed" shows each worker's score.
const path = require('path');
let pw; try { pw = require('playwright'); } catch (e) { pw = require('playwright-core'); }
const HTML = 'file://' + path.resolve(__dirname, '../../index.html');
let pass = 0, fail = 0;
const check = (l, c, d) => { if (c) { pass++; console.log('  ✓ ' + l); } else { fail++; console.log('  ✗ ' + l + (d !== undefined ? '  -> ' + JSON.stringify(d) : '')); } };

(async () => {
  const browser = await pw.chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 375, height: 812 }, locale: 'he-IL' })).newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.route('**/*', (r) => r.request().url().startsWith('file://') ? r.continue() : r.abort());
  await page.goto(HTML, { waitUntil: 'load' });
  await page.waitForTimeout(700);
  const r = await page.evaluate(async () => {
    window.sdb = function () {}; window.addLog = function () {};
    const ins = [], toasts = [];
    window.sbIns = (t, x) => ins.push([t, JSON.parse(JSON.stringify(x))]); window.sbUpd = (t, x) => ins.push([t, JSON.parse(JSON.stringify(x))]);
    window.toast = (m) => toasts.push(String(m));
    _currentUser = { username: 'admin' }; window._sbToken = 'tok';
    DB.toolbox_talks = []; DB.toolbox_reads = [];
    goPage('toolbox');
    const o = {};
    const set = (id, v) => { document.getElementById(id).value = v; };
    const fill = () => { set('tbt-title', 'סולמות'); set('tbt-body', 'שלוש נקודות אחיזה. בדיקה לפני עלייה.'); set('tbt-trainer', 'מיכאל'); set('tbt-trainer-q', 'ממונה בטיחות'); };
    // 1. the form has the fields; a new form starts with no questions
    openModal('m-tbt');
    o.fields = !!document.getElementById('tbt-video') && !!document.getElementById('tbt-video-btn') && !!document.getElementById('tbt-quiz') && !!document.getElementById('tbt-quiz-ai');
    o.empty0 = document.querySelectorAll('#tbt-quiz .tq').length;
    // 2. an incomplete question stops the save and says which
    fill(); _tbtQuizAdd();
    const q0 = document.querySelector('#tbt-quiz .tq');
    q0.querySelector('.tq-q').value = 'כמה נקודות אחיזה?';
    q0.querySelectorAll('.tq-a')[0].value = 'שתיים'; q0.querySelectorAll('.tq-a')[1].value = 'שלוש';
    let n = ins.length; svTbt(); o.noRight = { ins: ins.length - n, t: toasts.slice(-1)[0] };
    q0.querySelectorAll('input[type=radio]')[1].checked = true;
    // a bad video link stops the save
    set('tbt-video', 'youtube.com/x'); n = ins.length; svTbt(); o.badVid = { ins: ins.length - n, t: toasts.slice(-1)[0] };
    set('tbt-video', 'https://youtu.be/dQw4w9WgXcQ');
    // an empty extra question block is ignored
    _tbtQuizAdd();
    n = ins.length; svTbt(); o.saved = ins.slice(-1)[0]; o.savedN = ins.length - n;
    o.cleared = { v: gv('tbt-video'), q: document.querySelectorAll('#tbt-quiz .tq').length };
    // 3. no more than 5
    openModal('m-tbt'); for (let i = 0; i < 7; i++) _tbtQuizAdd(); o.max = document.querySelectorAll('#tbt-quiz .tq').length; o.maxToast = toasts.slice(-1)[0]; closeModal('m-tbt');
    // 4. edit brings the questions and the video back; a new form after it is empty again
    const id = o.saved && o.saved[1].id;
    _genEdit('toolbox_talks', id);
    const rows = document.querySelectorAll('#tbt-quiz .tq');
    o.edit = { v: gv('tbt-video'), n: rows.length, q: rows[0] && rows[0].querySelector('.tq-q').value, right: rows[0] && rows[0].querySelectorAll('input[type=radio]')[1].checked };
    closeModal('m-tbt'); openModal('m-tbt'); o.afterEdit = { n: document.querySelectorAll('#tbt-quiz .tq').length, v: gv('tbt-video') }; closeModal('m-tbt');
    // 5. duplicate copies them
    tbtDup(id); o.dup = { v: gv('tbt-video'), n: document.querySelectorAll('#tbt-quiz .tq').length, edit: _svEditId('toolbox_talks') }; closeModal('m-tbt');
    // 6. the AI writes questions; keyboard characters only; a bad answer index is dropped
    openModal('m-tbt'); fill();
    let sent = null;
    window.fetch = (u, init) => { sent = JSON.parse(init.body); return Promise.resolve(new Response(JSON.stringify({ content: [{ text: 'הנה:\n[{"q":"מה עושים לפני עלייה—לסולם?","a":["בודקים","רצים","שרים","ישנים"],"c":0},{"q":"כמה נקודות?","a":["1","2","3","4"],"c":2},{"q":"שבורה","a":["a","b"],"c":5}]' }] }), { status: 200 })); };
    o.ai = await tbtQuizAI();
    const ar = document.querySelectorAll('#tbt-quiz .tq');
    o.aiRows = ar.length; o.aiQ = ar[0] && ar[0].querySelector('.tq-q').value; o.aiRight = ar[1] && ar[1].querySelectorAll('input[type=radio]')[2].checked;
    o.aiPrompt = sent && sent.messages[0].content.includes('שלוש נקודות אחיזה');
    // replacing written questions asks first
    window.confirm = () => false; o.aiKept = await tbtQuizAI(); o.aiKeptRows = document.querySelectorAll('#tbt-quiz .tq').length;
    window.confirm = () => true;
    window.fetch = () => Promise.resolve(new Response('x', { status: 500 })); o.aiFail = await tbtQuizAI(); o.aiFailBtn = document.getElementById('tbt-quiz-ai').disabled;
    closeModal('m-tbt');
    // 7. a talk with only a video can be saved; an upload in progress blocks the save
    openModal('m-tbt'); set('tbt-title', 'סרטון בלבד'); set('tbt-trainer', 'מיכאל'); set('tbt-trainer-q', 'ממונה'); set('tbt-video', 'https://youtu.be/dQw4w9WgXcQ');
    _tbtVidBusy = true; n = ins.length; svTbt(); o.busy = { ins: ins.length - n, t: toasts.slice(-1)[0] }; _tbtVidBusy = false;
    n = ins.length; svTbt(); o.vidOnly = ins.length - n;
    // 8. who signed shows the score
    DB.toolbox_reads = [{ id: 'r1', talk_id: id, emp_id: 'e1', emp_name: 'אחמד', read_at: '2026-10-11T08:00:00Z', quiz_ok: 1, quiz_n: 2 }, { id: 'r2', talk_id: id, emp_id: 'e2', emp_name: 'דנה', read_at: '2026-10-11T08:01:00Z', quiz_ok: 2, quiz_n: 2 }, { id: 'r3', talk_id: id, emp_id: 'e3', emp_name: 'יוסי', read_at: '2026-10-11T08:02:00Z' }];
    tbtWho(id);
    const wb = document.getElementById('tbt-who-body').textContent;
    o.who = { half: wb.includes('1/2 נכונות'), full: wb.includes('2/2 נכונות'), none: (wb.match(/נכונות/g) || []).length };
    return o;
  });
  check('the form has a video field, an upload button and a questions block', r.fields);
  check('a new form starts with no questions', r.empty0 === 0, r.empty0);
  check('a question without a marked right answer stops the save and names it', r.noRight.ins === 0 && /שאלה 1/.test(r.noRight.t || ''), r.noRight);
  check('a video link that is not https stops the save', r.badVid.ins === 0 && /https/.test(r.badVid.t || ''), r.badVid);
  const sv = r.saved && r.saved[1];
  check('saved: video and one question (the empty block ignored)', r.savedN === 1 && sv.video_url === 'https://youtu.be/dQw4w9WgXcQ' && Array.isArray(sv.quiz) && sv.quiz.length === 1 && sv.quiz[0].c === 1 && sv.quiz[0].a[1] === 'שלוש', sv);
  check('after the save the form is clean', r.cleared.v === '' && r.cleared.q === 0, r.cleared);
  check('no more than 5 questions', r.max === 5 && /5/.test(r.maxToast || ''), r.max);
  check('edit brings back the video and the question with its right answer', r.edit.v === 'https://youtu.be/dQw4w9WgXcQ' && r.edit.n === 1 && r.edit.q === 'כמה נקודות אחיזה?' && r.edit.right, r.edit);
  check('a new form after an edit is empty again', r.afterEdit.n === 0 && r.afterEdit.v === '', r.afterEdit);
  check('duplicate copies the video and the questions into a new record', r.dup.v === 'https://youtu.be/dQw4w9WgXcQ' && r.dup.n === 1 && !r.dup.edit, r.dup);
  check('the AI: questions from the talk text, a broken one dropped', r.ai === 'ok' && r.aiRows === 2 && r.aiPrompt, r);
  check('the AI text is cleaned to keyboard characters, the right answer marked', r.aiQ === 'מה עושים לפני עלייה-לסולם?' && r.aiRight, r.aiQ);
  check('written questions are replaced only after asking', r.aiKept === 'kept' && r.aiKeptRows === 2);
  check('an AI failure says so and frees the button', r.aiFail === 'fail' && r.aiFailBtn === false);
  check('a video upload in progress blocks the save', r.busy.ins === 0, r.busy);
  check('a talk with only a video (no text, no file) can be saved', r.vidOnly === 1, r.vidOnly);
  check('who signed: each worker\'s score, nothing for one who did not answer', r.who.half && r.who.full && r.who.none === 2, r.who);
  check('no page errors', errors.length === 0, errors);
  await browser.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
