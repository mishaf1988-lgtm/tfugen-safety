---
name: tfugen-ref
description: Reference sheet for TFUGEN Safety (tfugen-safety repo). Load this BEFORE grepping index.html for tables, helper functions, or Hebrew strings. Contains all 21 table schemas, helper function line numbers, pre-converted Hebrew-to-\\uXXXX dictionary, and copy-paste skeletons for new views/modals/saves. Trigger whenever editing index.html or adding a new module, table, view, or Hebrew UI string.
---

# TFUGEN Safety — Quick Reference (token-saver)

Use this file as the FIRST source of truth. Only grep `index.html` if the answer is not here.

## Supabase

- Base: `https://znhjtpcltrxxyfjczgvw.supabase.co`
- Globals in index.html: `SBU` (url), `SBK` (anon key), `SB_ON` (bool, true after sync)
- Headers helpers: `sbH()`, `sbHUpsert()`
- Storage bucket for photos/files: `incidents-photos` (via `_PHOTO_BUCKET`)
- Outbox keys: `OB_KEY`, `OB_ERR_KEY` (localStorage)

## Tables (21) — field map

Stored as `DB.{name}[]` in localStorage key `tfgn2`. `var DB=` is at line 3318 of index.html (measured 02/10/2026).

| Table | Purpose | Key fields (beyond `id`) |
|---|---|---|
| `docs` | Documents (0 rows, measured 02/10/2026) | `n`,`c`,`v`,`o`,`u`,`e`,`s`,`i`,`nt`,`file_url` (measured 02/10/2026) |
| `auds` | Internal audits | `n` subject,`a` auditor,`r` area,`d`,`f` findings,`sc` score,`s`,`f2`,`sm` summary (measured 02/10/2026) |
| `ncr` | Non-conformance (public 0 rows by design, 375 in `backup_ops_20260918`; measured 02/10/2026) | `num`,`d` description (not a date; the date is `sd`),`a`,`p`,`o`,`u`,`s`,`c`,`rc`,`rc_cat`,`sd`,`cd`,`notes`,`location_id`,`sens`,`verified_by` |
| `inc` | Incidents | `d`,`dt`,`ty`,`sv`,`l`,`dy`,`s`,`r`,`file_url` |
| `tr` | Training | `w`,`n`,`c`,`d`,`e`,`sc`,`s`,`file_url` |
| `rsk` | Risks | `n`,`type`,`p`,`sv`,`ctl`,`s` |
| `emp` | Employees (51, none has `r`; measured 02/10/2026) | `n`,`r` role,`dep`,`s` (a date, not a status),`eid`,`ph`,`ext_id`,`em` |
| `ptw` | Permit-to-work | `num`,`con`,`ds`,`de`,`ts`,`te`,`area`,`sup`,`wkr`,`desc`,`sg1n..sg4d` |
| `ppe` | PPE | `n`,`type`,`d`,`e`,`qty` |
| `med` | Medical | `n`,`emp`,`d`,`e`,`type`,`s` |
| `ins` | Insurance | `n`,`d`,`e`,`co`,`s` |
| `drl` | Drills | `d`,`type`,`s`,`notes` |
| `ctr` | Contractors | `n`,`co`,`d`,`e`,`s`,`cert` |
| `wst` | Waste | `d`,`type`,`qty`,`dest`,`s` |
| `hzm` | Hazmat (32 from permit 70011, 04/10/2026) | `n`,`un`,`hs` risk select (empty on import),`q` stock qty (null on import: the permit gives a max, kept in `em`),`loc`,`location_id`,`ms` SDS revision date (show with `fd`, not `eb`),`em` control measures,`file_url` SDS (04/10/2026) |
| `env` | Environmental | `d`,`type`,`val`,`lim`,`s` |
| `leg` | Legal register | `n`,`ref`,`d`,`e`,`s`,`notes` |
| `equip_inspections` | Equipment inspections | `code`,`n`,`vendor`,`loc`,`d`,`e`,`s`,`notes`,`photo_url` |
| `near_miss` | Near-miss reports | `d`,`t`,`descr`,`area`,`rep`,`sev`,`typ`,`s`,`notes`,`photo_url`,`ts` |
| `rounds` | Morning rounds | `d`,`inspector`,`fire`,`corridors`,`ppe`,`samples`,`chemicals`,`firstaid`,`notes` (booleans where applicable) |
| `ncr_ai` | NCR AI analyses (history) | `ncr_id`,`version`,`rc`,`c`,`o`,`u`,`created_at` |
| `hist` | Local audit log (not synced) | `tx`,`ts` |

**Conventions:**
- Expiry field is always `e` (single letter). Format: `YYYY-MM-DD`.
- Date `d`, due `due`, timestamp `ts`, status `s`.
- Empty dates → `null` (never `''`).
- Boolean checklist items in `rounds`: true/false.

## Helper functions — line numbers in index.html

Line numbers measured 02/10/2026 with `grep -n`; they drift with every PR, so `grep -n` before relying on one.

| Function | Line | Purpose |
|---|---|---|
| `g(id)` | 3321 | `document.getElementById` shortcut |
| `gv(id)` | 3322 | trimmed input `.value` |
| `gi(id)` | 3323 | int input |
| `gf(id)` | 3324 | float input |
| `gid()` | 3325 | unique id generator |
| `fd(d)` | 3328 | date → `DD/MM/YYYY` (empty → `-`) |
| `du(d)` | 3329 | days until expiry (negative = past, empty → 9999) |
| `eb(d)` | 3330 | expiry badge HTML (green/yellow/red) |
| `toast(msg,opts)` | 3334 | fading toast |
| `addLog(msg)` | 3344 | push to `DB.hist` |
| `sdb()` | 3372 | save DB → localStorage `tfgn2` (debounced 250ms, the write is in `window._sdbFlush=` 3350, `setItem` at 3357) |
| `ldb()` | 3380 | load DB from localStorage |
| `_obPush/_obDrain` | 3563/3725 | outbox queue |
| `sbIns/sbUpd/sbDel` | 3806-3808 | queue Supabase ops (`sbIns`/`sbUpd` are wrapped again by `window.sbIns=` 24844 / `window.sbUpd=` 24849) |
| `sbSync(silent)` | 3882 | pull all tables → DB |
| `askDel(tbl,id)` | 4256 | delete with confirm |
| `goPage(id)` | 4399 | show page (wrapped again by `window.goPage=` 25039 and `_g=goPage;window.goPage=` 25180) |
| `rPage()` | 4747 | re-render current page |
| `openModal(id)` | 4940 | show modal |
| `closeModal(id)` | 5057 | hide modal |
| `rDash()` | 6401 | dashboard render |
| `_expCollect()` | 7421 | collect expiries from 7 tables (`docs`,`ppe`,`med`,`tr`,`ctr`,`equip_inspections`,`hearing_tests`) plus `_drlNext`/`_audNext`/`_mrNext`/`_legNext`/`_thzRecheck` |
| `VIEW_CONFIG` | 14558 | view field map |
| `showView(tbl,id)` | 14652 | generic detail view |
| `_PHOTO_BUCKET` | 22556 | `'incidents-photos'` |
| `_imgCompress` | 22557 | canvas-based image resize |
| `_attachUrls` | 22693 | keyed by areaId — save `photo_url` from here |
| `_fileUpload` | 24852 | upload to Storage |
| `_attachPick(areaId,prefix)` | 24887 | file picker + upload |
| `_eqiQrLib(cb)` / `_eqiQrSvg(text,size)` | 8435 / 8448 | load qrcode-generator once (global `qrcode`), then any text as inline SVG QR. Used by equipment stickers and the weekly talk link (`m-tbt-link`); in a harness the CDN is blocked, so stub `window.qrcode` |
| `_tbtLinkEnd(r)` / `_tbtLinkErr(st,er)` / `_empTalksSection(e)` | - | weekly talk: the link runs out `toolbox_talks.link_at` (written by `talk.js` on each link) + 14 days, Israel's day; Hebrew text for `/api/talk` link errors by status; the employee card section (👁 on an employee) listing every published talk since `emp.s` (start date), signed or not, an outside signature counted by `id_no` = `eid`. The weekly mail warns when the link runs out within 7 days and under 80% signed (`talkLine`) |
| `hebrewName(env,raw)` / `heName(t)` (`functions/_ai.js`) | - | a name typed in any language to Hebrew letters (Gemini; Hebrew input kept as is; output accepted only if Hebrew letters, max 60). `toolbox_reads.emp_id` = `x:<ID or passport>:<name as typed>` = signed from outside the employee list; one signature per number per talk |

## Hebrew → \\uXXXX dictionary

**Pre-converted — copy-paste directly.**

| Word | Escape |
|---|---|
| שמור | `\u05e9\u05de\u05d5\u05e8` |
| ביטול | `\u05d1\u05d9\u05d8\u05d5\u05dc` |
| מחק | `\u05de\u05d7\u05e7` |
| ערוך | `\u05e2\u05e8\u05d5\u05da` |
| הוסף | `\u05d4\u05d5\u05e1\u05e3` |
| סגור | `\u05e1\u05d2\u05d5\u05e8` |
| חזור | `\u05d7\u05d6\u05d5\u05e8` |
| אישור | `\u05d0\u05d9\u05e9\u05d5\u05e8` |
| תאריך | `\u05ea\u05d0\u05e8\u05d9\u05da` |
| שעה | `\u05e9\u05e2\u05d4` |
| אזור | `\u05d0\u05d6\u05d5\u05e8` |
| סטטוס | `\u05e1\u05d8\u05d8\u05d5\u05e1` |
| תיאור | `\u05ea\u05d9\u05d0\u05d5\u05e8` |
| הערות | `\u05d4\u05e2\u05e8\u05d5\u05ea` |
| מדווח | `\u05de\u05d3\u05d5\u05d5\u05d7` |
| חומרה | `\u05d7\u05d5\u05de\u05e8\u05d4` |
| סוג | `\u05e1\u05d5\u05d2` |
| מפקח | `\u05de\u05e4\u05e7\u05d7` |
| תפוגה | `\u05ea\u05e4\u05d5\u05d2\u05d4` |
| בוצע | `\u05d1\u05d5\u05e6\u05e2` |
| פתוח | `\u05e4\u05ea\u05d5\u05d7` |
| סגור | `\u05e1\u05d2\u05d5\u05e8` |
| קריטי | `\u05e7\u05e8\u05d9\u05d8\u05d9` |
| גבוה | `\u05d2\u05d1\u05d5\u05d4` |
| בינוני | `\u05d1\u05d9\u05e0\u05d5\u05e0\u05d9` |
| נמוך | `\u05e0\u05de\u05d5\u05da` |
| עובד | `\u05e2\u05d5\u05d1\u05d3` |
| מחלקה | `\u05de\u05d7\u05dc\u05e7\u05d4` |
| ציוד | `\u05e6\u05d9\u05d5\u05d3` |
| בדיקה | `\u05d1\u05d3\u05d9\u05e7\u05d4` |
| דיווח | `\u05d3\u05d9\u05d5\u05d5\u05d7` |
| תמונה | `\u05ea\u05de\u05d5\u05e0\u05d4` |
| קובץ | `\u05e7\u05d5\u05d1\u05e5` |
| העלאה | `\u05d4\u05e2\u05dc\u05d0\u05d4` |
| שגיאה | `\u05e9\u05d2\u05d9\u05d0\u05d4` |
| טעינה | `\u05d8\u05e2\u05d9\u05e0\u05d4` |
| נשמר | `\u05e0\u05e9\u05de\u05e8` |
| לא נמצא | `\u05dc\u05d0 \u05e0\u05de\u05e6\u05d0` |
| קרוב לתאונה | `\u05e7\u05e8\u05d5\u05d1 \u05dc\u05ea\u05d0\u05d5\u05e0\u05d4` |
| סבב בוקר | `\u05e1\u05d1\u05d1 \u05d1\u05d5\u05e7\u05e8` |
| בדיקת ציוד | `\u05d1\u05d3\u05d9\u05e7\u05ea \u05e6\u05d9\u05d5\u05d3` |
| אין הרשאות | `\u05d0\u05d9\u05df \u05d4\u05e8\u05e9\u05d0\u05d5\u05ea` |

**For ad-hoc conversion:**
```bash
node -e "console.log([...'טקסט'].map(c=>'\\\\u'+c.charCodeAt(0).toString(16).padStart(4,'0')).join(''))"
```

## Code skeletons — copy & adapt

### 1. New VIEW_CONFIG entry (for `showView`)
```js
my_table:{title:'\u05db\u05d5\u05ea\u05e8\u05ea',back:'my-page',fields:[
  ['\u05ea\u05d0\u05e8\u05d9\u05da','d'],['\u05ea\u05d9\u05d0\u05d5\u05e8','descr'],['\u05e1\u05d8\u05d8\u05d5\u05e1','s']
],photo:'photo_url'}
```

### 2. Row template with view (👁) + delete (🗑)
```js
'<td>'+fd(r.d)+'</td><td>'+(r.descr||'\u2014')+'</td>'+
'<td><button class="btn btn-d btn-sm" onclick="showView(\'my_table\',\''+r.id+'\')">&#128065;</button> '+
'<button class="btn btn-d btn-sm" onclick="askDel(\'my_table\',\''+r.id+'\')">&#128465;</button></td>'
```

### 3. Save function pattern
```js
function svMy(){
  var descr=gv('my-desc');if(!descr){toast('\u05ea\u05d9\u05d0\u05d5\u05e8 \u05d7\u05d5\u05d1\u05d4');return;}
  var r={id:gid(),d:gv('my-d')||null,descr:descr,s:gv('my-s'),
         photo_url:_attachUrls['my-photo-area']||null,ts:new Date().toISOString()};
  if(!DB.my_table)DB.my_table=[];
  DB.my_table.push(r);sbIns('my_table',r);sdb();
  closeModal('m-my');toast('\u05e0\u05e9\u05de\u05e8 \u2713');rMy();rDash();
}
```

### 4. Photo/file attach area in modal HTML
```html
<div class="field fw"><label>&#128247; &#1510;&#1500;&#1501; / &#1511;&#1493;&#1489;&#1509;</label>
  <div id="my-photo-area">
    <button type="button" class="btn btn-s" style="width:100%" onclick="_attachPick('my-photo-area','my')">&#128247; &#1510;&#1500;&#1501;</button>
  </div>
</div>
```

### 5. Migration skeleton (SQL Editor → run manually)
```sql
-- migrations/YYYY-MM-DD_<name>.sql
ALTER TABLE tbl ADD COLUMN IF NOT EXISTS col TEXT;
-- rollback: ALTER TABLE tbl DROP COLUMN IF EXISTS col;
```

## Known manual steps (user must do in Supabase dashboard)

1. SQL Editor → paste migration → Run
2. Storage → New bucket `incidents-photos` → Public: ON
3. Storage → bucket → Policies → New policy → name `allow_anon_insert`, operation INSERT, role anon, USING `true`, WITH CHECK `true`

## Gotchas

- Account skills (`project-files/claude-ai-skill/*/`): `account-skill-test.py` checks that every `references/*.md` named in a SKILL.md exists, and that "(N כללים" next to a references file equals the numbered rules there, numbered 1..N once each. Adding a rule to `lessons.md` = bump N in SKILL.md in the same commit (04/10/2026, it said 31 with 32).
- Recurring duties with no expiry of their own (drills, internal audits): `_drlNext()` / `_audNext()` compute `e` = last done + 12 months per type/area and feed both `_expCollect` and `_expNoDate`; the row action is `_drlNew(ty)` / `_audNew(area)` in `rExp`. Since 02/10/2026 also `_mrNext()` (one row, any review kind, button `goPage('mr')`; no review at all = a no-date row once `SB_ON`, because 9.3 is red when empty) and `_legNext()` (one row per law from `c_date`, buttons view / `_legReconfirm(id)` / `editLeg(id)`); shared date math `_plusMonths(d,n)`. A new recurring duty = one more `_xxxNext` in the same three places. Since 04/10/2026 also `_envNext()` (the factory's measurements from `env` by `ty`: `_ENV_DUTIES` [type, months], 0 = once a calendar year, due 31/12 of the next year; button `_envNew(ty)`; mail: `ENV_DUTIES`/`envOf`). The mail test's fetch mock lists the duty tables by name (`weekly-digest-test.mjs`, `const rec = [...]`): a new `REC_SRC` table goes there too, or it reads as "not read" and breaks the expFail check. Empty register = no rows at all, unless its ISO row is red when empty. Which rows are grey (`na`) when empty is Michael's questionnaire answer (DECISIONS 30/09/2026: 6.1.2, 6.1.3, 7.5, 8.1, 8.2 drills, 9.1.2, 9.2; the evidence is in his folders): never turn one red/warn without asking him. Test: `recurring-duties-test.js`.
- A follow-up on a closed row (hazard recheck): one date column (`tour_hazards.recheck_d`), pending while it is empty or older than the close date, so a reopen needs no reset. `_thzRecheck()` feeds `_expCollect`; the row buttons are `_thzRckDo(id,held)`. Not in the tasks page: a virtual task there gets a 🗑 that deletes the source row.
- Objectives: `_OBJECTIVES` (targets) + `_objMeasure()` (one measure for the review card `#mr-obj` and ISO 6.2). A register with no rows = `na`, never 0%.
- Expiry sources: `_expCollect` in index.html and `EXP_SRC` in `functions/api/weekly-digest.js` (the 30-day block of the weekly mail) list the same tables. A new expiry table = an entry in both. Recurring duties (drill, audit, review, law) are in the mail through `REC_SRC` / `recurringOf` (same 12-month rule, rows with no last date left out): a new `_xxxNext` = one more `REC_SRC` entry too. A duty whose ISO row is red when empty (today only `mgmt_reviews`) carries `true` as the fifth `REC_SRC` field: `neverOf(sets)` turns a table read and empty into the red line "never done" above the expiry block (`meta.never`, `counts.never`); a failed read stays "not read". `ctr`, `ppe`, `med` keep `e` as text: filter by `YYYY-MM-DD`, never trust `lte` alone.
- Empty statutory registers: `_REQ_REGS` / `_emptyReqRegs()` / `_emptyRegText()` (next to `_expCollect`), shown in `#exp-empty-reg` and `#dash-alerts`. Gated on `SB_ON`. Add a register = one entry in `_REQ_REGS` **and** in `REQ_REGS` of `functions/api/weekly-digest.js` (the weekly mail reads them with `limit=1`; a failed read is not called empty).
- Findings / decisions as tasks: a row editor in the form (`_mrDecRow` for `m-mrsave`, `_drlFndRow` for `m-drl`), each row = one `tasks` row with `source_table` + `source_id`; add the table to `_tskSrcLabel` and `_sourceIcon`. A form with such rows resets them in `openModal` (else a cancelled row is saved next time).
- Source -> NCR link (near-miss, internal audit): no column. `_chainNmToNcr` / `_chainAudToNcr` fill the form and set `_xxChainPending`; `svNcr` writes the NCR number into the source text (`nm.notes`, `aud.sm`), read back by `/NCR-\d+/`. `openNewNcrModal` clears the pending ids, and the audit link applies only to a new NCR.
- An emoji in a JS string above U+FFFF = surrogate pair (`ud83d udd34` style), never a 5-digit escape (`rule1-hebrew-test.js` checks `u1f...`).
- Harness tests that call `goPage` run as `reporter` and get kicked to `dash`: stub `window._role=()=>'admin'` and `_isAdminUser=()=>true`.

- Server calls from the DB / cron carry `x-notify-secret` = `TRUSTEE_NOTIFY_SECRET`. Every endpoint checks it fail closed: `if (!want || header !== want) 403` (02/10/2026, the last two were `trustee-notify.js` and `trustee-log.js`). Harness tests of such an endpoint put the secret in `env` and the header in the default request. Live check: `GET /api/trustee-notify?probe=1`.

- A warning printed by a harness test is swallowed: `lean-harness.py` shortens a green run to one line. A signal that must be seen but cannot be red (too many false positives) prints `::warning title=...::` from a step in `tests.yml`; GitHub shows it on the PR (`status-dup-test.py`, 02/10/2026).

- `openModal` fills every EMPTY `input[type=date]` with today, except `data-nodefault`. Only a "when did it happen" date defaults; expiry, target, closing, approval, last review, joining and leaving dates carry `data-nodefault` (27 fields, 03/10/2026). A new date field fails `date-defaults-test.js` until it is put in its TODAY or NONE list. `toast()` decodes `&#NNNN;` since 03/10/2026 (13 calls printed `&#10003;` raw); still prefer `\u2713`.
- Some tests cut one function's source out of index.html and run it alone (`vitre-review-test.mjs` takes `_truRouteVitreRecipient` with `new Function`). A new helper called inside such a function must be added to the cut, or the suite crashes with "NO SUMMARY" (03/10/2026, `_empLeft`). `grep -n "cut('function <name>" tests/harness/*` before calling a new helper from an existing function.
- Reading Michael's OneDrive safety folder from a cloud session: `/api/od-read` (only under `שולחן העבודה/ניהול בטיחות/`). Put a one-off token in `server_state` (`od_raw_token`, 40+ chars, and `od_raw_exp` a few minutes ahead) with `execute_sql`, then `curl -X POST https://tapugan-safety.pages.dev/api/od-read -H 'x-raw-token: <tok>'` with `{"list":"<folder>"}` (files and sub-folders) or `{"path":"...","raw":true}` (the bytes; .pdf/.docx/.doc/.txt/.csv too since 04/10/2026). Read a PDF here with `pdftotext`. Expire the token when done. Direct curl to nevo.co.il is 403 from the cloud; WebFetch works.
- One file outside that folder: `UPLOAD_LOG` (`שולחן העבודה/סקילים להעלאה/יומן.txt`, the skill upload task's log). `od-read` `{"uploadLog":true,"raw":true}` with the same one-off token; the weekly mail reads it itself (`uploadLog`/`uploadLine`, red after 8 days or on a failure word). Never widen `ROOT` for it (04/10/2026).
- What is new in that folder: do not walk the tree (`od-read` list, one call per folder, did not finish in 10 minutes on 04/10/2026, and a Pages Function has 50 subrequests). `/api/od-scan` (cron nightly) reads Graph `root/delta` from the last link and keeps files created inside the folder in `server_state.od_scan` (`files[]`: `p` path under the folder, `c` created, last 62 days). Delta items have no `parentReference.path`: the path comes from parent ids, unknown parents by `GET items/{id}`. Test: `od-scan-test.mjs`. Any new `/api` path that pg_cron calls also goes in `MACHINE_PATHS` (`functions/_middleware.js`), or Supabase gets the country gate's 403 HTML (lesson 52). A new function imported from another `functions/api/*.js` needs its `sed` in `run.sh` (`'./od-read.js'` -> `.mjs`).
- Hazard tours, trustees and equipment on a phone: `screens-visual-test.js` (page, new form, edit form, detail; each must show its seeded row and no `YYYY-MM-DD`). The app's own paths, not the generic ones: equipment edits through `eqiEdit(id)` (not in `_EDIT_MODS`), and `showView('trustee_reports',id)` falls back to `_truGoAll` (the full list), so measure `#pg-trustees`. A trustee row is a hazard only with `ok:false`. `showView` turns a bare `YYYY-MM-DD` into `fd()` since 04/10/2026.
- The worker's page at 375 px in four languages: `talk-page-visual-test.mjs` (no sideways scroll, nothing off screen, no cut placeholder or button, field order). `SHOTS=/some/dir bash tests/harness/run.sh talk-page-visual` saves the pictures for a human look. The manager's side: `toolbox-visual-test.js` (`measure(sel)` per dialog; a wide table may scroll inside its `.tbl-wrap`, the box must fit). An entity in innerHTML is fine (the browser decodes it); one in `textContent` shows raw, and the test fails on it. Copy this test for a new module's screens.
- Who left: `_empLeft(e)` = `emp.left_d` up to today, Israel's day. Filtered in the weekly talk (`_tbtEmpSet`, `_tbtEmpN`, `tbtWho`, `talk.js getEmps`, the mail's `talkData`), the name pickers (`emp-names-list`, `tsk-assignee-list` in `openModal`), the dashboard count (`ke` in `rDash`) and the trustee SMS (`_truRouteVitreRecipient`); search and the employee's own card still show them. Signed version: `toolbox_reads.text_hash` = SHA-256 of `[lang, title, body, file_url]`, `textHash` in talk.js = `_tbtTextHash` in the app.
- Excel import with SheetJS: `sheet_to_json(...,raw:false)` turns a date cell into the US display text ("7/25/25"), which a DD/MM parser reads as day 7 of month 25. Read raw (the Excel serial) and convert with the UTC serial math (`_eqiXl2Date`), and pass the raw cell, not `String(cell)`. `cellDates:true` gives a local-midnight Date that `toISOString()` moves a day back east of UTC. Test: `eqi-xl2-test.js` (04/10/2026, found running the real file before importing it).
- `_attachUrls[areaId]` is set ONLY after upload resolves. If user saves too fast → `photo_url:null`. Block save while "מעלה..." is visible.
- `showView` early-returns if `VIEW_CONFIG[tbl]` is missing — add it whenever you render the table.
- `_obDrain` is gated by `SB_ON`. Emp-session must flip `SB_ON=true` to sync.
- A `date` column (`docs.u`, `emp.s`, measured 03/10/2026) rejects `''` with a 4xx, so a form that sends `gv('x')` for an empty date fails the whole save silently (next line). `ptw.ds/de/sgNd` and `hzm.ms` are `text` and would store `''`. Test: `empty-dates-test.js`, and `empty-dates-static-test.py` for every `type="date"` input. Excel NCR import (`xlParse`/`xlDate`): `ncr` has no `src_date` column (03/10/2026), the date goes to `sd`; `xlDate` returns null for an empty or unreadable cell (`ncr-batch2-test.js`).
- Outbox retries forever on 4xx — column-missing errors are silent. Check outbox badge.
- Hebrew in JS strings must be `\uXXXX` escapes (CLAUDE.md rule).
- `keyboard-only-test.js` (02/10/2026) fails on a long dash, «», curly quotes, `…` and maqaf in text people see (HTML text/attributes, entities, JS string literals; comments and CSS skipped). Its string scanner is a regex, so a regex literal whose character class holds `'` or `"` is read as a string: keep such characters before the quotes in the class (`[\s.’׳'"-]`, `_truNameKey`). Middle dot: replaced by a comma everywhere people see it (Michael, 03/10/2026), and the test fails on it, except lines that read or write it as a DATA separator: `trustee_reports.loc` 'area \u00b7 detail' and `mgr_note` 'not relevant: ... \u00b7 ...' (old rows carry it; a writer line says `// data format`). Same rule in `server-keyboard-test.js` (close-hazard.js, hazard-file.js). Arrows stay as button icons.
