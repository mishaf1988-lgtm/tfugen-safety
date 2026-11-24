// Correcting a new worker's induction after it was sent (24/11/2026, Michael: "\u05d1\u05e7\u05dc\u05d9\u05d8\u05ea \u05e2\u05d5\u05d1\u05d3\u05d9\u05dd \u05d7\u05d3\u05e9\u05d9\u05dd \u05dc\u05e4\u05e2\u05de\u05d9\u05dd \u05d9\u05e9 \u05d0\u05d9\u05d6\u05e9\u05d4\u05d5 \u05e4\u05e1\u05e4\u05d5\u05e1...
// \u05d1\u05de\u05d9\u05d9\u05dc \u05e2\u05e6\u05de\u05d5 \u05d9\u05d4\u05d9\u05d4 \u05e7\u05d9\u05e9\u05d5\u05e8 \u05e2\u05dd \u05d0\u05d5\u05e4\u05e6\u05d9\u05d4 \u05dc\u05d4\u05d5\u05e1\u05d9\u05e3 \u05d3\u05d1\u05e8\u05d9\u05dd \u05d0\u05d5 \u05dc\u05e9\u05e0\u05d5\u05ea \u05d3\u05d1\u05e8\u05d9\u05dd"; in the questionnaire: details, equipment handed over and
// missing documents; only HR and Michael with the HR code; the signed copy stays, a correction page is filed beside it and
// an update mail goes out; DECISIONS 24/11/2026).
//
// The pure part (no network, no database): the link token, what changed, the correction page, the update mail and the
// edit form. The handlers (code gate, save, filing) are in api/talk.js (op=edit), next to the induction they correct.
import { makeLinkToken, readLinkToken } from './_closelink.js';
import { SITE } from './_shared.js';
import { LOGO_JPG } from './_logo.js';

export const EDIT_PREFIX = 'ind-edit:v1:';
export const EDIT_TTL_DAYS = 14;
// Each correction files a page and sends a mail to two people; a link that leaked cannot keep doing it.
export const EDIT_MAX = 10;
export const makeEditToken = (env, rowId, nowMs) => makeLinkToken(env, EDIT_PREFIX, rowId, EDIT_TTL_DAYS, nowMs);
export const readEditToken = (env, tok, nowMs) => readLinkToken(env, EDIT_PREFIX, tok, nowMs);
export const editUrl = (tok) => SITE.appUrl + '/api/talk?op=edit&e=' + encodeURIComponent(tok);

export const EDIT_LABELS = { emp_name: '\u05e9\u05dd', id_no: "\u05de\u05e1' \u05ea.\u05d6.", emp_no: '\u05de\u05e1\u05e4\u05e8 \u05e2\u05d5\u05d1\u05d3', dept: '\u05de\u05d7\u05dc\u05e7\u05d4', phone: '\u05d8\u05dc\u05e4\u05d5\u05df', job: '\u05ea\u05e4\u05e7\u05d9\u05d3', agency: '\u05d7\u05d1\u05e8\u05ea \u05db\u05d5\u05d7 \u05d0\u05d3\u05dd' };
const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const norm = (v) => (v == null ? '' : String(v).trim());
const fdate = (d) => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(d || '')); return m ? m[3] + '/' + m[2] + '/' + m[1] : ''; };

// Pure. The fields that differ between the row and what HR sent: [{k, label, old, new}], in the order of EDIT_LABELS.
// A field missing from `next` was not sent and is left as it is.
export function diffRow(row, next) {
  const out = [];
  for (const k of Object.keys(EDIT_LABELS)) {
    if (!next || !(k in next)) continue;
    const a = norm(row && row[k]), b = norm(next[k]);
    if (a !== b) out.push({ k, label: EDIT_LABELS[k], old: a, new: b });
  }
  return out;
}

// Pure. The equipment as one line: what was handed over, or that nothing was.
export function equipSummary(e) {
  if (!e || !Array.isArray(e.items) || !e.items.length) return '\u05dc\u05d0 \u05e0\u05de\u05e1\u05e8 \u05e6\u05d9\u05d5\u05d3';
  return e.items.map((i) => i.n + (i.d ? ' (' + i.d + ')' : '') + ' x' + i.q).join(', ') + (e.ret ? '. \u05de\u05d7\u05d6\u05d9\u05e8\u05d9\u05dd \u05dc' + e.ret : '');
}
export const equipChanged = (a, b) => equipSummary(a) !== equipSummary(b);

// Pure. The audit line kept on the row (toolbox_reads.edits): when, what was before and after, how many photos.
export function editEntry(changes, eqOld, eqNew, nDocs, nowMs) {
  return {
    at: new Date(nowMs || Date.now()).toISOString(), by: 'hr',
    changes: changes.map((c) => ({ k: c.k, old: c.old, new: c.new })),
    equip: equipChanged(eqOld, eqNew) ? { old: equipSummary(eqOld), new: equipSummary(eqNew) } : null,
    // The equipment object as it was signed, so a resend of the signed form (op refile) is built from what the worker signed
    // (security review 24/11/2026, finding 1)
    equipOld: equipChanged(eqOld, eqNew) ? (eqOld || null) : undefined,
    docs: nDocs || 0,
  };
}

// Pure. The row as the worker signed it: every correction undone, the latest first. A resend of the signed form is built from
// this, never from the corrected row (the signed copy stays as signed; the corrections live on their own pages).
export function asSigned(row) {
  const out = { ...row };
  const list = Array.isArray(row && row.edits) ? row.edits : [];
  for (let i = list.length - 1; i >= 0; i--) {
    const e = list[i] || {};
    for (const c of (e.changes || [])) out[c.k] = c.old === '' ? null : c.old;
    if (e.equipOld !== undefined && e.equip) out.equip = e.equipOld;
  }
  return out;
}

const TD = 'border:1px solid #999;padding:6px 10px';
const changeRows = (changes, eq) => changes.map((c) => '<tr><td style="' + TD + ';font-weight:bold">' + esc(c.label) + '</td><td style="' + TD + '">' + esc(c.old || '-') + '</td><td style="' + TD + '">' + esc(c.new || '-') + '</td></tr>').join('')
  + (eq ? '<tr><td style="' + TD + ';font-weight:bold">\u05e6\u05d9\u05d5\u05d3 \u05e9\u05e0\u05de\u05e1\u05e8</td><td style="' + TD + '">' + esc(eq.old) + '</td><td style="' + TD + '">' + esc(eq.new) + '</td></tr>' : '');
export const EQ_RESIGN = '\u05d4\u05e6\u05d4\u05e8\u05ea \u05d4\u05e6\u05d9\u05d5\u05d3 \u05d4\u05d7\u05ea\u05d5\u05de\u05d4 \u05d1\u05e7\u05dc\u05d9\u05d8\u05d4 \u05dc\u05d0 \u05e9\u05d5\u05e0\u05ea\u05d4. \u05d9\u05e9 \u05dc\u05d4\u05d7\u05ea\u05d9\u05dd \u05d0\u05ea \u05d4\u05e2\u05d5\u05d1\u05d3 \u05e2\u05dc \u05d4\u05e6\u05d4\u05e8\u05d4 \u05de\u05e2\u05d5\u05d3\u05db\u05e0\u05ea.';

// The correction page, filed beside the signed form (which stays as the worker signed it). `docs` are base64 JPEG photos.
export function correctionHtml(row, entry, docs, when) {
  const eq = entry.equip;
  const changes = entry.changes.map((c) => ({ ...c, label: EDIT_LABELS[c.k] || c.k }));
  return '<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8"><title>\u05d3\u05e3 \u05ea\u05d9\u05e7\u05d5\u05df \u05dc\u05d8\u05d5\u05e4\u05e1 \u05e7\u05dc\u05d9\u05d8\u05d4</title></head>'
    + '<body style="font-family:Arial,sans-serif;font-size:13px;line-height:1.5;margin:24px;color:#111">'
    + '<img alt="' + esc(SITE.shortName) + '" style="height:56px;float:left;margin:0 0 8px 12px" src="data:image/jpeg;base64,' + LOGO_JPG + '">'
    + '<div style="font-size:11px;color:#555">' + esc(SITE.company) + ' - \u05d3\u05e3 \u05ea\u05d9\u05e7\u05d5\u05df \u05dc\u05d8\u05d5\u05e4\u05e1 \u05d4\u05db\u05e0\u05e1\u05ea \u05e2\u05d5\u05d1\u05d3\u05d9\u05dd \u05dc\u05de\u05e9\u05de\u05e8\u05ea, \u05d8\u05d5\u05e4\u05e1 08.02.01</div>'
    + '<h1 style="font-size:18px;margin:4px 0 8px">\u05d3\u05e3 \u05ea\u05d9\u05e7\u05d5\u05df: ' + esc(row.emp_name || '') + '</h1>'
    + '<p>\u05d4\u05d8\u05d5\u05e4\u05e1 \u05d4\u05d7\u05ea\u05d5\u05dd \u05e9\u05dc \u05d4\u05e2\u05d5\u05d1\u05d3 \u05e0\u05e9\u05d0\u05e8 \u05db\u05e4\u05d9 \u05e9\u05e0\u05d7\u05ea\u05dd. \u05d4\u05d3\u05e3 \u05d4\u05d6\u05d4 \u05de\u05ea\u05e2\u05d3 \u05de\u05d4 \u05ea\u05d5\u05e7\u05df \u05d0\u05d5 \u05e0\u05d5\u05e1\u05e3 \u05d0\u05d7\u05e8\u05d9\u05d5.</p>'
    + '<table style="border-collapse:collapse;margin:12px 0">'
    + '<tr><td style="' + TD + ';font-weight:bold">\u05ea\u05d0\u05e8\u05d9\u05da \u05d5\u05e9\u05e2\u05ea \u05d4\u05ea\u05d9\u05e7\u05d5\u05df</td><td style="' + TD + '" colspan="2">' + esc(fdate(when.day)) + ' ' + esc(when.hm) + '</td></tr>'
    + '<tr><td style="' + TD + ';font-weight:bold">\u05e2\u05d5\u05d1\u05d3</td><td style="' + TD + '" colspan="2">' + esc(row.emp_name || '') + '</td></tr>'
    + '<tr><td style="' + TD + ';font-weight:bold">\u05de\u05d6\u05d4\u05d4 \u05e8\u05e9\u05d5\u05de\u05d4</td><td style="' + TD + '" colspan="2">' + esc(row.id || '') + '</td></tr>'
    + (changes.length || eq ? '<tr style="background:#f3f4f6"><td style="' + TD + ';font-weight:bold">\u05de\u05d4 \u05ea\u05d5\u05e7\u05df</td><td style="' + TD + ';font-weight:bold">\u05d4\u05d9\u05d4</td><td style="' + TD + ';font-weight:bold">\u05e2\u05db\u05e9\u05d9\u05d5</td></tr>' + changeRows(changes, eq) : '')
    + (entry.docs ? '<tr><td style="' + TD + ';font-weight:bold">\u05de\u05e1\u05de\u05db\u05d9\u05dd \u05e9\u05e0\u05d5\u05e1\u05e4\u05d5</td><td style="' + TD + '" colspan="2">' + entry.docs + ' (\u05d1\u05e2\u05de\u05d5\u05d3\u05d9\u05dd \u05d4\u05d1\u05d0\u05d9\u05dd)</td></tr>' : '')
    + '</table>'
    + (eq ? '<p style="font-weight:bold">' + esc(EQ_RESIGN) + '</p>' : '')
    + (Array.isArray(docs) ? docs.map((d, n) => '<div style="page-break-before:always;break-before:page"><div style="font-weight:bold;margin:0 0 8px">\u05de\u05e1\u05de\u05da \u05e9\u05e0\u05d5\u05e1\u05e3 ' + (n + 1) + ' \u05de\u05ea\u05d5\u05da ' + docs.length + ' - ' + esc(row.emp_name || '') + '</div>'
      + '<img alt="' + (n + 1) + '" style="max-width:100%;max-height:900px" src="data:image/jpeg;base64,' + d + '"></div>').join('') : '')
    + '<div style="font-size:11px;color:#555">\u05ea\u05d5\u05e7\u05df \u05d3\u05e8\u05da \u05d4\u05e7\u05d9\u05e9\u05d5\u05e8 \u05d1\u05de\u05d9\u05d9\u05dc \u05d4\u05e7\u05dc\u05d9\u05d8\u05d4, \u05e2\u05dd \u05d4\u05e1\u05d9\u05e1\u05de\u05d4 \u05e9\u05dc \u05de\u05e9\u05d0\u05d1\u05d9 \u05d0\u05e0\u05d5\u05e9.</div></body></html>';
}

// The update mail (HR and Michael): what changed, the filed page and a fresh edit link.
export function updateMailHtml(row, entry, pageUrl, newEditUrl, signature) {
  const eq = entry.equip;
  const changes = entry.changes.map((c) => ({ ...c, label: EDIT_LABELS[c.k] || c.k }));
  return '<div dir="rtl" style="direction:rtl;text-align:right;font-family:Arial,sans-serif;font-size:14px">'
    + '<p>\u05ea\u05d5\u05e7\u05e0\u05d4 \u05e7\u05dc\u05d9\u05d8\u05ea \u05d4\u05e2\u05d5\u05d1\u05d3 ' + esc(row.emp_name || '') + '. \u05d4\u05d8\u05d5\u05e4\u05e1 \u05d4\u05d7\u05ea\u05d5\u05dd \u05e0\u05e9\u05d0\u05e8 \u05db\u05e4\u05d9 \u05e9\u05e0\u05d7\u05ea\u05dd, \u05d5\u05d3\u05e3 \u05d4\u05ea\u05d9\u05e7\u05d5\u05df \u05de\u05e6\u05d5\u05e8\u05e3.</p>'
    + '<table style="border-collapse:collapse"><tr style="background:#f3f4f6"><td style="' + TD + ';font-weight:bold">\u05de\u05d4 \u05ea\u05d5\u05e7\u05df</td><td style="' + TD + ';font-weight:bold">\u05d4\u05d9\u05d4</td><td style="' + TD + ';font-weight:bold">\u05e2\u05db\u05e9\u05d9\u05d5</td></tr>'
    + changeRows(changes, eq) + '</table>'
    + (entry.docs ? '<p>\u05e0\u05d5\u05e1\u05e4\u05d5 ' + entry.docs + ' \u05de\u05e1\u05de\u05db\u05d9\u05dd.</p>' : '')
    + (eq ? '<p style="font-weight:bold">' + esc(EQ_RESIGN) + '</p>' : '')
    + (pageUrl ? '<p>\u05d3\u05e3 \u05d4\u05ea\u05d9\u05e7\u05d5\u05df \u05d1\u05ea\u05d9\u05e7\u05d9\u05d9\u05d4: <a href="' + esc(pageUrl) + '">\u05e4\u05ea\u05d9\u05d7\u05d4</a></p>' : '')
    + (newEditUrl ? '<p><a href="' + esc(newEditUrl) + '">\u05dc\u05ea\u05d9\u05e7\u05d5\u05df \u05d0\u05d5 \u05d4\u05d5\u05e1\u05e4\u05d4 \u05e0\u05d5\u05e1\u05e4\u05d9\u05dd</a> (\u05d3\u05d5\u05e8\u05e9 \u05d0\u05ea \u05d4\u05e1\u05d9\u05e1\u05de\u05d4 \u05e9\u05dc \u05de\u05e9\u05d0\u05d1\u05d9 \u05d0\u05e0\u05d5\u05e9, \u05d1\u05ea\u05d5\u05e7\u05e3 ' + EDIT_TTL_DAYS + ' \u05d9\u05de\u05d9\u05dd)</p>' : '')
    + '<p style="color:#666;font-size:12px">\u05e0\u05e9\u05dc\u05d7 \u05d0\u05d5\u05d8\u05d5\u05de\u05d8\u05d9\u05ea \u05de\u05d0\u05e4\u05dc\u05d9\u05e7\u05e6\u05d9\u05d9\u05ea \u05e0\u05d9\u05d4\u05d5\u05dc \u05d4\u05d1\u05d8\u05d9\u05d7\u05d5\u05ea \u05e9\u05dc ' + esc(SITE.company) + '.</p>' + (signature || '') + '</div>';
}

// The line added to the induction mail itself.
export function editLinkHtml(url) {
  return '<p style="border:1px solid #1e3a8a;border-radius:6px;padding:8px 10px;background:#eff6ff">\u05e4\u05e1\u05e4\u05d5\u05e1 \u05d1\u05e7\u05dc\u05d9\u05d8\u05d4? <a href="' + esc(url) + '" style="font-weight:bold">\u05dc\u05d7\u05e6\u05d5 \u05db\u05d0\u05df \u05db\u05d3\u05d9 \u05dc\u05d4\u05d5\u05e1\u05d9\u05e3 \u05d0\u05d5 \u05dc\u05ea\u05e7\u05df</a> \u05e4\u05e8\u05d8\u05d9 \u05e2\u05d5\u05d1\u05d3, \u05e6\u05d9\u05d5\u05d3 \u05e9\u05e0\u05de\u05e1\u05e8 \u05d5\u05de\u05e1\u05de\u05db\u05d9\u05dd. \u05e0\u05d3\u05e8\u05e9\u05ea \u05d4\u05e1\u05d9\u05e1\u05de\u05d4 \u05e9\u05dc \u05de\u05e9\u05d0\u05d1\u05d9 \u05d0\u05e0\u05d5\u05e9, \u05d5\u05d4\u05e7\u05d9\u05e9\u05d5\u05e8 \u05d1\u05ea\u05d5\u05e7\u05e3 ' + EDIT_TTL_DAYS + ' \u05d9\u05de\u05d9\u05dd. \u05d4\u05d8\u05d5\u05e4\u05e1 \u05d4\u05d7\u05ea\u05d5\u05dd \u05e0\u05e9\u05d0\u05e8 \u05db\u05de\u05d5 \u05e9\u05e0\u05d7\u05ea\u05dd, \u05d5\u05e0\u05d5\u05e1\u05e3 \u05dc\u05d5 \u05d3\u05e3 \u05ea\u05d9\u05e7\u05d5\u05df.</p>';
}

// Pure. The equipment of a row as the form's inputs: {q:{index:qty}, d:{index:text}, free:[{n,q}], ret, c}.
export function equipPrefill(e, items, tools, free, retDef) {
  const q = {}, d = {}, fr = [];
  if (e && Array.isArray(e.items)) {
    for (const it of e.items) {
      const i = items.indexOf(it.n);
      if (i >= 0) { q[i] = it.q; if (i === tools && it.d) d[i] = it.d; } else if (fr.length < free) fr.push({ n: it.n, q: it.q });
    }
  }
  const has = e && Array.isArray(e.items) && e.items.length > 0;
  return { q, d, free: fr, ret: (e && e.ret) || retDef, c: has ? 'yes' : 'no' };
}

// The edit form (inner HTML; the caller wraps it in the page). P: {tok, depts, otherDep, items, tools, free, retDef, nonce}.
export function editFormHtml(row, P, flash) {
  const st = 'box-sizing:border-box;width:100%;font-size:16px;padding:10px;border:1px solid #d1d5db;border-radius:8px;margin-bottom:10px';
  const lb = (id, t) => '<label for="' + id + '" style="display:block;font-weight:700;margin-bottom:4px">' + esc(t) + '</label>';
  const inp = (id, name, v, extra) => lb(id, EDIT_LABELS[extra.k]) + '<input id="' + id + '" name="' + name + '" value="' + esc(v) + '" maxlength="' + (extra.max || 60) + '" autocomplete="off" ' + (extra.attrs || '') + ' style="' + st + '">';
  const eq = equipPrefill(row.equip, P.items, P.tools, P.free, P.retDef);
  const qIn = (nm, v) => '<input name="' + nm + '" inputmode="numeric" maxlength="3" autocomplete="off" dir="ltr" placeholder="0" aria-label="\u05db\u05de\u05d5\u05ea" value="' + esc(v || '') + '" style="' + st + ';width:72px;margin:0;text-align:center">';
  const eqRow = (lab, inpHtml) => '<div style="display:flex;gap:8px;align-items:center;margin-bottom:6px"><div style="flex:1">' + lab + '</div>' + inpHtml + '</div>';
  const depOpts = P.depts.concat([P.otherDep]).map((d) => '<option value="' + esc(d) + '"' + (d === row.dept ? ' selected' : '') + '>' + esc(d) + '</option>').join('');
  return (flash ? '<p style="color:#b91c1c;font-weight:700">' + esc(flash) + '</p>' : '')
    + '<p>\u05ea\u05d9\u05e7\u05d5\u05df \u05e7\u05dc\u05d9\u05d8\u05d4 \u05e9\u05dc <b>' + esc(row.emp_name || '') + '</b>. \u05de\u05e9\u05e0\u05d9\u05dd \u05e8\u05e7 \u05de\u05d4 \u05e9\u05e6\u05e8\u05d9\u05da. \u05d4\u05d8\u05d5\u05e4\u05e1 \u05d4\u05d7\u05ea\u05d5\u05dd \u05e0\u05e9\u05d0\u05e8 \u05db\u05de\u05d5 \u05e9\u05e0\u05d7\u05ea\u05dd, \u05d5\u05e0\u05d5\u05e1\u05e3 \u05dc\u05d5 \u05d3\u05e3 \u05ea\u05d9\u05e7\u05d5\u05df \u05e2\u05dd \u05de\u05d4 \u05e9\u05e9\u05d5\u05e0\u05d4.</p>'
    + '<form id="ef" method="POST" action="/api/talk?op=edit"><input type="hidden" name="e" value="' + esc(P.tok) + '">'
    + inp('ename', 'ename', row.emp_name, { k: 'emp_name' }) + inp('eid', 'eid', row.id_no, { k: 'id_no', max: 12, attrs: 'dir="ltr" inputmode="numeric"' })
    + inp('ino', 'ino', row.emp_no, { k: 'emp_no', max: 12, attrs: 'dir="ltr" inputmode="numeric"' })
    + lb('idep', EDIT_LABELS.dept) + '<select id="idep" name="idep" style="' + st + '">' + depOpts + '</select>'
    + inp('iph', 'iph', row.phone, { k: 'phone', max: 20, attrs: 'type="tel" dir="ltr" inputmode="tel"' }) + inp('ijob', 'ijob', row.job, { k: 'job' }) + inp('iagn', 'iagn', row.agency, { k: 'agency' })
    + '<div style="border:2px solid #1e3a8a;border-radius:8px;padding:10px 12px;margin-bottom:12px"><div style="font-weight:700;color:#1e3a8a;margin-bottom:6px">\u05e6\u05d9\u05d5\u05d3 \u05e9\u05e0\u05de\u05e1\u05e8 \u05dc\u05e2\u05d5\u05d1\u05d3</div>'
    + '<label style="display:flex;gap:8px;align-items:center;margin:4px 0;font-weight:700"><input type="radio" name="eqc" value="yes" required' + (eq.c === 'yes' ? ' checked' : '') + ' style="width:22px;height:22px">\u05e0\u05de\u05e1\u05e8 \u05e6\u05d9\u05d5\u05d3 (\u05dc\u05e8\u05e9\u05d5\u05dd \u05db\u05de\u05d5\u05ea \u05dc\u05db\u05dc \u05e4\u05e8\u05d9\u05d8)</label>'
    + '<label style="display:flex;gap:8px;align-items:center;margin:4px 0;font-weight:700"><input type="radio" name="eqc" value="no" required' + (eq.c === 'no' ? ' checked' : '') + ' style="width:22px;height:22px">\u05dc\u05d0 \u05e0\u05de\u05e1\u05e8 \u05e6\u05d9\u05d5\u05d3</label>'
    + P.items.map((n, i) => eqRow('<label>' + esc(n) + '</label>' + (i === P.tools ? '<input name="eqd' + i + '" maxlength="80" autocomplete="off" placeholder="\u05e4\u05d9\u05e8\u05d5\u05d8 \u05db\u05dc\u05d9 \u05d4\u05e2\u05d1\u05d5\u05d3\u05d4" aria-label="\u05e4\u05d9\u05e8\u05d5\u05d8 \u05db\u05dc\u05d9 \u05d4\u05e2\u05d1\u05d5\u05d3\u05d4" value="' + esc(eq.d[i] || '') + '" style="' + st + ';margin:4px 0 0">' : ''), qIn('eqq' + i, eq.q[i]))).join('')
    + Array.from({ length: P.free }, (_, i) => eqRow('<input name="eqn' + i + '" maxlength="40" autocomplete="off" placeholder="\u05e4\u05e8\u05d9\u05d8 \u05e0\u05d5\u05e1\u05e3" aria-label="\u05e4\u05e8\u05d9\u05d8 \u05e0\u05d5\u05e1\u05e3" value="' + esc((eq.free[i] || {}).n || '') + '" style="' + st + ';margin:0">', qIn('eqf' + i, (eq.free[i] || {}).q))).join('')
    + '<label for="eqr" style="display:block;font-weight:700;margin:8px 0 4px">\u05de\u05d7\u05d6\u05d9\u05e8\u05d9\u05dd \u05d1\u05e1\u05d9\u05d5\u05dd \u05d4\u05e2\u05d1\u05d5\u05d3\u05d4 \u05dc</label><input name="eqr" id="eqr" maxlength="40" autocomplete="off" value="' + esc(eq.ret) + '" style="' + st + ';margin:0">'
    + '<div style="font-size:13px;color:#6b7280;margin-top:6px">\u05e9\u05d9\u05e0\u05d5\u05d9 \u05d1\u05e6\u05d9\u05d5\u05d3 \u05dc\u05d0 \u05de\u05e9\u05e0\u05d4 \u05d0\u05ea \u05d4\u05d4\u05e6\u05d4\u05e8\u05d4 \u05d4\u05d7\u05ea\u05d5\u05de\u05d4: \u05d4\u05e2\u05d5\u05d1\u05d3 \u05d9\u05e6\u05d8\u05e8\u05da \u05dc\u05d7\u05ea\u05d5\u05dd \u05de\u05d7\u05d3\u05e9 \u05e2\u05dc \u05d4\u05e6\u05d4\u05e8\u05d4 \u05de\u05e2\u05d5\u05d3\u05db\u05e0\u05ea.</div></div>'
    + '<div style="font-weight:700;margin-bottom:4px">\u05d4\u05d5\u05e1\u05e4\u05ea \u05de\u05e1\u05de\u05db\u05d9\u05dd (\u05e6\u05d9\u05dc\u05d5\u05dd \u05d0\u05d5 \u05ea\u05de\u05d5\u05e0\u05d4, \u05d0\u05e4\u05e9\u05e8 \u05db\u05de\u05d4)</div>'
    + '<label style="display:block;text-align:center;padding:12px;margin-bottom:6px;border:2px solid #1e3a8a;border-radius:8px;background:#eff6ff;color:#1e3a8a;font-size:17px;font-weight:700;cursor:pointer">\u05e6\u05d9\u05dc\u05d5\u05dd \u05d0\u05d5 \u05d1\u05d7\u05d9\u05e8\u05ea \u05ea\u05de\u05d5\u05e0\u05d4<input type="file" id="efile" accept="image/*" multiple style="position:absolute;width:1px;height:1px;opacity:0"></label>'
    + '<div id="ebox"></div><div id="ecnt" style="font-size:13px;color:#374151;margin-bottom:12px"></div>'
    + '<button type="submit" id="ego" style="display:block;width:100%;padding:14px;border:0;border-radius:10px;background:#15803d;color:#fff;font-size:18px;font-weight:700">\u05e9\u05de\u05d9\u05e8\u05ea \u05d4\u05ea\u05d9\u05e7\u05d5\u05df</button></form>'
    + '<script nonce="' + esc(P.nonce) + '">' + EDIT_SCRIPT + '</script>';
}

// The photos: each picture is drawn smaller on a canvas and kept as a JPEG in a hidden field "doc" (as the induction page does),
// up to 8 and under the server's limits. One press sends once.
export const EDIT_SCRIPT = '(function(){var f=document.getElementById("efile"),box=document.getElementById("ebox"),c=document.getElementById("ecnt"),form=document.getElementById("ef"),go=document.getElementById("ego");if(!f||!box||!form)return;'
  + 'var MAX=8,TOT=3800000,sum=0;function cnt(){var n=box.querySelectorAll("input[name=doc]").length;c.textContent=n?"\u05e0\u05d1\u05d7\u05e8\u05d5 "+n+" \u05de\u05e1\u05de\u05db\u05d9\u05dd":"";}'
  + 'function add(file){return new Promise(function(ok){var im=new Image(),rd=new FileReader();im.onload=function(){var s=Math.min(1,1400/Math.max(im.width,im.height)),cv=document.createElement("canvas");cv.width=Math.round(im.width*s);cv.height=Math.round(im.height*s);cv.getContext("2d").drawImage(im,0,0,cv.width,cv.height);'
  + 'var q=0.7,d=cv.toDataURL("image/jpeg",q);while(d.length*0.75>600000&&q>0.3){q-=0.1;d=cv.toDataURL("image/jpeg",q);}'
  + 'if(box.querySelectorAll("input[name=doc]").length>=MAX||sum+d.length*0.75>TOT){c.textContent="\u05d0\u05d9 \u05d0\u05e4\u05e9\u05e8 \u05dc\u05d4\u05d5\u05e1\u05d9\u05e3 \u05e2\u05d5\u05d3 \u05de\u05e1\u05de\u05db\u05d9\u05dd \u05d1\u05e9\u05dc\u05d9\u05d7\u05d4 \u05d0\u05d7\u05ea";ok();return;}sum+=d.length*0.75;var h=document.createElement("input");h.type="hidden";h.name="doc";h.value=d;box.appendChild(h);ok();};im.onerror=function(){ok();};rd.onload=function(){im.src=rd.result;};rd.onerror=function(){ok();};rd.readAsDataURL(file);});}'
  + 'f.addEventListener("change",function(){var l=Array.prototype.slice.call(f.files||[]),p=Promise.resolve();l.forEach(function(x){p=p.then(function(){return add(x);});});p.then(function(){f.value="";cnt();});});'
  + 'form.addEventListener("submit",function(){go.disabled=true;setTimeout(function(){go.disabled=false;},45000);});window.addEventListener("pageshow",function(e){if(e.persisted)go.disabled=false;});})();';
