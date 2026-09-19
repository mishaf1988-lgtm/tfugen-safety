#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Tapugan Safety — VM notifier.

Runs on an always-on machine (Michael's virtual PC) and emails the safety
officer FROM HIS OWN MAILBOX every time a trustee saves a hazard
(trustee_reports.ok = false). WhatsApp keeps going out from the server
(functions/api/trustee-notify.js); this script is only the e-mail leg, for
mailboxes that Resend's trial cannot reach.

How it works
  every N seconds: anonymous Supabase session → read hazards from the last
  48 h → for each one not yet in state.json → send one e-mail → remember it.
  The first run only remembers what already exists (no flood of old rows).

Usage
  python notify.py                 run forever (start.bat restarts it if it dies)
  python notify.py --once          one poll and exit
  python notify.py --test-email    send a sample e-mail and exit (checks the mail path)

Config: config.json next to this file (copy config.example.json).
Sending: "mode": "outlook" — through the Outlook that is open on the machine
(Windows, pip install pywin32; no password needed) — or "smtp" (Gmail app
password / Microsoft 365 / any SMTP).
"""
import json
import logging
import os
import smtplib
import ssl
import sys
import time
from datetime import datetime, timedelta, timezone
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.utils import formataddr
from html import escape

import requests

HERE = os.path.dirname(os.path.abspath(__file__))
CONFIG_PATH = os.path.join(HERE, 'config.json')
STATE_PATH = os.path.join(HERE, 'state.json')
LOG_PATH = os.path.join(HERE, 'notifier.log')

LOOKBACK_HOURS = 48          # a hazard older than this is never sent (replays, restarts)
MAX_SEND_ATTEMPTS = 10       # after this many failed sends we give up on that row (logged)
PRUNE_DAYS = 14              # forget ids older than this from state.json

TASKS = {
    1: 'סיור מפגעים באזור', 2: 'מקלחות חירום ושטיפות עיניים', 3: 'דרכי מילוט ויציאות חירום',
    4: 'תקינות סולמות וגישה לגובה', 5: 'עמדות כיבוי אש', 6: 'מגיני מכונות ולחצני עצירה',
    7: 'עזרה ראשונה וציוד מגן', 8: 'מעקב סגירה',
}

log = logging.getLogger('notifier')


# ---------------------------------------------------------------- config / state
def load_config(path=None):
    path = path or CONFIG_PATH
    if not os.path.exists(path):
        raise SystemExit('config.json missing — copy config.example.json to config.json and fill it in')
    with open(path, encoding='utf-8') as f:
        cfg = json.load(f)
    for k in ('supabase_url', 'supabase_key', 'to', 'mode'):
        if not cfg.get(k):
            raise SystemExit('config.json: "%s" is required' % k)
    cfg.setdefault('app_url', 'https://tapugan-safety.pages.dev')
    cfg.setdefault('poll_seconds', 60)
    if cfg['mode'] not in ('outlook', 'smtp'):
        raise SystemExit('config.json: "mode" must be "outlook" or "smtp"')
    if cfg['mode'] == 'smtp':
        s = cfg.get('smtp') or {}
        for k in ('host', 'port', 'user', 'password'):
            if not s.get(k):
                raise SystemExit('config.json: smtp.%s is required in smtp mode' % k)
    return cfg


def load_state(path=None):
    path = path or STATE_PATH
    if not os.path.exists(path):
        return None
    try:
        with open(path, encoding='utf-8') as f:
            st = json.load(f)
        st.setdefault('seen', {})
        st.setdefault('fails', {})
        return st
    except Exception as e:  # corrupt file → start again, but do not flood
        log.warning('state.json unreadable (%s) — starting a fresh state', e)
        return None


def save_state(st, path=None):
    path = path or STATE_PATH
    cutoff = (datetime.now(timezone.utc) - timedelta(days=PRUNE_DAYS)).isoformat()
    st['seen'] = {k: v for k, v in st['seen'].items() if str(v) >= cutoff or v == 'seeded'}
    tmp = path + '.tmp'
    with open(tmp, 'w', encoding='utf-8') as f:
        json.dump(st, f, ensure_ascii=False, indent=1)
    os.replace(tmp, path)


# ---------------------------------------------------------------- supabase
class Session:
    """Anonymous Supabase session (role `authenticated`), refreshed when it expires.
    trustee_reports is readable by any authenticated session — that is all we need."""

    def __init__(self, url, key):
        self.url = url.rstrip('/')
        self.key = key
        self.access = None
        self.refresh = None
        self.expires = 0

    def _apply(self, data):
        self.access = data['access_token']
        self.refresh = data.get('refresh_token')
        self.expires = time.time() + int(data.get('expires_in') or 3600)

    def token(self):
        if self.access and time.time() < self.expires - 60:
            return self.access
        if self.refresh:
            try:
                r = requests.post(self.url + '/auth/v1/token', params={'grant_type': 'refresh_token'},
                                  json={'refresh_token': self.refresh},
                                  headers={'apikey': self.key, 'Content-Type': 'application/json'}, timeout=20)
                if r.ok:
                    self._apply(r.json())
                    return self.access
                log.info('refresh failed (%s) — signing in again', r.status_code)
            except Exception as e:
                log.info('refresh error (%s) — signing in again', e)
        r = requests.post(self.url + '/auth/v1/signup', json={},
                          headers={'apikey': self.key, 'Content-Type': 'application/json'}, timeout=20)
        if not r.ok:
            raise RuntimeError('anonymous sign-in failed: %s %s' % (r.status_code, r.text[:200]))
        self._apply(r.json())
        return self.access

    def invalidate(self):
        self.access = None
        self.expires = 0


def fetch_hazards(sess, cfg):
    since = (datetime.now(timezone.utc) - timedelta(hours=LOOKBACK_HOURS)).isoformat()
    r = requests.get(sess.url + '/rest/v1/trustee_reports',
                     params={'select': 'id,u,t,d,loc,f,ok,s,photo_url,ts', 'ok': 'eq.false',
                             'ts': 'gte.' + since, 'order': 'ts.asc'},
                     headers={'apikey': sess.key, 'Authorization': 'Bearer ' + sess.token()}, timeout=30)
    if r.status_code == 401:
        sess.invalidate()
        raise RuntimeError('session rejected (401) — will sign in again next round')
    if not r.ok:
        raise RuntimeError('read failed: %s %s' % (r.status_code, r.text[:200]))
    rows = r.json()
    return [x for x in rows if isinstance(x, dict) and x.get('id')]


# ---------------------------------------------------------------- e-mail
def clean(s, n=200):
    return ' '.join(str(s if s is not None else '').split())[:n]


def build_email(row, app_url):
    task = TASKS.get(int(row.get('t') or 0), 'משימה %s' % row.get('t'))
    who = clean(row.get('u'), 40)
    loc = clean(row.get('loc') or 'לא צוין', 80)
    finding = clean(row.get('f') or 'ללא תיאור', 300)
    date = clean(row.get('d'), 10)
    subject = '🦺 ליקוי מנאמן בטיחות — %s · %s' % (who, task)
    photo = ''
    if row.get('photo_url') and str(row['photo_url']).startswith('http'):
        photo = '<p><a href="%s">📷 תמונת הממצא</a></p>' % escape(str(row['photo_url']))
    html_body = (
        '<div dir="rtl" style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">'
        '<div style="background:#cc1f1f;padding:16px;text-align:center;border-radius:8px 8px 0 0">'
        '<h1 style="color:#fff;margin:0;font-size:18px">🦺 ליקוי חדש מנאמן בטיחות</h1>'
        '<p style="color:#ffcccc;margin:4px 0 0;font-size:12px">תעשיות תפוגן — ניהול הבטיחות</p></div>'
        '<div style="background:#fff;padding:20px;border:1px solid #e5e7eb;font-size:14px;line-height:1.7">'
        '<p><strong>נאמן:</strong> %s</p><p><strong>משימה:</strong> %s. %s</p><p><strong>תאריך:</strong> %s</p>'
        '<p><strong>מיקום:</strong> %s</p><p><strong>הממצא:</strong> %s</p>%s'
        '<p style="margin-top:16px"><a href="%s" style="background:#cc1f1f;color:#fff;padding:10px 20px;'
        'border-radius:6px;text-decoration:none;font-weight:bold">לניתוב באפליקציה</a></p></div>'
        '<div style="background:#f9fafb;padding:10px;text-align:center;font-size:11px;color:#9ca3af;'
        'border-radius:0 0 8px 8px">נשלח מהמחשב של ממונה הבטיחות כשנאמן שומר ליקוי · מודולים → נאמני בטיחות</div></div>'
    ) % (escape(who), escape(str(row.get('t'))), escape(task), escape(date), escape(loc), escape(finding), photo, escape(app_url))
    text = '%s\nנאמן: %s\nמשימה: %s. %s\nתאריך: %s\nמיקום: %s\nממצא: %s\n%s' % (
        subject, who, row.get('t'), task, date, loc, finding, app_url)
    return subject, html_body, text


def send_outlook(to, subject, html_body):
    import win32com.client  # pip install pywin32 (Windows only)
    outlook = win32com.client.Dispatch('Outlook.Application')
    mail = outlook.CreateItem(0)
    mail.To = to
    mail.Subject = subject
    mail.HTMLBody = html_body
    mail.Send()


def send_smtp(smtp_cfg, to, subject, html_body, text):
    msg = MIMEMultipart('alternative')
    sender = smtp_cfg.get('from') or smtp_cfg['user']
    msg['From'] = formataddr(('Tapugan Safety', sender))
    msg['To'] = to
    msg['Subject'] = subject
    msg.attach(MIMEText(text, 'plain', 'utf-8'))
    msg.attach(MIMEText(html_body, 'html', 'utf-8'))
    port = int(smtp_cfg['port'])
    if port == 465:
        with smtplib.SMTP_SSL(smtp_cfg['host'], port, context=ssl.create_default_context(), timeout=30) as s:
            s.login(smtp_cfg['user'], smtp_cfg['password'])
            s.sendmail(sender, [to], msg.as_string())
    else:
        with smtplib.SMTP(smtp_cfg['host'], port, timeout=30) as s:
            s.ehlo()
            s.starttls(context=ssl.create_default_context())
            s.login(smtp_cfg['user'], smtp_cfg['password'])
            s.sendmail(sender, [to], msg.as_string())


def send_email(cfg, subject, html_body, text):
    if cfg['mode'] == 'outlook':
        send_outlook(cfg['to'], subject, html_body)
    else:
        send_smtp(cfg['smtp'], cfg['to'], subject, html_body, text)


# ---------------------------------------------------------------- one round
def poll_once(cfg, sess, state, sender=send_email):
    """Returns (sent, seeded) counts. `state` is mutated; None → first run (seed only)."""
    rows = fetch_hazards(sess, cfg)
    if state is None:
        state = {'seen': {r['id']: 'seeded' for r in rows}, 'fails': {}}
        save_state(state)
        log.info('first run: %d existing hazard(s) remembered, none sent', len(rows))
        return state, 0, len(rows)
    sent = 0
    now = datetime.now(timezone.utc).isoformat()
    for r in rows:
        rid = r['id']
        if rid in state['seen']:
            continue
        if r.get('ok') is not False:
            continue
        subject, html_body, text = build_email(r, cfg['app_url'])
        try:
            sender(cfg, subject, html_body, text)
            state['seen'][rid] = now
            state['fails'].pop(rid, None)
            sent += 1
            log.info('sent: %s', subject)
        except Exception as e:
            n = int(state['fails'].get(rid, 0)) + 1
            state['fails'][rid] = n
            log.error('send failed (%d/%d) for %s: %s', n, MAX_SEND_ATTEMPTS, rid, e)
            if n >= MAX_SEND_ATTEMPTS:
                state['seen'][rid] = now
                log.error('giving up on %s after %d attempts — check the mail settings', rid, n)
        save_state(state)
    return state, sent, 0


def main(argv):
    logging.basicConfig(level=logging.INFO, format='%(asctime)s %(levelname)s %(message)s',
                        handlers=[logging.FileHandler(LOG_PATH, encoding='utf-8'), logging.StreamHandler(sys.stdout)])
    cfg = load_config()
    if '--test-email' in argv:
        sample = {'id': 'test', 'u': 'בדיקה', 't': 5, 'd': datetime.now().strftime('%Y-%m-%d'),
                  'loc': 'מחסן · מטף מזרחי', 'f': 'הודעת בדיקה מהמחשב הווירטואלי — מטף ללא פלומבה', 'photo_url': None}
        subject, html_body, text = build_email(sample, cfg['app_url'])
        send_email(cfg, subject, html_body, text)
        log.info('test e-mail sent to %s via %s', cfg['to'], cfg['mode'])
        return 0
    sess = Session(cfg['supabase_url'], cfg['supabase_key'])
    state = load_state()
    log.info('notifier started — to=%s mode=%s every %ss', cfg['to'], cfg['mode'], cfg['poll_seconds'])
    while True:
        try:
            state, sent, seeded = poll_once(cfg, sess, state)
        except Exception as e:
            log.error('round failed: %s', e)
        if '--once' in argv:
            return 0
        time.sleep(int(cfg['poll_seconds']))


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
