// Cloudflare Pages Function: read one sheet of a workbook in sviva's OneDrive
// safety folder, server to server only (28/09). Used to learn the layout of
// the sheets the department report and the meeting data are built from
// ("נמענים" / "דוח לשליחה" in the folder-13 workbook, the accidents table in
// folder 12) instead of guessing it. Read-only: it never writes to OneDrive.
//
// POST {path, sheet?, from?, to?, cols?}, header x-notify-secret (same secret
// as hazard-file; called from the database with pg_net). path is relative to
// "שולחן העבודה/ניהול בטיחות/" and cannot leave it. Without sheet: the tab
// names. With sheet: rows from..to (default 1..60), columns A..(cols, max 26).
// A .pptx: its slides, shape texts, tables and chart series (_pptx.js).
// part: one XML part of the file as text (60KB at a time, from offset).
import { jsonResp } from '../_shared.js';
import { odConfigured, accessToken, stateGet } from '../_onedrive.js';
import { readSheetRows, sheetNames, readZip, entryText } from '../_xlsxpatch.js';
import { pptxOutline } from '../_pptx.js';

export const ROOT = '\u05e9\u05d5\u05dc\u05d7\u05df \u05d4\u05e2\u05d1\u05d5\u05d3\u05d4/\u05e0\u05d9\u05d4\u05d5\u05dc \u05d1\u05d8\u05d9\u05d7\u05d5\u05ea/';
const G = 'https://graph.microsoft.com/v1.0/me/drive/root:/';
const seg = (p) => String(p).split('/').filter(Boolean).map(encodeURIComponent).join('/');

export function safePath(p) {
  const parts = String(p || '').split('/').filter(Boolean);
  if (!parts.length || parts.some((x) => x === '..' || x === '.') || !/\.(xls[xm]|pptx)$/i.test(parts[parts.length - 1])) return null;
  return ROOT + parts.join('/');
}

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method !== 'POST') return jsonResp({ error: 'method not allowed' }, 405, {});
  const want = env.TRUSTEE_NOTIFY_SECRET;
  let body = {}; try { body = await request.json(); } catch (e) {}
  // The file itself (to render the deck and compare it with the archive,
  // 28/09): a one-off token, never the server secret. It is put in
  // server_state (od_raw_token + od_raw_exp) from the database by whoever may
  // run SQL there, lasts minutes, and allows only this download.
  const rawTok = request.headers.get('x-raw-token') || '';
  let rawOk = false;
  if (body.raw === true && rawTok.length >= 32) {
    const st = await stateGet(env, ['od_raw_token', 'od_raw_exp']).catch(() => ({}));
    const t = st.od_raw_token && st.od_raw_token.value, x = st.od_raw_exp && st.od_raw_exp.value;
    rawOk = !!t && t === rawTok && !!x && Date.parse(x) > Date.now();
  }
  if (!rawOk && (!want || (request.headers.get('x-notify-secret') || '') !== want)) return jsonResp({ error: 'forbidden' }, 403, {});
  if (!odConfigured(env)) return jsonResp({ ok: false, error: 'server not configured' }, 200, {});
  const full = safePath(body.path);
  if (!full) return jsonResp({ ok: false, error: 'bad path' }, 400, {});
  try {
    const { token } = await accessToken(env);
    const r = await fetch(G + seg(full) + ':/content', { headers: { Authorization: 'Bearer ' + token } });
    if (!r.ok) return jsonResp({ ok: false, error: 'onedrive ' + r.status, path: full }, 200, {});
    const bytes = new Uint8Array(await r.arrayBuffer());
    if (body.raw === true) {
      if (!rawOk) return jsonResp({ error: 'forbidden' }, 403, {});
      return new Response(bytes, { status: 200, headers: { 'Content-Type': 'application/octet-stream', 'Cache-Control': 'no-store' } });
    }
    // One XML part as text (to see how a slide or chart is built), capped.
    if (body.part) {
      const e = readZip(bytes).find((x) => x.name === String(body.part));
      if (!e || !/\.(xml|rels)$/.test(e.name)) return jsonResp({ ok: false, error: 'no such xml part' }, 200, {});
      const t = await entryText(e);
      const from = Math.max(0, +body.offset || 0);
      return jsonResp({ ok: true, path: full, part: e.name, length: t.length, offset: from, text: t.substring(from, from + 60000) }, 200, {});
    }
    if (/\.pptx$/i.test(full)) return jsonResp({ ok: true, path: full, deck: await pptxOutline(bytes) }, 200, {});
    const sheets = await sheetNames(bytes);
    if (!body.sheet) return jsonResp({ ok: true, path: full, sheets }, 200, {});
    const from = Math.max(1, +body.from || 1), to = Math.min(from + 199, +body.to || 60);
    const cols = Math.min(26, Math.max(1, +body.cols || 16));
    const rows = await readSheetRows(bytes, { sheet: String(body.sheet), minRow: from, maxRow: to, lastCol: cols - 1, dateCols: [] });
    return jsonResp({ ok: true, path: full, sheets, sheet: body.sheet, rows: rows.map((x) => ({ r: x.r, v: x.v })) }, 200, {});
  } catch (e) {
    return jsonResp({ ok: false, error: String((e && e.message) || e).substring(0, 200) }, 200, {});
  }
}
