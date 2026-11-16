// The weekly form probe (16/11/2026, Michael in the questionnaire: "בצע: בדיקה שבועית לטופס"; handoff 16/11/2026 "next up" 2).
// Once a week (Sunday from 06:00 Israel, wa-morning watch) the server fills form 146.03 with made-up details, as a
// contractor's send would (functions/_ctrform.js), saves it as one fixed Word file in the safety folder (replaced each
// week, nothing else is written), has Microsoft turn it into a PDF (the same graphPdf the real send uses) and reads the
// PDF's text: the company, both workers, the three dates in DD.MM.YYYY order and never reversed, and the workers' table
// heading. Why: on 16/11/2026 Word reversed dates written with slashes, and LibreOffice (our local render) did not show
// it; only Microsoft's PDF did. A failure goes to Michael on WhatsApp (kind fault); a pass is only kept in server_state.
import { PDFDocument } from './_pdflib.js';
import { countText } from './_pdftext.js';
import { fillCtrForm } from './_ctrform.js';
import { accessToken, putFile } from './_onedrive.js';
import { sendToOwner, ownerWa, ownerWindowOpen } from './_wa.js';
import { sbFrom, tmo, SB_TIMEOUT_MS } from './_shared.js';
import { formTemplate, dotDay } from './api/ctr-link.js';
import { graphPdf } from './api/talk.js';

export const PROBE_KEY = 'form_probe';
export const PROBE_DIR = '\u05e9\u05d5\u05dc\u05d7\u05df \u05d4\u05e2\u05d1\u05d5\u05d3\u05d4/\u05e0\u05d9\u05d4\u05d5\u05dc \u05d1\u05d8\u05d9\u05d7\u05d5\u05ea/00_\u05d3\u05d5\u05d7\u05d5\u05ea \u05d5\u05de\u05e2\u05e7\u05d1/_\u05d1\u05d3\u05d9\u05e7\u05d5\u05ea \u05d0\u05d5\u05d8\u05d5\u05de\u05d8\u05d9\u05d5\u05ea';
export const PROBE_NAME = '\u05d8\u05d5\u05e4\u05e1 146.03 - \u05d1\u05d3\u05d9\u05e7\u05d4 \u05e9\u05d1\u05d5\u05e2\u05d9\u05ea.docx';
export const PROBE_COMPANY = '\u05d1\u05d3\u05d9\u05e7\u05d4 \u05e9\u05d1\u05d5\u05e2\u05d9\u05ea';
export const PROBE_WORKERS = ['\u05d9\u05e9\u05e8\u05d0\u05dc \u05d9\u05e9\u05e8\u05d0\u05dc\u05d9', '\u05de\u05e9\u05d4 \u05db\u05d4\u05df'];
export const PROBE_HEAD = '\u05e9\u05dd \u05d4\u05e2\u05d5\u05d1\u05d3';
// a 1x1 PNG: the signatures (their look is not what is checked)
const PNG = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='), (c) => c.charCodeAt(0));
const addDays = (ymd, n) => new Date(Date.parse(ymd + 'T12:00:00Z') + n * 864e5).toISOString().slice(0, 10);
const revDot = (ymd) => ymd.slice(0, 4) + '.' + ymd.slice(5, 7) + '.' + ymd.slice(8, 10);

// Due: Sunday, from 06:00 Israel, once that day. dow/hour/day in Israel time; last = the day it last ran.
export const probeDue = (dow, hour, day, last) => dow === 0 && hour >= 6 && hour < 12 && day !== last;
// The made-up send for a day (YYYY-MM-DD).
export function probeData(day) {
  const ds = day, de = addDays(day, 3);
  return { ds, de, d: { company: PROBE_COMPANY, cnum: '000000000', signer: PROBE_WORKERS[0], sid: '000000018', contact: '0500000000', date: dotDay(day),
    works: '\u05e2\u05d1\u05d5\u05d3\u05d4 \u05d1\u05d2\u05d5\u05d1\u05d4', desc: '\u05d1\u05d3\u05d9\u05e7\u05d4 \u05d0\u05d5\u05d8\u05d5\u05de\u05d8\u05d9\u05ea \u05e9\u05dc \u05d4\u05d8\u05d5\u05e4\u05e1, \u05dc\u05d0 \u05e2\u05d1\u05d5\u05d3\u05d4 \u05d0\u05de\u05d9\u05ea\u05d9\u05ea', job: dotDay(ds) + ' \u05e2\u05d3 ' + dotDay(de) + ', \u05d1\u05d3\u05d9\u05e7\u05d4', mgrSig: PNG,
    workers: [{ n: PROBE_WORKERS[0], id: '000000018', sig: PNG }, { n: PROBE_WORKERS[1], id: '000000026', sig: PNG }] } };
}
// Pure: what is wrong in the PDF's text. count(needle) = how many times it is there. [] = all well.
export function probeFails(count, day) {
  const p = probeData(day), bad = [];
  if (count(PROBE_COMPANY) < 1) bad.push('\u05e9\u05dd \u05d4\u05d7\u05d1\u05e8\u05d4 \u05dc\u05d0 \u05e0\u05de\u05e6\u05d0');
  for (const w of PROBE_WORKERS) if (count(w) < 1) bad.push('\u05e9\u05dd \u05d4\u05e2\u05d5\u05d1\u05d3 ' + w + ' \u05dc\u05d0 \u05e0\u05de\u05e6\u05d0');
  if (count(PROBE_HEAD) < 1) bad.push('\u05db\u05d5\u05ea\u05e8\u05ea \u05d8\u05d1\u05dc\u05ea \u05d4\u05e2\u05d5\u05d1\u05d3\u05d9\u05dd \u05dc\u05d0 \u05e0\u05de\u05e6\u05d0\u05d4');
  for (const d of [day, p.de]) {
    if (count(dotDay(d)) < 1) bad.push('\u05d4\u05ea\u05d0\u05e8\u05d9\u05da ' + dotDay(d) + ' \u05dc\u05d0 \u05e0\u05de\u05e6\u05d0');
    if (count(revDot(d)) > 0) bad.push('\u05d4\u05ea\u05d0\u05e8\u05d9\u05da ' + dotDay(d) + ' \u05d9\u05e6\u05d0 \u05d4\u05e4\u05d5\u05da (' + revDot(d) + ')');
  }
  return bad;
}
export function probeText(bad) {
  return '\u05d4\u05d1\u05d3\u05d9\u05e7\u05d4 \u05d4\u05e9\u05d1\u05d5\u05e2\u05d9\u05ea \u05e9\u05dc \u05d8\u05d5\u05e4\u05e1 146.03 (\u05e7\u05d9\u05e9\u05d5\u05e8 \u05d4\u05e7\u05d1\u05dc\u05df) \u05de\u05e6\u05d0\u05d4 \u05d1\u05e2\u05d9\u05d4 \u05d1-PDF \u05e9\u05dc Microsoft:\n' + bad.slice(0, 6).map((b) => '- ' + b).join('\n')
    + '\n\u05d4\u05e7\u05d5\u05d1\u05e5 \u05dc\u05d1\u05d3\u05d9\u05e7\u05d4: 00_\u05d3\u05d5\u05d7\u05d5\u05ea \u05d5\u05de\u05e2\u05e7\u05d1/_\u05d1\u05d3\u05d9\u05e7\u05d5\u05ea \u05d0\u05d5\u05d8\u05d5\u05de\u05d8\u05d9\u05d5\u05ea/' + PROBE_NAME + '. \u05d8\u05e4\u05e1\u05d9\u05dd \u05e9\u05dc \u05e7\u05d1\u05dc\u05e0\u05d9\u05dd \u05d0\u05de\u05d9\u05ea\u05d9\u05d9\u05dd \u05e2\u05dc\u05d5\u05dc\u05d9\u05dd \u05dc\u05e6\u05d0\u05ea \u05db\u05da \u05e2\u05d3 \u05e9\u05d6\u05d4 \u05d9\u05ea\u05d5\u05e7\u05df.';
}

const hdr = (env) => { const k = env.SUPABASE_SERVICE_ROLE_KEY; return { apikey: k, Authorization: 'Bearer ' + k, 'Content-Type': 'application/json' }; };
async function stateGet(env) {
  const r = await fetch(sbFrom(env) + '/rest/v1/server_state?select=value&key=eq.' + PROBE_KEY, { headers: hdr(env), signal: tmo(SB_TIMEOUT_MS) });
  if (!r.ok) throw new Error('state ' + r.status);
  const rows = await r.json();
  try { return JSON.parse((rows && rows[0] && rows[0].value) || '{}') || {}; } catch (e) { return {}; }
}
async function stateSet(env, v) {
  await fetch(sbFrom(env) + '/rest/v1/server_state?on_conflict=key', { /* cas-ok: one weekly result, the newest whole, nothing merged */ method: 'POST', headers: { ...hdr(env), Prefer: 'resolution=merge-duplicates,return=minimal' }, signal: tmo(SB_TIMEOUT_MS),
    body: JSON.stringify([{ key: PROBE_KEY, value: JSON.stringify(v), updated_at: new Date().toISOString() }]) });
}
export const probeDeps = { accessToken, putFile, formTemplate, graphPdf };
// The run. ctx = {dow, hour, day} in Israel time; force = run now whatever the day. {ran, ok, fails} or {ran:false}.
export async function formProbe(env, ctx, deps, force) {
  const d0 = deps || probeDeps;
  const st = await stateGet(env);
  if (!force && !probeDue(ctx.dow, ctx.hour, ctx.day, st.day)) return { ran: false };
  // the day first: a slow or cut run is not repeated every 5 minutes
  await stateSet(env, Object.assign({}, st, { day: ctx.day, at: new Date().toISOString(), ok: null }));
  let bad = [], err = null;
  try {
    const token = (await d0.accessToken(env)).token;
    const tp = await d0.formTemplate(token);
    const fl = await fillCtrForm(tp.bytes, probeData(ctx.day).d);
    await d0.putFile(token, PROBE_DIR, PROBE_NAME, fl.bytes, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    const pdf = await d0.graphPdf(token, (PROBE_DIR + '/' + PROBE_NAME).split('/').map(encodeURIComponent).join('/'), 25000);
    if (!pdf) bad = ['Microsoft \u05dc\u05d0 \u05d4\u05d7\u05d6\u05d9\u05e8 PDF'];
    else {
      const doc = await PDFDocument.load(pdf);
      bad = probeFails((n) => countText(doc, n), ctx.day);
      if (fl.report && fl.report.missing && fl.report.missing.length) bad.push('\u05d1\u05d8\u05d5\u05e4\u05e1 \u05d7\u05e1\u05e8\u05d9\u05dd: ' + fl.report.missing.slice(0, 4).join(', '));
    }
  } catch (e) { err = String((e && e.message) || e).slice(0, 120); bad = ['\u05d4\u05d1\u05d3\u05d9\u05e7\u05d4 \u05dc\u05d0 \u05e8\u05e6\u05d4 \u05e2\u05d3 \u05d4\u05e1\u05d5\u05e3 (' + err + ')']; }
  let told = null;
  if (bad.length && env.META_PHONE_NUMBER_ID && env.META_ACCESS_TOKEN) {
    const url = sbFrom(env), to = await ownerWa(env, url).catch(() => '');
    if (to) { const r = await sendToOwner(env, to, probeText(bad), { kind: 'fault', windowOpen: await ownerWindowOpen(env, url) }).catch(() => null); told = !!(r && r.ok); }
  }
  await stateSet(env, { day: ctx.day, at: new Date().toISOString(), ok: !bad.length, fails: bad, told });
  return { ran: true, ok: !bad.length, fails: bad, told };
}
