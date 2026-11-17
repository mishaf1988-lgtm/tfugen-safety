"""בונה שני קטעי אנימציה (GIF שמתנגן לבד בשקף): חיתוך בזרם מים, וקילוף בקיטור."""
import math, random, sys
from PIL import Image, ImageDraw

S = 2  # ציור בגודל כפול והקטנה, לקצוות חלקים
W, H = 660, 300
TINT, DARK, DEEP, ACC = "#EFF2F5", "#0B2635", "#14485F", "#1F608C"
WATER, GOLD, RED, SKIN, FLESH = "#BFD9EA", "#E09A2F", "#C0453B", "#8A5A2B", "#F0D27A"

def canvas():
    im = Image.new("RGB", (W * S, H * S), TINT)
    return im, ImageDraw.Draw(im)

def done(im):
    return im.resize((W, H), Image.LANCZOS)

def R(d, x0, y0, x1, y1, **k):
    d.rounded_rectangle([x0 * S, y0 * S, x1 * S, y1 * S], radius=k.pop("r", 0) * S, **k)

def E(d, cx, cy, rx, ry, **k):
    d.ellipse([(cx - rx) * S, (cy - ry) * S, (cx + rx) * S, (cy + ry) * S], **k)

def save(frames, name, ms):
    # לוח צבעים מכמה פריימים יחד, אחרת צבע שמופיע רק בהמשך (הצ'יפס הצהוב) יוצא אפור
    pick = frames[::max(len(frames) // 6, 1)]
    strip = Image.new("RGB", (W * len(pick), H))
    for i, f in enumerate(pick):
        strip.paste(f, (i * W, 0))
    pal = strip.quantize(colors=96, dither=Image.NONE)
    q = [f.quantize(palette=pal, dither=Image.NONE) for f in frames]
    q[0].save(name, save_all=True, append_images=q[1:], duration=ms, loop=0, optimize=False, disposal=1)

def cut():
    """תפוח אדמה נורה בצינור מים מימין לשמאל, פוגש רשת סכינים ויוצא כמקלות."""
    frames, N, bx = [], 54, 250  # bx: מיקום רשת הסכינים
    rnd = random.Random(3)
    streaks = [(rnd.uniform(0, W), rnd.uniform(108, 192), rnd.uniform(18, 46)) for _ in range(26)]
    for f in range(N):
        im, d = canvas()
        R(d, 20, 95, W - 20, 205, r=55, fill=WATER, outline=DEEP, width=5 * S)
        for x, y, ln in streaks:  # פסי מים זזים שמאלה
            xx = (x - f * 34) % (W - 80) + 40
            d.line([(xx * S, y * S), ((xx + ln) * S, y * S)], fill="#FFFFFF", width=3 * S)
        t = min(f / 22, 1.0)
        px = W - 70 - (W - 70 - bx) * (t ** 2.2)  # האצה
        if f <= 22:
            E(d, px, 150, 46, 32, fill=GOLD, outline=SKIN, width=4 * S)
            E(d, px + 14, 140, 4, 3, fill=SKIN); E(d, px - 12, 158, 4, 3, fill=SKIN)
        if f >= 20:  # המקלות יוצאים משמאל לרשת
            u = min((f - 20) / 18, 1.0)
            for i in range(5):
                y = 118 + i * 16
                x1 = bx - 6 - u * (150 + i * 9)
                R(d, x1, y - 5, min(x1 + 92, bx - 4), y + 5, r=3, fill=FLESH, outline=GOLD, width=2 * S)
        R(d, bx - 5, 80, bx + 5, 220, r=3, fill=DARK)  # רשת הסכינים
        for i in range(6):
            y = 110 + i * 16
            d.line([((bx - 14) * S, y * S), ((bx + 14) * S, y * S)], fill=RED, width=3 * S)
        frames.append(done(im))
    save(frames, "clip-cut.gif", 60)

def peel():
    """סיר לחץ: הלחץ עולה, משתחרר בבת אחת, והקליפה עפה."""
    frames, N, pop = [], 60, 30
    rnd = random.Random(5)
    flakes = [(rnd.uniform(0, 2 * math.pi), rnd.uniform(5, 11), rnd.uniform(5, 9)) for _ in range(22)]
    bub = [(rnd.uniform(215, 445), rnd.uniform(0, 1), rnd.uniform(5, 10)) for _ in range(16)]
    for f in range(N):
        im, d = canvas()
        flash = f in (pop, pop + 1)
        R(d, 190, 55, 470, 245, r=60, fill="#FFFFFF" if flash else "#DCE8F2", outline=DEEP, width=7 * S)
        R(d, 300, 38, 360, 60, r=6, fill=DEEP)
        cx, cy = 330, 152
        if f < pop:
            for x, ph, r in bub:  # קיטור עולה
                yy = 235 - ((ph + f / 18) % 1) * 165
                E(d, x, yy, r, r, fill="#FFFFFF", outline="#A9C4D8", width=2 * S)
            E(d, cx, cy, 62, 42, fill=SKIN, outline="#5E3C1B", width=4 * S)
        else:
            u = (f - pop) / 14
            E(d, cx, cy, 60, 40, fill=FLESH, outline=GOLD, width=3 * S)
            if u < 1.6:
                for a, sp, r in flakes:  # קליפות עפות
                    dist = 50 + sp * 11 * u
                    E(d, cx + math.cos(a) * dist * 1.25, cy + math.sin(a) * dist * 0.8, r, r * 0.6, fill=SKIN)
        # מד לחץ
        gx, gy = 95, 150
        E(d, gx, gy, 58, 58, fill="#FFFFFF", outline=DARK, width=5 * S)
        d.arc([(gx - 46) * S, (gy - 46) * S, (gx + 46) * S, (gy + 46) * S], start=300, end=30, fill=RED, width=9 * S)
        p = min(f / (pop - 4), 1.0) if f < pop else max(1 - (f - pop) / 5, 0.0)
        ang = math.radians(150 + p * 225)
        d.line([(gx * S, gy * S), ((gx + math.cos(ang) * 40) * S, (gy + math.sin(ang) * 40) * S)], fill=DARK, width=5 * S)
        E(d, gx, gy, 6, 6, fill=DARK)
        if pop <= f < pop + 12:  # סילון קיטור בשחרור
            u = (f - pop) / 12
            for i in range(5):
                E(d, 520 + i * 22 + u * 30, 70 - i * 6 - u * 18, 14 + i * 3, 12 + i * 2, fill="#FFFFFF", outline="#A9C4D8", width=2 * S)
        frames.append(done(im))
    save(frames, "clip-peel.gif", 70)

cut(); peel(); print("clips ok")
