#!/usr/bin/env python3
"""No secret written in any file of the repo (11/10/2026, Michael: "מאשר את סריקת הסודות").

The repo is public. On 11/10/2026 the backup Worker's MANUAL_KEY was found in plain text in
project-files/INFRA-2026-05-06.md, where it had been since 05/2026 (#1379). This scans every
tracked text file for:
  - provider tokens: Anthropic, Supabase secret, GitHub, AWS, Slack, Resend, Google, private keys;
  - a Supabase JWT whose payload says service_role (the anon key is public, it may stay);
  - a random-looking value (24+ letters and digits, both) right after a name with KEY / SECRET /
    TOKEN / PASSWORD in it.
PUBLIC: values that are public by design. A value found here: move it to Cloudflare / the
environment, write only the NAME in the repo, and change it where it is used.
"""
import base64, json, os, re, subprocess, sys

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..')
ok = bad = 0
PUBLIC = {
    '0x4AAAAAAFKxZEGectSBXS2S',  # Turnstile site key, shown to every browser (index.html)
    'sb_publishable_N2ihyyjK_qZEyB0vqunNtQ_oi4roa0M',  # Supabase publishable key, in the page
    'sb_publishable_zITtcP-mcfm8Jv6nBmqFjg_zXpCFdL1',  # the same for the test database (staging), in the page
}
SKIP_EXT = re.compile(r'\.(png|jpe?g|gif|pdf|xlsx|docx|pptx|woff2?|ico|zip|mp4)$', re.I)
B = r'(?<![A-Za-z0-9+/_-])'
TOKEN = re.compile(B + r'(sk-ant-[A-Za-z0-9_-]{20,}|sb_secret_[A-Za-z0-9_-]{10,}|ghp_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,}|AKIA[A-Z0-9]{16}|xox[bpa]-[A-Za-z0-9-]{20,}|-----BEGIN [A-Z ]*PRIVATE KEY-----|re_[A-Za-z0-9]{8}_[A-Za-z0-9]{20,}|AIza[A-Za-z0-9_-]{35})(?![A-Za-z0-9+/=])')
JWT = re.compile(B + r'eyJ[A-Za-z0-9_-]{15,}\.(eyJ[A-Za-z0-9_-]{15,})\.[A-Za-z0-9_-]{20,}')
ASSIGN = re.compile(r'(?i)(key|secret|token|password|passwd)[A-Za-z_*]*[^\n]{0,8}?[=:|][^\n]{0,6}?[`\'"]([A-Za-z0-9_-]{24,})[`\'"]')


def check(label, cond, detail=None):
    global ok, bad
    if cond: ok += 1; print('  ✓ ' + label)
    else: bad += 1; print('  ✗ ' + label + ('  -> ' + str(detail) if detail is not None else ''))


def randomish(v):
    return sum(c.isdigit() for c in v) >= 3 and sum(c.isalpha() for c in v) >= 6 and '_' not in v


def role(seg):
    try: return json.loads(base64.urlsafe_b64decode(seg + '=' * (-len(seg) % 4))).get('role')
    except Exception: return None


def scan(text):
    out = []
    for m in TOKEN.finditer(text):
        if m.group(1) not in PUBLIC: out.append(m.group(1)[:12] + '...')
    for m in JWT.finditer(text):
        if role(m.group(1)) == 'service_role': out.append('service_role JWT')
    for m in ASSIGN.finditer(text):
        v = m.group(2)
        if v not in PUBLIC and randomish(v): out.append(m.group(1) + ': ' + v[:4] + '...')
    return out


print('the scanner itself')
check('catches the old MANUAL_KEY line', bool(scan('| **MANUAL_KEY** | `' + 'o4wmn03tz1talr4g6rv' + '6zeulzw95ie41` |')))
check('catches a provider token', bool(scan('ANTHROPIC_KEY = "sk-ant-' + 'api03-abcdefghijklmnopqrstuvwxyz"')))
check('catches a service_role JWT, not the anon one', bool(scan('eyJhbGciOiJIUzI1NiJ9.' + base64.urlsafe_b64encode(b'{"role":"service_role","iss":"supabase"}').decode().rstrip('=') + '.abcdefghijklmnopqrstuvwxyz')) and not scan('eyJhbGciOiJIUzI1NiJ9.' + base64.urlsafe_b64encode(b'{"role":"anon","iss":"supabase"}').decode().rstrip('=') + '.abcdefghijklmnopqrstuvwxyz'))
check('names and words are not secrets', not scan("secret` = `TRUSTEE_NOTIFY_SECRET`") and not scan("KEY='tfgn_dash_stats_open'") and not scan('"cache_read_input_tokens"'))
check('a base64 picture is not a token', not scan("'/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAUDBAQEAwUEBAQFBQUGBwwIBwcHBw8LCwkMEQ8SEhEPERETFhwXExQaFRERGCEYGh0dHx8fExciJCIeJB'"))

print('\nthe repo (every tracked text file)')
files = subprocess.run(['git', 'ls-files'], cwd=ROOT, capture_output=True, text=True).stdout.split()
check('git ls-files works', len(files) > 100, len(files))
found = []
for f in files:
    if SKIP_EXT.search(f): continue
    try: t = open(os.path.join(ROOT, f), encoding='utf-8').read()
    except Exception: continue
    for x in scan(t):
        found.append(f + ': ' + x)
check('no secret in any file', not found, found[:10])
print('\n%d passed, %d failed' % (ok, bad))
sys.exit(1 if bad else 0)
