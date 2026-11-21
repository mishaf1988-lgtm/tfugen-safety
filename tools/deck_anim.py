"""Moving drawings for the training videos (21/11/2026, Michael in a questionnaire: "do it: a trial in the next video").
A scene of kind 'anim' is a list scene with a drawing above its lines: [ 'anim', tag, title, lines, warn, narration, name ].
Each drawing is plain SVG (920x560) animated by the same GSAP timeline as the scene, so hyperframes renders it frame by frame.
Every tween is placed at an absolute time inside the scene (t .. t+d): the render seeks the timeline, nothing runs on its own.

anim(name, i, t, d) -> (html, [timeline lines]).  NAMES lists what exists; deck-video.py refuses any other name.
"""

W, H = 920, 560
PANEL = '<rect x="0" y="0" width="920" height="560" rx="24" fill="#0e2a4f"/>'


def _svg(i, inner):
    return ('<svg class="anim" id="s%d_anim" viewBox="0 0 %d %d" width="920" height="560" '
            'font-family="Liberation Sans, DejaVu Sans, sans-serif">%s%s</svg>' % (i, W, H, PANEL, inner))


def _label(x, y, text, size=34, fill='#ffffff', id_=None, weight=700):
    idp = ' id="%s"' % id_ if id_ else ''
    return '<text%s x="%d" y="%d" font-size="%d" font-weight="%d" fill="%s" text-anchor="middle" direction="rtl">%s</text>' % (
        idp, x, y, size, weight, fill, text)


def _person(x, y, color='#8ecae6'):
    """A simple standing figure, feet at (x, y)."""
    return ('<g><circle cx="%d" cy="%d" r="18" fill="%s"/><rect x="%d" y="%d" width="30" height="62" rx="10" fill="%s"/>'
            '<rect x="%d" y="%d" width="10" height="34" fill="%s"/><rect x="%d" y="%d" width="10" height="34" fill="%s"/></g>'
            % (x, y - 112, color, x - 15, y - 92, color, x - 13, y - 34, color, x + 3, y - 34, color))


def sparks10m(i, t, d):
    """Scene: prepare 10 m around. Sparks fly far, some fall through a floor opening and roll on the floor below."""
    p = 's%d_' % i
    ox, oy = 340, 268   # torch tip
    g = [
        '<rect x="20" y="326" width="610" height="10" fill="#cfd8e3"/><rect x="730" y="326" width="170" height="10" fill="#cfd8e3"/>',
        '<rect x="20" y="516" width="880" height="10" fill="#cfd8e3"/>',
        _label(680, 372, 'פתח ברצפה', 26, '#cfd8e3', weight=400), _label(160, 552, 'הקומה שמתחת', 26, '#cfd8e3', weight=400),
        _person(300, 326, '#8ecae6'),
        '<line x1="312" y1="232" x2="%d" y2="%d" stroke="#e0e0e0" stroke-width="8" stroke-linecap="round"/>' % (ox, oy),
        '<circle id="%sglow" cx="%d" cy="%d" r="16" fill="#ffd166"/>' % (p, ox, oy),
        '<ellipse id="%sring" cx="300" cy="331" rx="270" ry="54" fill="none" stroke="#ffc300" stroke-width="5" stroke-dasharray="18 12"/>' % p,
        '<g id="%sm1">%s<line x1="40" y1="200" x2="270" y2="200" stroke="#ffc300" stroke-width="5"/>'
        '<polygon points="30,200 50,190 50,210" fill="#ffc300"/></g>' % (p, _label(150, 186, '10 מטר', 38, '#ffc300')),
        '<g id="%sm2"><line x1="300" y1="350" x2="300" y2="500" stroke="#ffc300" stroke-width="4" stroke-dasharray="10 8"/>%s</g>'
        % (p, _label(380, 440, 'וגם למטה', 32, '#ffc300')),
    ]
    tl = []
    # (x where it lands, y it lands on, then roll to) - deterministic, so every render is the same
    paths = [(80, 322, None), (150, 322, None), (220, 322, None), (430, 322, None), (520, 322, None), (600, 322, None),
             (680, 512, 820), (690, 512, 870), (110, 322, None), (560, 322, None), (40, 322, None), (676, 512, 760)]
    waves = (t + 0.6,) + ((t + d * 0.45,) if d >= 10 else ())   # a second wave only when it ends inside the scene
    for w, start in enumerate(waves):
        for k, (x, y, roll) in enumerate(paths):
            sid = '%ss%d_%d' % (p, w, k)
            g.append('<circle id="%s" cx="%d" cy="%d" r="7" fill="#ffb703" opacity="0"/>' % (sid, ox, oy))
            s0 = start + 0.12 * k
            fall = 1.1 if y > 400 else 0.8
            tl.append('tl.fromTo("#%s",{opacity:1,attr:{cx:%d,cy:%d}},{attr:{cx:%d},duration:%.2f,ease:"none"},%.2f);' % (sid, ox, oy, x, fall, s0))
            tl.append('tl.fromTo("#%s",{attr:{cy:%d}},{attr:{cy:%d},duration:%.2f,ease:"power1.out"},%.2f);' % (sid, oy, oy - 70, fall * 0.3, s0))
            tl.append('tl.to("#%s",{attr:{cy:%d},duration:%.2f,ease:"power2.in"},%.2f);' % (sid, y, fall * 0.7, s0 + fall * 0.3))
            if roll:
                tl.append('tl.to("#%s",{attr:{cx:%d},duration:1.2,ease:"power1.out"},%.2f);' % (sid, roll, s0 + fall))
            tl.append('tl.to("#%s",{opacity:0.35,fill:"#e85d04",duration:0.8},%.2f);' % (sid, s0 + fall + (1.2 if roll else 0)))
    n = max(1, int((d - 0.6) / 0.5))
    tl.append('tl.fromTo("#%sglow",{scale:0.7,transformOrigin:"50%% 50%%"},{scale:1.25,duration:0.25,repeat:%d,yoyo:true,ease:"sine.inOut"},%.2f);' % (p, n, t + 0.4))
    tl.append('tl.fromTo("#%sring",{scale:0.05,opacity:0,transformOrigin:"50%% 50%%"},{scale:1,opacity:1,duration:1.2,ease:"power2.out"},%.2f);' % (p, t + 1.6))
    tl.append('tl.fromTo("#%sm1",{opacity:0},{opacity:1,duration:0.6},%.2f);' % (p, t + 2.4))
    tl.append('tl.fromTo("#%sm2",{opacity:0},{opacity:1,duration:0.6},%.2f);' % (p, t + max(3.2, d * 0.55)))
    return _svg(i, ''.join(g)), tl


def smolder30(i, t, d):
    """Scene: fire watch after the work. The surface looks cold, an ember glows inside; the watch stays 30 minutes."""
    p = 's%d_' % i
    g = ['<rect x="40" y="200" width="420" height="230" rx="10" fill="#6c757d"/>',
         '<rect x="40" y="190" width="420" height="20" fill="#adb5bd"/>']
    for k in range(9):
        g.append('<path d="M%d 220 l30 200" stroke="#5a6169" stroke-width="6"/>' % (60 + 46 * k))
    for k, (x, y, r) in enumerate([(170, 330, 26), (250, 300, 18), (330, 360, 22)]):
        g.append('<circle id="%se%d" cx="%d" cy="%d" r="%d" fill="#ff7b00" opacity="0.15"/>' % (p, k, x, y, r))
    g.append('<path id="%ssmoke" d="M250 186 q-18 -40 0 -80 q18 -40 0 -80" stroke="#cfd8e3" stroke-width="8" fill="none" stroke-linecap="round" opacity="0"/>' % p)
    g.append(_label(250, 476, 'מבחוץ נראה כבוי', 32, '#ffffff'))
    g.append(_label(250, 520, 'בפנים עוד בוער', 32, '#ff9f1c', id_=p + 'in'))
    cx, cy, r = 700, 250, 140
    g.append('<circle cx="%d" cy="%d" r="%d" fill="#13315c" stroke="#cfd8e3" stroke-width="8"/>' % (cx, cy, r))
    circ = 2 * 3.14159 * (r - 22)
    g.append('<circle id="%sarc" cx="%d" cy="%d" r="%d" fill="none" stroke="#ffc300" stroke-width="30" '
             'stroke-dasharray="%.1f" stroke-dashoffset="%.1f" transform="rotate(-90 %d %d)"/>' % (p, cx, cy, r - 22, circ, circ, cx, cy))
    g.append('<line id="%shand" x1="%d" y1="%d" x2="%d" y2="%d" stroke="#ffffff" stroke-width="10" stroke-linecap="round"/>' % (p, cx, cy, cx, cy - 100))
    g.append('<circle cx="%d" cy="%d" r="12" fill="#ffffff"/>' % (cx, cy))
    g.append(_label(cx, 450, 'צופה האש נשאר', 34, '#ffffff'))
    g.append(_label(cx, 500, '30 דקות לפחות', 40, '#ffc300', id_=p + 'm'))
    g.append('<path id="%sok" d="M650 250 l35 35 l70 -80" stroke="#2dc653" stroke-width="22" fill="none" stroke-linecap="round" stroke-linejoin="round" opacity="0"/>' % p)
    tl = []
    run = max(2.0, d - 2.2)
    for k in range(3):
        n = max(1, int(run / (0.9 + 0.2 * k)))
        tl.append('tl.fromTo("#%se%d",{opacity:0.15,scale:0.8,transformOrigin:"50%% 50%%"},{opacity:0.95,scale:1.15,duration:%.2f,repeat:%d,yoyo:true,ease:"sine.inOut"},%.2f);'
                  % (p, k, 0.9 + 0.2 * k, n, t + 0.5 + 0.3 * k))
    tl.append('tl.fromTo("#%ssmoke",{opacity:0,y:20},{opacity:0.7,y:-10,duration:2.5,ease:"sine.out"},%.2f);' % (p, t + 1.0))
    tl.append('tl.fromTo("#%sin",{opacity:0},{opacity:1,duration:0.6},%.2f);' % (p, t + 1.5))
    tl.append('tl.fromTo("#%sarc",{attr:{"stroke-dashoffset":%.1f}},{attr:{"stroke-dashoffset":0},duration:%.2f,ease:"none"},%.2f);' % (p, circ, run, t + 0.8))
    tl.append('tl.fromTo("#%shand",{rotation:0,svgOrigin:"%d %d"},{rotation:360,svgOrigin:"%d %d",duration:%.2f,ease:"none"},%.2f);' % (p, cx, cy, cx, cy, run, t + 0.8))
    tl.append('tl.fromTo("#%sok",{opacity:0,scale:0.4,transformOrigin:"50%% 50%%"},{opacity:1,scale:1,duration:0.5,ease:"back.out(2)"},%.2f);' % (p, t + 0.8 + run))
    tl.append('tl.to("#%shand",{opacity:0,duration:0.3},%.2f);' % (p, t + 0.8 + run))
    return _svg(i, ''.join(g)), tl


def drumvapor(i, t, d):
    """Scene: an 'empty' drum. Vapour fills it, a torch comes near, it flares: no hot work on drums, even empty."""
    p = 's%d_' % i
    g = ['<rect x="130" y="110" width="260" height="380" rx="26" fill="#4361ee"/>',
         '<rect x="130" y="210" width="260" height="14" fill="#3a0ca3"/><rect x="130" y="380" width="260" height="14" fill="#3a0ca3"/>',
         '<ellipse cx="260" cy="110" rx="130" ry="26" fill="#4895ef"/>']
    for k, (x, y, rx) in enumerate([(200, 440, 60), (310, 430, 55), (250, 350, 70), (210, 280, 55), (310, 300, 60), (260, 190, 75)]):
        g.append('<ellipse id="%sv%d" cx="%d" cy="%d" rx="%d" ry="%d" fill="#c8b6ff" opacity="0"/>' % (p, k, x, y, rx, int(rx * 0.6)))
    g.append(_label(260, 330, '"ריקה"', 44, '#ffffff'))
    g.append(_label(260, 540, 'בפנים: אדים דליקים', 34, '#c8b6ff', id_=p + 'lab'))
    g.append('<g id="%storch"><rect x="720" y="250" width="170" height="26" rx="10" fill="#adb5bd"/>'
             '<polygon points="720,248 660,263 720,278" fill="#ffd166"/><circle cx="655" cy="263" r="14" fill="#ff9f1c"/></g>' % p)
    pts = []
    import math
    for k in range(16):
        a = math.pi * 2 * k / 16
        rr = 210 if k % 2 == 0 else 95
        pts.append('%.0f,%.0f' % (260 + rr * math.cos(a), 180 + rr * math.sin(a)))
    g.append('<polygon id="%sboom" points="%s" fill="#ff7b00" stroke="#ffd166" stroke-width="10" opacity="0"/>' % (p, ' '.join(pts)))
    g.append('<g id="%sno" opacity="0"><circle cx="690" cy="400" r="110" fill="none" stroke="#d62828" stroke-width="22"/>'
             '<line x1="612" y1="478" x2="768" y2="322" stroke="#d62828" stroke-width="22"/></g>' % p)
    g.append(_label(690, 545, 'לא מרתכים', 40, '#ff6b6b', id_=p + 'nol'))
    tl = []
    fill_end = t + max(2.5, d * 0.35)
    for k in range(6):
        s = t + 0.5 + (fill_end - t - 0.5) * k / 6
        tl.append('tl.fromTo("#%sv%d",{opacity:0,y:30},{opacity:0.75,y:0,duration:1.4,ease:"sine.out"},%.2f);' % (p, k, s))
    tl.append('tl.fromTo("#%slab",{opacity:0},{opacity:1,duration:0.6},%.2f);' % (p, fill_end - 0.6))
    near = fill_end + 0.4
    tl.append('tl.fromTo("#%storch",{x:220},{x:0,duration:1.6,ease:"power1.inOut"},%.2f);' % (p, near - 1.6))
    tl.append('tl.fromTo("#%storch",{x:0},{x:-200,duration:0.9,ease:"power1.in"},%.2f);' % (p, near))
    boom = near + 0.9
    tl.append('tl.fromTo("#%sboom",{opacity:0,scale:0.1,transformOrigin:"260px 180px"},{opacity:1,scale:1.2,duration:0.35,ease:"power3.out"},%.2f);' % (p, boom))
    tl.append('tl.to("#%sboom",{opacity:0,duration:1.0},%.2f);' % (p, boom + 0.6))
    tl.append('tl.to("#%storch",{opacity:0,duration:0.4},%.2f);' % (p, boom + 0.3))
    tl.append('tl.fromTo("#%sno",{opacity:0,scale:0.5,transformOrigin:"690px 400px"},{opacity:1,scale:1,duration:0.5,ease:"back.out(2)"},%.2f);' % (p, boom + 1.0))
    tl.append('tl.fromTo("#%snol",{opacity:0},{opacity:1,duration:0.5},%.2f);' % (p, boom + 1.2))
    return _svg(i, ''.join(g)), tl


NAMES = {'sparks10m': sparks10m, 'smolder30': smolder30, 'drumvapor': drumvapor}


def anim(name, i, t, d):
    return NAMES[name](i, t, d)
