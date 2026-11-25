#!/usr/bin/env python3
"""Action cards (25/11/2026, Michael: "a method so nothing is missed, that you always remember to reach the information
you have... and save tokens"; DECISIONS 25/11/2026). The cards live in project-files/action-cards.md, one table row
each: id | when | then | text | source. This module parses them and matches them to an action; the PreToolUse hook
(action-card.py), the Stop hook (action-complete.py) and the server (functions/_cards.js, built here) use it.

  python3 tools/action-cards.py --write   rebuild functions/_cards.js from the table
  python3 tools/action-cards.py --check   exit 1 when functions/_cards.js is stale or a card is too long
  python3 tools/action-cards.py --index   one short line per card (session start)
"""
import json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
SRC = os.path.join(ROOT, 'project-files', 'action-cards.md')
JS = os.path.join(ROOT, 'functions', '_cards.js')
MAX = 500
KEYS = ('tool', 'op', 'to', 'file')


def split_row(line):
    cells, cur, i = [], '', 0
    s = line.strip().strip('|')
    while i < len(s):
        if s[i] == '\\' and i + 1 < len(s) and s[i + 1] == '|':
            cur += '|'; i += 2; continue
        if s[i] == '|':
            cells.append(cur.strip()); cur = ''; i += 1; continue
        cur += s[i]; i += 1
    cells.append(cur.strip())
    return cells


def parse(path=SRC):
    with open(path, encoding='utf-8') as f:
        text = f.read()
    body = text.split('<!-- cards -->', 1)[1] if '<!-- cards -->' in text else ''
    cards = []
    for line in body.splitlines():
        if not line.startswith('|') or re.match(r'^\|\s*-', line):
            continue
        c = split_row(line)
        if len(c) < 5 or c[0] in ('מזהה', ''):
            continue
        when = {}
        for tok in c[1].split():
            k, _, v = tok.partition('=')
            if k in KEYS and v:
                when[k] = v
        cards.append({'id': c[0], 'when': when, 'then': c[2], 'text': c[3], 'src': c[4]})
    return cards


def _routine_json(cmd):
    """The JSON a routine-db.sh call sends: inline in quotes, or @file (the b64 body is dropped)."""
    m = re.search(r"routine-db\.sh\s+@(\S+)", cmd)
    if m:
        try:
            with open(m.group(1).strip('\'"'), encoding='utf-8') as f:
                d = json.load(f)
            d.pop('b64', None)
            return d
        except Exception:
            return None
    m = re.search(r"routine-db\.sh\s+'(\{.*?\})'", cmd, re.S)
    if m:
        try:
            return json.loads(m.group(1))
        except Exception:
            return None
    return None


def facts(tool, tool_input):
    """tool, op, to, file, text for one action."""
    inp = tool_input or {}
    if tool == 'Bash':
        cmd = str(inp.get('command') or '')
        d = _routine_json(cmd)
        ops = re.findall(r"""['"]op['"]\s*:\s*['"](\w+)['"]""", cmd)
        if d:
            att = d.get('attach') or []
            return {'tool': tool, 'op': str(d.get('op') or ''), 'to': ' '.join(str(d.get(k) or '') for k in ('to', 'cc')),
                    'file': ' '.join([str(d.get(k) or '') for k in ('name', 'path', 'dir', 'replaced_by', 'old', 'new')] + [str(a) for a in att]),
                    'text': cmd}
        return {'tool': tool, 'op': ' '.join(ops), 'to': cmd, 'file': cmd, 'text': cmd} if ops else {'tool': tool, 'op': '', 'to': '', 'file': '', 'text': cmd}
    text = json.dumps(inp, ensure_ascii=False)
    return {'tool': tool, 'op': str(inp.get('op') or ''), 'to': text, 'file': text, 'text': text}


def match(card, f):
    w = card['when']
    if not w:
        return False
    for k, rx in w.items():
        val = f.get(k) or ''
        try:
            if k == 'op':
                if not any(re.fullmatch(rx, o) for o in val.split()):
                    return False
            elif not re.search(rx, val, re.I):
                return False
        except re.error:
            return False
    return True


def for_action(cards, tool, tool_input):
    f = facts(tool, tool_input)
    return [c for c in cards if match(c, f)]


def render(cards):
    return '\n'.join('\U0001F4CC ' + c['id'] + ': ' + c['text'] + ' (' + c['src'] + ')' for c in cards)


def index_line(cards):
    return 'כרטיסי פעולה (project-files/action-cards.md): ' + '; '.join(
        c['id'] + ' [' + ' '.join(k + '=' + v for k, v in c['when'].items()) + ']' for c in cards)


def js_text(cards):
    # a tool-only card (delete_trigger, create_session) is for Claude sessions; the server never sees those tools
    slim = [{'id': c['id'], 'when': c['when'], 'text': c['text'], 'src': c['src']} for c in cards if 'tool' not in c['when']]
    return ('// Built by tools/action-cards.py --write from project-files/action-cards.md (25/11/2026). Do not edit.\n'
            '// cardsFor(body): the action cards for one routine-db request, returned to the assistant in `cards`.\n'
            'export const CARDS = ' + json.dumps(slim, ensure_ascii=True, indent=1) + ';\n'
            'export function cardsFor(body) {\n'
            '  if (!body || typeof body !== \'object\') return [];\n'
            '  const op = String(body.op || \'\');\n'
            '  const to = [body.to, body.cc].map((x) => String(x || \'\')).join(\' \');\n'
            '  const file = [body.name, body.path, body.dir, body.replaced_by, body.old, body.new].map((x) => String(x || \'\')).concat((body.attach || []).map(String)).join(\' \');\n'
            '  const f = { tool: \'routine-db\', op, to, file };\n'
            '  return CARDS.filter((c) => Object.keys(c.when).length && Object.keys(c.when).every((k) => {\n'
            '    if (k === \'tool\') return false;\n'
            '    try { return k === \'op\' ? new RegExp(\'^(?:\' + c.when[k] + \')$\').test(op) : new RegExp(c.when[k], \'i\').test(f[k]); } catch (e) { return false; }\n'
            '  })).map((c) => c.id + \': \' + c.text + \' (\' + c.src + \')\');\n'
            '}\n')


def main():
    cards = parse()
    if '--index' in sys.argv:
        print(index_line(cards)); return 0
    long_ = [c['id'] for c in cards if len(c['text']) > MAX]
    want = js_text(cards)
    if '--write' in sys.argv:
        with open(JS, 'w', encoding='utf-8') as f:
            f.write(want)
        print('wrote', JS, len(cards), 'cards')
    if '--check' in sys.argv:
        try:
            have = open(JS, encoding='utf-8').read()
        except OSError:
            have = ''
        if have != want:
            print('functions/_cards.js is stale: python3 tools/action-cards.py --write'); return 1
        if long_:
            print('cards over', MAX, 'chars:', long_); return 1
        print('ok', len(cards), 'cards')
    return 0


if __name__ == '__main__':
    sys.exit(main())
