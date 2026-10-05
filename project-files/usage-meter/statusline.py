#!/usr/bin/env python3
"""Status line for Claude Code in the terminal (and wherever Claude Code shows a
status line): tokens, context, cost and plan limits of the current session.
Michael, 05/10/2026: "I want to see it on the screen in every chat".
Input: the JSON Claude Code passes on stdin (context_window, cost, rate_limits).
Never fails: a missing field is left out of the line.
Test:  python3 project-files/usage-meter/test_usage_meter.py
"""
import json, sys

LIMITS = {"five_hour": "5 שעות", "seven_day": "שבוע"}


def k(n):
    n = float(n)
    return "%.2fM" % (n / 1e6) if n >= 1e6 else ("%.1fk" % (n / 1e3) if n >= 1e3 else "%d" % n)


def pct_of(v):
    if not isinstance(v, dict):
        return None
    for key in ("used_percentage", "utilization", "percent", "used_percent"):
        if isinstance(v.get(key), (int, float)):
            x = v[key]
            return x * 100 if key == "utilization" and x <= 1 else x
    return None


def line(d):
    parts = []
    cw = d.get("context_window") or {}
    tot = (cw.get("total_input_tokens") or 0) + (cw.get("total_output_tokens") or 0)
    if tot:
        parts.append("📊 " + k(tot) + " טוקנים")
    if isinstance(cw.get("used_percentage"), (int, float)):
        parts.append("הקשר %d%%" % round(cw["used_percentage"]))
    cost = (d.get("cost") or {}).get("total_cost_usd")
    if isinstance(cost, (int, float)):
        parts.append("$%.2f" % cost)
    for key, v in (d.get("rate_limits") or {}).items():
        p = pct_of(v)
        if p is not None:
            parts.append("%s %d%%" % (LIMITS.get(key, key), round(p)))
    return " | ".join(parts) or "📊"


if __name__ == "__main__":
    try:
        d = json.load(sys.stdin)
    except Exception:
        d = {}
    sys.stdout.write(line(d))
