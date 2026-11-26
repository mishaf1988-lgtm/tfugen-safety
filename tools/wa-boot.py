#!/usr/bin/env python3
"""The WhatsApp assistant's start-up in one round (24/11/2026, Michael in the questionnaire: "do it: one opening
command (recommended)"). Measured that day: every run spent its first 4-5 tool calls on start-up (wc, cat of the core
that spilled over the tool's output limit and was Read again, 2-3 grep/cat on wa-topics files such as docs.md, 79KB),
and every later step re-reads all of it. Same idea as tools/common-read.py.

  python3 tools/wa-boot.py --page 1 <<'EOF'      # pages 1-4 in parallel, in ONE message (four Bash calls in one round)
  <Michael's message text; for a short reply such as "2" or "do it" add prev_assistant_message>
  EOF
  python3 tools/wa-boot.py --topics-only - < msg  # the core already read: only the topic sections and the notebook lines
  python3 tools/wa-boot.py --section docs.md#12   # one section that was not printed
  python3 tools/wa-boot.py --all "<text>"         # everything, no paging (tests and measuring)
  python3 tools/wa-boot.py --stats "<text>"       # sizes only

What it prints: the whole of project-files/routine-wa-core.md (never trimmed: safety rules, Hebrew, confirmations, the
365 rules), then at most MAX_SECTIONS sections of the wa-topics files the message routes to (ROUTES, the same routing
as step 2 of the core), at most TOPIC_CHARS characters, then up to NB_LINES matching lines of wa-topics/notebook.md
(the core greps it before every wa_me), and a last line with what was NOT printed and how to get it.
Pages: the Bash tool spills an output over about 30KB to a file (measured 24/11/2026: 28.5KB came back whole, 31.3KB and
33KB spilled), so the text is cut into pages of PAGE_BYTES. Deterministic: no network, no model, no clock.
A topic file named in ROUTES that is missing, or a wa-topics file with no route, is an error (exit 2), not a silent skip.
"""
import os, re, sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
CORE = os.path.join(ROOT, "project-files", "routine-wa-core.md")
TOPICS = os.path.join(ROOT, "project-files", "wa-topics")
NOTEBOOK = "notebook.md"
MAX_SECTIONS = 3
TOPIC_CHARS = 12000
NB_LINES = 5
NB_CHARS = 2000
PAGE_BYTES = 27000
SPLIT_AT = 4000  # a rule paragraph longer than this is cut at its bold sub-titles ("**...**")

# Which topic file a message needs: the routes of step 2 in routine-wa-core.md, as word starts (after the prefixes
# ו ה ב ל מ ש כ). A keyword of two words matches the message as a phrase. commands.md also routes by the first word.
ROUTES = {
    "docs.md": ["טיוט", "מייל", "מיילים", "קובץ", "קבצ", "מסמך", "מסמכ", "וורד", "word", "excel", "אקסל", "pdf",
                "תסקיר", "חשבוני", "צילום", "צילמ", "תמונ", "תעוד", "תוקף", "תפוג", "פג תוקף", "נשמר", "לתייק", "תיוק",
                "תתייק", "הצעת מחיר", "ביטוח", "קבלן", "od_swap", "iso"],
    "prof.md": ["חוק", "תקן", "תקנ", "דין", "מותר", "אסור", "תדירות", "סעיף", "רגולציה", "אמוניה", "חומ\"ס", "חומס",
                "ממונה", "היתר"],
    "ops.md": ["עובד", "מפגע", "ציוד", "תאונ", "פציע", "נפגע", "פיתוח", "בצע", "מאשר", "ליקוי", "ליקויי", "אחזקה",
               "מלגז", "מנוף", "סולם"],
    "maps.md": ["מפה", "מפת", "תוכנית", "שרטוט", "תכנית"],
    "calsign.md": ["יומן", "זימון", "תזמן", "חתימ", "תחתום", "לחתום", "חתום", "הזז", "פגיש"],
    "commands.md": [],
    "meeting.md": ["הקלט", "תמלל", "תמלול", "פרוטוקול", "ישיב", "ייצוא", "ייצא", "קבוצת", "קבוצה", "wa_chat"],
    "privacy.md": ["תסתיר", "הסתר", "להסתיר", "פרטים אישיים", "השחר"],
    "promises.md": ["תזכיר", "תזכורת", "מעקב", "תחזור", "תעדכן", "אחזור"],
    "learn.md": ["למדת", "תזכור", "טעית", "לא נכון", "מחברת", "מחק"],
    NOTEBOOK: [],  # always searched for lines (the core's step 0ג1), never as a whole topic
}
COMMAND_WORDS = ["סכם", "תחקיר", "שיחה", "מה ישבר", "נגד", "החלט", "שאלות", "עדיפות", "נוהל", "הדרכה", "השווה",
                 "פקודות"]
STOP = {"מה", "של", "את", "על", "עם", "לי", "אני", "זה", "זאת", "יש", "אין", "כל", "גם", "רק", "או", "אם", "כי", "לא",
        "כן", "עד", "מי", "איך", "למה", "היום", "מחר", "עכשיו", "בבקשה", "תודה", "הוא", "היא", "הם", "שלי", "שלך",
        "אתה", "אפשר", "צריך", "תוכל", "תן", "לך", "אותו", "אותה", "עוד", "כבר", "יותר", "מצב", "המצב", "משהו",
        "דחוף", "איפה", "כמה", "האם", "מתי", "תכין", "תשלח", "תבדוק", "ביום", "לאחר", "בוקר", "טוב", "הי", "היי", "שלום", "אחרי", "לפני", "אבל", "שם", "פה", "the"}
PREFIX = "והבלמשכ"
WORD = re.compile(r"[A-Za-z0-9_א-ת\"]+")


class BootError(Exception):
    pass


def words(text):
    return [w.strip('"').lower() for w in WORD.findall(text or "") if w.strip('"')]


def variants(w):
    out = [w]
    if len(w) >= 4 and w[0] in PREFIX:
        out.append(w[1:])
        if len(w) >= 5 and w[1] in PREFIX:
            out.append(w[2:])
    return out


def word_stems(w):
    """The search stems of one word: without up to two prefix letters and a plural or feminine ending. A stripped
    form must keep 4 letters (המלגזה gives מלגז, not לגז)."""
    out = set()
    if w in STOP:
        return out
    for n, v in enumerate(variants(w)):
        s = v
        if len(s) >= 5 and s.endswith(("ים", "ות")):
            s = s[:-2]
        elif len(s) >= 4 and s[-1] in "הת":
            s = s[:-1]
        if len(s) >= (3 if n == 0 else 4) and s not in STOP and v not in STOP:
            out.add(s)
    return out


def stems(text):
    """{word: its stems} for the words of a message that can be searched."""
    out = {}
    for w in words(text):
        st = word_stems(w)
        if st:
            out[w] = st
    return out


def word_re(stem):
    return re.compile(r"(?<![A-Za-z0-9_א-ת])[" + PREFIX + r"]{0,2}" + re.escape(stem.lower()))


def routed(msg):
    """The topic files the message routes to, in ROUTES order."""
    norm = " ".join(words(msg))
    ws = words(msg)
    out = []
    for name, keys in ROUTES.items():
        if name == NOTEBOOK:
            continue
        hit = any((" " in k and k in norm) or (" " not in k and any(v.startswith(k) for w in ws for v in variants(w)))
                  for k in keys)
        if name == "commands.md" and ws:
            first = norm
            hit = hit or any(first == c or first.startswith(c + " ") for c in COMMAND_WORDS)
        if hit:
            out.append(name)
    return out


SEC_START = re.compile(r"^(## |\s{0,3}- |\d[0-9א-ת-]*\. |\*\*)")
SUB_SPLIT = re.compile(r"(?<=[.;:)\]]) (?=\*\*[^*\n]{3,90}\*\*)")


def title_of(text):
    m = re.search(r"\*\*([^*\n]{3,90})\*\*", text[:300])
    t = m.group(1) if m else re.sub(r"^[\s#*-]+", "", text.split("\n", 1)[0])
    t = t.strip(" .:")
    return t[:40]


def sections(name, text):
    """[(id, title, text)]: a section starts at a '## ' heading, a bullet with indent 0-3, a rule number such as
    '0ב1. ', or a bold opening; deeper lines belong to it. Lines before the first section (the title) are not a section.
    A paragraph over SPLIT_AT characters is cut at its bold sub-titles."""
    raw, cur = [], None
    for line in text.split("\n"):
        if line.strip() and SEC_START.match(line) and not line.startswith("# "):
            if cur is not None:
                raw.append(cur)
            cur = [line]
        elif cur is not None:
            cur.append(line)
    if cur is not None:
        raw.append(cur)
    out = []
    for lines in raw:
        body = "\n".join(lines).rstrip()
        parts = [body]
        if len(body) > SPLIT_AT:
            parts = [p for p in SUB_SPLIT.split(body) if p.strip()]
        for p in parts:
            out.append((name + "#" + str(len(out) + 1), title_of(p), p))
    return out


def read_topic(name):
    path = os.path.join(TOPICS, name)
    if not os.path.exists(path):
        raise BootError("missing topic file: project-files/wa-topics/" + name + " (ROUTES in tools/wa-boot.py)")
    return open(path, encoding="utf-8").read()


def check_routes():
    have = sorted(f for f in os.listdir(TOPICS) if f.endswith(".md"))
    for name in ROUTES:
        read_topic(name)
    extra = [f for f in have if f not in ROUTES]
    if extra:
        raise BootError("wa-topics file with no route in tools/wa-boot.py ROUTES: " + ", ".join(extra))


def has(low, st):
    return any(word_re(s).search(low) for s in st)


def score(sec_text, ms, df):
    """Each message word found in the section adds 1/(the number of sections that have it): a rare word weighs more."""
    low = sec_text.lower()
    return sum(1.0 / df[w] for w, st in ms.items() if df.get(w) and has(low, st))


def pick(msg):
    """(chosen sections, notebook lines, not printed [(file, [(id, title)])], files not routed)."""
    check_routes()
    ms = stems(msg)
    files = routed(msg)
    secs = [s for f in files for s in sections(f, read_topic(f))]
    df = {w: sum(1 for _, _, t in secs if has(t.lower(), st)) for w, st in ms.items()}
    ranked = []
    for i, (sid, title, text) in enumerate(secs):
        sc = score(text, ms, df)
        if sc > 0:
            ranked.append((-sc, i, sid, title, text))
    ranked.sort()
    chosen, used = [], 0
    for _, i, sid, title, text in ranked:
        if len(chosen) >= MAX_SECTIONS:
            break
        if used + len(text) > TOPIC_CHARS:
            continue
        chosen.append((i, sid, title, text))
        used += len(text)
    chosen.sort()
    got = {sid for _, sid, _, _ in chosen}
    left = [(f, [(sid, title) for sid, title, _ in secs if sid.startswith(f + "#") and sid not in got]) for f in files]
    # notebook lines (the core's step 0ג1)
    nb = sections(NOTEBOOK, read_topic(NOTEBOOK))
    ndf = {w: sum(1 for _, _, t in nb if has(t.lower(), st)) for w, st in ms.items()}
    nrank = sorted((-score(t, ms, ndf), -i, sid, t) for i, (sid, _, t) in enumerate(nb) if score(t, ms, ndf) > 0)
    nlines, nused = [], 0
    for _, negi, sid, t in nrank:
        if len(nlines) >= NB_LINES:
            break
        if nused + len(t) > NB_CHARS:
            continue
        nlines.append((-negi, t))
        nused += len(t)
    nlines.sort()
    not_routed = [f for f in ROUTES if f not in files and f != NOTEBOOK]
    return chosen, [t for _, t in nlines], left, not_routed


def build(msg, topics_only=False):
    core = open(CORE, encoding="utf-8").read()
    if core.count("\n---\n") < 2:
        raise BootError("routine-wa-core.md lost its two '---' lines")
    chosen, nlines, left, not_routed = pick(msg)
    out = []
    if not topics_only:
        out.append("=== wa-boot: הליבה, project-files/routine-wa-core.md (הקובץ כולו) ===")
        out.append(core.rstrip())
    out.append("=== wa-boot: סעיפים מ-wa-topics לפי ההודעה (" + str(len(chosen)) + ") ===")
    if not chosen:
        out.append("(אין: ההודעה לא נוגעת בנושא שיש לו קובץ)")
    for _, sid, title, text in chosen:
        out.append("--- " + sid + " | " + title + " ---")
        out.append(text.strip("\n"))
    out.append("=== wa-boot: שורות מהמחברת (wa-topics/notebook.md) שמתאימות להודעה (" + str(len(nlines)) + ") ===")
    out.extend(t.strip() for t in nlines)
    parts = []
    for f, secs in left:
        if secs:
            parts.append(f + ": " + "; ".join(sid.split("#")[1] + " " + t[:24] for sid, t in secs))
    last = "=== wa-boot: לא הודפס === " + (" | ".join(parts) if parts else "מהנושאים שנבחרו: כלום")
    last += " | נושאים שלא נבחרו: " + ", ".join(not_routed)
    last += " | סעיף: python3 tools/wa-boot.py --section <קובץ>#<מספר> | חיפוש: grep -n -i \"<מילה>\" project-files/wa-topics/<קובץ>"
    out.append(last)
    return "\n".join(out) + "\n"


def pages(text, limit=PAGE_BYTES):
    """Cut at line ends (a line longer than a page at a space) into pages of at most `limit` UTF-8 bytes,
    leaving room for the page header and footer."""
    room = limit - 200
    pieces = []
    for line in text.splitlines(keepends=True):
        while len(line.encode()) > room:
            cut = len(line)
            while cut > 0 and len(line[:cut].encode()) > room:
                cut = line.rfind(" ", 0, cut - 1)
            if cut <= 0:  # no space: cut by characters
                cut = room // 4
            pieces.append(line[:cut])
            line = line[cut:]
        pieces.append(line)
    out, cur, size = [], [], 0
    for p in pieces:
        b = len(p.encode())
        if size + b > room and cur:
            out.append("".join(cur))
            cur, size = [], 0
        cur.append(p)
        size += b
    if cur:
        out.append("".join(cur))
    return out


def one_section(ref):
    name, _, num = ref.partition("#")
    for sid, title, text in sections(name, read_topic(name)):
        if sid == ref:
            return "--- " + sid + " | " + title + " ---\n" + text.strip("\n") + "\n"
    raise BootError("no section " + ref)


def read_msg(args):
    if not args:
        return ""
    if args == ["-"]:
        return sys.stdin.read()
    if len(args) == 1 and os.path.isfile(args[0]):
        return open(args[0], encoding="utf-8").read()
    return " ".join(args)


def main(argv):
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass
    args = list(argv)
    page, mode = 1, "page"
    try:
        if args[:1] == ["--section"]:
            sys.stdout.write(one_section(args[1]))
            return 0
        if "--page" in args:
            i = args.index("--page")
            page = int(args[i + 1])
            del args[i:i + 2]
        topics_only = "--topics-only" in args
        args = [a for a in args if a != "--topics-only"]
        for flag in ("--all", "--stats"):
            if flag in args:
                mode = flag[2:]
                args.remove(flag)
        if not args and not sys.stdin.isatty():
            args = ["-"]
        text = build(read_msg(args), topics_only)
    except BootError as e:
        print("wa-boot error: " + str(e), file=sys.stderr)
        return 2
    pg = pages(text)
    if mode == "all":
        sys.stdout.write(text)
        return 0
    if mode == "stats":
        print("chars %d bytes %d pages %d" % (len(text), len(text.encode()), len(pg)))
        return 0
    if page < 1 or page > len(pg):
        print("[wa-boot: אין עמוד %d, יש %d. הכל נקרא]" % (page, len(pg)))
        return 0
    sys.stdout.write("[wa-boot עמוד %d/%d]\n" % (page, len(pg)) + pg[page - 1])
    if page < len(pg):
        sys.stdout.write("[wa-boot: המשך בעמוד %d. אם לא הרצת אותו: python3 tools/wa-boot.py --page %d עם אותה הודעה]\n"
                         % (page + 1, page + 1))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
