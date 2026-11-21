#!/usr/bin/env python3
"""Training video from a deck's scenes (20/11/2026, Michael: "do it: both, all the slides", boiler and induction,
after the work-at-height trial; DECISIONS 20/11/2026). The height video's index.html was written by hand; this tool
builds the same composition from scenes.json, so every deck gets the same look.

scenes.json: a list of scenes, each [kind, tag, title, lines, warn, narration, image?]
  kind 'title' (the cover), 'list', 'photo' (a list with image = [file, credit] above it), or 'anim' (a list with a
  moving drawing above it, x[6] = a name from tools/deck_anim.py NAMES; 21/11/2026).
  narration: 4-300 characters (tts_probe), numbers in words.

Usage:
  python3 tools/deck-video.py tts  <scenes.json> <workdir>      narration per scene -> <workdir>/audio/<i>.wav (skips existing)
  python3 tools/deck-video.py html <scenes.json> <workdir>      -> <workdir>/index.html, timed by the audio lengths
Then, in a hyperframes project (project-files/decks/video/README.md): copy index.html, audio/, logo.jpg and the
images, and render.
"""
import base64, html, json, os, subprocess, sys, time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import deck_anim  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BY = 'הוכן על ידי: מיכאל פרייליך, ממונה בטיחות ואיכות הסביבה'
PAD, LEAD = 1.2, 0.4   # a scene = its narration + 1.2 s; the voice starts 0.4 s in (as the height video)

CSS = '''*{margin:0;padding:0;box-sizing:border-box} html,body{width:1080px;height:1920px;overflow:hidden;background:#0b2545}
#root{width:1080px;height:1920px;position:relative;font-family:"Liberation Sans","DejaVu Sans",sans-serif;direction:rtl}
.scene{position:absolute;inset:0;padding:150px 80px 120px;background:linear-gradient(180deg,#0b2545 0%,#13315c 100%);color:#fff;text-align:right}
.logo{display:block;margin:220px auto 80px;width:420px;border-radius:24px;background:#fff;padding:20px}
.big{font-size:110px;font-weight:700;text-align:center;color:#ffc300;line-height:1.15} .sub{font-size:54px;text-align:center;margin-top:40px;line-height:1.3}
.foot2{font-size:40px;text-align:center;margin-top:180px;color:#cfd8e3}
.tag{display:inline-block;background:#d62828;color:#fff;font-size:38px;padding:10px 28px;border-radius:12px;margin-bottom:30px}
.h{font-size:78px;font-weight:700;color:#ffc300;margin-bottom:56px;line-height:1.15}
ul{list-style:none} li{font-size:54px;line-height:1.35;margin-bottom:42px;padding-right:56px;position:relative}
ul.sm li{font-size:46px;margin-bottom:30px} ul.xs li{font-size:41px;margin-bottom:24px}
li:before{content:"";position:absolute;right:0;top:22px;width:26px;height:26px;border-radius:50%;background:#ffc300}
.warn{margin-top:40px;background:#d62828;font-size:50px;font-weight:700;padding:30px 36px;border-radius:20px;text-align:center}
.anim{display:block;width:100%;height:auto;margin-bottom:40px}
.photo{display:block;width:100%;height:520px;object-fit:cover;border-radius:20px;margin-bottom:6px} .credit{font-size:26px;color:#cfd8e3;margin-bottom:40px}
.by{position:absolute;right:80px;left:80px;bottom:96px;font-size:28px;color:#cfd8e3;text-align:center}
.num{position:absolute;left:80px;top:70px;font-size:32px;color:#cfd8e3}
.bar{position:absolute;left:80px;right:80px;bottom:70px;height:10px;background:rgba(255,255,255,.2);border-radius:5px} .fill{margin-left:auto;height:100%;background:#ffc300;border-radius:5px}'''


def load(p):
    s = json.load(open(p, encoding='utf-8'))
    for i, x in enumerate(s):
        if x[0] not in ('title', 'list', 'photo', 'anim'): raise SystemExit('scene %d: kind %r' % (i, x[0]))
        if not 4 <= len(x[5] or '') <= 300: raise SystemExit('scene %d: narration %d characters (4-300)' % (i, len(x[5] or '')))
        if x[0] == 'photo' and (len(x) < 7 or not x[6]): raise SystemExit('scene %d: photo with no image' % i)
        if x[0] == 'anim' and (len(x) < 7 or x[6] not in deck_anim.NAMES): raise SystemExit('scene %d: anim %r (one of %s)' % (i, x[6] if len(x) > 6 else None, ', '.join(deck_anim.NAMES)))
    return s


def dur(wav):
    out = subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', wav],
                         capture_output=True, text=True, check=True).stdout.strip()
    return float(out)


def tts(scenes, work):
    os.makedirs(os.path.join(work, 'audio'), exist_ok=True)
    for i, x in enumerate(scenes):
        f = os.path.join(work, 'audio', '%d.wav' % i)
        if os.path.exists(f) and os.path.getsize(f) > 1000: continue
        body = json.dumps({'op': 'tts_probe', 'agent': 'deck-video', 'text': x[5], 'model': 'gemini', 'send': False, 'b64': True},
                          ensure_ascii=False)
        for attempt in range(4):
            r = subprocess.run(['bash', os.path.join(ROOT, 'project-files', 'routine-db.sh'), body], capture_output=True, text=True)
            try:
                m = json.loads(r.stdout)['models'][0]
            except Exception:
                m = {'error': (r.stdout or r.stderr)[:200]}
            if m.get('b64'): break
            print('scene %d: %s (try %d)' % (i, m.get('error'), attempt + 1), file=sys.stderr)
            if 'per day' in str(m.get('error')):   # 100 recordings a day (20/11/2026): retrying only burns the day
                raise SystemExit('scene %d: voice quota per day reached' % i)
            if '429' in str(m.get('error')): time.sleep(60)   # the voice allows 10 requests a minute (20/11/2026)
        else:
            raise SystemExit('scene %d: no audio' % i)
        open(f, 'wb').write(base64.b64decode(m['b64']))
        print('scene %d: %.2f s' % (i, dur(f)))


def build(scenes, work):
    e = html.escape
    n = len(scenes)
    secs, auds, tl = [], [], []
    t = 0.0
    for i, x in enumerate(scenes):
        kind, tag, title, lines, warn = x[0], x[1], x[2], x[3] or [], x[4]
        a = dur(os.path.join(work, 'audio', '%d.wav' % i))
        d = round(a + PAD + LEAD, 2)
        body = []
        if kind == 'title':
            body.append('<img class="logo" src="logo.jpg"><div class="big" id="s%d_t">%s</div>' % (i, e(title)))
            for k, l in enumerate(lines): body.append('<div class="sub" id="s%d_l%d">%s</div>' % (i, k, e(l)))
            body.append('<div class="foot2" id="s%d_w">%s</div>' % (i, e(warn or BY)))
            tl.append('tl.from("#s%d_t",{y:60,opacity:0,duration:0.8,ease:"power3.out"},%.2f);' % (i, t + 0.3))
            for k in range(len(lines)): tl.append('tl.from("#s%d_l%d",{opacity:0,duration:0.6},%.2f);' % (i, k, t + 1.2 + 0.6 * k))
            tl.append('tl.from("#s%d_w",{opacity:0,duration:0.6},%.2f);' % (i, t + 1.2 + 0.6 * len(lines)))
        else:
            if tag: body.append('<div class="tag">%s</div>' % e(tag))
            body.append('<div class="h" id="s%d_t">%s</div>' % (i, e(title)))
            if kind == 'photo':
                body.append('<img class="photo" src="%s"><div class="credit">%s</div>' % (e(x[6][0]), e(x[6][1])))
            if kind == 'anim':
                svg, atl = deck_anim.anim(x[6], i, t, d)
                body.append(svg)
                tl.extend(atl)
            chars = sum(len(l) for l in lines) + (len(warn) if warn else 0) + (500 if kind in ('photo', 'anim') else 0)
            cls = ' class="xs"' if chars > 330 else (' class="sm"' if chars > 220 or len(lines) > 5 else '')
            body.append('<ul%s>%s</ul>' % (cls, ''.join('<li id="s%d_l%d">%s</li>' % (i, k, e(l)) for k, l in enumerate(lines))))
            if warn: body.append('<div class="warn" id="s%d_w">%s</div>' % (i, e(warn)))
            tl.append('tl.from("#s%d_t",{x:80,opacity:0,duration:0.6,ease:"power3.out"},%.2f);' % (i, t + 0.2))
            step = (d - 2.0) / max(1, len(lines) + (1 if warn else 0))
            for k in range(len(lines)): tl.append('tl.from("#s%d_l%d",{x:60,opacity:0,duration:0.5},%.2f);' % (i, k, t + 0.8 + step * k))
            if warn: tl.append('tl.from("#s%d_w",{scale:0.8,opacity:0,duration:0.5,ease:"back.out(2)"},%.2f);' % (i, t + 0.8 + step * len(lines)))
        body.append('<div class="by">%s</div><div class="num">%d/%d</div><div class="bar"><div class="fill" id="s%d_bar"></div></div>' % (BY, i + 1, n, i))
        tl.append('tl.fromTo("#s%d_bar",{width:"0%%"},{width:"100%%",duration:%.2f,ease:"none"},%.2f);' % (i, d, t))
        secs.append('<section class="clip scene" id="s%d" data-start="%.2f" data-duration="%.2f" data-track-index="0">%s</section>'
                    % (i, t, d, ''.join(body)))
        auds.append('<audio class="clip" id="a%d" src="audio/%d.wav" data-start="%.2f" data-duration="%.2f" data-track-index="1" data-volume="1"></audio>'
                    % (i, i, t + LEAD, a))
        t = round(t + d, 2)
    page = ('<!doctype html><html lang="he" dir="rtl"><head><meta charset="UTF-8"><meta name="viewport" content="width=1080, height=1920">\n'
            '<script src="gsap.min.js"></script><style>\n' + CSS + '\n</style></head><body>\n'
            '<div id="root" data-composition-id="main" data-start="0" data-duration="%.2f" data-width="1080" data-height="1920" data-fps="30">\n' % t
            + ''.join(secs) + ''.join(auds) + '\n</div><script>const tl=gsap.timeline({paused:true});' + ''.join(tl)
            + 'window.__timelines["main"]=tl;tl.seek(0);</script></body></html>')
    open(os.path.join(work, 'index.html'), 'w', encoding='utf-8').write(page)
    print('index.html: %d scenes, %.1f s' % (n, t))


if __name__ == '__main__':
    if len(sys.argv) != 4 or sys.argv[1] not in ('tts', 'html'): raise SystemExit(__doc__)
    sc = load(sys.argv[2])
    (tts if sys.argv[1] == 'tts' else build)(sc, sys.argv[3])
