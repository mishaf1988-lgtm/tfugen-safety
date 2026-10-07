#!/usr/bin/env python3
"""PreToolUse guard for the Microsoft 365 connector (Michael, 05/10/2026, questionnaire):
mail = drafts only, never send; delete = never, not even with approval; files =
written only inside the safety folder; Teams and calendar = read only; every
allowed write needs the word "בצע" from Michael for that exact action.

A rule in a hook runs on every call. The skill (michael-assistant, references/m365.md)
carries the same rules for chat and Cowork, where there are no hooks.

The connector's tool names change between sessions (a UUID prefix, a renamed
server), so the decision is by words in the tool name, not by an exact list:
  deny  : delete / remove / send / reply / forward / move / rename / share /
          any write to Teams, chat or calendar
  ask   : a draft, or a file written inside the safety folder (Michael's "בצע"
          is the answer to the prompt)
  deny  : a file write whose path is outside the safety folder
  pass  : read, search, list, get, find
  ask   : anything else (fail safe)

Shell tools: Bash, and PowerShell on Windows (Move-Item / Remove-Item passed unchecked there,
07/10/2026). Same `command` field, same rules. The one exception (m365-guard (4), Michael
07/10/2026): inside `שולחן העבודה\סקילים להעלאה` a move between the folder and its subfolders,
with literal paths and the file name kept, and appending lines to `יומן.txt`. Delete, rename,
overwrite and a move out of the folder stay denied there too.

Test:  echo '{"tool_name":"mcp__Microsoft_365__outlook_send_mail","tool_input":{}}' | python3 .claude/hooks/guard-365.py
"""
import json, re, sys
sys.stdin.reconfigure(encoding="utf-8")  # Claude Code sends UTF-8; Windows reads cp1255 (05/10/2026)

SAFETY_FOLDER = "ניהול בטיחות"  # the one OneDrive folder Claude may write in
M365 = re.compile(r"365|outlook|sharepoint|onedrive|teams|graph|mail|calendar|drive", re.I)
READ = re.compile(r"(^|_)(read|search|list|get|find|lookup|me)(_|$)", re.I)
# Whole words between underscores: "share" must not match sharepoint_folder_search.
NEVER = re.compile(r"(^|_)(delete|remove|trash|purge|destroy|send|reply|forward|rename|share|permission|invite|cancel|settings?|rules?)(_|$)", re.I)
# A move is the one way to "delete": into a folder named "למחיקה" that Michael empties himself.
MOVE = re.compile(r"(^|_)(move|copy)(_|$)", re.I)
TRASH_FOLDER = "\u05dc\u05de\u05d7\u05d9\u05e7\u05d4"  # "למחיקה"
# The OneDrive folder synced to Michael's computer is the same data: a shell delete or move there
# reaches the cloud through sync, and a curl to Graph is the connector without the connector.
# A command word followed by its arguments: "rm/mv" inside a commit message is prose, not a
# delete (the hook blocked its own commit, 05/10/2026). A heredoc that quotes a delete still
# trips it: write such text with Edit/Write, not through Bash.
# The verb may also end a pipeline ("... | Remove-Item"), and .NET calls delete without a verb.
SHELL_DEL = re.compile(r"(^|[\s;&|({])(rm|rmdir|del|erase|rd|mv|move|mi|Remove-Item|Move-Item|ri|rni|ren|Rename-Item|git\s+clean)(?=\s+\S|\s*($|[;|)}]))"
                       r"|(\[(System\.)?IO\.(File|Directory)\]::(Delete|Move|Replace))", re.I)
SHELLS = ("Bash", "PowerShell")
ONEDRIVE_PATH = re.compile(r"OneDrive|\u05e9\u05d5\u05dc\u05d7\u05df \u05d4\u05e2\u05d1\u05d5\u05d3\u05d4|\u05e0\u05d9\u05d4\u05d5\u05dc \u05d1\u05d8\u05d9\u05d7\u05d5\u05ea|tapugancoil-my\.sharepoint", re.I)
# curl, and PowerShell's Invoke-RestMethod / Invoke-WebRequest (-Method Post, -Body).
_GW = r"(-X\s*(POST|DELETE|PATCH|PUT)|--request\s*(POST|DELETE|PATCH|PUT)|-d\s|--data|-Method\s+['\"]?(POST|DELETE|PATCH|PUT)|-Body\b)"
GRAPH_WRITE = re.compile(r"graph\.microsoft\.com.*?(" + _GW + r"|sendMail)|" + _GW + r".*?graph\.microsoft\.com", re.I | re.S)
# m365-guard (4): the skill upload folder. A source must be inside it, a destination inside or the folder itself.
UPLOAD_DIR = r"\u05e9\u05d5\u05dc\u05d7\u05df \u05d4\u05e2\u05d1\u05d5\u05d3\u05d4[\\/]+\u05e1\u05e7\u05d9\u05dc\u05d9\u05dd \u05dc\u05d4\u05e2\u05dc\u05d0\u05d4"
IN_UPLOAD = re.compile(UPLOAD_DIR + r"[\\/]+[^\\/]")
AT_UPLOAD = re.compile(UPLOAD_DIR + r"([\\/]|$)")
SHELL_MOVE = re.compile(r"^(mv|move|mi|Move-Item)$", re.I)
UPLOAD_LOG = "\u05d9\u05d5\u05de\u05df.txt"  # "יומן.txt": lines are only added at its end
# On a segment that names the log: anything but an append ("Add-Content", ">>", "Out-File -Append").
LOG_OVERWRITE = re.compile(r"(^|[\s;&|({])(Set-Content|sc|Clear-Content|clc)\b|(?<![>\d&])>(?![>&])|\bOut-File\b(?!.*-Append)", re.I)
SEGMENTS = re.compile(r"\|\||&&|[;|\n]")
PEOPLE_WRITE = re.compile(r"(teams|chat|channel|calendar|event|meeting)", re.I)
WRITE = re.compile(r"create|update|write|upload|put|patch|copy|draft|edit|set|add|append|replace", re.I)
FILEISH = re.compile(r"file|folder|drive|sharepoint|onedrive|upload|item", re.I)


def out(decision, reason):
    print(json.dumps({"hookSpecificOutput": {
        "hookEventName": "PreToolUse",
        "permissionDecision": decision,
        "permissionDecisionReason": "guard-365: " + reason}}))


def _base(p):
    return re.split(r"[\\/]+", p.rstrip("\\/"))[-1]


def upload_move_ok(args):
    """A move that stays inside the upload folder and keeps the file name (m365-guard (4))."""
    toks = [t.strip("\"'") for t in re.findall(r'"[^"]*"|\'[^\']*\'|\S+', args)]
    srcs, dst, pos, i = [], None, [], 0
    while i < len(toks):
        t = toks[i].lower()
        if t in ("-destination", "-dest"):
            dst = toks[i + 1] if i + 1 < len(toks) else None; i += 2; continue
        if t in ("-path", "-literalpath", "-lp"):
            if i + 1 < len(toks): srcs.append(toks[i + 1])
            i += 2; continue
        if t.startswith("-"):
            if t in ("-force", "-f", "--force"):
                return False  # overwrites a file that is already there
            i += 1; continue
        pos.append(toks[i]); i += 1
    if dst is None and pos:
        dst = pos.pop()
    srcs += pos
    if not srcs or not dst or any(".." in p for p in srcs + [dst]):
        return False
    if not AT_UPLOAD.search(dst) or not all(IN_UPLOAD.search(p) for p in srcs):
        return False  # literal paths only: a variable could point anywhere
    if re.search(r"[\\/]$", dst):
        return True
    b = _base(dst)
    # Same name = a move; a name with no dot = a subfolder; anything else = a rename.
    return all(_base(p) == b for p in srcs) or "." not in b


def shell_onedrive(cmd):
    """Why a shell command that names the synced OneDrive folder is denied, or None."""
    for seg in SEGMENTS.split(cmd):
        if UPLOAD_LOG in seg and LOG_OVERWRITE.search(seg):
            return ("a shell write that overwrites or empties '%s'. m365-guard (4), Michael 07/10/2026: lines are only "
                    "added at its end (Add-Content, >>, Out-File -Append)." % UPLOAD_LOG)
        m = SHELL_DEL.search(seg)
        if not m:
            continue
        verb = m.group(2) or ""
        if SHELL_MOVE.match(verb) and upload_move_ok(seg[m.end(2):]):
            continue
        return ("a shell delete, move or rename inside the synced OneDrive folder. It reaches the cloud "
                "through sync. Michael (05/10/2026): never delete in 365; a file to remove goes to a 'למחיקה' folder, by him. "
                "The one exception (m365-guard (4), 07/10/2026): a move between 'סקילים להעלאה' and its subfolders, "
                "with literal paths, the file name kept and no -Force.")
    return None


def strings(v, acc):
    if isinstance(v, dict):
        for x in v.values(): strings(x, acc)
    elif isinstance(v, list):
        for x in v: strings(x, acc)
    elif isinstance(v, str):
        acc.append(v)
    return acc


def decide(name, ti):
    if name in SHELLS:
        cmd = str(ti.get("command", ""))
        if GRAPH_WRITE.search(cmd):
            return ("deny", "a direct Graph write (curl / Invoke-RestMethod to graph.microsoft.com with POST/DELETE/PATCH/PUT). "
                    "Michael (05/10/2026): Microsoft 365 is written only through the connector, under its rules.")
        if ONEDRIVE_PATH.search(cmd):
            why = shell_onedrive(cmd)
            if why:
                return ("deny", why)
        return None
    short = name.split("__")[-1] if "__" in name else name
    if not M365.search(name):
        return None
    if READ.search(short) and not WRITE.search(short) and not NEVER.search(short):
        return None
    if MOVE.search(short):
        if any(TRASH_FOLDER in s for s in strings(ti, [])):
            return ("ask", "'%s' moves something into the 'למחיקה' folder. Allowed only with Michael's word 'בצע' "
                    "for this exact item, after it was shown to him." % short)
        return ("deny", "'%s' moves or copies something in Microsoft 365. Michael (05/10/2026): the only move allowed is "
                "into a 'למחיקה' folder (with his 'בצע'); everything else stays where it is." % short)
    if NEVER.search(short):
        return ("deny", "'%s' deletes, sends or moves something in Microsoft 365. Michael (05/10/2026): "
                "never through Claude, not even with approval. A mail is a draft that he sends from Outlook; "
                "a file to remove goes to a 'למחיקה' folder that he empties." % short)
    if PEOPLE_WRITE.search(short) and WRITE.search(short):
        return ("deny", "'%s' writes to Teams or the calendar. Michael (05/10/2026): read only there." % short)
    if WRITE.search(short):
        if FILEISH.search(short) and "draft" not in short.lower():
            vals = strings(ti, [])
            pathy = [s for s in vals if "/" in s or "\\" in s]
            if pathy and not any(SAFETY_FOLDER in s for s in vals):
                return ("deny", "'%s' writes a file outside the safety folder ('%s'). Michael (05/10/2026): "
                        "files are written only there." % (short, SAFETY_FOLDER))
        return ("ask", "'%s' writes to Microsoft 365. Allowed only with Michael's word 'בצע' for this exact "
                "action, after it was shown to him (what, where, to whom). Then log it in the Claude Log sheet." % short)
    return ("ask", "'%s' is not a known read tool of Microsoft 365. Michael's 'בצע' is needed." % short)


if __name__ == "__main__":
    d = json.load(sys.stdin)
    r = decide(str(d.get("tool_name", "")), d.get("tool_input", {}) or {})
    if r:
        out(*r)
    else:
        print("{}")
