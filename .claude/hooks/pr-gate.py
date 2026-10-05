#!/usr/bin/env python3
"""PreToolUse (mcp__github__create_pull_request): the PR description has the
retro and skill lines before the PR is opened (lessons-gate.py runs the same
check in CI, but only after the PR exists, so a missing line costs a red round
and an edit). Runs check(title, body, files) from .github/scripts/lessons-gate.py
on `git diff --name-only origin/main...HEAD`. Red = deny with the reason.

Tests set PR_GATE_CHANGED (comma list) instead of git.
Test:  python3 tests/harness/pr-gate-test.py
"""
import importlib.util, json, os, subprocess, sys
sys.stdout.reconfigure(encoding="utf-8")  # Windows writes cp1255; Claude Code reads UTF-8 (05/10/2026)

GATE = ".github/scripts/lessons-gate.py"


def root(d):
    cwd = os.environ.get("CLAUDE_PROJECT_DIR") or d.get("cwd") or "."
    try:
        top = subprocess.run(["git", "rev-parse", "--show-toplevel"], cwd=cwd, capture_output=True, text=True, timeout=10).stdout.strip()
        return top or cwd
    except Exception:
        return cwd


def changed(cwd):
    env = os.environ.get("PR_GATE_CHANGED")
    if env is not None:
        return [x for x in env.split(",") if x]
    p = subprocess.run(["git", "diff", "--name-only", "origin/main...HEAD"], cwd=cwd, capture_output=True, text=True, timeout=20)
    return p.stdout.split()


def main():
    try:
        d = json.load(sys.stdin)
    except Exception:
        print("{}"); return
    if not str(d.get("tool_name", "")).endswith("create_pull_request"):
        print("{}"); return
    inp = d.get("tool_input") or {}
    cwd = root(d)
    try:
        spec = importlib.util.spec_from_file_location("lessons_gate", os.path.join(cwd, GATE))
        gate = importlib.util.module_from_spec(spec); spec.loader.exec_module(gate)
        ok, why = gate.check(inp.get("title", ""), inp.get("body", ""), changed(cwd))
    except Exception:
        print("{}"); return        # the gate is missing or broken: CI still checks
    if ok:
        print("{}"); return
    print(json.dumps({"hookSpecificOutput": {
        "hookEventName": "PreToolUse",
        "permissionDecision": "deny",
        "permissionDecisionReason": "pr-gate: התיאור לא יעבור את lessons-gate ב-CI. לתקן לפני פתיחת ה-PR:\n" + why}}, ensure_ascii=False))


if __name__ == "__main__":
    main()
