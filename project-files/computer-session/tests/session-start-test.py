#!/usr/bin/env python3
"""session-start.py: prints the skills, the handoff, the open STATUS items and
the last METRICS row; never fails on a missing file or a tty stdin."""
import os, subprocess, sys, tempfile
from _common import hook, check, done
d = tempfile.mkdtemp(); os.makedirs(os.path.join(d, "project-files"))
open(os.path.join(d, "handoff-05-10-2026-10.00.md"), "w").write("# handoff\nהבא בתור: בדיקה X\n")
open(os.path.join(d, "STATUS.md"), "w").write("## פתוח\n- [ ] משימה א\n- [x] סגורה\n  - [ ] משימה ב\n")
open(os.path.join(d, "project-files", "METRICS.md"), "w").write("| חודש | כישלון |\n|---|---|\n| 09/2026 | 20% |\n| 10/2026 | 12% |\n")
run = lambda cwd, inp="{}": subprocess.run([sys.executable, hook("session-start.py")], input=inp, capture_output=True, text=True,
                                            timeout=30, env=dict(os.environ, CLAUDE_PROJECT_DIR=cwd))
p = run(d); o = p.stdout
check("exit 0", p.returncode == 0, p.stderr)
check("names the skills to load", "tfugen-lean" in o and "tfugen-lessons" in o, o)
check("prints the handoff", "handoff-05-10-2026-10.00.md" in o and "בדיקה X" in o, o)
check("open items: 2, the closed one left out", "2 פריטים פתוחים" in o and "משימה ב" in o and "סגורה" not in o, o)
check("last METRICS row with its header", "10/2026 | 12%" in o and "| חודש" in o and "09/2026" not in o, o)
e = tempfile.mkdtemp()
p = run(e, "not json")
check("empty dir + bad stdin: exit 0, still names the skills", p.returncode == 0 and "tfugen-lean" in p.stdout, (p.returncode, p.stdout, p.stderr))
big = tempfile.mkdtemp(); open(os.path.join(big, "handoff-x.md"), "w").write("א" * 9000)
check("a long handoff is cut", "נחתך" in run(big).stdout)
done()
