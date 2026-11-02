#!/usr/bin/env python3
"""The cost of a Claude Code session at API list prices, from its own transcript (02/11/2026, Michael in the
questionnaire: "do it: a cost measurement per session", the idea of ccusage on GitHub; two handoffs in a row said
"not measured" because get_session gave no usage field).

  python3 tools/session-cost.py            # this session: the newest transcript of this repo, with its subagents
  python3 tools/session-cost.py FILE.jsonl  # a given transcript (and FILE's subagents/ folder, if any)

Each assistant message is counted once (a message is logged once per content block with the same usage), by
message id. Prices per million tokens: project-files/agent-costs.md (read 18/10/2026 from the pricing page); a
5-minute cache write is 1.25 x input (not in that line: an estimate). The answer is the API list price, not what the
subscription is billed (agent-costs.md). Prints one line for the handoff: '**עלות השיחה:** X דולר (...)'.
"""
import glob, json, os, sys

# $ per million: input, 1h cache write, cache read, output (agent-costs.md line "מחירון לכל מיליון טוקנים")
PRICES = {"opus": (4.0, 8.0, 0.20, 20.0), "sonnet": (2.0, 4.0, 0.10, 10.0), "haiku": (0.10, 0.20, 0.01, 0.50)}
HAIKU_TIER, HAIKU_X = 100_000, 5  # Haiku above 100 thousand input tokens in one request: 5 x


def price_of(model):
    m = str(model or "").lower()
    return next((v for k, v in PRICES.items() if k in m), None)


def cost(files):
    seen, total, unknown, by = set(), 0.0, set(), {}
    for f in files:
        for line in open(f, encoding="utf-8", errors="replace"):
            try:
                d = json.loads(line)
            except Exception:
                continue
            m = d.get("message")
            if not isinstance(m, dict) or not isinstance(m.get("usage"), dict):
                continue
            key = (f, m.get("id"), d.get("requestId"))
            if key in seen:
                continue
            seen.add(key)
            p = price_of(m.get("model"))
            if not p:
                unknown.add(str(m.get("model")))
                continue
            u = m["usage"]
            cc = u.get("cache_creation") or {}
            w1h = cc.get("ephemeral_1h_input_tokens", 0) or 0
            w5m = cc.get("ephemeral_5m_input_tokens", (u.get("cache_creation_input_tokens", 0) or 0) - w1h) or 0
            inp, rd, out = u.get("input_tokens", 0) or 0, u.get("cache_read_input_tokens", 0) or 0, u.get("output_tokens", 0) or 0
            x = HAIKU_X if "haiku" in str(m.get("model")).lower() and inp + rd + w1h + w5m > HAIKU_TIER else 1
            c = x * (inp * p[0] + w1h * p[1] + w5m * p[0] * 1.25 + rd * p[2] + out * p[3]) / 1e6
            total += c
            by[m.get("model")] = by.get(m.get("model"), 0.0) + c
    return total, by, len(seen), unknown


def main(argv):
    if len(argv) > 1:
        main_file = argv[1]
    else:
        proj = os.path.expanduser("~/.claude/projects/" + os.getcwd().replace("/", "-"))
        fs = sorted(glob.glob(proj + "/*.jsonl"), key=os.path.getmtime)
        if not fs:
            print("**עלות השיחה:** לא נמדדה, אין קובץ שיחה ב-" + proj); return 1
        main_file = fs[-1]
    files = [main_file] + sorted(glob.glob(main_file[:-len(".jsonl")] + "/subagents/*.jsonl"))
    total, by, n, unknown = cost(files)
    parts = ", ".join("%s %.2f" % (k, v) for k, v in sorted(by.items(), key=lambda x: -x[1]))
    extra = (", מודל בלי מחיר: " + ", ".join(sorted(unknown))) if unknown else ""
    print("**עלות השיחה:** %.2f דולר (מחירון API, לא חיוב; %d הודעות, %d סוכני עזר; %s%s; tools/session-cost.py)" % (total, n, len(files) - 1, parts, extra))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
