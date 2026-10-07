// Cloudflare Pages Function: pick a file that is already in the safety folder (07/10/2026,
// Michael: "all the files in one place, not uploaded twice"; he approved the plan in a
// questionnaire). The app keeps 'od:<item id>|<name>' in file_url instead of a second copy.
//
// POST {op, ...} with the manager's session (admin / manager only):
//   list   {path}  the folders and files of one folder inside "שולחן העבודה/ניהול בטיחות"
//   search {q}     files by name, inside the safety folder only (up to 100; more:true = refine)
//   url    {id}    the item's current webUrl and name, so a link survives a move or a rename
// Read only: every call to Microsoft Graph is a GET. Nothing is written, moved or shared
// (m365-guard). An item outside the safety folder is refused, even by id.
import { defaultAllowedOrigins, corsHeaders, jsonResp, requireRole } from '../_shared.js';
import { odConfigured, accessToken } from '../_onedrive.js';
import { ROOT, safeDir } from './od-read.js';

const G = 'https://graph.microsoft.com/v1.0/me/drive';
const seg = (p) => String(p).split('/').filter(Boolean).map(encodeURIComponent).join('/');
const SEL = 'id,name,size,folder,file,lastModifiedDateTime,parentReference';
export const ROOT_REF = '/drive/root:/' + ROOT.replace(/\/$/, '');

// parentReference.path of an item inside the safety folder (Graph sends it URL-encoded at times).
export function insideRoot(ref) {
  let p = String((ref && ref.path) || '');
  try { p = decodeURIComponent(p); } catch (e) { return false; }
  return p === ROOT_REF || p.indexOf(ROOT_REF + '/') === 0;
}
export const ID_RE = /^[A-Za-z0-9!._-]{5,120}$/;
const item = (x) => ({ id: x.id, name: x.name, dir: !!x.folder, n: x.folder ? x.folder.childCount : undefined, size: x.size, mod: x.lastModifiedDateTime });
const byName = (a, b) => (a.dir === b.dir ? String(a.name).localeCompare(String(b.name), 'he') : a.dir ? -1 : 1);

export async function onRequest(context) {
  const { request, env } = context;
  const cors = corsHeaders(request.headers.get('Origin') || '', defaultAllowedOrigins(env), 'POST,OPTIONS');
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (request.method !== 'POST') return jsonResp({ error: 'method not allowed' }, 405, cors);
  const who = await requireRole(request, env, ['admin', 'manager']);
  if (!who.ok) return jsonResp({ error: who.error }, who.status, cors);
  if (!odConfigured(env)) return jsonResp({ ok: false, error: 'server not configured' }, 200, cors);
  let body = {}; try { body = await request.json(); } catch (e) {}
  const get = async (url) => {
    const { token } = await accessToken(env);
    const r = await fetch(url, { headers: { Authorization: 'Bearer ' + token } });
    if (!r.ok) throw new Error('onedrive ' + r.status);
    return r.json();
  };
  try {
    if (body.op === 'list') {
      const dir = safeDir(body.path);
      if (!dir) return jsonResp({ ok: false, error: 'bad path' }, 400, cors);
      const j = await get(G + '/root:/' + seg(dir) + ':/children?$select=' + SEL + '&$top=200');
      return jsonResp({ ok: true, path: dir.substring(ROOT.length), items: (j.value || []).map(item).sort(byName) }, 200, cors);
    }
    if (body.op === 'search') {
      const q = String(body.q || '').replace(/['\\]/g, ' ').trim().substring(0, 60);
      if (q.length < 2) return jsonResp({ ok: false, error: 'bad query' }, 400, cors);
      // 07/10/2026: folder 15 alone holds 80+ files named "נוהל", and the drive-wide search kept
      // 25 of its first 50 hits with no word that more existed. Now: search inside the safety
      // folder (drive-wide only if Graph refuses that), up to 2 pages of 200. A hit carries no
      // path, so each parent folder is read once (at most MAX_PAR) for "where" and to prove it
      // sits in the safety folder. more = something was left out; the app says so.
      const MAX_PAR = 30, MAX_HITS = 100;
      const qs = "/search(q='" + encodeURIComponent(q) + "')?$select=id,name,size,folder,file,lastModifiedDateTime,parentReference&$top=200";
      let scope = 'folder', j;
      try { j = await get(G + '/root:/' + seg(ROOT) + ':' + qs); } catch (e) { scope = 'drive'; j = await get(G + '/root' + qs); }
      let hits = j.value || [], next = j['@odata.nextLink'] || '';
      if (next.indexOf('https://graph.microsoft.com/') === 0) { const j2 = await get(next); hits = hits.concat(j2.value || []); next = j2['@odata.nextLink'] || ''; }
      let more = !!next;
      hits = hits.filter((x) => x && !x.folder && ID_RE.test(String(x.id || '')) && x.parentReference && ID_RE.test(String(x.parentReference.id || '')));
      const pids = [...new Set(hits.map((x) => x.parentReference.id))];
      if (pids.length > MAX_PAR) more = true;
      const where = {};
      await Promise.all(pids.slice(0, MAX_PAR).map((id) => get(G + '/items/' + encodeURIComponent(id) + '?$select=id,name,parentReference').then((d) => {
        let full = ''; try { full = decodeURIComponent(String((d.parentReference && d.parentReference.path) || '')) + '/' + d.name; } catch (e) { return; }
        if (full === ROOT_REF || full.indexOf(ROOT_REF + '/') === 0) where[id] = full.substring(ROOT_REF.length + 1);
      }).catch(() => {})));
      const inside = hits.filter((x) => Object.prototype.hasOwnProperty.call(where, x.parentReference.id));
      if (inside.length > MAX_HITS) more = true;
      const items = inside.slice(0, MAX_HITS).map((x) => { const it = item(x); it.where = where[x.parentReference.id]; return it; });
      return jsonResp({ ok: true, items, more, scope }, 200, cors);
    }
    if (body.op === 'url') {
      const id = String(body.id || '');
      if (!ID_RE.test(id)) return jsonResp({ ok: false, error: 'bad id' }, 400, cors);
      const x = await get(G + '/items/' + encodeURIComponent(id) + '?$select=id,name,webUrl,parentReference');
      if (!insideRoot(x.parentReference)) return jsonResp({ ok: false, error: 'outside the safety folder' }, 403, cors);
      return jsonResp({ ok: true, id: x.id, name: x.name, url: x.webUrl }, 200, cors);
    }
    return jsonResp({ ok: false, error: 'bad op' }, 400, cors);
  } catch (e) {
    return jsonResp({ ok: false, error: String((e && e.message) || e).substring(0, 200) }, 200, cors);
  }
}
