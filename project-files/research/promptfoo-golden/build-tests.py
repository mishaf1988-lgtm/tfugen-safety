#!/usr/bin/env python3
"""Writes tests.json (one promptfoo test per golden question) from project-files/assistant-golden.json.
Run after any change to the questions; promptfoo-golden-test.py fails when tests.json is stale."""
import json, os

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", "..", ".."))


def build():
    qs = json.load(open(os.path.join(ROOT, "project-files/assistant-golden.json"), encoding="utf-8"))["questions"]
    return [{"description": q["id"], "vars": {"id": q["id"], "q": q["q"]}} for q in qs]


if __name__ == "__main__":
    json.dump(build(), open(os.path.join(HERE, "tests.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print("tests.json: %d tests" % len(build()))
