# coding: utf-8
import os, requests, json
from datetime import datetime, timedelta

SB_URL = os.environ['SUPABASE_URL']
SB_KEY = os.environ['SUPABASE_KEY']
RESEND_KEY = os.environ['RESEND_KEY']
TO_EMAIL = os.environ['TO_EMAIL']

TODAY = datetime.now().date()
THRESHOLDS = [7, 14, 30]

def sb_get(table):
    r = requests.get(
        f"{SB_URL}/rest/v1/{table}?select=*",
        headers={"apikey": SB_KEY, "Authorization": f"Bearer {SB_KEY}"}
    )
    return r.json() if r.ok else []

def days_until(date_str):
    if not date_str:
        return 9999
    try:
        d = datetime.fromisoformat(date_str[:10]).date()
        return (d - TODAY).days
    except:
        return 9999

def build_email():
    docs = sb_get('docs')
    trainings = sb_get('tr')
    audits = sb_get('auds')
    ncrs = sb_get('ncr')

    alerts = []

    # Check documents
    for d in docs:
        days = days_until(d.get('e'))
        if 0 <= days <= 30:
            urgency = "🔴" if days <= 7 else "🟡" if days <= 14 else "🟠"
            alerts.append({
                'type': 'מסמך ISO',
                'name': d.get('n', ''),
                'days': days,
                'urgency': urgency,
                'owner': d.get('o', ''),
                'status': d.get('s', '')
            })

    # Check trainings
    for t in trainings:
        days = days_until(t.get('e'))
        if 0 <= days <= 30:
            urgency = "🔴" if days <= 7 else "🟡" if days <= 14 else "🟠"
            alerts.append({
                'type': 'הדרכה',
                'name': f"{t.get('w', '')} - {t.get('n', '')}",
                'days': days,
                'urgency': urgency,
                'owner': t.get('w', ''),
                'status': t.get('s', '')
            })

    # Check open NCRs past due
    for n in ncrs:
        if n.get('s') != 'סגור':
            days = days_until(n.get('u'))
            if days < 0:
                alerts.append({
                    'type': 'CAPA / אי-התאמה',
                    'name': f"{n.get('num', '')} - {n.get('d', '')[:40]}",
                    'days': days,
                    'urgency': "🔴",
                    'owner': n.get('o', ''),
                    'status': n.get('s', '')
                })

    return alerts

def send_email(alerts):
    today_str = TODAY.strftime('%d/%m/%Y')

    if not alerts:
        subject = f"✅ מערכת הבטיחות תפוגן - הכל תקין | {today_str}"
        body_text = "כל המסמכים וההדרכות בתוקף. אין פקיעות קרובות."
        body_html = f"""
        <div dir="rtl" style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
          <div style="background:#cc1f1f;padding:20px;text-align:center;border-radius:8px 8px 0 0">
            <h1 style="color:white;margin:0;font-size:20px">ניהול הבטיחות ואיכות הסביבה</h1>
            <p style="color:#ffcccc;margin:4px 0 0;font-size:13px">תעשיות תפוגן</p>
          </div>
          <div style="background:#f0fff4;border:1px solid #bbf7d0;padding:24px;border-radius:0 0 8px 8px">
            <h2 style="color:#16a34a;margin-top:0">✅ הכל תקין!</h2>
            <p>אין פקיעות תוקף קרובות. כל המסמכים וההדרכות בתוקף.</p>
            <p style="font-size:12px;color:#666;margin-top:20px">דוח יומי | {today_str} | מיכאל פרייליך - מנהל הבטיחות</p>
          </div>
        </div>
        """
    else:
        alerts.sort(key=lambda x: x['days'])
        critical = [a for a in alerts if a['days'] <= 7]
        warning = [a for a in alerts if 7 < a['days'] <= 14]
        notice = [a for a in alerts if a['days'] > 14]

        subject = f"⚠️ התראת בטיחות תפוגן - {len(alerts)} פריטים דורשים תשומת לב | {today_str}"

        def make_rows(items):
            if not items:
                return ''
            rows = ''
            for a in items:
                color = '#dc2626' if a['days'] <= 7 else '#d97706' if a['days'] <= 14 else '#ea580c'
                days_text = f"עבר יעד!" if a['days'] < 0 else f"{a['days']} ימים"
                rows += f"""
                <tr>
                  <td style="padding:10px;border-bottom:1px solid #f0f0f0">{a['urgency']} {a['type']}</td>
                  <td style="padding:10px;border-bottom:1px solid #f0f0f0;font-weight:bold">{a['name']}</td>
                  <td style="padding:10px;border-bottom:1px solid #f0f0f0;color:{color};font-weight:bold">{days_text}</td>
                  <td style="padding:10px;border-bottom:1px solid #f0f0f0">{a.get('owner','')}</td>
                </tr>"""
            return rows

        body_html = f"""
        <div dir="rtl" style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
          <div style="background:#cc1f1f;padding:20px;text-align:center;border-radius:8px 8px 0 0">
            <h1 style="color:white;margin:0;font-size:20px">ניהול הבטיחות ואיכות הסביבה</h1>
            <p style="color:#ffcccc;margin:4px 0 0;font-size:13px">תעשיות תפוגן | {today_str}</p>
          </div>
          
          <div style="background:white;padding:24px;border:1px solid #e5e7eb">
            <h2 style="color:#cc1f1f;margin-top:0">⚠️ {len(alerts)} פריטים דורשים תשומת לב</h2>
            
            <div style="display:flex;gap:12px;margin-bottom:20px;flex-wrap:wrap">
              {"" if not critical else f'<div style="background:#fef2f2;border:2px solid #dc2626;border-radius:8px;padding:12px 20px;text-align:center"><div style="font-size:24px;font-weight:bold;color:#dc2626">{len(critical)}</div><div style="font-size:12px;color:#991b1b">קריטי (7 ימים)</div></div>'}
              {"" if not warning else f'<div style="background:#fffbeb;border:2px solid #d97706;border-radius:8px;padding:12px 20px;text-align:center"><div style="font-size:24px;font-weight:bold;color:#d97706">{len(warning)}</div><div style="font-size:12px;color:#92400e">אזהרה (14 ימים)</div></div>'}
              {"" if not notice else f'<div style="background:#fff7ed;border:2px solid #ea580c;border-radius:8px;padding:12px 20px;text-align:center"><div style="font-size:24px;font-weight:bold;color:#ea580c">{len(notice)}</div><div style="font-size:12px;color:#9a3412">התראה (30 ימים)</div></div>'}
            </div>

            <table style="width:100%;border-collapse:collapse;font-size:13px">
              <thead>
                <tr style="background:#cc1f1f;color:white">
                  <th style="padding:10px;text-align:right">סוג</th>
                  <th style="padding:10px;text-align:right">שם</th>
                  <th style="padding:10px;text-align:right">נותר</th>
                  <th style="padding:10px;text-align:right">אחראי</th>
                </tr>
              </thead>
              <tbody>
                {make_rows(alerts)}
              </tbody>
            </table>

            <div style="margin-top:20px;padding:16px;background:#f8f9fa;border-radius:8px;text-align:center">
              <a href="https://tfugen-safety.vercel.app" style="background:#cc1f1f;color:white;padding:10px 24px;border-radius:6px;text-decoration:none;font-weight:bold;font-size:14px">
                כנס למערכת לטיפול
              </a>
            </div>
          </div>

          <div style="background:#f9fafb;padding:12px;text-align:center;border-radius:0 0 8px 8px;border:1px solid #e5e7eb;border-top:none">
            <p style="margin:0;font-size:11px;color:#9ca3af">
              מיכאל פרייליך - מנהל הבטיחות | תעשיות תפוגן 2025<br>
              דוח אוטומטי יומי | tfugen-safety.vercel.app
            </p>
          </div>
        </div>
        """

        body_text = f"יש {len(alerts)} פריטים שדורשים תשומת לב. כנס ל: https://tfugen-safety.vercel.app"

    # Send via Resend
    r = requests.post(
        "https://api.resend.com/emails",
        headers={
            "Authorization": f"Bearer {RESEND_KEY}",
            "Content-Type": "application/json"
        },
        json={
            "from": "Safety System Tfugen <onboarding@resend.dev>",
            "to": [TO_EMAIL],
            "subject": subject,
            "html": body_html,
            "text": body_text
        }
    )

    if r.ok:
        print(f"Email sent! ID: {r.json().get('id')}")
        print(f"Total alerts: {len(alerts)}")
    else:
        print(f"Email FAILED: {r.status_code} {r.text}")
        exit(1)

if __name__ == "__main__":
    print(f"Running daily reminders - {TODAY}")
    alerts = build_email()
    print(f"Found {len(alerts)} alerts")
    send_email(alerts)
