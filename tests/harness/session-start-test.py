#!/usr/bin/env python3
"""session-start.py: prints the skills, the handoff, the open STATUS items and
the last METRICS row; never fails on a missing file or a tty stdin."""
import json, os, subprocess, sys, tempfile
from _common import hook, check, done
d = tempfile.mkdtemp(); os.makedirs(os.path.join(d, "project-files"))
open(os.path.join(d, "handoff-05-10-2026-10.00.md"), "w", encoding="utf-8").write("# handoff\nהבא בתור: בדיקה X\n")
open(os.path.join(d, "STATUS.md"), "w", encoding="utf-8").write("## פתוח\n- [ ] משימה א\n- [x] סגורה\n  - [ ] משימה ב\n")
open(os.path.join(d, "project-files", "METRICS.md"), "w", encoding="utf-8").write("| חודש | כישלון |\n|---|---|\n| 09/2026 | 20% |\n| 10/2026 | 12% |\n")
run = lambda cwd, inp="{}": subprocess.run([sys.executable, hook("session-start.py")], input=inp, capture_output=True, text=True, encoding="utf-8",
                                            timeout=30, env=dict(os.environ, CLAUDE_PROJECT_DIR=cwd))
p = run(d); o = p.stdout
check("exit 0", p.returncode == 0, p.stderr)
check("names the skills to load", "tfugen-lean" in o and "tfugen-lessons" in o, o)
check("no office file: no office line", "משרד הסוכנים" not in o, o)
open(os.path.join(d, "project-files", "routine-office.md"), "w", encoding="utf-8").write("**העמוד:** `https://claude.ai/artifact/Abc123XYZ` (משרד)\n")
o2 = run(d).stdout
check("the agents' office: opened at the start of every conversation, URL from routine-office.md", "משרד הסוכנים" in o2 and "https://claude.ai/artifact/Abc123XYZ" in o2 and '"open"' in o2, o2)
# Broken on purpose (16/10/2026): with the office lines taken out of report() the check above fails.
os.remove(os.path.join(d, "project-files", "routine-office.md"))
# STATUS 100 (17/10/2026): the items other conversations hold, from claim.sh --list.
rc = lambda raw: subprocess.run([sys.executable, hook("session-start.py")], input="{}", capture_output=True, text=True, encoding="utf-8",
                                timeout=30, env=dict(os.environ, CLAUDE_PROJECT_DIR=d, SESSION_START_CLAIMS=raw)).stdout
o3 = rc(json.dumps({"ok": True, "claims": {"14.2": {"session": "session_X", "at": "2026-10-16T17:50:33.537Z", "note": "הגנת גרסה"}}}))
check("a held item is shown: item, conversation, DD/MM/YYYY date, note", "פריטים תפוסים: 1" in o3 and "14.2: session_X, 16/10/2026 17:50 UTC (הגנת גרסה)" in o3, o3)
check("no claims: no section", "פריטים תפוסים" not in rc(json.dumps({"ok": True, "claims": {}})))
check("a bad answer (no key, offline): no section, no crash", "פריטים תפוסים" not in rc("ROUTINE_KEY missing"))
check("no claim.sh and no stand-in: nothing", "פריטים תפוסים" not in run(d).stdout)
# 20/10/2026: open requests to development (dev_inbox), from routine-db state_get.
rd = lambda raw: subprocess.run([sys.executable, hook("session-start.py")], input="{}", capture_output=True, text=True, encoding="utf-8",
                                timeout=30, env=dict(os.environ, CLAUDE_PROJECT_DIR=d, SESSION_START_DEV=raw)).stdout
dv = json.dumps([{"id": "dev-1", "at": "2026-10-20T20:00:00Z", "agent": "routine-wa-assistant", "text": "צעד חודשי לדוח המים", "status": "open"},
                 {"id": "dev-0", "at": "2026-10-19T20:00:00Z", "agent": "routine-coa", "text": "ישן", "status": "done"}])
o4 = rd(json.dumps({"ok": True, "rows": [{"key": "dev_inbox", "value": dv}]}))
check("open requests to development: counted, listed with id and agent, done ones left out", "בקשות לפיתוח: 1" in o4 and "dev-1 (routine-wa-assistant" in o4 and "dev-0" not in o4, o4)
check("dev_inbox: a bad answer, no section", "בקשות לפיתוח" not in rd("ROUTINE_KEY missing"))
check("prints the handoff", "handoff-05-10-2026-10.00.md" in o and "בדיקה X" in o, o)
check("open items: 2, the closed one left out", "2 פריטים פתוחים" in o and "משימה ב" in o and "סגורה" not in o, o)
check("last METRICS row with its header", "10/2026 | 12%" in o and "| חודש" in o and "09/2026" not in o, o)
open(os.path.join(d, "project-files", "chrome-queue.md"), "w", encoding="utf-8").write("## פתוח\n- [ ] **C1. זרימה ב-Power Automate** (12/10/2026)\n  ```\n  - [ ] לא משימה\n  ```\n## בוצע\n- [x] **C0. ישן**\n")
o = run(d).stdout
check("open Chrome tasks: counted and listed, done ones and code-block lines left out", "משימות לכרום: 1 פתוחות" in o and "C1. זרימה" in o and "C0" not in o, o)
open(os.path.join(d, "project-files", "ideas-lab.md"), "w", encoding="utf-8").write("# x\n## ממתין להחלטה\n### 1. המפקח המדומה\nטקסט\n### 2. לוח מודעות\n### 4. נבנה ונשכח כאן\n**מצב:** נבחר 16/10/2026\n## הוחלט\n### 3. ישן שנדחה\n")
o = run(d).stdout
check("ideas waiting for Michael: counted and named, decided ones left out", "רעיונות שמחכים להחלטה של מיכאל: 2" in o and "המפקח המדומה" in o and "ישן שנדחה" not in o and "נבנה ונשכח" not in o, o)
e = tempfile.mkdtemp()
p = run(e, "not json")
check("empty dir + bad stdin: exit 0, still names the skills", p.returncode == 0 and "tfugen-lean" in p.stdout, (p.returncode, p.stdout, p.stderr))
big = tempfile.mkdtemp(); open(os.path.join(big, "handoff-x.md"), "w", encoding="utf-8").write("א" * 9000)
check("a long handoff is cut", "נחתך" in run(big).stdout)
# 14/10/2026 (lesson 15): open items whose test changed after the item's last date.
m = tempfile.mkdtemp(); os.makedirs(os.path.join(m, "tests", "harness"))
w_ = lambda rel, t: open(os.path.join(m, rel), "w", encoding="utf-8").write(t)
w_("tests/harness/a-test.js", "// 02/09/2026: first\n// 03/09/2026: the middle dot too\nconst d = '2026-09-20';\n")
w_("tests/harness/b-test.py", "# 01/09/2026\n# 01/01/2099 is a fixture\n")
w_("STATUS.md", "## פתוח\n- [ ] **תווי מקלדת (02/09/2026).** `a-test.js`\n"
   "- [ ] **נבדק (01/09/2026).** `a-test.js`. נבדק 05/09/2026: עדיין פתוח כי מחכה לטלפון\n"
   "- [ ] **הבדיקה ישנה (02/09/2026).** `b-test.py`\n"
   "- [ ] **אב (03/09/2026)**\n  - [ ] משנה בלי תאריך `a-test.js`\n"
   "- [ ] **בלי שנה (01/09, ישן).** `a-test.js`\n"
   "- [x] **סגור (01/08/2026).** `a-test.js`\n")
o = run(m).stdout
sec = o.split("אולי כבר בוצעו", 1)[1] if "אולי כבר בוצעו" in o else ""
check("maybe-done: an item older than its test is listed, with both dates", "תווי מקלדת" in sec and "03/09/2026" in sec and "02/09/2026" in sec, o)
check("maybe-done: a later 'נבדק DD/MM/YYYY' on the line silences it", "נבדק (01/09" not in sec, sec)
check("maybe-done: a test whose only newer date is a fixture (ISO, future) does not count", "הבדיקה ישנה" not in sec, sec)
check("maybe-done: an indented item carries its parent's date", "משנה בלי תאריך" not in sec, sec)
check("maybe-done: a date without a year counts as the last such day", "בלי שנה" in sec, sec)
check("maybe-done: a closed item is left out", "01/08/2026" not in sec, sec)
check("maybe-done: counted, oldest first", "2 פריטים" in sec and sec.index("בלי שנה") < sec.index("תווי מקלדת"), sec)

# 05/10/2026, Michael's computer: Windows stdout is cp1255, an emoji in STATUS raised
# UnicodeEncodeError inside the try, and the session got nothing. Simulated with PYTHONIOENCODING.
w = tempfile.mkdtemp(); open(os.path.join(w, "STATUS.md"), "w", encoding="utf-8").write("- [ ] \U0001f4d6 משימה ג\n")
p = subprocess.run([sys.executable, hook("session-start.py")], input=b"{}", capture_output=True, timeout=30,
                   env=dict(os.environ, CLAUDE_PROJECT_DIR=w, PYTHONIOENCODING="cp1255", PYTHONUTF8="0"))
o = p.stdout.decode("utf-8", "replace")
check("cp1255 stdout (Windows) + emoji: the report still arrives, in UTF-8", "== התחלת שיחה" in o and "\U0001f4d6 משימה ג" in o, (o, p.stderr))
# 14/10/2026: in the cloud the repo's hooks are copied to ~/.claude/settings.json, guarded.
r = tempfile.mkdtemp(); hm = tempfile.mkdtemp(); os.makedirs(os.path.join(r, ".claude"))
probe = os.path.join(hm, "ran")
json.dump({"hooks": {"PreToolUse": [{"matcher": "Bash", "hooks": [{"type": "command", "command": 'echo "$CLAUDE_PROJECT_DIR" > ' + probe}]}]}},
          open(os.path.join(r, ".claude", "settings.json"), "w"))
os.makedirs(os.path.join(hm, ".claude")); json.dump({"permissions": {"allow": ["x"]}}, open(os.path.join(hm, ".claude", "settings.json"), "w"))
cl = lambda remote: subprocess.run([sys.executable, hook("session-start.py")], input="{}", capture_output=True, text=True, timeout=30,
                                   env=dict(os.environ, CLAUDE_PROJECT_DIR=r, HOME=hm, CLAUDE_CODE_REMOTE=remote))
us = lambda: json.load(open(os.path.join(hm, ".claude", "settings.json")))
cl("false")
check("not in the cloud: user settings left alone", "hooks" not in us(), us())
cl("true"); u = us()
cmd = u.get("hooks", {}).get("PreToolUse", [{}])[0].get("hooks", [{}])[0].get("command", "")
check("cloud: hooks copied, other keys kept", cmd and u.get("permissions") == {"allow": ["x"]}, u)
sh = lambda pd: subprocess.run(["bash", "-c", cmd], env=dict(os.environ, CLAUDE_PROJECT_DIR=pd), capture_output=True, text=True)
p = sh(r)
check("in the repo the copy does nothing (no hook twice)", p.returncode == 0 and not os.path.exists(probe), (p.returncode, cmd))
p = sh("/home/user")
check("outside the repo the copy runs, with the repo as CLAUDE_PROJECT_DIR",
      p.returncode == 0 and os.path.exists(probe) and open(probe).read().strip() == r, (p.returncode, p.stderr, cmd))
t = os.path.getmtime(os.path.join(hm, ".claude", "settings.json")); cl("true")
check("unchanged hooks: not rewritten", os.path.getmtime(os.path.join(hm, ".claude", "settings.json")) == t)
# retro 15/10/2026: a hook group that is not the repo's survives, the repo's are not doubled, no temp file is left
sf = os.path.join(hm, ".claude", "settings.json"); cur_ = us()
cur_["hooks"]["Stop"] = cur_["hooks"].get("Stop", []) + [{"hooks": [{"type": "command", "command": "~/.claude/stop-hook-git-check.sh"}]}]
json.dump(cur_, open(sf, "w")); cl("true"); u2 = us()
check("a foreign Stop hook survives the copy", any(h.get("command") == "~/.claude/stop-hook-git-check.sh" for g in u2["hooks"].get("Stop", []) for h in g.get("hooks", [])), u2["hooks"].get("Stop"))
check("the repo's PreToolUse group is there once, not doubled", len(u2["hooks"]["PreToolUse"]) == 1, u2["hooks"]["PreToolUse"])
check("no temp file left in ~/.claude", not [n for n in os.listdir(os.path.join(hm, ".claude")) if ".tmp" in n], os.listdir(os.path.join(hm, ".claude")))
# the challenger's edge cases (15/10/2026): odd shapes do not stop the copy, a broken file is not overwritten, the mode stays
cur_ = us(); cur_["hooks"]["Stop"] = "not a list"; cur_["env"] = {"K": "secret"}
json.dump(cur_, open(sf, "w")); os.chmod(sf, 0o600); cl("true"); u3 = us()
check("a Stop value that is not a list: the repo's hooks still installed", "PreToolUse" in u3["hooks"] and u3["env"] == {"K": "secret"}, u3.get("hooks", {}).keys())
check("the file mode 0600 is kept", (os.stat(sf).st_mode & 0o777) == 0o600, oct(os.stat(sf).st_mode & 0o777))
open(sf, "w").write("{ broken json"); cl("true")
check("a broken settings file is left as it is", open(sf).read() == "{ broken json", open(sf).read())
# 27/10/2026: a prompt hook (the rules checker) has no wrapper; it was appended again on every start,
# nine copies in ~/.claude, ten checks on every reply. Three starts, and an older wording, leave one.
r2 = tempfile.mkdtemp(); hm2 = tempfile.mkdtemp(); os.makedirs(os.path.join(r2, ".claude")); os.makedirs(os.path.join(hm2, ".claude"))
PR = "You check the final reply that Claude wrote to Michael, a factory safety manager who reads it in Hebrew. Input JSON: $ARGUMENTS"
json.dump({"hooks": {"Stop": [{"hooks": [{"type": "command", "command": 'python3 "$CLAUDE_PROJECT_DIR"/x.py'}]}, {"hooks": [{"type": "prompt", "prompt": PR + " 8 rules"}]}]}},
          open(os.path.join(r2, ".claude", "settings.json"), "w"))
json.dump({"hooks": {"Stop": [{"hooks": [{"type": "prompt", "prompt": PR + " 6 rules"}]}, {"hooks": [{"type": "prompt", "prompt": "someone else's check"}]}]}},
          open(os.path.join(hm2, ".claude", "settings.json"), "w"))
for _ in range(3):
    subprocess.run([sys.executable, hook("session-start.py")], input="{}", capture_output=True, text=True, timeout=30,
                   env=dict(os.environ, CLAUDE_PROJECT_DIR=r2, HOME=hm2, CLAUDE_CODE_REMOTE="true"))
ps = [h["prompt"] for g in json.load(open(os.path.join(hm2, ".claude", "settings.json")))["hooks"]["Stop"] for h in g["hooks"] if h.get("type") == "prompt"]
check("three starts: the repo's prompt hook once, the old wording replaced, a foreign prompt kept",
      sorted(ps) == sorted([PR + " 8 rules", "someone else's check"]), ps)
# Lesson 116 (18/10/2026): CLAUDE.md told a session to write ~/.claude/settings.json by hand, it kept
# "$CLAUDE_PROJECT_DIR" in the path, and every prompt and trigger of a nine-agent session was refused.
_cm = open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "CLAUDE.md"), encoding="utf-8").read()
check("CLAUDE.md turns hooks on through session-start.py, not by hand (lesson 116)",
      "python3 .claude/hooks/session-start.py" in _cm and "לפני כל פקודה" not in _cm)
done()
