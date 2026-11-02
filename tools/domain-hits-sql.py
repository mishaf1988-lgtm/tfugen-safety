#!/usr/bin/env python3
"""Which work branch Michael's messages touch (02/11/2026, Michael in the questionnaire: "do it: a measurement and a
check in a month"). Prints one SQL query for the Supabase MCP (execute_sql): for each branch in
project-files/domains/index.json, how many of Michael's own messages to the assistant (notifications_log owner_in,
WhatsApp and the app chat) in the last N days contain one of its words, the same match the server uses
(functions/_domains.js, lower-case substring; here one regex of the words per branch; without the one-letter typo match, so a little lower than the server; tools/domain-gaps.py has it), and how many matched no branch. Tests and drills ("[..." at the
start) are left out. A branch with 0 hits has words that never come up; a branch hit by most messages has a word
that is too common. Usage: python3 tools/domain-hits-sql.py [days, default 30] [min length, default 0; 30 = real requests, not buttons]
"""
import json, os, sys

def sql(days=30, min_len=0):
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    idx = json.load(open(os.path.join(root, "project-files/domains/index.json"), encoding="utf-8"))
    import re
    rx = lambda ws: "'" + "|".join(re.escape(w.lower()).replace("'", "''") for w in ws) + "'"
    ks = [k for k in idx if not k.startswith("_")]
    cols = ["count(*) filter (where t ~ %s) as %s" % (rx(idx[k]["words"]), k) for k in ks]
    cols.append("count(*) filter (where not t ~ %s) as no_branch" % rx([w for k in ks for w in idx[k]["words"]]))
    cols.append("count(*) as all_messages")
    return ("with m as (select lower(payload->>'text') as t from notifications_log where event_type = 'owner_in' "
            "and ts > now() - interval '%d days' and coalesce(payload->>'text', '') <> '' and payload->>'text' not like '[%%' and length(payload->>'text') > %d) "
            "select %s from m") % (days, min_len, ", ".join(cols))


if __name__ == "__main__":
    print(sql(int(sys.argv[1]) if len(sys.argv) > 1 else 30, int(sys.argv[2]) if len(sys.argv) > 2 else 0))
