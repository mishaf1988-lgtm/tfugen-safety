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

// Stage 3 (03/10/2026, Michael: "\u05e2\u05d1\u05e8\u05d9\u05ea, \u05e2\u05e8\u05d1\u05d9\u05ea, \u05e8\u05d5\u05e1\u05d9\u05ea, \u05d0\u05de\u05d4\u05e8\u05d9\u05ea/\u05d0\u05d7\u05e8"). The talk
// text comes translated from the manager's screen (body_ar / body_ru / body_am,
// first line = the title); these are the words of the page around it.
// Written by Claude, not by a native speaker: worth one look by a worker who
// reads each language (STATUS).
export const LANGS = {
  he: { name: '\u05e2\u05d1\u05e8\u05d9\u05ea', dir: 'rtl',
    errOkT: '\u05d7\u05e1\u05e8 \u05d0\u05d9\u05e9\u05d5\u05e8', errOk: '\u05e6\u05e8\u05d9\u05da \u05dc\u05e1\u05de\u05df "\u05e7\u05e8\u05d0\u05ea\u05d9 \u05d5\u05d4\u05d1\u05e0\u05ea\u05d9 \u05d0\u05ea \u05d4\u05d4\u05d3\u05e8\u05db\u05d4".', errNameT: '\u05d7\u05e1\u05e8 \u05e9\u05dd', errName: '\u05d1\u05d7\u05e8 \u05d0\u05ea \u05d4\u05e9\u05dd \u05e9\u05dc\u05da \u05de\u05d4\u05e8\u05e9\u05d9\u05de\u05d4.', errSigT: '\u05d7\u05e1\u05e8\u05d4 \u05d7\u05ea\u05d9\u05de\u05d4', errSig: '\u05d4\u05d7\u05ea\u05d9\u05de\u05d4 \u05dc\u05d0 \u05e0\u05e7\u05dc\u05d8\u05d4. \u05d7\u05ea\u05d5\u05dd \u05d1\u05d0\u05e6\u05d1\u05e2 \u05d1\u05ea\u05d5\u05da \u05d4\u05de\u05e1\u05d2\u05e8\u05ea \u05d5\u05e0\u05e1\u05d4 \u05e9\u05d5\u05d1.', errSaveT: '\u05d4\u05e9\u05de\u05d9\u05e8\u05d4 \u05e0\u05db\u05e9\u05dc\u05d4', errSave: '\u05d4\u05d7\u05ea\u05d9\u05de\u05d4 \u05dc\u05d0 \u05e0\u05e9\u05de\u05e8\u05d4. \u05e0\u05e1\u05d4 \u05e9\u05d5\u05d1 \u05d1\u05e2\u05d5\u05d3 \u05d3\u05e7\u05d4.',
    title: '\u05d4\u05d3\u05e8\u05db\u05d4 \u05e9\u05d1\u05d5\u05e2\u05d9\u05ea', file: '\u05e4\u05ea\u05d7 \u05d0\u05ea \u05d4\u05e7\u05d5\u05d1\u05e5 \u05d4\u05de\u05e6\u05d5\u05e8\u05e3', you: '\u05d4\u05e9\u05dd \u05e9\u05dc\u05da', pick: '\u05d1\u05d7\u05e8 \u05de\u05d4\u05e8\u05e9\u05d9\u05de\u05d4',
    ok: '\u05e7\u05e8\u05d0\u05ea\u05d9 \u05d5\u05d4\u05d1\u05e0\u05ea\u05d9 \u05d0\u05ea \u05d4\u05d4\u05d3\u05e8\u05db\u05d4', sig: '\u05d7\u05ea\u05d9\u05de\u05d4 \u05d1\u05d0\u05e6\u05d1\u05e2', clear: '\u05e0\u05e7\u05d4 \u05d7\u05ea\u05d9\u05de\u05d4', send: '\u05d7\u05ea\u05d5\u05dd \u05d5\u05e9\u05dc\u05d7', saving: '\u05e9\u05d5\u05de\u05e8...',
    noName: '\u05d1\u05d7\u05e8 \u05d0\u05ea \u05d4\u05e9\u05dd \u05e9\u05dc\u05da \u05de\u05d4\u05e8\u05e9\u05d9\u05de\u05d4', noSig: '\u05d7\u05e1\u05e8\u05d4 \u05d7\u05ea\u05d9\u05de\u05d4. \u05d7\u05ea\u05d5\u05dd \u05d1\u05d0\u05e6\u05d1\u05e2 \u05d1\u05ea\u05d5\u05da \u05d4\u05de\u05e1\u05d2\u05e8\u05ea', auto: '',
    thanks: '\u05ea\u05d5\u05d3\u05d4', saved: '\u05d4\u05d7\u05ea\u05d9\u05de\u05d4 \u05e0\u05e9\u05de\u05e8\u05d4.', next: '\u05e2\u05d5\u05d1\u05d3 \u05d4\u05d1\u05d0 \u05d7\u05d5\u05ea\u05dd', already: '\u05db\u05d1\u05e8 \u05d7\u05ea\u05de\u05ea \u05e2\u05dc \u05d4\u05d4\u05d3\u05e8\u05db\u05d4 \u05d4\u05d6\u05d5. \u05d0\u05d9\u05df \u05e6\u05d5\u05e8\u05da \u05dc\u05d7\u05ea\u05d5\u05dd \u05e9\u05d5\u05d1.', back: '\u05d7\u05d6\u05e8\u05d4 \u05dc\u05d4\u05d3\u05e8\u05db\u05d4' },
  ar: { name: '\u0627\u0644\u0639\u0631\u0628\u064a\u0629', dir: 'rtl',
    errOkT: '\u064a\u0646\u0642\u0635 \u0627\u0644\u062a\u0623\u0643\u064a\u062f', errOk: '\u064a\u062c\u0628 \u0648\u0636\u0639 \u0639\u0644\u0627\u0645\u0629 \u0639\u0644\u0649 "\u0642\u0631\u0623\u062a \u0627\u0644\u062a\u062f\u0631\u064a\u0628 \u0648\u0641\u0647\u0645\u062a\u0647".', errNameT: '\u064a\u0646\u0642\u0635 \u0627\u0644\u0627\u0633\u0645', errName: '\u0627\u062e\u062a\u0631 \u0627\u0633\u0645\u0643 \u0645\u0646 \u0627\u0644\u0642\u0627\u0626\u0645\u0629.', errSigT: '\u064a\u0646\u0642\u0635 \u0627\u0644\u062a\u0648\u0642\u064a\u0639', errSig: '\u0644\u0645 \u064a\u0635\u0644 \u0627\u0644\u062a\u0648\u0642\u064a\u0639. \u0648\u0642\u0651\u0639 \u0628\u0625\u0635\u0628\u0639\u0643 \u062f\u0627\u062e\u0644 \u0627\u0644\u0625\u0637\u0627\u0631 \u0648\u062d\u0627\u0648\u0644 \u0645\u0631\u0629 \u0623\u062e\u0631\u0649.', errSaveT: '\u0641\u0634\u0644 \u0627\u0644\u062d\u0641\u0638', errSave: '\u0644\u0645 \u064a\u062a\u0645 \u062d\u0641\u0638 \u0627\u0644\u062a\u0648\u0642\u064a\u0639. \u062d\u0627\u0648\u0644 \u0645\u0631\u0629 \u0623\u062e\u0631\u0649 \u0628\u0639\u062f \u062f\u0642\u064a\u0642\u0629.',
    title: '\u062a\u062f\u0631\u064a\u0628 \u0627\u0644\u0633\u0644\u0627\u0645\u0629 \u0627\u0644\u0623\u0633\u0628\u0648\u0639\u064a', file: '\u0627\u0641\u062a\u062d \u0627\u0644\u0645\u0644\u0641 \u0627\u0644\u0645\u0631\u0641\u0642', you: '\u0627\u0633\u0645\u0643', pick: '\u0627\u062e\u062a\u0631 \u0645\u0646 \u0627\u0644\u0642\u0627\u0626\u0645\u0629',
    ok: '\u0642\u0631\u0623\u062a \u0627\u0644\u062a\u062f\u0631\u064a\u0628 \u0648\u0641\u0647\u0645\u062a\u0647', sig: '\u0627\u0644\u062a\u0648\u0642\u064a\u0639 \u0628\u0627\u0644\u0625\u0635\u0628\u0639', clear: '\u0627\u0645\u0633\u062d \u0627\u0644\u062a\u0648\u0642\u064a\u0639', send: '\u0648\u0642\u0651\u0639 \u0648\u0623\u0631\u0633\u0644', saving: '\u062c\u0627\u0631 \u0627\u0644\u062d\u0641\u0638...',
    noName: '\u0627\u062e\u062a\u0631 \u0627\u0633\u0645\u0643 \u0645\u0646 \u0627\u0644\u0642\u0627\u0626\u0645\u0629', noSig: '\u0627\u0644\u062a\u0648\u0642\u064a\u0639 \u0646\u0627\u0642\u0635. \u0648\u0642\u0651\u0639 \u0628\u0625\u0635\u0628\u0639\u0643 \u062f\u0627\u062e\u0644 \u0627\u0644\u0625\u0637\u0627\u0631', auto: '\u062a\u0631\u062c\u0645\u0629 \u0622\u0644\u064a\u0629. \u0644\u0623\u064a \u0633\u0624\u0627\u0644 \u062a\u0648\u062c\u0651\u0647 \u0625\u0644\u0649 \u0645\u0633\u0624\u0648\u0644 \u0627\u0644\u0633\u0644\u0627\u0645\u0629.',
    thanks: '\u0634\u0643\u0631\u0627', saved: '\u062a\u0645 \u062d\u0641\u0638 \u0627\u0644\u062a\u0648\u0642\u064a\u0639.', next: '\u0627\u0644\u0639\u0627\u0645\u0644 \u0627\u0644\u062a\u0627\u0644\u064a \u064a\u0648\u0642\u0651\u0639', already: '\u0644\u0642\u062f \u0648\u0642\u0651\u0639\u062a \u0639\u0644\u0649 \u0647\u0630\u0627 \u0627\u0644\u062a\u062f\u0631\u064a\u0628 \u0645\u0646 \u0642\u0628\u0644. \u0644\u0627 \u062d\u0627\u062c\u0629 \u0644\u0644\u062a\u0648\u0642\u064a\u0639 \u0645\u0631\u0629 \u0623\u062e\u0631\u0649.', back: '\u0627\u0644\u0639\u0648\u062f\u0629 \u0625\u0644\u0649 \u0627\u0644\u062a\u062f\u0631\u064a\u0628' },
  ru: { name: '\u0420\u0443\u0441\u0441\u043a\u0438\u0439', dir: 'ltr',
    errOkT: '\u041d\u0435\u0442 \u043f\u043e\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0435\u043d\u0438\u044f', errOk: '\u041d\u0443\u0436\u043d\u043e \u043e\u0442\u043c\u0435\u0442\u0438\u0442\u044c "\u042f \u043f\u0440\u043e\u0447\u0438\u0442\u0430\u043b(\u0430) \u0438 \u043f\u043e\u043d\u044f\u043b(\u0430) \u0438\u043d\u0441\u0442\u0440\u0443\u043a\u0442\u0430\u0436".', errNameT: '\u041d\u0435\u0442 \u0438\u043c\u0435\u043d\u0438', errName: '\u0412\u044b\u0431\u0435\u0440\u0438\u0442\u0435 \u0441\u0432\u043e\u0451 \u0438\u043c\u044f \u0438\u0437 \u0441\u043f\u0438\u0441\u043a\u0430.', errSigT: '\u041d\u0435\u0442 \u043f\u043e\u0434\u043f\u0438\u0441\u0438', errSig: '\u041f\u043e\u0434\u043f\u0438\u0441\u044c \u043d\u0435 \u043f\u043e\u043b\u0443\u0447\u0435\u043d\u0430. \u0420\u0430\u0441\u043f\u0438\u0448\u0438\u0442\u0435\u0441\u044c \u043f\u0430\u043b\u044c\u0446\u0435\u043c \u0432\u043d\u0443\u0442\u0440\u0438 \u0440\u0430\u043c\u043a\u0438 \u0438 \u043f\u043e\u043f\u0440\u043e\u0431\u0443\u0439\u0442\u0435 \u0441\u043d\u043e\u0432\u0430.', errSaveT: '\u041e\u0448\u0438\u0431\u043a\u0430 \u0441\u043e\u0445\u0440\u0430\u043d\u0435\u043d\u0438\u044f', errSave: '\u041f\u043e\u0434\u043f\u0438\u0441\u044c \u043d\u0435 \u0441\u043e\u0445\u0440\u0430\u043d\u0435\u043d\u0430. \u041f\u043e\u043f\u0440\u043e\u0431\u0443\u0439\u0442\u0435 \u0441\u043d\u043e\u0432\u0430 \u0447\u0435\u0440\u0435\u0437 \u043c\u0438\u043d\u0443\u0442\u0443.',
    title: '\u0415\u0436\u0435\u043d\u0435\u0434\u0435\u043b\u044c\u043d\u044b\u0439 \u0438\u043d\u0441\u0442\u0440\u0443\u043a\u0442\u0430\u0436 \u043f\u043e \u0431\u0435\u0437\u043e\u043f\u0430\u0441\u043d\u043e\u0441\u0442\u0438', file: '\u041e\u0442\u043a\u0440\u044b\u0442\u044c \u043f\u0440\u0438\u043b\u043e\u0436\u0435\u043d\u043d\u044b\u0439 \u0444\u0430\u0439\u043b', you: '\u0412\u0430\u0448\u0435 \u0438\u043c\u044f', pick: '\u0412\u044b\u0431\u0435\u0440\u0438\u0442\u0435 \u0438\u0437 \u0441\u043f\u0438\u0441\u043a\u0430',
    ok: '\u042f \u043f\u0440\u043e\u0447\u0438\u0442\u0430\u043b(\u0430) \u0438 \u043f\u043e\u043d\u044f\u043b(\u0430) \u0438\u043d\u0441\u0442\u0440\u0443\u043a\u0442\u0430\u0436', sig: '\u041f\u043e\u0434\u043f\u0438\u0441\u044c \u043f\u0430\u043b\u044c\u0446\u0435\u043c', clear: '\u0421\u0442\u0435\u0440\u0435\u0442\u044c \u043f\u043e\u0434\u043f\u0438\u0441\u044c', send: '\u041f\u043e\u0434\u043f\u0438\u0441\u0430\u0442\u044c \u0438 \u043e\u0442\u043f\u0440\u0430\u0432\u0438\u0442\u044c', saving: '\u0421\u043e\u0445\u0440\u0430\u043d\u044f\u044e...',
    noName: '\u0412\u044b\u0431\u0435\u0440\u0438\u0442\u0435 \u0441\u0432\u043e\u0451 \u0438\u043c\u044f \u0438\u0437 \u0441\u043f\u0438\u0441\u043a\u0430', noSig: '\u041d\u0435\u0442 \u043f\u043e\u0434\u043f\u0438\u0441\u0438. \u0420\u0430\u0441\u043f\u0438\u0448\u0438\u0442\u0435\u0441\u044c \u043f\u0430\u043b\u044c\u0446\u0435\u043c \u0432\u043d\u0443\u0442\u0440\u0438 \u0440\u0430\u043c\u043a\u0438', auto: '\u0410\u0432\u0442\u043e\u043c\u0430\u0442\u0438\u0447\u0435\u0441\u043a\u0438\u0439 \u043f\u0435\u0440\u0435\u0432\u043e\u0434. \u0421 \u0432\u043e\u043f\u0440\u043e\u0441\u0430\u043c\u0438 \u043e\u0431\u0440\u0430\u0449\u0430\u0439\u0442\u0435\u0441\u044c \u043a \u043e\u0442\u0432\u0435\u0442\u0441\u0442\u0432\u0435\u043d\u043d\u043e\u043c\u0443 \u043f\u043e \u0431\u0435\u0437\u043e\u043f\u0430\u0441\u043d\u043e\u0441\u0442\u0438.',
    thanks: '\u0421\u043f\u0430\u0441\u0438\u0431\u043e', saved: '\u041f\u043e\u0434\u043f\u0438\u0441\u044c \u0441\u043e\u0445\u0440\u0430\u043d\u0435\u043d\u0430.', next: '\u0421\u043b\u0435\u0434\u0443\u044e\u0449\u0438\u0439 \u0440\u0430\u0431\u043e\u0442\u043d\u0438\u043a', already: '\u0412\u044b \u0443\u0436\u0435 \u043f\u043e\u0434\u043f\u0438\u0441\u0430\u043b\u0438 \u044d\u0442\u043e\u0442 \u0438\u043d\u0441\u0442\u0440\u0443\u043a\u0442\u0430\u0436. \u041f\u043e\u0434\u043f\u0438\u0441\u044b\u0432\u0430\u0442\u044c \u0441\u043d\u043e\u0432\u0430 \u043d\u0435 \u043d\u0443\u0436\u043d\u043e.', back: '\u0412\u0435\u0440\u043d\u0443\u0442\u044c\u0441\u044f \u043a \u0438\u043d\u0441\u0442\u0440\u0443\u043a\u0442\u0430\u0436\u0443' },
  am: { name: '\u12a0\u121b\u122d\u129b', dir: 'ltr',
    errOkT: '\u121b\u1228\u130b\u1308\u132b \u12ed\u130e\u12f5\u120b\u120d', errOk: '"\u1235\u120d\u1320\u1293\u12cd\u1295 \u12a0\u1295\u1265\u1264 \u1270\u1228\u12f5\u127b\u1208\u1201" \u12e8\u121a\u1208\u12cd\u1295 \u121d\u120d\u12ad\u1275 \u12eb\u12f5\u122d\u1309\u1362', errNameT: '\u1235\u121d \u12ed\u130e\u12f5\u120b\u120d', errName: '\u1235\u121d\u12ce\u1295 \u12a8\u12dd\u122d\u12dd\u1229 \u12ed\u121d\u1228\u1321\u1362', errSigT: '\u134a\u122d\u121b \u12ed\u130e\u12f5\u120b\u120d', errSig: '\u134a\u122d\u121b\u12cd \u12a0\u120d\u12f0\u1228\u1230\u121d\u1362 \u1260\u1233\u1325\u1291 \u12cd\u1235\u1325 \u1260\u1323\u1275\u12ce \u1348\u122d\u1218\u12cd \u12a5\u1295\u12f0\u1308\u1293 \u12ed\u121e\u12ad\u1229\u1362', errSaveT: '\u121b\u1235\u1240\u1218\u1325 \u12a0\u120d\u1270\u1233\u12ab\u121d', errSave: '\u134a\u122d\u121b\u12cd \u12a0\u120d\u1270\u1240\u1218\u1320\u121d\u1362 \u12a8\u12a0\u1295\u12f5 \u12f0\u1242\u1243 \u1260\u128b\u120b \u12a5\u1295\u12f0\u1308\u1293 \u12ed\u121e\u12ad\u1229\u1362',
    title: '\u1233\u121d\u1295\u1273\u12ca \u12e8\u12f0\u1205\u1295\u1290\u1275 \u1235\u120d\u1320\u1293', file: '\u12e8\u1270\u12eb\u12eb\u12d8\u12cd\u1295 \u134b\u12ed\u120d \u12ad\u1348\u1275', you: '\u1235\u121d\u12ce', pick: '\u12a8\u12dd\u122d\u12dd\u1229 \u12ed\u121d\u1228\u1321',
    ok: '\u1235\u120d\u1320\u1293\u12cd\u1295 \u12a0\u1295\u1265\u1264 \u1270\u1228\u12f5\u127b\u1208\u1201', sig: '\u1260\u1323\u1275 \u12ed\u1348\u122d\u1219', clear: '\u134a\u122d\u121b\u12cd\u1295 \u12a0\u1325\u134b', send: '\u1348\u122d\u1218\u12cd \u12ed\u120b\u12a9', saving: '\u1260\u121b\u1235\u1240\u1218\u1325 \u120b\u12ed...',
    noName: '\u12a5\u1263\u12ad\u12ce \u1235\u121d\u12ce\u1295 \u12a8\u12dd\u122d\u12dd\u1229 \u12ed\u121d\u1228\u1321', noSig: '\u134a\u122d\u121b \u12e8\u1208\u121d\u1362 \u1260\u1233\u1325\u1291 \u12cd\u1235\u1325 \u1260\u1323\u1275\u12ce \u12ed\u1348\u122d\u1219', auto: '\u1260\u121b\u123d\u1295 \u12e8\u1270\u1270\u1228\u130e\u1218\u1362 \u1325\u12eb\u1244 \u12ab\u1208\u12ce\u1275 \u12e8\u12f0\u1205\u1295\u1290\u1275 \u1283\u120b\u134a\u12cd\u1295 \u12ed\u1320\u12ed\u1241\u1362',
    thanks: '\u12a5\u1293\u1218\u1230\u130d\u1293\u1208\u1295', saved: '\u134a\u122d\u121b\u12ce \u1270\u1240\u121d\u1327\u120d\u1362', next: '\u1240\u1323\u12e9 \u1230\u122b\u1270\u129b \u12ed\u1348\u122d\u121d', already: '\u1260\u12da\u1205 \u1235\u120d\u1320\u1293 \u120b\u12ed \u12a0\u1235\u1240\u12f5\u1218\u12cd \u1348\u122d\u1218\u12cb\u120d\u1362 \u12a5\u1295\u12f0\u1308\u1293 \u1218\u1348\u1228\u121d \u12a0\u12eb\u1235\u1348\u120d\u130d\u121d\u1362', back: '\u12c8\u12f0 \u1235\u120d\u1320\u1293\u12cd \u1270\u1218\u1208\u1235' },
};
export const langOf = (l) => (Object.prototype.hasOwnProperty.call(LANGS, l) ? l : 'he');
// The text a worker reads in lang: the translation (first line = title) when
// there is one, else the Hebrew. lang comes back as what was actually shown.
export function textOf(talk, lang) {
  const tr = lang !== 'he' && String((talk && talk['body_' + lang]) || '').trim();
  if (!tr) return { lang: 'he', title: talk.title || '', body: talk.body || '' };
  const i = tr.indexOf('\n');
  return i < 0 ? { lang, title: tr, body: '' } : { lang, title: tr.substring(0, i).trim(), body: tr.substring(i + 1).trim() };
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

export function talkUrl(tok, lang) { return APP_URL + '/api/talk?k=' + encodeURIComponent(tok) + (lang && lang !== 'he' ? '&l=' + lang : ''); }
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
const errPage = (msg, status) => page('\u05dc\u05d0 \u05e0\u05d9\u05ea\u05df \u05dc\u05e4\u05ea\u05d5\u05d7', '<p>' + esc(msg) + '</p>', 'err', status || 400);

async function getTalk(env, id) {
  const r = await fetch(SB + '/rest/v1/toolbox_talks?id=eq.' + encodeURIComponent(id) + '&select=id,d,title,body,body_ar,body_ru,body_am,file_url,s', { headers: sbH(env) });
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

const sigScript = (L) => `(function(){
var T=${JSON.stringify({ noName: L.noName, noSig: L.noSig, saving: L.saving }).replace(/</g, '\\u003c')};
var c=document.getElementById('pad'),x=c.getContext('2d'),drawn=false,down=false;
function fit(){var r=c.getBoundingClientRect();c.width=r.width;c.height=180;x.lineWidth=2.5;x.lineCap='round';x.strokeStyle='#111';drawn=false;}
fit();
function pt(e){var r=c.getBoundingClientRect();return{x:e.clientX-r.left,y:e.clientY-r.top};}
c.addEventListener('pointerdown',function(e){down=true;var p=pt(e);x.beginPath();x.moveTo(p.x,p.y);c.setPointerCapture(e.pointerId);e.preventDefault();});
c.addEventListener('pointermove',function(e){if(!down)return;var p=pt(e);x.lineTo(p.x,p.y);x.stroke();drawn=true;e.preventDefault();});
c.addEventListener('pointerup',function(){down=false;});
document.getElementById('clr').addEventListener('click',function(){fit();});
document.getElementById('f').addEventListener('submit',function(e){
  if(!document.getElementById('emp').value){e.preventDefault();alert(T.noName);return;}
  if(!drawn){e.preventDefault();alert(T.noSig);return;}
  document.getElementById('sig').value=c.toDataURL('image/png');
  var b=document.getElementById('go');b.disabled=true;b.textContent=T.saving;
});
})();`;

async function showTalk(env, tok, want) {
  const t = await readTalkToken(env, tok);
  if (t.error === 'expired') return errPage('\u05ea\u05d5\u05e7\u05e3 \u05d4\u05e7\u05d9\u05e9\u05d5\u05e8 \u05e4\u05d2. \u05d1\u05e7\u05e9 \u05e7\u05d9\u05e9\u05d5\u05e8 \u05d7\u05d3\u05e9 \u05de\u05d4\u05de\u05de\u05d5\u05e0\u05d4 \u05e2\u05dc \u05d4\u05d1\u05d8\u05d9\u05d7\u05d5\u05ea.', 410);
  if (t.error) return errPage('\u05d4\u05e7\u05d9\u05e9\u05d5\u05e8 \u05dc\u05d0 \u05ea\u05e7\u05d9\u05df. \u05d1\u05e7\u05e9 \u05e7\u05d9\u05e9\u05d5\u05e8 \u05d7\u05d3\u05e9 \u05de\u05d4\u05de\u05de\u05d5\u05e0\u05d4 \u05e2\u05dc \u05d4\u05d1\u05d8\u05d9\u05d7\u05d5\u05ea.', 403);
  const talk = await getTalk(env, t.id);
  if (!talk || talk.s !== S_PUB) return errPage('\u05d4\u05d4\u05d3\u05e8\u05db\u05d4 \u05d4\u05d6\u05d5 \u05dc\u05d0 \u05e4\u05d5\u05e8\u05e1\u05de\u05d4 \u05d0\u05d5 \u05d4\u05d5\u05e1\u05e8\u05d4.', 404);
  const x = textOf(talk, langOf(want));
  const lang = x.lang, L = LANGS[lang];
  const emps = await getEmps(env);
  const files = await signedFiles(env, talk.file_url);
  const byDep = {};
  for (const e of emps) { const d = e.dep || '\u05d0\u05d7\u05e8'; (byDep[d] = byDep[d] || []).push(e); }
  const opts = Object.keys(byDep).sort((a, b) => a.localeCompare(b, 'he')).map((d) =>
    '<optgroup label="' + esc(d) + '">' + byDep[d].map((e) => '<option value="' + esc(e.id) + '">' + esc(e.n) + '</option>').join('') + '</optgroup>').join('');
  const avail = langsOf(talk);
  const bar = avail.length < 2 ? '' : '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px">' + avail.map((l) =>
    l === lang ? '<span style="padding:6px 12px;border-radius:16px;background:#1e3a8a;color:#fff;font-size:14px;font-weight:700">' + esc(LANGS[l].name) + '</span>'
      : '<a href="' + esc(talkUrl(tok, l)) + '" style="padding:6px 12px;border-radius:16px;border:1px solid #1e3a8a;color:#1e3a8a;font-size:14px;text-decoration:none">' + esc(LANGS[l].name) + '</a>').join('') + '</div>';
  const nonce = newId() + newId();
  const inner = bar
    + '<div style="font-size:13px;color:#6b7280">' + esc(fdate(talk.d)) + '</div>'
    + '<h2 style="margin:4px 0 12px;font-size:20px">' + esc(x.title) + '</h2>'
    + (L.auto ? '<div style="font-size:12px;color:#92400e;background:#fef3c7;border-radius:6px;padding:6px 10px;margin-bottom:10px">' + esc(L.auto) + '</div>' : '')
    + (x.body ? '<div style="white-space:pre-wrap;background:#f9fafb;border-radius:8px;padding:12px;margin-bottom:12px">' + esc(x.body) + '</div>' : '')
    + files.map((u, i) => '<p><a href="' + esc(u) + '" target="_blank" rel="noopener" style="color:#1e3a8a;font-weight:700">' + esc(L.file) + (files.length > 1 ? ' ' + (i + 1) : '') + '</a></p>').join('')
    + '<form id="f" method="POST" action="/api/talk" style="border-top:1px solid #e5e7eb;padding-top:12px;margin-top:8px">'
    + '<input type="hidden" name="k" value="' + esc(tok) + '"><input type="hidden" name="l" value="' + lang + '"><input type="hidden" name="sig" id="sig">'
    + '<label style="display:block;font-weight:700;margin-bottom:4px">' + esc(L.you) + '</label>'
    + '<select name="emp" id="emp" required dir="rtl" style="width:100%;font-size:16px;padding:10px;border:1px solid #d1d5db;border-radius:8px;margin-bottom:12px"><option value="">' + esc(L.pick) + '</option>' + opts + '</select>'
    + '<label style="display:flex;gap:8px;align-items:center;margin-bottom:12px"><input type="checkbox" name="ok" value="1" required style="width:22px;height:22px;flex:none">' + esc(L.ok) + '</label>'
    + '<div style="font-weight:700;margin-bottom:4px">' + esc(L.sig) + '</div>'
    + '<canvas id="pad" style="width:100%;height:180px;border:2px dashed #9ca3af;border-radius:8px;touch-action:none;background:#fff"></canvas>'
    + '<button type="button" id="clr" style="margin:6px 0 14px;padding:6px 14px;border:1px solid #d1d5db;border-radius:8px;background:#fff;font-size:14px">' + esc(L.clear) + '</button>'
    + '<button type="submit" id="go" style="display:block;width:100%;padding:14px;border:0;border-radius:10px;background:#15803d;color:#fff;font-size:18px;font-weight:700">' + esc(L.send) + '</button>'
    + '</form><script nonce="' + nonce + '">' + sigScript(L) + '</script>';
  return page(L.title, inner, '', 200, nonce, lang);
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
  const lang = langOf(String(form.get('l') || '')), L = LANGS[lang];
  const back = '<p><a href="' + esc(talkUrl(tok, lang)) + '" style="color:#1e3a8a;font-weight:700">' + esc(L.back) + '</a></p>';
  const bad = (t, m, st) => page(L[t], '<p>' + esc(L[m]) + '</p>' + back, 'err', st || 400, '', lang);
  if (String(form.get('ok') || '') !== '1') return bad('errOkT', 'errOk');
  const talk = await getTalk(env, t.id);
  if (!talk || talk.s !== S_PUB) return errPage('\u05d4\u05d4\u05d3\u05e8\u05db\u05d4 \u05d4\u05d6\u05d5 \u05dc\u05d0 \u05e4\u05d5\u05e8\u05e1\u05de\u05d4 \u05d0\u05d5 \u05d4\u05d5\u05e1\u05e8\u05d4.', 404);
  const empId = String(form.get('emp') || '');
  const emp = (await getEmps(env)).find((e) => String(e.id) === empId);
  if (!emp) return bad('errNameT', 'errName');
  const sig = sigBytes(form.get('sig'));
  if (!sig) return bad('errSigT', 'errSig');

  const done = (name) => page(L.thanks + ', ' + name, '<p>' + esc(L.already) + '</p>' + back, 'ok', 200, '', lang);
  const dup = await fetch(SB + '/rest/v1/toolbox_reads?talk_id=eq.' + encodeURIComponent(talk.id) + '&emp_id=eq.' + encodeURIComponent(emp.id) + '&select=id', { headers: sbH(env) });
  if (dup.ok) { const rows = await dup.json(); if (Array.isArray(rows) && rows.length) return done(emp.n); }

  const id = newId();
  const name = 'sig-' + talk.id + '-' + String(emp.id).replace(/[^A-Za-z0-9_-]/g, '') + '-' + id + '.png';
  const up = await fetch(SB + '/storage/v1/object/' + BUCKET + '/' + name, { method: 'POST', headers: sbH(env, { 'Content-Type': 'image/png', 'x-upsert': 'false' }), body: sig });
  if (!up.ok) return bad('errSaveT', 'errSave', 502);
  const row = {
    id, talk_id: talk.id, emp_id: String(emp.id), emp_name: emp.n, dept: emp.dep || null, lang: textOf(talk, lang).lang,
    sig_url: SB + '/storage/v1/object/public/' + BUCKET + '/' + name,
    device: deviceOf(request.headers.get('user-agent')), read_at: new Date().toISOString(),
  };
  const ins = await fetch(SB + '/rest/v1/toolbox_reads', { method: 'POST', headers: sbH(env, { 'Content-Type': 'application/json', Prefer: 'return=minimal' }), body: JSON.stringify(row) });
  if (ins.status === 409) return done(emp.n);
  if (!ins.ok) return bad('errSaveT', 'errSave', 502);
  return page(L.thanks + ', ' + emp.n, '<p>' + esc(L.saved) + '</p><p style="color:#6b7280;font-size:14px">' + esc(textOf(talk, lang).title) + '</p>'
    + '<p><a href="' + esc(talkUrl(tok, lang)) + '" style="display:block;text-align:center;padding:12px;border-radius:10px;background:#1e3a8a;color:#fff;font-weight:700;text-decoration:none">' + esc(L.next) + '</a></p>', 'ok', 200, '', lang);
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
    if (request.method === 'GET') { const q = new URL(request.url).searchParams; return await showTalk(env, q.get('k') || '', q.get('l') || ''); }
    if (request.method !== 'POST') return errPage('\u05e4\u05e2\u05d5\u05dc\u05d4 \u05dc\u05d0 \u05e0\u05ea\u05de\u05db\u05ea.', 405);
    if (/application\/json/i.test(request.headers.get('content-type') || '')) return await makeLink(env, request);
    return await signTalk(env, request);
  } catch (e) {
    return errPage('\u05ea\u05e7\u05dc\u05d4 \u05d6\u05de\u05e0\u05d9\u05ea. \u05e0\u05e1\u05d4 \u05e9\u05d5\u05d1 \u05d1\u05e2\u05d5\u05d3 \u05d3\u05e7\u05d4.', 500);
  }
}
