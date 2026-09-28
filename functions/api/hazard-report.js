// Cloudflare Pages Function: the report to each department (stage 4, 28/09).
// Replaces the workbook macro "\u05e9\u05dc\u05d7 \u05d3\u05d5"\u05d7 \u05d1\u05d8\u05d9\u05d7\u05d5\u05ea" (sheet "\u05d3\u05d5\u05d7 \u05dc\u05e9\u05dc\u05d9\u05d7\u05d4"), with
// the same rules, read from the same workbook so a change there applies here:
//   * rows: the department's hazards that are not \u05e1\u05d2\u05d5\u05e8, from the merged
//     register (manager + trustees, hazard-file.js buildRegister), columns
//     \u05de\u05e1"\u05d3 / \u05de\u05d9\u05e7\u05d5\u05dd / \u05ea\u05d9\u05d0\u05d5\u05e8 / \u05d7\u05d5\u05de\u05e8\u05d4 / \u05d0\u05d7\u05e8\u05d0\u05d9 / \u05e4\u05e2\u05d5\u05dc\u05d4 / \u05d9\u05e2\u05d3 / \u05e1\u05d8\u05d8\u05d5\u05e1. A hazard from
//     an earlier tour of the department (its tour number below the latest)
//     says "<status> - \u05de\u05e1\u05d9\u05d5\u05e8 \u05e7\u05d5\u05d3\u05dd!" and is highlighted, like column N.
//   * \u05d0\u05dc: the department's managers (sheet "\u05e0\u05de\u05e2\u05e0\u05d9\u05dd", part 1), plus \u05d0\u05d7\u05d6\u05e7\u05d4 /
//     \u05d7\u05e9\u05de\u05dc / \u05d4\u05e0\u05d3\u05e1\u05d4 when one of the rows is theirs (part 2), plus the
//     \u05d4\u05e0\u05d3\u05e1\u05d4 row (\u05e9\u05dc\u05d5\u05de\u05d9, their manager) when a row is for \u05d0\u05d7\u05d6\u05e7\u05d4 or \u05d7\u05e9\u05de\u05dc.
//     \u05e2\u05d5\u05ea\u05e7: part 3, on every mail.
//   * the opening and closing lines: L1 / L2 of "\u05d3\u05d5\u05d7 \u05dc\u05e9\u05dc\u05d9\u05d7\u05d4".
// Sent from sviva's Outlook (Graph, Mail.Send), kept in Sent Items.
// Only on request (Michael: "\u05e8\u05e7 \u05db\u05e4\u05ea\u05d5\u05e8 \u05d1\u05d0\u05e4\u05dc\u05d9\u05e7\u05e6\u05d9\u05d4"): admin/manager session.
// POST {op:'preview'} -> every department; {op:'send', depts:[...], test?}.
// test: true sends each report to the connected account only.
import { defaultAllowedOrigins, corsHeaders, jsonResp, requireRole } from '../_shared.js';
import { odConfigured, accessToken, tokenRow, hasMail, sendMailTo, stateSet } from '../_onedrive.js';
import { readSheetRows } from '../_xlsxpatch.js';
import { FOLDER, FILES, DEPTS, buildRegister, readAll } from './hazard-file.js';

const G = 'https://graph.microsoft.com/v1.0/me/drive/root:/';
const seg = (p) => String(p).split('/').filter(Boolean).map(encodeURIComponent).join('/');
const S_DONE = '\u05e1\u05d2\u05d5\u05e8';
const OLD = ' - \u05de\u05e1\u05d9\u05d5\u05e8 \u05e7\u05d5\u05d3\u05dd!';
const RESP_KEYS = ['\u05d0\u05d7\u05d6\u05e7\u05d4', '\u05d7\u05e9\u05de\u05dc', '\u05d4\u05e0\u05d3\u05e1\u05d4'];
const DEFAULT_OPEN = '\u05e9\u05dc\u05d5\u05dd, \u05dc\u05d4\u05dc\u05df \u05d4\u05de\u05e4\u05d2\u05e2\u05d9\u05dd \u05d4\u05e4\u05ea\u05d5\u05d7\u05d9\u05dd \u05e9\u05e0\u05de\u05e6\u05d0\u05d5 \u05d1\u05e1\u05d9\u05d5\u05e8 \u05d4\u05d1\u05d8\u05d9\u05d7\u05d5\u05ea \u05d5\u05d3\u05d5\u05e8\u05e9\u05d9\u05dd \u05d8\u05d9\u05e4\u05d5\u05dc.';
const DEFAULT_SIGN = '\u05d1\u05d1\u05e8\u05db\u05d4, \u05de\u05de\u05d5\u05e0\u05d4 \u05d1\u05d8\u05d9\u05d7\u05d5\u05ea';
const emails = (t) => String(t || '').split(/[,;\s]+/).map((x) => x.trim()).filter((x) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(x));
const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const fd = (v) => { const d = v && typeof v === 'object' ? v.date : v; const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(d || '')); return m ? m[3] + '/' + m[2] + '/' + m[1] : ''; };

// Pure: the "\u05e0\u05de\u05e2\u05e0\u05d9\u05dd" sheet (readSheetRows from row 1) -> who gets what.
export function parseRecipients(rows) {
  const out = { depts: {}, resp: {}, cc: [] };
  let part = 0;
  (rows || []).forEach(({ v }) => {
    const a = String(v[0] || '').trim();
    const p = /^([123])\./.exec(a); if (p) { part = +p[1]; return; }
    if (part === 1) { const d = DEPTS.find((x) => x === a); const e = emails(v[2]); if (d && e.length) out.depts[d] = e; }
    else if (part === 2) { const k = RESP_KEYS.find((x) => a.indexOf(x) === 0); const e = emails(v[1]); if (k && e.length) out.resp[k] = e; }
    else if (part === 3) { emails(v[1]).forEach((x) => out.cc.push(x)); }
  });
  return out;
}

// Pure: one department's report from the register rows.
export function buildReport(dept, rows, rcpt, texts) {
  const mine = rows.filter((r) => r[3] === dept);
  const latest = mine.reduce((m, r) => Math.max(m, +r[2] || 0), 0);
  const open = mine.filter((r) => r[10] !== S_DONE).map((r) => {
    const old = !!latest && (+r[2] || 0) > 0 && +r[2] < latest;
    return { n: r[0], loc: r[4] || '', descr: r[5] || '', sev: r[6] || '', resp: r[7] || '', action: r[8] || '', due: fd(r[9]), status: (r[10] || '') + (old ? OLD : ''), old };
  });
  const seen = new Set(), to = [];
  const add = (list) => (list || []).forEach((x) => { const k = x.toLowerCase(); if (!seen.has(k)) { seen.add(k); to.push(x); } });
  add(rcpt.depts[dept]);
  const who = new Set();
  open.forEach((r) => String(r.resp).split(/\s*\+\s*/).forEach((x) => { if (RESP_KEYS.indexOf(x) >= 0) who.add(x); }));
  RESP_KEYS.forEach((k) => { if (who.has(k)) add(rcpt.resp[k]); });
  if (who.has('\u05d0\u05d7\u05d6\u05e7\u05d4') || who.has('\u05d7\u05e9\u05de\u05dc')) add(rcpt.resp['\u05d4\u05e0\u05d3\u05e1\u05d4']);
  const cc = [];
  (rcpt.cc || []).forEach((x) => { const k = x.toLowerCase(); if (!seen.has(k)) { seen.add(k); cc.push(x); } });
  const title = '\u05d3\u05d5\u05d7 \u05de\u05e4\u05d2\u05e2\u05d9\u05dd \u05e4\u05ea\u05d5\u05d7\u05d9\u05dd \u05dc\u05d8\u05d9\u05e4\u05d5\u05dc - \u05de\u05d7\u05dc\u05e7\u05ea ' + dept;
  const th = ['\u05de\u05e1"\u05d3', '\u05de\u05d9\u05e7\u05d5\u05dd', '\u05ea\u05d9\u05d0\u05d5\u05e8 \u05d4\u05de\u05e4\u05d2\u05e2', '\u05d7\u05d5\u05de\u05e8\u05d4', '\u05de\u05d7\u05dc\u05e7\u05d4 \u05d0\u05d7\u05e8\u05d0\u05d9\u05ea', '\u05e4\u05e2\u05d5\u05dc\u05d4 \u05e0\u05d3\u05e8\u05e9\u05ea', '\u05d9\u05e2\u05d3 \u05dc\u05d8\u05d9\u05e4\u05d5\u05dc', '\u05e1\u05d8\u05d8\u05d5\u05e1'];
  const cell = 'border:1px solid #ccc;padding:6px;vertical-align:top';
  const html = '<div dir="rtl" style="font-family:Arial,sans-serif;font-size:14px">'
    + '<h2 style="margin:0 0 10px">' + esc(title) + '</h2>'
    + '<p>' + esc(texts.open || DEFAULT_OPEN).replace(/\n/g, '<br>') + '</p>'
    + (open.some((r) => r.old) ? '<p style="color:#8a6d00">\u05d4\u05e9\u05d5\u05e8\u05d5\u05ea \u05d4\u05de\u05e1\u05d5\u05de\u05e0\u05d5\u05ea \u05d1\u05e6\u05d1\u05e2 \u05d6\u05d4\u05d1 \u05d4\u05df \u05dc\u05d9\u05e7\u05d5\u05d9\u05d9\u05dd \u05de\u05e1\u05d9\u05d5\u05e8\u05d9\u05dd \u05e7\u05d5\u05d3\u05de\u05d9\u05dd \u05e9\u05d8\u05e8\u05dd \u05e0\u05e1\u05d2\u05e8\u05d5.</p>' : '')
    + '<table style="border-collapse:collapse;width:100%"><tr>' + th.map((h) => '<th style="' + cell + ';background:#1f3864;color:#fff">' + esc(h) + '</th>').join('') + '</tr>'
    + open.map((r) => '<tr style="background:' + (r.old ? '#fff2cc' : '#fff') + '">' + [r.n, r.loc, r.descr, r.sev, r.resp, r.action, r.due, r.status].map((x) => '<td style="' + cell + '">' + esc(x).replace(/\n/g, '<br>') + '</td>').join('') + '</tr>').join('')
    + '</table><p>' + esc(texts.sign || DEFAULT_SIGN).replace(/\n/g, '<br>') + '</p></div>';
  return { dept, title, to, cc, rows: open, count: open.length, old: open.filter((r) => r.old).length, html };
}

async function loadAll(env, token) {
  const [hazards, reports] = await Promise.all([
    readAll(env, 'tour_hazards?select=id,n,d,tour_no,dept,loc,descr,sev,resp,resp2,action,due,s,closed_d,notes&order=n.asc'),
    readAll(env, 'trustee_reports?select=id,u,t,d,loc,ok,f,s,ref,mgr_note,action,closed_d,ts&order=ts.asc'),
  ]);
  const r = await fetch(G + seg(FOLDER + '/' + FILES.xlsm.name) + ':/content', { headers: { Authorization: 'Bearer ' + token } });
  if (!r.ok) throw new Error('the workbook could not be read (onedrive ' + r.status + ')');
  const book = new Uint8Array(await r.arrayBuffer());
  const rc = await readSheetRows(book, { sheet: '\u05e0\u05de\u05e2\u05e0\u05d9\u05dd', minRow: 1, maxRow: 80, lastCol: 3, dateCols: [] });
  const tx = await readSheetRows(book, { sheet: '\u05d3\u05d5\u05d7 \u05dc\u05e9\u05dc\u05d9\u05d7\u05d4', minRow: 1, maxRow: 2, lastCol: 11, dateCols: [] });
  const t1 = tx.find((x) => x.r === 1), t2 = tx.find((x) => x.r === 2);
  return { rows: buildRegister(hazards, reports).rows, rcpt: parseRecipients(rc), texts: { open: t1 && t1.v[11], sign: t2 && t2.v[11] } };
}

export async function onRequest(context) {
  const { request, env } = context;
  const cors = corsHeaders(request.headers.get('Origin') || '', defaultAllowedOrigins(env), 'POST,OPTIONS');
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (request.method !== 'POST') return jsonResp({ error: 'method not allowed' }, 405, cors);
  const who = await requireRole(request, env, ['admin', 'manager']);
  if (!who.ok) return jsonResp({ error: who.error }, who.status, cors);
  if (!odConfigured(env)) return jsonResp({ ok: false, error: 'server not configured' }, 200, cors);
  let body = {}; try { body = await request.json(); } catch (e) {}
  try {
    const row = await tokenRow(env);
    if (!row || !row.refresh_token) return jsonResp({ ok: false, error: 'OneDrive \u05dc\u05d0 \u05de\u05d7\u05d5\u05d1\u05e8' }, 200, cors);
    const { token } = await accessToken(env);
    const data = await loadAll(env, token);
    const reports = DEPTS.map((d) => buildReport(d, data.rows, data.rcpt, data.texts));
    if (body.op !== 'send') return jsonResp({ ok: true, canSend: hasMail(row), reports: reports.map((x) => Object.assign({}, x, { html: undefined })) }, 200, cors);
    if (!hasMail(row)) return jsonResp({ ok: false, error: '\u05d0\u05d9\u05df \u05d4\u05e8\u05e9\u05d0\u05ea \u05e9\u05dc\u05d9\u05d7\u05ea \u05de\u05d9\u05d9\u05dc (Mail.Send)' }, 200, cors);
    const want = Array.isArray(body.depts) ? body.depts : [];
    // A test (28/09, Michael: "for now, only to me"): the same mail, to the
    // connected account only, no copies; the real recipients are listed at the top.
    const test = body.test === true;
    const me = row.user_email;
    if (test && !me) return jsonResp({ ok: false, error: '\u05dc\u05d0 \u05d9\u05d3\u05d5\u05e2 \u05dc\u05d0\u05d9\u05d6\u05d4 \u05d7\u05e9\u05d1\u05d5\u05df \u05dc\u05e9\u05dc\u05d5\u05d7' }, 200, cors);
    const sent = [], skipped = [], failed = [];
    for (const rep of reports) {
      if (want.indexOf(rep.dept) < 0) continue;
      if (!rep.count) { skipped.push({ dept: rep.dept, why: '\u05d0\u05d9\u05df \u05de\u05e4\u05d2\u05e2\u05d9\u05dd \u05e4\u05ea\u05d5\u05d7\u05d9\u05dd' }); continue; }
      if (!test && !rep.to.length) { skipped.push({ dept: rep.dept, why: '\u05d0\u05d9\u05df \u05e0\u05de\u05e2\u05df \u05d1\u05d2\u05d9\u05dc\u05d9\u05d5\u05df \u05e0\u05de\u05e2\u05e0\u05d9\u05dd' }); continue; }
      const to = test ? [me] : rep.to, cc = test ? [] : rep.cc;
      const subject = (test ? '\u05d1\u05d3\u05d9\u05e7\u05d4 - ' : '') + rep.title;
      const html = test ? '<div dir="rtl" style="font-family:Arial,sans-serif;font-size:13px;background:#fff8e1;border:1px solid #e0c46c;padding:8px;margin-bottom:10px">\u05de\u05d9\u05d9\u05dc \u05d1\u05d3\u05d9\u05e7\u05d4, \u05e0\u05e9\u05dc\u05d7 \u05e8\u05e7 \u05d0\u05dc\u05d9\u05da. \u05d1\u05e9\u05dc\u05d9\u05d7\u05d4 \u05d0\u05de\u05d9\u05ea\u05d9\u05ea: \u05d0\u05dc ' + esc(rep.to.join(', ') || '(\u05d0\u05d9\u05df \u05e0\u05de\u05e2\u05df)') + ' | \u05e2\u05d5\u05ea\u05e7 ' + esc(rep.cc.join(', ')) + '</div>' + rep.html : rep.html;
      try { await sendMailTo(token, to, cc, subject, html); sent.push({ dept: rep.dept, to, cc, count: rep.count, test }); }
      catch (e) { failed.push({ dept: rep.dept, error: String((e && e.message) || e).substring(0, 160) }); }
    }
    if (!test) await stateSet(env, { hazard_report_last: JSON.stringify({ at: new Date().toISOString(), by: (who.user && who.user.email) || null, sent: sent.map((x) => x.dept) }) }).catch(() => {});
    return jsonResp({ ok: !failed.length, sent, skipped, failed }, 200, cors);
  } catch (e) {
    return jsonResp({ ok: false, error: String((e && e.message) || e).substring(0, 200) }, 200, cors);
  }
}
