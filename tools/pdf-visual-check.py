#!/usr/bin/env python3
"""Visual check of a PDF before it goes to a person (22/11/2026, Michael on the circular-saw training package sent to
the department manager: "go over it visually ... the page numbers, whether everything is centred ... and fix the whole
process"). Page 1 said "page 2 of 2" (fixed text, not a field), page 2 had no header or logo, a section heading was
left alone at the bottom of page 1, page 2 was almost empty, David/Times beside Arial, ":signature" with the colon on
the wrong side, 22.11.2026, and in the Excel form: no logo or page number, the table not centred with a big gap on top
and 9 empty rows, and text cut in cells.

Usage: python3 tools/pdf-visual-check.py <file.pdf> [--expect texts.txt] [--json] [--allow-fonts NAME,NAME] [--no-render]
Needs poppler (pdfinfo, pdftotext, pdfimages, pdffonts, pdftoppm); the render checks (centring, empty rows,
cut text) read pdftoppm's grey PGM directly, no Pillow. Every page is checked:
  page_of   "page X of Y" on every page, X <= Y, page 1 of each document is 1, X follows the page before
  logo      at least one image on every page
  logo_top  (when image positions are known) an image in the top header band of every page, not only logos at the
            bottom (23/11/2026: the weekly training on form 08.01 went out with the Tapugan logo column gone from the
            header table; only the footer logos were left, and "an image on the page" passed)
  rtl       Hebrew paragraphs, headings and numbering laid out left to right: short Hebrew lines flush with the left
            edge and not the right, or "1." on the left of Hebrew lines (23/11/2026: bidi together with jc=right,
            which Word shows on the LEFT; LibreOffice previews it right)
  font      only Arial (LiberationSans / Arimo = Arial in LibreOffice) or symbol fonts
  orphan    a numbered heading that is the last line of a page that is not the last page of its document
  empty     a page that is not the first of its document with 3 lines of body text or fewer
  punct     a Hebrew word that starts with ":" "." "," (the mark on the wrong side in RTL)
  date      a date with dots (22.11.2026): DD/MM/YYYY
  overlap   two words drawn over each other (text cut by a cell or a neighbour)
  cut       a word with no ink at one end or none at all in the render (clipped by its cell)
  centre    a table off centre left/right (text pages are right-aligned, not checked), or a gap on top of more than a
            quarter of the page that is not centring (bigger than the gap at the bottom)
  rows      3 or more empty table rows at the end of a table
  expect    (--expect) every text you wrote is in the PDF whole: clipped cell text is dropped from the PDF
Exit 0 = clean, 1 = problems (one line each on stderr, in Hebrew), 2 = could not check. Prints one JSON line.
The pure part (analyze) takes the extracted pages, so the tests run without poppler."""
import argparse, json, os, re, shutil, subprocess, sys, tempfile
import xml.etree.ElementTree as ET

HEB = re.compile('[֐-׿]')
PAGE_W = 'עמוד'  # "page"
OF_W = 'מתוך'  # "of"
PAGE_OF = re.compile(PAGE_W + r'\s*(\d+)\s*' + OF_W + r'\s*(\d+)|[Pp]age\s*(\d+)\s*of\s*(\d+)')
HEADING = re.compile(r'^\d{1,2}(\.\d{1,2})*\s*\.?\s+\S')
DOT_DATE = re.compile(r'(?<![\d.])\d{1,2}\.\d{1,2}\.(\d{4}|\d{2})(?![\d.])')
OK_FONT = re.compile(r'arial|liberationsans|liberation sans|arimo|symbol|wingdings|zapf|dingbat|opensymbol', re.I)
HEADER_BAND = 0.16  # top of the page: the form header
LOGO_TOP_BAND = 0.2  # a header logo starts within the top fifth of the page
NUM_TOKEN = re.compile(r'^\(?\d{1,2}[.)]$|^[.(]\d{1,2}\)?$')
FOOTER_BAND = 0.07


def logical_word(w):
    """pdftotext gives Hebrew in visual order (letters reversed); numbers and Latin as they are."""
    return w[::-1] if HEB.search(w) else w


def line_text(words):
    """Words of one line in reading order: right to left when the line has Hebrew."""
    if any(HEB.search(w['t']) for w in words):
        ws = sorted(words, key=lambda w: -w['x1'])
    else:
        ws = sorted(words, key=lambda w: w['x0'])
    return ' '.join(logical_word(w['t']) for w in ws)


def find_page_of(lines):
    """(X, Y) of "page X of Y" on the page, or None. By position, not by reading order (a paragraph without RTL
    direction shows the same words in another order): X is the number between "page" and "of", Y the one beside "of"
    on its other side."""
    for ln in lines:
        m = PAGE_OF.search(ln['text'])
        if m:
            g = [x for x in m.groups() if x]
            return int(g[0]), int(g[1])
        # visual order, left to right, words split into Hebrew / digit tokens (LibreOffice glues a field to its
        # neighbours: "page1of" as one word)
        vis = ' '.join(w['t'] for w in sorted(ln['words'], key=lambda w: w['x0']))
        toks = [logical_word(t) for t in re.findall(r'\d+|[\u0590-\u05ff]+|[A-Za-z]+', vis)]
        if PAGE_W in toks and OF_W in toks:
            i, j = toks.index(PAGE_W), toks.index(OF_W)
            lo, hi = min(i, j), max(i, j)
            mid = [t for t in toks[lo + 1:hi] if t.isdigit()]
            k = j + (1 if j > i else -1)
            k2 = i + (1 if i > j else -1)
            other = toks[k] if 0 <= k < len(toks) and toks[k].isdigit() else toks[k2] if 0 <= k2 < len(toks) and toks[k2].isdigit() else None
            if len(mid) == 1 and other:
                return int(mid[0]), int(other)
    return None


def _ov(a, b):
    w = min(a['x1'], b['x1']) - max(a['x0'], b['x0'])
    h = min(a['y1'], b['y1']) - max(a['y0'], b['y0'])
    if w <= 0 or h <= 0:
        return 0.0
    small = min((a['x1'] - a['x0']) * (a['y1'] - a['y0']), (b['x1'] - b['x0']) * (b['y1'] - b['y0'])) or 1
    return w * h / small


def analyze(pages, allow_fonts=(), expect=()):
    """pages: [{w, h, lines: [{text, x0, y0, x1, y1, words: [{t, x0, y0, x1, y1, ink?: (left, mid, right)}]}],
    images: int, fonts: [names], ink_box?: (x0, y0, x1, y1), table_box?: (x0, y0, x1, y1), rules?: [y, ...]}]. Returns a list of problems
    {page, check, msg} (msg in Hebrew, page 1-based)."""
    probs = []

    def bad(i, check, msg):
        probs.append({'page': i + 1, 'check': check, 'msg': 'עמוד %d: %s' % (i + 1, msg)})

    allow = [a.lower() for a in allow_fonts if a]
    po = [find_page_of(p['lines']) for p in pages]
    n = len(pages)
    # documents: a new one starts where page_of says 1 (or at page 1)
    doc_last = [True] * n
    doc_first = [False] * n
    for i in range(n):
        x = po[i]
        doc_first[i] = i == 0 or (x is not None and x[0] == 1) or po[i - 1] is None and x is None
        if i > 0:
            doc_last[i - 1] = doc_first[i]
    for i, p in enumerate(pages):
        x = po[i]
        if x is None:
            bad(i, 'page_of', 'אין "עמוד X מתוך Y" (כותרת חסרה)')
        else:
            a, b = x
            prev = po[i - 1] if i else None
            if a > b or a < 1:
                bad(i, 'page_of', 'כתוב "עמוד %d מתוך %d"' % (a, b))
            elif a > 1 and (prev is None or prev != (a - 1, b)):
                bad(i, 'page_of', 'כתוב "עמוד %d מתוך %d" אבל לפניו אין עמוד %d (טקסט קבוע במקום שדה PAGE)' % (a, b, a - 1))
            elif a < b and (i + 1 >= n or po[i + 1] != (a + 1, b)):
                bad(i, 'page_of', 'כתוב "מתוך %d" אבל העמוד הבא לא עמוד %d של אותו מסמך' % (b, a + 1))
        if not p.get('images'):
            bad(i, 'logo', 'אין לוגו (אין תמונה בעמוד)')
        elif p.get('image_boxes') is not None and not any(b[1] < LOGO_TOP_BAND * (p['h'] or 1) for b in p['image_boxes']):
            bad(i, 'logo_top', '\u05d0\u05d9\u05df \u05dc\u05d5\u05d2\u05d5 \u05d1\u05db\u05d5\u05ea\u05e8\u05ea \u05d4\u05e2\u05dc\u05d9\u05d5\u05e0\u05d4 (\u05e8\u05e7 \u05dc\u05de\u05d8\u05d4), \u05dc\u05e7\u05d7\u05ea \u05d0\u05ea \u05d8\u05d1\u05dc\u05ea \u05d4\u05db\u05d5\u05ea\u05e8\u05ea \u05de\u05d4\u05d8\u05d5\u05e4\u05e1 \u05d4\u05de\u05e7\u05d5\u05e8\u05d9')
        odd = sorted({f for f in p.get('fonts') or [] if not OK_FONT.search(f) and not any(a in f.lower() for a in allow)})
        if odd:
            bad(i, 'font', 'גופן לא Arial: ' + ', '.join(re.sub(r'^[A-Z]{6}\+', '', f) for f in odd))
        h = p['h'] or 1
        band = HEADER_BAND if x is not None else 0  # no header on the page: nothing on top to skip
        body = [ln for ln in p['lines'] if ln['y0'] > h * band and ln['y1'] < h * (1 - FOOTER_BAND) and not PAGE_OF.search(ln['text'])]
        if body and not doc_last[i]:
            last = max(body, key=lambda ln: ln['y1'])
            t = last['text'].strip()
            if HEADING.match(t) and len(t.split()) <= 8:
                bad(i, 'orphan', 'כותרת "%s" לבד בסוף העמוד, התוכן שלה בעמוד הבא' % t[:40])
        rtl_msg = rtl_problem(body, p.get('table_box'))
        if rtl_msg:
            bad(i, 'rtl', rtl_msg)
        if not doc_first[i] and len(body) <= 3:
            bad(i, 'empty', 'כמעט ריק (%d שורות), לאחד עם העמוד הקודם' % len(body))
        words = [w for ln in p['lines'] for w in ln['words']]
        for w in words:
            lw = logical_word(w['t'])
            if HEB.search(lw) and lw[:1] in ':.,;':
                bad(i, 'punct', '"%s": סימן פיסוק בצד הלא נכון' % lw[:30])
                break
        for ln in p['lines']:
            m = DOT_DATE.search(ln['text'])
            if m:
                bad(i, 'date', 'תאריך %s: DD/MM/YYYY' % m.group(0))
                break
        for w in words:
            if w['x0'] < -1 or w['y0'] < -1 or w['x1'] > p['w'] + 1 or w['y1'] > h + 1:
                bad(i, 'cut', '"%s" יוצא מהעמוד' % logical_word(w['t'])[:30])
                break
        done = False
        for a in range(len(words)):
            for b in range(a + 1, len(words)):
                if _ov(words[a], words[b]) > 0.3:
                    bad(i, 'overlap', '"%s" ו-"%s" מודפסים זה על זה (טקסט חתוך)' % (logical_word(words[a]['t'])[:20], logical_word(words[b]['t'])[:20]))
                    done = True
                    break
            if done:
                break
        for w in words:
            ink = w.get('ink')
            if not ink or len(w['t']) < 3:
                continue
            left, mid, right = ink
            if left + mid + right == 0 or (mid > 0 and (left == 0 or right == 0)):
                bad(i, 'cut', '"%s" חתוך בתא (לא נראה במלואו)' % logical_word(w['t'])[:30])
                break
        box, tb = p.get('ink_box'), p.get('table_box')
        if box:
            x0, y0, x1, y1 = box
            lm, rm = (tb[0], p['w'] - tb[2]) if tb else (0, 0)
            if tb and abs(lm - rm) > 0.08 * p['w']:
                bad(i, 'centre', 'לא ממורכז (שוליים %d ו-%d נקודות)' % (lm, rm))
            top, low = (tb[1], h - tb[3]) if tb else (y0, None)
            if top > 0.25 * h and (low is None or top > 1.5 * low):  # a table centred top/bottom is fine
                bad(i, 'centre', 'רווח גדול למעלה (%d%% מהעמוד)' % (100 * top / h))
        rules = sorted(p.get('rules') or [])
        if len(rules) >= 4:
            empty = 0
            for top, bot in reversed(list(zip(rules, rules[1:]))):
                if bot - top < 6:
                    continue
                if any(top < (ln['y0'] + ln['y1']) / 2 < bot for ln in p['lines']):
                    break
                empty += 1
            if empty >= 3:
                bad(i, 'rows', '%d שורות ריקות בסוף הטבלה' % empty)
    if expect:
        have = {}
        for p in pages:
            for ln in p['lines']:
                for w in ln['words']:
                    k = norm_word(logical_word(w['t']))
                    have[k] = have.get(k, 0) + 1
        for e in expect:
            miss = [w for w in (norm_word(x) for x in str(e).split()) if len(w) >= 2 and not have.get(w)]
            if miss:
                probs.append({'page': 0, 'check': 'cut', 'msg': '"%s" \u05dc\u05d0 \u05de\u05d5\u05e4\u05d9\u05e2 \u05d1\u05de\u05dc\u05d5\u05d0\u05d5 \u05d1-PDF (\u05d7\u05e1\u05e8: %s), \u05db\u05e0\u05e8\u05d0\u05d4 \u05d7\u05ea\u05d5\u05da \u05d1\u05ea\u05d0' % (str(e)[:50], ' '.join(miss[:4]))})
    return probs


def rtl_problem(body, table_box=None):
    """A Hebrew page laid out left to right: short Hebrew lines that end flush left and not right, or a number "1."
    on the left of a Hebrew line. Lines inside a ruled table are skipped (cells align to their own edges). Returns a
    Hebrew message or None."""
    heb = [ln for ln in body if HEB.search(ln['text']) and not (table_box and table_box[1] - 2 < ln['y0'] < table_box[3] + 2)]
    if len(heb) < 3:
        return None
    col_l = min(ln['x0'] for ln in heb)
    col_r = max(ln['x1'] for ln in heb)
    width = col_r - col_l
    short = [ln for ln in heb if ln['x1'] - ln['x0'] < 0.75 * width]
    left = sum(1 for ln in short if ln['x0'] - col_l < 4)
    right = sum(1 for ln in short if col_r - ln['x1'] < 4)
    if left >= 3 and left > 2 * right:
        return '%d \u05e9\u05d5\u05e8\u05d5\u05ea \u05d1\u05e2\u05d1\u05e8\u05d9\u05ea \u05de\u05d9\u05d5\u05e9\u05e8\u05d5\u05ea \u05dc\u05e9\u05de\u05d0\u05dc \u05d5\u05dc\u05d0 \u05dc\u05d9\u05de\u05d9\u05df (\u05db\u05d9\u05d5\u05d5\u05df \u05de\u05e9\u05de\u05d0\u05dc \u05dc\u05d9\u05de\u05d9\u05df; \u05d1-Word: bidi \u05d1\u05dc\u05d9 jc=right)' % left
    num_l = num_r = 0
    for ln in heb:
        ws = sorted(ln['words'], key=lambda w: w['x0'])
        if len(ws) < 2:
            continue
        if NUM_TOKEN.match(ws[0]['t']) and HEB.search(ws[-1]['t']):
            num_l += 1
        elif NUM_TOKEN.match(ws[-1]['t']):
            num_r += 1
    if num_l >= 2 and num_l > num_r:
        return '\u05d4\u05de\u05e1\u05e4\u05d5\u05e8 \u05de\u05e9\u05de\u05d0\u05dc \u05dc\u05e9\u05d5\u05e8\u05d4 \u05d1\u05e2\u05d1\u05e8\u05d9\u05ea (%d \u05e9\u05d5\u05e8\u05d5\u05ea): \u05db\u05d9\u05d5\u05d5\u05df \u05de\u05e9\u05de\u05d0\u05dc \u05dc\u05d9\u05de\u05d9\u05df' % num_l
    return None


def norm_word(w):
    return re.sub(r'[\s.,:;()"\'\-]', '', w)


# ---- extraction (poppler) -----------------------------------------------------------------------------------
def run(cmd):
    return subprocess.run(cmd, capture_output=True, text=True, timeout=180)


def extract(pdf, render=True):
    xml = run(['pdftotext', '-bbox-layout', pdf, '-']).stdout
    xml = re.sub(r'<!DOCTYPE[^>]*>', '', xml)
    root = ET.fromstring(xml)
    pages = []
    for pg in root.iter():
        if not pg.tag.endswith('page'):
            continue
        p = {'w': float(pg.get('width')), 'h': float(pg.get('height')), 'lines': [], 'images': 0, 'fonts': []}
        for ln in pg.iter():
            if not ln.tag.endswith('line'):
                continue
            ws = [{'t': w.text or '', 'x0': float(w.get('xMin')), 'y0': float(w.get('yMin')), 'x1': float(w.get('xMax')), 'y1': float(w.get('yMax'))}
                  for w in ln if w.tag.endswith('word') and (w.text or '').strip()]
            if ws:
                p['lines'].append({'text': line_text(ws), 'words': ws, 'x0': min(w['x0'] for w in ws), 'y0': min(w['y0'] for w in ws),
                                   'x1': max(w['x1'] for w in ws), 'y1': max(w['y1'] for w in ws)})
        pages.append(p)
    for row in run(['pdfimages', '-list', pdf]).stdout.splitlines()[2:]:
        c = row.split()
        if c and c[0].isdigit() and 0 < int(c[0]) <= len(pages):
            pages[int(c[0]) - 1]['images'] += 1
    image_boxes(pdf, pages)
    for i, p in enumerate(pages):
        out = run(['pdffonts', '-f', str(i + 1), '-l', str(i + 1), pdf]).stdout.splitlines()[2:]
        p['fonts'] = [ln.split()[0] for ln in out if ln.strip()]
    if render:
        tmp = tempfile.mkdtemp(prefix='pvc-')
        try:
            for i, p in enumerate(pages):
                base = os.path.join(tmp, 'p%d' % i)
                run(['pdftoppm', '-r', '144', '-gray', '-singlefile', '-f', str(i + 1), '-l', str(i + 1), pdf, base])
                if os.path.exists(base + '.pgm'):
                    ink_metrics(p, read_pgm(base + '.pgm'), 2.0)
        finally:
            shutil.rmtree(tmp, ignore_errors=True)
    return pages, None


def image_boxes(pdf, pages):
    """Where each image sits (points), from pdftohtml -xml; leaves the pages without 'image_boxes' when it cannot
    tell (no pdftohtml), so the logo_top check is skipped rather than guessed."""
    if not shutil.which('pdftohtml'):
        return
    tmp = tempfile.mkdtemp(prefix='pvc-img-')
    try:
        run(['pdftohtml', '-xml', '-q', '-nodrm', pdf, os.path.join(tmp, 'x')])
        path = os.path.join(tmp, 'x.xml')
        if not os.path.exists(path):
            return
        with open(path, encoding='utf-8', errors='replace') as f:
            xml = re.sub(r'<!DOCTYPE[^>]*>', '', f.read())
        root = ET.fromstring(xml)
        for pg in root.iter('page'):
            k = int(pg.get('number', 0)) - 1
            if not 0 <= k < len(pages):
                continue
            sc = pages[k]['h'] / (float(pg.get('height') or 0) or pages[k]['h'] or 1)
            pages[k]['image_boxes'] = [(float(im.get('left')) * sc, float(im.get('top')) * sc,
                                        (float(im.get('left')) + float(im.get('width'))) * sc,
                                        (float(im.get('top')) + float(im.get('height'))) * sc) for im in pg.iter('image')]
    except (ET.ParseError, OSError, ValueError, TypeError):
        return
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


class Gray:
    """A grey render from pdftoppm -gray (binary PGM), no Pillow needed (it is broken in some containers)."""
    def __init__(self, w, h, data):
        self.size, self.data = (w, h), data

    def dark(self, x, y):
        return self.data[y * self.size[0] + x] < 160


def read_pgm(path):
    with open(path, 'rb') as f:
        raw = f.read()
    m = re.match(rb'P5\s+(?:#[^\n]*\s+)*(\d+)\s+(\d+)\s+(\d+)\s', raw)
    w, h = int(m.group(1)), int(m.group(2))
    return Gray(w, h, raw[m.end():m.end() + w * h])


def ink_metrics(p, im, s):
    """From the render (s pixels per point): the bounding box of all ink, the y of table rules (dark rows across most
    of the content width), and for each word the ink in its left fifth, middle and right fifth."""
    W, H = im.size
    d = im.data
    rows = [y for y in range(H) if any(v < 160 for v in d[y * W:(y + 1) * W])]
    if not rows:
        return
    cols = [x for x in range(W) if any(d[y * W + x] < 160 for y in range(rows[0], rows[-1] + 1, 2))]
    bb = (cols[0], rows[0], cols[-1] + 1, rows[-1] + 1)
    p['ink_box'] = (bb[0] / s, bb[1] / s, bb[2] / s, bb[3] / s)
    span = bb[2] - bb[0]
    rules = []
    for y in range(bb[1], bb[3]):
        run_, best = 0, 0
        for v in d[y * W + bb[0]:y * W + bb[2]]:
            run_ = run_ + 1 if v < 160 else 0
            best = max(best, run_)
        if best > 0.4 * span and best > 60:  # a ruled line: one unbroken dark run, text never is
            if rules and y - rules[-1][-1] <= 1:
                rules[-1].append(y)
            else:
                rules.append([y])
    rules = [r for r in rules if len(r) <= 6]
    p['rules'] = [sum(r) / len(r) / s for r in rules]
    if len(rules) >= 3:
        xs = []
        for r in rules:
            y = r[len(r) // 2]
            dk = [x for x in range(bb[0], bb[2]) if d[y * W + x] < 160]
            xs += [dk[0], dk[-1]]
        p['table_box'] = (min(xs) / s, rules[0][0] / s, (max(xs) + 1) / s, rules[-1][-1] / s)
    for ln in p['lines']:
        for w in ln['words']:
            x0, x1 = int(w['x0'] * s), int(w['x1'] * s)
            y0, y1 = int(w['y0'] * s), int(w['y1'] * s)
            if x1 - x0 < 10 or y1 <= y0 or x0 < 0 or y0 < 0 or x1 > W or y1 > H:
                continue
            f = max(2, (x1 - x0) // 5)

            def cnt(a, b):
                return sum(1 for y in range(y0, y1) for v in d[y * W + a:y * W + b] if v < 160)
            w['ink'] = (cnt(x0, x0 + f), cnt(x0 + f, x1 - f), cnt(x1 - f, x1))


def main(argv=None):
    ap = argparse.ArgumentParser()
    ap.add_argument('pdf')
    ap.add_argument('--json', action='store_true')
    ap.add_argument('--allow-fonts', default='')
    ap.add_argument('--no-render', action='store_true')
    ap.add_argument('--expect', help='a UTF-8 file, one line per text you wrote into the form (cell values, headings): '
                    'each must appear whole in the PDF; a word missing = cut by its cell (LibreOffice and Excel drop clipped text)')
    a = ap.parse_args(argv)
    for t in ('pdftotext', 'pdfimages', 'pdffonts'):
        if not shutil.which(t):
            print(json.dumps({'ok': False, 'error': 'no %s (poppler)' % t}))
            return 2
    try:
        pages, note = extract(a.pdf, render=not a.no_render and bool(shutil.which('pdftoppm')))
    except (ET.ParseError, OSError, subprocess.SubprocessError, ValueError) as e:
        print(json.dumps({'ok': False, 'error': 'read: %s' % e}))
        return 2
    expect = []
    if a.expect:
        with open(a.expect, encoding='utf-8') as f:
            expect = [x.strip() for x in f if x.strip()]
    probs = analyze(pages, a.allow_fonts.split(','), expect)
    for x in probs:
        print('FAIL: ' + x['msg'], file=sys.stderr)
    out = {'ok': not probs, 'pages': len(pages), 'problems': probs if a.json else len(probs)}
    if note:
        out['note'] = note
    print(json.dumps(out, ensure_ascii=False))
    return 0 if not probs else 1


if __name__ == '__main__':
    sys.exit(main())
