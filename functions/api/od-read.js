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
import { jsonResp } from '../_shared.js';
import { odConfigured, accessToken } from '../_onedrive.js';
import { readSheetRows, sheetNames } from '../_xlsxpatch.js';

export const ROOT = 'שולחן העבודה/ניהול בטיחות/';
const G = 'https://graph.microsoft.com/v1.0/me/drive/root:/';
const seg = (p) => String(p).split('/').filter(Boolean).map(encodeURIComponent).join('/');

export function safePath(p) {
  const parts = String(p || '').split('/').filter(Boolean);
  if (!parts.length || parts.some((x) => x === '..' || x === '.') || !/\.xls[xm]$/i.test(parts[parts.length - 1])) return null;
  return ROOT + parts.join('/');
}

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method !== 'POST') return jsonResp({ error: 'method not allowed' }, 405, {});
  const want = env.TRUSTEE_NOTIFY_SECRET;
  if (!want || (request.headers.get('x-notify-secret') || '') !== want) return jsonResp({ error: 'forbidden' }, 403, {});
  if (!odConfigured(env)) return jsonResp({ ok: false, error: 'server not configured' }, 200, {});
  let body = {}; try { body = await request.json(); } catch (e) {}
  const full = safePath(body.path);
  if (!full) return jsonResp({ ok: false, error: 'bad path' }, 400, {});
  try {
    const { token } = await accessToken(env);
    const r = await fetch(G + seg(full) + ':/content', { headers: { Authorization: 'Bearer ' + token } });
    if (!r.ok) return jsonResp({ ok: false, error: 'onedrive ' + r.status, path: full }, 200, {});
    const bytes = new Uint8Array(await r.arrayBuffer());
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
