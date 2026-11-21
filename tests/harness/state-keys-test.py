#!/usr/bin/env python3
# Retro 15/11/2026 (d): inv_month was written by the server and nobody decided whether agents may read it, so the
# assistant could not. Every server_state key the server code writes must be a decision: readable by agents
# (STATE_READ in routine-db.js) or private (STATE_PRIVATE below, with the reason). A new key in neither list fails here.
# Static: reads functions/**/*.js, finds every write (stateSet of _onedrive.js, stateCas of _cas.js, every function
# that passes its own parameter on to one of them, and every direct POST to server_state) and names the key: a literal,
# a constant (also an imported one), or a piece built at run time that DYNAMIC declares.
# List what the scan sees: python3 tests/harness/state-keys-test.py --list
import os, re, sys, glob, fnmatch

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
passed = failed = 0
def check(label, cond, detail=None):
    global passed, failed
    if cond: passed += 1; print('  ✓ ' + label)
    else: failed += 1; print('  ✗ ' + label + ('  -> ' + str(detail)[:2500] if detail is not None else ''))

# Keys the server writes for itself: agents get none of them through state_get. A pattern (*) only where the key is
# built at run time. To let agents read one: move it to STATE_READ in routine-db.js (a security-review change).
STATE_PRIVATE = [
    # secrets and identity: never to an agent
    'induction_code', 'trustee_code', 'vapid_keys', 'chat_push_subs', 'od_raw_token', 'od_raw_exp',
    'ms_auth_nonce', 'owner_wa_uid', 'guess_locks',
    # whole deleted rows, signatures and questions waiting for Michael's tap (free text of people)
    'undo_log', 'undo_ask', 'del_ask', 'tour_close_ask', 'sign_requests', 'sign_pick',
    'sign_mail', 'claude_log_q',
    # locks and 'run again' marks of leased jobs (runLeased, stateLock)
    '*_lock', '*_dirty',
    # WhatsApp plumbing: de-duplication, delivery marks, failures waiting for a retry
    'wa_hook_seen', 'wa_meta_out', 'wa_owner_in_at', 'wa_status_last', 'wa_fail_pending', 'wa_morning_last',
    'wa_watch_last', 'voice_replied',
    # the morning cron's own marks
    'cal_sent', 'dev_warned', 'ocr_auto', 'deck_check',
    # once-a-day counters and probes of routine-db
    'fire_probe_day', 'hazard_probe_day', 'invoice_set_day', 'task_add_day', 'relay_fire_at', 'skip_moved',
    'work_claims',
    # the hazard workbooks (hazard-file.js): signatures, cTags, run results per file
    'hazard_xlsm_at', 'hazard_xlsm_ctag', 'hazard_xlsm_dismissed', 'hazard_xlsm_dropped', 'hazard_xlsm_err', 'hazard_xlsm_err_at',
    'hazard_xlsm_last', 'hazard_xlsm_logq', 'hazard_xlsm_ok_at', 'hazard_xlsm_rows', 'hazard_xlsm_sheets', 'hazard_xlsm_sig',
    'hazard_xlsm_url', 'hazard_xlsm_year', 'hazard_xlsx_at', 'hazard_xlsx_ctag', 'hazard_xlsx_dismissed', 'hazard_xlsx_dropped',
    'hazard_xlsx_err', 'hazard_xlsx_err_at', 'hazard_xlsx_last', 'hazard_xlsx_logq', 'hazard_xlsx_ok_at', 'hazard_xlsx_rows',
    'hazard_xlsx_sheets', 'hazard_xlsx_sig', 'hazard_xlsx_url', 'hazard_xlsx_year', 'hazard_prune_day', 'hazard_prune_report',
    'hazard_snap_month',
    # the hazard report mail (hazard-report.js)
    'hazard_report_last', 'hazard_send_key', 'hazard_status_depts', 'hazard_status_last',
    # the committee deck (hazard-deck.js)
    'deck_at', 'deck_ctag', 'deck_err', 'deck_err_at', 'deck_err_kind', 'deck_meeting_date',
    'deck_ok_at', 'deck_report', 'deck_s3_month', 'deck_s5', 'deck_sig', 'deck_url',
    'deck_ver', 'deck_week',
    # the trustee log and its notices (trustee-log.js, trustee-notify.js)
    'trustee_log_at', 'trustee_log_diag', 'trustee_log_err', 'trustee_log_ok_at', 'trustee_log_sig', 'trustee_log_url',
    'trustee_photos', 'trustee_photos_url', 'notify_cap_day', 'notify_fail',
    # the maintenance desk link (maint-hook.js)
    'maint_closed', 'maint_err', 'maint_from', 'maint_sent',
    # results of scheduled server jobs, shown in the app or in the weekly mail (the app reads them through its own endpoints)
    'backup_od', 'skip_seen', 'fault_alert', 'sync_watch', 'mail_inbox_at', 'mail_inbox_done',
    'mail_inbox_since', 'registry_probe', 'vitre_sync', 'weather_tomorrow', 'weekly_digest', 'xlsx_gaps',
    'push_gone', 'push_last', 'push_ok_at', 'induction_equip_alert',
    # works.js: the permit mails and reminders
    'works_ask_last', 'works_mail_last', 'works_open_last', 'works_remind_last', 'works_sub',
]

# Pieces of a key that exist only at run time: (file, the expression as written) -> what it can be.
# '@STATE_WRITE' = the keys op state_set accepts (it refuses any other).
DYNAMIC = {
    # runLeased(env, name): the lock and the "run again" mark of every leased job
    ('functions/_onedrive.js', 'lk'): ['*_lock'],
    ('functions/_onedrive.js', 'dk'): ['*_dirty'],
    # the two hazard workbooks (FILES in hazard-file.js)
    ('functions/api/hazard-file.js', 'K'): ['hazard_xlsm_', 'hazard_xlsx_'],
    ('functions/api/hazard-file.js', 'which'): ['xlsm', 'xlsx'],
    ('functions/api/hazard-file.js', 'sk'): ['hazard_xlsm_dropped', 'hazard_xlsx_dropped'],
    ('functions/api/hazard-file.js', 'dk'): ['hazard_xlsm_dismissed', 'hazard_xlsx_dismissed'],
    # op set of codes.js refuses a key that is not in CODE_KEYS
    ('functions/api/codes.js', 'key'): ['induction_code', 'trustee_code'],
    ('functions/api/routine-db.js', 'body.key'): '@STATE_WRITE',
    # the question that waits for Michael's tap: one key per kind (askPending = { key: ... } in routine-db.js)
    ('functions/api/routine-db.js', 'askPending.key'): ['cal_move_ask', 'cal_invite_ask', 'del_ask', 'undo_ask', 'tour_close_ask'],
}

files = sorted(glob.glob(os.path.join(ROOT, 'functions', '**', '*.js'), recursive=True))
src = {os.path.relpath(f, ROOT): open(f, encoding='utf-8').read() for f in files}
# A constant: NAME = 'value' (also the second one in "const A = 'a', B = 'b'"). A name imported from another file
# is looked up there, so FAIL_KEY of _wa.js and FAIL_KEY of trustee-notify.js stay apart.
CONST_RE = re.compile(r"\b([A-Z][A-Z0-9_]*) = '([^'\n]*)'(?=\s*[,;])")
local = {f: dict(CONST_RE.findall(s)) for f, s in src.items()}
imports = {}
for f, s in src.items():
    for names, mod in re.findall(r"import\s*\{([^}]*)\}\s*from\s*'([^']+)'", s):
        target = os.path.normpath(os.path.join(os.path.dirname(f), mod))
        for n in names.split(','):
            n = n.strip()
            if not n: continue
            orig, _, alias = n.partition(' as ')
            imports.setdefault(f, {})[(alias or orig).strip()] = (target, orig.strip())

def span(s, i):
    """s[i] is an opening bracket: (its top-level comma-separated parts, the index of the closing bracket)."""
    depth, out, cur, q, j = 0, [], '', None, i
    while j < len(s):
        c = s[j]
        if q:
            cur += c
            if c == '\\': cur += s[j + 1]; j += 1
            elif c == q: q = None
        elif c in '\'"`': q = c; cur += c
        elif c in '([{':
            depth += 1
            if depth > 1: cur += c
        elif c in ')]}':
            depth -= 1
            if depth == 0: out.append(cur.strip()); return out, j
            cur += c
        elif c == ',' and depth == 1: out.append(cur.strip()); cur = ''
        else: cur += c
        j += 1
    return out, j

def lit_keys(o):
    """The keys of every object literal in the expression: 'a' for a name, ('[', expr) for [expr], '...x' for a spread."""
    keys, i = [], 0
    while i < len(o):
        if o[i] != '{': i += 1; continue
        parts, j = span(o, i)
        for p in parts:
            if not p: continue
            if p.startswith('...'): keys.append(p); continue
            m = re.match(r"\[(.+?)\]\s*:", p, re.S)
            if m: keys.append(('[', m.group(1))); continue
            m = re.match(r"'([^']+)'\s*:", p) or re.match(r"([A-Za-z_$][\w$]*)\s*(?::|$)", p)
            keys.append("'" + m.group(1) + "'" if m else p)
        i = j + 1
    return keys

DEF_RE = re.compile(r"function\s+(\w+)\s*\(([^)]*)\)|(?:const|let)\s+(\w+)\s*=\s*(?:async\s*)?\(([^)]*)\)\s*=>")
defs = {f: [(m.start(), m.group(1) or m.group(3), [x.strip().split('=')[0].strip() for x in (m.group(2) if m.group(1) else m.group(4)).split(',')]) for m in DEF_RE.finditer(s)] for f, s in src.items()}
def enclosing(f, pos):
    best = None
    for d in defs[f]:
        if d[0] < pos: best = d
    return best

def const(f, e):
    seen = set()
    while (f, e) not in seen:
        seen.add((f, e))
        if e in local.get(f, {}): return local[f][e]
        if e in imports.get(f, {}): f, e = imports[f][e]
        else: break
    return None

VARS = {}
def rkey(f, e):
    """A key expression -> the keys it can be, or None."""
    e = re.sub(r'\s+', ' ', e.strip())
    if (f, e) in VARS: return list(VARS[(f, e)])
    m = re.fullmatch(r"'([^']*)'", e)
    if m: return [m.group(1)]
    if re.fullmatch(r"[A-Za-z_][A-Za-z0-9_]*", e):
        c = const(f, e)
        return [c] if c is not None else None
    parts = re.split(r"\s\+\s", e)
    if len(parts) > 1:
        out = ['']
        for x in parts:
            r = rkey(f, x)
            if r is None: return None
            out = [a + b for a in out for b in r]
        return out
    return None

# Who writes: (file, function) -> ('key' | 'obj', the index of that argument). The two at the bottom of every write
# are given; a function that passes its own parameter on to one of them is found by the scan and becomes a writer too.
writers = {('functions/_onedrive.js', 'stateSet'): ('obj', 1), ('functions/_cas.js', 'stateCas'): ('key', 2)}
found, unresolved = {}, {}

def visible(f, name):
    if any(d[1] == name for d in defs[f]): return (f, name)
    return imports.get(f, {}).get(name)

def passes_on(f, pos, e, mode, new):
    """The expression is a parameter of the function it is in: that function is a writer."""
    d = enclosing(f, pos)
    if not (d and e in d[2]): return False
    w = (f, d[1])
    if w not in writers: writers[w] = (mode, d[2].index(e)); new.append(w)
    return True

def note_key(f, pos, e, new):
    e = e.strip()
    ks = rkey(f, e)
    line = src[f].count('\n', 0, pos) + 1
    if ks is None:
        if not passes_on(f, pos, e, 'key', new): unresolved[(f, re.sub(r'\s+', ' ', e)[:170])] = line
        return
    for k in ks: found.setdefault(k, set()).add(f + ':' + str(line))

def note_obj(f, pos, e, new):
    e = e.strip()
    line = src[f].count('\n', 0, pos) + 1
    if re.fullmatch(r"[A-Za-z_]\w*", e):
        if passes_on(f, pos, e, 'obj', new): return
        # an object filled in steps: V = { a: 1 }; V.b = 2; V[K] = 3
        ks = ["'" + x + "'" for x in re.findall(r"(?<![\w.])" + e + r"\.([A-Za-z_]\w*)\s*=(?!=)", src[f])]
        ks += [('[', x) for x in re.findall(r"(?<![\w.])" + e + r"\[([^\]]+)\]\s*=(?!=)", src[f])]
        for m in re.finditer(r"(?<![\w.])" + e + r" = \{", src[f]): ks += lit_keys('{' + ', '.join(span(src[f], m.end() - 1)[0]) + '}')
        if not ks: unresolved[(f, e)] = line; return
    elif '{' in e: ks = lit_keys(e)
    else: unresolved[(f, re.sub(r'\s+', ' ', e)[:170])] = line; return
    for k in ks:
        if isinstance(k, tuple): note_key(f, pos, k[1], new)
        elif k.startswith('...'): note_obj(f, pos, k[3:], new)
        else: note_key(f, pos, k, new)

def scan():
    new = []
    names = {w[1] for w in writers}
    for f, s in src.items():
        for name in names:
            w = visible(f, name)
            if w not in writers: continue
            mode, idx = writers[w]
            for m in re.finditer(r"(?<![\w.])" + name + r"\(", s):
                head = s[s.rfind('\n', 0, m.start()) + 1:m.start()]
                if re.search(r"function\s*$", head) or head.lstrip().startswith('//'): continue
                a = span(s, m.end() - 1)[0]
                if len(a) > idx: (note_key if mode == 'key' else note_obj)(f, m.start(), a[idx], new)
        # direct writes: POST to server_state with a body [{ key: X, ... }] (built in the call, or just above it)
        for m in re.finditer(r"server_state\?on_conflict=key", s):
            d = enclosing(f, m.start())
            if d and writers.get((f, d[1]), ('', 0))[0] == 'obj': continue   # the rows come from the object: its callers are scanned
            end = s.find(';\n', m.start())
            seg = s[m.start():end if end > 0 else m.start() + 700]
            ks = re.findall(r"\bkey: ([^,}]+)[,}]", seg) or (['key'] if re.search(r"\{\s*key\s*,", seg) else [])
            if not ks: ks = re.findall(r"\bkey: ([^,}]+)[,}]", s[max(0, m.start() - 600):m.start()])
            if not ks: unresolved[(f, 'direct write to server_state, no key found')] = s.count('\n', 0, m.start()) + 1
            for k in ks: note_key(f, m.start(), k, new)
    return new

rdb = src['functions/api/routine-db.js']
def js_list(name):
    m = re.search(r"export const " + name + r" = \[([^\]]*)\];", rdb)
    out = []
    for e in (m.group(1).split(',') if m else []):
        r = rkey('functions/api/routine-db.js', e)
        out += r if r else ['?' + e.strip()]
    return out
READ, WRITE = js_list('STATE_READ'), js_list('STATE_WRITE')
VARS = {k: (WRITE if v == '@STATE_WRITE' else v) for k, v in DYNAMIC.items()}
while scan(): found.clear(); unresolved.clear()
found = {k: sorted(v) for k, v in found.items()}
unresolved = sorted((f, line, e) for (f, e), line in unresolved.items())

def private(k):
    return any(fnmatch.fnmatchcase(k, p) for p in STATE_PRIVATE)

if '--list' in sys.argv:
    for k in sorted(found): print(('R ' if k in READ else 'P ' if private(k) else '? ') + k + '  ' + ' '.join(found[k][:3]))
    for u in unresolved: print('UNRESOLVED', u)
    print('writers:', sorted(w[0].split('/')[-1] + ':' + w[1] for w in writers))
    sys.exit(0)

check('STATE_READ and STATE_WRITE were read from routine-db.js, every entry resolved', len(READ) > 30 and len(WRITE) > 3 and not [x for x in READ + WRITE if x.startswith('?')], [x for x in READ + WRITE if x.startswith('?')])
check('the scan finds the writes (more than 100 keys; inv_month, agent_log, promises and a wrapper\'s key among them)', len(found) > 100 and all(k in found for k in ('inv_month', 'agent_log', 'promises', 'undo_log', 'wa_morning_last')), len(found))
check('every write has a key the test can name (a literal, a constant, or a piece declared in DYNAMIC)', not unresolved, unresolved)
missing = sorted(set(k for k in list(found) + WRITE if k not in READ and not private(k)))
check('every key the server writes is in STATE_READ or in STATE_PRIVATE (decide: may agents read it?)', not missing, {k: found.get(k, ['STATE_WRITE'])[:2] for k in missing})
both = sorted(k for k in READ if private(k))
check('no key is both readable and private', not both, both)
stale = sorted(p for p in STATE_PRIVATE if not any(fnmatch.fnmatchcase(k, p) for k in list(found) + WRITE))
check('every STATE_PRIVATE entry is still written somewhere', not stale, stale)
stale_d = sorted(str(d) for d in DYNAMIC if d[1] not in re.sub(r'\s+', ' ', src.get(d[0], '')))
check('every DYNAMIC entry still matches the code', not stale_d, stale_d)
dup = sorted(p for p in set(STATE_PRIVATE) if STATE_PRIVATE.count(p) > 1)
check('STATE_PRIVATE has no entry twice', not dup, dup)
print('\n%d passed, %d failed' % (passed, failed))
sys.exit(1 if failed else 0)
