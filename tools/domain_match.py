"""How a message finds its work branch and the lines in it (02/11/2026, Michael in the questionnaire: "do it: smart
ranking and spelling mistakes", after a look at GitHub search tools: BM25 as in wink-bm25 / ndx, typo tolerance).
Used by .claude/hooks/domain-load.py and tools/domain-gaps.py; the server has the same match in functions/_domains.js
(tools/domains-build.py writes it). No library.

- tokens(text): the words of a message, lower case, also without one or two Hebrew prefix letters (ו ה ב ל מ ש כ).
- word_hit(word, text, toks): a branch word is in the text, or (one word of 5 letters or more) one letter away from
  a word of the text, so "תסקירם" or "קבלנימ" still count. Short words only exactly: one letter off a 4-letter Hebrew
  word is often another word.
- rank(lines, toks): BM25 (k1 1.2, b 0.75) of the lines against the message words; a rare word (146.03) weighs more
  than a common one (טופס). A word matches a line when it is inside it, or one letter away from a word of it.
"""
import math, re

STOP = set("את של עם על אני רוצה צריך לי זה זו יש אם גם מה כל לא כן הוא היא הם אתה תכין הכן תבדוק בדוק שלח תשלח לגבי איך למה מתי איפה אבל או רק עוד כבר שלי שלך אותו אותה אחרי לפני היום מחר אתמול".split())
PREFIX = "והבלמשכ"
WORD = re.compile(r"[\w֐-׿.-]+")
FUZZY_MIN = 5


def words(text):
    return [w.strip(".-") for w in WORD.findall(str(text or "").lower()) if w.strip(".-")]


def tokens(text):
    out = set()
    for w in words(text):
        if len(w) >= 3 and w not in STOP:
            out.add(w)
        for _ in range(2):
            if len(w) > 3 and w[0] in PREFIX:
                w = w[1:]
                if len(w) >= 3 and w not in STOP:
                    out.add(w)
    return out


def lev1(a, b):
    """True when a and b are at most one edit apart (insert, delete or replace one letter)."""
    if a == b:
        return True
    la, lb = len(a), len(b)
    if abs(la - lb) > 1:
        return False
    if la > lb:
        a, b, la, lb = b, a, lb, la
    i = 0
    while i < la and a[i] == b[i]:
        i += 1
    return a[i + 1:] == b[i + 1:] if la == lb else a[i:] == b[i + 1:]


def near(word, toks):
    return len(word) >= FUZZY_MIN and any(len(t) >= FUZZY_MIN - 1 and lev1(word, t) for t in toks)


def _cls(c):
    return "a-z" if "a" <= c <= "z" else "0-9" if "0" <= c <= "9" else ""


def in_text(w, text):
    """retro 02/11/2026 (c): a Latin word only as a whole word (coa is not inside coach, iso not inside isolate);
    a Hebrew word stays a substring, since a prefix letter is glued to it. Same rule as functions/_domains.js."""
    if not all(" " <= c <= "~" for c in w):
        return w in text
    a, b = _cls(w[0]), _cls(w[-1])
    return re.search(("(^|[^" + a + "])" if a else "") + re.escape(w) + ("([^" + b + "]|$)" if b else ""), text) is not None


def word_hit(word, text, toks):
    w = word.lower()
    return in_text(w, text) or (" " not in w and near(w, toks))


def branches(text, idx):
    t = str(text or "").lower()
    toks = tokens(t)
    return [(k, v, sum(1 for w in v.get("words", []) if word_hit(w, t, toks))) for k, v in idx.items()
            if not k.startswith("_") and any(word_hit(w, t, toks) for w in v.get("words", []))]


def rank(lines, toks, k1=1.2, b=0.75):
    docs = [(l, l.lower(), set(words(l))) for l in lines]
    n = len(docs) or 1
    avg = sum(len(d[1]) for d in docs) / n or 1

    def has(tok, d):
        return tok in d[1] or (len(tok) >= FUZZY_MIN and any(len(x) >= FUZZY_MIN - 1 and lev1(tok, x) for x in d[2]))

    df = {t: sum(1 for d in docs if has(t, d)) for t in toks}
    out = []
    for i, d in enumerate(docs):
        s = 0.0
        for t in toks:
            if df[t] and has(t, d):
                idf = math.log(1 + (n - df[t] + 0.5) / (df[t] + 0.5))
                s += idf * (k1 + 1) / (1 + k1 * (1 - b + b * len(d[1]) / avg))
        if s > 0:
            out.append((s, i, d[0]))
    out.sort(key=lambda x: (-x[0], x[1]))
    return out
