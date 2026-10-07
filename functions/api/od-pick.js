// Cloudflare Pages Function: pick a file that is already in the safety folder (07/10/2026,
// Michael: "all the files in one place, not uploaded twice"; he approved the plan in a
// questionnaire). The app keeps 'od:<item id>|<name>' in file_url instead of a second copy.
//
// POST {op, ...} with the manager's session (admin / manager only):
//   list   {path}  the folders and files of one folder inside "שולחן העבודה/ניהול בטיחות"
//   search {q}     files by name, inside the safety folder only
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
      const j = await get(G + '/root:/' + seg(ROOT) + ":/search(q='" + encodeURIComponent(q) + "')?$select=" + SEL + '&$top=50');
      const items = (j.value || []).filter((x) => !x.folder && insideRoot(x.parentReference)).map((x) => {
        const it = item(x); let p = ''; try { p = decodeURIComponent(String(x.parentReference.path)); } catch (e) {}
        it.where = p.substring(ROOT_REF.length + 1);
        return it;
      });
      return jsonResp({ ok: true, items }, 200, cors);
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
