#!/usr/bin/env python3
"""A meeting recording in the safety folder -> a transcript with times (07/11/2026, Michael in the questionnaire:
"do it: a meeting recording to a protocol + tasks", "recorded on the phone into the folder").

  python3 tools/meeting-stt.py '<path under the safety folder>' <out.txt> [--chunk 300]

Downloads the file with tools/od-get.sh (one-off token; od-read streams audio, up to 150 MB), cuts it with ffmpeg into
CHUNK-second pieces of Opus 24k mono (about 1 MB for 5 minutes, under the 6 MB of _stt.js), and sends each to
routine-db op stt (Whisper on Workers AI, Hebrew). The output has one line per piece: "[HH:MM:SS] text". A piece that
fails is written "[HH:MM:SS] (not transcribed: <why>)" and the run goes on, so one bad minute does not lose the hour.
Nothing of the audio is kept: the temp folder is removed at the end. The recording itself is the assistant's to move
to the to-delete folder (od_trash) after Michael approves the protocol (wa-topics/meeting.md).

Exit: 0 all pieces; 6 some pieces failed (the transcript is still written); 2 usage; 3 no ROUTINE_KEY or no ffmpeg;
5 download failed.
"""
import base64, json, os, shutil, subprocess, sys, tempfile

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
URL = os.environ.get("ROUTINE_DB_URL", "https://tapugan-safety.pages.dev/api/routine-db")
AUDIO = (".m4a", ".mp3", ".wav", ".aac", ".ogg", ".opus", ".webm")


def hms(sec):
    sec = int(sec)
    return "%02d:%02d:%02d" % (sec // 3600, sec % 3600 // 60, sec % 60)


def post_stt(path, key):
    """One piece -> (ok, text or error). curl, as routine-db.sh (the site answers 403 to Python's urllib), with the JSON
    in a file (--data-binary @file), never on a command line (a 1 MB argument is over the kernel's limit)."""
    jf, hf = path + ".json", path + ".hdr"
    with open(hf, "w") as o:   # the key in a header file, not on curl's command line (ps shows arguments)
        o.write("x-routine-key: " + key + "\ncontent-type: application/json\n")
    os.chmod(hf, 0o600)
    with open(path, "rb") as f, open(jf, "w") as o:
        json.dump({"op": "stt", "agent": "meeting-stt", "why": "meeting recording to protocol",
                   "b64": base64.b64encode(f.read()).decode()}, o)
    err = "no answer"
    for attempt in range(2):
        r = subprocess.run(["curl", "-sS", "--max-time", "90", "-X", "POST", URL, "-H", "@" + hf,
                            "--data-binary", "@" + jf], capture_output=True, text=True)
        try:
            j = json.loads(r.stdout)
            if j.get("ok"):
                return True, str(j.get("text", "")).strip()
            err = str(j.get("error", "no text"))[:120]
        except ValueError:
            err = (r.stderr or r.stdout or "curl failed").strip()[:120]
        if "nothing heard" in err:
            break  # silence: no point asking again
    return False, err


def split(src, outdir, chunk):
    """ffmpeg cuts the recording into Opus pieces; returns their paths in order."""
    pat = os.path.join(outdir, "p%04d.ogg")
    # local files only: a fake .m4a from a mail could be a playlist that pulls URLs (security review 07/11/2026)
    r = subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-protocol_whitelist", "file", "-i", src, "-vn", "-ac", "1", "-ar", "16000",
                        "-c:a", "libopus", "-b:a", "24k", "-f", "segment", "-segment_time", str(chunk), pat],
                       capture_output=True, text=True)
    if r.returncode != 0:
        raise RuntimeError("ffmpeg: " + r.stderr.strip()[-300:])
    return sorted(os.path.join(outdir, x) for x in os.listdir(outdir) if x.startswith("p") and x.endswith(".ogg"))


def transcribe(pieces, chunk, key, post=post_stt):
    lines, failed = [], 0
    for i, p in enumerate(pieces):
        ok, t = post(p, key)
        if ok:
            lines.append("[%s] %s" % (hms(i * chunk), t))
        else:
            failed += 1
            lines.append("[%s] (not transcribed: %s)" % (hms(i * chunk), t))
    return lines, failed


def main(argv):
    args, chunk, i = [], 300, 0
    while i < len(argv):   # --chunk 300 and --chunk=300 both (review 07/11/2026)
        a = argv[i]
        if a.startswith("--chunk"):
            v = a.split("=", 1)[1] if "=" in a else (argv[i + 1] if i + 1 < len(argv) else "")
            i += 0 if "=" in a else 1
            chunk = int(v) if v.isdigit() else -1
        else:
            args.append(a)
        i += 1
    if len(args) != 2 or not args[0].lower().endswith(AUDIO) or not (60 <= chunk <= 600):
        print(__doc__.strip().splitlines()[2].strip(), file=sys.stderr)
        return 2
    key = os.environ.get("ROUTINE_KEY", "")
    if not key or not shutil.which("ffmpeg"):
        print("ROUTINE_KEY or ffmpeg missing", file=sys.stderr)
        return 3
    src, out = args
    tmp = tempfile.mkdtemp(prefix="meeting-")
    try:
        local = os.path.join(tmp, "rec" + os.path.splitext(src)[1].lower())
        g = subprocess.run(["bash", os.path.join(HERE, "tools", "od-get.sh"), src, local], capture_output=True, text=True)
        if g.returncode != 0 or not os.path.exists(local):
            print("download failed: " + (g.stderr or g.stdout).strip()[-300:], file=sys.stderr)
            return 5
        pieces = split(local, tmp, chunk)
        lines, failed = transcribe(pieces, chunk, key)
        with open(out, "w", encoding="utf-8") as f:
            f.write("\n".join(lines) + "\n")
        print(json.dumps({"pieces": len(pieces), "failed": failed, "minutes": round(len(pieces) * chunk / 60), "out": out}))
        return 6 if failed else 0
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
