// Cloudflare Pages Function: the weekly safety talk, read and signed by each
// worker (stage 2, 03/10/2026).
//
// Michael, 03/10/2026: every worker reads the weekly talk and signs at the end,
// instead of one group signature through Vitre. Workers have no account.
// Identity: "name from the list + finger signature". Device: a personal phone
// and a shared tablet. So this is a link, not a login:
//
//   POST JSON {op:'link', id}   manager/admin only (bearer token): returns a
//                               signed link to one published talk, valid 14 days
//   GET  ?k=<token>             a light page served from here (not index.html,
//                               1.4MB, which a cheap phone on site loads slowly):
//                               the talk, a name list, a finger-signature box
//   POST form                   saves the signature PNG to Storage and one row
//                               in toolbox_reads (service key)
//
// Why a server page and not an anonymous session (DECISIONS 03/10/2026): the
// database gets no new anonymous door. The link holder can do exactly two
// things, read one published talk and sign it once per worker; the unique
// index toolbox_reads(talk_id, emp_id) refuses a second signature, so a leaked
// link writes at most one row per worker. The link shows the names of the
// workers (Michael's choice: a name from a list); it shows no phone, no id
// number and nothing about who already signed.
// Not in MACHINE_PATHS: a person opens it, so the Israel-only rule applies.
import { defaultAllowedOrigins, corsHeaders, jsonResp, isAllowedCaller, requireRole } from '../_shared.js';
import { makeLinkToken, readLinkToken } from '../_closelink.js';

const SB = 'https://znhjtpcltrxxyfjczgvw.supabase.co';
const APP_URL = 'https://tapugan-safety.pages.dev';
const BUCKET = 'incidents-photos';
const PREFIX = 'talk-link:v1:';
export const TALK_TTL_DAYS = 14;
const S_PUB = '\u05e4\u05d5\u05e8\u05e1\u05de\u05d4';
const MAX_SIG = 300 * 1024;
const MIN_SIG = 400;

function esc(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function sbH(env, extra) {
  const k = env.SUPABASE_SERVICE_ROLE_KEY;
  return { apikey: k, Authorization: 'Bearer ' + k, ...(extra || {}) };
}
function newId() { return Date.now().toString(36) + Math.random().toString(36).substring(2, 6); }
function fdate(d) { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(d || '')); return m ? m[3] + '/' + m[2] + '/' + m[1] : ''; }
export function deviceOf(ua) {
  ua = String(ua || '');
  if (/iPad|Tablet|Android(?!.*Mobile)/i.test(ua)) return 'tablet';
  if (/Mobile|iPhone|Android/i.test(ua)) return 'phone';
  return 'other';
}

export function talkUrl(tok) { return APP_URL + '/api/talk?k=' + encodeURIComponent(tok); }
export function makeTalkToken(env, id, nowMs) { return makeLinkToken(env, PREFIX, id, TALK_TTL_DAYS, nowMs); }
export function readTalkToken(env, tok, nowMs) { return readLinkToken(env, PREFIX, tok, nowMs); }

function headers(nonce) {
  return {
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': 'no-store',
    'Referrer-Policy': 'no-referrer',
    'X-Robots-Tag': 'noindex, nofollow',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; img-src data:; "
      + (nonce ? "script-src 'nonce-" + nonce + "'; " : '')
      + "form-action 'self'; base-uri 'none'; frame-ancestors 'none'",
  };
}

export function page(title, inner, tone, status, nonce) {
  const color = tone === 'ok' ? '#15803d' : tone === 'err' ? '#cc1f1f' : '#1e3a8a';
  const html = '<!doctype html><html lang="he" dir="rtl"><head><meta charset="UTF-8">'
    + '<meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex, nofollow">'
    + '<title>\u05d4\u05d3\u05e8\u05db\u05d4 \u05e9\u05d1\u05d5\u05e2\u05d9\u05ea</title></head>'
    + '<body style="font-family:Arial,Heebo,sans-serif;background:#f5f7fa;margin:0;padding:12px">'
    + '<div style="background:#fff;border-radius:12px;max-width:560px;margin:0 auto;box-shadow:0 4px 20px rgba(0,0,0,.08);overflow:hidden">'
    + '<div style="background:' + color + ';color:#fff;padding:14px 18px;font-size:18px;font-weight:700">' + esc(title) + '</div>'
    + '<div style="padding:16px 18px;font-size:16px;line-height:1.7;color:#1f2937">' + inner + '</div>'
    + '<div style="padding:10px 18px;background:#f9fafb;font-size:11px;color:#9ca3af">\u05ea\u05e2\u05e9\u05d9\u05d5\u05ea \u05ea\u05e4\u05d5\u05d2\u05df - \u05e0\u05d9\u05d4\u05d5\u05dc \u05d1\u05d8\u05d9\u05d7\u05d5\u05ea</div>'
    + '</div></body></html>';
  return new Response(html, { status: status || 200, headers: headers(nonce) });
}
const errPage = (msg, status) => page('\u05dc\u05d0 \u05e0\u05d9\u05ea\u05df \u05dc\u05e4\u05ea\u05d5\u05d7', '<p>' + esc(msg) + '</p>', 'err', status || 400);

async function getTalk(env, id) {
  const r = await fetch(SB + '/rest/v1/toolbox_talks?id=eq.' + encodeURIComponent(id) + '&select=id,d,title,body,file_url,s', { headers: sbH(env) });
  if (!r.ok) throw new Error('talk read ' + r.status);
  const rows = await r.json();
  return Array.isArray(rows) ? rows[0] || null : null;
}
async function getEmps(env) {
  const r = await fetch(SB + '/rest/v1/emp?select=id,n,dep&order=n.asc', { headers: sbH(env) });
  if (!r.ok) throw new Error('emp read ' + r.status);
  const rows = await r.json();
  return (Array.isArray(rows) ? rows : []).filter((e) => e && e.id && e.n);
}

// A file on the talk sits in the private bucket under the app's public-form
// URL; the worker gets a signed link for one hour.
async function signedFiles(env, fileUrl) {
  const out = [];
  const mark = '/storage/v1/object/public/' + BUCKET + '/';
  for (const u of String(fileUrl || '').split(',').map((x) => x.trim()).filter(Boolean)) {
    const i = u.indexOf(mark);
    if (i < 0) continue;
    const path = u.substring(i + mark.length);
    try {
      const r = await fetch(SB + '/storage/v1/object/sign/' + BUCKET + '/' + path, { method: 'POST', headers: sbH(env, { 'Content-Type': 'application/json' }), body: JSON.stringify({ expiresIn: 3600 }) });
      if (!r.ok) continue;
      const j = await r.json();
      if (j && j.signedURL) out.push(SB + '/storage/v1' + j.signedURL);
    } catch (e) { /* the text still shows */ }
  }
  return out;
}

const SIG_SCRIPT = `(function(){
var c=document.getElementById('pad'),x=c.getContext('2d'),drawn=false,down=false;
function fit(){var r=c.getBoundingClientRect();c.width=r.width;c.height=180;x.lineWidth=2.5;x.lineCap='round';x.strokeStyle='#111';drawn=false;}
fit();
function pt(e){var r=c.getBoundingClientRect();return{x:e.clientX-r.left,y:e.clientY-r.top};}
c.addEventListener('pointerdown',function(e){down=true;var p=pt(e);x.beginPath();x.moveTo(p.x,p.y);c.setPointerCapture(e.pointerId);e.preventDefault();});
c.addEventListener('pointermove',function(e){if(!down)return;var p=pt(e);x.lineTo(p.x,p.y);x.stroke();drawn=true;e.preventDefault();});
c.addEventListener('pointerup',function(){down=false;});
document.getElementById('clr').addEventListener('click',function(){fit();});
document.getElementById('f').addEventListener('submit',function(e){
  if(!document.getElementById('emp').value){e.preventDefault();alert('\u05d1\u05d7\u05e8 \u05d0\u05ea \u05d4\u05e9\u05dd \u05e9\u05dc\u05da \u05de\u05d4\u05e8\u05e9\u05d9\u05de\u05d4');return;}
  if(!drawn){e.preventDefault();alert('\u05d7\u05e1\u05e8\u05d4 \u05d7\u05ea\u05d9\u05de\u05d4. \u05d7\u05ea\u05d5\u05dd \u05d1\u05d0\u05e6\u05d1\u05e2 \u05d1\u05ea\u05d5\u05da \u05d4\u05de\u05e1\u05d2\u05e8\u05ea');return;}
  document.getElementById('sig').value=c.toDataURL('image/png');
  var b=document.getElementById('go');b.disabled=true;b.textContent='\u05e9\u05d5\u05de\u05e8...';
});
})();`;

async function showTalk(env, tok) {
  const t = await readTalkToken(env, tok);
  if (t.error === 'expired') return errPage('\u05ea\u05d5\u05e7\u05e3 \u05d4\u05e7\u05d9\u05e9\u05d5\u05e8 \u05e4\u05d2. \u05d1\u05e7\u05e9 \u05e7\u05d9\u05e9\u05d5\u05e8 \u05d7\u05d3\u05e9 \u05de\u05d4\u05de\u05de\u05d5\u05e0\u05d4 \u05e2\u05dc \u05d4\u05d1\u05d8\u05d9\u05d7\u05d5\u05ea.', 410);
  if (t.error) return errPage('\u05d4\u05e7\u05d9\u05e9\u05d5\u05e8 \u05dc\u05d0 \u05ea\u05e7\u05d9\u05df. \u05d1\u05e7\u05e9 \u05e7\u05d9\u05e9\u05d5\u05e8 \u05d7\u05d3\u05e9 \u05de\u05d4\u05de\u05de\u05d5\u05e0\u05d4 \u05e2\u05dc \u05d4\u05d1\u05d8\u05d9\u05d7\u05d5\u05ea.', 403);
  const talk = await getTalk(env, t.id);
  if (!talk || talk.s !== S_PUB) return errPage('\u05d4\u05d4\u05d3\u05e8\u05db\u05d4 \u05d4\u05d6\u05d5 \u05dc\u05d0 \u05e4\u05d5\u05e8\u05e1\u05de\u05d4 \u05d0\u05d5 \u05d4\u05d5\u05e1\u05e8\u05d4.', 404);
  const emps = await getEmps(env);
  const files = await signedFiles(env, talk.file_url);
  const byDep = {};
  for (const e of emps) { const d = e.dep || '\u05d0\u05d7\u05e8'; (byDep[d] = byDep[d] || []).push(e); }
  const opts = Object.keys(byDep).sort((a, b) => a.localeCompare(b, 'he')).map((d) =>
    '<optgroup label="' + esc(d) + '">' + byDep[d].map((e) => '<option value="' + esc(e.id) + '">' + esc(e.n) + '</option>').join('') + '</optgroup>').join('');
  const nonce = newId() + newId();
  const inner = '<div style="font-size:13px;color:#6b7280">' + esc(fdate(talk.d)) + '</div>'
    + '<h2 style="margin:4px 0 12px;font-size:20px">' + esc(talk.title) + '</h2>'
    + (talk.body ? '<div style="white-space:pre-wrap;background:#f9fafb;border-radius:8px;padding:12px;margin-bottom:12px">' + esc(talk.body) + '</div>' : '')
    + files.map((u, i) => '<p><a href="' + esc(u) + '" target="_blank" rel="noopener" style="color:#1e3a8a;font-weight:700">\u05e4\u05ea\u05d7 \u05d0\u05ea \u05d4\u05e7\u05d5\u05d1\u05e5 \u05d4\u05de\u05e6\u05d5\u05e8\u05e3' + (files.length > 1 ? ' ' + (i + 1) : '') + '</a></p>').join('')
    + '<form id="f" method="POST" action="/api/talk" style="border-top:1px solid #e5e7eb;padding-top:12px;margin-top:8px">'
    + '<input type="hidden" name="k" value="' + esc(tok) + '"><input type="hidden" name="sig" id="sig">'
    + '<label style="display:block;font-weight:700;margin-bottom:4px">\u05d4\u05e9\u05dd \u05e9\u05dc\u05da</label>'
    + '<select name="emp" id="emp" required style="width:100%;font-size:16px;padding:10px;border:1px solid #d1d5db;border-radius:8px;margin-bottom:12px"><option value="">\u05d1\u05d7\u05e8 \u05de\u05d4\u05e8\u05e9\u05d9\u05de\u05d4</option>' + opts + '</select>'
    + '<label style="display:flex;gap:8px;align-items:center;margin-bottom:12px"><input type="checkbox" name="ok" value="1" required style="width:22px;height:22px">\u05e7\u05e8\u05d0\u05ea\u05d9 \u05d5\u05d4\u05d1\u05e0\u05ea\u05d9 \u05d0\u05ea \u05d4\u05d4\u05d3\u05e8\u05db\u05d4</label>'
    + '<div style="font-weight:700;margin-bottom:4px">\u05d7\u05ea\u05d9\u05de\u05d4 \u05d1\u05d0\u05e6\u05d1\u05e2</div>'
    + '<canvas id="pad" style="width:100%;height:180px;border:2px dashed #9ca3af;border-radius:8px;touch-action:none;background:#fff"></canvas>'
    + '<button type="button" id="clr" style="margin:6px 0 14px;padding:6px 14px;border:1px solid #d1d5db;border-radius:8px;background:#fff;font-size:14px">\u05e0\u05e7\u05d4 \u05d7\u05ea\u05d9\u05de\u05d4</button>'
    + '<button type="submit" id="go" style="display:block;width:100%;padding:14px;border:0;border-radius:10px;background:#15803d;color:#fff;font-size:18px;font-weight:700">\u05d7\u05ea\u05d5\u05dd \u05d5\u05e9\u05dc\u05d7</button>'
    + '</form><script nonce="' + nonce + '">' + SIG_SCRIPT + '</script>';
  return page('\u05d4\u05d3\u05e8\u05db\u05d4 \u05e9\u05d1\u05d5\u05e2\u05d9\u05ea', inner, '', 200, nonce);
}

// The PNG from canvas.toDataURL, checked: the right header, not empty, not huge.
export function sigBytes(dataUrl) {
  const m = /^data:image\/png;base64,([A-Za-z0-9+/=]+)$/.exec(String(dataUrl || ''));
  if (!m) return null;
  let bin;
  try { bin = atob(m[1]); } catch (e) { return null; }
  if (bin.length < MIN_SIG || bin.length > MAX_SIG) return null;
  const u8 = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  if (u8[0] !== 0x89 || u8[1] !== 0x50 || u8[2] !== 0x4E || u8[3] !== 0x47) return null;
  return u8;
}

async function signTalk(env, request) {
  let form;
  try { form = await request.formData(); } catch (e) { return errPage('\u05d4\u05d8\u05d5\u05e4\u05e1 \u05dc\u05d0 \u05e0\u05e7\u05e8\u05d0. \u05e0\u05e1\u05d4 \u05e9\u05d5\u05d1.'); }
  const tok = String(form.get('k') || '');
  const t = await readTalkToken(env, tok);
  if (t.error === 'expired') return errPage('\u05ea\u05d5\u05e7\u05e3 \u05d4\u05e7\u05d9\u05e9\u05d5\u05e8 \u05e4\u05d2. \u05d1\u05e7\u05e9 \u05e7\u05d9\u05e9\u05d5\u05e8 \u05d7\u05d3\u05e9 \u05de\u05d4\u05de\u05de\u05d5\u05e0\u05d4 \u05e2\u05dc \u05d4\u05d1\u05d8\u05d9\u05d7\u05d5\u05ea.', 410);
  if (t.error) return errPage('\u05d4\u05e7\u05d9\u05e9\u05d5\u05e8 \u05dc\u05d0 \u05ea\u05e7\u05d9\u05df. \u05d1\u05e7\u05e9 \u05e7\u05d9\u05e9\u05d5\u05e8 \u05d7\u05d3\u05e9 \u05de\u05d4\u05de\u05de\u05d5\u05e0\u05d4 \u05e2\u05dc \u05d4\u05d1\u05d8\u05d9\u05d7\u05d5\u05ea.', 403);
  const back = '<p><a href="' + esc(talkUrl(tok)) + '" style="color:#1e3a8a;font-weight:700">\u05d7\u05d6\u05e8\u05d4 \u05dc\u05d4\u05d3\u05e8\u05db\u05d4</a></p>';
  if (String(form.get('ok') || '') !== '1') return page('\u05d7\u05e1\u05e8 \u05d0\u05d9\u05e9\u05d5\u05e8', '<p>\u05e6\u05e8\u05d9\u05da \u05dc\u05e1\u05de\u05df "\u05e7\u05e8\u05d0\u05ea\u05d9 \u05d5\u05d4\u05d1\u05e0\u05ea\u05d9 \u05d0\u05ea \u05d4\u05d4\u05d3\u05e8\u05db\u05d4".</p>' + back, 'err', 400);
  const talk = await getTalk(env, t.id);
  if (!talk || talk.s !== S_PUB) return errPage('\u05d4\u05d4\u05d3\u05e8\u05db\u05d4 \u05d4\u05d6\u05d5 \u05dc\u05d0 \u05e4\u05d5\u05e8\u05e1\u05de\u05d4 \u05d0\u05d5 \u05d4\u05d5\u05e1\u05e8\u05d4.', 404);
  const empId = String(form.get('emp') || '');
  const emp = (await getEmps(env)).find((e) => String(e.id) === empId);
  if (!emp) return page('\u05d7\u05e1\u05e8 \u05e9\u05dd', '<p>\u05d1\u05d7\u05e8 \u05d0\u05ea \u05d4\u05e9\u05dd \u05e9\u05dc\u05da \u05de\u05d4\u05e8\u05e9\u05d9\u05de\u05d4.</p>' + back, 'err', 400);
  const sig = sigBytes(form.get('sig'));
  if (!sig) return page('\u05d7\u05e1\u05e8\u05d4 \u05d7\u05ea\u05d9\u05de\u05d4', '<p>\u05d4\u05d7\u05ea\u05d9\u05de\u05d4 \u05dc\u05d0 \u05e0\u05e7\u05dc\u05d8\u05d4. \u05d7\u05ea\u05d5\u05dd \u05d1\u05d0\u05e6\u05d1\u05e2 \u05d1\u05ea\u05d5\u05da \u05d4\u05de\u05e1\u05d2\u05e8\u05ea \u05d5\u05e0\u05e1\u05d4 \u05e9\u05d5\u05d1.</p>' + back, 'err', 400);

  const done = (name) => page('\u05db\u05d1\u05e8 \u05d7\u05ea\u05de\u05ea', '<p>' + esc(name) + ', \u05db\u05d1\u05e8 \u05d7\u05ea\u05de\u05ea \u05e2\u05dc \u05d4\u05d4\u05d3\u05e8\u05db\u05d4 \u05d4\u05d6\u05d5. \u05d0\u05d9\u05df \u05e6\u05d5\u05e8\u05da \u05dc\u05d7\u05ea\u05d5\u05dd \u05e9\u05d5\u05d1.</p>' + back, 'ok', 200);
  const dup = await fetch(SB + '/rest/v1/toolbox_reads?talk_id=eq.' + encodeURIComponent(talk.id) + '&emp_id=eq.' + encodeURIComponent(emp.id) + '&select=id', { headers: sbH(env) });
  if (dup.ok) { const rows = await dup.json(); if (Array.isArray(rows) && rows.length) return done(emp.n); }

  const id = newId();
  const name = 'sig-' + talk.id + '-' + String(emp.id).replace(/[^A-Za-z0-9_-]/g, '') + '-' + id + '.png';
  const up = await fetch(SB + '/storage/v1/object/' + BUCKET + '/' + name, { method: 'POST', headers: sbH(env, { 'Content-Type': 'image/png', 'x-upsert': 'false' }), body: sig });
  if (!up.ok) return page('\u05d4\u05e9\u05de\u05d9\u05e8\u05d4 \u05e0\u05db\u05e9\u05dc\u05d4', '<p>\u05d4\u05d7\u05ea\u05d9\u05de\u05d4 \u05dc\u05d0 \u05e0\u05e9\u05de\u05e8\u05d4. \u05e0\u05e1\u05d4 \u05e9\u05d5\u05d1 \u05d1\u05e2\u05d5\u05d3 \u05d3\u05e7\u05d4.</p>' + back, 'err', 502);
  const row = {
    id, talk_id: talk.id, emp_id: String(emp.id), emp_name: emp.n, dept: emp.dep || null, lang: 'he',
    sig_url: SB + '/storage/v1/object/public/' + BUCKET + '/' + name,
    device: deviceOf(request.headers.get('user-agent')), read_at: new Date().toISOString(),
  };
  const ins = await fetch(SB + '/rest/v1/toolbox_reads', { method: 'POST', headers: sbH(env, { 'Content-Type': 'application/json', Prefer: 'return=minimal' }), body: JSON.stringify(row) });
  if (ins.status === 409) return done(emp.n);
  if (!ins.ok) return page('\u05d4\u05e9\u05de\u05d9\u05e8\u05d4 \u05e0\u05db\u05e9\u05dc\u05d4', '<p>\u05d4\u05d7\u05ea\u05d9\u05de\u05d4 \u05dc\u05d0 \u05e0\u05e9\u05de\u05e8\u05d4. \u05e0\u05e1\u05d4 \u05e9\u05d5\u05d1 \u05d1\u05e2\u05d5\u05d3 \u05d3\u05e7\u05d4.</p>' + back, 'err', 502);
  return page('\u05ea\u05d5\u05d3\u05d4, ' + emp.n, '<p>\u05d4\u05d7\u05ea\u05d9\u05de\u05d4 \u05e2\u05dc "' + esc(talk.title) + '" \u05e0\u05e9\u05de\u05e8\u05d4.</p>'
    + '<p><a href="' + esc(talkUrl(tok)) + '" style="display:block;text-align:center;padding:12px;border-radius:10px;background:#1e3a8a;color:#fff;font-weight:700;text-decoration:none">\u05e2\u05d5\u05d1\u05d3 \u05d4\u05d1\u05d0 \u05d7\u05d5\u05ea\u05dd</a></p>', 'ok', 200);
}

async function makeLink(env, request) {
  const allowed = defaultAllowedOrigins(env);
  const cors = corsHeaders(request.headers.get('origin') || '', allowed, 'POST,OPTIONS');
  if (!isAllowedCaller(request, allowed)) return jsonResp({ error: 'origin not allowed' }, 403, cors);
  const who = await requireRole(request, env, ['admin', 'manager']);
  if (!who.ok) return jsonResp({ error: who.error }, who.status || 401, cors);
  let b = {};
  try { b = await request.json(); } catch (e) { b = {}; }
  if (!b || b.op !== 'link') return jsonResp({ error: 'unknown op' }, 400, cors);
  const talk = await getTalk(env, String(b.id || ''));
  if (!talk) return jsonResp({ error: 'not found' }, 404, cors);
  if (talk.s !== S_PUB) return jsonResp({ error: 'not published' }, 409, cors);
  const tok = await makeTalkToken(env, talk.id);
  if (!tok) return jsonResp({ error: 'not configured' }, 503, cors);
  return jsonResp({ url: talkUrl(tok), days: TALK_TTL_DAYS }, 200, cors);
}

export async function onRequest({ request, env }) {
  try {
    if (request.method === 'OPTIONS') {
      const allowed = defaultAllowedOrigins(env);
      return new Response(null, { headers: corsHeaders(request.headers.get('origin') || '', allowed, 'POST,OPTIONS') });
    }
    if (!env.SUPABASE_SERVICE_ROLE_KEY) return errPage('\u05d4\u05e9\u05e8\u05ea \u05dc\u05d0 \u05de\u05d5\u05d2\u05d3\u05e8.', 500);
    if (request.method === 'GET') return await showTalk(env, new URL(request.url).searchParams.get('k') || '');
    if (request.method !== 'POST') return errPage('\u05e4\u05e2\u05d5\u05dc\u05d4 \u05dc\u05d0 \u05e0\u05ea\u05de\u05db\u05ea.', 405);
    if (/application\/json/i.test(request.headers.get('content-type') || '')) return await makeLink(env, request);
    return await signTalk(env, request);
  } catch (e) {
    return errPage('\u05ea\u05e7\u05dc\u05d4 \u05d6\u05de\u05e0\u05d9\u05ea. \u05e0\u05e1\u05d4 \u05e9\u05d5\u05d1 \u05d1\u05e2\u05d5\u05d3 \u05d3\u05e7\u05d4.', 500);
  }
}
