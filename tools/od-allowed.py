#!/usr/bin/env python3
"""Where in the safety folder the server lets the agents write (24/11/2026, Michael: "בצע: פעולת שרת להורדה ותיוק
מ-OneDrive"). The WhatsApp assistant used to run 3 greps in functions/api/routine-db.js (5,800 lines) to find out. This
reads the same constants the server checks (odMoveCheck / odMkdirCheck / odPutPdfCheck / odPdfCheck / odSwapCheck), so the
list cannot drift from the code:

  python3 tools/od-allowed.py           # the short Hebrew list (the block in wa-topics/docs.md, 0ב1ג)
  python3 tools/od-allowed.py --json    # the parsed values (tests/harness/od-allowed-test.mjs runs the server checks on them)
  python3 tools/od-allowed.py --write   # rewrite the block between the markers in docs.md and routine-wa-assistant.md

A constant that is missing or changed shape is an error (exit 2), never a shorter list.
"""
import json, os, re, sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
RDB = os.path.join(ROOT, "functions", "api", "routine-db.js")
OCR = os.path.join(ROOT, "functions", "_ocr.js")
TARGETS = [os.path.join(ROOT, "project-files", "wa-topics", "docs.md"), os.path.join(ROOT, "project-files", "routine-wa-assistant.md")]
START, END = "<!-- od-allowed:start (tools/od-allowed.py --write) -->", "<!-- od-allowed:end -->"


class ParseError(Exception):
    pass


def unesc(s):
    return re.sub(r"\\u([0-9a-fA-F]{4})", lambda m: chr(int(m.group(1), 16)), s)


def one(pattern, text, what):
    m = re.search(pattern, text, re.M)
    if not m:
        raise ParseError("not found in the server: " + what)
    return m.group(1)


def strs(arr):
    return [unesc(x) for x in re.findall(r"'([^']*)'", arr)]


def parse():
    rdb = open(RDB, encoding="utf-8").read()
    ocr = open(OCR, encoding="utf-8").read()
    v = {}
    v["root"] = unesc(one(r"^export const OD_ROOT = '([^']+)';", rdb, "OD_ROOT")).rstrip("/").split("/")[-1]
    v["inbox"] = unesc(one(r"^export const OD_INBOX = '([^']+)';", rdb, "OD_INBOX"))
    v["skip"] = unesc(one(r"^export const OD_SKIP = '([^']+)';", rdb, "OD_SKIP"))
    v["auto"] = unesc(one(r"^export const OD_AUTO = '([^']+)';", rdb, "OD_AUTO"))
    v["auto_dirs"] = strs(one(r"^export const OD_AUTO_DIRS = \[([^\]]+)\];", rdb, "OD_AUTO_DIRS"))
    v["ocr"] = unesc(one(r"^export const OD_OCR_DIR = '([^']+)';", ocr, "OD_OCR_DIR"))
    trig = one(r"^export const OD_TRIGGER_DIRS = (.+);$", rdb, "OD_TRIGGER_DIRS")
    if trig != "[OD_INBOX, OD_AUTO, OD_OCR_DIR].concat(OD_AUTO_DIRS)":
        raise ParseError("OD_TRIGGER_DIRS changed shape: " + trig)
    no_dir = one(r"^const OD_NO_DIR = /\(\^\|\\/\)\(([^)]+)\)\(\\/\|\$\)/i;", rdb, "OD_NO_DIR")
    v["no_dir"] = [unesc(x) for x in no_dir.split("|")]
    v["mkdir_depth"] = int(one(r"^export const OD_MKDIR_DEPTH = (\d+);", rdb, "OD_MKDIR_DEPTH"))
    mx = one(r"^export const OD_PUT_MAX = ([\d *]+);", rdb, "OD_PUT_MAX")
    n = 1
    for f in mx.split("*"):
        n *= int(f.strip())
    v["put_max_mb"] = n // (1024 * 1024)
    put = one(r"export function odPutPdfCheck\(b\) \{([\s\S]*?)\n\}", rdb, "odPutPdfCheck")
    v["put_types"] = one(r"const ext = \(/\\\.\(([a-z0-9|]+)\)\$/i\.exec\(c\.name\)", put, "the od_put_pdf file types").split("|")
    v["swap_tops"] = strs(one(r"^export const OD_SWAP_NEW_TOPS = \[([^\]]+)\];", rdb, "OD_SWAP_NEW_TOPS"))
    v["inv_top"] = unesc(one(r"^export const OD_INV_TOP = '([^']+)';", rdb, "OD_INV_TOP"))
    return v


def block(v):
    q = lambda x: "`" + x + "`"
    lines = [
        START,
        "     - **מותר:** כל תיקייה בתוך " + q(v["root"]) + " חוץ מהרשימה למטה. `od_mkdir`: תיקייה חדשה בתוך תיקייה קיימת של עד " + str(v["mkdir_depth"]) + " רמות. `od_put_pdf`: " + ", ".join(v["put_types"]) + ", עד " + str(v["put_max_mb"]) + "MB. חשבונית: " + q(v["inv_top"] + "/YYYY-MM") + " (`od_move` יוצר את החודש).",
        "     - **אסור בראש הנתיב:** " + ", ".join(q(x) for x in [v["inbox"], v["auto"], v["ocr"]] + v["auto_dirs"]) + ". מהנכנס יוצאים רק ב-`od_move`, ואליו רק ל-" + q(v["inbox"] + "/" + v["skip"]) + ".",
        "     - **אסור בכל מקום בנתיב:** " + ", ".join(q(x) for x in v["no_dir"]) + " (להעברה לשם יש `od_archive` / `od_trash`).",
        "     - **`od_swap` (גרסה חדשה במקום ישנה):** רק לתיקיות " + ", ".join(q(x) for x in v["swap_tops"]) + ".",
        END,
    ]
    return "\n".join(lines)


def write(v):
    b = block(v)
    for p in TARGETS:
        t = open(p, encoding="utf-8").read()
        i, j = t.find(START), t.find(END)
        if i < 0 or j < i:
            raise ParseError("markers missing in " + os.path.relpath(p, ROOT))
        open(p, "w", encoding="utf-8").write(t[:i] + b + t[j + len(END):])


def main():
    try:
        v = parse()
        if "--json" in sys.argv:
            print(json.dumps(v, ensure_ascii=False))
        elif "--write" in sys.argv:
            write(v)
            print("od-allowed: block written")
        else:
            print(block(v))
    except ParseError as e:
        print("od-allowed: " + str(e), file=sys.stderr)
        sys.exit(2)


if __name__ == "__main__":
    main()
