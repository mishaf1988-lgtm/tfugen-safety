#!/usr/bin/env python3
"""Hebrew captions on a training video (21/11/2026, Michael in the questionnaire, after a screenshot of video skills:
"do it: captions on one video"): a worker can watch on the floor with no sound. The captions are the narration
itself (scenes.json, field 5), timed from the recordings the video was built from, and burned into the picture with
ffmpeg (libass), nothing leaves the machine.

  python3 tools/deck-video-subs.py <scenes.json> <work-dir with audio/N.wav> <in.mp4> <out.mp4>

A scene lasts its narration + PAD and the voice starts LEAD into it (tools/deck-video.py). A narration is cut into
captions of at most MAXC characters at sentence ends, then at commas, then at spaces; each caption gets a share of
the scene's voice time by its length. Two lines to a caption."""
import json, os, re, subprocess, sys

PAD, LEAD = 1.2, 0.4      # as tools/deck-video.py
MAXC = 34                 # characters in one caption line at 1080 wide, font size 54
MARGIN_V = 170            # above the author line at the bottom


def dur(wav):
    return float(subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', wav],
                                capture_output=True, text=True, check=True).stdout.strip())


def chunks(text, maxc=MAXC):
    """Pure: the narration as caption lines, none longer than maxc unless one word is."""
    out = []
    for sent in re.split(r'(?<=[.!?])\s+', text.strip()):
        parts = [sent]
        for sep in (r'(?<=[,;:])\s+', r'\s+'):
            nxt = []
            for p in parts:
                if len(p) <= maxc: nxt.append(p); continue
                cur = ''
                for w in re.split(sep, p):
                    if cur and len(cur) + 1 + len(w) > maxc: nxt.append(cur); cur = w
                    else: cur = (cur + ' ' + w).strip()
                if cur: nxt.append(cur)
            parts = nxt
        out.extend(p for p in parts if p)
    return out


def cues(scenes, durs):
    """Pure: [(start, end, text)] over the whole video."""
    res, t = [], 0.0
    for x, d in zip(scenes, durs):
        ls = chunks(x[5])
        cs = [' \\N'.join(ls[k:k + 2]) for k in range(0, len(ls), 2)]   # two lines a caption: no one-word caption left alone
        total = sum(len(c) for c in cs) or 1
        s = t + LEAD
        for c in cs:
            e = s + d * len(c) / total
            res.append((round(s, 2), round(e, 2), c)); s = e
        t += d + PAD
    return res


def stamp(sec):
    h = int(sec // 3600); m = int(sec % 3600 // 60); s = sec % 60
    return '%d:%02d:%05.2f' % (h, m, s)


def rtl(t):
    """Pure: a right-to-left mark around every line, or libass puts the closing full stop or colon on the right."""
    return ' \\N'.join('\u200f' + l.strip() + '\u200f' for l in t.replace('\n', ' ').split('\\N'))


def ass(cs):
    head = '''[Script Info]
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920
WrapStyle: 2

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: cap,Liberation Sans,54,&H00FFFFFF,&H00FFFFFF,&HC0000000,&HC0000000,1,0,0,0,100,100,0,0,3,10,0,2,40,40,%d,177

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
''' % MARGIN_V
    return head + ''.join('Dialogue: 0,%s,%s,cap,,0,0,0,,%s\n' % (stamp(s), stamp(e), rtl(t)) for s, e, t in cs)


def main():
    if len(sys.argv) != 5: raise SystemExit(__doc__)
    scenes = json.load(open(sys.argv[1], encoding='utf-8'))
    work, src, out = sys.argv[2], sys.argv[3], sys.argv[4]
    durs = [dur(os.path.join(work, 'audio', '%d.wav' % i)) for i in range(len(scenes))]
    cs = cues(scenes, durs)
    f = os.path.join(work, 'captions.ass'); open(f, 'w', encoding='utf-8').write(ass(cs))
    r = subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', src, '-vf', 'ass=' + f.replace(':', r'\:'), '-c:a', 'copy', out])
    if r.returncode or not os.path.exists(out): raise SystemExit('ffmpeg failed')
    print('%d captions, last ends %.1f s, %s' % (len(cs), cs[-1][1], out))


if __name__ == '__main__':
    main()
