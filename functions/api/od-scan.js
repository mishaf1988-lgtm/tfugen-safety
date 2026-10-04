// Cloudflare Pages Function: which files were ADDED to Michael's OneDrive
// safety folder (04/10/2026, Michael: "approve all", handoff "monthly scan of
// the folder for the assistant").
//
// A walk of the whole folder tree did not end in 10 minutes from the cloud,
// and one Pages Function has 50 subrequests. So no file list is kept at all:
// Graph's delta feed (driveItem delta, OneDrive for Business) gives, page by
// page, what changed in the drive since the link of the last run. Only a file
// created after that link was taken (createdDateTime >= since), not deleted,
// and inside "<ROOT>" counts; the Excel registers that change every day are
// modified, not created, and stay out.
//
// Delta items carry no parentReference.path (Graph docs, Remarks), only the
// parent id. The path is rebuilt from the folders seen in the same run, and a
// parent never seen is looked up once (GET items/{id}, path included there),
// LOOKUP_MAX per run. A run that runs out of pages or lookups keeps the page
// it stopped at (next) and the next run starts there; a file seen twice is
// kept once (by id).
//
// pg_cron calls it every night with the Vault secret (private.od_scan_tick).
// The result is server_state.od_scan (service role only; the repo is public,
// so the names never go to the repo): the files of the last KEEP_DAYS, the
// link, and ok/error. The weekly mail lists the files of the last 7 days and
// names a failed or stale scan; once a month a Routine reads the regulatory
// ones (project-files/routine-od-scan.md).
import { jsonResp } from '../_shared.js';
import { odConfigured, accessToken, stateGet, stateSet } from '../_onedrive.js';
import { ROOT } from './od-read.js';

export const STATE_KEY = 'od_scan';
export const PAGE_MAX = 25, LOOKUP_MAX = 10;
export const KEEP_DAYS = 62, KEEP_MAX = 200;
const G = 'https://graph.microsoft.com/v1.0/me/drive';
const DAY = 86400000;
const BASE = '/drive/root:/' + ROOT.replace(/\/$/, '');

// A folder's parentReference.path + its name -> its path under the safety
// folder ('' is never returned here: the folder itself is matched by id), or
// null when it is outside.
export function relPath(parentPath, name) {
  let p = String(parentPath || '');
  try { p = decodeURIComponent(p); } catch (e) {}
  if (p === BASE) return name;
  if (p.startsWith(BASE + '/')) return p.slice(BASE.length + 1) + '/' + name;
  return null;
}

// Newest first, one per id, nothing older than KEEP_DAYS, at most KEEP_MAX.
export function keepFiles(old, found, nowMs) {
  const by = new Map();
  [...(old || []), ...(found || [])].forEach((f) => { if (f && f.id) by.set(f.id, f); });
  return [...by.values()]
    .filter((f) => nowMs - Date.parse(f.c) <= KEEP_DAYS * DAY)
    .sort((a, b) => String(b.c).localeCompare(String(a.c)))
    .slice(0, KEEP_MAX);
}

// One pass over the delta pages from url. get(url) -> {status, json}. Returns
// {found, next, link, pages, lookups, gone}: next = the page to start from next
// time (budget ran out), link = the new delta link (feed read to its end).
export async function scanPages(get, url, rootId, since) {
  const folders = new Map(), memo = new Map(), found = [];
  let pages = 0, lookups = 0;
  const dirOf = async (id) => {
    if (!id) return null;
    if (id === rootId) return '';
    if (memo.has(id)) return memo.get(id);
    let r;
    const f = folders.get(id);
    if (f) {
      const up = await dirOf(f.parent);
      if (up === undefined) return undefined;
      r = up === null ? null : (up ? up + '/' : '') + f.name;
    } else {
      if (lookups >= LOOKUP_MAX) return undefined;
      lookups++;
      const x = await get(G + '/items/' + encodeURIComponent(id) + '?$select=id,name,parentReference');
      if (x.status === 404) r = null;
      else if (x.status !== 200) throw new Error('lookup ' + x.status);
      else r = x.json.parentReference ? relPath(x.json.parentReference.path, x.json.name) : null;
    }
    memo.set(id, r);
    return r;
  };
  while (url && pages < PAGE_MAX) {
    const x = await get(url);
    if (x.status === 410) return { found, next: null, link: null, pages, lookups, gone: true };
    if (x.status !== 200) throw new Error('delta ' + x.status);
    pages++;
    const items = x.json.value || [];
    items.forEach((it) => { if (it.folder && !it.deleted) folders.set(it.id, { name: it.name, parent: it.parentReference && it.parentReference.id }); });
    for (const it of items) {
      if (!it.file || it.deleted || !it.createdDateTime || it.createdDateTime < since) continue;
      const dir = await dirOf(it.parentReference && it.parentReference.id);
      if (dir === undefined) return { found, next: url, link: null, pages, lookups };
      if (dir !== null) found.push({ id: it.id, p: (dir ? dir + '/' : '') + it.name, c: it.createdDateTime, size: it.size || 0 });
    }
    if (x.json['@odata.nextLink']) url = x.json['@odata.nextLink'];
    else return { found, next: null, link: x.json['@odata.deltaLink'] || null, pages, lookups };
  }
  return { found, next: url, link: null, pages, lookups };
}

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method !== 'POST') return jsonResp({ error: 'method not allowed' }, 405, {});
  const want = env.TRUSTEE_NOTIFY_SECRET;
  if (!want || (request.headers.get('x-notify-secret') || '') !== want) return jsonResp({ error: 'forbidden' }, 403, {});
  if (!odConfigured(env) || !env.SUPABASE_SERVICE_ROLE_KEY) return jsonResp({ ok: false, error: 'server not configured' }, 200, {});
  const st = await stateGet(env, [STATE_KEY]).catch(() => ({}));
  let s = {}; try { s = JSON.parse((st[STATE_KEY] && st[STATE_KEY].value) || '{}') || {}; } catch (e) { s = {}; }
  const now = new Date().toISOString();
  const save = async (o) => { const v = Object.assign({}, s, o, { at: now }); await stateSet(env, { [STATE_KEY]: JSON.stringify(v) }).catch(() => {}); return v; };
  try {
    const { token } = await accessToken(env);
    const get = async (u) => {
      const r = await fetch(u, { headers: { Authorization: 'Bearer ' + token } });
      return { status: r.status, json: r.status === 200 ? await r.json() : null };
    };
    // The start line: from now on, no enumeration of what is already there.
    const baseline = async (why) => {
      const x = await get(G + '/root/delta?token=latest');
      if (x.status !== 200 || !x.json['@odata.deltaLink']) throw new Error('delta latest ' + x.status);
      return save({ ok: !why, error: why || '', link: x.json['@odata.deltaLink'], next: null, since: now, pass: null, added: 0 });
    };
    if (!s.root) {
      const x = await get(G + '/root:/' + ROOT.replace(/\/$/, '').split('/').map(encodeURIComponent).join('/') + '?$select=id');
      if (x.status !== 200 || !x.json.id) throw new Error('root ' + x.status);
      s.root = x.json.id;
    }
    if (!s.link) return jsonResp(Object.assign({ baseline: true }, await baseline()), 200, {});
    const pass = s.next ? (s.pass || now) : now;
    const r = await scanPages(get, s.next || s.link, s.root, s.since || now);
    const files = keepFiles(s.files, r.found, Date.now());
    if (r.gone) {
      // The link expired (410): start again from now; whatever came in between is lost, and the mail says so.
      s.files = files;
      const v = await baseline('resync: link expired, files added since ' + (s.since || '?') + ' may be missing');
      return jsonResp({ ok: false, error: v.error, added: r.found.length }, 200, {});
    }
    const v = await save(r.link
      ? { ok: true, error: '', files, link: r.link, next: null, since: pass, pass: null, added: r.found.length, pages: r.pages, lookups: r.lookups }
      : { ok: true, error: '', files, next: r.next, pass, added: r.found.length, pages: r.pages, lookups: r.lookups });
    return jsonResp({ ok: true, added: r.found.length, pending: !!v.next, pages: r.pages, lookups: r.lookups, files: files.length }, 200, {});
  } catch (e) {
    const why = String((e && e.message) || e).substring(0, 200);
    await save({ ok: false, error: why });
    return jsonResp({ ok: false, error: why }, 200, {});
  }
}
