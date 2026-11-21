#!/usr/bin/env python3
"""The training-video queue (20/11/2026, Michael: "do more videos", then in the questionnaire "do it: 4 riskiest" and
"do it: videos for the 15 decks left"). The voice allows 100 recordings a day, so a video of 30-50 scenes is about
half a day's quota: this runs once a day and builds what fits, in QUEUE order, until the quota ends.

For each topic whose project-files/decks/video/<topic>/scenes.json exists and whose video is not yet in the decks
folder on OneDrive: narration (tools/deck-video.py tts, stops the whole run at the daily limit), composition,
8 still frames for review, render (hyperframes), compress under the 8MB upload limit, upload with od_put_pdf, and
check the folder listing. One agent_report line per run (agent "deck-video").

Usage: python3 tools/deck-video-run.py [--dry]      (--dry: print what would be built, touch nothing)
Work files stay in ~/.deck-video (audio already made is reused the next day).
"""
import base64, datetime as dt, json, os, secrets, shutil, subprocess, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
W = os.path.expanduser('~/.deck-video')
DIR = '11_הדרכות/04_מצגות וחומרי הדרכה'
DAY = '2026-11-20'   # the file name date: the day Michael asked for the videos
MAX = 8 * 1024 * 1024
QUEUE = ['nh3', 'hotwork', 'forklift', 'hazmat', 'electric', 'emergency', 'machines', 'manual', 'ppe-noise',
         'contractors', 'managers', 'trustees', 'cleaning', 'coldrooms', 'hotoil', 'environment', 'lab', 'yard']
# The file name after "סרטון הדרכה - ": the cover title up to ':' unless named here.
NAMES = {'nh3': 'אמוניה', 'hotwork': 'עבודה באש', 'forklift': 'מלגזה'}


def sh(args, **kw):
    return subprocess.run(args, capture_output=True, text=True, **kw)


def rdb(body):
    r = sh(['bash', os.path.join(ROOT, 'project-files', 'routine-db.sh'), json.dumps(body, ensure_ascii=False)])
    try: return json.loads(r.stdout)
    except Exception: return {'ok': False, 'error': (r.stdout or r.stderr)[:200]}


def listing():
    """Names in the decks folder, with a one-off raw token (as tools/od-get.sh)."""
    tok = secrets.token_hex(24)
    now = dt.datetime.now(dt.timezone.utc)
    rdb({'op': 'state_set', 'key': 'od_raw_token', 'value': tok})
    rdb({'op': 'state_set', 'key': 'od_raw_exp', 'value': (now + dt.timedelta(minutes=5)).strftime('%Y-%m-%dT%H:%M:%SZ')})
    try:
        r = sh(['curl', '-sS', '--max-time', '60', '-X', 'POST', 'https://tapugan-safety.pages.dev/api/od-read',
                '-H', 'x-raw-token: ' + tok, '-H', 'content-type: application/json',
                '--data', json.dumps({'list': DIR, 'raw': True}, ensure_ascii=False)])
        d = json.loads(r.stdout)
    finally:
        rdb({'op': 'state_set', 'key': 'od_raw_exp', 'value': now.strftime('%Y-%m-%dT%H:%M:%SZ')})
    items = d.get('items') or d.get('files') or d.get('children')
    if not isinstance(items, list): raise SystemExit('listing failed: ' + str(d)[:200])
    return {x.get('name'): x.get('size') for x in items}


def fname(topic, scenes):
    n = NAMES.get(topic) or scenes[0][2].split(':')[0].strip()
    return '%s - סרטון הדרכה - %s.mp4' % (DAY, n)


def setup():
    hf = os.path.join(W, 'hf')
    gsap = os.path.join(hf, 'proj', 'gsap.min.js')
    if os.path.exists(gsap): return hf
    os.makedirs(hf, exist_ok=True)
    if sh(['npm', 'install', '--ignore-scripts', 'hyperframes@0.9.19'], cwd=hf).returncode: raise SystemExit('npm install failed')
    if sh(['npx', 'hyperframes', 'init', 'proj', '-e', 'blank', '--non-interactive', '--skip-transcribe'], cwd=hf).returncode:
        raise SystemExit('hyperframes init failed')
    # the composition loads gsap.min.js locally, and init does not copy it (20/11/2026: render stopped at 25%, 404)
    shutil.copy(os.path.join(hf, 'node_modules/hyperframes/dist/vendor/npm/gsap@3.15.0/dist/gsap.min.js'), gsap)
    return hf


def compress(src, out):
    for scale, crf in (('720', '34'), ('540', '36')):
        sh(['ffmpeg', '-y', '-loglevel', 'error', '-i', src, '-c:v', 'libx264', '-crf', crf, '-preset', 'slow', '-tune', 'stillimage',
            '-vf', 'scale=%s:-2' % scale, '-c:a', 'aac', '-b:a', '48k', '-ac', '1', out])
        if os.path.exists(out) and 0 < os.path.getsize(out) <= MAX: return True
    return False


def upload(path, name):
    body = {'op': 'od_put_pdf', 'agent': 'deck-video', 'why': 'סרטון הדרכה מהמצגת, מיכאל: עשה עוד סרטנים, 20/11/2026',
            'dir': DIR, 'name': name, 'b64': base64.b64encode(open(path, 'rb').read()).decode()}
    f = os.path.join(W, 'up.json'); json.dump(body, open(f, 'w'), ensure_ascii=False)
    r = sh(['curl', '-sS', '--max-time', '240', '-X', 'POST', 'https://tapugan-safety.pages.dev/api/routine-db',
            '-H', 'x-routine-key: ' + os.environ.get('ROUTINE_KEY', ''), '-H', 'content-type: application/json', '--data', '@' + f])
    os.remove(f)
    try: return json.loads(r.stdout)
    except Exception: return {'ok': False, 'error': (r.stdout or r.stderr)[:200]}


def main():
    dry = '--dry' in sys.argv
    have = listing()
    todo = []
    for t in QUEUE:
        p = os.path.join(ROOT, 'project-files/decks/video', t, 'scenes.json')
        if not os.path.exists(p): continue
        sc = json.load(open(p, encoding='utf-8'))
        if fname(t, sc) not in have: todo.append((t, p, sc))
    print('to build: ' + ', '.join('%s (%d)' % (t, len(sc)) for t, _, sc in todo))
    if dry or not todo: return
    hf = setup()
    done, stop = [], ''
    for t, p, sc in todo:
        work = os.path.join(W, 'work', t)
        r = sh([sys.executable, os.path.join(ROOT, 'tools/deck-video.py'), 'tts', p, work])
        if r.returncode:
            stop = t + ': ' + (r.stderr.strip().splitlines() or ['tts failed'])[-1][:160]
            break
        if sh([sys.executable, os.path.join(ROOT, 'tools/deck-video.py'), 'html', p, work]).returncode: stop = t + ': html'; break
        proj = os.path.join(hf, 'p_' + t)
        shutil.rmtree(proj, ignore_errors=True); shutil.copytree(os.path.join(hf, 'proj'), proj)
        shutil.copy(os.path.join(work, 'index.html'), proj)
        shutil.copytree(os.path.join(work, 'audio'), os.path.join(proj, 'audio'))
        shutil.copy(os.path.join(ROOT, 'logo.jpg'), proj)
        img = os.path.join(ROOT, 'project-files/decks/img', t)
        if os.path.isdir(img):
            for f in os.listdir(img):
                if f.endswith(('.jpg', '.png')): shutil.copy(os.path.join(img, f), proj)
        sh(['npx', 'hyperframes', 'snapshot', '--frames', '8', '-o', os.path.join(W, 'shots', t)], cwd=proj, timeout=600)
        r = sh(['npx', 'hyperframes', 'render', '-o', 'out.mp4', '-q', 'standard'], cwd=proj, timeout=3600)
        if r.returncode or not os.path.exists(os.path.join(proj, 'out.mp4')): stop = t + ': render ' + r.stdout[-160:]; break
        mp4 = os.path.join(W, t + '.mp4')
        if not compress(os.path.join(proj, 'out.mp4'), mp4): stop = t + ': over 8MB after compression'; break
        name = fname(t, sc)
        u = upload(mp4, name)
        if not u.get('ok'): stop = t + ': upload ' + str(u.get('error'))[:120]; break
        if listing().get(name) != os.path.getsize(mp4): stop = t + ': not in the folder listing after upload'; break
        done.append(name)
        print('saved: ' + name)
    line = ('סרטונים שנשמרו בתיקיית המצגות: ' + (', '.join(done) or 'אין')) + ('. נעצר: ' + stop if stop else '')
    rdb({'op': 'agent_report', 'agent': 'deck-video', 'ok': not stop or 'per day' in stop, 'line': line[:300], 'learned': 'אין'})
    print(line)


if __name__ == '__main__':
    main()
