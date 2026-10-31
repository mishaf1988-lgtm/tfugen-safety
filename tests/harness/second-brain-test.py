# second-brain.py (31/10/2026): a Stop hook that stops "does not work / cannot" said with no check in the turn,
# and a proposal that looks like a part on the system map with no look at card.md.
import json, os, subprocess, sys, tempfile
H = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", ".claude", "hooks", "second-brain.py")
p_ok = f_ok = 0
def check(l, c, d=None):
    global p_ok, f_ok
    if c: p_ok += 1; print("  ✓ " + l)
    else: f_ok += 1; print("  ✗ " + l + ("  -> " + repr(d) if d is not None else ""))
root = tempfile.mkdtemp()
os.makedirs(os.path.join(root, "project-files", "system-map"))
open(os.path.join(root, "project-files", "system-map", "card.md"), "w", encoding="utf-8").write(
    "# x\n\n## פיתוח\n- פיתוח מיידי: פיתוח מיידי לבקשה מהעוזר\n")
def run(msgs, active=False):
    f = tempfile.NamedTemporaryFile("w", delete=False, suffix=".jsonl", encoding="utf-8")
    for m in msgs: f.write(json.dumps(m, ensure_ascii=False) + "\n")
    f.close()
    p = subprocess.run([sys.executable, H], input=json.dumps({"transcript_path": f.name, "stop_hook_active": active}),
                       capture_output=True, text=True, encoding="utf-8", env={**os.environ, "CLAUDE_PROJECT_DIR": root})
    return p.stdout
U = {"type": "user", "message": {"role": "user", "content": "q"}}
A = lambda t: {"type": "assistant", "message": {"role": "assistant", "content": [{"type": "text", "text": t}]}}
T = lambda n, i: {"type": "assistant", "message": {"role": "assistant", "content": [{"type": "tool_use", "name": n, "input": i}]}}
NOTWORK = "דיווח השגיאות לא עובד"
check("'does not work' with no check in the turn: blocked", '"block"' in run([U, A(NOTWORK)]))
check("...with a database read in the turn: passes", run([U, T("mcp__Supabase__execute_sql", {"query": "select 1"}), A(NOTWORK)]) == "")
check("...a check from before the user's last message does not count", '"block"' in run([T("mcp__Supabase__execute_sql", {}), U, A(NOTWORK)]))
PROPOSE = "אפשר לחבר תיקון: פיתוח מיידי לבקשה מהעוזר"
o = run([U, A(PROPOSE)])
check("a proposal like a part on the map: blocked, naming card.md", '"block"' in o and "card.md:4" in o, o)
check("...after reading card.md in the turn: passes", run([U, T("Bash", {"command": "grep -i x project-files/system-map/card.md"}), A(PROPOSE)]) == "")
check("a plain reply: passes", run([U, A("הטיוטה מוכנה")]) == "")
check("never twice in a row (stop_hook_active)", run([U, A(NOTWORK)], active=True) == "")
cfg = json.load(open(os.path.join(os.path.dirname(H), "..", "settings.json"), encoding="utf-8"))
check("registered as a Stop hook", any("second-brain.py" in h.get("command", "") for g in cfg["hooks"]["Stop"] for h in g["hooks"]))
print("\n%d passed, %d failed" % (p_ok, f_ok))
sys.exit(1 if f_ok else 0)
