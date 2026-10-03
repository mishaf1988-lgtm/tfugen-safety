#!/usr/bin/env python3
"""Monthly learning metrics (Michael, 01/10/2026: "a machine that learns and grows").

Once a month (.github/workflows/metrics.yml) this reads the PRs merged in the
previous month and the lessons file, and writes one row per month into
project-files/METRICS.md. Claude reads that file at the start of a session
(CLAUDE.md), so a bad month is seen, not guessed.

Per month:
  - merged PRs
  - PRs whose first commit failed the `tests` check, out of the PRs that ran it
  - average `tests` rounds until green (commits with a `tests` run, up to the first success)
  - fix PRs (same title rule as lessons-gate.py)
  - PRs whose retro line found something (not "אין" / "none")
  - new lessons (header date in that month), lessons that recurred (חזר: > 0, snapshot)

Usage: monthly-metrics.py [YYYY-MM]   (default: the previous month, UTC)
Env: GITHUB_TOKEN (optional, raises the rate limit), GITHUB_REPOSITORY.
Test: tests/harness/monthly-metrics-test.py (pure functions, no network).
"""
import datetime, importlib.util, json, os, re, sys, urllib.request

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..')
OUT = os.path.join(ROOT, 'project-files', 'METRICS.md')
LESSONS = os.path.join(ROOT, '.claude', 'skills', 'tfugen-lessons', 'SKILL.md')
# 02/10/2026: lessons already enforced in code live in the archive, one line each,
# with the same numbering; a lesson dated this month may already be there.
ARCHIVE = os.path.join(ROOT, 'project-files', 'lessons-archive.md')
REPO = os.environ.get('GITHUB_REPOSITORY', 'mishaf1988-lgtm/tfugen-safety')

_spec = importlib.util.spec_from_file_location('gate', os.path.join(os.path.dirname(os.path.abspath(__file__)), 'lessons-gate.py'))
gate = importlib.util.module_from_spec(_spec); _spec.loader.exec_module(gate)

HEADER = ('| חודש | PRs שמוזגו | נכשלו בפעם הראשונה '
          '| סבבים עד ירוק (ממוצע) | PRs של Fix | רטרו שמצא משהו '
          '| לקחים חדשים | לקחים שחזרו |')
SEP = '|---|---|---|---|---|---|---|---|'
ROW = re.compile(r'^\| (\d\d/\d{4}) \|')
TABLE_START = '<!-- metrics-table -->'
TABLE_END = '<!-- /metrics-table -->'
DETAIL_START = '<!-- metrics-detail -->'
DETAIL_END = '<!-- /metrics-detail -->'


def month_range(ym):
    y, m = map(int, ym.split('-'))
    start = datetime.datetime(y, m, 1, tzinfo=datetime.timezone.utc)
    end = datetime.datetime(y + (m == 12), m % 12 + 1, 1, tzinfo=datetime.timezone.utc)
    return start, end


def previous_month(today):
    first = today.replace(day=1)
    last = first - datetime.timedelta(days=1)
    return '%04d-%02d' % (last.year, last.month)


def rounds_until_green(conclusions):
    """conclusions: the `tests` result per commit, in commit order (None = no run).
    Returns (first_try_failed, rounds) where rounds counts commits with a run up
    to and including the first success; rounds is None if it never went green."""
    ran = [c for c in conclusions if c]
    if not ran:
        return False, None
    first_failed = ran[0] != 'success'
    for i, c in enumerate(ran):
        if c == 'success':
            return first_failed, i + 1
    return first_failed, None


def retro_found(body):
    m = gate.RETRO.search(body or '')
    if not m:
        return False
    return not gate.RETRO_NONE.match(m.group(2).strip())


def read_lessons():
    """The lessons file plus the archive (both carry numbered lessons)."""
    out = ''
    for p in (LESSONS, ARCHIVE):
        if os.path.exists(p):
            with open(p, encoding='utf-8') as f:
                out += f.read() + '\n'
    return out


def lesson_stats(text, ym):
    """New lessons dated in month ym, and lessons whose חזר: is above 0."""
    y, m = ym.split('-')
    # The first full DD/MM/YYYY in the header (lesson 15 has a range: "21/09 עד 01/10/2026").
    dates = [re.search(r'\b\d\d/(\d\d)/(\d{4})\b', h) for h in re.findall(r'^\*\*\d+\. .*$', text, re.M)]
    new = len([d for d in dates if d and d.group(1) == m and d.group(2) == y])
    recurred = len([n for n in re.findall(r'^חזר:\s*(\d+)', text, re.M) if int(n) > 0])
    return new, recurred


def lessons_digest(text, ym):
    """Michael, 03/10/2026: the monthly summary names the lessons, not only counts them.
    New lessons dated in ym, and every lesson whose חזר: is above 0 (state on the day)."""
    y, m = ym.split('-')
    items = []
    for blk in re.split(r'(?m)^(?=\*\*\d+\. )', text):
        h = re.match(r'\*\*(\d+)\. (.+?) \(([^)]*)\)', blk)
        if not h:
            continue
        r = re.search(r'חזר:\s*(\d+)', blk)
        d = re.search(r'\b\d\d/(\d\d)/(\d{4})\b', h.group(3))
        items.append((int(h.group(1)), h.group(2).strip(), int(r.group(1)) if r else 0, bool(d and d.group(1) == m and d.group(2) == y)))
    items.sort()
    new = ['- %d. %s' % (n, t) for n, t, _, isnew in items if isnew]
    rec = ['- %d. %s: חזר %d' % (n, t, k) for n, t, k, _ in sorted(items, key=lambda x: -x[2]) if k > 0]
    return (['', '### לקחים חדשים ב-%s/%s' % (m, y), ''] + (new or ['אין.']) +
            ['', '### לקחים שחזרו (מצב ביום המדידה; חזר = הכלל לא עובד, צריך hook או בדיקה)', ''] + (rec or ['אין.']))


def summarize(prs, lessons_text, ym):
    """prs: [{number, title, body, conclusions}] merged in ym."""
    n = len(prs)
    first_fail, rounds, fixes, retros, detail, measured = 0, [], 0, 0, [], 0
    for p in prs:
        failed, r = rounds_until_green(p['conclusions'])
        if any(p['conclusions']):
            measured += 1
        if failed:
            first_fail += 1
            detail.append('- #%d %s: %s' % (p['number'], p['title'][:70],
                          ('%d סבבים' % r) if r else 'לא הגיע לירוק'))
        if r:
            rounds.append(r)
        if gate.FIX.search(p['title'] or ''):
            fixes += 1
        if retro_found(p.get('body')):
            retros += 1
    new, recurred = lesson_stats(lessons_text, ym)
    avg = ('%.1f' % (sum(rounds) / len(rounds))) if rounds else '-'
    # Percent of the PRs that ran `tests` at all (it exists from #1006, 01/10/2026).
    pct = ('%d/%d (%d%%)' % (first_fail, measured, round(100.0 * first_fail / measured))) if measured else '-'
    y, m = ym.split('-')
    row = '| %s/%s | %d | %s | %s | %d | %d | %d | %d |' % (m, y, n, pct, avg, fixes, retros, new, recurred)
    return row, detail


def render(existing, row, detail, ym, now, extra=None):
    """Insert or replace this month's row, newest first; replace the detail block."""
    month = row.split('|')[1].strip()
    rows = []
    if TABLE_START in existing:
        body = existing.split(TABLE_START, 1)[1].split(TABLE_END, 1)[0]
        rows = [l for l in body.splitlines() if ROW.match(l) and l.split('|')[1].strip() != month]
    rows.append(row)
    rows.sort(key=lambda l: tuple(reversed(l.split('|')[1].strip().split('/'))), reverse=True)
    y, m = ym.split('-')
    det = ['### נכשלו בפעם הראשונה ב-%s/%s' % (m, y), '']
    det += detail or ['אין.']
    det += extra or []
    try:
        from zoneinfo import ZoneInfo
        now = now.astimezone(ZoneInfo('Asia/Jerusalem'))
        zone = '\u05e9\u05e2\u05d5\u05df \u05d9\u05e9\u05e8\u05d0\u05dc'
    except Exception:
        zone = 'UTC'
    stamp = now.strftime('%d/%m/%Y %H:%M') + ' ' + zone
    return '\n'.join([
        '# מדידה חודשית: האם אנחנו לומדים?',
        '',
        'נכתב אוטומטית ב-1 לכל חודש (`.github/workflows/metrics.yml`). לא לערוך ידנית: הריצה הבאה תדרוס.',
        'מגמה טובה: פחות נכשלים בפעם הראשונה, פחות סבבים, אפס לקחים שחזרו. לקח שחזר = הכלל לא עובד, צריך hook או בדיקה.',
        '"לקחים שחזרו" הוא מצב ביום המדידה, לא רק מאותו חודש.',
        '',
        'עודכן: ' + stamp,
        '',
        TABLE_START, HEADER, SEP] + rows + [TABLE_END, '',
        DETAIL_START] + det + [DETAIL_END, ''])


# ---- network (not in the test) ----

def api(path):
    req = urllib.request.Request('https://api.github.com/repos/%s/%s' % (REPO, path),
                                 headers={'Accept': 'application/vnd.github+json', 'User-Agent': 'tapugan-metrics'})
    tok = os.environ.get('GITHUB_TOKEN')
    if tok:
        req.add_header('Authorization', 'Bearer ' + tok)
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.load(r)


def merged_prs(ym):
    start, end = month_range(ym)
    out, page = [], 1
    while True:
        batch = api('pulls?state=closed&sort=updated&direction=desc&per_page=100&page=%d' % page)
        if not batch:
            break
        for p in batch:
            if not p.get('merged_at'):
                continue
            t = datetime.datetime.fromisoformat(p['merged_at'].replace('Z', '+00:00'))
            if start <= t < end:
                out.append(p)
        last = datetime.datetime.fromisoformat(batch[-1]['updated_at'].replace('Z', '+00:00'))
        if last < start:
            break
        page += 1
    return out


def conclusions(number):
    res = []
    for c in api('pulls/%d/commits?per_page=100' % number):
        runs = api('commits/%s/check-runs?check_name=tests' % c['sha']).get('check_runs', [])
        runs = [r for r in runs if r.get('conclusion')]
        runs.sort(key=lambda r: r.get('started_at') or '')
        # A re-run on the same commit is not a new round: the last result counts.
        res.append(runs[-1]['conclusion'] if runs else None)
    return res


def main():
    now = datetime.datetime.now(datetime.timezone.utc)
    ym = sys.argv[1] if len(sys.argv) > 1 else previous_month(now.date())
    if not re.match(r'^\d{4}-(0[1-9]|1[0-2])$', ym):
        sys.exit('month must be YYYY-MM, got %r' % ym)
    prs = [{'number': p['number'], 'title': p['title'], 'body': p.get('body') or '',
            'conclusions': conclusions(p['number'])} for p in merged_prs(ym)]
    lessons = read_lessons()
    row, detail = summarize(prs, lessons, ym)
    existing = open(OUT, encoding='utf-8').read() if os.path.exists(OUT) else ''
    with open(OUT, 'w', encoding='utf-8') as f:
        f.write(render(existing, row, detail, ym, now, lessons_digest(lessons, ym)))
    print(row)


if __name__ == '__main__':
    main()
