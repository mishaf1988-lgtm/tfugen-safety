#!/usr/bin/env python3
"""PreToolUse (mcp__github__actions_run_trigger): no "run it again until it is green".

17/11/2026 (Michael in the questionnaire, four test rules, rule 3): a test that failed and would pass on a
second run with no change is a flaky test. It is written in tests/harness/flaky.md (what failed, when, and
what is done about it: fixed, or deleted with a reason) before anything is run again. So a re-run of a
workflow is refused unless this branch changed tests/harness/flaky.md against origin/main. Other methods pass.

Tests set RERUN_GUARD_LISTED (1 / 0) instead of git.
Test:  python3 tests/harness/rerun-guard-test.py
"""
import json, os, subprocess, sys
sys.stdout.reconfigure(encoding="utf-8")  # Windows writes cp1255; Claude Code reads UTF-8 (05/10/2026)
sys.stdin.reconfigure(encoding="utf-8")  # Claude Code sends UTF-8; Windows reads cp1255 (05/10/2026)

FLAKY = "tests/harness/flaky.md"


def listed(cwd):
    env = os.environ.get("RERUN_GUARD_LISTED")
    if env is not None:
        return env == "1"
    try:
        return subprocess.run(["git", "diff", "--quiet", "origin/main", "--", FLAKY], cwd=cwd, capture_output=True, timeout=20).returncode == 1
    except Exception:
        return False


def main():
    try:
        d = json.load(sys.stdin)
    except Exception:
        print("{}"); return
    if not str(d.get("tool_name", "")).endswith("actions_run_trigger"):
        print("{}"); return
    if not str((d.get("tool_input") or {}).get("method", "")).startswith("rerun"):
        print("{}"); return
    if listed(os.environ.get("CLAUDE_PROJECT_DIR") or d.get("cwd") or "."):
        print("{}"); return
    print(json.dumps({"hookSpecificOutput": {
        "hookEventName": "PreToolUse",
        "permissionDecision": "deny",
        "permissionDecisionReason": "rerun-guard (17/11/2026, ארבעה כללי בדיקות): לא מריצים שוב עד ירוק. בדיקה שנכשלה בלי שינוי בקוד נרשמת קודם ב-tests/harness/flaky.md (איזו, מתי, מה נכשל), ואז מתקנים אותה או מוחקים עם סיבה."}}, ensure_ascii=False))


if __name__ == "__main__":
    main()
