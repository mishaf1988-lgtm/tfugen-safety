---
name: tfugen-ref
description: Reference sheet for TFUGEN Safety (tfugen-safety repo). Load this BEFORE grepping index.html for tables, helper functions, or Hebrew strings. Contains all 21 table schemas, helper function line numbers, pre-converted Hebrew-to-\\uXXXX dictionary, and copy-paste skeletons for new views/modals/saves. Trigger whenever editing index.html or adding a new module, table, view, or Hebrew UI string.
---

# TFUGEN Safety — Quick Reference (token-saver)

Use this file as the FIRST source of truth. Only grep `index.html` if the answer is not here.

## Supabase

- Base: `https://znhjtpcltrxxyfjczgvw.supabase.co`
- Globals in index.html: `SBU` (url), `SBK` (anon key), `SB_ON` (bool, true after sync)
- **The factory's details = `SITE`** (17/10/2026): name, brand, shortName, owner (the safety manager's name), company, appUrl, host, supabaseUrl/Key, loginDomain, adminEmail, managerEmail, odRoot, backupPrefix, filePrefix, waTemplates, and the factory's lists: depts (hazard register = `_THZ_DEPTS`), areaDept (`AREA_DEPT`), tbtDepts (`_TBT_DEPTS`, talk.js `TBT_DEPTS`), tbtReport (server), trainPlan/trainPlanAuto (`_TP_SEED`/`_TP_AUTO`, form 08.01). A department name in a code line is a factory value too: add it to SITE, not to a list in index.html (the export scan fails on Tapugan's departments). Never write "Tapugan", "tfugen", the project id, the Hebrew name or the manager's name in new code: `'+SITE.name+'` in a string, `<span data-site="{shortName}">` in markup. The values live in `functions/_site.js`; `<script id="site-config">` in the page is written from it by `node tests/harness/site-config-test.mjs --write`, and that test fails on any new mention. The logo is the file `logo.jpg` (the page asks for `/logo.jpg`, prints take it from `.topbar-left img`); after replacing it run `python3 tools/make-logo.py` (the server copy in `_logo.js`) and `tools/make-icons.js`; the same test fails on a stale `_logo.js`. The app name in `manifest.webmanifest` and the letter in `icon.svg` are written by `--write` too. A new SITE key goes into `tools/platform/_site.js` too (empty value; the test fails otherwise), and a value that names the factory never goes in a code line: `node tools/export-platform.mjs <dir>` (the safety-platform copy) fails on it; comments are rewritten in the copy only. A test that runs a function sliced out of index.html passes `SITE: clientSite()` (from `functions/_site.js`) in its context (`vitre-close-test.mjs`).
- Headers helpers: `sbH()`, `sbHUpsert()`
- Storage bucket for photos/files: `incidents-photos` (via `_PHOTO_BUCKET`)
- Outbox keys: `OB_KEY`, `OB_ERR_KEY` (localStorage)

## Tables (21) — field map

Stored as `DB.{name}[]` in localStorage key `tfgn2`. `var DB=` is at line 3318 of index.html (measured 02/10/2026).

| Table | Purpose | Key fields (beyond `id`) |
|---|---|---|
| `train_plan` | Annual training plan, form 08.01 (15/10/2026, 0 rows at creation). One row per item per year; screen = card `#tp-card` on the training page (`rTp`) | `yr`,`n` (unique together),`t`,`who`,`aud`,`q` ("1,3" = target quarters),`done` (jsonb `[{d,by,note,file_url}]` by hand). Done automatically = a CLOSED annual/quality talk whose `subjects` hold the item's subject: `_TP_AUTO` in index.html and `PLAN_AUTO` in `weekly-digest.js` must stay the same. Backed up in `backup-od.js` with the talks file |
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
| `wst` | Waste | `d`,`ty`,`q`,`c` (קוד),`h` (מוביל),`site` (אתר קליטה),`cert` (מספר תעודה),`t` (טיפול),`file_url` (13/10/2026, נמדד במסד) |
| `hzm` | Hazmat (32 from permit 70011, 04/10/2026) | `n`,`un`,`hs` risk select (empty on import),`q` stock qty (null on import: the permit gives a max, kept in `em`),`loc`,`location_id`,`ms` SDS revision date (show with `fd`, not `eb`),`em` control measures,`file_url` SDS (04/10/2026) |
| `env` | Environmental | `d`,`type`,`val`,`lim`,`s` |
| `leg` | Legal register | `n`,`ref`,`d`,`e`,`s`,`notes` |
| `equip_inspections` | Equipment inspections | `code`,`n`,`vendor`,`loc`,`d`,`e`,`s`,`notes`,`photo_url`,`resp_area` (area responsible, key of `SITE.equipAreas`; null = the safety manager's, 20/10/2026; `_eqiAreaLabel`/`_eqiSetArea`) |
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
| `sbIns/sbUpd/sbDel` | ~4330 | queue Supabase ops (`sbIns`/`sbUpd` are wrapped again by the OneDrive hook, `window.sbIns=` / `window.sbUpd=` ~27650: a new argument must be forwarded there too, 16/10/2026 the pin of 14.2 was swallowed). `sbUpd(tbl,row,pin)`: `pin` = the version the form was opened at (`_editPin`/`_editPinTake`) |
| `sbSync(silent)` | 3882 | pull all tables → DB |
| `askDel(tbl,id)` | 4256 | delete with confirm |
| `_aiThin(t)` / `_aiFwNone(t)` | grep | AI buttons: description only a label or under 8 chars / 5-Why answer "not enough". With `_AI_THIN_MSG`, `_AI_THIN_ANS`, `_AI_THIN_RULE`, `_AI_FW_RULE` |
| `goPage(id)` | 4399 | show page (wrapped again by `window.goPage=` 25039 and `_g=goPage;window.goPage=` 25180) |
| `rPage()` | 4747 | re-render current page |
| `openModal(id)` | 4940 | show modal |
| `closeModal(id)` | 5057 | hide modal |
| `rDash()` | 6401 | dashboard render |
| `_expCollect()` | 7421 | collect expiries from 7 tables (`docs`,`ppe`,`med`,`tr`,`ctr`,`equip_inspections`,`hearing_tests`) plus `_drlNext`/`_audNext`/`_mrNext`/`_legNext`/`_thzRecheck` |
| `_expOff(r)` | grep | `s` starting "לא רלוונטי" = taken out of tracking on purpose: skipped by `_expCollect` and `_expNoDate`, and by `xlsx-gaps.js` (`OFF`, reads `n,e,s`). A new expiry scanner checks it too (BACKLOG 12.11, 10/10/2026) |
| `<script id="app-main">` / `/app.js` (`functions/_appjs.js`, `app.js.js`) | 3246 | the main script is served as `/app.js?v=<deploy>` (10/10/2026, DECISIONS): keep the `id` on the tag and never write `</script>` inside it. Tests still load index.html inline; `app-split-test.mjs` covers the split. A new helper module in `functions/` imported by an api file needs the copy+sed in `run.sh` |
| `PUBLIC_PATHS` (`functions/_middleware.js`) | - | the only non-`/api/` URLs the site serves (10/10/2026, security scan): every other path is 404. A new static file the app needs (icon, page) goes into the list, or it 404s on the live site; `geo-gate-test.mjs` section 9 |
| `SPEAK` / `speakScript(lang)` (`functions/api/talk.js`) | - | "read aloud" on the weekly-talk page: `speechSynthesis`, shown only when the phone has a voice in the page language (`he`/`iw`, `ar`, `ru`, `am`); `talk-speak-test.mjs` |
| `_heFold(s)` / `_heMatch(q,texts)` | - | spelling-tolerant Hebrew search (12/10/2026): drops א/ו/י, niqqud, final forms and punctuation on both sides; a query of only א/ו/י falls back to plain substring. Used by the expiry page box `#exp-q` (`expSearch`). Reuse it for any new search box instead of `toLowerCase().indexOf` |
| `_lockWipeSensitive()` / `_LOCK_WIPE` | - | called first thing in `_lockNow` (12/10/2026): empties `emp`, `med`, `hearing_tests` in DB and deletes them from the `tfgn2` blob in place. Never write `tfgn2` from DB inside the lock: at startup DB is still empty. A new sensitive table goes into `_LOCK_WIPE` |
| `_signIcon(emoji)` / `_SIGN_MAP` / `_SIGN_GLYPH` | - | redesign phase 2 (12/10/2026): an emoji to an inline ISO 7010-style sign (warn triangle, must circle, safe square, fire square); unknown emoji escaped as is. Used by the Today rows; reuse it when phase 3 replaces emoji elsewhere. Sign tokens: `--s-yellow/red/green/blue/ink`, fonts `--f-sign/--f-plex/--f-mono` |
| phase 3 CSS block | - | redesign phase 3 (13/10/2026): the last block before the first `</style>` ("Phase 3 of the redesign") sets the sign look for shared components; a new component rule goes above it or it loses on order. `#pg-dash` rules stay (higher specificity). Tests that compare colours: expect `--s-*` values (`sign-app-test.js`). |
| `_tabOpen(t)` / `_TAB_OF` / `_sheetBtnTab(b)` / `_tabMark(id)` | - | redesign phase 4 (13/10/2026): `#tabbar` under the top bar; `today` goes to dash, `field`/`reg`/`mgmt` open `m-modules-sheet` filtered by `sheet.dataset.tab` (in `_modulesSheetFilter`, frequent group last, deduped). A new page needs a `_TAB_OF` entry or `tabs-nav-test.js` fails. |
| phase 5 register row CSS | - | redesign phase 5 (13/10/2026): under 600px every `.tbl-wrap` row (except `#tb-eqi`, `#tb-trustees`) orders cells: first labelled = name (1), cells with a `.b` badge (2), other labelled = small "label:" facts (3), unlabelled = buttons (9) after a `tr::after` rule. A table that needs its own layout gets a `tbody:not(#tb-x)` exclusion. Test reads `data-label` one tick after render (TBL-1 observer). |
| `_SHORT_FORMS` / `_shortForm(id)` | - | redesign phase 5c (13/10/2026): per modal, the ids of the secondary fields; `openModal` moves their `.field` into `details.more-f` once (ids and handlers unchanged) and counts the filled ones in the summary. Never list a starred field, an expiry `*-e` or a file area (`short-forms-test.js`). |
| `_lgWait(p,ms,step)` / `_lgMark` / `_lgMsg` / `_LG_WAIT_MS` | - | sign-in (15/10/2026): any step that waits on a server goes through `_lgWait` (rejects `timeout:<step>` after `_LG_WAIT_MS`, 20s) and its error goes through `_lgMsg` with `_loginErr(msg,true)` (sticky; the plain one clears after 2.5s). Step times per sign-in in localStorage `tfgn_login_times` (last 10), shown by `_sysChkLogin` in the system screen. A new step without a limit fails `login-wait-test.js` |
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

## Gotchas: `references/gotchas.md`

כ-4,200 מילים של מלכודות שנמצאו בקוד (בדיקות שחותכות את `index.html` בין שמות פונקציות, נעילות, סנכרון, מטמון ועוד). הועבר לקובץ נפרד ב-27/10/2026 (מיכאל בשאלון: "בצע: לפצל את שני הגדולים"; המדריך של Anthropic לבניית skills: SKILL.md עד 5,000 מילים, והפירוט ב-`references/`). **לפני עריכה באזור מסוים ב-`index.html`:** `grep -n -i "<מילת מפתח>" .claude/skills/tfugen-ref/references/gotchas.md`, ולקרוא רק את מה שנמצא.
