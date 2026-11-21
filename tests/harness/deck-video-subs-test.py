#!/usr/bin/env python3
# Captions for the training videos (tools/deck-video-subs.py, 21/11/2026): the pure parts. A caption line longer than
# MAXC runs off a 1080 wide screen, a caption that starts before the voice or ends after the scene shows over the
# next slide, and a line without the right-to-left marks gets its full stop on the wrong side.
import importlib.util, os, sys
sys.stdout.reconfigure(encoding="utf-8")
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
spec = importlib.util.spec_from_file_location("subs", os.path.join(ROOT, "tools", "deck-video-subs.py"))
m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m)
passed = failed = 0
def check(label, cond, detail=None):
    global passed, failed
    if cond: passed += 1; print("  ✓ " + label)
    else: failed += 1; print("  ✗ " + label + ("  -> " + str(detail)[:300] if detail is not None else ""))

long = 'אמוניה היא גז רעיל. בדליפה: לובשים מנ"פ, מתרחקים נגד כיוון הרוח, ומדווחים למנהל המשמרת מיד.'
c = m.chunks(long)
check("chunks: no line longer than MAXC, nothing lost", all(len(x) <= m.MAXC for x in c) and "".join(c).replace(" ", "") == long.replace(" ", ""), c)
check("chunks: a sentence end starts a new line; a short text is one line", c[0] == "אמוניה היא גז רעיל." and m.chunks("שלום.") == ["שלום."], c)
check("chunks: one word longer than MAXC stays whole", m.chunks("א" * 50) == ["א" * 50])
q = m.cues([[0, 0, 0, 0, 0, "שלום לכולם. זה ניסיון."], [0, 0, 0, 0, 0, "שורה שנייה."]], [4.0, 2.0])
check("cues: the first starts LEAD into the scene, the second scene starts after the first narration + PAD + LEAD",
      q[0][0] == m.LEAD and abs(q[-1][0] - (4.0 + m.PAD + m.LEAD)) < 0.01, q)
check("cues: a caption ends with its own narration, before the next scene's voice", abs(q[0][1] - (m.LEAD + 4.0)) < 0.01 and abs(q[-1][1] - (4.0 + m.PAD + m.LEAD + 2.0)) < 0.01, q)
check("cues: two lines to a caption, so no one-word caption alone", "\\N" in m.cues([[0, 0, 0, 0, 0, long]], [9.0])[0][2])
r = m.rtl("בטיחות ביום הראשון: \\Nלעבוד.")
check("rtl: a right-to-left mark on both sides of every line", r.count("‏") == 4 and r.startswith("‏") and r.endswith("‏"), repr(r))
a = m.ass([(0.4, 3.56, "שלום.")])
check("ass: 1080x1920, one dialogue line with times, bottom margin above the author line", "PlayResY: 1920" in a and "Dialogue: 0,0:00:00.40,0:00:03.56,cap" in a and (",%d,177" % m.MARGIN_V) in a)
check("stamp: minutes and hours", m.stamp(946.3) == "0:15:46.30" and m.stamp(3601) == "1:00:01.00")
print("%d passed, %d failed" % (passed, failed))
sys.exit(1 if failed else 0)
