#!/usr/bin/env bash
# Tapugan Safety - VM notifier: one-shot install on a small Linux server
# (Ubuntu / Debian). Run as root:  sudo bash install-linux.sh
# Puts the script in /opt/tapugan-notifier, runs it as a systemd service
# (starts on boot, restarts on failure). Re-runnable.
set -euo pipefail
DIR=/opt/tapugan-notifier
SRC="$(cd "$(dirname "$0")" && pwd)"

apt-get update -qq
apt-get install -y -qq python3 python3-requests >/dev/null

id -u notifier >/dev/null 2>&1 || useradd --system --home "$DIR" --shell /usr/sbin/nologin notifier
mkdir -p "$DIR"
cp "$SRC/notify.py" "$DIR/"
[ -f "$DIR/config.json" ] || cp "$SRC/config.example.json" "$DIR/config.json"
chown -R notifier:notifier "$DIR"
chmod 600 "$DIR/config.json"

cp "$SRC/notifier.service" /etc/systemd/system/tapugan-notifier.service
systemctl daemon-reload
systemctl enable tapugan-notifier >/dev/null

# Guided setup (no editor needed — works from a phone): asks three questions,
# writes config.json for Gmail SMTP, sends a test e-mail, starts the service.
if [ -t 0 ] && [ "${NO_WIZARD:-}" != "1" ]; then
  echo
  echo "=== Setup (press Enter to keep a default) ==="
  echo "Send FROM which kind of mailbox?"
  echo "  1) Gmail / Google Workspace   (needs an APP password: Google Account > App passwords)"
  echo "  2) Microsoft 365 / Outlook    (the mailbox password; IT may need to enable SMTP AUTH)"
  echo "  3) Brevo API over HTTPS       (for cloud servers where SMTP ports are blocked, e.g. DigitalOcean;"
  echo "                                 free account at brevo.com, verify the sender address by e-mail link)"
  read -r -p "Choose 1, 2 or 3 [1]: " PROVIDER; PROVIDER="${PROVIDER:-1}"
  read -r -p "Address that SENDS (e.g. sviva@tapugan.co.il): " SENDER
  if [ "$PROVIDER" = "2" ]; then
    read -r -s -p "Password of that mailbox: " APPPW; echo
  elif [ "$PROVIDER" = "3" ]; then
    read -r -s -p "Brevo API key (brevo.com > SMTP & API > API Keys): " APPPW; echo
  else
    read -r -s -p "Gmail APP password (16 chars): " APPPW; echo
  fi
  read -r -p "Send TO [sviva@tapugan.co.il]: " TO; TO="${TO:-sviva@tapugan.co.il}"
  if [ -n "$SENDER" ] && [ -n "$APPPW" ]; then
    python3 - "$DIR/config.json" "$SENDER" "$APPPW" "$TO" "$PROVIDER" <<'PY'
import json, sys
path, sender, pw, to, provider = sys.argv[1:6]
cfg = {
  "supabase_url": "https://znhjtpcltrxxyfjczgvw.supabase.co",
  "supabase_key": "sb_publishable_N2ihyyjK_qZEyB0vqunNtQ_oi4roa0M",
  "app_url": "https://tapugan-safety.pages.dev",
  "to": to, "poll_seconds": 60
}
if provider == "3":
    cfg["mode"] = "brevo"
    cfg["brevo"] = {"api_key": pw.strip(), "from": sender, "name": "Tapugan Safety"}
elif provider == "2":
    cfg["mode"] = "smtp"
    cfg["smtp"] = {"host": "smtp.office365.com", "port": 587, "user": sender, "password": pw, "from": sender}
else:
    cfg["mode"] = "smtp"
    cfg["smtp"] = {"host": "smtp.gmail.com", "port": 465, "user": sender, "password": pw.replace(" ", ""), "from": sender}
json.dump(cfg, open(path, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
PY
    chown notifier:notifier "$DIR/config.json"; chmod 600 "$DIR/config.json"
    echo "config.json written. Sending a test e-mail to $TO ..."
    if sudo -u notifier python3 "$DIR/notify.py" --test-email; then
      systemctl restart tapugan-notifier
      echo
      echo "=== Done. The notifier is running and starts on boot. ==="
      echo "In the app: bell > 'ליקוי מנאמן בטיחות' > leave Email UNticked (this server sends it), Save."
      exit 0
    else
      echo
      echo "The test e-mail FAILED. 'timed out' = this cloud blocks SMTP ports -> run again and choose 3 (Brevo)."
      echo "Gmail: check the APP password. Microsoft 365: 'SMTP AUTH disabled' means IT must enable Authenticated SMTP"
      echo "for this mailbox (admin.microsoft.com > Users > Mail > Manage email apps). Brevo: verify the sender first. Then run:"
      echo "  sudo bash $SRC/install-linux.sh     (to answer the questions again)"
      exit 1
    fi
  fi
fi

echo
echo "Installed to $DIR."
echo "1) Edit $DIR/config.json  (mode: smtp, to:, smtp host/user/password)"
echo "2) Test the mail path:    sudo -u notifier python3 $DIR/notify.py --test-email"
echo "3) Start:                 sudo systemctl restart tapugan-notifier"
echo "   Log:                   sudo journalctl -u tapugan-notifier -f"
