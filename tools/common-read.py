#!/usr/bin/env python3
"""Print only the named sections of project-files/agent-common.md (24/11/2026, Michael in the questionnaire:
"do it: the shared knowledge file", saving in the Code Mode way: an agent that needs two sections no longer
pulls the whole 43 thousand characters into its context, where every later step reads them again).

  python3 tools/common-read.py פתיחה "ידע משותף"     # the sections whose '## ' heading starts with these words
  python3 tools/common-read.py --list                 # the section headings

A name that matches no section is an error (exit 2), so a renamed heading is not skipped in silence.
"""
import os, re, sys

PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "project-files", "agent-common.md")


def sections(text):
    parts = re.split(r"(?m)^(## .*)$", text)
    return [(parts[i][3:].strip(), parts[i] + parts[i + 1]) for i in range(1, len(parts), 2)]


def pick(text, names):
    secs, out, missing = sections(text), [], []
    for n in names:
        hit = [body for head, body in secs if head.startswith(n)]
        if not hit:
            missing.append(n)
        out.extend(hit)
    return "".join(out).rstrip() + "\n", missing


def main(argv):
    text = open(PATH, encoding="utf-8").read()
    if not argv or argv == ["--list"]:
        print("\n".join(h for h, _ in sections(text)))
        return 0
    body, missing = pick(text, argv)
    if missing:
        print("no section: " + ", ".join(missing), file=sys.stderr)
        return 2
    sys.stdout.write(body)
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
