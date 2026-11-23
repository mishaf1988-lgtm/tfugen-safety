#!/usr/bin/env python3
"""The one way to make a weekly training document on form 08.01 (and any Hebrew document on a controlled form)
(23/11/2026, Michael on WhatsApp: "move to development: this is how a form is made, learn from mistakes").

What went wrong on 22-23/11/2026 (the weekly training for the moulders): (1) the first version came out left to right:
every paragraph had w:bidi together with jc="right", which Word draws on the LEFT (LibreOffice draws it right, so the
preview lied); (2) the fixed version lost the Tapugan logo column of the header table (only the footer logos were left).
This tool makes both impossible:
  - it always starts from the ORIGINAL Word form (tools/od-get.sh on the form in the safety folder, or
    "iso 9001 updated/טפסים/08/08.01_תיעוד ביצוע הדרכה.doc"), and refuses a template with no logo in its header;
  - the training text is written by tools/rtl_ooxml.py (schema order, Arial, w:bidi and no left/right jc);
  - tools/form-fill.py does the filling and the polish (header on every page, PAGE / NUMPAGES fields, Arial, RTL);
  - before it writes "ok" it checks the Word file itself: the header logo is still there, and no RTL paragraph
    has jc="right" (form-fill.lint);
  - with soffice it renders a preview PDF and runs tools/pdf-visual-check.py on it (logo in the header of every page,
    right-to-left layout, page X of Y, Arial). The preview is NOT the PDF to send: there is no Arial in LibreOffice here.

Usage: python3 tools/talk-0801.py --template <08.01.doc|docx> --spec talk.json --out <dir/name-without-ext>

talk.json: every key of tools/form-fill.py (cells, table_cells, rows, replace_text), plus
  "content":        [{"h": "1. heading", "p": ["paragraph", ...]}, ...]  the training text, in this order
  "content_before": "<text>"  put the content before the first body paragraph or table holding this text
                    (default: right after the header table at the top of the body)

After exit 0 (the assistant, in this order; a step that fails = fix and run again, never send):
  1. od_put_pdf the .docx to the training folder        2. routine-db op od_pdf (Microsoft's PDF, Arial)
  3. tools/od-get.sh the PDF                              4. python3 tools/pdf-visual-check.py <pdf> --expect <texts>
  5. only on exit 0: wa_file / mail_draft, caption "נבדק ויזואלית: N עמודים"
Exit 0 = ok, 1 = a problem (one line each on stderr), prints one JSON line {ok, docx, preview_pdf, next, ...}."""
import argparse, importlib.util, json, os, shutil, sys, tempfile

from lxml import etree

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import rtl_ooxml  # noqa: E402


def _load(name, file):
    spec = importlib.util.spec_from_file_location(name, os.path.join(HERE, file))
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


ff = _load('form_fill', 'form-fill.py')
q = ff.q
NEXT = ['od_put_pdf the .docx', 'routine-db op od_pdf (not LibreOffice)', 'tools/od-get.sh the PDF',
        'python3 tools/pdf-visual-check.py <pdf> --expect <texts>: exit 0 before wa_file / mail_draft']


def content_xml(content):
    """The training text as RTL paragraphs: a heading (bold, kept with the next) and its paragraphs."""
    out = []
    for sec in content or []:
        if sec.get('h'):
            out.append(rtl_ooxml.p_xml(ff.fix_value(sec['h']), bold=True, size=24, before=160, after=80, keep=True))
        ps = sec.get('p') or []
        for t in [ps] if isinstance(ps, str) else ps:
            out.append(rtl_ooxml.p_xml(ff.fix_value(t), justify=False))
    return [etree.fromstring(x) for x in out]


def insert_content(doc, content, before=None):
    body = doc.find(q('body'))
    els = content_xml(content)
    if not els:
        return 0
    kids = [ch for ch in body if ch.tag in (q('p'), q('tbl'))]
    anchor = None
    if before:
        anchor = next((ch for ch in kids if ff.norm(before) in ff.norm(''.join(ch.itertext()))), None)
        if anchor is None:
            raise ff.Fail('content_before: "%s" not found' % before)
        for el in els:
            anchor.addprevious(el)
        return len(els)
    first_tbl = next((ch for ch in kids if ch.tag == q('tbl')), None)
    if first_tbl is None:
        raise ff.Fail('the template has no header table at the top of the body; use content_before')
    for el in reversed(els):
        first_tbl.addnext(el)
    return len(els)


def main(argv=None):
    ap = argparse.ArgumentParser(description='Weekly training on the original 08.01 Word form: RTL, logo, Arial, checked.')
    ap.add_argument('--template', required=True)
    ap.add_argument('--spec', required=True)
    ap.add_argument('--out', required=True)
    a = ap.parse_args(argv)
    summary = {'ok': False, 'docx': None, 'preview_pdf': None, 'next': NEXT}
    work = tempfile.mkdtemp(prefix='talk-0801-')
    try:
        with open(a.spec, encoding='utf-8') as f:
            spec = json.load(f)
        acc, _ = ff.to_docx(a.template, work)
        before_px = ff.parts_xml(acc)
        if not ff.head_logo(before_px):
            raise ff.Fail('the template has no logo in its header: not the original form. Take it from the safety folder '
                          '(tools/od-get.sh) or "iso 9001 updated/טפסים/08" / '
                          'התבנית בלי לוגו בכותרת')
        before = ff.marks(acc)
        px = ff.parts_xml(acc)
        doc = px['word/document.xml']
        log = []
        ff.fill_cells(doc, spec.get('cells') or [], log)
        ff.fill_table_cells(doc, spec.get('table_cells') or [], log)
        rs = spec.get('rows') or []
        for r in [rs] if isinstance(rs, dict) else rs:
            ff.extend_rows(doc, r)
        for r in spec.get('replace_text') or []:
            if not sum(ff.replace_in(root, r['find'], r['value']) for root in px.values()):
                raise ff.Fail('replace_text: "%s" not found' % r['find'])
        summary['content_paragraphs'] = insert_content(doc, spec.get('content'), spec.get('content_before'))
        extra = ff.polish(acc, px, log)
        out = os.path.abspath(a.out)
        os.makedirs(os.path.dirname(out), exist_ok=True)
        docx = out + '.docx'
        ff.write_docx(acc, docx, px, extra)
        summary['docx'] = docx
        after = ff.marks(docx)
        errs = ff.lint(before_px, ff.parts_xml(docx))
        if after['images'] < before['images']:
            errs.append('logo lost / הלוגו אבד: images %d < template %d' % (after['images'], before['images']))
        if before['form_no'] and before['form_no'] not in after['text']:
            errs.append('form number %s missing' % before['form_no'])
        summary['form_no'] = before['form_no']
        if ff.soffice() and spec.get('visual', True):
            pdf = ff.run_soffice(docx, 'pdf', tempfile.mkdtemp(dir=work))
            shutil.copy(pdf, out + '.preview.pdf')
            summary['preview_pdf'] = out + '.preview.pdf'
            expect = [ff.fix_value(s['h']) for s in spec.get('content') or [] if s.get('h')]
            vis = ff.visual_check(out + '.preview.pdf', expect)
            # no Arial in LibreOffice here: a font line is about the preview, not the Word file (polish set Arial)
            vis = [v for v in vis if 'Arial' not in v]
            summary['visual'] = vis or 'ok'
            errs += ['visual / בדיקה ויזואלית: ' + v for v in vis]
        if errs:
            summary['errors'] = errs
            for e in errs:
                print('FAIL: ' + e, file=sys.stderr)
            print(json.dumps(summary, ensure_ascii=False))
            return 1
        summary['ok'] = True
        print(json.dumps(summary, ensure_ascii=False))
        return 0
    except (ff.Fail, OSError, ValueError) as e:
        summary['errors'] = [str(e)]
        print('FAIL: ' + str(e), file=sys.stderr)
        print(json.dumps(summary, ensure_ascii=False))
        return 1
    finally:
        shutil.rmtree(work, ignore_errors=True)


if __name__ == '__main__':
    sys.exit(main())
