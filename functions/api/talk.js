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
// workers (Michael's choice: a name from a list); it shows no phone and no id
// number. Choosing a name that already signed answers "already signed": that
// tells the link holder about one worker, and asking costs a signature in that
// worker's name when they had not signed (checker, 03/10/2026; accepted).
// Not in MACHINE_PATHS: a person opens it, so the Israel-only rule applies.
import { defaultAllowedOrigins, corsHeaders, jsonResp, isAllowedCaller, requireRole, ipBucket } from '../_shared.js';
import { makeLinkToken, readLinkToken } from '../_closelink.js';
import { hebrewName, heName } from '../_ai.js';
import { accessToken, putFile, sendMailTo } from '../_onedrive.js';
import { LOGO_JPG } from '../_logo.js';

const SB = 'https://znhjtpcltrxxyfjczgvw.supabase.co';
const APP_URL = 'https://tapugan-safety.pages.dev';
const BUCKET = 'incidents-photos';
const PREFIX = 'talk-link:v1:';
export const TALK_TTL_DAYS = 14;
// Group mode (05/10/2026, Michael: "approve"): the trainer opens the talk on their own phone
// and passes it from hand to hand, after a face-to-face briefing. The amended training
// regulations (in force 16/10/2026) make face-to-face the default and online the exception,
// so each signature records which it was (toolbox_reads.mode). A group link is made by a
// signed-in manager for the phone in their hand: its own prefix, one day, and only there
// the list marks who already signed (a shared link does not show that).
const GROUP_PREFIX = 'talk-group:v1:';
export const GROUP_TTL_DAYS = 1;
// The trainer's closing declaration (regulations: a signed declaration of the trainer). Hebrew only:
// the trainer is the manager.
export const TR_DECL = '\u05d0\u05e0\u05d9 \u05de\u05e6\u05d4\u05d9\u05e8/\u05d4 \u05e9\u05d4\u05e2\u05d1\u05e8\u05ea\u05d9 \u05d0\u05ea \u05d4\u05d4\u05d3\u05e8\u05db\u05d4 \u05d4\u05d6\u05d5 \u05dc\u05e2\u05d5\u05d1\u05d3\u05d9\u05dd \u05e9\u05d7\u05ea\u05de\u05d5 \u05e2\u05dc\u05d9\u05d4, \u05e4\u05e0\u05d9\u05dd \u05d0\u05dc \u05e4\u05e0\u05d9\u05dd, \u05d1\u05e9\u05e4\u05d4 \u05e9\u05d4\u05dd \u05de\u05d1\u05d9\u05e0\u05d9\u05dd.';
const S_PUB = '\u05e4\u05d5\u05e8\u05e1\u05de\u05d4';
const MAX_SIG = 300 * 1024;
// Documents photographed at the induction (13/10/2026, Michael: "a place to photograph the documents
// for a new worker, it can be several"; in the questionnaire: "embedded in the PDF", "free photos").
// The phone shrinks each photo to a JPEG first (1400px, quality 0.7, a few hundred KB). They live
// only inside the signed form in OneDrive and its mail, never in the database or Storage.
export const MAX_DOCS = 8, MAX_DOC = 900 * 1024, MAX_DOCS_TOTAL = 4 * 1024 * 1024, MAIL_ATTACH_MAX = 3 * 1024 * 1024;
export function docsOf(list) {
  const out = []; let total = 0;
  for (const v of (list || [])) {
    const m = /^data:image\/jpeg;base64,([A-Za-z0-9+/=]+)$/.exec(String(v || ''));
    if (!m) continue;
    const n = Math.floor(m[1].length * 3 / 4);
    if (n < 2048 || n > MAX_DOC || total + n > MAX_DOCS_TOTAL || out.length >= MAX_DOCS) continue;
    total += n; out.push(m[1]);
  }
  return out;
}
const MIN_SIG = 400;
// A worker not on the list (03/10/2026, Michael: "not always everyone is on the
// list"): an ID or passport number and a typed name, kept as emp_id
// "x:<number>:<name as typed>" (the original) and as emp_name in Hebrew letters
// (the documentation is Hebrew). The number is who it is: the same number signs
// once per talk, whatever the spelling of the name (Michael, 03/10/2026: "ID missing"). The link holder can add made-up
// names: at most MAX_OUT per talk (Michael accepted, 03/10/2026).
export const OTHER = '__other';
export const MAX_OUT = 100;
// 5 to 12 letters and digits: an Israeli ID, or a passport.
export const idOf = (v) => { const s = String(v || '').replace(/[\s.-]/g, '').toUpperCase(); return /^[A-Z0-9]{5,12}$/.test(s) ? s : null; };
const oneLine = (v) => String(v || '').replace(/\s+/g, ' ').trim().substring(0, 60);

// Stage 3 (03/10/2026, Michael: "\u05e2\u05d1\u05e8\u05d9\u05ea, \u05e2\u05e8\u05d1\u05d9\u05ea, \u05e8\u05d5\u05e1\u05d9\u05ea, \u05d0\u05de\u05d4\u05e8\u05d9\u05ea/\u05d0\u05d7\u05e8"). The talk
// text comes translated from the manager's screen (body_ar / body_ru / body_am,
// first line = the title); these are the words of the page around it.
// Written by Claude, not by a native speaker: worth one look by a worker who
// reads each language (STATUS).
export const LANGS = {
  he: { name: '\u05e2\u05d1\u05e8\u05d9\u05ea', dir: 'rtl',
    errOkT: '\u05d7\u05e1\u05e8 \u05d0\u05d9\u05e9\u05d5\u05e8', errOk: '\u05e6\u05e8\u05d9\u05da \u05dc\u05e1\u05de\u05df \u05d0\u05ea \u05d4\u05d4\u05e6\u05d4\u05e8\u05d4 \u05e9\u05e7\u05d9\u05d1\u05dc\u05ea \u05d0\u05ea \u05d4\u05d4\u05d3\u05e8\u05db\u05d4 \u05d5\u05d4\u05d1\u05e0\u05ea \u05d0\u05d5\u05ea\u05d4.', errNameT: '\u05d7\u05e1\u05e8 \u05e9\u05dd', errName: '\u05d1\u05d7\u05e8 \u05d0\u05ea \u05d4\u05e9\u05dd \u05e9\u05dc\u05da \u05de\u05d4\u05e8\u05e9\u05d9\u05de\u05d4.', errSigT: '\u05d7\u05e1\u05e8\u05d4 \u05d7\u05ea\u05d9\u05de\u05d4', errSig: '\u05d4\u05d7\u05ea\u05d9\u05de\u05d4 \u05dc\u05d0 \u05e0\u05e7\u05dc\u05d8\u05d4. \u05d7\u05ea\u05d5\u05dd \u05d1\u05d0\u05e6\u05d1\u05e2 \u05d1\u05ea\u05d5\u05da \u05d4\u05de\u05e1\u05d2\u05e8\u05ea \u05d5\u05e0\u05e1\u05d4 \u05e9\u05d5\u05d1.', errSaveT: '\u05d4\u05e9\u05de\u05d9\u05e8\u05d4 \u05e0\u05db\u05e9\u05dc\u05d4', errSave: '\u05d4\u05d7\u05ea\u05d9\u05de\u05d4 \u05dc\u05d0 \u05e0\u05e9\u05de\u05e8\u05d4. \u05e0\u05e1\u05d4 \u05e9\u05d5\u05d1 \u05d1\u05e2\u05d5\u05d3 \u05d3\u05e7\u05d4.',
    title: '\u05d4\u05d3\u05e8\u05db\u05d4 \u05e9\u05d1\u05d5\u05e2\u05d9\u05ea', file: '\u05e4\u05ea\u05d7 \u05d0\u05ea \u05d4\u05e7\u05d5\u05d1\u05e5 \u05d4\u05de\u05e6\u05d5\u05e8\u05e3', you: '\u05d4\u05e9\u05dd \u05e9\u05dc\u05da', pick: '\u05d1\u05d7\u05e8 \u05de\u05d4\u05e8\u05e9\u05d9\u05de\u05d4',
    ok: '\u05d0\u05e0\u05d9 \u05de\u05d0\u05e9\u05e8/\u05ea \u05e9\u05e7\u05d9\u05d1\u05dc\u05ea\u05d9 \u05d4\u05d3\u05e8\u05db\u05d4 \u05e2\u05dc \u05d4\u05d5\u05e8\u05d0\u05d5\u05ea \u05d4\u05d1\u05d8\u05d9\u05d7\u05d5\u05ea \u05d1\u05e0\u05d5\u05e9\u05d0 \u05d6\u05d4, \u05d4\u05d1\u05e0\u05ea\u05d9 \u05d0\u05d5\u05ea\u05df \u05d5\u05d0\u05e4\u05e2\u05dc \u05dc\u05e4\u05d9\u05d4\u05df.', sig: '\u05d7\u05ea\u05d9\u05de\u05d4 \u05d1\u05d0\u05e6\u05d1\u05e2', clear: '\u05e0\u05e7\u05d4 \u05d7\u05ea\u05d9\u05de\u05d4', send: '\u05d7\u05ea\u05d5\u05dd \u05d5\u05e9\u05dc\u05d7', saving: '\u05e9\u05d5\u05de\u05e8...',
    noName: '\u05d1\u05d7\u05e8 \u05d0\u05ea \u05d4\u05e9\u05dd \u05e9\u05dc\u05da \u05de\u05d4\u05e8\u05e9\u05d9\u05de\u05d4', noSig: '\u05d7\u05e1\u05e8\u05d4 \u05d7\u05ea\u05d9\u05de\u05d4. \u05d7\u05ea\u05d5\u05dd \u05d1\u05d0\u05e6\u05d1\u05e2 \u05d1\u05ea\u05d5\u05da \u05d4\u05de\u05e1\u05d2\u05e8\u05ea', auto: '',
    thanks: '\u05ea\u05d5\u05d3\u05d4', saved: '\u05d4\u05d7\u05ea\u05d9\u05de\u05d4 \u05e0\u05e9\u05de\u05e8\u05d4.', next: '\u05e2\u05d5\u05d1\u05d3 \u05d4\u05d1\u05d0 \u05d7\u05d5\u05ea\u05dd', already: '\u05db\u05d1\u05e8 \u05d7\u05ea\u05de\u05ea \u05e2\u05dc \u05d4\u05d4\u05d3\u05e8\u05db\u05d4 \u05d4\u05d6\u05d5. \u05d0\u05d9\u05df \u05e6\u05d5\u05e8\u05da \u05dc\u05d7\u05ea\u05d5\u05dd \u05e9\u05d5\u05d1.', back: '\u05d7\u05d6\u05e8\u05d4 \u05dc\u05d4\u05d3\u05e8\u05db\u05d4',
    errT: '\u05dc\u05d0 \u05e0\u05d9\u05ea\u05df \u05dc\u05e4\u05ea\u05d5\u05d7', expired: '\u05ea\u05d5\u05e7\u05e3 \u05d4\u05e7\u05d9\u05e9\u05d5\u05e8 \u05e4\u05d2. \u05d1\u05e7\u05e9 \u05e7\u05d9\u05e9\u05d5\u05e8 \u05d7\u05d3\u05e9 \u05de\u05d4\u05de\u05de\u05d5\u05e0\u05d4 \u05e2\u05dc \u05d4\u05d1\u05d8\u05d9\u05d7\u05d5\u05ea.', badLink: '\u05d4\u05e7\u05d9\u05e9\u05d5\u05e8 \u05dc\u05d0 \u05ea\u05e7\u05d9\u05df. \u05d1\u05e7\u05e9 \u05e7\u05d9\u05e9\u05d5\u05e8 \u05d7\u05d3\u05e9 \u05de\u05d4\u05de\u05de\u05d5\u05e0\u05d4 \u05e2\u05dc \u05d4\u05d1\u05d8\u05d9\u05d7\u05d5\u05ea.', unpub: '\u05d4\u05d4\u05d3\u05e8\u05db\u05d4 \u05d4\u05d6\u05d5 \u05dc\u05d0 \u05e4\u05d5\u05e8\u05e1\u05de\u05d4 \u05d0\u05d5 \u05d4\u05d5\u05e1\u05e8\u05d4.',
    other: '\u05d0\u05e0\u05d9 \u05dc\u05d0 \u05d1\u05e8\u05e9\u05d9\u05de\u05d4', oname: '\u05e9\u05dd \u05de\u05dc\u05d0', ocomp: '\u05d7\u05d1\u05e8\u05d4 \u05d0\u05d5 \u05de\u05d7\u05dc\u05e7\u05d4 (\u05dc\u05d0 \u05d7\u05d5\u05d1\u05d4)', oNeed: '\u05db\u05ea\u05d5\u05d1 \u05d0\u05ea \u05d4\u05e9\u05dd \u05d4\u05de\u05dc\u05d0 \u05e9\u05dc\u05da', errHe: '\u05dc\u05d0 \u05d4\u05e6\u05dc\u05d7\u05e0\u05d5 \u05dc\u05e8\u05e9\u05d5\u05dd \u05d0\u05ea \u05d4\u05e9\u05dd. \u05db\u05ea\u05d5\u05d1 \u05d0\u05d5\u05ea\u05d5 \u05d1\u05d0\u05d5\u05ea\u05d9\u05d5\u05ea \u05e2\u05d1\u05e8\u05d9\u05d5\u05ea \u05d0\u05d5 \u05d1\u05e7\u05e9 \u05e2\u05d6\u05e8\u05d4 \u05de\u05e2\u05d5\u05d1\u05d3 \u05d0\u05d7\u05e8.', full: '\u05d4\u05d2\u05e2\u05e0\u05d5 \u05dc\u05de\u05e1\u05e4\u05e8 \u05d4\u05de\u05e8\u05d1\u05d9 \u05e9\u05dc \u05d7\u05d5\u05ea\u05de\u05d9\u05dd \u05de\u05d7\u05d5\u05e5 \u05dc\u05e8\u05e9\u05d9\u05de\u05d4. \u05e4\u05e0\u05d4 \u05dc\u05de\u05de\u05d5\u05e0\u05d4 \u05e2\u05dc \u05d4\u05d1\u05d8\u05d9\u05d7\u05d5\u05ea.', oid: '\u05ea\u05e2\u05d5\u05d3\u05ea \u05d6\u05d4\u05d5\u05ea \u05d0\u05d5 \u05d3\u05e8\u05db\u05d5\u05df', oIdNeed: '\u05db\u05ea\u05d5\u05d1 \u05de\u05e1\u05e4\u05e8 \u05ea\u05e2\u05d5\u05d3\u05ea \u05d6\u05d4\u05d5\u05ea \u05d0\u05d5 \u05d3\u05e8\u05db\u05d5\u05df', idMismatch: '\u05de\u05e1\u05e4\u05e8 \u05ea\u05e2\u05d5\u05d3\u05ea \u05d4\u05d6\u05d4\u05d5\u05ea \u05dc\u05d0 \u05ea\u05d5\u05d0\u05dd \u05d0\u05ea \u05d4\u05e8\u05e9\u05d5\u05dd \u05d0\u05e6\u05dc\u05e0\u05d5. \u05d1\u05d3\u05d5\u05e7 \u05d0\u05ea \u05d4\u05de\u05e1\u05e4\u05e8 \u05d0\u05d5 \u05e4\u05e0\u05d4 \u05dc\u05de\u05de\u05d5\u05e0\u05d4 \u05e2\u05dc \u05d4\u05d1\u05d8\u05d9\u05d7\u05d5\u05ea.', group: '\u05d4\u05d3\u05e8\u05db\u05d4 \u05e4\u05e0\u05d9\u05dd \u05d0\u05dc \u05e4\u05e0\u05d9\u05dd', trainerL: '\u05de\u05d3\u05e8\u05d9\u05da', signedL: '\u05d7\u05ea\u05dd' },
  ar: { name: '\u0627\u0644\u0639\u0631\u0628\u064a\u0629', dir: 'rtl',
    errOkT: '\u064a\u0646\u0642\u0635 \u0627\u0644\u062a\u0623\u0643\u064a\u062f', errOk: '\u064a\u062c\u0628 \u0648\u0636\u0639 \u0639\u0644\u0627\u0645\u0629 \u0639\u0644\u0649 \u0627\u0644\u062a\u0635\u0631\u064a\u062d \u0628\u0623\u0646\u0643 \u062a\u0644\u0642\u064a\u062a \u0627\u0644\u062a\u062f\u0631\u064a\u0628 \u0648\u0641\u0647\u0645\u062a\u0647.', errNameT: '\u064a\u0646\u0642\u0635 \u0627\u0644\u0627\u0633\u0645', errName: '\u0627\u062e\u062a\u0631 \u0627\u0633\u0645\u0643 \u0645\u0646 \u0627\u0644\u0642\u0627\u0626\u0645\u0629.', errSigT: '\u064a\u0646\u0642\u0635 \u0627\u0644\u062a\u0648\u0642\u064a\u0639', errSig: '\u0644\u0645 \u064a\u0635\u0644 \u0627\u0644\u062a\u0648\u0642\u064a\u0639. \u0648\u0642\u0651\u0639 \u0628\u0625\u0635\u0628\u0639\u0643 \u062f\u0627\u062e\u0644 \u0627\u0644\u0625\u0637\u0627\u0631 \u0648\u062d\u0627\u0648\u0644 \u0645\u0631\u0629 \u0623\u062e\u0631\u0649.', errSaveT: '\u0641\u0634\u0644 \u0627\u0644\u062d\u0641\u0638', errSave: '\u0644\u0645 \u064a\u062a\u0645 \u062d\u0641\u0638 \u0627\u0644\u062a\u0648\u0642\u064a\u0639. \u062d\u0627\u0648\u0644 \u0645\u0631\u0629 \u0623\u062e\u0631\u0649 \u0628\u0639\u062f \u062f\u0642\u064a\u0642\u0629.',
    title: '\u062a\u062f\u0631\u064a\u0628 \u0627\u0644\u0633\u0644\u0627\u0645\u0629 \u0627\u0644\u0623\u0633\u0628\u0648\u0639\u064a', file: '\u0627\u0641\u062a\u062d \u0627\u0644\u0645\u0644\u0641 \u0627\u0644\u0645\u0631\u0641\u0642', you: '\u0627\u0633\u0645\u0643', pick: '\u0627\u062e\u062a\u0631 \u0645\u0646 \u0627\u0644\u0642\u0627\u0626\u0645\u0629',
    ok: '\u0623\u0624\u0643\u062f \u0623\u0646\u0646\u064a \u062a\u0644\u0642\u064a\u062a \u062a\u062f\u0631\u064a\u0628\u0627 \u0639\u0644\u0649 \u062a\u0639\u0644\u064a\u0645\u0627\u062a \u0627\u0644\u0633\u0644\u0627\u0645\u0629 \u0641\u064a \u0647\u0630\u0627 \u0627\u0644\u0645\u0648\u0636\u0648\u0639\u060c \u0648\u0641\u0647\u0645\u062a\u0647\u0627 \u0648\u0633\u0623\u0639\u0645\u0644 \u0628\u0645\u0648\u062c\u0628\u0647\u0627.', sig: '\u0627\u0644\u062a\u0648\u0642\u064a\u0639 \u0628\u0627\u0644\u0625\u0635\u0628\u0639', clear: '\u0627\u0645\u0633\u062d \u0627\u0644\u062a\u0648\u0642\u064a\u0639', send: '\u0648\u0642\u0651\u0639 \u0648\u0623\u0631\u0633\u0644', saving: '\u062c\u0627\u0631 \u0627\u0644\u062d\u0641\u0638...',
    noName: '\u0627\u062e\u062a\u0631 \u0627\u0633\u0645\u0643 \u0645\u0646 \u0627\u0644\u0642\u0627\u0626\u0645\u0629', noSig: '\u0627\u0644\u062a\u0648\u0642\u064a\u0639 \u0646\u0627\u0642\u0635. \u0648\u0642\u0651\u0639 \u0628\u0625\u0635\u0628\u0639\u0643 \u062f\u0627\u062e\u0644 \u0627\u0644\u0625\u0637\u0627\u0631', auto: '\u062a\u0631\u062c\u0645\u0629 \u0622\u0644\u064a\u0629. \u0644\u0623\u064a \u0633\u0624\u0627\u0644 \u062a\u0648\u062c\u0651\u0647 \u0625\u0644\u0649 \u0645\u0633\u0624\u0648\u0644 \u0627\u0644\u0633\u0644\u0627\u0645\u0629.',
    thanks: '\u0634\u0643\u0631\u0627', saved: '\u062a\u0645 \u062d\u0641\u0638 \u0627\u0644\u062a\u0648\u0642\u064a\u0639.', next: '\u0627\u0644\u0639\u0627\u0645\u0644 \u0627\u0644\u062a\u0627\u0644\u064a \u064a\u0648\u0642\u0651\u0639', already: '\u0644\u0642\u062f \u0648\u0642\u0651\u0639\u062a \u0639\u0644\u0649 \u0647\u0630\u0627 \u0627\u0644\u062a\u062f\u0631\u064a\u0628 \u0645\u0646 \u0642\u0628\u0644. \u0644\u0627 \u062d\u0627\u062c\u0629 \u0644\u0644\u062a\u0648\u0642\u064a\u0639 \u0645\u0631\u0629 \u0623\u062e\u0631\u0649.', back: '\u0627\u0644\u0639\u0648\u062f\u0629 \u0625\u0644\u0649 \u0627\u0644\u062a\u062f\u0631\u064a\u0628',
    errT: '\u0644\u0627 \u064a\u0645\u0643\u0646 \u0627\u0644\u0641\u062a\u062d', expired: '\u0627\u0646\u062a\u0647\u062a \u0635\u0644\u0627\u062d\u064a\u0629 \u0627\u0644\u0631\u0627\u0628\u0637. \u0627\u0637\u0644\u0628 \u0631\u0627\u0628\u0637\u0627 \u062c\u062f\u064a\u062f\u0627 \u0645\u0646 \u0645\u0633\u0624\u0648\u0644 \u0627\u0644\u0633\u0644\u0627\u0645\u0629.', badLink: '\u0627\u0644\u0631\u0627\u0628\u0637 \u063a\u064a\u0631 \u0635\u0627\u0644\u062d. \u0627\u0637\u0644\u0628 \u0631\u0627\u0628\u0637\u0627 \u062c\u062f\u064a\u062f\u0627 \u0645\u0646 \u0645\u0633\u0624\u0648\u0644 \u0627\u0644\u0633\u0644\u0627\u0645\u0629.', unpub: '\u0647\u0630\u0627 \u0627\u0644\u062a\u062f\u0631\u064a\u0628 \u063a\u064a\u0631 \u0645\u0646\u0634\u0648\u0631 \u0623\u0648 \u062a\u0645\u062a \u0625\u0632\u0627\u0644\u062a\u0647.',
    other: '\u0627\u0633\u0645\u064a \u063a\u064a\u0631 \u0645\u0648\u062c\u0648\u062f \u0641\u064a \u0627\u0644\u0642\u0627\u0626\u0645\u0629', oname: '\u0627\u0644\u0627\u0633\u0645 \u0627\u0644\u0643\u0627\u0645\u0644', ocomp: '\u0627\u0644\u0634\u0631\u0643\u0629 \u0623\u0648 \u0627\u0644\u0642\u0633\u0645 (\u0627\u062e\u062a\u064a\u0627\u0631\u064a)', oNeed: '\u0627\u0643\u062a\u0628 \u0627\u0633\u0645\u0643 \u0627\u0644\u0643\u0627\u0645\u0644', errHe: '\u0644\u0645 \u0646\u062a\u0645\u0643\u0646 \u0645\u0646 \u062a\u0633\u062c\u064a\u0644 \u0627\u0644\u0627\u0633\u0645. \u0627\u0643\u062a\u0628\u0647 \u0628\u0623\u062d\u0631\u0641 \u0639\u0628\u0631\u064a\u0629 \u0623\u0648 \u0627\u0637\u0644\u0628 \u0627\u0644\u0645\u0633\u0627\u0639\u062f\u0629 \u0645\u0646 \u0639\u0627\u0645\u0644 \u0622\u062e\u0631.', full: '\u062a\u0645 \u0627\u0644\u0648\u0635\u0648\u0644 \u0625\u0644\u0649 \u0627\u0644\u062d\u062f \u0627\u0644\u0623\u0642\u0635\u0649 \u0644\u0644\u0645\u0648\u0642\u0639\u064a\u0646 \u0645\u0646 \u062e\u0627\u0631\u062c \u0627\u0644\u0642\u0627\u0626\u0645\u0629. \u062a\u0648\u062c\u0647 \u0625\u0644\u0649 \u0645\u0633\u0624\u0648\u0644 \u0627\u0644\u0633\u0644\u0627\u0645\u0629.', oid: '\u0631\u0642\u0645 \u0627\u0644\u0647\u0648\u064a\u0629 \u0623\u0648 \u062c\u0648\u0627\u0632 \u0627\u0644\u0633\u0641\u0631', oIdNeed: '\u0627\u0643\u062a\u0628 \u0631\u0642\u0645 \u0627\u0644\u0647\u0648\u064a\u0629 \u0623\u0648 \u062c\u0648\u0627\u0632 \u0627\u0644\u0633\u0641\u0631', idMismatch: '\u0631\u0642\u0645 \u0627\u0644\u0647\u0648\u064a\u0629 \u0644\u0627 \u064a\u0637\u0627\u0628\u0642 \u0627\u0644\u0645\u0633\u062c\u0644 \u0644\u062f\u064a\u0646\u0627. \u062a\u062d\u0642\u0642 \u0645\u0646 \u0627\u0644\u0631\u0642\u0645 \u0623\u0648 \u062a\u0648\u062c\u0647 \u0625\u0644\u0649 \u0645\u0633\u0624\u0648\u0644 \u0627\u0644\u0633\u0644\u0627\u0645\u0629.', group: '\u062a\u062f\u0631\u064a\u0628 \u0648\u062c\u0647\u0627\u064b \u0644\u0648\u062c\u0647', trainerL: '\u0627\u0644\u0645\u062f\u0631\u0628', signedL: '\u0648\u0642\u0651\u0639' },
  ru: { name: '\u0420\u0443\u0441\u0441\u043a\u0438\u0439', dir: 'ltr',
    errOkT: '\u041d\u0435\u0442 \u043f\u043e\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0435\u043d\u0438\u044f', errOk: '\u041d\u0443\u0436\u043d\u043e \u043e\u0442\u043c\u0435\u0442\u0438\u0442\u044c \u043f\u043e\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0435\u043d\u0438\u0435, \u0447\u0442\u043e \u0432\u044b \u043f\u0440\u043e\u0448\u043b\u0438 \u0438\u043d\u0441\u0442\u0440\u0443\u043a\u0442\u0430\u0436 \u0438 \u043f\u043e\u043d\u044f\u043b\u0438 \u0435\u0433\u043e.', errNameT: '\u041d\u0435\u0442 \u0438\u043c\u0435\u043d\u0438', errName: '\u0412\u044b\u0431\u0435\u0440\u0438\u0442\u0435 \u0441\u0432\u043e\u0451 \u0438\u043c\u044f \u0438\u0437 \u0441\u043f\u0438\u0441\u043a\u0430.', errSigT: '\u041d\u0435\u0442 \u043f\u043e\u0434\u043f\u0438\u0441\u0438', errSig: '\u041f\u043e\u0434\u043f\u0438\u0441\u044c \u043d\u0435 \u043f\u043e\u043b\u0443\u0447\u0435\u043d\u0430. \u0420\u0430\u0441\u043f\u0438\u0448\u0438\u0442\u0435\u0441\u044c \u043f\u0430\u043b\u044c\u0446\u0435\u043c \u0432\u043d\u0443\u0442\u0440\u0438 \u0440\u0430\u043c\u043a\u0438 \u0438 \u043f\u043e\u043f\u0440\u043e\u0431\u0443\u0439\u0442\u0435 \u0441\u043d\u043e\u0432\u0430.', errSaveT: '\u041e\u0448\u0438\u0431\u043a\u0430 \u0441\u043e\u0445\u0440\u0430\u043d\u0435\u043d\u0438\u044f', errSave: '\u041f\u043e\u0434\u043f\u0438\u0441\u044c \u043d\u0435 \u0441\u043e\u0445\u0440\u0430\u043d\u0435\u043d\u0430. \u041f\u043e\u043f\u0440\u043e\u0431\u0443\u0439\u0442\u0435 \u0441\u043d\u043e\u0432\u0430 \u0447\u0435\u0440\u0435\u0437 \u043c\u0438\u043d\u0443\u0442\u0443.',
    title: '\u0415\u0436\u0435\u043d\u0435\u0434\u0435\u043b\u044c\u043d\u044b\u0439 \u0438\u043d\u0441\u0442\u0440\u0443\u043a\u0442\u0430\u0436 \u043f\u043e \u0431\u0435\u0437\u043e\u043f\u0430\u0441\u043d\u043e\u0441\u0442\u0438', file: '\u041e\u0442\u043a\u0440\u044b\u0442\u044c \u043f\u0440\u0438\u043b\u043e\u0436\u0435\u043d\u043d\u044b\u0439 \u0444\u0430\u0439\u043b', you: '\u0412\u0430\u0448\u0435 \u0438\u043c\u044f', pick: '\u0412\u044b\u0431\u0435\u0440\u0438\u0442\u0435 \u0438\u0437 \u0441\u043f\u0438\u0441\u043a\u0430',
    ok: '\u041f\u043e\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0430\u044e, \u0447\u0442\u043e \u043f\u0440\u043e\u0448\u0451\u043b(\u043b\u0430) \u0438\u043d\u0441\u0442\u0440\u0443\u043a\u0442\u0430\u0436 \u043f\u043e \u043f\u0440\u0430\u0432\u0438\u043b\u0430\u043c \u0431\u0435\u0437\u043e\u043f\u0430\u0441\u043d\u043e\u0441\u0442\u0438 \u043f\u043e \u044d\u0442\u043e\u0439 \u0442\u0435\u043c\u0435, \u043f\u043e\u043d\u044f\u043b(\u0430) \u0438\u0445 \u0438 \u0431\u0443\u0434\u0443 \u0438\u0445 \u0441\u043e\u0431\u043b\u044e\u0434\u0430\u0442\u044c.', sig: '\u041f\u043e\u0434\u043f\u0438\u0441\u044c \u043f\u0430\u043b\u044c\u0446\u0435\u043c', clear: '\u0421\u0442\u0435\u0440\u0435\u0442\u044c \u043f\u043e\u0434\u043f\u0438\u0441\u044c', send: '\u041f\u043e\u0434\u043f\u0438\u0441\u0430\u0442\u044c \u0438 \u043e\u0442\u043f\u0440\u0430\u0432\u0438\u0442\u044c', saving: '\u0421\u043e\u0445\u0440\u0430\u043d\u044f\u044e...',
    noName: '\u0412\u044b\u0431\u0435\u0440\u0438\u0442\u0435 \u0441\u0432\u043e\u0451 \u0438\u043c\u044f \u0438\u0437 \u0441\u043f\u0438\u0441\u043a\u0430', noSig: '\u041d\u0435\u0442 \u043f\u043e\u0434\u043f\u0438\u0441\u0438. \u0420\u0430\u0441\u043f\u0438\u0448\u0438\u0442\u0435\u0441\u044c \u043f\u0430\u043b\u044c\u0446\u0435\u043c \u0432\u043d\u0443\u0442\u0440\u0438 \u0440\u0430\u043c\u043a\u0438', auto: '\u0410\u0432\u0442\u043e\u043c\u0430\u0442\u0438\u0447\u0435\u0441\u043a\u0438\u0439 \u043f\u0435\u0440\u0435\u0432\u043e\u0434. \u0421 \u0432\u043e\u043f\u0440\u043e\u0441\u0430\u043c\u0438 \u043e\u0431\u0440\u0430\u0449\u0430\u0439\u0442\u0435\u0441\u044c \u043a \u043e\u0442\u0432\u0435\u0442\u0441\u0442\u0432\u0435\u043d\u043d\u043e\u043c\u0443 \u043f\u043e \u0431\u0435\u0437\u043e\u043f\u0430\u0441\u043d\u043e\u0441\u0442\u0438.',
    thanks: '\u0421\u043f\u0430\u0441\u0438\u0431\u043e', saved: '\u041f\u043e\u0434\u043f\u0438\u0441\u044c \u0441\u043e\u0445\u0440\u0430\u043d\u0435\u043d\u0430.', next: '\u0421\u043b\u0435\u0434\u0443\u044e\u0449\u0438\u0439 \u0440\u0430\u0431\u043e\u0442\u043d\u0438\u043a', already: '\u0412\u044b \u0443\u0436\u0435 \u043f\u043e\u0434\u043f\u0438\u0441\u0430\u043b\u0438 \u044d\u0442\u043e\u0442 \u0438\u043d\u0441\u0442\u0440\u0443\u043a\u0442\u0430\u0436. \u041f\u043e\u0434\u043f\u0438\u0441\u044b\u0432\u0430\u0442\u044c \u0441\u043d\u043e\u0432\u0430 \u043d\u0435 \u043d\u0443\u0436\u043d\u043e.', back: '\u0412\u0435\u0440\u043d\u0443\u0442\u044c\u0441\u044f \u043a \u0438\u043d\u0441\u0442\u0440\u0443\u043a\u0442\u0430\u0436\u0443',
    errT: '\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u043e\u0442\u043a\u0440\u044b\u0442\u044c', expired: '\u0421\u0440\u043e\u043a \u0434\u0435\u0439\u0441\u0442\u0432\u0438\u044f \u0441\u0441\u044b\u043b\u043a\u0438 \u0438\u0441\u0442\u0451\u043a. \u041f\u043e\u043f\u0440\u043e\u0441\u0438\u0442\u0435 \u043d\u043e\u0432\u0443\u044e \u0441\u0441\u044b\u043b\u043a\u0443 \u0443 \u043e\u0442\u0432\u0435\u0442\u0441\u0442\u0432\u0435\u043d\u043d\u043e\u0433\u043e \u043f\u043e \u0431\u0435\u0437\u043e\u043f\u0430\u0441\u043d\u043e\u0441\u0442\u0438.', badLink: '\u0421\u0441\u044b\u043b\u043a\u0430 \u043d\u0435\u0434\u0435\u0439\u0441\u0442\u0432\u0438\u0442\u0435\u043b\u044c\u043d\u0430. \u041f\u043e\u043f\u0440\u043e\u0441\u0438\u0442\u0435 \u043d\u043e\u0432\u0443\u044e \u0441\u0441\u044b\u043b\u043a\u0443 \u0443 \u043e\u0442\u0432\u0435\u0442\u0441\u0442\u0432\u0435\u043d\u043d\u043e\u0433\u043e \u043f\u043e \u0431\u0435\u0437\u043e\u043f\u0430\u0441\u043d\u043e\u0441\u0442\u0438.', unpub: '\u042d\u0442\u043e\u0442 \u0438\u043d\u0441\u0442\u0440\u0443\u043a\u0442\u0430\u0436 \u043d\u0435 \u043e\u043f\u0443\u0431\u043b\u0438\u043a\u043e\u0432\u0430\u043d \u0438\u043b\u0438 \u0443\u0434\u0430\u043b\u0451\u043d.',
    other: '\u041c\u0435\u043d\u044f \u043d\u0435\u0442 \u0432 \u0441\u043f\u0438\u0441\u043a\u0435', oname: '\u041f\u043e\u043b\u043d\u043e\u0435 \u0438\u043c\u044f', ocomp: '\u041a\u043e\u043c\u043f\u0430\u043d\u0438\u044f \u0438\u043b\u0438 \u043e\u0442\u0434\u0435\u043b (\u043d\u0435\u043e\u0431\u044f\u0437\u0430\u0442\u0435\u043b\u044c\u043d\u043e)', oNeed: '\u041d\u0430\u043f\u0438\u0448\u0438\u0442\u0435 \u0441\u0432\u043e\u0451 \u043f\u043e\u043b\u043d\u043e\u0435 \u0438\u043c\u044f', errHe: '\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u0437\u0430\u043f\u0438\u0441\u0430\u0442\u044c \u0438\u043c\u044f. \u041d\u0430\u043f\u0438\u0448\u0438\u0442\u0435 \u0435\u0433\u043e \u0431\u0443\u043a\u0432\u0430\u043c\u0438 \u0438\u0432\u0440\u0438\u0442\u0430 \u0438\u043b\u0438 \u043f\u043e\u043f\u0440\u043e\u0441\u0438\u0442\u0435 \u043f\u043e\u043c\u043e\u0449\u0438 \u0443 \u0434\u0440\u0443\u0433\u043e\u0433\u043e \u0440\u0430\u0431\u043e\u0442\u043d\u0438\u043a\u0430.', full: '\u0414\u043e\u0441\u0442\u0438\u0433\u043d\u0443\u0442\u043e \u043c\u0430\u043a\u0441\u0438\u043c\u0430\u043b\u044c\u043d\u043e\u0435 \u0447\u0438\u0441\u043b\u043e \u043f\u043e\u0434\u043f\u0438\u0441\u0435\u0439 \u0432\u043d\u0435 \u0441\u043f\u0438\u0441\u043a\u0430. \u041e\u0431\u0440\u0430\u0442\u0438\u0442\u0435\u0441\u044c \u043a \u043e\u0442\u0432\u0435\u0442\u0441\u0442\u0432\u0435\u043d\u043d\u043e\u043c\u0443 \u043f\u043e \u0431\u0435\u0437\u043e\u043f\u0430\u0441\u043d\u043e\u0441\u0442\u0438.', oid: '\u041d\u043e\u043c\u0435\u0440 \u0443\u0434\u043e\u0441\u0442\u043e\u0432\u0435\u0440\u0435\u043d\u0438\u044f \u043b\u0438\u0447\u043d\u043e\u0441\u0442\u0438 \u0438\u043b\u0438 \u043f\u0430\u0441\u043f\u043e\u0440\u0442\u0430', oIdNeed: '\u0423\u043a\u0430\u0436\u0438\u0442\u0435 \u043d\u043e\u043c\u0435\u0440 \u0443\u0434\u043e\u0441\u0442\u043e\u0432\u0435\u0440\u0435\u043d\u0438\u044f \u043b\u0438\u0447\u043d\u043e\u0441\u0442\u0438 \u0438\u043b\u0438 \u043f\u0430\u0441\u043f\u043e\u0440\u0442\u0430', idMismatch: '\u041d\u043e\u043c\u0435\u0440 \u0443\u0434\u043e\u0441\u0442\u043e\u0432\u0435\u0440\u0435\u043d\u0438\u044f \u043d\u0435 \u0441\u043e\u0432\u043f\u0430\u0434\u0430\u0435\u0442 \u0441 \u0437\u0430\u043f\u0438\u0441\u0430\u043d\u043d\u044b\u043c \u0443 \u043d\u0430\u0441. \u041f\u0440\u043e\u0432\u0435\u0440\u044c\u0442\u0435 \u043d\u043e\u043c\u0435\u0440 \u0438\u043b\u0438 \u043e\u0431\u0440\u0430\u0442\u0438\u0442\u0435\u0441\u044c \u043a \u043e\u0442\u0432\u0435\u0442\u0441\u0442\u0432\u0435\u043d\u043d\u043e\u043c\u0443 \u043f\u043e \u0431\u0435\u0437\u043e\u043f\u0430\u0441\u043d\u043e\u0441\u0442\u0438.', group: '\u0418\u043d\u0441\u0442\u0440\u0443\u043a\u0442\u0430\u0436 \u043b\u0438\u0447\u043d\u043e', trainerL: '\u0418\u043d\u0441\u0442\u0440\u0443\u043a\u0442\u043e\u0440', signedL: '\u043f\u043e\u0434\u043f\u0438\u0441\u0430\u043b' },
  am: { name: '\u12a0\u121b\u122d\u129b', dir: 'ltr',
    errOkT: '\u121b\u1228\u130b\u1308\u132b \u12ed\u130e\u12f5\u120b\u120d', errOk: '\u1235\u120d\u1320\u1293\u12cd\u1295 \u12a5\u1295\u12f0\u12c8\u1230\u12f1 \u12a5\u1293 \u12a5\u1295\u12f0\u1270\u1228\u12f1\u1275 \u12e8\u121a\u1308\u120d\u1338\u12cd\u1295 \u121b\u1228\u130b\u1308\u132b \u121d\u120d\u12ad\u1275 \u12eb\u12f5\u122d\u1309\u1362', errNameT: '\u1235\u121d \u12ed\u130e\u12f5\u120b\u120d', errName: '\u1235\u121d\u12ce\u1295 \u12a8\u12dd\u122d\u12dd\u1229 \u12ed\u121d\u1228\u1321\u1362', errSigT: '\u134a\u122d\u121b \u12ed\u130e\u12f5\u120b\u120d', errSig: '\u134a\u122d\u121b\u12cd \u12a0\u120d\u12f0\u1228\u1230\u121d\u1362 \u1260\u1233\u1325\u1291 \u12cd\u1235\u1325 \u1260\u1323\u1275\u12ce \u1348\u122d\u1218\u12cd \u12a5\u1295\u12f0\u1308\u1293 \u12ed\u121e\u12ad\u1229\u1362', errSaveT: '\u121b\u1235\u1240\u1218\u1325 \u12a0\u120d\u1270\u1233\u12ab\u121d', errSave: '\u134a\u122d\u121b\u12cd \u12a0\u120d\u1270\u1240\u1218\u1320\u121d\u1362 \u12a8\u12a0\u1295\u12f5 \u12f0\u1242\u1243 \u1260\u128b\u120b \u12a5\u1295\u12f0\u1308\u1293 \u12ed\u121e\u12ad\u1229\u1362',
    title: '\u1233\u121d\u1295\u1273\u12ca \u12e8\u12f0\u1205\u1295\u1290\u1275 \u1235\u120d\u1320\u1293', file: '\u12e8\u1270\u12eb\u12eb\u12d8\u12cd\u1295 \u134b\u12ed\u120d \u12ad\u1348\u1275', you: '\u1235\u121d\u12ce', pick: '\u12a8\u12dd\u122d\u12dd\u1229 \u12ed\u121d\u1228\u1321',
    ok: '\u1260\u12da\u1205 \u122d\u12d5\u1235 \u120b\u12ed \u12e8\u12f0\u1205\u1295\u1290\u1275 \u1218\u1218\u122a\u12eb\u12ce\u127d \u1235\u120d\u1320\u1293 \u12a5\u1295\u12f0\u12c8\u1230\u12f5\u12a9\u1363 \u12a5\u1295\u12f0\u1270\u1228\u12f3\u128b\u1278\u12cd \u12a5\u1293 \u1260\u12a5\u1290\u1231 \u1218\u1230\u1228\u1275 \u12a5\u1295\u12f0\u121d\u1230\u122b \u12a0\u1228\u130b\u130d\u1323\u1208\u1201\u1362', sig: '\u1260\u1323\u1275 \u12ed\u1348\u122d\u1219', clear: '\u134a\u122d\u121b\u12cd\u1295 \u12a0\u1325\u134b', send: '\u1348\u122d\u1218\u12cd \u12ed\u120b\u12a9', saving: '\u1260\u121b\u1235\u1240\u1218\u1325 \u120b\u12ed...',
    noName: '\u12a5\u1263\u12ad\u12ce \u1235\u121d\u12ce\u1295 \u12a8\u12dd\u122d\u12dd\u1229 \u12ed\u121d\u1228\u1321', noSig: '\u134a\u122d\u121b \u12e8\u1208\u121d\u1362 \u1260\u1233\u1325\u1291 \u12cd\u1235\u1325 \u1260\u1323\u1275\u12ce \u12ed\u1348\u122d\u1219', auto: '\u1260\u121b\u123d\u1295 \u12e8\u1270\u1270\u1228\u130e\u1218\u1362 \u1325\u12eb\u1244 \u12ab\u1208\u12ce\u1275 \u12e8\u12f0\u1205\u1295\u1290\u1275 \u1283\u120b\u134a\u12cd\u1295 \u12ed\u1320\u12ed\u1241\u1362',
    thanks: '\u12a5\u1293\u1218\u1230\u130d\u1293\u1208\u1295', saved: '\u134a\u122d\u121b\u12ce \u1270\u1240\u121d\u1327\u120d\u1362', next: '\u1240\u1323\u12e9 \u1230\u122b\u1270\u129b \u12ed\u1348\u122d\u121d', already: '\u1260\u12da\u1205 \u1235\u120d\u1320\u1293 \u120b\u12ed \u12a0\u1235\u1240\u12f5\u1218\u12cd \u1348\u122d\u1218\u12cb\u120d\u1362 \u12a5\u1295\u12f0\u1308\u1293 \u1218\u1348\u1228\u121d \u12a0\u12eb\u1235\u1348\u120d\u130d\u121d\u1362', back: '\u12c8\u12f0 \u1235\u120d\u1320\u1293\u12cd \u1270\u1218\u1208\u1235',
    errT: '\u1218\u12ad\u1348\u1275 \u12a0\u120d\u1270\u127b\u1208\u121d', expired: '\u12e8\u120a\u1295\u12a9 \u130a\u12dc \u12a0\u120d\u134f\u120d\u1362 \u12a8\u12f0\u1205\u1295\u1290\u1275 \u1283\u120b\u134a\u12cd \u12a0\u12f2\u1235 \u120a\u1295\u12ad \u12ed\u1320\u12ed\u1241\u1362', badLink: '\u120a\u1295\u12a9 \u1275\u12ad\u12ad\u120d \u12a0\u12ed\u12f0\u1208\u121d\u1362 \u12a8\u12f0\u1205\u1295\u1290\u1275 \u1283\u120b\u134a\u12cd \u12a0\u12f2\u1235 \u120a\u1295\u12ad \u12ed\u1320\u12ed\u1241\u1362', unpub: '\u12ed\u1205 \u1235\u120d\u1320\u1293 \u12a0\u120d\u1273\u1270\u1218\u121d \u12c8\u12ed\u121d \u1270\u12c8\u130d\u12f7\u120d\u1362',
    other: '\u1235\u121c \u1260\u12dd\u122d\u12dd\u1229 \u12cd\u1235\u1325 \u12e8\u1208\u121d', oname: '\u1219\u1209 \u1235\u121d', ocomp: '\u12a9\u1263\u1295\u12eb \u12c8\u12ed\u121d \u12ad\u134d\u120d (\u12a0\u121b\u122b\u132d)', oNeed: '\u1219\u1209 \u1235\u121d\u12ce\u1295 \u12ed\u133b\u1349', errHe: '\u1235\u1219\u1295 \u1218\u1218\u12dd\u1308\u1265 \u12a0\u120d\u1270\u127b\u1208\u121d\u1362 \u1260\u12d5\u1265\u122b\u12ed\u1235\u1325 \u134a\u12f0\u120b\u1275 \u12ed\u133b\u1349\u1275 \u12c8\u12ed\u121d \u12a8\u120c\u120b \u1230\u122b\u1270\u129b \u12a5\u122d\u12f3\u1273 \u12ed\u1320\u12ed\u1241\u1362', full: '\u12a8\u12dd\u122d\u12dd\u1229 \u12cd\u132d \u12e8\u121a\u1348\u122d\u1219 \u1230\u12ce\u127d \u12a8\u134d\u1270\u129b\u12cd \u1241\u1325\u122d \u12f0\u122d\u1237\u120d\u1362 \u12e8\u12f0\u1205\u1295\u1290\u1275 \u1283\u120b\u134a\u12cd\u1295 \u12eb\u1290\u130b\u130d\u1229\u1362', oid: '\u12e8\u1218\u1273\u12c8\u1242\u12eb \u12c8\u12ed\u121d \u12e8\u1353\u1235\u1356\u122d\u1275 \u1241\u1325\u122d', oIdNeed: '\u12e8\u1218\u1273\u12c8\u1242\u12eb \u12c8\u12ed\u121d \u12e8\u1353\u1235\u1356\u122d\u1275 \u1241\u1325\u122d \u12ed\u133b\u1349', idMismatch: '\u12e8\u1218\u1273\u12c8\u1242\u12eb \u1241\u1325\u1229 \u12a8\u1270\u1218\u12d8\u1308\u1260\u12cd \u130b\u122d \u12a0\u12ed\u12db\u1218\u12f5\u121d\u1362 \u1241\u1325\u1229\u1295 \u12eb\u1228\u130b\u130d\u1321 \u12c8\u12ed\u121d \u12e8\u12f0\u1205\u1295\u1290\u1275 \u1283\u120b\u134a\u12cd\u1295 \u12eb\u1290\u130b\u130d\u1229\u1362', group: '\u134a\u1275 \u1208\u134a\u1275 \u1235\u120d\u1320\u1293', trainerL: '\u12a0\u1230\u120d\u1323\u129d', signedL: '\u1348\u122d\u121f\u120d' },
};
// Video and comprehension questions (10/10/2026, Michael: "\u05d9\u05e9 \u05d2\u05dd \u05e1\u05e8\u05d8\u05d5\u05e0\u05d9\u05dd"; the order approved
// 05/10/2026 in DECISIONS: a video in the page, then a question that is not required).
const VID = { he: ['\u05e1\u05e8\u05d8\u05d5\u05df \u05d4\u05d4\u05d3\u05e8\u05db\u05d4', '\u05e4\u05ea\u05d7 \u05d0\u05ea \u05d4\u05e1\u05e8\u05d8\u05d5\u05df'], ar: ['\u0641\u064a\u062f\u064a\u0648 \u0627\u0644\u062a\u062f\u0631\u064a\u0628', '\u0627\u0641\u062a\u062d \u0627\u0644\u0641\u064a\u062f\u064a\u0648'], ru: ['\u0412\u0438\u0434\u0435\u043e \u0438\u043d\u0441\u0442\u0440\u0443\u043a\u0442\u0430\u0436\u0430', '\u041e\u0442\u043a\u0440\u044b\u0442\u044c \u0432\u0438\u0434\u0435\u043e'], am: ['\u12e8\u1235\u120d\u1320\u1293 \u126a\u12f2\u12ee', '\u126a\u12f2\u12ee\u12cd\u1295 \u12ad\u1348\u1275'] };
for (const k of Object.keys(VID)) { LANGS[k].video = VID[k][0]; LANGS[k].vOpen = VID[k][1]; }
const IND_T = { he: '\u05d4\u05d3\u05e8\u05db\u05ea \u05e7\u05dc\u05d9\u05d8\u05d4 \u05dc\u05e2\u05d5\u05d1\u05d3 \u05d7\u05d3\u05e9', ar: '\u062a\u062f\u0631\u064a\u0628 \u0627\u0633\u062a\u064a\u0639\u0627\u0628 \u0644\u0644\u0639\u0627\u0645\u0644 \u0627\u0644\u062c\u062f\u064a\u062f', ru: '\u0412\u0432\u043e\u0434\u043d\u044b\u0439 \u0438\u043d\u0441\u0442\u0440\u0443\u043a\u0442\u0430\u0436 \u0434\u043b\u044f \u043d\u043e\u0432\u043e\u0433\u043e \u0440\u0430\u0431\u043e\u0442\u043d\u0438\u043a\u0430', am: '\u1208\u12a0\u12f2\u1235 \u1230\u122b\u1270\u129b \u12e8\u1218\u130d\u1262\u12eb \u1235\u120d\u1320\u1293' };
for (const k of Object.keys(IND_T)) LANGS[k].indT = IND_T[k];
// The manager writes the questions in Hebrew; the translate button in the form adds them in
// Arabic, Russian and Amharic (Michael, 10/10/2026: "\u05d1\u05e6\u05e2: \u05dc\u05ea\u05e8\u05d2\u05dd \u05e2\u05dd \u05d4\u05db\u05e4\u05ea\u05d5\u05e8 \u05d4\u05e7\u05d9\u05d9\u05dd"). A question
// with no translation for the page's language is left out of that page.
export const QZL = {
  he: { t: '\u05d1\u05d3\u05d9\u05e7\u05ea \u05d4\u05d1\u05e0\u05d4 (\u05dc\u05d0 \u05d7\u05d5\u05d1\u05d4)', ok: '\u05e0\u05db\u05d5\u05df', no: '\u05d4\u05ea\u05e9\u05d5\u05d1\u05d4 \u05d4\u05e0\u05db\u05d5\u05e0\u05d4:' },
  ar: { t: '\u0627\u062e\u062a\u0628\u0627\u0631 \u0641\u0647\u0645 (\u063a\u064a\u0631 \u0625\u0644\u0632\u0627\u0645\u064a)', ok: '\u0635\u062d\u064a\u062d', no: '\u0627\u0644\u0625\u062c\u0627\u0628\u0629 \u0627\u0644\u0635\u062d\u064a\u062d\u0629:' },
  ru: { t: '\u041f\u0440\u043e\u0432\u0435\u0440\u043a\u0430 \u043f\u043e\u043d\u0438\u043c\u0430\u043d\u0438\u044f (\u043d\u0435\u043e\u0431\u044f\u0437\u0430\u0442\u0435\u043b\u044c\u043d\u043e)', ok: '\u0412\u0435\u0440\u043d\u043e', no: '\u041f\u0440\u0430\u0432\u0438\u043b\u044c\u043d\u044b\u0439 \u043e\u0442\u0432\u0435\u0442:' },
  am: { t: '\u12e8\u1218\u1228\u12f3\u1275 \u1325\u12eb\u1244 (\u12a0\u1235\u1308\u12f3\u1305 \u12a0\u12ed\u12f0\u1208\u121d)', ok: '\u1275\u12ad\u12ad\u120d', no: '\u1275\u12ad\u12ad\u1208\u129b\u12cd \u1218\u120d\u1235:' },
};
export const QZ = QZL.he;
// The induction is a form the worker reads, not a talk someone gives (10/10/2026, Michael: "\u05dc\u05d4\u05d5\u05e8\u05d9\u05d3 \u05d0\u05ea
// \u05e9\u05dd \u05d4\u05de\u05d3\u05e8\u05d9\u05da, \u05d0\u05e4\u05e9\u05e8 \u05dc\u05e6\u05d9\u05d9\u05df \u05de\u05d9 \u05d9\u05e6\u05e8 \u05d0\u05ea \u05d4\u05d8\u05d5\u05e4\u05e1 \u05d1\u05de\u05e7\u05d5\u05dd"). The name and qualification stay, because the
// training record needs them (regulations from 16/10/2026), under "the form was prepared by".
// The new-worker form (11/10/2026, Michael: "\u05e9\u05e4\u05d4 \u05e9\u05dc \u05d4\u05d8\u05d5\u05e4\u05e1 \u05d7\u05d9\u05d9\u05d1\u05ea \u05dc\u05d4\u05d9\u05d5\u05ea \u05d1\u05e2\u05d1\u05e8\u05d9\u05ea", "\u05dc\u05d4\u05d5\u05e8\u05d9\u05d3 \u05e9\u05d0\u05dc\u05d5\u05df \u05d4\u05d1\u05e0\u05d4",
// "\u05dc\u05d0 \u05e6\u05e8\u05d9\u05db\u05d9\u05dd \u05d3\u05d9\u05d1\u05d5\u05d1 \u05db\u05e8\u05d2\u05e2", "\u05dc\u05d4\u05d5\u05e1\u05d9\u05e3 \u05dc\u05d8\u05d5\u05e4\u05e1 \u05de\u05e1\u05e4\u05e8 \u05e2\u05d5\u05d1\u05d3, \u05de\u05d7\u05dc\u05e7\u05d4, \u05de\u05e1\u05e4\u05e8 \u05d8\u05dc\u05e4\u05d5\u05df \u05e9\u05dc \u05e2\u05d5\u05d1\u05d3, \u05ea\u05e4\u05e7\u05d9\u05d3, \u05d1\u05de\u05d9\u05d3\u05d4 \u05e2\u05d5\u05d1\u05d3 \u05db\u05d5\u05d7 \u05d0\u05d3\u05dd
// \u05ea\u05d9\u05d1\u05d4 \u05dc\u05e8\u05e9\u05d5\u05dd \u05e9\u05dc \u05d4\u05d7\u05d1\u05e8\u05d4", "\u05d1\u05e8\u05d5\u05db\u05d9\u05dd \u05d4\u05d1\u05d0\u05d9\u05dd \u05dc\u05de\u05e4\u05e2\u05dc \u05ea\u05e2\u05e9\u05d9\u05d5\u05ea \u05ea\u05e4\u05d5\u05d2\u05df", "\u05d4\u05de\u05e4\u05e2\u05dc \u05d4\u05d5\u05d0 \u05de\u05e4\u05e2\u05dc \u05de\u05d6\u05d5\u05df \u05d7\u05d9\u05d5\u05e0\u05d9"). The worker
// reads in his language; the signed form is always in Hebrew. Keyboard characters only (CLAUDE.md).
export const IND_L = {
  he: { welcome: '\u05d1\u05e8\u05d5\u05db\u05d9\u05dd \u05d4\u05d1\u05d0\u05d9\u05dd \u05dc\u05de\u05e4\u05e2\u05dc \u05ea\u05e2\u05e9\u05d9\u05d5\u05ea \u05ea\u05e4\u05d5\u05d2\u05df', vital: '\u05d4\u05de\u05e4\u05e2\u05dc \u05d4\u05d5\u05d0 \u05de\u05e4\u05e2\u05dc \u05de\u05d6\u05d5\u05df \u05d7\u05d9\u05d5\u05e0\u05d9', empNo: '\u05de\u05e1\u05e4\u05e8 \u05e2\u05d5\u05d1\u05d3', dep: '\u05de\u05d7\u05dc\u05e7\u05d4', depPick: '\u05d1\u05d7\u05e8 \u05de\u05d7\u05dc\u05e7\u05d4', depOther: '\u05d0\u05d7\u05e8', phone: '\u05de\u05e1\u05e4\u05e8 \u05d8\u05dc\u05e4\u05d5\u05df', job: '\u05ea\u05e4\u05e7\u05d9\u05d3', ag: '\u05d0\u05e0\u05d9 \u05e2\u05d5\u05d1\u05d3 \u05d3\u05e8\u05da \u05d7\u05d1\u05e8\u05ea \u05db\u05d5\u05d7 \u05d0\u05d3\u05dd', agName: '\u05e9\u05dd \u05d7\u05d1\u05e8\u05ea \u05db\u05d5\u05d7 \u05d4\u05d0\u05d3\u05dd (\u05d0\u05dd \u05d9\u05e9)', errT: '\u05d7\u05e1\u05e8\u05d9\u05dd \u05e4\u05e8\u05d8\u05d9\u05dd', needNo: '\u05db\u05ea\u05d5\u05d1 \u05de\u05e1\u05e4\u05e8 \u05e2\u05d5\u05d1\u05d3', needDep: '\u05d1\u05d7\u05e8 \u05de\u05d7\u05dc\u05e7\u05d4', needPhone: '\u05db\u05ea\u05d5\u05d1 \u05de\u05e1\u05e4\u05e8 \u05d8\u05dc\u05e4\u05d5\u05df \u05ea\u05e7\u05d9\u05df', needJob: '\u05db\u05ea\u05d5\u05d1 \u05d0\u05ea \u05d4\u05ea\u05e4\u05e7\u05d9\u05d3', needAg: '\u05db\u05ea\u05d5\u05d1 \u05d0\u05ea \u05e9\u05dd \u05d7\u05d1\u05e8\u05ea \u05db\u05d5\u05d7 \u05d4\u05d0\u05d3\u05dd' },
  ar: { welcome: '\u0623\u0647\u0644\u0627 \u0648\u0633\u0647\u0644\u0627 \u0628\u0643\u0645 \u0641\u064a \u0645\u0635\u0646\u0639 \u0635\u0646\u0627\u0639\u0627\u062a \u062a\u0641\u0648\u063a\u0627\u0646', vital: '\u0627\u0644\u0645\u0635\u0646\u0639 \u0647\u0648 \u0645\u0635\u0646\u0639 \u0623\u063a\u0630\u064a\u0629 \u062d\u064a\u0648\u064a', empNo: '\u0631\u0642\u0645 \u0627\u0644\u0639\u0627\u0645\u0644', dep: '\u0627\u0644\u0642\u0633\u0645', depPick: '\u0627\u062e\u062a\u0631 \u0627\u0644\u0642\u0633\u0645', depOther: '\u0622\u062e\u0631', phone: '\u0631\u0642\u0645 \u0627\u0644\u0647\u0627\u062a\u0641', job: '\u0627\u0644\u0648\u0638\u064a\u0641\u0629', ag: '\u0623\u0639\u0645\u0644 \u0639\u0646 \u0637\u0631\u064a\u0642 \u0634\u0631\u0643\u0629 \u0642\u0648\u0649 \u0639\u0627\u0645\u0644\u0629', agName: '\u0627\u0633\u0645 \u0634\u0631\u0643\u0629 \u0627\u0644\u0642\u0648\u0649 \u0627\u0644\u0639\u0627\u0645\u0644\u0629 (\u0625\u0646 \u0648\u062c\u062f\u062a)', errT: '\u062a\u0641\u0627\u0635\u064a\u0644 \u0646\u0627\u0642\u0635\u0629', needNo: '\u0627\u0643\u062a\u0628 \u0631\u0642\u0645 \u0627\u0644\u0639\u0627\u0645\u0644', needDep: '\u0627\u062e\u062a\u0631 \u0627\u0644\u0642\u0633\u0645', needPhone: '\u0627\u0643\u062a\u0628 \u0631\u0642\u0645 \u0647\u0627\u062a\u0641 \u0635\u062d\u064a\u062d', needJob: '\u0627\u0643\u062a\u0628 \u0627\u0644\u0648\u0638\u064a\u0641\u0629', needAg: '\u0627\u0643\u062a\u0628 \u0627\u0633\u0645 \u0634\u0631\u0643\u0629 \u0627\u0644\u0642\u0648\u0649 \u0627\u0644\u0639\u0627\u0645\u0644\u0629' },
  ru: { welcome: '\u0414\u043e\u0431\u0440\u043e \u043f\u043e\u0436\u0430\u043b\u043e\u0432\u0430\u0442\u044c \u043d\u0430 \u0437\u0430\u0432\u043e\u0434 \u0422\u0430\u043f\u0443\u0433\u0430\u043d \u0418\u043d\u0434\u0430\u0441\u0442\u0440\u0438\u0437', vital: '\u0417\u0430\u0432\u043e\u0434 \u044f\u0432\u043b\u044f\u0435\u0442\u0441\u044f \u0436\u0438\u0437\u043d\u0435\u043d\u043d\u043e \u0432\u0430\u0436\u043d\u044b\u043c \u043f\u0440\u0435\u0434\u043f\u0440\u0438\u044f\u0442\u0438\u0435\u043c \u043f\u0438\u0449\u0435\u0432\u043e\u0439 \u043f\u0440\u043e\u043c\u044b\u0448\u043b\u0435\u043d\u043d\u043e\u0441\u0442\u0438', empNo: '\u0422\u0430\u0431\u0435\u043b\u044c\u043d\u044b\u0439 \u043d\u043e\u043c\u0435\u0440', dep: '\u041e\u0442\u0434\u0435\u043b', depPick: '\u0412\u044b\u0431\u0435\u0440\u0438\u0442\u0435 \u043e\u0442\u0434\u0435\u043b', depOther: '\u0414\u0440\u0443\u0433\u043e\u0435', phone: '\u041d\u043e\u043c\u0435\u0440 \u0442\u0435\u043b\u0435\u0444\u043e\u043d\u0430', job: '\u0414\u043e\u043b\u0436\u043d\u043e\u0441\u0442\u044c', ag: '\u042f \u0440\u0430\u0431\u043e\u0442\u0430\u044e \u0447\u0435\u0440\u0435\u0437 \u043a\u0430\u0434\u0440\u043e\u0432\u043e\u0435 \u0430\u0433\u0435\u043d\u0442\u0441\u0442\u0432\u043e', agName: '\u041d\u0430\u0437\u0432\u0430\u043d\u0438\u0435 \u043a\u0430\u0434\u0440\u043e\u0432\u043e\u0433\u043e \u0430\u0433\u0435\u043d\u0442\u0441\u0442\u0432\u0430 (\u0435\u0441\u043b\u0438 \u0435\u0441\u0442\u044c)', errT: '\u041d\u0435 \u0445\u0432\u0430\u0442\u0430\u0435\u0442 \u0434\u0430\u043d\u043d\u044b\u0445', needNo: '\u0423\u043a\u0430\u0436\u0438\u0442\u0435 \u0442\u0430\u0431\u0435\u043b\u044c\u043d\u044b\u0439 \u043d\u043e\u043c\u0435\u0440', needDep: '\u0412\u044b\u0431\u0435\u0440\u0438\u0442\u0435 \u043e\u0442\u0434\u0435\u043b', needPhone: '\u0423\u043a\u0430\u0436\u0438\u0442\u0435 \u043f\u0440\u0430\u0432\u0438\u043b\u044c\u043d\u044b\u0439 \u043d\u043e\u043c\u0435\u0440 \u0442\u0435\u043b\u0435\u0444\u043e\u043d\u0430', needJob: '\u0423\u043a\u0430\u0436\u0438\u0442\u0435 \u0434\u043e\u043b\u0436\u043d\u043e\u0441\u0442\u044c', needAg: '\u0423\u043a\u0430\u0436\u0438\u0442\u0435 \u043d\u0430\u0437\u0432\u0430\u043d\u0438\u0435 \u043a\u0430\u0434\u0440\u043e\u0432\u043e\u0433\u043e \u0430\u0433\u0435\u043d\u0442\u0441\u0442\u0432\u0430' },
  am: { welcome: '\u12c8\u12f0 \u1273\u1351\u130b\u1295 \u12a2\u1295\u12f1\u1235\u1275\u122a\u12ce\u127d \u134b\u1265\u122a\u12ab \u12a5\u1295\u12b3\u1295 \u1260\u12f0\u1205\u1293 \u1218\u1321', vital: '\u134b\u1265\u122a\u12ab\u12cd \u12a0\u1235\u1348\u120b\u130a \u12e8\u121d\u130d\u1265 \u134b\u1265\u122a\u12ab \u1290\u12cd', empNo: '\u12e8\u1220\u122b\u1270\u129b \u1241\u1325\u122d', dep: '\u12ad\u134d\u120d', depPick: '\u12ad\u134d\u120d \u12ed\u121d\u1228\u1321', depOther: '\u120c\u120b', phone: '\u1235\u120d\u12ad \u1241\u1325\u122d', job: '\u12e8\u1225\u122b \u12f5\u122d\u123b', ag: '\u12e8\u121d\u1220\u122b\u12cd \u1260\u1230\u12cd \u1283\u12ed\u120d \u12a9\u1263\u1295\u12eb \u1260\u12a9\u120d \u1290\u12cd', agName: '\u12e8\u1230\u12cd \u1283\u12ed\u120d \u12a9\u1263\u1295\u12eb\u12cd \u1235\u121d (\u12ab\u1208)', errT: '\u12dd\u122d\u12dd\u122e\u127d \u12ed\u130e\u12f5\u120b\u1209', needNo: '\u12e8\u1220\u122b\u1270\u129b \u1241\u1325\u122d \u12ed\u133b\u1349', needDep: '\u12ad\u134d\u120d \u12ed\u121d\u1228\u1321', needPhone: '\u1275\u12ad\u12ad\u1208\u129b \u1235\u120d\u12ad \u1241\u1325\u122d \u12ed\u133b\u1349', needJob: '\u12e8\u1225\u122b \u12f5\u122d\u123b\u12cd\u1295 \u12ed\u133b\u1349', needAg: '\u12e8\u1230\u12cd \u1283\u12ed\u120d \u12a9\u1263\u1295\u12eb\u12cd\u1295 \u1235\u121d \u12ed\u133b\u1349' },
};
export const IND_OTHER_DEP = '\u05d0\u05d7\u05e8';
// Pure. The details of the new-worker form, checked: {ok, v} or {ok:false, err}. The names (job,
// agency) are put in Hebrew by the caller. A worker number is needed unless he comes from an agency.
export function indFields(form) {
  const one = (k, n) => String(form.get(k) || '').replace(/[\u0000-\u001f\u007f<>]/g, ' ').replace(/\s+/g, ' ').trim().substring(0, n);
  const no = one('ino', 12).replace(/[^0-9]/g, ''), dep = one('idep', 40), phone = one('iph', 20).replace(/[^0-9+]/g, ''), job = one('ijob', 60), agency = one('iagn', 60), ag = agency.length > 0;
  const deps = TBT_DEPTS.map((x) => x[0]).concat([IND_OTHER_DEP]);
  if (!ag && !no) return { ok: false, err: 'needNo' };
  if (deps.indexOf(dep) < 0) return { ok: false, err: 'needDep' };
  const digits = phone.replace(/[^0-9]/g, '');
  if (digits.length < 9 || digits.length > 15) return { ok: false, err: 'needPhone' };
  if (job.length < 2) return { ok: false, err: 'needJob' };
  if (ag && agency.length < 2) return { ok: false, err: 'needAg' };  // Michael 11/10/2026: a box for the agency name, not a tick
  return { ok: true, v: { emp_no: no || null, dept: dep, phone, job, agency: ag ? agency : null } };
}
export const BY_L = { he: '\u05d4\u05d8\u05d5\u05e4\u05e1 \u05d4\u05d5\u05db\u05df \u05e2\u05dc \u05d9\u05d3\u05d9', ar: '\u0623\u0639\u062f\u0651 \u0627\u0644\u0646\u0645\u0648\u0630\u062c', ru: '\u0424\u043e\u0440\u043c\u0443 \u043f\u043e\u0434\u0433\u043e\u0442\u043e\u0432\u0438\u043b', am: '\u1245\u1339\u1295 \u12eb\u12d8\u130b\u1300\u12cd' };

// Read aloud (10/10/2026, Michael: "\u05de\u05d0\u05e9\u05e8 \u05d4\u05de\u05dc\u05e6\u05d5\u05ea"). First version: the phone's own voices
// (speechSynthesis). Michael the same day: "\u05d4\u05d3\u05d9\u05d1\u05d5\u05d1 \u05dc\u05d0 \u05d8\u05d5\u05d1, \u05db\u05de\u05d5 \u05e8\u05d5\u05d1\u05d5\u05d8, \u05d7\u05d9\u05d9\u05d1 \u05dc\u05d4\u05d9\u05d5\u05ea \u05d9\u05d5\u05ea\u05e8 \u05de\u05e7\u05e6\u05d5\u05e2\u05d9 \u05db\u05de\u05d5
// \u05de\u05d3\u05e8\u05d9\u05da \u05de\u05d3\u05d1\u05e8, \u05d1\u05e0\u05d5\u05e1\u05e3 \u05d4\u05d5\u05d0 \u05de\u05e7\u05e8\u05d9\u05d0 \u05de\u05e1\u05e4\u05e8 \u05d8\u05d5\u05e4\u05e1". So the voice now comes from Gemini TTS (the key the
// server already holds; Hebrew, Arabic, Russian and Amharic, free tier, paid about $0.04 for three
// minutes): /api/talk?op=say streams it, the page plays it as it arrives, and the phone's voice is
// only the fallback when the server voice fails. What is read is speechText: no form numbers, no
// "2.1." in front of a line.
export const SPEAK = {
  he: { listen: '\u05d4\u05e7\u05e8\u05d0 \u05d1\u05e7\u05d5\u05dc', stop: '\u05e2\u05e6\u05d5\u05e8', tag: ['he', 'iw'] },
  ar: { listen: '\u0627\u0633\u062a\u0645\u0639', stop: '\u0625\u064a\u0642\u0627\u0641', tag: ['ar'] },
  ru: { listen: '\u041f\u0440\u043e\u0441\u043b\u0443\u0448\u0430\u0442\u044c', stop: '\u0421\u0442\u043e\u043f', tag: ['ru'] },
  am: { listen: '\u12a0\u12f3\u121d\u1325', stop: '\u12a0\u1241\u121d', tag: ['am'] },
};
export const TTS_MODEL = 'gemini-3.8-flash-tts';
// Charon: Gemini's "informative" voice, a calm male voice that reads like an instructor.
// TTS_VOICE / TTS_MODEL in the environment override both without a deploy.
export const TTS_VOICE = 'Charon';
export const TTS_LANG = { he: 'he-IL', ar: 'ar', ru: 'ru-RU', am: 'am-ET' };
export const TTS_MAX = 12000;  // the full induction form 08.02.01: 7,900 characters in Hebrew, 11,500 in Russian (10/10/2026)
// The words to speak. A form number ("(\u05d8\u05d5\u05e4\u05e1 08.02.01)", "08.01") means nothing said aloud, and a
// line number ("2.1.") is read as "two point one"; both go. Each line ends in a stop, so the voice
// pauses between rules instead of running them together; " - " becomes a comma.
export function speechText(title, body) {
  const strip = (v) => String(v || '')
    .replace(/\([^()]*\d{1,2}\.\d{2}(?:\.\d{1,2})*[^()]*\)/g, ' ')
    .replace(/(?:\u05dc\u05e4\u05d9\s+)?(?:\u05d8\u05d5\u05e4\u05e1|\u05e0\u05d5\u05d4\u05dc|form|\u0444\u043e\u0440\u043c\u0430|\u0646\u0645\u0648\u0630\u062c)\s*\d{1,2}(?:\.\d{1,2})+/gi, ' ')
    .replace(/(^|[\s(])\d{1,2}\.\d{2}\.\d{1,2}(?=[\s).,]|$)/g, '$1');
  return (strip(title) + '\n' + strip(body)).split('\n')
    .map((l) => l.replace(/^\s*(?:\d+(?:\.\d+)*[.)]?|[-*])\s+/, '').replace(/\s+-\s+/g, ', ').replace(/\s+/g, ' ').trim())
    .filter((l) => /[^\s.,:;()-]/.test(l))
    .map((l) => (/[.!?:;,\u060c\u061f\u1362]$/.test(l) ? l : l + '.'))
    .join('\n').substring(0, TTS_MAX);
}
export function spokenOf(talk, lang) { const x = textOf(talk, lang); return speechText(x.title, x.body); }
const GEM = 'https://generativelanguage.googleapis.com/v1beta';
// The stream from Gemini, untouched: decoding base64 audio here would cost more CPU than the free
// plan's 10ms. The page decodes. The current API (interactions) first; generateContent with
// responseModalities AUDIO if that is refused, so a change on Google's side degrades, not breaks.
export async function ttsUpstream(env, text, lang) {
  if (!env.GEMINI_API_KEY) return { status: 503, err: 'no key' };
  const model = env.TTS_MODEL || TTS_MODEL, voice = env.TTS_VOICE || TTS_VOICE;
  const H = { 'Content-Type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY };
  let r = await fetch(GEM + '/interactions', { method: 'POST', headers: H, body: JSON.stringify({
    model, stream: true, input: [{ type: 'user_input', content: [{ type: 'text', text }] }],
    response_format: { type: 'audio', mime_type: 'audio/l16', sample_rate: 24000 },
    generation_config: { speech_config: [{ voice, language: TTS_LANG[lang] || 'he-IL' }] } }) });
  if (r.ok && r.body) return { r };
  const e1 = r.status + ' ' + String(await r.text().catch(() => '')).substring(0, 160);
  r = await fetch(GEM + '/models/' + encodeURIComponent(model) + ':streamGenerateContent?alt=sse', { method: 'POST', headers: H, body: JSON.stringify({
    contents: [{ role: 'user', parts: [{ text }] }],
    generationConfig: { responseModalities: ['AUDIO'], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } } } }) });
  if (r.ok && r.body) return { r };
  return { status: 502, err: 'interactions ' + e1 + ' | generate ' + r.status + ' ' + String(await r.text().catch(() => '')).substring(0, 160) };
}
const SAY_H = { 'Content-Type': 'text/event-stream; charset=utf-8', 'X-Content-Type-Options': 'nosniff', 'X-Robots-Tag': 'noindex' };
// The same text in the same voice is the same audio: kept in the edge cache for a week, so a
// department of 40 costs one generation. Best effort: no cache, no harm.
async function sayStream(env, text, lang, ctx, extra) {
  const H = Object.assign({}, SAY_H, extra || {});
  let cache = null, key = null;
  try {
    cache = (typeof caches !== 'undefined' && caches.default) || null;
    if (cache) {
      const d = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode([env.TTS_MODEL || TTS_MODEL, env.TTS_VOICE || TTS_VOICE, lang, text].join('|'))));
      key = new Request('https://tts-cache.tapugan-safety.pages.dev/' + Array.from(d.slice(0, 16)).map((b) => b.toString(16).padStart(2, '0')).join(''));
      const hit = await cache.match(key);
      if (hit && hit.body) return new Response(hit.body, { headers: Object.assign({}, H, { 'X-TTS': 'cache' }) });
    }
  } catch (e) { cache = null; }
  const up = await ttsUpstream(env, text, lang);
  if (!up.r) return new Response(JSON.stringify({ error: up.err }), { status: up.status, headers: Object.assign({}, H, { 'Content-Type': 'application/json' }) });
  let body = up.r.body;
  if (cache && key && ctx && typeof ctx.waitUntil === 'function') {
    const [a, b] = body.tee();
    body = a;
    ctx.waitUntil(cache.put(key, new Response(b, { headers: { 'Content-Type': SAY_H['Content-Type'], 'Cache-Control': 'public, max-age=604800' } })).catch(() => {}));
  }
  return new Response(body, { headers: Object.assign({}, H, { 'Cache-Control': 'no-store', 'X-TTS': 'gemini' }) });
}
async function sayTalk(env, tok, want, g, ctx, cookie) {
  const t = await readTok(env, tok, g);
  if (t.error) return new Response('{"error":"link"}', { status: 403, headers: { 'Content-Type': 'application/json' } });
  const talk = await getTalk(env, t.id);
  if (!talk || talk.s !== S_PUB || !permOk(t, talk)) return new Response('{"error":"talk"}', { status: 404, headers: { 'Content-Type': 'application/json' } });
  if (!(await codeGate(env, talk, cookie)).ok) return new Response('{"error":"code"}', { status: 403, headers: { 'Content-Type': 'application/json' } });
  const lang = textOf(talk, langOf(want)).lang;
  return sayStream(env, spokenOf(talk, lang), lang, ctx);
}
// The player, one copy: inlined in the worker's page and served at ?op=player to the app's
// "listen" button. Reads Server-Sent Events (or one JSON), finds every base64 audio part
// wherever the API puts it, and queues 16-bit PCM on an AudioContext as it arrives.
export const PLAYER = `(function(){if(window.tapSay)return;
function b64(s){var b=atob(s),n=b.length,u=new Uint8Array(n);for(var i=0;i<n;i++)u[i]=b.charCodeAt(i);return u;}
function audios(o,out){if(!o||typeof o!=='object')return;if(Array.isArray(o)){for(var i=0;i<o.length;i++)audios(o[i],out);return;}
var m=String(o.mime_type||o.mimeType||'');if(typeof o.data==='string'&&o.data.length>8&&(/audio/i.test(m)||o.type==='audio')){out.push({d:o.data,m:m,r:+(o.sample_rate||o.sampleRate||0)});return;}
for(var k in o)if(k!=='data')audios(o[k],out);}
window.tapSay=function(o){var AC=window.AudioContext||window.webkitAudioContext;
if(!AC){if(o.onFail)o.onFail('noaudio');return{stop:function(){}};}
var ac=o.ac||new AC(),ctl=window.AbortController?new AbortController():null,at=0,got=0,live=0,done=false,stopped=false,carry=null;
try{ac.resume();}catch(e){}
function fin(){if(stopped)return;stopped=true;try{if(ctl)ctl.abort();}catch(e){}try{ac.close();}catch(e){}}
function ended(){if(done&&!live&&!stopped){fin();if(o.onEnd)o.onEnd();}}
function play(a){var u=b64(a.d),off=0;if(stopped)return;
if(u.length>44&&u[0]===82&&u[1]===73&&u[2]===70&&u[3]===70)off=44;
if(carry){var t=new Uint8Array(carry.length+u.length-off);t.set(carry);t.set(u.subarray(off),carry.length);u=t;off=0;carry=null;}
var n=(u.length-off)>>1;if((u.length-off)&1)carry=u.slice(u.length-1);if(!n)return;
var rate=a.r||+((/rate=(\\d+)/.exec(a.m)||[])[1])||24000,buf=ac.createBuffer(1,n,rate),ch=buf.getChannelData(0),dv=new DataView(u.buffer,u.byteOffset+off,n*2);
for(var i=0;i<n;i++)ch[i]=dv.getInt16(i*2,true)/32768;
var s=ac.createBufferSource();s.buffer=buf;s.connect(ac.destination);var st=Math.max(ac.currentTime+0.08,at);s.start(st);at=st+buf.duration;got++;live++;
s.onended=function(){live--;ended();};}
function feed(x){var j;try{j=JSON.parse(x);}catch(e){return;}var out=[];audios(j,out);for(var i=0;i<out.length;i++)play(out[i]);}
function lines(b,last){var p=b.split('\\n'),rest=last?'':p.pop();for(var i=0;i<p.length;i++){var l=p[i].replace(/\\r$/,'');if(l.indexOf('data:')===0)feed(l.slice(5).trim());}return rest;}
var init=o.init||{};if(ctl)init.signal=ctl.signal;
fetch(o.url,init).then(function(r){if(!r.ok)throw new Error('http '+r.status);var ct=r.headers.get('content-type')||'',sse=/event-stream/.test(ct);
if(!sse||!r.body||!r.body.getReader)return r.text().then(function(t){if(sse)lines(t,true);else feed(t);});
var rd=r.body.getReader(),dec=new TextDecoder(),b='';
function pump(){return rd.read().then(function(x){if(x.done){lines(b,true);return;}b=lines(b+dec.decode(x.value,{stream:true}),false);return pump();});}
return pump();}).then(function(){done=true;if(!got){fin();if(o.onFail)o.onFail('empty');}else ended();},
function(e){if(stopped)return;done=true;if(!got){fin();if(o.onFail)o.onFail(String(e&&e.message||e));}else ended();});
return{stop:fin};};})();`;
export const speakScript = (lang, text) => `(function(){
  var b=document.getElementById('say'),f=document.getElementById('f'),S=window.speechSynthesis,AC=window.AudioContext||window.webkitAudioContext;
  if(!b||!f)return;
  var W=${JSON.stringify(SPEAK[lang] || SPEAK.he)},TX=${JSON.stringify(String(text || '')).replace(/</g, '\\u003c')},v=null,on=false,cur=null;
  var url='/api/talk?op=say&k='+encodeURIComponent(f.k.value)+'&l='+encodeURIComponent(f.l.value)+(f.g?'&g=1':'');
  function pick(){v=null;var vs=(S&&S.getVoices&&S.getVoices())||[];for(var i=0;i<vs.length&&!v;i++){var l=String(vs[i].lang||'').toLowerCase();for(var k=0;k<W.tag.length;k++)if(l.indexOf(W.tag[k])===0){v=vs[i];break;}}b.style.display=(AC&&window.tapSay)||v?'':'none';}
  pick();if(S&&S.addEventListener)S.addEventListener('voiceschanged',pick);
  function idle(){on=false;cur=null;b.textContent='\\ud83d\\udd0a '+W.listen;}
  function phone(){if(!on)return;if(!S||!v||typeof SpeechSynthesisUtterance==='undefined'){idle();return;}var u=new SpeechSynthesisUtterance(TX);u.voice=v;u.lang=v.lang;u.rate=0.95;u.onend=idle;u.onerror=idle;S.cancel();S.speak(u);}
  b.addEventListener('click',function(){
    if(on){if(cur)cur.stop();if(S)S.cancel();idle();return;}
    on=true;b.textContent='\\u23f9 '+W.stop;
    if(AC&&window.tapSay)cur=window.tapSay({url:url,onEnd:idle,onFail:function(){cur=null;phone();}});else phone();
  });
})();`;
export const langOf = (l) => (Object.prototype.hasOwnProperty.call(LANGS, l) ? l : 'he');
// The text a worker reads in lang: the translation (first line = title) when
// there is one, else the Hebrew. lang comes back as what was actually shown.
export function textOf(talk, lang) {
  const tr = lang !== 'he' && String((talk && talk['body_' + lang]) || '').trim();
  if (!tr) return { lang: 'he', title: talk.title || '', body: talk.body || '' };
  const i = tr.indexOf('\n');
  return i < 0 ? { lang, title: tr, body: '' } : { lang, title: tr.substring(0, i).trim(), body: tr.substring(i + 1).trim() };
}
// SHA-256 of the version the worker saw (Michael 03/10/2026: "hash, yes"). The app
// computes the same (_tbtTextHash) and marks a signature on an older version.
export async function textHash(talk, lang) {
  const x = textOf(talk, lang);
  const data = new TextEncoder().encode(JSON.stringify([x.lang, x.title, x.body, String((talk && talk.file_url) || '')]));
  const h = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(h)).map((b) => b.toString(16).padStart(2, '0')).join('');
}
export const langsOf = (talk) => ['he'].concat(['ar', 'ru', 'am'].filter((l) => String((talk && talk['body_' + l]) || '').trim()));

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

export function talkUrl(tok, lang, g, tr) { return APP_URL + '/api/talk?k=' + encodeURIComponent(tok) + (lang && lang !== 'he' ? '&l=' + lang : '') + (g ? '&g=1' : '') + (tr ? '&t=1' : ''); }
export function makeTalkToken(env, id, nowMs) { return makeLinkToken(env, PREFIX, id, TALK_TTL_DAYS, nowMs); }
export function readTalkToken(env, tok, nowMs) { return readLinkToken(env, PREFIX, tok, nowMs); }
// New-worker induction (form 08.02, Michael 10/10/2026: "\u05e8\u05e7 \u05e2\u05d5\u05d1\u05d3\u05d9\u05dd \u05d7\u05d3\u05e9, \u05d0\u05d7\u05e8\u05d9\u05dd \u05dc\u05d0 \u05e8\u05dc\u05d5\u05d5\u05e0\u05d8\u05d9"): one
// link and one QR at the entrance that do not run out. The token carries the talk's link_v; the
// manager's "cancel link" raises it, so a leaked link stops working and a new one is printed.
const PERM_PREFIX = 'talk-perm:v1:';
export const PERM_TTL_DAYS = 3650;
export const KIND_IND = 'induction';
// The annual safety training and the quality department's training (14/10/2026, Michael: "a barcode the worker
// scans at the annual training, fills in his details, and in the end one form 08.01 with everyone who signed";
// in the questionnaire: "\u05d1\u05e6\u05e2: \u05d4\u05db\u05dc \u05d1\u05d4\u05e7\u05dc\u05d3\u05d4", "\u05d1\u05e6\u05e2: \u05dc\u05e4\u05d9 \u05d4\u05ea\u05d5\u05db\u05e0\u05d9\u05ea"). Typed: no list, the worker types name and ID
// and picks a department. Permanent link like the induction, until the manager closes it (revoke).
export const KIND_ANN = 'annual', KIND_QA = 'quality';
export const TYPED_KINDS = [KIND_ANN, KIND_QA];
export const PERM_KINDS = [KIND_IND, KIND_ANN, KIND_QA];
// The whole factory signs one annual training, temps included: more room than a weekly talk's 100 typed names.
export const MAX_OUT_TYPED = 600;
export const ANN_OK = '\u05d0\u05e0\u05d9 \u05de\u05d0\u05e9\u05e8/\u05ea \u05e9\u05e2\u05d1\u05e8\u05ea\u05d9 \u05d0\u05ea \u05d4\u05d4\u05d3\u05e8\u05db\u05d4 \u05d1\u05db\u05dc \u05d4\u05e0\u05d5\u05e9\u05d0\u05d9\u05dd \u05e9\u05dc\u05de\u05e2\u05dc\u05d4, \u05d4\u05d1\u05e0\u05ea\u05d9 \u05d0\u05d5\u05ea\u05dd \u05d5\u05d0\u05e4\u05e2\u05dc \u05dc\u05e4\u05d9\u05d4\u05dd.';
export const DEP_OTHER_PH = '\u05e9\u05dd \u05d4\u05de\u05d7\u05dc\u05e7\u05d4';
// The training departments and the employee-card names that belong to each (index.html _TBT_DEPTS).
export const TBT_DEPTS = [["\u05d8\u05d5\u05d2\u05e0\u05d9\u05dd", ["\u05d9\u05e6\u05d5\u05e8"]], ["\u05de\u05e2\u05d5\u05e6\u05d1\u05d9\u05dd", ["\u05d8\u05d1\u05e2 (\u05de\u05e2\u05e6\u05d1\u05d9\u05dd)"]], ["\u05d0\u05e8\u05d9\u05d6\u05d4", ["\u05d0\u05e8\u05d9\u05d6\u05d4"]], ["\u05d7\u05d5\u05de\u05e8 \u05d2\u05dc\u05dd", ["\u05d7\u05d5\u05de\u05e8\u05d9 \u05d2\u05dc\u05dd"]], ["\u05ea\u05d5\u05e6\"\u05d2 \u05d5\u05de\u05d7\u05e1\u05e0\u05d9\u05dd", ["\u05ea\u05d5\u05e6\u05d2"]], ["\u05de\u05e2\u05d1\u05d3\u05d4", ["\u05de\u05e2\u05d1\u05d3\u05d4"]], ["\u05d0\u05d7\u05d6\u05e7\u05d4 \u05d5\u05d7\u05e9\u05de\u05dc", ["\u05d0\u05d7\u05d6\u05e7\u05d4, \u05d0\u05e0\u05e8\u05d2\u05d9\u05d4 \u05d5\u05d7\u05e9\u05de\u05dc"]]];
export function deptMatch(dept, empDep) {
  if (!dept) return true;
  const d = String(empDep || ''), row = TBT_DEPTS.find((x) => x[0] === dept);
  return d === dept || (!!row && row[1].indexOf(d) >= 0);
}
// The shared weekly talk (14/10/2026, Michael: "one shared draft for all departments, whoever fills it
// picks his department"; "each department goes over all its topics"). Its text has a section per
// department, a line "## <department>" and then that department's topics; text before the first
// section is shown to everyone. No sections = an ordinary talk.
export function sectionsOf(body) {
  const intro = [], list = []; let cur = null;
  for (const l of String(body || '').split(/\r?\n/)) {
    const m = /^##\s+(.+?)\s*$/.exec(l);
    if (m) { cur = { dept: m[1], text: [] }; list.push(cur); } else (cur ? cur.text : intro).push(l);
  }
  return { intro: intro.join('\n').trim(), list: list.map((x) => ({ dept: x.dept, text: x.text.join('\n').trim() })) };
}
export const WDEP_L = '\u05d4\u05de\u05d7\u05dc\u05e7\u05d4 \u05e9\u05dc\u05da', WDEP_PICK = '\u05d1\u05d7\u05e8 \u05de\u05d7\u05dc\u05e7\u05d4';
export const tDeptOf = (empDep) => { const r = TBT_DEPTS.find((x) => deptMatch(x[0], empDep)); return r ? r[0] : ''; };
export function makePermToken(env, id, v, nowMs) { return makeLinkToken(env, PERM_PREFIX, id + '-v' + (v || 0), PERM_TTL_DAYS, nowMs); }
export async function readPermToken(env, tok, nowMs) {
  const r = await readLinkToken(env, PERM_PREFIX, tok, nowMs);
  if (r.error) return r;
  const m = /^(.+)-v(\d{1,5})$/.exec(r.id);
  return m ? { id: m[1], perm: true, v: +m[2] } : { error: 'bad' };
}
// The HR code in front of the induction page (10/10/2026, Michael: "\u05d4\u05d8\u05d5\u05e4\u05e1 \u05e6\u05e8\u05d9\u05da \u05dc\u05d4\u05d9\u05d5\u05ea \u05de\u05d5\u05d2\u05df \u05d1\u05e1\u05d9\u05e1\u05de\u05d4
// \u05d1\u05d6\u05de\u05df \u05d1\u05d9\u05e6\u05d5\u05e2 \u05d4\u05d4\u05d3\u05e8\u05db\u05d4 \u05e9\u05dc hr", and in the questionnaire: "\u05d6\u05d4 \u05e6\u05e8\u05d9\u05da \u05dc\u05e2\u05d1\u05d5\u05d3 \u05e7\u05d1\u05d5\u05e2", no code handed out each
// time). One code, in server_state 'induction_code' (service key only, RLS without policies), typed
// once on a device: the device keeps a signed cookie for a year. Changing the code signs every device
// out, because the cookie carries a hash of it. No code set = closed, not open. A wrong guess waits,
// as the trustee code does (trustee-gate.js): a Worker keeps no count without a store.
export const IND_CODE_KEY = 'induction_code';
export const IND_CODE_COOKIE = 'tsind';
export const IND_CODE_DAYS = 365;
const CODE_PREFIX = 'talk-indcode:v1:';
const WRONG_CODE_DELAY_MS = 800;
async function indCode(env) {
  try {
    const r = await fetch(SB + '/rest/v1/server_state?key=eq.' + IND_CODE_KEY + '&select=value', { headers: sbH(env) });
    if (!r.ok) return '';
    const rows = await r.json();
    return String((Array.isArray(rows) && rows[0] && rows[0].value) || '').trim().toLowerCase();
  } catch (e) { return ''; }
}
async function codeTag(code) {
  const d = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode('ind-code|' + code)));
  return Array.from(d.slice(0, 6)).map((b) => b.toString(16).padStart(2, '0')).join('');
}
export async function makeCodeCookie(env, talkId, code) { return makeLinkToken(env, CODE_PREFIX, talkId + '-' + (await codeTag(code)), IND_CODE_DAYS); }
const cookieOf = (h) => { const m = /(?:^|;\s*)tsind=([^;]+)/.exec(String(h || '')); return m ? m[1] : ''; };
// { ok } for every talk that is not the induction; for the induction, ok only with this code's cookie.
async function codeGate(env, talk, cookieHeader) {
  if (!talk || talk.kind !== KIND_IND) return { ok: true };
  const code = await indCode(env);
  if (!code) return { ok: false, closed: true };
  const c = cookieOf(cookieHeader);
  if (!c) return { ok: false };
  const r = await readLinkToken(env, CODE_PREFIX, c);
  return { ok: !r.error && r.id === talk.id + '-' + (await codeTag(code)) };
}
// The guessing lock (10/10/2026, the security review: a wrong guess only waited, and a script in
// parallel could try every six-digit code in hours). Every attempt counts before the code is checked,
// in one atomic upsert (guess_hit, migration 2026-10-10_guess_lock.sql); over GUESS_LIMIT in an hour
// from the same address = refused without a check; the right code clears the count. The first lock
// of an address lands in server_state 'guess_locks', which the weekly mail reports. If the count
// cannot be read the check goes on (the lock must not shut HR out when the database blinks).
// The same block sits in talk.js and trustee-gate.js; a shared module would need a build entry in
// every test that loads either file.
export const GUESS_LIMIT = 10;
const GUESS_SB = 'https://znhjtpcltrxxyfjczgvw.supabase.co';
const guessH = (env) => ({ apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: 'Bearer ' + env.SUPABASE_SERVICE_ROLE_KEY, 'Content-Type': 'application/json' });
export async function guessKey(scope, request) {
  const ip = ipBucket(request.headers.get('cf-connecting-ip') || request.headers.get('x-real-ip'));
  const d = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode('guess|' + ip)));
  return 'guess:' + scope + ':' + Array.from(d.slice(0, 8)).map((b) => b.toString(16).padStart(2, '0')).join('');
}
async function guessHit(env, key) {
  try {
    const r = await fetch(GUESS_SB + '/rest/v1/rpc/guess_hit', { method: 'POST', headers: guessH(env), body: JSON.stringify({ p_key: key }) });
    if (!r.ok) return 0;
    const n = await r.json();
    return typeof n === 'number' ? n : 0;
  } catch (e) { return 0; }
}
async function guessClear(env, key) {
  try { await fetch(GUESS_SB + '/rest/v1/rpc/guess_clear', { method: 'POST', headers: guessH(env), body: JSON.stringify({ p_key: key }) }); } catch (e) { /* the code was right */ }
}
async function guessLocked(env, scope) {
  try {
    const r = await fetch(GUESS_SB + '/rest/v1/server_state?key=eq.guess_locks&select=value', { headers: guessH(env) });
    const rows = r.ok ? await r.json() : [];
    let list = []; try { list = JSON.parse((rows[0] && rows[0].value) || '[]'); } catch (e) { list = []; }
    list = (Array.isArray(list) ? list : []).concat([{ at: new Date().toISOString(), s: scope }]).slice(-50);
    await fetch(GUESS_SB + '/rest/v1/server_state?on_conflict=key', { method: 'POST', headers: Object.assign(guessH(env), { Prefer: 'resolution=merge-duplicates,return=minimal' }), body: JSON.stringify({ key: 'guess_locks', value: JSON.stringify(list), updated_at: new Date().toISOString() }) });
  } catch (e) { /* the lock holds anyway */ }
}
// A mail to Michael the moment an address is locked (11/10/2026, Michael: "\u05d1\u05e6\u05e2: \u05de\u05d9\u05d9\u05dc \u05dc\u05da \u05d5\u05db\u05e4\u05ea\u05d5\u05e8
// \u05e4\u05ea\u05d9\u05d7\u05d4"): the lock is per address, and HR and the trustees on the factory WiFi share one, so a lock
// may shut out his own people. Which password, when; the unlock is in "\u05de\u05e9\u05ea\u05de\u05e9\u05d9\u05dd \u05d5\u05e1\u05d9\u05e1\u05de\u05d0\u05d5\u05ea". Never the address.
const LOCK_LABEL = { ind: '\u05e1\u05d9\u05e1\u05de\u05ea \u05de\u05e9\u05d0\u05d1\u05d9 \u05d0\u05e0\u05d5\u05e9 (\u05d8\u05d5\u05e4\u05e1 \u05e7\u05dc\u05d9\u05d8\u05d4)', tru: '\u05e1\u05d9\u05e1\u05de\u05ea \u05e0\u05d0\u05de\u05e0\u05d9 \u05d4\u05d1\u05d8\u05d9\u05d7\u05d5\u05ea' };
export function lockMailHtml(scope, atIso) {
  const d = new Date(atIso);
  const day = d.toLocaleDateString('en-GB', { timeZone: 'Asia/Jerusalem' }), hm = d.toLocaleTimeString('en-GB', { timeZone: 'Asia/Jerusalem', hour: '2-digit', minute: '2-digit', hour12: false });
  return '<div dir="rtl" style="font-family:Arial,sans-serif;font-size:14px">'
    + '<p><b>' + (LOCK_LABEL[scope] || scope) + '</b>: 10 \u05e0\u05d9\u05e1\u05d9\u05d5\u05e0\u05d5\u05ea \u05e9\u05d2\u05d5\u05d9\u05d9\u05dd \u05d1\u05e9\u05e2\u05d4 \u05de\u05d0\u05d5\u05ea\u05d4 \u05db\u05ea\u05d5\u05d1\u05ea, \u05d1-' + day + ' \u05d1\u05e9\u05e2\u05d4 ' + hm + '. \u05d4\u05db\u05ea\u05d5\u05d1\u05ea \u05e0\u05e2\u05d5\u05dc\u05d4 \u05dc\u05e9\u05e2\u05d4.</p>'
    + '<p>\u05d0\u05dd \u05d0\u05dc\u05d4 \u05d0\u05e0\u05e9\u05d9\u05dd \u05e9\u05dc\u05db\u05dd (\u05dc\u05de\u05e9\u05dc \u05de\u05d4-WiFi \u05e9\u05dc \u05d4\u05de\u05e4\u05e2\u05dc): \u05d0\u05e4\u05e9\u05e8 \u05dc\u05e4\u05ea\u05d5\u05d7 \u05de\u05d9\u05d3 \u05d1\u05d0\u05e4\u05dc\u05d9\u05e7\u05e6\u05d9\u05d4, "\u05de\u05e9\u05ea\u05de\u05e9\u05d9\u05dd \u05d5\u05e1\u05d9\u05e1\u05de\u05d0\u05d5\u05ea", \u05db\u05e4\u05ea\u05d5\u05e8 "\u05e4\u05ea\u05d7 \u05e2\u05db\u05e9\u05d9\u05d5".</p>'
    + '<p>\u05d0\u05dd \u05d6\u05d4 \u05dc\u05d0 \u05de\u05d5\u05db\u05e8 \u05dc\u05db\u05dd: \u05db\u05d3\u05d0\u05d9 \u05dc\u05d4\u05d7\u05dc\u05d9\u05e3 \u05d0\u05ea \u05d4\u05e1\u05d9\u05e1\u05de\u05d4 \u05d1\u05d0\u05d5\u05ea\u05d5 \u05de\u05e7\u05d5\u05dd.</p>'
    + '<p style="color:#666;font-size:12px">\u05e0\u05e9\u05dc\u05d7 \u05d0\u05d5\u05d8\u05d5\u05de\u05d8\u05d9\u05ea \u05de\u05d0\u05e4\u05dc\u05d9\u05e7\u05e6\u05d9\u05d9\u05ea \u05e0\u05d9\u05d4\u05d5\u05dc \u05d4\u05d1\u05d8\u05d9\u05d7\u05d5\u05ea \u05e9\u05dc \u05ea\u05e2\u05e9\u05d9\u05d5\u05ea \u05ea\u05e4\u05d5\u05d2\u05df.</p></div>';
}
async function lockMail(env, scope) {
  try {
    const od = await accessToken(env);
    if (!od || !od.email) return;
    await sendMailTo(od.token, [od.email], [], '\u05e0\u05e2\u05d9\u05dc\u05d4 \u05e2\u05dc \u05e0\u05d9\u05d7\u05d5\u05e9 \u05e1\u05d9\u05e1\u05de\u05d4: ' + (LOCK_LABEL[scope] || scope), lockMailHtml(scope, new Date().toISOString()), []);
  } catch (e) { /* the lock holds anyway */ }
}
// n attempts so far in the window, including this one; true = refuse without checking.
export async function guessGate(env, scope, request) {
  if (!env.SUPABASE_SERVICE_ROLE_KEY) return { key: null, locked: false };
  const key = await guessKey(scope, request);
  const n = await guessHit(env, key);
  if (n === GUESS_LIMIT + 1) { await guessLocked(env, scope); await lockMail(env, scope); }
  return { key, locked: n > GUESS_LIMIT };
}
// The weekly-talk link reaches every worker for 14 days, and "not on the list" with a name not in
// Hebrew letters is a Gemini call per box (name, company, job, agency) from anyone holding the link
// (BACKLOG 13.9, 13/10/2026). Each such call counts first in the same counter, scope "tlk", per
// address: over TLK_AI_LIMIT in an hour the name is not sent, and the page asks for it in Hebrew
// letters (errHe), which needs no call. A name already in Hebrew is never counted. The factory WiFi
// is one address, so the limit is far above a department signing at once; a database that cannot
// count lets the call go (a worker must not be stopped when it blinks). codes.js skips "tlk".
export const TLK_AI_LIMIT = 300;
export async function nameHe(env, request, raw) {
  const direct = heName(raw);
  if (direct) return direct;
  if (env.SUPABASE_SERVICE_ROLE_KEY && (await guessHit(env, await guessKey('tlk', request))) > TLK_AI_LIMIT) return null;
  return hebrewName(env, raw);
}
export async function guessOk(env, g) { if (g && g.key) await guessClear(env, g.key); }
const sameCode = (a, b) => { const x = String(a || ''), y = String(b || ''); let d = x.length === y.length ? 0 : 1; for (let i = 0; i < Math.max(x.length, y.length); i++) d |= (x.charCodeAt(i) || 0) ^ (y.charCodeAt(i) || 0); return d === 0; };
function codePage(tok, lang, wrong, closed, locked) {
  const inner = '<p>\u05d0\u05ea \u05d8\u05d5\u05e4\u05e1 \u05d4\u05e7\u05dc\u05d9\u05d8\u05d4 \u05e4\u05d5\u05ea\u05d7\u05d9\u05dd \u05e2\u05dd \u05d4\u05e1\u05d9\u05e1\u05de\u05d4 \u05e9\u05dc \u05de\u05e9\u05d0\u05d1\u05d9 \u05d0\u05e0\u05d5\u05e9. \u05de\u05e7\u05dc\u05d9\u05d3\u05d9\u05dd \u05d0\u05d5\u05ea\u05d4 \u05e4\u05e2\u05dd \u05d0\u05d7\u05ea, \u05d5\u05d4\u05de\u05db\u05e9\u05d9\u05e8 \u05d6\u05d5\u05db\u05e8.</p>'
    + '<p dir="auto" style="font-size:14px;color:#6b7280;margin-top:-4px">\u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631 \u0644\u062f\u0649 \u0642\u0633\u0645 \u0627\u0644\u0645\u0648\u0627\u0631\u062f \u0627\u0644\u0628\u0634\u0631\u064a\u0629 | \u041f\u0430\u0440\u043e\u043b\u044c \u0443 \u043e\u0442\u0434\u0435\u043b\u0430 \u043a\u0430\u0434\u0440\u043e\u0432 | \u12e8\u12ed\u1208\u134d \u1243\u1209 \u1260\u1230\u12cd \u1200\u1265\u1275 \u12ad\u134d\u120d \u1290\u12cd</p>'
    + (locked ? '<p style="color:#b91c1c;font-weight:700">\u05d9\u05d5\u05ea\u05e8 \u05de\u05d3\u05d9 \u05e0\u05d9\u05e1\u05d9\u05d5\u05e0\u05d5\u05ea \u05de\u05d4\u05de\u05db\u05e9\u05d9\u05e8 \u05d4\u05d6\u05d4. \u05e0\u05e1\u05d5 \u05e9\u05d5\u05d1 \u05d1\u05e2\u05d5\u05d3 \u05e9\u05e2\u05d4.</p>' : closed ? '<p style="color:#b91c1c;font-weight:700">\u05d4\u05e1\u05d9\u05e1\u05de\u05d4 \u05e2\u05d5\u05d3 \u05dc\u05d0 \u05d4\u05d5\u05d2\u05d3\u05e8\u05d4. \u05e4\u05e0\u05d5 \u05dc\u05de\u05de\u05d5\u05e0\u05d4 \u05d4\u05d1\u05d8\u05d9\u05d7\u05d5\u05ea.</p>'
      : (wrong ? '<p style="color:#b91c1c;font-weight:700">\u05e1\u05d9\u05e1\u05de\u05d4 \u05e9\u05d2\u05d5\u05d9\u05d4. \u05e0\u05e1\u05d5 \u05e9\u05d5\u05d1.</p>' : '')
      + '<form method="POST" action="/api/talk"><input type="hidden" name="k" value="' + esc(tok) + '"><input type="hidden" name="l" value="' + esc(langOf(lang)) + '">'
      + '<label for="icode" style="display:block;font-weight:700;margin-bottom:4px">\u05e1\u05d9\u05e1\u05de\u05d4</label>'
      + '<input id="icode" name="icode" type="password" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" maxlength="32" required dir="ltr" style="width:100%;box-sizing:border-box;font-size:20px;letter-spacing:2px;text-align:center;padding:12px;border:1px solid #d1d5db;border-radius:8px;margin-bottom:12px">'
      + '<button type="submit" id="icode-go" style="display:block;width:100%;padding:14px;border:0;border-radius:10px;background:#1e3a8a;color:#fff;font-size:18px;font-weight:700">\u05db\u05e0\u05d9\u05e1\u05d4</button></form>');
  return page('\u05e1\u05d9\u05e1\u05de\u05ea \u05de\u05e9\u05d0\u05d1\u05d9 \u05d0\u05e0\u05d5\u05e9', inner, closed || wrong || locked ? 'err' : '', locked ? 429 : (closed ? 503 : (wrong ? 403 : 200)), '', 'he');
}
async function codeSubmit(env, form, request) {
  const tok = String(form.get('k') || ''), lang = langOf(String(form.get('l') || ''));
  const t = await readTok(env, tok, false);
  if (t.error === 'expired') return errL('expired', lang, 410);
  if (t.error) return errL('badLink', lang, 403);
  const talk = await getTalk(env, t.id);
  if (!talk || talk.s !== S_PUB || !permOk(t, talk) || talk.kind !== KIND_IND) return errL('badLink', lang, 403);
  const code = await indCode(env);
  if (!code) return codePage(tok, lang, false, true);
  const gg = await guessGate(env, 'ind', request);
  if (gg.locked) return codePage(tok, lang, false, false, true);
  if (!sameCode(String(form.get('icode') || '').trim().toLowerCase(), code)) { await new Promise((r) => setTimeout(r, WRONG_CODE_DELAY_MS)); return codePage(tok, lang, true, false); }
  await guessOk(env, gg);
  const c = await makeCodeCookie(env, talk.id, code);
  if (!c) return errPage('\u05d4\u05e9\u05e8\u05ea \u05dc\u05d0 \u05de\u05d5\u05d2\u05d3\u05e8.', 500);
  return new Response(null, { status: 303, headers: { Location: talkUrl(tok, lang), 'Cache-Control': 'no-store',
    'Set-Cookie': IND_CODE_COOKIE + '=' + c + '; Path=/api/talk; Max-Age=' + IND_CODE_DAYS * 86400 + '; HttpOnly; Secure; SameSite=Lax' } });
}
// A permanent token opens only an induction talk, and only while its version is the current one.
export const permOk = (t, talk) => !t.perm || (!!talk && PERM_KINDS.indexOf(talk.kind) >= 0 && (talk.link_v || 0) === t.v);
export function makeGroupToken(env, id, nowMs) { return makeLinkToken(env, GROUP_PREFIX, id, GROUP_TTL_DAYS, nowMs); }
export function readGroupToken(env, tok, nowMs) { return readLinkToken(env, GROUP_PREFIX, tok, nowMs); }
async function readTok(env, tok, g) {
  if (g) return readGroupToken(env, tok);
  const t = await readTalkToken(env, tok);
  if (t.error !== 'bad') return t;
  const p = await readPermToken(env, tok);
  return p.error ? t : p;
}

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
      // The talk video (10/10/2026): a file from our Storage, or YouTube without cookies.
      + "media-src " + SB + "; frame-src https://www.youtube-nocookie.com; "
      // The read-aloud voice (10/10/2026): fetched from this same endpoint, played with Web Audio.
      + "connect-src 'self'; "
      + "form-action 'self'; base-uri 'none'; frame-ancestors 'none'",
  };
}

export function page(title, inner, tone, status, nonce, lang) {
  const L = LANGS[langOf(lang)];
  const color = tone === 'ok' ? '#15803d' : tone === 'err' ? '#cc1f1f' : '#1e3a8a';
  const html = '<!doctype html><html lang="' + langOf(lang) + '" dir="' + L.dir + '"><head><meta charset="UTF-8">'
    + '<meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex, nofollow">'
    + '<title>' + esc(L.title) + '</title></head>'
    + '<body style="font-family:Arial,Heebo,sans-serif;background:#f5f7fa;margin:0;padding:12px">'
    + '<div style="background:#fff;border-radius:12px;max-width:560px;margin:0 auto;box-shadow:0 4px 20px rgba(0,0,0,.08);overflow:hidden">'
    + '<div style="background:' + color + ';color:#fff;padding:14px 18px;font-size:18px;font-weight:700">' + esc(title) + '</div>'
    + '<div style="padding:16px 18px;font-size:16px;line-height:1.7;color:#1f2937">' + inner + '</div>'
    + '<div dir="rtl" style="padding:10px 18px;background:#f9fafb;font-size:11px;color:#9ca3af">\u05ea\u05e2\u05e9\u05d9\u05d5\u05ea \u05ea\u05e4\u05d5\u05d2\u05df - \u05e0\u05d9\u05d4\u05d5\u05dc \u05d1\u05d8\u05d9\u05d7\u05d5\u05ea</div>'
    + '</div></body></html>';
  return new Response(html, { status: status || 200, headers: headers(nonce) });
}
export function ytId(v) {
  const m = /^https:\/\/(?:www\.|m\.)?(?:youtube\.com\/(?:watch\?(?:[^#]*&)?v=|shorts\/|embed\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/.exec(String(v || '').trim());
  return m ? m[1] : '';
}
const ansOk = (a) => typeof a === 'string' && a.trim() !== '';
// Up to 5 questions; each needs a text, two answers and a right answer that is not empty.
export function quizOf(talk, lang) {
  const q = Array.isArray(talk && talk.quiz) ? talk.quiz : [];
  const base = q.filter((x) => x && ansOk(x.q) && Array.isArray(x.a) && x.a.filter(ansOk).length >= 2
    && Number.isInteger(x.c) && x.c >= 0 && x.c < x.a.length && ansOk(x.a[x.c])).slice(0, 5);
  if (!lang || lang === 'he') return base;
  // A translation counts only with the same answers in the same places, so the right answer stays right.
  return base.map((x) => {
    const t = x.t && x.t[lang];
    if (!t || !ansOk(t.q) || !Array.isArray(t.a) || t.a.length !== x.a.length || x.a.some((a, j) => ansOk(a) !== ansOk(t.a[j]))) return null;
    return { q: t.q, a: t.a, c: x.c };
  }).filter(Boolean);
}
// The first answer to each question, "0:2,1:0". Changing it after seeing the right answer does
// not count: the score is evidence of understanding (procedure 8, 5.5.5).
// Every question with the answer the worker chose first (10/10/2026, Michael: "\u05d7\u05e1\u05e8... \u05db\u05d5\u05dc\u05dc \u05d4\u05e9\u05d0\u05dc\u05d5\u05ea
// \u05e9\u05e0\u05e2\u05e0\u05d5"): for the signed induction form. In the language the worker answered in; when every
// question was translated (same count) the Hebrew comes along, the answers sit in the same places.
export function quizAnswers(talk, lang, raw) {
  const quiz = quizOf(talk, lang);
  if (!quiz.length) return [];
  const he = lang && lang !== 'he' ? quizOf(talk, 'he') : [];
  const first = {};
  for (const p of String(raw || '').split(',')) { const m = /^(\d):(\d)$/.exec(p.trim()); if (m && !(m[1] in first) && +m[1] < quiz.length) first[m[1]] = +m[2]; }
  return quiz.map((x, i) => {
    const pick = i in first && ansOk(x.a[first[i]]) ? first[i] : null;
    const h = he.length === quiz.length ? he[i] : null;
    return { q: x.q, a: pick === null ? null : x.a[pick], right: x.a[x.c], ok: pick === x.c,
      he: h ? { q: h.q, a: pick === null ? null : h.a[pick], right: h.a[h.c] } : null };
  });
}
export function quizScore(quiz, raw) {
  if (!quiz.length) return null;
  const first = {};
  for (const p of String(raw || '').split(',')) { const m = /^(\d):(\d)$/.exec(p.trim()); if (m && !(m[1] in first) && +m[1] < quiz.length) first[m[1]] = +m[2]; }
  const keys = Object.keys(first);
  if (!keys.length) return null;
  return { ok: keys.filter((k) => first[k] === quiz[+k].c).length, n: quiz.length };
}
async function videoHtml(env, talk, L) {
  const v = String(talk.video_url || '').trim();
  if (!v) return '';
  const head = '<div style="font-weight:700;margin:4px 0 6px">\ud83c\udfac ' + esc(L.video) + '</div>';
  const id = ytId(v);
  if (id) return head + '<div style="position:relative;padding-top:56.25%;margin-bottom:12px"><iframe src="https://www.youtube-nocookie.com/embed/' + id + '?rel=0" title="' + esc(L.video) + '" allow="encrypted-media; picture-in-picture; fullscreen" allowfullscreen style="position:absolute;top:0;left:0;width:100%;height:100%;border:0;border-radius:8px"></iframe></div>';
  const signed = await signedFiles(env, v);
  if (signed[0]) return head + '<video controls playsinline preload="metadata" src="' + esc(signed[0]) + '" style="display:block;width:100%;border-radius:8px;background:#000;margin-bottom:12px"></video>';
  if (/^https:\/\//.test(v)) return head + '<p><a href="' + esc(v) + '" target="_blank" rel="noopener" style="color:#1e3a8a;font-weight:700">\u25b6 ' + esc(L.vOpen) + '</a></p>';
  return '';
}
function quizHtml(quiz, lang) {
  if (!quiz.length) return '';
  const T = QZL[lang] || QZ;
  return '<div id="qz" dir="' + ((LANGS[lang] || LANGS.he).dir) + '" style="border-top:1px solid #e5e7eb;padding-top:12px;margin-top:8px"><div style="font-weight:700;margin-bottom:8px">\u2753 ' + esc(T.t) + '</div>'
    + quiz.map((x, i) => '<fieldset data-q="' + i + '" style="border:1px solid #e5e7eb;border-radius:8px;padding:8px 12px;margin:0 0 10px"><legend style="font-weight:700;padding:0 4px">' + (i + 1) + '. ' + esc(x.q) + '</legend>'
      + x.a.map((a, j) => (ansOk(a) ? '<label style="display:flex;gap:8px;align-items:center;padding:6px 0"><input type="radio" name="q' + i + '" value="' + j + '" style="width:22px;height:22px;flex:none">' + esc(a) + '</label>' : '')).join('')
      + '<div class="qr" style="font-size:14px;font-weight:700"></div></fieldset>').join('') + '</div>';
}
const quizScript = (quiz, lang) => `(function(){
var K=${JSON.stringify(quiz.map((x) => x.c))},A=${JSON.stringify(quiz.map((x) => x.a[x.c]))},T=${JSON.stringify(QZL[lang] || QZ)},first={};
Array.prototype.forEach.call(document.querySelectorAll('fieldset[data-q]'),function(f){var i=+f.getAttribute('data-q');
f.addEventListener('change',function(e){var v=+e.target.value;
if(!(i in first)){first[i]=v;document.getElementById('qa').value=Object.keys(first).map(function(k){return k+':'+first[k];}).join(',');}
var r=f.querySelector('.qr');if(v===K[i]){r.style.color='#15803d';r.textContent='\\u2713 '+T.ok;}else{r.style.color='#cc1f1f';r.textContent='\\u2717 '+T.no+' '+A[i];}});});
})();`.replace(/</g, '\\u003c');

// The signed induction form (10/10/2026, Michael: "\u05dc\u05d0\u05d7\u05e8 \u05d4\u05d4\u05d3\u05e8\u05db\u05d4 \u05d4\u05e2\u05d5\u05d1\u05d3 \u05d7\u05d5\u05ea\u05dd \u05d5\u05d4\u05d8\u05d5\u05e4\u05e1 \u05e6\u05e8\u05d9\u05da \u05dc\u05d4\u05d2\u05d9\u05e2 \u05dc-2
// \u05de\u05d9\u05d9\u05dc\u05d9\u05dd, \u05d0\u05dc\u05d9\u05d9 \u05d5\u05dc\u05de\u05e9\u05d0\u05d1\u05d9 \u05d0\u05e0\u05d5\u05e9, \u05dc\u05ea\u05d9\u05d5\u05e7 \u05d1\u05ea\u05d9\u05e7\u05d9\u05d9\u05d4". Questionnaire: to him and hr-tap@, filed under
// 11_\u05d4\u05d3\u05e8\u05db\u05d5\u05ea/12_\u05e7\u05dc\u05d9\u05d8\u05ea \u05e2\u05d5\u05d1\u05d3\u05d9\u05dd \u05d7\u05d3\u05e9\u05d9\u05dd/<year>). An HTML page with the text the worker read, the details
// and the signature; Graph turns it into a PDF (the HTML is filed when that fails); one mail with
// the form attached. The source HTML stays in the app folder: nothing is ever deleted in OneDrive.
export const IND_HR = 'hr-tap@tapugan.co.il';
export const IND_ROOT = '\u05e9\u05d5\u05dc\u05d7\u05df \u05d4\u05e2\u05d1\u05d5\u05d3\u05d4/\u05e0\u05d9\u05d4\u05d5\u05dc \u05d1\u05d8\u05d9\u05d7\u05d5\u05ea/11_\u05d4\u05d3\u05e8\u05db\u05d5\u05ea/12_\u05e7\u05dc\u05d9\u05d8\u05ea \u05e2\u05d5\u05d1\u05d3\u05d9\u05dd \u05d7\u05d3\u05e9\u05d9\u05dd';
export const IND_SRC = 'Apps/Tapugan Safety/\u05e7\u05dc\u05d9\u05d8\u05ea \u05e2\u05d5\u05d1\u05d3\u05d9\u05dd - \u05de\u05e7\u05d5\u05e8';
const GRAPH_ROOT = 'https://graph.microsoft.com/v1.0/me/drive/root:/';
const fileSafe = (v) => String(v || '').replace(/[\\/:*?"<>|#%]/g, ' ').replace(/\s+/g, ' ').trim().substring(0, 60);
function b64(u8) { let out = ''; for (let i = 0; i < u8.length; i += 0x8000) out += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(out); }
export function inductionHtml(talk, row, sigB64, lang, when, answers, docs) {
  const x = textOf(talk, 'he'), read = textOf(talk, lang).lang, L = LANGS.he, RL = LANGS[read] || LANGS.he;
  const tr = (k, v) => '<tr><td style="border:1px solid #999;padding:6px 10px;font-weight:bold">' + k + '</td><td style="border:1px solid #999;padding:6px 10px">' + v + '</td></tr>';
  return '<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8"><title>' + esc(x.title) + '</title></head>'
    + '<body style="font-family:Arial,sans-serif;font-size:13px;line-height:1.5;margin:24px;color:#111">'
    + '<img alt="\u05ea\u05e4\u05d5\u05d2\u05df" style="height:56px;float:left;margin:0 0 8px 12px" src="data:image/jpeg;base64,' + LOGO_JPG + '">'
    + '<div style="font-size:11px;color:#555">\u05ea\u05e2\u05e9\u05d9\u05d5\u05ea \u05ea\u05e4\u05d5\u05d2\u05df - \u05d4\u05d5\u05e8\u05d0\u05d5\u05ea \u05d4\u05db\u05e0\u05e1\u05ea \u05e2\u05d5\u05d1\u05d3\u05d9\u05dd \u05dc\u05de\u05e9\u05de\u05e8\u05ea, \u05d8\u05d5\u05e4\u05e1 08.02.01</div>'
    + '<h1 style="font-size:18px;margin:4px 0 8px">' + esc(x.title) + '</h1>'
    + '<div style="font-size:16px;font-weight:bold;margin:2px 0">' + esc(IND_L.he.welcome) + '</div><div style="margin-bottom:8px">' + esc(IND_L.he.vital) + '</div>'
    + (read !== 'he' ? '<div style="margin-bottom:6px">\u05e9\u05e4\u05ea \u05d4\u05d4\u05d3\u05e8\u05db\u05d4 \u05e9\u05d4\u05e2\u05d5\u05d1\u05d3 \u05e7\u05e8\u05d0: ' + esc(RL.name) + '</div>' : '')
    + '<div dir="' + L.dir + '" style="white-space:pre-wrap;border:1px solid #ccc;padding:10px">' + esc(x.body) + '</div>'
    + '<p dir="' + L.dir + '" style="font-weight:bold">' + esc(L.ok) + '</p>'
    + '<table style="border-collapse:collapse;margin:12px 0">'
    + tr('\u05ea\u05d0\u05e8\u05d9\u05da \u05d5\u05e9\u05e2\u05d4', esc(fdate(when.day)) + ' ' + esc(when.hm))
    + tr('\u05e9\u05dd', esc(row.emp_name || ''))
    + tr('\u05de\u05e1\' \u05ea.\u05d6.', esc(row.id_no || ''))
    + (row.emp_no ? tr('\u05de\u05e1\u05e4\u05e8 \u05e2\u05d5\u05d1\u05d3', esc(row.emp_no)) : '')
    + tr('\u05de\u05d7\u05dc\u05e7\u05d4', esc(row.dept || '-'))
    + (row.phone ? tr('\u05d8\u05dc\u05e4\u05d5\u05df', '<span dir="ltr">' + esc(row.phone) + '</span>') : '')
    + (row.job ? tr('\u05ea\u05e4\u05e7\u05d9\u05d3', esc(row.job)) : '')
    + (row.agency ? tr('\u05d7\u05d1\u05e8\u05ea \u05db\u05d5\u05d7 \u05d0\u05d3\u05dd', esc(row.agency)) : '')
    + (row.quiz_n ? tr('\u05d1\u05d3\u05d9\u05e7\u05ea \u05d4\u05d1\u05e0\u05d4', row.quiz_ok + '/' + row.quiz_n + ' \u05e0\u05db\u05d5\u05e0\u05d5\u05ea') : '')
    + (talk.trainer ? tr('\u05d4\u05d8\u05d5\u05e4\u05e1 \u05d4\u05d5\u05db\u05df \u05e2\u05dc \u05d9\u05d3\u05d9', esc(talk.trainer) + (talk.trainer_qual ? ', ' + esc(talk.trainer_qual) : '')) : '')
    + tr('\u05d7\u05ea\u05d9\u05de\u05d4', '<img alt="\u05d7\u05ea\u05d9\u05de\u05d4" style="height:90px;max-width:260px" src="data:image/png;base64,' + sigB64 + '">')
    + '</table>'
    + (Array.isArray(answers) && answers.length ? '<div style="font-weight:bold;margin:12px 0 4px">\u05d1\u05d3\u05d9\u05e7\u05ea \u05d4\u05d1\u05e0\u05d4: \u05d4\u05e9\u05d0\u05dc\u05d5\u05ea \u05d5\u05d4\u05ea\u05e9\u05d5\u05d1\u05d4 \u05e9\u05d4\u05e2\u05d5\u05d1\u05d3 \u05d1\u05d7\u05e8</div>'
      + '<table style="border-collapse:collapse;margin:0 0 12px;width:100%">' + answers.map((x, n) => '<tr>'
        + '<td style="border:1px solid #999;padding:6px 10px;vertical-align:top;width:45%"><b>' + (n + 1) + '. ' + esc(x.q) + '</b>' + (x.he && x.he.q !== x.q ? '<div style="color:#555">' + esc(x.he.q) + '</div>' : '') + '</td>'
        + '<td style="border:1px solid #999;padding:6px 10px;vertical-align:top">' + (x.a === null ? '\u05dc\u05d0 \u05e0\u05e2\u05e0\u05ea\u05d4' : esc(x.a) + (x.he && x.he.a !== x.a ? '<div style="color:#555">' + esc(x.he.a) + '</div>' : '')) + '</td>'
        + '<td style="border:1px solid #999;padding:6px 10px;vertical-align:top;white-space:nowrap;font-weight:bold;color:' + (x.ok ? '#15803d">\u2713 \u05e0\u05db\u05d5\u05df' : '#b91c1c">\u2717 \u05e9\u05d2\u05d5\u05d9') + '</td></tr>'
        + (x.ok ? '' : '<tr><td colspan="3" style="border:1px solid #999;padding:4px 10px;color:#555">\u05d4\u05ea\u05e9\u05d5\u05d1\u05d4 \u05d4\u05e0\u05db\u05d5\u05e0\u05d4: ' + esc(x.he ? x.he.right : x.right) + '</td></tr>')).join('') + '</table>' : '')
    + (Array.isArray(docs) && docs.length ? docs.map((d, n) => '<div style="page-break-before:always;break-before:page"><div style="font-weight:bold;margin:0 0 8px">\u05de\u05e1\u05de\u05da \u05e9\u05e6\u05d5\u05dc\u05dd \u05d1\u05e7\u05dc\u05d9\u05d8\u05d4 ' + (n + 1) + ' \u05de\u05ea\u05d5\u05da ' + docs.length + ' - ' + esc(row.emp_name || '') + '</div>'
      + '<img alt="' + (n + 1) + '" style="max-width:100%;max-height:900px" src="data:image/jpeg;base64,' + d + '"></div>').join('') : '')
    + '<div style="font-size:11px;color:#555">\u05e0\u05d7\u05ea\u05dd \u05d1\u05d8\u05dc\u05e4\u05d5\u05df \u05d3\u05e8\u05da \u05d0\u05e4\u05dc\u05d9\u05e7\u05e6\u05d9\u05d9\u05ea \u05e0\u05d9\u05d4\u05d5\u05dc \u05d4\u05d1\u05d8\u05d9\u05d7\u05d5\u05ea. \u05de\u05d6\u05d4\u05d4 \u05e8\u05e9\u05d5\u05de\u05d4: ' + esc(row.id || '') + '</div></body></html>';
}
export async function fileInduction(env, talk, row, sig, lang, nowMs, answers, docs) {
  const out = { pdf: false, url: null, mailed: false, err: null, name: null };
  try {
    const od = await accessToken(env);
    const now = new Date(nowMs || Date.now());
    const day = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Jerusalem' });
    const hm = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jerusalem', hour12: false });
    // The file name: date, name and the last 4 digits of the ID only (11/10/2026, Michael: "\u05d1\u05e6\u05e2: \u05e9\u05dd \u05d1\u05dc\u05d9 \u05ea.\u05d6. \u05de\u05dc\u05d0\u05d4").
    // A file name shows in folder listings, search and sharing; the full ID stays inside the signed form.
    const idTail = String(row.id_no || '').replace(/\D/g, '').slice(-4);
    const base = day.split('-').reverse().join('-') + ' - ' + fileSafe(row.emp_name) + (idTail ? ' - ' + idTail : '');
    const hb = new TextEncoder().encode(inductionHtml(talk, row, b64(sig), lang, { day, hm }, answers, docs));
    let bytes = hb, name = base + '.html', type = 'text/html';
    try {
      await putFile(od.token, IND_SRC, base + '.html', hb, 'text/html; charset=utf-8');
      const seg = (IND_SRC + '/' + base + '.html').split('/').map(encodeURIComponent).join('/');
      const r = await fetch(GRAPH_ROOT + seg + ':/content?format=pdf', { headers: { Authorization: 'Bearer ' + od.token } });
      if (r.ok) {
        const pdf = new Uint8Array(await r.arrayBuffer());
        if (pdf.length > 800 && pdf[0] === 0x25 && pdf[1] === 0x50 && pdf[2] === 0x44 && pdf[3] === 0x46) { bytes = pdf; name = base + '.pdf'; type = 'application/pdf'; out.pdf = true; }
      }
    } catch (e) { /* the HTML is filed and sent instead */ }
    out.name = name;
    const filed = await putFile(od.token, IND_ROOT + '/' + day.slice(0, 4), name, bytes, type);
    out.url = filed.webUrl || null;
    const to = [od.email, IND_HR].filter((v, i, a) => v && a.indexOf(v) === i);
    const cell = (k, v) => '<tr><td style="padding:4px 10px;font-weight:bold">' + k + '</td><td style="padding:4px 10px">' + v + '</td></tr>';
    const mail = '<div dir="rtl" style="font-family:Arial,sans-serif;font-size:14px">'
      + '<p>\u05e2\u05d5\u05d1\u05d3 \u05d7\u05d3\u05e9 \u05d7\u05ea\u05dd \u05e2\u05dc \u05d4\u05d5\u05e8\u05d0\u05d5\u05ea \u05d4\u05db\u05e0\u05e1\u05ea \u05e2\u05d5\u05d1\u05d3\u05d9\u05dd \u05dc\u05de\u05e9\u05de\u05e8\u05ea (\u05d8\u05d5\u05e4\u05e1 08.02.01). \u05d4\u05d8\u05d5\u05e4\u05e1 \u05d4\u05d7\u05ea\u05d5\u05dd \u05de\u05e6\u05d5\u05e8\u05e3.</p>'
      + '<table>' + cell('\u05e9\u05dd', esc(row.emp_name || '')) + cell('\u05de\u05e1\' \u05ea.\u05d6.', esc(row.id_no || '')) + (row.emp_no ? cell('\u05de\u05e1\u05e4\u05e8 \u05e2\u05d5\u05d1\u05d3', esc(row.emp_no)) : '') + cell('\u05de\u05d7\u05dc\u05e7\u05d4', esc(row.dept || '-')) + (row.phone ? cell('\u05d8\u05dc\u05e4\u05d5\u05df', esc(row.phone)) : '') + (row.job ? cell('\u05ea\u05e4\u05e7\u05d9\u05d3', esc(row.job)) : '') + (row.agency ? cell('\u05d7\u05d1\u05e8\u05ea \u05db\u05d5\u05d7 \u05d0\u05d3\u05dd', esc(row.agency)) : '') + cell('\u05ea\u05d0\u05e8\u05d9\u05da', esc(fdate(day)) + ' ' + esc(hm))
      + (row.quiz_n ? cell('\u05d1\u05d3\u05d9\u05e7\u05ea \u05d4\u05d1\u05e0\u05d4', row.quiz_ok + '/' + row.quiz_n) : '') + '</table>'
      + (out.url ? '<p>\u05ea\u05d5\u05d9\u05e7 \u05d1\u05ea\u05d9\u05e7\u05d9\u05d9\u05d4: <a href="' + esc(out.url) + '">' + esc(name) + '</a></p>' : '')
      + '<p style="color:#666;font-size:12px">\u05e0\u05e9\u05dc\u05d7 \u05d0\u05d5\u05d8\u05d5\u05de\u05d8\u05d9\u05ea \u05de\u05d0\u05e4\u05dc\u05d9\u05e7\u05e6\u05d9\u05d9\u05ea \u05e0\u05d9\u05d4\u05d5\u05dc \u05d4\u05d1\u05d8\u05d9\u05d7\u05d5\u05ea \u05e9\u05dc \u05ea\u05e2\u05e9\u05d9\u05d5\u05ea \u05ea\u05e4\u05d5\u05d2\u05df.</p></div>';
    await sendMailTo(od.token, to, [], '\u05d8\u05d5\u05e4\u05e1 \u05e7\u05dc\u05d9\u05d8\u05ea \u05e2\u05d5\u05d1\u05d3 \u05d7\u05d3\u05e9 \u05d7\u05ea\u05d5\u05dd: ' + (row.emp_name || '') + ', ' + fdate(day), mail,
      // A form with many photos can pass what a mail carries: then the link above only.
      bytes.length <= MAIL_ATTACH_MAX ? [{ '@odata.type': '#microsoft.graph.fileAttachment', name, contentType: type, contentBytes: b64(bytes) }] : []);
    out.mailed = true;
  } catch (e) { out.err = String((e && e.message) || e).substring(0, 200); }
  // Shown next to the signature in "who signed": filed, mailed, or why not.
  try {
    await fetch(SB + '/rest/v1/toolbox_reads?id=eq.' + encodeURIComponent(row.id), { method: 'PATCH', headers: sbH(env, { 'Content-Type': 'application/json', Prefer: 'return=minimal' }), body: JSON.stringify({ doc_url: out.url, mailed_at: out.mailed ? new Date().toISOString() : null, doc_err: out.err }) });
  } catch (e) { /* the signature is saved */ }
  return out;
}

const errPage = (msg, status) => page('\u05dc\u05d0 \u05e0\u05d9\u05ea\u05df \u05dc\u05e4\u05ea\u05d5\u05d7', '<p>' + esc(msg) + '</p>', 'err', status || 400);
// The same pages in the language the worker chose: an expired link is the error every worker meets.
const errL = (k, lang, status) => { const L = LANGS[langOf(lang)]; return page(L.errT, '<p>' + esc(L[k]) + '</p>', 'err', status, '', langOf(lang)); };

// Form 08.01 "\u05ea\u05d9\u05e2\u05d5\u05d3 \u05d1\u05d9\u05e6\u05d5\u05e2 \u05d4\u05d3\u05e8\u05db\u05d4" (14/10/2026, Michael: "I want the tables here filled with every worker who
// went through, and the signature here", one form, not one per worker; in the questionnaire: "PDF to
// the folder + print"). The layout of his Word form: logo and form number, the topics, date, duration,
// trainer and signature, the participants (#, name, department, ID, signature), the effectiveness check.
// 20 participants per page, as on the paper; the header repeats on each page.
export const F0801_ROOT = '\u05e9\u05d5\u05dc\u05d7\u05df \u05d4\u05e2\u05d1\u05d5\u05d3\u05d4/\u05e0\u05d9\u05d4\u05d5\u05dc \u05d1\u05d8\u05d9\u05d7\u05d5\u05ea/11_\u05d4\u05d3\u05e8\u05db\u05d5\u05ea';
export const F0801_SUB = { annual: '\u05d4\u05d3\u05e8\u05db\u05d4 \u05e9\u05e0\u05ea\u05d9\u05ea', quality: '\u05d4\u05d3\u05e8\u05db\u05ea \u05d0\u05d9\u05db\u05d5\u05ea', induction: '\u05e7\u05dc\u05d9\u05d8\u05ea \u05e2\u05d5\u05d1\u05d3\u05d9\u05dd - \u05d8\u05d5\u05e4\u05e1 08.01' };
export const F0801_WEEKLY = '\u05d4\u05d3\u05e8\u05db\u05d5\u05ea \u05e9\u05d1\u05d5\u05e2\u05d9\u05d5\u05ea';
export const F0801_SRC = 'Apps/Tapugan Safety/\u05d8\u05e4\u05e1\u05d9 \u05d4\u05d3\u05e8\u05db\u05d4 - \u05de\u05e7\u05d5\u05e8';
export const F0801_ROWS = 20;
export function topicsOf(body) {
  return String(body || '').split(/\r?\n/).map((l) => l.replace(/^\s*(\d+[.)]|[-*])\s*/, '').trim()).filter((l) => l.length > 1);
}
export function form0801Html(talk, reads, sigOf, trSig) {
  const e = esc, dt = fdate(talk.d), yn = (v) => (v === true ? '\u05db\u05df' : v === false ? '\u05dc\u05d0' : '');
  // The kinds of training ticked before publishing (subjects, 14/10/2026), else the topics of the text.
  const topics = topicsOf(talk.subjects || talk.body); while (topics.length < 4) topics.push('');
  const img = (v) => (String(v).indexOf('data:') === 0 ? v : 'data:image/png;base64,' + v);
  const css = 'body{font-family:Arial,sans-serif;font-size:12px;direction:rtl;margin:0}table{border-collapse:collapse;width:100%}td,th{border:1px solid #000;padding:3px 5px;vertical-align:middle}'
    + 'th{background:#d9d9d9;font-weight:normal}.pg{page-break-after:always;padding:8px 4px}.pg:last-child{page-break-after:auto}.h1{font-size:17px;font-weight:bold;text-align:center}'
    + '.sig{height:26px;max-width:120px}.lbl{font-weight:bold}.t2{color:#c00000;font-weight:bold;text-decoration:underline;margin:10px 0 4px}';
  const pages = Math.max(1, Math.ceil(reads.length / F0801_ROWS));
  const head = (n) => '<table><tr><td rowspan="2" style="width:110px;text-align:center"><img alt="\u05ea\u05e4\u05d5\u05d2\u05df" style="height:44px" src="data:image/jpeg;base64,' + LOGO_JPG + '"></td>'
    + '<td colspan="3" class="h1">\u05ea\u05d9\u05e2\u05d5\u05d3 \u05d1\u05d9\u05e6\u05d5\u05e2 \u05d4\u05d3\u05e8\u05db\u05d4</td></tr><tr><td style="font-size:11px">\u05d8\u05d5\u05e4\u05e1 08.01</td><td style="font-size:11px">\u05e2\u05de\u05d5\u05d3 ' + n + ' \u05de\u05ea\u05d5\u05da ' + pages + '</td><td style="font-size:11px">' + e(talk.title || '') + '</td></tr></table>';
  const top = '<table style="margin-top:10px"><tr><td rowspan="' + topics.length + '" style="width:110px;text-align:center">\u05e0\u05d5\u05e9\u05d0\u05d9 \u05d4\u05d4\u05d3\u05e8\u05db\u05d4</td>'
    + topics.map((t, i) => (i ? '<tr>' : '') + '<td style="width:24px;text-align:center">' + (i + 1) + '</td><td>' + e(t) + '</td></tr>').join('') + '</table>'
    + '<table style="margin-top:10px"><tr><td class="lbl" style="width:22%">\u05ea\u05d0\u05e8\u05d9\u05da \u05d4\u05d4\u05d3\u05e8\u05db\u05d4:</td><td>' + e(dt) + '</td><td class="lbl" style="width:22%">\u05de\u05e9\u05da \u05d4\u05d4\u05d3\u05e8\u05db\u05d4:</td><td>' + e(talk.dur || '') + '</td></tr>'
    + '<tr><td class="lbl">\u05e9\u05dd \u05d4\u05de\u05d3\u05e8\u05d9\u05da:</td><td>' + e(talk.trainer || '') + (talk.trainer_qual ? ', ' + e(talk.trainer_qual) : '') + '</td><td class="lbl">\u05d7\u05ea\u05d9\u05de\u05ea \u05d4\u05de\u05d3\u05e8\u05d9\u05da:</td><td>' + (trSig ? '<img class="sig" alt="" src="' + img(trSig) + '">' : '') + '</td></tr></table>';
  const eff = '<div class="t2">\u05d1\u05d3\u05d9\u05e7\u05ea \u05d0\u05e4\u05e7\u05d8\u05d9\u05d1\u05d9\u05d5\u05ea</div><table><tr><td class="lbl">\u05e0\u05d3\u05e8\u05e9\u05ea: ' + yn(talk.eff_req) + '</td><td class="lbl">\u05d0\u05e4\u05e7\u05d8\u05d9\u05d1\u05d9: ' + yn(talk.eff_ok) + '</td></tr>'
    + '<tr><td><span class="lbl">\u05ea\u05d0\u05e8\u05d9\u05da:</span> ' + e(fdate(talk.eff_d)) + '</td><td><span class="lbl">\u05d4\u05de\u05e9\u05da \u05d8\u05d9\u05e4\u05d5\u05dc (\u05d0\u05dd \u05e0\u05d3\u05e8\u05e9):</span> ' + e(talk.eff_next || '') + '</td></tr>'
    + '<tr><td><span class="lbl">\u05ea\u05d0\u05d5\u05e8 \u05d4\u05d1\u05d3\u05d9\u05e7\u05d4:</span> ' + e(talk.eff_desc || '') + '</td><td><span class="lbl">\u05d7\u05ea\u05d9\u05de\u05d4:</span> ' + e(talk.eff_by || '') + (talk.eff_by && trSig ? ' <img class="sig" alt="" src="' + img(trSig) + '">' : '') + '</td></tr></table>';
  let out = '';
  for (let p = 0; p < pages; p++) {
    const part = reads.slice(p * F0801_ROWS, (p + 1) * F0801_ROWS);
    const rows = part.map((x, i) => '<tr><td style="text-align:center">' + (p * F0801_ROWS + i + 1) + '</td><td>' + e(x.emp_name || '') + '</td><td>' + e(x.dept || '') + '</td><td dir="ltr" style="text-align:right">' + e(x.id_no || '') + '</td><td>' + (sigOf(x) ? '<img class="sig" alt="" src="' + img(sigOf(x)) + '">' : '') + '</td></tr>');
    while (rows.length < F0801_ROWS && p === pages - 1) rows.push('<tr><td style="height:22px"></td><td></td><td></td><td></td><td></td></tr>');
    out += '<div class="pg">' + head(p + 1) + (p === 0 ? top : '')
      + '<div class="t2">\u05e8\u05e9\u05d9\u05de\u05ea \u05d4\u05de\u05e9\u05ea\u05ea\u05e4\u05d9\u05dd</div><table><tr><th style="width:36px">\u05de\u05e1"\u05d3</th><th>\u05e9\u05dd \u05e2\u05d5\u05d1\u05d3</th><th>\u05de\u05d7\u05dc\u05e7\u05d4</th><th>\u05de\u05e1\' \u05d6\u05d4\u05d5\u05ea</th><th style="width:130px">\u05d7\u05ea\u05d9\u05de\u05d4</th></tr>' + rows.join('') + '</table>'
      + (p === pages - 1 ? eff : '') + '</div>';
  }
  return '<!doctype html><html lang="he" dir="rtl"><head><meta charset="UTF-8"><title>08.01</title><style>' + css + '</style></head><body>' + out + '</body></html>';
}
async function storageB64(env, url) {
  const m = /\/storage\/v1\/object\/(?:public\/|sign\/)?([^/]+)\/([^?]+)/.exec(String(url || ''));
  if (!m) return null;
  try {
    const r = await fetch(SB + '/storage/v1/object/' + m[1] + '/' + m[2], { headers: sbH(env) });
    if (!r.ok) return null;
    const u8 = new Uint8Array(await r.arrayBuffer());
    // A signature drawn in the app is uploaded as JPEG (_fileUpload compresses images), the workers' as PNG.
    return 'data:' + (u8[0] === 0xFF && u8[1] === 0xD8 ? 'image/jpeg' : 'image/png') + ';base64,' + b64(u8);
  } catch (e) { return null; }
}
export async function file0801(env, talk, reads, nowMs) {
  const out = { pdf: false, url: null, name: null, mailed: false, n: reads.length };
  const od = await accessToken(env);
  const now = new Date(nowMs || Date.now());
  const day = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Jerusalem' });
  const sigs = {};
  for (const x of reads) sigs[x.id] = await storageB64(env, x.sig_url);
  const trSig = talk.trainer_sig_url ? await storageB64(env, talk.trainer_sig_url) : null;
  const html = form0801Html(talk, reads, (x) => sigs[x.id], trSig);
  const base = (talk.d || day).split('-').reverse().join('-') + ' - ' + fileSafe(talk.title || '08.01') + ' - 08.01';
  const hb = new TextEncoder().encode(html);
  let bytes = hb, name = base + '.html', type = 'text/html';
  try {
    await putFile(od.token, F0801_SRC, base + '.html', hb, 'text/html; charset=utf-8');
    const seg = (F0801_SRC + '/' + base + '.html').split('/').map(encodeURIComponent).join('/');
    const r = await fetch(GRAPH_ROOT + seg + ':/content?format=pdf', { headers: { Authorization: 'Bearer ' + od.token } });
    if (r.ok) {
      const pdf = new Uint8Array(await r.arrayBuffer());
      if (pdf.length > 800 && pdf[0] === 0x25 && pdf[1] === 0x50 && pdf[2] === 0x44 && pdf[3] === 0x46) { bytes = pdf; name = base + '.pdf'; type = 'application/pdf'; out.pdf = true; }
    }
  } catch (e) { /* the HTML is filed instead */ }
  out.name = name;
  const folder = F0801_ROOT + '/' + (F0801_SUB[talk.kind] || F0801_WEEKLY) + '/' + String(talk.d || day).slice(0, 4);
  const filed = await putFile(od.token, folder, name, bytes, type);
  out.url = filed.webUrl || null;
  // To the connected account, and to the address on the training (the quality department).
  const cc = String(talk.mail_cc || '').split(/[,;\s]+/).filter((x) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(x)).slice(0, 5);
  const to = [od.email].concat(cc).filter((v, i, a) => v && a.indexOf(v) === i);
  if (to.length) {
    const mail = '<div dir="rtl" style="font-family:Arial,sans-serif;font-size:14px"><p>\u05d8\u05d5\u05e4\u05e1 08.01 \u05de\u05d5\u05dc\u05d0: <b>' + esc(talk.title || '') + '</b> (' + esc(fdate(talk.d)) + ')</p><p>\u05d7\u05ea\u05de\u05d5: ' + reads.length + '</p>'
      + (out.url ? '<p><a href="' + esc(out.url) + '">\u05e4\u05ea\u05d7 \u05d0\u05ea \u05d4\u05d8\u05d5\u05e4\u05e1 \u05d1\u05ea\u05d9\u05e7\u05d9\u05d9\u05d4</a></p>' : '') + '</div>';
    const att = bytes.length <= MAIL_ATTACH_MAX ? [{ '@odata.type': '#microsoft.graph.fileAttachment', name, contentType: type, contentBytes: b64(bytes) }] : [];
    try { await sendMailTo(od.token, to, [], '\u05d8\u05d5\u05e4\u05e1 08.01: ' + String(talk.title || '').substring(0, 80), mail, att); out.mailed = true; } catch (e) { out.mailErr = String((e && e.message) || e).substring(0, 160); }
  }
  return out;
}

async function getTalk(env, id) {
  const r = await fetch(SB + '/rest/v1/toolbox_talks?id=eq.' + encodeURIComponent(id) + '&select=id,d,title,body,body_ar,body_ru,body_am,file_url,s,trainer,trainer_qual,trainer_signed_at,trainer_sig_url,video_url,quiz,kind,link_v,dept,dur,mail_cc,subjects', { headers: sbH(env) });
  if (!r.ok) throw new Error('talk read ' + r.status);
  const rows = await r.json();
  return Array.isArray(rows) ? rows[0] || null : null;
}
// Someone who left (emp.left_d up to today, Michael 03/10/2026) is not on the list and cannot sign.
async function getEmps(env) {
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jerusalem' });
  const r = await fetch(SB + '/rest/v1/emp?select=id,n,dep,eid&or=(left_d.is.null,left_d.gt.' + today + ')&order=n.asc', { headers: sbH(env) });
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

const sigScript = (L) => `(function(){
var T=${JSON.stringify({ noName: L.noName, noSig: L.noSig, saving: L.saving, send: L.send, oNeed: L.oNeed, oIdNeed: L.oIdNeed }).replace(/</g, '\\u003c')};
var c=document.getElementById('pad'),x=c.getContext('2d'),drawn=false,down=false;
function fit(){var r=c.getBoundingClientRect();c.width=r.width;c.height=180;x.lineWidth=2.5;x.lineCap='round';x.strokeStyle='#111';drawn=false;}
fit();
function pt(e){var r=c.getBoundingClientRect();return{x:(e.clientX-r.left)*c.width/r.width,y:(e.clientY-r.top)*c.height/r.height};}
c.addEventListener('pointerdown',function(e){down=true;var p=pt(e);x.beginPath();x.moveTo(p.x,p.y);c.setPointerCapture(e.pointerId);e.preventDefault();});
c.addEventListener('pointermove',function(e){if(!down)return;var p=pt(e);x.lineTo(p.x,p.y);x.stroke();drawn=true;e.preventDefault();});
c.addEventListener('pointerup',function(){down=false;});
document.getElementById('clr').addEventListener('click',function(){fit();});
function obox(){document.getElementById('obox').style.display=document.getElementById('emp').value==='__other'?'block':'none';}
document.getElementById('emp').addEventListener('change',obox);obox();
document.getElementById('f').addEventListener('submit',function(e){
  if(!document.getElementById('emp').value){e.preventDefault();alert(T.noName);return;}
  if(document.getElementById('emp').value==='__other'&&document.getElementById('oname').value.trim().length<2){e.preventDefault();alert(T.oNeed);return;}
  if(!/^[A-Za-z0-9]{5,12}$/.test(document.getElementById('oid').value.replace(/[\s.-]/g,''))){e.preventDefault();alert(T.oIdNeed);return;}
  if(!drawn){e.preventDefault();alert(T.noSig);return;}
  document.getElementById('sig').value=c.toDataURL('image/png');
  var b=document.getElementById('go');b.disabled=true;b.textContent=T.saving;
});
window.addEventListener('pageshow',function(e){if(e.persisted){var b=document.getElementById('go');b.disabled=false;b.textContent=T.send;}});
})();`;

async function signedIds(env, talkId) {
  const r = await fetch(SB + '/rest/v1/toolbox_reads?talk_id=eq.' + encodeURIComponent(talkId) + '&select=emp_id', { headers: sbH(env) });
  if (!r.ok) return new Set();
  const rows = await r.json();
  return new Set((Array.isArray(rows) ? rows : []).map((x) => String(x.emp_id)));
}
const trScript = `(function(){
var c=document.getElementById('pad'),x=c.getContext('2d'),drawn=false,down=false;
function fit(){var r=c.getBoundingClientRect();c.width=r.width;c.height=180;x.lineWidth=2.5;x.lineCap='round';x.strokeStyle='#111';drawn=false;}
fit();
function pt(e){var r=c.getBoundingClientRect();return{x:(e.clientX-r.left)*c.width/r.width,y:(e.clientY-r.top)*c.height/r.height};}
c.addEventListener('pointerdown',function(e){down=true;var p=pt(e);x.beginPath();x.moveTo(p.x,p.y);c.setPointerCapture(e.pointerId);e.preventDefault();});
c.addEventListener('pointermove',function(e){if(!down)return;var p=pt(e);x.lineTo(p.x,p.y);x.stroke();drawn=true;e.preventDefault();});
c.addEventListener('pointerup',function(){down=false;});
document.getElementById('clr').addEventListener('click',function(){fit();});
document.getElementById('f').addEventListener('submit',function(e){if(!drawn){e.preventDefault();alert('\u05d7\u05e1\u05e8\u05d4 \u05d7\u05ea\u05d9\u05de\u05d4');return;}document.getElementById('sig').value=c.toDataURL('image/png');document.getElementById('go').disabled=true;});
})();`;
// The first trainer signature stays (13/10/2026, BACKLOG 13.9): the group link sits on the
// manager's phone for a day, and anyone holding it could sign again in the trainer's place.
// A wrong signature is fixed by the safety officer, not from the link.
function trSignedMsg(at) {
  const d = at && new Date(at), when = d && !isNaN(d) ? ' \u05d1-' + d.toLocaleDateString('en-GB', { timeZone: 'Asia/Jerusalem' }) + ' \u05d1\u05e9\u05e2\u05d4 ' + d.toLocaleTimeString('en-GB', { timeZone: 'Asia/Jerusalem', hour: '2-digit', minute: '2-digit', hour12: false }) : '';
  return '\u05d7\u05ea\u05d9\u05de\u05ea \u05d4\u05de\u05d3\u05e8\u05d9\u05da \u05db\u05d1\u05e8 \u05e0\u05e9\u05de\u05e8\u05d4' + when + '. \u05dc\u05ea\u05d9\u05e7\u05d5\u05df \u05d4\u05d7\u05ea\u05d9\u05de\u05d4 \u05d9\u05e9 \u05dc\u05e4\u05e0\u05d5\u05ea \u05dc\u05de\u05de\u05d5\u05e0\u05d4 \u05d4\u05d1\u05d8\u05d9\u05d7\u05d5\u05ea.';
}
// The trainer closes the group talk with a signed declaration, on the same phone.
function trainerPage(tok, talk) {
  const nonce = newId() + newId();
  const inner = '<h2 style="margin:4px 0 8px;font-size:20px">' + esc(talk.title) + '</h2>'
    + '<div style="font-size:14px;margin-bottom:10px">\u05de\u05d3\u05e8\u05d9\u05da: ' + esc(talk.trainer || '-') + (talk.trainer_qual ? ', ' + esc(talk.trainer_qual) : '') + '</div>'
    + (talk.trainer_signed_at ? '<p style="color:#15803d;font-weight:700">' + trSignedMsg(talk.trainer_signed_at) + '</p>' : '')
    + (talk.trainer_signed_at ? '' : '<form id="f" method="POST" action="/api/talk"><input type="hidden" name="k" value="' + esc(tok) + '"><input type="hidden" name="g" value="1"><input type="hidden" name="t" value="1"><input type="hidden" name="sig" id="sig">'
    + '<label style="display:flex;gap:8px;align-items:center;margin-bottom:12px"><input type="checkbox" name="ok" value="1" required style="width:22px;height:22px;flex:none">' + esc(TR_DECL) + '</label>'
    + '<div style="font-weight:700;margin-bottom:4px">\u05d7\u05ea\u05d9\u05de\u05ea \u05d4\u05de\u05d3\u05e8\u05d9\u05da</div>'
    + '<canvas id="pad" style="width:100%;height:180px;border:2px dashed #9ca3af;border-radius:8px;touch-action:none;background:#fff"></canvas>'
    + '<button type="button" id="clr" style="margin:6px 0 14px;padding:6px 14px;border:1px solid #d1d5db;border-radius:8px;background:#fff;font-size:14px">\u05e0\u05e7\u05d4</button>'
    + '<button type="submit" id="go" style="display:block;width:100%;padding:14px;border:0;border-radius:10px;background:#15803d;color:#fff;font-size:18px;font-weight:700">\u05d7\u05ea\u05d5\u05dd \u05d5\u05e1\u05d9\u05d9\u05dd</button></form>')
    + '<p><a href="' + esc(talkUrl(tok, 'he', true)) + '" style="color:#1e3a8a">\u05d7\u05d6\u05e8\u05d4 \u05dc\u05d7\u05ea\u05d9\u05de\u05d5\u05ea \u05d4\u05e2\u05d5\u05d1\u05d3\u05d9\u05dd</a></p>'
    + (talk.trainer_signed_at ? '' : '<script nonce="' + nonce + '">' + trScript + '</script>');
  return page('\u05e1\u05d9\u05d5\u05dd \u05d4\u05d4\u05d3\u05e8\u05db\u05d4', inner, '', 200, nonce, 'he');
}
async function signTrainer(env, form, tok, talk) {
  const back = '<p><a href="' + esc(talkUrl(tok, 'he', true, true)) + '" style="color:#1e3a8a;font-weight:700">\u05d7\u05d6\u05e8\u05d4</a></p>';
  const already = (at) => page('\u05db\u05d1\u05e8 \u05e0\u05d7\u05ea\u05dd', '<p>' + trSignedMsg(at) + '</p>' + back, 'err', 409, '', 'he');
  if (talk.trainer_signed_at) return already(talk.trainer_signed_at);
  if (String(form.get('ok') || '') !== '1') return page('\u05d7\u05e1\u05e8 \u05d0\u05d9\u05e9\u05d5\u05e8', '<p>\u05e6\u05e8\u05d9\u05da \u05dc\u05e1\u05de\u05df \u05d0\u05ea \u05d4\u05d4\u05e6\u05d4\u05e8\u05d4.</p>' + back, 'err', 400, '', 'he');
  const sig = sigBytes(form.get('sig'));
  if (!sig) return page('\u05d7\u05e1\u05e8\u05d4 \u05d7\u05ea\u05d9\u05de\u05d4', '<p>\u05d4\u05d7\u05ea\u05d9\u05de\u05d4 \u05dc\u05d0 \u05e0\u05e7\u05dc\u05d8\u05d4. \u05d7\u05ea\u05d5\u05dd \u05d1\u05d0\u05e6\u05d1\u05e2 \u05d1\u05ea\u05d5\u05da \u05d4\u05de\u05e1\u05d2\u05e8\u05ea.</p>' + back, 'err', 400, '', 'he');
  // A name per attempt and no upsert: a second signer racing the first never writes over its PNG.
  const name = 'sig-' + talk.id + '-trainer-' + newId() + '.png';
  const up = await fetch(SB + '/storage/v1/object/' + BUCKET + '/' + name, { method: 'POST', headers: sbH(env, { 'Content-Type': 'image/png', 'x-upsert': 'false' }), body: sig });
  const fail = () => page('\u05d4\u05e9\u05de\u05d9\u05e8\u05d4 \u05e0\u05db\u05e9\u05dc\u05d4', '<p>\u05d4\u05d7\u05ea\u05d9\u05de\u05d4 \u05dc\u05d0 \u05e0\u05e9\u05de\u05e8\u05d4. \u05e0\u05e1\u05d4 \u05e9\u05d5\u05d1 \u05d1\u05e2\u05d5\u05d3 \u05d3\u05e7\u05d4.</p>' + back, 'err', 502, '', 'he');
  if (!up.ok) return fail();
  const p = await fetch(SB + '/rest/v1/toolbox_talks?id=eq.' + encodeURIComponent(talk.id) + '&trainer_signed_at=is.null', { method: 'PATCH', headers: sbH(env, { 'Content-Type': 'application/json', Prefer: 'return=representation' }), body: JSON.stringify({ trainer_sig_url: SB + '/storage/v1/object/public/' + BUCKET + '/' + name, trainer_signed_at: new Date().toISOString() }) });
  if (!p.ok) return fail();
  const rows = await p.json().catch(() => null);
  if (Array.isArray(rows) && !rows.length) return already(null);
  return page('\u05ea\u05d5\u05d3\u05d4', '<p>\u05d7\u05ea\u05d9\u05de\u05ea \u05d4\u05de\u05d3\u05e8\u05d9\u05da \u05e0\u05e9\u05de\u05e8\u05d4. \u05d4\u05d4\u05d3\u05e8\u05db\u05d4 \u05d4\u05e1\u05ea\u05d9\u05d9\u05de\u05d4.</p>', 'ok', 200, '', 'he');
}

async function showTalk(env, tok, want, g, tr, cookie) {
  const t = await readTok(env, tok, g);
  if (t.error === 'expired') return errL('expired', want, 410);
  if (t.error) return errL('badLink', want, 403);
  const talk = await getTalk(env, t.id);
  if (!talk || talk.s !== S_PUB) return errL('unpub', want, 404);
  if (!permOk(t, talk)) return errL('badLink', want, 403);
  const gate = await codeGate(env, talk, cookie);
  if (!gate.ok) return codePage(tok, want, false, !!gate.closed);
  if (g && tr) return trainerPage(tok, talk);
  const x = textOf(talk, langOf(want));
  const lang = x.lang, L = LANGS[lang];
  const emps = await getEmps(env);
  const files = await signedFiles(env, talk.file_url);
  const vid = await videoHtml(env, talk, L);
  const ind = talk.kind === KIND_IND, IL = IND_L[lang] || IND_L.he, typed = TYPED_KINDS.indexOf(talk.kind) >= 0;
  const quiz = ind ? [] : quizOf(talk, lang);
  const secs = ind || typed ? { intro: '', list: [] } : sectionsOf(x.body), sectioned = secs.list.length > 0;
  // Group mode only: who already signed, so the phone moves on to the next worker.
  const signed = g ? await signedIds(env, talk.id) : new Set();
  // A talk for one department lists its workers (10/10/2026); "not on the list" stays for anyone else,
  // and the signature still checks against the whole list, so a worker who moved can sign.
  const listed = talk.dept ? emps.filter((e) => deptMatch(talk.dept, e.dep)) : emps;
  const byDep = {};
  for (const e of (listed.length ? listed : emps)) { const d = e.dep || '\u05d0\u05d7\u05e8'; (byDep[d] = byDep[d] || []).push(e); }
  const opts = Object.keys(byDep).sort((a, b) => a.localeCompare(b, 'he')).map((d) =>
    '<optgroup label="' + esc(d) + '">' + byDep[d].map((e) => (signed.has(String(e.id)) ? '<option value="" disabled>\u2713 ' + esc(e.n) + ' (' + esc(L.signedL) + ')</option>' : '<option value="' + esc(e.id) + '" data-t="' + esc(tDeptOf(e.dep)) + '">' + esc(e.n) + '</option>')).join('') + '</optgroup>').join('');
  const avail = langsOf(talk);
  const bar = avail.length < 2 ? '' : '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px">' + avail.map((l) =>
    l === lang ? '<span style="padding:6px 12px;border-radius:16px;background:#1e3a8a;color:#fff;font-size:14px;font-weight:700">' + esc(LANGS[l].name) + '</span>'
      : '<a href="' + esc(talkUrl(tok, l, g)) + '" style="padding:6px 12px;border-radius:16px;border:1px solid #1e3a8a;color:#1e3a8a;font-size:14px;text-decoration:none">' + esc(LANGS[l].name) + '</a>').join('') + '</div>';
  const nonce = newId() + newId();
  const inner = bar
    + (ind ? '<div style="background:#eff6ff;border-radius:8px;padding:10px 12px;margin-bottom:10px"><div style="font-size:18px;font-weight:700;color:#1e3a8a">' + esc(IL.welcome) + '</div><div style="font-size:14px;color:#374151;margin-top:2px">' + esc(IL.vital) + '</div></div>' : '')
    + '<div style="font-size:13px;color:#6b7280">' + esc(fdate(talk.d)) + '</div>'
    + '<h2 id="th" style="margin:4px 0 12px;font-size:20px">' + esc(x.title) + '</h2>'
    + (g ? '<div style="font-size:14px;font-weight:700;color:#1e3a8a;background:#eff6ff;border-radius:6px;padding:6px 10px;margin-bottom:8px">\ud83d\udc65 ' + esc(L.group) + '</div>' : '')
    + (talk.trainer ? '<div style="font-size:14px;color:#374151;margin-bottom:10px">' + (talk.kind === KIND_IND ? esc(BY_L[lang] || BY_L.he) + ': ' + esc(talk.trainer) + (talk.trainer_qual ? ', ' + esc(talk.trainer_qual) : '') : esc(L.trainerL) + ': ' + esc(talk.trainer)) + '</div>' : '')
    + (L.auto ? '<div style="font-size:12px;color:#92400e;background:#fef3c7;border-radius:6px;padding:6px 10px;margin-bottom:10px">' + esc(L.auto) + '</div>' : '')
    + (x.body && !ind && !sectioned ? '<button type="button" id="say" style="display:none;margin:0 0 8px;padding:8px 16px;border:1px solid #1e3a8a;border-radius:8px;background:#eff6ff;color:#1e3a8a;font-size:16px;font-weight:700">\ud83d\udd0a ' + esc((SPEAK[lang] || SPEAK.he).listen) + '</button>'
      : '') + (sectioned ? (secs.intro ? '<div style="white-space:pre-wrap;background:#f9fafb;border-radius:8px;padding:12px;margin-bottom:12px">' + esc(secs.intro) + '</div>' : '')
        + '<label for="wdep" style="display:block;font-weight:700;margin-bottom:4px">' + esc(WDEP_L) + '</label><select name="wdep" id="wdep" form="f" required dir="rtl" style="width:100%;font-size:16px;padding:10px;border:2px solid #1e3a8a;border-radius:8px;margin-bottom:12px"><option value="">' + esc(WDEP_PICK) + '</option>' + secs.list.map((c) => '<option value="' + esc(c.dept) + '">' + esc(c.dept) + '</option>').join('') + '</select>'
        + secs.list.map((c) => '<div class="wsec" data-dep="' + esc(c.dept) + '" style="display:none;white-space:pre-wrap;background:#f9fafb;border-radius:8px;padding:12px;margin-bottom:12px">' + esc(c.text) + '</div>').join('')
      : x.body ? '<div id="tb" style="white-space:pre-wrap;background:#f9fafb;border-radius:8px;padding:12px;margin-bottom:12px">' + esc(x.body) + '</div>' : '')
    + vid
    + files.map((u, i) => '<p><a href="' + esc(u) + '" target="_blank" rel="noopener" style="color:#1e3a8a;font-weight:700">' + esc(L.file) + (files.length > 1 ? ' ' + (i + 1) : '') + '</a></p>').join('')
    + quizHtml(quiz, lang)
    + '<form id="f" method="POST" action="/api/talk" style="border-top:1px solid #e5e7eb;padding-top:12px;margin-top:8px">'
    + '<input type="hidden" name="k" value="' + esc(tok) + '">' + (g ? '<input type="hidden" name="g" value="1">' : '') + '<input type="hidden" name="l" value="' + lang + '"><input type="hidden" name="sig" id="sig"><input type="hidden" name="qa" id="qa">'
    // 13/10/2026 (Michael: "I don't want the list of existing workers, only the new worker being taken in"):
    // the induction asks for the new worker's name and ID only; "emp" is always "not on the list".
    + (ind || typed ? '<input type="hidden" name="emp" id="emp" value="' + OTHER + '"><label for="oname" style="display:block;font-weight:700;margin-bottom:4px">' + esc(L.oname) + '</label>'
      : '<label style="display:block;font-weight:700;margin-bottom:4px">' + esc(L.you) + '</label>'
    + '<select name="emp" id="emp" required dir="rtl" style="width:100%;font-size:16px;padding:10px;border:1px solid #d1d5db;border-radius:8px;margin-bottom:12px"><option value="">' + esc(L.pick) + '</option><option value="' + OTHER + '">' + esc(L.other) + '</option>' + opts + '</select>')
    // Not on the list: the name first, then the ID like everyone (review 03/10/2026: the ID came between the list and the name).
    + '<div id="obox" style="display:none;margin:-4px 0 12px"><input name="oname" id="oname" maxlength="60" autocomplete="off"' + (ind || typed ? ' required' : '') + ' placeholder="' + esc(L.oname) + '" style="width:100%;box-sizing:border-box;font-size:16px;padding:10px;border:1px solid #d1d5db;border-radius:8px;margin-bottom:8px">' + (ind || typed ? '' : '<input name="ocomp" maxlength="60" autocomplete="off" placeholder="' + esc(L.ocomp) + '" style="width:100%;box-sizing:border-box;font-size:16px;padding:10px;border:1px solid #d1d5db;border-radius:8px">') + '</div>'
    + '<label for="oid" style="display:block;font-weight:700;margin-bottom:4px">' + esc(L.oid) + '</label><input name="oid" id="oid" maxlength="20" autocomplete="off" dir="ltr" style="width:100%;box-sizing:border-box;font-size:16px;padding:10px;border:1px solid #d1d5db;border-radius:8px;margin-bottom:12px;text-align:right">'
    + (typed ? (() => { const st = 'width:100%;box-sizing:border-box;font-size:16px;padding:10px;border:1px solid #d1d5db;border-radius:8px;margin-bottom:12px';
      return '<label for="idep" style="display:block;font-weight:700;margin-bottom:4px">' + esc(IL.dep) + '</label><select name="idep" id="idep" required dir="rtl" style="' + st + '"><option value="">' + esc(IL.depPick) + '</option>' + TBT_DEPTS.map((d) => '<option value="' + esc(d[0]) + '">' + esc(d[0]) + '</option>').join('') + '<option value="' + esc(IND_OTHER_DEP) + '">' + esc(IL.depOther) + '</option></select>'
        + '<input name="idepo" id="idepo" maxlength="40" autocomplete="off" placeholder="' + esc(DEP_OTHER_PH) + '" style="' + st + ';display:none">'; })() : '')
    + (ind ? (() => { const st = 'width:100%;box-sizing:border-box;font-size:16px;padding:10px;border:1px solid #d1d5db;border-radius:8px;margin-bottom:12px', lb = (f, t) => '<label for="' + f + '" style="display:block;font-weight:700;margin-bottom:4px">' + esc(t) + '</label>';
      return lb('ino', IL.empNo) + '<input name="ino" id="ino" maxlength="12" inputmode="numeric" autocomplete="off" dir="ltr" style="' + st + ';text-align:right">'
        + lb('idep', IL.dep) + '<select name="idep" id="idep" required dir="rtl" style="' + st + '"><option value="">' + esc(IL.depPick) + '</option>' + TBT_DEPTS.map((d) => '<option value="' + esc(d[0]) + '">' + esc(d[0]) + '</option>').join('') + '<option value="' + esc(IND_OTHER_DEP) + '">' + esc(IL.depOther) + '</option></select>'
        + lb('iph', IL.phone) + '<input name="iph" id="iph" type="tel" maxlength="20" required autocomplete="off" dir="ltr" style="' + st + ';text-align:right">'
        + lb('ijob', IL.job) + '<input name="ijob" id="ijob" maxlength="60" required autocomplete="off" style="' + st + '">'
        + lb('iagn', IL.agName) + '<input name="iagn" id="iagn" maxlength="60" autocomplete="off" style="' + st + '">'; })() : '')
    + (ind ? '<div style="font-weight:700;margin-bottom:4px">\u05e6\u05d9\u05dc\u05d5\u05dd \u05de\u05e1\u05de\u05db\u05d9\u05dd (\u05dc\u05e9\u05d9\u05de\u05d5\u05e9 \u05de\u05e9\u05d0\u05d1\u05d9 \u05d0\u05e0\u05d5\u05e9, \u05d0\u05e4\u05e9\u05e8 \u05db\u05de\u05d4, \u05dc\u05d0 \u05d7\u05d5\u05d1\u05d4)</div><div id="dbox" style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:8px"></div>'
      // A <label> opens the picker natively: in-app browsers (WhatsApp, Gmail) and some phones ignore a
      // script click on a hidden input (13/10/2026, Michael: "it does not let me open the camera").
      // The second label has no capture: the gallery, or the camera from the phone's own menu.
      + '<label id="dadd" style="display:block;width:100%;box-sizing:border-box;text-align:center;padding:12px;margin-bottom:6px;border:2px solid #1e3a8a;border-radius:8px;background:#eff6ff;color:#1e3a8a;font-size:17px;font-weight:700;cursor:pointer"><input type="file" id="dfile" accept="image/*" capture="environment" style="position:absolute;width:1px;height:1px;opacity:0;overflow:hidden">\ud83d\udcf7 \u05e6\u05dc\u05dd \u05de\u05e1\u05de\u05da</label>'
      + '<label id="dgal" style="display:block;width:100%;box-sizing:border-box;text-align:center;padding:12px;margin-bottom:6px;border:1px solid #1e3a8a;border-radius:8px;background:#eff6ff;color:#1e3a8a;font-size:15px;font-weight:700;cursor:pointer"><input type="file" id="dfile2" accept="image/*" style="position:absolute;width:1px;height:1px;opacity:0;overflow:hidden">\u05d0\u05d5 \u05d1\u05d7\u05e8 \u05ea\u05de\u05d5\u05e0\u05d4 \u05de\u05d4\u05d8\u05dc\u05e4\u05d5\u05df</label>'
      + '<div id="dcnt" style="font-size:13px;color:#374151;margin-bottom:12px"></div>' : '')
    + '<label style="display:flex;gap:8px;align-items:center;margin-bottom:12px"><input type="checkbox" name="ok" value="1" required style="width:22px;height:22px;flex:none">' + esc(typed && lang === 'he' ? ANN_OK : L.ok) + '</label>'
    + '<div style="font-weight:700;margin-bottom:4px">' + esc(L.sig) + '</div>'
    + '<canvas id="pad" style="width:100%;height:180px;border:2px dashed #9ca3af;border-radius:8px;touch-action:none;background:#fff"></canvas>'
    + '<button type="button" id="clr" style="margin:6px 0 14px;padding:6px 14px;border:1px solid #d1d5db;border-radius:8px;background:#fff;font-size:14px">' + esc(L.clear) + '</button>'
    + '<button type="submit" id="go" style="display:block;width:100%;padding:14px;border:0;border-radius:10px;background:#15803d;color:#fff;font-size:18px;font-weight:700">' + esc(L.send) + '</button>'
    + '</form>'
    + (g ? '<p style="border-top:1px solid #e5e7eb;margin-top:16px;padding-top:12px" dir="rtl"><a href="' + esc(talkUrl(tok, 'he', true, true)) + '" style="color:#1e3a8a;font-weight:700">' + (talk.trainer_signed_at ? '\u2713 \u05d4\u05de\u05d3\u05e8\u05d9\u05da \u05d7\u05ea\u05dd \u05e2\u05dc \u05e1\u05d9\u05d5\u05dd \u05d4\u05d4\u05d3\u05e8\u05db\u05d4' : '\u270d\ufe0f \u05e1\u05d9\u05d5\u05dd \u05d4\u05d4\u05d3\u05e8\u05db\u05d4: \u05d7\u05ea\u05d9\u05de\u05ea \u05d4\u05de\u05d3\u05e8\u05d9\u05da') + '</a></p>' : '')
    + '<script nonce="' + nonce + '">' + sigScript(L) + '</script>'
    + (quiz.length ? '<script nonce="' + nonce + '">' + quizScript(quiz, lang) + '</script>' : '')
    // The camera inside the page (13/10/2026, Michael on a Chrome tablet: the gallery opens, the
    // camera does not): getUserMedia, shutter and done. No mediaDevices = the label opens the file input.
    // Blocked (13/10/2026, the tablet said "blocked" without asking): the site permission or the
    // device's own camera switch, told apart with permissions.query, and a camera busy in another app.
    + (ind ? '<script nonce="' + nonce + '">(function(){var b=document.getElementById("dadd"),f=document.getElementById("dfile"),f2=document.getElementById("dfile2"),g2=document.getElementById("dgal"),box=document.getElementById("dbox"),c=document.getElementById("dcnt");if(!b||!f||!f2||!g2||!box)return;var cnt=function(){var n=box.children.length;c.textContent=n?"\u05e6\u05d5\u05dc\u05de\u05d5 "+n+" \u05de\u05e1\u05de\u05db\u05d9\u05dd":"";};var full=function(){if(box.children.length>=' + MAX_DOCS + '){alert("\u05d0\u05e4\u05e9\u05e8 \u05e2\u05d3 ' + MAX_DOCS + ' \u05de\u05e1\u05de\u05db\u05d9\u05dd");return true;}return false;};var add=function(src){var img=new Image();img.onload=function(){var k=Math.min(1,1400/Math.max(img.width,img.height)),cv=document.createElement("canvas");cv.width=Math.round(img.width*k);cv.height=Math.round(img.height*k);cv.getContext("2d").drawImage(img,0,0,cv.width,cv.height);var d=cv.toDataURL("image/jpeg",0.7),w=document.createElement("div"),im=document.createElement("img"),h=document.createElement("input"),x=document.createElement("button");w.style.cssText="position:relative";im.src=d;im.style.cssText="height:90px;border:1px solid #9ca3af;border-radius:6px";h.type="hidden";h.name="doc";h.value=d;x.type="button";x.textContent="\u05d4\u05e1\u05e8";x.style.cssText="display:block;margin-top:2px;width:100%;padding:4px;font-size:13px;border:1px solid #d1d5db;border-radius:6px;background:#fff";x.addEventListener("click",function(){w.remove();cnt();});w.appendChild(im);w.appendChild(h);w.appendChild(x);box.appendChild(w);cnt();};img.onerror=function(){alert("\u05dc\u05d0 \u05d4\u05e6\u05dc\u05d7\u05ea\u05d9 \u05dc\u05e7\u05e8\u05d5\u05d0 \u05d0\u05ea \u05d4\u05ea\u05de\u05d5\u05e0\u05d4");};img.src=src;};var onf=function(){var fl=this.files&&this.files[0];this.value="";if(!fl)return;var r=new FileReader();r.onload=function(){add(r.result);};r.readAsDataURL(fl);};f.addEventListener("change",onf);f2.addEventListener("change",onf);g2.addEventListener("click",function(e){if(full())e.preventDefault();});var md=navigator.mediaDevices;var mk=function(t,bg,fg){var x=document.createElement("button");x.type="button";x.textContent=t;x.style.cssText="flex:1;padding:14px;font-size:18px;font-weight:700;border:2px solid #fff;border-radius:8px;background:"+bg+";color:"+fg;return x;};var openCam=function(){var ov=document.createElement("div"),v=document.createElement("video"),bar=document.createElement("div"),msg=document.createElement("div"),shot=mk("\u05e6\u05dc\u05dd","#1e3a8a","#fff"),done=mk("\u05e1\u05d9\u05d5\u05dd","#fff","#111"),stream=null;ov.id="camov";ov.style.cssText="position:fixed;top:0;left:0;right:0;bottom:0;z-index:99;background:#000;display:flex;flex-direction:column";v.setAttribute("playsinline","");v.muted=true;v.autoplay=true;v.style.cssText="flex:1;width:100%;min-height:0;object-fit:contain;background:#000";msg.id="cammsg";msg.style.cssText="color:#fff;padding:8px 12px;font-size:16px;text-align:center;min-height:22px";bar.style.cssText="display:flex;gap:10px;padding:12px";shot.id="camshot";done.id="camdone";shot.disabled=true;bar.appendChild(shot);bar.appendChild(done);ov.appendChild(v);ov.appendChild(msg);ov.appendChild(bar);document.body.appendChild(ov);var stop=function(){if(stream)stream.getTracks().forEach(function(t){t.stop();});ov.remove();};done.addEventListener("click",stop);shot.addEventListener("click",function(){if(full()){stop();return;}var w=v.videoWidth,h=v.videoHeight;if(!w||!h)return;var cv=document.createElement("canvas");cv.width=w;cv.height=h;cv.getContext("2d").drawImage(v,0,0,w,h);add(cv.toDataURL("image/jpeg",0.9));msg.textContent="\u05e6\u05d5\u05dc\u05dd. \u05d0\u05e4\u05e9\u05e8 \u05dc\u05e6\u05dc\u05dd \u05e2\u05d5\u05d3 \u05de\u05e1\u05de\u05da, \u05d0\u05d5 \u05e1\u05d9\u05d5\u05dd";});md.getUserMedia({video:{facingMode:{ideal:"environment"},width:{ideal:1920},height:{ideal:1080}},audio:false}).then(function(s){stream=s;v.srcObject=s;var p=v.play();if(p&&p.catch)p.catch(function(){});shot.disabled=false;msg.textContent="\u05dc\u05db\u05d5\u05d5\u05df \u05d0\u05ea \u05d4\u05de\u05e1\u05de\u05da \u05d5\u05dc\u05dc\u05d7\u05d5\u05e5 \u05e6\u05dc\u05dd";}).catch(function(err){shot.style.display="none";var n=err&&err.name,say=function(t){msg.textContent=t+" \u05d1\u05d9\u05e0\u05ea\u05d9\u05d9\u05dd \u05d0\u05e4\u05e9\u05e8 \u05dc\u05d1\u05d7\u05d5\u05e8 \u05ea\u05de\u05d5\u05e0\u05d4 \u05de\u05d4\u05d8\u05dc\u05e4\u05d5\u05df (\u05d4\u05db\u05e4\u05ea\u05d5\u05e8 \u05d4\u05e9\u05e0\u05d9).";};if(n==="NotReadableError"||n==="AbortError"){say("\u05d4\u05de\u05e6\u05dc\u05de\u05d4 \u05ea\u05e4\u05d5\u05e1\u05d4 \u05d1\u05d0\u05e4\u05dc\u05d9\u05e7\u05e6\u05d9\u05d4 \u05d0\u05d7\u05e8\u05ea. \u05dc\u05e1\u05d2\u05d5\u05e8 \u05d0\u05d5\u05ea\u05d4 \u05d5\u05dc\u05e0\u05e1\u05d5\u05ea \u05e9\u05d5\u05d1.");return;}if(n==="NotFoundError"||n==="OverconstrainedError"){say("\u05dc\u05d0 \u05e0\u05de\u05e6\u05d0\u05d4 \u05de\u05e6\u05dc\u05de\u05d4 \u05d1\u05de\u05db\u05e9\u05d9\u05e8.");return;}if(n!=="NotAllowedError"){say("\u05dc\u05d0 \u05d4\u05e6\u05dc\u05d7\u05ea\u05d9 \u05dc\u05e4\u05ea\u05d5\u05d7 \u05d0\u05ea \u05d4\u05de\u05e6\u05dc\u05de\u05d4.");return;}var site="\u05d4\u05d0\u05ea\u05e8 \u05d7\u05e1\u05d5\u05dd \u05d1\u05de\u05e6\u05dc\u05de\u05d4. \u05dc\u05dc\u05d7\u05d5\u05e5 \u05e2\u05dc \u05d4\u05e1\u05de\u05dc \u05e9\u05de\u05e9\u05de\u05d0\u05dc \u05dc\u05db\u05ea\u05d5\u05d1\u05ea, \u05d4\u05e8\u05e9\u05d0\u05d5\u05ea, \u05de\u05e6\u05dc\u05de\u05d4, \u05dc\u05d0\u05e4\u05e9\u05e8, \u05d5\u05dc\u05e8\u05e2\u05e0\u05df \u05d0\u05ea \u05d4\u05d3\u05e3.",os="\u05d4\u05de\u05e6\u05dc\u05de\u05d4 \u05db\u05d1\u05d5\u05d9\u05d4 \u05d1\u05d4\u05d2\u05d3\u05e8\u05d5\u05ea \u05d4\u05de\u05db\u05e9\u05d9\u05e8. \u05d1\u05d4\u05d2\u05d3\u05e8\u05d5\u05ea: \u05e4\u05e8\u05d8\u05d9\u05d5\u05ea, \u05d2\u05d9\u05e9\u05d4 \u05dc\u05de\u05e6\u05dc\u05de\u05d4, \u05dc\u05d4\u05e4\u05e2\u05d9\u05dc. \u05dc\u05d1\u05d3\u05d5\u05e7 \u05d2\u05dd \u05de\u05ea\u05d2 \u05d0\u05d5 \u05de\u05e7\u05e9 \u05de\u05e6\u05dc\u05de\u05d4. \u05d0\u05d7\u05e8 \u05db\u05da \u05dc\u05e8\u05e2\u05e0\u05df \u05d0\u05ea \u05d4\u05d3\u05e3.";if(!navigator.permissions||!navigator.permissions.query){say(site);return;}navigator.permissions.query({name:"camera"}).then(function(r){say(r.state==="denied"?site:os);},function(){say(site);});});};b.addEventListener("click",function(e){if(full()){e.preventDefault();return;}if(!md||!md.getUserMedia)return;e.preventDefault();openCam();});})();</script>' : '')
    + (typed ? '<script nonce="' + nonce + '">(function(){var s=document.getElementById("idep"),o=document.getElementById("idepo");if(!s||!o)return;var f=function(){var on=s.value===' + JSON.stringify(IND_OTHER_DEP) + ';o.style.display=on?"block":"none";o.required=on;};s.addEventListener("change",f);f();})();</script>' : '')
    + (ind ? '<script nonce="' + nonce + '">(function(){var n=document.getElementById("iagn"),o=document.getElementById("ino"),f=function(){o.required=!n.value.trim();};n.addEventListener("input",f);f();})();</script>' : '')
    + (sectioned ? '<script nonce="' + nonce + '">(function(){var s=document.getElementById("wdep"),e=document.getElementById("emp");if(!s)return;var f=function(){var v=s.value;Array.prototype.forEach.call(document.querySelectorAll(".wsec"),function(d){d.style.display=d.getAttribute("data-dep")===v?"block":"none";});if(e)Array.prototype.forEach.call(e.querySelectorAll("option[data-t]"),function(o){o.hidden=!!v&&o.getAttribute("data-t")!==v;});};s.addEventListener("change",f);f();})();</script>' : '')
    + (x.body && !ind && !sectioned ? '<script nonce="' + nonce + '">' + PLAYER + '</script><script nonce="' + nonce + '">' + speakScript(lang, speechText(x.title, x.body)) + '</script>' : '');
  return page(talk.kind === KIND_IND ? L.indT : typed ? x.title : L.title, inner, '', 200, nonce, lang);
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

// Storage answers an existing name with 409, or (older versions) with 400 and
// statusCode "409" / error "Duplicate" in the body.
async function isDuplicate(r) {
  if (r.status === 409) return true;
  if (r.status !== 400) return false;
  const t = await r.text().catch(() => '');
  return /"409"|Duplicate|already exists/i.test(t);
}

async function signTalk(env, request, ctx) {
  let form;
  try { form = await request.formData(); } catch (e) { return errPage('\u05d4\u05d8\u05d5\u05e4\u05e1 \u05dc\u05d0 \u05e0\u05e7\u05e8\u05d0. \u05e0\u05e1\u05d4 \u05e9\u05d5\u05d1.'); }
  if (form.has('icode')) return codeSubmit(env, form, request);
  const tok = String(form.get('k') || '');
  const g = String(form.get('g') || '') === '1';
  const t = await readTok(env, tok, g);
  if (t.error === 'expired') return errL('expired', form.get('l'), 410);
  if (t.error) return errL('badLink', form.get('l'), 403);
  const lang = langOf(String(form.get('l') || '')), L = LANGS[lang];
  const back = '<p><a href="' + esc(talkUrl(tok, lang, g)) + '" style="color:#1e3a8a;font-weight:700">' + esc(L.back) + '</a></p>';
  const bad = (t, m, st) => page(L[t], '<p>' + esc(L[m]) + '</p>' + back, 'err', st || 400, '', lang);
  const talk0 = g && String(form.get('t') || '') === '1' ? await getTalk(env, t.id) : null;
  if (talk0) return talk0.s === S_PUB ? signTrainer(env, form, tok, talk0) : errL('unpub', 'he', 404);
  if (String(form.get('ok') || '') !== '1') return bad('errOkT', 'errOk');
  const talk = await getTalk(env, t.id);
  if (!talk || talk.s !== S_PUB) return errL('unpub', lang, 404);
  if (!permOk(t, talk)) return errL('badLink', lang, 403);
  const gate = await codeGate(env, talk, request.headers.get('cookie'));
  if (!gate.ok) return codePage(tok, lang, false, !!gate.closed);
  // The induction is for a new worker only (13/10/2026): never a worker from the list.
  const typed = TYPED_KINDS.indexOf(talk.kind) >= 0;
  const empId = talk.kind === KIND_IND || typed ? OTHER : String(form.get('emp') || '');
  const sig = sigBytes(form.get('sig'));
  // Michael, 03/10/2026: "an ID is always needed", for a worker on the list too.
  const oid = idOf(form.get('oid'));
  let emp;
  if (empId === OTHER) {
    const raw = oneLine(form.get('oname')), comp = oneLine(form.get('ocomp'));
    if (raw.length < 2) return bad('errNameT', 'oNeed');
    if (!oid) return bad('errNameT', 'oIdNeed');
    if (!sig) return bad('errSigT', 'errSig');
    const n = await nameHe(env, request, raw), dep = comp ? await nameHe(env, request, comp) : null;
    if (!n || (comp && !dep)) return bad('errNameT', 'errHe', 422);
    emp = { id: 'x:' + oid + ':' + raw.toLowerCase(), key: 'x:' + oid + ':', n, dep, out: true };
    // Annual / quality: the department picked from the list, or typed under "other" (14/10/2026).
    if (typed) {
      const pick = oneLine(form.get('idep')), deps = TBT_DEPTS.map((x) => x[0]);
      const typedDep = pick === IND_OTHER_DEP ? oneLine(form.get('idepo')).substring(0, 40) : '';
      if (deps.indexOf(pick) < 0 && !(pick === IND_OTHER_DEP && typedDep.length >= 2)) return page((IND_L[lang] || IND_L.he).errT, '<p>' + esc((IND_L[lang] || IND_L.he).needDep) + '</p>' + back, 'err', 400, '', lang);
      emp.dep = pick === IND_OTHER_DEP ? ((await nameHe(env, request, typedDep)) || typedDep) : pick;
    }
  } else {
    const emps = await getEmps(env);
    emp = emps.find((e) => String(e.id) === empId);
    if (!emp) return bad('errNameT', 'errName');
    if (!oid) return bad('errNameT', 'oIdNeed');
    // An ID on the employee card must match: no signing in another worker's name.
    const onCard = idOf(emp.eid);
    if (onCard && onCard !== oid) return bad('errNameT', 'idMismatch', 403);
    // Regulation 6 as amended (in force 16/10/2026): an ID for every participant, already typed by
    // everyone (03/10/2026). Michael, 09/10/2026: a card with no ID gets the typed number, unless
    // that number is on another worker's card (no signing in their name).
    if (!onCard) {
      if (emps.some((e) => e !== emp && idOf(e.eid) === oid)) return bad('errNameT', 'idMismatch', 403);
      emp = { ...emp, fill: true };
    }
  }
  if (!sig) return bad('errSigT', 'errSig');
  // The shared weekly talk: the department picked must be one of its sections, and it goes on the row.
  const wsecs = typed || talk.kind === KIND_IND ? [] : sectionsOf(textOf(talk, lang).body).list.map((c) => c.dept);
  const wdep = wsecs.length ? oneLine(form.get('wdep')) : '';
  if (wsecs.length && wsecs.indexOf(wdep) < 0) return page((IND_L[lang] || IND_L.he).errT, '<p>' + esc((IND_L[lang] || IND_L.he).needDep) + '</p>' + back, 'err', 400, '', lang);
  let indV = null;
  if (talk.kind === KIND_IND) {
    const IL = IND_L[lang] || IND_L.he, f = indFields(form);
    if (!f.ok) return page(IL.errT, '<p>' + esc(IL[f.err]) + '</p>' + back, 'err', 400, '', lang);
    const job = await nameHe(env, request, f.v.job), agency = f.v.agency ? await nameHe(env, request, f.v.agency) : null;
    if (!job || (f.v.agency && !agency)) return bad('errNameT', 'errHe', 422);
    indV = { ...f.v, job, agency };
  }

  const who = emp.out ? '&emp_id=like.' + encodeURIComponent(emp.key + '*') : '&emp_id=eq.' + encodeURIComponent(emp.id);
  const done = (name) => page(L.thanks + ', ' + name, '<p>' + esc(L.already) + '</p>' + back, 'ok', 200, '', lang);
  const dup = await fetch(SB + '/rest/v1/toolbox_reads?talk_id=eq.' + encodeURIComponent(talk.id) + who + '&select=id', { headers: sbH(env) });
  if (dup.ok) { const rows = await dup.json(); if (Array.isArray(rows) && rows.length) return done(emp.n); }
  if (emp.out) {
    const outs = await fetch(SB + '/rest/v1/toolbox_reads?talk_id=eq.' + encodeURIComponent(talk.id) + '&emp_id=like.' + encodeURIComponent('x:*') + '&select=id', { headers: sbH(env) });
    if (!outs.ok) return bad('errSaveT', 'errSave', 502);
    const n = await outs.json();
    if (Array.isArray(n) && n.length >= (typed ? MAX_OUT_TYPED : MAX_OUT)) return bad('errSaveT', 'full', 429);
  }

  // One file name per worker and talk, uploaded without upsert: of two sends at
  // the same moment the second is refused by Storage before its insert, so no
  // orphan file (checker finding 8, 03/10/2026). A file with no row (an earlier
  // insert that failed, or a row removed in the app) is overwritten once.
  const id = newId();
  // A typed name can be any script: its file name is a hash of the name, the same for the same name.
  const tag = emp.out ? 'x' + Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(emp.key)))).slice(0, 8).map((b) => b.toString(16).padStart(2, '0')).join('') : String(emp.id).replace(/[^A-Za-z0-9_-]/g, '');
  const name = 'sig-' + talk.id + '-' + tag + '.png';
  const upload = (upsert) => fetch(SB + '/storage/v1/object/' + BUCKET + '/' + name, { method: 'POST', headers: sbH(env, { 'Content-Type': 'image/png', 'x-upsert': upsert }), body: sig });
  let up = await upload('false');
  if (!up.ok && await isDuplicate(up)) {
    const again = await fetch(SB + '/rest/v1/toolbox_reads?talk_id=eq.' + encodeURIComponent(talk.id) + who + '&select=id', { headers: sbH(env) });
    if (!again.ok) return bad('errSaveT', 'errSave', 502);
    const rows = await again.json();
    if (Array.isArray(rows) && rows.length) return done(emp.n);
    up = await upload('true');
  }
  if (!up.ok) return bad('errSaveT', 'errSave', 502);
  const row = {
    id, talk_id: talk.id, emp_id: String(emp.id), emp_name: emp.n, id_no: oid, dept: wdep || emp.dep || null, lang: textOf(talk, lang).lang, text_hash: await textHash(talk, lang),
    sig_url: SB + '/storage/v1/object/public/' + BUCKET + '/' + name,
    device: deviceOf(request.headers.get('user-agent')), read_at: new Date().toISOString(), mode: g ? 'group' : 'link',
  };
  if (indV) Object.assign(row, indV);
  const qs = indV ? null : quizScore(quizOf(talk, textOf(talk, lang).lang), form.get('qa'));
  if (qs) { row.quiz_ok = qs.ok; row.quiz_n = qs.n; }
  const ins = await fetch(SB + '/rest/v1/toolbox_reads', { method: 'POST', headers: sbH(env, { 'Content-Type': 'application/json', Prefer: 'return=minimal' }), body: JSON.stringify(row) });
  if (ins.status === 409) return done(emp.n);
  if (!ins.ok) return bad('errSaveT', 'errSave', 502);
  // Induction: file the signed form and mail it, after the worker already sees "saved".
  if (talk.kind === KIND_IND) {
    const job = fileInduction(env, talk, row, sig, lang, undefined, [], docsOf(form.getAll('doc')));
    if (ctx && typeof ctx.waitUntil === 'function') ctx.waitUntil(job); else await job;
  }
  // The typed number onto the card, only while the card is still empty (never over a number
  // the manager wrote). A failed write costs the card, not the signature.
  if (emp.fill) {
    try { await fetch(SB + '/rest/v1/emp?id=eq.' + encodeURIComponent(emp.id) + '&or=(eid.is.null,eid.eq.)', { method: 'PATCH', headers: sbH(env, { 'Content-Type': 'application/json', Prefer: 'return=minimal' }), body: JSON.stringify({ eid: oid }) }); } catch (e) { /* the signature is saved */ }
  }
  return page(L.thanks + ', ' + emp.n, '<p>' + esc(L.saved) + '</p><p style="color:#6b7280;font-size:14px">' + esc(textOf(talk, lang).title) + '</p>'
    + '<p><a href="' + esc(talkUrl(tok, lang, g)) + '" style="display:block;text-align:center;padding:12px;border-radius:10px;background:#1e3a8a;color:#fff;font-weight:700;text-decoration:none">' + esc(L.next) + '</a></p>', 'ok', 200, '', lang);
}

async function makeLink(env, request, ctx) {
  const allowed = defaultAllowedOrigins(env);
  const cors = corsHeaders(request.headers.get('origin') || '', allowed, 'POST,OPTIONS');
  if (!isAllowedCaller(request, allowed)) return jsonResp({ error: 'origin not allowed' }, 403, cors);
  const who = await requireRole(request, env, ['admin', 'manager']);
  if (!who.ok) return jsonResp({ error: who.error }, who.status || 401, cors);
  let b = {};
  try { b = await request.json(); } catch (e) { b = {}; }
  // The manager hears the talk before publishing it (10/10/2026): the text from the form, unsaved.
  if (b && b.op === 'say') {
    const lang = langOf(b.lang), text = speechText(b.title, b.body);
    if (!text) return jsonResp({ error: 'empty' }, 400, cors);
    return sayStream(env, text, lang, ctx, cors);
  }
  // Form 08.01 with everyone who signed (14/10/2026): any kind, published or closed.
  if (b && b.op === 'form0801') {
    const r = await fetch(SB + '/rest/v1/toolbox_talks?id=eq.' + encodeURIComponent(String(b.id || '')) + '&select=*', { headers: sbH(env) });
    const t = r.ok ? ((await r.json()) || [])[0] : null;
    if (!t) return jsonResp({ error: 'not found' }, 404, cors);
    const rr = await fetch(SB + '/rest/v1/toolbox_reads?talk_id=eq.' + encodeURIComponent(t.id) + '&select=id,emp_name,dept,id_no,sig_url,read_at&order=read_at.asc', { headers: sbH(env) });
    const reads = rr.ok ? await rr.json() : null;
    if (!Array.isArray(reads)) return jsonResp({ error: 'reads' }, 502, cors);
    // Preview (14/10/2026, Michael: "see the form before publishing"): the same HTML, nothing filed or mailed,
    // also before anyone signed; the signatures there are, and the trainer's.
    if (b.preview === true) {
      const sigs = {};
      for (const x of reads) sigs[x.id] = await storageB64(env, x.sig_url);
      const trSig = t.trainer_sig_url ? await storageB64(env, t.trainer_sig_url) : null;
      return jsonResp({ ok: true, preview: true, n: reads.length, html: form0801Html(t, reads, (x) => sigs[x.id], trSig) }, 200, cors);
    }
    if (!reads.length) return jsonResp({ error: 'no signatures yet' }, 409, cors);
    try { return jsonResp(Object.assign({ ok: true }, await file0801(env, t, reads)), 200, cors); }
    catch (e) { return jsonResp({ ok: false, error: String((e && e.message) || e).substring(0, 160) }, 502, cors); }
  }
  if (!b || (b.op !== 'link' && b.op !== 'group' && b.op !== 'revoke')) return jsonResp({ error: 'unknown op' }, 400, cors);
  const talk = await getTalk(env, String(b.id || ''));
  if (!talk) return jsonResp({ error: 'not found' }, 404, cors);
  if (talk.s !== S_PUB) return jsonResp({ error: 'not published' }, 409, cors);
  // Annual / quality (14/10/2026, Michael: "the trainer signs the training and the effectiveness check, and the
  // kinds of training are ticked, before the form opens"): no link until both are there.
  if (TYPED_KINDS.indexOf(talk.kind) >= 0 && b.op !== 'revoke' && (!talk.trainer_signed_at || !String(talk.subjects || '').trim())) return jsonResp({ error: 'incomplete' }, 409, cors);
  // Group: for the phone in the manager's hand, one day; the shared link's expiry (link_at) is untouched.
  if (b.op === 'group') {
    const gt = await makeGroupToken(env, talk.id);
    if (!gt) return jsonResp({ error: 'not configured' }, 503, cors);
    return jsonResp({ url: talkUrl(gt, 'he', true), days: GROUP_TTL_DAYS }, 200, cors);
  }
  // Induction: the permanent link; "revoke" raises link_v first, so the old link and QR stop.
  if (PERM_KINDS.indexOf(talk.kind) >= 0) {
    let v = talk.link_v || 0;
    if (b.op === 'revoke') {
      v += 1;
      const p = await fetch(SB + '/rest/v1/toolbox_talks?id=eq.' + encodeURIComponent(talk.id), { method: 'PATCH', headers: sbH(env, { 'Content-Type': 'application/json', Prefer: 'return=minimal' }), body: JSON.stringify({ link_v: v }) });
      if (!p.ok) return jsonResp({ error: 'revoke failed' }, 502, cors);
    }
    const pt = await makePermToken(env, talk.id, v);
    if (!pt) return jsonResp({ error: 'not configured' }, 503, cors);
    return jsonResp({ url: talkUrl(pt), perm: true, link_v: v }, 200, cors);
  }
  if (b.op === 'revoke') return jsonResp({ error: 'not a permanent-link talk' }, 409, cors);
  const tok = await makeTalkToken(env, talk.id);
  if (!tok) return jsonResp({ error: 'not configured' }, 503, cors);
  // When the newest link runs out (03/10/2026, Michael chose a column): the weekly
  // mail warns before it does. A failed write costs the reminder, not the link.
  const at = new Date().toISOString();
  let saved = false;
  try {
    const p = await fetch(SB + '/rest/v1/toolbox_talks?id=eq.' + encodeURIComponent(talk.id), { method: 'PATCH', headers: sbH(env, { 'Content-Type': 'application/json', Prefer: 'return=minimal' }), body: JSON.stringify({ link_at: at }) });
    saved = p.ok;
  } catch (e) { saved = false; }
  return jsonResp({ url: talkUrl(tok), days: TALK_TTL_DAYS, link_at: saved ? at : null }, 200, cors);
}

export async function onRequest(context) {
  const { request, env } = context;
  try {
    if (request.method === 'OPTIONS') {
      const allowed = defaultAllowedOrigins(env);
      return new Response(null, { headers: corsHeaders(request.headers.get('origin') || '', allowed, 'POST,OPTIONS') });
    }
    if (!env.SUPABASE_SERVICE_ROLE_KEY) return errPage('\u05d4\u05e9\u05e8\u05ea \u05dc\u05d0 \u05de\u05d5\u05d2\u05d3\u05e8.', 500);
    if (request.method === 'GET') {
      const q = new URL(request.url).searchParams;
      if (q.get('op') === 'say') return await sayTalk(env, q.get('k') || '', q.get('l') || '', q.get('g') === '1', context, request.headers.get('cookie'));
      if (q.get('op') === 'player') return new Response(PLAYER, { headers: { 'Content-Type': 'application/javascript; charset=utf-8', 'Cache-Control': 'public, max-age=3600', 'X-Content-Type-Options': 'nosniff' } });
      return await showTalk(env, q.get('k') || '', q.get('l') || '', q.get('g') === '1', q.get('t') === '1', request.headers.get('cookie'));
    }
    if (request.method !== 'POST') return errPage('\u05e4\u05e2\u05d5\u05dc\u05d4 \u05dc\u05d0 \u05e0\u05ea\u05de\u05db\u05ea.', 405);
    if (/application\/json/i.test(request.headers.get('content-type') || '')) return await makeLink(env, request, context);
    return await signTalk(env, request, context);
  } catch (e) {
    return errPage('\u05ea\u05e7\u05dc\u05d4 \u05d6\u05de\u05e0\u05d9\u05ea. \u05e0\u05e1\u05d4 \u05e9\u05d5\u05d1 \u05d1\u05e2\u05d5\u05d3 \u05d3\u05e7\u05d4.', 500);
  }
}
