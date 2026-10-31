#!/usr/bin/env python3
"""Duplicate or clashing processes across the whole system (31/10/2026, Michael: "we need another process that checks
there are no duplicate processes, or processes that disturb each other, in the whole map and system").

Reads what the system is made of, without a model and without quota:
  * the agents table of project-files/ACCOUNT-INVENTORY.md (id, name, when, instructions file, conversation),
  * the Power Automate flows table there (trigger folder),
  * every project-files/routine-*.md (which server_state keys it writes with state_set).
Finds:
  same_doc     two active agents that run the same instructions file
  same_session two active agents that share one standing conversation and run within 30 minutes of each other
               (the second wakes into a conversation still busy with the first)
  same_folder  two flows on the same trigger folder (one file would run two flows)
  same_key     two agents that write the same server_state key (the later write wipes the earlier)
  near         two active agents within 5 minutes of each other on the same day (they share the quota peak);
               reported, never a failure
What is on purpose is written in overlap-ok.md ('- kind:key: why'), and only what is NOT there is a failure
(tests/harness/overlap-check-test.py). Run it by hand for the report: python3 project-files/system-map/overlap-check.py
"""
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
DAYS = {"א": 0, "ב": 1, "ג": 2, "ד": 3, "ה": 4, "ו": 5}  # א..ו -> Sun..Fri


def read(p):
    try:
        return open(p, encoding="utf-8").read()
    except OSError:
        return ""


def agents(inv):
    """Active scheduled agents: dicts of id, name, when, doc, session."""
    out = []
    for l in inv.split("\n"):
        m = re.match(r"\|\s*`(trig_\w+)`\s*\|(.*)", l)
        if not m:
            continue
        cells = [c.strip() for c in m.group(2).split("|")]
        if len(cells) < 4:
            continue
        name, when, doc, conv = cells[0], cells[1], cells[2], cells[3]
        # off, one-off checks and the API-only ones (no clock) are not scheduled processes
        if re.match("מפעיל API|בלי תזמון|בלי שעון", when):
            continue  # fired by the server (API), no clock: not a scheduled process
        if name.startswith("כבוי") or "חד-פעמי" in name or re.search(r"\d{2}/\d{2}/20\d\d \d", when):
            continue
        d = re.search(r"`([\w./-]+\.md)`", doc)
        s = re.search(r"session_\w+", conv)
        out.append({"id": m.group(1), "name": re.sub(r"\s*\(.*", "", name)[:60], "when": when,
                    "doc": d.group(1) if d else "", "session": s.group(0) if s else "", "slots": slots(when)})
    return out


def slots(when):
    """(day, minute of day) pairs. day: 0-6 (Sun-Sat) or 'm<n>' for a day of the month."""
    w = when.replace("מוצ\"ש", "מוצש")
    times = [(int(h), int(m)) for h, m in re.findall(r"\b(\d{1,2}):(\d{2})\b", w)]
    if not times:
        return []
    mins = [h * 60 + m for h, m in times]
    if re.search("כל שעתיים", w) and len(mins) >= 2:      # כל שעתיים
        mins = list(range(mins[0], mins[1] + 1, 120))
    elif re.search("כל שעה", w) and len(mins) >= 2:                    # כל שעה
        mins = list(range(mins[0], mins[1] + 1, 60))
    days = set()
    mo = re.search(r"(\d{1,2}) לחודש", w)                                  # N לחודש
    if mo:
        days = {"m" + mo.group(1)}
    elif "כל יום" in w:                                                    # כל יום
        days = set(range(7))
    elif "מוצש" in w:                                                           # מוצ"ש
        days = {6}
    else:
        r = re.search(r"([א-ו])'\s*-\s*([א-ו])'", w)
        if r:
            days = set(range(DAYS[r.group(1)], DAYS[r.group(2)] + 1))
        else:
            days = {DAYS[x] for x in re.findall(r"(?:^|[\s,])ו?-?([א-ו])'", w) if x in DAYS}
    return [(d, m) for d in days for m in mins]


def flows(inv):
    """Flow name -> trigger folder, from the Power Automate table."""
    out = {}
    for l in inv.split("\n"):
        m = re.match(r"\|\s*([^|`]+?)\s*\|\s*קובץ חדש ב-`([^`]+)`", l)  # קובץ חדש ב-
        if m:
            out[m.group(1)] = m.group(2)
    return out


def state_writers():
    """server_state key -> instructions files that write it with state_set."""
    out = {}
    d = os.path.join(ROOT, "project-files")
    for n in sorted(os.listdir(d)):
        if not (n.startswith("routine-") and n.endswith(".md")):
            continue
        for k in set(re.findall(r'"op"\s*:\s*"state_set"\s*,\s*"key"\s*:\s*"([\w-]+)"', read(os.path.join(d, n)))):
            out.setdefault(k, []).append(n)
    return out


def allowed():
    """'kind:key' -> why, from overlap-ok.md."""
    out = {}
    for l in read(os.path.join(HERE, "overlap-ok.md")).split("\n"):
        m = re.match(r"-\s*`?(\w+:[^`:]+)`?\s*:\s*(.+)", l)
        if m:
            out[m.group(1).strip()] = m.group(2).strip()
    return out


def findings():
    inv = read(os.path.join(ROOT, "project-files", "ACCOUNT-INVENTORY.md"))
    ag = agents(inv)
    out = []
    by_doc = {}
    for a in ag:
        if a["doc"]:
            by_doc.setdefault(a["doc"], []).append(a)
    for doc, xs in by_doc.items():
        if len(xs) > 1:
            out.append(("same_doc:" + doc, ", ".join(x["name"] for x in xs)))
    for i, a in enumerate(ag):
        for b in ag[i + 1:]:
            close = [(d, x, y) for d, x in a["slots"] for e, y in b["slots"] if d == e and abs(x - y) <= 30]
            if a["session"] and a["session"] == b["session"] and close:
                out.append(("same_session:" + a["session"], a["name"] + " / " + b["name"]))
            elif any(abs(x - y) <= 5 for _, x, y in close):
                out.append(("near:" + a["id"] + "+" + b["id"], a["name"] + " / " + b["name"]))
    by_folder = {}
    for f, folder in flows(inv).items():
        by_folder.setdefault(folder, []).append(f)
    for folder, fs in by_folder.items():
        if len(fs) > 1:
            out.append(("same_folder:" + folder, ", ".join(fs)))
    for k, docs in state_writers().items():
        if len(docs) > 1:
            out.append(("same_key:" + k, ", ".join(docs)))
    return out


def problems():
    """Findings that are neither 'near' nor written in overlap-ok.md."""
    ok = allowed()
    return [(k, w) for k, w in findings() if not k.startswith("near:") and k not in ok]


if __name__ == "__main__":
    f = findings()
    ok = allowed()
    for k, w in f:
        tag = "OK (" + ok[k] + ")" if k in ok else ("note" if k.startswith("near:") else "PROBLEM")
        print("%-8s %s  [%s]" % (tag.split(" ")[0], k, w) + ("" if k not in ok else "  " + ok[k]))
    print("%d findings, %d problems" % (len(f), len(problems())))
    sys.exit(1 if problems() else 0)
