// Cloudflare Pages Function: the weekly list of works for Friday (05/11/2026, Michael in the questionnaire:
// "a link the maintenance coordinator fills with all the works, and at the end it comes to me for approval").
// Until now maintenance answered his weekly mail in free text and the coordinator filled the paper permit by hand.
//
//   GET  ?k=<token>   the page: the Friday; the plant representative, his phone and the first-aider of that day;
//                     the works already sent (editable until Michael approves), add / remove rows; the form's 8 kinds
//                     of work (Michael's permit forms, safety folder 18, high-risk works), each with its safety
//                     measures, ticked automatically by words in the text; the gas test of a confined space, the fire
//                     watch of hot work, lock-out / tag-out of electrical and energy-isolation work; attachments; and,
//                     once Michael approved, closing the permit from the phone.
//   POST op=list      the submit: every work is a row in ptw, status S_PEND, id wk-<friday>-<n> (a resubmit updates
//                     the same rows while they are open; a row removed from the list becomes S_CANCEL, never deleted).
//                     Red flags, missing-for-approval and notes are lines in ptw.safety, computed here (assess).
//                     Michael gets one WhatsApp (at most one per NOTIFY_GAP_MIN per week).
//   POST op=file      one attachment (PDF / JPG / PNG by its bytes, never by its name) to a saved work, until it is closed.
//   POST op=close     the supervisor closes an approved permit: "finished, place clean and safe", end time, the
//                     30-minute check of hot work; refused while a lock is still open.
//   POST (json)       a signed-in manager / admin: {op:'link'} this week's link; {op:'files', id} a work's attachments
//                     as links that open for an hour.
//
// The token: works-link:v1, id = the Friday (YYYY-MM-DD), WORKS_TTL_DAYS. The token is the only gate of the page,
// like /api/talk; whoever holds the link can read and change this week's open works, nothing else. The list itself
// can be changed until the Friday; attachments and closing until the token runs out.
// No new column (05/11/2026): everything about a work beyond the permit's own columns is a line in ptw.safety.
// The weekly mail on Wednesday, the Thursday reminder and the Sunday "not closed" message run from the 5-minute
// clock (wa-morning.js, worksTick). Stage B (STATUS): a signed permit PDF per work (sg1..sg4 are left for it).
import { defaultAllowedOrigins, corsHeaders, jsonResp, isAllowedCaller, requireRole, sbFrom, SITE, SB_LIVE } from '../_shared.js';
import { makeLinkToken, readLinkToken } from '../_closelink.js';
import { ownerWa, sendToOwner, ownerWindowOpen, noteLastOut } from '../_wa.js';

let SB = SB_LIVE; // set from env in onRequest and in worksTick (sbFrom)
export const FETCH_MS = 10000, FILE_MS = 60000;
const fetch = (u, o) => globalThis.fetch(u, o && o.signal ? o : { ...(o || {}), signal: AbortSignal.timeout(FETCH_MS) });

export const WORKS_PREFIX = 'works-link:v1:';
export const WORKS_TTL_DAYS = 8;
export const MAX_ROWS = 20, MAX_N = 99, MAX_BODY = 120 * 1024;
export const S_PEND = '\u05de\u05de\u05ea\u05d9\u05df \u05dc\u05d0\u05d9\u05e9\u05d5\u05e8', S_REJ = '\u05e0\u05d3\u05d7\u05d4', S_CANCEL = '\u05de\u05d1\u05d5\u05d8\u05dc', S_CLOSED = '\u05e1\u05d2\u05d5\u05e8';
export const EDITABLE = [S_PEND, S_REJ];
export const NOT_APPROVED = [S_PEND, S_REJ, S_CANCEL, S_CLOSED];
export const EMP_LABEL = '\u05e2\u05d5\u05d1\u05d3\u05d9 \u05d4\u05de\u05e4\u05e2\u05dc';
// the lines of ptw.safety that are not a block (the app reads the first four: _PTW_* in index.html)
export const CHECK_MARK = '[\u05dc\u05d1\u05d3\u05d9\u05e7\u05d4] ', GATE_MARK = '[\u05d7\u05e1\u05e8 \u05dc\u05d0\u05d9\u05e9\u05d5\u05e8] ', NOTE_LINE = '[\u05d4\u05e2\u05e8\u05d4] ', REJ_MARK = '[\u05e0\u05d3\u05d7\u05d4] ', FILES_MARK = '[\u05e7\u05d1\u05e6\u05d9\u05dd] ';
export const NOTE_MARK = '\n\u05d4\u05e2\u05e8\u05d5\u05ea: ';
export const STATE_SUB = 'works_sub';           // {friday, at, n, none, notified_at}
export const NOTIFY_GAP_MIN = 15;
const TZ = 'Asia/Jerusalem';

// The 8 kinds of Michael's permit form (the same names as the app's permit form, svPtw), each with its keywords and
// the safety measures to tick. fields = what is typed: [key, label, kind] (t text, n number, h time), max length.
// Every kind has "other". Hot work: the fire watch. Confined space: the gas test, the attendant, the rescue plan.
export const CATS = [
  { k: 'hot', t: '\u05e2\u05d1\u05d5\u05d3\u05d5\u05ea \u05d7\u05de\u05d5\u05ea', kw: ['\u05e8\u05d9\u05ea\u05d5\u05da', '\u05e8\u05d9\u05ea\u05da', '\u05d7\u05d9\u05ea\u05d5\u05da', '\u05d4\u05e9\u05d7\u05d6\u05d4', '\u05d4\u05dc\u05d7\u05de\u05d4', '\u05de\u05d1\u05e2\u05e8', '\u05dc\u05d4\u05d1\u05d4'],
    items: ['\u05d4\u05d9\u05ea\u05e8 \u05e2\u05d1\u05d5\u05d3\u05d4 \u05d1\u05d7\u05d5\u05dd', '\u05d4\u05e8\u05d7\u05e7\u05ea \u05d7\u05d5\u05de\u05e8\u05d9\u05dd \u05d3\u05dc\u05d9\u05e7\u05d9\u05dd', '\u05de\u05d8\u05e3 \u05db\u05d9\u05d1\u05d5\u05d9 \u05d1\u05d0\u05ea\u05e8', '\u05e2\u05d1\u05d5\u05d3\u05d4 \u05d1\u05d6\u05d5\u05d2\u05d5\u05ea', '\u05d1\u05d3\u05d9\u05e7\u05ea \u05d4\u05d0\u05d6\u05d5\u05e8 \u05d1\u05e1\u05d9\u05d5\u05dd \u05d4\u05e2\u05d1\u05d5\u05d3\u05d4', '\u05e6\u05d9\u05d5\u05d3 \u05de\u05d2\u05df \u05d0\u05d9\u05e9\u05d9', '\u05d1\u05d3\u05d9\u05e7\u05d4 \u05e1\u05d5\u05e4\u05d9\u05ea 30 \u05d3\u05e7\u05d5\u05ea \u05d0\u05d7\u05e8\u05d9 \u05d4\u05e1\u05d9\u05d5\u05dd', '\u05d4\u05e6\u05d9\u05d5\u05d3 \u05ea\u05e7\u05d9\u05df', '\u05d1\u05d9\u05d3\u05d5\u05d3 \u05d4\u05d0\u05d6\u05d5\u05e8'],
    fields: [['fw', '\u05e6\u05d5\u05e4\u05d4 \u05d4\u05d0\u05e9 (\u05e9\u05dd)', 't']] },
  { k: 'hgt', t: '\u05e2\u05d1\u05d5\u05d3\u05d4 \u05d1\u05d2\u05d5\u05d1\u05d4', kw: ['\u05d2\u05d5\u05d1\u05d4', '\u05e1\u05d5\u05dc\u05dd', '\u05e1\u05d5\u05dc\u05de\u05d5\u05ea', '\u05d1\u05de\u05d4', '\u05d1\u05de\u05ea', '\u05e4\u05d9\u05d2\u05d5\u05dd', '\u05d6\u05e8\u05d5\u05e2'],
    items: ['\u05e8\u05ea\u05de\u05ea \u05d1\u05d8\u05d9\u05d7\u05d5\u05ea', '\u05e7\u05e1\u05d3\u05d4', '\u05e1\u05d5\u05dc\u05de\u05d5\u05ea \u05ea\u05e7\u05d9\u05e0\u05d9\u05dd', '\u05d1\u05de\u05ea \u05d4\u05e8\u05de\u05d4 \u05e2\u05dd \u05ea\u05e1\u05e7\u05d9\u05e8\u05d9\u05dd \u05d1\u05ea\u05d5\u05e7\u05e3', '\u05e4\u05d9\u05d2\u05d5\u05dd \u05e2\u05dd \u05d0\u05d9\u05e9\u05d5\u05e8', '\u05dc\u05db\u05dc \u05e2\u05d5\u05d1\u05d3 \u05ea\u05e2\u05d5\u05d3\u05ea \u05d4\u05d3\u05e8\u05db\u05d4 \u05dc\u05e2\u05d1\u05d5\u05d3\u05d4 \u05d1\u05d2\u05d5\u05d1\u05d4 \u05d1\u05ea\u05d5\u05e7\u05e3', '\u05e6\u05d9\u05d5\u05d3 \u05d4\u05e2\u05d1\u05d5\u05d3\u05d4 \u05d1\u05d2\u05d5\u05d1\u05d4 \u05ea\u05e7\u05d9\u05df', '\u05e2\u05d1\u05d5\u05d3\u05d4 \u05d1\u05d6\u05d5\u05d2\u05d5\u05ea', '\u05d1\u05d9\u05d3\u05d5\u05d3 \u05d4\u05d0\u05d6\u05d5\u05e8'] },
  { k: 'elc', t: '\u05e2\u05d1\u05d5\u05d3\u05d5\u05ea \u05d7\u05e9\u05de\u05dc', kw: ['\u05d7\u05e9\u05de\u05dc', '\u05dc\u05d5\u05d7'],
    items: ['\u05ea\u05d9\u05d0\u05d5\u05dd \u05e2\u05dd \u05d4\u05d7\u05e9\u05de\u05dc\u05d0\u05d9 \u05d4\u05de\u05d5\u05e1\u05de\u05da \u05e9\u05dc \u05d4\u05de\u05e4\u05e2\u05dc \u05dc\u05e0\u05d9\u05ea\u05d5\u05e7'], fields: [['mot', '\u05de\u05e1\u05e4\u05e8 \u05d4\u05de\u05e0\u05d5\u05e2 \u05d0\u05d5 \u05d4\u05de\u05db\u05d5\u05e0\u05d4 \u05e9\u05e0\u05d5\u05ea\u05e7\u05d5', 't'], ['ele', '\u05e9\u05dd \u05d4\u05d7\u05e9\u05de\u05dc\u05d0\u05d9', 't']] },
  { k: 'eng', t: '\u05e0\u05d9\u05ea\u05d5\u05e7 \u05d0\u05e0\u05e8\u05d2\u05d9\u05d4', kw: ['\u05e0\u05d9\u05ea\u05d5\u05e7', '\u05e0\u05e2\u05d9\u05dc\u05d4', '\u05e0\u05e2\u05d9\u05dc\u05ea'],
    items: ['\u05e0\u05d9\u05ea\u05d5\u05e7 \u05d2\u05d6', '\u05e0\u05d9\u05ea\u05d5\u05e7 \u05d0\u05d5\u05d5\u05d9\u05e8 \u05d3\u05d7\u05d5\u05e1', '\u05e0\u05d9\u05ea\u05d5\u05e7 \u05de\u05d9\u05dd', '\u05e6\u05d9\u05d5\u05d3 \u05e0\u05d9\u05d9\u05d3 \u05e0\u05d1\u05d3\u05e7 \u05e2\u05dc \u05d9\u05d3\u05d9 \u05d4\u05e7\u05d1\u05dc\u05df'] },
  { k: 'lft', t: '\u05e2\u05d1\u05d5\u05d3\u05d5\u05ea \u05d4\u05e0\u05e4\u05d4', kw: ['\u05d4\u05e0\u05e4\u05d4', '\u05de\u05e0\u05d5\u05e3', '\u05e2\u05d2\u05d5\u05e8\u05df'],
    items: ['\u05e0\u05d9\u05d4\u05d5\u05dc \u05e1\u05d9\u05db\u05d5\u05e0\u05d9\u05dd \u05e2\u05dd \u05db\u05dc \u05d4\u05d2\u05d5\u05e8\u05de\u05d9\u05dd', '\u05d4\u05ea\u05e7\u05d1\u05dc\u05d5 \u05db\u05dc \u05d4\u05ea\u05e1\u05e7\u05d9\u05e8\u05d9\u05dd (\u05e0\u05e1\u05e4\u05d7)', '\u05d0\u05d6\u05d5\u05e8 \u05d4\u05d4\u05e0\u05e4\u05d4 \u05de\u05d2\u05d5\u05d3\u05e8 \u05d5\u05de\u05e9\u05d5\u05dc\u05d8 \u05e2\u05d3 \u05d4\u05e1\u05d9\u05d5\u05dd'] },
  { k: 'chm', t: '\u05e7\u05e8\u05d1\u05ea \u05db\u05d9\u05de\u05d9\u05e7\u05dc\u05d9\u05dd', kw: ['\u05db\u05d9\u05de\u05d9\u05e7\u05dc', '\u05db\u05d9\u05de\u05d9\u05e7\u05dc\u05d9\u05dd', '\u05de\u05de\u05e1', '\u05d3\u05dc\u05d9\u05e7', '\u05d3\u05dc\u05d9\u05e7\u05d9\u05dd'],
    items: ['\u05d4\u05e2\u05e8\u05db\u05ea \u05e1\u05d9\u05db\u05d5\u05e0\u05d9\u05dd \u05dc\u05e4\u05e0\u05d9 \u05ea\u05d7\u05d9\u05dc\u05ea \u05d4\u05e2\u05d1\u05d5\u05d3\u05d4', '\u05d2\u05d9\u05d3\u05d5\u05e8, \u05e9\u05d9\u05dc\u05d5\u05d8 \u05d5\u05d1\u05d9\u05d3\u05d5\u05d3', '\u05e6\u05d9\u05d5\u05d3 \u05de\u05d2\u05df \u05d0\u05d9\u05e9\u05d9 \u05de\u05ea\u05d0\u05d9\u05dd', '\u05d0\u05de\u05e6\u05e2\u05d9 \u05db\u05d9\u05d1\u05d5\u05d9 \u05d0\u05e9', '\u05d4\u05e8\u05d7\u05e7\u05ea \u05de\u05e4\u05d2\u05e2\u05d9\u05dd'] },
  { k: 'cnf', t: '\u05d7\u05dc\u05dc \u05de\u05d5\u05e7\u05e3', kw: ['\u05de\u05d9\u05db\u05dc', '\u05d1\u05d5\u05e8', '\u05d7\u05dc\u05dc', '\u05d1\u05d9\u05d5\u05d1', '\u05e1\u05d9\u05dc\u05d5'],
    items: ['\u05de\u05d5\u05e0\u05d4 \u05d0\u05d7\u05e8\u05d0\u05d9', '\u05d4\u05e2\u05e8\u05db\u05ea \u05e1\u05d9\u05db\u05d5\u05e0\u05d9\u05dd \u05e2\u05dd \u05d4\u05d2\u05d5\u05e8\u05de\u05d9\u05dd \u05d4\u05e8\u05dc\u05d5\u05d5\u05e0\u05d8\u05d9\u05d9\u05dd', '\u05d4\u05d3\u05e8\u05db\u05d4', '\u05d4\u05d9\u05ea\u05e8 \u05dc\u05e4\u05e0\u05d9 \u05ea\u05d7\u05d9\u05dc\u05ea \u05d4\u05e2\u05d1\u05d5\u05d3\u05d4', '\u05db\u05dc\u05d9\u05dd \u05de\u05d5\u05ea\u05d0\u05de\u05d9\u05dd \u05dc\u05d0\u05d5\u05d5\u05d9\u05e8\u05d4 \u05e0\u05e4\u05d9\u05e6\u05d4', '\u05e6\u05d9\u05d5\u05d3 \u05de\u05d2\u05df \u05d0\u05d9\u05e9\u05d9', '\u05e6\u05d9\u05d5\u05d3 \u05e2\u05d6\u05e8\u05d4 \u05e8\u05d0\u05e9\u05d5\u05e0\u05d4 \u05d5\u05d7\u05d9\u05dc\u05d5\u05e5'],
    fields: [['o2', '\u05d1\u05d3\u05d9\u05e7\u05ea \u05d2\u05d6\u05d9\u05dd: \u05d7\u05de\u05e6\u05df O2 (%)', 'n'], ['lel', '\u05d1\u05d3\u05d9\u05e7\u05ea \u05d2\u05d6\u05d9\u05dd: \u05d3\u05dc\u05d9\u05e7\u05d5\u05ea LEL (%)', 'n'], ['h2s', '\u05d1\u05d3\u05d9\u05e7\u05ea \u05d2\u05d6\u05d9\u05dd: H2S (ppm)', 'n'], ['co', '\u05d1\u05d3\u05d9\u05e7\u05ea \u05d2\u05d6\u05d9\u05dd: CO (ppm)', 'n'],
      ['gat', '\u05e9\u05e2\u05ea \u05d1\u05d3\u05d9\u05e7\u05ea \u05d4\u05d2\u05d6\u05d9\u05dd', 'h'], ['gby', '\u05de\u05d9 \u05d1\u05d3\u05e7 \u05d0\u05ea \u05d4\u05d2\u05d6\u05d9\u05dd', 't'], ['att', '\u05d4\u05e9\u05d5\u05de\u05e8 \u05d1\u05d7\u05d5\u05e5 (\u05e9\u05dd)', 't'], ['rsc', '\u05ea\u05db\u05e0\u05d9\u05ea \u05d4\u05d7\u05d9\u05dc\u05d5\u05e5 (\u05e9\u05d5\u05e8\u05d4)', 't']] },
  { k: 'rof', t: '\u05e2\u05d1\u05d5\u05d3\u05d4 \u05e2\u05dc \u05d2\u05d2\u05d5\u05ea', kw: ['\u05d2\u05d2', '\u05d2\u05d2\u05d5\u05ea'],
    items: ['\u05e9\u05d9\u05dc\u05d5\u05d8', '\u05e7\u05d5 \u05d7\u05d9\u05d9\u05dd \u05ea\u05e7\u05d9\u05df', '\u05d0\u05d9\u05df \u05e2\u05d1\u05d5\u05d3\u05d4 \u05dc\u05d1\u05d3', '\u05d4\u05d3\u05e8\u05db\u05d4', '\u05d4\u05e2\u05e8\u05db\u05ea \u05e1\u05d9\u05db\u05d5\u05e0\u05d9\u05dd', '\u05e2\u05d1\u05d5\u05d3\u05d4 \u05dc\u05e4\u05d9 \u05d4\u05d4\u05e1\u05de\u05db\u05d4 \u05d5\u05ea\u05e7\u05e0\u05d5\u05ea \u05d4\u05e2\u05d1\u05d5\u05d3\u05d4 \u05e2\u05dc \u05d2\u05d2\u05d5\u05ea'] },
];
// Lock-out / tag-out of electrical and energy-isolation work (Michael in the questionnaire 05/11/2026): the points, who
// locked, the zero-energy check, who released and when. The permit is not closed while a lock is open.
export const LOTO = { k: 'loto', t: '\u05e0\u05e2\u05d9\u05dc\u05d4 \u05d5\u05ea\u05d9\u05d5\u05d2', items: ['\u05d1\u05d3\u05d9\u05e7\u05ea \u05d0\u05e4\u05e1 \u05d0\u05e0\u05e8\u05d2\u05d9\u05d4 \u05d1\u05d5\u05e6\u05e2\u05d4'],
  fields: [['pts', '\u05e0\u05e7\u05d5\u05d3\u05d5\u05ea \u05d4\u05e0\u05d9\u05ea\u05d5\u05e7 (\u05e8\u05e9\u05d9\u05de\u05d4)', 't'], ['lby', '\u05de\u05d9 \u05e0\u05e2\u05dc', 't'], ['rby', '\u05de\u05d9 \u05e9\u05d7\u05e8\u05e8 \u05d0\u05ea \u05d4\u05e0\u05e2\u05d9\u05dc\u05d4', 't'], ['rat', '\u05e9\u05e2\u05ea \u05d4\u05e9\u05d7\u05e8\u05d5\u05e8', 'h']] };
export const LOTO_KINDS = ['elc', 'eng'];
// The Friday itself (the same on every work of the week): the plant representative on site, his phone, the first-aider.
export const WEEK = { k: 'week', t: '\u05d1\u05d9\u05d5\u05dd \u05d4\u05e2\u05d1\u05d5\u05d3\u05d4', items: [], fields: [['rep', '\u05e0\u05e6\u05d9\u05d2 \u05d4\u05de\u05e4\u05e2\u05dc \u05d1\u05d0\u05ea\u05e8', 't'], ['rph', '\u05d4\u05e0\u05d9\u05d9\u05d3 \u05e9\u05dc \u05e0\u05e6\u05d9\u05d2 \u05d4\u05de\u05e4\u05e2\u05dc', 't'], ['aid', '\u05de\u05d2\u05d9\u05e9 \u05d4\u05e2\u05d6\u05e8\u05d4 \u05d4\u05e8\u05d0\u05e9\u05d5\u05e0\u05d4 \u05d1\u05de\u05e4\u05e2\u05dc', 't']] };
// Closing, from the link, after the work: what the form's last box says.
export const CLOSE = { k: 'close', t: '\u05e1\u05d2\u05d9\u05e8\u05d4', items: ['\u05d4\u05e2\u05d1\u05d5\u05d3\u05d4 \u05d4\u05e1\u05ea\u05d9\u05d9\u05de\u05d4, \u05d4\u05de\u05e7\u05d5\u05dd \u05e0\u05e7\u05d9 \u05d5\u05d1\u05d8\u05d5\u05d7'], fields: [['end', '\u05e9\u05e2\u05ea \u05d4\u05e1\u05d9\u05d5\u05dd', 'h'], ['c30', '\u05d1\u05d3\u05d9\u05e7\u05d4 30 \u05d3\u05e7\u05d5\u05ea \u05d0\u05d7\u05e8\u05d9 \u05d4\u05e1\u05d9\u05d5\u05dd (\u05e9\u05e2\u05d4)', 'h'], ['by', '\u05de\u05d9 \u05e1\u05d2\u05e8', 't']] };
export const BLOCKS = CATS.concat([LOTO, WEEK, CLOSE]);
const BLK = Object.fromEntries(BLOCKS.map((c) => [c.k, c]));
export const OTHER_L = '\u05d0\u05d7\u05e8';
// The gas thresholds (proposal, 05/11/2026). OFF until Michael approves the numbers (STATUS): until then the values are
// recorded and required, but nothing is red because of them.
// on: Michael approved the thresholds in the questionnaire 05/11/2026 ("\u05d1\u05e6\u05e2: \u05d4\u05e1\u05e4\u05d9\u05dd \u05d4\u05de\u05e7\u05d5\u05d1\u05dc\u05d9\u05dd").
export const GAS_LIMITS = { on: true, o2: [19.5, 23.5], lel: [null, 10], h2s: [null, 10], co: [null, 25] };
export const GAS_KEYS = ['o2', 'lel', 'h2s', 'co', 'gat', 'gby', 'att', 'rsc'];
const NUM_MAX = { o2: 100, lel: 100, h2s: 1000, co: 1000 };
// Kinds whose certificates Michael wants attached (a yellow note when none is, not a block).
export const ATTACH_KINDS = ['hgt', 'cnf', 'lft'];
export const FILE_KINDS = [['cert', '\u05ea\u05e2\u05d5\u05d3\u05d5\u05ea \u05e2\u05d5\u05d1\u05d3\u05d9\u05dd'], ['insp', '\u05ea\u05e1\u05e7\u05d9\u05e8 \u05d0\u05d5 \u05d1\u05d3\u05d9\u05e7\u05d4'], ['ins', '\u05d1\u05d9\u05d8\u05d5\u05d7'], ['other', '\u05d0\u05d7\u05e8']];
export const MAX_FILE = 4 * 1024 * 1024, MAX_FILES = 6, MAX_FILES_TOTAL = 15 * 1024 * 1024;
export const FILE_BUCKET = 'incidents-photos', FILE_DIR = 'works/';

// A keyword as a word: the start or a non-letter before it, up to three Hebrew prefix letters (vav, bet, lamed,
// he, mem, shin, kaf), any ending after it: "avur" (for) is not "bor" (pit), "be-ritukh" is "ritukh" (welding).
const HE = '\u05d0-\u05ea';
export const kwSource = (c) => '(^|[^' + HE + '])[\u05d5\u05d1\u05dc\u05d4\u05de\u05e9\u05db]{0,3}(' + c.kw.join('|') + ')';
const KW_RE = Object.fromEntries(CATS.map((c) => [c.k, new RegExp(kwSource(c))]));
export function kindsIn(text) { const s = String(text || ''); return CATS.filter((c) => KW_RE[c.k].test(s)).map((c) => c.k); }

// The departments: SITE (the hazard register and the trustees' areas), and maintenance.
export const DEPTS = Array.from(new Set([].concat(SITE.depts || [], Object.values(SITE.areaDept || {}).filter(Boolean))));

// ---- small helpers ----
function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }
function sbH(env, extra) { const k = env.SUPABASE_SERVICE_ROLE_KEY; return { apikey: k, Authorization: 'Bearer ' + k, ...(extra || {}) }; }
export const dmy = (ymd) => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(ymd || '')); return m ? m[3] + '/' + m[2] + '/' + m[1] : ''; };
export const ilDay = (d) => new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
const addDays = (ymd, n) => new Date(Date.parse(ymd + 'T00:00:00Z') + n * 86400000).toISOString().slice(0, 10);
// The Friday of this week: today when it is Friday, else the next one (Saturday -> the Friday after).
export function fridayOf(now) { const t = ilDay(now); const w = new Date(t + 'T00:00:00Z').getUTCDay(); return addDays(t, (5 - w + 7) % 7); }
// Text typed by people: no control or direction characters, keyboard characters only (people-text.md).
export const clean = (v, max, multi) => String(v == null ? '' : v)
  .replace(/[\u2013\u2014\u05be]/g, '-').replace(/[\u201c\u201d\u05f4]/g, '"').replace(/[\u2018\u2019\u05f3]/g, "'").replace(/\u2026/g, '...')
  .replace(multi ? /[\u0000-\u0009\u000b-\u001f\u007f\u200b-\u200f\u202a-\u202e\u2066-\u2069\ufeff]/g : /[\u0000-\u001f\u007f\u200b-\u200f\u202a-\u202e\u2066-\u2069\ufeff]/g, multi ? '' : ' ')
  .replace(multi ? /[ \t]+/g : /\s+/g, ' ').trim().slice(0, max + 1);
// A contractor's name for matching: no quotes, dots or dashes, no "Ltd" (be'am), one space.
export const ctrKey = (v) => String(v || '').toLowerCase().replace(/["'\u05f3\u05f4\u201c\u201d.]/g, '').replace(/[,()\-_/]/g, ' ').replace(/(^|\s)\u05d1\u05e2\u05de(\s|$)/g, ' ').replace(/\s+/g, ' ').trim();

export function makeWorksToken(env, friday, nowMs) { return makeLinkToken(env, WORKS_PREFIX, friday, WORKS_TTL_DAYS, nowMs); }
export async function readWorksToken(env, tok, nowMs) {
  const t = await readLinkToken(env, WORKS_PREFIX, tok, nowMs);
  if (t.error) return t;
  return /^\d{4}-\d{2}-\d{2}$/.test(t.id) ? t : { error: 'bad' };
}
export const worksUrl = (tok) => SITE.appUrl + '/api/works?k=' + encodeURIComponent(tok);
export const rowId = (friday, n) => 'wk-' + friday + '-' + n;
export const nOf = (id, friday) => { const m = new RegExp('^wk-' + friday + '-(\\d{1,2})$').exec(String(id || '')); return m ? Number(m[1]) : 0; };
export const WK_ID_RE = /^wk-(\d{4}-\d{2}-\d{2})-(\d{1,2})$/;

// ---- the contractor register ----
// '' = fine; otherwise why Michael should look (the same checks as _ptwConIssue in index.html).
export function ctrIssue(name, ctrRows, day) {
  const k = ctrKey(name);
  if (!k) return '\u05dc\u05d0 \u05e0\u05db\u05ea\u05d1 \u05e9\u05dd \u05d4\u05e7\u05d1\u05dc\u05df';
  const c = (ctrRows || []).find((x) => x && ctrKey(x.n) === k);
  if (!c) return '\u05d4\u05e7\u05d1\u05dc\u05df ' + name + ' \u05dc\u05d0 \u05d1\u05de\u05e8\u05e9\u05dd \u05d4\u05e7\u05d1\u05dc\u05e0\u05d9\u05dd';
  const w = [];
  if (/^\s*(\u05dc\u05d0 \u05e4\u05e2\u05d9\u05dc|\u05de\u05d5\u05e9\u05e2\u05d4|\u05d7\u05e1\u05d5\u05dd)/.test(String(c.s || ''))) w.push('\u05e1\u05d8\u05d8\u05d5\u05e1: ' + c.s);
  const e = String(c.e || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(e)) w.push('\u05d0\u05d9\u05df \u05ea\u05d0\u05e8\u05d9\u05da \u05ea\u05d5\u05e7\u05e3 \u05dc\u05d4\u05e1\u05db\u05dd');
  else if (e < day) w.push('\u05d4\u05d4\u05e1\u05db\u05dd \u05e4\u05d2 \u05d1-' + dmy(e));
  if (c.tr && c.tr !== '\u05d4\u05d5\u05db\u05e9\u05e8') w.push('\u05d4\u05d3\u05e8\u05db\u05ea \u05d1\u05d8\u05d9\u05d7\u05d5\u05ea: ' + c.tr);
  return w.length ? '\u05d4\u05e7\u05d1\u05dc\u05df ' + c.n + ': ' + w.join(', ') : '';
}

// ---- ptw.safety: blocks and marked lines ----
// A block is one line "title: measure; measure; label: value; other: ...". "; " separates, so a measure with a comma
// stays whole; a typed value loses its ";". Then [files] N, the flags, missing-for-approval, notes, rejection.
const noSemi = (s) => String(s || '').replace(/;/g, ',');
function blockLine(c, x) {
  const parts = (x.items || []).map((i) => c.items[i]);
  (c.fields || []).forEach(([fk, fl]) => { if (x[fk]) parts.push(fl + ': ' + noSemi(x[fk])); });
  if (x.other) parts.push(OTHER_L + ': ' + noSemi(x.other));
  return c.t + ': ' + parts.join('; ');
}
// st = {blocks: [keys in order], chk: {key: {items, field..., other}}, files, flags[], gate[], notes[], rej}
export function buildSafety(st) {
  const lines = st.blocks.filter((k) => BLK[k] && st.chk[k]).map((k) => blockLine(BLK[k], st.chk[k]));
  if (st.files) lines.push(FILES_MARK + st.files);
  if (st.flags && st.flags.length) lines.push(CHECK_MARK + st.flags.map(noSemi).join('; '));
  if (st.gate && st.gate.length) lines.push(GATE_MARK + st.gate.map(noSemi).join('; '));
  if (st.notes && st.notes.length) lines.push(NOTE_LINE + st.notes.map(noSemi).join('; '));
  if (st.rej) lines.unshift(REJ_MARK + st.rej);
  return lines.join('\n');
}
export function parseSafety(safety) {
  const st = { blocks: [], chk: {}, files: 0, flags: [], gate: [], notes: [], rej: '' };
  const list = (s) => s.split('; ').map((p) => p.trim()).filter(Boolean);
  String(safety || '').split('\n').forEach((line) => {
    if (line.indexOf(REJ_MARK) === 0) { st.rej = line.slice(REJ_MARK.length); return; }
    if (line.indexOf(CHECK_MARK) === 0) { st.flags = list(line.slice(CHECK_MARK.length)); return; }
    if (line.indexOf(GATE_MARK) === 0) { st.gate = list(line.slice(GATE_MARK.length)); return; }
    if (line.indexOf(NOTE_LINE) === 0) { st.notes = list(line.slice(NOTE_LINE.length)); return; }
    if (line.indexOf(FILES_MARK) === 0) { st.files = Math.min(99, parseInt(line.slice(FILES_MARK.length), 10) || 0); return; }
    const c = BLOCKS.find((x) => line.indexOf(x.t + ': ') === 0 || line === x.t + ':');
    if (!c) return;
    const x = { items: [] };
    list(line.slice(c.t.length + 1)).forEach((p) => {
      const i = c.items.indexOf(p);
      if (i >= 0) { x.items.push(i); return; }
      if (p.indexOf(OTHER_L + ': ') === 0) { x.other = p.slice(OTHER_L.length + 2); return; }
      (c.fields || []).forEach(([fk, fl]) => { if (p.indexOf(fl + ': ') === 0) x[fk] = p.slice(fl.length + 2); });
    });
    st.blocks.push(c.k); st.chk[c.k] = x;
  });
  return st;
}
export const lockOpen = (st) => { const l = st.chk.loto; return !!(l && l.lby && !(l.rby && l.rat)); };
// What the work still lacks before Michael can approve it (gate), what is red (gas out of range, when the thresholds
// are on), what is a yellow note (no attachment for height / confined / lifting; lock-out not filled). Pure.
export function assess(st, cats) {
  const gate = [], red = [], notes = [];
  if (cats.indexOf('hot') >= 0 && !(st.chk.hot && st.chk.hot.fw)) gate.push('\u05e2\u05d1\u05d5\u05d3\u05d5\u05ea \u05d7\u05de\u05d5\u05ea: \u05d7\u05e1\u05e8 \u05e6\u05d5\u05e4\u05d4 \u05d0\u05e9');
  if (cats.indexOf('cnf') >= 0) {
    const g = st.chk.cnf || {}, miss = GAS_KEYS.filter((k) => !g[k]);
    if (miss.length) gate.push('\u05d7\u05dc\u05dc \u05de\u05d5\u05e7\u05e3: \u05d7\u05e1\u05e8\u05d4 \u05d1\u05d3\u05d9\u05e7\u05ea \u05d2\u05d6\u05d9\u05dd \u05de\u05dc\u05d0\u05d4 (' + miss.map((k) => BLK.cnf.fields.find((f) => f[0] === k)[1].replace(/^\u05d1\u05d3\u05d9\u05e7\u05ea \u05d2\u05d6\u05d9\u05dd: /, '')).join(', ') + ')');
    if (GAS_LIMITS.on) ['o2', 'lel', 'h2s', 'co'].forEach((k) => {
      if (!g[k]) return;
      const v = Number(g[k]), [lo, hi] = GAS_LIMITS[k];
      if ((lo != null && v < lo) || (hi != null && v >= hi)) red.push('\u05d1\u05d3\u05d9\u05e7\u05ea \u05d2\u05d6\u05d9\u05dd \u05de\u05d7\u05d5\u05e5 \u05dc\u05d8\u05d5\u05d5\u05d7: ' + k.toUpperCase() + ' ' + g[k]);
    });
  }
  if (cats.some((k) => LOTO_KINDS.indexOf(k) >= 0)) {
    const l = st.chk.loto || {};
    if (!l.pts || !l.lby) notes.push('\u05e0\u05e2\u05d9\u05dc\u05d4 \u05d5\u05ea\u05d9\u05d5\u05d2: \u05d7\u05e1\u05e8\u05d5\u05ea \u05e0\u05e7\u05d5\u05d3\u05d5\u05ea \u05d4\u05e0\u05d9\u05ea\u05d5\u05e7 \u05d0\u05d5 \u05de\u05d9 \u05e0\u05e2\u05dc');
  }
  if (cats.some((k) => ATTACH_KINDS.indexOf(k) >= 0) && !st.files) notes.push('\u05dc\u05d0 \u05e6\u05d5\u05e8\u05e4\u05d5 \u05d0\u05d9\u05e9\u05d5\u05e8\u05d9\u05dd (\u05ea\u05e2\u05d5\u05d3\u05d5\u05ea, \u05ea\u05e1\u05e7\u05d9\u05e8\u05d9\u05dd)');
  return { gate, red, notes };
}

// ---- a work <-> a ptw row ----
export function rowToWork(r, friday) {
  const st = parseSafety(r.safety);
  const d = String(r.desc || ''), at = d.lastIndexOf(NOTE_MARK);
  const isEmp = r.con === EMP_LABEL;
  return { n: nOf(r.id, friday), num: r.num && !/^WK-/.test(r.num) ? r.num : '', ds: r.ds || friday, de: r.de || friday, ts: r.ts || '', te: r.te || '',
    who: isEmp ? 'emp' : 'ctr', con: isEmp ? '' : (r.con || ''), sup: r.sup || '', ph: r.ph || '', wkr: r.wkr || '', dep: r.dep || '', area: r.area || '',
    desc: at >= 0 ? d.slice(0, at) : d, note: at >= 0 ? d.slice(at + NOTE_MARK.length) : '',
    cats: CATS.filter((c) => st.chk[c.k]).map((c) => c.k), st, s: r.s || '', locked: EDITABLE.indexOf(r.s) < 0 };
}
export function workToRow(w, friday) {  // ver: the database trigger moves it (DECISIONS 16/10/2026)
  return { id: rowId(friday, w.n), num: w.num || ('WK-' + friday.slice(8, 10) + friday.slice(5, 7) + '-' + w.n), con: w.who === 'emp' ? EMP_LABEL : w.con,
    sup: w.sup, ph: w.ph, wkr: w.wkr, area: w.area, dep: w.dep, ds: w.ds, de: w.de, ts: w.ts, te: w.te,
    types: w.cats.map((k) => BLK[k].t).join(', '), safety: buildSafety(w.st), desc: w.desc + (w.note ? NOTE_MARK + w.note : ''), s: S_PEND };
}

// ---- reading the forms (strict: a value out of bounds refuses the whole post, naming the work and the field) ----
export const LIM = { num: 20, con: 80, sup: 60, ph: 20, wkr: 300, area: 80, desc: 600, note: 300, other: 120, field: 80, long: 200 };
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/, DATE_RE = /^\d{4}-\d{2}-\d{2}$/, NUM_RE = /^\d{1,4}(\.\d{1,2})?$/, PHONE_RE = /^[0-9+\- ]{6,20}$/;
// One block from a form: prefix = 'chk_<i>_<k>' style names. Returns {x} or {error}.
function readBlock(form, c, i, L) {
  const get = (k) => (form.get(k) == null ? '' : String(form.get(k)));
  const x = { items: [] };
  for (const v of form.getAll('chk_' + i + '_' + c.k).map(String)) {
    if (!/^\d{1,2}$/.test(v) || Number(v) >= c.items.length) return { error: L + '\u05d0\u05de\u05e6\u05e2\u05d9 \u05d1\u05d8\u05d9\u05d7\u05d5\u05ea \u05dc\u05d0 \u05de\u05d5\u05db\u05e8.' };
    if (x.items.indexOf(Number(v)) < 0) x.items.push(Number(v));
  }
  x.items.sort((a, b) => a - b);
  const oth = clean(get('oth_' + i + '_' + c.k), LIM.other); if (oth.length > LIM.other) return { error: L + '\u05d4\u05d8\u05e7\u05e1\u05d8 \u05d0\u05e8\u05d5\u05da \u05de\u05d3\u05d9.' }; if (oth) x.other = oth;
  for (const [fk, fl, kind] of (c.fields || [])) {
    const lim = fk === 'pts' || fk === 'rsc' ? LIM.long : LIM.field;
    const v = clean(get('f_' + i + '_' + c.k + '_' + fk), lim);
    if (v.length > lim) return { error: L + '\u05d4\u05d8\u05e7\u05e1\u05d8 \u05d0\u05e8\u05d5\u05da \u05de\u05d3\u05d9.' };
    if (!v) continue;
    if (kind === 'h' && !TIME_RE.test(v)) return { error: L + fl + ': \u05e9\u05e2\u05d4 \u05dc\u05d0 \u05ea\u05e7\u05d9\u05e0\u05d4.' };
    if (kind === 'n' && (!NUM_RE.test(v) || Number(v) > NUM_MAX[fk])) return { error: L + fl + ': \u05de\u05e1\u05e4\u05e8 \u05dc\u05d0 \u05ea\u05e7\u05d9\u05df.' };
    if (fk === 'rph' && !PHONE_RE.test(v)) return { error: fl + ': \u05de\u05e1\u05e4\u05e8 \u05dc\u05d0 \u05ea\u05e7\u05d9\u05df.' };
    x[fk] = v;
  }
  return { x };
}
export function readWorks(form, friday, ctrRows) {
  const get = (k) => (form.get(k) == null ? '' : String(form.get(k)));
  const rows = [];
  const week = readBlock(form, WEEK, 'w', '');
  if (week.error) return week;
  const idx = Array.from(new Set(Array.from(form.keys()).map((k) => (/^desc_(\d{1,3})$/.exec(k) || [])[1]).filter(Boolean))).map(Number).sort((a, b) => a - b);
  if (idx.length > MAX_ROWS) return { error: '\u05d0\u05e4\u05e9\u05e8 \u05e2\u05d3 ' + MAX_ROWS + ' \u05e2\u05d1\u05d5\u05d3\u05d5\u05ea \u05d1\u05e8\u05e9\u05d9\u05de\u05d4 \u05d0\u05d7\u05ea.' };
  for (const i of idx) {
    const L = '\u05e2\u05d1\u05d5\u05d3\u05d4 ' + (rows.length + 1) + ': ';
    const f = {};
    const txt = (k, lim, multi) => { const v = clean(get(k + '_' + i), lim, multi); if (v.length > lim) throw new Error(L + '\u05d4\u05d8\u05e7\u05e1\u05d8 \u05d0\u05e8\u05d5\u05da \u05de\u05d3\u05d9.'); return v; };
    try {
      f.desc = txt('desc', LIM.desc, true);
      f.note = txt('note', LIM.note, true);
      f.num = txt('num', LIM.num); f.con = txt('con', LIM.con); f.sup = txt('sup', LIM.sup); f.ph = txt('ph', LIM.ph);
      f.wkr = txt('wkr', LIM.wkr, true); f.area = txt('area', LIM.area); f.dep = txt('dep', LIM.area);
    } catch (e) { return { error: e.message }; }
    const anything = f.desc || f.con || f.sup || f.wkr || f.area;
    if (!anything) continue;  // an empty row left at the end
    if (!f.desc) return { error: L + '\u05d7\u05e1\u05e8 \u05ea\u05d9\u05d0\u05d5\u05e8 \u05d4\u05e2\u05d1\u05d5\u05d3\u05d4.' };
    if (f.num && !/^[A-Za-z0-9\u05d0-\u05ea\-\/ ]+$/.test(f.num)) return { error: L + '\u05de\u05e1\u05e4\u05e8 \u05d4\u05d4\u05e8\u05e9\u05d0\u05d4 \u05dc\u05d0 \u05ea\u05e7\u05d9\u05df.' };
    if (f.ph && !PHONE_RE.test(f.ph)) return { error: L + '\u05de\u05e1\u05e4\u05e8 \u05d4\u05e0\u05d9\u05d9\u05d3 \u05dc\u05d0 \u05ea\u05e7\u05d9\u05df.' };
    if (f.dep && DEPTS.indexOf(f.dep) < 0) return { error: L + '\u05de\u05d7\u05dc\u05e7\u05d4 \u05dc\u05d0 \u05de\u05d5\u05db\u05e8\u05ea.' };
    const who = get('who_' + i);
    if (who !== 'emp' && who !== 'ctr') return { error: L + '\u05d7\u05e1\u05e8 \u05de\u05d9 \u05de\u05d1\u05e6\u05e2 (\u05e2\u05d5\u05d1\u05d3\u05d9 \u05d4\u05de\u05e4\u05e2\u05dc \u05d0\u05d5 \u05e7\u05d1\u05dc\u05df).' };
    if (who === 'ctr' && !f.con) return { error: L + '\u05d7\u05e1\u05e8 \u05e9\u05dd \u05d4\u05e7\u05d1\u05dc\u05df.' };
    if (!f.sup) return { error: L + '\u05d7\u05e1\u05e8 \u05e9\u05dd \u05d4\u05d0\u05d7\u05e8\u05d0\u05d9 \u05d1\u05de\u05e7\u05d5\u05dd.' };
    const ds = get('ds_' + i) || friday, de = get('de_' + i) || ds;
    if (!DATE_RE.test(ds) || !DATE_RE.test(de) || ds < addDays(friday, -6) || de > addDays(friday, 7) || de < ds) return { error: L + '\u05d4\u05ea\u05d0\u05e8\u05d9\u05db\u05d9\u05dd \u05dc\u05d0 \u05ea\u05e7\u05d9\u05e0\u05d9\u05dd.' };
    const ts = get('ts_' + i), te = get('te_' + i);
    if ((ts && !TIME_RE.test(ts)) || (te && !TIME_RE.test(te))) return { error: L + '\u05d4\u05e9\u05e2\u05d4 \u05dc\u05d0 \u05ea\u05e7\u05d9\u05e0\u05d4.' };
    const cats = form.getAll('cat_' + i).map(String);
    if (cats.some((k) => !CATS.find((c) => c.k === k)) || new Set(cats).size !== cats.length) return { error: L + '\u05e1\u05d5\u05d2 \u05e2\u05d1\u05d5\u05d3\u05d4 \u05dc\u05d0 \u05de\u05d5\u05db\u05e8.' };
    const ordered = CATS.map((c) => c.k).filter((k) => cats.indexOf(k) >= 0);
    const st = { blocks: [], chk: {}, files: 0, flags: [], gate: [], notes: [], rej: '' };
    for (const k of ordered) { const b = readBlock(form, BLK[k], i, L); if (b.error) return b; st.blocks.push(k); st.chk[k] = b.x; }
    if (ordered.some((k) => LOTO_KINDS.indexOf(k) >= 0)) { const b = readBlock(form, LOTO, i, L); if (b.error) return b; st.blocks.push('loto'); st.chk.loto = b.x; }
    // the red flags: a kind the text names and nobody ticked, a kind with no measure, the contractor
    const flags = [];
    const named = kindsIn([f.desc, f.area, f.note].join(' ')).filter((k) => ordered.indexOf(k) < 0);
    if (named.length) flags.push('\u05d1\u05ea\u05d9\u05d0\u05d5\u05e8 \u05d9\u05e9 ' + named.map((k) => BLK[k].t).join(', ') + ', \u05d5\u05dc\u05d0 \u05e1\u05d5\u05de\u05df');
    ordered.forEach((k) => { const x = st.chk[k]; if (!x.items.length && !x.other) flags.push(BLK[k].t + ': \u05dc\u05d0 \u05e1\u05d5\u05de\u05df \u05d0\u05e3 \u05d0\u05de\u05e6\u05e2\u05d9 \u05d1\u05d8\u05d9\u05d7\u05d5\u05ea'); });
    if (who === 'ctr') { const ci = ctrIssue(f.con, ctrRows, ds); if (ci) flags.push(ci); }
    st.flags = flags;
    const rid = get('rid_' + i);
    rows.push({ ...f, who, ds, de, ts, te, cats: ordered, st, flags, rid: /^\d{1,2}$/.test(rid) ? Number(rid) : 0 });
  }
  const none = get('none') === '1';
  if (rows.length && !(week.x.rep && week.x.rph && week.x.aid)) return { error: '\u05d7\u05e1\u05e8\u05d9\u05dd \u05e4\u05e8\u05d8\u05d9 \u05d9\u05d5\u05dd \u05d4\u05e2\u05d1\u05d5\u05d3\u05d4: \u05e0\u05e6\u05d9\u05d2 \u05d4\u05de\u05e4\u05e2\u05dc \u05d1\u05d0\u05ea\u05e8, \u05d4\u05e0\u05d9\u05d9\u05d3 \u05e9\u05dc\u05d5, \u05d5\u05de\u05d2\u05d9\u05e9 \u05d4\u05e2\u05d6\u05e8\u05d4 \u05d4\u05e8\u05d0\u05e9\u05d5\u05e0\u05d4.' };
  return { rows, none, week: week.x };
}
// Which number each work gets: its own when it is an open row of this week, the next free one otherwise.
// Locked rows (Michael approved) are not touched; open rows that were removed from the list are cancelled.
export function planWrite(works, existing, friday) {
  const byN = {}; (existing || []).forEach((r) => { const n = nOf(r.id, friday); if (n) byN[n] = r; });
  const used = new Set(Object.keys(byN).map(Number)), keep = new Set(), out = [], skipped = [];
  let next = 1;
  const free = () => { while (used.has(next) || keep.has(next)) next++; return next; };
  for (const w of works) {
    const ex = w.rid && byN[w.rid];
    if (ex && EDITABLE.indexOf(ex.s) < 0) { skipped.push(w.rid); keep.add(w.rid); continue; }
    const n = ex && !keep.has(w.rid) ? w.rid : free();
    if (n > MAX_N) return { error: '\u05d9\u05d5\u05ea\u05e8 \u05de\u05d3\u05d9 \u05e2\u05d1\u05d5\u05d3\u05d5\u05ea \u05d4\u05e9\u05d1\u05d5\u05e2.' };
    keep.add(n); out.push({ ...w, n, isNew: !ex || n !== w.rid, prev: ex && n === w.rid ? ex : null });
  }
  // a row approved or closed is never cancelled from the list
  const cancel = Object.keys(byN).map(Number).filter((n) => !keep.has(n) && EDITABLE.indexOf(byN[n].s) >= 0).map((n) => byN[n].id);
  return { write: out, cancel, skipped };
}

// ---- the WhatsApp texts ----
const kb = (s) => clean(s, 400);
export function submitText(friday, works, again) {
  const head = '\u05e8\u05e9\u05d9\u05de\u05ea \u05d4\u05e2\u05d1\u05d5\u05d3\u05d5\u05ea \u05dc\u05d9\u05d5\u05dd \u05e9\u05d9\u05e9\u05d9 ' + dmy(friday);
  if (!works.length) return head + ': \u05de\u05d4\u05d0\u05d7\u05d6\u05e7\u05d4 \u05e0\u05de\u05e1\u05e8 \u05e9\u05d0\u05d9\u05df \u05e2\u05d1\u05d5\u05d3\u05d5\u05ea \u05de\u05d9\u05d5\u05d7\u05d3\u05d5\u05ea.';
  const cnt = CATS.map((c) => [c.t, works.filter((w) => w.cats.indexOf(c.k) >= 0).length]).filter((x) => x[1]);
  const lines = [head + (again ? ' \u05e2\u05d5\u05d3\u05db\u05e0\u05d4' : ' \u05d4\u05ea\u05e7\u05d1\u05dc\u05d4') + ': ' + works.length + ' \u05e2\u05d1\u05d5\u05d3\u05d5\u05ea' + (cnt.length ? ' (' + cnt.map((x) => x[0] + ' ' + x[1]).join(', ') + ').' : '.')];
  const red = works.filter((w) => w.st.flags.length || w.st.gate.length);
  if (red.length) {
    lines.push('\u05dc\u05d1\u05d3\u05d9\u05e7\u05d4:');
    red.slice(0, 5).forEach((w) => lines.push('- ' + kb(w.desc).slice(0, 50) + ' - ' + kb(w.st.flags.concat(w.st.gate).join('; ')).slice(0, 160)));
    if (red.length > 5) lines.push('\u05d5\u05e2\u05d5\u05d3 ' + (red.length - 5) + '.');
  } else lines.push('\u05d0\u05d9\u05df \u05d3\u05d2\u05dc\u05d9\u05dd \u05d0\u05d3\u05d5\u05de\u05d9\u05dd.');
  const yel = works.filter((w) => w.st.notes.length).length;
  if (yel) lines.push('\u05d4\u05e2\u05e8\u05d5\u05ea (\u05dc\u05d0 \u05d7\u05d5\u05e1\u05dd): \u05d1-' + yel + ' \u05e2\u05d1\u05d5\u05d3\u05d5\u05ea, \u05dc\u05de\u05e9\u05dc \u05d0\u05d9\u05e9\u05d5\u05e8\u05d9\u05dd \u05e9\u05dc\u05d0 \u05e6\u05d5\u05e8\u05e4\u05d5.');
  lines.push('\u05dc\u05d0\u05d9\u05e9\u05d5\u05e8 \u05d1\u05de\u05e1\u05da \u05d4\u05d9\u05ea\u05e8\u05d9 \u05d4\u05e2\u05d1\u05d5\u05d3\u05d4: ' + SITE.appUrl + '/#ptw');
  return lines.join('\n').slice(0, 900);
}
export const remindText = (friday) => '\u05e2\u05d3 \u05e2\u05db\u05e9\u05d9\u05d5 \u05dc\u05d0 \u05d4\u05ea\u05e7\u05d1\u05dc\u05d4 \u05e8\u05e9\u05d9\u05de\u05ea \u05d4\u05e2\u05d1\u05d5\u05d3\u05d5\u05ea \u05dc\u05d9\u05d5\u05dd \u05e9\u05d9\u05e9\u05d9 ' + dmy(friday)
  + ' \u05de\u05d4\u05d0\u05d7\u05d6\u05e7\u05d4. \u05d4\u05e7\u05d9\u05e9\u05d5\u05e8 \u05e0\u05e9\u05dc\u05d7 \u05d0\u05dc\u05d9\u05d4\u05dd \u05d1\u05d9\u05d5\u05dd \u05e8\u05d1\u05d9\u05e2\u05d9. \u05db\u05d3\u05d0\u05d9 \u05dc\u05d4\u05d6\u05db\u05d9\u05e8 \u05dc\u05d4\u05dd, \u05d0\u05d5 \u05dc\u05d4\u05e2\u05ea\u05d9\u05e7 \u05d0\u05ea \u05d4\u05e7\u05d9\u05e9\u05d5\u05e8 \u05de\u05d7\u05d3\u05e9 \u05d1\u05de\u05e1\u05da \u05d4\u05d9\u05ea\u05e8\u05d9 \u05d4\u05e2\u05d1\u05d5\u05d3\u05d4: ' + SITE.appUrl + '/#ptw';
export function openText(friday, rows) {
  const lines = ['\u05d4\u05d9\u05ea\u05e8\u05d9 \u05e2\u05d1\u05d5\u05d3\u05d4 \u05de\u05d9\u05d5\u05dd \u05e9\u05d9\u05e9\u05d9 ' + dmy(friday) + ' \u05e9\u05e2\u05d5\u05d3 \u05dc\u05d0 \u05e0\u05e1\u05d2\u05e8\u05d5: ' + rows.length + '.'];
  rows.slice(0, 5).forEach((r) => { const w = rowToWork(r, friday); lines.push('- ' + kb(w.desc).slice(0, 60) + (lockOpen(w.st) ? ' (\u05e0\u05e2\u05d9\u05dc\u05d4 \u05e2\u05d5\u05d3 \u05e4\u05ea\u05d5\u05d7\u05d4)' : '')); });
  if (rows.length > 5) lines.push('\u05d5\u05e2\u05d5\u05d3 ' + (rows.length - 5) + '.');
  lines.push('\u05d4\u05d0\u05d7\u05e8\u05d0\u05d9 \u05e1\u05d5\u05d2\u05e8 \u05de\u05d4\u05e7\u05d9\u05e9\u05d5\u05e8 \u05e9\u05dc \u05d4\u05d0\u05d7\u05d6\u05e7\u05d4 ("\u05e1\u05d2\u05d9\u05e8\u05ea \u05d4\u05d4\u05d9\u05ea\u05e8"). \u05d4\u05de\u05e1\u05da: ' + SITE.appUrl + '/#ptw');
  return lines.join('\n').slice(0, 900);
}

async function stateGet(env, key) {
  const r = await fetch(SB + '/rest/v1/server_state?key=eq.' + encodeURIComponent(key) + '&select=value', { headers: sbH(env) });
  if (!r.ok) throw new Error('state ' + r.status);
  const rows = await r.json();
  return rows && rows[0] ? rows[0].value : null;
}
async function stateSet(env, key, value) {
  const r = await fetch(SB + '/rest/v1/server_state?on_conflict=key', { method: 'POST', headers: sbH(env, { 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' }),
    body: JSON.stringify([{ key, value, updated_at: new Date().toISOString() }]) });
  if (!r.ok) throw new Error('state ' + r.status);
}
const parseJson = (v) => { try { const o = JSON.parse(v || 'null'); return o && typeof o === 'object' ? o : null; } catch (e) { return null; } };
async function waOwner(env, text, ref, nowMs) {
  if (!env.META_PHONE_NUMBER_ID || !env.META_ACCESS_TOKEN) return { ok: false, error: 'whatsapp not configured' };
  const to = await ownerWa(env, SB);
  if (!to) return { ok: false, error: 'no owner number' };
  const r = await sendToOwner(env, to, text, { windowOpen: await ownerWindowOpen(env, SB, nowMs) });
  if (r.ok) await noteLastOut(env, SB, text, ref);
  return r;
}

// ---- the page ----
function headers(nonce) {
  return { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer', 'X-Robots-Tag': 'noindex, nofollow',
    'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'DENY',
    'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; img-src data:; " + (nonce ? "script-src 'nonce-" + nonce + "'; " : '') + "form-action 'self'; base-uri 'none'; frame-ancestors 'none'" };
}
const CSS = 'body{font-family:Arial,Heebo,sans-serif;background:#f5f7fa;margin:0;padding:10px;color:#1f2937}'
  + '.box{background:#fff;border-radius:12px;max-width:640px;margin:0 auto;box-shadow:0 4px 20px rgba(0,0,0,.08);overflow:hidden}'
  + '.hd{color:#fff;padding:14px 16px;font-size:18px;font-weight:700}.in{padding:14px 16px;font-size:16px;line-height:1.6}'
  + '.w{border:1px solid #d1d5db;border-radius:10px;padding:10px;margin:0 0 14px;background:#fafafa}.w.lk{background:#ecfdf5}'
  + 'label{display:block;font-size:14px;font-weight:700;margin:8px 0 2px}input[type=text],input[type=tel],input[type=date],input[type=time],input[type=file],select,textarea{width:100%;box-sizing:border-box;padding:9px;font-size:16px;border:1px solid #9ca3af;border-radius:8px;background:#fff}'
  + 'textarea{min-height:64px}.two{display:flex;gap:8px}.two>div{flex:1}.ck{display:flex;gap:8px;align-items:flex-start;font-weight:400;margin:6px 0}.ck input{width:22px;height:22px;flex:none}'
  + '.cat{border-top:1px dashed #d1d5db;margin-top:6px;padding-top:4px}.ms{margin:0 30px 6px 0;display:none}.ms.on{display:block}.sec{border-top:2px solid #d1d5db;margin-top:10px;padding-top:6px}'
  + '.btn{display:block;width:100%;padding:12px;border:0;border-radius:10px;font-size:17px;font-weight:700;margin:8px 0}.p{background:#1e3a8a;color:#fff}.s{background:#e5e7eb;color:#111}.d{background:#fee2e2;color:#991b1b}.g{background:#15803d;color:#fff}'
  + '.red{color:#b91c1c;font-weight:700}.yel{color:#92400e}.ft{padding:10px 16px;background:#f9fafb;font-size:11px;color:#9ca3af}';
export function page(title, inner, tone, status, nonce, script) {
  const color = tone === 'ok' ? '#15803d' : tone === 'err' ? '#cc1f1f' : '#1e3a8a';
  const html = '<!doctype html><html lang="he" dir="rtl"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
    + '<meta name="robots" content="noindex, nofollow"><title>' + esc(title) + '</title><style>' + CSS + '</style></head><body><div class="box">'
    + '<div class="hd" style="background:' + color + '">' + esc(title) + '</div><div class="in">' + inner + '</div>'
    + '<div class="ft">' + esc(SITE.company) + ' - \u05e0\u05d9\u05d4\u05d5\u05dc \u05d1\u05d8\u05d9\u05d7\u05d5\u05ea</div></div>' + (script && nonce ? '<script nonce="' + nonce + '">' + script + '</script>' : '') + '</body></html>';
  return new Response(html, { status: status || 200, headers: headers(nonce) });
}
const errPage = (msg, status) => page('\u05dc\u05d0 \u05e0\u05d9\u05ea\u05df \u05dc\u05e4\u05ea\u05d5\u05d7', '<p>' + esc(msg) + '</p>', 'err', status || 400);
const newNonce = () => Array.from(crypto.getRandomValues(new Uint8Array(12))).map((b) => b.toString(16).padStart(2, '0')).join('');

// One block's inputs (measures, typed fields, other). form = the id of the form the inputs belong to ('' = the list).
function blockHtml(i, c, x, dis, opts) {
  const o = opts || {};
  let h = '';
  c.items.forEach((it, j) => { h += '<label class="ck"><input type="checkbox" name="chk_' + i + '_' + c.k + '" value="' + j + '"' + ((x.items || []).indexOf(j) >= 0 ? ' checked' : '') + dis + '> ' + esc(it) + '</label>'; });
  (c.fields || []).forEach(([fk, fl, kind]) => {
    const type = kind === 'h' ? 'time' : 'text', mode = kind === 'n' ? ' inputmode="decimal"' : '';
    h += '<label>' + esc(fl) + '</label><input type="' + type + '"' + mode + ' name="f_' + i + '_' + c.k + '_' + fk + '" maxlength="' + (fk === 'pts' || fk === 'rsc' ? LIM.long : LIM.field) + '" value="' + esc(x[fk] || '') + '"' + dis + '>';
  });
  if (!o.noOther) h += '<label>' + OTHER_L + '</label><input type="text" name="oth_' + i + '_' + c.k + '" maxlength="' + LIM.other + '" value="' + esc(x.other || '') + '"' + dis + '>';
  return h;
}
const linesHtml = (st) => (st.flags.length ? '<p class="red">\u05dc\u05d1\u05d3\u05d9\u05e7\u05d4: ' + esc(st.flags.join('; ')) + '</p>' : '')
  + (st.gate.length ? '<p class="red">\u05d7\u05e1\u05e8 \u05dc\u05e4\u05e0\u05d9 \u05d0\u05d9\u05e9\u05d5\u05e8: ' + esc(st.gate.join('; ')) + '</p>' : '')
  + (st.notes.length ? '<p class="yel">\u05d4\u05e2\u05e8\u05d4: ' + esc(st.notes.join('; ')) + '</p>' : '');
function rowHtml(i, w, friday, canEdit) {
  const v = (k) => esc(w ? w[k] : '');
  const lk = !canEdit || (w && w.locked);
  const dis = lk ? ' disabled' : '';
  const st = w ? w.st : { chk: {}, flags: [], gate: [], notes: [], files: 0 };
  let h = '<div class="w' + (w && w.locked ? ' lk' : '') + '" data-i="' + i + '">';
  h += '<div style="font-weight:700">\u05e2\u05d1\u05d5\u05d3\u05d4 <span class="no">' + (i + 1) + '</span>' + (w && w.s === S_CLOSED ? ' - \u05e0\u05e1\u05d2\u05e8\u05d4' : w && w.locked ? ' - \u05d0\u05d5\u05e9\u05e8\u05d4' : '') + '</div>';
  if (w && st.rej) h += '<p class="red">\u05e0\u05d3\u05d7\u05ea\u05d4: ' + esc(st.rej) + '. \u05d0\u05e4\u05e9\u05e8 \u05dc\u05ea\u05e7\u05df \u05d5\u05dc\u05e9\u05dc\u05d5\u05d7 \u05e9\u05d5\u05d1.</p>';
  if (w) h += linesHtml(st);
  if (!lk) h += '<input type="hidden" name="rid_' + i + '" value="' + (w ? w.n : '') + '">';
  h += '<label>\u05ea\u05d9\u05d0\u05d5\u05e8 \u05d4\u05e2\u05d1\u05d5\u05d3\u05d4 *</label><textarea name="desc_' + i + '" maxlength="' + LIM.desc + '" class="kw"' + dis + '>' + v('desc') + '</textarea>';
  h += '<div class="two"><div><label>\u05de\u05d7\u05dc\u05e7\u05d4</label><select name="dep_' + i + '"' + dis + '><option value="">-</option>'
    + DEPTS.map((d) => '<option' + (w && w.dep === d ? ' selected' : '') + '>' + esc(d) + '</option>').join('') + '</select></div>'
    + '<div><label>\u05de\u05e7\u05d5\u05dd \u05de\u05d3\u05d5\u05d9\u05e7</label><input type="text" name="area_' + i + '" maxlength="' + LIM.area + '" class="kw" value="' + v('area') + '"' + dis + '></div></div>';
  const who = w ? w.who : '';
  h += '<label>\u05de\u05d9 \u05de\u05d1\u05e6\u05e2 *</label><div class="two"><label class="ck"><input type="radio" name="who_' + i + '" value="ctr"' + (who === 'ctr' ? ' checked' : '') + dis + '> \u05e7\u05d1\u05dc\u05df</label>'
    + '<label class="ck"><input type="radio" name="who_' + i + '" value="emp"' + (who === 'emp' ? ' checked' : '') + dis + '> \u05e2\u05d5\u05d1\u05d3\u05d9 \u05d4\u05de\u05e4\u05e2\u05dc</label></div>';
  h += '<label>\u05e9\u05dd \u05d4\u05e7\u05d1\u05dc\u05df</label><input type="text" name="con_' + i + '" list="ctrl" maxlength="' + LIM.con + '" value="' + v('con') + '"' + dis + '>';
  h += '<div class="two"><div><label>\u05d0\u05d7\u05e8\u05d0\u05d9 \u05d1\u05de\u05e7\u05d5\u05dd *</label><input type="text" name="sup_' + i + '" maxlength="' + LIM.sup + '" value="' + v('sup') + '"' + dis + '></div>'
    + '<div><label>\u05e0\u05d9\u05d9\u05d3 \u05d4\u05d0\u05d7\u05e8\u05d0\u05d9</label><input type="tel" name="ph_' + i + '" maxlength="' + LIM.ph + '" value="' + v('ph') + '"' + dis + '></div></div>';
  h += '<label>\u05e9\u05de\u05d5\u05ea \u05d4\u05e2\u05d5\u05d1\u05d3\u05d9\u05dd</label><input type="text" name="wkr_' + i + '" maxlength="' + LIM.wkr + '" value="' + v('wkr') + '"' + dis + '>';
  h += '<div class="two"><div><label>\u05de\u05ea\u05d0\u05e8\u05d9\u05da</label><input type="date" name="ds_' + i + '" value="' + esc((w && w.ds) || friday) + '"' + dis + '></div>'
    + '<div><label>\u05e2\u05d3 \u05ea\u05d0\u05e8\u05d9\u05da</label><input type="date" name="de_' + i + '" value="' + esc((w && w.de) || friday) + '"' + dis + '></div></div>';
  h += '<div class="two"><div><label>\u05de\u05e9\u05e2\u05d4</label><input type="time" name="ts_' + i + '" value="' + v('ts') + '"' + dis + '></div>'
    + '<div><label>\u05e2\u05d3 \u05e9\u05e2\u05d4</label><input type="time" name="te_' + i + '" value="' + v('te') + '"' + dis + '></div></div>';
  h += '<label>\u05de\u05e1\u05e4\u05e8 \u05d4\u05e8\u05e9\u05d0\u05d4 (\u05d0\u05dd \u05d9\u05e9)</label><input type="text" name="num_' + i + '" maxlength="' + LIM.num + '" value="' + v('num') + '"' + dis + '>';
  h += '<label>\u05e1\u05d5\u05d2 \u05d4\u05e2\u05d1\u05d5\u05d3\u05d4 \u05d5\u05d0\u05de\u05e6\u05e2\u05d9 \u05d4\u05d1\u05d8\u05d9\u05d7\u05d5\u05ea</label>';
  CATS.forEach((c) => {
    const on = !!(w && w.cats.indexOf(c.k) >= 0);
    h += '<div class="cat"><label class="ck"><input type="checkbox" class="cat-k" name="cat_' + i + '" value="' + c.k + '"' + (on ? ' checked' : '') + dis + '> ' + esc(c.t) + '</label>';
    h += '<div class="ms' + (on ? ' on' : '') + '">' + blockHtml(i, c, st.chk[c.k] || {}, dis) + '</div></div>';
  });
  const lotoOn = !!(w && w.cats.some((k) => LOTO_KINDS.indexOf(k) >= 0));
  h += '<div class="cat loto ms' + (lotoOn ? ' on' : '') + '"><b>' + esc(LOTO.t) + '</b>' + blockHtml(i, LOTO, st.chk.loto || {}, dis, { noOther: true }) + '</div>';
  h += '<label>\u05d4\u05e2\u05e8\u05d5\u05ea</label><textarea name="note_' + i + '" maxlength="' + LIM.note + '" class="kw"' + dis + '>' + v('note') + '</textarea>';
  if (!lk) h += '<button type="button" class="btn d rm">\u05d4\u05e1\u05e8 \u05d0\u05ea \u05d4\u05e2\u05d1\u05d5\u05d3\u05d4</button>';
  return h + '</div>';
}
// After the list is saved: attachments (any open work), closing (an approved work). Their inputs sit in the work's
// box but belong to small forms outside the list (the form attribute), so one page holds them all.
function afterHtml(w, tok) {
  if (!w || w.s === S_CLOSED || w.s === S_CANCEL) return '';
  const fid = 'fu' + w.n, cid = 'fc' + w.n;
  let h = '<div class="sec"><b>\u05d0\u05d9\u05e9\u05d5\u05e8\u05d9\u05dd \u05de\u05e6\u05d5\u05e8\u05e4\u05d9\u05dd</b> (\u05ea\u05e2\u05d5\u05d3\u05d5\u05ea, \u05ea\u05e1\u05e7\u05d9\u05e8\u05d9\u05dd, \u05d1\u05d9\u05d8\u05d5\u05d7): ' + (w.st.files ? w.st.files + ' \u05e7\u05d1\u05e6\u05d9\u05dd' : '\u05e2\u05d5\u05d3 \u05dc\u05d0 \u05e6\u05d5\u05e8\u05e4\u05d5') + '.'
    + '<div class="two"><div><select name="kind" form="' + fid + '">' + FILE_KINDS.map((x) => '<option value="' + x[0] + '">' + esc(x[1]) + '</option>').join('') + '</select></div>'
    + '<div><input type="file" name="file" accept="application/pdf,image/jpeg,image/png" required form="' + fid + '"></div></div>'
    + '<button type="submit" class="btn s" form="' + fid + '">\u05e6\u05d9\u05e8\u05d5\u05e3 \u05d4\u05e7\u05d5\u05d1\u05e5</button><div style="font-size:12px;color:#6b7280">PDF, JPG \u05d0\u05d5 PNG, \u05e2\u05d3 4MB \u05dc\u05e7\u05d5\u05d1\u05e5, \u05e2\u05d3 ' + MAX_FILES + ' \u05e7\u05d1\u05e6\u05d9\u05dd \u05dc\u05e2\u05d1\u05d5\u05d3\u05d4.</div></div>';
  if (NOT_APPROVED.indexOf(w.s) < 0) {
    const hot = w.cats.indexOf('hot') >= 0, lo = w.st.chk.loto;
    h += '<div class="sec"><b>\u05e1\u05d2\u05d9\u05e8\u05ea \u05d4\u05d4\u05d9\u05ea\u05e8</b> (\u05d1\u05e1\u05d5\u05e3 \u05d4\u05e2\u05d1\u05d5\u05d3\u05d4, \u05e2\u05dc \u05d9\u05d3\u05d9 \u05d4\u05d0\u05d7\u05e8\u05d0\u05d9)';
    h += '<label class="ck"><input type="checkbox" name="done" value="1" form="' + cid + '"> ' + esc(CLOSE.items[0]) + '</label>';
    h += '<div class="two"><div><label>\u05e9\u05e2\u05ea \u05d4\u05e1\u05d9\u05d5\u05dd *</label><input type="time" name="end" form="' + cid + '"></div>'
      + (hot ? '<div><label>\u05d1\u05d3\u05d9\u05e7\u05d4 30 \u05d3\u05e7\u05d5\u05ea \u05d0\u05d7\u05e8\u05d9 \u05d4\u05e1\u05d9\u05d5\u05dd *</label><input type="time" name="c30" form="' + cid + '"></div>' : '') + '</div>';
    h += '<label>\u05de\u05d9 \u05e1\u05d5\u05d2\u05e8 *</label><input type="text" name="by" maxlength="' + LIM.field + '" form="' + cid + '">';
    if (lo && lo.lby && !(lo.rby && lo.rat)) h += '<p class="red">\u05d4\u05e0\u05e2\u05d9\u05dc\u05d4 \u05e9\u05dc ' + esc(lo.lby) + ' \u05e2\u05d5\u05d3 \u05e4\u05ea\u05d5\u05d7\u05d4. \u05d0\u05d9 \u05d0\u05e4\u05e9\u05e8 \u05dc\u05e1\u05d2\u05d5\u05e8 \u05dc\u05e4\u05e0\u05d9 \u05e9\u05d7\u05e8\u05d5\u05e8:</p>'
      + '<div class="two"><div><label>\u05de\u05d9 \u05e9\u05d7\u05e8\u05e8 \u05d0\u05ea \u05d4\u05e0\u05e2\u05d9\u05dc\u05d4</label><input type="text" name="rby" maxlength="' + LIM.field + '" form="' + cid + '"></div>'
      + '<div><label>\u05e9\u05e2\u05ea \u05d4\u05e9\u05d7\u05e8\u05d5\u05e8</label><input type="time" name="rat" form="' + cid + '"></div></div>';
    h += '<button type="submit" class="btn g" form="' + cid + '">\u05e1\u05d2\u05d9\u05e8\u05ea \u05d4\u05d4\u05d9\u05ea\u05e8</button></div>';
  }
  return h;
}
function afterForms(w, tok) {
  if (!w || w.s === S_CLOSED || w.s === S_CANCEL) return '';
  return '<form id="fu' + w.n + '" method="post" action="/api/works" enctype="multipart/form-data"><input type="hidden" name="op" value="file"><input type="hidden" name="k" value="' + esc(tok) + '"><input type="hidden" name="n" value="' + w.n + '"></form>'
    + (NOT_APPROVED.indexOf(w.s) < 0 ? '<form id="fc' + w.n + '" method="post" action="/api/works"><input type="hidden" name="op" value="close"><input type="hidden" name="k" value="' + esc(tok) + '"><input type="hidden" name="n" value="' + w.n + '"></form>' : '');
}
// The page script: add / remove a work (a copy of the empty template row, renumbered), open a kind's measures when
// ticked (and lock-out / tag-out with electrical or energy isolation), tick a kind when its word is typed (once: a kind
// the coordinator unticked stays unticked).
const pageScript = (kw) => `(function(){
var KW=${JSON.stringify(kw)},RE={},LK=${JSON.stringify(LOTO_KINDS)};for(var k in KW)RE[k]=new RegExp(KW[k]);
var L=document.getElementById('ls'),T=document.getElementById('tpl');if(!L)return;var n=+L.getAttribute('data-n'),MAX=${MAX_ROWS};
function nums(){var a=L.querySelectorAll('.w .no');for(var i=0;i<a.length;i++)a[i].textContent=i+1;}
function loto(w){var on=false;Array.prototype.forEach.call(w.querySelectorAll('.cat-k'),function(c){if(c.checked&&LK.indexOf(c.value)>=0)on=true;});var b=w.querySelector('.loto');if(b)b.className='cat loto ms'+(on?' on':'');}
function wire(w){
  var rm=w.querySelector('.rm');if(rm)rm.addEventListener('click',function(){w.parentNode.removeChild(w);nums();});
  Array.prototype.forEach.call(w.querySelectorAll('.cat-k'),function(c){c.addEventListener('change',function(){c.parentNode.nextSibling.className='ms'+(c.checked?' on':'');c.setAttribute('data-u','1');loto(w);});});
  Array.prototype.forEach.call(w.querySelectorAll('.kw'),function(t){t.addEventListener('input',function(){
    var s='';Array.prototype.forEach.call(w.querySelectorAll('.kw'),function(x){s+=' '+x.value;});
    Array.prototype.forEach.call(w.querySelectorAll('.cat-k'),function(c){if(!c.checked&&!c.getAttribute('data-u')&&RE[c.value].test(s)){c.checked=true;c.parentNode.nextSibling.className='ms on';}});
    loto(w);
  });});
}
Array.prototype.forEach.call(L.querySelectorAll('.w'),wire);
var add=document.getElementById('add');if(add)add.addEventListener('click',function(){
  if(L.querySelectorAll('.w').length>=MAX)return;
  var d=document.createElement('div');d.innerHTML=T.innerHTML.replace(/__I__/g,String(n++));var w=d.firstChild;L.appendChild(w);wire(w);nums();w.scrollIntoView();
});
var f=document.getElementById('f');if(f)f.addEventListener('submit',function(){var b=document.getElementById('go');b.disabled=true;b.textContent='\u05e9\u05d5\u05dc\u05d7...';});
})();`;
async function sbGet(env, path) {
  const r = await fetch(SB + '/rest/v1/' + path, { headers: sbH(env) });
  if (!r.ok) throw new Error('read ' + r.status);
  return r.json();
}
const WEEK_COLS = 'id,num,con,sup,ph,wkr,area,dep,ds,de,ts,te,types,safety,desc,s';
const weekRows = (env, friday) => sbGet(env, 'ptw?id=like.' + encodeURIComponent('wk-' + friday + '-*') + '&select=' + WEEK_COLS + '&order=id.asc&limit=100');
const ctrRowsOf = (env) => sbGet(env, 'ctr?select=n,e,s,tr&limit=500');
// Can the list itself still be changed: until the Friday (Israel); attachments and closing until the token runs out.
const listOpen = (friday, nowMs) => ilDay(new Date(nowMs)) <= friday;

async function showPage(env, tok, nowMs) {
  const t = await readWorksToken(env, tok, nowMs);
  if (t.error === 'expired') return errPage('\u05d4\u05e7\u05d9\u05e9\u05d5\u05e8 \u05e4\u05d2. \u05d0\u05e4\u05e9\u05e8 \u05dc\u05d1\u05e7\u05e9 \u05e7\u05d9\u05e9\u05d5\u05e8 \u05d7\u05d3\u05e9 \u05de\u05d4\u05de\u05de\u05d5\u05e0\u05d4 \u05e2\u05dc \u05d4\u05d1\u05d8\u05d9\u05d7\u05d5\u05ea.', 403);
  if (t.error) return errPage('\u05d4\u05e7\u05d9\u05e9\u05d5\u05e8 \u05dc\u05d0 \u05ea\u05e7\u05d9\u05df.', 403);
  const friday = t.id, canEdit = listOpen(friday, nowMs);
  const [rows, ctr] = await Promise.all([weekRows(env, friday), canEdit ? ctrRowsOf(env).catch(() => []) : Promise.resolve([])]);
  const works = rows.filter((r) => r.s !== S_CANCEL).map((r) => rowToWork(r, friday)).filter((w) => w.n).sort((a, b) => a.n - b.n);
  if (!canEdit && !works.length) return errPage('\u05d9\u05d5\u05dd \u05e9\u05d9\u05e9\u05d9 ' + dmy(friday) + ' \u05db\u05d1\u05e8 \u05e2\u05d1\u05e8, \u05d5\u05d4\u05e8\u05e9\u05d9\u05de\u05d4 \u05e9\u05dc\u05d5 \u05e0\u05e1\u05d2\u05e8\u05d4.', 410);
  const nonce = newNonce();
  const wk = (works.find((w) => w.st.chk.week) || { st: { chk: {} } }).st.chk.week || {};
  let h = canEdit
    ? '<p>\u05e8\u05e9\u05d9\u05de\u05ea \u05d4\u05e2\u05d1\u05d5\u05d3\u05d5\u05ea \u05d4\u05de\u05ea\u05d5\u05db\u05e0\u05e0\u05d5\u05ea \u05dc\u05d9\u05d5\u05dd \u05e9\u05d9\u05e9\u05d9 <b>' + dmy(friday) + '</b>. \u05dc\u05db\u05dc \u05e2\u05d1\u05d5\u05d3\u05d4: \u05de\u05d4, \u05d0\u05d9\u05e4\u05d4, \u05de\u05d9 \u05de\u05d1\u05e6\u05e2 \u05d5\u05de\u05d9 \u05d4\u05d0\u05d7\u05e8\u05d0\u05d9, \u05d5\u05e1\u05d5\u05d2 \u05d4\u05e2\u05d1\u05d5\u05d3\u05d4 \u05e2\u05dd \u05d0\u05de\u05e6\u05e2\u05d9 \u05d4\u05d1\u05d8\u05d9\u05d7\u05d5\u05ea. \u05d1\u05e1\u05d5\u05e3 \u05dc\u05d5\u05d7\u05e6\u05d9\u05dd "\u05e9\u05dc\u05d9\u05d7\u05d4 \u05dc\u05d0\u05d9\u05e9\u05d5\u05e8".</p>'
    : '<p>\u05d9\u05d5\u05dd \u05e9\u05d9\u05e9\u05d9 ' + dmy(friday) + ' \u05e2\u05d1\u05e8, \u05d5\u05d0\u05ea \u05d4\u05e8\u05e9\u05d9\u05de\u05d4 \u05db\u05d1\u05e8 \u05d0\u05d9 \u05d0\u05e4\u05e9\u05e8 \u05dc\u05e9\u05e0\u05d5\u05ea. \u05db\u05d0\u05df \u05de\u05e6\u05e8\u05e4\u05d9\u05dd \u05d0\u05d9\u05e9\u05d5\u05e8\u05d9\u05dd \u05d5\u05e1\u05d5\u05d2\u05e8\u05d9\u05dd \u05d0\u05ea \u05d4\u05d4\u05d9\u05ea\u05e8\u05d9\u05dd.</p>';
  if (canEdit && works.length) h += '<p style="background:#eff6ff;border-radius:8px;padding:8px">\u05d4\u05e8\u05e9\u05d9\u05de\u05d4 \u05db\u05d1\u05e8 \u05e0\u05e9\u05dc\u05d7\u05d4. \u05d0\u05e4\u05e9\u05e8 \u05dc\u05ea\u05e7\u05df \u05d5\u05dc\u05e9\u05dc\u05d5\u05d7 \u05e9\u05d5\u05d1 \u05e2\u05d3 \u05e9\u05d4\u05de\u05de\u05d5\u05e0\u05d4 \u05e2\u05dc \u05d4\u05d1\u05d8\u05d9\u05d7\u05d5\u05ea \u05de\u05d0\u05e9\u05e8.</p>';
  h += '<form id="f" method="post" action="/api/works"><input type="hidden" name="op" value="list"><input type="hidden" name="k" value="' + esc(tok) + '">';
  if (canEdit) h += '<datalist id="ctrl">' + Array.from(new Set((ctr || []).map((c) => c && c.n).filter(Boolean))).slice(0, 300).map((n) => '<option value="' + esc(n) + '">').join('') + '</datalist>';
  h += '<div class="w"><b>\u05d1\u05d9\u05d5\u05dd \u05d4\u05e2\u05d1\u05d5\u05d3\u05d4</b> (\u05d7\u05d5\u05d1\u05d4 \u05db\u05e9\u05d9\u05e9 \u05e2\u05d1\u05d5\u05d3\u05d5\u05ea)' + blockHtml('w', WEEK, wk, canEdit ? '' : ' disabled', { noOther: true }) + '</div>';
  const list = works.length ? works : [null];
  // the after-sections go inside each work's box; their small forms after the list form
  h += '<div id="ls" data-n="' + list.length + '">' + list.map((w, i) => rowHtml(i, w, friday, canEdit).replace(/<\/div>$/, afterHtml(w, tok) + '</div>')).join('') + '</div>';
  if (canEdit) {
    h += '<template id="tpl">' + rowHtml('__I__', null, friday, true).replace('<span class="no">__I__1</span>', '<span class="no"></span>') + '</template>';
    h += '<button type="button" id="add" class="btn s">+ \u05e2\u05d5\u05d3 \u05e2\u05d1\u05d5\u05d3\u05d4</button>';
    h += '<label class="ck" style="margin-top:12px"><input type="checkbox" name="none" value="1"> \u05d0\u05d9\u05df \u05e2\u05d1\u05d5\u05d3\u05d5\u05ea \u05de\u05d9\u05d5\u05d7\u05d3\u05d5\u05ea \u05d1\u05d9\u05d5\u05dd \u05e9\u05d9\u05e9\u05d9 \u05d4\u05d6\u05d4</label>';
    h += '<button type="submit" id="go" class="btn p">\u05e9\u05dc\u05d9\u05d7\u05d4 \u05dc\u05d0\u05d9\u05e9\u05d5\u05e8</button>';
  }
  h += '</form>' + works.map((w) => afterForms(w, tok)).join('');
  const kw = Object.fromEntries(CATS.map((c) => [c.k, kwSource(c)]));
  return page('\u05e2\u05d1\u05d5\u05d3\u05d5\u05ea \u05dc\u05d9\u05d5\u05dd \u05e9\u05d9\u05e9\u05d9 ' + dmy(friday), h, '', 200, nonce, pageScript(kw));
}

const backLink = (tok) => '<p><a href="' + esc(worksUrl(tok)) + '" style="color:#1e3a8a;font-weight:700">\u05d7\u05d6\u05e8\u05d4 \u05dc\u05e8\u05e9\u05d9\u05de\u05d4</a></p>';
async function submitList(env, form, tok, friday, nowMs) {
  const back = backLink(tok);
  if (!listOpen(friday, nowMs)) return errPage('\u05d9\u05d5\u05dd \u05e9\u05d9\u05e9\u05d9 ' + dmy(friday) + ' \u05db\u05d1\u05e8 \u05e2\u05d1\u05e8, \u05d5\u05d0\u05ea \u05d4\u05e8\u05e9\u05d9\u05de\u05d4 \u05db\u05d1\u05e8 \u05d0\u05d9 \u05d0\u05e4\u05e9\u05e8 \u05dc\u05e9\u05e0\u05d5\u05ea.', 410);
  const [existing, ctr] = await Promise.all([weekRows(env, friday), ctrRowsOf(env).catch(() => null)]);
  const parsed = readWorks(form, friday, ctr || []);
  if (parsed.error) return page('\u05e6\u05e8\u05d9\u05da \u05dc\u05ea\u05e7\u05df', '<p>' + esc(parsed.error) + '</p><p>\u05d7\u05d6\u05e8\u05d5 \u05d0\u05d7\u05d5\u05e8\u05d4 \u05d1\u05d3\u05e4\u05d3\u05e4\u05df, \u05d4\u05e4\u05e8\u05d8\u05d9\u05dd \u05e9\u05de\u05d9\u05dc\u05d0\u05ea\u05dd \u05e0\u05e9\u05de\u05e8\u05d5 \u05e9\u05dd.</p>' + back, 'err', 400);
  if (!parsed.rows.length && !parsed.none) return page('\u05dc\u05d0 \u05e0\u05d5\u05e1\u05e4\u05d5 \u05e2\u05d1\u05d5\u05d3\u05d5\u05ea', '<p>\u05dc\u05d0 \u05e0\u05db\u05ea\u05d1\u05d4 \u05d0\u05e3 \u05e2\u05d1\u05d5\u05d3\u05d4. \u05d0\u05dd \u05d0\u05d9\u05df \u05e2\u05d1\u05d5\u05d3\u05d5\u05ea \u05de\u05d9\u05d5\u05d7\u05d3\u05d5\u05ea \u05d1\u05d9\u05d5\u05dd \u05e9\u05d9\u05e9\u05d9, \u05e1\u05de\u05e0\u05d5 "\u05d0\u05d9\u05df \u05e2\u05d1\u05d5\u05d3\u05d5\u05ea \u05de\u05d9\u05d5\u05d7\u05d3\u05d5\u05ea".</p>' + back, 'err', 400);
  const plan = planWrite(parsed.rows, existing, friday);
  if (plan.error) return page('\u05e6\u05e8\u05d9\u05da \u05dc\u05ea\u05e7\u05df', '<p>' + esc(plan.error) + '</p>' + back, 'err', 400);
  // each work: the Friday's details, its attachments so far, then what it lacks (assess)
  plan.write.forEach((w) => {
    if (!ctr && w.who === 'ctr') w.st.flags.push('\u05dc\u05d0 \u05e0\u05d1\u05d3\u05e7 \u05de\u05d5\u05dc \u05de\u05e8\u05e9\u05dd \u05d4\u05e7\u05d1\u05dc\u05e0\u05d9\u05dd (\u05ea\u05e7\u05dc\u05d4 \u05d1\u05e7\u05e8\u05d9\u05d0\u05d4)');
    w.st.blocks.push('week'); w.st.chk.week = Object.assign({ items: [] }, parsed.week);
    w.st.files = w.prev ? parseSafety(w.prev.safety).files : 0;
    const a = assess(w.st, w.cats);
    w.st.flags = w.st.flags.concat(a.red); w.st.gate = a.gate; w.st.notes = a.notes;
  });
  // New works are inserted (a number taken meanwhile = 409, "try again"); an open work is updated only while it is
  // still open (s=in.(...)), so an approval that lands between the read and the write is never turned back to pending.
  const fresh = plan.write.filter((w) => w.isNew), upd = plan.write.filter((w) => !w.isNew);
  if (fresh.length) {
    const r = await fetch(SB + '/rest/v1/ptw', { method: 'POST', headers: sbH(env, { 'Content-Type': 'application/json', Prefer: 'return=minimal' }),
      body: JSON.stringify(fresh.map((w) => workToRow(w, friday))) });
    if (!r.ok) return page('\u05dc\u05d0 \u05e0\u05e9\u05de\u05e8', '<p>\u05d4\u05e8\u05e9\u05d9\u05de\u05d4 \u05dc\u05d0 \u05e0\u05e9\u05de\u05e8\u05d4 \u05d1\u05d2\u05dc\u05dc \u05ea\u05e7\u05dc\u05d4 \u05d6\u05de\u05e0\u05d9\u05ea. \u05e0\u05e1\u05d5 \u05e9\u05d5\u05d1 \u05d1\u05e2\u05d5\u05d3 \u05d3\u05e7\u05d4.</p>' + back, 'err', 503);
  }
  for (const w of upd) {
    const row = workToRow(w, friday); delete row.id;
    const r = await fetch(SB + '/rest/v1/ptw?id=eq.' + encodeURIComponent(rowId(friday, w.n)) + '&s=in.(' + EDITABLE.map(encodeURIComponent).join(',') + ')', {
      method: 'PATCH', headers: sbH(env, { 'Content-Type': 'application/json', Prefer: 'return=minimal' }), body: JSON.stringify(row) });
    if (!r.ok) return page('\u05dc\u05d0 \u05e0\u05e9\u05de\u05e8', '<p>\u05d7\u05dc\u05e7 \u05de\u05d4\u05e9\u05d9\u05e0\u05d5\u05d9\u05d9\u05dd \u05dc\u05d0 \u05e0\u05e9\u05de\u05e8\u05d5 \u05d1\u05d2\u05dc\u05dc \u05ea\u05e7\u05dc\u05d4 \u05d6\u05de\u05e0\u05d9\u05ea. \u05e0\u05e1\u05d5 \u05e9\u05d5\u05d1 \u05d1\u05e2\u05d5\u05d3 \u05d3\u05e7\u05d4.</p>' + back, 'err', 503);
  }
  if (plan.cancel.length) {
    const r = await fetch(SB + '/rest/v1/ptw?id=in.(' + plan.cancel.map(encodeURIComponent).join(',') + ')&s=in.(' + EDITABLE.map(encodeURIComponent).join(',') + ')', {
      method: 'PATCH', headers: sbH(env, { 'Content-Type': 'application/json', Prefer: 'return=minimal' }), body: JSON.stringify({ s: S_CANCEL }) });
    if (!r.ok) return page('\u05dc\u05d0 \u05e0\u05e9\u05de\u05e8', '<p>\u05d7\u05dc\u05e7 \u05de\u05d4\u05e9\u05d9\u05e0\u05d5\u05d9\u05d9\u05dd \u05dc\u05d0 \u05e0\u05e9\u05de\u05e8\u05d5 \u05d1\u05d2\u05dc\u05dc \u05ea\u05e7\u05dc\u05d4 \u05d6\u05de\u05e0\u05d9\u05ea. \u05e0\u05e1\u05d5 \u05e9\u05d5\u05d1 \u05d1\u05e2\u05d5\u05d3 \u05d3\u05e7\u05d4.</p>' + back, 'err', 503);
  }
  // Michael hears about it: the first submit of the week at once, a change at most once per NOTIFY_GAP_MIN.
  const nowIso = new Date(nowMs).toISOString();
  let prev = null; try { prev = parseJson(await stateGet(env, STATE_SUB)); } catch (e) { prev = null; }
  const again = !!(prev && prev.friday === friday);
  const due = !again || !prev.notified_at || nowMs - Date.parse(prev.notified_at) >= NOTIFY_GAP_MIN * 60000;
  const sub = { friday, at: nowIso, n: plan.write.length, none: !plan.write.length, notified_at: again ? prev.notified_at || null : null };
  if (due) {
    const wa = await waOwner(env, submitText(friday, plan.write, again), 'works ' + friday, nowMs).catch(() => ({ ok: false }));
    if (wa.ok) sub.notified_at = nowIso;
  }
  try { await stateSet(env, STATE_SUB, JSON.stringify(sub)); } catch (e) { /* the rows are saved; only the reminder may ask again */ }
  const red = plan.write.filter((w) => w.st.flags.length || w.st.gate.length).length;
  return page('\u05e0\u05e9\u05dc\u05d7 \u05dc\u05d0\u05d9\u05e9\u05d5\u05e8', '<p>' + (plan.write.length ? '\u05e0\u05e9\u05dc\u05d7\u05d5 ' + plan.write.length + ' \u05e2\u05d1\u05d5\u05d3\u05d5\u05ea \u05dc\u05d9\u05d5\u05dd \u05e9\u05d9\u05e9\u05d9 ' + dmy(friday) + '. \u05d4\u05de\u05de\u05d5\u05e0\u05d4 \u05e2\u05dc \u05d4\u05d1\u05d8\u05d9\u05d7\u05d5\u05ea \u05d9\u05e2\u05d1\u05d5\u05e8 \u05e2\u05dc\u05d9\u05d4\u05df \u05d5\u05d9\u05d0\u05e9\u05e8.' : '\u05e0\u05de\u05e1\u05e8 \u05e9\u05d0\u05d9\u05df \u05e2\u05d1\u05d5\u05d3\u05d5\u05ea \u05de\u05d9\u05d5\u05d7\u05d3\u05d5\u05ea \u05d1\u05d9\u05d5\u05dd \u05e9\u05d9\u05e9\u05d9 ' + dmy(friday) + '.') + '</p>'
    + (plan.skipped.length ? '<p>\u05e2\u05d1\u05d5\u05d3\u05d5\u05ea \u05e9\u05db\u05d1\u05e8 \u05d0\u05d5\u05e9\u05e8\u05d5 \u05dc\u05d0 \u05e9\u05d5\u05e0\u05d5.</p>' : '') + (red ? '<p class="red">\u05d1-' + red + ' \u05e2\u05d1\u05d5\u05d3\u05d5\u05ea \u05d7\u05e1\u05e8\u05d9\u05dd \u05e4\u05e8\u05d8\u05d9\u05dd \u05d0\u05d5 \u05e9\u05d9\u05e9 \u05de\u05d4 \u05dc\u05d1\u05d3\u05d5\u05e7. \u05d0\u05e4\u05e9\u05e8 \u05dc\u05d4\u05e9\u05dc\u05d9\u05dd \u05d1\u05e7\u05d9\u05e9\u05d5\u05e8.</p>' : '')
    + '<p>\u05d0\u05e4\u05e9\u05e8 \u05dc\u05d7\u05d6\u05d5\u05e8 \u05dc\u05e7\u05d9\u05e9\u05d5\u05e8, \u05dc\u05ea\u05e7\u05df \u05d5\u05dc\u05e6\u05e8\u05e3 \u05d0\u05d9\u05e9\u05d5\u05e8\u05d9\u05dd \u05e2\u05d3 \u05d4\u05d0\u05d9\u05e9\u05d5\u05e8.</p>' + back, 'ok', 200);
}

async function oneRow(env, friday, n) {
  const rows = await sbGet(env, 'ptw?id=eq.' + encodeURIComponent(rowId(friday, n)) + '&select=' + WEEK_COLS);
  return rows && rows[0] ? rows[0] : null;
}
// What a file is, by its first bytes (never by its name or its declared type).
export function fileType(u8) {
  if (u8.length > 4 && u8[0] === 0x25 && u8[1] === 0x50 && u8[2] === 0x44 && u8[3] === 0x46) return ['pdf', 'application/pdf'];
  if (u8.length > 3 && u8[0] === 0xff && u8[1] === 0xd8 && u8[2] === 0xff) return ['jpg', 'image/jpeg'];
  if (u8.length > 8 && [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((b, i) => u8[i] === b)) return ['png', 'image/png'];
  return null;
}
const filesDir = (friday, n) => FILE_DIR + friday + '/' + n + '/';
async function listFiles(env, friday, n) {
  const r = await fetch(SB + '/storage/v1/object/list/' + FILE_BUCKET, { method: 'POST', headers: sbH(env, { 'Content-Type': 'application/json' }),
    body: JSON.stringify({ prefix: filesDir(friday, n), limit: 50, sortBy: { column: 'name', order: 'asc' } }) });
  if (!r.ok) throw new Error('list ' + r.status);
  const j = await r.json();
  return (Array.isArray(j) ? j : []).filter((x) => x && x.name && /^[a-z]+-[a-z0-9]+\.(pdf|jpg|png)$/.test(x.name)).map((x) => ({ name: x.name, size: Number((x.metadata && x.metadata.size) || 0) }));
}
// Re-assess a saved row after its attachments changed (only the notes move) and write safety back while it is open.
async function rewriteSafety(env, row, friday, st) {
  const w = rowToWork(row, friday);
  st.notes = assess(st, w.cats).notes;
  const r = await fetch(SB + '/rest/v1/ptw?id=eq.' + encodeURIComponent(row.id) + '&s=neq.' + encodeURIComponent(S_CLOSED), { method: 'PATCH',
    headers: sbH(env, { 'Content-Type': 'application/json', Prefer: 'return=minimal' }), body: JSON.stringify({ safety: buildSafety(st) }) });
  if (!r.ok) throw new Error('patch ' + r.status);
}
async function submitFile(env, request, nowMs) {
  const len = Number(request.headers.get('content-length') || 0);
  if (!len || len > MAX_FILE + 64 * 1024) return errPage('\u05d4\u05e7\u05d5\u05d1\u05e5 \u05d2\u05d3\u05d5\u05dc \u05de\u05d3\u05d9 (\u05e2\u05d3 4MB).', 413);
  let form; try { form = await request.formData(); } catch (e) { return errPage('\u05d4\u05e7\u05d5\u05d1\u05e5 \u05dc\u05d0 \u05e0\u05e9\u05dc\u05d7 \u05db\u05e8\u05d0\u05d5\u05d9. \u05e0\u05e1\u05d5 \u05e9\u05d5\u05d1.', 400); }
  const tok = String(form.get('k') || '');
  const t = await readWorksToken(env, tok, nowMs);
  if (t.error) return errPage(t.error === 'expired' ? '\u05d4\u05e7\u05d9\u05e9\u05d5\u05e8 \u05e4\u05d2.' : '\u05d4\u05e7\u05d9\u05e9\u05d5\u05e8 \u05dc\u05d0 \u05ea\u05e7\u05d9\u05df.', 403);
  const friday = t.id, back = backLink(tok), n = Number(form.get('n'));
  const kind = String(form.get('kind') || '');
  if (!(n >= 1 && n <= MAX_N) || !FILE_KINDS.find((x) => x[0] === kind)) return page('\u05e6\u05e8\u05d9\u05da \u05dc\u05ea\u05e7\u05df', '<p>\u05d7\u05e1\u05e8 \u05e1\u05d5\u05d2 \u05d4\u05e7\u05d5\u05d1\u05e5 \u05d0\u05d5 \u05d4\u05e2\u05d1\u05d5\u05d3\u05d4.</p>' + back, 'err', 400);
  const file = form.get('file');
  if (!file || typeof file.arrayBuffer !== 'function') return page('\u05e6\u05e8\u05d9\u05da \u05dc\u05ea\u05e7\u05df', '<p>\u05dc\u05d0 \u05e0\u05d1\u05d7\u05e8 \u05e7\u05d5\u05d1\u05e5.</p>' + back, 'err', 400);
  const u8 = new Uint8Array(await file.arrayBuffer());
  if (u8.length > MAX_FILE) return page('\u05e6\u05e8\u05d9\u05da \u05dc\u05ea\u05e7\u05df', '<p>\u05d4\u05e7\u05d5\u05d1\u05e5 \u05d2\u05d3\u05d5\u05dc \u05de\u05d3\u05d9 (\u05e2\u05d3 4MB).</p>' + back, 'err', 413);
  const ft = fileType(u8);
  if (!ft) return page('\u05e6\u05e8\u05d9\u05da \u05dc\u05ea\u05e7\u05df', '<p>\u05d0\u05e4\u05e9\u05e8 \u05dc\u05e6\u05e8\u05e3 \u05e8\u05e7 PDF, JPG \u05d0\u05d5 PNG.</p>' + back, 'err', 415);
  const row = await oneRow(env, friday, n);
  if (!row || row.s === S_CANCEL) return page('\u05dc\u05d0 \u05e0\u05de\u05e6\u05d0', '<p>\u05d4\u05e2\u05d1\u05d5\u05d3\u05d4 \u05dc\u05d0 \u05e0\u05de\u05e6\u05d0\u05d4. \u05e9\u05d5\u05dc\u05d7\u05d9\u05dd \u05e7\u05d5\u05d3\u05dd \u05d0\u05ea \u05d4\u05e8\u05e9\u05d9\u05de\u05d4, \u05d5\u05d0\u05d6 \u05de\u05e6\u05e8\u05e4\u05d9\u05dd.</p>' + back, 'err', 404);
  if (row.s === S_CLOSED) return page('\u05d4\u05d4\u05d9\u05ea\u05e8 \u05e0\u05e1\u05d2\u05e8', '<p>\u05d4\u05d4\u05d9\u05ea\u05e8 \u05db\u05d1\u05e8 \u05e0\u05e1\u05d2\u05e8, \u05d5\u05d0\u05d9 \u05d0\u05e4\u05e9\u05e8 \u05dc\u05e6\u05e8\u05e3 \u05d0\u05dc\u05d9\u05d5 \u05e7\u05d1\u05e6\u05d9\u05dd.</p>' + back, 'err', 409);
  const have = await listFiles(env, friday, n);
  if (have.length >= MAX_FILES) return page('\u05e6\u05e8\u05d9\u05da \u05dc\u05ea\u05e7\u05df', '<p>\u05db\u05d1\u05e8 \u05e6\u05d5\u05e8\u05e4\u05d5 ' + MAX_FILES + ' \u05e7\u05d1\u05e6\u05d9\u05dd \u05dc\u05e2\u05d1\u05d5\u05d3\u05d4 \u05d4\u05d6\u05d5.</p>' + back, 'err', 409);
  if (have.reduce((a, x) => a + x.size, 0) + u8.length > MAX_FILES_TOTAL) return page('\u05e6\u05e8\u05d9\u05da \u05dc\u05ea\u05e7\u05df', '<p>\u05d4\u05e7\u05d1\u05e6\u05d9\u05dd \u05e9\u05dc \u05d4\u05e2\u05d1\u05d5\u05d3\u05d4 \u05d4\u05d6\u05d5 \u05db\u05d1\u05e8 \u05d2\u05d3\u05d5\u05dc\u05d9\u05dd \u05de\u05d3\u05d9 \u05d9\u05d7\u05d3.</p>' + back, 'err', 413);
  const name = kind + '-' + nowMs.toString(36) + Array.from(crypto.getRandomValues(new Uint8Array(4))).map((b) => b.toString(16).padStart(2, '0')).join('') + '.' + ft[0];
  const up = await fetch(SB + '/storage/v1/object/' + FILE_BUCKET + '/' + filesDir(friday, n) + name, { method: 'POST',
    headers: sbH(env, { 'Content-Type': ft[1], 'x-upsert': 'false' }), body: u8, signal: AbortSignal.timeout(FILE_MS) });
  if (!up.ok) return page('\u05dc\u05d0 \u05e0\u05e9\u05de\u05e8', '<p>\u05d4\u05e7\u05d5\u05d1\u05e5 \u05dc\u05d0 \u05e0\u05e9\u05de\u05e8 \u05d1\u05d2\u05dc\u05dc \u05ea\u05e7\u05dc\u05d4 \u05d6\u05de\u05e0\u05d9\u05ea. \u05e0\u05e1\u05d5 \u05e9\u05d5\u05d1 \u05d1\u05e2\u05d5\u05d3 \u05d3\u05e7\u05d4.</p>' + back, 'err', 503);
  // Uploads sent at the same time all saw the old list (security review 05/11/2026): count again after the upload,
  // and an upload past the limits removes its own file (only the file this request just wrote).
  const after = await listFiles(env, friday, n).catch(() => null);
  if (after && (after.length > MAX_FILES || after.reduce((a, x) => a + x.size, 0) > MAX_FILES_TOTAL)) {
    await fetch(SB + '/storage/v1/object/' + FILE_BUCKET + '/' + filesDir(friday, n) + name, { method: 'DELETE', headers: sbH(env), signal: AbortSignal.timeout(FILE_MS) }).catch(() => null);
    return page('\u05e6\u05e8\u05d9\u05da \u05dc\u05ea\u05e7\u05df', '<p>\u05db\u05d1\u05e8 \u05e6\u05d5\u05e8\u05e4\u05d5 \u05de\u05e1\u05e4\u05d9\u05e7 \u05e7\u05d1\u05e6\u05d9\u05dd \u05dc\u05e2\u05d1\u05d5\u05d3\u05d4 \u05d4\u05d6\u05d5.</p>' + back, 'err', 409);
  }
  const st = parseSafety(row.safety); st.files = after ? after.length : have.length + 1;
  try { await rewriteSafety(env, row, friday, st); } catch (e) { /* the file is kept; the count catches up on the next one */ }
  return page('\u05d4\u05e7\u05d5\u05d1\u05e5 \u05e6\u05d5\u05e8\u05e3', '<p>\u05d4\u05e7\u05d5\u05d1\u05e5 \u05e6\u05d5\u05e8\u05e3 \u05dc\u05e2\u05d1\u05d5\u05d3\u05d4 ' + n + ' (' + st.files + ' \u05e7\u05d1\u05e6\u05d9\u05dd). \u05d4\u05de\u05de\u05d5\u05e0\u05d4 \u05e2\u05dc \u05d4\u05d1\u05d8\u05d9\u05d7\u05d5\u05ea \u05d9\u05e8\u05d0\u05d4 \u05d0\u05d5\u05ea\u05d5 \u05d1\u05d0\u05e4\u05dc\u05d9\u05e7\u05e6\u05d9\u05d4.</p>' + back, 'ok', 200);
}
// Closing from the phone: only an approved permit, "finished, clean and safe" ticked, the end time, the 30-minute check
// of hot work, who closes; never while a lock is still open (a release typed here counts).
export function closeCheck(st, cats, c) {
  if (!c.done) return '\u05e6\u05e8\u05d9\u05da \u05dc\u05e1\u05de\u05df \u05e9\u05d4\u05e2\u05d1\u05d5\u05d3\u05d4 \u05d4\u05e1\u05ea\u05d9\u05d9\u05de\u05d4 \u05d5\u05d4\u05de\u05e7\u05d5\u05dd \u05e0\u05e7\u05d9 \u05d5\u05d1\u05d8\u05d5\u05d7.';
  if (!TIME_RE.test(c.end)) return '\u05d7\u05e1\u05e8\u05d4 \u05e9\u05e2\u05ea \u05d4\u05e1\u05d9\u05d5\u05dd.';
  if (cats.indexOf('hot') >= 0 && !TIME_RE.test(c.c30)) return '\u05d1\u05e2\u05d1\u05d5\u05d3\u05d4 \u05d7\u05de\u05d4 \u05e6\u05e8\u05d9\u05da \u05d0\u05ea \u05e9\u05e2\u05ea \u05d4\u05d1\u05d3\u05d9\u05e7\u05d4 30 \u05d3\u05e7\u05d5\u05ea \u05d0\u05d7\u05e8\u05d9 \u05d4\u05e1\u05d9\u05d5\u05dd.';
  if (!c.by) return '\u05d7\u05e1\u05e8 \u05de\u05d9 \u05e1\u05d5\u05d2\u05e8.';
  const l = st.chk.loto;
  if (l && l.lby && !((l.rby || c.rby) && (l.rat || c.rat))) return '\u05d4\u05e0\u05e2\u05d9\u05dc\u05d4 \u05e9\u05dc ' + l.lby + ' \u05e2\u05d5\u05d3 \u05e4\u05ea\u05d5\u05d7\u05d4. \u05e6\u05e8\u05d9\u05da \u05dc\u05e8\u05e9\u05d5\u05dd \u05de\u05d9 \u05e9\u05d7\u05e8\u05e8 \u05d5\u05de\u05ea\u05d9.';
  if ((c.rat && !TIME_RE.test(c.rat))) return '\u05e9\u05e2\u05ea \u05d4\u05e9\u05d7\u05e8\u05d5\u05e8 \u05dc\u05d0 \u05ea\u05e7\u05d9\u05e0\u05d4.';
  return '';
}
async function submitClose(env, form, tok, friday, nowMs) {
  const back = backLink(tok), n = Number(form.get('n'));
  if (!(n >= 1 && n <= MAX_N)) return page('\u05e6\u05e8\u05d9\u05da \u05dc\u05ea\u05e7\u05df', '<p>\u05d4\u05e2\u05d1\u05d5\u05d3\u05d4 \u05dc\u05d0 \u05e0\u05de\u05e6\u05d0\u05d4.</p>' + back, 'err', 400);
  const g = (k) => clean(form.get(k), LIM.field);
  const c = { done: String(form.get('done') || '') === '1', end: g('end'), c30: g('c30'), by: g('by'), rby: g('rby'), rat: g('rat') };
  if (Object.values(c).some((v) => typeof v === 'string' && v.length > LIM.field)) return page('\u05e6\u05e8\u05d9\u05da \u05dc\u05ea\u05e7\u05df', '<p>\u05d4\u05d8\u05e7\u05e1\u05d8 \u05d0\u05e8\u05d5\u05da \u05de\u05d3\u05d9.</p>' + back, 'err', 400);
  const row = await oneRow(env, friday, n);
  if (!row || row.s === S_CANCEL) return page('\u05dc\u05d0 \u05e0\u05de\u05e6\u05d0', '<p>\u05d4\u05e2\u05d1\u05d5\u05d3\u05d4 \u05dc\u05d0 \u05e0\u05de\u05e6\u05d0\u05d4.</p>' + back, 'err', 404);
  if (row.s === S_CLOSED) return page('\u05d4\u05d4\u05d9\u05ea\u05e8 \u05e0\u05e1\u05d2\u05e8', '<p>\u05d4\u05d4\u05d9\u05ea\u05e8 \u05db\u05d1\u05e8 \u05e0\u05e1\u05d2\u05e8.</p>' + back, 'ok', 200);
  if (NOT_APPROVED.indexOf(row.s) >= 0) return page('\u05e2\u05d5\u05d3 \u05dc\u05d0 \u05d0\u05d5\u05e9\u05e8', '<p>\u05d0\u05ea \u05d4\u05d4\u05d9\u05ea\u05e8 \u05d0\u05e4\u05e9\u05e8 \u05dc\u05e1\u05d2\u05d5\u05e8 \u05e8\u05e7 \u05d0\u05d7\u05e8\u05d9 \u05e9\u05d4\u05de\u05de\u05d5\u05e0\u05d4 \u05e2\u05dc \u05d4\u05d1\u05d8\u05d9\u05d7\u05d5\u05ea \u05d0\u05d9\u05e9\u05e8 \u05d0\u05d5\u05ea\u05d5.</p>' + back, 'err', 409);
  const w = rowToWork(row, friday), st = w.st;
  const why = closeCheck(st, w.cats, c);
  if (why) return page('\u05d0\u05d9 \u05d0\u05e4\u05e9\u05e8 \u05dc\u05e1\u05d2\u05d5\u05e8 \u05e2\u05d3\u05d9\u05d9\u05df', '<p>' + esc(why) + '</p><p>\u05d7\u05d6\u05e8\u05d5 \u05d0\u05d7\u05d5\u05e8\u05d4 \u05d1\u05d3\u05e4\u05d3\u05e4\u05df \u05d5\u05d4\u05e9\u05dc\u05d9\u05de\u05d5.</p>' + back, 'err', 409);
  if (st.chk.loto && st.chk.loto.lby) { if (c.rby && !st.chk.loto.rby) st.chk.loto.rby = c.rby; if (c.rat && !st.chk.loto.rat) st.chk.loto.rat = c.rat; }
  st.blocks = st.blocks.filter((k) => k !== 'close').concat(['close']);
  st.chk.close = { items: [0], end: c.end, c30: c.c30 || '', by: c.by };
  const r = await fetch(SB + '/rest/v1/ptw?id=eq.' + encodeURIComponent(row.id) + '&s=not.in.(' + NOT_APPROVED.map(encodeURIComponent).join(',') + ')', { method: 'PATCH',
    headers: sbH(env, { 'Content-Type': 'application/json', Prefer: 'return=minimal' }), body: JSON.stringify({ s: S_CLOSED, te: c.end, safety: buildSafety(st) }) });
  if (!r.ok) return page('\u05dc\u05d0 \u05e0\u05e9\u05de\u05e8', '<p>\u05d4\u05e1\u05d2\u05d9\u05e8\u05d4 \u05dc\u05d0 \u05e0\u05e9\u05de\u05e8\u05d4 \u05d1\u05d2\u05dc\u05dc \u05ea\u05e7\u05dc\u05d4 \u05d6\u05de\u05e0\u05d9\u05ea. \u05e0\u05e1\u05d5 \u05e9\u05d5\u05d1 \u05d1\u05e2\u05d5\u05d3 \u05d3\u05e7\u05d4.</p>' + back, 'err', 503);
  return page('\u05d4\u05d4\u05d9\u05ea\u05e8 \u05e0\u05e1\u05d2\u05e8', '<p>\u05d4\u05d9\u05ea\u05e8 \u05d4\u05e2\u05d1\u05d5\u05d3\u05d4 ' + n + ' \u05e0\u05e1\u05d2\u05e8 \u05d1\u05e9\u05e2\u05d4 ' + esc(c.end) + '. \u05ea\u05d5\u05d3\u05d4.</p>' + back, 'ok', 200);
}

async function submit(env, request, nowMs) {
  const ct = request.headers.get('content-type') || '';
  if (/multipart\/form-data/i.test(ct)) return submitFile(env, request, nowMs);
  if (!/application\/x-www-form-urlencoded/i.test(ct)) return errPage('\u05d4\u05d8\u05d5\u05e4\u05e1 \u05dc\u05d0 \u05e0\u05e9\u05dc\u05d7 \u05db\u05e8\u05d0\u05d5\u05d9. \u05e0\u05e1\u05d5 \u05e9\u05d5\u05d1 \u05de\u05d4\u05e7\u05d9\u05e9\u05d5\u05e8.', 415);
  const len = Number(request.headers.get('content-length') || 0);
  if (len > MAX_BODY) return errPage('\u05d4\u05e8\u05e9\u05d9\u05de\u05d4 \u05d0\u05e8\u05d5\u05db\u05d4 \u05de\u05d3\u05d9.', 413);
  const raw = await request.text();
  if (raw.length > MAX_BODY) return errPage('\u05d4\u05e8\u05e9\u05d9\u05de\u05d4 \u05d0\u05e8\u05d5\u05db\u05d4 \u05de\u05d3\u05d9.', 413);
  const form = new URLSearchParams(raw);
  const tok = String(form.get('k') || '');
  const t = await readWorksToken(env, tok, nowMs);
  if (t.error === 'expired') return errPage('\u05d4\u05e7\u05d9\u05e9\u05d5\u05e8 \u05e4\u05d2. \u05d0\u05e4\u05e9\u05e8 \u05dc\u05d1\u05e7\u05e9 \u05e7\u05d9\u05e9\u05d5\u05e8 \u05d7\u05d3\u05e9 \u05de\u05d4\u05de\u05de\u05d5\u05e0\u05d4 \u05e2\u05dc \u05d4\u05d1\u05d8\u05d9\u05d7\u05d5\u05ea.', 403);
  if (t.error) return errPage('\u05d4\u05e7\u05d9\u05e9\u05d5\u05e8 \u05dc\u05d0 \u05ea\u05e7\u05d9\u05df.', 403);
  const op = String(form.get('op') || 'list');
  if (op === 'close') return submitClose(env, form, tok, t.id, nowMs);
  if (op !== 'list') return errPage('\u05e4\u05e2\u05d5\u05dc\u05d4 \u05dc\u05d0 \u05e0\u05ea\u05de\u05db\u05ea.', 400);
  return submitList(env, form, tok, t.id, nowMs);
}

// The app (a manager / admin): this week's link; a work's attachments as links that open for an hour.
export const SIGN_SEC = 3600;
async function appOp(env, request, nowMs) {
  const allowed = defaultAllowedOrigins(env);
  const cors = corsHeaders(request.headers.get('origin') || '', allowed, 'POST,OPTIONS');
  if (!isAllowedCaller(request, allowed)) return jsonResp({ error: 'origin not allowed' }, 403, cors);
  const who = await requireRole(request, env, ['admin', 'manager']);
  if (!who.ok) return jsonResp({ error: who.error }, who.status || 401, cors);
  let b = {}; try { b = await request.json(); } catch (e) { b = {}; }
  if (b && b.op === 'link') {
    const friday = fridayOf(new Date(nowMs));
    const tok = await makeWorksToken(env, friday, nowMs);
    if (!tok) return jsonResp({ error: 'not configured' }, 500, cors);
    return jsonResp({ url: worksUrl(tok), friday, days: WORKS_TTL_DAYS }, 200, cors);
  }
  if (b && b.op === 'files') {
    const m = WK_ID_RE.exec(String(b.id || ''));
    if (!m) return jsonResp({ error: 'bad id' }, 400, cors);
    const files = await listFiles(env, m[1], Number(m[2]));
    if (!files.length) return jsonResp({ files: [] }, 200, cors);
    const paths = files.map((x) => filesDir(m[1], Number(m[2])) + x.name);
    const r = await fetch(SB + '/storage/v1/object/sign/' + FILE_BUCKET, { method: 'POST', headers: sbH(env, { 'Content-Type': 'application/json' }), body: JSON.stringify({ expiresIn: SIGN_SEC, paths }) });
    const j = r.ok ? await r.json() : [];
    const url = (p) => { const e = (Array.isArray(j) ? j : []).find((x) => x && x.path === p && x.signedURL); return e ? (/^https?:/.test(e.signedURL) ? e.signedURL : SB + '/storage/v1' + e.signedURL) : null; };
    return jsonResp({ files: files.map((x, i) => ({ kind: (FILE_KINDS.find((k) => x.name.indexOf(k[0] + '-') === 0) || FILE_KINDS[3])[1], type: x.name.split('.').pop(), size: x.size, url: url(paths[i]) })) }, 200, cors);
  }
  return jsonResp({ error: 'unknown op' }, 400, cors);
}

export async function onRequest(context) {
  SB = sbFrom(context.env);
  const { request, env } = context;
  const nowMs = Date.now();
  try {
    if (request.method === 'OPTIONS') return new Response(null, { headers: corsHeaders(request.headers.get('origin') || '', defaultAllowedOrigins(env), 'POST,OPTIONS') });
    if (!env.SUPABASE_SERVICE_ROLE_KEY) return errPage('\u05d4\u05e9\u05e8\u05ea \u05dc\u05d0 \u05de\u05d5\u05d2\u05d3\u05e8.', 500);
    if (request.method === 'GET') return await showPage(env, new URL(request.url).searchParams.get('k') || '', nowMs);
    if (request.method !== 'POST') return errPage('\u05e4\u05e2\u05d5\u05dc\u05d4 \u05dc\u05d0 \u05e0\u05ea\u05de\u05db\u05ea.', 405);
    if (/application\/json/i.test(request.headers.get('content-type') || '')) return await appOp(env, request, nowMs);
    return await submit(env, request, nowMs);
  } catch (e) {
    return errPage('\u05ea\u05e7\u05dc\u05d4 \u05d6\u05de\u05e0\u05d9\u05ea. \u05e0\u05e1\u05d5 \u05e9\u05d5\u05d1 \u05d1\u05e2\u05d5\u05d3 \u05d3\u05e7\u05d4.', 503);
  }
}

// ---- the 5-minute clock (wa-morning.js watch) ----
// Wednesday from 18:00 Israel: the link to maintenance, only when server_state works_mail_on is "true" (off until
// Michael approves the text) and works_mail_to holds the addresses ({to:[], cc:[]}, the company's domain only;
// kept in the database, not in this public code). Once per Friday (works_mail_last, written after the send).
// Thursday from 12:00: nothing came for this Friday (works_sub) = one WhatsApp to Michael (works_remind_last); only
// while the mail is on. Sunday from 08:00: approved permits of the Friday before that are not closed = one WhatsApp
// (works_open_last), whether the mail is on or not (the permits exist). Outside these hours the tick costs nothing.
export const MAIL_KEYS = ['works_mail_on', 'works_mail_to', 'works_mail_last', 'works_remind_last', 'works_open_last', STATE_SUB];
export const ilDow = (d) => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(new Intl.DateTimeFormat('en-US', { timeZone: TZ, weekday: 'short' }).format(d));
export const ilHour = (d) => Number(new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', hourCycle: 'h23' }).format(d));
export const mailDue = (now) => ilDow(now) === 3 && ilHour(now) >= 18 && ilHour(now) < 23;
export const remindDue = (now) => ilDow(now) === 4 && ilHour(now) >= 12 && ilHour(now) < 20;
export const openDue = (now) => ilDow(now) === 0 && ilHour(now) >= 8 && ilHour(now) < 20;
export const MAIL_SUBJECT = (friday) => '\u05e8\u05e9\u05d9\u05de\u05ea \u05e2\u05d1\u05d5\u05d3\u05d5\u05ea \u05dc\u05d9\u05d5\u05dd \u05e9\u05d9\u05e9\u05d9 ' + dmy(friday);
export function mailHtml(friday, url) {
  const p = (s) => '<p style="margin:0 0 10px">' + s + '</p>';
  return '<div dir="rtl" style="font-family:Arial,sans-serif;font-size:15px;line-height:1.6;color:#1f2937">'
    + p('\u05e9\u05dc\u05d5\u05dd,')
    + p('\u05d0\u05d1\u05e7\u05e9 \u05dc\u05e7\u05d1\u05dc \u05d0\u05ea \u05e8\u05e9\u05d9\u05de\u05ea \u05d4\u05e2\u05d1\u05d5\u05d3\u05d5\u05ea \u05d4\u05de\u05ea\u05d5\u05db\u05e0\u05e0\u05d5\u05ea \u05dc\u05d9\u05d5\u05dd \u05e9\u05d9\u05e9\u05d9 ' + dmy(friday) + ', \u05db\u05d3\u05d9 \u05e9\u05d0\u05d5\u05db\u05dc \u05dc\u05d1\u05d3\u05d5\u05e7 \u05d5\u05dc\u05d0\u05e9\u05e8 \u05de\u05e8\u05d0\u05e9 \u05e2\u05d1\u05d5\u05d3\u05d5\u05ea \u05de\u05d9\u05d5\u05d7\u05d3\u05d5\u05ea: \u05e2\u05d1\u05d5\u05d3\u05d4 \u05d1\u05d2\u05d5\u05d1\u05d4, \u05e2\u05d1\u05d5\u05d3\u05d5\u05ea \u05d7\u05de\u05d5\u05ea (\u05e8\u05d9\u05ea\u05d5\u05da, \u05d7\u05d9\u05ea\u05d5\u05da, \u05d4\u05e9\u05d7\u05d6\u05d4), \u05db\u05e0\u05d9\u05e1\u05d4 \u05dc\u05d7\u05dc\u05dc \u05de\u05d5\u05e7\u05e3, \u05e2\u05d1\u05d5\u05d3\u05d5\u05ea \u05d7\u05e9\u05de\u05dc \u05d5\u05d4\u05e0\u05e4\u05d4.')
    + p('\u05dc\u05db\u05dc \u05e2\u05d1\u05d5\u05d3\u05d4: \u05de\u05d4 \u05d4\u05e2\u05d1\u05d5\u05d3\u05d4, \u05d0\u05d9\u05e4\u05d4, \u05de\u05d9 \u05de\u05d1\u05e6\u05e2 (\u05e2\u05d5\u05d1\u05d3\u05d9 \u05d4\u05de\u05e4\u05e2\u05dc \u05d0\u05d5 \u05e7\u05d1\u05dc\u05df, \u05d5\u05e9\u05dd \u05d4\u05e7\u05d1\u05dc\u05df) \u05d5\u05de\u05d9 \u05d4\u05d0\u05d7\u05e8\u05d0\u05d9 \u05d1\u05de\u05e7\u05d5\u05dd, \u05d5\u05d0\u05de\u05e6\u05e2\u05d9 \u05d4\u05d1\u05d8\u05d9\u05d7\u05d5\u05ea. \u05d1\u05e0\u05d5\u05e1\u05e3: \u05de\u05d9 \u05e0\u05e6\u05d9\u05d2 \u05d4\u05de\u05e4\u05e2\u05dc \u05d1\u05d0\u05ea\u05e8 \u05d1\u05d9\u05d5\u05dd \u05e9\u05d9\u05e9\u05d9 \u05d5\u05de\u05d9 \u05de\u05d2\u05d9\u05e9 \u05d4\u05e2\u05d6\u05e8\u05d4 \u05d4\u05e8\u05d0\u05e9\u05d5\u05e0\u05d4.')
    + p('\u05de\u05de\u05dc\u05d0\u05d9\u05dd \u05d4\u05db\u05dc \u05d1\u05e7\u05d9\u05e9\u05d5\u05e8 \u05d4\u05d6\u05d4, \u05d2\u05dd \u05de\u05d4\u05d8\u05dc\u05e4\u05d5\u05df, \u05d5\u05de\u05e6\u05e8\u05e4\u05d9\u05dd \u05d1\u05d5 \u05d0\u05ea \u05d4\u05d0\u05d9\u05e9\u05d5\u05e8\u05d9\u05dd (\u05ea\u05e2\u05d5\u05d3\u05d5\u05ea \u05e2\u05d5\u05d1\u05d3\u05d9\u05dd, \u05ea\u05e1\u05e7\u05d9\u05e8\u05d9\u05dd):')
    + '<p style="margin:0 0 14px"><a href="' + esc(url) + '" style="display:inline-block;background:#1e3a8a;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:700">\u05dc\u05de\u05d9\u05dc\u05d5\u05d9 \u05e8\u05e9\u05d9\u05de\u05ea \u05d4\u05e2\u05d1\u05d5\u05d3\u05d5\u05ea</a></p>'
    + p('\u05d0\u05e4\u05e9\u05e8 \u05dc\u05d7\u05d6\u05d5\u05e8 \u05dc\u05e7\u05d9\u05e9\u05d5\u05e8 \u05d5\u05dc\u05ea\u05e7\u05df \u05e2\u05d3 \u05e9\u05d0\u05d0\u05e9\u05e8, \u05d5\u05dc\u05db\u05dc \u05d4\u05de\u05d0\u05d5\u05d7\u05e8 \u05e2\u05d3 \u05d9\u05d5\u05dd \u05e9\u05d9\u05e9\u05d9 ' + dmy(friday) + '. \u05d1\u05e1\u05d5\u05e3 \u05db\u05dc \u05e2\u05d1\u05d5\u05d3\u05d4 \u05d4\u05d0\u05d7\u05e8\u05d0\u05d9 \u05e1\u05d5\u05d2\u05e8 \u05d0\u05ea \u05d4\u05d4\u05d9\u05ea\u05e8 \u05d1\u05d0\u05d5\u05ea\u05d5 \u05e7\u05d9\u05e9\u05d5\u05e8. \u05d0\u05dd \u05d0\u05d9\u05df \u05e2\u05d1\u05d5\u05d3\u05d5\u05ea \u05de\u05d9\u05d5\u05d7\u05d3\u05d5\u05ea \u05d1\u05d9\u05d5\u05dd \u05e9\u05d9\u05e9\u05d9, \u05de\u05e1\u05de\u05e0\u05d9\u05dd \u05d6\u05d0\u05ea \u05d1\u05e7\u05d9\u05e9\u05d5\u05e8.')
    // Michael's own Outlook signature, as on every mail the server sends for him (05/11/2026: "with my stamp, Tapugan, title").
    + SITE.signature
    + '</div>';
}
export function mailList(raw) {
  const o = parseJson(raw);
  const ok = (a) => (Array.isArray(a) ? a : []).map((x) => String(x || '').trim().toLowerCase())
    .filter((x) => /^[a-z0-9._-]{1,40}@[a-z0-9.-]{3,60}$/.test(x) && x.endsWith(String(SITE.mailDomain || '').toLowerCase()));
  const to = ok(o && o.to).slice(0, 6), cc = ok(o && o.cc).slice(0, 4);
  return to.length ? { to, cc } : null;
}
// The one place that mails the link: the weekly mail and Michael's trial copy (05/11/2026). list = {to, cc}, or null
// for the connected account only (Michael's own mailbox; nobody else).
async function mailWeek(env, friday, list, prefix, nowMs, deps) {
  const tok = await makeWorksToken(env, friday, nowMs);
  if (!tok) return { error: 'no secret' };
  const od = await deps.accessToken(env);
  const to = list ? list.to : [od.email], cc = list ? list.cc : [];
  if (!to.length || !to[0]) return { error: 'no recipients' };
  await deps.sendMailTo(od.token, to, cc, prefix + MAIL_SUBJECT(friday), mailHtml(friday, worksUrl(tok)), []);
  return { to };
}
// A trial (Michael 05/11/2026: "send me the link by mail as maintenance would get it, and I fill it in myself"):
// the same mail, subject marked as a trial, to the connected account only. The weekly switch is not touched.
export const TRY_PREFIX = '\u05e0\u05d9\u05e1\u05d9\u05d5\u05df: ';
export async function worksTryMail(env, now, deps) {
  SB = sbFrom(env);
  const friday = fridayOf(now);
  const r = await mailWeek(env, friday, null, TRY_PREFIX, now.getTime(), deps);
  return r.error ? { ok: false, error: r.error } : { ok: true, friday, to: r.to };
}
// deps = {accessToken, sendMailTo} from _onedrive.js (wa-morning passes them; a test passes its own).
export async function worksTick(env, now, deps) {
  const m = mailDue(now), r = remindDue(now), o = openDue(now);
  if (!m && !r && !o) return null;
  SB = sbFrom(env);
  const friday = fridayOf(now);
  const rows = await sbGet(env, 'server_state?key=in.(' + MAIL_KEYS.join(',') + ')&select=key,value');
  const st = {}; (rows || []).forEach((x) => { st[x.key] = x.value; });
  if (o) {
    const last = addDays(friday, -7);
    if (st.works_open_last === last) return null;
    const open = await sbGet(env, 'ptw?id=like.' + encodeURIComponent('wk-' + last + '-*') + '&s=not.in.(' + NOT_APPROVED.map(encodeURIComponent).join(',') + ')&select=' + WEEK_COLS + '&order=id.asc&limit=100');
    if (!open.length) { await stateSet(env, 'works_open_last', last); return { open: 0 }; }
    const wa = await waOwner(env, openText(last, open), 'works open ' + last, now.getTime());
    if (wa.ok) await stateSet(env, 'works_open_last', last);
    return { open: open.length, sent: !!wa.ok, error: wa.error || null };
  }
  if (String(st.works_mail_on || '').trim() !== 'true') return { off: true };
  if (m) {
    if (st.works_mail_last === friday) return null;
    const list = mailList(st.works_mail_to);
    if (!list) return { mail: false, error: 'no recipients' };
    const sent = await mailWeek(env, friday, list, '', now.getTime(), deps);
    if (sent.error) return { mail: false, error: sent.error };
    await stateSet(env, 'works_mail_last', friday);
    return { mail: true, friday, to: list.to.length, cc: list.cc.length };
  }
  if (st.works_remind_last === friday) return null;
  const sub = parseJson(st[STATE_SUB]);
  if (sub && sub.friday === friday) return null;
  const text = remindText(friday);
  const wa = await waOwner(env, text, 'works remind ' + friday, now.getTime());
  if (wa.ok) await stateSet(env, 'works_remind_last', friday);
  return { remind: true, sent: !!wa.ok, error: wa.error || null };
}
