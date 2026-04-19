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

Stored as `DB.{name}[]` in localStorage key `tfgn2`. Line 967 of index.html.

| Table | Purpose | Key fields (beyond `id`) |
|---|---|---|
| `docs` | Documents | `n`,`type`,`d`,`e`,`ref`,`notes`,`file_url` |
| `auds` | Audits | `d`,`type`,`auditor`,`scope`,`s`,`notes` |
| `ncr` | Non-conformance (375 prod rows) | `num`,`d`,`src`,`type`,`desc`,`rc`,`c`,`o`,`u`,`s`,`due` |
| `inc` | Incidents | `d`,`dt`,`ty`,`sv`,`l`,`dy`,`s`,`r`,`file_url` |
| `tr` | Training | `w`,`n`,`c`,`d`,`e`,`sc`,`s`,`file_url` |
| `rsk` | Risks | `n`,`type`,`p`,`sv`,`ctl`,`s` |
| `emp` | Employees | `n`,`role`,`dept`,`ph`,`s` |
| `ptw` | Permit-to-work | `num`,`con`,`ds`,`de`,`ts`,`te`,`area`,`sup`,`wkr`,`desc`,`sg1n..sg4d` |
| `ppe` | PPE | `n`,`type`,`d`,`e`,`qty` |
| `med` | Medical | `n`,`emp`,`d`,`e`,`type`,`s` |
| `ins` | Insurance | `n`,`d`,`e`,`co`,`s` |
| `drl` | Drills | `d`,`type`,`s`,`notes` |
| `ctr` | Contractors | `n`,`co`,`d`,`e`,`s`,`cert` |
| `wst` | Waste | `d`,`type`,`qty`,`dest`,`s` |
| `hzm` | Hazmat | `n`,`cas`,`qty`,`sds`,`loc` |
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

| Function | Line | Purpose |
|---|---|---|
| `g(id)` | 970 | `document.getElementById` shortcut |
| `gv(id)` | 971 | trimmed input `.value` |
| `gi(id)` | 972 | int input |
| `gf(id)` | 973 | float input |
| `gid()` | 974 | unique id generator |
| `fd(d)` | 975 | date → `DD/MM/YYYY` (empty → `—`) |
| `du(d)` | 976 | days until expiry (negative = past) |
| `eb(d)` | 977 | expiry badge HTML (green/yellow/red) |
| `toast(msg)` | 979 | fading toast |
| `addLog(msg)` | 980 | push to `DB.hist` |
| `sdb()` | 981 | save DB → localStorage |
| `ldb()` | ~982 | load DB from localStorage |
| `_obPush/_obDrain` | 997/1018 | outbox queue |
| `sbIns/sbUpd/sbDel` | 1038-1040 | queue Supabase ops |
| `sbSync(silent)` | 1042 | pull all tables → DB |
| `askDel(tbl,id)` | 1144 | delete with confirm |
| `goPage(id)` | 1178 | show page |
| `rPage()` | 1187 | re-render current page |
| `openModal(id)` | 1192 | show modal |
| `closeModal(id)` | 1226 | hide modal |
| `rDash()` | 1441 | dashboard render |
| `_expCollect()` | 1496 | collect expiries from 5 tables |
| `VIEW_CONFIG` | 1836 | view field map |
| `showView(tbl,id)` | 1890 | generic detail view |
| `_imgCompress` | 2362 | canvas-based image resize |
| `_PHOTO_BUCKET` | 2361 | `'incidents-photos'` |
| `_fileUpload` | 2388 | upload to Storage |
| `_attachUrls` | 2379 | keyed by areaId — save `photo_url` from here |
| `_attachPick(areaId,prefix)` | 2414 | file picker + upload |

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

- `_attachUrls[areaId]` is set ONLY after upload resolves. If user saves too fast → `photo_url:null`. Block save while "מעלה..." is visible.
- `showView` early-returns if `VIEW_CONFIG[tbl]` is missing — add it whenever you render the table.
- `_obDrain` is gated by `SB_ON`. Emp-session must flip `SB_ON=true` to sync.
- Outbox retries forever on 4xx — column-missing errors are silent. Check outbox badge.
- Hebrew in JS strings must be `\uXXXX` escapes (CLAUDE.md rule).
