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
import { defaultAllowedOrigins, corsHeaders, jsonResp, isAllowedCaller, requireRole } from '../_shared.js';
import { makeLinkToken, readLinkToken } from '../_closelink.js';
import { hebrewName } from '../_ai.js';
import { accessToken, putFile, sendMailTo } from '../_onedrive.js';

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

// Read aloud (10/10/2026, Michael: "מאשר המלצות"): the phone's own voices (speechSynthesis),
// nothing installed and nothing sent anywhere. The button shows only when the phone has a voice
// in the page's language; many have Hebrew, Arabic and Russian, few have Amharic.
export const SPEAK = {
  he: { listen: '\u05d4\u05e7\u05e8\u05d0 \u05d1\u05e7\u05d5\u05dc', stop: '\u05e2\u05e6\u05d5\u05e8', tag: ['he', 'iw'] },
  ar: { listen: '\u0627\u0633\u062a\u0645\u0639', stop: '\u0625\u064a\u0642\u0627\u0641', tag: ['ar'] },
  ru: { listen: '\u041f\u0440\u043e\u0441\u043b\u0443\u0448\u0430\u0442\u044c', stop: '\u0421\u0442\u043e\u043f', tag: ['ru'] },
  am: { listen: '\u12a0\u12f3\u121d\u1325', stop: '\u12a0\u1241\u121d', tag: ['am'] },
};
export const speakScript = (lang) => `(function(){
  var b=document.getElementById('say'),t=document.getElementById('tb'),h=document.getElementById('th'),S=window.speechSynthesis;
  if(!b||!t||!S||typeof SpeechSynthesisUtterance==='undefined')return;
  var W=${JSON.stringify(SPEAK[lang] || SPEAK.he)},v=null,on=false;
  function pick(){var vs=S.getVoices()||[];v=null;for(var i=0;i<vs.length&&!v;i++){var l=String(vs[i].lang||'').toLowerCase();for(var k=0;k<W.tag.length;k++)if(l.indexOf(W.tag[k])===0){v=vs[i];break;}}b.style.display=v?'':'none';}
  pick();if(S.addEventListener)S.addEventListener('voiceschanged',pick);
  function idle(){on=false;b.textContent='\\ud83d\\udd0a '+W.listen;}
  b.addEventListener('click',function(){
    if(on){S.cancel();idle();return;}
    var u=new SpeechSynthesisUtterance(((h&&h.textContent)||'')+'. '+t.textContent);u.voice=v;u.lang=v.lang;u.rate=0.95;
    u.onend=idle;u.onerror=idle;S.cancel();S.speak(u);on=true;b.textContent='\\u23f9 '+W.stop;
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
// The training departments and the employee-card names that belong to each (index.html _TBT_DEPTS).
export const TBT_DEPTS = [["\u05d8\u05d5\u05d2\u05e0\u05d9\u05dd", ["\u05d9\u05e6\u05d5\u05e8"]], ["\u05de\u05e2\u05d5\u05e6\u05d1\u05d9\u05dd", ["\u05d8\u05d1\u05e2 (\u05de\u05e2\u05e6\u05d1\u05d9\u05dd)"]], ["\u05d0\u05e8\u05d9\u05d6\u05d4", ["\u05d0\u05e8\u05d9\u05d6\u05d4"]], ["\u05d7\u05d5\u05de\u05e8 \u05d2\u05dc\u05dd", ["\u05d7\u05d5\u05de\u05e8\u05d9 \u05d2\u05dc\u05dd"]], ["\u05ea\u05d5\u05e6\"\u05d2 \u05d5\u05de\u05d7\u05e1\u05e0\u05d9\u05dd", ["\u05ea\u05d5\u05e6\u05d2"]], ["\u05de\u05e2\u05d1\u05d3\u05d4", ["\u05de\u05e2\u05d1\u05d3\u05d4"]], ["\u05d0\u05d7\u05d6\u05e7\u05d4 \u05d5\u05d7\u05e9\u05de\u05dc", ["\u05d0\u05d7\u05d6\u05e7\u05d4, \u05d0\u05e0\u05e8\u05d2\u05d9\u05d4 \u05d5\u05d7\u05e9\u05de\u05dc"]]];
export function deptMatch(dept, empDep) {
  if (!dept) return true;
  const d = String(empDep || ''), row = TBT_DEPTS.find((x) => x[0] === dept);
  return d === dept || (!!row && row[1].indexOf(d) >= 0);
}
export function makePermToken(env, id, v, nowMs) { return makeLinkToken(env, PERM_PREFIX, id + '-v' + (v || 0), PERM_TTL_DAYS, nowMs); }
export async function readPermToken(env, tok, nowMs) {
  const r = await readLinkToken(env, PERM_PREFIX, tok, nowMs);
  if (r.error) return r;
  const m = /^(.+)-v(\d{1,5})$/.exec(r.id);
  return m ? { id: m[1], perm: true, v: +m[2] } : { error: 'bad' };
}
// A permanent token opens only an induction talk, and only while its version is the current one.
export const permOk = (t, talk) => !t.perm || (!!talk && talk.kind === KIND_IND && (talk.link_v || 0) === t.v);
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
export function inductionHtml(talk, row, sigB64, lang, when) {
  const x = textOf(talk, lang), L = LANGS[x.lang] || LANGS.he;
  const tr = (k, v) => '<tr><td style="border:1px solid #999;padding:6px 10px;font-weight:bold">' + k + '</td><td style="border:1px solid #999;padding:6px 10px">' + v + '</td></tr>';
  return '<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8"><title>' + esc(x.title) + '</title></head>'
    + '<body style="font-family:Arial,sans-serif;font-size:13px;line-height:1.5;margin:24px;color:#111">'
    + '<div style="font-size:11px;color:#555">\u05ea\u05e2\u05e9\u05d9\u05d5\u05ea \u05ea\u05e4\u05d5\u05d2\u05df - \u05d4\u05d5\u05e8\u05d0\u05d5\u05ea \u05d4\u05db\u05e0\u05e1\u05ea \u05e2\u05d5\u05d1\u05d3\u05d9\u05dd \u05dc\u05de\u05e9\u05de\u05e8\u05ea, \u05d8\u05d5\u05e4\u05e1 08.02.01</div>'
    + '<h1 style="font-size:18px;margin:4px 0 8px">' + esc(x.title) + '</h1>'
    + (x.lang !== 'he' ? '<div style="margin-bottom:6px">\u05e9\u05e4\u05ea \u05d4\u05d4\u05d3\u05e8\u05db\u05d4 \u05e9\u05d4\u05e2\u05d5\u05d1\u05d3 \u05e7\u05e8\u05d0: ' + esc(L.name) + '</div>' : '')
    + '<div dir="' + L.dir + '" style="white-space:pre-wrap;border:1px solid #ccc;padding:10px">' + esc(x.body) + '</div>'
    + '<p dir="' + L.dir + '" style="font-weight:bold">' + esc(L.ok) + '</p>'
    + '<table style="border-collapse:collapse;margin:12px 0">'
    + tr('\u05ea\u05d0\u05e8\u05d9\u05da \u05d5\u05e9\u05e2\u05d4', esc(fdate(when.day)) + ' ' + esc(when.hm))
    + tr('\u05e9\u05dd', esc(row.emp_name || ''))
    + tr('\u05de\u05e1\' \u05ea.\u05d6.', esc(row.id_no || ''))
    + tr('\u05d7\u05d1\u05e8\u05d4 / \u05de\u05d7\u05dc\u05e7\u05d4', esc(row.dept || '-'))
    + (row.quiz_n ? tr('\u05d1\u05d3\u05d9\u05e7\u05ea \u05d4\u05d1\u05e0\u05d4', row.quiz_ok + '/' + row.quiz_n + ' \u05e0\u05db\u05d5\u05e0\u05d5\u05ea') : '')
    + (talk.trainer ? tr('\u05de\u05d3\u05e8\u05d9\u05da', esc(talk.trainer) + (talk.trainer_qual ? ', ' + esc(talk.trainer_qual) : '')) : '')
    + tr('\u05d7\u05ea\u05d9\u05de\u05d4', '<img alt="\u05d7\u05ea\u05d9\u05de\u05d4" style="height:90px;max-width:260px" src="data:image/png;base64,' + sigB64 + '">')
    + '</table><div style="font-size:11px;color:#555">\u05e0\u05d7\u05ea\u05dd \u05d1\u05d8\u05dc\u05e4\u05d5\u05df \u05d3\u05e8\u05da \u05d0\u05e4\u05dc\u05d9\u05e7\u05e6\u05d9\u05d9\u05ea \u05e0\u05d9\u05d4\u05d5\u05dc \u05d4\u05d1\u05d8\u05d9\u05d7\u05d5\u05ea. \u05de\u05d6\u05d4\u05d4 \u05e8\u05e9\u05d5\u05de\u05d4: ' + esc(row.id || '') + '</div></body></html>';
}
export async function fileInduction(env, talk, row, sig, lang, nowMs) {
  const out = { pdf: false, url: null, mailed: false, err: null, name: null };
  try {
    const od = await accessToken(env);
    const now = new Date(nowMs || Date.now());
    const day = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Jerusalem' });
    const hm = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jerusalem', hour12: false });
    const base = day.split('-').reverse().join('-') + ' - ' + fileSafe(row.emp_name) + ' - ' + fileSafe(row.id_no);
    const hb = new TextEncoder().encode(inductionHtml(talk, row, b64(sig), lang, { day, hm }));
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
      + '<table>' + cell('\u05e9\u05dd', esc(row.emp_name || '')) + cell('\u05de\u05e1\' \u05ea.\u05d6.', esc(row.id_no || '')) + cell('\u05d7\u05d1\u05e8\u05d4 / \u05de\u05d7\u05dc\u05e7\u05d4', esc(row.dept || '-')) + cell('\u05ea\u05d0\u05e8\u05d9\u05da', esc(fdate(day)) + ' ' + esc(hm))
      + (row.quiz_n ? cell('\u05d1\u05d3\u05d9\u05e7\u05ea \u05d4\u05d1\u05e0\u05d4', row.quiz_ok + '/' + row.quiz_n) : '') + '</table>'
      + (out.url ? '<p>\u05ea\u05d5\u05d9\u05e7 \u05d1\u05ea\u05d9\u05e7\u05d9\u05d9\u05d4: <a href="' + esc(out.url) + '">' + esc(name) + '</a></p>' : '')
      + '<p style="color:#666;font-size:12px">\u05e0\u05e9\u05dc\u05d7 \u05d0\u05d5\u05d8\u05d5\u05de\u05d8\u05d9\u05ea \u05de\u05d0\u05e4\u05dc\u05d9\u05e7\u05e6\u05d9\u05d9\u05ea \u05e0\u05d9\u05d4\u05d5\u05dc \u05d4\u05d1\u05d8\u05d9\u05d7\u05d5\u05ea \u05e9\u05dc \u05ea\u05e2\u05e9\u05d9\u05d5\u05ea \u05ea\u05e4\u05d5\u05d2\u05df.</p></div>';
    await sendMailTo(od.token, to, [], '\u05d8\u05d5\u05e4\u05e1 \u05e7\u05dc\u05d9\u05d8\u05ea \u05e2\u05d5\u05d1\u05d3 \u05d7\u05d3\u05e9 \u05d7\u05ea\u05d5\u05dd: ' + (row.emp_name || '') + ', ' + fdate(day), mail,
      [{ '@odata.type': '#microsoft.graph.fileAttachment', name, contentType: type, contentBytes: b64(bytes) }]);
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

async function getTalk(env, id) {
  const r = await fetch(SB + '/rest/v1/toolbox_talks?id=eq.' + encodeURIComponent(id) + '&select=id,d,title,body,body_ar,body_ru,body_am,file_url,s,trainer,trainer_qual,trainer_signed_at,video_url,quiz,kind,link_v,dept', { headers: sbH(env) });
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
// The trainer closes the group talk with a signed declaration, on the same phone.
function trainerPage(tok, talk) {
  const nonce = newId() + newId();
  const inner = '<h2 style="margin:4px 0 8px;font-size:20px">' + esc(talk.title) + '</h2>'
    + '<div style="font-size:14px;margin-bottom:10px">\u05de\u05d3\u05e8\u05d9\u05da: ' + esc(talk.trainer || '-') + (talk.trainer_qual ? ', ' + esc(talk.trainer_qual) : '') + '</div>'
    + (talk.trainer_signed_at ? '<p style="color:#15803d;font-weight:700">\u05d4\u05de\u05d3\u05e8\u05d9\u05da \u05db\u05d1\u05e8 \u05d7\u05ea\u05dd. \u05d7\u05ea\u05d9\u05de\u05d4 \u05d7\u05d3\u05e9\u05d4 \u05ea\u05d7\u05dc\u05d9\u05e3 \u05d0\u05ea \u05d4\u05e7\u05d5\u05d3\u05de\u05ea.</p>' : '')
    + '<form id="f" method="POST" action="/api/talk"><input type="hidden" name="k" value="' + esc(tok) + '"><input type="hidden" name="g" value="1"><input type="hidden" name="t" value="1"><input type="hidden" name="sig" id="sig">'
    + '<label style="display:flex;gap:8px;align-items:center;margin-bottom:12px"><input type="checkbox" name="ok" value="1" required style="width:22px;height:22px;flex:none">' + esc(TR_DECL) + '</label>'
    + '<div style="font-weight:700;margin-bottom:4px">\u05d7\u05ea\u05d9\u05de\u05ea \u05d4\u05de\u05d3\u05e8\u05d9\u05da</div>'
    + '<canvas id="pad" style="width:100%;height:180px;border:2px dashed #9ca3af;border-radius:8px;touch-action:none;background:#fff"></canvas>'
    + '<button type="button" id="clr" style="margin:6px 0 14px;padding:6px 14px;border:1px solid #d1d5db;border-radius:8px;background:#fff;font-size:14px">\u05e0\u05e7\u05d4</button>'
    + '<button type="submit" id="go" style="display:block;width:100%;padding:14px;border:0;border-radius:10px;background:#15803d;color:#fff;font-size:18px;font-weight:700">\u05d7\u05ea\u05d5\u05dd \u05d5\u05e1\u05d9\u05d9\u05dd</button></form>'
    + '<p><a href="' + esc(talkUrl(tok, 'he', true)) + '" style="color:#1e3a8a">\u05d7\u05d6\u05e8\u05d4 \u05dc\u05d7\u05ea\u05d9\u05de\u05d5\u05ea \u05d4\u05e2\u05d5\u05d1\u05d3\u05d9\u05dd</a></p>'
    + '<script nonce="' + nonce + '">' + trScript + '</script>';
  return page('\u05e1\u05d9\u05d5\u05dd \u05d4\u05d4\u05d3\u05e8\u05db\u05d4', inner, '', 200, nonce, 'he');
}
async function signTrainer(env, form, tok, talk) {
  const back = '<p><a href="' + esc(talkUrl(tok, 'he', true, true)) + '" style="color:#1e3a8a;font-weight:700">\u05d7\u05d6\u05e8\u05d4</a></p>';
  if (String(form.get('ok') || '') !== '1') return page('\u05d7\u05e1\u05e8 \u05d0\u05d9\u05e9\u05d5\u05e8', '<p>\u05e6\u05e8\u05d9\u05da \u05dc\u05e1\u05de\u05df \u05d0\u05ea \u05d4\u05d4\u05e6\u05d4\u05e8\u05d4.</p>' + back, 'err', 400, '', 'he');
  const sig = sigBytes(form.get('sig'));
  if (!sig) return page('\u05d7\u05e1\u05e8\u05d4 \u05d7\u05ea\u05d9\u05de\u05d4', '<p>\u05d4\u05d7\u05ea\u05d9\u05de\u05d4 \u05dc\u05d0 \u05e0\u05e7\u05dc\u05d8\u05d4. \u05d7\u05ea\u05d5\u05dd \u05d1\u05d0\u05e6\u05d1\u05e2 \u05d1\u05ea\u05d5\u05da \u05d4\u05de\u05e1\u05d2\u05e8\u05ea.</p>' + back, 'err', 400, '', 'he');
  const name = 'sig-' + talk.id + '-trainer.png';
  const up = await fetch(SB + '/storage/v1/object/' + BUCKET + '/' + name, { method: 'POST', headers: sbH(env, { 'Content-Type': 'image/png', 'x-upsert': 'true' }), body: sig });
  const fail = () => page('\u05d4\u05e9\u05de\u05d9\u05e8\u05d4 \u05e0\u05db\u05e9\u05dc\u05d4', '<p>\u05d4\u05d7\u05ea\u05d9\u05de\u05d4 \u05dc\u05d0 \u05e0\u05e9\u05de\u05e8\u05d4. \u05e0\u05e1\u05d4 \u05e9\u05d5\u05d1 \u05d1\u05e2\u05d5\u05d3 \u05d3\u05e7\u05d4.</p>' + back, 'err', 502, '', 'he');
  if (!up.ok) return fail();
  const p = await fetch(SB + '/rest/v1/toolbox_talks?id=eq.' + encodeURIComponent(talk.id), { method: 'PATCH', headers: sbH(env, { 'Content-Type': 'application/json', Prefer: 'return=minimal' }), body: JSON.stringify({ trainer_sig_url: SB + '/storage/v1/object/public/' + BUCKET + '/' + name, trainer_signed_at: new Date().toISOString() }) });
  if (!p.ok) return fail();
  return page('\u05ea\u05d5\u05d3\u05d4', '<p>\u05d7\u05ea\u05d9\u05de\u05ea \u05d4\u05de\u05d3\u05e8\u05d9\u05da \u05e0\u05e9\u05de\u05e8\u05d4. \u05d4\u05d4\u05d3\u05e8\u05db\u05d4 \u05d4\u05e1\u05ea\u05d9\u05d9\u05de\u05d4.</p>', 'ok', 200, '', 'he');
}

async function showTalk(env, tok, want, g, tr) {
  const t = await readTok(env, tok, g);
  if (t.error === 'expired') return errL('expired', want, 410);
  if (t.error) return errL('badLink', want, 403);
  const talk = await getTalk(env, t.id);
  if (!talk || talk.s !== S_PUB) return errL('unpub', want, 404);
  if (!permOk(t, talk)) return errL('badLink', want, 403);
  if (g && tr) return trainerPage(tok, talk);
  const x = textOf(talk, langOf(want));
  const lang = x.lang, L = LANGS[lang];
  const emps = await getEmps(env);
  const files = await signedFiles(env, talk.file_url);
  const vid = await videoHtml(env, talk, L);
  const quiz = quizOf(talk, lang);
  // Group mode only: who already signed, so the phone moves on to the next worker.
  const signed = g ? await signedIds(env, talk.id) : new Set();
  // A talk for one department lists its workers (10/10/2026); "not on the list" stays for anyone else,
  // and the signature still checks against the whole list, so a worker who moved can sign.
  const listed = talk.dept ? emps.filter((e) => deptMatch(talk.dept, e.dep)) : emps;
  const byDep = {};
  for (const e of (listed.length ? listed : emps)) { const d = e.dep || '\u05d0\u05d7\u05e8'; (byDep[d] = byDep[d] || []).push(e); }
  const opts = Object.keys(byDep).sort((a, b) => a.localeCompare(b, 'he')).map((d) =>
    '<optgroup label="' + esc(d) + '">' + byDep[d].map((e) => (signed.has(String(e.id)) ? '<option value="" disabled>\u2713 ' + esc(e.n) + ' (' + esc(L.signedL) + ')</option>' : '<option value="' + esc(e.id) + '">' + esc(e.n) + '</option>')).join('') + '</optgroup>').join('');
  const avail = langsOf(talk);
  const bar = avail.length < 2 ? '' : '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px">' + avail.map((l) =>
    l === lang ? '<span style="padding:6px 12px;border-radius:16px;background:#1e3a8a;color:#fff;font-size:14px;font-weight:700">' + esc(LANGS[l].name) + '</span>'
      : '<a href="' + esc(talkUrl(tok, l, g)) + '" style="padding:6px 12px;border-radius:16px;border:1px solid #1e3a8a;color:#1e3a8a;font-size:14px;text-decoration:none">' + esc(LANGS[l].name) + '</a>').join('') + '</div>';
  const nonce = newId() + newId();
  const inner = bar
    + '<div style="font-size:13px;color:#6b7280">' + esc(fdate(talk.d)) + '</div>'
    + '<h2 id="th" style="margin:4px 0 12px;font-size:20px">' + esc(x.title) + '</h2>'
    + (g ? '<div style="font-size:14px;font-weight:700;color:#1e3a8a;background:#eff6ff;border-radius:6px;padding:6px 10px;margin-bottom:8px">\ud83d\udc65 ' + esc(L.group) + '</div>' : '')
    + (talk.trainer ? '<div style="font-size:14px;color:#374151;margin-bottom:10px">' + esc(L.trainerL) + ': ' + esc(talk.trainer) + '</div>' : '')
    + (L.auto ? '<div style="font-size:12px;color:#92400e;background:#fef3c7;border-radius:6px;padding:6px 10px;margin-bottom:10px">' + esc(L.auto) + '</div>' : '')
    + (x.body ? '<button type="button" id="say" style="display:none;margin:0 0 8px;padding:8px 16px;border:1px solid #1e3a8a;border-radius:8px;background:#eff6ff;color:#1e3a8a;font-size:16px;font-weight:700">\ud83d\udd0a ' + esc((SPEAK[lang] || SPEAK.he).listen) + '</button>'
      + '<div id="tb" style="white-space:pre-wrap;background:#f9fafb;border-radius:8px;padding:12px;margin-bottom:12px">' + esc(x.body) + '</div>' : '')
    + vid
    + files.map((u, i) => '<p><a href="' + esc(u) + '" target="_blank" rel="noopener" style="color:#1e3a8a;font-weight:700">' + esc(L.file) + (files.length > 1 ? ' ' + (i + 1) : '') + '</a></p>').join('')
    + quizHtml(quiz, lang)
    + '<form id="f" method="POST" action="/api/talk" style="border-top:1px solid #e5e7eb;padding-top:12px;margin-top:8px">'
    + '<input type="hidden" name="k" value="' + esc(tok) + '">' + (g ? '<input type="hidden" name="g" value="1">' : '') + '<input type="hidden" name="l" value="' + lang + '"><input type="hidden" name="sig" id="sig"><input type="hidden" name="qa" id="qa">'
    + '<label style="display:block;font-weight:700;margin-bottom:4px">' + esc(L.you) + '</label>'
    + '<select name="emp" id="emp" required dir="rtl" style="width:100%;font-size:16px;padding:10px;border:1px solid #d1d5db;border-radius:8px;margin-bottom:12px"><option value="">' + esc(L.pick) + '</option><option value="' + OTHER + '">' + esc(L.other) + '</option>' + opts + '</select>'
    // Not on the list: the name first, then the ID like everyone (review 03/10/2026: the ID came between the list and the name).
    + '<div id="obox" style="display:none;margin:-4px 0 12px"><input name="oname" id="oname" maxlength="60" autocomplete="off" placeholder="' + esc(L.oname) + '" style="width:100%;box-sizing:border-box;font-size:16px;padding:10px;border:1px solid #d1d5db;border-radius:8px;margin-bottom:8px"><input name="ocomp" maxlength="60" autocomplete="off" placeholder="' + esc(L.ocomp) + '" style="width:100%;box-sizing:border-box;font-size:16px;padding:10px;border:1px solid #d1d5db;border-radius:8px"></div>'
    + '<label for="oid" style="display:block;font-weight:700;margin-bottom:4px">' + esc(L.oid) + '</label><input name="oid" id="oid" maxlength="20" autocomplete="off" dir="ltr" style="width:100%;box-sizing:border-box;font-size:16px;padding:10px;border:1px solid #d1d5db;border-radius:8px;margin-bottom:12px;text-align:right">'
    + '<label style="display:flex;gap:8px;align-items:center;margin-bottom:12px"><input type="checkbox" name="ok" value="1" required style="width:22px;height:22px;flex:none">' + esc(L.ok) + '</label>'
    + '<div style="font-weight:700;margin-bottom:4px">' + esc(L.sig) + '</div>'
    + '<canvas id="pad" style="width:100%;height:180px;border:2px dashed #9ca3af;border-radius:8px;touch-action:none;background:#fff"></canvas>'
    + '<button type="button" id="clr" style="margin:6px 0 14px;padding:6px 14px;border:1px solid #d1d5db;border-radius:8px;background:#fff;font-size:14px">' + esc(L.clear) + '</button>'
    + '<button type="submit" id="go" style="display:block;width:100%;padding:14px;border:0;border-radius:10px;background:#15803d;color:#fff;font-size:18px;font-weight:700">' + esc(L.send) + '</button>'
    + '</form>'
    + (g ? '<p style="border-top:1px solid #e5e7eb;margin-top:16px;padding-top:12px" dir="rtl"><a href="' + esc(talkUrl(tok, 'he', true, true)) + '" style="color:#1e3a8a;font-weight:700">' + (talk.trainer_signed_at ? '\u2713 \u05d4\u05de\u05d3\u05e8\u05d9\u05da \u05d7\u05ea\u05dd \u05e2\u05dc \u05e1\u05d9\u05d5\u05dd \u05d4\u05d4\u05d3\u05e8\u05db\u05d4' : '\u270d\ufe0f \u05e1\u05d9\u05d5\u05dd \u05d4\u05d4\u05d3\u05e8\u05db\u05d4: \u05d7\u05ea\u05d9\u05de\u05ea \u05d4\u05de\u05d3\u05e8\u05d9\u05da') + '</a></p>' : '')
    + '<script nonce="' + nonce + '">' + sigScript(L) + '</script>'
    + (quiz.length ? '<script nonce="' + nonce + '">' + quizScript(quiz, lang) + '</script>' : '')
    + (x.body ? '<script nonce="' + nonce + '">' + speakScript(lang) + '</script>' : '');
  return page(talk.kind === KIND_IND ? L.indT : L.title, inner, '', 200, nonce, lang);
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
  const empId = String(form.get('emp') || '');
  const sig = sigBytes(form.get('sig'));
  // Michael, 03/10/2026: "an ID is always needed", for a worker on the list too.
  const oid = idOf(form.get('oid'));
  let emp;
  if (empId === OTHER) {
    const raw = oneLine(form.get('oname')), comp = oneLine(form.get('ocomp'));
    if (raw.length < 2) return bad('errNameT', 'oNeed');
    if (!oid) return bad('errNameT', 'oIdNeed');
    if (!sig) return bad('errSigT', 'errSig');
    const n = await hebrewName(env, raw), dep = comp ? await hebrewName(env, comp) : null;
    if (!n || (comp && !dep)) return bad('errNameT', 'errHe', 422);
    emp = { id: 'x:' + oid + ':' + raw.toLowerCase(), key: 'x:' + oid + ':', n, dep, out: true };
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

  const who = emp.out ? '&emp_id=like.' + encodeURIComponent(emp.key + '*') : '&emp_id=eq.' + encodeURIComponent(emp.id);
  const done = (name) => page(L.thanks + ', ' + name, '<p>' + esc(L.already) + '</p>' + back, 'ok', 200, '', lang);
  const dup = await fetch(SB + '/rest/v1/toolbox_reads?talk_id=eq.' + encodeURIComponent(talk.id) + who + '&select=id', { headers: sbH(env) });
  if (dup.ok) { const rows = await dup.json(); if (Array.isArray(rows) && rows.length) return done(emp.n); }
  if (emp.out) {
    const outs = await fetch(SB + '/rest/v1/toolbox_reads?talk_id=eq.' + encodeURIComponent(talk.id) + '&emp_id=like.' + encodeURIComponent('x:*') + '&select=id', { headers: sbH(env) });
    if (!outs.ok) return bad('errSaveT', 'errSave', 502);
    const n = await outs.json();
    if (Array.isArray(n) && n.length >= MAX_OUT) return bad('errSaveT', 'full', 429);
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
    id, talk_id: talk.id, emp_id: String(emp.id), emp_name: emp.n, id_no: oid, dept: emp.dep || null, lang: textOf(talk, lang).lang, text_hash: await textHash(talk, lang),
    sig_url: SB + '/storage/v1/object/public/' + BUCKET + '/' + name,
    device: deviceOf(request.headers.get('user-agent')), read_at: new Date().toISOString(), mode: g ? 'group' : 'link',
  };
  const qs = quizScore(quizOf(talk, textOf(talk, lang).lang), form.get('qa'));
  if (qs) { row.quiz_ok = qs.ok; row.quiz_n = qs.n; }
  const ins = await fetch(SB + '/rest/v1/toolbox_reads', { method: 'POST', headers: sbH(env, { 'Content-Type': 'application/json', Prefer: 'return=minimal' }), body: JSON.stringify(row) });
  if (ins.status === 409) return done(emp.n);
  if (!ins.ok) return bad('errSaveT', 'errSave', 502);
  // Induction: file the signed form and mail it, after the worker already sees "saved".
  if (talk.kind === KIND_IND) {
    const job = fileInduction(env, talk, row, sig, lang);
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

async function makeLink(env, request) {
  const allowed = defaultAllowedOrigins(env);
  const cors = corsHeaders(request.headers.get('origin') || '', allowed, 'POST,OPTIONS');
  if (!isAllowedCaller(request, allowed)) return jsonResp({ error: 'origin not allowed' }, 403, cors);
  const who = await requireRole(request, env, ['admin', 'manager']);
  if (!who.ok) return jsonResp({ error: who.error }, who.status || 401, cors);
  let b = {};
  try { b = await request.json(); } catch (e) { b = {}; }
  if (!b || (b.op !== 'link' && b.op !== 'group' && b.op !== 'revoke')) return jsonResp({ error: 'unknown op' }, 400, cors);
  const talk = await getTalk(env, String(b.id || ''));
  if (!talk) return jsonResp({ error: 'not found' }, 404, cors);
  if (talk.s !== S_PUB) return jsonResp({ error: 'not published' }, 409, cors);
  // Group: for the phone in the manager's hand, one day; the shared link's expiry (link_at) is untouched.
  if (b.op === 'group') {
    const gt = await makeGroupToken(env, talk.id);
    if (!gt) return jsonResp({ error: 'not configured' }, 503, cors);
    return jsonResp({ url: talkUrl(gt, 'he', true), days: GROUP_TTL_DAYS }, 200, cors);
  }
  // Induction: the permanent link; "revoke" raises link_v first, so the old link and QR stop.
  if (talk.kind === KIND_IND) {
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
  if (b.op === 'revoke') return jsonResp({ error: 'not an induction talk' }, 409, cors);
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
    if (request.method === 'GET') { const q = new URL(request.url).searchParams; return await showTalk(env, q.get('k') || '', q.get('l') || '', q.get('g') === '1', q.get('t') === '1'); }
    if (request.method !== 'POST') return errPage('\u05e4\u05e2\u05d5\u05dc\u05d4 \u05dc\u05d0 \u05e0\u05ea\u05de\u05db\u05ea.', 405);
    if (/application\/json/i.test(request.headers.get('content-type') || '')) return await makeLink(env, request);
    return await signTalk(env, request, context);
  } catch (e) {
    return errPage('\u05ea\u05e7\u05dc\u05d4 \u05d6\u05de\u05e0\u05d9\u05ea. \u05e0\u05e1\u05d4 \u05e9\u05d5\u05d1 \u05d1\u05e2\u05d5\u05d3 \u05d3\u05e7\u05d4.', 500);
  }
}
